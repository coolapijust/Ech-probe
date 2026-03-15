'use server';

// DNS 服务器配置
const DNS_SERVERS: Record<string, { urls: string[]; ips?: string[] }> = {
  'cloudflare-dns.com': {
    urls: ['https://cloudflare-dns.com/dns-query'],
    ips: ['1.1.1.1', '1.0.0.1'],
  },
  'dns.google': {
    urls: ['https://dns.google/dns-query'],
    ips: ['8.8.8.8', '8.8.4.4'],
  },
  'dns.alidns.com': {
    urls: ['https://dns.alidns.com/dns-query'],
    ips: ['223.5.5.5', '223.6.6.6'],
  },
  'doh.pub': {
    urls: ['https://doh.pub/dns-query'],
    ips: ['119.29.29.29', '119.28.28.28'],
  },
};

const QUERY_TIMEOUT = 10000;

/**
 * 查询域名的 HTTPS 记录 (ECH 配置)
 */
export async function queryDoH(domain: string, resolverUrl: string): Promise<string[]> {
  const url = new URL(resolverUrl);
  const dnsHost = url.hostname;
  const serverConfig = DNS_SERVERS[dnsHost];

  if (!serverConfig) {
    throw new Error(`Unknown DNS server: ${dnsHost}`);
  }

  // 尝试每个 DoH URL
  for (const dohUrl of serverConfig.urls) {
    try {
      const records = await queryDoHOverHTTP(domain, dohUrl);
      if (records.length > 0) {
        return records;
      }
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] DoH query to ${dohUrl} failed:`, err.message);
    }
  }

  return [];
}

/**
 * 通过 HTTP DoH 接口查询 HTTPS 记录
 */
async function queryDoHOverHTTP(domain: string, dohUrl: string): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), QUERY_TIMEOUT);

  try {
    const queryUrl = `${dohUrl}?name=${encodeURIComponent(domain)}&type=HTTPS`;

    console.log(`[${new Date().toISOString()}] Querying: ${queryUrl}`);

    const response = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/dns-json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    console.log(`[${new Date().toISOString()}] Response for ${domain}:`, JSON.stringify(data, null, 2));

    // 解析 DoH JSON 响应
    if (!data.Answer || !Array.isArray(data.Answer)) {
      return [];
    }

    // 提取 HTTPS 记录数据
    const httpsRecords = data.Answer
      .filter((ans: any) => ans.type === 65) // HTTPS record type
      .map((ans: any) => {
        // data 字段可能是 base64 编码的二进制数据
        if (typeof ans.data === 'string') {
          return ans.data;
        }
        return JSON.stringify(ans.data);
      });

    return httpsRecords;
  } catch (err: any) {
    clearTimeout(timeout);
    throw err;
  }
}
