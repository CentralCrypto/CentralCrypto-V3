
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
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
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

const LockOverlay = () => (
  <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center rounded-xl">
    <Lock size={40} className="text-[#dd9933] mb-4" />
    <h3 className="text-xl font-bold text-white mb-2">Upgrade Required</h3>
    <p className="text-gray-300 text-sm mb-4">Subscribe to Tier 2 or higher to access this page.</p>
  </div>
);

const PageHeader = ({ title, description }: { title: string, description: string }) => (
  <div className="bg-white dark:bg-[#1a1c1e] p-6 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm transition-colors mb-4 shrink-0">
    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
    <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">{description}</p>
  </div>
);

// --- FAQ COMPONENT ---

const PageFaq = ({ language, pageType }: { language: Language, pageType: string }) => {
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

  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('__all__');

  const [view, setView] = useState<'coins' | 'categories'>('coins');

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'market_cap_rank',
    direction: 'asc',
  });

  const PAGE_SIZE = 100;
  const [page, setPage] = useState(0);

  const [buyOpen, setBuyOpen] = useState(false);
  const buyRef = useRef<HTMLDivElement | null>(null);

  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // ---------------------------
  // Column reorder (DnD)
  // ---------------------------
  type ColKey =
    | 'fav'
    | 'rank'
    | 'asset'
    | 'price'
    | 'c1h'
    | 'c24h'
    | 'c7d'
    | 'mcap'
    | 'v24h'
    | 'v7d'
    | 'supply'
    | 'spark';

  const DEFAULT_COL_ORDER: ColKey[] = [
    'fav',
    'rank',
    'asset',
    'price',
    'c1h',
    'c24h',
    'c7d',
    'mcap',
    'v24h',
    'v7d',
    'supply',
    'spark',
  ];

  const [colOrder, setColOrder] = useState<ColKey[]>(DEFAULT_COL_ORDER);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cct_mc_colorder_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) setColOrder(parsed as ColKey[]);
      }
    } catch {}
  }, []);

  const persistColOrder = (next: ColKey[]) => {
    setColOrder(next);
    try { localStorage.setItem('cct_mc_colorder_v1', JSON.stringify(next)); } catch {}
  };

  // ---------------------------
  // CATEGORY DATA (local cachecko)
  // ---------------------------
  type TaxonomyGroup = { id: string; name: string; categoryIds: string[] };
  type TaxonomyMaster = { id: string; name: string; categoryIds?: string[]; groups?: TaxonomyGroup[] };

  type CategoryListItem = { category_id: string; name: string };

  type CategoryMarketRow = {
    id?: string;
    category_id?: string;
    name?: string;
    market_cap?: number;
    volume_24h?: number;
    market_cap_change_24h?: number;
    volume_change_24h?: number;
    coins_count?: number;
    // coinGecko-like keys:
    market_cap_24h?: number;
    total_volume?: number;
    top_3_coins?: string[];
    top_3_coins_id?: string[];
    // pct:
    pct_1h?: number;
    pct_24h?: number;
    pct_7d?: number;
    price_change_percentage_1h_in_currency?: number;
    price_change_percentage_24h_in_currency?: number;
    price_change_percentage_7d_in_currency?: number;
    // sometimes:
    "1h"?: number;
    "24h"?: number;
    "7d"?: number;
  };

  type CategoryCoinsMap = { generated_at?: string; categories?: Record<string, string[]> };

  const [taxMasters, setTaxMasters] = useState<TaxonomyMaster[]>([]);
  const [cgCategoryList, setCgCategoryList] = useState<CategoryListItem[]>([]);
  const [catMarket, setCatMarket] = useState<CategoryMarketRow[]>([]);
  const [catMap, setCatMap] = useState<CategoryCoinsMap | null>(null);

  const [catLoading, setCatLoading] = useState(false);
  const [catWarn, setCatWarn] = useState('');

  // UI selections (no lateral menu)
  const [selMasterId, setSelMasterId] = useState<string>('__all__'); // start showing masters list
  const [selGroupId, setSelGroupId] = useState<string>('__all__');
  const [selCategoryId, setSelCategoryId] = useState<string>('');

  const fetchLocalJson = async (path: string) => {
    const salt = Math.floor(Date.now() / 60000);
    const url = path.includes('?') ? `${path}&_cb=${salt}` : `${path}?_cb=${salt}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  };

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

  const loadCategories = async () => {
    setCatLoading(true);
    setCatWarn('');
    try {
      const [taxonomy, list, market] = await Promise.all([
        fetchLocalJson('/cachecko/categories/taxonomy-master.json'),
        fetchLocalJson('/cachecko/categories/coingecko_categories_list.json'),
        fetchLocalJson('/cachecko/categories/coingecko_categories_market.json'),
      ]);

      const mastersRaw: any[] =
        Array.isArray(taxonomy) ? taxonomy :
        Array.isArray(taxonomy?.masters) ? taxonomy.masters :
        Array.isArray(taxonomy?.data) ? taxonomy.data :
        [];

      const masters: TaxonomyMaster[] = mastersRaw.map((m: any, i: number) => {
        const id = String(m.id ?? m.masterId ?? m.key ?? m.name ?? `master_${i}`);
        const name = String(m.name ?? m.title ?? m.id ?? `Master ${i + 1}`);

        const directIds: string[] = Array.isArray(m.categoryIds) ? m.categoryIds.map((x: any) => String(x)) : [];

        const groupsRaw: any[] =
          Array.isArray(m.groups) ? m.groups :
          Array.isArray(m.children) ? m.children :
          Array.isArray(m.subs) ? m.subs :
          [];

        const groups: TaxonomyGroup[] = groupsRaw.map((g: any, gi: number) => ({
          id: String(g.id ?? g.key ?? g.name ?? `group_${gi}`),
          name: String(g.name ?? g.title ?? g.id ?? `Group ${gi + 1}`),
          categoryIds: Array.isArray(g.categoryIds) ? g.categoryIds.map((x: any) => String(x)) : [],
        })).filter(g => g.categoryIds.length > 0);

        return {
          id,
          name,
          categoryIds: directIds.length ? directIds : undefined,
          groups: groups.length ? groups : undefined,
        };
      }).filter(m => (m.categoryIds?.length ?? 0) > 0 || (m.groups?.length ?? 0) > 0);

      const listArr: CategoryListItem[] =
        Array.isArray(list) ? list :
        Array.isArray(list?.data) ? list.data :
        [];

      const marketArr: CategoryMarketRow[] =
        Array.isArray(market) ? market :
        Array.isArray(market?.data) ? market.data :
        [];

      setTaxMasters(masters);
      setCgCategoryList(listArr);
      setCatMarket(marketArr);

      // snapshot is optional for OVERVIEW, but needed for filtering coins
      try {
        const snapshot = await fetchLocalJson('/cachecko/categories/category_coins_map.json');
        setCatMap(snapshot as CategoryCoinsMap);
      } catch {
        setCatMap(null);
        setCatWarn('Filtro por coins indisponível: snapshot category_coins_map.json não está exposto em /cachecko/categories/. A tabela de categorias funciona (market agregados), mas o clique pra filtrar moedas fica desativado.');
      }

      // IMPORTANT: when entering categories, start at masters list
      setSelMasterId('__all__');
      setSelGroupId('__all__');
      setSelCategoryId('');
    } catch (e) {
      console.error('Categories load error', e);
      setCatWarn('Falha ao carregar categorias locais (/cachecko/categories/*).');
    } finally {
      setCatLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cct_mc_favs_v1');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setFavorites(new Set(arr.map(x => String(x))));
      }
    } catch {}
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buyRef.current && !buyRef.current.contains(t)) setBuyOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const toggleFav = (coinId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(coinId)) next.delete(coinId);
      else next.add(coinId);
      try { localStorage.setItem('cct_mc_favs_v1', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  // ---------------------------
  // Helpers (use your existing ones if you already have)
  // ---------------------------
  const formatUSD = (v?: number | null, short = false) => {
    const n = Number(v ?? 0);
    if (!isFinite(n)) return '-';
    if (!short) {
      return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n >= 1 ? 2 : 6 });
    }
    const abs = Math.abs(n);
    if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
    return `$${n.toFixed(2)}`;
  };

  const safePct = (v: number) => {
    if (!isFinite(v)) return '—';
    const s = v >= 0 ? '+' : '';
    return `${s}${v.toFixed(2)}%`;
  };

  // Sparkline pct estimation (keep compatible with your prior behavior)
  const pctFromSpark = (prices?: number[], hours = 1) => {
    if (!prices || prices.length < 2) return NaN;
    // sparkline 7d from coingecko usually has 168 points (hourly)
    const step = Math.max(1, Math.round(hours));
    const idx = Math.max(0, prices.length - 1 - step);
    const prev = Number(prices[idx]);
    const last = Number(prices[prices.length - 1]);
    if (!isFinite(prev) || !isFinite(last) || prev === 0) return NaN;
    return ((last - prev) / prev) * 100;
  };

  const pct7dFromSpark = (prices?: number[]) => {
    if (!prices || prices.length < 2) return NaN;
    const first = Number(prices[0]);
    const last = Number(prices[prices.length - 1]);
    if (!isFinite(first) || !isFinite(last) || first === 0) return NaN;
    return ((last - first) / first) * 100;
  };

  // ---------------------------
  // Sorting
  // ---------------------------
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    setSortConfig({ key, direction });
    setPage(0);
  };

  // ---------------------------
  // Category name map + market lookup
  // ---------------------------
  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cgCategoryList) m.set(String(c.category_id), String(c.name));
    return m;
  }, [cgCategoryList]);

  const catMarketById = useMemo(() => {
    const m = new Map<string, CategoryMarketRow>();
    for (const r of catMarket) {
      const id = String(r.category_id ?? r.id ?? '');
      if (!id) continue;
      m.set(id, r);
    }
    return m;
  }, [catMarket]);

  const categoryCoinIds = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const cats = catMap?.categories ?? null;
    if (!cats) return m;
    for (const [cid, ids] of Object.entries(cats)) {
      if (!Array.isArray(ids)) continue;
      m.set(String(cid), new Set(ids.map(x => String(x))));
    }
    return m;
  }, [catMap]);

  // ---------------------------
  // Build category rows (overview) USING market aggregates
  // masters list (selMasterId="__all__") OR categories inside master/group
  // ---------------------------
  const mastersForDropdown = useMemo(() => [{ id: '__all__', name: 'Masters' }, ...taxMasters], [taxMasters]);

  const selectedMaster = useMemo(() => {
    if (selMasterId === '__all__') return null;
    return taxMasters.find(m => m.id === selMasterId) ?? null;
  }, [selMasterId, taxMasters]);

  const groupsForMaster = useMemo(() => {
    if (!selectedMaster) return [];
    if (selectedMaster.groups?.length) return [{ id: '__all__', name: 'All', categoryIds: [] }, ...selectedMaster.groups];
    // if no groups, no group dropdown
    return [];
  }, [selectedMaster]);

  // categories list to show in table when master selected
  const categoriesToShow = useMemo(() => {
    // showing masters overview
    if (selMasterId === '__all__') return [];

    const m = selectedMaster;
    if (!m) return [];

    // if master has groups and a group is selected (not __all__)
    if (m.groups?.length) {
      if (selGroupId !== '__all__') {
        const g = m.groups.find(x => x.id === selGroupId);
        return g?.categoryIds ?? [];
      }
      // group __all__ => all categories under all groups
      const all = new Set<string>();
      for (const g of m.groups) for (const cid of g.categoryIds) all.add(cid);
      return [...all];
    }

    // master direct categoryIds
    return m.categoryIds ?? [];
  }, [selMasterId, selGroupId, selectedMaster]);

  const getRowPct = (r?: CategoryMarketRow, key?: '1h' | '24h' | '7d') => {
    if (!r) return NaN;
    if (key === '1h') return Number(r.price_change_percentage_1h_in_currency ?? r.pct_1h ?? (r as any)['1h'] ?? NaN);
    if (key === '24h') return Number(r.price_change_percentage_24h_in_currency ?? r.pct_24h ?? (r as any)['24h'] ?? NaN);
    return Number(r.price_change_percentage_7d_in_currency ?? r.pct_7d ?? (r as any)['7d'] ?? NaN);
  };

  const getRowMC = (r?: CategoryMarketRow) => {
    if (!r) return 0;
    return Number(r.market_cap ?? (r as any).market_cap_24h ?? 0);
  };

  const getRowVol = (r?: CategoryMarketRow) => {
    if (!r) return 0;
    return Number(r.volume_24h ?? (r as any).total_volume ?? 0);
  };

  const getRowCoins = (r?: CategoryMarketRow) => {
    if (!r) return 0;
    return Number(r.coins_count ?? 0);
  };

  const getTopLogos = (r?: CategoryMarketRow) => {
    const arr = (r?.top_3_coins ?? r?.top_3_coins_id ?? []) as any[];
    return Array.isArray(arr) ? arr.slice(0, 3).map(x => String(x)) : [];
  };

  // NOTE: we only have coin logos in coins dataset; for categories_market top_3 may be URLs already
  const logoUrlFor = (x: string) => {
    if (!x) return '';
    if (x.startsWith('http')) return x;
    // try match coin id -> image
    const c = coins.find(k => String(k.id) === x);
    return c?.image ?? '';
  };

  const mastersRows = useMemo(() => {
    // show 15 masters
    const rows = taxMasters.slice(0, 15).map(m => {
      // union all categories under master to compute aggregates by summing category market rows
      const catIds: string[] = m.groups?.length
        ? Array.from(new Set(m.groups.flatMap(g => g.categoryIds)))
        : (m.categoryIds ?? []);

      let mc = 0;
      let vol = 0;
      let coinsCount = 0;

      // weighted pct by marketcap (from category market)
      let wSum = 0;
      let w1 = 0, w24 = 0, w7 = 0;

      const topLogos: string[] = [];

      for (const cid of catIds) {
        const r = catMarketById.get(cid);
        if (!r) continue;

        const cMC = getRowMC(r);
        const cVol = getRowVol(r);
        const cN = getRowCoins(r);

        mc += cMC;
        vol += cVol;
        coinsCount += cN;

        const p1 = getRowPct(r, '1h');
        const p24 = getRowPct(r, '24h');
        const p7 = getRowPct(r, '7d');

        if (cMC > 0) {
          if (isFinite(p1)) w1 += cMC * p1;
          if (isFinite(p24)) w24 += cMC * p24;
          if (isFinite(p7)) w7 += cMC * p7;
          wSum += cMC;
        }

        // pick some logos
        for (const l of getTopLogos(r)) {
          if (topLogos.length < 3 && !topLogos.includes(l)) topLogos.push(l);
        }
      }

      const pct1 = wSum > 0 ? w1 / wSum : NaN;
      const pct24 = wSum > 0 ? w24 / wSum : NaN;
      const pct7 = wSum > 0 ? w7 / wSum : NaN;

      return {
        kind: 'master' as const,
        id: m.id,
        name: m.name,
        marketCap: mc,
        volume24: vol,
        coinsCount,
        pct1,
        pct24,
        pct7,
        logos: topLogos,
      };
    });

    rows.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    return rows;
  }, [taxMasters, catMarketById]);

  const categoriesRows = useMemo(() => {
    const rows = categoriesToShow.map(cid => {
      const r = catMarketById.get(cid);
      return {
        kind: 'category' as const,
        id: cid,
        name: categoryNameById.get(cid) ?? cid,
        marketCap: getRowMC(r),
        volume24: getRowVol(r),
        coinsCount: getRowCoins(r),
        pct1: getRowPct(r, '1h'),
        pct24: getRowPct(r, '24h'),
        pct7: getRowPct(r, '7d'),
        logos: getTopLogos(r),
      };
    });

    rows.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    return rows;
  }, [categoriesToShow, catMarketById, categoryNameById]);

  // ---------------------------
  // Main table filter + sort
  // ---------------------------
  const activeFilterSet = useMemo(() => {
    if (activeCategory === '__all__') return null;
    return categoryCoinIds.get(activeCategory) ?? null;
  }, [activeCategory, categoryCoinIds]);

  const filteredSortedCoins = useMemo(() => {
    let items = [...coins];

    if (activeFilterSet) {
      items = items.filter(c => activeFilterSet.has(String(c.id)));
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      items = items.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.symbol?.toLowerCase().includes(q) ||
        String(c.id).toLowerCase().includes(q)
      );
    }

    const getVal = (c: ApiCoin, key: string) => {
      const prices = c.sparkline_in_7d?.price;

      if (key === 'fav') return favorites.has(String(c.id)) ? 1 : 0;
      if (key === 'change_1h_est') return pctFromSpark(prices, 1);
      if (key === 'change_7d_est') return pct7dFromSpark(prices);
      if (key === 'vol_7d_est') return (c.total_volume || 0) * 7;

      // @ts-ignore
      return c[key];
    };

    items.sort((a: any, b: any) => {
      const aVal = getVal(a, sortConfig.key);
      const bVal = getVal(b, sortConfig.key);

      // strings
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
  }, [coins, searchTerm, sortConfig, activeFilterSet, favorites]);

  const totalCount = filteredSortedCoins.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  const pageCoins = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return filteredSortedCoins.slice(start, start + PAGE_SIZE);
  }, [filteredSortedCoins, safePage]);

  useEffect(() => { setPage(0); }, [searchTerm, activeCategory]);
  useEffect(() => { setPage(0); }, [sortConfig.key, sortConfig.direction]);

  const Paginator = ({ compact = false }: { compact?: boolean }) => {
    const start = safePage * PAGE_SIZE + 1;
    const end = Math.min(totalCount, (safePage + 1) * PAGE_SIZE);

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
                ? 'opacity-40 cursor-not-allowed border-slate-200/30 text-gray-500'
                : 'border-slate-700 text-gray-200 hover:bg-white/5'
              }`}
            title="Página anterior"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="text-xs font-black text-gray-300 px-2">
            {safePage + 1} / {totalPages}
          </div>

          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className={`px-2.5 py-2 rounded-lg border text-sm font-black transition-colors
              ${safePage >= totalPages - 1
                ? 'opacity-40 cursor-not-allowed border-slate-200/30 text-gray-500'
                : 'border-slate-700 text-gray-200 hover:bg-white/5'
              }`}
            title="Próxima página"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  };

  // ---------------------------
  // Sortable header cell (with pull handle)
  // ---------------------------
  const SortableTh = ({ id, children, align = 'left', w }: { id: ColKey; children: React.ReactNode; align?: 'left' | 'right' | 'center'; w?: string }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.6 : 1,
    };

    const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

    return (
      <th
        ref={setNodeRef}
        style={style}
        className={`p-3 select-none ${alignCls} ${w ?? ''} border-b border-slate-800 bg-[#2f3032]`}
      >
        <div className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-slate-700 hover:bg-white/5 text-slate-300"
            title="Arrastar para reordenar coluna"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={16} />
          </span>

          <span className="font-black uppercase tracking-widest text-xs text-gray-400 whitespace-nowrap">
            {children}
          </span>
        </div>
      </th>
    );
  };

  // ---------------------------
  // Column definitions (all columns back + widths balanced)
  // ---------------------------
  const colDefs = useMemo(() => {
    const defs: Record<ColKey, { align?: 'left' | 'right' | 'center'; w?: string; sortKey?: string; renderHeader: string }> = {
      fav: { align: 'center', w: 'w-[56px]', sortKey: 'fav', renderHeader: '' },
      rank: { align: 'center', w: 'w-[72px]', sortKey: 'market_cap_rank', renderHeader: '#' },
      asset: { align: 'left', w: 'w-[300px]', sortKey: 'name', renderHeader: 'Ativo' },
      price: { align: 'right', w: 'w-[140px]', sortKey: 'current_price', renderHeader: 'Preço' },
      c1h: { align: 'right', w: 'w-[90px]', sortKey: 'change_1h_est', renderHeader: '1h %' },
      c24h: { align: 'right', w: 'w-[96px]', sortKey: 'price_change_percentage_24h', renderHeader: '24h %' },
      c7d: { align: 'right', w: 'w-[96px]', sortKey: 'change_7d_est', renderHeader: '7d %' },
      mcap: { align: 'right', w: 'w-[150px]', sortKey: 'market_cap', renderHeader: 'Market Cap' },
      v24h: { align: 'right', w: 'w-[130px]', sortKey: 'total_volume', renderHeader: 'Vol (24h)' },
      v7d: { align: 'right', w: 'w-[130px]', sortKey: 'vol_7d_est', renderHeader: 'Vol (7d)' },
      supply: { align: 'right', w: 'w-[170px]', sortKey: 'circulating_supply', renderHeader: 'Circ. Supply' },
      spark: { align: 'right', w: 'w-[240px]', sortKey: '', renderHeader: 'Mini-chart (7d)' },
    };
    return defs;
  }, []);

  const handleHeaderClick = (col: ColKey) => {
    const key = colDefs[col]?.sortKey;
    if (!key) return;
    handleSort(key);
  };

  // ---------------------------
  // Categories: view behavior
  // ---------------------------
  const openCategories = async () => {
    setView('categories');
    if (taxMasters.length === 0 && !catLoading) await loadCategories();
  };

  const backToCoins = () => {
    setView('coins');
  };

  const applyCategoryFilter = (cid: string) => {
    // filtering coins requires snapshot
    const setIds = categoryCoinIds.get(cid);
    if (!setIds || setIds.size === 0) return;

    setActiveCategory(cid);
    setSortConfig({ key: 'market_cap', direction: 'desc' });
    setPage(0);
    setView('coins');
  };

  const clearCategory = () => {
    setActiveCategory('__all__');
    setSortConfig({ key: 'market_cap_rank', direction: 'asc' });
    setPage(0);
  };

  // ---------------------------
  // UI Controls: Categories button OR dropdowns (same slot)
  // ---------------------------
  const CategoriesControl = () => {
    if (view === 'coins') {
      return (
        <button
          onClick={openCategories}
          className="px-3 py-2 rounded-lg border bg-[#2f3032] text-white border-slate-700 hover:bg-white/5 text-sm font-black transition-colors"
          title="Categorias"
        >
          Categorias
        </button>
      );
    }

    // view === categories: dropdowns replacing the Categories button
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={selMasterId}
          onChange={(e) => {
            const v = e.target.value;
            setSelMasterId(v);
            setSelGroupId('__all__');
            setSelCategoryId('');
          }}
          className="px-3 py-2 rounded-lg border bg-[#2f3032] text-white border-slate-700 hover:bg-white/5 text-sm font-black outline-none"
          title="Masters / Subcategorias"
        >
          {mastersForDropdown.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        {selectedMaster?.groups?.length ? (
          <select
            value={selGroupId}
            onChange={(e) => { setSelGroupId(e.target.value); setSelCategoryId(''); }}
            className="px-3 py-2 rounded-lg border bg-[#2f3032] text-white border-slate-700 hover:bg-white/5 text-sm font-black outline-none"
            title="Nível 2 (ex.: AI Meme / Bitcoin Meme)"
          >
            <option value="__all__">All</option>
            {selectedMaster.groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        ) : null}

        {/* optional: category picker (n3) — only if master selected */}
        {selMasterId !== '__all__' && (
          <select
            value={selCategoryId}
            onChange={(e) => setSelCategoryId(e.target.value)}
            className="px-3 py-2 rounded-lg border bg-[#2f3032] text-white border-slate-700 hover:bg-white/5 text-sm font-black outline-none"
            title="Categoria (clique na linha pra aplicar filtro se snapshot existir)"
          >
            <option value="">— Categoria —</option>
            {categoriesToShow.map(cid => (
              <option key={cid} value={cid}>{categoryNameById.get(cid) ?? cid}</option>
            ))}
          </select>
        )}

        <button
          onClick={backToCoins}
          className="px-3 py-2 rounded-lg border bg-white/5 text-slate-200 border-slate-700 hover:bg-white/10 text-sm font-black transition-colors"
          title="Voltar"
        >
          Voltar
        </button>
      </div>
    );
  };

  // ---------------------------
  // Render
  // ---------------------------
  return (
    <div className="bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-100 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col h-full min-h-0">

      {/* Header Row: Search + CategoriesControl + BUY (left) + Refresh + Paginator (right) */}
      <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex flex-col gap-3 bg-gray-50/50 dark:bg-black/20 shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2 w-full flex-wrap">
            <div className="relative w-full md:w-[420px]">
              <Search size={18} className="absolute left-3 top-2.5 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar ativo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-[#2f3032] rounded-lg py-2.5 pl-11 pr-4 text-[15px] text-gray-900 dark:text-white focus:border-[#dd9933] outline-none transition-all shadow-inner border border-slate-100 dark:border-slate-700"
              />
            </div>

            {/* categories control (button or dropdowns) */}
            <CategoriesControl />

            {/* BUY dropdown (always same slot) */}
            <div className="relative" ref={buyRef}>
              <button
                onClick={() => setBuyOpen(v => !v)}
                className="px-3 py-2 rounded-lg bg-[#dd9933] text-black font-black hover:opacity-90 transition-opacity flex items-center gap-2"
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

            {/* Refresh */}
            <button
              onClick={() => { load(); if (view === 'categories') loadCategories(); }}
              className="p-2.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-gray-500 transition-colors"
              title="Atualizar"
            >
              <RefreshCw size={22} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {view === 'coins' && <Paginator compact />}
        </div>

        {/* ONLY show warning once, ONLY inside categories view */}
        {view === 'categories' && catWarn && (
          <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs font-bold leading-relaxed">
            {catWarn}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {loading && coins.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Loader2 className="animate-spin mb-2" size={32} />
            <span className="font-bold text-sm uppercase tracking-widest animate-pulse">Sincronizando Mercado...</span>
          </div>
        ) : view === 'categories' ? (
          <div className="overflow-auto custom-scrollbar">
            <table className="min-w-[1100px] w-full text-left border-collapse">
              <thead className="sticky top-0 z-20 bg-white dark:bg-[#2f3032]">
                <tr className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-400 border-b border-gray-100 dark:border-slate-800">
                  <th className="p-3 w-[320px]">Categoria</th>
                  <th className="p-3 w-[150px] text-right">Market Cap</th>
                  <th className="p-3 w-[140px] text-right">24h Volume</th>
                  <th className="p-3 w-[90px] text-right"># Coins</th>
                  <th className="p-3 w-[90px] text-right">1h</th>
                  <th className="p-3 w-[90px] text-right">24h</th>
                  <th className="p-3 w-[90px] text-right">7d</th>
                  <th className="p-3 w-[160px] text-center">Top 3</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {(selMasterId === '__all__' ? mastersRows : categoriesRows)
                  .filter(r => {
                    if (!selCategoryId) return true;
                    // if user picked a category in dropdown, show only that row
                    return r.kind === 'category' ? r.id === selCategoryId : true;
                  })
                  .map((row) => {
                    const canFilter = row.kind === 'category' && (categoryCoinIds.get(row.id)?.size ?? 0) > 0;

                    return (
                      <tr
                        key={`${row.kind}:${row.id}`}
                        className={`hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors ${row.kind === 'master' ? 'cursor-pointer' : (canFilter ? 'cursor-pointer' : 'cursor-not-allowed opacity-70')}`}
                        onClick={() => {
                          if (row.kind === 'master') {
                            setSelMasterId(row.id);
                            setSelGroupId('__all__');
                            setSelCategoryId('');
                            return;
                          }
                          if (row.kind === 'category') {
                            if (!canFilter) return;
                            applyCategoryFilter(row.id);
                          }
                        }}
                        title={row.kind === 'master'
                          ? 'Clique para ver subcategorias'
                          : (canFilter ? 'Clique para filtrar moedas' : 'Sem snapshot para filtrar moedas')}
                      >
                        <td className="p-3">
                          <div className="text-sm font-black text-gray-900 dark:text-white truncate">{row.name}</div>
                          <div className="text-xs font-bold text-gray-500 dark:text-slate-400 mt-1 truncate">{row.id}</div>
                        </td>

                        <td className="p-3 text-right font-mono text-[12px] font-bold text-gray-600 dark:text-slate-300">
                          {formatUSD(row.marketCap, true)}
                        </td>

                        <td className="p-3 text-right font-mono text-[12px] font-bold text-gray-600 dark:text-slate-300">
                          {formatUSD(row.volume24, true)}
                        </td>

                        <td className="p-3 text-right font-mono text-[12px] font-black text-gray-700 dark:text-slate-200">
                          {(row.coinsCount ?? 0).toLocaleString()}
                        </td>

                        <td className={`p-3 text-right font-mono text-[12px] font-black ${isFinite(row.pct1) ? (row.pct1 >= 0 ? 'text-green-500' : 'text-red-500') : 'text-gray-400 dark:text-slate-500'}`}>
                          {safePct(row.pct1)}
                        </td>

                        <td className={`p-3 text-right font-mono text-[12px] font-black ${isFinite(row.pct24) ? (row.pct24 >= 0 ? 'text-green-500' : 'text-red-500') : 'text-gray-400 dark:text-slate-500'}`}>
                          {safePct(row.pct24)}
                        </td>

                        <td className={`p-3 text-right font-mono text-[12px] font-black ${isFinite(row.pct7) ? (row.pct7 >= 0 ? 'text-green-500' : 'text-red-500') : 'text-gray-400 dark:text-slate-500'}`}>
                          {safePct(row.pct7)}
                        </td>

                        <td className="p-3">
                          <div className="flex items-center justify-center gap-2">
                            {row.logos.map((x) => {
                              const url = logoUrlFor(x);
                              if (!url) return null;
                              return (
                                <img
                                  key={x}
                                  src={url}
                                  alt=""
                                  className="w-7 h-7 rounded-full bg-slate-100 dark:bg-[#242628] p-1 border border-slate-200 dark:border-white/10"
                                  onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {(selMasterId === '__all__' ? mastersRows : categoriesRows).length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-sm font-bold text-gray-500 dark:text-slate-400">
                      Nenhum dado de categoria encontrado em coingecko_categories_market.json.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          // ---------------------------
          // COINS TABLE (all columns + mini-chart + reorder)
          // ---------------------------
          <div className="overflow-auto custom-scrollbar">
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={(event) => {
                const { active, over } = event;
                if (!over || active.id === over.id) return;
                const oldIndex = colOrder.indexOf(active.id as ColKey);
                const newIndex = colOrder.indexOf(over.id as ColKey);
                if (oldIndex === -1 || newIndex === -1) return;
                persistColOrder(arrayMove(colOrder, oldIndex, newIndex));
              }}
            >
              <SortableContext items={colOrder} strategy={horizontalListSortingStrategy}>
                <table className="w-full text-left border-collapse min-w-[1280px] table-fixed">
                  <thead className="sticky top-0 z-20 bg-white dark:bg-[#2f3032]">
                    <tr className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-400">
                      {colOrder.map((col) => {
                        const def = colDefs[col];
                        return (
                          <SortableTh key={col} id={col} align={def.align} w={def.w}>
                            <span
                              className={`cursor-pointer ${def.sortKey ? 'hover:text-[#dd9933]' : ''}`}
                              onClick={() => handleHeaderClick(col)}
                              title={def.sortKey ? 'Clique para ordenar' : ''}
                            >
                              {def.renderHeader || (col === 'fav' ? '' : col)}
                            </span>
                          </SortableTh>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {pageCoins.map((coin) => {
                      const prices = coin.sparkline_in_7d?.price;
                      const c1h = pctFromSpark(prices, 1);
                      const c7d = pct7dFromSpark(prices);
                      const vol7d = (coin.total_volume || 0) * 7;
                      const change24 = Number(coin.price_change_percentage_24h ?? 0);
                      const isPos24 = change24 >= 0;

                      const sparkData = Array.isArray(prices) ? prices.map((v, i) => ({ i, v })) : [];
                      const sparkId = `grad_${coin.id}`;

                      const isFav = favorites.has(String(coin.id));

                      return (
                        <tr key={coin.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors group">
                          {colOrder.map((col) => {
                            if (col === 'fav') {
                              return (
                                <td key={col} className="p-3 text-center w-[56px]">
                                  <button
                                    type="button"
                                    onClick={() => toggleFav(String(coin.id))}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 border border-slate-200 dark:border-slate-700"
                                    title="Favoritar"
                                  >
                                    <Star
                                      size={16}
                                      className={isFav ? 'text-[#dd9933]' : 'text-gray-400'}
                                      fill={isFav ? '#dd9933' : 'transparent'}
                                    />
                                  </button>
                                </td>
                              );
                            }

                            if (col === 'rank') {
                              return <td key={col} className="p-3 text-[13px] font-black text-gray-400 text-center w-[72px]">#{coin.market_cap_rank}</td>;
                            }

                            if (col === 'asset') {
                              return (
                                <td key={col} className="p-3 w-[300px]">
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
                                      <span className="text-xs font-bold text-gray-500 uppercase mt-1">{coin.symbol}</span>
                                      <span className="text-[10px] font-bold text-gray-400 mt-1 truncate">{coin.id}</span>
                                    </div>
                                  </div>
                                </td>
                              );
                            }

                            if (col === 'price') {
                              return (
                                <td key={col} className="p-3 text-right font-mono text-[15px] font-black text-gray-900 dark:text-slate-200 w-[140px]">
                                  {formatUSD(coin.current_price)}
                                </td>
                              );
                            }

                            if (col === 'c1h') {
                              return (
                                <td key={col} className={`p-3 text-right font-mono text-[13px] font-black w-[90px] ${!isFinite(c1h) ? 'text-gray-400 dark:text-slate-500' : (c1h >= 0 ? 'text-green-500' : 'text-red-500')}`}>
                                  {safePct(c1h)}
                                </td>
                              );
                            }

                            if (col === 'c24h') {
                              return (
                                <td key={col} className={`p-3 text-right font-mono text-[15px] font-black w-[96px] ${isPos24 ? 'text-green-500' : 'text-red-500'}`}>
                                  {safePct(change24)}
                                </td>
                              );
                            }

                            if (col === 'c7d') {
                              return (
                                <td key={col} className={`p-3 text-right font-mono text-[13px] font-black w-[96px] ${!isFinite(c7d) ? 'text-gray-400 dark:text-slate-500' : (c7d >= 0 ? 'text-green-500' : 'text-red-500')}`}>
                                  {safePct(c7d)}
                                </td>
                              );
                            }

                            if (col === 'mcap') {
                              return (
                                <td key={col} className="p-3 text-right font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400 w-[150px]">
                                  {formatUSD(coin.market_cap, true)}
                                </td>
                              );
                            }

                            if (col === 'v24h') {
                              return (
                                <td key={col} className="p-3 text-right font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400 w-[130px]">
                                  {formatUSD(coin.total_volume, true)}
                                </td>
                              );
                            }

                            if (col === 'v7d') {
                              return (
                                <td key={col} className="p-3 text-right font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400 w-[130px]" title="Estimativa simples: Vol(24h) * 7">
                                  {formatUSD(vol7d, true)}
                                </td>
                              );
                            }

                            if (col === 'supply') {
                              return (
                                <td key={col} className="p-3 text-right font-mono text-[12px] font-bold text-gray-500 dark:text-slate-500 w-[170px]">
                                  {coin.circulating_supply?.toLocaleString()} <span className="uppercase opacity-50">{coin.symbol}</span>
                                </td>
                              );
                            }

                            if (col === 'spark') {
                              return (
                                <td key={col} className="p-3 w-[240px]">
                                  <div className="w-full h-12">
                                    {sparkData.length > 0 ? (
                                      <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={sparkData}>
                                          <defs>
                                            <linearGradient id={sparkId} x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="0%" stopColor={isPos24 ? '#548f3f' : '#CD534B'} stopOpacity={0.55} />
                                              <stop offset="80%" stopColor={isPos24 ? '#548f3f' : '#CD534B'} stopOpacity={0.12} />
                                              <stop offset="100%" stopColor={isPos24 ? '#548f3f' : '#CD534B'} stopOpacity={0.02} />
                                            </linearGradient>
                                          </defs>
                                          <Area
                                            type="monotone"
                                            dataKey="v"
                                            stroke={isPos24 ? '#548f3f' : '#CD534B'}
                                            strokeWidth={2}
                                            fill={`url(#${sparkId})`}
                                            dot={false}
                                            isAnimationActive={false}
                                          />
                                          <YAxis domain={['auto', 'auto']} hide />
                                        </AreaChart>
                                      </ResponsiveContainer>
                                    ) : (
                                      <div className="w-full h-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 flex items-center justify-center text-[10px] font-black text-slate-400">
                                        sem sparkline
                                      </div>
                                    )}
                                  </div>
                                </td>
                              );
                            }

                            return <td key={col} className="p-3">—</td>;
                          })}
                        </tr>
                      );
                    })}

                    {pageCoins.length === 0 && (
                      <tr>
                        <td colSpan={colOrder.length} className="p-8 text-center text-sm font-bold text-gray-500 dark:text-slate-400">
                          Nenhum resultado com os filtros atuais.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>

      {/* Footer paginator only in coins view */}
      {view === 'coins' && (
        <div className="p-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-black/20 shrink-0">
          <Paginator />
        </div>
      )}

      {/* Quick clear filter button (optional, minimal) */}
      {view === 'coins' && activeCategory !== '__all__' && (
        <div className="p-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-black/20 shrink-0 flex justify-end">
          <button
            onClick={clearCategory}
            className="px-3 py-2 rounded-lg border bg-white dark:bg-[#2f3032] text-gray-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-white/5 text-sm font-black transition-colors"
            title="Limpar filtro de categoria"
          >
            Limpar filtro
          </button>
        </div>
      )}
    </div>
  );
};

export default IndicatorPage;
