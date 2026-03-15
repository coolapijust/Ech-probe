'use client';

import { useState } from 'react';
import { DomainForm } from '@/components/ECHProbe/DomainForm';
import { ResultsDisplay } from '@/components/ECHProbe/ResultsDisplay';
import { performECHAnalysis, ResolverResult } from '@/app/actions/dns';
import { Shield, Lock, Fingerprint, Activity, Globe, Server, CheckCircle } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function Home() {
  const [results, setResults] = useState<ResolverResult[]>([]);
  const [domain, setDomain] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { t } = useLanguage();

  const handleAnalyze = async (domain: string, resolvers: string[], custom: string[]) => {
    setIsAnalyzing(true);
    setDomain(domain);
    try {
      const data = await performECHAnalysis(domain, resolvers, custom);
      setResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="pt-6 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Bar - Language Switcher */}
          <div className="flex justify-end mb-4">
            <LanguageSwitcher />
          </div>

          <div className="text-center space-y-4">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent border border-accent/20 text-sm font-medium">
              <Lock className="w-3.5 h-3.5" />
              {t.badge}
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
              <span className="text-foreground">{t.title.split(' ')[0]}</span>
              <span className="text-accent"> {t.title.split(' ')[1]}</span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-muted-foreground font-medium">
              {t.subtitle}
            </p>
          </div>
        </div>
      </section>

      {/* Main Content - 两栏布局 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left Column - Form */}
          <div className="lg:col-span-5">
            <DomainForm onAnalyze={handleAnalyze} isLoading={isAnalyzing} />

            {/* Features - 放在表单下方 */}
            {!isAnalyzing && results.length === 0 && (
              <div className="mt-6 space-y-3">
                <FeatureItem
                  icon={<Shield className="w-5 h-5" />}
                  title={t.privacyVerified}
                  description={t.privacyDesc}
                />
                <FeatureItem
                  icon={<Fingerprint className="w-5 h-5" />}
                  title={t.configDetection}
                  description={t.configDesc}
                />
                <FeatureItem
                  icon={<Activity className="w-5 h-5" />}
                  title={t.multiResolver}
                  description={t.multiDesc}
                />
              </div>
            )}
          </div>

          {/* Right Column - Results */}
          <div className="lg:col-span-7">
            {results.length > 0 ? (
              <ResultsDisplay results={results} domain={domain} />
            ) : (
              /* ECH Info - 右侧占位内容 */
              <div className="h-full min-h-[400px] flex flex-col justify-center">
                <div className="bg-card border border-border/50 rounded-2xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center shrink-0">
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                        <Globe className="w-5 h-5 text-accent" />
                        {t.echCheckTitle}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed mb-4">
                        {t.echCheckDesc}
                      </p>
                      <div className="flex items-start gap-3 pt-4 border-t border-border/30">
                        <Server className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                        <div>
                          <span className="font-medium">{t.echWhatIs}</span>
                          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                            {t.echExplain}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-muted/30 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-sm text-muted-foreground">
            <p>{t.footer.replace('{year}', new Date().getFullYear().toString())}</p>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              System Operational
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border/50 hover:border-accent/30 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-sm mb-1">{title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
