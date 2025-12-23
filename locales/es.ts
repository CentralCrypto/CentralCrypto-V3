export const es = {
    common: {
        search: "Buscar",
        loading: "Cargando...",
        tagline: "Su centro de inteligencia cripto."
    },
    header: {
        cockpit: "Cockpit",
        workspace: "Workspace",
        indicators: "Indicadores",
        marketCap: "Cap. Mercado",
        academy: "Academy",
        welcome: "Bienvenido",
        profile: "Perfil",
        subscription: "Suscripción",
        security: "Seguridad",
        logout: "Salir",
        login: "Entrar",
        analysisCenter: "Centro de Análisis"
    },
    dashboard: {
        showStats: "Mostrar Estadísticas",
        hideStats: "Ocultar Estadísticas",
        magazineTitle: "Magazine",
        widgets: {
            fng: { title: "Fear & Greed", s0: "Miedo Extremo", s1: "Miedo", s2: "Neutral", s3: "Codicia", s4: "Codicia Extrema", s5: "Euforia" },
            rsi: { title: "Promedio RSI", oversold: "Sobrevendido", bearish: "Bearish", neutral: "Neutral", bullish: "Bullish", overbought: "Sobrecomprado" },
            // Add macd to dashboard widgets
            macd: { title: "Promedio MACD", bullish: "Bullish", bearish: "Bearish", neutral: "Neutral" },
            altseason: { title: "Altcoin Season", bitcoinSeason: "Bitcoin Season", altcoinSeason: "Altcoin Season", btcDomZone: "BTC Dominance", transition: "Transición", yesterday: "Ayer", week: "7D", month: "30D" },
            mktcapHistory: { title: "Mkt Cap Global", yesterday: "Ayer", week: "7D", month: "30D" },
            lsr: { title: "Long/Short Ratio", longs: "Longs", shorts: "Shorts", neutral: "Neutral" },
            etf: { title: "Flujo ETF", netFlow: "Flujo Neto" },
            trump: { title: "Trump-o-Meter", fallback: "Neutral", sarcastic: { positiveMedium: "Muy Bullish", negativeMedium: "Muy Bearish", neutral: "Neutral" } },
            gainers: { title: "Principales Alzas/Bajas", gainers: "Alzas", losers: "Bajas" },
            mktcap: { title: "Top 10 Cap. Mercado" },
            calendar: { title: "Calendario Económico", today: "HOY", tomorrow: "MAÑANA", previous: "Prev.", forecast: "Proj.", actual: "Real" },
            time: { yesterday: "Ayer", d7: "7D", d30: "30D" }
        },
        magazine: {
            recentStudies: "Estudos Recientes",
            featuredAnalysis: "Análisis Destacado",
            highlight: "Destacado",
            trendingTopics: "Más Leídos",
            dailyNews: "Noticias del Día",
            dontMiss: "No se lo pierda",
            editorsChoice: "Elección del Editor",
            newsFeed: "Feed de Noticias",
            miniBulletins: "Mini Boletines"
        },
        pagination: { prev: "Anterior", next: "Siguiente", page: "Página" }
    },
    footer: {
        tagline: "La plataforma definitiva para el trader moderno.",
        terms: "Términos de Uso",
        privacy: "Privacidad",
        risk: "Riesgo",
        rights: "Todos los derechos reservados.",
        modalAgree: "Acepto"
    },
    indicators: {
        title: "Indicadores CCT",
        nav: { features: "Recursos", testimonials: "Testimonios", backList: "Volver a la Lista", backHome: "Home", legal: "Legal" },
        hero: { badge: "Tecnología de Punta", title1: "Indicadores de Alta Precisão", subtitle: "Herramientas exclusivas para TradingView.", btnView: "Ver Scripts", btnSub: "Suscribirse" },
        list: { title: "Nuestros Indicadores", subtitle: "Explore nuestra colección.", searchPlaceholder: "Buscar indicadores...", emptyTitle: "No encontrado", emptyDesc: "Intente otro término.", clearFilter: "Limpiar", loadMore: "Cargar Más", strategy: "Estratégia", indicator: "Indicador" },
        details: { back: "Volver", strategy: "Estratégia", indicator: "Indicador", updated: "Actualizado recientemente", openTv: "Abrir en TV", disclaimerTitle: "Aviso Legal", disclaimerText: "El trading conlleva riesgos.", boosts: "Boosts", type: "Tipo", version: "Versión", access: "Acceso", getAccess: "Obtener Acceso", addFavDesc: "Añadir a favoritos en", btnAddFav: "Añadir a Favoritos", boostThanks: "¡Gracias por el boost!", boostLink: "Ver en TradingView" },
        vipModal: { title: "Solicitar Acceso VIP", successTitle: "Solicitud Enviada", successDesc: "Nos pondremos en contacto.", btnGo: "Ok", labelName: "Nombre", placeholderName: "Su nombre", labelUser: "Usuario TV", placeholderUser: "Su ID en TradingView", btnSubmit: "Enviar", btnSending: "Enviando..." },
        features: { title: "¿Por qué elegir CCT?", f1: { title: "Rápido", desc: "Ejecución instantánea." }, f2: { title: "Seguro", desc: "100% auditado." }, f3: { title: "Simple", desc: "Interfaz intuitiva." }, f4: { title: "Actualizado", desc: "Soporte constante." } },
        testimonials: { title: "Lo que dicen los traders" },
        // Add faq translations for Indicators page
        faq: { 
            title: "Preguntas Frecuentes", 
            q1: "¿Cómo instalo los indicadores?", 
            a1: "Simplemente haga clic en el enlace de TradingView y agréguelo a sus favoritos.", 
            q2: "¿Necesito una cuenta de TV de pago?", 
            a2: "No, la mayoría de nuestros indicadores funcionan en la versión gratuita.", 
            q3: "¿Cómo obtengo acceso a los scripts VIP?", 
            a3: "Después de suscribirse, envíe su nombre de usuario de TradingView para la aprobación manual." 
        },
        chat: { welcome: "¡Hola! ¿Cómo puedo ayudar?", typing: "Escribiendo...", limitTitle: "Límite Alcanzado", limit: "Visite TradingView para más información.", placeholder: "Escriba su duda...", error: "Error en la conexión." },
        legal: { terms: "Términos...", privacy: "Privacidad...", disclaimer: "Aviso de Riesgo..." }
    },
    workspace: {
        toolbar: { plan: "Plan", saveLayout: "Guardar", resetLayout: "Reiniciar", addBoard: "Nuevo Tablero", deleteBoard: "Eliminar Tablero", addWidget: "Añadir" },
        widgets: {
            fng: { title: "Fear & Greed", desc: "Índice de sentimiento del mercado.", historical: "Histórico", index: "Índice" },
            rsi: { title: "Promedio RSI", desc: "Promedio del RSI de múltiples activos.", timeframe: "Período", limit: "Monedas", xAxis: "Eje X" },
            macd: { title: "Promedio MACD", desc: "Promedio del MACD de múltiples activos.", avgLabel: "Promedio", timeframe: "Período", xAxis: "Eje X", loading: "Cargando...", tooltip: { price: "Precio", mcap: "Mkt Cap", change: "24h %", signal: "Señal", hist: "Hist." }, context: { mcap: "Ordenado por Mkt Cap.", priceChange: "Ordenado por Variación." } },
            trump: { title: "Trump-o-Meter", desc: "Impacto de los posts de Donald Trump.", viewPost: "Ver Post" },
            lsr: { title: "Long/Short Ratio", desc: "Relación entre posiciones largas y cortas.", fetching: "Buscando...", unavailable: "No disponible", couldNotFetch: "Error al buscar." },
            altseason: { title: "Altcoin Season", desc: "Indica si el mercado favorece Alts o BTC.", index: "Índice", altsMcap: "Mkt Cap Alts" },
            etf: { title: "Flujo ETF", desc: "Flujo institucional para ETFs de BTC/ETH.", dailyFlow: "Flujo Diario", lastUpdate: "Última actualización:", btcEtf: "BTC ETF", ethEtf: "ETH ETF", last7d: "7 Días", last30d: "30 Dias", last90d: "90 Dias" },
            gainers: { title: "Alzas y Bajas", desc: "Top 100 monedas con mayores variaciones.", gainers: "Alzas", losers: "Bajas" },
            calendar: { title: "Calendario", desc: "Eventos macroeconómicos importantes.", previous: "Prev.", forecast: "Proj.", actual: "Real", today: "HOY", tomorrow: "MAÑANA" },
            heatmap: { title: "Crypto Heatmap", desc: "Visualización en bloques (Treemap) del mercado cripto. Agrupado por categorías y dimensionado por Market Cap o Volumen 24h.", modeCap: "Cap. Mercado", modeVol: "Volumen 24h", price: "Precio", change: "Variación", noData: "Datos de heatmap no disponibles" },
            // Add title and desc to standard widgets for GridHeader.tsx
            price: { title: "Precio y Gráficos", desc: "Seguimiento de precios en tiempo real con gráficos históricos.", price: "Precio", volEst: "Vol. Est.", mcap: "Mkt Cap", change24h: "24h %", noData: "Sin datos." },
            volume: { title: "Volumen", desc: "Análisis del volumen de negociación a lo largo del tiempo.", vol24h: "Volumen 24h" },
            trend: { title: "Análisis de Tendencia", desc: "Análisis técnico de tendencias basado en medias móviles.", bullish: "Bullish", bearish: "Bearish", neutral: "Neutro", strength: "Fuerza", basedOn: "Basado en" },
            sentiment: { title: "Sentimiento Técnico", desc: "Sentimiento del mercado basado en indicadores técnicos (RSI).", extremeGreed: "Euforia", greed: "Codicia", extremeFear: "Pánico", fear: "Miedo", strong: "Fuerte", weak: "Débil", consistent: "Consistente", easing: "Disminuyendo", recovering: "Recuperando", neutralBiasUp: "Neutral (Alcista)", neutralBiasDown: "Neutral (Bajista)" },
            orderbook: { title: "Libro de Órdenes", desc: "Libro de órdenes en tiempo real y profundidad de mercado.", price: "Precio", size: "Tamaño", total: "Total", noData: "Sin datos de libro." },
            news: { title: "Noticias de Mercado", desc: "Últimas noticias del mercado criptográfico.", noNews: "No se encontraron noticias.", tryAnother: "Pruebe otra moneda." }
        }
    }
};