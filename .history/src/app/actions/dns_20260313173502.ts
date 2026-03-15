

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
  { name: 'Cloudflare', url: 'https://cloudflare-dns.com/dns-query', useJson: true },
  { name: 'Google', url: 'https://dns.google/resolve', useJson: true },
  { name: 'Alibaba', url: 'https://dns.alidns.com/resolve', useJson: true },
  { name: 'Tencent', url: 'https://doh.pub/dns-query', useJson: true },
];

async function queryDoH(domain: string, resolverUrl: string): Promise<string[]> {
  const url = new URL(resolverUrl);
  url.searchParams.append('name', domain);
  url.searchParams.append('type', 'HTTPS'); // HTTPS record type is 65
  
  const response = await fetch(url.toString(), {
    headers: { 'Accept': 'application/dns-json' },
    next: { revalidate: 60 }
  });

  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const json = await response.json();
  
  if (json.Answer) {
    return json.Answer.map((a: any) => a.data);
  }
  return [];
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
