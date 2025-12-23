
import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchOrderBook, OrderBookData } from '../services/api';
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
        const bgClass = type === 'bids' ? 'bg-green-900/30' : 'bg-red-900/30';
        const maxQty = useMemo(() => Math.max(...data.map(d => parseFloat(d.qty))), [data]);

        return (
            <div className="overflow-y-auto custom-scrollbar pr-1">
                <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase pb-1 border-b border-gray-100 dark:border-slate-700 sticky top-0 bg-[#2f3032]">
                    <span>{t.price} (USD)</span>
                    <span>{t.size} ({item.symbol})</span>
                </div>
                {data.map((order, i) => (
                    <div key={i} className="flex justify-between text-xs py-0.5 relative font-mono">
                        <div className="absolute right-0 top-0 h-full" style={{ width: `${(parseFloat(order.qty) / maxQty) * 100}%`, background: type === 'bids' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(248, 113, 113, 0.2)' }}></div>
                        <span className={`${colorClass} z-10`}>{parseFloat(order.price).toFixed(2)}</span>
                        <span className="z-10 text-slate-200">{parseFloat(order.qty).toFixed(4)}</span>
                    </div>
                ))}
            </div>
        );
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-full text-slate-500"><Loader2 className="animate-spin" /></div>;
    }
    
    if (!orderBook) {
        return <div className="flex items-center justify-center h-full text-slate-500 text-center text-xs p-4"><AlertTriangle size={16} className="mb-1"/> {t.noData}</div>;
    }

    return (
        <div className="flex flex-col h-full">
            <div className="h-1/3 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={depthData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1E293B', border: 'none', borderRadius: '0.5rem', fontSize: '10px' }} 
                            labelStyle={{ color: '#94A3B8' }}
                            formatter={(value: any, name: string) => [`${value.toFixed(4)} ${item.symbol}`, `${t.total} ${name}`]}
                            labelFormatter={(label) => `${t.price}: $${label.toFixed(2)}`}
                        />
                        <Area type="step" dataKey="bids" stroke="#10B981" fill="#10B981" fillOpacity={0.2} strokeWidth={2} connectNulls />
                        <Area type="step" dataKey="asks" stroke="#F87171" fill="#F87171" fillOpacity={0.2} strokeWidth={2} connectNulls />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
            
            <div className="flex-1 grid grid-cols-2 gap-2 p-2 overflow-hidden">
                <OrderList type="bids" data={orderBook.bids} />
                <OrderList type="asks" data={orderBook.asks} />
            </div>
        </div>
    );
};

export default OrderBookWidget;
