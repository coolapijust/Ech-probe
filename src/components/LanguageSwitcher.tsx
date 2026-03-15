
'use client';

import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLanguage(language === 'en' ? 'cn' : 'en')}
      className="flex items-center gap-2 text-muted-foreground hover:text-accent"
    >
      <Globe className="w-4 h-4" />
      {language === 'en' ? '中文' : 'English'}
    </Button>
  );
}
