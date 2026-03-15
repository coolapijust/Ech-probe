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
    // Parse the wire format data from DoH response
    // Format: "\# <length> <hex bytes>"
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
  // Check if it's wire format
  if (!data.startsWith('\\#')) {
    // Try base64 decoding
    try {
      return Buffer.from(data, 'base64');
    } catch {
      return null;
    }
  }

  // Parse "\# <length> <hex bytes>"
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
  const targetName = buffer.slice(offset, offset + targetLen).toString();
  offset += targetLen;

  // Parse SvcParams
  let echConfig: Buffer | null = null;

  while (offset < buffer.length) {
    if (offset + 4 > buffer.length) break;

    // SvcParamKey (2 bytes)
    const paramKey = buffer.readUInt16BE(offset);
    offset += 2;

    // SvcParamValue length (2 bytes)
    const paramLen = buffer.readUInt16BE(offset);
    offset += 2;

    if (offset + paramLen > buffer.length) break;

    const paramValue = buffer.slice(offset, offset + paramLen);
    offset += paramLen;

    // ECH key is 5 (RFC 9460)
    if (paramKey === 5) {
      echConfig = paramValue;
    }
  }

  if (!echConfig || echConfig.length < 2) return null;

  // Parse ECHConfig (RFC 9614)
  return parseECHConfig(echConfig, targetName);
}

/**
 * Parse ECHConfig structure
 */
function parseECHConfig(echConfig: Buffer, targetName: string): ECHConfigDetail {
  let offset = 0;

  // ECHConfigContents length (2 bytes)
  const contentsLen = echConfig.readUInt16BE(offset);
  offset += 2;

  if (contentsLen > echConfig.length - offset) {
    return createECHDetail(echConfig, targetName, 'unknown');
  }

  const contents = echConfig.slice(offset, offset + contentsLen);
  offset = 0;

  // version (2 bytes)
  const version = contents.readUInt16BE(offset);
  offset += 2;

  // config_id (1 byte)
  const configId = contents[offset++];

  // kem_id (2 bytes)
  const kemId = contents.readUInt16BE(offset);
  offset += 2;

  // public_key length (2 bytes)
  const publicKeyLen = contents.readUInt16BE(offset);
  offset += 2;

  // public_key
  const publicKey = contents.slice(offset, offset + publicKeyLen);
  offset += publicKeyLen;

  // cipher_suites length (2 bytes)
  const cipherSuitesLen = contents.readUInt16BE(offset);
  offset += 2;
  offset += cipherSuitesLen; // Skip cipher suites for now

  // extensions length (2 bytes)
  const extensionsLen = contents.readUInt16BE(offset);
  offset += 2;

  // Look for public_name extension (type 0)
  let publicName = targetName;
  const extensionsEnd = offset + extensionsLen;

  while (offset < extensionsEnd && offset < contents.length) {
    if (offset + 4 > contents.length) break;

    const extType = contents.readUInt16BE(offset);
    offset += 2;
    const extLen = contents.readUInt16BE(offset);
    offset += 2;

    if (offset + extLen > contents.length) break;

    if (extType === 0) {
      // public_name extension
      publicName = contents.slice(offset, offset + extLen).toString();
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
}

function createECHDetail(echConfig: Buffer, targetName: string, version: string): ECHConfigDetail {
  return {
    version,
    publicName: targetName,
    keys: [echConfig.toString('base64').slice(0, 32) + '...'],
    rawECHConfig: echConfig.toString('base64'),
  };
}
