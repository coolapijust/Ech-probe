

'use server';

import dns from 'dns';
import { parseECHFromHttpsRecord } from '@/lib/dns-parser';

export type ResolverResult = {
  resolverName: string;
  echConfigDetected: boolean;
  echConfigDetails: {
    version: string;
    publicName: string;
    keys: string[];
    rawECHConfig: string;
  } | null;
  errorMessage: string | null;
  rawResponse?: string;
};

const PRESET_RESOLVERS = [
  { name: 'Cloudflare', url: 'https://cloudflare-dns.com/dns-query' },
  { name: 'Google', url: 'https://dns.google/resolve' },
  { name: 'Alibaba', url: 'https://dns.alidns.com/resolve' },
  { name: 'Tencent', url: 'https://doh.pub/dns-query' },
];

async function queryDoH(domain: string, resolverUrl: string): Promise<string[]> {
  const url = new URL(resolverUrl);
  
  // 检测端点类型：/resolve 使用 JSON API，/dns-query 使用 DNS wire format
  const isJsonEndpoint = url.pathname === '/resolve';
  
  if (isJsonEndpoint) {
    // JSON API (Google, Alibaba)
    url.searchParams.append('name', domain);
    url.searchParams.append('type', 'HTTPS');
    
    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/dns-json' },
      next: { revalidate: 60 }
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const json = await response.json();
    
    if (json.Answer) {
      return json.Answer.map((a: any) => a.data);
    }
  } else {
    // DNS wire format (Cloudflare, Tencent)
    // 构造 DNS 查询包 (HTTPS record type = 65)
    const dnsQuery = buildDNSQuery(domain, 65);
    const base64Query = Buffer.from(dnsQuery).toString('base64')
      .replace(/=/g, ''); // Remove padding
    
    url.searchParams.append('dns', base64Query);
    
    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/dns-message' },
      next: { revalidate: 60 }
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    // 解析 DNS wire format 响应
    const buffer = Buffer.from(await response.arrayBuffer());
    return parseDNSResponse(buffer);
  }
  
  return [];
}

// 构造 DNS 查询包
function buildDNSQuery(domain: string, type: number): Uint8Array {
  const labels = domain.split('.');
  const parts: number[] = [];
  
  // Transaction ID
  parts.push(0x00, 0x00);
  // Flags: Standard query
  parts.push(0x01, 0x00);
  // Questions: 1
  parts.push(0x00, 0x01);
  // Answer RRs: 0
  parts.push(0x00, 0x00);
  // Authority RRs: 0
  parts.push(0x00, 0x00);
  // Additional RRs: 0
  parts.push(0x00, 0x00);
  
  // Query name
  for (const label of labels) {
    parts.push(label.length);
    for (let i = 0; i < label.length; i++) {
      parts.push(label.charCodeAt(i));
    }
  }
  parts.push(0x00); // End of name
  
  // Query type
  parts.push((type >> 8) & 0xff, type & 0xff);
  // Query class: IN
  parts.push(0x00, 0x01);
  
  return new Uint8Array(parts);
}

// 解析 DNS 响应包
function parseDNSResponse(buffer: Buffer): string[] {
  const results: string[] = [];
  
  // 跳过 DNS header (12 bytes)
  let offset = 12;
  
  // 获取问题数量
  const qdcount = (buffer[4] << 8) | buffer[5];
  // 获取回答数量
  const ancount = (buffer[6] << 8) | buffer[7];
  
  // 跳过问题部分
  for (let i = 0; i < qdcount; i++) {
    // 跳过域名
    while (buffer[offset] !== 0) {
      if ((buffer[offset] & 0xc0) === 0xc0) {
        offset += 2;
        break;
      }
      offset += buffer[offset] + 1;
    }
    if (buffer[offset] === 0) offset++;
    // 跳过 QTYPE 和 QCLASS
    offset += 4;
  }
  
  // 解析回答部分
  for (let i = 0; i < ancount; i++) {
    // 跳过域名
    while (buffer[offset] !== 0) {
      if ((buffer[offset] & 0xc0) === 0xc0) {
        offset += 2;
        break;
      }
      offset += buffer[offset] + 1;
    }
    if (buffer[offset] === 0) offset++;
    
    // 跳过 TYPE, CLASS, TTL
    offset += 8;
    // 获取 RDLENGTH
    const rdlength = (buffer[offset] << 8) | buffer[offset + 1];
    offset += 2;
    
    // 获取 RDATA
    const rdata = buffer.slice(offset, offset + rdlength);
    results.push(rdata.toString('base64'));
    offset += rdlength;
  }
  
  return results;
}

export async function performECHAnalysis(domain: string, selectedResolvers: string[], customResolvers: string[] = []): Promise<ResolverResult[]> {
  const results: ResolverResult[] = [];

  // 1. Process Preset DoH
  const resolversToQuery = PRESET_RESOLVERS.filter(r => selectedResolvers.includes(r.name));
  
  const dohPromises = resolversToQuery.map(async (res) => {
    try {
      const records = await queryDoH(domain, res.url);
      const echDetails = records.map(parseECHFromHttpsRecord).find(d => d !== null) || null;
      return {
        resolverName: res.name,
        echConfigDetected: !!echDetails,
        echConfigDetails: echDetails,
        errorMessage: null,
        rawResponse: records.join('\n')
      };
    } catch (err: any) {
      return {
        resolverName: res.name,
        echConfigDetected: false,
        echConfigDetails: null,
        errorMessage: err.message
      };
    }
  });

  // 2. Process Custom DoH
  const customPromises = customResolvers.map(async (url) => {
    try {
      const records = await queryDoH(domain, url);
      const echDetails = records.map(parseECHFromHttpsRecord).find(d => d !== null) || null;
      return {
        resolverName: `Custom (${new URL(url).hostname})`,
        echConfigDetected: !!echDetails,
        echConfigDetails: echDetails,
        errorMessage: null,
        rawResponse: records.join('\n')
      };
    } catch (err: any) {
      return {
        resolverName: 'Custom Resolver',
        echConfigDetected: false,
        echConfigDetails: null,
        errorMessage: err.message
      };
    }
  });

  const allResults = await Promise.all([...dohPromises, ...customPromises]);
  return allResults;
}
