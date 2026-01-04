import { WidgetType, DashboardItem, Dashboard, UserTier, Layout } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export const LOGO_URL = 'https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png';

// Grid Configuration
export const COLS = { lg: 20, md: 10, sm: 6, xs: 4, xxs: 2 };
export const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
export const ROW_HEIGHT = 100;

// Monetization Limits
export const TIER_LIMITS = {
  [UserTier.TIER_1]: 2,
  [UserTier.TIER_2]: 4,
  [UserTier.TIER_3]: 6,
};

// Expanded Fallback coins in case APIs fail
export const FALLBACK_COINS = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'USDT', name: 'Tether' },
  { symbol: 'BNB', name: 'BNB' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'USDC', name: 'USDC' },
  { symbol: 'XRP', name: 'XRP' },
  { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'TON', name: 'Toncoin' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'SHIB', name: 'Shiba Inu' },
  { symbol: 'AVAX', name: 'Avalanche' },
  { symbol: 'TRX', name: 'TRON' },
  { symbol: 'DOT', name: 'Polkadot' },
  { symbol: 'BCH', name: 'Bitcoin Cash' },
  { symbol: 'LINK', name: 'Chainlink' },
  { symbol: 'NEAR', name: 'NEAR Protocol' },
  { symbol: 'MATIC', name: 'Polygon' },
  { symbol: 'LTC', name: 'Litecoin' },
  { symbol: 'DAI', name: 'Dai' }
];

export const AVAILABLE_WIDGETS = [
  { type: WidgetType.PRICE, label: 'Price Chart', icon: 'ChartLine' },
  { type: WidgetType.VOLUME, label: 'Volume Data', icon: 'BarChart' },
  { type: WidgetType.TREND, label: 'Trend Analysis', icon: 'TrendingUp' },
  { type: WidgetType.SENTIMENT, label: 'Technical Sentiment', icon: 'Activity' },
  { type: WidgetType.ORDER_BOOK, label: 'Order Book', icon: 'List' },
  { type: WidgetType.NEWS, label: 'Crypto News', icon: 'Newspaper' },
  { type: WidgetType.HEATMAP, label: 'Crypto Heatmap', icon: 'LayoutGrid' },
];

// Initial items for MAIN BOARD 
export const getMainBoardItems = (): DashboardItem[] => [
  { id: `main-fng`, type: WidgetType.FEAR_GREED, title: 'Fear & Greed Sincero', symbol: 'SENTIMENT' },
  { id: `main-altseason`, type: WidgetType.ALTCOIN_SEASON, title: 'Altcoin Season Index', symbol: 'SENTIMENT' },
  { id: `main-rsi`, type: WidgetType.RSI_AVG, title: 'RSI Average / Tracker', symbol: 'MARKET' },
  { id: `main-macd`, type: WidgetType.MACD_AVG, title: 'MACD Average / Tracker', symbol: 'MARKET' },
  { id: `main-lsr`, type: WidgetType.LONG_SHORT_RATIO, title: 'Long/Short Ratio', symbol: 'MARKET' },
  { id: `main-trump`, type: WidgetType.TRUMP_METER, title: 'Trump-o-Meter', symbol: 'SENTIMENT' },
  { id: `main-etf`, type: WidgetType.ETF_NET_FLOW, title: 'ETF Net Flow', symbol: 'GLOBAL' },
  { id: `main-gainers`, type: WidgetType.GAINERS_LOSERS, title: 'Top Movers (24h)', symbol: 'MARKET' },
  { id: `main-calendar`, type: WidgetType.CALENDAR, title: 'Economic Calendar', symbol: 'GLOBAL' },
  { id: `main-heatmap`, type: WidgetType.HEATMAP, title: 'Crypto Heatmap Square', symbol: 'MARKET' },
];

// Helper to generate default layout
export const generateDefaultLayout = (items: DashboardItem[], isMain: boolean = false): Layout[] => {
  if (isMain) {
    return [
        { i: items[0].id, x: 0, y: 0, w: 4, h: 3.1, minW: 2, minH: 2 }, // F&G
        { i: items[1].id, x: 4, y: 0, w: 4, h: 3.1, minW: 2, minH: 2 }, // AltSeason
        { i: items[2].id, x: 8, y: 0, w: 4, h: 3.1, minW: 2, minH: 2 }, // RSI
        { i: items[3].id, x: 12, y: 0, w: 4, h: 3.1, minW: 2, minH: 2 }, // MACD
        { i: items[4].id, x: 16, y: 0, w: 4, h: 3.1, minW: 2, minH: 2 }, // LSR
        { i: items[5].id, x: 0, y: 3.1, w: 4, h: 3.1, minW: 2, minH: 2 }, // Trump
        { i: items[6].id, x: 4, y: 3.1, w: 4, h: 3.1, minW: 2, minH: 2 }, // ETF
        { i: items[7].id, x: 8, y: 3.1, w: 4, h: 3.1, minW: 2, minH: 2 }, // Gainers
        { i: items[8].id, x: 12, y: 3.1, w: 8, h: 3.1, minW: 2, minH: 2 }, // Calendar (Expanded)
        { i: items[9].id, x: 0, y: 6.2, w: 20, h: 6.2, minW: 4, minH: 4 }, // HEATMAP FULL
    ];
  }

  return items.map((item, i) => {
    return {
      i: item.id,
      x: (i % 4) * 5, 
      y: Math.floor(i / 4) * 3, 
      w: 5,
      h: 3,
      minW: 2,
      minH: 2,
    };
  });
};

export const createNewDashboard = (name: string, isEmpty: boolean = false, isMain: boolean = false): Dashboard => {
  const items = isMain ? getMainBoardItems() : (isEmpty ? [] : Array.from({ length: 4 }).map((_, i) => ({
    id: uuidv4(),
    type: i === 0 ? WidgetType.PRICE : i === 1 ? WidgetType.TREND : i === 2 ? WidgetType.VOLUME : WidgetType.NEWS,
    title: i === 0 ? 'Price' : i === 1 ? 'Trend' : i === 2 ? 'Volume' : 'News',
    symbol: 'BTC',
    isMaximized: false
  })));
  
  return {
    id: uuidv4(),
    name,
    items,
    layouts: { lg: generateDefaultLayout(items, isMain), md: [], sm: [] },
    lastUpdated: Date.now(),
    isLocked: isMain
  };
};