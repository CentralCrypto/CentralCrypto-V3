import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ExternalLink,
  GripVertical,
  Loader2,
  Search,
  Star,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  RotateCcw,
  ChevronDown
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';

import { ApiCoin, Language } from '../../../types';
import { fetchTopCoins } from '../services/api';
import { getTranslations } from '../../../locales';
import { useBinanceWS } from '../../../services/BinanceWebSocketContext';

// ======================
// CORES PADRONIZADAS (FIXAS)
// ======================
const GREEN = '#548F3F';
const RED = '#ff6961';

const FLASH_GREEN_BG = '#122A21';
const FLASH_RED_BG = '#C33B4080';

const formatUSD = (val: number, compact = false) => {
  if (val === undefined || val === null) return '---';
  if (!isFinite(val)) return '---';

  if (compact) {
    const abs = Math.abs(val);
    if (abs >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
  }
  return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatCompactNumber = (val: number) => {
  if (val === undefined || val === null) return '---';
  if (!isFinite(val)) return '---';
  const abs = Math.abs(val);

  if (abs >= 1e9) return `${(val / 1e9).toFixed(2)}Bi`;
  if (abs >= 1e6) return `${(val / 1e6).toFixed(2)}Mi`;
  if (abs >= 1e3) return `${(val / 1e3).toFixed(2)}K`;
  return `${Number(val).toFixed(2)}`;
};

const safePct = (v: number) => {
  if (!isFinite(v)) return '--';
  const s = v >= 0 ? '+' : '';
  return `${s}${v.toFixed(2)}%`;
};

// sparkline 7d (168 pts) => estimativas
const pctFromSpark = (prices?: number[], pointsBack: number = 1) => {
  const arr = Array.isArray(prices) ? prices.filter(n => typeof n === 'number' && isFinite(n)) : [];
  if (arr.length < 2) return NaN;
  const last = arr[arr.length - 1];
  const idx = Math.max(0, arr.length - 1 - Math.max(1, pointsBack));
  const prev = arr[idx];
  if (!isFinite(prev) || prev === 0) return NaN;
  return ((last - prev) / prev) * 100;
};

const pct7dFromSpark = (prices?: number[]) => {
  const arr = Array.isArray(prices) ? prices.filter(n => typeof n === 'number' && isFinite(n)) : [];
  if (arr.length < 2) return NaN;
  const first = arr[0];
  const last = arr[arr.length - 1];
  if (!isFinite(first) || first === 0) return NaN;
  return ((last - first) / first) * 100;
};

const normalizeBinanceSymbol = (coin: ApiCoin) => {
  const sym = String(coin?.symbol || '').trim().toUpperCase();
  if (!sym) return null;
  // Handle exceptions if needed, but usually just uppercase + USDT
  return `${sym}USDT`;
};

// --- COMPONENTES AUXILIARES OTIMIZADOS ---

// Componente de Linha Individual com Conexão WebSocket Isolada
const LiveCoinRow = React.memo(({ coin, index, colOrder, favorites, toggleFav, COIN_WIDTHS }: any) => {
  const { tickers } = useBinanceWS();
  const symbol = normalizeBinanceSymbol(coin);
  const liveData = symbol ? tickers[symbol] : null;

  const prevPriceRef = useRef<number>(coin.current_price || 0);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  const price = liveData ? parseFloat(liveData.c) : (coin.current_price || 0);
  
  // Calculate change based on open price from socket if available, otherwise static
  const change24h = liveData 
    ? ((parseFloat(liveData.c) - parseFloat(liveData.o)) / parseFloat(liveData.o) * 100) 
    : (coin.price_change_percentage_24h || 0);

  // Flash effect logic
  useEffect(() => {
    if (price !== prevPriceRef.current) {
        if (prevPriceRef.current > 0) {
            setFlash(price > prevPriceRef.current ? 'up' : 'down');
            const timer = setTimeout(() => setFlash(null), 500);
            return () => clearTimeout(timer);
        }
        prevPriceRef.current = price;
    }
  }, [price]);

  const getCellContent = (col: string) => {
    switch (col) {
      case 'rank':
        return <span className="text-gray-400 font-mono text-[10px]">#{coin.market_cap_rank}</span>;
      case 'asset':
        return (
          <div className="flex items-center gap-2 overflow-hidden">
            <button
              onClick={(e) => { e.stopPropagation(); toggleFav(coin.id); }}
              className="hover:scale-110 transition-transform"
            >
              <Star size={12} className={favorites[coin.id] ? "fill-yellow-400 text-yellow-400" : "text-gray-600 dark:text-slate-600"} />
            </button>
            <div className="w-5 h-5 shrink-0 rounded-full bg-white p-0.5">
              <img src={coin.image} loading="lazy" className="w-full h-full object-cover rounded-full" alt="" />
            </div>
            <div className="flex flex-col leading-tight min-w-0">
              <span className="font-bold text-gray-800 dark:text-gray-200 truncate">{coin.name}</span>
              <span className="text-[9px] text-gray-500 font-bold">{String(coin.symbol).toUpperCase()}</span>
            </div>
          </div>
        );
      case 'price':
        return (
          <div 
            className="font-mono font-bold transition-colors duration-300 px-1.5 py-0.5 rounded text-right"
            style={{ 
                backgroundColor: flash === 'up' ? FLASH_GREEN_BG : flash === 'down' ? FLASH_RED_BG : 'transparent',
                color: flash === 'up' ? '#4ade80' : flash === 'down' ? '#f87171' : undefined
            }}
          >
            {formatUSD(price)}
          </div>
        );
      case 'ch1h': {
        // 1h change isn't in miniTicker, calculate from sparkline or use static
        const val = pctFromSpark(coin.sparkline_in_7d?.price, 1);
        const color = val >= 0 ? GREEN : RED;
        return <span style={{ color }} className="font-bold">{safePct(val)}</span>;
      }
      case 'ch24h': {
        const color = change24h >= 0 ? GREEN : RED;
        return <span style={{ color }} className="font-bold">{safePct(change24h)}</span>;
      }
      case 'ch7d': {
        const val = pct7dFromSpark(coin.sparkline_in_7d?.price);
        const color = val >= 0 ? GREEN : RED;
        return <span style={{ color }} className="font-bold">{safePct(val)}</span>;
      }
      case 'mcap':
        return <span className="font-mono text-gray-600 dark:text-slate-400">{formatCompactNumber(coin.market_cap)}</span>;
      case 'vol24h':
        // Volume from socket is 24h volume 'q' (quote volume)
        const vol = liveData ? parseFloat(liveData.q) : coin.total_volume;
        return <span className="font-mono text-gray-600 dark:text-slate-400">{formatCompactNumber(vol)}</span>;
      case 'supply':
        return <span className="font-mono text-gray-500 text-[10px]">{formatCompactNumber(coin.circulating_supply)}</span>;
      case 'spark7d':
        const sparkData = coin.sparkline_in_7d?.price;
        if (!sparkData || sparkData.length < 5) return <span className="text-[9px] text-gray-500">-</span>;
        const color = (sparkData[sparkData.length - 1] >= sparkData[0]) ? GREEN : RED;
        const chartData = sparkData.map((v: number, i: number) => ({ i, v }));
        return (
          <div className="h-8 w-24 ml-auto">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <Area type="monotone" dataKey="v" stroke={color} fill="none" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-slate-800/50 h-[42px]">
      {colOrder.map((col: string) => {
        // @ts-ignore
        const w = COIN_WIDTHS[col] || 'w-20';
        const isRight = ['price','ch1h','ch24h','ch7d','mcap','vol24h','supply','spark7d'].includes(col);
        const isCenter = col === 'rank';
        const align = isRight ? 'justify-end text-right' : isCenter ? 'justify-center text-center' : 'justify-start text-left';
        
        return (
          <div key={col} className={`shrink-0 px-2 flex items-center ${w} ${align} text-xs h-full`}>
            {getCellContent(col)}
          </div>
        );
      })}
    </div>
  );
}, (prev, next) => {
    // Only re-render if static props change (id, favorites, colOrder). 
    // Live price updates are handled internally via context.
    return (
        prev.coin.id === next.coin.id &&
        prev.isFav === next.isFav &&
        prev.colOrder === next.colOrder
    );
});

type MarketCapTableProps = {
  language: Language;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
};

const MarketCapTable = ({ language, scrollContainerRef }: MarketCapTableProps) => {
  const t = getTranslations(language).workspace.marketCapTable;
  
  // NOTE: Removed useBinanceWS from parent component to prevent table-wide re-renders

  const [coins, setCoins] = useState<ApiCoin[]>([]);
  const [loading, setLoading] = useState(true);

  // view swap: coins <-> categories
  const [viewMode, setViewMode] = useState<'coins' | 'categories'>('coins');

  // search/sort/pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'market_cap_rank',
    direction: 'asc',
  });

  const [pageSize, setPageSize] = useState<number>(100);
  const [page, setPage] = useState(0);

  // buy dropdown
  const [buyOpen, setBuyOpen] = useState(false);
  const buyRef = useRef<HTMLDivElement | null>(null);

  // favorites
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [favOnly, setFavOnly] = useState(false);

  // Category context (MASTER -> SUB -> categoryIds)
  const [activeMasterId, setActiveMasterId] = useState<string | null>(null);
  const [activeSubId, setActiveSubId] = useState<string>('__all__');

  // Fallback single category
  const [activeCategoryId, setActiveCategoryId] = useState<string>('__all__');

  // categories datasets
  const [catLoading, setCatLoading] = useState(false);
  const [catWarn, setCatWarn] = useState<string>('');
  const [catWarnDismissed, setCatWarnDismissed] = useState(false);

  const [taxonomy, setTaxonomy] = useState<any>(null);
  const [catList, setCatList] = useState<any[]>([]);
  const [catMarket, setCatMarket] = useState<any[]>([]);
  const [catCoinMap, setCatCoinMap] = useState<Record<string, string[]> | null>(null);

  // top buttons
  const [topMode, setTopMode] = useState<'none' | 'gainers' | 'losers'>('none');

  // Column reorder - coins
  const DEFAULT_COLS: string[] = [
    'rank',
    'asset',
    'price',
    'ch1h',
    'ch24h',
    'ch7d',
    'mcap',
    'vol24h',
    'supply',
    'spark7d',
  ];
  const [colOrder, setColOrder] = useState<string[]>(DEFAULT_COLS);

  // Column reorder - categories
  const CAT_DEFAULT_COLS: string[] = [
    'category',
    'gainers',
    'losers',
    'ch1h',
    'ch24h',
    'ch7d',
    'mcap',
    'vol24h',
    'coins',
    'spark7d',
  ];
  const [catColOrder, setCatColOrder] = useState<string[]>(CAT_DEFAULT_COLS);

  // category sort config
  const [catSortConfig, setCatSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'marketCap',
    direction: 'desc',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // ✅ Reset icon spin (1x por clique)
  const [resetRot, setResetRot] = useState(0);

  // ✅ Scroll-to-top helper (corrige abrir “lá embaixo”)
  const scrollToTop = useCallback(() => {
    const el = scrollContainerRef?.current;
    if (el) el.scrollTo({ top: 0, behavior: 'auto' });
    else window.scrollTo({ top: 0, behavior: 'auto' });
  }, [scrollContainerRef]);

  const fetchJsonSafe = async (url: string) => {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${url} -> ${r.status}`);
    return r.json();
  };

  const loadCoins = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTopCoins();
      if (data && Array.isArray(data)) setCoins(data);
    } catch (e) {
      console.error('MarketCap load error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ Fix do loop infinito (pisca/pisca + spinner)
  const catInFlightRef = useRef(false);
  const loadCategoriesLocal = useCallback(async () => {
    if (catInFlightRef.current) return;
    catInFlightRef.current = true;

    setCatLoading(true);
    setCatWarn('');

    try {
      const base = '/cachecko/categories';

      const [taxonomyJson, listJson, marketJson] = await Promise.all([
        fetchJsonSafe(`${base}/taxonomy-master.json`).catch(() => null),
        fetchJsonSafe(`${base}/coingecko_categories_list.json`).catch(() => []),
        fetchJsonSafe(`${base}/coingecko_categories_market.json`).catch(() => []),
      ]);

      setTaxonomy(taxonomyJson);
      setCatList(Array.isArray(listJson) ? listJson : []);
      setCatMarket(Array.isArray(marketJson) ? marketJson : []);

      const mapJson = await fetchJsonSafe(`${base}/category_coins_map.json`).catch(() => null);

      if (mapJson && typeof mapJson === 'object') {
        const categories = (mapJson as any).categories && typeof (mapJson as any).categories === 'object'
          ? (mapJson as any).categories
          : mapJson;

        if (categories && typeof categories === 'object') {
          setCatCoinMap(categories as Record<string, string[]>);
        } else {
          setCatCoinMap(null);
        }
      } else {
        setCatCoinMap(null);
        if (!catWarnDismissed) {
          setCatWarn('Dados de categoria sem mapping local (category_coins_map.json ausente). Gainers/Losers e filtro por moedas dependem desse mapping.');
        }
      }
    } catch (e: any) {
      console.error('Categories load error', e);
      setCatWarn('Falha ao carregar categorias locais em /cachecko/categories/.');
    } finally {
      setCatLoading(false);
      catInFlightRef.current = false;
    }
  }, [catWarnDismissed]);

  useEffect(() => { loadCoins(); }, [loadCoins]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buyRef.current && !buyRef.current.contains(t)) setBuyOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // ✅ Carrega categorias apenas quando entra no modo categories
  useEffect(() => {
    if (viewMode === 'categories') loadCategoriesLocal();
  }, [viewMode, loadCategoriesLocal]);

  // ✅ Sempre que trocar “view” ou “nível”, sobe pro topo
  useEffect(() => {
    scrollToTop();
  }, [viewMode, activeMasterId, activeSubId, activeCategoryId, scrollToTop]);

  const refresh = useCallback(() => {
    if (viewMode === 'categories') loadCategoriesLocal();
    else loadCoins();
  }, [viewMode, loadCategoriesLocal, loadCoins]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    setSortConfig({ key, direction });
    setTopMode('none');
    setPage(0);
    scrollToTop();
  };

  const handleCatSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (catSortConfig.key === key && catSortConfig.direction === 'desc') direction = 'asc';
    setCatSortConfig({ key, direction });
    scrollToTop();
  };

  // ---------- Taxonomy parsing (masters + subs) ----------
  const parsedTaxonomy = useMemo(() => {
    const raw = taxonomy;
    let masters: any[] = [];

    if (Array.isArray(raw)) masters = raw;
    else if (raw && Array.isArray((raw as any).masters)) masters = (raw as any).masters;
    else if (raw && Array.isArray((raw as any).items)) masters = (raw as any).items;

    return masters
      .filter(Boolean)
      .map((m: any) => ({
        id: String(m.id ?? m.key ?? m.name ?? '').trim(),
        name: String(m.name ?? m.title ?? m.id ?? '').trim(),
        categoryIds: Array.isArray(m.categoryIds) ? m.categoryIds.map(String) : Array.isArray(m.categories) ? m.categories.map(String) : [],
        children: Array.isArray(m.children) ? m.children : Array.isArray(m.groups) ? m.groups : [],
      }))
      .filter((m: any) => m.id);
  }, [taxonomy]);

  const masterById = useMemo(() => {
    const map = new Map<string, any>();
    for (const m of parsedTaxonomy) map.set(m.id, m);
    return map;
  }, [parsedTaxonomy]);

  const selectedMaster = useMemo(() => {
    if (!activeMasterId) return null;
    return masterById.get(activeMasterId) || null;
  }, [activeMasterId, masterById]);

  const subOptions = useMemo(() => {
    if (!selectedMaster || !Array.isArray(selectedMaster.children) || selectedMaster.children.length === 0) return [];
    const subs = selectedMaster.children
      .filter(Boolean)
      .map((c: any) => ({
        id: String(c.id ?? c.key ?? c.name ?? '').trim(),
        name: String(c.name ?? c.title ?? c.id ?? '').trim(),
        categoryIds: Array.isArray(c.categoryIds) ? c.categoryIds.map(String) : Array.isArray(c.categories) ? c.categories.map(String) : [],
      }))
      .filter((x: any) => x.id);

    return [{ id: '__all__', name: 'Todas', categoryIds: [] as string[] }, ...subs];
  }, [selectedMaster]);

  // category name resolver
  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of catList) {
      const id = String((c as any).category_id ?? (c as any).id ?? '').trim();
      const nm = String((c as any).name ?? '').trim();
      if (id && nm) map.set(id, nm);
    }
    for (const c of catMarket) {
      const id = String((c as any).category_id ?? (c as any).id ?? (c as any).categoryId ?? '').trim();
      const nm = String((c as any).name ?? '').trim();
      if (id && nm) map.set(id, nm);
    }
    return map;
  }, [catList, catMarket]);

  // ✅ Nome “humano” da categoria atual pro cabeçalho
  const activeCategoryLabel = useMemo(() => {
    if (viewMode !== 'coins') return '';
    if (activeMasterId && selectedMaster) {
      const masterName = String(selectedMaster.name || '').trim();
      if (activeSubId && activeSubId !== '__all__') {
        const sub = subOptions.find(s => s.id === activeSubId);
        const subName = String(sub?.name || '').trim();
        return subName ? `${masterName} / ${subName}` : masterName;
      }
      return masterName;
    }
    if (activeCategoryId && activeCategoryId !== '__all__') {
      return categoryNameById.get(activeCategoryId) || activeCategoryId;
    }
    return '';
  }, [viewMode, activeMasterId, selectedMaster, activeSubId, subOptions, activeCategoryId, categoryNameById]);

  // ---------- Coin map -> sets ----------
  const coinById = useMemo(() => {
    const m = new Map<string, ApiCoin>();
    for (const c of coins) {
      if (c?.id) m.set(String(c.id), c);
    }
    return m;
  }, [coins]);

  const categoryCoinIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!catCoinMap) return map;

    for (const [catId, arr] of Object.entries(catCoinMap)) {
      if (!catId || !Array.isArray(arr)) continue;
      map.set(String(catId), new Set(arr.map(x => String(x))));
    }
    return map;
  }, [catCoinMap]);

  const getCoinPct24h = (c: ApiCoin) => {
    const v = (c as any).price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h;
    return isFinite(v) ? Number(v) : 0;
  };

  const getCoinPct1h = (c: ApiCoin) => {
    const v = (c as any).price_change_percentage_1h_in_currency;
    if (isFinite(v)) return Number(v);
    return pctFromSpark(c.sparkline_in_7d?.price, 1);
  };

  const getCoinPct7d = (c: ApiCoin) => {
    const v = (c as any).price_change_percentage_7d_in_currency;
    if (isFinite(v)) return Number(v);
    return pct7dFromSpark(c.sparkline_in_7d?.price);
  };

  const buildCategorySpark = (members: ApiCoin[]) => {
    const valid = members.filter(c => Array.isArray(c.sparkline_in_7d?.price) && c.sparkline_in_7d!.price!.length > 10);
    if (valid.length < 2) return null;

    const N = Math.min(...valid.map(c => c.sparkline_in_7d!.price!.length));
    if (!isFinite(N) || N < 10) return null;

    const weights = valid.map(c => Math.max(0, Number(c.market_cap || 0)));
    const wSum = weights.reduce((a, b) => a + b, 0) || 0;
    const useWeighted = wSum > 0;

    const series: { i: number; v: number }[] = [];
    for (let i = 0; i < N; i++) {
      let acc = 0;
      let accW = 0;

      for (let k = 0; k < valid.length; k++) {
        const arr = valid[k].sparkline_in_7d!.price!;
        const first = arr[0];
        const cur = arr[i];
        if (!isFinite(first) || first === 0 || !isFinite(cur)) continue;

        const pct = ((cur - first) / first) * 100;
        const w = useWeighted ? weights[k] : 1;
        if (w <= 0) continue;

        acc += pct * w;
        accW += w;
      }

      if (accW <= 0) return null;
      series.push({ i, v: acc / accW });
    }
    return series;
  };

  const membersFromCategoryIds = useCallback((catIds: string[]) => {
    const seen = new Set<string>();
    const members: ApiCoin[] = [];

    for (const cid of catIds) {
      const setIds = categoryCoinIds.get(cid);
      if (!setIds) continue;

      for (const id of setIds) {
        if (seen.has(id)) continue;
        seen.add(id);

        const c = coinById.get(id);
        if (c) members.push(c);
      }
    }
    return members;
  }, [categoryCoinIds, coinById]);

  const computeStatsFromCatIds = useCallback((catIds: string[], displayName: string) => {
    const members = membersFromCategoryIds(catIds);

    const coinsCount = members.length;
    const marketCap = members.reduce((s, c) => s + (Number(c.market_cap || 0) || 0), 0);
    const volume24h = members.reduce((s, c) => s + (Number(c.total_volume || 0) || 0), 0);

    const wSum = members.reduce((s, c) => s + (Number(c.market_cap || 0) || 0), 0);
    const wAvg = (getter: (c: ApiCoin) => number) => {
      if (wSum > 0) {
        let acc = 0;
        for (const c of members) {
          const w = Number(c.market_cap || 0) || 0;
          const v = getter(c);
          if (!isFinite(v)) continue;
          acc += w * v;
        }
        return acc / wSum;
      }
      const vals = members.map(getter).filter(v => isFinite(v));
      if (vals.length === 0) return NaN;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };

    const ch1h = wAvg(getCoinPct1h);
    const ch24h = wAvg(getCoinPct24h);
    const ch7d = wAvg(getCoinPct7d);

    const by24h = [...members].sort((a, b) => (getCoinPct24h(b) - getCoinPct24h(a)));
    const gainers = by24h.slice(0, 3);
    const losers = by24h.slice(-3).reverse();

    const spark = buildCategorySpark(members);

    return {
      name: displayName,
      coinsCount,
      marketCap,
      volume24h,
      ch1h,
      ch24h,
      ch7d,
      gainers,
      losers,
      spark,
      members
    };
  }, [membersFromCategoryIds]);

  // --------- category rows (MASTERS ONLY) ----------
  const masterRows = useMemo(() => {
    const q = (searchTerm || '').toLowerCase().trim();

    const rows = parsedTaxonomy
      .filter(m => {
        if (!q) return true;
        return String(m.name || '').toLowerCase().includes(q) || String(m.id || '').toLowerCase().includes(q);
      })
      .map((m) => {
        const masterCatIds: string[] = [];

        for (const id of (Array.isArray(m.categoryIds) ? m.categoryIds : [])) masterCatIds.push(String(id));

        const kids = Array.isArray(m.children) ? m.children : [];
        for (const k of kids) {
          const arr = Array.isArray((k as any).categoryIds) ? (k as any).categoryIds : Array.isArray((k as any).categories) ? (k as any).categories : [];
          for (const id of arr) masterCatIds.push(String(id));
        }

        const uniqueCatIds = Array.from(new Set(masterCatIds)).filter(Boolean);
        const stats = computeStatsFromCatIds(uniqueCatIds, m.name || m.id);

        return {
          id: m.id,
          displayName: m.name || m.id,
          catIds: uniqueCatIds,
          ...stats
        };
      })
      .filter(r => Number(r.coinsCount || 0) > 0);

    const dir = catSortConfig.direction === 'asc' ? 1 : -1;
    const sortKey = String(catSortConfig.key);

    rows.sort((a: any, b: any) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];

      if (typeof av === 'string' || typeof bv === 'string') {
        const r = String(av ?? '').localeCompare(String(bv ?? ''));
        return r * dir;
      }

      const an = isFinite(av) ? Number(av) : 0;
      const bn = isFinite(bv) ? Number(bv) : 0;
      if (an < bn) return -1 * dir;
      if (an > bn) return 1 * dir;
      return 0;
    });

    return rows;
  }, [parsedTaxonomy, searchTerm, computeStatsFromCatIds, catSortConfig]);

  // --------- COINS table filtering ----------
  const activeFilter = useMemo(() => {
    if (activeMasterId && selectedMaster) {
      if (activeSubId && activeSubId !== '__all__') {
        const sub = (subOptions || []).find(s => s.id === activeSubId);
        const catIds = sub?.categoryIds && sub.categoryIds.length > 0 ? sub.categoryIds : [];
        return { mode: 'master-sub', catIds };
      }

      const catIds: string[] = [];
      for (const id of (Array.isArray(selectedMaster.categoryIds) ? selectedMaster.categoryIds : [])) catIds.push(String(id));

      const kids = Array.isArray(selectedMaster.children) ? selectedMaster.children : [];
      for (const k of kids) {
        const arr = Array.isArray((k as any).categoryIds) ? (k as any).categoryIds : Array.isArray((k as any).categories) ? (k as any).categories : [];
        for (const id of arr) catIds.push(String(id));
      }

      const unique = Array.from(new Set(catIds)).filter(Boolean);
      return { mode: 'master-all', catIds: unique };
    }

    if (activeCategoryId !== '__all__') {
      return { mode: 'single', catIds: [activeCategoryId] };
    }

    return { mode: 'none', catIds: [] as string[] };
  }, [activeMasterId, selectedMaster, activeSubId, subOptions, activeCategoryId]);

  const allowedCoinIdsSet = useMemo(() => {
    if (!activeFilter.catIds || activeFilter.catIds.length === 0) return null;

    const union = new Set<string>();
    for (const cid of activeFilter.catIds) {
      const setIds = categoryCoinIds.get(cid);
      if (!setIds) continue;
      for (const id of setIds) union.add(id);
    }
    return union;
  }, [activeFilter, categoryCoinIds]);

  const filteredSortedCoins = useMemo(() => {
    let items = [...coins];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      items = items.filter(c => c.name?.toLowerCase().includes(q) || c.symbol?.toLowerCase().includes(q));
    }

    if (favOnly) {
      items = items.filter(c => !!favorites[c.id]);
    } else {
      if (allowedCoinIdsSet) {
        items = items.filter(c => allowedCoinIdsSet.has(String(c.id)));
      }
    }

    const getVal = (c: ApiCoin, key: string) => {
      const prices = c.sparkline_in_7d?.price;
      if (key === 'change_1h_est') return pctFromSpark(prices, 1);
      if (key === 'change_7d_est') return pct7dFromSpark(prices);
      return (c as any)[key];
    };

    const sortKey = sortConfig.key as string;

    items.sort((a: any, b: any) => {
      const aVal = getVal(a, sortKey);
      const bVal = getVal(b, sortKey);

      if (typeof aVal === 'string' || typeof bVal === 'string') {
        const as = String(aVal ?? '');
        const bs = String(bVal ?? '');
        const r = as.localeCompare(bs);
        return sortConfig.direction === 'asc' ? r : -r;
      }

      const an = isFinite(aVal) ? Number(aVal) : 0;
      const bn = isFinite(bVal) ? Number(bVal) : 0;

      if (an < bn) return sortConfig.direction === 'asc' ? -1 : 1;
      if (an > bn) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return items;
  }, [coins, searchTerm, favOnly, favorites, allowedCoinIdsSet, sortConfig]);

  const totalCount = filteredSortedCoins.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages - 1);

  const pageCoins = useMemo(() => {
    const start = safePage * pageSize;
    return filteredSortedCoins.slice(start, start + pageSize);
  }, [filteredSortedCoins, safePage, pageSize]);

  useEffect(() => { setPage(0); }, [
    searchTerm,
    favOnly,
    pageSize,
    activeMasterId,
    activeSubId,
    activeCategoryId,
    viewMode
  ]);

  const Paginator = ({ compact = false }: { compact?: boolean }) => {
    const start = safePage * pageSize + 1;
    const end = Math.min(totalCount, (safePage + 1) * pageSize);

    return (
      <div className={`flex items-center gap-2 ${compact ? '' : 'justify-between w-full'}`}>
        {!compact && (
          <div className="text-xs font-bold text-gray-500 dark:text-slate-400">
            {totalCount === 0 ? t.noResults : `${t.showing} ${start}-${end} ${t.of} ${totalCount}`}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setPage(p => Math.max(0, p - 1)); scrollToTop(); }}
            disabled={safePage === 0}
            className={`px-2.5 py-2 rounded-lg border text-sm font-black transition-colors
${safePage === 0
                ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-700 text-gray-400'
                : 'border-slate-200 dark:border-slate-700 text-gray-600 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            title={t.prev}
          >
            <ChevronLeft size={18} />
          </button>

          <div className="text-xs font-black text-gray-600 dark:text-slate-300 px-2">
            {safePage + 1} / {totalPages}
          </div>

          <button
            onClick={() => { setPage(p => Math.min(totalPages - 1, p + 1)); scrollToTop(); }}
            disabled={safePage >= totalPages - 1}
            className={`px-2.5 py-2 rounded-lg border text-sm font-black transition-colors
${safePage >= totalPages - 1
                ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-700 text-gray-400'
                : 'border-slate-200 dark:border-slate-700 text-gray-600 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            title={t.next}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  };

  // ✅ Larguras por % (coins)
  const COIN_WIDTHS = {
    rank: 'w-[4%]',
    asset: 'w-[18%]',
    price: 'w-[12%]',
    ch1h: 'w-[8%]',
    ch24h: 'w-[8%]',
    ch7d: 'w-[8%]',
    mcap: 'w-[12%]',
    vol24h: 'w-[12%]',
    supply: 'w-[10%]',
    spark7d: 'w-[8%]'
  };

  // ✅ Larguras por % (categories)
  const CAT_WIDTHS = {
    category: 'w-[20%]',
    gainers: 'w-[12%]',
    losers: 'w-[12%]',
    ch1h: 'w-[8%]',
    ch24h: 'w-[8%]',
    ch7d: 'w-[8%]',
    mcap: 'w-[12%]',
    vol24h: 'w-[10%]',
    coins: 'w-[8%]',
    spark7d: 'w-[10%]'
  };

  const SortableHeader: React.FC<{ id: string; label: string }> = ({ id, label }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      cursor: 'move'
    };

    // @ts-ignore
    const w = viewMode === 'categories' ? CAT_WIDTHS[id] : COIN_WIDTHS[id];
    const isRight = id !== 'asset' && id !== 'category' && id !== 'gainers' && id !== 'losers';
    const isCenter = id === 'rank' || id === 'coins';
    const align = isRight ? 'justify-end' : isCenter ? 'justify-center' : 'justify-start';

    // mapping sort keys
    let sortKey = '';
    if (viewMode === 'categories') {
      if (id === 'category') sortKey = 'displayName';
      if (id === 'mcap') sortKey = 'marketCap';
      if (id === 'vol24h') sortKey = 'volume24h';
      if (id === 'ch1h') sortKey = 'ch1h';
      if (id === 'ch24h') sortKey = 'ch24h';
      if (id === 'ch7d') sortKey = 'ch7d';
      if (id === 'coins') sortKey = 'coinsCount';
    } else {
      if (id === 'rank') sortKey = 'market_cap_rank';
      if (id === 'asset') sortKey = 'name';
      if (id === 'price') sortKey = 'current_price';
      if (id === 'mcap') sortKey = 'market_cap';
      if (id === 'vol24h') sortKey = 'total_volume';
      if (id === 'supply') sortKey = 'circulating_supply';
      if (id === 'ch1h') sortKey = 'change_1h_est';
      if (id === 'ch24h') sortKey = 'price_change_percentage_24h';
      if (id === 'ch7d') sortKey = 'change_7d_est';
    }

    const isActive = viewMode === 'categories' ? (catSortConfig.key === sortKey) : (sortConfig.key === sortKey);
    const dir = viewMode === 'categories' ? catSortConfig.direction : sortConfig.direction;

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`shrink-0 px-2 flex items-center ${w} ${align} group select-none`}
        {...attributes}
        {...listeners}
        onClick={() => sortKey && (viewMode === 'categories' ? handleCatSort(sortKey) : handleSort(sortKey))}
      >
        <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${isActive ? 'text-[#dd9933]' : 'text-gray-500 dark:text-slate-400 group-hover:text-gray-800 dark:group-hover:text-slate-200'}`}>
          {label}
          {isActive && <ChevronsUpDown size={12} className={dir === 'asc' ? 'rotate-180' : ''} />}
        </span>
      </div>
    );
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      if (viewMode === 'categories') {
        setCatColOrder((items) => {
          const oldIndex = items.indexOf(active.id);
          const newIndex = items.indexOf(over.id);
          return arrayMove(items, oldIndex, newIndex);
        });
      } else {
        setColOrder((items) => {
          const oldIndex = items.indexOf(active.id);
          const newIndex = items.indexOf(over.id);
          return arrayMove(items, oldIndex, newIndex);
        });
      }
    }
  };

  return (
    <div className="w-full h-full bg-white dark:bg-[#1a1c1e] flex flex-col font-sans relative">
      {/* --- HEADER --- */}
      <div className="flex flex-col gap-3 p-4 border-b border-gray-100 dark:border-slate-800/50 bg-white dark:bg-[#1a1c1e] z-20 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
              {viewMode === 'categories' ? 'Categorias' : t.asset}
              <span className="text-xs bg-gray-100 dark:bg-slate-800 text-gray-500 px-2 py-0.5 rounded-full">{viewMode === 'categories' ? masterRows.length : totalCount}</span>
            </h2>

            <div className="h-5 w-px bg-gray-200 dark:bg-slate-700"></div>

            <div className="flex bg-gray-100 dark:bg-slate-800/50 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('coins')}
                className={`px-3 py-1 text-xs font-black uppercase rounded transition-all ${viewMode === 'coins' ? 'bg-white dark:bg-[#2f3032] text-[#dd9933] shadow-sm' : 'text-gray-500'}`}
              >
                Moedas
              </button>
              <button
                onClick={() => setViewMode('categories')}
                className={`px-3 py-1 text-xs font-black uppercase rounded transition-all ${viewMode === 'categories' ? 'bg-white dark:bg-[#2f3032] text-[#dd9933] shadow-sm' : 'text-gray-500'}`}
              >
                Categorias
              </button>
            </div>

            {/* CATEGORY NAV (Only if coins view and a filter active) */}
            {viewMode === 'coins' && activeFilter.mode !== 'none' && (
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/10 px-3 py-1 rounded-lg border border-blue-100 dark:border-blue-900/30">
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Filtro:</span>
                <span className="text-xs font-black text-blue-700 dark:text-blue-300">{activeCategoryLabel}</span>
                <button
                  onClick={() => {
                    setActiveMasterId(null);
                    setActiveSubId('__all__');
                    setActiveCategoryId('__all__');
                  }}
                  className="ml-2 text-blue-400 hover:text-blue-600"
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {viewMode === 'coins' && (
              <div className="flex bg-gray-100 dark:bg-slate-800/50 p-1 rounded-lg">
                <button onClick={() => setFavOnly(!favOnly)} className={`p-1.5 rounded transition-colors ${favOnly ? 'bg-yellow-400 text-black shadow-sm' : 'text-gray-400 hover:text-yellow-400'}`}>
                  <Star size={14} className={favOnly ? 'fill-black' : ''} />
                </button>
              </div>
            )}

            <div className="relative group">
              <Search className="absolute left-3 top-2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder={viewMode === 'categories' ? t.searchCategory : t.searchPlaceholder}
                className="pl-9 pr-4 py-1.5 bg-gray-100 dark:bg-slate-800/50 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-200 outline-none w-40 focus:w-60 transition-all focus:ring-1 focus:ring-[#dd9933]"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <button
              onClick={() => { setResetRot(r => r + 360); refresh(); }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-gray-500"
              style={{ transform: `rotate(${resetRot}deg)`, transition: 'transform 0.5s ease' }}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* COIN VIEW: CATEGORY SELECTORS */}
        {viewMode === 'coins' && (
          <div className="flex flex-wrap gap-3 items-center pt-2 border-t border-dashed border-gray-100 dark:border-slate-800/50">
            {/* 1) Master Select */}
            <div className="relative group">
              <select
                value={activeMasterId || ''}
                onChange={e => {
                  const val = e.target.value;
                  setActiveMasterId(val || null);
                  setActiveSubId('__all__'); // reset sub
                  setActiveCategoryId('__all__'); // reset simple cat
                }}
                className="appearance-none bg-gray-50 dark:bg-slate-800/30 border border-gray-200 dark:border-slate-700 rounded-lg py-1 pl-3 pr-8 text-xs font-bold text-gray-700 dark:text-gray-300 outline-none cursor-pointer hover:border-[#dd9933] transition-colors"
              >
                <option value="">Todas as Áreas</option>
                {parsedTaxonomy.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-2 text-gray-400 pointer-events-none" />
            </div>

            {/* 2) Sub Select (if master selected & has children) */}
            {activeMasterId && subOptions.length > 1 && (
              <div className="relative group animate-in slide-in-from-left-2 duration-300">
                <select
                  value={activeSubId}
                  onChange={e => setActiveSubId(e.target.value)}
                  className="appearance-none bg-gray-50 dark:bg-slate-800/30 border border-gray-200 dark:border-slate-700 rounded-lg py-1 pl-3 pr-8 text-xs font-bold text-gray-700 dark:text-gray-300 outline-none cursor-pointer hover:border-[#dd9933] transition-colors"
                >
                  {subOptions.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-2 text-gray-400 pointer-events-none" />
              </div>
            )}

            {/* 3) Fallback Simple Category List (if no master selected) */}
            {!activeMasterId && catList.length > 0 && (
              <div className="relative group">
                <select
                  value={activeCategoryId}
                  onChange={e => setActiveCategoryId(e.target.value)}
                  className="appearance-none bg-gray-50 dark:bg-slate-800/30 border border-gray-200 dark:border-slate-700 rounded-lg py-1 pl-3 pr-8 text-xs font-bold text-gray-700 dark:text-gray-300 outline-none cursor-pointer hover:border-[#dd9933] transition-colors max-w-[200px]"
                >
                  <option value="__all__">Filtrar Categoria...</option>
                  {catList
                    .filter(c => (c as any).name)
                    .sort((a, b) => (a as any).name.localeCompare((b as any).name))
                    .map((c: any) => (
                      <option key={c.category_id || c.id} value={c.category_id || c.id}>
                        {c.name}
                      </option>
                    ))
                  }
                </select>
                <ChevronDown size={12} className="absolute right-2 top-2 text-gray-400 pointer-events-none" />
              </div>
            )}
          </div>
        )}
      </div>

      {catWarn && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/30 flex justify-between items-center text-xs text-amber-700 dark:text-amber-400">
          <span>{catWarn}</span>
          <button onClick={() => setCatWarnDismissed(true)} className="hover:text-amber-900 dark:hover:text-amber-200 font-bold">X</button>
        </div>
      )}

      {/* --- CONTENT --- */}
      <div className="flex-1 overflow-auto custom-scrollbar relative bg-white dark:bg-[#1a1c1e]">
        {loading || (viewMode === 'categories' && catLoading) ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/20 backdrop-blur-sm z-30">
            <Loader2 className="animate-spin text-[#dd9933]" size={32} />
          </div>
        ) : null}

        {/* HEADERS */}
        <div className="sticky top-0 z-20 bg-gray-50 dark:bg-[#151719] border-b border-gray-200 dark:border-slate-800 h-[36px] flex items-center">
          <DndContext sensors={[sensors]} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={viewMode === 'categories' ? catColOrder : colOrder} strategy={horizontalListSortingStrategy}>
              {(viewMode === 'categories' ? catColOrder : colOrder).map((col) => (
                <SortableHeader key={col} id={col} label={
                  col === 'rank' ? t.rank :
                    col === 'asset' ? t.asset :
                      col === 'price' ? t.price :
                        col === 'ch1h' ? '1h %' :
                          col === 'ch24h' ? '24h %' :
                            col === 'ch7d' ? '7d %' :
                              col === 'mcap' ? 'M.Cap' :
                                col === 'vol24h' ? t.vol :
                                  col === 'supply' ? t.supply :
                                    col === 'spark7d' ? t.chart :
                                      col === 'category' ? t.categories :
                                        col === 'gainers' ? 'Top Gain' :
                                          col === 'losers' ? 'Top Loss' :
                                            col === 'coins' ? 'Coins' : col
                } />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* LIST */}
        <div className="pb-10">
          {viewMode === 'coins' ? (
            pageCoins.length > 0 ? (
              pageCoins.map((coin, idx) => (
                <LiveCoinRow
                  key={coin.id}
                  coin={coin}
                  index={idx}
                  colOrder={colOrder}
                  favorites={favorites}
                  toggleFav={(id: string) => setFavorites(prev => ({ ...prev, [id]: !prev[id] }))}
                  COIN_WIDTHS={COIN_WIDTHS}
                />
              ))
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-slate-500 text-sm font-bold uppercase tracking-widest">
                {t.noResults}
              </div>
            )
          ) : (
            // CATEGORIES VIEW (STATIC LIST)
            masterRows.map((cat, idx) => (
              <div key={cat.id} className="flex items-center hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-slate-800/50 h-[56px] group cursor-pointer"
                onClick={() => {
                  // Drill down logic: set this master as active filter and switch to coins
                  setActiveMasterId(cat.id);
                  setActiveSubId('__all__');
                  setViewMode('coins');
                }}
              >
                {catColOrder.map(col => {
                  // @ts-ignore
                  const w = CAT_WIDTHS[col] || 'w-20';
                  const isRight = ['mcap', 'vol24h', 'ch1h', 'ch24h', 'ch7d', 'coins', 'spark7d'].includes(col);
                  const align = isRight ? 'justify-end text-right' : 'justify-start text-left';

                  return (
                    <div key={col} className={`shrink-0 px-2 flex items-center ${w} ${align} text-xs h-full`}>
                      {col === 'category' && (
                        <div className="font-bold text-gray-800 dark:text-gray-200 truncate pr-2 group-hover:text-[#dd9933] transition-colors uppercase tracking-tight">
                          {cat.displayName}
                        </div>
                      )}
                      {col === 'coins' && <span className="font-mono text-gray-500">{cat.coinsCount}</span>}
                      {col === 'mcap' && <span className="font-mono text-gray-600 dark:text-slate-400">{formatCompactNumber(cat.marketCap)}</span>}
                      {col === 'vol24h' && <span className="font-mono text-gray-600 dark:text-slate-400">{formatCompactNumber(cat.volume24h)}</span>}
                      {col === 'ch1h' && <span className={`font-bold ${cat.ch1h >= 0 ? 'text-green-500' : 'text-red-500'}`}>{safePct(cat.ch1h)}</span>}
                      {col === 'ch24h' && <span className={`font-bold ${cat.ch24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>{safePct(cat.ch24h)}</span>}
                      {col === 'ch7d' && <span className={`font-bold ${cat.ch7d >= 0 ? 'text-green-500' : 'text-red-500'}`}>{safePct(cat.ch7d)}</span>}

                      {col === 'gainers' && (
                        <div className="flex -space-x-1">
                          {cat.gainers.map((c: any) => (
                            <img key={c.id} src={c.image} className="w-5 h-5 rounded-full border border-white dark:border-slate-800" title={`${c.symbol}: ${safePct(getCoinPct24h(c))}`} />
                          ))}
                        </div>
                      )}
                      {col === 'losers' && (
                        <div className="flex -space-x-1">
                          {cat.losers.map((c: any) => (
                            <img key={c.id} src={c.image} className="w-5 h-5 rounded-full border border-white dark:border-slate-800 grayscale opacity-70" title={`${c.symbol}: ${safePct(getCoinPct24h(c))}`} />
                          ))}
                        </div>
                      )}

                      {col === 'spark7d' && cat.spark && (
                        <div className="h-8 w-24 ml-auto opacity-70">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={cat.spark}>
                              <Area type="monotone" dataKey="v" stroke={cat.ch7d >= 0 ? GREEN : RED} fill="none" strokeWidth={1.5} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* FOOTER */}
      {viewMode === 'coins' && (
        <div className="shrink-0 p-3 bg-white dark:bg-[#1a1c1e] border-t border-gray-100 dark:border-slate-800 z-30 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          <div className="flex items-center gap-4">
            <Paginator compact />
            <div className="h-4 w-px bg-gray-200 dark:bg-slate-700"></div>
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              className="bg-gray-100 dark:bg-slate-800/50 text-xs font-bold px-2 py-1 rounded outline-none border-none text-gray-700 dark:text-gray-300"
            >
              <option value={50}>50 / pág</option>
              <option value={100}>100 / pág</option>
              <option value={200}>200 / pág</option>
            </select>
          </div>

          <div className="relative" ref={buyRef}>
            <button
              onClick={() => setBuyOpen(!buyOpen)}
              className="bg-[#dd9933] hover:bg-amber-600 text-white px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 transform active:scale-95"
            >
              {t.buy} <ChevronDown size={14} className={buyOpen ? 'rotate-180' : ''} />
            </button>
            {buyOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-[#25282c] border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2">
                <div className="p-2 space-y-1">
                  <a href="https://accounts.binance.com/register?ref=36286244" target="_blank" className="block px-4 py-2.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors flex justify-between items-center group">
                    Binance <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                  <a href="https://www.bybit.com/invite?ref=Q7611" target="_blank" className="block px-4 py-2.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors flex justify-between items-center group">
                    Bybit <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                  <a href="https://bingx.com/invite/OSF6CV" target="_blank" className="block px-4 py-2.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors flex justify-between items-center group">
                    BingX <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                  <a href="https://www.mexc.com/register?inviteCode=127sD" target="_blank" className="block px-4 py-2.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors flex justify-between items-center group">
                    MEXC <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                  <a href="https://www.bitget.com/referral/register?clacCode=0X1234" target="_blank" className="block px-4 py-2.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors flex justify-between items-center group">
                    Bitget <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketCapTable;