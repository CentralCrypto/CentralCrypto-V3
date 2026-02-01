
import { ApiCoin } from '../types';
import { httpGetJson } from './http';
import { getCacheckoUrl, ENDPOINTS } from './endpoints';

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
 * Helper: Tenta extrair um array de dados de qualquer estrutura JSON
 */
function extractDataArray(raw: any): any[] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    if (raw.length === 0) return [];
    const first = raw[0];
    if (first && typeof first === 'object') {
      if (first.data?.heatmap?.items && Array.isArray(first.data.heatmap.items)) {
        return first.data.heatmap.items;
      }
      if (Array.isArray(first.data)) {
        return first.data;
      }
      if (first.data && Array.isArray(first.data.data)) {
        return first.data.data;
      }
      if (Array.isArray(first.daily)) {
        return first.daily;
      }
    }
    return raw;
  }

  if (typeof raw === 'object') {
    if (raw.daily && Array.isArray(raw.daily)) return raw.daily; // ETF Standard format
    if (raw.data?.heatmap?.items && Array.isArray(raw.data.heatmap.items)) return raw.data.heatmap.items;
    if (Array.isArray(raw.data)) return raw.data;
    if (Array.isArray(raw.items)) return raw.items;

    const keys = Object.keys(raw);
    for (const key of keys) {
      if (Array.isArray((raw as any)[key]) && (raw as any)[key].length > 0) return (raw as any)[key];
    }
  }

  return [];
}

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

export interface LsrData { lsr: number | null; longs: number | null; shorts: number | null; exchange?: string; }

export interface MacdAvgData { averageMacd: number; averageNMacd: number; bullishPercentage: number; bearishPercentage: number; yesterday: number; days7Ago: number; days30Ago: number; yesterdayNMacd: number; }

export interface MacdTrackerPoint {
  id?: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
  logo?: string;
  macd: Record<string, { nmacd: number; macd: number; histogram: number; signalLine: number; }>;
  signal?: Record<string, number>;
  histogram?: Record<string, number>;
  macdNorm?: number;
}

export interface RsiAvgData { averageRsi: number; yesterday: number; days7Ago: number; days30Ago: number; days90Ago?: number; }

export interface RsiTrackerPoint {
  id: string;
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

export interface MacdTablePageResult {
  items: MacdTrackerPoint[];
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
  return Array.isArray((data as any)?.history) ? ((data as any).history as AltSeasonHistoryPoint[]) : [];
};

export const fetchTrumpData = async (): Promise<TrumpData | null> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.trump));
  if (!data) return null;
  return Array.isArray(data) ? data[0] : data;
};

export const fetchFearAndGreed = async (): Promise<FngData[]> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.fng));
  const items = extractDataArray(data);
  return Array.isArray(items) ? items : [];
};

// -------------------- RSI --------------------

export const fetchRsiAverage = async (): Promise<RsiAvgData | null> => {
  const raw = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.rsiAvg));
  if (!raw) return null;

  const root = Array.isArray(raw) ? raw[0] : raw;
  const dataNode = (root as any)?.data || root;
  const overall = (dataNode as any)?.overall || dataNode;

  return {
    averageRsi: safeNum((overall as any)?.averageRsi, 50),
    yesterday: safeNum((overall as any)?.yesterday, 50),
    days7Ago: safeNum((overall as any)?.days7Ago, 50),
    days30Ago: safeNum((overall as any)?.days30Ago, 50),
    days90Ago: Number.isFinite(Number((overall as any)?.days90Ago)) ? Number((overall as any)?.days90Ago) : undefined
  };
};

// --- SCATTER CHART DATA (RSI TRACKER) ---
export const fetchRsiTrackerHist = async (): Promise<RsiTrackerPoint[]> => {
  const raw = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.rsiTrackerHist));
  const items = extractDataArray(raw);

  if (!items.length) return [];

  return items.map((p: any) => {
    const rsiNode = p.rsiOverall || p.rsi || {};
    const symbol = String(p.symbol || p.s || '').toUpperCase();
    return {
      id: p.id || symbol.toLowerCase(),
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

export const fetchRsiTable = async (opts?: { force?: boolean; ttlMs?: number }): Promise<RsiTableItem[]> => {
  const now = Date.now();
  const force = Boolean(opts?.force);
  const ttlMs = typeof opts?.ttlMs === 'number' && isFinite(opts.ttlMs) ? opts!.ttlMs! : RSI_TABLE_TTL_MS;

  if (!force && rsiTableCache.length > 0 && (now - rsiTableCacheTs) < ttlMs) return rsiTableCache;
  if (!force && rsiTableInFlight) return rsiTableInFlight;

  rsiTableInFlight = (async () => {
    let raw = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.rsiTable));
    let items = extractDataArray(raw);

    if (items.length === 0) {
      raw = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.rsiTrackerHist));
      items = extractDataArray(raw);
    }

    if (!items.length) {
      rsiTableCache = [];
      rsiTableCacheTs = Date.now();
      return rsiTableCache;
    }

    rsiTableCache = items.map((p: any) => {
      const symbol = String(p.symbol || '').toUpperCase();
      const rsiNode = p.rsiOverall || p.rsi || p.rsi_overall || p;

      return {
        id: String(p.id || symbol.toLowerCase() || ''),
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

  let filtered = all;
  if (q) {
    filtered = all.filter(i => {
      const sym = (i.symbol || '').toLowerCase();
      const nm = (i.name || '').toLowerCase();
      return sym.includes(q) || nm?.includes(q);
    });
  }

  const tf = tfKeyFromSort(sort);
  const sorted = [...filtered].sort((a, b) => {
    let av = 0;
    let bv = 0;

    if (tf) {
      av = safeNum((a as any).rsi?.[tf], 0);
      bv = safeNum((b as any).rsi?.[tf], 0);
    } else if (sort === 'marketCap') {
      av = safeNum((a as any).marketCap, 0);
      bv = safeNum((b as any).marketCap, 0);
    } else if (sort === 'volume24h') {
      av = safeNum((a as any).volume24h, 0);
      bv = safeNum((b as any).volume24h, 0);
    } else if (sort === 'price24h') {
      av = safeNum((a as any).change, 0);
      bv = safeNum((b as any).change, 0);
    } else if (sort === 'rank') {
      av = safeNum((a as any).rank, 0);
      bv = safeNum((b as any).rank, 0);
    } else {
      av = safeNum((a as any).rsi?.['4h'], 0);
      bv = safeNum((b as any).rsi?.['4h'], 0);
    }

    if (av === bv) {
      const am = safeNum((a as any).marketCap, 0);
      const bm = safeNum((b as any).marketCap, 0);
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

// -------------------- MACD --------------------

export const fetchMacdAverage = async (): Promise<MacdAvgData | null> => {
  const raw = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.macdAvg));
  if (!raw) return null;
  const root = Array.isArray(raw) ? raw[0] : raw;
  const d = (root as any)?.data?.overall || (root as any)?.data || root;

  return {
    averageMacd: safeNum((d as any).averageMacd, 0),
    averageNMacd: safeNum((d as any).averageNMacd, 0),
    bullishPercentage: safeNum((d as any).bullishPercentage, 50),
    bearishPercentage: safeNum((d as any).bearishPercentage, 50),
    yesterday: safeNum((d as any).yesterday, 0),
    days7Ago: safeNum((d as any).days7Ago, 0),
    days30Ago: safeNum((d as any).days30Ago, 0),
    yesterdayNMacd: safeNum((d as any).yesterdayNMacd, 0),
  };
};

export const fetchMacdTracker = async (opts?: { force?: boolean }): Promise<MacdTrackerPoint[]> => {
  const raw = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.macdTracker));
  const items = extractDataArray(raw);

  return items.map((i: any) => {
    const symbol = String(i.symbol || '').toUpperCase();
    const macdNode = i.macd || {};

    return {
      id: i.id || symbol.toLowerCase(),
      symbol,
      name: i.name || symbol,
      price: safeNum(i.price, 0),
      change24h: safeNum(i.price24h, 0),
      marketCap: safeNum(i.marketCap, 0),
      logo: i.image || i.logo || `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`,
      macd: {
        "15m": { nmacd: safeNum(macdNode.macd15m?.nmacd, 0), macd: safeNum(macdNode.macd15m?.macd, 0), histogram: safeNum(macdNode.macd15m?.histogram, 0), signalLine: safeNum(macdNode.macd15m?.signalLine, 0) },
        "1h": { nmacd: safeNum(macdNode.macd1h?.nmacd, 0), macd: safeNum(macdNode.macd1h?.macd, 0), histogram: safeNum(macdNode.macd1h?.histogram, 0), signalLine: safeNum(macdNode.macd1h?.signalLine, 0) },
        "4h": { nmacd: safeNum(macdNode.macd4h?.nmacd, 0), macd: safeNum(macdNode.macd4h?.macd, 0), histogram: safeNum(macdNode.macd4h?.histogram, 0), signalLine: safeNum(macdNode.macd4h?.signalLine, 0) },
        "24h": { nmacd: safeNum(macdNode.macd24h?.nmacd, 0), macd: safeNum(macdNode.macd24h?.macd, 0), histogram: safeNum(macdNode.macd24h?.histogram, 0), signalLine: safeNum(macdNode.macd24h?.signalLine, 0) },
        "7d": { nmacd: safeNum(macdNode.macd7d?.nmacd, 0), macd: safeNum(macdNode.macd7d?.macd, 0), histogram: safeNum(macdNode.macd7d?.histogram, 0), signalLine: safeNum(macdNode.macd7d?.signalLine, 0) },
      }
    };
  }).filter((x: any) => x.marketCap > 0);
};

export const fetchMacdTablePage = async (args: { page: number; limit: number; sort?: string; timeframe?: string; ascendingOrder?: boolean; filterText?: string; force?: boolean; }): Promise<MacdTablePageResult> => {
  const all = await fetchMacdTracker({ force: args.force });
  const q = normalizeSearch(args.filterText || '');
  let filtered = all;
  if (q) filtered = all.filter(i => i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));

  const tf = (args.timeframe || '4h') as '15m' | '1h' | '4h' | '24h' | '7d';
  const sort = args.sort || 'marketCap';
  const asc = args.ascendingOrder;

  const sorted = [...filtered].sort((a, b) => {
    let av = 0, bv = 0;
    if (sort === 'nmacd') { av = a.macd?.[tf]?.nmacd ?? 0; bv = b.macd?.[tf]?.nmacd ?? 0; }
    else if (sort === 'macd') { av = a.macd?.[tf]?.macd ?? 0; bv = b.macd?.[tf]?.macd ?? 0; }
    else if (sort === 'change24h') { av = a.change24h; bv = b.change24h; }
    else { av = a.marketCap; bv = b.marketCap; }
    return asc ? (av - bv) : (bv - av);
  });

  const limit = Math.max(1, args.limit);
  const totalItems = sorted.length;
  const totalPages = Math.ceil(totalItems / limit);
  const page = Math.min(Math.max(1, args.page), totalPages);
  const start = (page - 1) * limit;

  return { items: sorted.slice(start, start + limit), page, totalPages, totalItems };
};

// -------------------- ECON --------------------

export const fetchEconomicCalendar = async (): Promise<EconEvent[]> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.calendar));
  return Array.isArray(data) ? data : [];
};

// -------------------- ETF --------------------

// Simple fetch for summary widget
export const fetchEtfFlow = async (): Promise<EtfFlowData | null> => {
  try {
    const summaryRaw = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.etfNetFlow));
    if (!summaryRaw) return null;

    const root = Array.isArray(summaryRaw) ? summaryRaw[0] : summaryRaw;
    const data = (root && typeof root === 'object' && (root as any).data) ? (root as any).data : root;
    const status = (root && typeof root === 'object' && (root as any).status) ? (root as any).status : null;

    return {
      btcValue: Number((data as any)?.totalBtcValue ?? (data as any)?.btcValue ?? 0),
      ethValue: Number((data as any)?.totalEthValue ?? (data as any)?.ethValue ?? 0),
      netFlow: Number((data as any)?.total ?? (data as any)?.netFlow ?? 0),
      timestamp: status?.timestamp ? new Date(status.timestamp).getTime() : Date.now(),
      chartDataBTC: [],
      chartDataETH: [],
      history: (data as any)?.history || { lastWeek: 0, lastMonth: 0, last90d: 0 },
      solValue: Number((data as any)?.solValue ?? 0),
      xrpValue: Number((data as any)?.xrpValue ?? 0)
    };
  } catch (e) {
    console.error("Error fetching ETF data", e);
    return null;
  }
};

type EtfAsset = 'BTC' | 'ETH' | 'SOL' | 'XRP' | 'DOGE' | 'LTC';
type EtfMetric = 'flows' | 'volume';

const resolveEtfEndpoint = (asset: EtfAsset, metric: EtfMetric): string | null => {
  const filesObj = (ENDPOINTS as any)?.cachecko?.files ?? (ENDPOINTS as any)?.cachecko?.files ?? (ENDPOINTS as any)?.cachecko?.files;

  const obj = filesObj || (ENDPOINTS as any)?.cachecko?.files || (ENDPOINTS as any)?.cachecko?.files || {};
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = (obj as any)?.[k];
      if (typeof v === 'string' && v.trim()) return v;
    }
    return null;
  };

  if (asset === 'BTC') return metric === 'flows'
    ? pick('etfBtcFlows')
    : (pick('etfBtcVolume', 'etfBtcVolumes') || 'spot-btc-etf-volumes.json');

  if (asset === 'ETH') return metric === 'flows'
    ? pick('etfEthFlows')
    : (pick('etfEthVolume', 'etfEthVolumes') || 'spot-eth-etf-volumes.json');

  if (asset === 'SOL') return metric === 'flows'
    ? pick('etfSolFlows')
    : pick('etfSolVolume', 'etfSolVolumes');

  if (asset === 'XRP') return metric === 'flows'
    ? pick('etfXrpFlows')
    : pick('etfXrpVolume', 'etfXrpVolumes');

  if (asset === 'DOGE') return metric === 'volume'
    ? (pick('etfDogeVolume', 'etfDogeVolumes') || 'spot-doge-etf-volumes.json')
    : null;

  if (asset === 'LTC') return metric === 'volume'
    ? (pick('etfLtcVolume', 'etfLtcVolumes') || 'spot-ltc-etf-volumes.json')
    : null;

  return null;
};

// Processador seguro de data - CORRIGIDO PARA DETECTAR SEGUNDOS VS MS
const processChartDate = (dateInput: string | number) => {
  if (!dateInput) return 0;

  // Se for número
  if (typeof dateInput === 'number') {
    if (dateInput < 10000000000) {
      return dateInput * 1000;
    }
    return dateInput;
  }

  // Se for string
  const date = new Date(dateInput);
  return !isNaN(date.getTime()) ? date.getTime() : 0;
};

// Helpers para “desembrulhar” JSONs do TheBlock/TBStat/cache n8n
const tryJsonParse = (v: any): any => {
  if (typeof v !== 'string') return v;
  const s = v.trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

const unwrapPossibleDataNode = (raw: any): any => {
  if (!raw) return null;

  // Caso: [{ slug, data: "{...}" }]
  if (Array.isArray(raw) && raw.length > 0 && raw[0] && typeof raw[0] === 'object') {
    const first = raw[0] as any;
    const cand =
      first.data ??
      first.jsonFile?.data ??
      first.data?.jsonFile?.data ??
      null;

    const parsed = tryJsonParse(cand);
    return parsed ?? cand ?? first;
  }

  // Caso: { data: "{...}" } ou { jsonFile: { data: "{...}" } }
  if (raw && typeof raw === 'object') {
    const cand =
      (raw as any).data ??
      (raw as any).jsonFile?.data ??
      (raw as any).jsonFile ??
      null;

    const parsed = tryJsonParse(cand);
    return parsed ?? cand ?? raw;
  }

  // Caso: string direta
  const parsed = tryJsonParse(raw);
  return parsed ?? raw;
};

// Converte TBStat Series -> daily[]
const seriesToDaily = (seriesObj: any): any[] => {
  if (!seriesObj || typeof seriesObj !== 'object') return [];

  const byTs: Record<number, { timestamp: number; totalGlobal: number; perEtf: Record<string, number> }> = {};

  Object.keys(seriesObj).forEach((ticker) => {
    const node = seriesObj[ticker];
    const arr = node?.Data;
    if (!Array.isArray(arr)) return;

    arr.forEach((p: any) => {
      const tsSec = Number(p?.Timestamp);
      const val = Number(p?.Result);
      if (!Number.isFinite(tsSec) || !Number.isFinite(val)) return;

      if (!byTs[tsSec]) {
        byTs[tsSec] = { timestamp: tsSec, totalGlobal: 0, perEtf: {} };
      }
      byTs[tsSec].perEtf[ticker] = val;
      byTs[tsSec].totalGlobal += val;
    });
  });

  return Object.values(byTs).sort((a, b) => a.timestamp - b.timestamp);
};

/**
 * Ajuste: agora anexamos `__etfs` no array retornado para o widget conseguir
 * uma lista consistente de tickers detectados.
 */
export const fetchEtfDetailed = async (asset: EtfAsset, metric: EtfMetric): Promise<any[]> => {
  const endpoint = resolveEtfEndpoint(asset, metric);
  if (!endpoint) return [];

  const raw = await fetchWithFallback(getCacheckoUrl(endpoint));
  if (!raw) return [];

  const unwrapped = unwrapPossibleDataNode(raw);

  let dailyData: any[] = [];

  if (unwrapped?.daily && Array.isArray(unwrapped.daily)) {
    dailyData = unwrapped.daily;
  } else if (unwrapped?.data?.daily && Array.isArray(unwrapped.data.daily)) {
    dailyData = unwrapped.data.daily;
  } else if (Array.isArray(unwrapped)) {
    dailyData = unwrapped;
  }

  if (dailyData.length === 0) {
    const seriesObj =
      unwrapped?.Series ??
      unwrapped?.jsonFile?.Series ??
      unwrapped?.data?.Series ??
      null;

    if (seriesObj && typeof seriesObj === 'object') {
      dailyData = seriesToDaily(seriesObj);
    }
  }

  if (!Array.isArray(dailyData) || dailyData.length === 0) return [];

  const mapped = dailyData.map((d: any) => {
    const tsIn =
      d.timestamp ??
      d.Timestamp ??
      d.date ??
      d.Date ??
      null;

    const timestamp = processChartDate(tsIn as any);

    const flatPoint: any = {
      date: timestamp,
      totalGlobal: Number(d.totalGlobal ?? d.total ?? 0)
    };

    const per =
      (d.perEtf && typeof d.perEtf === 'object') ? d.perEtf :
      (d.etfs && typeof d.etfs === 'object') ? d.etfs :
      (d.ETFs && typeof d.ETFs === 'object') ? d.ETFs :
      null;

    if (per) {
      let sum = 0;
      Object.keys(per).forEach(ticker => {
        const val = Number(per[ticker]);
        const n = Number.isFinite(val) ? val : 0;
        flatPoint[ticker] = n;
        sum += n;
      });
      if (!Number.isFinite(flatPoint.totalGlobal) || flatPoint.totalGlobal === 0) {
        flatPoint.totalGlobal = sum;
      }
    }

    return flatPoint;
  }).filter((p: any) => Number.isFinite(p.date) && p.date > 0).sort((a: any, b: any) => a.date - b.date);

  // ---- anexa __etfs ----
  const tickers = new Set<string>();
  for (const row of mapped) {
    Object.keys(row || {}).forEach(k => {
      if (k !== 'date' && k !== 'totalGlobal' && k !== 'timestamp') tickers.add(k);
    });
  }
  (mapped as any).__etfs = Array.from(tickers);

  return mapped;
};

// -------------------- BINANCE & EXCHANGES LSR --------------------

// Modificado para suportar múltiplas exchanges
export const fetchLongShortRatio = async (symbol: string, period: string, exchange: string = 'Binance'): Promise<LsrData> => {
  const cleanSymbol = symbol.toUpperCase().endsWith('USDT') ? symbol.toUpperCase() : `${symbol.toUpperCase()}USDT`;
  const cleanPeriod = period.toLowerCase();

  try {
    if (exchange === 'Binance') {
      const binanceUrl = `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${cleanSymbol}&period=${cleanPeriod}&limit=1`;
      const res = await fetch(binanceUrl);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const p = data[0];
        return {
          exchange,
          lsr: isFinite(parseFloat(p.longShortRatio)) ? parseFloat(p.longShortRatio) : null,
          longs: isFinite(parseFloat(p.longAccount)) ? parseFloat(p.longAccount) * 100 : null,
          shorts: isFinite(parseFloat(p.shortAccount)) ? parseFloat(p.shortAccount) * 100 : null
        };
      }
    }
    else if (exchange === 'Bybit') {
      let bbPeriod = cleanPeriod;
      if (bbPeriod === '1d') bbPeriod = '1d';
      else if (bbPeriod === '5m') bbPeriod = '5min';
      else if (bbPeriod === '15m') bbPeriod = '15min';
      else if (bbPeriod === '30m') bbPeriod = '30min';
      else if (bbPeriod === '1h') bbPeriod = '1h';
      else if (bbPeriod === '4h') bbPeriod = '4h';

      const url = `https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=${cleanSymbol}&period=${bbPeriod}&limit=1`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.retCode === 0 && json.result && json.result.list && json.result.list.length > 0) {
        const item = json.result.list[0];
        return {
          exchange,
          lsr: parseFloat(item.ratio),
          longs: parseFloat(item.buyRatio) * 100,
          shorts: parseFloat(item.sellRatio) * 100
        };
      }
    }
    else if (exchange === 'OKX') {
      const instId = cleanSymbol.replace('USDT', '-USDT-SWAP');
      let okPeriod = cleanPeriod.toUpperCase();
      const url = `https://www.okx.com/api/v5/rubik/stat/taker-long-short-ratio?instId=${instId}&period=${okPeriod}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.code === '0' && json.data && json.data.length > 0) {
        const item = json.data[0];
        const ratio = parseFloat(item.buySellRatio);
        return {
          exchange,
          lsr: ratio,
          longs: null,
          shorts: null
        };
      }
    }
    else if (exchange === 'Mexc') {
      return { lsr: null, longs: null, shorts: null, exchange };
    }

  } catch (e) {
    console.warn(`LSR fetch failed for ${exchange}`, e);
  }
  return { lsr: null, longs: null, shorts: null, exchange };
};

export const fetchGainersLosers = async (): Promise<any> => {
  const coins = await fetchTopCoins();
  if (!coins || coins.length === 0) return { gainers: [], losers: [] };

  const filtered = coins.filter(c => c && (c as any).symbol && !isStablecoin((c as any).symbol));
  const sorted = [...filtered].sort((a: any, b: any) => ((b as any).price_change_percentage_24h || 0) - ((a as any).price_change_percentage_24h || 0));
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
