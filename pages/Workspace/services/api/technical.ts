
import { fetchWithFallback } from './utils';

// URLs Técnicas
const RSI_AVG_URL = 'https://centralcrypto.com.br/cachecko/rsiavg.json';
const RSI_TRACKER_URL = 'https://centralcrypto.com.br/cachecko/rsitrackerhist.json';
const MACD_AVG_URL = 'https://centralcrypto.com.br/cachecko/macdavg.json';
const MACD_TRACKER_URL = 'https://centralcrypto.com.br/cachecko/macdtracker.json';

export interface RsiAvgData { averageRsi: number; yesterday: number; days7Ago: number; days30Ago: number; }
export interface RsiTrackerPoint { symbol: string; rsi: Record<string, number>; currentRsi: number; lastRsi: number; volume24h: number; price: number; change24h: number; marketCap: number; logo: string; }
export interface MacdAvgData { averageMacd: number; yesterday: number; days7Ago: number; days30Ago: number; }
export interface MacdTrackerPoint { symbol: string; name: string; macd: Record<string, number>; signal: Record<string, number>; histogram: Record<string, number>; marketCap: number; volume24h: number; price: number; change24h: number; logo: string; }

export interface LsrData { 
    lsr: number | null; 
    longs: number | null; 
    shorts: number | null; 
    history?: { timestamp: number, lsr: number, longs: number, shorts: number }[];
}

export const fetchRsiAverage = async (): Promise<RsiAvgData | null> => {
    return await fetchWithFallback(RSI_AVG_URL);
};

export const fetchRsiTracker = async (): Promise<RsiTrackerPoint[]> => {
    const data = await fetchWithFallback(RSI_TRACKER_URL);
    return Array.isArray(data) ? data : [];
};

export const fetchMacdAverage = async (): Promise<MacdAvgData | null> => {
    return await fetchWithFallback(MACD_AVG_URL);
};

export const fetchMacdTracker = async (): Promise<MacdTrackerPoint[]> => {
    const data = await fetchWithFallback(MACD_TRACKER_URL);
    return Array.isArray(data) ? data : [];
};

/**
 * Busca o Long/Short Ratio diretamente da Binance via Proxy.
 * Timeframes suportados: 5m, 15m, 30m, 1h, 2h, 4h, 6h, 12h, 1d
 */
export const fetchLongShortRatio = async (symbol: string, period: string, limit: number = 30): Promise<LsrData> => {
    const cleanSymbol = symbol.toUpperCase().endsWith('USDT') ? symbol.toUpperCase() : `${symbol.toUpperCase()}USDT`;
    // Mapeia 1D para 1d (padrão Binance)
    const cleanPeriod = period.toLowerCase() === '1d' ? '1d' : period;
    
    try {
        const binanceUrl = `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${cleanSymbol}&period=${cleanPeriod}&limit=${limit}`;
        const binanceData = await fetchWithFallback(binanceUrl, 10000);
        
        if (Array.isArray(binanceData) && binanceData.length > 0) {
            const points = binanceData.map((d: any) => {
                const ratio = parseFloat(d.longShortRatio);
                const longs = d.longAccount ? parseFloat(d.longAccount) * 100 : (ratio / (ratio + 1)) * 100;
                const shorts = d.shortAccount ? parseFloat(d.shortAccount) * 100 : (1 / (ratio + 1)) * 100;
                
                return {
                    timestamp: d.timestamp,
                    lsr: ratio,
                    longs: parseFloat(longs.toFixed(2)),
                    shorts: parseFloat(shorts.toFixed(2))
                };
            }).sort((a, b) => a.timestamp - b.timestamp);

            const latest = points[points.length - 1];

            return {
                lsr: latest.lsr,
                longs: latest.longs,
                shorts: latest.shorts,
                history: points
            };
        }
    } catch (e) {
        console.error("LSR Fetch Error:", e);
    }

    return { lsr: null, longs: null, shorts: null, history: [] };
};
