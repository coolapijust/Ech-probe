export interface ECHConfigDetail {
  version: string;
  publicName: string;
  keys: string[];
  rawECHConfig: string;
}

/**
 * Parses HTTPS/SVCB record data to extract ECH info.
 * Handles base64 encoded binary data from RFC 8484 DoH response.
 */
export function parseECHFromHttpsRecord(data: string): ECHConfigDetail | null {
  if (!data) return null;

  try {
    // 解码 base64 数据
    const buffer = Buffer.from(data, 'base64');
    return parseSVCBRecord(buffer);
  } catch (e) {
    console.error(`[${new Date().toISOString()}] Failed to parse ECH from record:`, e);
    return null;
  }
}

/**
 * Parse SVCB/HTTPS record (RFC 9460)
 */
function parseSVCBRecord(buffer: Buffer): ECHConfigDetail | null {
  if (buffer.length < 3) return null;

  let offset = 0;

  // SvcPriority (2 bytes)
  const priority = buffer.readUInt16BE(offset);
  offset += 2;

  // TargetName (长度前缀)
  if (offset >= buffer.length) return null;
  const targetLen = buffer[offset++];
  if (offset + targetLen > buffer.length) return null;
  const targetName = buffer.slice(offset, offset + targetLen).toString() || '.';
  offset += targetLen;

  // 解析 SvcParams 查找 ECH (key = 5)
  let echConfig: Buffer | null = null;

  while (offset < buffer.length) {
    if (offset + 4 > buffer.length) break;

    const paramKey = buffer.readUInt16BE(offset);
    offset += 2;
    const paramLen = buffer.readUInt16BE(offset);
    offset += 2;

    if (offset + paramLen > buffer.length) break;

    const paramValue = buffer.slice(offset, offset + paramLen);
    offset += paramLen;

    // ECH key 是 5 (RFC 9460)
    if (paramKey === 5) {
      echConfig = paramValue;
      break;
    }
  }

  if (!echConfig || echConfig.length < 4) return null;

  return parseECHConfig(echConfig, targetName);
}

/**
 * Parse ECHConfig structure (RFC 9614)
 */
function parseECHConfig(echConfig: Buffer, targetName: string): ECHConfigDetail {
  try {
    let offset = 0;

    // ECHConfigContents 长度 (2 bytes)
    const contentsLen = echConfig.readUInt16BE(offset);
    offset += 2;

    if (contentsLen > echConfig.length - offset || contentsLen < 10) {
      return createECHDetail(echConfig, targetName, 'unknown');
    }

    // version (2 bytes)
    const version = echConfig.readUInt16BE(offset);
    offset += 2;

    // config_id (1 byte)
    offset++; // skip config_id

    // kem_id (2 bytes)
    offset += 2; // skip kem_id

    // public_key 长度 (2 bytes)
    const publicKeyLen = echConfig.readUInt16BE(offset);
    offset += 2;

    if (offset + publicKeyLen > echConfig.length) {
      return createECHDetail(echConfig, targetName, `0x${version.toString(16)}`);
    }

    // public_key
    const publicKey = echConfig.slice(offset, offset + publicKeyLen);
    offset += publicKeyLen;

    // cipher_suites 长度 (2 bytes)
    if (offset + 2 > echConfig.length) {
      return createECHDetail(echConfig, targetName, `0x${version.toString(16)}`, publicKey);
    }
    const cipherSuitesLen = echConfig.readUInt16BE(offset);
    offset += 2 + cipherSuitesLen; // skip cipher suites

    // extensions 长度 (2 bytes)
    if (offset + 2 > echConfig.length) {
      return createECHDetail(echConfig, targetName, `0x${version.toString(16)}`, publicKey);
    }
    const extensionsLen = echConfig.readUInt16BE(offset);
    offset += 2;

    // 解析 extensions 查找 public_name (type 0)
    let publicName = targetName;
    const extensionsEnd = offset + extensionsLen;

    while (offset < extensionsEnd && offset + 4 <= echConfig.length) {
      const extType = echConfig.readUInt16BE(offset);
      offset += 2;
      const extLen = echConfig.readUInt16BE(offset);
      offset += 2;

      if (offset + extLen > echConfig.length) break;

      if (extType === 0) {
        // public_name extension
        publicName = echConfig.slice(offset, offset + extLen).toString();
      }
      offset += extLen;
    }

    const versionStr = version === 0xfe0d ? 'Draft 13 (0xfe0d)' :
                       version === 0xfe09 ? 'Draft 9 (0xfe09)' :
                       `0x${version.toString(16)}`;

    return {
      version: versionStr,
      publicName: publicName || targetName,
      keys: [`${publicKey.toString('base64').slice(0, 32)}...`],
      rawECHConfig: echConfig.toString('base64'),
    };
  } catch (e) {
    console.error(`[${new Date().toISOString()}] Error parsing ECHConfig:`, e);
    return createECHDetail(echConfig, targetName, 'parse-error');
  }
}

function createECHDetail(
  echConfig: Buffer,
  targetName: string,
  version: string,
  publicKey?: Buffer
): ECHConfigDetail {
  return {
    version,
    publicName: targetName,
    keys: publicKey ? [`${publicKey.toString('base64').slice(0, 32)}...`] : ['...'],
    rawECHConfig: echConfig.toString('base64'),
  };
}
