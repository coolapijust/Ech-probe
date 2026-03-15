'use server';

import { buildDNSQuery, parseDNSResponse } from './dns-wire';

export async function queryDoH(domain: string, resolverUrl: string): Promise<string[]> {
  const url = new URL(resolverUrl);
  const isJsonEndpoint = url.pathname === '/resolve';
  
  if (isJsonEndpoint) {
    return queryJsonDoH(domain, url);
  } else {
    return queryWireDoH(domain, url);
  }
}

async function queryJsonDoH(domain: string, url: URL): Promise<string[]> {
  url.searchParams.append('name', domain);
  url.searchParams.append('type', 'HTTPS');
  
  console.log(`[DoH] JSON query: ${url.toString()}`);
  
  try {
    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/dns-json' },
      next: { revalidate: 60 }
    });

    console.log(`[DoH] Response status: ${response.status}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const json = await response.json();
    console.log(`[DoH] Response:`, json);
    
    if (json.Answer) {
      return json.Answer.map((a: any) => a.data);
    }
    return [];
  } catch (err: any) {
    console.error(`[DoH] JSON query failed:`, err.message);
    throw err;
  }
}

async function queryWireDoH(domain: string, url: URL): Promise<string[]> {
  const dnsQuery = buildDNSQuery(domain, 65);
  const base64Query = Buffer.from(dnsQuery).toString('base64').replace(/=/g, '');
  
  url.searchParams.append('dns', base64Query);
  
  const response = await fetch(url.toString(), {
    headers: { 'Accept': 'application/dns-message' },
    next: { revalidate: 60 }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const buffer = Buffer.from(await response.arrayBuffer());
  return parseDNSResponse(buffer);
}
