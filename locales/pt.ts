
export const pt = {
  common: {
    search: "Buscar",
    loading: "Carregando...",
    tagline: "A sua central definitiva de análise e inteligência cripto."
  },
  header: {
    cockpit: "Cockpit",
    workspace: "Workspace",
    indicators: "Indicadores",
    marketCap: "Market Cap",
    academy: "Academy",
    profile: "Meu Perfil",
    login: "Entrar",
    logout: "Sair",
    welcome: "Bem-vindo",
    subscription: "Assinatura",
    analysisCenter: "Central de Análise"
  },
  footer: {
    tagline: "Inteligência e tecnologia para o mercado de ativos digitais.",
    terms: "Termos de Uso",
    privacy: "Privacidade",
    risk: "Aviso de Risco",
    rights: "Todos os direitos reservados.",
    modalAgree: "Eu concordo"
  },
  dashboard: {
    widgets: {
      fng: { title: "Fear & Greed Index", s0: "Cagaço extremo", s1: "Rebosteio", s2: "Andando de lado", s3: "Agora Vai", s4: "É luaaaa!", s5: "Vende a mãe!" },
      time: { yesterday: "Ontem", d7: "7 Dias", d30: "30 Dias" },
      rsi: { title: "Média RSI", overbought: "Sobrecompra", oversold: "Sobrevenda", neutral: "Neutro" },
      macd: { title: "Média MACD", bullish: "Bullish", bearish: "Bearish", neutral: "Neutro" },
      lsr: { title: "Long/Short Ratio", longs: "Longs", shorts: "Shorts", neutral: "Neutro" },
      altseason: { title: "Altcoin Season", btcDomZone: "BTC Dominance", bitcoinSeason: "Bitcoin Season", altcoinSeason: "Altcoin Season", transition: "Transição", yesterday: "Ontem", week: "Semana", month: "Mês" },
      mktcapHistory: { title: "Market Cap", yesterday: "Ontem", week: "Semana", month: "Mês" },
      etf: { title: "Fluxo ETF", netFlow: "Fluxo Líquido", btcEtf: "BTC ETFs", ethEtf: "ETH ETFs", last7d: "7 Dias", last30d: "30 Dias", last90d: "90 Dias", lastUpdate: "Atualizado em", dailyFlow: "Fluxo Diário" },
      trump: { title: "Trump-o-Meter", viewPost: "Ver Post", sarcastic: { negativeSmall: "Impacto Irrelevante", negativeMedium: "Mercado em Alerta", negativeLarge: "TEMPESTADE NO X", positiveSmall: "Sinal de Força", positiveMedium: "BULLISH VIBES", positiveLarge: "A LUA É O LIMIT", neutral: "Silêncio Estratégico" } },
      gainers: { gainers: "Ganhadores", losers: "Perdedores" },
      calendar: { title: "Calendário Econômico", today: "HOJE", tomorrow: "AMANHÃ", previous: "Prev", forecast: "Proj", actual: "Atu" }
    },
    magazine: {
      recentStudies: "Estudos Recentes",
      featuredAnalysis: "Análises em Destaque",
      highlight: "Destaque",
      trendingTopics: "Mais Lidas",
      dailyNews: "Notícias do Dia",
      dontMiss: "Não Perca",
      editorsChoice: "Escolha do Editor",
      miniBulletins: "Mini Boletins"
    },
    pagination: {
      prev: "Anterior",
      page: "Página",
      next: "Próxima"
    }
  },
  indicators: {
    nav: { features: "Recursos", testimonials: "Depoimentos", backList: "Voltar para Lista", backHome: "Início", legal: "Legal" },
    hero: { badge: "Tecnologia de Ponta", title1: "Indicadores Profissionais", subtitle: "Aumente sua assertividade com ferramentas exclusivas.", btnView: "Ver Scripts", btnSub: "Assinar" },
    list: { title: "Nossos Indicadores", subtitle: "Scripts otimizados para TradingView.", searchPlaceholder: "Buscar indicadores...", strategy: "Estratégia", indicator: "Indicador", emptyTitle: "Nenhum resultado", emptyDesc: "Tente outro termo", clearFilter: "Limpar", loadMore: "Carregar Mais" },
    details: { back: "Voltar", strategy: "Estratégia", indicator: "Indicador", updated: "Atualizado", openTv: "Abrir no", disclaimerTitle: "Aviso", disclaimerText: "Investir envolve risco.", boosts: "Boosts", boostThanks: "Obrigado!", boostLink: "Ver no TV", type: "Tipo", version: "Versão", access: "Acesso", getAccess: "Obter Acesso", addFavDesc: "Adicione aos favoritos no", btnAddFav: "Favoritar no TV" },
    vipModal: { title: "Acesso VIP", successTitle: "Sucesso!", successDesc: "Seu pedido foi enviado.", btnGo: "Ir para TV", labelName: "Nome", placeholderName: "Seu nome", labelUser: "Usuário TV", placeholderUser: "@usuario", btnSending: "Enviando...", btnSubmit: "Solicitar" },
    features: { title: "Recursos Exclusivos", f1: { title: "Rápido", desc: "Sinais instantâneos" }, f2: { title: "Seguro", desc: "Auditado" }, f3: { title: "Fácil", desc: "Interface limpa" }, f4: { title: "Atualizado", desc: "Sempre evoluindo" } },
    testimonials: { title: "O que dizem os Traders" },
    faq: { title: "FAQ", q1: "O que é?", a1: "Ferramenta de análise", q2: "Como usar?", a2: "No TradingView", q3: "É grátis?", a3: "Alguns sim" },
    legal: { terms: "Termos...", privacy: "Privacidade...", disclaimer: "Risco..." },
    chat: { welcome: "Olá!", error: "Erro no chat", typing: "Digitando...", limitTitle: "Limite atingido", limit: "Contate o suporte", placeholder: "Pratique algo..." }
  },
  workspace: {
    toolbar: { plan: "Plano", saveLayout: "Salvar", resetLayout: "Resetar", addBoard: "Novo Board", deleteBoard: "Excluir Board", addWidget: "Adicionar" },
    pages: {
      marketcap: "Market Cap",
      topmovers: "Top Movers",
      faq: {
        title: "Metodologia e FAQ",
        q1: "Como o Crypto Fear & Greed Index é calculado?",
        a1: "O índice é uma análise de sentimento multifatorial. Processamos dados de cinco fontes principais: Volatilidade (25%), Momentum e Volume de Mercado (25%), Sentimento em Redes Sociais via NLP (15%), Dominância do Bitcoin (10%) e Tendências de Busca/Google Trends (10%). O resultado é um valor de 0 a 100 onde valores baixos indicam pânico e valores altos indicam euforia.",
        q2: "O que significa cada faixa do índice?",
        a2: "<ul class='space-y-2 font-mono text-xs'><li class='flex gap-2'><b class='text-red-500 w-16 shrink-0'>0-25:</b> <span><b>Cagaço extremo</b> (oportunidade histórica de compra)</span></li><li class='flex gap-2'><b class='text-orange-500 w-16 shrink-0'>26-45:</b> <span><b>Rebosteio</b> (medo presente no mercado)</span></li><li class='flex gap-2'><b class='text-yellow-500 w-16 shrink-0'>46-55:</b> <span><b>Andando de lado</b> (incerteza e falta de volume)</span></li><li class='flex gap-2'><b class='text-green-400 w-16 shrink-0'>56-75:</b> <span><b>Agora Vai</b> (ganância começando a dominar)</span></li><li class='flex gap-2'><b class='text-green-600 w-16 shrink-0'>76-94:</b> <span><b>É luaaaa!</b> (ganância extrema)</span></li><li class='flex gap-2'><b class='text-cyan-400 w-16 shrink-0'>95-100:</b> <span><b>Vende a mãe!</b> (euforia perigosa, correção iminente)</span></li></ul>",
        q3: "Qual a frequência de atualização dos dados?",
        a3: "O índice é atualizado a cada 24 horas, processando o fechamento diário global para garantir que ruídos de curto prazo não distorçam a percepção de sentimento macro.",
        q4: "Este indicador pode ser usado para sinais de trade?",
        a4: "Historicamente, o Medo Extremo marca fundos de mercado, enquanto a Ganância Extrema marca topos. Contudo, o mercado pode permanecer em estado de ganância por semanas antes de uma reversão."
      }
    },
    widgets: {
      fng: { title: "Fear & Greed Index", index: "Índice", desc: "Sentimento de mercado" },
      rsi: { title: "Média RSI", index: "RSI", desc: "Força Relativa Global", timeframe: "Timeframe", tooltip: { price: "Preço", mcap: "Market Cap", change: "Var 24h" } },
      macd: { title: "Média MACD", avgLabel: "Média Global MACD", desc: "Tendência Global MACD", timeframe: "Timeframe", xAxis: "Eixo X", loading: "Carregando...", tooltip: { price: "Preço", mcap: "Cap. Mercado", change: "Var", signal: "Signal", hist: "Hist" }, context: { mcap: "Visão por capitalização", priceChange: "Visão por variação" } },
      lsr: { title: "Long/Short Ratio", desc: "Proporção Long/Short", price: "Preço", size: "Tamanho", total: "Total", noData: "Sem dados" },
      altseason: { title: "Altcoin Season", index: "Índice ASI", altsMcap: "Cap Alts", yesterday: "Ontem", week: "Semana", month: "Mês", desc: "Temporada de Altcoins" },
      etf: { title: "Fluxo ETF", dailyFlow: "Fluxo Diário", btcEtf: "BTC ETFs", ethEtf: "ETH ETFs", last7d: "7 Días", last30d: "30 Dias", last90d: "90 Dias", lastUpdate: "Última atualização", desc: "Fluxo institucional de ETFs" },
      gainers: { title: "Top Movers", gainers: "Ganhadores", losers: "Perdedores", desc: "Principais variações do mercado" },
      trump: { title: "Trump-o-Meter", viewPost: "Ver Post", desc: "Impacto político no mercado" },
      calendar: { title: "Calendário Econômico", today: "HOJE", tomorrow: "AMANHÃ", previous: "Prev", forecast: "Proj", actual: "Atu", desc: "Eventos macroeconômicos" },
      price: { price: "Preço", volEst: "Vol Est", mcap: "Mkt Cap", change24h: "24h %", noData: "Sem dados", desc: "Preço e variação" },
      volume: { vol24h: "Vol 24h", desc: "Volume negociado" },
      trend: { bullish: "Alta", bearish: "Baixa", neutral: "Neutro", strength: "Força", basedOn: "Baseado em", desc: "Análise de tendência" },
      sentiment: { extremeGreed: "Extrema Ganância", greed: "Ganância", extremeFear: "Extremo Medo", fear: "Medo", neutralBiasUp: "Neutro (Alta)", neutralBiasDown: "Neutro (Baixa)", strong: "Forte", weak: "Fraco", consistent: "Consistente", easing: "Diminuindo", recovering: "Recuperando", desc: "Sentimento técnico" },
      orderbook: { price: "Preço", size: "Tamanho", total: "Total", noData: "Sem ordens", desc: "Livro de ofertas" },
      news: { noNews: "Sem notícias", tryAnother: "Tente outro ativo", desc: "Notícias vinculadas" }
    }
  }
};
