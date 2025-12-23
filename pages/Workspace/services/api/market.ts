
import { ApiCoin } from '../../../../types';
import { fetchWithFallback, isStablecoin } from './utils';

const PRIMARY_API_URL = 'https://centralcrypto.com.br/cachecko/cachecko.json';

/**
 * Fonte compartilhada para: 
 * 1. Heatmap Squares
 * 2. Central Bubbles
 * 3. Top Gainers & Losers
 */
export const fetchTopCoins = async (): Promise<ApiCoin[]> => {
    try {
        const data = await fetchWithFallback(PRIMARY_API_URL);
        if (!data) return [];
        
        let coins: any[] = [];
        if (Array.isArray(data)) {
            const subData = data.find(item => item && Array.isArray(item.data));
            if (subData) coins = subData.data;
            else if (data[0] && Array.isArray(data[0])) coins = data[0];
            else coins = data;
        } 
        else if (data && typeof data === 'object') {
            if (Array.isArray(data.data)) coins = data.data;
            else {
                const foundArray = Object.values(data).find(v => Array.isArray(v) && v.length > 10);
                if (foundArray) coins = foundArray as any[];
            }
        }
        return Array.isArray(coins) ? coins : [];
    } catch (e) {
        return [];
    }
};

export const fetchGainersLosers = async (): Promise<any> => {
    const coins = await fetchTopCoins();
    if (!coins || coins.length === 0) return { gainers: [], losers: [] };
    const filtered = coins.filter(c => c && c.symbol && !isStablecoin(c.symbol));
    const sorted = [...filtered].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
    return {
        gainers: sorted.slice(0, 100),
        losers: [...sorted].reverse().slice(0, 100)
    };
};
