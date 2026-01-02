
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

const MarketCapTable = ({ language }: { language: Language }) => {
  const [coins, setCoins] = useState<ApiCoin[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'market_cap_rank',
    direction: 'asc',
  });

  const PAGE_SIZE = 100;
  const [page, setPage] = useState(0);

  const [buyOpen, setBuyOpen] = useState(false);
  const buyRef = useRef<HTMLDivElement | null>(null);

  // ⭐ Favoritos (placeholder pro seu futuro portfolio)
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

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

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buyRef.current && !buyRef.current.contains(t)) setBuyOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    setSortConfig({ key, direction });
    setPage(0);
  };

  const filteredSortedCoins = useMemo(() => {
    let items = [...coins];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      items = items.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.symbol?.toLowerCase().includes(q)
      );
    }

    const getVal = (c: ApiCoin, key: string) => {
      const prices = c.sparkline_in_7d?.price;
      if (key === 'change_1h_est') return pctFromSpark(prices, 1);
      if (key === 'change_7d_est') return pct7dFromSpark(prices);
      if (key === 'vol_7d_est') return (c.total_volume || 0) * 7;
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
  }, [coins, searchTerm, sortConfig]);

  const totalCount = filteredSortedCoins.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  const pageCoins = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return filteredSortedCoins.slice(start, start + PAGE_SIZE);
  }, [filteredSortedCoins, safePage]);

  useEffect(() => { setPage(0); }, [searchTerm]);

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

  const SortIcon = ({ active }: { active: boolean }) => (
    <ChevronsUpDown size={14} className={`text-gray-400 group-hover:text-tech-accent ${active ? 'text-tech-accent' : ''}`} />
  );

  const COLS: Record<string, {
    id: string;
    label: string;
    sortKey?: string;
    align?: 'left' | 'center' | 'right';
    w: string;
  }> = {
    rank: { id: 'rank', label: '#', sortKey: 'market_cap_rank', align: 'center', w: 'w-[72px]' },
    asset: { id: 'asset', label: 'Ativo', sortKey: 'name', align: 'left', w: 'w-[300px]' },
    price: { id: 'price', label: 'Preço', sortKey: 'current_price', align: 'right', w: 'w-[140px]' },
    ch1h: { id: 'ch1h', label: '1h %', sortKey: 'change_1h_est', align: 'right', w: 'w-[92px]' },
    ch24h: { id: 'ch24h', label: '24h %', sortKey: 'price_change_percentage_24h', align: 'right', w: 'w-[100px]' },
    ch7d: { id: 'ch7d', label: '7d %', sortKey: 'change_7d_est', align: 'right', w: 'w-[100px]' },
    mcap: { id: 'mcap', label: 'Market Cap', sortKey: 'market_cap', align: 'right', w: 'w-[150px]' },
    vol24h: { id: 'vol24h', label: 'Vol (24h)', sortKey: 'total_volume', align: 'right', w: 'w-[130px]' },
    vol7d: { id: 'vol7d', label: 'Vol (7d)', sortKey: 'vol_7d_est', align: 'right', w: 'w-[130px]' },
    supply: { id: 'supply', label: 'Circ. Supply', sortKey: 'circulating_supply', align: 'right', w: 'w-[170px]' },
    spark7d: { id: 'spark7d', label: 'Mini-chart (7d)', sortKey: undefined, align: 'center', w: 'w-[340px]' },
  };

  const SortableTh = ({
    colId,
    label,
    sortKey,
    align = 'left',
    w,
  }: {
    colId: string;
    label: string;
    sortKey?: string;
    align?: 'left' | 'center' | 'right';
    w: string;
  }) => {
    // @ts-ignore FIX: Alias destructured 'transform' to avoid naming conflicts.
    const { attributes, listeners, setNodeRef, transform: dndTransform, transition, isDragging } = useDndKitSortable({ id: colId });
    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(dndTransform),
      transition,
      opacity: isDragging ? 0.6 : 1,
    };

    const justify =
      align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
    const textAlign =
      align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

    return (
      <th
        ref={setNodeRef}
        style={style}
        className={`p-3 select-none group border-b border-gray-100 dark:border-slate-800 ${w} ${textAlign} 
          hover:bg-gray-100 dark:hover:bg-white/5 transition-colors`}
      >
        <div className={`flex items-center gap-2 ${justify}`}>
          {/* puxador */}
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md hover:bg-gray-200 dark:hover:bg-white/10 text-gray-400"
            onClick={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
            title="Arraste para reordenar"
          >
            <GripVertical size={16} />
          </span>

          {/* label + sort (clicável) */}
          <button
            type="button"
            className={`inline-flex items-center gap-1 font-black uppercase tracking-widest text-xs text-gray-400 dark:text-slate-400 ${justify}`}
            onClick={() => sortKey && handleSort(sortKey)}
            disabled={!sortKey}
            title={sortKey ? 'Ordenar' : ''}
          >
            <span className="whitespace-nowrap">{label}</span>
            {sortKey ? <SortIcon active={sortConfig.key === sortKey} /> : null}
          </button>
        </div>
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

  return (
    <div className="bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-100 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col h-full min-h-0">

      {/* Header Row: Search + (Categorias placeholder) + BUY + (Paginator/Refresh) */}
      <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex flex-col gap-3 bg-gray-50/50 dark:bg-black/20 shrink-0">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-3">

          {/* left group */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="relative w-full lg:w-[420px]">
              <Search size={18} className="absolute left-3 top-2.5 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar ativo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-[#2f3032] rounded-lg py-2.5 pl-11 pr-4 text-[15px] text-gray-900 dark:text-white focus:border-[#dd9933] outline-none transition-all shadow-inner border border-slate-100 dark:border-slate-700"
              />
            </div>

            {/* Categorias (placeholder só pro botão existir sem popup agora) */}
            <button
              type="button"
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2f3032] text-gray-700 dark:text-slate-200 font-black hover:bg-gray-100 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
              title="Categorias"
            >
              Categorias
            </button>

            {/* BUY dropdown */}
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

          {/* right group */}
          <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
            <Paginator compact />
            <button
              onClick={() => load()}
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
          <table className="w-full text-left border-collapse min-w-[1420px] table-fixed">
            <thead className="sticky top-0 z-20 bg-white dark:bg-[#2f3032]">
              <tr className="border-b border-gray-100 dark:border-slate-800">
                {/* ⭐ coluna fixa (não reordenável) */}
                <th className="p-3 w-[44px] text-center">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-400">
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
                const change24 = (coin as any).price_change_percentage_24h_in_currency ?? coin.price_change_percentage_24h ?? 0;
                const isPos24 = change24 >= 0;

                const prices = coin.sparkline_in_7d?.price;
                const c1h = pctFromSpark(prices, 1);
                const c7d = pct7dFromSpark(prices);
                const vol7d = (coin.total_volume || 0) * 7;

                const sparkData = Array.isArray(prices) ? prices.map((v, i) => ({ i, v })) : [];

                const favKey = coin.id || `${coin.symbol}-${coin.name}`;
                const isFav = !!favorites[favKey];

                return (
                  <tr key={coin.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors group">
                    {/* ⭐ fav */}
                    <td className="p-3 w-[44px] text-center">
                      <button
                        type="button"
                        onClick={() => setFavorites(prev => ({ ...prev, [favKey]: !prev[favKey] }))}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                        title="Favoritar (placeholder)"
                      >
                        <Star size={18} className={isFav ? 'text-[#dd9933]' : 'text-gray-400'} />
                      </button>
                    </td>

                    {colOrder.map((cid) => {
                      if (cid === 'rank') {
                        return (
                          <td key={cid} className="p-3 text-[13px] font-black text-gray-400 w-[72px] text-center">
                            #{coin.market_cap_rank}
                          </td>
                        );
                      }

                      if (cid === 'asset') {
                        return (
                          <td key={cid} className="p-3 w-[300px]">
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
                          <td key={cid} className="p-3 text-right font-mono text-[15px] font-black text-gray-900 dark:text-slate-200 w-[140px]">
                            {formatUSD(coin.current_price)}
                          </td>
                        );
                      }

                      if (cid === 'ch1h') {
                        return (
                          <td
                            key={cid}
                            className={`p-3 text-right font-mono text-[13px] font-black w-[92px] ${!isFinite(c1h) ? 'text-gray-400 dark:text-slate-500' : (c1h >= 0 ? 'text-green-500' : 'text-red-500')}`}
                            title="Estimativa via sparkline 7d"
                          >
                            {safePct(c1h)}
                          </td>
                        );
                      }

                      if (cid === 'ch24h') {
                        return (
                          <td key={cid} className={`p-3 text-right font-mono text-[15px] font-black w-[100px] ${isPos24 ? 'text-green-500' : 'text-red-500'}`}>
                            {isPos24 ? '+' : ''}{Number(change24 || 0).toFixed(2)}%
                          </td>
                        );
                      }

                      if (cid === 'ch7d') {
                        return (
                          <td
                            key={cid}
                            className={`p-3 text-right font-mono text-[13px] font-black w-[100px] ${!isFinite(c7d) ? 'text-gray-400 dark:text-slate-500' : (c7d >= 0 ? 'text-green-500' : 'text-red-500')}`}
                            title="Estimativa via sparkline 7d"
                          >
                            {safePct(c7d)}
                          </td>
                        );
                      }

                      if (cid === 'mcap') {
                        return (
                          <td key={cid} className="p-3 text-right font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400 w-[150px]">
                            {formatUSD(coin.market_cap, true)}
                          </td>
                        );
                      }

                      if (cid === 'vol24h') {
                        return (
                          <td key={cid} className="p-3 text-right font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400 w-[130px]">
                            {formatUSD(coin.total_volume, true)}
                          </td>
                        );
                      }

                      if (cid === 'vol7d') {
                        return (
                          <td key={cid} className="p-3 text-right font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400 w-[130px]" title="Estimativa simples: Vol(24h) * 7">
                            {formatUSD(vol7d, true)}
                          </td>
                        );
                      }

                      if (cid === 'supply') {
                        return (
                          <td key={cid} className="p-3 text-right font-mono text-[12px] font-bold text-gray-500 dark:text-slate-500 w-[170px]">
                            {coin.circulating_supply?.toLocaleString()} <span className="uppercase opacity-50">{coin.symbol}</span>
                          </td>
                        );
                      }

                      if (cid === 'spark7d') {
                        return (
                          <td key={cid} className="p-3 w-[340px]">
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

      {/* Footer paginator */}
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
        <div className={`w-64 flex-shrink-0 bg-white dark:bg-[#1a1c1e] border border-gray-100 dark:border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-sm transition-colors shrink-0`}>
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
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto custom-scrollbar pr-1">
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
      </div>

      {/* Fullscreen SWARM modal */}
      {activePage === 'SWARM' && (
          <div className="fixed inset-0 z-[2000] bg-black/50 backdrop-blur-sm animate-in fade-in">
              <MarketWindSwarm language={language} onClose={() => setActivePage('MARKETCAP')} />
          </div>
      )}
    </div>
  );
}

export default IndicatorPage;
