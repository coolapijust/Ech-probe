package main

import (
	"crypto/tls"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log"
)

func main() {
	// Structurally valid ECHConfigList, borrowed from Go's crypto/tls tests.
	// Since meta.com cannot decrypt this, it will reject it and optionally
	// provide its own valid ECHConfigList in the HelloRetryRequest.
	invalidECHHex := "0045fe0d0041590020002092a01233db2218518ccbbbbc24df20686af417b37388de6460e94011974777090004000100010012636c6f7564666c6172652d6563682e636f6d0000"
	invalidECH, err := hex.DecodeString(invalidECHHex)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Using hardcoded fake ECH config (len=%d) for meta.com\n", len(invalidECH))

	conf := &tls.Config{
		ServerName:                     "meta.com",
		EncryptedClientHelloConfigList: invalidECH,
		MinVersion:                     tls.VersionTLS13,
		MaxVersion:                     tls.VersionTLS13,
	}

	conn, err := tls.Dial("tcp", "meta.com:443", conf)
	if err != nil {
		if rejectErr, ok := err.(*tls.ECHRejectionError); ok {
			fmt.Println("SUCCESS: ECH Rejected by Server! This is the expected behavior.")
			fmt.Printf("Parsed HelloRetryRequest and got real meta.com RetryConfigs (Base64):\n%s\n", base64.StdEncoding.EncodeToString(rejectErr.RetryConfigList))
		} else {
			fmt.Printf("Other dial error: %T %v\n", err, err)
		}
		return
	}
	defer conn.Close()
	fmt.Println("Connected successfully! (Unexpected, it should have been rejected by meta.com)")
}
