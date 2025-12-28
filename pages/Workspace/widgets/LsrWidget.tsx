import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, AlertTriangle, ChevronsUpDown } from 'lucide-react';
import { LsrData, fetchLongShortRatio, fetchTopCoins } from '../services/api'; 
import { DashboardItem, Language, ApiCoin } from '../../../types';
import { getTranslations } from '../../../locales';

const LSR_SYMBOLS = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'SHIBUSDT', 'DOTUSDT',
    'TRXUSDT', 'LINKUSDT', 'MATICUSDT', 'LTCUSDT', 'BCHUSDT', 'NEARUSDT', 'UNIUSDT', 'INJUSDT', 'OPUSDT', 'ARBUSDT'
];

const LSR_INTERVALS = ['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1D'];
const STABLECOINS = ['USDT', 'USDC', 'DAI', 'FDUSD', 'TUSD', 'USDD', 'PYUSD', 'USDE', 'GUSD'];

interface LsrTableRow {
    rank: number;
    symbol: string;
    price: number;
    priceChangePercent: number;
    lsr30m?: number;
    lsr4h?: number;
    lsr12h?: number;
    lsr24h?: number;
    image?: string;
}

const FlashCell = ({ value, formatter, isPercent, isPrice }: { value: number, formatter: (v:number) => string, isPercent?: boolean, isPrice?: boolean }) => {
    const prevValue = useRef(value);
    const [flashClass, setFlashClass] = useState('');

    useEffect(() => {
        if (value === undefined || value === null) return;
        if (value > prevValue.current) {
            setFlashClass('bg-green-500/30 text-green-600 dark:text-green-200');
        } else if (value < prevValue.current) {
            setFlashClass('bg-red-500/30 text-red-600 dark:text-red-200');
        }
        prevValue.current = value;
        const timer = setTimeout(() => setFlashClass(''), 800);
        return () => clearTimeout(timer);
    }, [value]);

    const safeVal = value || 0;
    let textColor = 'text-gray-900 dark:text-gray-300';
    if (isPercent) textColor = safeVal >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500';
    if (isPrice) textColor = 'text-gray-900 dark:text-white font-black';

    return (
        <span className={`transition-colors duration-500 rounded px-1.5 py-0.5 inline-block ${flashClass} ${textColor}`}>
            {formatter(safeVal)}
        </span>
    );
};

const LsrWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
    const [lsrData, setLsrData] = useState<LsrData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [lsrSymbol, setLsrSymbol] = useState('BTCUSDT');
    const [lsrPeriod, setLsrPeriod] = useState('5m');
    const [displayLsr, setDisplayLsr] = useState(0);

    const [maximizedTickers, setMaximizedTickers] = useState<LsrTableRow[]>([]);
    const [isLoadingTable, setIsLoadingTable] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    const t = getTranslations(language as Language).dashboard.widgets.lsr;
    const tWs = getTranslations(language as Language).workspace.widgets.lsr;

    useEffect(() => {
        if (item.isMaximized) return;
        setIsLoading(true);
        fetchLongShortRatio(lsrSymbol, lsrPeriod).then((data) => {
            setLsrData(data);
            setIsLoading(false);
            if (data && data.lsr !== null) setDisplayLsr(data.lsr || 0);
        });
    }, [lsrSymbol, lsrPeriod, item.isMaximized]);

    useEffect(() => {
        if (!item.isMaximized) return;
        const loadTableData = async () => {
            if(maximizedTickers.length === 0) setIsLoadingTable(true);
            const topCoins = await fetchTopCoins();
            const limitedTickers = topCoins
                .filter(coin => coin && coin.symbol && !STABLECOINS.includes(coin.symbol.toUpperCase()))
                .slice(0, 20)
                .map((coin, index) => ({
                    rank: index + 1,
                    symbol: coin.symbol.toUpperCase() + 'USDT',
                    price: coin.current_price || 0,
                    priceChangePercent: coin.price_change_percentage_24h || 0,
                    image: coin.image
                }));
            setMaximizedTickers(limitedTickers);
            setIsLoadingTable(false);

            for (let i = 0; i < limitedTickers.length; i++) {
                const symbol = limitedTickers[i].symbol;
                const [lsr30m, lsr4h, lsr12h, lsr1d] = await Promise.all([
                    fetchLongShortRatio(symbol, '30m'), fetchLongShortRatio(symbol, '4h'),
                    fetchLongShortRatio(symbol, '12h'), fetchLongShortRatio(symbol, '1D')
                ]);
                setMaximizedTickers(prev => prev.map(t => t.symbol === symbol ? { ...t, lsr30m: lsr30m.lsr || undefined, lsr4h: lsr4h.lsr || undefined, lsr12h: lsr12h.lsr || undefined, lsr24h: lsr1d.lsr || undefined } : t));
                await new Promise(r => setTimeout(r, 100));
            }
        };
        loadTableData();
    }, [item.isMaximized]);

    const sortedTickers = useMemo(() => {
        if (!sortConfig) return maximizedTickers;
        return [...maximizedTickers].sort((a: any, b: any) => {
            const aVal = a[sortConfig.key] || 0;
            const bVal = b[sortConfig.key] || 0;
            return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        });
    }, [maximizedTickers, sortConfig]);

    const Watermark = () => (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-[0.05] z-0">
            <img src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" className="w-3/4 h-auto grayscale filter" />
        </div>
    );

    if (item.isMaximized) {
        return (
            <div className="h-full flex flex-col bg-white dark:bg-[#0b0e11] text-gray-900 dark:text-white overflow-hidden relative p-4">
                <div className="grid grid-cols-[1.5fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_1fr] gap-4 px-6 py-4 bg-gray-100 dark:bg-[#1e2329] text-xs font-black text-gray-500 uppercase tracking-widest rounded-t-xl border-b border-gray-200 dark:border-slate-800">
                    <span>Ativo</span><span className="text-right">Preço Spot</span><span className="text-center">LSR 30m</span><span className="text-center">LSR 4h</span><span className="text-center">LSR 12h</span><span className="text-center">LSR 1d</span><span className="text-right">24h %</span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {isLoadingTable ? <div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div> : sortedTickers.map(row => (
                        <div key={row.symbol} className="grid grid-cols-[1.5fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_1fr] gap-4 px-6 py-4 border-b border-gray-100 dark:border-gray-800 items-center text-sm">
                            <div className="font-black flex items-center gap-3">
                                {row.image && <img src={row.image} className="w-8 h-8 rounded-full bg-white p-0.5 border border-gray-200 dark:border-slate-700" />} 
                                <div className="flex flex-col">
                                    <span className="text-base text-gray-900 dark:text-white leading-none">{row.symbol.replace('USDT', '')}</span>
                                    <span className="text-[10px] text-gray-500 uppercase font-bold">Binance Futures</span>
                                </div>
                            </div>
                            <div className="text-right font-mono"><FlashCell isPrice value={row.price} formatter={v => `$${v < 1 ? v.toFixed(5) : v.toLocaleString()}`} /></div>
                            <div className="text-center font-black text-base">{(row.lsr30m || 0).toFixed(2)}</div>
                            <div className="text-center font-black text-base">{(row.lsr4h || 0).toFixed(2)}</div>
                            <div className="text-center font-black text-base">{(row.lsr12h || 0).toFixed(2)}</div>
                            <div className="text-center font-black text-base">{(row.lsr24h || 0).toFixed(2)}</div>
                            <div className="text-right font-black text-base"><FlashCell value={row.priceChangePercent} formatter={v => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`} isPercent /></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const lsrVal = displayLsr || 0;
    const lsrAngle = (Math.min(Math.max(lsrVal, 0), 5) / 5) * 180;

    return (
        <div className="h-full flex flex-col items-center justify-center relative bg-white dark:bg-[#2f3032] p-4 text-center">
            <Watermark />
            <div className="absolute top-2 w-full flex justify-between px-2 z-20">
                <select value={lsrSymbol} onChange={e => setLsrSymbol(e.target.value)} className="bg-gray-100 dark:bg-[#1a1c1e] text-xs font-black p-1.5 rounded border-none outline-none text-gray-900 dark:text-white">
                    {LSR_SYMBOLS.map(s => <option key={s} value={s}>{s.replace('USDT','')}</option>)}
                </select>
                <select value={lsrPeriod} onChange={e => setLsrPeriod(e.target.value)} className="bg-gray-100 dark:bg-[#1a1c1e] text-xs font-black p-1.5 rounded border-none outline-none text-gray-900 dark:text-white">
                    {LSR_INTERVALS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>
            {isLoading ? <Loader2 className="animate-spin text-slate-500" /> : (
                <>
                <div className="mt-6 w-[80%] max-w-[240px]">
                    <svg viewBox="0 0 200 110">
                        <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" className="stroke-gray-100 dark:stroke-slate-800" strokeWidth="18" strokeLinecap="round" />
                        <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="#dd9933" strokeWidth="18" strokeDasharray={`${(lsrAngle/180)*283} 283`} strokeLinecap="round" />
                        <g transform={`rotate(${lsrAngle - 90} 100 100)`}><path d="M 100 100 L 100 20" className="stroke-gray-800 dark:stroke-white" strokeWidth="3" /><circle cx={100} cy={100} r="5" className="fill-gray-800 dark:fill-white" /></g>
                    </svg>
                </div>
                <div className="mt-2"><div className="text-4xl font-black text-[#dd9933] leading-none">{lsrVal.toFixed(2)}</div><div className="text-[10px] font-black text-gray-900 dark:text-white uppercase mt-1 tracking-widest" style={{ fontSize: '6.5px' }}>{lsrVal > 1.1 ? t.longs : lsrVal < 0.9 ? t.shorts : t.neutral}</div></div>
                </>
            )}
        </div>
    );
};

export default LsrWidget;