'use server';

import { ResolverResult } from './dns';

export type HRRResult = ResolverResult;

/**
 * 使用 HRR (Hello Retry Request) 模式获取 ECH 配置
 * 
 * 注意: Node.js 目前 (v20/v22) 原生不支持 ECH 客户端功能。
 * 这个函数返回一个说明当前限制的友好错误信息。
 * 
 * Go 语言可以通过 tls.Config.EncryptedClientHelloConfigList 实现此功能，
 * 但 Node.js 的 tls 模块没有对应的 API。
 */
export async function performHRRAnalysis(
  domain: string,
  port: number = 443
): Promise<ResolverResult> {
  console.log(`[HRR] HRR mode requested for ${domain}:${port}`);
  
  return {
    resolverName: `HRR (${domain}:${port})`,
    echConfigDetected: false,
    echConfigDetails: null,
    errorMessage: 'HRR mode is not supported in Node.js. Node.js does not natively support ECH client functionality. Please use DNS mode instead.',
  };
}

/**
 * 从错误对象中提取 RetryConfigList
 */
function extractRetryConfigs(err: any): Buffer | null {
  // Node.js 18.19+ 会在错误对象中包含 retryConfigList
  if (err.retryConfigList) {
    return Buffer.from(err.retryConfigList);
  }
  
  // 尝试从错误消息中提取 (base64 编码的)
  const base64Match = err.message?.match(/RetryConfigs::?\s*([A-Za-z0-9+/=]+)/);
  if (base64Match) {
    return Buffer.from(base64Match[1], 'base64');
  }
  
  return null;
}

/**
 * 从 ECHConfigList 中提取第一个 ECH 配置
 * ECHConfigList 格式: 2字节长度 + 多个 ECHConfig
 * 每个 ECHConfig: 2字节长度 + 内容
 */
function extractFirstECHConfig(configList: Buffer): Buffer | null {
  try {
    if (configList.length < 2) return null;
    
    // 读取总长度 (前2字节，大端序)
    const totalLength = configList.readUInt16BE(0);
    console.log(`[HRR] ECHConfigList total length: ${totalLength}`);
    
    // 读取第一个 ECHConfig 的长度
    if (configList.length < 4) return null;
    const firstConfigLength = configList.readUInt16BE(2);
    console.log(`[HRR] First ECHConfig length: ${firstConfigLength}`);
    
    // 提取第一个 ECHConfig
    if (configList.length < 4 + firstConfigLength) return null;
    return configList.slice(4, 4 + firstConfigLength);
  } catch (e) {
    console.error('[HRR] Failed to extract ECH config:', e);
    return null;
  }
}
