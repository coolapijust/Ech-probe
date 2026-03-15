export interface ECHConfigDetail {
  version: string;
  publicName: string;
  keys: string[];
  rawECHConfig: string;
}

/**
 * Parses HTTPS/SVCB record data to extract ECH info.
 * Handles DoH JSON response format: "\# <length> <hex bytes>"
 */
export function parseECHFromHttpsRecord(data: string): ECHConfigDetail | null {
  if (!data) return null;

  try {
    const wireData = parseWireFormat(data);
    if (!wireData) return null;

    return parseSVCBRecord(wireData);
  } catch (e) {
    console.error(`[${new Date().toISOString()}] Failed to parse ECH from record:`, e);
    return null;
  }
}

/**
 * Parse wire format: "\# <length> <hex bytes>"
 */
function parseWireFormat(data: string): Buffer | null {
  if (!data.startsWith('\\#')) {
    try {
      return Buffer.from(data, 'base64');
    } catch {
      return null;
    }
  }

  const parts = data.trim().split(/\s+/);
  if (parts.length < 3 || parts[0] !== '\\#') {
    return null;
  }

  const hexBytes = parts.slice(2).join('');
  return Buffer.from(hexBytes.replace(/\s/g, ''), 'hex');
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

  // TargetName (length-prefixed)
  if (offset >= buffer.length) return null;
  const targetLen = buffer[offset++];
  if (offset + targetLen > buffer.length) return null;
  const targetName = buffer.slice(offset, offset + targetLen).toString() || '.';
  offset += targetLen;

  // Parse SvcParams to find ECH (key = 5)
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

    // ECH key is 5 (RFC 9460)
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

    // ECHConfigContents length (2 bytes) - this is the length of the inner contents
    const contentsLen = echConfig.readUInt16BE(offset);
    offset += 2;

    if (contentsLen > echConfig.length - offset || contentsLen < 10) {
      return createECHDetail(echConfig, targetName, 'unknown');
    }

    // Parse ECHConfigContents
    // version (2 bytes)
    const version = echConfig.readUInt16BE(offset);
    offset += 2;

    // config_id (1 byte)
    const configId = echConfig[offset++];

    // kem_id (2 bytes)
    const kemId = echConfig.readUInt16BE(offset);
    offset += 2;

    // public_key length (2 bytes)
    const publicKeyLen = echConfig.readUInt16BE(offset);
    offset += 2;

    if (offset + publicKeyLen > echConfig.length) {
      return createECHDetail(echConfig, targetName, `0x${version.toString(16)}`);
    }

    // public_key
    const publicKey = echConfig.slice(offset, offset + publicKeyLen);
    offset += publicKeyLen;

    // cipher_suites length (2 bytes)
    if (offset + 2 > echConfig.length) {
      return createECHDetail(echConfig, targetName, `0x${version.toString(16)}`, publicKey);
    }
    const cipherSuitesLen = echConfig.readUInt16BE(offset);
    offset += 2;

    // Skip cipher suites
    offset += cipherSuitesLen;

    // extensions length (2 bytes)
    if (offset + 2 > echConfig.length) {
      return createECHDetail(echConfig, targetName, `0x${version.toString(16)}`, publicKey);
    }
    const extensionsLen = echConfig.readUInt16BE(offset);
    offset += 2;

    // Parse extensions to find public_name (type 0)
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
