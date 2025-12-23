
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
  // Safe fallback: if lang doesn't exist in LOCALE_DATA, return pt
  // If pt doesn't exist (critical error), return empty object cast as type to prevent crash
  return LOCALE_DATA[lang] || LOCALE_DATA['pt'] || ({} as TranslationType);
};

export const LANGUAGES_CONFIG = [
  { code: 'pt' as Language, label: 'Português', flag: 'https://hatscripts.github.io/circle-flags/flags/br.svg' },
  { code: 'en' as Language, label: 'English',   flag: 'https://hatscripts.github.io/circle-flags/flags/gb.svg' },
  { code: 'es' as Language, label: 'Español',   flag: 'https://hatscripts.github.io/circle-flags/flags/es.svg' },
];
