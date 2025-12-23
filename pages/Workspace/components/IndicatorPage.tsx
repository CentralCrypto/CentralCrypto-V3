
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WidgetType, Language, ApiCoin, UserTier } from '../../../types';
import { getTranslations } from '../../../locales';
import CryptoWidget from './CryptoWidget';
import { fetchLongShortRatio, LsrData, fetchTopCoins, isStablecoin } from '../services/api';
import { 
    LayoutDashboard, BarChart2, TrendingUp, TrendingDown, Activity, 
    PieChart, ArrowUpRight, Info, Calendar, ChevronsUpDown, 
    ArrowUp, ArrowDown, Lock, Crown, Maximize2, X, List, 
    ChevronLeft, ChevronRight, Loader2, XCircle, LayoutGrid, 
    CircleDashed, Zap, ChevronDown, BookOpen
} from 'lucide-react';

const LockOverlay = () => (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center rounded-xl">
        <Lock size={40} className="text-[#dd9933] mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Upgrade Required</h3>
        <p className="text-gray-300 text-sm mb-4">Subscribe to Tier 2 or higher to access this page.</p>
    </div>
);

const PageHeader = ({ title, description }: { title: string, description: string, language: Language }) => (
    <div className="bg-white dark:bg-[#1a1c1e] p-6 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm transition-colors">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
        <p className="text-gray-500 dark:text-slate-400 mt-1">{description}</p>
    </div>
);

const LsrTable = ({ language }: { language: Language }) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [limit, setLimit] = useState(10);
    const [page, setPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: string, dir: 'asc' | 'desc' }>({ key: 'lsr1d', dir: 'desc' });
    
    const load = async () => {
        setLoading(true);
        try {
            const coins = await fetchTopCoins();
            const filtered = coins.filter(c => c && c.symbol && !isStablecoin(c.symbol)).slice(0, 30);
            
            const results = [];
            for (const coin of filtered) {
                const [r15, r4h, r12h, r1d] = await Promise.all([
                    fetchLongShortRatio(coin.symbol, '15m', 1),
                    fetchLongShortRatio(coin.symbol, '4h', 1),
                    fetchLongShortRatio(coin.symbol, '12h', 1),
                    fetchLongShortRatio(coin.symbol, '1D', 1)
                ]);

                results.push({ 
                    ...coin, 
                    lsr15m: r15.lsr || 0,
                    lsr4h: r4h.lsr || 0,
                    lsr12h: r12h.lsr || 0,
                    lsr1d: r1d.lsr || 0
                });
            }
            setData(results);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleSort = (key: string) => {
        setSortConfig(prev => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }));
    };

    const sortedData = useMemo(() => {
        const sorted = [...data].sort((a, b) => {
            const valA = a[sortConfig.key] || 0;
            const valB = b[sortConfig.key] || 0;
            return sortConfig.dir === 'asc' ? valA - valB : valB - valA;
        });
        return sorted;
    }, [data, sortConfig]);

    const totalPages = Math.ceil(sortedData.length / limit);
    const paginatedData = sortedData.slice((page - 1) * limit, page * limit);

    const SortIcon = ({ col }: { col: string }) => {
        if (sortConfig.key !== col) return <ChevronsUpDown size={12} className="opacity-30" />;
        return sortConfig.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
    };

    return (
        <div className="bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-100 dark:border-slate-800 shadow-lg overflow-hidden transition-colors">
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-black/20">
                <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest">Multi-Timeframe Sentiment</h3>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Rows:</span>
                    <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }} className="bg-white dark:bg-[#2f3032] text-xs font-bold p-1 rounded border border-gray-200 dark:border-slate-700 outline-none">
                        <option value={10}>10</option><option value={20}>20</option><option value={30}>30</option>
                    </select>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-black/10 text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100 dark:border-slate-800">
                        <tr>
                            <th className="px-6 py-4 cursor-pointer hover:text-[#dd9933]" onClick={() => handleSort('symbol')}>Asset <SortIcon col="symbol"/></th>
                            <th className="px-6 py-4 text-right cursor-pointer hover:text-[#dd9933]" onClick={() => handleSort('current_price')}>Price <SortIcon col="current_price"/></th>
                            <th className="px-6 py-4 text-center cursor-pointer hover:text-[#dd9933]" onClick={() => handleSort('lsr15m')}>15M Ratio <SortIcon col="lsr15m"/></th>
                            <th className="px-6 py-4 text-center cursor-pointer hover:text-[#dd9933]" onClick={() => handleSort('lsr4h')}>4H Ratio <SortIcon col="lsr4h"/></th>
                            <th className="px-6 py-4 text-center cursor-pointer hover:text-[#dd9933]" onClick={() => handleSort('lsr12h')}>12H Ratio <SortIcon col="lsr12h"/></th>
                            <th className="px-6 py-4 text-center cursor-pointer hover:text-[#dd9933]" onClick={() => handleSort('lsr1d')}>24H Ratio <SortIcon col="lsr1d"/></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                        {loading ? Array(5).fill(0).map((_,i) => <tr key={i} className="animate-pulse"><td colSpan={6} className="h-12 bg-gray-100/50 dark:bg-white/5"></td></tr>) : paginatedData.map(coin => (
                            <tr key={coin.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 flex items-center gap-3">
                                    <img src={coin.image} className="w-6 h-6 rounded-full" alt=""/>
                                    <span className="font-bold text-gray-900 dark:text-white uppercase">{coin.symbol}</span>
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-xs text-gray-500">${coin.current_price?.toLocaleString()}</td>
                                <td className={`px-6 py-4 text-center font-black ${coin.lsr15m > 1 ? 'text-green-500' : 'text-red-500'}`}>{coin.lsr15m?.toFixed(2)}</td>
                                <td className={`px-6 py-4 text-center font-black ${coin.lsr4h > 1 ? 'text-green-500' : 'text-red-500'}`}>{coin.lsr4h?.toFixed(2)}</td>
                                <td className={`px-6 py-4 text-center font-black ${coin.lsr12h > 1 ? 'text-green-500' : 'text-red-500'}`}>{coin.lsr12h?.toFixed(2)}</td>
                                <td className={`px-6 py-4 text-center font-black ${coin.lsr1d > 1 ? 'text-green-500' : 'text-red-500'}`}>{coin.lsr1d?.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <div className="p-4 flex justify-between items-center border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-black/5">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-[#2f3032] disabled:opacity-30"><ChevronLeft size={16}/></button>
                    <span className="text-[10px] font-black text-gray-500">PAGE {page} OF {totalPages}</span>
                    <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-[#2f3032] disabled:opacity-30"><ChevronRight size={16}/></button>
                </div>
            )}
        </div>
    );
};

const IndicatorFaq = ({ items }: { items: {q: string, a: string}[] }) => {
    const [openIdx, setOpenIdx] = useState<number | null>(0);
    return (
        <div className="mt-12 space-y-4 mb-20">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter flex items-center gap-3 mb-8">
                <BookOpen size={24} className="text-[#dd9933]" /> Entendendo o Indicador
            </h2>
            {items.map((item, i) => (
                <div key={i} className="bg-white dark:bg-[#1a1c1e] border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden transition-all shadow-sm hover:shadow-md">
                    <button onClick={() => setOpenIdx(openIdx === i ? null : i)} className="w-full p-6 text-left flex justify-between items-center group">
                        <span className={`text-lg font-bold transition-colors ${openIdx === i ? 'text-[#dd9933]' : 'text-gray-700 dark:text-gray-300 group-hover:text-black dark:group-hover:text-white'}`}>{item.q}</span>
                        <ChevronDown className={`transition-transform duration-300 ${openIdx === i ? 'rotate-180 text-[#dd9933]' : 'text-gray-400'}`} size={20} />
                    </button>
                    <AnimatePresence>
                        {openIdx === i && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="p-6 pt-0 text-gray-600 dark:text-slate-400 leading-relaxed prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: item.a }} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            ))}
        </div>
    );
};

const LsrLayout = ({ language, userTier }: { language: Language, userTier: UserTier }) => {
    const faqItems = [
        { q: "O que é o Long/Short Ratio?", a: "O Long/Short Ratio (LSR) é um indicador de sentimento que mostra a proporção entre traders apostando na alta (long) e na baixa (short) de um ativo. Ele é calculado dividindo o total de contas compradas pelas vendidas em corretoras como a Binance Futures." },
        { q: "Como interpretar os dados?", a: "Um LSR acima de 1.0 indica que há mais contas 'Long' do que 'Short'. No entanto, para traders institucionais, um LSR muito alto (ex: 3.0 ou 4.0) pode ser visto como um sinal de 'excesso de otimismo' do varejo, o que muitas vezes precede correções ou 'liquidation hunts'." },
        { q: "O que significa 'Retail Sentiment' vs 'Whales'?", a: "Frequentemente, as baleias (institucionais) estão do lado oposto do varejo. Se o preço está caindo mas o LSR está subindo, significa que o varejo está tentando 'pegar a faca caindo', enquanto as baleias estão vendendo pesado." }
    ];

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800 relative bg-white dark:bg-[#1a1c1e] h-[350px]">
                    {userTier === UserTier.TIER_1 && <LockOverlay />}
                    <CryptoWidget item={{ id: 'lsr-gauge-page', type: WidgetType.LONG_SHORT_RATIO, title: 'Sentiment Gauge', symbol: 'BTCUSDT' }} language={language} />
                </div>
                <div className="lg:col-span-2 bg-white dark:bg-[#1a1c1e] rounded-xl overflow-hidden border border-gray-100 dark:border-slate-800 shadow-lg relative h-[350px]">
                     {userTier === UserTier.TIER_1 && <LockOverlay />}
                     <CryptoWidget item={{ id: 'lsr-main-chart', type: WidgetType.LONG_SHORT_RATIO, title: 'Liquidity Analysis', symbol: 'BTCUSDT', isMaximized: true }} language={language} />
                </div>
            </div>
            <LsrTable language={language} />
            <IndicatorFaq items={faqItems} />
        </div>
    );
};

// ...outros layouts (AltSeason, Etf, etc) inalterados em funcionalidade, apenas se necessário...

const IndicatorPage: React.FC<{ language: Language, coinMap: any, userTier: UserTier }> = ({ language, coinMap, userTier }) => {
    const [activePage, setActivePage] = useState<any>('LSR');
    const tWs = getTranslations(language).workspace.widgets;

    const GROUPS = [
        { title: 'Market', items: [ 
            { id: 'GAINERS', label: tWs.gainers.title, icon: <TrendingUp size={16} /> }, 
            { id: 'HEATMAP', label: "Heatmap Square", icon: <LayoutGrid size={16} /> },
            { id: 'BUBBLE_HEATMAP', label: "Crypto Bubbles", icon: <CircleDashed size={16} /> },
            { id: 'RSI', label: "RSI", icon: <Activity size={16} /> }, 
            { id: 'MACD', label: "MACD", icon: <BarChart2 size={16} /> }, 
            { id: 'LSR', label: tWs.lsr.title, icon: <BarChart2 size={16} /> }, 
        ]},
        { title: 'Global', items: [ 
            { id: 'CALENDAR', label: tWs.calendar.title, icon: <Calendar size={16} /> }, 
            { id: 'ETF', label: tWs.etf.title, icon: <ArrowUpRight size={16} /> }, 
        ]},
        { title: 'Sentiment', items: [ 
            { id: 'TRUMP', label: tWs.trump.title, icon: <Activity size={16} /> }, 
            { id: 'FNG', label: tWs.fng.title, icon: <PieChart size={16} /> }, 
            { id: 'ALTSEASON', label: tWs.altseason.title, icon: <LayoutDashboard size={16} /> }, 
        ]}
    ];
    
    return (
        <div className="flex h-full w-full gap-4">
            <div className="w-64 flex-shrink-0 bg-white dark:bg-[#1a1c1e] border border-gray-100 dark:border-slate-800 rounded-xl flex flex-col h-[calc(100vh-160px)] sticky top-32 shadow-sm transition-colors">
                <div className="p-4 border-b border-gray-100 dark:border-slate-800 font-bold text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wider">Pages</div>
                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                    {GROUPS.map((group, groupIdx) => (
                        <div key={groupIdx} className="mb-4">
                            <div className="px-4 py-2 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">{group.title}</div>
                            <div className="space-y-1">
                                {group.items.map((item) => (
                                    <button key={item.id} onClick={() => setActivePage(item.id)} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${activePage === item.id ? 'bg-[#dd9933] text-black shadow-md' : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#2f3032]'}`}>
                                        {item.icon}{item.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 flex flex-col gap-4 min-w-0 h-full overflow-y-auto pr-2 custom-scrollbar pb-20">
                <PageHeader title={activePage} description="Análise de mercado avançada e dados institucionais." language={language} />
                <div className="flex-1">
                    {activePage === 'LSR' && <LsrLayout language={language} userTier={userTier} />}
                    {activePage === 'ALTSEASON' && <div className="h-[600px]"><CryptoWidget item={{ id: 'altseason-page', type: WidgetType.ALTCOIN_SEASON, title: 'Altcoin Season Index', symbol: 'GLOBAL', isMaximized: true }} language={language} /></div>}
                    {activePage === 'ETF' && <div className="h-[750px]"><CryptoWidget item={{ id: 'etf-page', type: WidgetType.ETF_NET_FLOW, title: 'ETF Net Flow', symbol: 'GLOBAL', isMaximized: true }} language={language} /></div>}
                    {activePage === 'FNG' && <div className="h-[600px]"><CryptoWidget item={{ id: 'fng-page', type: WidgetType.FEAR_GREED, title: 'Fear & Greed Index', symbol: 'GLOBAL', isMaximized: true }} language={language} /></div>}
                    {activePage === 'RSI' && <div className="h-[700px]"><CryptoWidget item={{ id: 'rsi-page', type: WidgetType.RSI_AVG, title: 'RSI Average Tracker', symbol: 'MARKET', isMaximized: true }} language={language} /></div>}
                    {activePage === 'MACD' && <div className="h-[700px]"><CryptoWidget item={{ id: 'macd-page', type: WidgetType.MACD_AVG, title: 'MACD Average Tracker', symbol: 'MARKET', isMaximized: true }} language={language} /></div>}
                    {activePage === 'GAINERS' && <div className="h-[700px]"><CryptoWidget item={{ id: 'gainers-page', type: WidgetType.GAINERS_LOSERS, title: 'Top Movers (24h)', symbol: 'MARKET', isMaximized: true }} language={language} /></div>}
                    {activePage === 'HEATMAP' && <div className="h-[700px]"><CryptoWidget item={{ id: 'heatmap-page', type: WidgetType.HEATMAP, title: 'Crypto Heatmap', symbol: 'MARKET', isMaximized: true }} language={language} /></div>}
                    {activePage === 'BUBBLE_HEATMAP' && <div className="h-[650px]"><CryptoWidget item={{ id: 'bubble-page', type: WidgetType.BUBBLE_HEATMAP, title: 'Crypto Bubbles', symbol: 'MARKET', isMaximized: true }} language={language} /></div>}
                    {activePage === 'TRUMP' && <div className="h-[600px]"><CryptoWidget item={{ id: 'trump-page', type: WidgetType.TRUMP_METER, title: 'Trump-o-Meter', symbol: 'TRUMP', isMaximized: true }} language={language} /></div>}
                    {activePage === 'CALENDAR' && <div className="h-[600px]"><CryptoWidget item={{ id: 'cal-page', type: WidgetType.CALENDAR, title: 'Calendar', symbol: 'CAL', isMaximized: true }} language={language} /></div>}
                </div>
            </div>
        </div>
    );
};

export default IndicatorPage;
