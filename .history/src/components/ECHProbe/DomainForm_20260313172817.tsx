'use client';

import { useState } from 'react';
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

  const handleToggle = (name: string) => {
    setSelectedPresets((prev) =>
      prev.includes(name)
        ? prev.filter((p) => p !== name)
        : [...prev, name]
    );
  };

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
    console.log('[DEBUG] handleSubmit called, domain:', domain);
    if (domain && domain.trim()) {
      console.log('[DEBUG] Calling onAnalyze with:', domain.trim(), selectedPresets, customResolvers);
      onAnalyze(domain.trim(), selectedPresets, customResolvers);
    } else {
      console.log('[DEBUG] domain is empty');
    }
  };

  return (
    <div className="bg-card p-8 rounded-xl border shadow-xl" style={{ position: 'relative', zIndex: 10 }}>
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: '#75E1FF' }}>
          {t.targetDomain}
        </h2>
        <input
          type="text"
          placeholder={t.domainPlaceholder || 'example.com'}
          value={domain}
          onChange={(e) => {
            console.log('[DEBUG] Input onChange:', e.target.value);
            setDomain(e.target.value);
          }}
          style={{
            width: '100%',
            height: '56px',
            padding: '0 16px',
            fontSize: '18px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: 'white',
            outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px', marginBottom: '32px' }}>
        <div>
          <h3 className="font-medium mb-4" style={{ color: '#75E1FF' }}>
            {t.publicResolvers}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {PRESET_RESOLVERS.map((res) => (
              <label
                key={res}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  backgroundColor: selectedPresets.includes(res)
                    ? 'rgba(77, 77, 179, 0.3)'
                    : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedPresets.includes(res)}
                  onChange={() => handleToggle(res)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ cursor: 'pointer' }}>{res}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-medium mb-4" style={{ color: '#75E1FF' }}>
            {t.customResolvers}
          </h3>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              type="text"
              placeholder="https://your-doh.com/query"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: 'white',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={handleAddCustom}
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '20px',
              }}
            >
              +
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {customResolvers.map((url) => (
              <span
                key={url}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  fontSize: '14px',
                }}
              >
                {url.slice(0, 30)}...
                <button
                  type="button"
                  onClick={() => handleRemoveCustom(url)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ff6b6b',
                    cursor: 'pointer',
                    padding: '0',
                    fontSize: '16px',
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 20 }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isLoading || !domain}
          style={{
            width: '100%',
            height: '56px',
            fontSize: '18px',
            fontWeight: 600,
            backgroundColor: '#4D4DB3',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isLoading || !domain ? 'not-allowed' : 'pointer',
            opacity: isLoading || !domain ? 0.5 : 1,
          }}
        >
          {isLoading ? '分析中...' : '运行分析'}
        </button>
      </div>
    </div>
  );
}
