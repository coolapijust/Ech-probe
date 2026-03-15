package main

import (
	"crypto/tls"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
)

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
	HpkeSuite            struct {
		Kem  string `json:"kem"`
		Kdf  string `json:"kdf"`
		Aead string `json:"aead"`
	} `json:"hpkeSuite"`
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "Usage: ech-hrr <domain> [port]")
		os.Exit(1)
	}

	domain := os.Args[1]
	port := 443
	if len(os.Args) > 2 {
		p, err := strconv.Atoi(os.Args[2])
		if err == nil {
			port = p
		}
	}

	result := performHRR(domain, port)

	output, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		fmt.Fprintln(os.Stderr, "JSON marshal error:", err)
		os.Exit(1)
	}

	fmt.Println(string(output))
}

func performHRR(domain string, port int) HRRResult {
	// 硬编码的无效 ECH 配置
	invalidECHHex := "0045fe0d0041590020002092a01233db2218518ccbbbbc24df20686af417b37388de6460e94011974777090004000100010012636c6f7564666c6172652d6563682e636f6d0000"
	invalidECH, err := hex.DecodeString(invalidECHHex)
	if err != nil {
		return HRRResult{
			ResolverName:      fmt.Sprintf("HRR (%s:%d)", domain, port),
			ECHConfigDetected: false,
			ErrorMessage:      "Failed to decode invalid ECH config",
		}
	}

	conf := &tls.Config{
		ServerName:                     domain,
		EncryptedClientHelloConfigList: invalidECH,
		MinVersion:                     tls.VersionTLS13,
		MaxVersion:                     tls.VersionTLS13,
	}

	conn, err := tls.Dial("tcp", fmt.Sprintf("%s:%d", domain, port), conf)
	if err != nil {
		if rejectErr, ok := err.(*tls.ECHRejectionError); ok {
			retryConfigs := rejectErr.RetryConfigList
			details := parseECHConfigList(retryConfigs, domain)
			return HRRResult{
				ResolverName:      fmt.Sprintf("HRR (%s:%d)", domain, port),
				ECHConfigDetected: details != nil,
				ECHConfigDetails:  details,
				RawResponse:       base64.StdEncoding.EncodeToString(retryConfigs),
			}
		}
		return HRRResult{
			ResolverName:      fmt.Sprintf("HRR (%s:%d)", domain, port),
			ECHConfigDetected: false,
			ErrorMessage:      fmt.Sprintf("Connection error: %v", err),
		}
	}
	defer conn.Close()

	return HRRResult{
		ResolverName:      fmt.Sprintf("HRR (%s:%d)", domain, port),
		ECHConfigDetected: false,
		ErrorMessage:      "Server accepted invalid ECH config (unexpected)",
	}
}

// parseECHConfigList 解析 ECHConfigList
// 格式: 2字节总长度 + ECHConfig内容
// ECHConfig: 2字节版本 + 1字节config_id + 2字节kem_id + 2字节public_key长度 + public_key + ...
func parseECHConfigList(configList []byte, domain string) *ECHConfigDetail {
	if len(configList) < 2 {
		fmt.Fprintf(os.Stderr, "[DEBUG] Config list too short: %d bytes\n", len(configList))
		return nil
	}

	// 读取 ECHConfigList 总长度 (前2字节，大端序)
	totalLength := int(configList[0])<<8 | int(configList[1])
	fmt.Fprintf(os.Stderr, "[DEBUG] ECHConfigList total length: %d (0x%04x)\n", totalLength, totalLength)

	if totalLength > len(configList)-2 {
		fmt.Fprintf(os.Stderr, "[DEBUG] Total length %d > available %d\n", totalLength, len(configList)-2)
		return nil
	}

	// ECHConfigList 内容 (跳过2字节长度前缀)
	listContent := configList[2 : 2+totalLength]

	// 解析第一个 ECHConfig
	return parseECHConfig(listContent, domain)
}

// parseECHConfig 解析单个 ECHConfig
func parseECHConfig(config []byte, domain string) *ECHConfigDetail {
	if len(config) < 10 {
		fmt.Fprintf(os.Stderr, "[DEBUG] Config too short: %d bytes\n", len(config))
		return nil
	}

	offset := 0

	// 版本 (2 bytes)
	version := int(config[offset])<<8 | int(config[offset+1])
	offset += 2
	fmt.Fprintf(os.Stderr, "[DEBUG] Version: 0x%04x\n", version)

	// config_id (1 byte)
	configId := int(config[offset])
	offset += 1
	fmt.Fprintf(os.Stderr, "[DEBUG] Config ID: %d\n", configId)

	// kem_id (2 bytes)
	kemId := int(config[offset])<<8 | int(config[offset+1])
	offset += 2
	fmt.Fprintf(os.Stderr, "[DEBUG] KEM ID: 0x%04x (%d)\n", kemId, kemId)

	// public_key 长度 (2 bytes)
	pubKeyLen := int(config[offset])<<8 | int(config[offset+1])
	offset += 2
	fmt.Fprintf(os.Stderr, "[DEBUG] Public key length: %d\n", pubKeyLen)

	if offset+pubKeyLen > len(config) {
		fmt.Fprintf(os.Stderr, "[DEBUG] Public key extends beyond config: offset=%d, len=%d, config_len=%d\n",
			offset, pubKeyLen, len(config))
		return nil
	}

	// public_key
	pubKey := config[offset : offset+pubKeyLen]
	offset += pubKeyLen

	// 创建指纹 (前16字节 hex)
	fingerprint := hex.EncodeToString(pubKey)
	if len(fingerprint) > 32 {
		fingerprint = fingerprint[:32] + "..."
	}

	// 解析 cipher_suites (2字节长度 + 内容)
	var kdf, aead string
	if offset+2 <= len(config) {
		cipherSuitesLen := int(config[offset])<<8 | int(config[offset+1])
		offset += 2
		fmt.Fprintf(os.Stderr, "[DEBUG] Cipher suites length: %d\n", cipherSuitesLen)

		if cipherSuitesLen >= 4 && offset+cipherSuitesLen <= len(config) {
			// 读取第一个 cipher suite
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

	return &ECHConfigDetail{
		Version:              fmt.Sprintf("0x%04x", version),
		VersionHex:           fmt.Sprintf("0x%04x", version),
		ConfigId:             configId,
		KemId:                kemName,
		PublicKeyLength:      pubKeyLen,
		PublicKeyFingerprint: fingerprint,
		PublicName:           domain,
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
