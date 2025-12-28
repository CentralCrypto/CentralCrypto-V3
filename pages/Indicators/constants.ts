
import { Indicator, Testimonial, Language } from '../../types';
import { pt } from '../../locales/pt';

export const LOGO_URL = 'https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png';

export const WP_API_URL = '/2/wp-json/cct/v1/indicators';
export const WP_LOGIN_URL = '/2/wp-json/cct/v1/login';
export const WP_REORDER_URL = '/2/wp-json/cct/v1/reorder';
export const WP_SCRAPE_URL = '/2/wp-json/cct/v1/scrape';
export const API_SECRET = 'CCT_ADMIN_SECRET_2025'; 

const FALLBACK_INDICATORS: Indicator[] = [
  {
    id: 'supertrade-2025',
    title: 'CCT - SuperTrade 2025',
    description: 'O sistema definitivo de acompanhamento de tendências. Combina médias móveis adaptativas com filtros de volatilidade.',
    fullDescription: '### CCT SuperTrade 2025\nCombinação original de duas metodologias bem estabelecidas para identificar oportunidades de entrada e saída.\n\n### Funcionalidades\n- **Hi-Lo Activator:** Monitora a contração do mercado.\n- **Holy Grail:** Identifica pullbacks em tendências fortes.\n- **Pontuação:** Sistema único de score para entradas.',
    description_en: 'The definitive trend following system. Combines adaptive moving averages with volatility filters.',
    fullDescription_en: '### CCT SuperTrade 2025\nOriginal combination of two well-established methodologies to identify entry and exit opportunities.\n\n### Features\n- **Hi-Lo Activator:** Monitors market contraction.\n- **Holy Grail:** Identifies pullbacks in strong trends.\n- **Scoring:** Unique score system for entries.',
    description_es: 'El sistema definitivo de seguimiento de tendencias. Combina medias móviles adaptativas con filtros de volatilidad.',
    fullDescription_es: '### CCT SuperTrade 2025\nCombinación original de dos metodologías bien establecidas para identificar oportunidades de entrada e salida.\n\n### Funcionalidades\n- **Hi-Lo Activator:** Monitorea la contracción del mercado.\n- **Holy Grail:** Identifica retrocesos en tendencias fuertes.\n- **Puntuación:** Sistema único de puntuación para entradas.',
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
  { id: 't4', name: 'Carlos_Quant', role: 'Full-time Trader', content: 'O SMC Indicator é surreal. Consigo identificar as zonas de supply e demand com uma precisão que nunca vi em scripts grátis.', avatarUrl: 'https://ui-avatars.com/api/?name=Carlos+Quant&background=random' },
  { id: 't5', name: 'Crypto_Girl_88', role: 'Swing Trader', content: 'Acompanho a Central há anos e os indicadores de 2025 estão em outro patamar. O suporte técnico também é nota 10!', avatarUrl: 'https://ui-avatars.com/api/?name=Crypto+Girl&background=random' },
  { id: 't6', name: 'Master_Trend', role: 'TradingView Pro', content: 'Uso o SuperTrade no gráfico de 12H para filtrar ruído e é impressionante como ele evita falsas entradas em laterais.', avatarUrl: 'https://ui-avatars.com/api/?name=Master+Trend&background=random' },
  { id: 't7', name: 'Bitcoin_Maxi_BR', role: 'HODLer & Trader', content: 'Ferramentas indispensáveis para quem leva o mercado a sério. O dashboard integrado com os scripts do TV é sensacional.', avatarUrl: 'https://ui-avatars.com/api/?name=Bitcoin+Maxi&background=random' },
  { id: 't8', name: 'Scalper_Pro', role: 'Day Trader', content: 'O RSI Tracker é o meu braço direito. Identificar exaustão de tendência ficou muito mais visual e rápido.', avatarUrl: 'https://ui-avatars.com/api/?name=Scalper+Pro&background=random' },
  { id: 't9', name: 'Invest_Certo', role: 'Investidor', content: 'Interface limpa, lógica sólida e sinais confiáveis. Recomendo para todos os meus alunos de análise técnica.', avatarUrl: 'https://ui-avatars.com/api/?name=Invest+Certo&background=random' },
];

const TESTIMONIALS_EN: Testimonial[] = [
  { id: 't1', name: 'Trader_Visionario', role: 'Premium User', content: 'Simply incredible. The accuracy of the divergences in the RSI Tracker has changed my trading operations. An indispensable tool.', avatarUrl: 'https://ui-avatars.com/api/?name=Trader+Visionario&background=random' },
  { id: 't2', name: 'LucasM_Crypto', role: 'TV Community', content: 'Congratulations on the work, Central Crypto! The color filter makes reading the chart quickly much easier. Awesome!', avatarUrl: 'https://ui-avatars.com/api/?name=Lucas+M&background=random' },
  { id: 't3', name: 'AnaS_Invest', role: 'Technical Analyst', content: "I really like the visual cleanliness. Most scripts clutter the screen, but CCT's are very clean and to the point.", avatarUrl: 'https://ui-avatars.com/api/?name=Ana+S&background=random' },
  { id: 't4', name: 'Carlos_Quant', role: 'Full-time Trader', content: "The SMC Indicator is surreal. I can identify supply and demand zones with a precision I've never seen in free scripts.", avatarUrl: 'https://ui-avatars.com/api/?name=Carlos+Quant&background=random' },
  { id: 't5', name: 'Crypto_Girl_88', role: 'Swing Trader', content: "I've been following Central for years, and the 2025 indicators are on another level. The technical support is also top-notch!", avatarUrl: 'https://ui-avatars.com/api/?name=Crypto+Girl&background=random' },
  { id: 't6', name: 'Master_Trend', role: 'TradingView Pro', content: 'I use SuperTrade on the 12H chart to filter out noise, and it\'s impressive how it avoids false entries in sideways markets.', avatarUrl: 'https://ui-avatars.com/api/?name=Master+Trend&background=random' },
  { id: 't7', name: 'Bitcoin_Maxi_BR', role: 'HODLer & Trader', content: 'Indispensable tools for those who take the market seriously. The integrated dashboard with the TV scripts is sensational.', avatarUrl: 'https://ui-avatars.com/api/?name=Bitcoin+Maxi&background=random' },
  { id: 't8', name: 'Scalper_Pro', role: 'Day Trader', content: 'The RSI Tracker is my right hand. Identifying trend exhaustion has become much more visual and faster.', avatarUrl: 'https://ui-avatars.com/api/?name=Scalper+Pro&background=random' },
  { id: 't9', name: 'Invest_Certo', role: 'Investor', content: 'Clean interface, solid logic, and reliable signals. I recommend it to all my technical analysis students.', avatarUrl: 'https://ui-avatars.com/api/?name=Invest+Certo&background=random' },
];

const TESTIMONIALS_ES: Testimonial[] = [
  { id: 't1', name: 'Trader_Visionario', role: 'Usuario Premium', content: 'Simplemente increíble. La precisión de las divergencias en el RSI Tracker ha cambiado mi operativa. Una herramienta indispensable.', avatarUrl: 'https://ui-avatars.com/api/?name=Trader+Visionario&background=random' },
  { id: 't2', name: 'LucasM_Crypto', role: 'Comunidad TV', content: '¡Felicitaciones por el trabajo, Central Crypto! El filtro de colores facilita mucho la lectura rápida del gráfico. ¡Genial!', avatarUrl: 'https://ui-avatars.com/api/?name=Lucas+M&background=random' },
  { id: 't3', name: 'AnaS_Invest', role: 'Analista Técnica', content: "Me gusta mucho la limpieza visual. La mayoría de los scripts ensucian la pantalla, pero los de CCT son muy limpios y directos.", avatarUrl: 'https://ui-avatars.com/api/?name=Ana+S&background=random' },
  { id: 't4', name: 'Carlos_Quant', role: 'Trader a tiempo completo', content: "El Indicador SMC es surrealista. Puedo identificar las zonas de oferta y demanda con una precisión que nunca he visto en scripts gratuitos.", avatarUrl: 'https://ui-avatars.com/api/?name=Carlos+Quant&background=random' },
  { id: 't5', name: 'Crypto_Girl_88', role: 'Swing Trader', content: "Sigo a Central desde hace años y los indicadores de 2025 están a otro nivel. ¡El soporte técnico también es de primera!", avatarUrl: 'https://ui-avatars.com/api/?name=Crypto+Girl&background=random' },
  { id: 't6', name: 'Master_Trend', role: 'TradingView Pro', content: 'Uso el SuperTrade en el gráfico de 12H para filtrar el ruido y es impresionante cómo evita las entradas falsas en mercados laterales.', avatarUrl: 'https://ui-avatars.com/api/?name=Master+Trend&background=random' },
  { id: 't7', name: 'Bitcoin_Maxi_BR', role: 'HODLer & Trader', content: 'Herramientas indispensables para quienes se toman el mercado en serio. El panel de control integrado con los scripts de TV es sensacional.', avatarUrl: 'https://ui-avatars.com/api/?name=Bitcoin+Maxi&background=random' },
  { id: 't8', name: 'Scalper_Pro', role: 'Day Trader', content: 'El RSI Tracker es mi mano derecha. Identificar el agotamiento de la tendencia se ha vuelto mucho más visual y rápido.', avatarUrl: 'https://ui-avatars.com/api/?name=Scalper+Pro&background=random' },
  { id: 't9', name: 'Invest_Certo', role: 'Inversor', content: 'Interfaz limpia, lógica sólida y señales confiables. Se lo recomiendo a todos mis estudiantes de análisis técnico.', avatarUrl: 'https://ui-avatars.com/api/?name=Invest+Certo&background=random' },
];

export const INDICATORS = FALLBACK_INDICATORS; 

export const getConstants = (lang: Language) => {
  let testimonials = TESTIMONIALS_PT;
  if (lang === 'en') testimonials = TESTIMONIALS_EN;
  if (lang === 'es') testimonials = TESTIMONIALS_ES;
  return { indicators: FALLBACK_INDICATORS, testimonials };
};

export const UI_TEXT = pt.indicators;
export const LEGAL_TEXTS_DATA = pt.indicators.legal;

export interface Comment { id: number; author: string; text: string; timeAgo: string; }
export const MOCK_COMMENTS: Comment[] = [
  { id: 1, author: "CryptoViking_99", text: "Esse indicador mudou meu jeito de operar o gráfico de 4H!", timeAgo: "2 horas atrás" },
];