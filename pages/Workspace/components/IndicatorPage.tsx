
import React, { useState, useEffect, useMemo } from 'react';
import { WidgetType, Language, ApiCoin, UserTier } from '../../../types';
import { getTranslations } from '../../../locales';
import CryptoWidget from './CryptoWidget';
import { 
  BarChart2, TrendingUp, Activity, PieChart, ArrowUpRight, 
  Calendar, ChevronsUpDown, List, Loader2, 
  LayoutGrid, CircleDashed, Search, RefreshCw, Lock, ChevronDown
} from 'lucide-react';
import { fetchTopCoins } from '../services/api';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

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

const PageFaq = ({ language }: { language: Language }) => {
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const t = getTranslations(language).workspace.pages.faq;

    const items = [
        { q: t.q1, a: t.a1 },
        { q: t.q2, a: t.a2 },
        { q: t.q3, a: t.a3 },
        { q: t.q4, a: t.a4 }
    ];

    return (
        <div className="mt-8 mb-12 max-w-4xl mx-auto px-4">
            <h3 className="text-xl font-black text-gray-800 dark:text-[#dd9933] uppercase tracking-widest text-center mb-8">{t.title}</h3>
            <div className="space-y-3">
                {items.map((item, i) => (
                    <div key={i} className="bg-white dark:bg-[#1a1c1e] border border-gray-100 dark:border-tech-800 rounded-xl overflow-hidden shadow-sm transition-all duration-500">
                        <button 
                            onClick={() => setOpenIndex(openIndex === i ? null : i)}
                            className="w-full flex items-center justify-between p-5 text-left group"
                        >
                            <span className={`font-bold text-sm transition-colors ${openIndex === i ? 'text-[#dd9933]' : 'text-gray-700 dark:text-gray-300'}`}>{item.q}</span>
                            <ChevronDown size={18} className={`text-gray-400 transition-transform duration-500 ${openIndex === i ? 'rotate-180 text-[#dd9933]' : ''}`} />
                        </button>
                        <div className={`transition-all duration-500 ease-in-out ${openIndex === i ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                            <div className="p-5 pt-0 text-sm text-gray-500 dark:text-slate-400 leading-relaxed border-t border-transparent dark:border-white/5">
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
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'market_cap_rank', direction: 'asc' });

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

    useEffect(() => { load(); }, []);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
        setSortConfig({ key, direction });
    };

    const sortedCoins = useMemo(() => {
        let items = [...coins];
        if (searchTerm) {
            items = items.filter(c => 
                c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                c.symbol?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        items.sort((a: any, b: any) => {
            const aVal = a[sortConfig.key] ?? 0;
            const bVal = b[sortConfig.key] ?? 0;
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return items;
    }, [coins, searchTerm, sortConfig]);

    const SortHeader = ({ label, sortKey, align = "left" }: { label: string, sortKey: string, align?: "left" | "right" | "center" }) => (
        <th 
            className={`p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition-colors group ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}
            onClick={() => handleSort(sortKey)}
        >
            <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
                {label}
                <ChevronsUpDown size={12} className={`text-gray-400 group-hover:text-tech-accent ${sortConfig.key === sortKey ? 'text-tech-accent' : ''}`} />
            </div>
        </th>
    );

    return (
        <div className="bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-100 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col h-full min-h-0">
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50 dark:bg-black/20 shrink-0">
                <div className="relative w-full md:w-80">
                    <Search size={16} className="absolute left-3 top-2.5 text-gray-500" />
                    <input 
                        type="text" 
                        placeholder="Buscar ativo por nome ou symbol..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white dark:bg-[#2f3032] border border-gray-200 dark:border-slate-700 rounded-lg py-2 pl-10 pr-4 text-sm text-gray-900 dark:text-white focus:border-[#dd9933] outline-none transition-all shadow-inner border-none"
                    />
                </div>
                <button onClick={load} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-gray-500 transition-colors" title="Atualizar">
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
                {loading && coins.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <Loader2 className="animate-spin mb-2" size={32} />
                        <span className="font-bold text-xs uppercase tracking-widest animate-pulse">Sincronizando Mercado...</span>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead className="sticky top-0 z-20 bg-gray-50 dark:bg-[#2f3032]">
                            <tr className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-800">
                                <SortHeader label="#" sortKey="market_cap_rank" />
                                <SortHeader label="Ativo" sortKey="name" />
                                <SortHeader label="Preço" sortKey="current_price" align="right" />
                                <SortHeader label="24h %" sortKey="price_change_percentage_24h" align="right" />
                                <SortHeader label="Market Cap" sortKey="market_cap" align="right" />
                                <SortHeader label="Vol (24h)" sortKey="total_volume" align="right" />
                                <SortHeader label="Circ. Supply" sortKey="circulating_supply" align="right" />
                                <th className="p-4 text-right">7 Dias</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                            {sortedCoins.map((coin) => {
                                const change = coin.price_change_percentage_24h || 0;
                                const isPos = change >= 0;
                                const sparkData = coin.sparkline_in_7d?.price?.map((v, i) => ({ i, v })) || [];

                                return (
                                    <tr key={coin.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                                        <td className="p-4 text-xs font-bold text-gray-400">#{coin.market_cap_rank}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <img src={coin.image} alt="" className="w-7 h-7 rounded-full bg-white p-0.5 border border-gray-200 dark:border-slate-700" onError={(e) => (e.currentTarget.style.display='none')} />
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-gray-900 dark:text-white leading-none group-hover:text-[#dd9933] transition-colors">{coin.name}</span>
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase mt-1">{coin.symbol}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-mono text-sm font-bold text-gray-900 dark:text-slate-200">
                                            {formatUSD(coin.current_price)}
                                        </td>
                                        <td className={`p-4 text-right font-mono text-sm font-black ${isPos ? 'text-green-500' : 'text-red-500'}`}>
                                            {isPos ? '+' : ''}{change.toFixed(2)}%
                                        </td>
                                        <td className="p-4 text-right font-mono text-xs font-bold text-gray-600 dark:text-slate-400">
                                            {formatUSD(coin.market_cap, true)}
                                        </td>
                                        <td className="p-4 text-right font-mono text-xs font-bold text-gray-600 dark:text-slate-400">
                                            {formatUSD(coin.total_volume, true)}
                                        </td>
                                        <td className="p-4 text-right font-mono text-[10px] font-bold text-gray-500 dark:text-slate-500">
                                            {coin.circulating_supply?.toLocaleString()} <span className="uppercase opacity-50">{coin.symbol}</span>
                                        </td>
                                        <td className="p-4 w-28 h-12">
                                            {sparkData.length > 0 && (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={sparkData}>
                                                        <Line type="monotone" dataKey="v" stroke={isPos ? '#22c55e' : '#ef4444'} strokeWidth={1.5} dot={false} isAnimationActive={false} />
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
        </div>
    );
};

// --- MAIN PAGE WRAPPER ---

interface IndicatorPageProps {
  language: Language;
  coinMap: Record<string, ApiCoin>;
  userTier: UserTier;
}

type PageType = 'MARKETCAP' | 'RSI' | 'MACD' | 'FNG' | 'LSR' | 'ALTSEASON' | 'ETF' | 'GAINERS' | 'TRUMP' | 'CALENDAR' | 'HEATMAP' | 'BUBBLE_HEATMAP';

const IndicatorPage: React.FC<IndicatorPageProps> = ({ language, coinMap, userTier }) => {
    const [activePage, setActivePage] = useState<PageType>('MARKETCAP');
    const tWs = getTranslations(language).workspace.widgets;
    const tPages = getTranslations(language).workspace.pages;

    const GROUPS = [
        { title: 'Market', items: [ 
            { id: 'MARKETCAP' as PageType, label: tPages.marketcap, icon: <List size={16} /> },
            { id: 'GAINERS' as PageType, label: tPages.topmovers, icon: <TrendingUp size={16} /> }, 
            { id: 'HEATMAP' as PageType, label: "Heatmap Square", icon: <LayoutGrid size={16} /> },
            { id: 'BUBBLE_HEATMAP' as PageType, label: "Crypto Bubbles", icon: <CircleDashed size={16} /> },
            { id: 'RSI' as PageType, label: tWs.rsi.title, icon: <Activity size={16} /> }, 
            { id: 'MACD' as PageType, label: tWs.macd.title, icon: <BarChart2 size={16} /> }, 
            { id: 'LSR' as PageType, label: tWs.lsr.title, icon: <BarChart2 size={16} /> }, 
        ] },
        { title: 'Global', items: [ 
            { id: 'CALENDAR' as PageType, label: tWs.calendar.title, icon: <Calendar size={16} /> }, 
            { id: 'ETF' as PageType, label: tWs.etf.title, icon: <ArrowUpRight size={16} /> }, 
        ] },
        { title: 'Sentiment', items: [ 
            { id: 'TRUMP' as PageType, label: tWs.trump.title, icon: <Activity size={16} /> }, 
            { id: 'FNG' as PageType, label: tWs.fng.title, icon: <PieChart size={16} /> }, 
            { id: 'ALTSEASON' as PageType, label: tWs.altseason.title, icon: <Activity size={16} /> }, 
        ] }
    ];
    
    let currentPage = GROUPS[0].items[0];
    for (const group of GROUPS) { const found = group.items.find(item => item.id === activePage); if (found) { currentPage = found; break; } }
    
    return (
        <div className="flex flex-col w-full h-[calc(100vh-160px)] overflow-hidden">
            <div className="flex h-full w-full gap-4 overflow-hidden">
                {/* Sidebar de Navegação */}
                <div className="w-64 flex-shrink-0 bg-white dark:bg-[#1a1c1e] border border-gray-100 dark:border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-sm transition-colors shrink-0">
                    <div className="p-4 border-b border-gray-100 dark:border-slate-800 font-bold text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wider">Pages</div>
                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                        {GROUPS.map((group, groupIdx) => (
                            <div key={groupIdx} className="mb-4">
                                <div className="px-4 py-2 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">{group.title}</div>
                                <div className="space-y-1">
                                    {group.items.map((item) => (
                                        <button 
                                            key={item.id} 
                                            onClick={() => setActivePage(item.id)} 
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${activePage === item.id ? 'bg-[#dd9933] text-black shadow-md' : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#2f3032]'}`}
                                        >
                                            {item.icon}{item.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Conteúdo Principal */}
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
                        {activePage === 'TRUMP' && (
                            <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800">
                                <CryptoWidget item={{ id: 'trump-page', type: WidgetType.TRUMP_METER, title: 'Trump-o-Meter', symbol: 'TRUMP', isMaximized: true }} language={language} />
                            </div>
                        )}
                        {activePage === 'CALENDAR' && (
                            <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800">
                                <CryptoWidget item={{ id: 'cal-page', type: WidgetType.CALENDAR, title: 'Calendar', symbol: 'CAL', isMaximized: true }} language={language} />
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
                    
                    {/* FAQ SECTION */}
                    <PageFaq language={language} />
                </div>
            </div>
        </div>
    );
};

export default IndicatorPage;
