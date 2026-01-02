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

// -------------------- HELPERS --------------------

const formatUSD = (v: any, compact = false) => {
  const n = Number(v);
  if (!isFinite(n)) return '-';

  if (compact) {
    const abs = Math.abs(n);
    if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
    return `$${n.toFixed(2)}`;
  }

  const maxDecimals = n >= 100 ? 0 : n >= 1 ? 2 : 6;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: maxDecimals,
  }).format(n);
};

const safePct = (v: any) => {
  const n = Number(v);
  if (!isFinite(n)) return '--';
  const s = n >= 0 ? '+' : '';
  return `${s}${n.toFixed(2)}%`;
};

// sparkline 7d: varia por fonte. Então faz robusto por índice, sem assumir 168.
const pctFromSpark = (prices?: number[], pointsBack = 1) => {
  const arr = Array.isArray(prices) ? prices.filter(n => typeof n === 'number' && isFinite(n)) : [];
  if (arr.length < 2) return NaN;

  const last = arr[arr.length - 1];
  const idx = Math.max(0, arr.length - 1 - Math.max(1, Math.floor(pointsBack)));
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

// getters tolerantes (se vier "in_currency" ou campos antigos)
const getPct24h = (c: any) =>
  Number(
    c?.price_change_percentage_24h_in_currency ??
    c?.price_change_percentage_24h ??
    0
  );

const getPct1h = (c: any) =>
  Number(
    c?.price_change_percentage_1h_in_currency ??
    c?.price_change_percentage_1h ??
    NaN
  );

const getPct7d = (c: any) =>
  Number(
    c?.price_change_percentage_7d_in_currency ??
    c?.price_change_percentage_7d ??
    NaN
  );

function LockOverlay() {
  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center rounded-xl">
      <Lock size={40} className="text-[#dd9933] mb-4" />
      <h3 className="text-xl font-bold text-white mb-2">Upgrade Required</h3>
      <p className="text-gray-300 text-sm mb-4">Subscribe to Tier 2 or higher to access this page.</p>
    </div>
  );
}

function PageHeader({ title, description }: { title: string; description: string }) {
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

type TaxonomyMaster = {
  id: string;
  name: string;
  categoryIds?: string[];
  groups?: { id: string; name: string; categoryIds: string[] }[];
};

type CatListRow = { category_id: string; name: string } | { id: string; name: string };
type CatMarketRow = any;

const MarketCapTable = ({ language }: { language: Language }) => {
  const [coins, setCoins] = useState<ApiCoin[]>([]);
  const [loading, setLoading] = useState(true);

  // Views
  const [view, setView] = useState<'market' | 'categories'>('market');

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  // Sort
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'market_cap_rank',
    direction: 'asc',
  });

  // Pagination
  const PAGE_SIZE = 100;
  const [page, setPage] = useState(0);

  // Favorites (placeholder pro futuro)
  const [fav, setFav] = useState<Set<string>>(new Set());

  // BUY dropdown
  const [buyOpen, setBuyOpen] = useState(false);
  const buyRef = useRef<HTMLDivElement | null>(null);

  // Column reorder
  type ColId =
    | 'fav'
    | 'rank'
    | 'asset'
    | 'price'
    | 'chg1h'
    | 'chg24h'
    | 'chg7d'
    | 'mcap'
    | 'vol24h'
    | 'vol7d'
    | 'circ'
    | 'spark';

  const [colOrder, setColOrder] = useState<ColId[]>([
    'fav',
    'rank',
    'asset',
    'price',
    'chg1h',
    'chg24h',
    'chg7d',
    'mcap',
    'vol24h',
    'vol7d',
    'circ',
    'spark',
  ]);

  // Categories local data
  const [catLoading, setCatLoading] = useState(false);
  const [taxonomyMasters, setTaxonomyMasters] = useState<TaxonomyMaster[]>([]);
  const [catList, setCatList] = useState<Record<string, string>>({});
  const [catMarket, setCatMarket] = useState<Record<string, any>>({});
  const [catMap, setCatMap] = useState<Record<string, string[]>>({});
  const [hasCatSnapshot, setHasCatSnapshot] = useState<boolean>(true);
  const [catWarnShown, setCatWarnShown] = useState(false);

  // Master/group/category selection (sem “Masters” no dropdown)
  const [selMasterId, setSelMasterId] = useState<string>(''); // vazio = nada selecionado
  const [selGroupId, setSelGroupId] = useState<string>('');   // vazio = sem group
  const [selCategoryId, setSelCategoryId] = useState<string>(''); // coin-gecko category id

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    setSortConfig({ key, direction });
    setPage(0);
  };

  const loadCoins = async () => {
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

  const fetchLocalJson = async (url: string) => {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${url} -> ${r.status}`);
    return r.json();
  };

  const loadCategoriesLocal = async () => {
    setCatLoading(true);
    try {
      const [taxonomy, list, market] = await Promise.all([
        fetchLocalJson('/cachecko/categories/taxonomy-master.json'),
        fetchLocalJson('/cachecko/categories/coingecko_categories_list.json'),
        fetchLocalJson('/cachecko/categories/coingecko_categories_market.json'),
      ]);

      const masters: TaxonomyMaster[] = Array.isArray(taxonomy) ? taxonomy : (taxonomy?.masters || taxonomy?.data || []);
      setTaxonomyMasters(masters || []);

      const listArr: CatListRow[] = Array.isArray(list) ? list : (list?.data || []);
      const listMap: Record<string, string> = {};
      for (const row of listArr) {
        const id = (row as any).category_id ?? (row as any).id;
        const name = (row as any).name;
        if (id && name) listMap[String(id)] = String(name);
      }
      setCatList(listMap);

      const marketArr: CatMarketRow[] = Array.isArray(market) ? market : (market?.data || []);
      const marketMap: Record<string, any> = {};
      for (const row of marketArr) {
        const id = String(row?.id ?? row?.category_id ?? '');
        if (!id) continue;
        marketMap[id] = row;
      }
      setCatMarket(marketMap);

      // Snapshot (opcional)
      try {
        const snap = await fetchLocalJson('/cachecko/categories/category_coins_map.json');
        const cats = snap?.categories || {};
        setCatMap(cats);
        setHasCatSnapshot(true);
      } catch {
        setCatMap({});
        setHasCatSnapshot(false);
      }
    } catch (e) {
      console.error('Categories local load error', e);
      setTaxonomyMasters([]);
      setCatList({});
      setCatMarket({});
      setCatMap({});
      setHasCatSnapshot(false);
    } finally {
      setCatLoading(false);
    }
  };

  useEffect(() => {
    loadCoins();
    loadCategoriesLocal();
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
    setPage(0);
  }, [searchTerm, sortConfig.key, sortConfig.direction]);

  // -------- DND header helpers --------
  const SortableTh = ({
    id,
    children,
    align = 'left',
    w,
    onClick,
  }: {
    id: ColId;
    children: React.ReactNode;
    align?: 'left' | 'right' | 'center';
    w?: string;
    onClick?: () => void;
  }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.6 : 1,
    };

    return (
      <th
        ref={setNodeRef}
        style={style}
        className={`p-3 select-none border-b border-gray-100 dark:border-slate-800
          ${w || ''} ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}
          ${onClick ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5' : ''}`}
        onClick={onClick}
      >
        <div className={`relative flex items-center ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
          <span
            className="absolute left-0 inline-flex items-center justify-center w-6 h-6 rounded-md
              text-gray-400 hover:text-tech-accent hover:bg-gray-100 dark:hover:bg-white/5 cursor-grab active:cursor-grabbing"
            {...attributes}
            {...listeners}
            title="Arraste para reordenar"
          >
            <GripVertical size={16} />
          </span>

          <div className={`flex items-center gap-1 ${align === 'right' ? 'pr-0' : 'pl-7'} justify-center`}>
            {children}
          </div>
        </div>
      </th>
    );
  };

  const SortLabel = ({ label, sortKey }: { label: string; sortKey?: string }) => (
    <>
      <span className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-400">{label}</span>
      {sortKey && (
        <ChevronsUpDown
          size={14}
          className={`text-gray-400 group-hover:text-tech-accent ${sortConfig.key === sortKey ? 'text-tech-accent' : ''}`}
        />
      )}
    </>
  );

  // -------- Category selection helpers --------
  const masters = useMemo(() => Array.isArray(taxonomyMasters) ? taxonomyMasters : [], [taxonomyMasters]);

  const selectedMaster = useMemo(() => masters.find(m => m.id === selMasterId), [masters, selMasterId]);

  const groups = useMemo(() => {
    if (!selectedMaster?.groups || !Array.isArray(selectedMaster.groups)) return [];
    return selectedMaster.groups;
  }, [selectedMaster]);

  const groupCategoryIds = useMemo(() => {
    if (!selectedMaster) return [];
    if (groups.length > 0) {
      const g = groups.find(x => x.id === selGroupId);
      return g?.categoryIds || [];
    }
    return selectedMaster.categoryIds || [];
  }, [selectedMaster, groups, selGroupId]);

  const categoryName = (id: string) => catList[id] || catMarket[id]?.name || id;

  // category filter coin ids (snapshot)
  const activeCoinIdsSet = useMemo(() => {
    if (!selCategoryId) return null;
    const ids = catMap?.[selCategoryId];
    if (!Array.isArray(ids) || ids.length === 0) return new Set<string>();
    return new Set(ids);
  }, [catMap, selCategoryId]);

  const filteredSortedCoins = useMemo(() => {
    let items = [...coins];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      items = items.filter(c => (c.name || '').toLowerCase().includes(q) || (c.symbol || '').toLowerCase().includes(q));
    }

    // If a category selected and snapshot exists, filter.
    if (selCategoryId) {
      if (!hasCatSnapshot) {
        // snapshot missing: don't filter, just warn (once)
      } else if (activeCoinIdsSet) {
        items = items.filter((c: any) => activeCoinIdsSet.has(String(c.id)));
      }
    }

    const getVal = (c: any, key: string) => {
      const prices = (c as any).sparkline_in_7d?.price;
      if (key === 'chg1h') return isFinite(getPct1h(c)) ? getPct1h(c) : pctFromSpark(prices, 1);
      if (key === 'chg24h') return getPct24h(c);
      if (key === 'chg7d') return isFinite(getPct7d(c)) ? getPct7d(c) : pct7dFromSpark(prices);
      if (key === 'vol7d') return (Number(c.total_volume || 0) || 0) * 7;
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
  }, [coins, searchTerm, sortConfig, selCategoryId, activeCoinIdsSet, hasCatSnapshot]);

  const totalCount = filteredSortedCoins.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  const pageCoins = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return filteredSortedCoins.slice(start, start + PAGE_SIZE);
  }, [filteredSortedCoins, safePage]);

  // Warn once about missing snapshot when trying to use category filter
  useEffect(() => {
    if (view !== 'categories') return;
    if (hasCatSnapshot) return;
    if (catWarnShown) return;
    setCatWarnShown(true);
  }, [view, hasCatSnapshot, catWarnShown]);

  // -------- Categories table rows --------
  const masterRows = useMemo(() => {
    // aggregate from coingecko_categories_market.json (local)
    return masters.map(m => {
      const ids = m.groups?.length
        ? m.groups.flatMap(g => g.categoryIds || [])
        : (m.categoryIds || []);

      const rows = ids.map(id => catMarket[id]).filter(Boolean);

      const marketCap = rows.reduce((s, r) => s + (Number(r?.market_cap ?? r?.market_cap_usd ?? 0) || 0), 0);
      const vol24 = rows.reduce((s, r) => s + (Number(r?.volume_24h ?? r?.volume_24h_usd ?? r?.total_volume ?? 0) || 0), 0);
      const coinsCount = rows.reduce((s, r) => s + (Number(r?.coin_counter ?? r?.coins_count ?? 0) || 0), 0);

      // pct avg (marketcap weighted if we have market_cap)
      const wsum = rows.reduce((s, r) => s + (Number(r?.market_cap ?? 0) || 0), 0);
      const pct1h = wsum > 0
        ? rows.reduce((s, r) => s + (Number(r?.market_cap ?? 0) || 0) * (Number(r?.price_change_percentage_1h_in_currency ?? r?.price_change_percentage_1h ?? 0) || 0), 0) / wsum
        : rows.reduce((s, r) => s + (Number(r?.price_change_percentage_1h_in_currency ?? r?.price_change_percentage_1h ?? 0) || 0), 0) / Math.max(1, rows.length);

      const pct24h = wsum > 0
        ? rows.reduce((s, r) => s + (Number(r?.market_cap ?? 0) || 0) * (Number(r?.price_change_percentage_24h_in_currency ?? r?.price_change_percentage_24h ?? 0) || 0), 0) / wsum
        : rows.reduce((s, r) => s + (Number(r?.price_change_percentage_24h_in_currency ?? r?.price_change_percentage_24h ?? 0) || 0), 0) / Math.max(1, rows.length);

      const pct7d = wsum > 0
        ? rows.reduce((s, r) => s + (Number(r?.market_cap ?? 0) || 0) * (Number(r?.price_change_percentage_7d_in_currency ?? r?.price_change_percentage_7d ?? 0) || 0), 0) / wsum
        : rows.reduce((s, r) => s + (Number(r?.price_change_percentage_7d_in_currency ?? r?.price_change_percentage_7d ?? 0) || 0), 0) / Math.max(1, rows.length);

      return {
        id: m.id,
        name: m.name,
        marketCap,
        vol24,
        coinsCount,
        pct1h,
        pct24h,
        pct7d,
        isMaster: true,
      };
    });
  }, [masters, catMarket]);

  const categoryRows = useMemo(() => {
    if (!selectedMaster) return [];

    const ids = groupCategoryIds || [];
    const rows = ids.map(id => catMarket[id]).filter(Boolean);

    return ids.map(id => {
      const r = catMarket[id] || {};
      return {
        id,
        name: categoryName(id),
        marketCap: Number(r?.market_cap ?? r?.market_cap_usd ?? 0) || 0,
        vol24: Number(r?.volume_24h ?? r?.volume_24h_usd ?? r?.total_volume ?? 0) || 0,
        coinsCount: Number(r?.coin_counter ?? r?.coins_count ?? 0) || 0,
        pct1h: Number(r?.price_change_percentage_1h_in_currency ?? r?.price_change_percentage_1h ?? 0) || 0,
        pct24h: Number(r?.price_change_percentage_24h_in_currency ?? r?.price_change_percentage_24h ?? 0) || 0,
        pct7d: Number(r?.price_change_percentage_7d_in_currency ?? r?.price_change_percentage_7d ?? 0) || 0,
        isMaster: false,
      };
    }).sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
  }, [selectedMaster, groupCategoryIds, catMarket, catList]);

  // -------- UI blocks --------
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

  const CategoriesControl = () => {
    // Spot do botão CATEGORIAS (ou dropdowns quando view = categories)
    if (view === 'market') {
      return (
        <button
          onClick={() => {
            setView('categories');
            setPage(0);
            setSortConfig({ key: 'market_cap_rank', direction: 'asc' });
          }}
          className="px-3 py-2 rounded-lg border bg-white dark:bg-[#2f3032]
            text-gray-700 dark:text-slate-200 border-slate-200 dark:border-slate-700
            hover:bg-gray-100 dark:hover:bg-white/5 text-sm font-black transition-colors"
          title="Categorias"
        >
          Categorias
        </button>
      );
    }

    // view === categories -> dropdowns (sem “Masters” dentro)
    return (
      <div className="flex items-center gap-2">
        <select
          value={selMasterId}
          onChange={(e) => {
            const v = e.target.value;
            setSelMasterId(v);
            setSelGroupId('');
            setSelCategoryId('');
          }}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700
            bg-white dark:bg-[#2f3032] text-gray-900 dark:text-white
            hover:bg-gray-50 dark:hover:bg-white/5
            text-sm font-black outline-none
            [color-scheme:light] dark:[color-scheme:dark]"
          title="Master"
        >
          <option value="" disabled>Selecione um master…</option>
          {masters.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        {groups.length > 0 && (
          <select
            value={selGroupId}
            onChange={(e) => {
              setSelGroupId(e.target.value);
              setSelCategoryId('');
            }}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700
              bg-white dark:bg-[#2f3032] text-gray-900 dark:text-white
              hover:bg-gray-50 dark:hover:bg-white/5
              text-sm font-black outline-none
              [color-scheme:light] dark:[color-scheme:dark]"
            title="Grupo"
          >
            <option value="" disabled>Selecione um grupo…</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}

        {selMasterId && (groups.length === 0 || selGroupId) && (
          <select
            value={selCategoryId}
            onChange={(e) => {
              setSelCategoryId(e.target.value);
              // ao escolher categoria, volta pra tabela principal filtrada
              setView('market');
              setSortConfig({ key: 'market_cap', direction: 'desc' });
              setPage(0);
            }}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700
              bg-white dark:bg-[#2f3032] text-gray-900 dark:text-white
              hover:bg-gray-50 dark:hover:bg-white/5
              text-sm font-black outline-none
              [color-scheme:light] dark:[color-scheme:dark]"
            title="Subcategoria"
          >
            <option value="" disabled>Selecione uma categoria…</option>
            {groupCategoryIds.map(id => (
              <option key={id} value={id}>{categoryName(id)}</option>
            ))}
          </select>
        )}

        <button
          onClick={() => {
            setSelMasterId('');
            setSelGroupId('');
            setSelCategoryId('');
          }}
          className="px-3 py-2 rounded-lg border bg-white dark:bg-[#2f3032]
            text-gray-700 dark:text-slate-200 border-slate-200 dark:border-slate-700
            hover:bg-gray-100 dark:hover:bg-white/5 text-sm font-black transition-colors"
          title="Resetar seleção"
        >
          Reset
        </button>

        <button
          onClick={() => setView('market')}
          className="px-3 py-2 rounded-lg border bg-white dark:bg-[#2f3032]
            text-gray-700 dark:text-slate-200 border-slate-200 dark:border-slate-700
            hover:bg-gray-100 dark:hover:bg-white/5 text-sm font-black transition-colors"
          title="Voltar para Marketcap"
        >
          Marketcap
        </button>
      </div>
    );
  };

  // BUY dropdown (fixo, sempre no mesmo lugar)
  const BuyControl = () => (
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
  );

  // -------- Render --------
  return (
    // ✅ AQUI é o “item 1” que você reclamou: forço altura mínima pro corpo não sumir.
    <div className="bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-100 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col min-h-[640px]">
      {/* Header Row: Search + Categories + BUY + Refresh */}
      <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex flex-col gap-3 bg-gray-50/50 dark:bg-black/20 shrink-0">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative w-full md:flex-1 min-w-[260px]">
            <Search size={18} className="absolute left-3 top-2.5 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar ativo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-[#2f3032] rounded-lg py-2.5 pl-11 pr-4 text-[15px] text-gray-900 dark:text-white focus:border-[#dd9933] outline-none transition-all shadow-inner border border-slate-100 dark:border-slate-700"
            />
          </div>

          {/* ✅ CATEGORIAS + BUY devem ficar ao lado da busca (esquerda do header) */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-start">
            <CategoriesControl />
            <BuyControl />

            <button
              onClick={() => { loadCoins(); loadCategoriesLocal(); }}
              className="p-2.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-gray-500 transition-colors"
              title="Atualizar"
            >
              <RefreshCw size={22} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* paginator do topo só no market */}
          {view === 'market' && (
            <div className="w-full md:w-auto md:ml-auto">
              <Paginator compact />
            </div>
          )}
        </div>

        {/* Aviso do snapshot (uma vez, só na tela de categorias) */}
        {view === 'categories' && !hasCatSnapshot && (
          <div className="text-xs font-bold text-amber-600 dark:text-amber-400">
            Dados de categoria não indexados localmente. Para filtrar moedas por categoria, gere o snapshot:
            <span className="font-black"> /opt/n8n/cachecko/categories/category_coins_map.json </span>
            e exponha via
            <span className="font-black"> /cachecko/categories/category_coins_map.json</span>.
            <span className="ml-2 opacity-80">(A tabela de categorias usa os agregados do coingecko_categories_market.json mesmo sem snapshot.)</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-[420px] min-h-0 overflow-auto custom-scrollbar">
        {view === 'categories' ? (
          // -------------------- CATEGORIES TABLE --------------------
          <div className="p-0">
            {catLoading ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Loader2 className="animate-spin mb-2" size={32} />
                <span className="font-bold text-sm uppercase tracking-widest animate-pulse">Carregando Categorias...</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[1100px] table-fixed">
                <thead className="sticky top-0 z-20 bg-white dark:bg-[#2f3032]">
                  <tr className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-400 border-b border-gray-100 dark:border-slate-800">
                    <th className="p-3 w-[420px]">Categoria</th>
                    <th className="p-3 text-right w-[120px]">1h</th>
                    <th className="p-3 text-right w-[120px]">24h</th>
                    <th className="p-3 text-right w-[120px]">7d</th>
                    <th className="p-3 text-right w-[180px]">Market Cap</th>
                    <th className="p-3 text-right w-[180px]">24h Volume</th>
                    <th className="p-3 text-right w-[120px]"># Coins</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {(selMasterId ? categoryRows : masterRows).map((row) => {
                    const isPos24 = (row.pct24h || 0) >= 0;
                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        onClick={() => {
                          if (row.isMaster) {
                            setSelMasterId(row.id);
                            setSelGroupId('');
                            setSelCategoryId('');
                          }
                        }}
                        title={row.isMaster ? 'Clique para abrir subcategorias' : ''}
                      >
                        <td className="p-3 w-[420px]">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-[14px] font-black text-gray-900 dark:text-white truncate">
                              {row.name}
                            </span>
                            {row.isMaster && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gray-100 dark:bg-black/20 text-gray-500 dark:text-slate-400">
                                master
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono text-[13px] font-black">
                          <span className={(row.pct1h || 0) >= 0 ? 'text-green-500' : 'text-red-500'}>{safePct(row.pct1h)}</span>
                        </td>
                        <td className="p-3 text-right font-mono text-[13px] font-black">
                          <span className={isPos24 ? 'text-green-500' : 'text-red-500'}>{safePct(row.pct24h)}</span>
                        </td>
                        <td className="p-3 text-right font-mono text-[13px] font-black">
                          <span className={(row.pct7d || 0) >= 0 ? 'text-green-500' : 'text-red-500'}>{safePct(row.pct7d)}</span>
                        </td>
                        <td className="p-3 text-right font-mono text-[13px] font-bold text-gray-600 dark:text-slate-300">
                          {formatUSD(row.marketCap, true)}
                        </td>
                        <td className="p-3 text-right font-mono text-[13px] font-bold text-gray-600 dark:text-slate-300">
                          {formatUSD(row.vol24, true)}
                        </td>
                        <td className="p-3 text-right font-mono text-[13px] font-bold text-gray-600 dark:text-slate-300">
                          {Number(row.coinsCount || 0).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}

                  {(selMasterId ? categoryRows : masterRows).length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-sm font-bold text-gray-500 dark:text-slate-400">
                        Nenhuma categoria carregada. Confere os arquivos em /cachecko/categories/.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          // -------------------- MARKET TABLE --------------------
          <>
            {loading && coins.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Loader2 className="animate-spin mb-2" size={32} />
                <span className="font-bold text-sm uppercase tracking-widest animate-pulse">Sincronizando Mercado...</span>
              </div>
            ) : (
              <DndContext
                collisionDetection={closestCenter}
                onDragEnd={(e) => {
                  const { active, over } = e;
                  if (!over || active.id === over.id) return;
                  const oldIndex = colOrder.indexOf(active.id as ColId);
                  const newIndex = colOrder.indexOf(over.id as ColId);
                  if (oldIndex === -1 || newIndex === -1) return;
                  setColOrder(arrayMove(colOrder, oldIndex, newIndex));
                }}
              >
                <SortableContext items={colOrder} strategy={horizontalListSortingStrategy}>
                  <table className="w-full text-left border-collapse min-w-[1380px] table-fixed">
                    <thead className="sticky top-0 z-20 bg-white dark:bg-[#2f3032]">
                      <tr className="border-b border-gray-100 dark:border-slate-800">
                        {colOrder.map((col) => {
                          if (col === 'fav') {
                            return (
                              <SortableTh key={col} id={col} align="center" w="w-[52px]">
                                <span className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-400">★</span>
                              </SortableTh>
                            );
                          }

                          if (col === 'rank') {
                            return (
                              <SortableTh
                                key={col}
                                id={col}
                                align="center"
                                w="w-[76px]"
                                onClick={() => handleSort('market_cap_rank')}
                              >
                                <div className="group flex items-center gap-1">
                                  <SortLabel label="#" sortKey="market_cap_rank" />
                                </div>
                              </SortableTh>
                            );
                          }

                          if (col === 'asset') {
                            return (
                              <SortableTh
                                key={col}
                                id={col}
                                align="left"
                                w="w-[300px]"
                                onClick={() => handleSort('name')}
                              >
                                <div className="group flex items-center gap-1">
                                  <SortLabel label="Ativo" sortKey="name" />
                                </div>
                              </SortableTh>
                            );
                          }

                          if (col === 'price') {
                            return (
                              <SortableTh
                                key={col}
                                id={col}
                                align="right"
                                w="w-[140px]"
                                onClick={() => handleSort('current_price')}
                              >
                                <div className="group flex items-center gap-1">
                                  <SortLabel label="Preço" sortKey="current_price" />
                                </div>
                              </SortableTh>
                            );
                          }

                          if (col === 'chg1h') {
                            return (
                              <SortableTh
                                key={col}
                                id={col}
                                align="right"
                                w="w-[96px]"
                                onClick={() => handleSort('chg1h')}
                              >
                                <div className="group flex items-center gap-1">
                                  <SortLabel label="1h %" sortKey="chg1h" />
                                </div>
                              </SortableTh>
                            );
                          }

                          if (col === 'chg24h') {
                            return (
                              <SortableTh
                                key={col}
                                id={col}
                                align="right"
                                w="w-[104px]"
                                onClick={() => handleSort('chg24h')}
                              >
                                <div className="group flex items-center gap-1">
                                  <SortLabel label="24h %" sortKey="chg24h" />
                                </div>
                              </SortableTh>
                            );
                          }

                          if (col === 'chg7d') {
                            return (
                              <SortableTh
                                key={col}
                                id={col}
                                align="right"
                                w="w-[104px]"
                                onClick={() => handleSort('chg7d')}
                              >
                                <div className="group flex items-center gap-1">
                                  <SortLabel label="7d %" sortKey="chg7d" />
                                </div>
                              </SortableTh>
                            );
                          }

                          if (col === 'mcap') {
                            return (
                              <SortableTh
                                key={col}
                                id={col}
                                align="right"
                                w="w-[160px]"
                                onClick={() => handleSort('market_cap')}
                              >
                                <div className="group flex items-center gap-1">
                                  <SortLabel label="Market Cap" sortKey="market_cap" />
                                </div>
                              </SortableTh>
                            );
                          }

                          if (col === 'vol24h') {
                            return (
                              <SortableTh
                                key={col}
                                id={col}
                                align="right"
                                w="w-[140px]"
                                onClick={() => handleSort('total_volume')}
                              >
                                <div className="group flex items-center gap-1">
                                  <SortLabel label="Vol (24h)" sortKey="total_volume" />
                                </div>
                              </SortableTh>
                            );
                          }

                          if (col === 'vol7d') {
                            return (
                              <SortableTh
                                key={col}
                                id={col}
                                align="right"
                                w="w-[140px]"
                                onClick={() => handleSort('vol7d')}
                              >
                                <div className="group flex items-center gap-1">
                                  <SortLabel label="Vol (7d)" sortKey="vol7d" />
                                </div>
                              </SortableTh>
                            );
                          }

                          if (col === 'circ') {
                            return (
                              <SortableTh
                                key={col}
                                id={col}
                                align="right"
                                w="w-[170px]"
                                onClick={() => handleSort('circulating_supply')}
                              >
                                <div className="group flex items-center gap-1">
                                  <SortLabel label="Circ. Supply" sortKey="circulating_supply" />
                                </div>
                              </SortableTh>
                            );
                          }

                          // spark
                          return (
                            <SortableTh key={col} id={col} align="right" w="w-[360px]">
                              <span className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-400">Last 7 Days</span>
                            </SortableTh>
                          );
                        })}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                      {pageCoins.map((coin: any) => {
                        const change24 = getPct24h(coin);
                        const isPos24 = change24 >= 0;

                        const prices = coin.sparkline_in_7d?.price;
                        const c1h = isFinite(getPct1h(coin)) ? getPct1h(coin) : pctFromSpark(prices, 1);
                        const c7d = isFinite(getPct7d(coin)) ? getPct7d(coin) : pct7dFromSpark(prices);
                        const vol7d = (Number(coin.total_volume || 0) || 0) * 7;

                        const sparkData = Array.isArray(prices) ? prices.map((v: number, i: number) => ({ i, v })) : [];

                        return (
                          <tr key={coin.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors group">
                            {colOrder.map((col) => {
                              if (col === 'fav') {
                                const isFav = fav.has(String(coin.id));
                                return (
                                  <td key={col} className="p-3 text-center w-[52px]">
                                    <button
                                      onClick={() => {
                                        setFav(prev => {
                                          const n = new Set(prev);
                                          const id = String(coin.id);
                                          if (n.has(id)) n.delete(id);
                                          else n.add(id);
                                          return n;
                                        });
                                      }}
                                      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border
                                        ${isFav
                                          ? 'bg-[#dd9933] border-transparent text-black'
                                          : 'bg-white dark:bg-[#2f3032] border-slate-200 dark:border-slate-700 text-gray-400 hover:text-[#dd9933]'
                                        } transition-colors`}
                                      title="Favoritar (placeholder)"
                                    >
                                      <Star size={16} className={isFav ? '' : 'opacity-80'} />
                                    </button>
                                  </td>
                                );
                              }

                              if (col === 'rank') {
                                return (
                                  <td key={col} className="p-3 text-center text-[13px] font-black text-gray-400 w-[76px]">
                                    #{coin.market_cap_rank}
                                  </td>
                                );
                              }

                              if (col === 'asset') {
                                return (
                                  <td key={col} className="p-3 w-[300px]">
                                    <div className="flex items-center gap-3 min-w-0">
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
                                        <span className="text-xs font-bold text-gray-500 uppercase mt-1">
                                          {(coin.symbol || '').toUpperCase()}
                                        </span>
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

                              if (col === 'chg1h') {
                                return (
                                  <td
                                    key={col}
                                    className={`p-3 text-right font-mono text-[13px] font-black w-[96px] ${!isFinite(c1h) ? 'text-gray-400 dark:text-slate-500' : (c1h >= 0 ? 'text-green-500' : 'text-red-500')}`}
                                    title="Estimativa via sparkline 7d (ou dado 1h se vier no dataset)"
                                  >
                                    {safePct(c1h)}
                                  </td>
                                );
                              }

                              if (col === 'chg24h') {
                                return (
                                  <td key={col} className={`p-3 text-right font-mono text-[15px] font-black w-[104px] ${isPos24 ? 'text-green-500' : 'text-red-500'}`}>
                                    {safePct(change24)}
                                  </td>
                                );
                              }

                              if (col === 'chg7d') {
                                return (
                                  <td
                                    key={col}
                                    className={`p-3 text-right font-mono text-[13px] font-black w-[104px] ${!isFinite(c7d) ? 'text-gray-400 dark:text-slate-500' : (c7d >= 0 ? 'text-green-500' : 'text-red-500')}`}
                                    title="Estimativa via sparkline 7d (ou dado 7d se vier no dataset)"
                                  >
                                    {safePct(c7d)}
                                  </td>
                                );
                              }

                              if (col === 'mcap') {
                                return (
                                  <td key={col} className="p-3 text-right font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400 w-[160px]">
                                    {formatUSD(coin.market_cap, true)}
                                  </td>
                                );
                              }

                              if (col === 'vol24h') {
                                return (
                                  <td key={col} className="p-3 text-right font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400 w-[140px]">
                                    {formatUSD(coin.total_volume, true)}
                                  </td>
                                );
                              }

                              if (col === 'vol7d') {
                                return (
                                  <td key={col} className="p-3 text-right font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400 w-[140px]" title="Estimativa simples: Vol(24h) * 7">
                                    {formatUSD(vol7d, true)}
                                  </td>
                                );
                              }

                              if (col === 'circ') {
                                return (
                                  <td key={col} className="p-3 text-right font-mono text-[12px] font-bold text-gray-500 dark:text-slate-500 w-[170px]">
                                    {Number(coin.circulating_supply || 0).toLocaleString()} <span className="uppercase opacity-50">{(coin.symbol || '').toUpperCase()}</span>
                                  </td>
                                );
                              }

                              // spark
                              return (
                                <td key={col} className="p-3 w-[360px]">
                                  <div className="w-full h-[44px] min-w-0">
                                    {sparkData.length > 0 ? (
                                      <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={sparkData}>
                                          <defs>
                                            <linearGradient id={`sparkFill_${coin.id}`} x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="0%" stopColor={isPos24 ? '#548f3f' : '#CD534B'} stopOpacity={0.45} />
                                              <stop offset="100%" stopColor={isPos24 ? '#548f3f' : '#CD534B'} stopOpacity={0.06} />
                                            </linearGradient>
                                          </defs>
                                          <YAxis domain={['auto', 'auto']} hide />
                                          <Area
                                            type="monotone"
                                            dataKey="v"
                                            stroke={isPos24 ? '#548f3f' : '#CD534B'}
                                            strokeWidth={2}
                                            fill={`url(#sparkFill_${coin.id})`}
                                            dot={false}
                                            isAnimationActive={false}
                                          />
                                        </AreaChart>
                                      </ResponsiveContainer>
                                    ) : (
                                      <div className="w-full h-full rounded-lg bg-slate-100/60 dark:bg-white/5" />
                                    )}
                                  </div>
                                </td>
                              );
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
            )}
          </>
        )}
      </div>

      {/* Footer paginator (só no market) */}
      {view === 'market' && (
        <div className="p-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-black/20 shrink-0">
          <Paginator />
        </div>
      )}
    </div>
  );
};

export default MarketCapTable;

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
