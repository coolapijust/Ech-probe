'use server';

// DNS 服务器配置
const DNS_SERVERS: Record<string, { url: string; name: string }> = {
  'cloudflare-dns.com': {
    url: 'https://cloudflare-dns.com/dns-query',
    name: 'Cloudflare',
  },
  'dns.google': {
    url: 'https://dns.google/dns-query',
    name: 'Google',
  },
  'dns.alidns.com': {
    url: 'https://223.5.5.5/dns-query',
    name: 'Alibaba',
  },
  'doh.pub': {
    url: 'https://1.12.12.12/dns-query',
    name: 'Tencent',
  },
};

const QUERY_TIMEOUT = 10000;
const HTTPS_RECORD_TYPE = 65;

/**
 * 查询域名的 HTTPS 记录 (ECH 配置)
 */
export async function queryDoH(domain: string, resolverUrl: string): Promise<string[]> {
  const url = new URL(resolverUrl);
  const dnsHost = url.hostname;
  const serverConfig = DNS_SERVERS[dnsHost];

  if (!serverConfig) {
    throw new Error(`Unknown DNS server: ${dnsHost}`);
  }

  console.log(`[${new Date().toISOString()}] Querying ${domain} via ${serverConfig.name}`);

  const response = await queryDoHOverHTTP(domain, serverConfig.url);
  return response;
}

/**
 * 通过 RFC 8484 DoH 接口查询 HTTPS 记录
 */
async function queryDoHOverHTTP(domain: string, dohUrl: string): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), QUERY_TIMEOUT);

  try {
    // 构造 DNS 查询包
    const query = encodeDNSQuery(domain, HTTPS_RECORD_TYPE);

    const response = await fetch(dohUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/dns-message',
        'Accept': 'application/dns-message',
      },
      body: query,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseBuffer = Buffer.from(await response.arrayBuffer());
    const decoded = decodeDNSResponse(responseBuffer);

    console.log(`[${new Date().toISOString()}] ${domain} got ${decoded.answerList.length} answers from ${dohUrl}`);

    // 提取 HTTPS 记录数据 (base64 编码)
    const httpsRecords = decoded.answerList
      .filter((ans: any) => ans.type === HTTPS_RECORD_TYPE)
      .map((ans: any) => ans.data.toString('base64'));

    return httpsRecords;
  } catch (err: any) {
    clearTimeout(timeout);
    console.error(`[${new Date().toISOString()}] DoH query failed:`, err.message);
    throw err;
  }
}

/**
 * 编码 DNS 查询包
 */
function encodeDNSQuery(domain: string, type: number): Buffer {
  const id = Math.floor(Math.random() * 65535);
  const flags = 0x0100; // RD=1
  const questions = 1;

  // Header (12 bytes)
  const header = Buffer.alloc(12);
  header.writeUInt16BE(id, 0);
  header.writeUInt16BE(flags, 2);
  header.writeUInt16BE(questions, 4);
  header.writeUInt16BE(0, 6); // Answer RRs
  header.writeUInt16BE(0, 8); // Authority RRs
  header.writeUInt16BE(0, 10); // Additional RRs

  // Question: 域名编码
  const labels = domain.split('.');
  const nameParts: Buffer[] = [];
  for (const label of labels) {
    nameParts.push(Buffer.from([label.length]));
    nameParts.push(Buffer.from(label, 'ascii'));
  }
  nameParts.push(Buffer.from([0])); // 结束符

  const name = Buffer.concat(nameParts);

  // QTYPE (2 bytes)
  const qtype = Buffer.alloc(2);
  qtype.writeUInt16BE(type, 0);

  // QCLASS (2 bytes) - IN = 1
  const qclass = Buffer.alloc(2);
  qclass.writeUInt16BE(1, 0);

  return Buffer.concat([header, name, qtype, qclass]);
}

/**
 * 解码 DNS 响应包
 */
function decodeDNSResponse(buffer: Buffer): { answerList: any[] } {
  const answers = buffer.readUInt16BE(6);
  let offset = 12;

  // 跳过 Questions
  const questions = buffer.readUInt16BE(4);
  for (let i = 0; i < questions; i++) {
    const result = decodeDomain(buffer, offset);
    offset = result.offset;
    offset += 4; // QTYPE + QCLASS
  }

  // 解析 Answers
  const answerList: any[] = [];
  for (let i = 0; i < answers; i++) {
    const result = decodeDomain(buffer, offset);
    const name = result.name;
    offset = result.offset;

    const type = buffer.readUInt16BE(offset);
    offset += 2;
    const cls = buffer.readUInt16BE(offset);
    offset += 2;
    const ttl = buffer.readUInt32BE(offset);
    offset += 4;
    const rdlength = buffer.readUInt16BE(offset);
    offset += 2;
    const rdata = buffer.slice(offset, offset + rdlength);
    offset += rdlength;

    answerList.push({ name, type, class: cls, ttl, data: rdata });
  }

  return { answerList };
}

/**
 * 解码域名 (支持压缩指针)
 */
function decodeDomain(buffer: Buffer, offset: number): { name: string; offset: number } {
  const labels: string[] = [];
  let jumped = false;
  let jumpOffset = 0;

  while (true) {
    const len = buffer[offset];

    if (len === 0) {
      offset++;
      break;
    }

    // 检查是否是压缩指针 (11xxxxxx)
    if ((len & 0xC0) === 0xC0) {
      if (!jumped) {
        jumpOffset = offset + 2;
      }
      offset = ((len & 0x3F) << 8) | buffer[offset + 1];
      jumped = true;
      continue;
    }

    offset++;
    labels.push(buffer.slice(offset, offset + len).toString('ascii'));
    offset += len;
  }

  return { name: labels.join('.'), offset: jumped ? jumpOffset : offset };
}
