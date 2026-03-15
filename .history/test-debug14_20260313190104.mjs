// 检查 public key 后面的字节
const echHex = '0045fe0d0041fa00200020b3286e9a98baffae53037fac63bcf1ac705737805015049d1bfcac42d4089b0b0004000100010012636c6f7564666c6172652d6563682e636f6d0000';

const buffer = Buffer.from(echHex, 'hex');

// Public key 从 offset 9 开始，32 字节
// 所以 public key 结束于 offset 9 + 32 = 41

console.log('Bytes around offset 35-50:');
for (let i = 35; i < 55 && i < buffer.length; i++) {
  console.log(`  offset ${i}: ${buffer[i].toString(16).padStart(2, '0')} (${buffer[i]})`);
}

// 等等，让我重新数一下
// offset 0-1: ECHConfigList length (2 bytes)
// offset 2-3: Version (2 bytes)
// offset 4: Config ID (1 byte)
// offset 5-6: KEM ID (2 bytes)
// offset 7-8: Public Key length (2 bytes) = 0x0020 = 32
// offset 9-40: Public Key (32 bytes)
// offset 41-42: Cipher Suites length (2 bytes)

// 但 0x9b0b = 39691 太大了

// 可能是 cipher suites 长度是 1 字节？
console.log('\nTrying 1-byte length at offset 41:');
console.log('  Value:', buffer[41], '(', buffer[41].toString(16), ')');

// 或者是 2 字节但小端序？
console.log('\nTrying little-endian at offset 41-42:');
const littleEndian = buffer[41] | (buffer[42] << 8);
console.log('  Value:', littleEndian, '(', littleEndian.toString(16), ')');

// 让我看看如果 cipher suites length = 4 (0x0004)，那字节应该是 00 04
// 在 hex 中找 "0004"
const hexStr = buffer.toString('hex');
console.log('\nLooking for "0004" in hex:', hexStr.includes('0004'));
console.log('Position of "0004":', hexStr.indexOf('0004') / 2);
