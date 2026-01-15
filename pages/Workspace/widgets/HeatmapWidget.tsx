
import React, { useEffect, useState, useMemo } from 'react';
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';
import { createPortal } from 'react-dom';
import { Loader2, Maximize2, RefreshCw, AlertTriangle, BarChart2, PieChart, Minimize2 } from 'lucide-react';
import { fetchWithFallback } from '../services/api';
import { DashboardItem } from '../../../types';

interface Props {
  item?: DashboardItem;
  title?: string;
  onClose?: () => void;
  language?: string;
}

// Escala de cores (Vermelho -> Verde)
const getColorForChange = (change: number) => {
    if (change >= 7) return '#14532d'; // Green 900
    if (change >= 3) return '#16a34a'; // Green 600
    if (change >= 0) return '#22c55e'; // Green 500
    if (change >= -3) return '#ef4444'; // Red 500
    if (change >= -7) return '#b91c1c'; // Red 700
    return '#7f1d1d'; // Red 900
};

const formatUSD = (val: number) => {
    if (!val) return '$0';
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
};

const CustomTreemapContent = (props: any) => {
  const { x, y, width, height, name, change } = props;
  
  if (!width || !height || width < 10 || height < 10) return null;

  const color = getColorForChange(change || 0);
  const fontSizeSymbol = Math.min(width / 3, height / 3, 20);
  const fontSizePct = Math.min(width / 5, height / 5, 12);
  const showText = width > 35 && height > 30;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: color,
          stroke: '#1a1c1e',
          strokeWidth: 2,
          rx: 4, 
          ry: 4,
        }}
      />
      {showText && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - fontSizeSymbol * 0.2}
            textAnchor="middle"
            fill="#fff"
            fontWeight="900"
            fontSize={fontSizeSymbol}
            style={{ pointerEvents: 'none', textShadow: '0px 1px 3px rgba(0,0,0,0.5)' }}
          >
            {name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + fontSizeSymbol * 0.8}
            textAnchor="middle"
            fill="rgba(255,255,255,0.9)"
            fontSize={fontSizePct}
            fontWeight="bold"
            style={{ pointerEvents: 'none', textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}
          >
            {(change || 0) > 0 ? '+' : ''}{(change || 0).toFixed(2)}%
          </text>
        </>
      )}
    </g>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#1a1c1e] border border-gray-700 p-3 rounded-xl shadow-2xl text-xs z-[9999] min-w-[180px]">
        <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-800">
            <span className="font-black text-lg text-white">{data.name}</span>
            <span className={`font-black text-sm ${data.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {data.change > 0 ? '+' : ''}{data.change?.toFixed(2)}%
            </span>
        </div>
        <div className="space-y-1">
            <div className="flex justify-between gap-4">
                <span className="text-gray-400">Price:</span>
                <span className="font-mono font-bold text-white">${data.price < 1 ? data.price.toFixed(6) : data.price.toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-4">
                <span className="text-gray-400">Mkt Cap:</span>
                <span className="font-mono font-bold text-blue-400">{formatUSD(data.mcap)}</span>
            </div>
            <div className="flex justify-between gap-4">
                <span className="text-gray-400">Vol 24h:</span>
                <span className="font-mono font-bold text-yellow-500">{formatUSD(data.vol)}</span>
            </div>
        </div>
      </div>
    );
  }
  return null;
};

const HeatmapWidget: React.FC<Props> = ({ item, title = "Crypto Heatmap", onClose }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState<'mcap' | 'change'>('mcap');
  const [isFullscreen, setIsFullscreen] = useState(item?.isMaximized || false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        // Lendo cachecko_lite.json conforme solicitado
        const response = await fetchWithFallback('/cachecko/cachecko_lite.json');
        
        let list: any[] = [];
        if (Array.isArray(response)) {
            list = response;
        } else if (response && Array.isArray(response.data)) {
            list = response.data;
        }

        if (list.length > 0) {
          // Mapeando os campos abreviados do lite (s=symbol, n=name, p=price, p24=percent, mc=mcap, v=vol)
          const mapped = list.map((coin: any) => ({
              name: (coin.s || coin.symbol || '').toUpperCase(),
              fullName: coin.n || coin.name,
              // Tenta pegar do lite, senão fallback para full
              price: Number(coin.p ?? coin.current_price ?? 0),
              change: Number(coin.p24 ?? coin.price_change_percentage_24h ?? 0),
              mcap: Number(coin.mc ?? coin.market_cap ?? 0),
              vol: Number(coin.v ?? coin.total_volume ?? 0)
          })).filter(c => c.mcap > 0); // Remove lixo sem marketcap

          setData(mapped);
        } else {
          setError('Sem dados.');
        }
      } catch (e) {
        console.error(e);
        setError('Erro ao carregar.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshKey]);

  const treeData = useMemo(() => {
    if (!data.length) return [];

    // Ordena e pega top 50 para não travar o navegador
    const top50 = [...data]
        .sort((a, b) => b.mcap - a.mcap)
        .slice(0, 50);

    const leaves = top50.map((coin, index) => {
        // Define o tamanho do bloco
        let sizeValue = 0;
        if (metric === 'mcap') {
            sizeValue = coin.mcap;
        } else {
            // Para visualização de volatilidade, usamos valor absoluto da variação
            sizeValue = Math.pow(Math.abs(coin.change) + 1, 2) * (Math.log10(coin.mcap || 1000));
        }

        return {
            ...coin,
            size: sizeValue,
            rank: index + 1
        };
    });

    return [{ name: 'Market', children: leaves }];
  }, [data, metric]);

  const toggleFullscreen = () => {
      if (item?.isMaximized && onClose) onClose();
      else setIsFullscreen(!isFullscreen);
  };

  const WidgetContent = (
    <div className="flex flex-col w-full h-full bg-[#1a1c1e] text-white overflow-hidden relative">
        <div className="flex justify-between items-center px-4 py-2 border-b border-gray-800 bg-[#1a1c1e] shrink-0 z-10">
            <div className="flex items-center gap-4">
                <span className="text-sm font-black uppercase tracking-wider hidden sm:inline">{title}</span>
                {!loading && !error && (
                    <div className="flex bg-black/40 p-0.5 rounded-lg border border-gray-700">
                        <button 
                            onClick={() => setMetric('mcap')} 
                            className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded flex items-center gap-1.5 transition-all ${metric === 'mcap' ? 'bg-[#dd9933] text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}
                        >
                            <PieChart size={12} /> MarketCap
                        </button>
                        <button 
                            onClick={() => setMetric('change')} 
                            className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded flex items-center gap-1.5 transition-all ${metric === 'change' ? 'bg-[#dd9933] text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}
                        >
                            <BarChart2 size={12} /> Volatilidade
                        </button>
                    </div>
                )}
            </div>
            
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setRefreshKey(k => k + 1)} 
                    className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
                <button 
                    onClick={toggleFullscreen} 
                    className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
                >
                    {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
            </div>
        </div>

        <div className="flex-1 w-full min-h-0 relative">
            {loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="animate-spin text-[#dd9933]" size={32} />
                </div>
            ) : error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 gap-2">
                    <AlertTriangle size={24} />
                    <span className="text-xs font-bold">{error}</span>
                    <button onClick={() => setRefreshKey(k => k + 1)} className="px-3 py-1 bg-red-900/20 rounded text-xs">Retry</button>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                        data={treeData}
                        dataKey="size"
                        stroke="#1a1c1e"
                        fill="#1a1c1e"
                        content={<CustomTreemapContent />}
                        animationDuration={400}
                        aspectRatio={1.6} // Ajuste para retângulos mais largos
                    >
                        <Tooltip content={<CustomTooltip />} cursor={false} allowEscapeViewBox={{ x: true, y: true }} />
                    </Treemap>
                </ResponsiveContainer>
            )}
        </div>
        
        {/* Barra de Legenda */}
        <div className="h-6 bg-[#121416] border-t border-gray-800 flex items-center justify-center gap-1 px-4 shrink-0">
            <span className="text-[9px] text-gray-500 font-bold mr-2">-7%</span>
            <div className="w-4 h-2 bg-[#7f1d1d] rounded-sm"></div>
            <div className="w-4 h-2 bg-[#ef4444] rounded-sm"></div>
            <div className="w-4 h-2 bg-[#22c55e] rounded-sm"></div>
            <div className="w-4 h-2 bg-[#14532d] rounded-sm"></div>
            <span className="text-[9px] text-gray-500 font-bold ml-2">+7%</span>
        </div>
    </div>
  );

  if (isFullscreen) {
    return createPortal(
        <div className="fixed inset-0 z-[9999] w-screen h-screen bg-[#1a1c1e]">
            {WidgetContent}
        </div>,
        document.body
    );
  }

  return (
    <div className="w-full h-full overflow-hidden rounded-xl border border-gray-800 shadow-xl bg-[#1a1c1e]">
        {WidgetContent}
    </div>
  );
};

export default HeatmapWidget;
