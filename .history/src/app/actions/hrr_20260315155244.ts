'use server';

import { ECHConfigDetail, parseECHConfig } from '@/lib/dns-parser';
import { ResolverResult } from './dns';

export type HRRResult = ResolverResult;

// 硬编码的无效 ECH 配置 (来自 Go 测试)
// 结构有效但实际无效，用于触发服务器的 HelloRetryRequest
const INVALID_ECH_HEX = "0045fe0d0041590020002092a01233db2218518ccbbbbc24df20686af417b37388de6460e94011974777090004000100010012636c6f7564666c6172652d6563682e636f6d0000";

/**
 * 使用 HRR (Hello Retry Request) 模式获取 ECH 配置
 * 通过发送无效的 ECH 配置触发服务器返回真实的 RetryConfigList
 */
export async function performHRRAnalysis(
  domain: string,
  port: number = 443
): Promise<ResolverResult> {
  try {
    // 动态导入 tls 模块 (Node.js 内置)
    const tls = await import('tls');
    const net = await import('net');

    // 解码无效的 ECH 配置
    const invalidECH = Buffer.from(INVALID_ECH_HEX, 'hex');

    return new Promise((resolve) => {
        // 创建 TLS 配置
        const tlsOptions: tls.ConnectionOptions = {
          host: domain,
          port: port,
          servername: domain,
          minVersion: 'TLSv1.3',
          maxVersion: 'TLSv1.3',
          // @ts-ignore - Node.js 支持这个选项但类型定义可能不完整
          echConfigList: invalidECH,
        };

        console.log(`[HRR] Connecting to ${domain}:${port} with fake ECH config...`);

        const socket = tls.connect(tlsOptions, () => {
          console.log(`[HRR] Connected successfully to ${domain}`);
          socket.end();
          
          // 如果连接成功，说明服务器接受了无效的 ECH (不太可能)
          resolve({
            resolverName: `HRR (${domain}:${port})`,
            echConfigDetected: false,
            echConfigDetails: null,
            errorMessage: 'Server accepted invalid ECH config (unexpected)',
          });
        });

        socket.on('error', (err: any) => {
          console.log(`[HRR] Connection error: ${err.message}`);
          
          // 检查是否是 ECH 拒绝错误
          // Node.js 18.19+ 支持 ECHRejectionError
          if (err.code === 'ECH_REJECTED' || err.message?.includes('ECH')) {
            console.log(`[HRR] ECH Rejected! Parsing RetryConfigList...`);
            
            // 尝试从错误中提取 RetryConfigList
            const retryConfigs = extractRetryConfigs(err);
            
            if (retryConfigs) {
              console.log(`[HRR] Got RetryConfigList (${retryConfigs.length} bytes)`);
              
              // 解析第一个 ECH 配置
              const firstConfig = extractFirstECHConfig(retryConfigs);
              if (firstConfig) {
                const details = parseECHConfig(firstConfig, domain);
                resolve({
                  resolverName: `HRR (${domain}:${port})`,
                  echConfigDetected: true,
                  echConfigDetails: details,
                  errorMessage: null,
                  rawResponse: retryConfigs.toString('base64'),
                });
                return;
              }
            }
            
            resolve({
              resolverName: `HRR (${domain}:${port})`,
              echConfigDetected: false,
              echConfigDetails: null,
              errorMessage: 'ECH rejected but could not parse RetryConfigList',
              rawResponse: retryConfigs?.toString('base64'),
            });
          } else {
            resolve({
              resolverName: `HRR (${domain}:${port})`,
              echConfigDetected: false,
              echConfigDetails: null,
              errorMessage: `Connection error: ${err.message}`,
            });
          }
        });

        socket.on('close', () => {
          console.log(`[HRR] Connection closed`);
        });

        // 设置超时
        socket.setTimeout(10000);
        socket.on('timeout', () => {
          console.log(`[HRR] Connection timeout`);
          socket.destroy();
          resolve({
            resolverName: `HRR (${domain}:${port})`,
            echConfigDetected: false,
            echConfigDetails: null,
            errorMessage: 'Connection timeout',
          });
        });
      });
  } catch (err: any) {
    console.error(`[HRR] Fatal error: ${err.message}`);
    return {
      resolverName: `HRR (${domain}:${port})`,
      echConfigDetected: false,
      echConfigDetails: null,
      errorMessage: `Fatal error: ${err.message}`,
    };
  }
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
