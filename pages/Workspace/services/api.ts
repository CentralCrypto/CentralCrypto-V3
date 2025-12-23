
/**
 * ARQUIVO AGREGADOR - CENTRAL CRYPTO 3.0
 * Este arquivo apenas exporta os módulos fragmentados para evitar quebras nos widgets.
 * Se você precisar alterar a lógica de um indicador específico, vá para o arquivo correspondente em services/api/
 */

export * from './api/utils';
export * from './api/market';
export * from './api/sentiment';
export * from './api/technical';
export * from './api/global';

import { fetchWithFallback } from './api/utils';

// Funções remanescentes que não se encaixam nos grupos principais
export interface NewsItem { title: string; link: string; pubDate: string; source: string; description: string; thumbnail: string; }
export interface OrderBookData { bids: { price: string; qty: string }[]; asks: { price: string; qty: string }[]; }

export const fetchCryptoNews = async (symbol: string, name: string): Promise<NewsItem[]> => {
    try {
        const url = `https://centralcrypto.com.br/cachecko/news.php?symbol=${symbol}&name=${name}`;
        const data = await fetchWithFallback(url);
        return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
};

export const fetchOrderBook = async (symbol: string): Promise<OrderBookData | null> => {
    try {
        const url = `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=20`;
        const res = await fetch(url);
        if (res.ok) return await res.json();
    } catch (e) {}
    return null;
};
