export const en = {
    common: {
        search: "Search",
        loading: "Loading...",
        tagline: "Your crypto intelligence hub."
    },
    header: {
        cockpit: "Cockpit",
        workspace: "Workspace",
        indicators: "Indicators",
        marketCap: "Market Cap",
        academy: "Academy",
        welcome: "Welcome",
        profile: "Profile",
        subscription: "Subscription",
        security: "Security",
        logout: "Logout",
        login: "Login",
        analysisCenter: "Analysis Center"
    },
    dashboard: {
        showStats: "Show Stats",
        hideStats: "Hide Stats",
        magazineTitle: "Magazine",
        widgets: {
            fng: { title: "Fear & Greed", s0: "Extreme Fear", s1: "Fear", s2: "Neutral", s3: "Greed", s4: "Extreme Greed", s5: "Euphoria" },
            rsi: { title: "Average RSI", oversold: "Oversold", bearish: "Bearish", neutral: "Neutral", bullish: "Bullish", overbought: "Overbought" },
            // Add macd to dashboard widgets
            macd: { title: "Average MACD", bullish: "Bullish", bearish: "Bearish", neutral: "Neutral" },
            altseason: { title: "Altcoin Season", bitcoinSeason: "Bitcoin Season", altcoinSeason: "Altcoin Season", btcDomZone: "BTC Dominance", transition: "Transition", yesterday: "Yesterday", week: "7D", month: "30D" },
            mktcapHistory: { title: "Global Mkt Cap", yesterday: "Yesterday", week: "7D", month: "30D" },
            lsr: { title: "Long/Short Ratio", longs: "Longs", shorts: "Shorts", neutral: "Neutral" },
            etf: { title: "ETF Flow", netFlow: "Net Flow" },
            trump: { title: "Trump-o-Meter", fallback: "Neutral", sarcastic: { positiveMedium: "Very Bullish", negativeMedium: "Very Bearish", neutral: "Neutral" } },
            gainers: { title: "Top Gainers/Losers", gainers: "Gainers", losers: "Losers" },
            mktcap: { title: "Top 10 Market Cap" },
            calendar: { title: "Economic Calendar", today: "TODAY", tomorrow: "TOMORROW", previous: "Prev.", forecast: "Proj.", actual: "Real" },
            time: { yesterday: "Yesterday", d7: "7D", d30: "30D" }
        },
        magazine: {
            recentStudies: "Recent Studies",
            featuredAnalysis: "Featured Analysis",
            highlight: "Highlight",
            trendingTopics: "Trending Topics",
            dailyNews: "Daily News",
            dontMiss: "Don't Miss",
            editorsChoice: "Editor's Choice",
            newsFeed: "News Feed",
            miniBulletins: "Mini Bulletins"
        },
        pagination: { prev: "Previous", next: "Next", page: "Page" }
    },
    footer: {
        tagline: "The ultimate platform for the modern trader.",
        terms: "Terms of Use",
        privacy: "Privacy Policy",
        risk: "Risk Warning",
        rights: "All rights reserved.",
        modalAgree: "I Agree"
    },
    indicators: {
        title: "CCT Indicators",
        nav: { features: "Features", testimonials: "Testimonials", backList: "Back to List", backHome: "Home", legal: "Legal" },
        hero: { badge: "Cutting Edge Tech", title1: "High Precision Indicators", subtitle: "Exclusive tools for TradingView.", btnView: "View Scripts", btnSub: "Subscribe" },
        list: { title: "Our Indicators", subtitle: "Explore our collection.", searchPlaceholder: "Search indicators...", emptyTitle: "None found", emptyDesc: "Try another term.", clearFilter: "Clear", loadMore: "Load More", strategy: "Strategy", indicator: "Indicator" },
        details: { back: "Back", strategy: "Strategy", indicator: "Indicator", updated: "Recently updated", openTv: "Open on TV", disclaimerTitle: "Legal Disclaimer", disclaimerText: "Trading involves risks.", boosts: "Boosts", type: "Type", version: "Version", access: "Access", getAccess: "Get Access", addFavDesc: "Add to favorites on", btnAddFav: "Add to Favorites", boostThanks: "Thanks for the boost!", boostLink: "View on TradingView" },
        vipModal: { title: "Request VIP Access", successTitle: "Request Sent", successDesc: "We will contact you.", btnGo: "Ok", labelName: "Name", placeholderName: "Your name", labelUser: "TV Username", placeholderUser: "Your TradingView ID", btnSubmit: "Submit", btnSending: "Sending..." },
        features: { title: "Why Choose CCT?", f1: { title: "Fast", desc: "Instant execution." }, f2: { title: "Secure", desc: "100% audited." }, f3: { title: "Simple", desc: "Intuitive interface." }, f4: { title: "Updated", desc: "Constant support." } },
        testimonials: { title: "What traders say" },
        // Add faq translations for Indicators page
        faq: { 
            title: "Frequently Asked Questions", 
            q1: "How do I install the indicators?", 
            a1: "Just click the TradingView link and add it to your favorites.", 
            q2: "Do I need a paid TV account?", 
            a2: "No, most of our indicators work on the free version.", 
            q3: "How do I get access to VIP scripts?", 
            a3: "After subscribing, send your TradingView username for manual approval." 
        },
        chat: { welcome: "Hello! How can I help?", typing: "Typing...", limitTitle: "Limit Reached", limit: "Visit TradingView for more info.", placeholder: "Ask a question...", error: "Connection error." },
        legal: { terms: "Terms...", privacy: "Privacy...", disclaimer: "Risk Warning..." }
    },
    workspace: {
        toolbar: { plan: "Plan", saveLayout: "Save", resetLayout: "Reset", addBoard: "New Board", deleteBoard: "Delete Board", addWidget: "Add" },
        widgets: {
            fng: { title: "Fear & Greed", desc: "Market sentiment index.", historical: "Historical", index: "Index" },
            rsi: { title: "Average RSI", desc: "Average RSI of multiple assets.", timeframe: "Period", limit: "Coins", xAxis: "X Axis" },
            macd: { title: "Average MACD", desc: "Average MACD of multiple assets.", avgLabel: "Average", timeframe: "Period", xAxis: "X Axis", loading: "Loading...", tooltip: { price: "Price", mcap: "Mkt Cap", change: "24h %", signal: "Signal", hist: "Hist." }, context: { mcap: "Sorted by Mkt Cap.", priceChange: "Sorted by Change." } },
            trump: { title: "Trump-o-Meter", desc: "Impact of Donald Trump's posts.", viewPost: "View Post" },
            lsr: { title: "Long/Short Ratio", desc: "Ratio between long and short positions.", fetching: "Fetching...", unavailable: "Unavailable", couldNotFetch: "Error fetching." },
            altseason: { title: "Altcoin Season", desc: "Indicates if market favors Alts or BTC.", index: "Index", altsMcap: "Alts Mkt Cap" },
            etf: { title: "ETF Flow", desc: "Institutional flow for BTC/ETH ETFs.", dailyFlow: "Daily Flow", lastUpdate: "Last update:", btcEtf: "BTC ETF", ethEtf: "ETH ETF", last7d: "7 Days", last30d: "30 Days", last90d: "90 Days" },
            gainers: { title: "Gainers & Losers", desc: "Top 100 coins with highest changes.", gainers: "Gainers", losers: "Losers" },
            calendar: { title: "Calendar", desc: "Important macroeconomic events.", previous: "Prev.", forecast: "Proj.", actual: "Real", today: "TODAY", tomorrow: "TOMORROW" },
            heatmap: { title: "Crypto Heatmap", desc: "Visual block view (Treemap) of the crypto market. Grouped by categories and sized by Market Cap or 24h Volume.", modeCap: "Market Cap", modeVol: "24h Volume", price: "Price", change: "Change", noData: "Heatmap data unavailable" },
            // Add title and desc to standard widgets for GridHeader.tsx
            price: { title: "Price and Charts", desc: "Real-time price tracking with historical charts.", price: "Price", volEst: "Est. Vol.", mcap: "Mkt Cap", change24h: "24h %", noData: "No data." },
            volume: { title: "Volume", desc: "Trading volume analysis over time.", vol24h: "24h Volume" },
            trend: { title: "Trend Analysis", desc: "Technical trend analysis based on moving averages.", bullish: "Bullish", bearish: "Bearish", neutral: "Neutral", strength: "Strength", basedOn: "Based on" },
            sentiment: { title: "Technical Sentiment", desc: "Market sentiment based on technical indicators (RSI).", extremeGreed: "Euphoria", greed: "Greed", extremeFear: "Panic", fear: "Fear", strong: "Strong", weak: "Weak", consistent: "Consistent", easing: "Easing", recovering: "Recovering", neutralBiasUp: "Neutral (Bias Up)", neutralBiasDown: "Neutral (Bias Down)" },
            orderbook: { title: "Order Book", desc: "Real-time order book and market depth.", price: "Price", size: "Size", total: "Total", noData: "No book data." },
            news: { title: "Market News", desc: "Latest news from the crypto market.", noNews: "No news found.", tryAnother: "Try another coin." }
        }
    }
};