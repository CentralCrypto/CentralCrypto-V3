
export const es = {
  common: {
    search: "Buscar",
    loading: "Cargando...",
    tagline: "Tu centro definitivo de análisis e inteligencia cripto."
  },
  header: {
    cockpit: "Cabina",
    workspace: "Espacio",
    indicators: "Indicadores",
    marketCap: "Cap de Mercado",
    academy: "Academia",
    profile: "Mi Perfil",
    login: "Entrar",
    logout: "Salir",
    welcome: "Bienvenido",
    subscription: "Suscripción",
    analysisCenter: "Centro de Análisis"
  },
  footer: {
    tagline: "Inteligencia e tecnologia para el mercado de activos digitales.",
    terms: "Términos",
    privacy: "Privacidad",
    risk: "Aviso de Riesgo",
    rights: "Todos os direitos reservados.",
    modalAgree: "Acepto"
  },
  dashboard: {
    widgets: {
      fng: { title: "Índice de Miedo y Codicia", s0: "Cagazo extremo", s1: "Cagazo", s2: "Lateral, sin gracia", s3: "¡Ahora sí!", s4: "¡A la puta luna!", s5: "¡Vende a tu madre!" },
      time: { yesterday: "Ayer", d7: "7 Días", d30: "30 Días" },
      rsi: { title: "Media RSI", overbought: "Sobrecompra", oversold: "Sobreventa", neutral: "Neutro" },
      macd: { title: "Media MACD", bullish: "Bullish", bearish: "Bearish", neutral: "Neutro" },
      lsr: { title: "Ratio Long/Short", longs: "Longs", shorts: "Shorts", neutral: "Neutro" },
      altseason: { title: "Temporada de Altcoins", btcDomZone: "Dominancia BTC", bitcoinSeason: "Temporada de Bitcoin", altcoinSeason: "Temporada de Altcoins", transition: "Transición", yesterday: "Ayer", week: "Semana", month: "Mes" },
      mktcapHistory: { title: "Market Cap", yesterday: "Ayer", week: "Semana", month: "Mes" },
      etf: { title: "Flujo ETF", netFlow: "Flujo Neto", btcEtf: "BTC ETFs", ethEtf: "ETH ETFs", last7d: "7 Días", last30d: "30 Dias", last90d: "90 Días", lastUpdate: "Actualizado en", dailyFlow: "Flujo Diario" },
      trump: { title: "Trump-o-Meter", viewPost: "Ver Post", sarcastic: { negativeSmall: "Impacto Irrelevante", negativeMedium: "Mercado en Alerta", negativeLarge: "TORMENTA EN X", positiveSmall: "Señal de Fuerza", positiveMedium: "VIBRAS ALCISTAS", positiveLarge: "EL CIELO ES EL LÍMITE", neutral: "Silencio Estratégico" } },
      gainers: { gainers: "Ganadores", losers: "Perdedores" },
      calendar: { title: "Calendario Econômico", today: "HOY", tomorrow: "MAÑANA", previous: "Prev", forecast: "Fore", actual: "Actu" }
    },
    magazine: {
      recentStudies: "Estudios Recientes",
      featuredAnalysis: "Análisis Destacados",
      highlight: "Destacado",
      trendingTopics: "Más Leídas",
      dailyNews: "Noticias del Día",
      dontMiss: "No te Pierdas",
      editorsChoice: "Elección del Editor",
      miniBulletins: "Mini Boletines"
    },
    pagination: {
      prev: "Anterior",
      page: "Página",
      next: "Siguiente"
    }
  },
  indicators: {
    nav: { features: "Recursos", testimonials: "Testimonios", backList: "Volver a la Lista", backHome: "Inicio", legal: "Legal" },
    hero: { badge: "Tecnología Punta", title1: "Indicadores Profesionales", subtitle: "Aumenta tu precisión con herramientas exclusivas.", btnView: "Ver Scripts", btnSub: "Suscribirse" },
    list: { title: "Nuestros Indicadores", subtitle: "Scripts optimizados para TradingView.", searchPlaceholder: "Buscar indicadores...", strategy: "Estratégia", indicator: "Indicador", emptyTitle: "Sin resultados", emptyDesc: "Intenta otro término", clearFilter: "Limpiar", loadMore: "Cargar Mais" },
    details: { back: "Voltar", strategy: "Estratégia", indicator: "Indicador", updated: "Actualizado", openTv: "Abrir en", disclaimerTitle: "Aviso", disclaimerText: "Invertir implica riesgo.", boosts: "Boosts", boostThanks: "¡Gracias!", boostLink: "Ver en TV", type: "Tipo", version: "Versão", access: "Acceso", getAccess: "Obtener Acceso", addFavDesc: "Añadir a favoritos en", btnAddFav: "Añadir Favorito" },
    vipModal: { title: "Acesso VIP", successTitle: "¡Éxito!", successDesc: "Tu solicitud ha sido enviada.", btnGo: "Ir a TV", labelName: "Nombre", placeholderName: "Tu nombre", labelUser: "Usuario TV", placeholderUser: "@usuario", btnSending: "Enviando...", btnSubmit: "Solicitar" },
    features: { title: "Recursos Exclusivos", f1: { title: "Rápido", desc: "Señales instantáneas" }, f2: { title: "Seguro", desc: "Auditado" }, f3: { title: "Fácil", desc: "Interfaz limpia" }, f4: { title: "Atualizado", desc: "Siempre evolucionando" } },
    testimonials: { title: "Lo que dicen los Traders" },
    faq: { title: "FAQ", q1: "¿Qué es?", a1: "Herramienta de análisis", q2: "¿Cómo usar?", a2: "En TradingView", q3: "¿Es gratis?", a3: "Algunos sí" },
    legal: { terms: "Términos...", privacy: "Privacidad...", disclaimer: "Riesgo..." },
    chat: { welcome: "¡Hola!", error: "Error en el chat", typing: "Escribiendo...", limitTitle: "Límite alcanzado", limit: "Contacta al soporte", placeholder: "Pregunta algo..." }
  },
  workspace: {
    toolbar: { plan: "Plan", saveLayout: "Guardar", resetLayout: "Reiniciar", addBoard: "Nuevo Board", deleteBoard: "Eliminar Board", addWidget: "Añadir" },
    pages: {
      marketcap: "Cap de Mercado",
      topmovers: "Más Movimientos",
      faq: {
        title: "Metodologia e FAQ",
        q1: "Como o Crypto Fear & Greed Index é calculado?",
        a1: "O índice é uma análise de sentimento multifatorial. Processamos dados de cinco fontes principais: Volatilidade (25%), Momentum e Volume de Mercado (25%), Sentimento em Redes Sociais via NLP (15%), Dominância do Bitcoin (10%) e Tendências de Busca/Google Trends (10%). O resultado é um valor de 0 a 100 onde valores baixos indicam pânico e valores altos indicam euforia.",
        q2: "O que significa cada faixa do índice?",
        a2: "0-25: Medo Extremo (oportunidade histórica de compra); 26-45: Medo; 46-55: Neutro; 56-75: Ganância; 76-100: Ganância Extrema (alerta de correção iminente).",
        q3: "Qual a frequência de atualização dos dados?",
        a3: "O índice é atualizado a cada 24 horas, processando o fechamento diário global para garantir que ruídos de curto prazo não distorçam a percepção de sentimento macro.",
        q4: "Este indicador pode ser usado para sinais de trade?",
        a4: "Historicamente, o Medo Extremo marca fundos de mercado, enquanto a Ganância Extrema marca topos. Contudo, o mercado pode permanecer em estado de ganância por semanas antes de uma reversão."
      }
    },
    widgets: {
      fng: { title: "Índice de Miedo y Codicia", index: "Índice", desc: "Sentimento de mercado" },
      rsi: { title: "Media RSI", index: "RSI", desc: "Fuerza Relativa Global", timeframe: "Timeframe", tooltip: { price: "Precio", mcap: "Cap. Mercado", change: "Var 24h" } },
      macd: { title: "Media MACD", avgLabel: "Media Global MACD", desc: "Tendencia Global MACD", timeframe: "Timeframe", xAxis: "Eje X", loading: "Cargando...", tooltip: { price: "Precio", mcap: "Cap. Mercado", change: "Var", signal: "Signal", hist: "Hist" }, context: { mcap: "Vista por cap", priceChange: "Vista por variación" } },
      lsr: { title: "Ratio Long/Short", desc: "Proporción Long/Short", price: "Precio", size: "Tamaño", total: "Total", noData: "Sin datos" },
      altseason: { title: "Temporada Altcoin", index: "Índice ASI", altsMcap: "Cap Alts", yesterday: "Ayer", week: "Semana", month: "Mes", desc: "Indicador de temporada de Alts" },
      etf: { title: "Flujo ETF", dailyFlow: "Flujo Diario", btcEtf: "BTC ETFs", ethEtf: "ETH ETFs", last7d: "7 Días", last30d: "30 Dias", last90d: "90 Días", lastUpdate: "Última actualización", desc: "Flujos institucionales de ETFs" },
      gainers: { title: "Más Movimientos", gainers: "Ganadores", losers: "Perdedores", desc: "Principais variaciones" },
      trump: { title: "Trump-o-Meter", viewPost: "Ver Post", desc: "Impacto político" },
      calendar: { title: "Calendario Económico", today: "HOY", tomorrow: "MAÑANA", previous: "Prev", forecast: "Fore", actual: "Actu", desc: "Eventos macroeconómicos" },
      price: { price: "Precio", volEst: "Vol Est", mcap: "Cap. Mercado", change24h: "24h %", noData: "Sin datos", desc: "Precio y variación" },
      volume: { vol24h: "Vol 24h", desc: "Volumen negociado" },
      trend: { bullish: "Alcista", bearish: "Bajista", neutral: "Neutro", strength: "Fuerza", basedOn: "Basado em", desc: "Análisis de tendencia" },
      sentiment: { extremeGreed: "Codicia Extrema", greed: "Codicia", extremeFear: "Miedo Extremo", fear: "Miedo", neutralBiasUp: "Neutro (Alza)", neutralBiasDown: "Neutro (Baja)", strong: "Forte", weak: "Débil", consistent: "Consistente", easing: "Disminuyendo", recovering: "Recuperando", desc: "Sentimento técnico" },
      orderbook: { price: "Precio", size: "Tamaño", total: "Total", noData: "Sin órdenes", desc: "Libro de órdenes" },
      news: { noNews: "Sin noticias", tryAnother: "Prueba otro activo", desc: "Noticias vinculadas" }
    }
  }
};
