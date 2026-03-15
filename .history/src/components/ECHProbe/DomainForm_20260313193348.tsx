'use client';

import { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Globe, Plus, X, Server } from 'lucide-react';

interface DomainFormProps {
  onAnalyze: (domain: string, resolvers: string[], customResolvers: string[]) => void;
  isLoading: boolean;
}

const PRESET_RESOLVERS = ['Cloudflare', 'Google', 'Alibaba', 'Tencent'];

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
      onAnalyze(domain.trim(), PRESET_RESOLVERS, customResolvers);
    }
  };

  return (
    <div className="bg-card rounded-xl border shadow-xl overflow-hidden">
      {/* 域名输入区域 */}
      <div className="p-6 border-b border-border/50">
        <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
          <Globe className="w-4 h-4" />
          {t.targetDomain}
        </label>
        <input
          type="text"
          placeholder={t.domainPlaceholder || 'example.com'}
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="w-full h-14 px-4 text-lg bg-background/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
        />
      </div>

      {/* 解析器配置区域 */}
      <div className="p-6 space-y-6">
        {/* 公共解析器 - 无勾选，始终启用 */}
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
            <Server className="w-4 h-4" />
            {t.publicResolvers}
            <span className="text-xs text-accent bg-accent/10 px-2 py-0.5 rounded-full">始终启用</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PRESET_RESOLVERS.map((res) => (
              <div
                key={res}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-border/50 bg-primary/5 text-sm font-medium"
              >
                <span className="w-2 h-2 rounded-full bg-green-500" />
                {res}
              </div>
            ))}
          </div>
        </div>

        {/* 自定义解析器 */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
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
              className="flex-1 h-10 px-3 text-sm bg-background/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
            <button
              type="button"
              onClick={handleAddCustom}
              disabled={!customUrl}
              className="h-10 px-4 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* 已添加的自定义解析器 */}
          {customResolvers.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {customResolvers.map((url) => (
                <span
                  key={url}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent/10 border border-accent/30 rounded-full text-xs"
                >
                  <span className="max-w-[200px] truncate">{new URL(url).hostname}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustom(url)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-3 h-3" />
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
          className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="animate-spin">⟳</span>
              {t.executing}
            </>
          ) : (
            t.runAnalysis
          )}
        </button>
      </div>
    </div>
  );
}
