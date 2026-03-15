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

  console.log('[DomainForm] Render, domain:', domain, 'selectedPresets:', selectedPresets);

  const handleToggle = (name: string) => {
    console.log('[DomainForm] handleToggle called:', name);
    setSelectedPresets((prev) => {
      const newValue = prev.includes(name) 
        ? prev.filter((p) => p !== name) 
        : [...prev, name];
      console.log('[DomainForm] new selectedPresets:', newValue);
      return newValue;
    });
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
    console.log('[DomainForm] handleSubmit called, domain:', domain);
    if (domain && domain.trim()) {
      onAnalyze(domain.trim(), selectedPresets, customResolvers);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '56px',
    padding: '0 16px 0 48px',
    fontSize: '18px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: 'white',
    outline: 'none',
  };

  const checkboxLabelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  };

  const buttonStyle: React.CSSProperties = {
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  };

  return (
    <div style={{
      backgroundColor: 'rgba(255,255,255,0.05)',
      padding: '32px',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.1)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
    }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', color: '#75E1FF' }}>
          {t.targetDomain}
        </h2>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#888' }}>🔍</span>
          <input
            type="text"
            placeholder={t.domainPlaceholder || 'example.com'}
            value={domain}
            onChange={(e) => {
              console.log('[DomainForm] Input changed:', e.target.value);
              setDomain(e.target.value);
            }}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px', marginBottom: '32px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '16px', color: '#75E1FF' }}>
            {t.publicResolvers}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {PRESET_RESOLVERS.map((res) => (
              <label
                key={res}
                style={{
                  ...checkboxLabelStyle,
                  backgroundColor: selectedPresets.includes(res) 
                    ? 'rgba(77, 77, 179, 0.3)' 
                    : 'rgba(255,255,255,0.03)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedPresets.includes(res) 
                  ? 'rgba(77, 77, 179, 0.3)' 
                  : 'rgba(255,255,255,0.03)'}
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
          <h3 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '16px', color: '#75E1FF' }}>
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

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isLoading || !domain}
        style={buttonStyle}
      >
        {isLoading ? '⏳ ' + (t.executing || '分析中...') : '▶ ' + (t.runAnalysis || '运行分析')}
      </button>
    </div>
  );
}
