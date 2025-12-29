import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WidgetType, Language, ApiCoin, UserTier } from '../../../types';
import { getTranslations } from '../../../locales';
import CryptoWidget from './CryptoWidget';
import {
  BarChart2, TrendingUp, Activity, PieChart, ArrowUpRight,
  Calendar, ChevronsUpDown, List, Loader2,
  LayoutGrid, CircleDashed, Search, RefreshCw, Lock, ChevronDown, User
} from 'lucide-react';
import { fetchTopCoins, fetchHeatmapCategories, HeatmapCategory } from '../services/api';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

// ---------------- Helpers ----------------

type SortDir = 'asc' | 'desc';

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

// ---------------- UI bits ----------------

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

// ---------------- MARKET CAP TABLE (PAGINADA 100/100) ----------------

const MarketCapTable = ({ language }: { language: Language }) => {
  const [coins, setCoins] = useState<ApiCoin[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: SortDir }>({ key: 'market_cap_rank', direction: 'asc' });

  const PAGE_SIZE = 100;
  const [page, setPage] = useState(0);

  const [buyOpen, setBuyOpen] = useState(false);

  const [categories, setCategories] = useState<HeatmapCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('__all__');

  const buyRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchTopCoins();
      if (data && Array.isArray(data)) setCoins(data);

      const cats = await fetchHeatmapCategories();
      if (Array.isArray(cats)) setCategories(cats);
    } catch (e) {
      console.error("MarketCap load error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Fecha dropdown BUY clicando fora
  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      if (!buyRef.current) return;
      if (buyRef.current.contains(ev.target as any)) return;
      setBuyOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleSort = (key: string) => {
    let direction: SortDir = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    setSortConfig({ key, direction });
    setPage(0);
  };

  // Mapa de categoria -> Set(coinId)
  const categoryIdSet = useMemo(() => {
    if (activeCategory === '__all__') return null;
    const cat = categories.find(c => c?.id === activeCategory);
    if (!cat || !Array.isArray(cat.coins)) return new Set<string>();

    const ids = new Set<string>();
    for (const item of cat.coins) {
      if (typeof item === 'string') ids.add(item);
      else if (item && typeof item === 'object') {
        const id = (item as any).id || (item as any).coin_id || (item as any).coinId;
        if (typeof id === 'string' && id) ids.add(id);
      }
    }
    return ids;
  }, [categories, activeCategory]);

  const processed = useMemo(() => {
    let items = [...coins];

    // 1) categoria
    if (categoryIdSet) items = items.filter(c => categoryIdSet.has(c.id));

    // 2) busca
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      items = items.filter(c => c.name?.toLowerCase().includes(q) || c.symbol?.toLowerCase().includes(q));
    }

    // 3) sort
    const getVal = (c: ApiCoin, key: string) => {
      const prices = c.sparkline_in_7d?.price;
      if (key === 'change_1h_est') return pctFromSpark(prices, 1);
      if (key === 'change_7d_est') return pct7dFromSpark(prices);
      if (key === 'vol_7d_est') return (c.total_volume || 0) * 7;
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
  }, [coins, searchTerm, sortConfig, categoryIdSet]);

  const totalCount = processed.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);

  const pageCoins = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return processed.slice(start, end);
  }, [processed, safePage]);

  // Reset page quando muda filtro
  useEffect(() => { setPage(0); }, [searchTerm, activeCategory]);

  const SortHeader = ({ label, sortKey, align = "left", width }: { label: string, sortKey: string, align?: "left" | "right" | "center", width?: string }) => (
    <th
      className={`p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition-colors group ${width || ''} ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}
      onClick={() => handleSort(sortKey)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
        {label}
        <ChevronsUpDown size={14} className={`text-gray-400 group-hover:text-tech-accent ${sortConfig.key === sortKey ? 'text-tech-accent' : ''}`} />
      </div>
    </th>
  );

  return (
    <div className="bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-100 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col h-full min-h-0">
      {/* Header: busca + BUY + refresh */}
      <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex flex-col gap-3 bg-gray-50/50 dark:bg-black/20 shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-80">
            <Search size={18} className="absolute left-3 top-3 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar ativo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-[#2f3032] rounded-lg py-2.5 pl-11 pr-4 text-[15px] text-gray-900 dark:text-white focus:border-[#dd9933] outline-none transition-all shadow-inner"
            />
          </div>

          <div className="flex items-center gap-2" ref={buyRef}>
            {/* BUY dropdown */}
            <div className="relative">
              <button
                onClick={() => setBuyOpen(v => !v)}
                className="px-3 py-2.5 rounded-lg bg-white dark:bg-[#2f3032] border border-gray-100 dark:border-slate-700 text-sm font-black text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                BUY <ChevronDown size={16} className={`${buyOpen ? 'rotate-180' : ''} transition-transform`} />
              </button>

              {buyOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl overflow-hidden border border-gray-100 dark:border-slate-700 bg-white dark:bg-[#1a1c1e] shadow-xl z-50">
                  <a
                    href="https://www.bybit.com/invite?ref=JMBYZW"
                    target="_blank"
                    rel="noreferrer"
                    className="block px-4 py-3 text-sm font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5"
                    onClick={() => setBuyOpen(false)}
                  >
                    Bybit (Referral)
                  </a>
                </div>
              )}
            </div>

            {/* Refresh */}
            <button
              onClick={load}
              className="p-2.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-gray-500 transition-colors"
              title="Atualizar"
            >
              <RefreshCw size={22} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Tabs de categoria */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-1">
          <button
            onClick={() => setActiveCategory('__all__')}
            className={`px-3 py-2 rounded-full text-xs font-black whitespace-nowrap border transition-colors
              ${activeCategory === '__all__'
                ? 'bg-[#dd9933] text-black border-transparent'
                : 'bg-white dark:bg-[#2f3032] text-gray-700 dark:text-slate-200 border-gray-100 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            title="Mostrar tudo"
          >
            All
          </button>

          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-2 rounded-full text-xs font-black whitespace-nowrap border transition-colors
                ${activeCategory === cat.id
                  ? 'bg-[#dd9933] text-black border-transparent'
                  : 'bg-white dark:bg-[#2f3032] text-gray-700 dark:text-slate-200 border-gray-100 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-white/5'
                }`}
              title={`${cat.name}${cat.coin_counter ? ` • ${cat.coin_counter} coins` : ''}${cat.description ? ` — ${cat.description}` : ''}`}
            >
              {cat.name}
              {typeof cat.coin_counter === 'number' ? <span className="ml-2 opacity-70">({cat.coin_counter})</span> : null}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {loading && coins.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Loader2 className="animate-spin mb-2" size={32} />
            <span className="font-bold text-sm uppercase tracking-widest animate-pulse">Sincronizando Mercado...</span>
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[1220px] table-fixed text-[14px]">
            <thead className="sticky top-0 z-20 bg-white dark:bg-[#2f3032]">
              <tr className="text-[11px] font-black uppercase tracking-widest text-gray-400 dark:text-slate-400 border-b border-gray-100 dark:border-slate-800">
                <SortHeader label="#" sortKey="market_cap_rank" width="w-[64px]" />
                <SortHeader label="Ativo" sortKey="name" width="w-[330px]" />
                <SortHeader label="Preço" sortKey="current_price" align="right" width="w-[150px]" />
                <SortHeader label="1h %" sortKey="change_1h_est" align="right" width="w-[92px]" />
                <SortHeader label="24h %" sortKey="price_change_percentage_24h" align="right" width="w-[96px]" />
                <SortHeader label="7d %" sortKey="change_7d_est" align="right" width="w-[96px]" />
                <SortHeader label="Market Cap" sortKey="market_cap" align="right" width="w-[140px]" />
                <SortHeader label="Vol (24h)" sortKey="total_volume" align="right" width="w-[120px]" />
                <SortHeader label="Vol (7d)" sortKey="vol_7d_est" align="right" width="w-[120px]" />
                <SortHeader label="Circ. Supply" sortKey="circulating_supply" align="right" width="w-[170px]" />
                <th className="p-3 text-right w-[240px]">Mini-chart (7d)</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {pageCoins.map((coin) => {
                const change = coin.price_change_percentage_24h || 0;
                const isPos = change >= 0;

                const sparkData = coin.sparkline_in_7d?.price?.map((v, i) => ({ i, v })) || [];
                const c1h = pctFromSpark(coin.sparkline_in_7d?.price, 1);
                const c7d = pct7dFromSpark(coin.sparkline_in_7d?.price);
                const vol7d = (coin.total_volume || 0) * 7;

                return (
                  <tr key={coin.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors group">
                    <td className="p-3 font-bold text-gray-400 w-[64px]">#{coin.market_cap_rank}</td>

                    <td className="p-3 w-[330px]">
                      <div className="flex items-center gap-3">
                        <img
                          src={coin.image}
                          alt=""
                          className="w-9 h-9 rounded-full bg-white p-0.5 border border-slate-100 dark:border-white/10 shadow-sm"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-black text-gray-900 dark:text-white leading-none truncate group-hover:text-[#dd9933] transition-colors">
                            {coin.name}
                          </span>
                          <span className="text-[12px] font-bold text-gray-500 uppercase mt-1">{coin.symbol}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-3 text-right font-mono font-black text-gray-900 dark:text-slate-200 w-[150px]">
                      {formatUSD(coin.current_price)}
                    </td>

                    <td className={`p-3 text-right font-mono font-black ${!isFinite(c1h) ? 'text-gray-400 dark:text-slate-500' : (c1h >= 0 ? 'text-green-500' : 'text-red-500')} w-[92px]`} title="Estimativa via sparkline 7d">
                      {safePct(c1h)}
                    </td>

                    <td className={`p-3 text-right font-mono font-black ${isPos ? 'text-green-500' : 'text-red-500'} w-[96px]`}>
                      {isPos ? '+' : ''}{change.toFixed(2)}%
                    </td>

                    <td className={`p-3 text-right font-mono font-black ${!isFinite(c7d) ? 'text-gray-400 dark:text-slate-500' : (c7d >= 0 ? 'text-green-500' : 'text-red-500')} w-[96px]`} title="Estimativa via sparkline 7d">
                      {safePct(c7d)}
                    </td>

                    <td className="p-3 text-right font-mono font-bold text-gray-600 dark:text-slate-400 w-[140px]">
                      {formatUSD(coin.market_cap, true)}
                    </td>

                    <td className="p-3 text-right font-mono font-bold text-gray-600 dark:text-slate-400 w-[120px]">
                      {formatUSD(coin.total_volume, true)}
                    </td>

                    <td className="p-3 text-right font-mono font-bold text-gray-600 dark:text-slate-400 w-[120px]" title="Estimativa simples: Vol(24h) * 7">
                      {formatUSD(vol7d, true)}
                    </td>

                    <td className="p-3 text-right font-mono text-[12px] font-bold text-gray-500 dark:text-slate-500 w-[170px]">
                      {coin.circulating_supply?.toLocaleString()} <span className="uppercase opacity-50">{coin.symbol}</span>
                    </td>

                    <td className="p-3 h-14 w-[240px]">
                      {sparkData.length > 0 && (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={sparkData}>
                            <Line
                              type="monotone"
                              dataKey="v"
                              stroke={isPos ? '#548f3f' : '#CD534B'}
                              strokeWidth={2}
                              dot={false}
                              isAnimationActive={false}
                            />
                            <YAxis domain={['auto', 'auto']} hide />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer paginado */}
      <div className="p-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-black/20 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 shrink-0">
        <div className="font-bold">
          Page {safePage + 1} / {totalPages} • Mostrando {Math.min(PAGE_SIZE, totalCount - safePage * PAGE_SIZE)} de {totalCount}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className={`px-3 py-2 rounded-lg font-black transition-colors
              ${safePage === 0 ? 'bg-gray-200 text-gray-500 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed' : 'bg-white dark:bg-[#2f3032] text-gray-800 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 border border-gray-100 dark:border-slate-700'}`}
          >
            Prev
          </button>

          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className={`px-3 py-2 rounded-lg font-black transition-colors
              ${safePage >= totalPages - 1 ? 'bg-gray-200 text-gray-500 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed' : 'bg-[#dd9933] text-black hover:opacity-90'}`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------- MAIN WRAPPER ----------------

interface IndicatorPageProps {
  language: Language;
  coinMap: Record<string, ApiCoin>;
  userTier: UserTier;
}

type PageType =
  | 'MARKETCAP'
  | 'RSI'
  | 'MACD'
  | 'FNG'
  | 'LSR'
  | 'ALTSEASON'
  | 'ETF'
  | 'GAINERS'
  | 'HEATMAP'
  | 'BUBBLE_HEATMAP'
  | 'CALENDAR'
  | 'TRUMP';

const IndicatorPage: React.FC<IndicatorPageProps> = ({ language, userTier }) => {
  const [activePage, setActivePage] = useState<PageType>('MARKETCAP');
  const tWs = getTranslations(language).workspace.widgets;
  const tPages = getTranslations(language).workspace.pages;

  const GROUPS = [
    {
      title: 'Market', items: [
        { id: 'MARKETCAP' as PageType, label: tPages.marketcap, icon: <List size={18} /> },
        { id: 'GAINERS' as PageType, label: tPages.topmovers, icon: <TrendingUp size={18} /> },
        { id: 'HEATMAP' as PageType, label: "Heatmap Square", icon: <LayoutGrid size={18} /> },
        { id: 'BUBBLE_HEATMAP' as PageType, label: "Crypto Bubbles", icon: <CircleDashed size={18} /> },
        { id: 'RSI' as PageType, label: tWs.rsi.title, icon: <Activity size={18} /> },
        { id: 'MACD' as PageType, label: tWs.macd.title, icon: <BarChart2 size={18} /> },
        { id: 'LSR' as PageType, label: tWs.lsr.title, icon: <BarChart2 size={18} /> },
      ]
    },
    {
      title: 'Global', items: [
        { id: 'CALENDAR' as PageType, label: tWs.calendar.title, icon: <Calendar size={18} /> },
        { id: 'ETF' as PageType, label: tWs.etf.title, icon: <ArrowUpRight size={18} /> },
      ]
    },
    {
      title: 'Sentiment', items: [
        { id: 'FNG' as PageType, label: tWs.fng.title, icon: <PieChart size={18} /> },
        { id: 'ALTSEASON' as PageType, label: tWs.altseason.title, icon: <Activity size={18} /> },
        { id: 'TRUMP' as PageType, label: "Trump-o-Meter", icon: <User size={18} /> },
      ]
    }
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
          <div className="p-4 border-b border-gray-100 dark:border-slate-800 font-black text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wider">
            Dashboard Pages
          </div>
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            {GROUPS.map((group, groupIdx) => (
              <div key={groupIdx} className="mb-4">
                <div className="px-4 py-2 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">{group.title}</div>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActivePage(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-black transition-all tracking-wide
                        ${activePage === item.id
                          ? 'bg-[#dd9933] text-black shadow-md'
                          : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#2f3032]'
                        }`}
                    >
                      {item.icon}{item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Conteúdo */}
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
        </div>
      </div>
    </div>
  );
};

export default IndicatorPage;
