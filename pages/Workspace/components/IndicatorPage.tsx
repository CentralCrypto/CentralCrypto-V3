import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WidgetType, Language, ApiCoin, UserTier } from '../../../types';
import { getTranslations } from '../../../locales';
import CryptoWidget from './CryptoWidget';

import {
  BarChart2, TrendingUp, Activity, PieChart, ArrowUpRight,
  Calendar, ChevronsUpDown, List, Loader2,
  LayoutGrid, CircleDashed, Search, RefreshCw, Lock,
  ChevronDown, User, ExternalLink, ChevronLeft, ChevronRight,
  GripVertical
} from 'lucide-react';

import { fetchTopCoins, fetchHeatmapCategories, HeatmapCategory } from '../services/api';

import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { AreaChart, Area, LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

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

  const [categories, setCategories] = useState<HeatmapCategory[]>([]);
  const [catLoading, setCatLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');

  // categorias continuam carregando (pra você “trabalhar isso depois”)
  // mas não tem mais a linha de abas nem filtro ativo no layout agora.
  const [activeCategory, setActiveCategory] = useState<string>('__all__');

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({
    key: 'market_cap_rank',
    direction: 'asc'
  });

  const PAGE_SIZE = 100;
  const [page, setPage] = useState(0);

  const [buyOpen, setBuyOpen] = useState(false);
  const buyRef = useRef<HTMLDivElement | null>(null);

  // ====== DRAG & DROP DE COLUNAS (user custom) ======
  type ColId =
    | 'rank'
    | 'asset'
    | 'price'
    | 'c1h'
    | 'c24h'
    | 'c7d'
    | 'mcap'
    | 'vol24'
    | 'vol7d'
    | 'supply'
    | 'spark';

  const DEFAULT_COLS: ColId[] = [
    'rank',
    'asset',
    'price',
    'c1h',
    'c24h',
    'c7d',
    'mcap',
    'vol24',
    'vol7d',
    'supply',
    'spark',
  ];

  const [colOrder, setColOrder] = useState<ColId[]>(() => {
    try {
      const raw = localStorage.getItem('mc_col_order_v1');
      if (!raw) return DEFAULT_COLS;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return DEFAULT_COLS;

      const clean = parsed.filter((x: any) => DEFAULT_COLS.includes(x));
      const missing = DEFAULT_COLS.filter(x => !clean.includes(x));
      return [...clean, ...missing] as ColId[];
    } catch {
      return DEFAULT_COLS;
    }
  });

  useEffect(() => {
    try { localStorage.setItem('mc_col_order_v1', JSON.stringify(colOrder)); } catch {}
  }, [colOrder]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchTopCoins();
      if (data && Array.isArray(data)) setCoins(data);
    } catch (e) {
      console.error("MarketCap load error", e);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    setCatLoading(true);
    try {
      const data = await fetchHeatmapCategories();
      if (data && Array.isArray(data)) {
        setCategories(data);
      }
    } catch (e) {
      console.error("Categories load error", e);
    } finally {
      setCatLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadCategories(); }, []);

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

  // Mantém pronto pra depois (sem usar agora)
  const categoryMatcher = useMemo(() => {
    if (activeCategory === '__all__') return null;

    const cat = categories.find(c => c?.id === activeCategory);
    if (!cat) return (coin: ApiCoin) => false;

    const rawCoins: any[] =
      Array.isArray((cat as any).coins) ? (cat as any).coins :
      Array.isArray((cat as any).coins?.data) ? (cat as any).coins.data :
      Array.isArray((cat as any).coins?.coins) ? (cat as any).coins.coins :
      Array.isArray((cat as any).items) ? (cat as any).items :
      [];

    if (!rawCoins || rawCoins.length === 0) return (coin: ApiCoin) => false;

    const ids = new Set<string>();
    const syms = new Set<string>();
    const names = new Set<string>();

    const ingestCoinPaprikaId = (sRaw: string) => {
      const s = (sRaw || '').trim();
      if (!s) return;

      ids.add(s.toLowerCase());
      names.add(s.toLowerCase());

      if (s.includes('-')) {
        const parts = s.split('-').filter(Boolean);
        const sym = parts[0];
        const slug = parts.slice(1).join('-');

        if (sym) syms.add(sym.toUpperCase());
        if (slug) {
          ids.add(slug.toLowerCase());
          names.add(slug.replace(/-/g, ' ').toLowerCase());
        }
      } else {
        if (s.length <= 10 && /^[a-z0-9]+$/i.test(s)) syms.add(s.toUpperCase());
      }
    };

    const ingestName = (nRaw: string) => {
      const n = (nRaw || '').trim();
      if (!n) return;
      names.add(n.toLowerCase());
    };

    const ingestSymbol = (symRaw: string) => {
      const sym = (symRaw || '').trim();
      if (!sym) return;
      syms.add(sym.toUpperCase());
    };

    for (const item of rawCoins) {
      if (typeof item === 'string') {
        ingestCoinPaprikaId(item);
        continue;
      }

      if (item && typeof item === 'object') {
        const o: any = item;

        const possibleIds = [
          o.coingecko_id,
          o.coingeckoId,
          o.id,
          o.coin_id,
          o.coinId,
          o.slug,
        ].filter(v => typeof v === 'string' && v.trim());

        for (const v of possibleIds) ingestCoinPaprikaId(String(v));

        if (typeof o.symbol === 'string') ingestSymbol(o.symbol);
        if (typeof o.ticker === 'string') ingestSymbol(o.ticker);

        if (typeof o.name === 'string') ingestName(o.name);
      }
    }

    return (coin: ApiCoin) => {
      const cid = (coin.id || '').toLowerCase();
      const csym = (coin.symbol || '').toUpperCase();
      const cnm = (coin.name || '').toLowerCase();

      if (cid && ids.has(cid)) return true;
      if (csym && syms.has(csym)) return true;
      if (cnm && names.has(cnm)) return true;

      const cnmCompact = cnm.replace(/\s+/g, '-');
      if (cnmCompact && ids.has(cnmCompact)) return true;

      return false;
    };
  }, [categories, activeCategory]);

  const filteredSortedCoins = useMemo(() => {
    let items = [...coins];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      items = items.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.symbol?.toLowerCase().includes(q)
      );
    }

    // 👇 agora NÃO aplica categoria (você pediu sem a linha/abas e vai mexer depois)
    // if (categoryMatcher) items = items.filter(categoryMatcher);

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
  }, [coins, searchTerm, sortConfig /*, categoryMatcher*/]);

  const totalCount = filteredSortedCoins.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  const pageCoins = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return filteredSortedCoins.slice(start, start + PAGE_SIZE);
  }, [filteredSortedCoins, safePage]);

  useEffect(() => { setPage(0); }, [searchTerm]);
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

  // ====== HEADER SORTABLE (DND-KIT) ======
  const SortableTh = ({ id, children }: { id: ColId, children: React.ReactNode }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.7 : 1,
      zIndex: isDragging ? 30 : undefined,
      position: 'relative',
    };

    return (
      <th ref={setNodeRef} style={style} className="p-0 align-middle">
        <div className="p-3 flex items-center gap-2 select-none">
          <button
            type="button"
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 hover:text-tech-accent"
            title="Arraste para reordenar colunas"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={16} />
          </button>
          <div className="min-w-0 flex-1">
            {children}
          </div>
        </div>
      </th>
    );
  };

  const SortHeader = ({ label, sortKey, align = "left", w }: { label: string, sortKey: string, align?: "left" | "right" | "center", w?: string }) => (
    <div
      className={`cursor-pointer hover:text-tech-accent transition-colors group ${w ? w : ''} ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}
      onClick={() => handleSort(sortKey)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleSort(sortKey); }}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
        {label}
        <ChevronsUpDown size={14} className={`text-gray-400 group-hover:text-tech-accent ${sortConfig.key === sortKey ? 'text-tech-accent' : ''}`} />
      </div>
    </div>
  );

  const onDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setColOrder((prev) => {
      const oldIndex = prev.indexOf(active.id);
      const newIndex = prev.indexOf(over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  // ====== DEFINIÇÃO DAS COLUNAS (render dinâmico em qualquer ordem) ======
  const colDefs = useMemo(() => {
    const defs: Record<ColId, {
      id: ColId;
      w: string;
      align?: "left" | "right" | "center";
      header: () => React.ReactNode;
      cell: (coin: ApiCoin, computed: any) => React.ReactNode;
    }> = {
      rank: {
        id: 'rank',
        w: 'w-[64px]',
        align: 'left',
        header: () => <SortHeader label="#" sortKey="market_cap_rank" w="w-[64px]" />,
        cell: (coin) => (
          <td className="p-3 text-[13px] font-black text-gray-400 w-[64px]">#{coin.market_cap_rank}</td>
        )
      },
      asset: {
        id: 'asset',
        w: 'w-[340px]',
        align: 'left',
        header: () => <SortHeader label="Ativo" sortKey="name" w="w-[340px]" />,
        cell: (coin) => (
          <td className="p-3 w-[340px]">
            <div className="flex items-center gap-3">
              <img
                src={coin.image}
                alt=""
                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#242628] p-1 border border-slate-200 dark:border-white/10 shadow-sm"
                onError={(e) => (e.currentTarget.style.display='none')}
              />
              <div className="flex flex-col min-w-0">
                <span className="text-[15px] font-black text-gray-900 dark:text-white leading-none group-hover:text-[#dd9933] transition-colors truncate">
                  {coin.name}
                </span>
                <span className="text-xs font-bold text-gray-500 uppercase mt-1">{coin.symbol}</span>
              </div>
            </div>
          </td>
        )
      },
      price: {
        id: 'price',
        w: 'w-[140px]',
        align: 'right',
        header: () => <SortHeader label="Preço" sortKey="current_price" align="right" w="w-[140px]" />,
        cell: (coin) => (
          <td className="p-3 text-right font-mono text-[15px] font-black text-gray-900 dark:text-slate-200 w-[140px]">
            {formatUSD(coin.current_price)}
          </td>
        )
      },
      c1h: {
        id: 'c1h',
        w: 'w-[90px]',
        align: 'right',
        header: () => <SortHeader label="1h %" sortKey="change_1h_est" align="right" w="w-[90px]" />,
        cell: (_coin, computed) => (
          <td
            className={`p-3 text-right font-mono text-[13px] font-black w-[90px] ${!isFinite(computed.c1h) ? 'text-gray-400 dark:text-slate-500' : (computed.c1h >= 0 ? 'text-green-500' : 'text-red-500')}`}
            title="Estimativa via sparkline 7d"
          >
            {safePct(computed.c1h)}
          </td>
        )
      },
      c24h: {
        id: 'c24h',
        w: 'w-[96px]',
        align: 'right',
        header: () => <SortHeader label="24h %" sortKey="price_change_percentage_24h" align="right" w="w-[96px]" />,
        cell: (coin, computed) => (
          <td className={`p-3 text-right font-mono text-[15px] font-black w-[96px] ${computed.isPos24 ? 'text-green-500' : 'text-red-500'}`}>
            {computed.isPos24 ? '+' : ''}{(coin.price_change_percentage_24h || 0).toFixed(2)}%
          </td>
        )
      },
      c7d: {
        id: 'c7d',
        w: 'w-[96px]',
        align: 'right',
        header: () => <SortHeader label="7d %" sortKey="change_7d_est" align="right" w="w-[96px]" />,
        cell: (_coin, computed) => (
          <td
            className={`p-3 text-right font-mono text-[13px] font-black w-[96px] ${!isFinite(computed.c7d) ? 'text-gray-400 dark:text-slate-500' : (computed.c7d >= 0 ? 'text-green-500' : 'text-red-500')}`}
            title="Estimativa via sparkline 7d"
          >
            {safePct(computed.c7d)}
          </td>
        )
      },
      mcap: {
        id: 'mcap',
        w: 'w-[140px]',
        align: 'right',
        header: () => <SortHeader label="Market Cap" sortKey="market_cap" align="right" w="w-[140px]" />,
        cell: (coin) => (
          <td className="p-3 text-right font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400 w-[140px]">
            {formatUSD(coin.market_cap, true)}
          </td>
        )
      },
      vol24: {
        id: 'vol24',
        w: 'w-[120px]',
        align: 'right',
        header: () => <SortHeader label="Vol (24h)" sortKey="total_volume" align="right" w="w-[120px]" />,
        cell: (coin) => (
          <td className="p-3 text-right font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400 w-[120px]">
            {formatUSD(coin.total_volume, true)}
          </td>
        )
      },
      vol7d: {
        id: 'vol7d',
        w: 'w-[120px]',
        align: 'right',
        header: () => <SortHeader label="Vol (7d)" sortKey="vol_7d_est" align="right" w="w-[120px]" />,
        cell: (_coin, computed) => (
          <td className="p-3 text-right font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400 w-[120px]" title="Estimativa simples: Vol(24h) * 7">
            {formatUSD(computed.vol7d, true)}
          </td>
        )
      },
      supply: {
        id: 'supply',
        w: 'w-[170px]',
        align: 'right',
        header: () => <SortHeader label="Circ. Supply" sortKey="circulating_supply" align="right" w="w-[170px]" />,
        cell: (coin) => (
          <td className="p-3 text-right font-mono text-[12px] font-bold text-gray-500 dark:text-slate-500 w-[170px]">
            {coin.circulating_supply?.toLocaleString()} <span className="uppercase opacity-50">{coin.symbol}</span>
          </td>
        )
      },
      spark: {
        id: 'spark',
        w: 'w-[280px]',
        align: 'right',
        header: () => <div className="text-right w-[280px]">Mini-chart (7d)</div>,
        cell: (_coin, computed) => (
          <td className="p-3 h-14 w-[280px]">
            {computed.sparkData.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={computed.sparkData}>
                  <defs>
                    <linearGradient id={computed.gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={computed.isPos24 ? '#548f3f' : '#CD534B'} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={computed.isPos24 ? '#548f3f' : '#CD534B'} stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="none"
                    fill={`url(#${computed.gradId})`}
                    isAnimationActive={false}
                  />

                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke={computed.isPos24 ? '#548f3f' : '#CD534B'}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />

                  <YAxis domain={['auto', 'auto']} hide />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </td>
        )
      },
    };

    return defs;
  }, [sortConfig]);

  const visibleCols = useMemo(() => colOrder.map(id => colDefs[id]), [colOrder, colDefs]);

  return (
    <div className="bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-100 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col h-full min-h-0">

      {/* Header Row: Search + BUY (colado) + Refresh + Paginator */}
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

            {/* BUY dropdown - encostado no search */}
            <div className="relative shrink-0" ref={buyRef}>
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
              onClick={() => { load(); loadCategories(); }}
              className="p-2.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-gray-500 transition-colors shrink-0"
              title="Atualizar"
            >
              <RefreshCw size={22} className={loading ? 'animate-spin' : ''} />
            </button>

            {/* (Opcional) indicador que categorias estão carregando, sem mostrar abas */}
            {catLoading && (
              <div className="ml-1 text-xs font-bold text-gray-500 dark:text-slate-500 flex items-center gap-2 shrink-0">
                <Loader2 className="animate-spin" size={14} />
                Categorias...
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <Paginator compact />
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
          <table className="w-full text-left border-collapse min-w-[1280px] table-fixed">
            <thead className="sticky top-0 z-20 bg-white dark:bg-[#2f3032]">
              <tr className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-400 border-b border-gray-100 dark:border-slate-800">
                <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={colOrder} strategy={horizontalListSortingStrategy}>
                    {visibleCols.map(col => (
                      <SortableTh key={col.id} id={col.id}>
                        <div className={col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}>
                          {col.header()}
                        </div>
                      </SortableTh>
                    ))}
                  </SortableContext>
                </DndContext>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {pageCoins.map((coin) => {
                const change24 = coin.price_change_percentage_24h || 0;
                const isPos24 = change24 >= 0;

                const prices = coin.sparkline_in_7d?.price;
                const c1h = pctFromSpark(prices, 1);
                const c7d = pct7dFromSpark(prices);
                const vol7d = (coin.total_volume || 0) * 7;

                const sparkData = prices?.map((v, i) => ({ i, v })) || [];
                const gradId = `sparkGrad_${coin.id}`;

                const computed = { change24, isPos24, prices, c1h, c7d, vol7d, sparkData, gradId };

                return (
                  <tr key={coin.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors group">
                    {visibleCols.map(col => col.cell(coin, computed))}
                  </tr>
                );
              })}

              {pageCoins.length === 0 && (
                <tr>
                  <td colSpan={visibleCols.length} className="p-8 text-center text-sm font-bold text-gray-500 dark:text-slate-400">
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
