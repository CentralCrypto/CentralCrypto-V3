
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';
import { createPortal } from 'react-dom';
import { Loader2, Maximize2, RefreshCw, AlertTriangle, BarChart2, PieChart, Minimize2, TrendingUp, TrendingDown, Layers, X as CloseIcon, ZoomOut } from 'lucide-react';
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
  const { x, y, width, height, name, change, image, symbol, price, onMouseEnter, onMouseLeave, onClick, zoomLevel = 1 } = props;
  
  // Guard clause
  if (!width || !height || width < 0 || height < 0 || !symbol) return null;

  const color = getColorForChange(change || 0);
  
  // LÓGICA DE ZOOM SEMÂNTICO (VISUAL SIZING):
  const visualW = width * zoomLevel;
  const visualH = height * zoomLevel;

  const isTiny = visualW < 40 || visualH < 40;   // Muito pequeno -> Vazio
  const isSmall = !isTiny && (visualW < 100 || visualH < 80); // Pequeno -> Só Logo
  const isLarge = !isTiny && !isSmall;        // Grande -> Info Completa

  // CONSTANTES DE ESCALA VISUAL
  // O objetivo é: texto cresce até um limite legível, depois para de crescer para não ficar "gigante".
  // maxVisualPx define o tamanho máximo em pixels NA TELA que o elemento deve ter.
  // Dividimos pelo zoomLevel para converter de volta para unidades SVG.
  
  // Tamanho do texto base (sem zoom): aumentado para ser mais legível inicialmente
  const baseFontSize = Math.min(width / 2.8, height / 4, 24); 
  // Limite máximo visual: O texto nunca parecerá maior que 24px na tela
  const maxFontSizeSVG = 24 / zoomLevel; 
  // O tamanho final é o menor entre o tamanho proporcional ao box e o limite visual
  const finalFontSize = Math.min(baseFontSize, maxFontSizeSVG);

  // Mesmo conceito para o logo
  // Limite visual do logo: 60px na tela
  const maxLogoSizeSVG = 60 / zoomLevel; 

  const triggerOnRect = isTiny;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={4 / zoomLevel} 
        ry={4 / zoomLevel}
        style={{
          fill: color,
          stroke: '#1a1c1e',
          strokeWidth: 2 / zoomLevel, // Borda fica fina no zoom
          pointerEvents: 'all', 
          cursor: 'pointer'
        }}
        onMouseEnter={triggerOnRect ? () => onMouseEnter && onMouseEnter(props) : undefined}
        onMouseLeave={triggerOnRect ? onMouseLeave : undefined}
        onClick={onClick}
      />
      {!isTiny && (
        <foreignObject 
            x={x} 
            y={y} 
            width={width} 
            height={height} 
            style={{ pointerEvents: 'none' }}
        >
            <div className="w-full h-full flex items-center justify-center overflow-hidden">
                <div 
                    className="flex flex-col items-center justify-center p-0.5 pointer-events-auto cursor-help w-full h-full"
                    onMouseEnter={() => onMouseEnter && onMouseEnter(props)}
                    onMouseLeave={onMouseLeave}
                    onClick={onClick}
                >
                    {/* Logo Logic - escala inversa ao zoom para manter limite visual */}
                    {image && (
                        <div style={{ 
                            width: '40%', 
                            height: 'auto', 
                            maxWidth: `${maxLogoSizeSVG}px`, 
                            maxHeight: `${maxLogoSizeSVG}px`,
                            marginBottom: isLarge ? '4%' : '0',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}>
                            <img 
                                src={image} 
                                alt={name} 
                                className="rounded-full shadow-sm drop-shadow-md object-contain w-full h-full"
                                style={{ imageRendering: '-webkit-optimize-contrast' }}
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                        </div>
                    )}

                    {/* Text Logic - Inverse Scale Clamping */}
                    {isLarge && (
                        <div className="flex flex-col items-center justify-center text-center w-full leading-tight">
                            <span 
                                className="font-black text-white drop-shadow-md"
                                style={{ fontSize: `${finalFontSize}px` }}
                            >
                                {symbol}
                            </span>
                            <span 
                                className="font-bold text-white/90 drop-shadow-sm mt-[2%]"
                                style={{ fontSize: `${finalFontSize * 0.75}px` }}
                            >
                                {formatPrice(price)}
                            </span>
                            <span 
                                className={`font-black drop-shadow-sm mt-[2%] ${(change || 0) >= 0 ? 'text-green-50' : 'text-red-50'}`}
                                style={{ fontSize: `${finalFontSize * 0.65}px` }}
                            >
                                {(change || 0) > 0 ? '+' : ''}{(change || 0).toFixed(2)}%
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </foreignObject>
      )}
    </g>
  );
};

// Tooltip now receives zoomLevel to counter-scale itself
const CustomTooltip = ({ active, payload, coordinate, viewBox, zoomLevel = 1 }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload || payload[0];
    if (!data || !data.symbol) return null;

    const isPositive = (data.change || 0) >= 0;

    const x = coordinate?.x || 0;
    const y = coordinate?.y || 0;
    
    // Tooltip offset logic to keep it on screen
    const isRightHalf = x > (viewBox?.width || 0) / 2;
    const isBottomHalf = y > 220; 

    const xTranslate = isRightHalf ? '-100%' : '0%';
    const yTranslate = isBottomHalf ? '-100%' : '0%';
    
    // Scale offset by 1/zoomLevel so the distance feels constant on screen
    const offsetPx = 15 / zoomLevel; 
    const xOffset = isRightHalf ? -offsetPx : offsetPx;
    const yOffset = isBottomHalf ? -offsetPx : offsetPx;

    return (
      <div 
        className="absolute z-[9999] pointer-events-none"
        style={{ 
            left: 0, 
            top: 0,
            // CRITICAL: Translate to position, THEN Scale down inversely to zoom
            // This keeps the tooltip visually constant size (1x) regardless of chart zoom
            transform: `translate(${x + xOffset}px, ${y + yOffset}px) translate(${xTranslate}, ${yTranslate}) scale(${1 / zoomLevel})`,
            transformOrigin: isRightHalf ? (isBottomHalf ? 'bottom right' : 'top right') : (isBottomHalf ? 'bottom left' : 'top left')
        }} 
      >
          <div className="bg-[#121314]/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl min-w-[240px] overflow-hidden flex flex-col">
            {/* Header Compact */}
            <div className="bg-white/5 p-3 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-3">
                    {data.image && <img src={data.image} className="w-10 h-10 rounded-full border border-white/10 bg-white p-0.5" alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />}
                    <div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-base font-black text-white leading-none">{data.symbol}</span>
                            <span className="text-[10px] font-bold text-gray-400 bg-white/10 px-1.5 py-0.5 rounded">#{data.rank}</span>
                        </div>
                        <span className="text-[11px] font-medium text-gray-400 truncate max-w-[120px] block mt-0.5">{data.fullName}</span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-lg font-mono font-bold text-white">{formatPrice(data.price)}</div>
                    <div className={`text-[11px] font-black ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? '+' : ''}{Number(data.change || 0).toFixed(2)}%
                    </div>
                </div>
            </div>

            {/* Body Compact Stats */}
            <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[11px]">
                <div className="flex flex-col">
                    <span className="text-gray-500 font-bold uppercase tracking-wide">Mkt Cap</span>
                    <span className="font-mono font-medium text-gray-200 text-sm">{formatCompact(data.mcap)}</span>
                </div>
                <div className="flex flex-col text-right">
                    <span className="text-gray-500 font-bold uppercase tracking-wide">Vol 24h</span>
                    <span className="font-mono font-medium text-[#dd9933] text-sm">{formatCompact(data.vol)}</span>
                </div>
                
                <div className="col-span-2 border-t border-white/5"></div>

                <div className="flex justify-between items-center col-span-2">
                    <span className="text-gray-500 font-bold uppercase">High 24h</span>
                    <span className="font-mono font-medium text-green-400">{formatPrice(data.high24)}</span>
                </div>
                <div className="flex justify-between items-center col-span-2">
                    <span className="text-gray-500 font-bold uppercase">Low 24h</span>
                    <span className="font-mono font-medium text-red-400">{formatPrice(data.low24)}</span>
                </div>
                
                <div className="col-span-2 border-t border-white/5"></div>

                <div className="flex justify-between items-center col-span-2">
                    <span className="text-gray-500 font-bold uppercase">ATH</span>
                    <div className="flex items-center gap-1.5">
                        <span className="font-mono font-medium text-gray-300">{formatPrice(data.ath)}</span>
                        <span className="text-[10px] text-red-500 font-bold bg-red-900/20 px-1 rounded">({data.ath_p?.toFixed(0)}%)</span>
                    </div>
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

  // Zoom & Pan State
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number, y: number, ix: number, iy: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset zoom on data reload or view change
  useEffect(() => {
      setTransform({ k: 1, x: 0, y: 0 });
  }, [metric, data, isFullscreen]);

  const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const sensitivity = 0.001;
      const delta = -e.deltaY * sensitivity;
      const oldK = transform.k;
      const newK = Math.min(Math.max(1, oldK + delta), 20); // Zoom máximo aumentado para 20x

      if (newK === oldK) return;

      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Pivot math:
      const worldX = (mx - transform.x) / oldK;
      const worldY = (my - transform.y) / oldK;

      const newX = mx - worldX * newK;
      const newY = my - worldY * newK;

      setTransform({ k: newK, x: newX, y: newY });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      if (transform.k <= 1) return;
      e.preventDefault(); // Prevent text selection
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, ix: transform.x, iy: transform.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging || !dragStart.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setTransform(prev => ({ ...prev, x: dragStart.current!.ix + dx, y: dragStart.current!.iy + dy }));
  };

  const handleMouseUp = () => {
      setIsDragging(false);
      dragStart.current = null;
  };

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

    // 🔥 LIMITE AUMENTADO PARA 1000 MOEDAS
    const limit = 1000;
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
                    {data.length > 0 ? `Top 1000 de ${data.length} moedas` : '0 moedas'}
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

        <div className="flex-1 w-full min-h-0 relative bg-[#0f1011] overflow-hidden" 
             ref={containerRef}
             onWheel={handleWheel}
             onMouseDown={handleMouseDown}
             onMouseMove={handleMouseMove}
             onMouseUp={handleMouseUp}
             onMouseLeave={handleMouseUp}
        >
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
                <div style={{ 
                    width: '100%', 
                    height: '100%', 
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`, 
                    transformOrigin: '0 0',
                    cursor: transform.k > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <Treemap
                            data={treeData}
                            dataKey="size"
                            stroke="#0f1011" 
                            fill="#1a1c1e"
                            // 🔥 Passamos o zoomLevel para o conteúdo poder reagir
                            content={<CustomTreemapContent zoomLevel={transform.k} />}
                            animationDuration={600}
                            aspectRatio={1.6} 
                        >
                            <Tooltip 
                                content={<CustomTooltip zoomLevel={transform.k} />} 
                                cursor={true} 
                                allowEscapeViewBox={{ x: true, y: true }} 
                                isAnimationActive={false} 
                                offset={0}
                            />
                        </Treemap>
                    </ResponsiveContainer>
                </div>
            )}

            {transform.k > 1 && (
                <button 
                    onClick={() => setTransform({ k: 1, x: 0, y: 0 })}
                    className="absolute bottom-4 right-4 z-50 bg-[#dd9933] text-black px-3 py-1.5 rounded-lg shadow-xl font-bold text-xs flex items-center gap-2 hover:scale-105 transition-transform"
                >
                    <ZoomOut size={14} /> Reset Zoom
                </button>
            )}
        </div>
        
        {/* Barra de Legenda */}
        <div className="h-8 bg-[#121416] border-t border-gray-800 flex items-center justify-center gap-1 px-4 shrink-0 overflow-hidden z-20">
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
