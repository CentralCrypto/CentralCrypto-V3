
import React, { useEffect, useState, useMemo } from 'react';
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';
import { createPortal } from 'react-dom';
import { Loader2, Maximize2, RefreshCw, AlertTriangle, BarChart2, PieChart, Minimize2, TrendingUp, TrendingDown, Layers, X as CloseIcon } from 'lucide-react';
import { fetchWithFallback } from '../services/api';
import { DashboardItem } from '../../../types';

interface Props {
  item?: DashboardItem;
  title?: string;
  onClose?: () => void;
  language?: string;
}

// === PALETA DE CORES AJUSTADA (User Request) ===
// GREEN BASE: #548F3F
// RED BASE: #ff6961

const getColorForChange = (change: number) => {
    // Escala de Verdes
    if (change >= 20) return '#345e2a'; // Darker/Stronger Forest
    if (change >= 7)  return '#467a33'; // Mid Strong
    if (change >= 0)  return '#548F3F'; // **USER GREEN BASE**
    
    // Escala de Vermelhos
    if (change <= -20) return '#b93c3c'; // Darker Red
    if (change <= -7)  return '#e0524e'; // Mid Red
    if (change < 0)    return '#ff6961'; // **USER RED BASE**
    
    return '#2d3748'; // Zero/Neutral (Dark Slate)
};

const formatCompact = (num: number) => {
    if (!num) return '-';
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toLocaleString()}`;
};

const formatPrice = (price: number | undefined | null) => {
    if (price === undefined || price === null || typeof price !== 'number' || isNaN(price)) return '$0.00';
    if (price < 1) return `$${price.toFixed(6)}`;
    if (price < 10) return `$${price.toFixed(4)}`;
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const CustomTreemapContent = (props: any) => {
  const { x, y, width, height, name, change, image, symbol, price } = props;
  
  // Guard clause
  if (!width || !height || width < 5 || height < 5 || !symbol) return null;

  const color = getColorForChange(change || 0);
  
  // Logic for display density based on size
  const isTiny = width < 35 || height < 35;   // Too small -> Empty
  const isSmall = !isTiny && (width < 90 || height < 80); // Small -> Logo Only
  const isLarge = !isTiny && !isSmall;        // Large -> Full info

  // Logic for Tooltip Trigger
  // Small/Tiny squares: Tooltip triggers on entire box
  // Large squares: Tooltip triggers ONLY on the content
  const rectPointerEvents = isLarge ? 'none' : 'all';
  const contentPointerEvents = isLarge ? 'all' : 'none'; 

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6} 
        ry={6}
        style={{
          fill: color,
          stroke: '#1a1c1e',
          strokeWidth: 2,
          pointerEvents: rectPointerEvents, 
          cursor: 'default'
        }}
      />
      {!isTiny && (
        <foreignObject 
            x={x} 
            y={y} 
            width={width} 
            height={height} 
            style={{ pointerEvents: 'none' }} 
        >
            <div 
                className="w-full h-full flex flex-col items-center justify-center p-1 overflow-hidden text-center transition-opacity hover:opacity-90"
                style={{ pointerEvents: contentPointerEvents, cursor: 'default' }}
            >
                {/* Logo Logic */}
                {image && (
                    <img 
                        src={image} 
                        alt={name} 
                        className={`rounded-full shadow-sm drop-shadow-md mb-0.5 object-cover ${isSmall ? 'w-full h-full max-w-[28px] max-h-[28px] object-contain' : 'w-9 h-9 mb-1'}`}
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                )}

                {/* Text Logic - Only for Large - FONTS INCREASED */}
                {isLarge && (
                    <>
                        <span className="font-black text-white drop-shadow-md text-lg leading-tight mt-0.5">
                            {symbol}
                        </span>
                        <span className="text-sm font-bold text-white/95 drop-shadow-sm mt-0.5">
                            {formatPrice(price)}
                        </span>
                        <span className={`text-xs font-black drop-shadow-sm mt-0.5 ${(change || 0) >= 0 ? 'text-green-50' : 'text-red-50'}`}>
                            {(change || 0) > 0 ? '+' : ''}{(change || 0).toFixed(2)}%
                        </span>
                    </>
                )}
            </div>
        </foreignObject>
      )}
    </g>
  );
};

// Smart Tooltip to prevent overflow
const CustomTooltip = ({ active, payload, coordinate, viewBox }: any) => {
  if (active && payload && payload.length && coordinate && viewBox) {
    const data = payload[0].payload;
    if (!data || !data.symbol) return null;

    const isPositive = data.change >= 0;

    // Detect edges to flip tooltip
    // coordinate.x/y is the mouse position relative to the chart container
    // viewBox.width/height is the chart container size
    const x = coordinate.x || 0;
    const y = coordinate.y || 0;
    const w = viewBox.width || 0;
    const h = viewBox.height || 0;

    // Thresholds (pixels from edge)
    const isRightEdge = x > w - 300; 
    const isBottomEdge = y > h - 250; 

    // Dynamic classes for positioning
    // If Right Edge: translate-x-full (move left) + negative margin
    // If Bottom Edge: translate-y-full (move up) + negative margin
    let transformClass = "translate-x-4 translate-y-4"; // Default: Right-Down from cursor
    
    if (isRightEdge && isBottomEdge) {
        transformClass = "-translate-x-[102%] -translate-y-[102%]"; // Top-Left
    } else if (isRightEdge) {
        transformClass = "-translate-x-[102%] translate-y-4"; // Left-Down
    } else if (isBottomEdge) {
        transformClass = "translate-x-4 -translate-y-[102%]"; // Right-Up
    }

    return (
      <div 
        className={`absolute z-[9999] pointer-events-none transition-transform duration-75 ${transformClass}`}
        style={{ left: 0, top: 0 }} // Recharts wrapper handles x/y translate, we adjust relative to that
      >
          <div className="bg-[#121314]/95 backdrop-blur-xl border border-gray-700/50 p-0 rounded-2xl shadow-2xl min-w-[280px] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-4 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img src={data.image} className="w-10 h-10 rounded-full border-2 border-white/10 shadow-lg bg-white" alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    <div>
                        <h4 className="text-lg font-black text-white leading-none">{data.fullName}</h4>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-bold text-gray-400 bg-black/30 px-1.5 py-0.5 rounded">Rank #{data.rank}</span>
                            <span className="text-xs font-bold text-blue-400 uppercase">{data.symbol}</span>
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-xl font-mono font-black text-white">{formatPrice(data.price)}</div>
                    <div className={`text-xs font-black flex items-center justify-end gap-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                        {isPositive ? '+' : ''}{data.change?.toFixed(2)}%
                    </div>
                </div>
            </div>

            {/* Body Stats */}
            <div className="p-4 grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                    <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Market Cap</span>
                    <div className="font-mono font-bold text-gray-200 text-sm">{formatCompact(data.mcap)}</div>
                </div>
                <div className="space-y-1 text-right">
                    <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Volume 24h</span>
                    <div className="font-mono font-bold text-[#dd9933] text-sm">{formatCompact(data.vol)}</div>
                </div>
                
                <div className="col-span-2 h-px bg-gray-800 my-1"></div>

                <div className="space-y-1">
                    <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">High 24h</span>
                    <div className="font-mono font-medium text-green-400">{formatPrice(data.high24)}</div>
                </div>
                <div className="space-y-1 text-right">
                    <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Low 24h</span>
                    <div className="font-mono font-medium text-red-400">{formatPrice(data.low24)}</div>
                </div>

                <div className="col-span-2 h-px bg-gray-800 my-1"></div>

                <div className="space-y-1">
                    <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">All Time High (ATH)</span>
                    <div className="flex justify-between items-center">
                        <span className="font-mono font-medium text-gray-300">{formatPrice(data.ath)}</span>
                        <span className="text-[10px] text-red-500 font-bold">{data.ath_p?.toFixed(1)}%</span>
                    </div>
                    <div className="text-[9px] text-gray-600">{data.ath_date ? new Date(data.ath_date).toLocaleDateString() : '-'}</div>
                </div>
                
                <div className="space-y-1 text-right">
                    <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Supply Circulante</span>
                    <div className="font-mono font-medium text-gray-300">{formatCompact(data.supply)}</div>
                    <div className="text-[9px] text-gray-600">Max: {data.max_supply ? formatCompact(data.max_supply) : '∞'}</div>
                </div>
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
        const response = await fetchWithFallback('/cachecko/cachecko_lite.json');
        
        let rawList: any[] = [];
        if (Array.isArray(response)) {
            if (response[0] && response[0].data && Array.isArray(response[0].data)) {
                rawList = response[0].data;
            } else {
                rawList = response;
            }
        } else if (response && response.data && Array.isArray(response.data)) {
            rawList = response.data;
        }

        if (rawList.length > 0) {
          const mapped = rawList.map((coin: any) => ({
              name: (coin.s || coin.symbol || '').toUpperCase(),
              fullName: coin.n || coin.name,
              symbol: (coin.s || coin.symbol || '').toUpperCase(),
              image: coin.image || coin.i || '', // Fallback for image key if minimized
              price: Number(coin.p ?? coin.current_price ?? 0),
              change: Number(coin.p24 ?? coin.price_change_percentage_24h ?? 0),
              mcap: Number(coin.mc ?? coin.market_cap ?? 0),
              vol: Number(coin.v ?? coin.total_volume ?? 0),
              // Extra fields for rich card
              rank: coin.market_cap_rank || coin.r || 0,
              high24: Number(coin.h24 ?? coin.high_24h ?? 0),
              low24: Number(coin.l24 ?? coin.low_24h ?? 0),
              ath: Number(coin.ath ?? 0),
              ath_p: Number(coin.ath_p ?? coin.ath_change_percentage ?? 0),
              ath_date: coin.ath_d ?? coin.ath_date ?? '',
              supply: Number(coin.cs ?? coin.circulating_supply ?? 0),
              max_supply: Number(coin.ms ?? coin.max_supply ?? 0)
          })).filter(c => c.mcap > 0 && c.symbol); 

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

    // Increase limit to 250 for deeper market view without killing the DOM
    const limit = 250;
    const sorted = [...data].sort((a, b) => b.mcap - a.mcap).slice(0, limit);

    const leaves = sorted.map((coin, index) => {
        let sizeValue = 0;
        if (metric === 'mcap') {
            sizeValue = coin.mcap;
        } else {
            // Logarithmic scale for volatility to prevent tiny blocks
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

  const renderContent = () => (
    <div className="flex flex-col w-full h-full bg-[#1a1c1e] text-white overflow-hidden relative font-sans">
        <div className="flex justify-between items-center px-4 py-2 border-b border-gray-800 bg-[#1a1c1e] shrink-0 z-10">
            <div className="flex items-center gap-4">
                <span className="text-sm font-black uppercase tracking-wider hidden sm:inline text-gray-300">{title}</span>
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
                            <BarChart2 size={12} /> Variação 24h
                        </button>
                    </div>
                )}
            </div>
            
            <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-gray-800/50 rounded text-[10px] font-bold text-gray-400">
                    <Layers size={12} />
                    {data.length > 0 ? `250 de ${data.length} moedas` : '0 moedas'}
                </div>
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

        <div className="flex-1 w-full min-h-0 relative bg-[#0f1011]">
            {loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="animate-spin text-[#dd9933]" size={40} />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Carregando Mercado...</span>
                </div>
            ) : error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 gap-2">
                    <AlertTriangle size={24} />
                    <span className="text-xs font-bold">{error}</span>
                    <button onClick={() => setRefreshKey(k => k + 1)} className="px-3 py-1 bg-red-900/20 rounded text-xs hover:bg-red-900/30 transition-colors">Tentar Novamente</button>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                        data={treeData}
                        dataKey="size"
                        stroke="#0f1011" 
                        fill="#1a1c1e"
                        content={<CustomTreemapContent />}
                        animationDuration={600}
                        aspectRatio={1.6} 
                    >
                        <Tooltip content={<CustomTooltip />} cursor={true} allowEscapeViewBox={{ x: true, y: true }} isAnimationActive={false} />
                    </Treemap>
                </ResponsiveContainer>
            )}
        </div>
        
        {/* Barra de Legenda - Cores baseadas nas escolhas do user (#ff6961 red / #548F3F green) */}
        <div className="h-8 bg-[#121416] border-t border-gray-800 flex items-center justify-center gap-1 px-4 shrink-0 overflow-hidden">
            <span className="text-[9px] text-gray-500 font-bold mr-2">-20%</span>
            <div className="w-8 h-3 bg-[#b93c3c] rounded-sm" title="<= -20%"></div>
            <div className="w-8 h-3 bg-[#e0524e] rounded-sm" title="-7% to -20%"></div>
            <div className="w-8 h-3 bg-[#ff6961] rounded-sm" title="0% to -7% (User Red)"></div>
            
            <div className="w-6 h-3 bg-[#2d3748] rounded-sm border border-gray-700 mx-2" title="0% (Neutral)"></div>
            
            <div className="w-8 h-3 bg-[#548F3F] rounded-sm" title="0% to +7% (User Green)"></div>
            <div className="w-8 h-3 bg-[#467a33] rounded-sm" title="+7% to +20%"></div>
            <div className="w-8 h-3 bg-[#345e2a] rounded-sm" title=">= +20%"></div>
            <span className="text-[9px] text-gray-500 font-bold ml-2">+20%</span>
        </div>
    </div>
  );

  if (isFullscreen) {
    return createPortal(
        <div className="fixed inset-0 z-[9999] w-screen h-screen bg-[#1a1c1e]">
            {renderContent()}
        </div>,
        document.body
    );
  }

  return (
    <div className="w-full h-full overflow-hidden rounded-xl border border-gray-800 shadow-xl bg-[#1a1c1e]">
        {renderContent()}
    </div>
  );
};

export default HeatmapWidget;
