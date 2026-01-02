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
  const t = getTranslations(language as Language).dashboard.widgets.marketcap ?? getTranslations(language as Language).dashboard.widgets?.marketcap;
  const [coins, setCoins] = useState<ApiCoin[]>([]);
  const [loading, setLoading] = useState(true);

  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('__all__');
  const [view, setView] = useState<'coins' | 'categories'>('coins');

  // sorting
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'market_cap_rank',
    direction: 'asc',
  });

  const PAGE_SIZE = 100;
  const [page, setPage] = useState(0);

  // BUY dropdown
  const [buyOpen, setBuyOpen] = useState(false);
  const buyRef = useRef<HTMLDivElement | null>(null);

  // favorites
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // ---- Local category datasets (Cachecko local exposure)
  type TaxonomyMaster = { id: string; name: string; categoryIds: string[] };
  type CategoryListItem = { category_id: string; name: string };
  type CategoryCoinsMap = { generated_at?: string; categories?: Record<string, string[]> };

  const [taxMasters, setTaxMasters] = useState<TaxonomyMaster[]>([]);
  const [cgCategoryList, setCgCategoryList] = useState<CategoryListItem[]>([]);
  const [cgCategoryMarket, setCgCategoryMarket] = useState<any[]>([]);
  const [catMap, setCatMap] = useState<CategoryCoinsMap | null>(null);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState<string>('');
  const [activeMasterId, setActiveMasterId] = useState<string>('__masters__');

  // ---- helpers (data)
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

  const pctFromSpark = (prices?: number[], hoursBack = 1) => {
    if (!prices || prices.length < 10) return NaN;
    // 7d sparkline usually has 168 points (hourly). hoursBack approximated.
    const len = prices.length;
    const idxBack = Math.max(0, len - 1 - Math.min(len - 1, Math.round(hoursBack)));
    const prev = prices[idxBack];
    const last = prices[len - 1];
    if (!isFinite(prev) || !isFinite(last) || prev === 0) return NaN;
    return ((last - prev) / prev) * 100;
  };

  const pct7dFromSpark = (prices?: number[]) => {
    if (!prices || prices.length < 10) return NaN;
    const first = prices[0];
    const last = prices[prices.length - 1];
    if (!isFinite(first) || !isFinite(last) || first === 0) return NaN;
    return ((last - first) / first) * 100;
  };

  // ---- load coins
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

  // ---- local json fetch with cache bust
  const fetchLocalJson = async (path: string) => {
    const salt = Math.floor(Date.now() / 60000);
    const url = path.includes('?') ? `${path}&_cb=${salt}` : `${path}?_cb=${salt}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  };

  const loadCategories = async () => {
    setCatLoading(true);
    setCatError('');
    try {
      // All local, exposed by your server as /cachecko/...
      const [taxonomy, list, market] = await Promise.all([
        fetchLocalJson('/cachecko/categories/taxonomy-master.json'),
        fetchLocalJson('/cachecko/categories/coingecko_categories_list.json'),
        fetchLocalJson('/cachecko/categories/coingecko_categories_market.json'),
      ]);

      // taxonomy parsing (robust)
      const mastersRaw: any[] =
        Array.isArray(taxonomy) ? taxonomy :
        Array.isArray(taxonomy?.masters) ? taxonomy.masters :
        Array.isArray(taxonomy?.data) ? taxonomy.data :
        [];

      const masters: TaxonomyMaster[] = mastersRaw
        .map((m: any, i: number) => ({
          id: String(m.id ?? m.masterId ?? m.key ?? m.name ?? `master_${i}`),
          name: String(m.name ?? m.title ?? m.id ?? `Master ${i + 1}`),
          categoryIds: Array.isArray(m.categoryIds) ? m.categoryIds.map((x: any) => String(x)) : [],
        }))
        .filter(m => m.categoryIds.length > 0);

      const listArr: CategoryListItem[] =
        Array.isArray(list) ? list :
        Array.isArray(list?.data) ? list.data :
        [];

      const marketArr: any[] =
        Array.isArray(market) ? market :
        Array.isArray(market?.data) ? market.data :
        [];

      setTaxMasters(masters);
      setCgCategoryList(listArr);
      setCgCategoryMarket(marketArr);

      // Snapshot map (optional)
      try {
        const snapshot = await fetchLocalJson('/cachecko/categories/category_coins_map.json');
        setCatMap(snapshot as CategoryCoinsMap);
      } catch (e: any) {
        setCatMap(null);
        setCatError('Dados de categoria não indexados localmente. Coloque o snapshot em: /opt/n8n/cachecko/categories/category_coins_map.json e exponha via /cachecko/categories/category_coins_map.json.');
      }
    } catch (e: any) {
      console.error('Categories load error', e);
      setCatError('Falha ao carregar categorias locais (cachecko). Confira se /cachecko/categories/* está acessível.');
    } finally {
      setCatLoading(false);
    }
  };

  // ---- init
  useEffect(() => {
    load();
    // favorites from localStorage
    try {
      const raw = localStorage.getItem('cct_mc_favs_v1');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setFavorites(new Set(arr.map(x => String(x))));
      }
    } catch { }
  }, []);

  // ---- close dropdowns on click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buyRef.current && !buyRef.current.contains(t)) setBuyOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // ---- when open categories view first time, load datasets
  useEffect(() => {
    if (view === 'categories' && taxMasters.length === 0 && !catLoading) loadCategories();
  }, [view]);

  // ---- category mode default sorting
  useEffect(() => {
    if (activeCategory !== '__all__') {
      setSortConfig({ key: 'market_cap', direction: 'desc' });
      setPage(0);
    }
  }, [activeCategory]);

  const toggleFav = (coinId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(coinId)) next.delete(coinId);
      else next.add(coinId);
      try { localStorage.setItem('cct_mc_favs_v1', JSON.stringify([...next])); } catch { }
      return next;
    });
  };

  // ---- coin maps for instant filter
  const coinById = useMemo(() => {
    const m = new Map<string, ApiCoin>();
    for (const c of coins) m.set(String(c.id), c);
    return m;
  }, [coins]);

  const hasAnySparkline = useMemo(() => {
    return coins.some(c => Array.isArray(c.sparkline_in_7d?.price) && (c.sparkline_in_7d?.price?.length ?? 0) > 10);
  }, [coins]);

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cgCategoryList) m.set(String(c.category_id), String(c.name));
    return m;
  }, [cgCategoryList]);

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

  const masterCoinIds = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const master of taxMasters) {
      const set = new Set<string>();
      for (const cid of master.categoryIds) {
        const s = categoryCoinIds.get(String(cid));
        if (!s) continue;
        for (const id of s) set.add(id);
      }
      m.set(master.id, set);
    }
    return m;
  }, [taxMasters, categoryCoinIds]);

  // ---- pick current filter set
  const activeFilterSet = useMemo(() => {
    if (activeCategory === '__all__') return null;

    // master selection
    const isMaster = taxMasters.some(m => m.id === activeCategory);
    if (isMaster) return masterCoinIds.get(activeCategory) ?? new Set<string>();

    // category selection
    return categoryCoinIds.get(activeCategory) ?? new Set<string>();
  }, [activeCategory, taxMasters, masterCoinIds, categoryCoinIds]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    setSortConfig({ key, direction });
    setPage(0);
  };

  // ---- filtered & sorted
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
      return (c as any)[key];
    };

    items.sort((a: any, b: any) => {
      const aVal = getVal(a, sortConfig.key);
      const bVal = getVal(b, sortConfig.key);

      // favorites: force favs on top when sorting by fav
      if (sortConfig.key === 'fav') {
        const an = Number(aVal ?? 0);
        const bn = Number(bVal ?? 0);
        if (an !== bn) return sortConfig.direction === 'asc' ? (an - bn) : (bn - an);
        // tie-breaker by market cap rank
        return (a.market_cap_rank ?? 999999) - (b.market_cap_rank ?? 999999);
      }

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

  // ---- paginator
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

  // ---- columns (draggable order)
  type ColDef = {
    id: string;
    label: string;
    sortKey?: string;
    align?: 'left' | 'right' | 'center';
    width: number;
    hidden?: boolean;
    isStatic?: boolean; // not draggable
  };

  const categoryMode = activeCategory !== '__all__';

  const baseColumns: ColDef[] = useMemo(() => {
    const cols: ColDef[] = [
      { id: 'fav', label: '', sortKey: 'fav', align: 'center', width: 46, isStatic: false },
      { id: 'rank', label: '#', sortKey: 'market_cap_rank', align: 'center', width: 64, isStatic: false },
      { id: 'asset', label: 'Ativo', sortKey: 'name', align: 'left', width: 300, isStatic: false },

      { id: 'price', label: 'Preço', sortKey: 'current_price', align: 'right', width: 140, isStatic: false },
      { id: 'h1', label: '1h %', sortKey: 'change_1h_est', align: 'right', width: 92, hidden: !hasAnySparkline, isStatic: false },
      { id: 'h24', label: '24h %', sortKey: 'price_change_percentage_24h', align: 'right', width: 96, isStatic: false },
      { id: 'd7', label: '7d %', sortKey: 'change_7d_est', align: 'right', width: 96, hidden: !hasAnySparkline, isStatic: false },

      { id: 'vol24', label: 'Vol (24h)', sortKey: 'total_volume', align: 'right', width: 128, isStatic: false },
      { id: 'mcap', label: 'Market Cap', sortKey: 'market_cap', align: 'right', width: 150, isStatic: false },

      // only in general mode
      { id: 'vol7d', label: 'Vol (7d)', sortKey: 'vol_7d_est', align: 'right', width: 128, hidden: categoryMode, isStatic: false },
      { id: 'supply', label: 'Circ. Supply', sortKey: 'circulating_supply', align: 'right', width: 170, hidden: categoryMode, isStatic: false },

      // last 7 days
      { id: 'spark', label: 'Last 7 Days', sortKey: undefined, align: 'right', width: 360, hidden: !hasAnySparkline, isStatic: false },
    ];

    // CoinGecko category mode columns (per prompt)
    if (categoryMode) {
      return cols.filter(c => ['fav', 'rank', 'asset', 'price', 'h1', 'h24', 'd7', 'vol24', 'mcap', 'spark'].includes(c.id));
    }
    return cols.filter(c => !c.hidden);
  }, [hasAnySparkline, categoryMode]);

  const [colOrder, setColOrder] = useState<string[]>([]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    // restore order
    try {
      const raw = localStorage.getItem('cct_mc_col_order_v2');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setColOrder(arr.map((x: any) => String(x)));
      }
    } catch { }
  }, []);

  const orderedColumns = useMemo(() => {
    const ids = baseColumns.map(c => c.id);
    const order = colOrder.length ? colOrder.filter(id => ids.includes(id)) : ids;

    // ensure any new columns appear at end
    const missing = ids.filter(id => !order.includes(id));
    const finalOrder = [...order, ...missing];

    const map = new Map(baseColumns.map(c => [c.id, c]));
    return finalOrder.map(id => map.get(id)!).filter(Boolean);
  }, [baseColumns, colOrder]);

  const onDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedColumns.findIndex(c => c.id === active.id);
    const newIndex = orderedColumns.findIndex(c => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(orderedColumns.map(c => c.id), oldIndex, newIndex);
    setColOrder(next);
    try { localStorage.setItem('cct_mc_col_order_v2', JSON.stringify(next)); } catch { }
  };

  // ---- Sortable header cell with centered title + left handle
  const SortableTh = ({ col }: { col: ColDef }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id });
    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      width: col.width,
      opacity: isDragging ? 0.7 : 1,
    };

    const isSortable = true;

    const alignClass =
      col.align === 'right' ? 'text-right' :
      col.align === 'center' ? 'text-center' :
      'text-left';

    return (
      <th
        ref={setNodeRef}
        style={style}
        className={`p-3 select-none border-b border-slate-800 text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-400 bg-[#2f3032] sticky top-0 z-20 ${alignClass}`}
      >
        <div className="relative flex items-center w-full">
          {/* handle */}
          {isSortable && col.id !== 'spark' && (
            <button
              type="button"
              className="absolute left-0 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/5 text-gray-500"
              title="Arrastar coluna"
              {...attributes}
              {...listeners}
            >
              <GripVertical size={14} />
            </button>
          )}

          {/* title (centered, with padding so it doesn't overlap handle) */}
          <button
            type="button"
            onClick={() => col.sortKey ? handleSort(col.sortKey) : null}
            className={`w-full flex items-center gap-1 ${col.align === 'right' ? 'justify-end pr-1' : col.align === 'center' ? 'justify-center' : 'justify-start'} ${col.id !== 'fav' ? 'pl-6' : 'pl-0'} hover:text-tech-accent transition-colors`}
          >
            {col.label}
            {col.sortKey && (
              <ChevronsUpDown size={14} className={`${sortConfig.key === col.sortKey ? 'text-tech-accent' : 'text-gray-500'}`} />
            )}
          </button>
        </div>
      </th>
    );
  };

  // ---- sparkline component (stronger gradient + avoid -1 sizes)
  const Sparkline = ({ prices, isPositive }: { prices?: number[]; isPositive: boolean }) => {
    const data = (prices || []).map((v, i) => ({ i, v }));
    if (!data.length) return null;

    const gradId = isPositive ? 'sparkGradPos' : 'sparkGradNeg';

    return (
      <div className="w-full h-[46px] min-w-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isPositive ? '#63d471' : '#ff6b6b'} stopOpacity={0.55} />
                <stop offset="85%" stopColor={isPositive ? '#63d471' : '#ff6b6b'} stopOpacity={0.06} />
              </linearGradient>
            </defs>

            <YAxis domain={['auto', 'auto']} hide />
            <Area
              type="monotone"
              dataKey="v"
              stroke={isPositive ? '#63d471' : '#ff6b6b'}
              strokeWidth={2}
              fill={`url(#${gradId})`}
              fillOpacity={1}
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // ---- CATEGORY OVERVIEW computations
  type CatAggRow = {
    id: string;
    name: string;
    isMaster: boolean;
    coinCount: number;
    marketCap: number;
    volume24: number;
    pct1h: number;
    pct24h: number;
    pct7d: number;
    topGainers: ApiCoin[];
    topLosers: ApiCoin[];
    spark?: number[];
  };

  // normalize spark series per coin once (for category sparklines)
  const normSparkByCoin = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const c of coins) {
      const p = c.sparkline_in_7d?.price;
      if (!p || p.length < 10) continue;
      const first = p[0];
      if (!isFinite(first) || first === 0) continue;
      const norm = p.map(v => (isFinite(v) ? (v / first) : 1));
      m.set(String(c.id), norm);
    }
    return m;
  }, [coins]);

  const computeAgg = (ids: Set<string>): CatAggRow => {
    const arr: ApiCoin[] = [];
    for (const id of ids) {
      const c = coinById.get(String(id));
      if (c) arr.push(c);
    }

    const coinCount = arr.length;
    let marketCap = 0;
    let volume24 = 0;

    // weighted pct
    let w1 = 0, w24 = 0, w7 = 0, wSum = 0;
    let s1 = 0, s24 = 0, s7 = 0;

    for (const c of arr) {
      const mc = Number(c.market_cap ?? 0);
      const vol = Number(c.total_volume ?? 0);
      marketCap += isFinite(mc) ? mc : 0;
      volume24 += isFinite(vol) ? vol : 0;

      const p = c.sparkline_in_7d?.price;
      const pct1 = pctFromSpark(p, 1);
      const pct7 = pct7dFromSpark(p);
      const pct24 = Number(c.price_change_percentage_24h ?? NaN);

      if (isFinite(pct1)) s1 += pct1;
      if (isFinite(pct24)) s24 += pct24;
      if (isFinite(pct7)) s7 += pct7;

      if (isFinite(mc) && mc > 0) {
        if (isFinite(pct1)) w1 += mc * pct1;
        if (isFinite(pct24)) w24 += mc * pct24;
        if (isFinite(pct7)) w7 += mc * pct7;
        wSum += mc;
      }
    }

    const pct1h = wSum > 0 ? (w1 / wSum) : (coinCount ? (s1 / coinCount) : NaN);
    const pct24h = wSum > 0 ? (w24 / wSum) : (coinCount ? (s24 / coinCount) : NaN);
    const pct7d = wSum > 0 ? (w7 / wSum) : (coinCount ? (s7 / coinCount) : NaN);

    const sortedBy24 = [...arr].filter(c => isFinite(Number(c.price_change_percentage_24h))).sort((a, b) => Number(b.price_change_percentage_24h) - Number(a.price_change_percentage_24h));
    const topGainers = sortedBy24.slice(0, 3);
    const topLosers = [...sortedBy24].reverse().slice(0, 3);

    // category spark: weighted avg of normalized series
    let spark: number[] | undefined = undefined;
    if (hasAnySparkline) {
      const series: number[][] = [];
      const weights: number[] = [];
      for (const c of arr) {
        const s = normSparkByCoin.get(String(c.id));
        if (!s) continue;
        const mc = Number(c.market_cap ?? 0);
        series.push(s);
        weights.push(isFinite(mc) && mc > 0 ? mc : 1);
      }
      if (series.length) {
        const len = Math.min(...series.map(s => s.length));
        const out = new Array(len).fill(0);
        let wTot = 0;
        for (let k = 0; k < series.length; k++) {
          const w = weights[k];
          wTot += w;
          for (let i = 0; i < len; i++) out[i] += series[k][i] * w;
        }
        if (wTot > 0) spark = out.map(v => v / wTot);
      }
    }

    return {
      id: '',
      name: '',
      isMaster: false,
      coinCount,
      marketCap,
      volume24,
      pct1h,
      pct24h,
      pct7d,
      topGainers,
      topLosers,
      spark,
    };
  };

  const categoryOverviewRows = useMemo(() => {
    const rows: CatAggRow[] = [];

    if (activeMasterId === '__masters__') {
      // masters list
      for (const m of taxMasters) {
        const ids = masterCoinIds.get(m.id) ?? new Set<string>();
        const agg = computeAgg(ids);
        rows.push({
          ...agg,
          id: m.id,
          name: m.name,
          isMaster: true,
        });
      }
      // sort by market cap desc like CoinGecko
      rows.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
      return rows;
    }

    // subcategories of a master
    const master = taxMasters.find(x => x.id === activeMasterId);
    if (!master) return rows;

    for (const cid of master.categoryIds) {
      const ids = categoryCoinIds.get(String(cid)) ?? new Set<string>();
      const agg = computeAgg(ids);
      rows.push({
        ...agg,
        id: String(cid),
        name: categoryNameById.get(String(cid)) ?? String(cid),
        isMaster: false,
      });
    }

    rows.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    return rows;
  }, [activeMasterId, taxMasters, masterCoinIds, categoryCoinIds, categoryNameById, coinById, normSparkByCoin, hasAnySparkline]);

  const applyCategory = (id: string) => {
    setActiveCategory(id);
    setView('coins');
    setPage(0);
  };

  const clearCategory = () => {
    setActiveCategory('__all__');
    setSortConfig({ key: 'market_cap_rank', direction: 'asc' });
    setPage(0);
  };

  // ---- UI
  return (
    <div className="bg-[#1a1c1e] rounded-xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-full min-h-0">

      {/* Header Row: Search + Categories + BUY + Refresh + Paginator */}
      <div className="p-4 border-b border-slate-800 flex flex-col gap-3 bg-black/20 shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-center gap-3">

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

          {/* Right controls */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">

            {/* Categories button (NO POPUP) */}
            <button
              onClick={() => setView(v => v === 'coins' ? 'categories' : 'coins')}
              className={`px-3 py-2 rounded-lg border text-sm font-black transition-colors
                ${view === 'categories'
                  ? 'bg-[#dd9933] text-black border-transparent'
                  : 'bg-[#2f3032] text-white border-slate-700 hover:bg-white/5'
                }`}
              title="Categorias"
            >
              Categorias
            </button>

            {/* BUY dropdown */}
            <div className="relative" ref={buyRef}>
              <button
                onClick={() => setBuyOpen(v => !v)}
                className="px-3 py-2 rounded-lg bg-[#dd9933] text-black font-black hover:opacity-90 transition-opacity flex items-center gap-2"
                title="BUY"
              >
                BUY <ChevronDown size={16} />
              </button>

              {buyOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[#2f3032] border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
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
              onClick={() => { load(); if (view === 'categories') loadCategories(); }}
              className="p-2.5 hover:bg-white/5 rounded-lg text-gray-400 transition-colors border border-slate-700"
              title="Atualizar"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>

            {/* top paginator */}
            {view === 'coins' && <Paginator compact />}
          </div>
        </div>

        {/* Active filter badge */}
        {activeCategory !== '__all__' && (
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-300">
            <div className="truncate">
              Filtro ativo:
              <span className="ml-2 text-tech-accent font-black">
                {taxMasters.find(m => m.id === activeCategory)?.name ?? categoryNameById.get(activeCategory) ?? activeCategory}
              </span>
            </div>
            <button
              onClick={clearCategory}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-slate-700 hover:bg-white/10 font-black"
              title="Limpar filtro"
            >
              Limpar
            </button>
          </div>
        )}
      </div>

      {/* BODY: categories view OR coins table */}
      <div className="flex-1 overflow-auto custom-scrollbar">

        {/* CATEGORIES VIEW (replaces table in same page) */}
        {view === 'categories' ? (
          <div className="flex flex-col md:flex-row min-h-[520px]">

            {/* Left panel: masters / subcats */}
            <div className="w-full md:w-[320px] border-b md:border-b-0 md:border-r border-slate-800 bg-[#121416]">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="text-sm font-black text-white">Categorias</div>
                <button
                  onClick={() => setView('coins')}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-slate-700 hover:bg-white/10 text-xs font-black text-slate-200"
                >
                  Voltar
                </button>
              </div>

              {catLoading ? (
                <div className="p-4 text-sm font-bold text-slate-400 flex items-center gap-2">
                  <Loader2 className="animate-spin" size={16} />
                  Carregando categorias...
                </div>
              ) : (
                <>
                  {catError && (
                    <div className="m-4 p-3 rounded-xl border border-amber-600/40 bg-amber-500/10 text-amber-200 text-xs font-bold leading-relaxed">
                      {catError}
                    </div>
                  )}

                  <div className="p-2">
                    <button
                      onClick={() => setActiveMasterId('__masters__')}
                      className={`w-full px-3 py-2 rounded-lg text-left text-xs font-black uppercase tracking-wider border transition-colors
                        ${activeMasterId === '__masters__'
                          ? 'bg-[#dd9933] text-black border-transparent'
                          : 'bg-[#2f3032] text-slate-200 border-slate-700 hover:bg-white/5'
                        }`}
                    >
                      Masters
                    </button>
                  </div>

                  <div className="px-2 pb-2">
                    {taxMasters.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setActiveMasterId(m.id)}
                        className={`w-full px-3 py-2 rounded-lg text-left text-sm font-black border transition-colors mb-2
                          ${activeMasterId === m.id
                            ? 'bg-[#dd9933] text-black border-transparent'
                            : 'bg-[#2f3032] text-slate-200 border-slate-700 hover:bg-white/5'
                          }`}
                        title={m.name}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{m.name}</span>
                          <span className="text-xs font-black opacity-70">{m.categoryIds.length}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Right panel: overview table */}
            <div className="flex-1">
              <div className="p-4 border-b border-slate-800 bg-black/20 flex items-center justify-between">
                <div className="text-sm font-black text-white truncate">
                  {activeMasterId === '__masters__'
                    ? 'Overview: Masters'
                    : `Overview: ${taxMasters.find(x => x.id === activeMasterId)?.name ?? activeMasterId}`}
                </div>

                <button
                  onClick={clearCategory}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-slate-700 hover:bg-white/10 text-xs font-black text-slate-200"
                  title="Voltar ao marketcap geral"
                >
                  Limpar filtro
                </button>
              </div>

              <div className="overflow-auto custom-scrollbar">
                <table className="min-w-[1200px] w-full text-left border-collapse">
                  <thead className="sticky top-0 z-20 bg-[#2f3032]">
                    <tr className="text-xs font-black uppercase tracking-widest text-gray-400 border-b border-slate-800">
                      <th className="p-3 w-[240px]">Categoria</th>
                      <th className="p-3 w-[160px] text-center">Top Gainers</th>
                      <th className="p-3 w-[160px] text-center">Top Losers</th>
                      <th className="p-3 w-[90px] text-right">1h</th>
                      <th className="p-3 w-[90px] text-right">24h</th>
                      <th className="p-3 w-[90px] text-right">7d</th>
                      <th className="p-3 w-[140px] text-right">Market Cap</th>
                      <th className="p-3 w-[140px] text-right">24h Vol</th>
                      <th className="p-3 w-[90px] text-right"># Coins</th>
                      <th className="p-3 w-[260px] text-right">Gráfico</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-800">
                    {categoryOverviewRows.map(row => {
                      const pos24 = (row.pct24h ?? 0) >= 0;
                      const canFilter =
                        !!catMap?.categories &&
                        (row.isMaster ? (masterCoinIds.get(row.id)?.size ?? 0) > 0 : (categoryCoinIds.get(row.id)?.size ?? 0) > 0);

                      return (
                        <tr
                          key={row.id}
                          className={`hover:bg-white/5 transition-colors ${canFilter ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
                          onClick={() => {
                            if (!canFilter) return;
                            applyCategory(row.id);
                          }}
                          title={canFilter ? 'Clique para filtrar a tabela principal' : 'Sem snapshot de mapeamento para filtrar'}
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-black text-white truncate">{row.name}</span>
                              {row.isMaster && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white/5 border border-slate-700 text-slate-200">
                                  MASTER
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-bold text-slate-400 mt-1 truncate">{row.id}</div>
                          </td>

                          <td className="p-3">
                            <div className="flex items-center justify-center gap-2">
                              {row.topGainers.map(c => (
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
                              {row.topLosers.map(c => (
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

                          <td className="p-3">
                            {row.spark && row.spark.length > 10 ? (
                              <Sparkline prices={row.spark} isPositive={pos24} />
                            ) : (
                              <div className="text-xs font-bold text-slate-500 text-right">—</div>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {categoryOverviewRows.length === 0 && (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-sm font-bold text-slate-400">
                          Nenhuma categoria disponível com os dados atuais.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-3 border-t border-slate-800 bg-black/20 text-xs font-bold text-slate-400">
                Dica: clique numa linha para filtrar a tabela de marketcap. O filtro continua ativo mesmo voltando para “Marketcap”.
              </div>
            </div>
          </div>
        ) : (
          <>
            {loading && coins.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Loader2 className="animate-spin mb-2" size={32} />
                <span className="font-bold text-sm uppercase tracking-widest animate-pulse">Sincronizando Mercado...</span>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <table
                  className="text-left border-collapse table-fixed"
                  style={{ width: 'max-content', minWidth: '100%' }}
                >
                  <colgroup>
                    {orderedColumns.map(c => (
                      <col key={c.id} style={{ width: c.width }} />
                    ))}
                  </colgroup>

                  <thead className="sticky top-0 z-20 bg-[#2f3032]">
                    <SortableContext items={orderedColumns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                      <tr>
                        {orderedColumns.map(col => (
                          <SortableTh key={col.id} col={col} />
                        ))}
                      </tr>
                    </SortableContext>
                  </thead>

                  <tbody className="divide-y divide-slate-800">
                    {pageCoins.map((coin) => {
                      const change24 = Number(coin.price_change_percentage_24h ?? 0);
                      const isPos24 = change24 >= 0;

                      const prices = coin.sparkline_in_7d?.price;
                      const c1h = hasAnySparkline ? pctFromSpark(prices, 1) : NaN;
                      const c7d = hasAnySparkline ? pct7dFromSpark(prices) : NaN;
                      const vol7d = (coin.total_volume || 0) * 7;

                      const isFav = favorites.has(String(coin.id));

                      return (
                        <tr key={coin.id} className="hover:bg-white/5 transition-colors group">
                          {/* fav */}
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

                          {/* rank */}
                          <td className="p-3 text-[13px] font-black text-gray-400 text-center">
                            {coin.market_cap_rank ? `#${coin.market_cap_rank}` : '—'}
                          </td>

                          {/* asset */}
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

                          {/* price */}
                          <td className="p-3 text-right font-mono text-[15px] font-black text-slate-100">
                            {formatUSD(coin.current_price)}
                          </td>

                          {/* 1h */}
                          {!orderedColumns.find(c => c.id === 'h1')?.hidden && (
                            <td
                              className={`p-3 text-right font-mono text-[13px] font-black ${!isFinite(c1h) ? 'text-slate-500' : (c1h >= 0 ? 'text-green-400' : 'text-red-400')}`}
                              title="Estimativa via sparkline 7d"
                            >
                              {safePct(c1h)}
                            </td>
                          )}

                          {/* 24h */}
                          <td className={`p-3 text-right font-mono text-[15px] font-black ${isPos24 ? 'text-green-400' : 'text-red-400'}`}>
                            {safePct(change24)}
                          </td>

                          {/* 7d */}
                          {!orderedColumns.find(c => c.id === 'd7')?.hidden && (
                            <td
                              className={`p-3 text-right font-mono text-[13px] font-black ${!isFinite(c7d) ? 'text-slate-500' : (c7d >= 0 ? 'text-green-400' : 'text-red-400')}`}
                              title="Estimativa via sparkline 7d"
                            >
                              {safePct(c7d)}
                            </td>
                          )}

                          {/* vol24 */}
                          <td className="p-3 text-right font-mono text-[13px] font-bold text-slate-300">
                            {formatUSD(coin.total_volume, true)}
                          </td>

                          {/* market cap */}
                          <td className="p-3 text-right font-mono text-[13px] font-bold text-slate-300">
                            {formatUSD(coin.market_cap, true)}
                          </td>

                          {/* vol7d (general mode only) */}
                          {!orderedColumns.find(c => c.id === 'vol7d')?.hidden && (
                            <td className="p-3 text-right font-mono text-[13px] font-bold text-slate-400" title="Estimativa simples: Vol(24h) * 7">
                              {formatUSD(vol7d, true)}
                            </td>
                          )}

                          {/* supply (general mode only) */}
                          {!orderedColumns.find(c => c.id === 'supply')?.hidden && (
                            <td className="p-3 text-right font-mono text-[12px] font-bold text-slate-500">
                              {coin.circulating_supply?.toLocaleString()} <span className="uppercase opacity-50">{coin.symbol}</span>
                            </td>
                          )}

                          {/* spark */}
                          {!orderedColumns.find(c => c.id === 'spark')?.hidden && (
                            <td className="p-3">
                              {hasAnySparkline && prices && prices.length > 10 ? (
                                <Sparkline prices={prices} isPositive={isPos24} />
                              ) : (
                                <div className="text-xs font-bold text-slate-500 text-right">—</div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}

                    {pageCoins.length === 0 && (
                      <tr>
                        <td colSpan={orderedColumns.length} className="p-8 text-center text-sm font-bold text-slate-400">
                          Nenhum resultado com os filtros atuais.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </DndContext>
            )}
          </>
        )}
      </div>

      {/* Footer paginator */}
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
