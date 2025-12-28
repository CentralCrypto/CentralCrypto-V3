import { ApiCoin } from '../types';
import { httpGetJson } from './http';
import { getCacheckoUrl, ENDPOINTS } from './endpoints';

const STABLECOINS = ['USDT', 'USDC', 'DAI', 'FDUSD', 'TUSD', 'USDD', 'PYUSD', 'USDE', 'GUSD', 'USDP', 'BUSD'];

const DEFAULT_FETCH_TIMEOUT_MS = 10000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch JSON de forma segura:
 * - Timeout (AbortController)
 * - Lê text() e só faz JSON.parse se houver conteúdo
 * - Nunca explode com "Unexpected end of JSON input"
 */
async function safeFetchJson<T = any>(
  url: string,
  opts?: { timeoutMs?: number; retries?: number; retryDelayMs?: number; headers?: Record<string, string> }
): Promise<{ ok: boolean; status: number; data: T | null; text: string }> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const retries = opts?.retries ?? 0;
  const retryDelayMs = opts?.retryDelayMs ?? 350;

  let lastErr: any = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json,text/plain,*/*',
          ...(opts?.headers || {}),
        },
        signal: controller.signal,
      });

      const status = response.status;
      const ok = response.ok;

      let text = '';
      try {
        text = await response.text();
      } catch (e) {
        text = '';
      }

      if (!text || !text.trim()) {
        return { ok, status, data: null, text: '' };
      }

      // tenta parsear JSON; se falhar, devolve null e mantém o text pra log/debug
      try {
        const data = JSON.parse(text) as T;
        return { ok, status, data, text };
      } catch (e) {
        console.warn(`[API] Resposta não-JSON ou truncada em ${url} (status ${status}). Ignorando parse.`, {
          sample: text.slice(0, 200),
        });
        return { ok, status, data: null, text };
      }
    } catch (e: any) {
      lastErr = e;

      // retry somente se ainda tiver tentativas
      if (attempt < retries) {
        await sleep(retryDelayMs);
        continue;
      }

      // sem retry: retorna padrão seguro
      console.warn(`[API] safeFetchJson falhou em ${url}:`, e);
      return { ok: false, status: 0, data: null, text: '' };
    } finally {
      clearTimeout(timer);
    }
  }

  console.warn(`[API] safeFetchJson falhou (sem retorno) em ${url}:`, lastErr);
  return { ok: false, status: 0, data: null, text: '' };
}

/**
 * Common fetch with fallback and cache busting
 */
export const fetchWithFallback = async (url: string): Promise<any | null> => {
  try {
    const salt = Math.floor(Date.now() / 60000);
    const finalUrl = url.includes('?') ? `${url}&_cb=${salt}` : `${url}?_cb=${salt}`;
    const { data } = await httpGetJson(finalUrl, { timeoutMs: 10000, retries: 2 });
    return data;
  } catch (e) {
    console.error(`[API] Erro ao buscar ${url}:`, e);
  }
  return null;
};

export const isStablecoin = (symbol: string) => STABLECOINS.includes(symbol.toUpperCase());

export const fetchTopCoins = async (): Promise<ApiCoin[]> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.main));
  if (!data) return [];

  let coins: any[] = [];

  if (Array.isArray(data)) {
    const subData = data.find(item => item && Array.isArray(item.data));
    if (subData) coins = subData.data;
    else if (data[0] && Array.isArray(data[0])) coins = data[0];
    else coins = data;
  } else if (data && typeof data === 'object') {
    if (Array.isArray((data as any).data)) coins = (data as any).data;
    else {
      const foundArray = Object.values(data).find(v => Array.isArray(v) && v.length > 10);
      if (foundArray) coins = foundArray as any[];
    }
  }

  return Array.isArray(coins) ? coins : [];
};

export interface NewsItem { title: string; link: string; pubDate: string; source: string; description: string; thumbnail: string; }

export interface EtfFlowData {
  btcValue: number;
  ethValue: number;
  netFlow: number;
  timestamp: number;
  points?: any[];
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

export interface EconEvent { date: string; title: string; country: string; impact: string; previous?: string; forecast?: string; }

export interface OrderBookData { bids: { price: string; qty: string }[]; asks: { price: string; qty: string }[]; }

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
  guid?: string;
}

export interface AltSeasonHistoryPoint { timestamp: number; altcoinIndex: number; altcoinMarketcap: number; }

export interface AltSeasonData { index: number; yesterday: number; lastWeek: number; lastMonth: number; history?: AltSeasonHistoryPoint[]; }

export const fetchCryptoNews = async (symbol: string, coinName: string): Promise<NewsItem[]> => {
  const url = getCacheckoUrl(ENDPOINTS.cachecko.files.news);
  const finalUrl = `${url}?s=${symbol}&n=${encodeURIComponent(coinName)}`;
  const data = await fetchWithFallback(finalUrl);
  return Array.isArray(data) ? data : [];
};

export const fetchAltcoinSeason = async (): Promise<AltSeasonData | null> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.altseason));
  if (!data) return null;
  return Array.isArray(data) ? data[0] : data;
};

export const fetchAltcoinSeasonHistory = async (): Promise<AltSeasonHistoryPoint[]> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.altseason));
  if (!data) return [];
  const root = Array.isArray(data) ? data[0] : data;
  return Array.isArray(root.history) ? root.history : [];
};

export const fetchTrumpData = async (): Promise<TrumpData | null> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.trump));
  if (!data) return null;
  const root = Array.isArray(data) ? data[0] : data;
  return {
    ...root,
    link: (root as any).guid || (root as any).link
  };
};

export const fetchFearAndGreed = async (): Promise<FngData[]> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.fng));
  if (!data) return [];
  const root = Array.isArray(data) ? ((data as any)[0]?.data || data) : ((data as any).data || []);
  return Array.isArray(root) ? root : [];
};

export const fetchRsiAverage = async (): Promise<RsiAvgData | null> => fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.rsiAvg));

export const fetchRsiTracker = async (): Promise<RsiTrackerPoint[]> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.rsiTracker));
  return Array.isArray(data) ? data : [];
};

export const fetchMacdAverage = async (): Promise<MacdAvgData | null> => fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.macdAvg));

export const fetchMacdTracker = async (): Promise<MacdTrackerPoint[]> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.macdTracker));
  return Array.isArray(data) ? data : [];
};

export const fetchMarketCapHistory = async (): Promise<any | null> => fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.mktcapHist));

export const fetchEconomicCalendar = async (): Promise<EconEvent[]> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.calendar));
  return Array.isArray(data) ? data : [];
};

export const fetchEtfFlow = async (): Promise<EtfFlowData | null> => {
  const res = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.etfNetFlow));
  if (!res) return null;

  // O JSON é retornado dentro de uma array [ { data: { ... }, status: { ... } } ]
  const root = Array.isArray(res) ? res[0] : res;
  if (!root || !root.data) return null;

  return {
    btcValue: root.data.totalBtcValue || 0,
    ethValue: root.data.totalEthValue || 0,
    netFlow: root.data.total || 0,
    timestamp: root.status?.timestamp ? new Date(root.status.timestamp).getTime() : Date.now(),
    points: root.data.points || []
  };
};

export const fetchLongShortRatio = async (symbol: string, period: string): Promise<LsrData> => {
  const binanceUrl = `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=1`;

  try {
    const { ok, status, data } = await safeFetchJson<any>(binanceUrl, { timeoutMs: 8000, retries: 1 });

    if (!ok || !data) {
      // Sem JSON ou erro HTTP: devolve nulo sem quebrar
      if (status && status !== 200) console.warn(`[LSR] HTTP ${status} em ${binanceUrl}`);
      return { lsr: null, longs: null, shorts: null };
    }

    if (Array.isArray(data) && data.length > 0) {
      const point = data[0];
      const lsr = parseFloat(point.longShortRatio);
      const longs = parseFloat(point.longAccount) * 100;
      const shorts = parseFloat(point.shortAccount) * 100;

      return {
        lsr: Number.isFinite(lsr) ? lsr : null,
        longs: Number.isFinite(longs) ? longs : null,
        shorts: Number.isFinite(shorts) ? shorts : null
      };
    }
  } catch (e) {
    console.warn('[LSR] Erro inesperado:', e);
  }

  return { lsr: null, longs: null, shorts: null };
};

export const fetchGainersLosers = async (): Promise<any> => {
  const coins = await fetchTopCoins();
  if (!coins || coins.length === 0) return { gainers: [], losers: [] };

  const filtered = coins.filter(c => c && (c as any).symbol && !isStablecoin((c as any).symbol));
  const sorted = [...filtered].sort((a: any, b: any) => ((b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)));

  return { gainers: sorted.slice(0, 100), losers: [...sorted].reverse().slice(0, 100) };
};

export const fetchOrderBook = async (symbol: string): Promise<OrderBookData | null> => {
  const url = `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=20`;

  try {
    const { ok, status, data } = await safeFetchJson<any>(url, { timeoutMs: 8000, retries: 1 });

    if (!ok || !data) {
      if (status && status !== 200) console.warn(`[OrderBook] HTTP ${status} em ${url}`);
      return null;
    }

    if (data && data.bids && data.asks) {
      return {
        bids: data.bids.map((b: any) => ({ price: b[0], qty: b[1] })),
        asks: data.asks.map((a: any) => ({ price: a[0], qty: a[1] }))
      };
    }
  } catch (e) {
    console.warn('[OrderBook] Erro inesperado:', e);
  }

  return null;
};
