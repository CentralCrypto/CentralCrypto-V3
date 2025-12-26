
import { ApiCoin, HeatmapCrypto } from '../../../types';
import { httpGetJson } from '../../../services/http';

const PRIMARY_API_URL = 'https://centralcrypto.com.br/cachecko/cachecko.json';
const FNG_URL_PRIMARY = 'https://centralcrypto.com.br/cachecko/fearandgreed_data.json';
const RSI_AVG_URL = 'https://centralcrypto.com.br/cachecko/rsiavg.json';
const RSI_TRACKER_URL = 'https://centralcrypto.com.br/cachecko/rsitrackerhist.json';
const MACD_AVG_URL = 'https://centralcrypto.com.br/cachecko/macdavg.json';
const MACD_TRACKER_URL = 'https://centralcrypto.com.br/cachecko/macdtracker.json';
const TRUMP_URL = 'https://centralcrypto.com.br/cachecko/trumpometer.json';
const ALTSEASON_URL = 'https://centralcrypto.com.br/cachecko/altcoinseasonindex.json';
const MKTCAP_HISTORY_URL = 'https://centralcrypto.com.br/cachecko/mktcap-historico.json';
const CALENDAR_URL = 'https://centralcrypto.com.br/cachecko/calendar.json';
const HEATMAP_URL = 'https://centralcrypto.com.br/cachecko/heatmap.json';
const ETF_BTC_FLOWS_URL = 'https://centralcrypto.com.br/cachecko/spot-btc-etf-flows.json';
const ETF_ETH_FLOWS_URL = 'https://centralcrypto.com.br/cachecko/spot-eth-etf-flows.json';

const STABLECOINS = ['USDT', 'USDC', 'DAI', 'FDUSD', 'TUSD', 'USDD', 'PYUSD', 'USDE', 'GUSD', 'USDP', 'BUSD'];

/**
 * Fetch veloz com salt de 1 hora.
 * Migrado para httpGetJson para usar o novo wrapper sênior com timeouts reais.
 */
export const fetchWithFallback = async (url: string): Promise<any | null> => {
    const isWordPress = url.includes('/wp-json/');
    
    // Salt que muda a cada hora para cache eficiente
    const salt = `cache_h=${Math.floor(Date.now() / 3600000)}`;
    const finalUrl = url.includes('?') ? `${url}&${salt}` : `${url}?${salt}`;

    try {
        const { data } = await httpGetJson(finalUrl, { 
            timeoutMs: isWordPress ? 3000 : 8000 
        });
        return data;
    } catch (e: any) {
        console.warn(`[API] fetchWithFallback direct failed: ${url} -> ${e.message}`);
    }

    // Proxy Fallback apenas para APIs não-WP se falhar direto
    if (!isWordPress) {
        try {
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(finalUrl)}`;
            const { data } = await httpGetJson(proxyUrl, { timeoutMs: 12000 });
            return data;
        } catch (e) {}
    }
    
    return null;
};

export const isStablecoin = (symbol: string) => STABLECOINS.includes(symbol.toUpperCase());

export const fetchTopCoins = async (): Promise<ApiCoin[]> => {
    const data = await fetchWithFallback(PRIMARY_API_URL);
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
export interface FngData { value: string; timestamp: string; }
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
    const url = `https://centralcrypto.com.br/cachecko/news.php?symbol=${symbol}&name=${name}`;
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
    const data = await fetchWithFallback(binanceUrl);
    if (Array.isArray(data) && data.length > 0) {
        const point = data[0];
        return { lsr: parseFloat(point.longShortRatio), longs: parseFloat(point.longAccount) * 100, shorts: parseFloat(point.shortAccount) * 100 };
    }
    return { lsr: null, longs: null, shorts: null };
};

export const fetchFearAndGreed = async (): Promise<FngData[]> => {
    const data = await fetchWithFallback(FNG_URL_PRIMARY);
    if (Array.isArray(data)) return data;
    if (data && data.data && Array.isArray(data.data)) return data.data;
    return [];
};

export const fetchRsiAverage = async (): Promise<RsiAvgData | null> => fetchWithFallback(RSI_AVG_URL);
export const fetchRsiTracker = async (): Promise<RsiTrackerPoint[]> => {
    const data = await fetchWithFallback(RSI_TRACKER_URL);
    return Array.isArray(data) ? data : [];
};
export const fetchMacdAverage = async (): Promise<MacdAvgData | null> => fetchWithFallback(MACD_AVG_URL);
export const fetchMacdTracker = async (): Promise<MacdTrackerPoint[]> => {
    const data = await fetchWithFallback(MACD_TRACKER_URL);
    return Array.isArray(data) ? data : [];
};
export const fetchTrumpData = async (): Promise<TrumpData | null> => fetchWithFallback(TRUMP_URL);
export const fetchAltcoinSeason = async (): Promise<AltSeasonData | null> => fetchWithFallback(ALTSEASON_URL);
export const fetchAltcoinSeasonHistory = async (): Promise<any[]> => {
    const data = await fetchWithFallback(ALTSEASON_URL);
    if (data && !Array.isArray(data) && data.history) return data.history;
    return Array.isArray(data) ? data : [];
};
export const fetchMarketCapHistory = async (): Promise<MktCapHistoryData | null> => fetchWithFallback(MKTCAP_HISTORY_URL);
export const fetchEconomicCalendar = async (): Promise<EconEvent[]> => {
    const data = await fetchWithFallback(CALENDAR_URL);
    return Array.isArray(data) ? data : [];
};
export const fetchEtfFlow = async (): Promise<EtfFlowData | null> => {
    const [btc, eth] = await Promise.all([fetchWithFallback(ETF_BTC_FLOWS_URL), fetchWithFallback(ETF_ETH_FLOWS_URL)]);
    if (!btc && !eth) return null;
    return { btcValue: btc?.net_flow || 0, ethValue: eth?.net_flow || 0, timestamp: btc?.timestamp || eth?.timestamp || Date.now(), chartDataBTC: btc?.history || [], chartDataETH: eth?.history || [], history: btc?.aggregates || { lastWeek: 0, lastMonth: 0, last90d: 0 }, solValue: btc?.sol_net_flow || 0, xrpValue: btc?.xrp_net_flow || 0 };
};

export const fetchOrderBook = async (symbol: string): Promise<OrderBookData | null> => {
    const url = `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=20`;
    try {
        const { data } = await httpGetJson(url);
        return data;
    } catch (e) {}
    return null;
};
