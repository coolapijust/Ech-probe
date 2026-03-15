'use client';

import { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Globe, Plus, X, Server, Search, Loader2 } from 'lucide-react';

interface DomainFormProps {
  onAnalyze: (domain: string, resolvers: string[], customResolvers: string[]) => void;
  isLoading: boolean;
}

const PRESET_RESOLVERS = [
  { name: 'Cloudflare', color: 'bg-orange-500' },
  { name: 'Google', color: 'bg-blue-500' },
  { name: 'Alibaba', color: 'bg-red-500' },
  { name: 'Tencent', color: 'bg-green-500' },
];

export function DomainForm({ onAnalyze, isLoading }: DomainFormProps) {
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
      onAnalyze(domain.trim(), PRESET_RESOLVERS.map(r => r.name), customResolvers);
    }
  };

  return (
    <div className="bg-card rounded-2xl border shadow-xl overflow-hidden">
      {/* 域名输入区域 */}
      <div className="p-6 border-b border-border/50">
        <label className="flex items-center gap-2 text-base font-medium text-muted-foreground mb-3">
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
            className="w-full h-12 pl-4 pr-12 text-base bg-background/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
          />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50" />
        </div>
      </div>

      {/* 解析器配置区域 */}
      <div className="p-6 space-y-6">
        {/* 公共解析器 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 text-base font-medium text-muted-foreground">
              <Server className="w-4 h-4" />
              {t.publicResolvers}
            </label>
            <span className="text-sm text-muted-foreground/60 bg-muted px-2 py-1 rounded-full">
              4 resolvers
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PRESET_RESOLVERS.map((res) => (
              <div
                key={res.name}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border/50 bg-muted/30"
              >
                <span className={`w-2 h-2 rounded-full ${res.color}`} />
                <span className="text-base font-medium">{res.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 自定义解析器 */}
        <div>
          <label className="flex items-center gap-2 text-base font-medium text-muted-foreground mb-3">
            <Plus className="w-4 h-4" />
            {t.customResolvers}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="https://dns.example.com/dns-query"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
              className="flex-1 h-11 px-4 text-base bg-background/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
            />
            <button
              type="button"
              onClick={handleAddCustom}
              disabled={!customUrl}
              className="h-11 px-4 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground rounded-xl text-primary-foreground font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span className="text-base">Add</span>
            </button>
          </div>

          {/* 已添加的自定义解析器 */}
          {customResolvers.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {customResolvers.map((url) => (
                <span
                  key={url}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/5 border border-accent/20 rounded-lg text-base"
                >
                  <span className="max-w-[180px] truncate text-muted-foreground">
                    {new URL(url).hostname}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustom(url)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-0.5 hover:bg-destructive/10 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 提交按钮 */}
      <div className="p-6 border-t border-border/50 bg-muted/20">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isLoading || !domain}
          className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground rounded-xl transition-all flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t.executing}
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              {t.runAnalysis}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
