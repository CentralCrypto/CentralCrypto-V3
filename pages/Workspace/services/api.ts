
import { ApiCoin } from '../../../types';
import { httpGetJson } from '../../../services/http';
import { getCacheckoUrl, ENDPOINTS } from '../../../services/endpoints';

const STABLECOINS = ['USDT', 'USDC', 'DAI', 'FDUSD', 'TUSD', 'USDD', 'PYUSD', 'USDE', 'GUSD', 'USDP', 'BUSD'];

/**
 * Engine de fetch para o Workspace com suporte a cache buster temporal
 */
export const fetchWithFallback = async (url: string): Promise<any | null> => {
    try {
        const salt = Math.floor(Date.now() / 60000);
        const finalUrl = url.includes('?') ? `${url}&_cb=${salt}` : `${url}?_cb=${salt}`;
        
        const { data } = await httpGetJson(finalUrl, { timeoutMs: 8000 });
        return data;
    } catch (e) {
        if (url.includes('.json') && typeof window !== 'undefined' && window.location.hostname !== 'centralcrypto.com.br') {
            try {
                const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url.startsWith('/') ? 'https://centralcrypto.com.br' + url : url)}`;
                const res = await fetch(proxyUrl);
                const json = await res.json();
                return JSON.parse(json.contents);
            } catch (proxyErr) {
                return null;
            }
        }
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
export interface FngData { 
    value: string; 
    timestamp: string; 
    // Fix: Added missing property to match usage in components
    value_classification?: string;
    value_classification_i18n?: {
        pt: string;
        en: string;
        es: string;
    };
}
export interface RsiAvgData { averageRsi: number; yesterday: number; days7Ago: number; days30Ago: number; }
export interface RsiTrackerPoint { symbol: string; rsi: Record<string, number>; currentRsi: number; lastRsi: number; volume24h: number; price: number; change24h: number; marketCap: number; logo: string; }
export interface MacdAvgData { averageMacd: number; yesterday: number; days7Ago: number; days30Ago: number; }
export interface MacdTrackerPoint { symbol: string; name: string; macd: Record<string, number>; signal: Record<string, number>; histogram: Record<string, number>; marketCap: number; volume24h: number; price: number; change24h: number; logo: string; }
export interface TrumpData { author_name: string; image_url: string; post_text: string; post_url: string; impact_value: number; impact_label: string; impact_color: string; impact_direction: string; impact_magnitude: string; }
export interface AltSeasonData { index: number; yesterday: number; lastWeek: number; lastMonth: number; }
export interface MktCapHistoryData { current: number; history: { date: number; value: number }[]; yesterday: number; lastWeek: number; lastMonth: number; }
export interface EconEvent { date: string; country: string; impact: string; title: string; previous: string; forecast: string; actual: string; time: string; }
export interface EtfFlowData { btcValue: number; ethValue: number; timestamp: number; chartDataBTC: any[]; chartDataETH: any[]; history: { lastWeek: number; lastMonth: number; last90d: number; }; solValue?: number; xrpValue?: number; }
export interface LsrData { lsr: number | null; longs: number | null; shorts: number | null; }
export interface OrderBookData { bids: { price: string; qty: string }[]; asks: { price: string; qty: string }[]; }

export const fetchCryptoNews = async (symbol: string, name: string): Promise<NewsItem[]> => {
    const url = `${getCacheckoUrl(ENDPOINTS.cachecko.files.news)}?symbol=${symbol}&name=${name}`;
    const data = await fetchWithFallback(url);
    return Array.isArray(data) ? data : [];
};

export const fetchGainersLosers = async (): Promise<any> => {
    const coins = await fetchTopCoins();
    if (!coins || coins.length === 0) return { gainers: [], losers: [] };
    const filtered = coins.filter(c => c && c.symbol && !isStablecoin(c.symbol));
    const sorted = [...filtered].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
    return { gainers: sorted.slice(0, 100), losers: [...sorted].reverse().slice(0, 100) };
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

export const fetchFearAndGreed = async (): Promise<FngData[]> => {
    const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.fng));
    // Suporte para a estrutura específica do JSON Cachecko fornecida pelo usuário
    if (Array.isArray(data)) {
        if (data[0] && data[0].data && Array.isArray(data[0].data)) {
            return data[0].data;
        }
        return data;
    }
    if (data && data.data && Array.isArray(data.data)) return data.data;
    return [];
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
export const fetchTrumpData = async (): Promise<TrumpData | null> => fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.trump));
export const fetchAltcoinSeason = async (): Promise<AltSeasonData | null> => fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.altseason));
export const fetchAltcoinSeasonHistory = async (): Promise<any[]> => {
    const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.altseason));
    if (data && !Array.isArray(data) && data.history) return data.history;
    return Array.isArray(data) ? data : [];
};
export const fetchMarketCapHistory = async (): Promise<MktCapHistoryData | null> => fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.mktcapHist));
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

export const fetchOrderBook = async (symbol: string): Promise<OrderBookData | null> => {
    const url = `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=20`;
    try {
        const response = await fetch(url);
        return await response.json();
    } catch (e) {}
    return null;
};
