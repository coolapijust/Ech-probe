package handler

import (
	"crypto/tls"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"time"
)

type HRRRequest struct {
	Domain string `json:"domain"`
	Port   int    `json:"port"`
}

type HRRResult struct {
	ResolverName      string           `json:"resolverName"`
	ECHConfigDetected bool             `json:"echConfigDetected"`
	ECHConfigDetails  *ECHConfigDetail `json:"echConfigDetails,omitempty"`
	ErrorMessage      string           `json:"errorMessage,omitempty"`
	RawResponse       string           `json:"rawResponse,omitempty"`
}

type ECHConfigDetail struct {
	Version              string `json:"version"`
	VersionHex           string `json:"versionHex"`
	ConfigId             int    `json:"configId"`
	KemId                string `json:"kemId"`
	PublicKeyLength      int    `json:"publicKeyLength"`
	PublicKeyFingerprint string `json:"publicKeyFingerprint"`
	PublicName           string `json:"publicName"`
	RawECHConfig         string `json:"rawECHConfig"`
	HpkeSuite            struct {
		Kem  string `json:"kem"`
		Kdf  string `json:"kdf"`
		Aead string `json:"aead"`
	} `json:"hpkeSuite"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(HRRResult{
			ErrorMessage: "Method not allowed",
		})
		return
	}

	var req HRRRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(HRRResult{
			ErrorMessage: "Invalid request body: " + err.Error(),
		})
		return
	}

	if req.Domain == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(HRRResult{
			ErrorMessage: "Domain is required",
		})
		return
	}

	if req.Port == 0 {
		req.Port = 443
	}

	result := performHRR(req.Domain, req.Port)
	json.NewEncoder(w).Encode(result)
}

// buildFakeECHConfigList 动态构造一个格式正确但密钥无效的 ECH config list。
// public_name 设为目标域名，这样当 Go 校验 outer SNI 对应的证书时能够匹配。
// 使用 DHKEM(X25519) + 32 字节全零公钥（无效，服务器必然拒绝），
// 从而触发 ECHRejectionError 并取回服务器真实的 RetryConfigList。
func buildFakeECHConfigList(publicName string) []byte {
	pubNameBytes := []byte(publicName)

	// --- ECHConfigContents (RFC 9180 §4 / draft-ietf-tls-esni-18 §4) ---
	// config_id         u8
	// kem_id            u16
	// public_key        u16 + bytes
	// cipher_suites     u16 + (kdf_id u16 + aead_id u16)...
	// maximum_name_length u8
	// public_name       u8 + bytes   (opaque<1..255>)
	// extensions        u16
	var body []byte
	body = append(body, 0x01)                                   // config_id
	body = append(body, 0x00, 0x20)                             // kem_id: DHKEM(X25519, HKDF-SHA256)
	// X25519 公钥：合法的非低阶点，但不对应任何私钥，服务器 HPKE 解密必然失败，
	// 从而触发 ECH rejection 并返回真实的 RetryConfigList。
	// 不能用全零（低阶点），Go crypto/ecdh 会在本地直接拒绝。
	fakePublicKey := []byte{
		0x67, 0x2c, 0x4e, 0x1d, 0x8f, 0x3a, 0xb5, 0x21,
		0x9e, 0x4c, 0x7d, 0xf1, 0x82, 0x65, 0x30, 0xab,
		0x44, 0x78, 0x2b, 0xc9, 0x5d, 0xe1, 0xf8, 0x03,
		0x16, 0x94, 0xa7, 0x5c, 0xbb, 0x2f, 0x49, 0x7e,
	}
	body = append(body, 0x00, 0x20)      // public_key len = 32
	body = append(body, fakePublicKey...)
	body = append(body, 0x00, 0x04)                             // cipher_suites len = 4 (1 suite × 4 bytes)
	body = append(body, 0x00, 0x01)                             // kdf_id:  HKDF-SHA256
	body = append(body, 0x00, 0x01)                             // aead_id: AES-128-GCM
	body = append(body, 0x00)                                   // maximum_name_length
	body = append(body, byte(len(pubNameBytes)))                // public_name len
	body = append(body, pubNameBytes...)                        // public_name
	body = append(body, 0x00, 0x00)                             // extensions: empty

	// --- ECHConfig: version(2) + length(2) + body ---
	var echConfig []byte
	echConfig = append(echConfig, 0xfe, 0x0d)                               // version = 0xfe0d
	echConfig = append(echConfig, byte(len(body)>>8), byte(len(body)))      // length
	echConfig = append(echConfig, body...)

	// --- ECHConfigList: list_length(2) + echConfig ---
	var list []byte
	list = append(list, byte(len(echConfig)>>8), byte(len(echConfig)))
	list = append(list, echConfig...)

	return list
}

func performHRR(domain string, port int) HRRResult {
	resolverName := fmt.Sprintf("HRR (%s:%d)", domain, port)

	// 动态生成 fake ECH config，public_name 为目标域名
	invalidECH := buildFakeECHConfigList(domain)

	// 先建立原始 TCP 连接，再手动包装 TLS，
	// 这样 Handshake() 返回的 ECHRejectionError 可以在证书校验路径之前被捕获。
	tcpConn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", domain, port), 10*time.Second)
	if err != nil {
		return HRRResult{
			ResolverName:      resolverName,
			ECHConfigDetected: false,
			ErrorMessage:      fmt.Sprintf("TCP dial error: %v", err),
		}
	}
	defer tcpConn.Close()

	conf := &tls.Config{
		ServerName:                     domain,
		EncryptedClientHelloConfigList: invalidECH,
		MinVersion:                     tls.VersionTLS13,
		MaxVersion:                     tls.VersionTLS13,
		InsecureSkipVerify:             true,
	}

	tlsConn := tls.Client(tcpConn, conf)
	defer tlsConn.Close()

	// Handshake() 会触发 ECH 协商；若服务器支持 ECH 并拒绝无效配置，
	// 会返回 ECHRejectionError，其中包含真实的 RetryConfigList。
	handshakeErr := tlsConn.Handshake()
	if handshakeErr != nil {
		var rejectErr *tls.ECHRejectionError
		if errors.As(handshakeErr, &rejectErr) {
			retryConfigs := rejectErr.RetryConfigList
			details := parseECHConfigList(retryConfigs, domain)
			return HRRResult{
				ResolverName:      resolverName,
				ECHConfigDetected: details != nil,
				ECHConfigDetails:  details,
				RawResponse:       base64.StdEncoding.EncodeToString(retryConfigs),
			}
		}
		return HRRResult{
			ResolverName:      resolverName,
			ECHConfigDetected: false,
			ErrorMessage:      fmt.Sprintf("Connection error: %v", handshakeErr),
		}
	}

	return HRRResult{
		ResolverName:      resolverName,
		ECHConfigDetected: false,
		ErrorMessage:      "Server accepted invalid ECH config (unexpected)",
	}
}

func parseECHConfigList(configList []byte, domain string) *ECHConfigDetail {
	if len(configList) < 2 {
		return nil
	}

	totalLength := int(configList[0])<<8 | int(configList[1])
	if totalLength > len(configList)-2 {
		return nil
	}

	// listContent 是整个 ECHConfigList 的 payload，可能含多条 ECHConfig。
	// 每条 ECHConfig 的格式为: version(2) + length(2) + ECHConfigContents
	listContent := configList[2 : 2+totalLength]
	rawHex := hex.EncodeToString(configList)

	detail := parseECHConfig(listContent, domain)
	if detail != nil {
		detail.RawECHConfig = rawHex
	}
	return detail
}

// parseECHConfig 从 ECHConfigList payload（已去掉外层 2字节 list_length）中
// 解析第一条 ECHConfig，格式为:
//   version(2) + length(2) + ECHConfigContents
// ECHConfigContents:
//   config_id(1) + kem_id(2) + public_key(u16+bytes)
//   + cipher_suites(u16+entries) + maximum_name_length(1)
//   + public_name(u8+bytes) + extensions(2)
func parseECHConfig(config []byte, domain string) *ECHConfigDetail {
	if len(config) < 10 {
		return nil
	}

	offset := 0

	// version (2 bytes)
	version := int(config[offset])<<8 | int(config[offset+1])
	offset += 2

	// ECHConfig length (2 bytes) — 跳过，不消费内容
	offset += 2

	// config_id (1 byte)
	configId := int(config[offset])
	offset += 1

	// kem_id (2 bytes)
	kemId := int(config[offset])<<8 | int(config[offset+1])
	offset += 2

	// public_key: length(2) + bytes
	if offset+2 > len(config) {
		return nil
	}
	pubKeyLen := int(config[offset])<<8 | int(config[offset+1])
	offset += 2

	if offset+pubKeyLen > len(config) {
		return nil
	}

	pubKey := config[offset : offset+pubKeyLen]
	offset += pubKeyLen

	fingerprint := hex.EncodeToString(pubKey)
	if len(fingerprint) > 32 {
		fingerprint = fingerprint[:32] + "..."
	}

	var kdf, aead string
	if offset+2 <= len(config) {
		cipherSuitesLen := int(config[offset])<<8 | int(config[offset+1])
		offset += 2

		if cipherSuitesLen >= 4 && offset+cipherSuitesLen <= len(config) {
			kdfId := int(config[offset])<<8 | int(config[offset+1])
			aeadId := int(config[offset+2])<<8 | int(config[offset+3])
			kdf = getKDFName(kdfId)
			aead = getAEADName(aeadId)
		}
	}

	if kdf == "" {
		kdf = "HKDF-SHA256"
	}
	if aead == "" {
		aead = "AES-128-GCM"
	}

	kemName := getKEMName(kemId)

	// parse maximum_name_length
	if offset >= len(config) {
		return nil
	}
	offset += 1 // maximum_name_length (skip)

	// parse public_name
	publicName := domain
	if offset < len(config) {
		nameLen := int(config[offset])
		offset++
		if offset+nameLen <= len(config) {
			publicName = string(config[offset : offset+nameLen])
			offset += nameLen
		}
	}

	return &ECHConfigDetail{
		Version:              fmt.Sprintf("ECHConfig draft-18 (0x%04x)", version),
		VersionHex:           fmt.Sprintf("0x%04x", version),
		ConfigId:             configId,
		KemId:                kemName,
		PublicKeyLength:      pubKeyLen,
		PublicKeyFingerprint: fingerprint,
		PublicName:           publicName,
		HpkeSuite: struct {
			Kem  string `json:"kem"`
			Kdf  string `json:"kdf"`
			Aead string `json:"aead"`
		}{
			Kem:  kemName,
			Kdf:  kdf,
			Aead: aead,
		},
	}
}

func getKEMName(kemId int) string {
	kemNames := map[int]string{
		0x0010: "DHKEM(P-256, HKDF-SHA256)",
		0x0011: "DHKEM(P-384, HKDF-SHA384)",
		0x0012: "DHKEM(P-521, HKDF-SHA512)",
		0x0020: "DHKEM(X25519, HKDF-SHA256)",
		0x0021: "DHKEM(X448, HKDF-SHA512)",
		0x0041: "ML-KEM-768",
		0x4110: "ML-KEM-768 (Experimental/PQ)",
	}
	if name, ok := kemNames[kemId]; ok {
		return name
	}
	return fmt.Sprintf("0x%04x", kemId)
}

func getKDFName(kdfId int) string {
	kdfNames := map[int]string{
		0x0001: "HKDF-SHA256",
		0x0002: "HKDF-SHA384",
		0x0003: "HKDF-SHA512",
	}
	if name, ok := kdfNames[kdfId]; ok {
		return name
	}
	return fmt.Sprintf("0x%04x", kdfId)
}

func getAEADName(aeadId int) string {
	aeadNames := map[int]string{
		0x0001: "AES-128-GCM",
		0x0002: "AES-256-GCM",
		0x0003: "ChaCha20Poly1305",
	}
	if name, ok := aeadNames[aeadId]; ok {
		return name
	}
	return fmt.Sprintf("0x%04x", aeadId)
}
