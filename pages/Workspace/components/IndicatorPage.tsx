import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ApiCoin, Language, WidgetType } from '../../../types';
import { getTranslations } from '../../../locales';
import CryptoWidget from './CryptoWidget';

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
  const [liteCoins, setLiteCoins] = useState<any[]>([]);
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

  // --- CATEGORY DATASETS
  type TaxonomyGroup = { id: string; name: string; categoryIds: string[] };
  type TaxonomyMaster = { id: string; name: string; categoryIds?: string[]; groups?: TaxonomyGroup[] };

  type CategoryListItem = { category_id: string; name: string };
  type CategoryCoinsMap = { generated_at?: string; categories?: Record<string, string[]> };

  const [taxMasters, setTaxMasters] = useState<TaxonomyMaster[]>([]);
  const [cgCategoryList, setCgCategoryList] = useState<CategoryListItem[]>([]);
  const [catMap, setCatMap] = useState<CategoryCoinsMap | null>(null);

  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState('');

  // dropdown selections (3-level)
  const [selMasterId, setSelMasterId] = useState<string>('');     // level 1
  const [selGroupId, setSelGroupId] = useState<string>('');       // level 2 (optional)
  const [selCategoryId, setSelCategoryId] = useState<string>(''); // level 3 (real filter)

  // ---- helpers
  const fetchLocalJson = async (path: string) => {
    const salt = Math.floor(Date.now() / 60000);
    const url = path.includes('?') ? `${path}&_cb=${salt}` : `${path}?_cb=${salt}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  };

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

  const loadLite = async () => {
    try {
      const j = await fetchLocalJson('/cachecko/cachecko_lite.json');
      const arr = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : [];
      setLiteCoins(arr);
    } catch (e) {
      console.warn('cachecko_lite.json not found, falling back to main dataset');
      setLiteCoins([]);
    }
  };

  const loadCategories = async () => {
    setCatLoading(true);
    setCatError('');
    try {
      const [taxonomy, list] = await Promise.all([
        fetchLocalJson('/cachecko/categories/taxonomy-master.json'),
        fetchLocalJson('/cachecko/categories/coingecko_categories_list.json'),
      ]);

      // taxonomy robust parse (supports nested groups/children)
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

      setTaxMasters(masters);
      setCgCategoryList(listArr);

      // snapshot map optional
      try {
        const snapshot = await fetchLocalJson('/cachecko/categories/category_coins_map.json');
        setCatMap(snapshot as CategoryCoinsMap);
      } catch {
        setCatMap(null);
        setCatError('Dados de categoria não indexados localmente. Coloque o snapshot em: /opt/n8n/cachecko/categories/category_coins_map.json e exponha via /cachecko/categories/category_coins_map.json.');
      }

      // default selection
      if (!selMasterId && masters.length) {
        setSelMasterId(masters[0].id);
      }
    } catch (e) {
      console.error('Categories load error', e);
      setCatError('Falha ao carregar categorias locais (cachecko). Confira se /cachecko/categories/* está acessível.');
    } finally {
      setCatLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadLite();

    try {
      const raw = localStorage.getItem('cct_mc_favs_v1');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setFavorites(new Set(arr.map(x => String(x))));
      }
    } catch { }
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buyRef.current && !buyRef.current.contains(t)) setBuyOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (view === 'categories' && taxMasters.length === 0 && !catLoading) loadCategories();
  }, [view]);

  const toggleFav = (coinId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(coinId)) next.delete(coinId);
      else next.add(coinId);
      try { localStorage.setItem('cct_mc_favs_v1', JSON.stringify([...next])); } catch { }
      return next;
    });
  };

  // ---- Category name map
  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cgCategoryList) m.set(String(c.category_id), String(c.name));
    return m;
  }, [cgCategoryList]);

  // ---- Lite universe (preferred in category lists)
  const universe = useMemo(() => {
    const base = liteCoins.length ? liteCoins : coins;
    return Array.isArray(base) ? base : [];
  }, [liteCoins, coins]);

  const coinById = useMemo(() => {
    const m = new Map<string, any>();
    for (const c of universe) m.set(String(c.id), c);
    return m;
  }, [universe]);

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

  // ---- dropdown derived lists
  const selMaster = useMemo(() => taxMasters.find(m => m.id === selMasterId) ?? null, [taxMasters, selMasterId]);

  const groupsForMaster = useMemo(() => {
    if (!selMaster) return [];
    if (selMaster.groups?.length) return selMaster.groups;
    // if no explicit groups, create a default group holding direct categoryIds
    const ids = selMaster.categoryIds ?? [];
    return ids.length ? [{ id: '__default__', name: 'All', categoryIds: ids }] : [];
  }, [selMaster]);

  useEffect(() => {
    // when master changes, set group default
    if (!selMaster) return;
    const gs = groupsForMaster;
    if (!gs.length) {
      setSelGroupId('');
      setSelCategoryId('');
      return;
    }
    setSelGroupId(gs[0].id);
    setSelCategoryId('');
  }, [selMasterId]);

  const categoriesForGroup = useMemo(() => {
    const g = groupsForMaster.find(x => x.id === selGroupId) ?? null;
    return g?.categoryIds ?? [];
  }, [groupsForMaster, selGroupId]);

  // ---- Aggregates for category overview table (NO SPARKLINE)
  const computeAgg = (ids: Set<string>) => {
    const arr: any[] = [];
    for (const id of ids) {
      const c = coinById.get(String(id));
      if (c) arr.push(c);
    }

    const coinCount = arr.length;
    let marketCap = 0;
    let volume24 = 0;

    let wSum = 0;
    let w1 = 0, w24 = 0, w7 = 0;

    let s1 = 0, s24 = 0, s7 = 0;
    let s1n = 0, s24n = 0, s7n = 0;

    for (const c of arr) {
      const mc = Number(c.market_cap ?? 0);
      const vol = Number(c.total_volume ?? 0);
      if (isFinite(mc)) marketCap += mc;
      if (isFinite(vol)) volume24 += vol;

      const p1 = Number(c.price_change_percentage_1h_in_currency ?? c.price_change_percentage_1h ?? NaN);
      const p24 = Number(c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h ?? NaN);
      const p7 = Number(c.price_change_percentage_7d_in_currency ?? c.price_change_percentage_7d ?? NaN);

      if (isFinite(p1)) { s1 += p1; s1n++; }
      if (isFinite(p24)) { s24 += p24; s24n++; }
      if (isFinite(p7)) { s7 += p7; s7n++; }

      const w = isFinite(mc) && mc > 0 ? mc : 0;
      if (w > 0) {
        if (isFinite(p1)) w1 += w * p1;
        if (isFinite(p24)) w24 += w * p24;
        if (isFinite(p7)) w7 += w * p7;
        wSum += w;
      }
    }

    const pct1h = wSum > 0 ? (w1 / wSum) : (s1n ? (s1 / s1n) : NaN);
    const pct24h = wSum > 0 ? (w24 / wSum) : (s24n ? (s24 / s24n) : NaN);
    const pct7d = wSum > 0 ? (w7 / wSum) : (s7n ? (s7 / s7n) : NaN);

    const sortedBy24 = [...arr]
      .filter(c => isFinite(Number(c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h)))
      .sort((a, b) => Number(b.price_change_percentage_24h_in_currency ?? b.price_change_percentage_24h) - Number(a.price_change_percentage_24h_in_currency ?? a.price_change_percentage_24h));

    const topGainers = sortedBy24.slice(0, 3);
    const topLosers = [...sortedBy24].reverse().slice(0, 3);

    return { coinCount, marketCap, volume24, pct1h, pct24h, pct7d, topGainers, topLosers };
  };

  const categoryRows = useMemo(() => {
    // show categories within selected group
    const rows = categoriesForGroup.map(cid => {
      const ids = categoryCoinIds.get(String(cid)) ?? new Set<string>();
      const agg = computeAgg(ids);
      return {
        id: String(cid),
        name: categoryNameById.get(String(cid)) ?? String(cid),
        ...agg,
      };
    });

    // order by marketcap desc like CoinGecko
    rows.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    return rows;
  }, [categoriesForGroup, categoryCoinIds, coinById, categoryNameById]);

  const applyCategory = (cid: string) => {
    setSelCategoryId(cid);
    setActiveCategory(cid);
    setView('coins');
    setSortConfig({ key: 'market_cap', direction: 'desc' });
    setPage(0);
  };

  const clearCategory = () => {
    setActiveCategory('__all__');
    setSelCategoryId('');
    setSortConfig({ key: 'market_cap_rank', direction: 'asc' });
    setPage(0);
  };

  // ---- main table filter
  const activeFilterSet = useMemo(() => {
    if (activeCategory === '__all__') return null;
    return categoryCoinIds.get(activeCategory) ?? new Set<string>();
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
      if (key === 'fav') return favorites.has(String(c.id)) ? 1 : 0;
      // @ts-ignore
      return (c as any)[key];
    };

    items.sort((a: any, b: any) => {
      const aVal = getVal(a, sortConfig.key);
      const bVal = getVal(b, sortConfig.key);

      if (sortConfig.key === 'fav') {
        const an = Number(aVal ?? 0);
        const bn = Number(bVal ?? 0);
        if (an !== bn) return sortConfig.direction === 'asc' ? (an - bn) : (bn - an);
        return (a.market_cap_rank ?? 999999) - (b.market_cap_rank ?? 999999);
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
                ? 'opacity-40 cursor-not-allowed border-slate-700/40 text-gray-500'
                : 'border-slate-700/50 text-gray-200 hover:bg-white/5'
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
                ? 'opacity-40 cursor-not-allowed border-slate-700/40 text-gray-500'
                : 'border-slate-700/50 text-gray-200 hover:bg-white/5'
              }`}
            title="Próxima página"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  };

  // ---- header control: categories button OR dropdowns
  const CategoryControl = () => {
    if (view === 'coins') {
      return (
        <button
          onClick={() => setView('categories')}
          className="px-3 py-2 rounded-lg border bg-[#2f3032] text-white border-slate-700 hover:bg-white/5 text-sm font-black transition-colors"
          title="Categorias"
        >
          Categorias
        </button>
      );
    }

    // categories view: show up to 3 dropdowns (master, group if exists, category)
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {/* master */}
        <select
          value={selMasterId}
          onChange={(e) => setSelMasterId(e.target.value)}
          className="px-3 py-2 rounded-lg border bg-[#2f3032] text-white border-slate-700 hover:bg-white/5 text-sm font-black outline-none"
          title="Master"
        >
          {taxMasters.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        {/* group (optional) */}
        {groupsForMaster.length > 1 && (
          <select
            value={selGroupId}
            onChange={(e) => { setSelGroupId(e.target.value); }}
            className="px-3 py-2 rounded-lg border bg-[#2f3032] text-white border-slate-700 hover:bg-white/5 text-sm font-black outline-none"
            title="Grupo"
          >
            {groupsForMaster.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}

        {/* category (real selection) */}
        <select
          value={selCategoryId}
          onChange={(e) => {
            const v = e.target.value;
            setSelCategoryId(v);
            if (v) applyCategory(v);
          }}
          className="px-3 py-2 rounded-lg border bg-[#2f3032] text-white border-slate-700 hover:bg-white/5 text-sm font-black outline-none"
          title="Categoria"
        >
          <option value="">— Selecionar —</option>
          {categoriesForGroup.map(cid => (
            <option key={cid} value={cid}>{categoryNameById.get(cid) ?? cid}</option>
          ))}
        </select>

        <button
          onClick={() => { clearCategory(); setView('coins'); }}
          className="px-3 py-2 rounded-lg border bg-white/5 text-slate-200 border-slate-700 hover:bg-white/10 text-sm font-black transition-colors"
          title="Voltar"
        >
          Voltar
        </button>
      </div>
    );
  };

  return (
    <div className="bg-[#1a1c1e] rounded-xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-full min-h-0">
      {/* Header Row: everything LEFT near search (Categories + BUY), paginator still right */}
      <div className="p-4 border-b border-slate-800 flex flex-col gap-3 bg-black/20 shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2 w-full flex-wrap">
            {/* Search */}
            <div className="relative w-full md:w-[420px]">
              <Search size={18} className="absolute left-3 top-2.5 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar ativo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#2f3032] rounded-lg py-2.5 pl-11 pr-4 text-[15px] text-white focus:border-[#dd9933] outline-none transition-all shadow-inner border border-slate-700"
              />
            </div>

            {/* Categories control (button or dropdowns) */}
            <CategoryControl />

            {/* BUY dropdown (always same place) */}
            <div className="relative" ref={buyRef}>
              <button
                onClick={() => setBuyOpen(v => !v)}
                className="px-3 py-2 rounded-lg bg-[#dd9933] text-black font-black hover:opacity-90 transition-opacity flex items-center gap-2"
                title="BUY"
              >
                BUY <ChevronDown size={16} />
              </button>

              {buyOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-[#2f3032] border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
                  <a
                    href="https://www.bybit.com/invite?ref=JMBYZW"
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-3 flex items-center justify-between hover:bg-white/5 text-sm font-black text-slate-200"
                  >
                    Bybit
                    <ExternalLink size={16} className="text-gray-400" />
                  </a>
                </div>
              )}
            </div>

            {/* Refresh */}
            <button
              onClick={() => { load(); loadLite(); if (view === 'categories') loadCategories(); }}
              className="p-2.5 hover:bg-white/5 rounded-lg text-gray-400 transition-colors border border-slate-700"
              title="Atualizar"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* paginator right */}
          {view === 'coins' && <Paginator compact />}
        </div>

        {catLoading && view === 'categories' && (
          <div className="text-xs font-bold text-slate-400 flex items-center gap-2">
            <Loader2 className="animate-spin" size={14} />
            Carregando categorias...
          </div>
        )}

        {catError && view === 'categories' && (
          <div className="p-3 rounded-xl border border-amber-600/40 bg-amber-500/10 text-amber-200 text-xs font-bold leading-relaxed">
            {catError}
          </div>
        )}
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {view === 'categories' ? (
          <div className="overflow-auto custom-scrollbar">
            <table className="min-w-[1200px] w-full text-left border-collapse">
              <thead className="sticky top-0 z-20 bg-[#2f3032]">
                <tr className="text-xs font-black uppercase tracking-widest text-gray-400 border-b border-slate-800">
                  <th className="p-3 w-[260px]">Categoria</th>
                  <th className="p-3 w-[160px] text-center">Top Gainers</th>
                  <th className="p-3 w-[160px] text-center">Top Losers</th>
                  <th className="p-3 w-[90px] text-right">1h</th>
                  <th className="p-3 w-[90px] text-right">24h</th>
                  <th className="p-3 w-[90px] text-right">7d</th>
                  <th className="p-3 w-[150px] text-right">Market Cap</th>
                  <th className="p-3 w-[150px] text-right">24h Vol</th>
                  <th className="p-3 w-[90px] text-right"># Coins</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {categoryRows.map(row => {
                  const canFilter = !!catMap?.categories && (categoryCoinIds.get(row.id)?.size ?? 0) > 0;
                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-white/5 transition-colors ${canFilter ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
                      onClick={() => { if (canFilter) applyCategory(row.id); }}
                      title={canFilter ? 'Clique para filtrar a tabela principal' : 'Sem snapshot de mapeamento para filtrar'}
                    >
                      <td className="p-3">
                        <div className="text-sm font-black text-white truncate">{row.name}</div>
                        <div className="text-xs font-bold text-slate-400 mt-1 truncate">{row.id}</div>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          {row.topGainers.map((c: any) => (
                            <img
                              key={c.id}
                              src={c.image}
                              alt=""
                              className="w-7 h-7 rounded-full bg-[#242628] p-1 border border-white/10"
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                          ))}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          {row.topLosers.map((c: any) => (
                            <img
                              key={c.id}
                              src={c.image}
                              alt=""
                              className="w-7 h-7 rounded-full bg-[#242628] p-1 border border-white/10"
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                          ))}
                        </div>
                      </td>

                      <td className={`p-3 text-right font-mono text-[12px] font-black ${isFinite(row.pct1h) ? (row.pct1h >= 0 ? 'text-green-400' : 'text-red-400') : 'text-slate-500'}`}>
                        {safePct(row.pct1h)}
                      </td>

                      <td className={`p-3 text-right font-mono text-[12px] font-black ${isFinite(row.pct24h) ? (row.pct24h >= 0 ? 'text-green-400' : 'text-red-400') : 'text-slate-500'}`}>
                        {safePct(row.pct24h)}
                      </td>

                      <td className={`p-3 text-right font-mono text-[12px] font-black ${isFinite(row.pct7d) ? (row.pct7d >= 0 ? 'text-green-400' : 'text-red-400') : 'text-slate-500'}`}>
                        {safePct(row.pct7d)}
                      </td>

                      <td className="p-3 text-right font-mono text-[12px] font-bold text-slate-300">
                        {formatUSD(row.marketCap, true)}
                      </td>

                      <td className="p-3 text-right font-mono text-[12px] font-bold text-slate-300">
                        {formatUSD(row.volume24, true)}
                      </td>

                      <td className="p-3 text-right font-mono text-[12px] font-black text-slate-200">
                        {row.coinCount.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}

                {categoryRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-sm font-bold text-slate-400">
                      Nenhuma categoria disponível com os dados atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            {loading && coins.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Loader2 className="animate-spin mb-2" size={32} />
                <span className="font-bold text-sm uppercase tracking-widest animate-pulse">Sincronizando Mercado...</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[1200px] table-fixed">
                <thead className="sticky top-0 z-20 bg-[#2f3032]">
                  <tr className="text-xs font-black uppercase tracking-widest text-gray-400 border-b border-slate-800">
                    <th className="p-3 w-[46px] text-center">★</th>
                    <th className="p-3 w-[70px] text-center">#</th>
                    <th className="p-3 w-[320px]">Ativo</th>
                    <th className="p-3 w-[140px] text-right">Preço</th>
                    <th className="p-3 w-[96px] text-right">24h</th>
                    <th className="p-3 w-[150px] text-right">Market Cap</th>
                    <th className="p-3 w-[150px] text-right">Vol (24h)</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800">
                  {pageCoins.map((coin) => {
                    const change24 = Number(coin.price_change_percentage_24h ?? 0);
                    const isPos24 = change24 >= 0;
                    const isFav = favorites.has(String(coin.id));

                    return (
                      <tr key={coin.id} className="hover:bg-white/5 transition-colors group">
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleFav(String(coin.id))}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/5 border border-slate-700"
                            title="Favoritar"
                          >
                            <Star
                              size={16}
                              className={isFav ? 'text-[#dd9933]' : 'text-slate-500'}
                              fill={isFav ? '#dd9933' : 'transparent'}
                            />
                          </button>
                        </td>

                        <td className="p-3 text-[13px] font-black text-gray-400 text-center">
                          {coin.market_cap_rank ? `#${coin.market_cap_rank}` : '—'}
                        </td>

                        <td className="p-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={coin.image}
                              alt=""
                              className="w-9 h-9 rounded-full bg-[#242628] p-1 border border-white/10 shadow-sm shrink-0"
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="text-[15px] font-black text-white leading-none group-hover:text-[#dd9933] transition-colors truncate">
                                {coin.name}
                              </span>
                              <span className="text-xs font-bold text-slate-400 uppercase mt-1">{coin.symbol}</span>
                            </div>
                          </div>
                        </td>

                        <td className="p-3 text-right font-mono text-[15px] font-black text-slate-100">
                          {formatUSD(coin.current_price)}
                        </td>

                        <td className={`p-3 text-right font-mono text-[13px] font-black ${isPos24 ? 'text-green-400' : 'text-red-400'}`}>
                          {safePct(change24)}
                        </td>

                        <td className="p-3 text-right font-mono text-[13px] font-bold text-slate-300">
                          {formatUSD(coin.market_cap, true)}
                        </td>

                        <td className="p-3 text-right font-mono text-[13px] font-bold text-slate-300">
                          {formatUSD(coin.total_volume, true)}
                        </td>
                      </tr>
                    );
                  })}

                  {pageCoins.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-sm font-bold text-slate-400">
                        Nenhum resultado com os filtros atuais.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {view === 'coins' && (
        <div className="p-3 border-t border-slate-800 bg-black/20 shrink-0">
          <Paginator />
        </div>
      )}
    </div>
  );
};

// --- MAIN PAGE WRAPPER ---

interface IndicatorPageProps {
  language: Language;
  coinMap: Record<string, ApiCoin>;
  userTier: UserTier;
}

type PageType = 'MARKETCAP' | 'RSI' | 'MACD' | 'FNG' | 'LSR' | 'ALTSEASON' | 'ETF' | 'GAINERS' | 'HEATMAP' | 'BUBBLE_HEATMAP' | 'CALENDAR' | 'TRUMP';

const IndicatorPage: React.FC<IndicatorPageProps> = ({ language, coinMap, userTier }) => {
  const [activePage, setActivePage] = useState<PageType>('MARKETCAP');
  const tWs = getTranslations(language).workspace.widgets;
  const tPages = getTranslations(language).workspace.pages;

  const GROUPS = [
    { title: 'Market', items: [
      { id: 'MARKETCAP' as PageType, label: tPages.marketcap, icon: <List size={18} /> },
      { id: 'GAINERS' as PageType, label: tPages.topmovers, icon: <TrendingUp size={18} /> },
      { id: 'HEATMAP' as PageType, label: "Heatmap Square", icon: <LayoutGrid size={18} /> },
      { id: 'BUBBLE_HEATMAP' as PageType, label: "Crypto Bubbles", icon: <CircleDashed size={18} /> },
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
        <div className="w-64 flex-shrink-0 bg-white dark:bg-[#1a1c1e] border border-gray-100 dark:border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-sm transition-colors shrink-0">
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

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto custom-scrollbar pr-1">
          <PageHeader title={currentPage.label} description="Dados analíticos e ferramentas de mercado em tempo real." />

          <div className="flex-1 min-h-[600px] relative">
            {activePage === 'MARKETCAP' && <MarketCapTable language={language} />}

            {activePage === 'ALTSEASON' && (
              <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800">
                <CryptoWidget item={{ id: 'altseason-page', type: WidgetType.ALTCOIN_SEASON, title: 'Altcoin Season Index', symbol: 'GLOBAL', isMaximized: true }} language={language} />
              </div>
            )}
            {activePage === 'ETF' && (
              <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800">
                <CryptoWidget item={{ id: 'etf-page', type: WidgetType.ETF_NET_FLOW, title: 'ETF Net Flow', symbol: 'GLOBAL', isMaximized: true }} language={language} />
              </div>
            )}
            {activePage === 'FNG' && (
              <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800">
                <CryptoWidget item={{ id: 'fng-page', type: WidgetType.FEAR_GREED, title: 'Fear & Greed Index', symbol: 'GLOBAL', isMaximized: true }} language={language} />
              </div>
            )}
            {activePage === 'RSI' && (
              <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800">
                <CryptoWidget item={{ id: 'rsi-page', type: WidgetType.RSI_AVG, title: 'RSI Average Tracker', symbol: 'MARKET', isMaximized: true }} language={language} />
              </div>
            )}
            {activePage === 'MACD' && (
              <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800">
                <CryptoWidget item={{ id: 'macd-page', type: WidgetType.MACD_AVG, title: 'MACD Average Tracker', symbol: 'MARKET', isMaximized: true }} language={language} />
              </div>
            )}
            {activePage === 'GAINERS' && (
              <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800">
                <CryptoWidget item={{ id: 'gainers-page', type: WidgetType.GAINERS_LOSERS, title: 'Top Movers (24h)', symbol: 'MARKET', isMaximized: true }} language={language} />
              </div>
            )}
            {activePage === 'HEATMAP' && (
              <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800">
                <CryptoWidget item={{ id: 'heatmap-page', type: WidgetType.HEATMAP, title: 'Crypto Heatmap', symbol: 'MARKET', isMaximized: true }} language={language} />
              </div>
            )}
            {activePage === 'BUBBLE_HEATMAP' && (
              <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800">
                <CryptoWidget item={{ id: 'bubble-page', type: WidgetType.BUBBLE_HEATMAP, title: 'Crypto Bubbles', symbol: 'MARKET', isMaximized: true }} language={language} />
              </div>
            )}
            {activePage === 'CALENDAR' && (
              <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800">
                <CryptoWidget item={{ id: 'cal-page', type: WidgetType.CALENDAR, title: 'Calendar', symbol: 'CAL', isMaximized: true }} language={language} />
              </div>
            )}
            {activePage === 'TRUMP' && (
              <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800">
                <CryptoWidget item={{ id: 'trump-page', type: WidgetType.TRUMP_METER, title: 'Trump-o-Meter', symbol: 'SENTIMENT', isMaximized: true }} language={language} />
              </div>
            )}
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
      </div>
    </div>
  );
};

export default IndicatorPage;
