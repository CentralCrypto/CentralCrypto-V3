
import { getCacheckoUrl } from '../../../services/endpoints';

export const SITE_LOGO_FALLBACK = 'https://centralcrypto.com.br/favicon.ico';
const MANIFEST_URL = '/cachecko/logos/manifest.json'; // Relative to proxy
const PAPRIKA_LIST_URL = 'https://api.coinpaprika.com/v1/coins';

interface ManifestCoin {
    id: string;
    symbol: string;
    name: string;
    imageUrl: string;
    fileName: string; // e.g. "/cachecko/logos/bitcoin.png"
    localFsPath: string;
}

interface Manifest {
    coins: ManifestCoin[];
}

interface PaprikaCoin {
    id: string;
    name: string;
    symbol: string;
    rank: number;
    is_active: boolean;
}

// In-memory cache
let manifestCache: Manifest | null = null;
let paprikaCache: PaprikaCoin[] | null = null;
let symbolToIdMap = new Map<string, string>(); // Maps symbol (BTC) to ID (bitcoin) based on local manifest

// Initialize caches immediately (fire and forget)
(async () => {
    // 1. Load Local Manifest
    try {
        const res = await fetch(getCacheckoUrl('/logos/manifest.json'));
        if (res.ok) {
            manifestCache = await res.json();
            // Build fast lookup map
            if (manifestCache?.coins) {
                manifestCache.coins.forEach(c => {
                    if (c.symbol) symbolToIdMap.set(c.symbol.toLowerCase(), c.id);
                });
            }
        }
    } catch (e) {
        console.warn('Logo manifest load failed', e);
    }

    // 2. Load Paprika list (with localStorage caching for 24h)
    try {
        const CACHE_KEY = 'cct_paprika_list';
        const now = Date.now();
        let cached = null;
        
        try {
            const item = localStorage.getItem(CACHE_KEY);
            if (item) cached = JSON.parse(item);
        } catch (e) { /* ignore storage errors */ }
        
        if (cached && (now - cached.ts < 24 * 60 * 60 * 1000)) {
            paprikaCache = cached.data;
        }

        if (!paprikaCache) {
            const res = await fetch(PAPRIKA_LIST_URL);
            if (res.ok) {
                const data = await res.json();
                paprikaCache = data;
                try {
                    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: now, data }));
                } catch (e) { /* ignore quota errors */ }
            }
        }
    } catch (e) {
        console.warn('Paprika list load failed', e);
    }
})();

export const getLogoChain = (symbol: string, apiImage?: string, id?: string): string[] => {
    const s = (symbol || '').toLowerCase();
    const chain: string[] = [];

    // 1. LOCAL CACHE (Primary)
    const coinId = id || symbolToIdMap.get(s);
    let localCoin: ManifestCoin | undefined;
    
    if (manifestCache && coinId) {
        localCoin = manifestCache.coins.find(c => c.id === coinId);
        if (localCoin && localCoin.fileName) {
            // Garante que o caminho é relativo ao public/proxy
            chain.push(localCoin.fileName); 
        }
    }

    // 2. API ORIGIN (CoinGecko/Source)
    if (apiImage && apiImage.startsWith('http') && !apiImage.includes('missing')) {
        chain.push(apiImage);
    } else if (localCoin && localCoin.imageUrl) {
        chain.push(localCoin.imageUrl);
    }

    // 3. COINPAPRIKA (Secondary CDN)
    if (paprikaCache) {
        // Tenta achar ID do paprika
        const paprikaItem = paprikaCache.find(p => p.symbol.toLowerCase() === s && (p.rank < 2000 || p.is_active));
        if (paprikaItem) {
            chain.push(`https://static.coinpaprika.com/coin/${paprikaItem.id}/logo.png`);
        }
    }
    
    // 3.5 Fallback CoinCap (Generic CDN)
    if (chain.length === 0 && s) {
        chain.push(`https://assets.coincap.io/assets/icons/${s}@2x.png`);
    }

    // 4. SITE PLACEHOLDER (Ultimate Fallback)
    chain.push(SITE_LOGO_FALLBACK);

    // Remove duplicates
    return Array.from(new Set(chain));
};

export const resolveLogo = (symbol: string, apiImage?: string, id?: string): string => {
    const chain = getLogoChain(symbol, apiImage, id);
    return chain[0];
};
