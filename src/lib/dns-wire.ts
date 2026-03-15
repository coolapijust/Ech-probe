// DNS Wire Format 编码/解码工具

export function buildDNSQuery(domain: string, type: number): Uint8Array {
  const labels = domain.split('.');
  const parts: number[] = [];
  
  // Transaction ID
  parts.push(0x00, 0x00);
  // Flags: Standard query
  parts.push(0x01, 0x00);
  // Questions: 1
  parts.push(0x00, 0x01);
  // Answer RRs: 0
  parts.push(0x00, 0x00);
  // Authority RRs: 0
  parts.push(0x00, 0x00);
  // Additional RRs: 0
  parts.push(0x00, 0x00);
  
  // Query name
  for (const label of labels) {
    parts.push(label.length);
    for (let i = 0; i < label.length; i++) {
      parts.push(label.charCodeAt(i));
    }
  }
  parts.push(0x00);
  
  // Query type
  parts.push((type >> 8) & 0xff, type & 0xff);
  // Query class: IN
  parts.push(0x00, 0x01);
  
  return new Uint8Array(parts);
}

export function parseDNSResponse(buffer: Buffer): string[] {
  const results: string[] = [];
  let offset = 12;
  
  const qdcount = (buffer[4] << 8) | buffer[5];
  const ancount = (buffer[6] << 8) | buffer[7];
  
  for (let i = 0; i < qdcount; i++) {
    while (buffer[offset] !== 0) {
      if ((buffer[offset] & 0xc0) === 0xc0) {
        offset += 2;
        break;
      }
      offset += buffer[offset] + 1;
    }
    if (buffer[offset] === 0) offset++;
    offset += 4;
  }
  
  for (let i = 0; i < ancount; i++) {
    while (buffer[offset] !== 0) {
      if ((buffer[offset] & 0xc0) === 0xc0) {
        offset += 2;
        break;
      }
      offset += buffer[offset] + 1;
    }
    if (buffer[offset] === 0) offset++;
    
    offset += 8;
    const rdlength = (buffer[offset] << 8) | buffer[offset + 1];
    offset += 2;
    
    const rdata = buffer.slice(offset, offset + rdlength);
    results.push(rdata.toString('base64'));
    offset += rdlength;
  }
  
  return results;
}
