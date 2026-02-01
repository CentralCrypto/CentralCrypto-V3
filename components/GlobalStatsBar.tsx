
import React, { useState, useEffect } from 'react';
import { fetchWithFallback } from '../services/api';

const formatUSD = (num: number) => {
  if (num > 1e12) return "$" + (num/1e12).toFixed(2) + "T";
  if (num > 1e9) return "$" + (num/1e9).toFixed(2) + "B";
  if (num > 1e6) return "$" + (num/1e6).toFixed(2) + "M";
  return "$" + num.toLocaleString();
};

const GlobalStatsBar = () => {
  const [stats, setStats] = useState({
    coins: 0, exchanges: 0, mcap: 0, mcapChange: 0, vol24: 0, btcDom: 0, ethDom: 0
  });

  useEffect(() => {
    const loadCGData = async () => {
      const url = "/cachecko/cg_global.json";
      try {
        const json = await fetchWithFallback(url);
        if (json) {
            const d = (Array.isArray(json) ? json[0].data : json.data);
            setStats({
              coins: d.active_cryptocurrencies || 0,
              exchanges: d.markets || 0,
              mcap: d.total_market_cap?.usd || 0,
              mcapChange: d.market_cap_change_percentage_24h_usd || 0,
              vol24: d.total_volume?.usd || 0,
              btcDom: d.market_cap_percentage?.btc || 0,
              ethDom: d.market_cap_percentage?.eth || 0
            });
        }
      } catch (e) {
        console.error("GlobalStatsBar error", e);
      }
    };
    loadCGData();
  }, []);

  return (
    <div className="w-full bg-[#f3f4f6] dark:bg-tech-900 border-b border-tech-800 py-3 px-6 flex flex-wrap justify-between items-center text-base font-mono text-gray-400 transition-colors">
      <div className="flex gap-2"><span className="font-bold text-gray-800 dark:text-gray-200">Coins:</span> <span>{stats.coins.toLocaleString()}</span></div>
      <div className="flex gap-2"><span className="font-bold text-gray-800 dark:text-gray-200">Exchanges:</span> <span>{stats.exchanges.toLocaleString()}</span></div>
      <div className="flex gap-2">
        <span className="font-bold text-gray-800 dark:text-gray-200">Market Cap:</span> 
        <span className="text-[#dd9933]">{formatUSD(stats.mcap)}</span>
        <span className={stats.mcapChange >= 0 ? "text-tech-success" : "text-tech-danger"}>
          ({stats.mcapChange >= 0 ? '+' : ''}{stats.mcapChange.toFixed(2)}%)
        </span>
      </div>
      <div className="flex gap-2"><span className="font-bold text-gray-800 dark:text-gray-200">24h Vol:</span> <span>{formatUSD(stats.vol24)}</span></div>
      <div className="flex gap-2"><span className="font-bold text-gray-800 dark:text-gray-200">BTC Dom:</span> <span className="text-[#dd9933]">{stats.btcDom.toFixed(1)}%</span></div>
      <div className="flex gap-2"><span className="font-bold text-gray-800 dark:text-gray-200">ETH Dom:</span> <span className="text-[#627eea]">{stats.ethDom.toFixed(1)}%</span></div>
    </div>
  );
};

export default GlobalStatsBar;
