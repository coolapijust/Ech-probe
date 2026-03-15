
'use client';

import { useState } from 'react';
import { DomainForm } from '@/components/ECHProbe/DomainForm';
import { ResultsDisplay } from '@/components/ECHProbe/ResultsDisplay';
import { performECHAnalysis, ResolverResult } from '@/app/actions/dns';
import { Shield, Lock, Fingerprint, Activity } from 'lucide-react';
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
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 space-y-12">
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>

      {/* Hero Section */}
      <header className="text-center space-y-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 text-accent border border-accent/30 text-sm font-medium animate-in fade-in zoom-in duration-700">
          <Lock className="w-4 h-4" /> {t.badge}
        </div>
        <h1 className="text-5xl md:text-7xl font-headline font-bold tracking-tight text-white">
          {t.title.split(' ')[0]} <span className="text-accent">{t.title.split(' ')[1]}</span>
        </h1>
        <p className="text-xl text-muted-foreground font-body">
          {t.description}
        </p>
      </header>

      {/* Main UI */}
      <main className="space-y-12">
        <section className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <DomainForm onAnalyze={handleAnalyze} isLoading={isAnalyzing} />
        </section>

        {results.length > 0 && (
          <div className="space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <ResultsDisplay results={results} domain={domain} />
          </div>
        )}

        {results.length === 0 && !isAnalyzing && (
          <section className="grid md:grid-cols-3 gap-8 py-12 border-t border-border/50">
            <div className="space-y-4 p-6 rounded-xl bg-card/50 border border-border/30">
              <div className="p-3 rounded-lg bg-accent/10 w-fit">
                <Shield className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-headline font-semibold">{t.privacyVerified}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t.privacyDesc}
              </p>
            </div>
            <div className="space-y-4 p-6 rounded-xl bg-card/50 border border-border/30">
              <div className="p-3 rounded-lg bg-accent/10 w-fit">
                <Fingerprint className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-headline font-semibold">{t.configDetection}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t.configDesc}
              </p>
            </div>
            <div className="space-y-4 p-6 rounded-xl bg-card/50 border border-border/30">
              <div className="p-3 rounded-lg bg-accent/10 w-fit">
                <Activity className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-headline font-semibold">{t.multiResolver}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t.multiDesc}
              </p>
            </div>
          </section>
        )}
      </main>

      <footer className="text-center py-12 border-t border-border/30 text-muted-foreground text-sm">
        <p>{t.footer.replace('{year}', new Date().getFullYear().toString())}</p>
      </footer>
    </div>
  );
}
