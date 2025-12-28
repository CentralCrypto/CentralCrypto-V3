import { ApiCoin } from '../types';
import { httpGetJson } from './http';
import { getCacheckoUrl, ENDPOINTS } from './endpoints';

const STABLECOINS = ['USDT', 'USDC', 'DAI', 'FDUSD', 'TUSD', 'USDD', 'PYUSD', 'USDE', 'GUSD', 'USDP', 'BUSD'];

/**
 * Common fetch with fallback and cache busting
 */
// Added fetchWithFallback implementation to fix missing name error
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
        if (Array.isArray(data.data)) coins = data.data;
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

export interface EconEvent { date: string; title: string; country: string; impact: string; previous?: string; forecast?: string; }

export interface OrderBookData { bids: { price: string; qty: string }[]; asks: { price: string; qty: string }[]; }

export interface FngData { 
    value: string; 
    timestamp: string; 
    value_classification?: string;
    value_classification_i18n?: { pt: string; en: string; es: string; };
}

// Added TrumpData interface to fix missing name error
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

/**
 * Fetches and processes Trump impact data with guid mapping
 */
// Applied updated fetchTrumpData part logic and fixed missing name errors
export const fetchTrumpData = async (): Promise<TrumpData | null> => {
    const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.trump));
    if (!data) return null;
    const root = Array.isArray(data) ? data[0] : data;
    // Map guid to link as requested
    return {
        ...root,
        link: root.guid || root.link
    };
};

export const fetchFearAndGreed = async (): Promise<FngData[]> => {
    const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.fng));
    if (!data) return [];
    const root = Array.isArray(data) ? (data[0]?.data || data) : (data.data || []);
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
    const [btc, eth] = await Promise.all([
        fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.etfBtc)),
        fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.etfEth))
    ]);
    if (!btc && !eth) return null;
    return { btcValue: btc?.net_flow || 0, ethValue: eth?.net_flow || 0, timestamp: btc?.timestamp || eth?.timestamp || Date.now(), chartDataBTC: btc?.history || [], chartDataETH: eth?.history || [], history: btc?.aggregates || { lastWeek: 0, lastMonth: 0, last90d: 0 }, solValue: btc?.sol_net_flow || 0, xrpValue: btc?.xrp_net_flow || 0 };
};

export const fetchLongShortRatio = async (symbol: string, period: string): Promise<LsrData> => {
    const binanceUrl = `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=1`;
    try {
        const response = await fetch(binanceUrl);
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
            const point = data[0];
            return { lsr: parseFloat(point.longShortRatio), longs: parseFloat(point.longAccount) * 100, shorts: parseFloat(point.shortAccount) * 100 };
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
            return { bids: data.bids.map((b: any) => ({ price: b[0], qty: b[1] })), asks: data.asks.map((a: any) => ({ price: a[0], qty: a[1] })) };
        }
    } catch (e) {}
    return null;
};