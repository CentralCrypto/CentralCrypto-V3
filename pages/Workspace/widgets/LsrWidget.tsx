
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, AlertTriangle, ChevronsUpDown, GripVertical } from 'lucide-react';
import { LsrData, fetchLongShortRatio, fetchTopCoins } from '../services/api'; 
import { DashboardItem, Language } from '../../../types';
import { getTranslations } from '../../../locales';
import { useBinanceWS } from '../../../services/BinanceWebSocketContext';

// DND Kit Imports
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const LSR_SYMBOLS = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'SHIBUSDT', 'DOTUSDT',
    'TRXUSDT', 'LINKUSDT', 'MATICUSDT', 'LTCUSDT', 'BCHUSDT', 'NEARUSDT', 'UNIUSDT', 'INJUSDT', 'OPUSDT', 'ARBUSDT'
];

const LSR_INTERVALS = ['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1D'];
const STABLECOINS = ['USDT', 'USDC', 'DAI', 'FDUSD', 'TUSD', 'USDD', 'PYUSD', 'USDE', 'GUSD'];

const EXCHANGES = ['Binance', 'Bybit', 'OKX', 'Mexc', 'Aggregated'];

// --- Helper Components ---

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

// Live Row Component (Connected to WS)
const LiveLsrRow = React.memo(({ row, colOrder }: { row: any, colOrder: string[] }) => {
    const { tickers } = useBinanceWS();
    // Assuming standard Binance symbol format for WS matching
    const wsSymbol = row.symbol; 
    const liveData = tickers[wsSymbol];
    
    let livePrice = row.price;
    let liveChange = row.priceChangePercent;
    
    if (liveData) {
        livePrice = parseFloat(liveData.c);
        const open = parseFloat(liveData.o);
        if (open > 0) liveChange = ((livePrice - open) / open) * 100;
    }

    const renderCell = (colId: string) => {
        switch(colId) {
            case 'asset':
                return (
                    <td key={colId} className="p-3">
                        <div className="font-black flex items-center gap-3">
                            {row.image && <img src={row.image} className="w-8 h-8 rounded-full bg-white p-0.5 border border-gray-200 dark:border-slate-700" alt="" />} 
                            <div className="flex flex-col">
                                <span className="text-base text-gray-900 dark:text-white leading-none">{row.symbol.replace('USDT', '')}</span>
                            </div>
                        </div>
                    </td>
                );
            case 'price':
                return (
                    <td key={colId} className="p-3 text-right font-mono text-base">
                        <FlashCell isPrice value={livePrice} formatter={v => `$${v < 1 ? v.toFixed(5) : v.toLocaleString()}`} />
                    </td>
                );
            case 'lsr30m':
                return <td key={colId} className="p-3 text-center font-black text-base">{row.lsr30m ? row.lsr30m.toFixed(2) : '-'}</td>;
            case 'lsr4h':
                return <td key={colId} className="p-3 text-center font-black text-base">{row.lsr4h ? row.lsr4h.toFixed(2) : '-'}</td>;
            case 'lsr12h':
                return <td key={colId} className="p-3 text-center font-black text-base">{row.lsr12h ? row.lsr12h.toFixed(2) : '-'}</td>;
            case 'lsr24h':
                return <td key={colId} className="p-3 text-center font-black text-base">{row.lsr24h ? row.lsr24h.toFixed(2) : '-'}</td>;
            case 'change24h':
                return (
                    <td key={colId} className="p-3 text-right font-black text-base">
                        <FlashCell value={liveChange} formatter={v => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`} isPercent />
                    </td>
                );
            default: return <td key={colId} className="p-3"></td>;
        }
    };

    return (
        <tr className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
            {colOrder.map((colId) => renderCell(colId))}
        </tr>
    );
}, (prev, next) => {
    // Only re-render if static row data changes, WebSocket updates handled internally via hook if we used custom hook logic,
    // but since we access hook inside component, it will re-render on tick. 
    // Optimization: Memo helps if parent re-renders but props are same.
    return prev.row === next.row && prev.colOrder === next.colOrder;
});

// --- Main Widget Component ---

const LsrWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
    // Minimized State
    const [lsrData, setLsrData] = useState<LsrData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [lsrSymbol, setLsrSymbol] = useState('BTCUSDT');
    const [lsrPeriod, setLsrPeriod] = useState('5m');
    const [displayLsr, setDisplayLsr] = useState(0);

    // Maximized State
    const [maximizedTickers, setMaximizedTickers] = useState<any[]>([]);
    const [isLoadingTable, setIsLoadingTable] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [selectedExchange, setSelectedExchange] = useState('Binance');

    // Drag and Drop State
    const [colOrder, setColOrder] = useState<string[]>(['asset', 'price', 'lsr30m', 'lsr4h', 'lsr12h', 'lsr24h', 'change24h']);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const t = getTranslations(language as Language).dashboard.widgets.lsr;

    // Minimized Data Fetch
    useEffect(() => {
        if (item.isMaximized) return;
        setIsLoading(true);
        fetchLongShortRatio(lsrSymbol, lsrPeriod).then((data) => {
            setLsrData(data);
            setIsLoading(false);
            if (data && data.lsr !== null) setDisplayLsr(data.lsr || 0);
        });
    }, [lsrSymbol, lsrPeriod, item.isMaximized]);

    // Maximized Data Fetch
    useEffect(() => {
        if (!item.isMaximized) return;
        
        const loadTableData = async () => {
            if(maximizedTickers.length === 0) setIsLoadingTable(true);
            
            // Get Coins
            const topCoins = await fetchTopCoins();
            const limitedTickers = topCoins
                .filter(coin => coin && coin.symbol && !STABLECOINS.includes(coin.symbol.toUpperCase()))
                .slice(0, 20)
                .map((coin, index) => ({
                    rank: index + 1,
                    symbol: coin.symbol.toUpperCase() + 'USDT',
                    price: coin.current_price || 0,
                    priceChangePercent: coin.price_change_percentage_24h || 0,
                    image: coin.image,
                    // Init placeholder values
                    lsr30m: 0, lsr4h: 0, lsr12h: 0, lsr24h: 0
                }));
            
            // Initial render to show list while loading LSRs
            setMaximizedTickers(limitedTickers);
            setIsLoadingTable(false);

            // Fetch LSRs for each coin
            // NOTE: Aggregated Logic
            const fetchLsrValue = async (symbol: string, period: string) => {
                if (selectedExchange === 'Aggregated') {
                    const [b, by, o] = await Promise.all([
                        fetchLongShortRatio(symbol, period, 'Binance'),
                        fetchLongShortRatio(symbol, period, 'Bybit'),
                        fetchLongShortRatio(symbol, period, 'OKX')
                    ]);
                    
                    const vals = [b.lsr, by.lsr, o.lsr].filter(v => v !== null && v !== undefined) as number[];
                    if (vals.length === 0) return null;
                    return vals.reduce((a, b) => a + b, 0) / vals.length;
                } else {
                    const data = await fetchLongShortRatio(symbol, period, selectedExchange);
                    return data.lsr;
                }
            };

            // Parallel fetch per coin to speed up (chunks of 5)
            const chunkSize = 5;
            for (let i = 0; i < limitedTickers.length; i += chunkSize) {
                const chunk = limitedTickers.slice(i, i + chunkSize);
                await Promise.all(chunk.map(async (coin) => {
                     const [v30m, v4h, v12h, v1d] = await Promise.all([
                         fetchLsrValue(coin.symbol, '30m'),
                         fetchLsrValue(coin.symbol, '4h'),
                         fetchLsrValue(coin.symbol, '12h'),
                         fetchLsrValue(coin.symbol, '1D')
                     ]);
                     
                     setMaximizedTickers(prev => prev.map(t => 
                         t.symbol === coin.symbol ? { 
                             ...t, 
                             lsr30m: v30m || undefined, 
                             lsr4h: v4h || undefined, 
                             lsr12h: v12h || undefined, 
                             lsr24h: v1d || undefined 
                         } : t
                     ));
                }));
            }
        };
        
        loadTableData();
    }, [item.isMaximized, selectedExchange]);

    const sortedTickers = useMemo(() => {
        if (!sortConfig) return maximizedTickers;
        return [...maximizedTickers].sort((a: any, b: any) => {
            const aVal = a[sortConfig.key] || 0;
            const bVal = b[sortConfig.key] || 0;
            return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        });
    }, [maximizedTickers, sortConfig]);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setColOrder((items) => {
                const oldIndex = items.indexOf(active.id as string);
                const newIndex = items.indexOf(over.id as string);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    // Columns Definition
    const COLS: Record<string, { id: string, label: string }> = {
        asset: { id: 'asset', label: 'Ativo' },
        price: { id: 'price', label: 'Preço Spot' },
        lsr30m: { id: 'lsr30m', label: 'LSR 30m' },
        lsr4h: { id: 'lsr4h', label: 'LSR 4h' },
        lsr12h: { id: 'lsr12h', label: 'LSR 12h' },
        lsr24h: { id: 'lsr24h', label: 'LSR 1d' },
        change24h: { id: 'change24h', label: '24h %' }
    };

    const SortableTh = ({ colId, label }: { colId: string, label: string }) => {
        const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: colId });
        const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 100 : 'auto' };
        
        return (
            <th 
                ref={setNodeRef} 
                style={style} 
                className={`p-3 bg-gray-100 dark:bg-[#1e2329] text-xs font-black text-gray-500 uppercase tracking-widest cursor-pointer select-none group ${colId === 'asset' ? 'text-left' : 'text-center'}`}
                onClick={() => handleSort(colId)}
            >
                <div className={`flex items-center gap-2 ${colId === 'asset' ? 'justify-start' : 'justify-center'}`}>
                    <span 
                        {...attributes} {...listeners} 
                        onClick={(e) => e.stopPropagation()} 
                        className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`}
                    >
                        <GripVertical size={12} />
                    </span>
                    {label}
                    <ChevronsUpDown size={12} className={`text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ${sortConfig?.key === colId ? 'opacity-100 text-[#dd9933]' : ''}`} />
                </div>
            </th>
        );
    };

    const Watermark = () => (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-[0.05] z-0">
            <img src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" className="w-3/4 h-auto grayscale filter" />
        </div>
    );

    // --- RENDER MAXIMIZED ---
    if (item.isMaximized) {
        return (
            <div className="h-full flex flex-col bg-white dark:bg-[#0b0e11] text-gray-900 dark:text-white overflow-hidden relative p-4">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
                    <div className="text-lg font-black uppercase text-gray-700 dark:text-gray-200">Long/Short Ratio Matrix</div>
                    
                    <div className="flex bg-gray-100 dark:bg-[#1e2329] p-1 rounded-lg">
                        {EXCHANGES.map(ex => (
                            <button
                                key={ex}
                                onClick={() => setSelectedExchange(ex)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${selectedExchange === ex ? 'bg-[#dd9933] text-black shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                            >
                                {ex}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar border border-gray-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#1a1c1e]">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr>
                                    <SortableContext items={colOrder} strategy={horizontalListSortingStrategy}>
                                        {colOrder.map(colId => (
                                            <SortableTh key={colId} colId={colId} label={COLS[colId].label} />
                                        ))}
                                    </SortableContext>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoadingTable ? (
                                    <tr><td colSpan={colOrder.length} className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-[#dd9933]" size={32}/></td></tr>
                                ) : (
                                    sortedTickers.map(row => (
                                        <LiveLsrRow key={row.symbol} row={row} colOrder={colOrder} />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </DndContext>
                </div>
            </div>
        );
    }

    // --- RENDER MINIMIZED ---
    const lsrVal = displayLsr || 0;
    const lsrAngle = ((Math.min(Math.max(lsrVal, 1), 5) - 1) / 4) * 180;

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
                <div className="mt-6 w-[80%] max-w-[240px] overflow-visible">
                    <svg viewBox="0 0 200 110" className="overflow-visible">
                        {/* Escala Externa (1-5) */}
                        {[1, 2, 3, 4, 5].map(v => {
                            const angle = ((v - 1) / 4) * 180;
                            const rad = (angle - 180) * (Math.PI / 180);
                            const tx = 100 + 80 * Math.cos(rad);
                            const ty = 100 + 80 * Math.sin(rad);
                            return (
                                <text key={v} x={tx} y={ty} textAnchor="middle" fill="currentColor" className="text-gray-400 font-black" fontSize="9">{v}</text>
                            );
                        })}

                        <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" className="stroke-gray-100 dark:stroke-slate-800" strokeWidth="18" strokeLinecap="round" />
                        <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="#dd9933" strokeWidth="18" strokeDasharray={`${(lsrAngle/180)*283} 283`} strokeLinecap="round" />
                        <g transform={`rotate(${lsrAngle - 90} 100 100)`}>
                            <path d="M 100 100 L 100 20" className="stroke-gray-800 dark:stroke-white" strokeWidth="3" />
                            <circle cx={100} cy={100} r="5" className="fill-gray-800 dark:fill-white" />
                        </g>
                    </svg>
                </div>
                <div className="mt-2">
                    <div className="text-[24px] font-black text-[#dd9933] leading-none">{lsrVal.toFixed(2)}</div>
                    <div className="text-[8px] font-black text-gray-900 dark:text-white uppercase mt-1 tracking-widest">{lsrVal > 1.1 ? t.longs : lsrVal < 0.9 ? t.shorts : t.neutral}</div>
                </div>
                </>
            )}
        </div>
    );
};

export default LsrWidget;
