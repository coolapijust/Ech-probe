'use server';

import { ResolverResult } from './dns';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

export type HRRResult = ResolverResult;

/**
 * 使用 HRR (Hello Retry Request) 模式获取 ECH 配置
 * 
 * 本地环境：通过调用 Go 编译的 ech-hrr 工具实现
 * Vercel 环境：通过调用 /api/hrr Go Serverless Function 实现
 */
export async function performHRRAnalysis(
  domain: string,
  port: number = 443
): Promise<ResolverResult> {
  console.log(`[HRR] Starting HRR analysis for ${domain}:${port}`);
  
  // 检测是否在 Vercel 环境
  const isVercel = process.env.VERCEL === '1';
  
  if (isVercel) {
    return performHRRViaAPI(domain, port);
  }
  
  return performHRRLocally(domain, port);
}

/**
 * 通过 Vercel API 调用 Go 函数
 */
async function performHRRViaAPI(domain: string, port: number): Promise<ResolverResult> {
  try {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/hrr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, port }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${error}`);
    }
    
    const result = await response.json();
    return {
      resolverName: result.resolverName,
      echConfigDetected: result.echConfigDetected,
      echConfigDetails: result.echConfigDetails,
      errorMessage: result.errorMessage,
      rawResponse: result.rawResponse,
    };
  } catch (error: any) {
    console.error(`[HRR] API error:`, error);
    return {
      resolverName: `HRR (${domain}:${port})`,
      echConfigDetected: false,
      echConfigDetails: null,
      errorMessage: `API call failed: ${error.message}`,
    };
  }
}

/**
 * 本地调用 Go 二进制文件
 */
async function performHRRLocally(domain: string, port: number): Promise<ResolverResult> {
  try {
    const isWindows = process.platform === 'win32';
    const exeName = isWindows ? 'ech-hrr.exe' : 'ech-hrr';
    
    const possiblePaths = [
      path.join(process.cwd(), 'tools', 'ech-hrr', exeName),
      path.join(process.cwd(), '..', 'tools', 'ech-hrr', exeName),
    ];
    
    let exePath: string | null = null;
    for (const p of possiblePaths) {
      try {
        await execFileAsync(isWindows ? 'where' : 'which', [p]);
        exePath = p;
        break;
      } catch {
        continue;
      }
    }
    
    if (!exePath) {
      const goFile = path.join(process.cwd(), 'tools', 'ech-hrr', 'main.go');
      console.log(`[HRR] Binary not found, trying go run for ${goFile}`);
      
      const { stdout } = await execFileAsync('go', ['run', goFile, domain, port.toString()], {
        timeout: 30000,
        cwd: path.join(process.cwd(), 'tools', 'ech-hrr'),
      });
      
      const result = JSON.parse(stdout);
      return {
        resolverName: result.resolverName,
        echConfigDetected: result.echConfigDetected,
        echConfigDetails: result.echConfigDetails,
        errorMessage: result.errorMessage,
        rawResponse: result.rawResponse,
      };
    }
    
    console.log(`[HRR] Using binary: ${exePath}`);
    
    const { stdout } = await execFileAsync(exePath, [domain, port.toString()], {
      timeout: 30000,
    });
    
    const result = JSON.parse(stdout);
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
    
    if (error.message?.includes('go') || error.code === 'ENOENT') {
      return {
        resolverName: `HRR (${domain}:${port})`,
        echConfigDetected: false,
        echConfigDetails: null,
        errorMessage: 'Go is not available. HRR mode requires Go to be installed locally.',
      };
    }
    
    return {
      resolverName: `HRR (${domain}:${port})`,
      echConfigDetected: false,
      echConfigDetails: null,
      errorMessage: `HRR analysis failed: ${error.message || 'Unknown error'}`,
    };
  }
}
