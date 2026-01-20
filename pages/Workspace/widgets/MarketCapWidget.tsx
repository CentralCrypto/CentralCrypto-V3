
import React, { useState, useEffect } from 'react';
import { fetchWithFallback } from '../services/api';
import { DashboardItem, Language } from '../../../types';
import { getCacheckoUrl, ENDPOINTS } from '../../../services/endpoints';
import { useBinanceWS } from '../../../services/BinanceWebSocketContext';

const MarketCapWidget: React.FC<{ language: Language; onNavigate: () => void }> = ({ language, onNavigate }) => {
    const [list, setList] = useState<any[]>([]);
    const { tickers } = useBinanceWS();

    useEffect(() => {
        fetchWithFallback(getCacheckoUrl(ENDPOINTS.cachecko.files.top10mktcap))
            .then(data => {
                const coinList = data?.[0]?.top_mktcap;
                if (Array.isArray(coinList)) {
                    // Initial Map using JSON data
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

    // Merge live data with static list
    const liveList = list.map(coin => {
        const symbol = coin.symbol?.toUpperCase();
        const binanceSymbol = `${symbol}USDT`;
        const liveData = tickers[binanceSymbol];

        let displayPrice = coin.current_price || 0;
        let displayChange = coin.price_change_percentage_24h || 0;

        if (liveData) {
            const close = parseFloat(liveData.c);
            const open = parseFloat(liveData.o);
            const changePct = open > 0 ? ((close - open) / open) * 100 : 0;
            
            displayPrice = close;
            displayChange = changePct;
        }

        return { ...coin, current_price: displayPrice, price_change_percentage_24h: displayChange };
    });

    return (
        <div className="glass-panel p-3 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 transition-colors overflow-hidden">
            <div className="flex justify-between items-center mb-2 w-full">
                <div className="font-black text-gray-500 dark:text-gray-400 text-[11px] leading-tight uppercase tracking-wider">TOP 10 MARKET CAP</div>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-1 custom-scrollbar w-full">
                {liveList.map((coin, i) => (
                    <div key={i} className="flex items-center justify-between px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors group">
                        <div className="flex items-center gap-3">
                            <img 
                                src={`https://assets.coincap.io/assets/icons/${coin.symbol.toLowerCase()}@2x.png`} 
                                className="w-7 h-7 rounded-full bg-white p-0.5 border border-gray-100 dark:border-transparent" 
                                alt=""
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                            <div className="flex flex-col">
                                <span className="text-lg font-bold text-gray-900 dark:text-white leading-none group-hover:text-tech-accent">{coin.name}</span>
                                <span className="text-[11px] font-bold text-gray-500 uppercase">{coin.symbol}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-lg font-bold text-gray-900 dark:text-white font-mono leading-none">
                                ${coin.current_price < 1 ? coin.current_price.toFixed(4) : coin.current_price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </div>
                            <div className={`text-[11px] font-bold font-mono ${(coin.price_change_percentage_24h ?? 0) >= 0 ? 'text-tech-success' : 'text-tech-danger'}`}>
                                {(coin.price_change_percentage_24h ?? 0).toFixed(2)}%
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MarketCapWidget;
