// 使用完整数据测试增强的 ECH 解析器
import { parseHTTPSRecord } from './src/lib/dns-parser.ts';

// 从腾讯 DNS 获取的完整数据
const base64Data = 'AAEAAAEAAwJoMgAEAAiin4dPop+ITwAFAEcARf4NAEH6ACAAILMobpqYuv+uUwN/rGO88axwVzeAUBUEnRv8rELUCJsLAAQAAQABABJjbG91ZGZsYXJlLWVjaC5jb20AAAAGACAmBkcAAAcAAAAAAACin4dPJgZHAAAHAAAAAAAAop+ITw==';

console.log('Base64 data length:', base64Data.length);

const buffer = Buffer.from(base64Data, 'base64');
console.log('Buffer length:', buffer.length, 'bytes');

const record = parseHTTPSRecord(buffer);

console.log('\n=== HTTPS Record Details ===');
console.log('Priority:', record.priority);
console.log('Target Name:', record.targetName);
console.log('ALPN Protocols:', record.alpnProtocols.join(', ') || 'None');
console.log('Port:', record.port || 'Default (443)');
console.log('IPv4 Hints:', record.ipv4Hints.join(', ') || 'None');
console.log('IPv6 Hints:', record.ipv6Hints.join(', ') || 'None');

if (record.echConfig) {
  const ech = record.echConfig;
  console.log('\n=== ECH Config Details ===');
  console.log('Version:', ech.version);
  console.log('Version Hex:', ech.versionHex);
  console.log('Config ID:', ech.configId, '(0x' + ech.configId.toString(16).padStart(2, '0') + ')');
  console.log('Public Name:', ech.publicName);

  console.log('\n--- HPKE Suite ---');
  console.log('KEM:', ech.hpkeSuite.kem);
  console.log('KDF:', ech.hpkeSuite.kdf);
  console.log('AEAD:', ech.hpkeSuite.aead);

  console.log('\n--- Public Key ---');
  console.log('Algorithm:', ech.kemId);
  console.log('Length:', ech.publicKeyLength, 'bytes');
  console.log('Fingerprint:', ech.publicKeyFingerprint);
  console.log('Base64:', ech.publicKey);

  console.log('\n--- Raw Data ---');
  console.log('Raw ECHConfig (base64):', ech.rawECHConfig);
} else {
  console.log('\n❌ No ECH config found');
}
