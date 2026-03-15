export interface ECHConfigDetail {
  version: string;
  versionHex: string;
  publicName: string;
  configId: number;
  kemId: string;
  kdfId: string;
  aeadId: string;
  publicKey: string;
  publicKeyFingerprint: string;
  publicKeyLength: number;
  maxNameLength: number;
  rawECHConfig: string;
  // HPKE 套件信息
  hpkeSuite: {
    kem: string;
    kdf: string;
    aead: string;
  };
}

export interface HTTPSRecordDetail {
  priority: number;
  targetName: string;
  alpnProtocols: string[];
  port?: number;
  ipv4Hints: string[];
  ipv6Hints: string[];
  echConfig: ECHConfigDetail | null;
  rawData: string;
}

// KEM ID 映射 (RFC 9180 + 私有扩展)
const KEM_IDS: Record<number, string> = {
  0x0010: 'DHKEM(P-256, HKDF-SHA256)',
  0x0011: 'DHKEM(P-384, HKDF-SHA384)',
  0x0012: 'DHKEM(P-521, HKDF-SHA512)',
  0x0020: 'DHKEM(X25519, HKDF-SHA256)',
  0x0021: 'DHKEM(X448, HKDF-SHA512)',
  // Cloudflare 私有扩展
  0x41fa: 'Cloudflare X25519 (Private Use)',
  0x4110: 'ML-KEM-768 (Experimental/PQ)',
  0x4112: 'Cloudflare X25519 (Private Use)',
};

// KDF ID 映射 (RFC 9180)
const KDF_IDS: Record<number, string> = {
  0x0001: 'HKDF-SHA256',
  0x0002: 'HKDF-SHA384',
  0x0003: 'HKDF-SHA512',
};

// AEAD ID 映射 (RFC 9180)
const AEAD_IDS: Record<number, string> = {
  0x0001: 'AES-128-GCM',
  0x0002: 'AES-256-GCM',
  0x0003: 'ChaCha20Poly1305',
  0xFFFF: 'Export-only',
};

/**
 * 计算 SHA256 指纹
 */
function computeFingerprint(data: Buffer): string {
  // 简化的指纹计算，取前 16 字节作为十六进制
  return data.toString('hex').slice(0, 32).match(/.{4}/g)?.join(':') || '';
}

/**
 * Parses HTTPS/SVCB record data to extract full details.
 */
export function parseECHFromHttpsRecord(data: string): ECHConfigDetail | null {
  if (!data) return null;

  try {
    const buffer = Buffer.from(data, 'base64');
    const record = parseHTTPSRecord(buffer);
    return record.echConfig;
  } catch (e) {
    console.error(`[${new Date().toISOString()}] Failed to parse ECH from record:`, e);
    return null;
  }
}

/**
 * 解析完整的 HTTPS 记录
 */
export function parseHTTPSRecord(buffer: Buffer): HTTPSRecordDetail {
  let offset = 0;

  // SvcPriority (2 bytes)
  const priority = buffer.readUInt16BE(offset);
  offset += 2;

  // TargetName (长度前缀)
  const targetLen = buffer[offset++];
  const targetName = buffer.slice(offset, offset + targetLen).toString() || '.';
  offset += targetLen;

  // 解析 SvcParams
  const alpnProtocols: string[] = [];
  const ipv4Hints: string[] = [];
  const ipv6Hints: string[] = [];
  let port: number | undefined;
  let echConfig: ECHConfigDetail | null = null;

  while (offset < buffer.length) {
    if (offset + 4 > buffer.length) break;

    const paramKey = buffer.readUInt16BE(offset);
    offset += 2;
    const paramLen = buffer.readUInt16BE(offset);
    offset += 2;

    if (offset + paramLen > buffer.length) break;

    const paramValue = buffer.slice(offset, offset + paramLen);

    switch (paramKey) {
      case 1: // alpn
        alpnProtocols.push(...parseAlpn(paramValue));
        break;
      case 2: // no-default-alpn (无值)
        break;
      case 3: // port
        if (paramLen >= 2) {
          port = paramValue.readUInt16BE(0);
        }
        break;
      case 4: // ipv4hint
        ipv4Hints.push(...parseIpv4Hints(paramValue));
        break;
      case 5: // ech
        echConfig = parseECHConfig(paramValue, targetName);
        break;
      case 6: // ipv6hint
        ipv6Hints.push(...parseIpv6Hints(paramValue));
        break;
    }

    offset += paramLen;
  }

  return {
    priority,
    targetName,
    alpnProtocols,
    port,
    ipv4Hints,
    ipv6Hints,
    echConfig,
    rawData: buffer.toString('base64'),
  };
}

/**
 * 解析 ALPN 协议列表
 */
function parseAlpn(buffer: Buffer): string[] {
  const protocols: string[] = [];
  let offset = 0;

  while (offset < buffer.length) {
    const len = buffer[offset++];
    if (offset + len > buffer.length) break;
    protocols.push(buffer.slice(offset, offset + len).toString());
    offset += len;
  }

  return protocols;
}

/**
 * 解析 IPv4 hints
 */
function parseIpv4Hints(buffer: Buffer): string[] {
  const ips: string[] = [];
  for (let i = 0; i < buffer.length; i += 4) {
    if (i + 4 > buffer.length) break;
    const ip = `${buffer[i]}.${buffer[i + 1]}.${buffer[i + 2]}.${buffer[i + 3]}`;
    ips.push(ip);
  }
  return ips;
}

/**
 * 解析 IPv6 hints
 */
function parseIpv6Hints(buffer: Buffer): string[] {
  const ips: string[] = [];
  for (let i = 0; i < buffer.length; i += 16) {
    if (i + 16 > buffer.length) break;
    const groups: string[] = [];
    for (let j = 0; j < 16; j += 2) {
      groups.push(buffer.readUInt16BE(i + j).toString(16));
    }
    ips.push(groups.join(':'));
  }
  return ips;
}

/**
 * 解析 ECHConfig (RFC 9614)
 * ECH 数据格式: ECHConfigList = 2字节长度前缀 + 多个 ECHConfig
 */
function parseECHConfig(echConfig: Buffer, targetName: string): ECHConfigDetail {
  try {
    let offset = 0;

    // ECHConfigList 长度 (2 bytes) - 整个列表的长度
    const listLen = echConfig.readUInt16BE(offset);
    offset += 2;

    if (listLen > echConfig.length - offset || listLen < 8) {
      return createECHDetail(echConfig, targetName, 0, 'unknown');
    }

    // 注意: ECHConfigList 后直接是 ECHConfig，没有额外的长度前缀
    // version (2 bytes)
    const version = echConfig.readUInt16BE(offset);
    offset += 2;

    // config_id (1 byte)
    const configId = echConfig[offset++];

    // kem_id (2 bytes)
    const kemId = echConfig.readUInt16BE(offset);
    offset += 2;

    // public_key 长度 (2 bytes)
    const publicKeyLen = echConfig.readUInt16BE(offset);
    offset += 2;

    if (offset + publicKeyLen > echConfig.length) {
      return createECHDetail(echConfig, targetName, configId, `0x${version.toString(16)}`);
    }

    // public_key
    const publicKey = echConfig.slice(offset, offset + publicKeyLen);
    offset += publicKeyLen;

    // 某些实现 (如 Cloudflare) 在 public key 后有 2 字节额外数据
    // 检查接下来的 2 字节是否看起来像是 cipher suites length (应该是小值如 4)
    let cipherSuitesLen = 0;
    if (offset + 2 <= echConfig.length) {
      const possibleLen = echConfig.readUInt16BE(offset);
      // 如果值太大 (>1000)，可能是格式问题，尝试跳过 2 字节
      if (possibleLen > 1000 && offset + 4 <= echConfig.length) {
        const nextPossibleLen = echConfig.readUInt16BE(offset + 2);
        if (nextPossibleLen <= 100) {
          offset += 2; // 跳过 2 字节
          cipherSuitesLen = nextPossibleLen;
        } else {
          cipherSuitesLen = possibleLen;
        }
      } else {
        cipherSuitesLen = possibleLen;
      }
      offset += 2;
    } else {
      return createECHDetail(echConfig, targetName, configId, `0x${version.toString(16)}`, publicKey, kemId);
    }

    // 解析第一个 cipher suite (KDF + AEAD)
    let kdfId = 0;
    let aeadId = 0;
    if (cipherSuitesLen >= 4 && offset + 4 <= echConfig.length) {
      kdfId = echConfig.readUInt16BE(offset);
      aeadId = echConfig.readUInt16BE(offset + 2);
    }
    offset += cipherSuitesLen;

    // extensions 长度 (2 bytes)
    let maxNameLength = 0;
    if (offset + 2 <= echConfig.length) {
      const extensionsLen = echConfig.readUInt16BE(offset);
      offset += 2;

      // 检查是否是直接的 public name (Cloudflare 格式)
      // 如果 extensionsLen 合理且剩余数据看起来像域名
      if (extensionsLen > 0 && extensionsLen <= echConfig.length - offset) {
        const possibleName = echConfig.slice(offset, offset + extensionsLen);
        // 检查是否包含可打印字符 (域名)
        const isPrintable = possibleName.every(b => b >= 32 && b < 127);

        if (isPrintable) {
          // 直接是 public name，没有 extension type/length 前缀
          targetName = possibleName.toString().replace(/\x00/g, '');
        } else {
          // 标准格式: 解析 extensions
          const extensionsEnd = offset + extensionsLen;
          while (offset < extensionsEnd && offset + 4 <= echConfig.length) {
            const extType = echConfig.readUInt16BE(offset);
            offset += 2;
            const extLen = echConfig.readUInt16BE(offset);
            offset += 2;

            if (offset + extLen > echConfig.length) break;

            if (extType === 0) {
              targetName = echConfig.slice(offset, offset + extLen).toString();
            }
            offset += extLen;
          }
        }
      }
    }

    const versionStr = version === 0xfe0d ? 'ECH Standard (RFC 9146)' :
                       version === 0xfe0c ? 'Draft 11/12' :
                       version === 0xfe09 ? 'Draft 9' :
                       `Draft/Experimental (0x${version.toString(16)})`;

    return {
      version: versionStr,
      versionHex: `0x${version.toString(16)}`,
      publicName: targetName || '.',
      configId,
      kemId: KEM_IDS[kemId] || `0x${kemId.toString(16).padStart(4, '0')}`,
      kdfId: KDF_IDS[kdfId] || `0x${kdfId.toString(16).padStart(4, '0')}`,
      aeadId: AEAD_IDS[aeadId] || `0x${aeadId.toString(16).padStart(4, '0')}`,
      publicKey: publicKey.toString('base64'),
      publicKeyFingerprint: computeFingerprint(publicKey),
      publicKeyLength: publicKey.length,
      maxNameLength,
      rawECHConfig: echConfig.toString('base64'),
      hpkeSuite: {
        kem: KEM_IDS[kemId] || `Unknown (0x${kemId.toString(16).padStart(4, '0')})`,
        kdf: KDF_IDS[kdfId] || `Unknown (0x${kdfId.toString(16).padStart(4, '0')})`,
        aead: AEAD_IDS[aeadId] || `Unknown (0x${aeadId.toString(16).padStart(4, '0')})`,
      },
    };
  } catch (e) {
    console.error(`[${new Date().toISOString()}] Error parsing ECHConfig:`, e);
    return createECHDetail(echConfig, targetName, 0, 'parse-error');
  }
}

function createECHDetail(
  echConfig: Buffer,
  targetName: string,
  configId: number,
  version: string,
  publicKey?: Buffer,
  kemId?: number
): ECHConfigDetail {
  const versionHex = typeof version === 'string' && version.startsWith('0x')
    ? version
    : '0x0000';

  return {
    version,
    versionHex,
    publicName: targetName || '.',
    configId,
    kemId: kemId ? KEM_IDS[kemId] || `0x${kemId.toString(16).padStart(4, '0')}` : 'unknown',
    kdfId: 'unknown',
    aeadId: 'unknown',
    publicKey: publicKey ? publicKey.toString('base64') : '',
    publicKeyFingerprint: publicKey ? computeFingerprint(publicKey) : '',
    publicKeyLength: publicKey ? publicKey.length : 0,
    maxNameLength: 0,
    rawECHConfig: echConfig.toString('base64'),
    hpkeSuite: {
      kem: 'unknown',
      kdf: 'unknown',
      aead: 'unknown',
    },
  };
}
