'use server';

import { buildDNSQuery, parseDNSResponse } from './dns-wire';

const FETCH_TIMEOUT = 5000;

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

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
  
  const response = await fetchWithTimeout(url.toString(), {
    headers: { 'Accept': 'application/dns-json' },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const json = await response.json();
  
  if (json.Answer) {
    return json.Answer.map((a: any) => a.data);
  }
  return [];
}

async function queryWireDoH(domain: string, url: URL): Promise<string[]> {
  const dnsQuery = buildDNSQuery(domain, 65);
  const base64Query = Buffer.from(dnsQuery).toString('base64').replace(/=/g, '');
  
  url.searchParams.append('dns', base64Query);
  
  const response = await fetchWithTimeout(url.toString(), {
    headers: { 'Accept': 'application/dns-message' },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const buffer = Buffer.from(await response.arrayBuffer());
  return parseDNSResponse(buffer);
}
