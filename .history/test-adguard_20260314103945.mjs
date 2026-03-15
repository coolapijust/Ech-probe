// 阿里 DoH 查询 adguard.com
const dohUrl = 'https://223.5.5.5/dns-query';
const domain = 'adguard.com';

// 构建 DNS 查询包 (HTTPS 记录类型 = 65)
function buildDNSQuery(domain) {
  const encoder = new TextEncoder();
  const domainParts = domain.split('.');
  
  // 计算包大小
  let size = 12; // DNS 头
  for (const part of domainParts) {
    size += 1 + part.length;
  }
  size += 5; // 根标签 + QTYPE (2) + QCLASS (2)
  
  const buffer = new Uint8Array(size);
  const view = new DataView(buffer.buffer);
  
  // DNS 头
  view.setUint16(0, Math.floor(Math.random() * 65535), false); // ID
  view.setUint16(2, 0x0100, false); // Flags: RD
  view.setUint16(4, 1, false); // QDCOUNT
  view.setUint16(6, 0, false); // ANCOUNT
  view.setUint16(8, 0, false); // NSCOUNT
  view.setUint16(10, 0, false); // ARCOUNT
  
  // 查询名称
  let offset = 12;
  for (const part of domainParts) {
    buffer[offset++] = part.length;
    for (let i = 0; i < part.length; i++) {
      buffer[offset++] = part.charCodeAt(i);
    }
  }
  buffer[offset++] = 0; // 根标签
  
  // QTYPE = HTTPS (65)
  view.setUint16(offset, 65, false);
  offset += 2;
  
  // QCLASS = IN (1)
  view.setUint16(offset, 1, false);
  
  return buffer;
}

// Base64 URL 编码 (RFC 4648)
function base64UrlEncode(buffer) {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function queryECH() {
  try {
    const query = buildDNSQuery(domain);
    const encoded = base64UrlEncode(query);
    
    console.log('Querying adguard.com HTTPS record via Alibaba DoH...');
    console.log('DNS query (base64url):', encoded);
    
    const response = await fetch(`${dohUrl}?dns=${encoded}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/dns-message',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.arrayBuffer();
    console.log('Response received, size:', data.byteLength, 'bytes');
    
    // 解析响应
    const view = new DataView(data);
    const ancount = view.getUint16(6, false);
    console.log('Answer count:', ancount);
    
    if (ancount === 0) {
      console.log('No HTTPS records found for adguard.com');
      return;
    }
    
    // 简单解析 - 查找 ECH 配置
    const bytes = new Uint8Array(data);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log('Response (hex):', hex.substring(0, 200) + '...');
    
    // 检查是否包含 ECH 参数 (0x00, 0x05 是 ECH 参数类型)
    let hasECH = false;
    for (let i = 0; i < bytes.length - 2; i++) {
      if (bytes[i] === 0x00 && bytes[i+1] === 0x05 && bytes[i+2] > 0) {
        hasECH = true;
        break;
      }
    }
    
    console.log('ECH Config detected:', hasECH);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

queryECH();
