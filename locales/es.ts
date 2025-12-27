
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
    details: { back: "Voltar", strategy: "Estratégia", indicator: "Indicador", updated: "Atualizado", openTv: "Abrir en", disclaimerTitle: "Aviso", disclaimerText: "Invertir implica riesgo.", boosts: "Boosts", boostThanks: "¡Gracias!", boostLink: "Ver en TV", type: "Tipo", version: "Versão", access: "Acceso", getAccess: "Obtener Acceso", addFavDesc: "Añadir a favoritos en", btnAddFav: "Añadir Favorito" },
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
        title: "Metodología y FAQ",
        fng: {
          q1: "¿Cómo se calcula el Fear & Greed Index?",
          a1: "El índice es un análisis de sentimiento multifactorial. Procesamos datos de volatilidad, volumen de mercado, sentimiento en redes sociales y dominancia de Bitcoin para generar un valor de 0 a 100.",
          q2: "¿Qué significa cada rango del índice?",
          a2: "<ul class='space-y-2 font-mono text-xs'><li class='flex gap-2'><b class='text-red-500 w-16 shrink-0'>0-25:</b> <span><b>Miedo Extremo</b> (oportunidad histórica de compra)</span></li><li class='flex gap-2'><b class='text-orange-500 w-16 shrink-0'>26-45:</b> <span><b>Miedo</b> (miedo presente en el mercado)</span></li><li class='flex gap-2'><b class='text-yellow-500 w-16 shrink-0'>46-55:</b> <span><b>Neutro</b> (incertidumbre y falta de volumen)</span></li><li class='flex gap-2'><b class='text-green-400 w-16 shrink-0'>56-75:</b> <span><b>Codicia</b> (la codicia comienza a dominar)</span></li><li class='flex gap-2'><b class='text-green-600 w-16 shrink-0'>76-94:</b> <span><b>Codicia Extrema</b> (codicia extrema)</span></li><li class='flex gap-2'><b class='text-cyan-400 w-16 shrink-0'>95-100:</b> <span><b>Euforia</b> (euforia peligrosa, corrección inminente)</span></li></ul>"
        },
        rsi: {
          q1: "¿Qué es el Promedio Global de RSI?",
          a1: "Es el promedio aritmético del Índice de Fuerza Relativa de las 100 principales criptomonedas por capitalización. Ayuda a identificar cuando el mercado en su conjunto está en zonas macro de sobrecompra o sobreventa.",
          q2: "¿Cómo interpretar los valores?",
          a2: "Por encima de 70 indica que la mayoría de los activos están estirados (sobrecomprados). Por debajo de 30 indica que el mercado está en pánico vendedor (sobrevendido)."
        },
        macd: {
          q1: "¿Cómo funciona el Rastreador MACD?",
          a1: "Analizamos el cruce de las medias móviles de convergencia y divergencia en múltiples activos simultáneamente, filtrando por capitalización de mercado.",
          q2: "¿Qué representan los puntos en el gráfico?",
          a2: "Cada punto es un activo. La posición en el eje Y muestra la fuerza de la tendencia actual, lo que permite identificar reversiones globales antes de que ocurran en el precio."
        },
        altseason: {
          q1: "¿Qué define una Temporada de Altcoins?",
          a1: "Una Temporada de Altcoins ocurre cuando el 75% de las 50 principales monedas superan a Bitcoin en un período de 90 días.",
          q2: "¿Cómo usar este índice?",
          a2: "Valores cercanos a 0 indican Temporada de Bitcoin (mejor tener BTC). Valores cercanos a 100 indican Temporada de Altcoins (las altcoins tienden a explotar frente al par BTC)."
        },
        etf: {
          q1: "¿Por qué seguir los flujos de los ETF?",
          a1: "Los flujos de los ETF representan la entrada de 'Smart Money' institucional. Las entradas masivas suelen preceder a movimientos alcistas en BTC y ETH.",
          q2: "¿Qué es el Flujo Neto?",
          a2: "Es la suma algebraica de todas las entradas y salidas de los fondos spot aprobados en los EE. UU."
        },
        lsr: {
          q1: "¿Qué es el Long/Short Ratio?",
          a1: "Representa la proporción entre apuestas alcistas (Longs) y bajistas (Shorts) en el mercado de futuros de las principales bolsas.",
          q2: "¿Cómo interpretar?",
          a2: "Un ratio muy alto (por ejemplo, 3.0) suele ser una señal contraria, lo que indica que hay muchos operadores 'comprados', lo que facilita las cascadas de liquidación."
        },
        trump: {
          q1: "¿Qué mide el Trump-o-Meter?",
          a1: "Procesamos a través de Inteligencia Artificial (NLP) las publicaciones de Donald Trump en las redes sociales para medir el impacto emocional inmediato en el mercado de criptomonedas.",
          q2: "¿Cómo leer el medidor?",
          a2: "El medidor va de -50 (Bearish extremo) a +50 (Bullish extremo). Cuanto más a la derecha, mayor será la correlación positiva esperada con activos de riesgo como el BTC."
        },
        calendar: {
          q1: "¿Qué eventos se monitorean en el Calendario?",
          a1: "Nos centramos en los macrodatos de EE. UU. (IPC, FOMC, nóminas no agrícolas) y Brasil, que repercuten directamente en la liquidez y la volatilidad del Bitcoin.",
          q2: "¿Qué significan los colores de impacto?",
          a2: "Rojo (Alto impacto), Naranja (Medio) y Amarillo (Bajo). Los eventos rojos suelen generar una volatilidad violenta en el momento del anuncio."
        },
        heatmap: {
          q1: "¿Cómo leer el Heatmap Cuadrado?",
          a1: "El tamaño del cuadrado representa el Market Cap y el color representa la variación de precio. El verde intenso indica una subida fuerte, el rojo intenso indica una caída libre.",
          q2: "¿Puedo filtrar por rendimiento?",
          a2: "Sí, en la parte superior del widget puedes cambiar la vista para centrarte solo en los que más han subido o bajado."
        },
        bubble: {
          q1: "¿Qué muestra el Bubble Chart?",
          a1: "Es una visión volumétrica y dinámica de los Top Movers. Las burbujas más grandes representan activos con mayor volumen o variación porcentual en el día.",
          q2: "¿Para qué sirven los colores?",
          a2: "Los colores clasifican el sentimiento: de Bearish extremo a Bullish extremo, lo que permite visualizar hacia dónde se dirige el flujo de capital."
        }
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
