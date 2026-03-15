export interface ECHConfigDetail {
  version: string;
  publicName: string;
  keys: string[];
  rawECHConfig: string;
}

/**
 * Parses HTTPS/SVCB record data to extract ECH info.
 * Handles both text format (from DoH JSON) and binary format (from DNS UDP).
 */
export function parseECHFromHttpsRecord(data: string): ECHConfigDetail | null {
  if (!data) return null;

  try {
    // Try to detect format
    const isTextFormat = data.includes('alpn=') || data.includes('ech=');
    
    if (isTextFormat) {
      return parseTextFormat(data);
    } else {
      // Assume base64 encoded binary format
      return parseBinaryFormat(data);
    }
  } catch (e) {
    console.error("Failed to parse ECH from record", e);
    return null;
  }
}

function parseTextFormat(data: string): ECHConfigDetail | null {
  if (!data.includes('ech=')) return null;

  const parts = data.split(/\s+/);
  const echPart = parts.find(p => p.startsWith('ech='));
  if (!echPart) return null;

  const rawECH = echPart.replace('ech=', '').replace(/"/g, '');
  
  return {
    version: "0xfe0d (Draft 13+)",
    publicName: "N/A (Encapsulated)",
    keys: [rawECH.substring(0, 16) + "..."],
    rawECHConfig: rawECH
  };
}

function parseBinaryFormat(base64Data: string): ECHConfigDetail | null {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Minimum size for HTTPS record with ECH
    if (buffer.length < 10) return null;
    
    // Parse SVCB/HTTPS record format (RFC 9460)
    // Format: priority (2 bytes) + target name + svc params
    let offset = 0;
    
    // SvcPriority
    const priority = buffer.readUInt16BE(offset);
    offset += 2;
    
    // TargetName (length-prefixed)
    const targetLen = buffer[offset++];
    const targetName = buffer.slice(offset, offset + targetLen).toString();
    offset += targetLen;
    
    // Parse SvcParams
    let echConfig: string | null = null;
    
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
        echConfig = paramValue.toString('base64');
      }
    }
    
    if (!echConfig) return null;
    
    return {
      version: "0xfe0d (Draft 13+)",
      publicName: targetName || "N/A (Encapsulated)",
      keys: [echConfig.substring(0, 16) + "..."],
      rawECHConfig: echConfig
    };
  } catch (e) {
    console.error("Failed to parse binary ECH record", e);
    return null;
  }
}
