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
	ResolverName      string          `json:"resolverName"`
	ECHConfigDetected bool            `json:"echConfigDetected"`
	ECHConfigDetails  *ECHConfigDetail `json:"echConfigDetails,omitempty"`
	ErrorMessage      string          `json:"errorMessage,omitempty"`
	RawResponse       string          `json:"rawResponse,omitempty"`
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
			details := parseECHConfig(retryConfigs, domain)
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

func parseECHConfig(configList []byte, domain string) *ECHConfigDetail {
	// 打印原始数据用于调试
	fmt.Fprintf(os.Stderr, "[DEBUG] ECH ConfigList length: %d\n", len(configList))
	fmt.Fprintf(os.Stderr, "[DEBUG] ECH ConfigList (hex): %s\n", hex.EncodeToString(configList))
	
	if len(configList) < 2 {
		fmt.Fprintf(os.Stderr, "[DEBUG] ConfigList too short: %d < 2\n", len(configList))
		return nil
	}
	
	// 读取总长度 (前2字节)
	totalLength := int(configList[0])<<8 | int(configList[1])
	fmt.Fprintf(os.Stderr, "[DEBUG] Total length field: %d, actual data: %d\n", totalLength, len(configList)-2)
	if totalLength > len(configList)-2 {
		fmt.Fprintf(os.Stderr, "[DEBUG] Total length exceeds data\n")
		return nil
	}
	
	// ECHConfigList = ECHConfigContents (直接是配置内容，不再嵌套长度)
	// 参考: https://datatracker.ietf.org/doc/html/draft-ietf-tls-esni-17
	config := configList[2:]
	fmt.Fprintf(os.Stderr, "[DEBUG] Config content length: %d\n", len(config))
	fmt.Fprintf(os.Stderr, "[DEBUG] Config content (hex): %s\n", hex.EncodeToString(config))
	
	if len(config) < 10 {
		fmt.Fprintf(os.Stderr, "[DEBUG] Config content too short: %d < 10\n", len(config))
		return nil
	}
	
	// 解析 ECHConfig 结构:
	// version (2) + config_id (1) + kem_id (2) + pubkey_len (2) + pubkey + cipher_suites + extensions
	offset := 0
	
	// 解析版本
	version := int(config[offset])<<8 | int(config[offset+1])
	offset += 2
	fmt.Fprintf(os.Stderr, "[DEBUG] Version: 0x%04x\n", version)
	
	// 解析 config_id
	configId := int(config[offset])
	offset += 1
	fmt.Fprintf(os.Stderr, "[DEBUG] ConfigId: %d\n", configId)
	
	// 解析 kem_id
	kemId := int(config[offset])<<8 | int(config[offset+1])
	offset += 2
	fmt.Fprintf(os.Stderr, "[DEBUG] KemId: 0x%04x\n", kemId)
	
	// 解析 public key 长度
	pubKeyLen := int(config[offset])<<8 | int(config[offset+1])
	offset += 2
	fmt.Fprintf(os.Stderr, "[DEBUG] PubKeyLen: %d\n", pubKeyLen)
	
	if offset+pubKeyLen > len(config) {
		fmt.Fprintf(os.Stderr, "[DEBUG] PubKey exceeds config length: offset=%d, len=%d\n", offset, len(config))
		return nil
	}
	
	// 提取 public key
	pubKey := config[offset : offset+pubKeyLen]
	offset += pubKeyLen
	fmt.Fprintf(os.Stderr, "[DEBUG] PubKey (first 16 bytes hex): %s...\n", hex.EncodeToString(pubKey[:min(16, len(pubKey))]))
	
	// 继续解析剩余部分 (cipher suites + extensions)
	remaining := config[offset:]
	fmt.Fprintf(os.Stderr, "[DEBUG] Remaining bytes after pubkey: %d\n", len(remaining))
	if len(remaining) > 0 {
		fmt.Fprintf(os.Stderr, "[DEBUG] Remaining (hex): %s\n", hex.EncodeToString(remaining))
	}
	
	// 解析 cipher suites
	kdfName := "HKDF-SHA256"
	aeadName := "AES-128-GCM"
	if len(remaining) >= 2 {
		cipherSuitesLen := int(remaining[0])<<8 | int(remaining[1])
		fmt.Fprintf(os.Stderr, "[DEBUG] Cipher suites length: %d\n", cipherSuitesLen)
		if cipherSuitesLen >= 4 && 2+cipherSuitesLen <= len(remaining) {
			kdfId := int(remaining[2])<<8 | int(remaining[3])
			aeadId := int(remaining[4])<<8 | int(remaining[5])
			kdfName = getKDFName(kdfId)
			aeadName = getAEADName(aeadId)
			fmt.Fprintf(os.Stderr, "[DEBUG] KDF: 0x%04x (%s), AEAD: 0x%04x (%s)\n", kdfId, kdfName, aeadId, aeadName)
		}
	}
	
	// 解析 extensions 找 public_name
	publicName := domain
	if len(remaining) >= 6 {
		// 跳过 cipher suites
		cipherSuitesLen := int(remaining[0])<<8 | int(remaining[1])
		extensionsOffset := 2 + cipherSuitesLen
		
		if extensionsOffset+2 <= len(remaining) {
			extensionsLen := int(remaining[extensionsOffset])<<8 | int(remaining[extensionsOffset+1])
			fmt.Fprintf(os.Stderr, "[DEBUG] Extensions length: %d\n", extensionsLen)
			
			extensionsData := remaining[extensionsOffset+2:]
			if len(extensionsData) >= extensionsLen {
				extensionsData = extensionsData[:extensionsLen]
				
				// 查找 public_name extension (type = 0x00)
				extOffset := 0
				for extOffset+4 <= len(extensionsData) {
					extType := int(extensionsData[extOffset])<<8 | int(extensionsData[extOffset+1])
					extLen := int(extensionsData[extOffset+2])<<8 | int(extensionsData[extOffset+3])
					
					if extOffset+4+extLen <= len(extensionsData) {
						extValue := extensionsData[extOffset+4 : extOffset+4+extLen]
						
						if extType == 0x00 { // public_name extension
							// public_name 结构: length (1 byte) + name
							if len(extValue) > 0 {
								nameLen := int(extValue[0])
								if 1+nameLen <= len(extValue) {
									publicName = string(extValue[1 : 1+nameLen])
									fmt.Fprintf(os.Stderr, "[DEBUG] Found public_name: %s\n", publicName)
								}
							}
						}
					}
					
					extOffset += 4 + extLen
				}
			}
		}
	}
	
	// 创建指纹 (前16字节 hex)
	fingerprint := hex.EncodeToString(pubKey)
	if len(fingerprint) > 32 {
		fingerprint = fingerprint[:32] + "..."
	}
	
	kemName := getKEMName(kemId)
	
	return &ECHConfigDetail{
		Version:              fmt.Sprintf("0x%04x", version),
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
			Kdf:  kdfName,
			Aead: aeadName,
		},
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
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
