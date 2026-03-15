'use server';

import dgram from 'dgram';
import * as dnsPacket from 'dns-packet';

// DNS 服务器 IP 映射
const DNS_SERVERS: Record<string, string[]> = {
  'cloudflare-dns.com': ['1.1.1.1', '1.0.0.1'],
  'dns.google': ['8.8.8.8', '8.8.4.4'],
  'dns.alidns.com': ['223.5.5.5', '223.6.6.6'],
  'doh.pub': ['119.29.29.29', '119.28.28.28'],
};

const DNS_PORT = 53;
const QUERY_TIMEOUT = 5000;

// 使用 UDP DNS 查询 HTTPS 记录
export async function queryDoH(domain: string, resolverUrl: string): Promise<string[]> {
  const url = new URL(resolverUrl);
  const dnsHost = url.hostname;
  const serverIPs = DNS_SERVERS[dnsHost];

  if (!serverIPs) {
    throw new Error(`Unknown DNS server: ${dnsHost}`);
  }

  // 尝试每个 DNS 服务器
  for (const serverIP of serverIPs) {
    try {
      const records = await queryDNSOverUDP(domain, serverIP);
      return records;
    } catch (err: any) {
      console.error(`DNS query to ${serverIP} failed:`, err.message);
      // 尝试下一个服务器
    }
  }

  throw new Error('All DNS servers failed');
}

// 通过 UDP 发送 DNS 查询
function queryDNSOverUDP(domain: string, serverIP: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error('DNS query timeout'));
    }, QUERY_TIMEOUT);

    // 构造 DNS 查询包
    const query = dnsPacket.encode({
      type: 'query',
      id: Math.floor(Math.random() * 65535),
      flags: dnsPacket.RECURSION_DESIRED,
      questions: [{
        type: 'HTTPS',
        name: domain,
      }],
    });

    socket.on('message', (message) => {
      clearTimeout(timeout);
      socket.close();

      try {
        const response = dnsPacket.decode(message);

        if (response.answers && response.answers.length > 0) {
          const records = response.answers
            .filter((a: any) => a.type === 'HTTPS')
            .map((a: any) => {
              // 将 HTTPS 记录数据转换为字符串
              if (typeof a.data === 'string') {
                return a.data;
              }
              if (Buffer.isBuffer(a.data)) {
                return a.data.toString('base64');
              }
              return JSON.stringify(a.data);
            });
          resolve(records);
        } else {
          resolve([]);
        }
      } catch (err: any) {
        reject(new Error(`Failed to decode DNS response: ${err.message}`));
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      socket.close();
      reject(err);
    });

    // 发送查询
    socket.send(query, DNS_PORT, serverIP, (err) => {
      if (err) {
        clearTimeout(timeout);
        socket.close();
        reject(err);
      }
    });
  });
}
