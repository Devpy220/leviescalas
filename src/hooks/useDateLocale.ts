import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ptBR, enUS, es } from 'date-fns/locale';

const localeMap: Record<string, Locale> = {
  pt: ptBR,
  en: enUS,
  es: es,
};

export function useDateLocale(): Locale {
  const { i18n } = useTranslation();
  return useMemo(() => {
    const lang = i18n.language?.substring(0, 2) || 'pt';
    return localeMap[lang] || ptBR;
  }, [i18n.language]);
}
