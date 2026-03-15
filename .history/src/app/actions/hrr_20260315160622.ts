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
 * 通过调用 Go 编译的 ech-hrr 工具实现
 */
export async function performHRRAnalysis(
  domain: string,
  port: number = 443
): Promise<ResolverResult> {
  console.log(`[HRR] Starting HRR analysis for ${domain}:${port}`);
  
  try {
    // 确定可执行文件路径
    const isWindows = process.platform === 'win32';
    const exeName = isWindows ? 'ech-hrr.exe' : 'ech-hrr';
    
    // 尝试多个路径（开发环境和 Vercel 环境）
    const possiblePaths = [
      path.join(process.cwd(), 'tools', 'ech-hrr', exeName),
      path.join(process.cwd(), '..', 'tools', 'ech-hrr', exeName),
      path.join('/var/task', 'tools', 'ech-hrr', exeName),
    ];
    
    let exePath: string | null = null;
    for (const p of possiblePaths) {
      try {
        await execFileAsync('ls', [p]);
        exePath = p;
        break;
      } catch {
        continue;
      }
    }
    
    if (!exePath) {
      // 如果找不到预编译的二进制文件，尝试使用 go run
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
    
    // 检查是否是 Go 未安装
    if (error.message?.includes('go') || error.code === 'ENOENT') {
      return {
        resolverName: `HRR (${domain}:${port})`,
        echConfigDetected: false,
        echConfigDetails: null,
        errorMessage: 'Go is not available. HRR mode requires Go to be installed.',
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
