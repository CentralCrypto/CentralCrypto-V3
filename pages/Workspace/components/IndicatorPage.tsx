
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ApiCoin, Language, WidgetType, UserTier } from '../../../types';
import { getTranslations } from '../../../locales';
import CryptoWidget from './CryptoWidget';
import MarketWindSwarm from './MarketWindSwarm';

import {
  Activity,
  ArrowUpRight,
  BarChart2,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleDashed,
  ExternalLink,
  GripVertical,
  LayoutGrid,
  List,
  Loader2,
  Lock,
  PieChart,
  RefreshCw,
  Search,
  Star,
  TrendingUp,
  User,
  Wind
} from 'lucide-react';

import { fetchTopCoins } from '../services/api';

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
// @ts-ignore FIX: Alias useSortable to avoid potential naming collisions.
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable as useDndKitSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';

// --- HELPERS ---

const formatUSD = (val: number, compact = false) => {
  if (val === undefined || val === null) return "---";
  if (compact) {
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  }
  return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const safePct = (v: number) => {
  if (!isFinite(v)) return '--';
  const s = v >= 0 ? '+' : '';
  return `${s}${v.toFixed(2)}%`;
};

// CoinGecko sparkline_in_7d geralmente vem em pontos horários (168).
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

function LockOverlay() {
  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center rounded-xl">
      <Lock size={40} className="text-[#dd9933] mb-4" />
      <h3 className="text-xl font-bold text-white mb-2">Upgrade Required</h3>
      <p className="text-gray-300 text-sm mb-4">Subscribe to Tier 2 or higher to access this page.</p>
    </div>
  );
}

function PageHeader({ title, description }: { title: string, description: string }) {
  return (
    <div className="bg-white dark:bg-[#1a1c1e] p-6 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm transition-colors mb-4 shrink-0">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
      <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">{description}</p>
    </div>
  );
}

// --- FAQ COMPONENT ---

function PageFaq({ language, pageType }: { language: Language, pageType: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const t = getTranslations(language).workspace.pages.faq;

  const faqData = useMemo(() => {
    switch(pageType) {
      case 'FNG': return t.fng;
      case 'RSI': return t.rsi;
      case 'MACD': return t.macd;
      case 'ALTSEASON': return t.altseason;
      case 'ETF': return t.etf;
      case 'LSR': return t.lsr;
      case 'TRUMP': return t.trump;
      case 'CALENDAR': return t.calendar;
      case 'HEATMAP': return t.heatmap;
      case 'BUBBLE_HEATMAP': return t.bubble;
      default: return null;
    }
  }, [pageType, t]);

  if (!faqData) return null;

  const items = [
    { q: faqData.q1, a: faqData.a1 },
    { q: faqData.q2, a: faqData.a2 }
  ];

  return (
    <div className="mt-8 mb-12 max-w-4xl mx-auto px-4">
      <h3 className="text-xl font-black text-gray-800 dark:text-[#dd9933] uppercase tracking-widest text-center mb-8">Metodologia e FAQ</h3>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="bg-white dark:bg-[#1a1c1e] border border-gray-100 dark:border-tech-800 rounded-xl overflow-hidden shadow-sm transition-all duration-500">
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between p-5 text-left group"
            >
              <span className={`font-bold text-base transition-colors ${openIndex === i ? 'text-[#dd9933]' : 'text-gray-700 dark:text-gray-300'}`}>{item.q}</span>
              <ChevronDown size={20} className={`text-gray-400 transition-transform duration-500 ${openIndex === i ? 'rotate-180 text-[#dd9933]' : ''}`} />
            </button>
            <div className={`transition-all duration-500 ease-in-out ${openIndex === i ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="p-5 pt-0 text-base text-gray-500 dark:text-slate-400 leading-relaxed border-t border-transparent dark:border-white/5">
                <div dangerouslySetInnerHTML={{ __html: item.a }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- MARKET CAP TABLE ---

const MarketCapTable = ({ language }: { language: Language }) => {
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

  // quick sort buttons
  const [quickSort, setQuickSort] = useState<'none' | 'gainers' | 'losers'>('none');

  // BUY
  const [buyOpen, setBuyOpen] = useState(false);
  const buyRef = useRef<HTMLDivElement | null>(null);

  // ⭐ favorites
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [favOnly, setFavOnly] = useState(false);

  // category filter (aplica na tabela de coins)
  const [activeCategoryId, setActiveCategoryId] = useState<string>('__all__');

  // categories datasets (local cachecko)
  const [catLoading, setCatLoading] = useState(false);
  const [catWarn, setCatWarn] = useState<string>('');
  const [catWarnDismissed, setCatWarnDismissed] = useState(false);

  const [taxonomy, setTaxonomy] = useState<any>(null);
  const [catList, setCatList] = useState<any[]>([]);
  const [catMarket, setCatMarket] = useState<any[]>([]);
  const [catCoinMap, setCatCoinMap] = useState<Record<string, string[]> | null>(null);

  // dropdown levels (sem menu lateral)
  const [masterKey, setMasterKey] = useState<string>('__all__');
  const [subKey, setSubKey] = useState<string>('__all__');

  // Column reorder (dnd-kit)
  const DEFAULT_COLS: string[] = [
    'rank',
    'asset',
    'price',
    'ch1h',
    'ch24h',
    'ch7d',
    'mcap',
    'vol24h',
    'vol7d',
    'supply',
    'spark7d',
  ];
  const [colOrder, setColOrder] = useState<string[]>(DEFAULT_COLS);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchTopCoins();
      if (data && Array.isArray(data)) setCoins(data);
    } catch (e) {
      console.error('MarketCap load error', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchJsonSafe = async (url: string) => {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${url} -> ${r.status}`);
    return r.json();
  };

  const loadCategoriesLocal = async () => {
    if (catLoading) return;
    setCatLoading(true);
    setCatWarn('');

    try {
      const base = '/cachecko/categories';
      const [
        taxonomyJson,
        listJson,
        marketJson,
      ] = await Promise.all([
        fetchJsonSafe(`${base}/taxonomy-master.json`).catch(() => null),
        fetchJsonSafe(`${base}/coingecko_categories_list.json`).catch(() => []),
        fetchJsonSafe(`${base}/coingecko_categories_market.json`).catch(() => []),
      ]);

      setTaxonomy(taxonomyJson);
      setCatList(Array.isArray(listJson) ? listJson : []);
      setCatMarket(Array.isArray(marketJson) ? marketJson : []);

      // mapping é opcional (snapshot)
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
          setCatWarn('Dados de categoria não indexados localmente (category_coins_map.json ausente). A lista de categorias funciona, mas o filtro por moedas pode ficar limitado.');
        }
      }
    } catch (e: any) {
      console.error('Categories load error', e);
      setCatWarn('Falha ao carregar categorias locais em /cachecko/categories/.');
    } finally {
      setCatLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buyRef.current && !buyRef.current.contains(t)) setBuyOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // ao entrar na view categories, carrega os JSONs locais
  useEffect(() => {
    if (viewMode === 'categories') loadCategoriesLocal();
  }, [viewMode]);

  const applyQuickSort = (mode: 'none' | 'gainers' | 'losers') => {
    setQuickSort(mode);
    setPage(0);

    if (mode === 'gainers') {
      setSortConfig({ key: 'price_change_percentage_24h', direction: 'desc' });
      return;
    }
    if (mode === 'losers') {
      setSortConfig({ key: 'price_change_percentage_24h', direction: 'asc' });
      return;
    }

    setSortConfig({ key: 'market_cap_rank', direction: 'asc' });
  };

  const handleSort = (key: string) => {
    setQuickSort('none');

    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    setSortConfig({ key, direction });
    setPage(0);
  };

  // ---------- Taxonomy parsing (suporta 2 ou 3 níveis) ----------
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
        categoryIds: Array.isArray(m.categoryIds) ? m.categoryIds : Array.isArray(m.categories) ? m.categories : [],
        children: Array.isArray(m.children) ? m.children : Array.isArray(m.groups) ? m.groups : [],
      }))
      .filter((m: any) => m.id);
  }, [taxonomy]);

  const masterOptions = useMemo(() => {
    const opts = parsedTaxonomy.map((m: any) => ({ id: m.id, name: m.name, children: m.children, categoryIds: m.categoryIds }));
    return [{ id: '__all__', name: 'Todas' }, ...opts];
  }, [parsedTaxonomy]);

  const selectedMaster = useMemo(() => {
    if (masterKey === '__all__') return null;
    return parsedTaxonomy.find((m: any) => m.id === masterKey) || null;
  }, [parsedTaxonomy, masterKey]);

  const subOptions = useMemo(() => {
    if (!selectedMaster || !Array.isArray(selectedMaster.children) || selectedMaster.children.length === 0) {
      return [{ id: '__all__', name: 'Todas' }];
    }
    const opts = selectedMaster.children
      .filter(Boolean)
      .map((c: any) => ({
        id: String(c.id ?? c.key ?? c.name ?? '').trim(),
        name: String(c.name ?? c.title ?? c.id ?? '').trim(),
        categoryIds: Array.isArray(c.categoryIds) ? c.categoryIds : Array.isArray(c.categories) ? c.categories : [],
      }))
      .filter((x: any) => x.id);

    return [{ id: '__all__', name: 'Todas' }, ...opts];
  }, [selectedMaster]);

  useEffect(() => { setSubKey('__all__'); }, [masterKey]);

  const visibleCategoryIds = useMemo(() => {
    if (masterKey === '__all__') {
      const ids = new Set<string>();
      for (const c of catList) {
        const id = String((c as any).category_id ?? (c as any).id ?? '').trim();
        if (id) ids.add(id);
      }
      for (const c of catMarket) {
        const id = String((c as any).category_id ?? (c as any).id ?? (c as any).categoryId ?? '').trim();
        if (id) ids.add(id);
      }
      return Array.from(ids);
    }

    if (!selectedMaster) return [];
    const hasChildren = Array.isArray(selectedMaster.children) && selectedMaster.children.length > 0;

    if (hasChildren) {
      if (subKey === '__all__') {
        const ids = new Set<string>();
        for (const sg of selectedMaster.children) {
          const arr = Array.isArray(sg.categoryIds) ? sg.categoryIds : Array.isArray(sg.categories) ? sg.categories : [];
          for (const id of arr) if (id) ids.add(String(id));
        }
        return Array.from(ids);
      }
      const sg = subOptions.find((x: any) => x.id === subKey);
      const arr = sg && Array.isArray((sg as any).categoryIds) ? (sg as any).categoryIds : [];
      return arr.map((x: any) => String(x));
    }

    const arr = Array.isArray(selectedMaster.categoryIds) ? selectedMaster.categoryIds : [];
    return arr.map((x: any) => String(x));
  }, [catList, catMarket, masterKey, selectedMaster, subKey, subOptions]);

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

  const catMarketById = useMemo(() => {
    const map = new Map<string, any>();
    for (const c of catMarket) {
      const id = String((c as any).category_id ?? (c as any).id ?? (c as any).categoryId ?? '').trim();
      if (id) map.set(id, c);
    }
    return map;
  }, [catMarket]);

  // ---------- Category aggregates from coins dataset (quando map existe) ----------
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
      map.set(catId, new Set(arr.map(x => String(x))));
    }
    return map;
  }, [catCoinMap]);

  const getCoinPct1h = (c: ApiCoin) => {
    const v = (c as any).price_change_percentage_1h_in_currency;
    if (isFinite(v)) return Number(v);
    return pctFromSpark(c.sparkline_in_7d?.price, 1);
  };

  const getCoinPct24h = (c: ApiCoin) => {
    const v = (c as any).price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h;
    return isFinite(v) ? Number(v) : 0;
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

  const computeCategoryStats = (categoryId: string) => {
    const setIds = categoryCoinIds.get(categoryId);
    const name = categoryNameById.get(categoryId) || categoryId;

    if (!setIds || setIds.size === 0) {
      const mk = catMarketById.get(categoryId);
      const coinsCount = Number((mk as any)?.coin_counter ?? (mk as any)?.coins ?? 0) || 0;

      return {
        id: categoryId,
        name,
        coinsCount,
        marketCap: Number((mk as any)?.market_cap ?? (mk as any)?.marketCap ?? 0) || 0,
        volume24h: Number((mk as any)?.volume_24h ?? (mk as any)?.volume24h ?? (mk as any)?.total_volume ?? 0) || 0,
        ch1h: Number((mk as any)?.market_cap_change_1h ?? (mk as any)?.change_1h ?? (mk as any)?.price_change_percentage_1h_in_currency ?? NaN),
        ch24h: Number((mk as any)?.market_cap_change_24h ?? (mk as any)?.change_24h ?? (mk as any)?.price_change_percentage_24h_in_currency ?? NaN),
        ch7d: Number((mk as any)?.market_cap_change_7d ?? (mk as any)?.change_7d ?? (mk as any)?.price_change_percentage_7d_in_currency ?? NaN),
        gainers: [] as ApiCoin[],
        losers: [] as ApiCoin[],
        spark: null as any,
        hasMap: false,
      };
    }

    const members: ApiCoin[] = [];
    for (const id of setIds) {
      const c = coinById.get(id);
      if (c) members.push(c);
    }

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
      id: categoryId,
      name,
      coinsCount,
      marketCap,
      volume24h,
      ch1h,
      ch24h,
      ch7d,
      gainers,
      losers,
      spark,
      hasMap: true,
    };
  };

  // ---------- Coin table filtering ----------
  const filteredSortedCoins = useMemo(() => {
    let items = [...coins];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      items = items.filter(c => c.name?.toLowerCase().includes(q) || c.symbol?.toLowerCase().includes(q));
    }

    if (favOnly) {
      items = items.filter(c => !!favorites[c.id]);
    }

    if (activeCategoryId !== '__all__') {
      const setIds = categoryCoinIds.get(activeCategoryId);
      if (setIds && setIds.size > 0) {
        items = items.filter(c => setIds.has(String(c.id)));
      }
    }

    const getVal = (c: ApiCoin, key: string) => {
      const prices = c.sparkline_in_7d?.price;

      if (key === 'change_1h_est') return pctFromSpark(prices, 1);
      if (key === 'change_7d_est') return pct7dFromSpark(prices);
      if (key === 'vol_7d_est') return (c.total_volume || 0) * 7;

      if (key === 'price_change_percentage_24h') {
        const v = (c as any).price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h;
        return isFinite(v) ? Number(v) : 0;
      }

      // @ts-ignore
      return c[key];
    };

    items.sort((a: any, b: any) => {
      const aVal = getVal(a, sortConfig.key);
      const bVal = getVal(b, sortConfig.key);

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
  }, [coins, searchTerm, favOnly, favorites, activeCategoryId, categoryCoinIds, sortConfig]);

  const totalCount = filteredSortedCoins.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages - 1);

  const pageCoins = useMemo(() => {
    const start = safePage * pageSize;
    return filteredSortedCoins.slice(start, start + pageSize);
  }, [filteredSortedCoins, safePage, pageSize]);

  useEffect(() => { setPage(0); }, [searchTerm, favOnly, pageSize, activeCategoryId]);

  const Paginator = ({ compact = false }: { compact?: boolean }) => {
    const start = safePage * pageSize + 1;
    const end = Math.min(totalCount, (safePage + 1) * pageSize);

    return (
      <div className={`flex items-center gap-2 ${compact ? '' : 'justify-between w-full'}`}>
        {!compact && (
          <div className="text-xs font-bold text-gray-500 dark:text-slate-400">
            {totalCount === 0 ? '0 resultados' : `Mostrando ${start}-${end} de ${totalCount}`}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className={`px-2.5 py-2 rounded-lg border text-sm font-black transition-colors
              ${safePage === 0
                ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-700 text-gray-400'
                : 'border-slate-200 dark:border-slate-700 text-gray-600 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            title="Página anterior"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="text-xs font-black text-gray-600 dark:text-slate-300 px-2">
            {safePage + 1} / {totalPages}
          </div>

          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className={`px-2.5 py-2 rounded-lg border text-sm font-black transition-colors
              ${safePage >= totalPages - 1
                ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-700 text-gray-400'
                : 'border-slate-200 dark:border-slate-700 text-gray-600 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            title="Próxima página"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  };

  // widths ajustados
  const COLS: Record<string, {
    id: string;
    label: string;
    sortKey?: string;
    align?: 'left' | 'center' | 'right';
    w: string;
  }> = {
    rank: { id: 'rank', label: '#', sortKey: 'market_cap_rank', align: 'center', w: 'w-[64px]' },
    asset: { id: 'asset', label: 'Ativo', sortKey: 'name', align: 'left', w: 'w-[260px]' },
    price: { id: 'price', label: 'Preço', sortKey: 'current_price', align: 'right', w: 'w-[120px]' },
    ch1h: { id: 'ch1h', label: '1h %', sortKey: 'change_1h_est', align: 'right', w: 'w-[80px]' },
    ch24h: { id: 'ch24h', label: '24h %', sortKey: 'price_change_percentage_24h', align: 'right', w: 'w-[90px]' },
    ch7d: { id: 'ch7d', label: '7d %', sortKey: 'change_7d_est', align: 'right', w: 'w-[90px]' },
    mcap: { id: 'mcap', label: 'Market Cap', sortKey: 'market_cap', align: 'right', w: 'w-[140px]' },
    vol24h: { id: 'vol24h', label: 'Vol (24h)', sortKey: 'total_volume', align: 'right', w: 'w-[120px]' },
    vol7d: { id: 'vol7d', label: 'Vol (7d)', sortKey: 'vol_7d_est', align: 'right', w: 'w-[120px]' },
    supply: { id: 'supply', label: 'Circ. Supply', sortKey: 'circulating_supply', align: 'right', w: 'w-[150px]' },
    spark7d: { id: 'spark7d', label: 'Mini-chart (7d)', sortKey: undefined, align: 'center', w: 'w-[300px]' },
  };

  const SortIcon = ({ active }: { active: boolean }) => (
    <ChevronsUpDown size={14} className={`text-gray-400 group-hover:text-tech-accent ${active ? 'text-tech-accent' : ''}`} />
  );

  // Header: puxador sempre à esquerda, TEXTO SEMPRE CENTRALIZADO no espaço total da coluna
  const SortableTh = ({
    colId,
    label,
    sortKey,
    w,
  }: {
    colId: string;
    label: string;
    sortKey?: string;
    align?: 'left' | 'center' | 'right';
    w: string;
  }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useDndKitSortable({ id: colId });
    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.6 : 1,
    };

    return (
      <th
        ref={setNodeRef}
        style={style}
        className={`relative h-[54px] p-0 select-none group border-b border-gray-100 dark:border-slate-800 ${w}
          hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-center`}
      >
        {/* Grip fixo à esquerda */}
        <span
          className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 rounded-md
            hover:bg-gray-200 dark:hover:bg-white/10 text-gray-400"
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
          title="Arraste para reordenar"
        >
          <GripVertical size={16} />
        </span>

        {/* Botão ocupa toda a coluna e centraliza o texto */}
        <button
          type="button"
          className="w-full h-full inline-flex items-center justify-center gap-1 font-black uppercase tracking-widest text-xs
            text-gray-400 dark:text-slate-400 px-10 text-center"
          onClick={() => sortKey && handleSort(sortKey)}
          disabled={!sortKey}
          title={sortKey ? 'Ordenar' : ''}
        >
          <span className="whitespace-nowrap">{label}</span>
          {sortKey ? <SortIcon active={sortConfig.key === sortKey} /> : null}
        </button>
      </th>
    );
  };

  const onDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    const oldIndex = colOrder.indexOf(active.id);
    const newIndex = colOrder.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    setColOrder(prev => arrayMove(prev, oldIndex, newIndex));
  };

  const CategoryRowLogos = ({ arr }: { arr: ApiCoin[] }) => {
    return (
      <div className="flex items-center justify-center gap-1">
        {arr.slice(0, 3).map((c, i) => (
          <img
            key={`${c.id}_${i}`}
            src={c.image}
            alt=""
            className="w-6 h-6 rounded-full bg-slate-100 dark:bg-[#242628] p-0.5 border border-slate-200 dark:border-white/10"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        ))}
        {arr.length === 0 && <span className="text-xs font-bold text-gray-400 dark:text-slate-500">—</span>}
      </div>
    );
  };

  const CategoriesTable = () => {
    const rows = visibleCategoryIds
      .map((id) => computeCategoryStats(id))
      .filter((r) => r && r.name)
      .filter((r: any) => Number(r.coinsCount || 0) > 0); // <-- some categorias com 0 moedas

    const q = (searchTerm || '').toLowerCase().trim();
    const filtered = q
      ? rows.filter(r => String(r.name).toLowerCase().includes(q) || String(r.id).toLowerCase().includes(q))
      : rows;

    filtered.sort((a, b) => (Number(b.marketCap || 0) - Number(a.marketCap || 0)));

    return (
      <div className="overflow-x-auto">
        {catLoading && filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Loader2 className="animate-spin mb-2" size={32} />
            <span className="font-bold text-sm uppercase tracking-widest animate-pulse">Carregando Categorias...</span>
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[1400px] table-fixed">
            <thead className="sticky top-0 z-20 bg-white dark:bg-[#2f3032]">
              <tr className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-400 border-b border-gray-100 dark:border-slate-800 h-[54px]">
                <th className="p-3 w-[360px] text-center">Categoria</th>
                <th className="p-3 text-center w-[160px]">Top Gainers</th>
                <th className="p-3 text-center w-[160px]">Top Losers</th>
                <th className="p-3 text-center w-[90px]">1h</th>
                <th className="p-3 text-center w-[90px]">24h</th>
                <th className="p-3 text-center w-[90px]">7d</th>
                <th className="p-3 text-center w-[160px]">Market Cap</th>
                <th className="p-3 text-center w-[150px]">24h Volume</th>
                <th className="p-3 text-center w-[110px]"># Coins</th>
                <th className="p-3 text-center w-[240px]">Gráfico (7d)</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {filtered.map((r: any) => {
                const pos24 = isFinite(r.ch24h) ? (Number(r.ch24h) >= 0) : true;

                return (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors cursor-pointer h-[56px]"
                    onClick={() => {
                      if (categoryCoinIds.get(r.id)?.size) {
                        setActiveCategoryId(r.id);
                        setViewMode('coins');
                        setPage(0);
                        setQuickSort('none');
                        setSortConfig({ key: 'market_cap', direction: 'desc' });
                      } else {
                        if (!catWarnDismissed) {
                          setCatWarn('Sem snapshot/mapping local para aplicar filtro de moedas nessa categoria. Gere category_coins_map.json.');
                        }
                      }
                    }}
                    title="Clique para filtrar a tabela principal"
                  >
                    <td className="p-3 w-[360px]">
                      {/* Só o nome. SEM ID técnico embaixo. */}
                      <div className="flex flex-col min-w-0">
                        <span className="text-[14px] font-black text-gray-900 dark:text-white truncate">
                          {r.name}
                        </span>
                      </div>
                    </td>

                    <td className="p-3 text-center w-[160px]">
                      <CategoryRowLogos arr={r.gainers || []} />
                    </td>

                    <td className="p-3 text-center w-[160px]">
                      <CategoryRowLogos arr={r.losers || []} />
                    </td>

                    <td className={`p-3 text-center font-mono text-[13px] font-black w-[90px] ${!isFinite(r.ch1h) ? 'text-gray-400 dark:text-slate-500' : (r.ch1h >= 0 ? 'text-green-500' : 'text-red-500')}`}>
                      {safePct(Number(r.ch1h))}
                    </td>

                    <td className={`p-3 text-center font-mono text-[13px] font-black w-[90px] ${!isFinite(r.ch24h) ? 'text-gray-400 dark:text-slate-500' : (pos24 ? 'text-green-500' : 'text-red-500')}`}>
                      {safePct(Number(r.ch24h))}
                    </td>

                    <td className={`p-3 text-center font-mono text-[13px] font-black w-[90px] ${!isFinite(r.ch7d) ? 'text-gray-400 dark:text-slate-500' : (r.ch7d >= 0 ? 'text-green-500' : 'text-red-500')}`}>
                      {safePct(Number(r.ch7d))}
                    </td>

                    <td className="p-3 text-center font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400 w-[160px]">
                      {formatUSD(Number(r.marketCap || 0), true)}
                    </td>

                    <td className="p-3 text-center font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400 w-[150px]">
                      {formatUSD(Number(r.volume24h || 0), true)}
                    </td>

                    <td className="p-3 text-center font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400 w-[110px]">
                      {Number(r.coinsCount || 0).toLocaleString()}
                    </td>

                    <td className="p-3 w-[240px]">
                      <div className="w-full h-10">
                        {Array.isArray(r.spark) && r.spark.length > 5 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={r.spark}>
                              <defs>
                                <linearGradient id={`cg_${r.id}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={pos24 ? '#26a269' : '#e01b24'} stopOpacity={0.55} />
                                  <stop offset="75%" stopColor={pos24 ? '#26a269' : '#e01b24'} stopOpacity={0.18} />
                                  <stop offset="100%" stopColor={pos24 ? '#26a269' : '#e01b24'} stopOpacity={0.02} />
                                </linearGradient>
                              </defs>
                              <Area
                                type="monotone"
                                dataKey="v"
                                stroke={pos24 ? '#26a269' : '#e01b24'}
                                strokeWidth={2}
                                fill={`url(#cg_${r.id})`}
                                fillOpacity={1}
                                isAnimationActive={false}
                                dot={false}
                              />
                              <YAxis domain={['auto', 'auto']} hide />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400 dark:text-slate-500">
                            —
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-sm font-bold text-gray-500 dark:text-slate-400">
                    Nenhuma categoria encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    );
  };

  // helper pra dropdown ficar dark de verdade
  const darkSelectClass =
    "bg-white dark:bg-[#2f3032] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-black " +
    "text-gray-800 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 outline-none";

  const darkSelectStyle: React.CSSProperties = {
    // isso força o navegador a renderizar o dropdown nativo em dark quando o tema está dark
    colorScheme: 'dark',
  };

  return (
    <div className="bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-100 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col">

      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex flex-col gap-3 bg-gray-50/50 dark:bg-black/20 shrink-0">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-3">

          {/* LEFT GROUP */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="relative w-full lg:w-[420px]">
              <Search size={18} className="absolute left-3 top-2.5 text-gray-500" />
              <input
                type="text"
                placeholder={viewMode === 'categories' ? 'Buscar categoria...' : 'Buscar ativo...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-[#2f3032] rounded-lg py-2.5 pl-11 pr-4 text-[15px] text-gray-900 dark:text-white focus:border-[#dd9933] outline-none transition-all shadow-inner border border-slate-100 dark:border-slate-700"
              />
            </div>

            <button
              type="button"
              onClick={() => setFavOnly(v => !v)}
              className={`px-3 py-2 rounded-lg border font-black transition-colors whitespace-nowrap
                ${favOnly
                  ? 'bg-[#dd9933] text-black border-transparent'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2f3032] text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5'
                }`}
              title="Filtrar favoritos"
            >
              Favoritos
            </button>

            {viewMode === 'coins' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('categories');
                    setQuickSort('none');
                  }}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2f3032] text-gray-700 dark:text-slate-200 font-black hover:bg-gray-100 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
                  title="Abrir categorias"
                >
                  Categorias
                </button>

                <button
                  type="button"
                  onClick={() => applyQuickSort(quickSort === 'gainers' ? 'none' : 'gainers')}
                  className={`px-3 py-2 rounded-lg border font-black transition-colors whitespace-nowrap
                    ${quickSort === 'gainers'
                      ? 'bg-[#dd9933] text-black border-transparent'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2f3032] text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5'
                    }`}
                  title="Ordenar por 24h% (maior → menor)"
                >
                  Top Gainers
                </button>

                <button
                  type="button"
                  onClick={() => applyQuickSort(quickSort === 'losers' ? 'none' : 'losers')}
                  className={`px-3 py-2 rounded-lg border font-black transition-colors whitespace-nowrap
                    ${quickSort === 'losers'
                      ? 'bg-[#dd9933] text-black border-transparent'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2f3032] text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5'
                    }`}
                  title="Ordenar por 24h% (menor → maior)"
                >
                  Top Losers
                </button>
              </>
            ) : (
              <>
                <select
                  value={masterKey}
                  onChange={(e) => setMasterKey(e.target.value)}
                  className={darkSelectClass}
                  style={darkSelectStyle}
                  title="Master"
                >
                  {masterOptions.map((o: any) => (
                    <option key={o.id} value={o.id} className="bg-[#2f3032] text-slate-200">
                      {o.name}
                    </option>
                  ))}
                </select>

                {subOptions.length > 1 && (
                  <select
                    value={subKey}
                    onChange={(e) => setSubKey(e.target.value)}
                    className={darkSelectClass}
                    style={darkSelectStyle}
                    title="Subcategoria"
                  >
                    {subOptions.map((o: any) => (
                      <option key={o.id} value={o.id} className="bg-[#2f3032] text-slate-200">
                        {o.name}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  onClick={() => setViewMode('coins')}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2f3032] text-gray-700 dark:text-slate-200 font-black hover:bg-gray-100 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
                  title="Voltar para Marketcap"
                >
                  Voltar
                </button>
              </>
            )}

            {viewMode === 'coins' && activeCategoryId !== '__all__' && (
              <button
                type="button"
                onClick={() => setActiveCategoryId('__all__')}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2f3032] text-gray-700 dark:text-slate-200 font-black hover:bg-gray-100 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
                title="Limpar filtro de categoria"
              >
                Limpar
              </button>
            )}

            {/* BUY */}
            <div className="relative" ref={buyRef}>
              <button
                onClick={() => setBuyOpen(v => !v)}
                className="px-3 py-2 rounded-lg bg-[#dd9933] text-black font-black hover:opacity-90 transition-opacity flex items-center gap-2 whitespace-nowrap"
                title="BUY"
              >
                BUY <ChevronDown size={16} />
              </button>

              {buyOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-white dark:bg-[#2f3032] border border-slate-100 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
                  <a
                    href="https://www.bybit.com/invite?ref=JMBYZW"
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-white/5 text-sm font-black text-gray-800 dark:text-slate-200"
                  >
                    Bybit
                    <ExternalLink size={16} className="text-gray-400" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT GROUP */}
          <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest">
                Itens
              </span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                className={darkSelectClass}
                style={darkSelectStyle}
                title="Quantidade por página"
              >
                <option value={25} className="bg-[#2f3032] text-slate-200">25</option>
                <option value={50} className="bg-[#2f3032] text-slate-200">50</option>
                <option value={75} className="bg-[#2f3032] text-slate-200">75</option>
                <option value={100} className="bg-[#2f3032] text-slate-200">100</option>
              </select>
            </div>

            <Paginator compact />

            <button
              onClick={() => {
                if (viewMode === 'categories') loadCategoriesLocal();
                else load();
              }}
              className="p-2.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-gray-500 transition-colors"
              title="Atualizar"
            >
              <RefreshCw size={22} className={(loading || catLoading) ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {viewMode === 'categories' && catWarn && !catWarnDismissed && (
          <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20">
            <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
              {catWarn}
            </div>
            <button
              type="button"
              onClick={() => setCatWarnDismissed(true)}
              className="text-xs font-black px-2 py-1 rounded-md bg-amber-200/70 dark:bg-amber-800/40 text-amber-900 dark:text-amber-100 hover:opacity-90"
            >
              OK
            </button>
          </div>
        )}
      </div>

      {/* BODY */}
      {viewMode === 'categories' ? (
        <CategoriesTable />
      ) : (
        <div className="overflow-x-auto">
          {loading && coins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <Loader2 className="animate-spin mb-2" size={32} />
              <span className="font-bold text-sm uppercase tracking-widest animate-pulse">Sincronizando Mercado...</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[1480px] table-fixed">
              <thead className="sticky top-0 z-20 bg-white dark:bg-[#2f3032]">
                <tr className="border-b border-gray-100 dark:border-slate-800 h-[54px]">
                  <th className="p-0 w-[48px] text-center">
                    <span className="inline-flex w-full h-full items-center justify-center text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-400">
                      Fav
                    </span>
                  </th>

                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={colOrder} strategy={horizontalListSortingStrategy}>
                      {colOrder.map((cid) => {
                        const c = COLS[cid];
                        return (
                          <SortableTh
                            key={c.id}
                            colId={c.id}
                            label={c.label}
                            sortKey={c.sortKey}
                            align={c.align}
                            w={c.w}
                          />
                        );
                      })}
                    </SortableContext>
                  </DndContext>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {pageCoins.map((coin) => {
                  const change24 =
                    (coin as any).price_change_percentage_24h_in_currency ??
                    coin.price_change_percentage_24h ??
                    0;

                  const isPos24 = Number(change24 || 0) >= 0;

                  const prices = coin.sparkline_in_7d?.price;
                  const c1h = pctFromSpark(prices, 1);
                  const c7d = pct7dFromSpark(prices);
                  const vol7d = (coin.total_volume || 0) * 7;

                  const sparkData = Array.isArray(prices) ? prices.map((v, i) => ({ i, v })) : [];

                  const isFav = !!favorites[coin.id];

                  return (
                    <tr key={coin.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors group h-[56px]">
                      <td className="p-0 w-[48px] text-center">
                        <button
                          type="button"
                          onClick={() => setFavorites(prev => ({ ...prev, [coin.id]: !prev[coin.id] }))}
                          className="inline-flex items-center justify-center w-full h-[56px] hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                          title="Favoritar"
                        >
                          <Star size={18} className={isFav ? 'text-[#dd9933]' : 'text-gray-400'} />
                        </button>
                      </td>

                      {colOrder.map((cid) => {
                        if (cid === 'rank') {
                          return (
                            <td key={cid} className={`p-3 text-[13px] font-black text-gray-400 ${COLS.rank.w} text-center`}>
                              #{coin.market_cap_rank}
                            </td>
                          );
                        }

                        if (cid === 'asset') {
                          return (
                            <td key={cid} className={`p-3 ${COLS.asset.w}`}>
                              <div className="flex items-center gap-3 min-w-0">
                                <img
                                  src={coin.image}
                                  alt=""
                                  className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#242628] p-1 border border-slate-200 dark:border-white/10 shadow-sm shrink-0"
                                  onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[15px] font-black text-gray-900 dark:text-white leading-none group-hover:text-[#dd9933] transition-colors truncate">
                                    {coin.name}
                                  </span>
                                  <span className="text-xs font-bold text-gray-500 uppercase mt-1 truncate">
                                    {coin.symbol}
                                  </span>
                                </div>
                              </div>
                            </td>
                          );
                        }

                        if (cid === 'price') {
                          return (
                            <td key={cid} className={`p-3 text-right font-mono text-[15px] font-black text-gray-900 dark:text-slate-200 ${COLS.price.w}`}>
                              {formatUSD(coin.current_price)}
                            </td>
                          );
                        }

                        if (cid === 'ch1h') {
                          return (
                            <td
                              key={cid}
                              className={`p-3 text-right font-mono text-[13px] font-black ${COLS.ch1h.w} ${!isFinite(c1h) ? 'text-gray-400 dark:text-slate-500' : (c1h >= 0 ? 'text-green-500' : 'text-red-500')}`}
                              title="Estimativa via sparkline 7d"
                            >
                              {safePct(c1h)}
                            </td>
                          );
                        }

                        if (cid === 'ch24h') {
                          return (
                            <td key={cid} className={`p-3 text-right font-mono text-[15px] font-black ${COLS.ch24h.w} ${isPos24 ? 'text-green-500' : 'text-red-500'}`}>
                              {isPos24 ? '+' : ''}{Number(change24 || 0).toFixed(2)}%
                            </td>
                          );
                        }

                        if (cid === 'ch7d') {
                          return (
                            <td
                              key={cid}
                              className={`p-3 text-right font-mono text-[13px] font-black ${COLS.ch7d.w} ${!isFinite(c7d) ? 'text-gray-400 dark:text-slate-500' : (c7d >= 0 ? 'text-green-500' : 'text-red-500')}`}
                              title="Estimativa via sparkline 7d"
                            >
                              {safePct(c7d)}
                            </td>
                          );
                        }

                        if (cid === 'mcap') {
                          return (
                            <td key={cid} className={`p-3 text-right font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400 ${COLS.mcap.w}`}>
                              {formatUSD(coin.market_cap, true)}
                            </td>
                          );
                        }

                        if (cid === 'vol24h') {
                          return (
                            <td key={cid} className={`p-3 text-right font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400 ${COLS.vol24h.w}`}>
                              {formatUSD(coin.total_volume, true)}
                            </td>
                          );
                        }

                        if (cid === 'vol7d') {
                          return (
                            <td key={cid} className={`p-3 text-right font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400 ${COLS.vol7d.w}`} title="Estimativa simples: Vol(24h) * 7">
                              {formatUSD(vol7d, true)}
                            </td>
                          );
                        }

                        if (cid === 'supply') {
                          return (
                            <td key={cid} className={`p-3 text-right font-mono text-[12px] font-bold text-gray-500 dark:text-slate-500 ${COLS.supply.w}`}>
                              {coin.circulating_supply?.toLocaleString()} <span className="uppercase opacity-50">{coin.symbol}</span>
                            </td>
                          );
                        }

                        if (cid === 'spark7d') {
                          return (
                            <td key={cid} className={`p-3 ${COLS.spark7d.w}`}>
                              <div className="w-full h-12 min-w-0">
                                {sparkData.length > 1 ? (
                                  <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={sparkData}>
                                      <defs>
                                        <linearGradient id={`g_${coin.id}`} x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="0%" stopColor={isPos24 ? '#26a269' : '#e01b24'} stopOpacity={0.55} />
                                          <stop offset="75%" stopColor={isPos24 ? '#26a269' : '#e01b24'} stopOpacity={0.18} />
                                          <stop offset="100%" stopColor={isPos24 ? '#26a269' : '#e01b24'} stopOpacity={0.02} />
                                        </linearGradient>
                                      </defs>
                                      <Area
                                        type="monotone"
                                        dataKey="v"
                                        stroke={isPos24 ? '#26a269' : '#e01b24'}
                                        strokeWidth={2}
                                        fill={`url(#g_${coin.id})`}
                                        fillOpacity={1}
                                        isAnimationActive={false}
                                        dot={false}
                                      />
                                      <YAxis domain={['auto', 'auto']} hide />
                                    </AreaChart>
                                  </ResponsiveContainer>
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400 dark:text-slate-500">
                                    —
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        }

                        return <td key={cid} className="p-3" />;
                      })}
                    </tr>
                  );
                })}

                {pageCoins.length === 0 && (
                  <tr>
                    <td colSpan={1 + colOrder.length} className="p-8 text-center text-sm font-bold text-gray-500 dark:text-slate-400">
                      Nenhum resultado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-black/20 shrink-0">
        <Paginator />
      </div>
    </div>
  );
};

// --- MAIN PAGE WRAPPER ---

interface IndicatorPageProps {
  language: Language;
  coinMap: Record<string, ApiCoin>;
  userTier: UserTier;
}

type PageType = 'MARKETCAP' | 'RSI' | 'MACD' | 'FNG' | 'LSR' | 'ALTSEASON' | 'ETF' | 'GAINERS' | 'HEATMAP' | 'BUBBLE_HEATMAP' | 'SWARM' | 'CALENDAR' | 'TRUMP';

function IndicatorPage({ language, coinMap, userTier }: IndicatorPageProps) {
  const [activePage, setActivePage] = useState<PageType>('MARKETCAP');
  const tWs = getTranslations(language).workspace.widgets;
  const tPages = getTranslations(language).workspace.pages;

  const GROUPS = [
    { title: 'Market', items: [
      { id: 'MARKETCAP' as PageType, label: tPages.marketcap, icon: <List size={18} /> },
      { id: 'GAINERS' as PageType, label: tPages.topmovers, icon: <TrendingUp size={18} /> },
      { id: 'HEATMAP' as PageType, label: "Heatmap Square", icon: <LayoutGrid size={18} /> },
      { id: 'BUBBLE_HEATMAP' as PageType, label: "Crypto Bubbles", icon: <CircleDashed size={18} /> },
      { id: 'SWARM' as PageType, label: tPages.swarm, icon: <Wind size={18} /> },
      { id: 'RSI' as PageType, label: tWs.rsi.title, icon: <Activity size={18} /> },
      { id: 'MACD' as PageType, label: tWs.macd.title, icon: <BarChart2 size={18} /> },
      { id: 'LSR' as PageType, label: tWs.lsr.title, icon: <BarChart2 size={18} /> },
    ] },
    { title: 'Global', items: [
      { id: 'CALENDAR' as PageType, label: tWs.calendar.title, icon: <Calendar size={18} /> },
      { id: 'ETF' as PageType, label: tWs.etf.title, icon: <ArrowUpRight size={18} /> },
    ] },
    { title: 'Sentiment', items: [
      { id: 'FNG' as PageType, label: tWs.fng.title, icon: <PieChart size={18} /> },
      { id: 'ALTSEASON' as PageType, label: tWs.altseason.title, icon: <Activity size={18} /> },
      { id: 'TRUMP' as PageType, label: "Trump-o-Meter", icon: <User size={18} /> },
    ] }
  ];

  let currentPage = GROUPS[0].items[0];
  for (const group of GROUPS) {
    const found = group.items.find(item => item.id === activePage);
    if (found) { currentPage = found; break; }
  }

  return (
    <div className="flex flex-col w-full h-[calc(100vh-160px)] overflow-hidden">
      <div className="flex h-full w-full gap-4 overflow-hidden">
        {/* Sidebar */}
        <div className={`w-64 flex-shrink-0 bg-white dark:bg-[#1a1c1e] border border-gray-100 dark:border-slate-800 rounded-xl flex-col overflow-hidden shadow-sm transition-all duration-300 shrink-0 ${activePage === 'SWARM' ? 'hidden' : 'flex'}`}>
          <div className="p-4 border-b border-gray-100 dark:border-slate-800 font-black text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wider">Dashboard Pages</div>
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            {GROUPS.map((group, groupIdx) => (
              <div key={groupIdx} className="mb-4">
                <div className="px-4 py-2 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">{group.title}</div>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActivePage(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-black transition-all tracking-wide ${activePage === item.id ? 'bg-[#dd9933] text-black shadow-md' : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#2f3032]'}`}
                    >
                      {item.icon}{item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className={`flex-1 flex-col min-w-0 h-full overflow-y-auto custom-scrollbar pr-1 ${activePage === 'SWARM' ? 'hidden' : 'flex'}`}>
          <PageHeader title={currentPage.label} description="Dados analíticos e ferramentas de mercado em tempo real." />

          <div className="flex-1 min-h-[600px] relative">
            {activePage === 'MARKETCAP' && <MarketCapTable language={language} />}
            {activePage === 'ALTSEASON' && <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800"><CryptoWidget item={{ id: 'altseason-page', type: WidgetType.ALTCOIN_SEASON, title: 'Altcoin Season Index', symbol: 'GLOBAL', isMaximized: true }} language={language} /></div>}
            {activePage === 'ETF' && <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800"><CryptoWidget item={{ id: 'etf-page', type: WidgetType.ETF_NET_FLOW, title: 'ETF Net Flow', symbol: 'GLOBAL', isMaximized: true }} language={language} /></div>}
            {activePage === 'FNG' && <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800"><CryptoWidget item={{ id: 'fng-page', type: WidgetType.FEAR_GREED, title: 'Fear & Greed Index', symbol: 'GLOBAL', isMaximized: true }} language={language} /></div>}
            {activePage === 'RSI' && <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800"><CryptoWidget item={{ id: 'rsi-page', type: WidgetType.RSI_AVG, title: 'RSI Average Tracker', symbol: 'MARKET', isMaximized: true }} language={language} /></div>}
            {activePage === 'MACD' && <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800"><CryptoWidget item={{ id: 'macd-page', type: WidgetType.MACD_AVG, title: 'MACD Average Tracker', symbol: 'MARKET', isMaximized: true }} language={language} /></div>}
            {activePage === 'GAINERS' && <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800"><CryptoWidget item={{ id: 'gainers-page', type: WidgetType.GAINERS_LOSERS, title: 'Top Movers (24h)', symbol: 'MARKET', isMaximized: true }} language={language} /></div>}
            {activePage === 'HEATMAP' && <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800"><CryptoWidget item={{ id: 'heatmap-page', type: WidgetType.HEATMAP, title: 'Crypto Heatmap', symbol: 'MARKET', isMaximized: true }} language={language} /></div>}
            {activePage === 'BUBBLE_HEATMAP' && <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800"><CryptoWidget item={{ id: 'bubble-page', type: WidgetType.BUBBLE_HEATMAP, title: 'Crypto Bubbles', symbol: 'MARKET', isMaximized: true }} language={language} /></div>}
            {activePage === 'CALENDAR' && <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800"><CryptoWidget item={{ id: 'cal-page', type: WidgetType.CALENDAR, title: 'Calendar', symbol: 'CAL', isMaximized: true }} language={language} /></div>}
            {activePage === 'TRUMP' && <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800"><CryptoWidget item={{ id: 'trump-page', type: WidgetType.TRUMP_METER, title: 'Trump-o-Meter', symbol: 'SENTIMENT', isMaximized: true }} language={language} /></div>}
            {activePage === 'LSR' && (
              <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800 relative">
                {userTier === UserTier.TIER_1 && <LockOverlay />}
                <div className={userTier === UserTier.TIER_1 ? 'blur-sm h-full' : 'h-full'}>
                  <CryptoWidget item={{ id: 'lsr-page', type: WidgetType.LONG_SHORT_RATIO, title: 'Long/Short Ratio', symbol: 'GLOBAL', isMaximized: true }} language={language} />
                </div>
              </div>
            )}
          </div>
          <PageFaq language={language} pageType={activePage} />
        </div>
        
        {/* Fullscreen SWARM modal */}
        {activePage === 'SWARM' && (
            <MarketWindSwarm language={language} onClose={() => setActivePage('MARKETCAP')} />
        )}
      </div>
    </div>
  );
}

export default IndicatorPage;
