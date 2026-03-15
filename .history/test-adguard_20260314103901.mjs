import { queryDoH } from './src/lib/doh-query.ts';

async function test() {
  try {
    console.log('Querying adguard.com via Alibaba DoH...');
    const result = await queryDoH('adguard.com', 'https://223.5.5.5/dns-query');
    console.log('Result:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
