'use server';

import { ResolverResult } from './dns';

export type HRRResult = ResolverResult;

/**
 * 使用 HRR (Hello Retry Request) 模式获取 ECH 配置
 * 
 * 统一通过 /api/hrr 端点调用，本地和 Vercel 环境一致
 */
export async function performHRRAnalysis(
  domain: string,
  port: number = 443
): Promise<ResolverResult> {
  console.log(`[HRR] Starting HRR analysis for ${domain}:${port}`);
  
  try {
    // 本地开发使用相对路径，Vercel 环境使用绝对路径
    const isLocal = !process.env.VERCEL_URL;
    const apiUrl = isLocal 
      ? '/api/hrr' 
      : `https://${process.env.VERCEL_URL}/api/hrr`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, port }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`[HRR] Result:`, result);
    
    return {
      resolverName: result.resolverName,
      echConfigDetected: result.echConfigDetected,
      echConfigDetails: result.echConfigDetails,
      errorMessage: result.errorMessage,
      rawResponse: result.rawResponse,
    };
  } catch (error: any) {
    console.error(`[HRR] Error:`, error);
    
    return {
      resolverName: `HRR (${domain}:${port})`,
      echConfigDetected: false,
      echConfigDetails: null,
      errorMessage: `HRR analysis failed: ${error.message || 'Unknown error'}`,
    };
  }
}
