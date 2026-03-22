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
	fmt.Fprintf(os.Stderr, "[DEBUG] First 20 bytes: %v\n", configList[:min(20, len(configList))])
	
	if len(configList) < 4 {
		fmt.Fprintf(os.Stderr, "[DEBUG] ConfigList too short: %d < 4\n", len(configList))
		return nil
	}
	
	// 读取总长度
	totalLength := int(configList[0])<<8 | int(configList[1])
	fmt.Fprintf(os.Stderr, "[DEBUG] Total length field: %d, actual data: %d\n", totalLength, len(configList)-2)
	if totalLength > len(configList)-2 {
		fmt.Fprintf(os.Stderr, "[DEBUG] Total length exceeds data\n")
		return nil
	}
	
	// 读取第一个配置的长度
	configLen := int(configList[2])<<8 | int(configList[3])
	fmt.Fprintf(os.Stderr, "[DEBUG] Config length: %d\n", configLen)
	if configLen+4 > len(configList) {
		fmt.Fprintf(os.Stderr, "[DEBUG] Config length exceeds data\n")
		return nil
	}
	
	// 提取第一个配置
	config := configList[4 : 4+configLen]
	fmt.Fprintf(os.Stderr, "[DEBUG] Config content (hex): %s\n", hex.EncodeToString(config))
	if len(config) < 8 {
		fmt.Fprintf(os.Stderr, "[DEBUG] Config content too short: %d < 8\n", len(config))
		return nil
	}
	
	// 解析版本
	version := int(config[0])<<8 | int(config[1])
	fmt.Fprintf(os.Stderr, "[DEBUG] Version: 0x%04x\n", version)
	
	// 解析 config_id
	configId := int(config[2])
	fmt.Fprintf(os.Stderr, "[DEBUG] ConfigId: %d\n", configId)
	
	// 解析 kem_id
	kemId := int(config[3])<<8 | int(config[4])
	fmt.Fprintf(os.Stderr, "[DEBUG] KemId: 0x%04x\n", kemId)
	
	// 解析 public key 长度
	pubKeyLen := int(config[5])<<8 | int(config[6])
	fmt.Fprintf(os.Stderr, "[DEBUG] PubKeyLen: %d\n", pubKeyLen)
	if 7+pubKeyLen > len(config) {
		fmt.Fprintf(os.Stderr, "[DEBUG] PubKey exceeds config length\n")
		return nil
	}
	
	// 提取 public key
	pubKey := config[7 : 7+pubKeyLen]
	fmt.Fprintf(os.Stderr, "[DEBUG] PubKey (hex): %s...\n", hex.EncodeToString(pubKey[:min(16, len(pubKey))]))
	
	// 继续解析剩余部分
	remaining := config[7+pubKeyLen:]
	fmt.Fprintf(os.Stderr, "[DEBUG] Remaining bytes after pubkey: %d\n", len(remaining))
	if len(remaining) > 0 {
		fmt.Fprintf(os.Stderr, "[DEBUG] Remaining (hex): %s\n", hex.EncodeToString(remaining))
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
		PublicName:           domain,
		HpkeSuite: struct {
			Kem  string `json:"kem"`
			Kdf  string `json:"kdf"`
			Aead string `json:"aead"`
		}{
			Kem:  kemName,
			Kdf:  "HKDF-SHA256",
			Aead: "AES-128-GCM",
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
