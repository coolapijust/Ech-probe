'use server';

import { parseECHFromHttpsRecord } from '@/lib/dns-parser';
import { queryDoH } from '@/lib/doh-query';

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

export async function performECHAnalysis(
  domain: string,
  selectedResolvers: string[],
  customResolvers: string[] = []
): Promise<ResolverResult[]> {
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
      let errorMsg = err.message || 'Unknown error';
      if (err.name === 'AbortError') {
        errorMsg = 'Request timeout';
      }
      return {
        resolverName: res.name,
        echConfigDetected: false,
        echConfigDetails: null,
        errorMessage: errorMsg
      };
    }
  });

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
      let errorMsg = err.message || 'Unknown error';
      if (err.name === 'AbortError') {
        errorMsg = 'Request timeout';
      }
      return {
        resolverName: 'Custom Resolver',
        echConfigDetected: false,
        echConfigDetails: null,
        errorMessage: errorMsg
      };
    }
  });

  const allResults = await Promise.all([...dohPromises, ...customPromises]);
  return allResults;
}
