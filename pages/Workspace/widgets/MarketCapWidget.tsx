
import React, { useState, useEffect } from 'react';
import { fetchWithFallback } from '../services/api';
import { DashboardItem, Language } from '../../../types';
import { getCacheckoUrl, ENDPOINTS } from '../../../services/endpoints';

const MarketCapWidget: React.FC<{ language: Language; onNavigate: () => void }> = ({ language, onNavigate }) => {
    const [list, setList] = useState<any[]>([]);
    useEffect(() => {
        fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.top10mktcap))
            .then(data => {
                const coinList = data?.[0]?.top_mktcap;
                if (Array.isArray(coinList)) {
                    const mappedList = coinList.map((coin: any) => ({
                        ...coin,
                        current_price: coin.price,
                        price_change_percentage_24h: coin.change,
                        image: coin.logo,
                    }));
                    setList(mappedList);
                }
            })
            .catch(() => {});
    }, []);
    return (
        <div className="glass-panel p-3 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 transition-colors overflow-hidden">
            <div className="flex justify-between items-center mb-2 w-full">
                <div className="font-black text-gray-500 dark:text-gray-400 text-[11px] leading-tight uppercase tracking-wider">TOP 10 MARKET CAP</div>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-1 custom-scrollbar w-full">
                {list.map((coin, i) => (
                    <div key={i} className="flex items-center justify-between px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors group">
                        <div className="flex items-center gap-3">
                            <img src={coin.image} className="w-7 h-7 rounded-full bg-white p-0.5 border border-gray-100 dark:border-transparent" alt="" />
                            <div className="flex flex-col"><span className="text-lg font-bold text-gray-900 dark:text-white leading-none group-hover:text-tech-accent">{coin.name}</span><span className="text-[11px] font-bold text-gray-500 uppercase">{coin.symbol}</span></div>
                        </div>
                        <div className="text-right">
                            <div className="text-lg font-bold text-gray-900 dark:text-white font-mono leading-none">${(coin.current_price ?? 0).toLocaleString()}</div>
                            <div className={`text-[11px] font-bold font-mono ${(coin.price_change_percentage_24h ?? 0) >= 0 ? 'text-tech-success' : 'text-tech-danger'}`}>{(coin.price_change_percentage_24h ?? 0).toFixed(2)}%</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MarketCapWidget;