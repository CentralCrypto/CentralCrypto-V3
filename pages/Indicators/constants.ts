
import { Indicator, Testimonial, Language } from '../../types';
import { pt } from '../../locales/pt'; // Import for fallback

export const LOGO_URL = 'https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png';

export const WP_API_URL = 'https://centralcrypto.com.br/2/wp-json/cct/v1/indicators';
export const WP_LOGIN_URL = 'https://centralcrypto.com.br/2/wp-json/cct/v1/login';
export const WP_REORDER_URL = 'https://centralcrypto.com.br/2/wp-json/cct/v1/reorder';
export const WP_SCRAPE_URL = 'https://centralcrypto.com.br/2/wp-json/cct/v1/scrape';
export const API_SECRET = 'CCT_ADMIN_SECRET_2025'; 

// --- FALLBACK DATA ---
const FALLBACK_INDICATORS: Indicator[] = [
  {
    id: 'supertrade-2025',
    title: 'CCT - SuperTrade 2025',
    description: 'O sistema definitivo de acompanhamento de tendências. Combina médias móveis adaptativas com filtros de volatilidade.',
    fullDescription: '### CCT SuperTrade 2025\nCombinação original de duas metodologias bem estabelecidas para identificar oportunidades de entrada e saída.\n\n### Funcionalidades\n- **Hi-Lo Activator:** Monitora a contração do mercado.\n- **Holy Grail:** Identifica pullbacks em tendências fortes.\n- **Pontuação:** Sistema único de score para entradas.',
    description_en: 'The definitive trend following system. Combines adaptive moving averages with volatility filters.',
    fullDescription_en: '### CCT SuperTrade 2025\nOriginal combination of two well-established methodologies to identify entry and exit opportunities.\n\n### Features\n- **Hi-Lo Activator:** Monitors market contraction.\n- **Holy Grail:** Identifies pullbacks in strong trends.\n- **Scoring:** Unique score system for entries.',
    description_es: 'El sistema definitivo de seguimiento de tendencias. Combina medias móviles adaptativas con filtros de volatilidad.',
    fullDescription_es: '### CCT SuperTrade 2025\nCombinación original de dos metodologías bien establecidas para identificar oportunidades de entrada y salida.\n\n### Funcionalidades\n- **Hi-Lo Activator:** Monitorea la contracción del mercado.\n- **Holy Grail:** Identifica retrocesos en tendencias fuertes.\n- **Puntuación:** Sistema único de puntuación para entradas.',
    price: 'Script Protegido',
    tags: ['Trend', 'SuperTrend', 'Swing', 'VIP'],
    imageUrl: 'https://s3.tradingview.com/b/bIwMp5oI_mid.webp?v=1747966679',
    features: ['Tendência Clara', 'Filtro de Ruído', 'Alertas Configuráveis'],
    originalUrl: 'https://www.tradingview.com/script/bIwMp5oI-CCT-SuperTrade-2025/',
    type: 'Indicator',
    likes: 342,
    comments: 89,
    badge: 'VIP'
  }
];

const TESTIMONIALS_PT: Testimonial[] = [
  { id: 't1', name: 'Trader_Visionario', role: 'Premium User', content: 'Simplesmente incrível. A assertividade das divergências no RSI Tracker mudou meu operacional. Ferramenta indispensável.', avatarUrl: 'https://ui-avatars.com/api/?name=Trader+Visionario&background=random' },
  { id: 't2', name: 'LucasM_Crypto', role: 'Comunidade TV', content: 'Parabéns pelo trabalho, Central Crypto! O filtro de cores facilita muito a leitura rápida do gráfico. Top demais!', avatarUrl: 'https://ui-avatars.com/api/?name=Lucas+M&background=random' },
  { id: 't3', name: 'AnaS_Invest', role: 'Analista Técnica', content: 'Gosto muito da limpeza visual. A maioria dos scripts polui a tela, mas os da CCT são muito clean e diretos ao ponto.', avatarUrl: 'https://ui-avatars.com/api/?name=Ana+S&background=random' },
];

export const INDICATORS = FALLBACK_INDICATORS; 

export const getConstants = (lang: Language) => {
  return { indicators: FALLBACK_INDICATORS, testimonials: TESTIMONIALS_PT };
};

// --- COMPATIBILITY LAYER ---
// Restore these exports to prevent crashes in files that haven't been fully migrated
export const UI_TEXT = pt.indicators;
export const LEGAL_TEXTS_DATA = pt.indicators.legal;

export interface Comment {
  id: number;
  author: string;
  text: string;
  timeAgo: string;
}

export const MOCK_COMMENTS: Comment[] = [
  { id: 1, author: "CryptoViking_99", text: "Esse indicador mudou meu jeito de operar o gráfico de 4H! Muito obrigado Central!", timeAgo: "2 horas atrás" },
  { id: 2, author: "Ana_TraderBR", text: "A coloração dos candles facilita muito a visualização da tendência. Recomendo.", timeAgo: "5 horas atrás" },
];
