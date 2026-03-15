package handler

import (
	"crypto/tls"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
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

func performHRR(domain string, port int) HRRResult {
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

func parseECHConfigList(configList []byte, domain string) *ECHConfigDetail {
	if len(configList) < 2 {
		return nil
	}

	totalLength := int(configList[0])<<8 | int(configList[1])
	if totalLength > len(configList)-2 {
		return nil
	}

	listContent := configList[2 : 2+totalLength]
	return parseECHConfig(listContent, domain)
}

func parseECHConfig(config []byte, domain string) *ECHConfigDetail {
	if len(config) < 10 {
		return nil
	}

	offset := 0

	version := int(config[offset])<<8 | int(config[offset+1])
	offset += 2

	configId := int(config[offset])
	offset += 1

	kemId := int(config[offset])<<8 | int(config[offset+1])
	offset += 2

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
