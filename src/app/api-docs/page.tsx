import Link from 'next/link';

export const metadata = {
  title: 'ECH Probe — API 文档',
  description: 'ECH 支持检测公共 API 使用文档，支持 DNS 和 HRR 两种检测模式。',
};

const ENDPOINT = '/api/ech-check';

export default function ApiDocsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground font-sans">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              ← 返回探针
            </Link>
            <span className="text-border/60">|</span>
            <span className="font-semibold text-foreground">API 文档</span>
          </div>
          <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">/api/ech-check</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">

        {/* Title */}
        <section className="space-y-3">
          <h1 className="text-3xl font-bold text-balance">ECH 支持检测 API</h1>
          <p className="text-muted-foreground leading-relaxed">
            检测指定域名是否启用了加密客户端问候（Encrypted Client Hello，ECH）。
            支持两种检测模式：通过多 DNS 解析器查询 HTTPS 记录（DNS 模式），以及通过 TLS
            握手 Hello Retry Request 直接从服务器获取 ECH 配置（HRR 模式）。
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge color="green">免费</Badge>
            <Badge color="blue">无需鉴权</Badge>
            <Badge color="gray">CORS 已开放</Badge>
          </div>
        </section>

        <Divider />

        {/* Base URL */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">端点</h2>
          <CodeBlock lang="http">
            {`GET  ${ENDPOINT}?domain=example.com\nPOST ${ENDPOINT}`}
          </CodeBlock>
        </section>

        <Divider />

        {/* Parameters */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold">参数</h2>

          <div className="space-y-4">
            <ParamRow
              name="domain"
              type="string"
              required
              desc="目标域名，不含协议头和路径。例如：example.com"
            />
            <ParamRow
              name="mode"
              type='"dns" | "hrr" | "all"'
              defaultVal="dns"
              desc={
                <>
                  检测模式。<code className="text-xs bg-muted px-1 py-0.5 rounded">dns</code> — 通过多 DoH 解析器查询 HTTPS DNS 记录；
                  {' '}<code className="text-xs bg-muted px-1 py-0.5 rounded">hrr</code> — 通过 TLS Hello Retry Request 直接获取；
                  {' '}<code className="text-xs bg-muted px-1 py-0.5 rounded">all</code> — 并行运行两种模式。
                </>
              }
            />
            <ParamRow
              name="resolvers"
              type="string[]"
              defaultVal="Cloudflare, Google, Alibaba, Tencent"
              desc='仅 DNS 模式有效。逗号分隔的解析器名称（GET），或数组（POST）。可选值：Cloudflare、Google、Alibaba、Tencent、Custom。'
            />
          </div>
        </section>

        <Divider />

        {/* Response */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">响应格式</h2>
          <CodeBlock lang="json">
            {`{
  "domain": "meta.com",
  "mode": "dns",
  "supported": true,
  "results": [
    {
      "resolver": "Cloudflare",
      "detected": true,
      "error": null,
      "details": {
        "version": "ECHConfig draft-18 (0xfe0d)",
        "configId": 42,
        "kemId": "DHKEM(X25519, HKDF-SHA256)",
        "publicKeyLength": 32,
        "publicKeyFingerprint": "a3f2...",
        "publicName": "meta.com",
        "hpkeSuite": {
          "kem": "DHKEM(X25519, HKDF-SHA256)",
          "kdf": "HKDF-SHA256",
          "aead": "AES-128-GCM"
        },
        "rawECHConfig": "0045fe0d..."
      }
    }
  ],
  "summary": {
    "total": 4,
    "detected": 3,
    "consistent": false
  }
}`}
          </CodeBlock>

          <div className="space-y-3">
            <RespRow name="domain" type="string" desc="查询的域名" />
            <RespRow name="mode" type="string" desc="使用的检测模式" />
            <RespRow name="supported" type="boolean" desc="至少一个来源检测到 ECH 配置则为 true" />
            <RespRow name="results" type="array" desc="每个解析器/来源的检测结果" />
            <RespRow name="results[].resolver" type="string" desc="解析器名称" />
            <RespRow name="results[].detected" type="boolean" desc="是否检测到 ECH 配置" />
            <RespRow name="results[].error" type="string | null" desc="错误信息，无错误时为 null" />
            <RespRow name="results[].details" type="object | null" desc="ECH 配置详情，未检测到时为 null" />
            <RespRow name="summary.total" type="number" desc="总检测来源数量" />
            <RespRow name="summary.detected" type="number" desc="检测到 ECH 的来源数量" />
            <RespRow name="summary.consistent" type="boolean" desc="所有来源结果是否一致" />
          </div>
        </section>

        <Divider />

        {/* Examples */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold">示例</h2>

          <div className="space-y-8">
            <ExampleBlock
              title="GET — DNS 模式（默认）"
              request={`GET /api/ech-check?domain=meta.com`}
            />
            <ExampleBlock
              title="GET — HRR 模式"
              request={`GET /api/ech-check?domain=meta.com&mode=hrr`}
            />
            <ExampleBlock
              title="GET — 两种模式并行"
              request={`GET /api/ech-check?domain=meta.com&mode=all`}
            />
            <ExampleBlock
              title="GET — 指定解析器"
              request={`GET /api/ech-check?domain=meta.com&resolvers=Cloudflare,Google`}
            />
            <ExampleBlock
              title="POST — 完整请求体"
              request={`POST /api/ech-check\nContent-Type: application/json\n\n{\n  "domain": "meta.com",\n  "mode": "all",\n  "resolvers": ["Cloudflare", "Google"]\n}`}
            />
            <ExampleBlock
              title="cURL"
              request={`curl "https://your-deployment.vercel.app/api/ech-check?domain=meta.com&mode=all"`}
            />
            <ExampleBlock
              title="JavaScript (fetch)"
              request={`const res = await fetch('/api/ech-check?domain=meta.com&mode=dns');\nconst data = await res.json();\nconsole.log(data.supported); // true or false`}
            />
          </div>
        </section>

        <Divider />

        {/* Error codes */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">错误码</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left py-2 pr-6 font-medium text-muted-foreground w-20">状态码</th>
                  <th className="text-left py-2 pr-6 font-medium text-muted-foreground">原因</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">响应体</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {[
                  ['400', '缺少 domain 参数或域名格式非法', '{ "error": "Missing required parameter: domain" }'],
                  ['405', '请求方法不受支持（仅 GET/POST）', '{ "error": "Method not allowed" }'],
                  ['500', '服务器内部错误（DNS 查询失败等）', '{ "error": "..." }'],
                ].map(([code, reason, body]) => (
                  <tr key={code}>
                    <td className="py-3 pr-6 font-mono text-destructive">{code}</td>
                    <td className="py-3 pr-6 text-foreground">{reason}</td>
                    <td className="py-3 font-mono text-xs text-muted-foreground">{body}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Divider />

        {/* Notes */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">注意事项</h2>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside leading-relaxed">
            <li>HRR 模式在 Vercel 生产环境中通过独立的 Go Serverless Handler 运行，需部署后方可使用。</li>
            <li>DNS 模式通过标准 DoH（DNS-over-HTTPS）查询，结果受各解析器缓存影响，TTL 通常为 60–300 秒。</li>
            <li>所有请求均已开放 CORS，可从浏览器前端直接调用。</li>
            <li>本 API 无速率限制，但请避免高频滥用。</li>
          </ul>
        </section>

      </div>

      <footer className="border-t border-border/40 mt-16">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>ECH Probe</span>
          <Link href="/" className="hover:text-foreground transition-colors">返回探针工具</Link>
        </div>
      </footer>
    </main>
  );
}

// ——— 内部 UI 组件 ———

function Badge({ children, color }: { children: React.ReactNode; color: 'green' | 'blue' | 'gray' }) {
  const cls = {
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    gray: 'bg-muted text-muted-foreground border-border/40',
  }[color];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cls}`}>{children}</span>
  );
}

function Divider() {
  return <hr className="border-border/40" />;
}

function CodeBlock({ children, lang }: { children: string; lang?: string }) {
  return (
    <div className="rounded-lg bg-muted/60 border border-border/40 overflow-x-auto">
      {lang && (
        <div className="px-4 py-2 border-b border-border/40 text-xs text-muted-foreground font-mono">{lang}</div>
      )}
      <pre className="p-4 text-sm font-mono text-foreground leading-relaxed whitespace-pre-wrap break-all">
        {children}
      </pre>
    </div>
  );
}

function ParamRow({
  name,
  type,
  required,
  defaultVal,
  desc,
}: {
  name: string;
  type: string;
  required?: boolean;
  defaultVal?: string;
  desc: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 py-3 border-b border-border/20 last:border-0">
      <div className="w-36 shrink-0">
        <span className="font-mono text-sm text-foreground">{name}</span>
        {required && <span className="ml-1 text-xs text-destructive">*</span>}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{type}</span>
          {defaultVal && (
            <span className="text-xs text-muted-foreground">默认：<code className="font-mono">{defaultVal}</code></span>
          )}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function RespRow({ name, type, desc }: { name: string; type: string; desc: string }) {
  return (
    <div className="flex gap-4 py-2 border-b border-border/20 last:border-0 text-sm">
      <span className="w-48 shrink-0 font-mono text-foreground">{name}</span>
      <span className="w-24 shrink-0 text-xs font-mono text-muted-foreground self-start mt-0.5">{type}</span>
      <span className="text-muted-foreground leading-relaxed">{desc}</span>
    </div>
  );
}

function ExampleBlock({ title, request }: { title: string; request: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <CodeBlock lang="http">{request}</CodeBlock>
    </div>
  );
}
