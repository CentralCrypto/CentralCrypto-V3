
import React, { useEffect, useState, useMemo } from 'react';
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';
import { createPortal } from 'react-dom';
import { Loader2, Maximize2, RefreshCw, AlertTriangle, BarChart2, PieChart, Minimize2, TrendingUp, TrendingDown, Info, DollarSign, Activity, Layers } from 'lucide-react';
import { fetchWithFallback } from '../services/api';
import { DashboardItem } from '../../../types';

interface Props {
  item?: DashboardItem;
  title?: string;
  onClose?: () => void;
  language?: string;
}

// Escala de cores "Matte" (Menos saturada, mais profissional)
const getColorForChange = (change: number) => {
    if (change >= 15) return '#14532d'; // Deepest Green
    if (change >= 5) return '#166534';  // Deep Green
    if (change >= 0) return '#15803d';  // Matte Green
    if (change >= -5) return '#b91c1c'; // Matte Red
    if (change >= -15) return '#991b1b'; // Deep Red
    return '#7f1d1d'; // Deepest Red
};

const formatCompact = (num: number) => {
    if (!num) return '-';
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toLocaleString()}`;
};

const formatPrice = (price: number) => {
    if (price < 1) return `$${price.toFixed(6)}`;
    if (price < 10) return `$${price.toFixed(4)}`;
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const CustomTreemapContent = (props: any) => {
  const { x, y, width, height, name, change, image, symbol, price } = props;
  
  if (!width || !height || width < 5 || height < 5) return null;

  const color = getColorForChange(change || 0);
  const showDetail = width > 50 && height > 50;
  const showLogo = width > 35 && height > 35;

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
          rx: 6, 
          ry: 6,
        }}
      />
      <foreignObject x={x} y={y} width={width} height={height} style={{ pointerEvents: 'none' }}>
        <div className="w-full h-full flex flex-col items-center justify-center p-1 overflow-hidden text-center">
            {showLogo && image && (
                <img 
                    src={image} 
                    alt={name} 
                    className="w-6 h-6 md:w-8 md:h-8 rounded-full mb-1 shadow-sm drop-shadow-md" 
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                />
            )}
            <span className={`font-black text-white drop-shadow-md ${showDetail ? 'text-sm' : 'text-[10px]'} leading-tight`}>
                {symbol}
            </span>
            {showDetail && (
                <>
                    <span className="text-[10px] font-bold text-white/90 drop-shadow-sm mt-0.5">
                        {formatPrice(price)}
                    </span>
                    <span className={`text-[10px] font-black drop-shadow-sm mt-0.5 ${change >= 0 ? 'text-green-100' : 'text-red-100'}`}>
                        {change > 0 ? '+' : ''}{change.toFixed(2)}%
                    </span>
                </>
            )}
        </div>
      </foreignObject>
    </g>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isPositive = data.change >= 0;

    return (
      <div className="bg-[#121314]/95 backdrop-blur-xl border border-gray-700/50 p-0 rounded-2xl shadow-2xl z-[9999] min-w-[280px] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-4 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <img src={data.image} className="w-10 h-10 rounded-full border-2 border-white/10 shadow-lg bg-white" alt="" />
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
                <div className="text-[9px] text-gray-600">{new Date(data.ath_date).toLocaleDateString()}</div>
            </div>
            
            <div className="space-y-1 text-right">
                <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Supply Circulante</span>
                <div className="font-mono font-medium text-gray-300">{formatCompact(data.supply)}</div>
                <div className="text-[9px] text-gray-600">Max: {data.max_supply ? formatCompact(data.max_supply) : '∞'}</div>
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
                            <BarChart2 size={12} /> Volatilidade
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
                        stroke="#0f1011" // Darker stroke to separate blocks cleaner
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
        
        {/* Barra de Legenda - Cores "Matte" Profissionais */}
        <div className="h-8 bg-[#121416] border-t border-gray-800 flex items-center justify-center gap-1 px-4 shrink-0 overflow-hidden">
            <span className="text-[9px] text-gray-500 font-bold mr-2">-15%</span>
            <div className="w-6 h-3 bg-[#7f1d1d] rounded-sm" title="-15%"></div>
            <div className="w-6 h-3 bg-[#991b1b] rounded-sm" title="-5%"></div>
            <div className="w-6 h-3 bg-[#b91c1c] rounded-sm" title="-2%"></div>
            <div className="w-6 h-3 bg-[#334155] rounded-sm border border-gray-700" title="0%"></div>
            <div className="w-6 h-3 bg-[#15803d] rounded-sm" title="+2%"></div>
            <div className="w-6 h-3 bg-[#166534] rounded-sm" title="+5%"></div>
            <div className="w-6 h-3 bg-[#14532d] rounded-sm" title="+15%"></div>
            <span className="text-[9px] text-gray-500 font-bold ml-2">+15%</span>
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
