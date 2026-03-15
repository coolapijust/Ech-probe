
export interface ECHConfigDetail {
  version: string;
  publicName: string;
  keys: string[];
  rawECHConfig: string;
}

/**
 * Parses a string representation of an HTTPS/SVCB record to find ECH info.
 * Typical format: "# 1 . alpn=\"h3,h2\" ech=AEn+..."
 */
export function parseECHFromHttpsRecord(data: string): ECHConfigDetail | null {
  if (!data || !data.includes('ech=')) return null;

  try {
    const parts = data.split(/\s+/);
    const echPart = parts.find(p => p.startsWith('ech='));
    if (!echPart) return null;

    const rawECH = echPart.replace('ech=', '').replace(/"/g, '');
    
    // In a real scenario, we'd base64 decode and parse the binary ECHConfig structure (RFC 9446).
    // For this probe, we'll extract simulated metadata or just show the presence.
    // ECHConfig version is typically at the start of the decoded binary.
    
    return {
      version: "0xfe0d (Draft 13+)", // Most common modern ECH version
      publicName: "N/A (Encapsulated)",
      keys: [rawECH.substring(0, 16) + "..."],
      rawECHConfig: rawECH
    };
  } catch (e) {
    console.error("Failed to parse ECH from record", e);
    return null;
  }
}
