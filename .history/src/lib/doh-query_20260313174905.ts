'use server';

import dns from 'dns';

// DNS 服务器 IP 映射
const DNS_SERVERS: Record<string, string[]> = {
  'cloudflare-dns.com': ['1.1.1.1', '1.0.0.1'],
  'dns.google': ['8.8.8.8', '8.8.4.4'],
  'dns.alidns.com': ['223.5.5.5', '223.6.6.6'],
  'doh.pub': ['119.29.29.29', '119.28.28.28'],
};

// 使用 Node.js 原生 DNS 查询 HTTPS 记录
export async function queryDoH(domain: string, resolverUrl: string): Promise<string[]> {
  const url = new URL(resolverUrl);
  const dnsHost = url.hostname;
  const serverIPs = DNS_SERVERS[dnsHost];
  
  if (!serverIPs) {
    throw new Error(`Unknown DNS server: ${dnsHost}`);
  }
  
  // 创建自定义 resolver
  const resolver = new dns.Resolver();
  resolver.setServers(serverIPs);
  
  try {
    // 查询 HTTPS 记录 (type 65)
    const records = await resolveHttpsWithResolver(domain, resolver);
    return records;
  } catch (err: any) {
    throw new Error(`DNS query failed: ${err.message}`);
  }
}

// HTTPS 记录类型编号
const HTTPS_RECORD_TYPE = 65;

// 解析 HTTPS 记录
async function resolveHttpsWithResolver(domain: string, resolver: dns.Resolver): Promise<string[]> {
  return new Promise((resolve, reject) => {
    // 使用数字 65 表示 HTTPS 记录类型
    // @ts-ignore - Node.js 支持 resolve 方法传入 record type number
    resolver.resolve(domain, HTTPS_RECORD_TYPE, (err: Error | null, records: any[]) => {
      if (err) {
        reject(err);
        return;
      }
      
      // 将记录转换为字符串格式
      const results: string[] = [];
      for (const record of records) {
        if (typeof record === 'string') {
          results.push(record);
        } else if (Buffer.isBuffer(record)) {
          results.push(record.toString('base64'));
        } else if (Array.isArray(record)) {
          results.push(record.join(''));
        }
      }
      resolve(results);
    });
  });
}
