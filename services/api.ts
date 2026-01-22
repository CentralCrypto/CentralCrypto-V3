import { ApiCoin } from '../../../types';
import { httpGetJson } from '../../../services/http';
import { getCacheckoUrl, ENDPOINTS } from '../../../services/endpoints';

const STABLECOINS = ['USDT', 'USDC', 'DAI', 'FDUSD', 'TUSD', 'USDD', 'PYUSD', 'USDE', 'GUSD', 'USDP', 'BUSD'];

/**
 * Busca dados usando caminhos relativos e o utilitário robusto httpGetJson.
 * O proxy interno do Vite resolve para o domínio principal.
 */
export const fetchWithFallback = async (url: string): Promise<any | null> => {
  try {
    const salt = Math.floor(Date.now() / 60000);
    const finalUrl = url.includes('?') ? `${url}&_cb=${salt}` : `${url}?_cb=${salt}`;
    const { data } = await httpGetJson(finalUrl, { timeoutMs: 15000, retries: 2 });
    return data;
  } catch (e: any) {
    if (e.status !== 404) {
      console.warn(`[API] Warn fetching ${url}:`, e.message || e);
    }
  }
  return null;
};

export const isStablecoin = (symbol: string) => STABLECOINS.includes(symbol.toUpperCase());

/**
 * Cache + dedupe em memória (por aba).
 */
const TOP_COINS_TTL_MS = 60_000;
let topCoinsCacheTs = 0;
let topCoinsCache: ApiCoin[] = [];
let topCoinsInFlight: Promise<ApiCoin[]> | null = null;

export const fetchTopCoins = async (opts?: { force?: boolean; ttlMs?: number }): Promise<ApiCoin[]> => {
  const now = Date.now();
  const force = Boolean(opts?.force);
  const ttlMs = typeof opts?.ttlMs === 'number' && isFinite(opts.ttlMs) ? opts!.ttlMs! : TOP_COINS_TTL_MS;

  if (!force && topCoinsCache.length > 0 && (now - topCoinsCacheTs) < ttlMs) return topCoinsCache;
  if (!force && topCoinsInFlight) return topCoinsInFlight;

  topCoinsInFlight = (async () => {
    const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.main));
    if (!data) return topCoinsCache || [];

    let coins: any[] = [];

    if (Array.isArray(data)) {
      const subData = data.find(item => item && Array.isArray(item.data));
      if (subData) coins = subData.data;
      else if (data[0] && Array.isArray(data[0])) coins = data[0];
      else coins = data;
    } else if (data && typeof data === 'object') {
      if (Array.isArray((data as any).data)) coins = (data as any).data;
      else {
        const foundArray = Object.values(data as any).find(v => Array.isArray(v) && (v as any[]).length > 10);
        if (foundArray) coins = foundArray as any[];
      }
    }

    topCoinsCache = Array.isArray(coins) ? (coins as ApiCoin[]) : [];
    topCoinsCacheTs = Date.now();
    return topCoinsCache;
  })().finally(() => {
    topCoinsInFlight = null;
  });

  return topCoinsInFlight;
};

// --------- CATEGORIES (HEATMAP) ---------

export interface HeatmapCategory {
  id: string;
  name: string;
  description?: string;
  type?: string;
  coin_counter?: number;
  ico_counter?: number;
  coins?: any[];
}

const CATEGORIES_TTL_MS = 10 * 60_000;
let categoriesCacheTs = 0;
let categoriesCache: HeatmapCategory[] = [];
let categoriesInFlight: Promise<HeatmapCategory[]> | null = null;

export const fetchHeatmapCategories = async (opts?: { force?: boolean }): Promise<HeatmapCategory[]> => {
  const now = Date.now();
  const force = Boolean(opts?.force);

  if (!force && categoriesCache.length > 0 && (now - categoriesCacheTs) < CATEGORIES_TTL_MS) return categoriesCache;
  if (!force && categoriesInFlight) return categoriesInFlight;

  categoriesInFlight = (async () => {
    const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.heatmapCategories));
    const arr = Array.isArray(data) ? data : (Array.isArray((data as any)?.data) ? (data as any).data : []);
    categoriesCache = Array.isArray(arr) ? (arr as HeatmapCategory[]) : [];
    categoriesCacheTs = Date.now();
    return categoriesCache;
  })().finally(() => {
    categoriesInFlight = null;
  });

  return categoriesInFlight;
};

// --------- OUTROS EXPORTS USADOS PELOS WIDGETS ---------

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  description: string;
  thumbnail: string;
}

export interface EtfFlowData {
  btcValue: number;
  ethValue: number;
  netFlow: number;
  timestamp: number;
  chartDataBTC: any[];
  chartDataETH: any[];
  history: { lastWeek: number; lastMonth: number; last90d: number; };
  solValue: number;
  xrpValue: number;
}

export interface LsrData { lsr: number | null; longs: number | null; shorts: number | null; }

export interface MacdAvgData { averageMacd: number; yesterday: number; days7Ago: number; days30Ago: number; }

export interface MacdTrackerPoint {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
  logo?: string;
  macd: Record<string, number>;
  signal: Record<string, number>;
  histogram: Record<string, number>;
  macdNorm?: number;
}

export interface RsiAvgData { averageRsi: number; yesterday: number; days7Ago: number; days30Ago: number; days90Ago?: number; }

export interface RsiTrackerPoint {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h?: number;
  rank?: number;
  logo?: string;
  rsi: Record<string, number>;
  currentRsi?: number;
  lastRsi?: number;
}

export interface RsiTableItem {
  id: string;
  symbol: string;
  name?: string;
  price: number;
  rsi: {
    "15m": number;
    "1h": number;
    "4h": number;
    "24h": number;
    "7d": number;
  };
  change?: number;
  logo?: string;
  marketCap?: number;
  volume24h?: number;
  rank?: number;
}

export interface EconEvent {
  date: string;
  title: string;
  country: string;
  impact: string;
  previous?: string;
  forecast?: string;
}

export interface OrderBookData {
  bids: { price: string; qty: string }[];
  asks: { price: string; qty: string }[];
}

export interface FngData {
  value: string;
  timestamp: string;
  value_classification?: string;
  value_classification_i18n?: { pt: string; en: string; es: string; };
}

export interface TrumpData {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  sarcastic_label: string;
  trump_rank_50: number;
  trump_rank_percent: number;
  impact_semaforo?: string;
}

export interface AltSeasonHistoryPoint { timestamp: number; altcoinIndex: number; altcoinMarketcap: number; }
export interface AltSeasonData { index: number; yesterday: number; lastWeek: number; lastMonth: number; history?: AltSeasonHistoryPoint[]; }

// -------------------- HELPERS RSI (client-side paging/sort) --------------------

export type RsiTimeframeKey = '15m' | '1h' | '4h' | '24h' | '7d';
export type RsiSortKey = 'rsi15m' | 'rsi1h' | 'rsi4h' | 'rsi24h' | 'rsi7d' | 'marketCap' | 'volume24h' | 'price24h' | 'rank';

export interface RsiTablePageResult {
  items: RsiTableItem[];
  page: number;
  totalPages: number;
  totalItems: number;
}

const tfKeyFromSort = (sort: string): RsiTimeframeKey | null => {
  if (sort === 'rsi15m') return '15m';
  if (sort === 'rsi1h') return '1h';
  if (sort === 'rsi4h') return '4h';
  if (sort === 'rsi24h') return '24h';
  if (sort === 'rsi7d') return '7d';
  return null;
};

const safeNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeSearch = (s: string) => (s || '').toLowerCase().trim();

// --------- NEWS ---------

export const fetchCryptoNews = async (symbol: string, coinName: string): Promise<NewsItem[]> => {
  const url = ENDPOINTS.special.news;
  const finalUrl = `${url}?s=${encodeURIComponent(symbol)}&n=${encodeURIComponent(coinName)}`;
  const data = await fetchWithFallback(finalUrl);
  return Array.isArray(data) ? data : [];
};

export const fetchAltcoinSeason = async (): Promise<AltSeasonData | null> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.altseason));
  if (!data) return null;
  return Array.isArray(data) ? data[0] : data;
};

export const fetchAltcoinSeasonHistory = async (): Promise<AltSeasonHistoryPoint[]> => {
  const data = await fetchAltcoinSeason();
  return Array.isArray(data?.history) ? (data!.history as AltSeasonHistoryPoint[]) : [];
};

export const fetchTrumpData = async (): Promise<TrumpData | null> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.trump));
  if (!data) return null;
  return Array.isArray(data) ? data[0] : data;
};

export const fetchFearAndGreed = async (): Promise<FngData[]> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.fng));
  if (!data) return [];
  const root = Array.isArray(data) ? (data[0]?.data || data) : ((data as any).data || []);
  return Array.isArray(root) ? root : [];
};

// -------------------- RSI --------------------

export const fetchRsiAverage = async (): Promise<RsiAvgData | null> => {
  const raw = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.rsiAvg));
  if (!raw) return null;

  const root = Array.isArray(raw) ? raw[0] : raw;
  const dataNode = root?.data || root;

  // Aceita tanto {overall:{...}} quanto objeto direto
  const overall = dataNode?.overall || dataNode;

  // Padroniza e preserva compatibilidade
  return {
    averageRsi: safeNum(overall?.averageRsi, 50),
    yesterday: safeNum(overall?.yesterday, 50),
    days7Ago: safeNum(overall?.days7Ago, 50),
    days30Ago: safeNum(overall?.days30Ago, 50),
    days90Ago: Number.isFinite(Number(overall?.days90Ago)) ? Number(overall?.days90Ago) : undefined
  };
};

// --- SCATTER CHART DATA (RSI TRACKER) ---
// Arquivo Específico: rsitrackerhist.json
export const fetchRsiTrackerHist = async (): Promise<RsiTrackerPoint[]> => {
  const raw = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.rsiTrackerHist));

  // N8N Output standard: [ { data: ... } ] or direct array
  let items: any[] = [];
  if (Array.isArray(raw)) {
    items = (raw[0]?.data && Array.isArray(raw[0].data)) ? raw[0].data : raw;
  } else if (raw && raw.data) {
    items = Array.isArray(raw.data) ? raw.data : [];
  }

  if (!items.length) return [];

  return items.map((p: any) => {
    const rsiNode = p.rsiOverall || p.rsi || {};
    const symbol = p.symbol || p.s || '';
    return {
      symbol,
      name: p.name || p.n || symbol,
      price: safeNum(p.current_price || p.price, 0),
      change24h: safeNum(p.price_change_percentage_24h || p.price24h, 0),
      marketCap: safeNum(p.market_cap || p.marketCap, 0),
      volume24h: safeNum(p.total_volume || p.volume24h, undefined as any),
      rank: Number.isFinite(Number(p.market_cap_rank || p.rank)) ? Number(p.market_cap_rank || p.rank) : undefined,
      logo: p.image || p.logo || `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`,
      rsi: {
        "15m": safeNum(rsiNode?.rsi15m ?? rsiNode?.['15m'], 50),
        "1h": safeNum(rsiNode?.rsi1h ?? rsiNode?.['1h'], 50),
        "4h": safeNum(rsiNode?.rsi4h ?? rsiNode?.['4h'], 50),
        "24h": safeNum(rsiNode?.rsi24h ?? rsiNode?.['24h'], 50),
        "7d": safeNum(rsiNode?.rsi7d ?? rsiNode?.['7d'], 50),
      },
      currentRsi: Number.isFinite(Number(p.currentRsi)) ? Number(p.currentRsi) : (Number.isFinite(Number(rsiNode?.rsi4h)) ? Number(rsiNode?.rsi4h) : undefined),
      lastRsi: Number.isFinite(Number(p.lastRsi)) ? Number(p.lastRsi) : undefined
    };
  });
};

// -------- RSI TABLE CACHE (rsitracker.json) com TTL + inflight --------

const RSI_TABLE_TTL_MS = 60_000;
let rsiTableCacheTs = 0;
let rsiTableCache: RsiTableItem[] = [];
let rsiTableInFlight: Promise<RsiTableItem[]> | null = null;

/**
 * --- TABLE DATA ---
 * Arquivo Específico: rsitracker.json
 */
export const fetchRsiTable = async (opts?: { force?: boolean; ttlMs?: number }): Promise<RsiTableItem[]> => {
  const now = Date.now();
  const force = Boolean(opts?.force);
  const ttlMs = typeof opts?.ttlMs === 'number' && isFinite(opts.ttlMs) ? opts!.ttlMs! : RSI_TABLE_TTL_MS;

  if (!force && rsiTableCache.length > 0 && (now - rsiTableCacheTs) < ttlMs) return rsiTableCache;
  if (!force && rsiTableInFlight) return rsiTableInFlight;

  rsiTableInFlight = (async () => {
    const raw = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.rsiTable));

    let items: any[] = [];
    if (Array.isArray(raw)) {
      items = (raw[0]?.data && Array.isArray(raw[0].data)) ? raw[0].data : raw;
    } else if (raw && raw.data) {
      items = Array.isArray(raw.data) ? raw.data : [];
    }

    if (!items.length) {
      rsiTableCache = [];
      rsiTableCacheTs = Date.now();
      return rsiTableCache;
    }

    rsiTableCache = items.map((p: any) => {
      const symbol = p.symbol || '';
      const rsiNode = p.rsiOverall || p.rsi || p.rsi_overall || {};

      return {
        id: String(p.id || symbol || ''),
        symbol,
        name: p.name,
        price: safeNum(p.current_price || p.price, 0),
        change: safeNum(p.price_change_percentage_24h || p.price24h || p.change24h, 0),
        marketCap: Number.isFinite(Number(p.market_cap || p.marketCap)) ? Number(p.market_cap || p.marketCap) : undefined,
        volume24h: Number.isFinite(Number(p.total_volume || p.volume24h)) ? Number(p.total_volume || p.volume24h) : undefined,
        rank: Number.isFinite(Number(p.market_cap_rank || p.rank)) ? Number(p.market_cap_rank || p.rank) : undefined,
        logo: p.image || p.logo || `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`,
        rsi: {
          "15m": safeNum(p.rsi15m || rsiNode?.rsi15m || rsiNode?.['15m'], 50),
          "1h": safeNum(p.rsi1h || rsiNode?.rsi1h || rsiNode?.['1h'], 50),
          "4h": safeNum(p.rsi4h || rsiNode?.rsi4h || rsiNode?.['4h'], 50),
          "24h": safeNum(p.rsi24h || rsiNode?.rsi24h || rsiNode?.['24h'], 50),
          "7d": safeNum(p.rsi7d || rsiNode?.rsi7d || rsiNode?.['7d'], 50)
        }
      } as RsiTableItem;
    });

    rsiTableCacheTs = Date.now();
    return rsiTableCache;
  })().finally(() => {
    rsiTableInFlight = null;
  });

  return rsiTableInFlight;
};

/**
 * Paginação/sort/search em cima do MESMO cache rsitracker.json
 * Assim você consegue tabela e scatter usando 1 endpoint de cache.
 */
export const fetchRsiTablePage = async (args: {
  page: number;
  limit: number;
  sort?: RsiSortKey;
  ascendingOrder?: boolean;
  filterText?: string;
  force?: boolean;
}): Promise<RsiTablePageResult> => {
  const page = Math.max(1, Math.floor(args.page || 1));
  const limit = Math.max(1, Math.min(500, Math.floor(args.limit || 200)));
  const sort = (args.sort || 'rsi4h') as RsiSortKey;
  const asc = Boolean(args.ascendingOrder);
  const q = normalizeSearch(args.filterText || '');

  const all = await fetchRsiTable({ force: args.force });

  // filter
  let filtered = all;
  if (q) {
    filtered = all.filter(i => {
      const sym = (i.symbol || '').toLowerCase();
      const nm = (i.name || '').toLowerCase();
      return sym.includes(q) || nm.includes(q);
    });
  }

  // sort
  const tf = tfKeyFromSort(sort);
  const sorted = [...filtered].sort((a, b) => {
    let av = 0;
    let bv = 0;

    if (tf) {
      av = safeNum(a.rsi?.[tf], 0);
      bv = safeNum(b.rsi?.[tf], 0);
    } else if (sort === 'marketCap') {
      av = safeNum(a.marketCap, 0);
      bv = safeNum(b.marketCap, 0);
    } else if (sort === 'volume24h') {
      av = safeNum(a.volume24h, 0);
      bv = safeNum(b.volume24h, 0);
    } else if (sort === 'price24h') {
      av = safeNum(a.change, 0);
      bv = safeNum(b.change, 0);
    } else if (sort === 'rank') {
      // rank menor = melhor; em sort asc/desc a gente respeita o toggle
      av = safeNum(a.rank, 0);
      bv = safeNum(b.rank, 0);
    } else {
      av = safeNum(a.rsi?.['4h'], 0);
      bv = safeNum(b.rsi?.['4h'], 0);
    }

    if (av === bv) {
      // desempate estável: marketCap desc
      const am = safeNum(a.marketCap, 0);
      const bm = safeNum(b.marketCap, 0);
      return bm - am;
    }

    return asc ? (av - bv) : (bv - av);
  });

  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const safePage = Math.min(page, totalPages);

  const start = (safePage - 1) * limit;
  const end = start + limit;
  const items = sorted.slice(start, end);

  return { items, page: safePage, totalPages, totalItems };
};

/**
 * Scatter usando o MESMO cache da tabela (rsitracker.json).
 * Útil quando você quer 1 fonte única para gráfico e tabela.
 */
export const fetchRsiScatterFromTableCache = async (opts?: {
  limit?: number;
  force?: boolean;
}): Promise<RsiTrackerPoint[]> => {
  const limit = typeof opts?.limit === 'number' && isFinite(opts.limit) ? Math.max(1, Math.min(1000, Math.floor(opts.limit))) : 300;
  const rows = await fetchRsiTable({ force: opts?.force });

  return rows.slice(0, limit).map(r => ({
    symbol: r.symbol,
    name: r.name || r.symbol,
    price: safeNum(r.price, 0),
    change24h: safeNum(r.change, 0),
    marketCap: safeNum(r.marketCap, 0),
    volume24h: Number.isFinite(Number(r.volume24h)) ? Number(r.volume24h) : undefined,
    rank: Number.isFinite(Number(r.rank)) ? Number(r.rank) : undefined,
    logo: r.logo,
    rsi: {
      "15m": safeNum(r.rsi?.["15m"], 50),
      "1h": safeNum(r.rsi?.["1h"], 50),
      "4h": safeNum(r.rsi?.["4h"], 50),
      "24h": safeNum(r.rsi?.["24h"], 50),
      "7d": safeNum(r.rsi?.["7d"], 50),
    }
  }));
};

// -------------------- MACD --------------------

export const fetchMacdAverage = async (): Promise<MacdAvgData | null> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.macdAvg));
  return data || null;
};

export const fetchMacdTracker = async (): Promise<MacdTrackerPoint[]> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.macdTracker));
  return Array.isArray(data) ? data : [];
};

// -------------------- ECON --------------------

export const fetchEconomicCalendar = async (): Promise<EconEvent[]> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.calendar));
  return Array.isArray(data) ? data : [];
};

// -------------------- ETF --------------------

export const fetchEtfFlow = async (): Promise<EtfFlowData | null> => {
  const raw = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.etfNetFlow));
  if (!raw) return null;

  const root = Array.isArray(raw) ? raw[0] : raw;

  const data = (root && typeof root === 'object' && (root as any).data) ? (root as any).data : root;
  const status = (root && typeof root === 'object' && (root as any).status) ? (root as any).status : null;

  return {
    btcValue: Number(data?.totalBtcValue ?? data?.btcValue ?? 0),
    ethValue: Number(data?.totalEthValue ?? data?.ethValue ?? 0),
    netFlow: Number(data?.total ?? data?.netFlow ?? 0),
    timestamp: status?.timestamp ? new Date(status.timestamp).getTime() : Date.now(),
    chartDataBTC: data?.chartDataBTC || [],
    chartDataETH: data?.chartDataETH || [],
    history: data?.history || { lastWeek: 0, lastMonth: 0, last90d: 0 },
    solValue: Number(data?.solValue ?? 0),
    xrpValue: Number(data?.xrpValue ?? 0)
  };
};

// -------------------- BINANCE --------------------

export const fetchLongShortRatio = async (symbol: string, period: string): Promise<LsrData> => {
  const cleanSymbol = symbol.toUpperCase().endsWith('USDT') ? symbol.toUpperCase() : `${symbol.toUpperCase()}USDT`;
  const cleanPeriod = period.toLowerCase();

  const binanceUrl = `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${cleanSymbol}&period=${cleanPeriod}&limit=1`;
  try {
    const res = await fetch(binanceUrl);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const p = data[0];
      return {
        lsr: isFinite(parseFloat(p.longShortRatio)) ? parseFloat(p.longShortRatio) : null,
        longs: isFinite(parseFloat(p.longAccount)) ? parseFloat(p.longAccount) * 100 : null,
        shorts: isFinite(parseFloat(p.shortAccount)) ? parseFloat(p.shortAccount) * 100 : null
      };
    }
  } catch (e) { }
  return { lsr: null, longs: null, shorts: null };
};

export const fetchGainersLosers = async (): Promise<any> => {
  const coins = await fetchTopCoins();
  if (!coins || coins.length === 0) return { gainers: [], losers: [] };

  const filtered = coins.filter(c => c && c.symbol && !isStablecoin(c.symbol));
  const sorted = [...filtered].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
  return { gainers: sorted.slice(0, 100), losers: [...sorted].reverse().slice(0, 100) };
};

export const fetchOrderBook = async (symbol: string): Promise<OrderBookData | null> => {
  const url = `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=20`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data && data.bids && data.asks) {
      return {
        bids: data.bids.map((b: any) => ({ price: b[0], qty: b[1] })),
        asks: data.asks.map((a: any) => ({ price: a[0], qty: a[1] }))
      };
    }
  } catch (e) { }
  return null;
};

// -------------------- MARKETCAP HIST --------------------

export const fetchMarketCapHistory = async (): Promise<any | null> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.mktcapHist));
  return data;
};
