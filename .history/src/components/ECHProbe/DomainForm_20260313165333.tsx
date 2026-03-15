'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Shield, Search, Globe, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/context/LanguageContext';

interface DomainFormProps {
  onAnalyze: (domain: string, resolvers: string[], customResolvers: string[]) => void;
  isLoading: boolean;
}

const PRESET_RESOLVERS = ['Cloudflare', 'Google', 'Alibaba', 'Tencent'];

export function DomainForm({ onAnalyze, isLoading }: DomainFormProps) {
  const { t } = useLanguage();
  const [domain, setDomain] = useState('');
  const [selectedPresets, setSelectedPresets] = useState<string[]>(['Cloudflare', 'Google']);
  const [customUrl, setCustomUrl] = useState('');
  const [customResolvers, setCustomResolvers] = useState<string[]>([]);

  const togglePreset = (name: string) => {
    setSelectedPresets((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  };

  const addCustomResolver = () => {
    if (customUrl && !customResolvers.includes(customUrl)) {
      try {
        new URL(customUrl);
        setCustomResolvers((prev) => [...prev, customUrl]);
        setCustomUrl('');
      } catch (e) {
        // Simple validation
      }
    }
  };

  const removeCustom = (url: string) => {
    setCustomResolvers((prev) => prev.filter((r) => r !== url));
  };

  const handleAnalyzeClick = () => {
    if (domain) {
      onAnalyze(domain, selectedPresets, customResolvers);
    }
  };

  return (
    <div className="space-y-8 bg-card p-8 rounded-xl border shadow-xl">
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-5 h-5 text-accent" />
          <h2 className="text-xl font-headline font-semibold">{t.targetDomain}</h2>
        </div>
        <div className="relative">
          <Input
            placeholder={t.domainPlaceholder}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="h-14 pl-12 text-lg bg-background/50 border-border focus:ring-accent transition-all"
            required
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            <h3 className="font-headline font-medium">{t.publicResolvers}</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {PRESET_RESOLVERS.map((res) => (
              <label
                key={res}
                className="flex items-center space-x-3 p-3 rounded-lg border bg-background/30 hover:bg-background/50 transition-colors cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedPresets.includes(res)}
                  onChange={() => togglePreset(res)}
                  className="h-4 w-4 rounded border-primary text-primary focus:ring-accent"
                />
                <span className="cursor-pointer">{res}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-accent" />
            <h3 className="font-headline font-medium">{t.customResolvers}</h3>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="https://your-doh.com/query"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              className="bg-background/50"
            />
            <Button type="button" variant="secondary" onClick={addCustomResolver} size="icon">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="py-1.5 px-3 border-accent/30 bg-accent/5">
              {t.localResolver}
            </Badge>
            {customResolvers.map((url) => (
              <Badge key={url} variant="secondary" className="py-1.5 px-3 flex items-center gap-2 group">
                <span className="truncate max-w-[150px]">{url}</span>
                <X
                  className="w-3 h-3 cursor-pointer hover:text-destructive transition-colors"
                  onClick={() => removeCustom(url)}
                />
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="w-full h-14 text-lg font-headline bg-primary hover:bg-primary/90 text-white shadow-lg transition-all group disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
        disabled={isLoading || !domain}
        onClick={handleAnalyzeClick}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
            {t.executing}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {t.runAnalysis}
            <Search className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </div>
        )}
      </button>
    </div>
  );
}
