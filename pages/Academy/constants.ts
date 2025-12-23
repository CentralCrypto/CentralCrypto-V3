import { AcademyLanguage } from '../../types';

export const API_URL = "https://centralcrypto.com.br/2/wp-json/central-academy/v1/topics";

// Senha para operações de Escrita (POST)
export const API_PASSWORD = 'K1w1@P3lud0$2025';

export const LANGUAGES = [
  { code: AcademyLanguage.PT, label: 'Português' },
  { code: AcademyLanguage.EN, label: 'English' },
  { code: AcademyLanguage.ES, label: 'Español' },
];