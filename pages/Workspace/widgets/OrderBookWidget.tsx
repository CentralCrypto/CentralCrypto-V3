import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, Tooltip, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { fetchOrderBook, OrderBookData } from '../../../services/api';
import { DashboardItem, Language } from '../../../types';
import { getTranslations } from '../../../locales';

interface Props {
  item: DashboardItem;
  language?: Language;
}

const OrderBookWidget: React.FC<Props> = ({ item, language = 'pt' }) => {
    const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const t = getTranslations(language as Language).workspace.widgets.orderbook;

    useEffect(() => {
        const loadData = () => {
            fetchOrderBook(item.symbol).then(data => {
                setOrderBook(data);
                setIsLoading(false);
            });
        };
        loadData();
        const interval = setInterval(loadData, 10000);
        return () => clearInterval(interval);
    }, [item.symbol]);

    const { depthData, maxCumulative } = useMemo(() => {
        if (!orderBook) return { depthData: [], maxCumulative: 0 };

        let bidTotal = 0;
        const cumulativeBids = orderBook.bids
            .map(b => ({ price: parseFloat(b.price), size: parseFloat(b.qty) }))
            .sort((a, b) => b.price - a.price)
            .map(b => {
                bidTotal += b.size;
                return { price: b.price, bids: bidTotal, asks: undefined };
            })
            .reverse();

        let askTotal = 0;
        const cumulativeAsks = orderBook.asks
            .map(a => ({ price: parseFloat(a.price), size: parseFloat(a.qty) }))
            .sort((a, b) => a.price - b.price)
            .map(a => {
                askTotal += a.size;
                return { price: a.price, asks: askTotal, bids: undefined };
            });

        return {
          depthData: [...cumulativeBids, ...cumulativeAsks],
          maxCumulative: Math.max(bidTotal, askTotal)
        };
    }, [orderBook]);

    const OrderList = ({ type, data }: { type: 'bids' | 'asks', data: { price: string, qty: string }[] }) => {
        const colorClass = type === 'bids' ? 'text-green-400' : 'text-red-400';
        const bgClass = type === 'bids' ? 'bg-green-500/10' : 'bg-red-500/10'; 
        const maxQty = useMemo(() => Math.max(...data.map(d => parseFloat(d.qty) || 0)) || 1, [data]);

        return (
            <div className="flex-1 overflow-y-auto custom-scrollbar relative text-xs">
                <div className="flex justify-between px-2 py-1 text-[10px] text-gray-500 font-bold uppercase border-b border-gray-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-[#2f3032] z-10">
                    <span>{t.price}</span>
                    <span>{t.size}</span>
                </div>
                {data.map((order, i) => {
                    const qty = parseFloat(order.qty);
                    const widthPct = Math.min((qty / maxQty) * 100, 100);
                    return (
                        <div key={i} className="flex justify-between px-2 py-0.5 relative">
                            <div 
                                className={`absolute top-0 ${type === 'bids' ? 'right-0' : 'left-0'} bottom-0 ${bgClass}`} 
                                style={{ width: `${widthPct}%`, opacity: 0.5 }}
                            />
                            <span className={`relative z-10 font-mono font-bold ${colorClass}`}>
                                {parseFloat(order.price).toFixed(2)}
                            </span>
                            <span className="relative z-10 font-mono text-gray-600 dark:text-slate-300">
                                {qty.toFixed(4)}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    if (isLoading) return <div className="flex items-center justify-center h-full text-gray-400"><Loader2 className="animate-spin" /></div>;
    if (!orderBook) return <div className="flex flex-col items-center justify-center h-full text-gray-400"><AlertTriangle className="mb-2" size={24} />{t.noData}</div>;

    if (item.isMaximized) {
        return (
            <div className="h-full flex flex-col bg-white dark:bg-[#2f3032] p-4">
                <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
                    <div className="flex flex-col border border-gray-100 dark:border-slate-800 rounded-lg overflow-hidden">
                        <div className="p-2 text-center font-bold text-green-500 bg-green-500/5 uppercase text-xs">Bids</div>
                        <OrderList type="bids" data={orderBook.bids} />
                    </div>
                    <div className="flex flex-col border border-gray-100 dark:border-slate-800 rounded-lg overflow-hidden">
                        <div className="p-2 text-center font-bold text-red-500 bg-red-500/5 uppercase text-xs">Asks</div>
                        <OrderList type="asks" data={orderBook.asks} />
                    </div>
                </div>
                <div className="h-1/3 mt-4 border border-gray-100 dark:border-slate-800 rounded-lg overflow-hidden relative">
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={depthData}>
                            <XAxis dataKey="price" type="number" hide domain={['auto', 'auto']} />
                            <YAxis hide />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#1a1c1e', borderColor: '#334155', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                                formatter={(value: number) => value.toFixed(4)}
                                labelFormatter={(label) => `Price: ${label}`}
                            />
                            <Area type="step" dataKey="bids" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} strokeWidth={2} />
                            <Area type="step" dataKey="asks" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }

    // Minimized View
    const bestAsk = parseFloat(orderBook.asks[0]?.price || '0');
    const bestBid = parseFloat(orderBook.bids[0]?.price || '0');
    const midPrice = ((bestAsk + bestBid) / 2).toFixed(2);

    return (
        <div className="h-full flex flex-col bg-white dark:bg-[#2f3032] relative overflow-hidden">
            <div className="flex-1 flex flex-col min-h-0 relative z-10">
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Asks List (Top) - Reversed */}
                    <div className="flex-1 flex flex-col overflow-hidden border-b border-gray-100 dark:border-slate-800">
                         <OrderList type="asks" data={orderBook.asks.slice(0, 8).reverse()} />
                    </div>
                    
                    {/* Mid Price */}
                    <div className="p-1 bg-gray-50 dark:bg-black/20 text-center font-mono font-bold text-lg text-gray-900 dark:text-white border-y border-gray-200 dark:border-slate-700">
                        {midPrice}
                    </div>
                    
                    {/* Bids List (Bottom) */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                         <OrderList type="bids" data={orderBook.bids.slice(0, 8)} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderBookWidget;