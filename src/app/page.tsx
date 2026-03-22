'use client';

import { useState } from 'react';
import { DomainForm } from '@/components/ECHProbe/DomainForm';
import { ResultsDisplay } from '@/components/ECHProbe/ResultsDisplay';
import { performECHAnalysis, ResolverResult } from '@/app/actions/dns';
import { performHRRAnalysis } from '@/app/actions/hrr';
import { Shield, Fingerprint, Activity, Globe, Server, CheckCircle, Github, BookOpen } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import Link from 'next/link';

export default function Home() {
  const [results, setResults] = useState<ResolverResult[]>([]);
  const [hrrResult, setHrrResult] = useState<ResolverResult | null>(null);
  const [domain, setDomain] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mode, setMode] = useState<'dns' | 'hrr'>('dns');
  const { t } = useLanguage();

  const handleAnalyze = async (domain: string, resolvers: string[], custom: string[]) => {
    setIsAnalyzing(true);
    setDomain(domain);
    setHrrResult(null);
    try {
      const data = await performECHAnalysis(domain, resolvers, custom);
      setResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleHRRAnalyze = async (domain: string) => {
    setIsAnalyzing(true);
    setDomain(domain);
    setResults([]);
    try {
      const data = await performHRRAnalysis(domain);
      setHrrResult(data);
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
            <Link
              href="/api-docs"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">API 文档</span>
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* Main Content - Centered */}
      <main className="flex-1 p-4 lg:p-6">
        {/* Content - Centered Layout */}
        <div className="max-w-4xl mx-auto">
          {!isAnalyzing && results.length === 0 && !hrrResult ? (
            <div className="grid lg:grid-cols-12 gap-4 lg:gap-6">
              {/* Left Column - Form (7 columns) */}
              <div className="lg:col-span-7">
                <DomainForm 
                  onAnalyze={handleAnalyze} 
                  onHRRAnalyze={handleHRRAnalyze}
                  isLoading={isAnalyzing}
                  mode={mode}
                  onModeChange={setMode}
                />
              </div>

              {/* Right Column - Features vertical stack (5 columns) */}
              <div className="lg:col-span-5">
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
              </div>
            </div>
          ) : (
            <DomainForm 
              onAnalyze={handleAnalyze} 
              onHRRAnalyze={handleHRRAnalyze}
              isLoading={isAnalyzing}
              mode={mode}
              onModeChange={setMode}
            />
          )}
        </div>

        {/* Results Section - Full Width */}
        {(results.length > 0 || hrrResult) && (
          <div className="mt-6">
            {results.length > 0 && <ResultsDisplay results={results} domain={domain} />}
            {hrrResult && <ResultsDisplay results={[hrrResult]} domain={domain} />}
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
      <footer className="border-t border-border/50 bg-muted/30 p-4 lg:p-6">
        <div className="container mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-sm text-muted-foreground">
            <p>{t.footer.replace('{year}', new Date().getFullYear().toString())}</p>
            <div className="flex items-center gap-4">
              <a 
                href="https://github.com/coolapijust/Ech-probe" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-1.5 hover:text-accent transition-colors"
              >
                <Github className="w-4 h-4" />
                GitHub
              </a>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                System Operational
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 lg:gap-4 p-4 lg:p-5 rounded-xl bg-card border border-border/50 hover:border-accent/30 transition-colors min-h-[100px] lg:min-h-[120px]">
      <div className="w-10 h-10 lg:w-11 lg:h-11 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-sm mb-1 lg:mb-2">{title}</h3>
        <p className="text-[11px] lg:text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
