
import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, ChevronsUpDown } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { fetchTopCoins, isStablecoin } from '../services/api';
import { DashboardItem, Language, ApiCoin } from '../../../types';
import { getTranslations } from '../../../locales';

const formatCompactNumber = (number: number) => {
  if (!number || number === 0) return "---";
  if (number < 1000) return number.toString();
  const suffixes = ["", "K", "M", "B", "T"];
  const suffixNum = Math.floor(("" + Math.floor(number)).length / 3);
  let shortValue = parseFloat((number / Math.pow(1000, suffixNum)).toPrecision(3));
  if (shortValue % 1 !== 0) shortValue = parseFloat(shortValue.toFixed(2));
  return shortValue + suffixes[suffixNum];
};

const TickerList: React.FC<{ tickers: ApiCoin[], type: 'gainer' | 'loser' }> = ({ tickers, type }) => {
    const color = type === 'gainer' ? 'text-green-500' : 'text-red-500';
    return (
        <div className="flex flex-col gap-1">
            {tickers.slice(0, 10).map(t => {
                const change = t.price_change_percentage_24h || 0;
                return (
                    <div key={t.id} className="flex items-center justify-between text-xs px-2 py-1 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors rounded">
                        <div className="flex items-center gap-2">
                            <img src={t.image} alt={t.symbol} className="w-5 h-5 rounded-full" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                            <span className="font-bold text-gray-900 dark:text-white uppercase">{t.symbol}</span>
                        </div>
                        <div className="text-right">
                            <div className="font-semibold text-gray-600 dark:text-slate-300">${(t.current_price || 0) > 1 ? t.current_price.toFixed(2) : (t.current_price || 0).toPrecision(3)}</div>
                            <div className={`font-bold ${color}`}>{change.toFixed(2)}%</div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const MaximizedTable: React.FC<{ data: ApiCoin[], type: 'gainers' | 'losers' }> = ({ data, type }) => {
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const sortedData = useMemo(() => {
        if (!data) return [];
        let sortableData = [...data];
        if (sortConfig) {
            sortableData.sort((a, b) => {
                // @ts-ignore - dynamic access
                let aVal = a[sortConfig.key] || 0;
                // @ts-ignore - dynamic access
                let bVal = b[sortConfig.key] || 0;
                
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableData;
    }, [data, sortConfig]);

    const SortHeader = ({ label, sortKey, align = "left" }: { label: string, sortKey?: string, align?: string }) => (
        <div 
            className={`flex items-center gap-1 cursor-pointer hover:text-gray-900 dark:hover:text-white ${align === 'right' ? 'justify-end' : 'justify-start'}`}
            onClick={() => sortKey && handleSort(sortKey)}
        >
            {label} {sortKey && <ChevronsUpDown size={12} className="text-gray-400" />}
        </div>
    );

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1.5fr] gap-4 px-4 py-2 bg-gray-100 dark:bg-black/20 text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider sticky top-0 z-10 border-b border-gray-100 dark:border-slate-700">
                <SortHeader label="Asset" sortKey="symbol" />
                <SortHeader label="Price" sortKey="current_price" align="right" />
                <SortHeader label="24h %" sortKey="price_change_percentage_24h" align="right" />
                <SortHeader label="Vol (24h)" sortKey="total_volume" align="right" />
                <SortHeader label="Mkt Cap" sortKey="market_cap" align="right" />
                <div className="text-right">Last 7 Days</div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {sortedData.map((coin, index) => {
                    if (!coin) return null;
                    
                    const change = coin.price_change_percentage_24h || 0;
                    const isPositive = change >= 0;
                    const chartData = coin.sparkline_in_7d?.price?.map((val, i) => ({ i, val })) || [];
                    
                    return (
                        <div key={coin.id} className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1.5fr] gap-4 px-4 py-3 border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors items-center text-sm">
                            <div className="flex items-center gap-3">
                                <span className="text-gray-400 text-xs w-4">{index + 1}</span>
                                <img src={coin.image} alt={coin.symbol} className="w-6 h-6 rounded-full" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-900 dark:text-white leading-none">{coin.name}</span>
                                    <span className="text-xs text-gray-500 font-mono uppercase">{coin.symbol}</span>
                                </div>
                            </div>
                            <div className="text-right font-mono text-gray-700 dark:text-slate-300">
                                ${(coin.current_price || 0) < 1 ? coin.current_price?.toFixed(6) : coin.current_price?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </div>
                            <div className={`text-right font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                {isPositive ? '+' : ''}{change.toFixed(2)}%
                            </div>
                            <div className="text-right text-gray-600 dark:text-slate-400 font-mono text-xs">
                                ${formatCompactNumber(coin.total_volume || 0)}
                            </div>
                            <div className="text-right text-gray-600 dark:text-slate-400 font-mono text-xs">
                                ${formatCompactNumber(coin.market_cap || 0)}
                            </div>
                            <div className="h-10 w-full">
                                {chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData}>
                                            <Line type="monotone" dataKey="val" stroke={isPositive ? '#22c55e' : '#ef4444'} strokeWidth={2} dot={false} />
                                            <YAxis domain={['dataMin', 'dataMax']} hide />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-end text-xs text-gray-500">No Data</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const GainersLosersWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
    const [allCoins, setAllCoins] = useState<ApiCoin[]>([]);
    const [activeGnlTab, setActiveGnlTab] = useState<'gainers' | 'losers'>('gainers');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);
    
    const t = getTranslations(language as Language).dashboard.widgets.gainers;
    
    const load = () => {
        setIsLoading(true);
        setError(false);
        fetchTopCoins()
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    setAllCoins(data);
                    setIsLoading(false);
                } else {
                    if (allCoins.length === 0) setError(true);
                    setIsLoading(false);
                }
            })
            .catch(() => {
                if (allCoins.length === 0) setError(true);
                setIsLoading(false);
            });
    };

    useEffect(() => {
        load();
        const interval = setInterval(load, 60000); 
        const safetyTimeout = setTimeout(() => {
            if (isLoading && allCoins.length === 0) {
                setIsLoading(false);
                setError(true);
            }
        }, 15000);
        return () => {
            clearInterval(interval);
            clearTimeout(safetyTimeout);
        }
    }, []);

    const { gainers, losers } = useMemo(() => {
        if (!allCoins || allCoins.length === 0) return { gainers: [], losers: [] };
        
        const validCoins = allCoins.filter(c => c && c.symbol && !isStablecoin(c.symbol));
        const sorted = [...validCoins].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
        
        const gainersList = sorted.filter(c => (c.price_change_percentage_24h || 0) > 0);
        const losersList = [...sorted].reverse().filter(c => (c.price_change_percentage_24h || 0) < 0);

        return { gainers: gainersList, losers: losersList };
    }, [allCoins]);
    
    if (isLoading && allCoins.length === 0) {
        return <div className="flex items-center justify-center h-full text-gray-400 dark:text-slate-500"><Loader2 className="animate-spin" /></div>;
    }

    if (error && allCoins.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-4 text-gray-500 dark:text-slate-400">
                <AlertTriangle size={24} className="mb-2 text-yellow-500" />
                <span className="text-xs font-bold">Dados Indisponíveis</span>
                <span className="text-[10px] mt-1 opacity-70">Falha ao carregar mercado.</span>
                <button onClick={load} className="mt-3 flex items-center gap-1 text-[10px] bg-gray-100 dark:bg-slate-800 px-3 py-1.5 rounded hover:text-[#dd9933] transition-colors">
                    <RefreshCw size={10} /> Tentar Novamente
                </button>
            </div>
        );
    }

    const currentList = activeGnlTab === 'gainers' ? gainers : losers;

    if (item.isMaximized) {
        return (
            <div className="h-full flex flex-col p-4 bg-white dark:bg-[#2f3032]">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex bg-gray-100 dark:bg-slate-800/50 p-1 rounded-lg">
                        <button onClick={() => setActiveGnlTab('gainers')} className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-md transition-all ${activeGnlTab === 'gainers' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-white shadow' : 'text-gray-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700/50'}`}>
                            <TrendingUp size={16} className="text-green-500" /> {t.gainers} (Top 100)
                        </button>
                        <button onClick={() => setActiveGnlTab('losers')} className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-md transition-all ${activeGnlTab === 'losers' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-white shadow' : 'text-gray-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700/50'}`}>
                            <TrendingDown size={16} className="text-red-500" /> {t.losers} (Top 100)
                        </button>
                    </div>
                </div>
                <div className="flex-1 border-0 dark:border dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-[#1a1c1e]">
                    <MaximizedTable data={currentList} type={activeGnlTab} />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-2 bg-white dark:bg-[#2f3032]">
            <div className="flex bg-gray-100 dark:bg-slate-800/50 p-1 rounded-lg mb-2">
                <button onClick={() => setActiveGnlTab('gainers')} className={`flex-1 flex items-center justify-center gap-2 text-xs font-bold p-1 rounded-md transition-all ${activeGnlTab === 'gainers' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-white shadow' : 'text-gray-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700/50'}`}>
                    <TrendingUp size={14} className="text-green-500" /> {t.gainers}
                </button>
                <button onClick={() => setActiveGnlTab('losers')} className={`flex-1 flex items-center justify-center gap-2 text-xs font-bold p-1 rounded-md transition-all ${activeGnlTab === 'losers' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-white shadow' : 'text-gray-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700/50'}`}>
                    <TrendingDown size={14} className="text-red-500" /> {t.losers}
                </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                <TickerList tickers={currentList} type={activeGnlTab === 'gainers' ? 'gainer' : 'loser'} />
            </div>
        </div>
    );
};

export default GainersLosersWidget;
