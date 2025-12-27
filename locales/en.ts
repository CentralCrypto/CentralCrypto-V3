
export const en = {
  common: {
    search: "Search",
    loading: "Loading...",
    tagline: "Your ultimate crypto analysis and intelligence hub."
  },
  header: {
    cockpit: "Cockpit",
    workspace: "Workspace",
    indicators: "Indicators",
    marketCap: "Market Cap",
    academy: "Academy",
    profile: "My Profile",
    login: "Login",
    logout: "Logout",
    welcome: "Welcome",
    subscription: "Subscription",
    analysisCenter: "Analysis Center"
  },
  footer: {
    tagline: "Intelligence and technology for the digital asset market.",
    terms: "Terms of Use",
    privacy: "Privacy",
    risk: "Risk Warning",
    rights: "All rights reserved.",
    modalAgree: "I agree"
  },
  dashboard: {
    widgets: {
      fng: { title: "Fear & Greed Index", s0: "Extreme Fear", s1: "Fear", s2: "Neutral", s3: "Greed", s4: "Extreme Greed", s5: "Euphoria" },
      time: { yesterday: "Yesterday", d7: "7 Days", d30: "30 Days" },
      rsi: { title: "RSI Average", overbought: "Overbought", oversold: "Oversold", neutral: "Neutral" },
      macd: { bullish: "Bullish", bearish: "Bearish", neutral: "Neutral" },
      lsr: { title: "Long/Short Ratio", longs: "Longs", shorts: "Shorts", neutral: "Neutral" },
      altseason: { title: "Altcoin Season", btcDomZone: "BTC Dom Zone", bitcoinSeason: "Bitcoin Season", altcoinSeason: "Altcoin Season", transition: "Transition", yesterday: "Yesterday", week: "Week", month: "Month" },
      mktcapHistory: { title: "Market Cap", yesterday: "Yesterday", week: "Week", month: "Month" },
      etf: { title: "ETF Flow", netFlow: "Net Flow", btcEtf: "BTC ETFs", ethEtf: "ETH ETFs", last7d: "7 Days", last30d: "30 Days", last90d: "90 Days", lastUpdate: "Updated on", dailyFlow: "Daily Flow" },
      trump: { title: "Trump-o-Meter", viewPost: "View Post", sarcastic: { negativeSmall: "Irrelevant Impact", negativeMedium: "Market Alert", negativeLarge: "STORM ON X", positiveSmall: "Strength Signal", positiveMedium: "BULLISH VIBES", positiveLarge: "THE MOON IS THE LIMIT", neutral: "Strategic Silence" } },
      gainers: { gainers: "Gainers", losers: "Losers" },
      calendar: { title: "Economic Calendar", today: "TODAY", tomorrow: "TOMORROW", previous: "Prev", forecast: "Fore", actual: "Actu" }
    },
    magazine: {
      recentStudies: "Recent Studies",
      featuredAnalysis: "Featured Analysis",
      highlight: "Highlight",
      trendingTopics: "Trending",
      dailyNews: "Daily News",
      dontMiss: "Don't Miss",
      editorsChoice: "Editor's Choice",
      miniBulletins: "Mini Bulletins"
    },
    pagination: {
      prev: "Prev",
      page: "Page",
      next: "Next"
    }
  },
  indicators: {
    nav: { features: "Features", testimonials: "Testimonials", backList: "Back to List", backHome: "Home", legal: "Legal" },
    hero: { badge: "Cutting Edge", title1: "Professional Indicators", subtitle: "Boost your accuracy with exclusive tools.", btnView: "View Scripts", btnSub: "Subscribe" },
    list: { title: "Our Indicators", subtitle: "Optimized scripts for TradingView.", searchPlaceholder: "Search indicators...", strategy: "Strategy", indicator: "Indicator", emptyTitle: "No results", emptyDesc: "Try another term", clearFilter: "Clear", loadMore: "Load More" },
    details: { back: "Back", strategy: "Strategy", indicator: "Indicator", updated: "Updated", openTv: "Open on", disclaimerTitle: "Disclaimer", disclaimerText: "Investing involves risk.", boosts: "Boosts", boostThanks: "Thanks!", boostLink: "View on TV", type: "Type", version: "Version", access: "Access", getAccess: "Get Access", addFavDesc: "Add to favorites on", btnAddFav: "Favorite on TV" },
    vipModal: { title: "VIP Access", successTitle: "Success!", successDesc: "Your request has been sent.", btnGo: "Go to TV", labelName: "Name", placeholderName: "Your name", labelUser: "TV Username", placeholderUser: "@username", btnSending: "Sending...", btnSubmit: "Submit" },
    features: { title: "Exclusive Features", f1: { title: "Fast", desc: "Instant signals" }, f2: { title: "Safe", desc: "Audited" }, f3: { title: "Easy", desc: "Clean interface" }, f4: { title: "Updated", desc: "Always evolving" } },
    testimonials: { title: "What Traders Say" },
    faq: { title: "FAQ", q1: "What is it?", a1: "Analysis tool", q2: "How to use?", a2: "On TradingView", q3: "Is it free?", a3: "Some are" },
    legal: { terms: "Terms...", privacy: "Privacy...", disclaimer: "Risk..." },
    chat: { welcome: "Hello!", error: "Chat error", typing: "Typing...", limitTitle: "Limit reached", limit: "Contact support", placeholder: "Ask anything..." }
  },
  workspace: {
    toolbar: { plan: "Plan", saveLayout: "Save", resetLayout: "Reset", addBoard: "New Board", deleteBoard: "Delete Board", addWidget: "Add" },
    pages: {
      marketcap: "Market Cap",
      topmovers: "Top Movers",
      faq: {
        title: "Frequently Asked Questions",
        q1: "How does this indicator calculate data?",
        a1: "Our algorithms process real-time data directly from the Cachecko source, filtering volatility and volume to deliver precise metrics.",
        q2: "Where should I use this information?",
        a2: "These indicators are decision support tools. We recommend using them to confirm market trends and identify exhaustion points (extreme fear or greed).",
        q3: "Which data sources are used?",
        a3: "We read aggregated data from the largest exchanges (Binance, OKX, Bybit), social networks, and on-chain institutional flows.",
        q4: "How often is the data updated?",
        a4: "Most analytical metrics (RSI, F&G, Altseason) are updated every 24 hours, while prices and orders are in real-time."
      }
    },
    widgets: {
      fng: { title: "Fear & Greed Index", index: "Index", desc: "Market sentiment" },
      rsi: { title: "RSI Average", index: "RSI", desc: "Global Relative Strength", timeframe: "Timeframe", tooltip: { price: "Price", mcap: "Market Cap", change: "24h Var" } },
      macd: { title: "MACD Average", avgLabel: "Global MACD Average", desc: "Global MACD Trend", timeframe: "Timeframe", xAxis: "X Axis", loading: "Loading...", tooltip: { price: "Price", mcap: "Mkt Cap", change: "Var", signal: "Signal", hist: "Hist" }, context: { mcap: "View by cap", priceChange: "View by variation" } },
      lsr: { title: "Long/Short Ratio", desc: "Long/Short ratio", price: "Price", size: "Size", total: "Total", noData: "No data" },
      altseason: { title: "Altcoin Season", index: "ASI Index", altsMcap: "Alts Market Cap", yesterday: "Yesterday", week: "Week", month: "Month", desc: "Altcoin Season Indicator" },
      etf: { title: "ETF Flow", dailyFlow: "Daily Flow", btcEtf: "BTC ETFs", ethEtf: "ETH ETFs", last7d: "7 Days", last30d: "30 Days", last90d: "90 Days", lastUpdate: "Last update", desc: "Institutional ETF flows" },
      gainers: { title: "Top Movers", gainers: "Gainers", losers: "Losers", desc: "Top market variations" },
      trump: { title: "Trump-o-Meter", viewPost: "View Post", desc: "Political impact on market" },
      calendar: { title: "Economic Calendar", today: "TODAY", tomorrow: "TOMORROW", previous: "Prev", forecast: "Fore", actual: "Actu", desc: "Macroeconomic events" },
      price: { price: "Price", volEst: "Est Vol", mcap: "Mkt Cap", change24h: "24h %", noData: "No data", desc: "Price and variation" },
      volume: { vol24h: "24h Vol", desc: "Traded volume" },
      trend: { bullish: "Bullish", bearish: "Bearish", neutral: "Neutral", strength: "Strength", basedOn: "Based on", desc: "Trend analysis" },
      sentiment: { extremeGreed: "Extreme Greed", greed: "Greed", extremeFear: "Extreme Fear", fear: "Fear", neutralBiasUp: "Neutral (Up)", neutralBiasDown: "Neutral (Down)", strong: "Strong", weak: "Weak", consistent: "Consistent", easing: "Easing", recovering: "Recovering", desc: "Technical sentiment" },
      orderbook: { price: "Price", size: "Size", total: "Total", noData: "No orders", desc: "Order book" },
      news: { noNews: "No news", tryAnother: "Try another asset", desc: "Linked news" }
    }
  }
};
