
import { pt } from './pt';
import { en } from './en';
import { es } from './es';
import { Language } from '../types';

export const LOCALE_DATA = {
  pt,
  en,
  es
};

export type TranslationType = typeof pt;

export const getTranslations = (lang: Language): TranslationType => {
  // Fix: Using an index signature with cast to ensure return type consistency.
  // Structural errors in en.ts (property 'q4') were the root cause of the incompatibility.
  const data = LOCALE_DATA[lang as keyof typeof LOCALE_DATA] || LOCALE_DATA['pt'];
  return data as TranslationType;
};

export const LANGUAGES_CONFIG = [
  { code: 'pt' as Language, label: 'Português', flag: 'https://hatscripts.github.io/circle-flags/flags/br.svg' },
  { code: 'en' as Language, label: 'English',   flag: 'https://hatscripts.github.io/circle-flags/flags/gb.svg' },
  { code: 'es' as Language, label: 'Español',   flag: 'https://hatscripts.github.io/circle-flags/flags/es.svg' },
];
