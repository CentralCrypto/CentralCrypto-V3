import React from 'react';
import { MOCK_COINS } from '../constants';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { Search } from '../components/Icons';

const Market: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Visão de Mercado</h2>
          <p className="text-gray-400 text-sm mt-1">Cotações e análises em tempo real</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
             <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
             <input type="text" placeholder="Filtrar moedas..." className="w-full bg-tech-800 border border-tech-700 text-xs py-2 pl-9 pr-4 rounded text-white focus:border-tech-500 outline-none" />
          </div>
          <button className="bg-tech-800 text-tech-500 hover:text-white px-4 py-2 text-xs rounded border border-tech-700 hover:bg-tech-700 transition-all font-bold">USD</button>
        </div>
      </div>

      <div className="glass-panel rounded-xl overflow-hidden border-t border-tech-500/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-tech-900 border-b border-tech-800 text-[10px] text-gray-500 uppercase tracking-wider font-mono">
                <th className="p-4 font-medium">Ativo</th>
                <th className="p-4 font-medium text-right">Preço</th>
                <th className="p-4 font-medium text-right">24h %</th>
                <th className="p-4 font-medium text-right hidden md:table-cell">Volume</th>
                <th className="p-4 font-medium text-right hidden lg:table-cell">Market Cap</th>
                <th className="p-4 font-medium w-32 hidden md:table-cell">Tendência (7d)</th>
                <th className="p-4 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tech-800">
              {MOCK_COINS.map((coin) => (
                <tr key={coin.id} className="hover:bg-tech-800/30 transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-tech-800 border border-tech-700 flex items-center justify-center text-[10px] font-bold text-white shadow-inner">
                        {coin.symbol[0]}
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm group-hover:text-tech-500 transition-colors">{coin.name}</div>
                        <div className="text-xs text-gray-500">{coin.symbol}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right font-mono text-sm text-white">
                    ${coin.price.toLocaleString()}
                  </td>
                  <td className={`p-4 text-right font-mono text-sm ${coin.change24h >= 0 ? 'text-tech-success' : 'text-tech-danger'}`}>
                    {coin.change24h > 0 ? '+' : ''}{coin.change24h}%
                  </td>
                  <td className="p-4 text-right font-mono text-sm text-gray-400 hidden md:table-cell">
                    ${coin.volume}
                  </td>
                  <td className="p-4 text-right font-mono text-sm text-gray-400 hidden lg:table-cell">
                    ${coin.marketCap}
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <div className="h-10 w-28 ml-auto filter drop-shadow-lg">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={coin.data}>
                          <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke={coin.change24h >= 0 ? '#22c55e' : '#ef4444'} 
                            strokeWidth={2} 
                            dot={false} 
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <button className="text-xs bg-tech-500 hover:bg-tech-400 text-tech-950 font-bold px-4 py-1.5 rounded transition-all shadow-lg shadow-tech-500/10">
                      Trade
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Market;