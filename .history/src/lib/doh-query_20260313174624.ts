'use server';

import dns from 'dns';
import { promisify } from 'util';

const resolveTxt = promisify(dns.resolveTxt);

// 使用 Node.js 原生 DNS 查询 HTTPS 记录
export async function queryDoH(domain: string, resolverUrl: string): Promise<string[]> {
  // 从 resolverUrl 提取 DNS 服务器地址
  const url = new URL(resolverUrl);
  const dnsServer = url.hostname;
  
  // 创建自定义 resolver
  const resolver = new dns.Resolver();
  resolver.setServers([dnsServer]);
  
  try {
    // 查询 HTTPS 记录 (type 65)
    const records = await resolveHttpsWithResolver(domain, resolver);
    return records;
  } catch (err: any) {
    // 如果失败，尝试使用系统默认 DNS
    try {
      const records = await resolveHttpsWithResolver(domain, dns);
      return records;
    } catch (fallbackErr: any) {
      throw new Error(`DNS query failed: ${err.message}`);
    }
  }
}

// 解析 HTTPS 记录
async function resolveHttpsWithResolver(domain: string, resolver: dns.Resolver | typeof dns): Promise<string[]> {
  return new Promise((resolve, reject) => {
    // @ts-ignore - Node.js 18+ 支持 resolve 方法传入 record type
    resolver.resolve(domain, 'HTTPS', (err: Error | null, records: any[]) => {
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
