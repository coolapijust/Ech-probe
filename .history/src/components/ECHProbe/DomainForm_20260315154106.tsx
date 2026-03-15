'use client';

import { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Globe, Plus, X, Server, Search, Loader2, RefreshCw, Shield } from 'lucide-react';

interface DomainFormProps {
  onAnalyze: (domain: string, resolvers: string[], customResolvers: string[]) => void;
  onHRRAnalyze?: (domain: string) => void;
  isLoading: boolean;
  mode?: 'dns' | 'hrr';
  onModeChange?: (mode: 'dns' | 'hrr') => void;
}

const PRESET_RESOLVERS = [
  { name: 'Cloudflare', color: 'bg-orange-500' },
  { name: 'Google', color: 'bg-blue-500' },
  { name: 'Alibaba', color: 'bg-red-500' },
  { name: 'Tencent', color: 'bg-green-500' },
];

export function DomainForm({ onAnalyze, onHRRAnalyze, isLoading, mode = 'dns', onModeChange }: DomainFormProps) {
  const { t } = useLanguage();
  const [domain, setDomain] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customResolvers, setCustomResolvers] = useState<string[]>([]);

  const handleAddCustom = () => {
    if (customUrl && !customResolvers.includes(customUrl)) {
      try {
        new URL(customUrl);
        setCustomResolvers((prev) => [...prev, customUrl]);
        setCustomUrl('');
      } catch (e) {
        console.error('Invalid URL');
      }
    }
  };

  const handleRemoveCustom = (url: string) => {
    setCustomResolvers((prev) => prev.filter((r) => r !== url));
  };

  const handleSubmit = () => {
    if (domain && domain.trim()) {
      if (mode === 'hrr' && onHRRAnalyze) {
        onHRRAnalyze(domain.trim());
      } else {
        onAnalyze(domain.trim(), PRESET_RESOLVERS.map(r => r.name), customResolvers);
      }
    }
  };

  return (
    <div className="bg-card rounded-2xl border shadow-xl overflow-hidden">
      {/* 域名输入区域 */}
      <div className="p-4 lg:p-5 border-b border-border/50">
        <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
          <Globe className="w-4 h-4" />
          {t.targetDomain}
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder={t.domainPlaceholder || 'example.com'}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && domain && handleSubmit()}
            className="w-full h-11 pl-4 pr-11 text-base bg-background/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
          />
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
        </div>
      </div>

      {/* 模式切换 */}
      {onModeChange && (
        <div className="px-4 lg:px-5 pt-4 lg:pt-5">
          <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-lg">
            <button
              type="button"
              onClick={() => onModeChange('dns')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'dns'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Server className="w-4 h-4" />
              DNS 查询
            </button>
            <button
              type="button"
              onClick={() => onModeChange('hrr')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'hrr'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              HRR 模式
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {mode === 'dns'
              ? '通过多个 DNS 解析器查询 HTTPS 记录获取 ECH 配置'
              : '通过 TLS Hello Retry Request 从服务器获取 ECH 配置'}
          </p>
        </div>
      )}

      {/* 解析器配置区域 */}
      <div className="p-4 lg:p-5 space-y-3 lg:space-y-4">
        {/* 公共解析器 - 仅在 DNS 模式显示 */}
        {mode === 'dns' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Server className="w-4 h-4" />
              {t.publicResolvers}
            </label>
            <span className="text-xs text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-full">
              4
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRESET_RESOLVERS.map((res) => (
              <div
                key={res.name}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-muted/30"
              >
                <span className={`w-2 h-2 rounded-full ${res.color}`} />
                <span className="text-sm font-medium">{res.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 自定义解析器 */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
            <Plus className="w-4 h-4" />
            {t.customResolvers}
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="https://dns.example.com/dns-query"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
              className="flex-1 h-10 px-3 text-sm bg-background/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
            />
            <button
              type="button"
              onClick={handleAddCustom}
              disabled={!customUrl}
              className="h-10 px-3 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground rounded-lg text-primary-foreground font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* 已添加的自定义解析器 */}
          {customResolvers.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {customResolvers.map((url) => (
                <span
                  key={url}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-accent/5 border border-accent/20 rounded-lg text-sm"
                >
                  <span className="max-w-[150px] truncate text-muted-foreground">
                    {new URL(url).hostname}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustom(url)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        )}

        {/* HRR 模式说明 */}
        {mode === 'hrr' && (
          <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-foreground">HRR 模式</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  通过发送无效的 ECH 配置触发服务器的 Hello Retry Request，
                  从而获取真实的 ECH 配置。此方法直接连接到目标服务器的 443 端口。
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 提交按钮 */}
      <div className="p-5 border-t border-border/50 bg-muted/20">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isLoading || !domain}
          className="w-full h-11 text-base font-semibold bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground rounded-lg transition-all flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t.executing}
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              {t.runAnalysis}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
