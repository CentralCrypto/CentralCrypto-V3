
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
    const { data } = await httpGetJson(finalUrl, { timeoutMs: 10000, retries: 2 });
    return data;
  } catch (e) {
    console.error(`[API] Erro ao buscar ${url}: `, (e as any).message || e);
  }
  return null;
};

export const isStablecoin = (symbol: string) => STABLECOINS.includes(symbol.toUpperCase());

/**
 * Cache + dedupe em memória (por aba).
 * Evita várias chamadas simultâneas ao mesmo JSON quando há muitos widgets.
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

export interface RsiAvgData { averageRsi: number; yesterday: number; days7Ago: number; days30Ago: number; }

export interface RsiTrackerPoint {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
  logo?: string;
  rsi: Record<string, number>;
  currentRsi?: number;
  lastRsi?: number;
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

export const fetchCryptoNews = async (symbol: string, coinName: string): Promise<NewsItem[]> => {
  const url = getCacheckoUrl(ENDPOINTS.cachecko.files.news);
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

export const fetchRsiAverage = async (): Promise<RsiAvgData | null> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.rsiAvg));
  return data || null;
};

export const fetchRsiTracker = async (): Promise<RsiTrackerPoint[]> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.rsiTracker));
  return Array.isArray(data) ? data : [];
};

export const fetchMacdAverage = async (): Promise<MacdAvgData | null> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.macdAvg));
  return data || null;
};

export const fetchMacdTracker = async (): Promise<MacdTrackerPoint[]> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.macdTracker));
  return Array.isArray(data) ? data : [];
};

export const fetchEconomicCalendar = async (): Promise<EconEvent[]> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.calendar));
  return Array.isArray(data) ? data : [];
};

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
  } catch (e) {}
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
  } catch (e) {}
  return null;
};
