import { NextRequest, NextResponse } from 'next/server';
import { performECHAnalysis } from '@/app/actions/dns';

/**
 * ECH 支持检测公共 API
 *
 * 用法：
 *   GET  /api/ech-check?domain=example.com               — DNS 模式（默认）
 *   GET  /api/ech-check?domain=example.com&mode=dns      — DNS 多解析器模式
 *   GET  /api/ech-check?domain=example.com&mode=hrr      — HRR TLS 握手模式
 *   GET  /api/ech-check?domain=example.com&mode=all      — 同时运行两种模式
 *
 *   POST /api/ech-check
 *   Body: { "domain": "example.com", "mode": "dns" | "hrr" | "all", "resolvers": ["Cloudflare","Google"] }
 *
 * 响应格式：
 * {
 *   "domain": "example.com",
 *   "mode": "dns",
 *   "supported": true,
 *   "results": [ { "resolver": "Cloudflare", "detected": true, "details": {...} } ],
 *   "summary": { "total": 4, "detected": 3, "consistent": true }
 * }
 */

const ALL_RESOLVERS = ['Cloudflare', 'Google', 'Alibaba', 'Tencent'];

type Mode = 'dns' | 'hrr' | 'all';

async function runDNS(domain: string, resolvers: string[]) {
  const rawResults = await performECHAnalysis(domain, resolvers, []);
  return rawResults.map(r => ({
    resolver: r.resolverName,
    detected: r.echConfigDetected,
    error: r.errorMessage ?? null,
    details: r.echConfigDetected ? r.echConfigDetails : null,
  }));
}

async function runHRR(domain: string) {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://localhost:${process.env.PORT || 3000}`;

  const res = await fetch(`${baseUrl}/api/hrr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain, port: 443 }),
  });

  if (!res.ok) {
    return [{
      resolver: `HRR (${domain}:443)`,
      detected: false,
      error: `Go handler returned ${res.status}`,
      details: null,
    }];
  }

  const data = await res.json();
  return [{
    resolver: data.resolverName ?? `HRR (${domain}:443)`,
    detected: data.echConfigDetected ?? false,
    error: data.errorMessage ?? null,
    details: data.echConfigDetected ? data.echConfigDetails : null,
  }];
}

function buildResponse(domain: string, mode: Mode, results: ReturnType<typeof buildResponse>['results']) {
  const detected = results.filter(r => r.detected).length;
  const supported = detected > 0;
  const consistent = results.every(r => r.detected === results[0].detected);

  return {
    domain,
    mode,
    supported,
    results,
    summary: {
      total: results.length,
      detected,
      consistent,
    },
  };
}

async function handle(req: NextRequest) {
  try {
    let domain: string;
    let mode: Mode = 'dns';
    let resolvers: string[] = ALL_RESOLVERS;

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      domain = body.domain;
      mode = (body.mode as Mode) ?? 'dns';
      if (Array.isArray(body.resolvers) && body.resolvers.length > 0) {
        resolvers = body.resolvers;
      }
    } else {
      const { searchParams } = new URL(req.url);
      domain = searchParams.get('domain') ?? '';
      mode = (searchParams.get('mode') as Mode) ?? 'dns';
      const resolverParam = searchParams.get('resolvers');
      if (resolverParam) {
        resolvers = resolverParam.split(',').map(r => r.trim()).filter(Boolean);
      }
    }

    if (!domain) {
      return NextResponse.json(
        { error: 'Missing required parameter: domain' },
        { status: 400 }
      );
    }

    // 清理域名（去除协议头、路径、端口）
    domain = domain.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].trim();

    if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(domain)) {
      return NextResponse.json(
        { error: 'Invalid domain format' },
        { status: 400 }
      );
    }

    let results: Awaited<ReturnType<typeof runDNS>>;

    if (mode === 'all') {
      const [dnsResults, hrrResults] = await Promise.all([
        runDNS(domain, resolvers),
        runHRR(domain),
      ]);
      results = [...dnsResults, ...hrrResults];
    } else if (mode === 'hrr') {
      results = await runHRR(domain);
    } else {
      results = await runDNS(domain, resolvers);
    }

    return NextResponse.json(buildResponse(domain, mode, results), {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
