// 测试最终代码
import { parseECHFromHttpsRecord } from './src/lib/dns-parser.ts';

// 阿里 DNS 返回的 crypto.cloudflare.com 数据
const aliData = 'AAEAAAEAAwJoMgAEAAiin4dPop+ITwAFAEcARf4NAEFHACAAINk4LmiEA4LhqjvI9siQ1Ft9FbQ9iu43Tq3Cn+zql7kTAAQAAQAB';

// Cloudflare DNS 返回的 crypto.cloudflare.com 数据
const cfData = 'AAEAAAEAAwJoMgAEAAiin4dPop+ITwAFAEcARf4NAEFHACAAINk4LmiEA4LhqjvI9siQ1Ft9FbQ9iu43Tq3Cn+zql7kTAAQAAQAB';

console.log('Testing AliDNS data:');
const aliResult = parseECHFromHttpsRecord(aliData);
if (aliResult) {
  console.log('✅ ECH detected!');
  console.log('  Version:', aliResult.version);
  console.log('  Public Name:', aliResult.publicName);
  console.log('  Keys:', aliResult.keys);
} else {
  console.log('❌ No ECH');
}

console.log('\nTesting Cloudflare DNS data:');
const cfResult = parseECHFromHttpsRecord(cfData);
if (cfResult) {
  console.log('✅ ECH detected!');
  console.log('  Version:', cfResult.version);
  console.log('  Public Name:', cfResult.publicName);
  console.log('  Keys:', cfResult.keys);
} else {
  console.log('❌ No ECH');
}
