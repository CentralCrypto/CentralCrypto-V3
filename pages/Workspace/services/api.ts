
import { ApiCoin } from '../../../types';
import { httpGetJson } from '../../../services/http';
import { getCacheckoUrl, ENDPOINTS } from '../../../services/endpoints';

const STABLECOINS = ['USDT', 'USDC', 'DAI', 'FDUSD', 'TUSD', 'USDD', 'PYUSD', 'USDE', 'GUSD', 'USDP', 'BUSD'];

// === LOGO HANDLING CONSTANTS ===
export const SITE_LOGO_FALLBACK = 'https://centralcrypto.com.br/favicon.ico';
export const COINCAP_CDN = 'https://assets.coincap.io/assets/icons';

// --- LOGO MANIFEST CACHE ---
let logoManifest: any = null;
let symbolToIdMap = new Map<string, string>();

// Inicializa o carregamento do manifesto silenciosamente
(async () => {
    try {
        const url = getCacheckoUrl('/logos/manifest.json');
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            logoManifest = data;
            if (Array.isArray(data.coins)) {
                data.coins.forEach((c: any) => {
                    if (c.symbol) symbolToIdMap.set(c.symbol.toLowerCase(), c.id);
                });
            }
        }
    } catch (e) {
        // Falha silenciosa
    }
})();

// Função principal de resolução de URL inicial
export const resolveLogo = (symbol: string, apiImage?: string, id?: string): string => {
    const s = (symbol || '').toLowerCase();
    
    // 1. Tenta Cache Local via Manifest
    if (logoManifest) {
        const coinId = id || symbolToIdMap.get(s);
        const localCoin = coinId ? logoManifest.coins.find((c: any) => c.id === coinId) : null;
        if (localCoin && localCoin.fileName) {
            return localCoin.fileName;
        }
    }

    // 2. Se tiver imagem da API válida
    if (apiImage && apiImage.startsWith('http') && !apiImage.includes('missing')) {
        return apiImage;
    }

    // 3. Fallback Padrão
    return `${COINCAP_CDN}/${s}@2x.png`;
};

// Gera cadeia de fallbacks para uso em onError
export const getLogoChain = (symbol: string, apiImage?: string, id?: string): string[] => {
    const s = (symbol || '').toLowerCase();
    const chain: string[] = [];

    // 1. Tenta Local
    const coinId = id || (logoManifest ? symbolToIdMap.get(s) : null);
    if (coinId) {
        chain.push(`/cachecko/logos/${coinId}.png`);
    }

    // 2. Tenta Origem API
    if (apiImage && apiImage.startsWith('http')) {
        chain.push(apiImage);
    }

    // 3. Tenta CDN CoinCap
    chain.push(`${COINCAP_CDN}/${s}@2x.png`);

    // 4. Tenta Placeholder Final
    chain.push(SITE_LOGO_FALLBACK);

    return Array.from(new Set(chain));
};

// Helper para Highcharts HTML string
export const getHighchartsImgTag = (symbol: string, url: string, size: number = 24, style: string = ""): string => {
    const s = (symbol || '').toLowerCase();
    const fallback = `${COINCAP_CDN}/${s}@2x.png`;
    const errorLogic = `this.onerror=null;this.src='${fallback}';this.onerror=function(){this.src='${SITE_LOGO_FALLBACK}';}`;
    return `<img src="${url}" style="width:${size}px;height:${size}px;${style}" onerror="${errorLogic}" />`;
};

/**
 * Busca dados usando caminhos relativos.
 */
export const fetchWithFallback = async (url: string): Promise<any | null> => {
  try {
    const { data } = await httpGetJson(url, { timeoutMs: 15000, retries: 2 });
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
 * Helper ULTRA-ROBUSTO para extrair dados de respostas n8n/json variáveis
 */
const extractDataArray = (raw: any): any[] => {
  if (!raw) return [];

  // Se já for array
  if (Array.isArray(raw)) {
    if (raw.length === 0) return [];
    
    // Caso n8n comum: [{ data: [...] }]
    if (raw.length === 1) {
        if (raw[0]?.data && Array.isArray(raw[0].data)) return raw[0].data;
        if (raw[0]?.json?.data && Array.isArray(raw[0].json.data)) return raw[0].json.data; // n8n json wrapper
        if (raw[0]?.data?.heatmap?.items && Array.isArray(raw[0].data.heatmap.items)) return raw[0].data.heatmap.items;
        
        // Se o único item for o objeto de dados em si (ex: { overall: ... })
        if (raw[0]?.overall || raw[0]?.rsiOverall) return raw;
    }
    
    // Se o primeiro item parece ser um dado válido, retorna o array original
    return raw;
  }

  // Se for objeto
  if (typeof raw === 'object') {
    if (Array.isArray(raw.data)) return raw.data;
    if (Array.isArray(raw.items)) return raw.items;
    if (raw.data?.data && Array.isArray(raw.data.data)) return raw.data.data;
    if (raw.heatmap?.items && Array.isArray(raw.heatmap.items)) return raw.heatmap.items;
    
    // Objeto único tratado como lista de 1 item (fallback)
    if (raw.symbol || raw.id) return [raw];
  }

  return [];
};

const safeNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeSearch = (s: string) => (s || '').toLowerCase().trim();

// --------- CACHES ---------
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
    const items = extractDataArray(data);
    topCoinsCache = Array.isArray(items) ? (items as ApiCoin[]) : [];
    topCoinsCacheTs = Date.now();
    return topCoinsCache;
  })().finally(() => {
    topCoinsInFlight = null;
  });

  return topCoinsInFlight;
};

export interface HeatmapCategory {
  id: string; name: string; description?: string; type?: string; coin_counter?: number; ico_counter?: number; coins?: any[];
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
    const arr = extractDataArray(data);
    categoriesCache = Array.isArray(arr) ? (arr as HeatmapCategory[]) : [];
    categoriesCacheTs = Date.now();
    return categoriesCache;
  })().finally(() => {
    categoriesInFlight = null;
  });

  return categoriesInFlight;
};

// --------- INTERFACES & EXPORTS ---------

export interface NewsItem { title: string; link: string; pubDate: string; source: string; description: string; thumbnail: string; }
export interface EtfFlowData { btcValue: number; ethValue: number; netFlow: number; timestamp: number; chartDataBTC: any[]; chartDataETH: any[]; history: { lastWeek: number; lastMonth: number; last90d: number; }; solValue: number; xrpValue: number; }
export interface LsrData { lsr: number | null; longs: number | null; shorts: number | null; }
export interface MacdAvgData { averageMacd: number; yesterday: number; days7Ago: number; days30Ago: number; bullishPercentage?: number; bearishPercentage?: number; averageNMacd: number; yesterdayNMacd: number; }
export interface MacdTrackerPoint { symbol: string; name: string; price: number; change24h: number; marketCap: number; logo?: string; logoChain?: string[]; macd: any; }
export interface RsiAvgData { averageRsi: number; yesterday: number; days7Ago: number; days30Ago: number; days90Ago?: number; }
export interface RsiTrackerPoint { symbol: string; name: string; price: number; change24h: number; marketCap: number; volume24h?: number; rank?: number; logo?: string; logoChain?: string[]; rsi: Record<string, number>; currentRsi?: number; lastRsi?: number; }
export interface RsiTableItem { id: string; symbol: string; name?: string; price: number; rsi: { "15m": number; "1h": number; "4h": number; "24h": number; "7d": number; }; change?: number; logo?: string; logoChain?: string[]; marketCap?: number; volume24h?: number; rank?: number; }
export interface EconEvent { date: string; title: string; country: string; impact: string; previous?: string; forecast?: string; }
export interface OrderBookData { bids: { price: string; qty: string }[]; asks: { price: string; qty: string }[]; }
export interface FngData { value: string; timestamp: string; value_classification?: string; value_classification_i18n?: { pt: string; en: string; es: string; }; }
export interface TrumpData { title: string; link: string; description: string; pubDate: string; sarcastic_label: string; trump_rank_50: number; trump_rank_percent: number; impact_semaforo?: string; }
export interface AltSeasonHistoryPoint { timestamp: number; altcoinIndex: number; altcoinMarketcap: number; }
export interface AltSeasonData { index: number; yesterday: number; lastWeek: number; lastMonth: number; history?: AltSeasonHistoryPoint[]; }

export type RsiTimeframeKey = '15m' | '1h' | '4h' | '24h' | '7d';
export type RsiSortKey = 'rsi15m' | 'rsi1h' | 'rsi4h' | 'rsi24h' | 'rsi7d' | 'marketCap' | 'volume24h' | 'price24h' | 'rank';
export interface RsiTablePageResult { items: RsiTableItem[]; page: number; totalPages: number; totalItems: number; }
export interface MacdTablePageResult { items: MacdTrackerPoint[]; page: number; totalPages: number; totalItems: number; }

// --------- RSI IMPLEMENTATION ---------

export const fetchRsiAverage = async (): Promise<RsiAvgData | null> => {
  const raw = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.rsiAvg));
  if (!raw) return null;
  let root = Array.isArray(raw) ? raw[0] : raw;
  if (root?.data?.overall) root = root.data;
  else if (root?.overall) root = root;
  const overall = root?.overall || root;
  return {
    averageRsi: safeNum(overall?.averageRsi, 50),
    yesterday: safeNum(overall?.yesterday, 50),
    days7Ago: safeNum(overall?.days7Ago, 50),
    days30Ago: safeNum(overall?.days30Ago, 50),
    days90Ago: safeNum(overall?.days90Ago, undefined)
  };
};

export const fetchRsiTrackerHist = async (): Promise<RsiTrackerPoint[]> => {
  const raw = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.rsiTrackerHist));
  const items = extractDataArray(raw);
  if (!items.length) return [];
  return items.map((p: any) => {
    const rsiNode = p.rsiOverall || p.rsi || {};
    const symbol = String(p.symbol || p.s || '').toUpperCase();
    return {
      symbol,
      name: p.name || p.n || symbol,
      price: safeNum(p.current_price || p.price, 0),
      change24h: safeNum(p.price_change_percentage_24h || p.price24h, 0),
      // Fix: Ensure robust property access for market cap
      marketCap: safeNum(p.market_cap || p.marketCap || p.mc, 0),
      volume24h: safeNum(p.total_volume || p.volume24h || p.v, 0),
      rank: safeNum(p.market_cap_rank || p.rank || p.r, 9999),
      logo: resolveLogo(symbol, p.image || p.logo, p.id),
      logoChain: getLogoChain(symbol, p.image || p.logo, p.id),
      rsi: {
        "15m": safeNum(rsiNode?.rsi15m ?? rsiNode?.['15m'], 50),
        "1h": safeNum(rsiNode?.rsi1h ?? rsiNode?.['1h'], 50),
        "4h": safeNum(rsiNode?.rsi4h ?? rsiNode?.['4h'], 50),
        "24h": safeNum(rsiNode?.rsi24h ?? rsiNode?.['24h'], 50),
        "7d": safeNum(rsiNode?.rsi7d ?? rsiNode?.['7d'], 50),
      },
      currentRsi: safeNum(p.currentRsi || rsiNode?.rsi4h, 50),
      lastRsi: safeNum(p.lastRsi, 50)
    };
  });
};

const RSI_TABLE_TTL_MS = 60_000;
let rsiTableCacheTs = 0;
let rsiTableCache: RsiTableItem[] = [];
let rsiTableInFlight: Promise<RsiTableItem[]> | null = null;

export const fetchRsiTable = async (opts?: { force?: boolean }): Promise<RsiTableItem[]> => {
  const now = Date.now();
  if (!opts?.force && rsiTableCache.length > 0 && (now - rsiTableCacheTs) < RSI_TABLE_TTL_MS) return rsiTableCache;
  if (!opts?.force && rsiTableInFlight) return rsiTableInFlight;

  rsiTableInFlight = (async () => {
      let raw = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.rsiTable));
      let items = extractDataArray(raw);
      if (items.length === 0) {
          // Fallback to hist data if table data is empty
          raw = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.rsiTrackerHist));
          items = extractDataArray(raw);
      }
      if (!items.length) return [];
      
      rsiTableCache = items.map((p: any) => {
        const symbol = String(p.symbol || '').toUpperCase();
        const rsiNode = p.rsiOverall || p.rsi || p.rsi_overall || p; 
        return {
          id: String(p.id || symbol || ''),
          symbol,
          name: p.name || symbol,
          price: safeNum(p.current_price || p.price, 0),
          change: safeNum(p.price_change_percentage_24h || p.price24h || p.change24h, 0),
          marketCap: safeNum(p.market_cap || p.marketCap || p.mc, 0),
          volume24h: safeNum(p.total_volume || p.volume24h || p.v, 0),
          rank: safeNum(p.market_cap_rank || p.rank || p.r, 9999),
          logo: resolveLogo(symbol, p.image || p.logo, p.id),
          logoChain: getLogoChain(symbol, p.image || p.logo, p.id),
          rsi: {
            "15m": safeNum(p.rsi15m ?? rsiNode.rsi15m ?? rsiNode['15m'], 50),
            "1h": safeNum(p.rsi1h ?? rsiNode.rsi1h ?? rsiNode['1h'], 50),
            "4h": safeNum(p.rsi4h ?? rsiNode.rsi4h ?? rsiNode['4h'], 50),
            "24h": safeNum(p.rsi24h ?? rsiNode.rsi24h ?? rsiNode['24h'], 50),
            "7d": safeNum(p.rsi7d ?? rsiNode.rsi7d ?? rsiNode['7d'], 50)
          }
        };
      });
      rsiTableCacheTs = Date.now();
      return rsiTableCache;
  })().finally(() => { rsiTableInFlight = null; });
  
  return rsiTableInFlight;
};

export const fetchRsiTablePage = async (args: { page: number; limit: number; sort?: RsiSortKey; ascendingOrder?: boolean; filterText?: string; force?: boolean; }): Promise<RsiTablePageResult> => {
  const all = await fetchRsiTable({ force: args.force });
  const q = normalizeSearch(args.filterText || '');
  let filtered = all;
  if (q) filtered = all.filter(i => (i.symbol || '').toLowerCase().includes(q) || (i.name || '').toLowerCase().includes(q));

  const sort = args.sort || 'rsi4h';
  const asc = args.ascendingOrder;
  const tf = (['15m','1h','4h','24h','7d'].includes(sort.replace('rsi',''))) ? sort.replace('rsi','') as RsiTimeframeKey : null;

  const sorted = [...filtered].sort((a, b) => {
    let av = 0, bv = 0;
    if (tf) { av = a.rsi[tf]; bv = b.rsi[tf]; }
    else if (sort === 'marketCap') { av = a.marketCap || 0; bv = b.marketCap || 0; }
    else if (sort === 'volume24h') { av = a.volume24h || 0; bv = b.volume24h || 0; }
    else if (sort === 'price24h') { av = a.change || 0; bv = b.change || 0; }
    else if (sort === 'rank') { av = a.rank || 0; bv = b.rank || 0; }
    else { av = a.rsi['4h']; bv = b.rsi['4h']; } 
    return asc ? (av - bv) : (bv - av);
  });

  const limit = Math.max(1, args.limit);
  const totalItems = sorted.length;
  const totalPages = Math.ceil(totalItems / limit);
  const page = Math.min(Math.max(1, args.page), totalPages);
  const start = (page - 1) * limit;
  return { items: sorted.slice(start, start + limit), page, totalPages, totalItems };
};

/**
 * Scatter usando o MESMO cache da tabela (rsitracker.json).
 * Útil quando você quer 1 fonte única para gráfico e tabela.
 */
export const fetchRsiScatterFromTableCache = async (opts?: {
  limit?: number;
  force?: boolean;
}): Promise<RsiTrackerPoint[]> => {
  const limit = typeof opts?.limit === 'number' && isFinite(opts.limit) ? Math.max(1, Math.min(1000, Math.floor(opts.limit))) : 300;
  const rows = await fetchRsiTable({ force: opts?.force });

  return rows.slice(0, limit).map(r => ({
    symbol: r.symbol,
    name: r.name || r.symbol,
    price: safeNum(r.price, 0),
    change24h: safeNum(r.change, 0),
    marketCap: safeNum(r.marketCap, 0),
    volume24h: Number.isFinite(Number(r.volume24h)) ? Number(r.volume24h) : undefined,
    rank: Number.isFinite(Number(r.rank)) ? Number(r.rank) : undefined,
    logo: r.logo,
    rsi: {
      "15m": safeNum(r.rsi?.["15m"], 50),
      "1h": safeNum(r.rsi?.["1h"], 50),
      "4h": safeNum(r.rsi?.["4h"], 50),
      "24h": safeNum(r.rsi?.["24h"], 50),
      "7d": safeNum(r.rsi?.["7d"], 50),
    }
  }));
};

// -------------------- MACD --------------------

export const fetchMacdAverage = async (): Promise<MacdAvgData | null> => {
  const raw = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.macdAvg));
  if (!raw) return null;
  let root = Array.isArray(raw) ? raw[0] : raw;
  const d = root?.data?.overall || root?.data || root;
  return {
      averageMacd: safeNum(d.averageMacd, 0),
      averageNMacd: safeNum(d.averageNMacd, 0),
      bullishPercentage: safeNum(d.bullishPercentage, 50),
      bearishPercentage: safeNum(d.bearishPercentage, 50),
      yesterday: safeNum(d.yesterday, 0),
      days7Ago: safeNum(d.days7Ago, 0),
      days30Ago: safeNum(d.days30Ago, 0),
      yesterdayNMacd: safeNum(d.yesterdayNMacd, 0),
  };
};

export const fetchMacdTracker = async (opts?: { force?: boolean }): Promise<MacdTrackerPoint[]> => {
  const raw = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.macdTracker));
  let items = extractDataArray(raw);
  return items.map((i: any) => {
      const symbol = String(i.symbol || '').toUpperCase();
      const macdNode = i.macd || {};
      return {
          symbol,
          name: i.name || symbol,
          price: safeNum(i.price, 0),
          change24h: safeNum(i.price24h, 0),
          // Fix: Ensure robust property access for market cap (snake_case vs camelCase vs short 'mc')
          marketCap: safeNum(i.market_cap || i.marketCap || i.mc, 0),
          logo: resolveLogo(symbol, i.image || i.logo, i.id),
          logoChain: getLogoChain(symbol, i.image || i.logo, i.id),
          macd: {
              "15m": { nmacd: safeNum(macdNode.macd15m?.nmacd, 0), macd: safeNum(macdNode.macd15m?.macd, 0), histogram: safeNum(macdNode.macd15m?.histogram, 0), signalLine: safeNum(macdNode.macd15m?.signalLine, 0) },
              "1h": { nmacd: safeNum(macdNode.macd1h?.nmacd, 0), macd: safeNum(macdNode.macd1h?.macd, 0), histogram: safeNum(macdNode.macd1h?.histogram, 0), signalLine: safeNum(macdNode.macd1h?.signalLine, 0) },
              "4h": { nmacd: safeNum(macdNode.macd4h?.nmacd, 0), macd: safeNum(macdNode.macd4h?.macd, 0), histogram: safeNum(macdNode.macd4h?.histogram, 0), signalLine: safeNum(macdNode.macd4h?.signalLine, 0) },
              "24h": { nmacd: safeNum(macdNode.macd24h?.nmacd, 0), macd: safeNum(macdNode.macd24h?.macd, 0), histogram: safeNum(macdNode.macd24h?.histogram, 0), signalLine: safeNum(macdNode.macd24h?.signalLine, 0) },
              "7d": { nmacd: safeNum(macdNode.macd7d?.nmacd, 0), macd: safeNum(macdNode.macd7d?.macd, 0), histogram: safeNum(macdNode.macd7d?.histogram, 0), signalLine: safeNum(macdNode.macd7d?.signalLine, 0) },
          }
      };
  }).filter(x => x.marketCap > 0);
};

export const fetchMacdTablePage = async (args: { page: number; limit: number; sort?: string; timeframe?: string; ascendingOrder?: boolean; filterText?: string; force?: boolean; }): Promise<MacdTablePageResult> => {
    const all = await fetchMacdTracker({ force: args.force });
    const q = normalizeSearch(args.filterText || '');
    let filtered = all;
    if (q) filtered = all.filter(i => i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));

    const tf = (args.timeframe || '4h') as '15m'|'1h'|'4h'|'24h'|'7d';
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

// ... Rest of simple fetches
export const fetchCryptoNews = async (symbol: string, coinName: string): Promise<NewsItem[]> => {
  const url = `${ENDPOINTS.special.news}?s=${encodeURIComponent(symbol)}&n=${encodeURIComponent(coinName)}`;
  const data = await fetchWithFallback(url);
  return Array.isArray(data) ? data : [];
};
export const fetchAltcoinSeason = async (): Promise<AltSeasonData | null> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.altseason));
  return Array.isArray(data) ? data[0] : data;
};
export const fetchAltcoinSeasonHistory = async (): Promise<AltSeasonHistoryPoint[]> => {
  const data = await fetchAltcoinSeason();
  return Array.isArray(data?.history) ? (data!.history as AltSeasonHistoryPoint[]) : [];
};
export const fetchTrumpData = async (): Promise<TrumpData | null> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.trump));
  return Array.isArray(data) ? data[0] : data;
};
export const fetchFearAndGreed = async (): Promise<FngData[]> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.fng));
  return extractDataArray(data) as FngData[];
};
export const fetchEconomicCalendar = async (): Promise<EconEvent[]> => {
  const data = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.calendar));
  return Array.isArray(data) ? data : [];
};
export const fetchEtfFlow = async (): Promise<EtfFlowData | null> => {
  const raw = await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.etfNetFlow));
  if (!raw) return null;
  const root = Array.isArray(raw) ? raw[0] : raw;
  const data = (root && (root as any).data) ? (root as any).data : root;
  const status = (root && (root as any).status) ? (root as any).status : null;
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
  try {
    const res = await fetch(`https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${cleanSymbol}&period=${period.toLowerCase()}&limit=1`);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const p = data[0];
      return { lsr: parseFloat(p.longShortRatio), longs: parseFloat(p.longAccount)*100, shorts: parseFloat(p.shortAccount)*100 };
    }
  } catch (e) { }
  return { lsr: null, longs: null, shorts: null };
};
export const fetchOrderBook = async (symbol: string): Promise<OrderBookData | null> => {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=20`);
    const data = await response.json();
    if (data.bids && data.asks) return { bids: data.bids.map((b:any)=>({price:b[0],qty:b[1]})), asks: data.asks.map((a:any)=>({price:a[0],qty:a[1]})) };
  } catch (e) { }
  return null;
};
export const fetchMarketCapHistory = async (): Promise<any | null> => {
  return await fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.mktcapHist));
};
