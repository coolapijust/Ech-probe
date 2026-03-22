# ECH Probe - 可视化 ECH 配置检测工具

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC)](https://tailwindcss.com/)

ECH Probe 是一个用于检测和分析域名 ECH (Encrypted Client Hello) 配置以及检测潜在的对HTTPS记录的DNS污染的 Web 工具。通过多个 DNS 解析器同时查询，帮助您验证 ECH 配置的正确性和一致性。

🔗 **在线访问**: https://future.softx.eu.org

## 功能特性

- **多解析器检测**: 同时查询 Cloudflare、Google、AliDns、Dnspod 等公共 DNS 解析器
- **ECH 配置解析**: 自动解析 ECHConfig 内容，显示版本、配置 ID、公钥等详细信息
- **跨源对比**: 对比不同 DNS 解析器返回的结果，检测配置一致性
- **HRR 模式**: 通过 Hello Retry Request 机制获取某些网站隐藏的 ECH 配置

## 技术栈

- **框架**: [Next.js 16](https://nextjs.org/) (App Router)
- **语言**: [TypeScript](https://www.typescriptlang.org/)
- **样式**: [Tailwind CSS 4](https://tailwindcss.com/)
- **组件库**: [shadcn/ui](https://ui.shadcn.com/)
- **图标**: [Lucide React](https://lucide.dev/)
- **DNS 查询**: DoH (DNS over HTTPS)


### 构建

```bash
pnpm build
```

## ECH 支持检测

工具支持检测以下 KEM 算法：

| KEM ID | 算法名称 |
|--------|----------|
| 0x0010 | DHKEM(P-256, HKDF-SHA256) |
| 0x0011 | DHKEM(P-384, HKDF-SHA384) |
| 0x0012 | DHKEM(P-521, HKDF-SHA512) |
| 0x0020 | DHKEM(X25519, HKDF-SHA256) |
| 0x0021 | DHKEM(X448, HKDF-SHA512) |
| 0x4110 | ML-KEM-768 (Experimental/PQ) |
| 0x41fa | Cloudflare X25519 (Private Use) |
| 0x4112 | Cloudflare X25519 (Private Use) |

## Hello Retry Request (HRR) 模式

某些网站（如 Meta 旗下服务）的 ECH 配置不会通过常规 DNS 查询返回，而是隐藏在 TLS 握手过程中。HRR 模式通过以下机制获取这些隐藏配置：

### 工作原理

1. **构造无效 ECH 配置**: 客户端发送一个格式正确但公钥无效的 ECH 配置给服务器
2. **触发 Hello Retry Request**: 服务器检测到无效的 ECH 配置后，返回 `ECHRejectionError` 并附带正确的 ECH 配置
3. **提取真实配置**: 从服务器的响应中提取 `retry_configs`，解析出真实的 ECH 公钥和配置信息

### 使用方法

1. 在查询界面切换到 **HRR 模式**
2. 输入目标域名（如 `meta.com`）
3. 点击查询，等待 TLS 握手完成
4. 查看解析出的 ECH 配置详情

### 技术实现

- 基于 Go 1.25+ 的 `crypto/tls` 包 ECH 支持
- 使用 Vercel Serverless Functions 部署 Go 后端
- 统一 API 端点 `/api/hrr` 同时支持本地和线上环境

### 注意事项

- HRR 模式需要与目标服务器建立 TLS 连接，查询时间比 DNS 模式稍长
- 某些服务器可能不支持 ECH 或不会返回 retry configs
- 仅支持 TLS 1.3 协议

## 项目结构

```
├── src/
│   ├── app/
│   │   ├── actions/
│   │   │   └── dns.ts          # DNS 查询逻辑
│   │   ├── page.tsx            # 主页面
│   │   └── layout.tsx          # 根布局
│   ├── components/
│   │   └── ECHProbe/
│   │       ├── DomainForm.tsx  # 域名输入表单
│   │       └── ResultsDisplay.tsx  # 结果展示
│   ├── lib/
│   │   ├── dns-parser.ts       # DNS 解析逻辑
│   │   ├── dns-wire.ts         # DNS Wire 格式处理
│   │   └── doh-query.ts        # DoH 查询实现
│   ├── context/
│   │   └── LanguageContext.tsx # 语言切换上下文
│   └── i18n/
│       └── translations.ts     # 多语言翻译
├── public/
└── package.json
```

## 隐私说明

- 所有 DNS 查询通过 DoH (DNS over HTTPS) 进行，加密传输
- 不收集或存储任何用户查询的域名信息
- DoH查询完全于后端进行以避免国内对海外DoH服务的阻断，前端仅负责展示查询结果，但后端零日志。

## 许可证

MIT License

## 相关链接

- [ECH RFC 9146](https://datatracker.ietf.org/doc/html/rfc9146)
- [Cloudflare ECH](https://developers.cloudflare.com/ssl/edge-certificates/ech/)
- [Project GitHub](https://github.com/coolapijust/Ech-probe)

---

Made with ❤️ for a more private web
