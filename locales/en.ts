
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
      fng: { title: "Fear & Greed Index", s0: "Scared shitless", s1: "Oh shit mode", s2: "Sideways snooze", s3: "Here we go!", s4: "To the damn moon!", s5: "Sell your mom!" },
      time: { yesterday: "Yesterday", d7: "7 Days", d30: "30 Days" },
      rsi: { title: "RSI Average", overbought: "Overbought", oversold: "Oversold", neutral: "Neutral" },
      macd: { title: "MACD Average", bullish: "Bullish", bearish: "Bearish", neutral: "Neutral" },
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
        title: "Methodology and FAQ",
        fng: {
          q1: "How is the Fear & Greed Index calculated?",
          a1: "The index is a multi-factor sentiment analysis. We process data from volatility, market volume, social media sentiment, and Bitcoin dominance to generate a value from 0 to 100.",
          q2: "What does each range of the index mean?",
          a2: "<ul class='space-y-2 font-mono text-xs'><li class='flex gap-2'><b class='text-red-500 w-16 shrink-0'>0-25:</b> <span><b>Extreme Fear</b> (historical buying opportunity)</span></li><li class='flex gap-2'><b class='text-orange-500 w-16 shrink-0'>26-45:</b> <span><b>Fear</b> (fear present in the market)</span></li><li class='flex gap-2'><b class='text-yellow-500 w-16 shrink-0'>46-55:</b> <span><b>Neutral</b> (uncertainty and lack of volume)</span></li><li class='flex gap-2'><b class='text-green-400 w-16 shrink-0'>56-75:</b> <span><b>Greed</b> (greed starting to dominate)</span></li><li class='flex gap-2'><b class='text-green-600 w-16 shrink-0'>76-94:</b> <span><b>Extreme Greed</b> (extreme greed)</span></li><li class='flex gap-2'><b class='text-cyan-400 w-16 shrink-0'>95-100:</b> <span><b>Euphoria</b> (dangerous euphoria, imminent correction)</span></li></ul>"
        },
        rsi: {
          q1: "What is the Global RSI Average?",
          a1: "It is the arithmetic average of the Relative Strength Index of the top 100 cryptocurrencies by capitalization. It helps identify when the market as a whole is in macro overbought or oversold zones.",
          q2: "How to interpret the values?",
          a2: "Above 70 indicates that most assets are stretched (overbought). Below 30 indicates that the market is in selling panic (oversold)."
        },
        macd: {
          q1: "How does the MACD Tracker work?",
          a1: "We analyze the crossing of moving average convergence and divergence in multiple assets simultaneously, filtering by market capitalization.",
          q2: "What do the points on the chart represent?",
          a2: "Each point is an asset. The position on the Y-axis shows the strength of the current trend, allowing global reversals to be identified before they happen in price."
        },
        altseason: {
          q1: "What defines an Altcoin Season?",
          a1: "An Altcoin Season happens when 75% of the top 50 coins perform better than Bitcoin over a 90-day period.",
          q2: "How to use this index?",
          a2: "Values close to 0 indicate Bitcoin Season (better to have BTC). Values close to 100 indicate Altcoin Season (altcoins tend to explode relative to the BTC pair)."
        },
        etf: {
          q1: "Why follow ETF flows?",
          a1: "ETF flows represent institutional 'Smart Money' entry. Massive inflows usually precede upward movements in BTC and ETH.",
          q2: "What is Net Flow?",
          a2: "It is the algebraic sum of all inflows and outflows of the spot funds approved in the US."
        },
        lsr: {
          q1: "What is the Long/Short Ratio?",
          a1: "It represents the proportion between long and short bets in the futures market of major exchanges.",
          q2: "How to interpret?",
          a2: "A very high ratio (e.g., 3.0) is usually a contrarian signal, indicating that there are many 'long' traders, which facilitates liquidation cascades."
        },
        trump: {
          q1: "What does the Trump-o-Meter measure?",
          a1: "We process Donald Trump's social media posts via Artificial Intelligence (NLP) to measure the immediate emotional impact on the crypto market.",
          q2: "How to read the meter?",
          a2: "The meter goes from -50 (extreme Bearish) to +50 (extreme Bullish). The further to the right, the higher the expected positive correlation with risk assets like BTC."
        },
        calendar: {
          q1: "What events are monitored in the Calendar?",
          a1: "We focus on US macro data (CPI, FOMC, Payroll) and Brazil, which directly impact Bitcoin's liquidity and volatility.",
          q2: "What do the impact colors mean?",
          a2: "Red (High Impact), Orange (Medium), and Yellow (Low). Red events usually generate violent volatility at the time of the announcement."
        },
        heatmap: {
          q1: "How to read the Square Heatmap?",
          a1: "The size of the square represents the Market Cap, and the color represents the price variation. Intense green indicates strong upward movement, intense red indicates free fall.",
          q2: "Can I filter by performance?",
          a2: "Yes, at the top of the widget you can switch the view to focus only on those who rose or fell the most."
        },
        bubble: {
          q1: "What does the Bubble Chart show?",
          a1: "It is a volumetric and dynamic view of the Top Movers. Larger bubbles represent assets with higher volume or percentage variation on the day.",
          q2: "What are the colors for?",
          a2: "The colors classify sentiment: from extreme Bearish to extreme Bullish, allowing you to visualize where the capital flow is going."
        }
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
