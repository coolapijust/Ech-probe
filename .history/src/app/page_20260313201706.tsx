'use client';

import { useState } from 'react';
import { DomainForm } from '@/components/ECHProbe/DomainForm';
import { ResultsDisplay } from '@/components/ECHProbe/ResultsDisplay';
import { performECHAnalysis, ResolverResult } from '@/app/actions/dns';
import { Shield, Fingerprint, Activity, Globe, Server, CheckCircle } from 'lucide-react';
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
    <div className="min-h-screen flex flex-col">
      {/* Header Bar - No Logo */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 h-14">
          <span className="font-bold text-lg">{t.title}</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">{t.badge}</span>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* Main Content - Full Width */}
      <main className="flex-1 p-6">
        {/* Content Grid - Form takes majority */}
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left Column - Form (7 columns) */}
          <div className="lg:col-span-7">
            <DomainForm onAnalyze={handleAnalyze} isLoading={isAnalyzing} />
          </div>

          {/* Right Column - Features vertical stack (5 columns) */}
          <div className="lg:col-span-5">
            {!isAnalyzing && results.length === 0 && (
              <div className="space-y-4">
                <FeatureCard
                  icon={<Shield className="w-5 h-5" />}
                  title={t.privacyVerified}
                  description={t.privacyDesc}
                />
                <FeatureCard
                  icon={<Fingerprint className="w-5 h-5" />}
                  title={t.configDetection}
                  description={t.configDesc}
                />
                <FeatureCard
                  icon={<Activity className="w-5 h-5" />}
                  title={t.multiResolver}
                  description={t.multiDesc}
                />
              </div>
            )}
            {results.length > 0 && (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <p>{t.subtitle}</p>
              </div>
            )}
          </div>
        </div>

        {/* Results Section - Full Width */}
        {results.length > 0 && (
          <div className="mt-6">
            <ResultsDisplay results={results} domain={domain} />
          </div>
        )}

        {/* Bottom Section - ECH Explanation */}
        {!isAnalyzing && (
          <div className="mt-8">
            <div className="bg-card border border-border/50 rounded-xl p-6">
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
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-muted/30">
        <div className="px-6 py-4">
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

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4 p-5 rounded-xl bg-card border border-border/50 hover:border-accent/30 transition-colors min-h-[120px]">
      <div className="w-11 h-11 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-sm mb-2">{title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
