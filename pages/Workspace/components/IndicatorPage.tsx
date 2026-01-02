import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WidgetType, Language, ApiCoin, UserTier } from '../../../types';
import { getTranslations } from '../../../locales';
import CryptoWidget from './CryptoWidget';

import {
  BarChart2, TrendingUp, Activity, PieChart, ArrowUpRight,
  Calendar, ChevronsUpDown, List, Loader2,
  LayoutGrid, CircleDashed, Search, RefreshCw, Lock,
  ChevronDown, User, ExternalLink, ChevronLeft, ChevronRight,
  GripVertical, Star, X, Layers
} from 'lucide-react';

import { fetchTopCoins } from '../services/api';

import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';

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
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({
    key: 'market_cap_rank',
    direction: 'asc'
  });

  const PAGE_SIZE = 100;
  const [page, setPage] = useState(0);

  // BUY dropdown
  const [buyOpen, setBuyOpen] = useState(false);
  const buyRef = useRef<HTMLDivElement | null>(null);

  // Favorites
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('mc_favs');
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  });

  const persistFavs = (set: Set<string>) => {
    try {
      localStorage.setItem('mc_favs', JSON.stringify(Array.from(set)));
    } catch {}
  };

  const toggleFav = (coinId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(coinId)) next.delete(coinId);
      else next.add(coinId);
      persistFavs(next);
      return next;
    });
  };

  // ---------- OFFLINE CATEGORIES (Cachecko local) ----------
  type TaxonomyMaster = { id: string; name: string; categoryIds: string[] };

  const [catOpen, setCatOpen] = useState(false);
  const [catLoading, setCatLoading] = useState(false);
  const [catIndexOk, setCatIndexOk] = useState(true);
  const [taxonomy, setTaxonomy] = useState<TaxonomyMaster[]>([]);
  const [catNameById, setCatNameById] = useState<Record<string, string>>({});
  const [categoryCoinsMap, setCategoryCoinsMap] = useState<Record<string, string[]> | null>(null);

  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const fetchLocalJson = async (url: string) => {
    try {
      const salt = Math.floor(Date.now() / 60000);
      const finalUrl = url.includes('?') ? `${url}&_cb=${salt}` : `${url}?_cb=${salt}`;
      const res = await fetch(finalUrl, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  const parseTaxonomy = (data: any): TaxonomyMaster[] => {
    const safeId = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const normalize = (item: any): TaxonomyMaster | null => {
      if (!item || typeof item !== 'object') return null;
      const name = String(item.name || item.master || item.title || item.id || '').trim();
      const categoryIds = Array.isArray(item.categoryIds) ? item.categoryIds
        : Array.isArray(item.categories) ? item.categories
        : Array.isArray(item.items) ? item.items
        : [];
      if (!name || !Array.isArray(categoryIds)) return null;

      const id = String(item.id || item.masterId || safeId(name));
      return { id, name, categoryIds: categoryIds.map((x: any) => String(x)).filter(Boolean) };
    };

    if (Array.isArray(data)) {
      return data.map(normalize).filter(Boolean) as TaxonomyMaster[];
    }

    if (data && typeof data === 'object') {
      if (Array.isArray(data.masters)) {
        return data.masters.map(normalize).filter(Boolean) as TaxonomyMaster[];
      }

      // object map fallback: { "Memecoins": ["dog-themed", ...], ... }
      const out: TaxonomyMaster[] = [];
      for (const k of Object.keys(data)) {
        const v = (data as any)[k];
        if (Array.isArray(v)) {
          out.push({ id: safeId(k), name: k, categoryIds: v.map((x: any) => String(x)).filter(Boolean) });
        }
      }
      return out;
    }

    return [];
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

  const loadCategoriesOffline = async () => {
    setCatLoading(true);
    try {
      // IMPORTANT:
      // Esses endpoints precisam existir via alias/servidor apontando para:
      // /opt/n8n/cachecko/categories/...
      const taxonomyData = await fetchLocalJson('/cachecko/categories/taxonomy-master.json');
      const listData = await fetchLocalJson('/cachecko/categories/coingecko_categories_list.json');
      const mapData = await fetchLocalJson('/cachecko/categories/category_coins_map.json');

      const masters = parseTaxonomy(taxonomyData);
      setTaxonomy(masters);

      const nameMap: Record<string, string> = {};
      if (Array.isArray(listData)) {
        for (const it of listData) {
          const cid = String(it?.category_id || it?.id || '').trim();
          const nm = String(it?.name || '').trim();
          if (cid && nm) nameMap[cid] = nm;
        }
      }
      setCatNameById(nameMap);

      const cats = mapData?.categories && typeof mapData.categories === 'object' ? mapData.categories : null;
      if (!cats) {
        setCatIndexOk(false);
        setCategoryCoinsMap(null);
      } else {
        setCatIndexOk(true);
        setCategoryCoinsMap(cats as Record<string, string[]>);
      }
    } catch (e) {
      console.error('Offline category load error', e);
      setCatIndexOk(false);
      setCategoryCoinsMap(null);
    } finally {
      setCatLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadCategoriesOffline(); }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buyRef.current && !buyRef.current.contains(t)) setBuyOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Pre-index coins
  const coinById = useMemo(() => {
    const m = new Map<string, ApiCoin>();
    for (const c of coins) {
      if (c?.id) m.set(String(c.id), c);
    }
    return m;
  }, [coins]);

  const categoryCoinIds = useMemo(() => {
    const m = new Map<string, Set<string>>();
    if (!categoryCoinsMap) return m;

    for (const [cid, ids] of Object.entries(categoryCoinsMap)) {
      if (!Array.isArray(ids)) continue;
      m.set(cid, new Set(ids.map(x => String(x)).filter(Boolean)));
    }
    return m;
  }, [categoryCoinsMap]);

  const masterCoinIds = useMemo(() => {
    const m = new Map<string, Set<string>>();
    if (!taxonomy || taxonomy.length === 0) return m;

    for (const master of taxonomy) {
      const set = new Set<string>();
      for (const cid of master.categoryIds) {
        const s = categoryCoinIds.get(cid);
        if (!s) continue;
        for (const id of s) set.add(id);
      }
      m.set(master.id, set);
    }
    return m;
  }, [taxonomy, categoryCoinIds]);

  const activeFilterSet = useMemo(() => {
    if (selectedCategoryId) {
      return categoryCoinIds.get(selectedCategoryId) || new Set<string>();
    }
    if (selectedMasterId) {
      return masterCoinIds.get(selectedMasterId) || new Set<string>();
    }
    return null;
  }, [selectedCategoryId, selectedMasterId, categoryCoinIds, masterCoinIds]);

  const activeFilterLabel = useMemo(() => {
    if (selectedCategoryId) return catNameById[selectedCategoryId] || selectedCategoryId;
    if (selectedMasterId) {
      const m = taxonomy.find(x => x.id === selectedMasterId);
      return m?.name || selectedMasterId;
    }
    return null;
  }, [selectedCategoryId, selectedMasterId, catNameById, taxonomy]);

  // When selecting category/master, default sort to Market Cap desc (CoinGecko behavior)
  useEffect(() => {
    if (selectedCategoryId || selectedMasterId) {
      setSortConfig({ key: 'market_cap', direction: 'desc' });
      setPage(0);
      return;
    }
    setSortConfig({ key: 'market_cap_rank', direction: 'asc' });
    setPage(0);
  }, [selectedCategoryId, selectedMasterId]);

  // ---------- Column reorder (drag&drop) ----------
  type ColDef = {
    key: string;
    label: string;
    sortKey?: string;
    align?: 'left' | 'right' | 'center';
    w?: string;
    draggable?: boolean;
    hiddenInCategoryMode?: boolean;
  };

  const CATEGORY_MODE = Boolean(selectedCategoryId || selectedMasterId);

  const BASE_COLS: ColDef[] = useMemo(() => ([
    { key: 'price', label: 'Preço', sortKey: 'current_price', align: 'right', w: 'w-[150px]', draggable: true },
    { key: '1h', label: '1h %', sortKey: 'change_1h_est', align: 'right', w: 'w-[100px]', draggable: true },
    { key: '24h', label: '24h %', sortKey: 'price_change_percentage_24h', align: 'right', w: 'w-[105px]', draggable: true },
    { key: '7d', label: '7d %', sortKey: 'change_7d_est', align: 'right', w: 'w-[105px]', draggable: true },
    { key: 'mcap', label: 'Market Cap', sortKey: 'market_cap', align: 'right', w: 'w-[160px]', draggable: true, hiddenInCategoryMode: false },
    { key: 'vol24', label: 'Vol (24h)', sortKey: 'total_volume', align: 'right', w: 'w-[140px]', draggable: true },
    { key: 'vol7d', label: 'Vol (7d)', sortKey: 'vol_7d_est', align: 'right', w: 'w-[140px]', draggable: true, hiddenInCategoryMode: true },
    { key: 'supply', label: 'Circ. Supply', sortKey: 'circulating_supply', align: 'right', w: 'w-[180px]', draggable: true, hiddenInCategoryMode: true },
    { key: 'spark', label: 'Last 7 Days', sortKey: undefined, align: 'right', w: 'w-[240px]', draggable: true }
  ]), []);

  const hasAnySparkline = useMemo(() => {
    for (const c of coins) {
      const p = c?.sparkline_in_7d?.price;
      if (Array.isArray(p) && p.length > 10) return true;
    }
    return false;
  }, [coins]);

  const DEFAULT_ORDER = useMemo(() => BASE_COLS.map(c => c.key), [BASE_COLS]);

  const [colOrder, setColOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('mc_col_order');
      const arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr) && arr.length) return arr.map(String);
      return DEFAULT_ORDER;
    } catch {
      return DEFAULT_ORDER;
    }
  });

  useEffect(() => {
    // keep order in sync when code changes
    const known = new Set(DEFAULT_ORDER);
    setColOrder(prev => {
      const filtered = prev.filter(k => known.has(k));
      for (const k of DEFAULT_ORDER) if (!filtered.includes(k)) filtered.push(k);
      try { localStorage.setItem('mc_col_order', JSON.stringify(filtered)); } catch {}
      return filtered;
    });
  }, [DEFAULT_ORDER]);

  const [dragKey, setDragKey] = useState<string | null>(null);

  const reorder = (from: string, to: string) => {
    if (from === to) return;
    setColOrder(prev => {
      const next = [...prev];
      const i = next.indexOf(from);
      const j = next.indexOf(to);
      if (i === -1 || j === -1) return prev;
      next.splice(i, 1);
      next.splice(j, 0, from);
      try { localStorage.setItem('mc_col_order', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const visibleCols = useMemo(() => {
    const defByKey = new Map(BASE_COLS.map(d => [d.key, d]));
    const ordered = colOrder.map(k => defByKey.get(k)).filter(Boolean) as ColDef[];

    return ordered.filter(c => {
      if (c.key === 'spark' && !hasAnySparkline) return false;
      if (CATEGORY_MODE && c.hiddenInCategoryMode) return false;
      return true;
    });
  }, [BASE_COLS, colOrder, hasAnySparkline, CATEGORY_MODE]);

  const handleSort = (key?: string) => {
    if (!key) return;
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    setSortConfig({ key, direction });
    setPage(0);
  };

  // ---------- Filtering + Sorting ----------
  const filteredSortedCoins = useMemo(() => {
    let items = [...coins];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      items = items.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.symbol?.toLowerCase().includes(q)
      );
    }

    if (activeFilterSet) {
      items = items.filter(c => c?.id && activeFilterSet.has(String(c.id)));
    }

    const getPct24 = (c: ApiCoin) => {
      const v = (c as any).price_change_percentage_24h_in_currency ?? (c as any).price_change_percentage_24h ?? (c as any).price_change_percentage_24h;
      return isFinite(v) ? Number(v) : 0;
    };

    const getVal = (c: ApiCoin, key: string) => {
      const prices = c.sparkline_in_7d?.price;

      if (key === 'change_1h_est') {
        const direct = (c as any).price_change_percentage_1h_in_currency ?? (c as any).price_change_percentage_1h;
        if (isFinite(direct)) return Number(direct);
        return pctFromSpark(prices, 1);
      }

      if (key === 'change_7d_est') {
        const direct = (c as any).price_change_percentage_7d_in_currency ?? (c as any).price_change_percentage_7d;
        if (isFinite(direct)) return Number(direct);
        return pct7dFromSpark(prices);
      }

      if (key === 'vol_7d_est') return (c.total_volume || 0) * 7;

      if (key === 'price_change_percentage_24h') return getPct24(c);

      // @ts-ignore
      return (c as any)[key];
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
  }, [coins, searchTerm, sortConfig, activeFilterSet]);

  const totalCount = filteredSortedCoins.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  const pageCoins = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return filteredSortedCoins.slice(start, start + PAGE_SIZE);
  }, [filteredSortedCoins, safePage]);

  useEffect(() => { setPage(0); }, [searchTerm, selectedCategoryId, selectedMasterId]);
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

  const HeaderCell = ({ col }: { col: ColDef }) => {
    const align = col.align || 'left';

    return (
      <th
        className={`p-3 select-none ${col.w ? col.w : ''} ${
          align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
        } ${col.sortKey ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5' : ''}`}
        onClick={() => handleSort(col.sortKey)}
        draggable={Boolean(col.draggable)}
        onDragStart={(e) => {
          if (!col.draggable) return;
          setDragKey(col.key);
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', col.key);
        }}
        onDragOver={(e) => {
          if (!col.draggable) return;
          e.preventDefault();
        }}
        onDrop={(e) => {
          if (!col.draggable) return;
          e.preventDefault();
          const from = e.dataTransfer.getData('text/plain');
          if (from) reorder(from, col.key);
          setDragKey(null);
        }}
      >
        <div className="relative">
          {col.draggable && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100">
              <GripVertical size={16} className="text-gray-400" />
            </span>
          )}

          {/* Header label centered to avoid solapar no puxador */}
          <div className={`flex items-center justify-center gap-1 ${col.draggable ? 'pl-5' : ''}`}>
            <span className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-400">
              {col.label}
            </span>
            {col.sortKey && (
              <ChevronsUpDown
                size={14}
                className={`text-gray-400 ${
                  sortConfig.key === col.sortKey ? 'text-tech-accent' : ''
                }`}
              />
            )}
          </div>
        </div>
      </th>
    );
  };

  // ---------- Category stats for the modal (overview) ----------
  type CatStats = {
    key: string;
    name: string;
    coinIds: Set<string>;
    coins: ApiCoin[];
    count: number;
    marketCap: number;
    volume24h: number;
    pct1h: number;
    pct24h: number;
    pct7d: number;
    gainers: ApiCoin[];
    losers: ApiCoin[];
    spark: { i: number; v: number }[];
  };

  const sparkCache = useRef<Map<string, { i: number; v: number }[]>>(new Map());

  const buildAggSpark = (key: string, ids: Set<string>) => {
    if (sparkCache.current.has(key)) return sparkCache.current.get(key)!;

    // pega top coins por market cap, limita pra não matar performance
    const arr: ApiCoin[] = [];
    for (const id of ids) {
      const c = coinById.get(id);
      if (c) arr.push(c);
    }
    arr.sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));

    const top = arr.slice(0, 30).filter(c => Array.isArray(c.sparkline_in_7d?.price) && (c.sparkline_in_7d?.price?.length || 0) > 10);
    if (top.length === 0) {
      const empty: { i: number; v: number }[] = [];
      sparkCache.current.set(key, empty);
      return empty;
    }

    const len = Math.min(...top.map(c => c.sparkline_in_7d!.price!.length));
    const weights = top.map(c => Math.max(1, Number(c.market_cap || 0)));
    const wsum = weights.reduce((a, b) => a + b, 0);

    const series: { i: number; v: number }[] = [];
    for (let i = 0; i < len; i++) {
      let acc = 0;
      for (let k = 0; k < top.length; k++) {
        const p0 = top[k].sparkline_in_7d!.price![0] || 1;
        const pi = top[k].sparkline_in_7d!.price![i] || p0;
        const rel = (pi / p0) * 100; // índice relativo
        acc += rel * weights[k];
      }
      series.push({ i, v: acc / (wsum || 1) });
    }

    sparkCache.current.set(key, series);
    return series;
  };

  const computeStats = (key: string, name: string, ids: Set<string>): CatStats => {
    const list: ApiCoin[] = [];
    for (const id of ids) {
      const c = coinById.get(id);
      if (c) list.push(c);
    }

    const count = list.length;
    let mcap = 0;
    let vol = 0;

    let wSum = 0;
    let w1 = 0;
    let w24 = 0;
    let w7 = 0;

    let s1 = 0, s24 = 0, s7 = 0;

    for (const c of list) {
      const mc = Number(c.market_cap || 0);
      const v24 = Number(c.total_volume || 0);
      const p1 = Number((c as any).price_change_percentage_1h_in_currency ?? (c as any).price_change_percentage_1h ?? pctFromSpark(c.sparkline_in_7d?.price, 1));
      const p24 = Number((c as any).price_change_percentage_24h_in_currency ?? (c as any).price_change_percentage_24h ?? c.price_change_percentage_24h ?? 0);
      const p7 = Number((c as any).price_change_percentage_7d_in_currency ?? (c as any).price_change_percentage_7d ?? pct7dFromSpark(c.sparkline_in_7d?.price));

      mcap += mc;
      vol += v24;

      if (mc > 0 && isFinite(p1) && isFinite(p24) && isFinite(p7)) {
        wSum += mc;
        w1 += mc * p1;
        w24 += mc * p24;
        w7 += mc * p7;
      } else {
        if (isFinite(p1)) s1 += p1;
        if (isFinite(p24)) s24 += p24;
        if (isFinite(p7)) s7 += p7;
      }
    }

    const pct1h = wSum > 0 ? (w1 / wSum) : (count ? (s1 / count) : 0);
    const pct24h = wSum > 0 ? (w24 / wSum) : (count ? (s24 / count) : 0);
    const pct7d = wSum > 0 ? (w7 / wSum) : (count ? (s7 / count) : 0);

    const by24 = [...list].sort((a, b) => {
      const av = Number((a as any).price_change_percentage_24h_in_currency ?? (a as any).price_change_percentage_24h ?? a.price_change_percentage_24h ?? 0);
      const bv = Number((b as any).price_change_percentage_24h_in_currency ?? (b as any).price_change_percentage_24h ?? b.price_change_percentage_24h ?? 0);
      return bv - av;
    });

    const gainers = by24.slice(0, 3);
    const losers = [...by24].reverse().slice(0, 3);

    const spark = hasAnySparkline ? buildAggSpark(key, ids) : [];

    return { key, name, coinIds: ids, coins: list, count, marketCap: mcap, volume24h: vol, pct1h, pct24h, pct7d, gainers, losers, spark };
  };

  const mastersTop = useMemo(() => (taxonomy || []).slice(0, 15), [taxonomy]);

  const selectedMaster = useMemo(() => {
    if (!selectedMasterId) return null;
    return taxonomy.find(m => m.id === selectedMasterId) || null;
  }, [selectedMasterId, taxonomy]);

  const modalRows = useMemo(() => {
    if (!catOpen) return [] as CatStats[];
    if (!catIndexOk) return [] as CatStats[];

    // Level 1: masters
    if (!selectedMasterId) {
      return mastersTop.map(m => computeStats(`master:${m.id}`, m.name, masterCoinIds.get(m.id) || new Set<string>()));
    }

    // Level 2: subcategories of master
    const rows: CatStats[] = [];
    const sub = selectedMaster?.categoryIds || [];
    for (const cid of sub) {
      const ids = categoryCoinIds.get(cid);
      if (!ids) continue;
      const nm = catNameById[cid] || cid;
      rows.push(computeStats(`cat:${cid}`, nm, ids));
    }
    rows.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    return rows;
  }, [catOpen, catIndexOk, selectedMasterId, mastersTop, selectedMaster, masterCoinIds, categoryCoinIds, catNameById]);

  const clearCategoryFilter = () => {
    setSelectedCategoryId(null);
    setSelectedMasterId(null);
    setPage(0);
  };

  // ---------- UI: Category Modal ----------
  const CategoryModal = () => {
    if (!catOpen) return null;

    return (
      <div className="fixed inset-0 z-[9999]">
        <div className="absolute inset-0 bg-black/60" onClick={() => setCatOpen(false)} />

        <div className="absolute right-0 top-0 h-full w-[980px] max-w-[95vw] bg-white dark:bg-[#1a1c1e] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-black/30 flex items-center justify-center border border-slate-200 dark:border-slate-800">
                <Layers size={18} className="text-gray-600 dark:text-slate-300" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black tracking-widest uppercase text-gray-700 dark:text-slate-200">
                  Categorias
                </span>
                <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
                  {catIndexOk ? 'Modo CoinGecko (offline)' : 'Sem snapshot local (category_coins_map.json)'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(selectedMasterId || selectedCategoryId) && (
                <button
                  onClick={clearCategoryFilter}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-black text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5"
                >
                  Limpar
                </button>
              )}

              <button
                onClick={() => setCatOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
                title="Fechar"
              >
                <X size={18} className="text-gray-700 dark:text-slate-200" />
              </button>
            </div>
          </div>

          {!catIndexOk && (
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-200 text-sm font-bold">
              Dados de categoria não indexados localmente. Coloque o snapshot em:
              <span className="font-black"> /opt/n8n/cachecko/categories/category_coins_map.json </span>
              e exponha via <span className="font-black">/cachecko/categories/category_coins_map.json</span>.
            </div>
          )}

          <div className="flex-1 min-h-0 grid grid-cols-12">
            {/* LEFT NAV */}
            <div className="col-span-4 border-r border-slate-200 dark:border-slate-800 min-h-0 flex flex-col">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                <div className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-slate-400">
                  {selectedMasterId ? 'Subcategorias' : 'Masters'}
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
                {!selectedMasterId && (
                  <div className="p-2">
                    {mastersTop.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { setSelectedMasterId(m.id); setSelectedCategoryId(null); }}
                        className="w-full px-3 py-3 rounded-xl text-left hover:bg-gray-100 dark:hover:bg-white/5 flex items-center justify-between"
                      >
                        <span className="font-black text-sm text-gray-800 dark:text-slate-200 truncate">
                          {m.name}
                        </span>
                        <span className="text-xs font-black text-gray-500 dark:text-slate-400">
                          {(masterCoinIds.get(m.id)?.size || 0).toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {selectedMasterId && (
                  <div className="p-2">
                    <button
                      onClick={() => { setSelectedMasterId(null); setSelectedCategoryId(null); }}
                      className="w-full px-3 py-2 mb-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5"
                    >
                      ← Voltar pros Masters
                    </button>

                    {(selectedMaster?.categoryIds || []).map(cid => {
                      const nm = catNameById[cid] || cid;
                      const size = categoryCoinIds.get(cid)?.size || 0;
                      const active = selectedCategoryId === cid;

                      return (
                        <button
                          key={cid}
                          disabled={!catIndexOk || size === 0}
                          onClick={() => { setSelectedCategoryId(cid); }}
                          className={`w-full px-3 py-3 rounded-xl text-left flex items-center justify-between transition-colors
                            ${active ? 'bg-[#dd9933] text-black' : 'hover:bg-gray-100 dark:hover:bg-white/5'}
                            ${(!catIndexOk || size === 0) ? 'opacity-40 cursor-not-allowed' : ''}
                          `}
                          title={cid}
                        >
                          <span className={`font-black text-sm truncate ${active ? 'text-black' : 'text-gray-800 dark:text-slate-200'}`}>
                            {nm}
                          </span>
                          <span className={`text-xs font-black ${active ? 'text-black/70' : 'text-gray-500 dark:text-slate-400'}`}>
                            {size.toLocaleString()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* OVERVIEW TABLE */}
            <div className="col-span-8 min-h-0 flex flex-col">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-slate-400">
                  Overview
                </div>
                {catLoading && (
                  <div className="text-xs font-bold text-gray-500 dark:text-slate-400 flex items-center gap-2">
                    <Loader2 className="animate-spin" size={14} />
                    Carregando...
                  </div>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-[#1a1c1e]">
                    <tr className="text-[11px] font-black uppercase tracking-widest text-gray-400 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <th className="p-3 w-[260px]">Nome</th>
                      <th className="p-3 w-[140px]">Top Gainers</th>
                      <th className="p-3 w-[140px]">Top Losers</th>
                      <th className="p-3 text-right w-[80px]">1h</th>
                      <th className="p-3 text-right w-[80px]">24h</th>
                      <th className="p-3 text-right w-[80px]">7d</th>
                      <th className="p-3 text-right w-[140px]">Market Cap</th>
                      <th className="p-3 text-right w-[140px]">24h Vol</th>
                      <th className="p-3 text-right w-[90px]"># Coins</th>
                      {hasAnySparkline && <th className="p-3 text-right w-[220px]">Gráfico</th>}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {modalRows.map(r => {
                      const pos24 = (r.pct24h || 0) >= 0;
                      const canClick = r.count > 0 && catIndexOk;

                      return (
                        <tr
                          key={r.key}
                          className={`hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors ${canClick ? 'cursor-pointer' : 'opacity-60'}`}
                          onClick={() => {
                            if (!canClick) return;

                            // clicking row selects master/subcategory depending on level
                            if (!selectedMasterId) {
                              const m = taxonomy.find(x => `master:${x.id}` === r.key);
                              if (m) {
                                setSelectedMasterId(m.id);
                                setSelectedCategoryId(null);
                              }
                              return;
                            }

                            // subcategory selection = filter main table immediately
                            const cid = r.key.startsWith('cat:') ? r.key.replace('cat:', '') : null;
                            if (cid) setSelectedCategoryId(cid);
                          }}
                        >
                          <td className="p-3 font-black text-sm text-gray-800 dark:text-slate-200 truncate">
                            {r.name}
                          </td>

                          <td className="p-3">
                            <div className="flex -space-x-2">
                              {r.gainers.map((c, i) => (
                                <img
                                  key={c.id + i}
                                  src={c.image}
                                  alt=""
                                  className="w-7 h-7 rounded-full bg-slate-100 dark:bg-[#242628] p-1 border border-slate-200 dark:border-white/10"
                                  onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                              ))}
                            </div>
                          </td>

                          <td className="p-3">
                            <div className="flex -space-x-2">
                              {r.losers.map((c, i) => (
                                <img
                                  key={c.id + i}
                                  src={c.image}
                                  alt=""
                                  className="w-7 h-7 rounded-full bg-slate-100 dark:bg-[#242628] p-1 border border-slate-200 dark:border-white/10"
                                  onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                              ))}
                            </div>
                          </td>

                          <td className={`p-3 text-right font-mono text-xs font-black ${r.pct1h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {safePct(r.pct1h)}
                          </td>

                          <td className={`p-3 text-right font-mono text-xs font-black ${pos24 ? 'text-green-500' : 'text-red-500'}`}>
                            {safePct(r.pct24h)}
                          </td>

                          <td className={`p-3 text-right font-mono text-xs font-black ${r.pct7d >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {safePct(r.pct7d)}
                          </td>

                          <td className="p-3 text-right font-mono text-xs font-black text-gray-700 dark:text-slate-300">
                            {formatUSD(r.marketCap, true)}
                          </td>

                          <td className="p-3 text-right font-mono text-xs font-black text-gray-700 dark:text-slate-300">
                            {formatUSD(r.volume24h, true)}
                          </td>

                          <td className="p-3 text-right font-mono text-xs font-black text-gray-600 dark:text-slate-400">
                            {r.count.toLocaleString()}
                          </td>

                          {hasAnySparkline && (
                            <td className="p-2 w-[220px]">
                              {r.spark.length > 0 ? (
                                <div className="w-full min-w-[180px] h-[34px]">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={r.spark}>
                                      <defs>
                                        <linearGradient id={`grad_${r.key.replace(/[^a-z0-9]/gi, '_')}`} x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="0%" stopColor={pos24 ? '#548f3f' : '#CD534B'} stopOpacity={0.40} />
                                          <stop offset="70%" stopColor={pos24 ? '#548f3f' : '#CD534B'} stopOpacity={0.10} />
                                          <stop offset="100%" stopColor={pos24 ? '#548f3f' : '#CD534B'} stopOpacity={0.00} />
                                        </linearGradient>
                                      </defs>
                                      <Area
                                        type="monotone"
                                        dataKey="v"
                                        stroke={pos24 ? '#548f3f' : '#CD534B'}
                                        fill={`url(#grad_${r.key.replace(/[^a-z0-9]/gi, '_')})`}
                                        strokeWidth={2}
                                        dot={false}
                                        isAnimationActive={false}
                                      />
                                      <YAxis domain={['auto', 'auto']} hide />
                                    </AreaChart>
                                  </ResponsiveContainer>
                                </div>
                              ) : (
                                <div className="w-full min-w-[180px] h-[34px] rounded-md bg-slate-100 dark:bg-black/20" />
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}

                    {modalRows.length === 0 && (
                      <tr>
                        <td colSpan={hasAnySparkline ? 10 : 9} className="p-8 text-center text-sm font-bold text-gray-500 dark:text-slate-400">
                          Sem dados para mostrar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-xs font-bold text-gray-500 dark:text-slate-400">
                {selectedCategoryId ? 'Selecionou categoria: ' : selectedMasterId ? 'Master selecionado: ' : 'Selecione um master para ver subcategorias.'}
                <span className="ml-1 font-black text-gray-700 dark:text-slate-200">{activeFilterLabel || '-'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---------- Render ----------
  return (
    <div className="bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-100 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col h-full min-h-0">

      {/* Header Row: Search + Categorias + BUY + Refresh + Paginator */}
      <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex flex-col gap-3 bg-gray-50/50 dark:bg-black/20 shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2 w-full md:w-auto">
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

            {/* Categorias (CoinGecko style) */}
            <button
              onClick={() => setCatOpen(true)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2f3032] text-gray-700 dark:text-slate-200 font-black hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
              title="Categorias"
            >
              <Layers size={16} />
              Categorias
            </button>

            {/* Active filter pill */}
            {activeFilterLabel && (
              <button
                onClick={() => setCatOpen(true)}
                className="px-3 py-2 rounded-lg bg-[#dd9933] text-black font-black hover:opacity-90 transition-opacity"
                title="Filtro ativo"
              >
                {activeFilterLabel}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <Paginator compact />

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
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#2f3032] border border-slate-100 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
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
              onClick={() => { load(); loadCategoriesOffline(); }}
              className="p-2.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-gray-500 transition-colors"
              title="Atualizar"
            >
              <RefreshCw size={22} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {loading && coins.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Loader2 className="animate-spin mb-2" size={32} />
            <span className="font-bold text-sm uppercase tracking-widest animate-pulse">Sincronizando Mercado...</span>
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[1320px] table-fixed">
            <thead className="sticky top-0 z-20 bg-white dark:bg-[#2f3032]">
              <tr className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-400 border-b border-gray-100 dark:border-slate-800">
                {/* ⭐ Favorites */}
                <th className="p-3 w-[44px] text-center">
                  <Star size={16} className="inline text-gray-400" />
                </th>

                {/* Rank tighter */}
                <th
                  className="p-3 w-[56px] text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5"
                  onClick={() => handleSort('market_cap_rank')}
                >
                  <div className="flex items-center justify-center gap-1">
                    #
                    <ChevronsUpDown size={14} className={`${sortConfig.key === 'market_cap_rank' ? 'text-tech-accent' : 'text-gray-400'}`} />
                  </div>
                </th>

                {/* Ativo wider */}
                <th
                  className="p-3 w-[420px] cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Ativo
                    <ChevronsUpDown size={14} className={`${sortConfig.key === 'name' ? 'text-tech-accent' : 'text-gray-400'}`} />
                  </div>
                </th>

                {visibleCols.map(col => <HeaderCell key={col.key} col={col} />)}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {pageCoins.map((coin) => {
                const prices = coin.sparkline_in_7d?.price;
                const c1h = Number((coin as any).price_change_percentage_1h_in_currency ?? (coin as any).price_change_percentage_1h ?? pctFromSpark(prices, 1));
                const c7d = Number((coin as any).price_change_percentage_7d_in_currency ?? (coin as any).price_change_percentage_7d ?? pct7dFromSpark(prices));
                const change24 = Number((coin as any).price_change_percentage_24h_in_currency ?? (coin as any).price_change_percentage_24h ?? coin.price_change_percentage_24h ?? 0);

                const isPos24 = change24 >= 0;
                const vol7d = (coin.total_volume || 0) * 7;

                const sparkData = Array.isArray(prices) ? prices.map((v, i) => ({ i, v })) : [];

                return (
                  <tr key={coin.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors group">
                    {/* ⭐ */}
                    <td className="p-2 w-[44px] text-center">
                      <button
                        onClick={() => toggleFav(String(coin.id))}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
                        title="Favoritar"
                      >
                        <Star
                          size={16}
                          className={favorites.has(String(coin.id)) ? 'text-[#dd9933]' : 'text-gray-400'}
                          fill={favorites.has(String(coin.id)) ? '#dd9933' : 'transparent'}
                        />
                      </button>
                    </td>

                    {/* Rank */}
                    <td className="p-2 text-[13px] font-black text-gray-400 w-[56px] text-center">
                      #{coin.market_cap_rank}
                    </td>

                    {/* Ativo */}
                    <td className="p-3 w-[420px]">
                      <div className="flex items-center gap-3">
                        <img
                          src={coin.image}
                          alt=""
                          className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#242628] p-1 border border-slate-200 dark:border-white/10 shadow-sm"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-[15px] font-black text-gray-900 dark:text-white leading-none group-hover:text-[#dd9933] transition-colors truncate">
                            {coin.name}
                          </span>
                          <span className="text-xs font-bold text-gray-500 uppercase mt-1">{coin.symbol}</span>
                        </div>
                      </div>
                    </td>

                    {/* Dynamic columns */}
                    {visibleCols.map(col => {
                      if (col.key === 'price') {
                        return (
                          <td key={col.key} className="p-3 text-right font-mono text-[15px] font-black text-gray-900 dark:text-slate-200 w-[150px]">
                            {formatUSD(coin.current_price)}
                          </td>
                        );
                      }

                      if (col.key === '1h') {
                        return (
                          <td
                            key={col.key}
                            className={`p-3 text-right font-mono text-[13px] font-black w-[100px] ${
                              !isFinite(c1h) ? 'text-gray-400 dark:text-slate-500' : (c1h >= 0 ? 'text-green-500' : 'text-red-500')
                            }`}
                            title="1h (sparkline ou campo direto)"
                          >
                            {safePct(c1h)}
                          </td>
                        );
                      }

                      if (col.key === '24h') {
                        return (
                          <td key={col.key} className={`p-3 text-right font-mono text-[15px] font-black w-[105px] ${isPos24 ? 'text-green-500' : 'text-red-500'}`}>
                            {isPos24 ? '+' : ''}{change24.toFixed(2)}%
                          </td>
                        );
                      }

                      if (col.key === '7d') {
                        return (
                          <td
                            key={col.key}
                            className={`p-3 text-right font-mono text-[13px] font-black w-[105px] ${
                              !isFinite(c7d) ? 'text-gray-400 dark:text-slate-500' : (c7d >= 0 ? 'text-green-500' : 'text-red-500')
                            }`}
                            title="7d (sparkline ou campo direto)"
                          >
                            {safePct(c7d)}
                          </td>
                        );
                      }

                      if (col.key === 'mcap') {
                        return (
                          <td key={col.key} className="p-3 text-right font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400 w-[160px]">
                            {formatUSD(coin.market_cap, true)}
                          </td>
                        );
                      }

                      if (col.key === 'vol24') {
                        return (
                          <td key={col.key} className="p-3 text-right font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400 w-[140px]">
                            {formatUSD(coin.total_volume, true)}
                          </td>
                        );
                      }

                      if (col.key === 'vol7d') {
                        return (
                          <td key={col.key} className="p-3 text-right font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400 w-[140px]" title="Estimativa simples: Vol(24h) * 7">
                            {formatUSD(vol7d, true)}
                          </td>
                        );
                      }

                      if (col.key === 'supply') {
                        return (
                          <td key={col.key} className="p-3 text-right font-mono text-[12px] font-bold text-gray-500 dark:text-slate-500 w-[180px]">
                            {coin.circulating_supply?.toLocaleString()} <span className="uppercase opacity-50">{coin.symbol}</span>
                          </td>
                        );
                      }

                      if (col.key === 'spark') {
                        return (
                          <td key={col.key} className="p-2 w-[240px]">
                            {sparkData.length > 0 ? (
                              <div className="w-full min-w-[200px] h-[38px]">
                                <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={sparkData}>
                                    <defs>
                                      <linearGradient id={`spark_${coin.id}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={isPos24 ? '#548f3f' : '#CD534B'} stopOpacity={0.45} />
                                        <stop offset="70%" stopColor={isPos24 ? '#548f3f' : '#CD534B'} stopOpacity={0.15} />
                                        <stop offset="100%" stopColor={isPos24 ? '#548f3f' : '#CD534B'} stopOpacity={0.00} />
                                      </linearGradient>
                                    </defs>
                                    <Area
                                      type="monotone"
                                      dataKey="v"
                                      stroke={isPos24 ? '#548f3f' : '#CD534B'}
                                      fill={`url(#spark_${coin.id})`}
                                      strokeWidth={2}
                                      dot={false}
                                      isAnimationActive={false}
                                    />
                                    <YAxis domain={['auto', 'auto']} hide />
                                  </AreaChart>
                                </ResponsiveContainer>
                              </div>
                            ) : (
                              <div className="w-full min-w-[200px] h-[38px] rounded-md bg-slate-100 dark:bg-black/20" />
                            )}
                          </td>
                        );
                      }

                      return <td key={col.key} className="p-3" />;
                    })}
                  </tr>
                );
              })}

              {pageCoins.length === 0 && (
                <tr>
                  <td colSpan={3 + visibleCols.length} className="p-8 text-center text-sm font-bold text-gray-500 dark:text-slate-400">
                    Nenhum resultado com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer paginator */}
      <div className="p-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-black/20 shrink-0">
        <Paginator />
      </div>

      {/* Modal */}
      <CategoryModal />
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
