
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { ResponsiveContainer, Treemap } from 'recharts';
import { createPortal } from 'react-dom';
import { Loader2, Maximize2, RefreshCw, AlertTriangle, BarChart2, PieChart, Minimize2, Layers, ZoomOut } from 'lucide-react';
import { fetchWithFallback } from '../services/api';
import { DashboardItem } from '../../../types';

interface Props {
  item?: DashboardItem;
  title?: string;
  onClose?: () => void;
  language?: string;
}

// === PALETA DE CORES ===
const getColorForChange = (change: number) => {
    if (change >= 20) return '#345e2a';
    if (change >= 7)  return '#467a33';
    if (change >= 0)  return '#548F3F';
    if (change <= -20) return '#b93c3c';
    if (change <= -7)  return '#e0524e';
    if (change < 0)    return '#ff6961';
    return '#2d3748';
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

// === MANUAL TOOLTIP COMPONENT ===
const ManualTooltip = ({ data, x, y }: { data: any, x: number, y: number }) => {
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ top: y, left: x });

    // Adjust position to prevent overflow
    useEffect(() => {
        if (tooltipRef.current) {
            const rect = tooltipRef.current.getBoundingClientRect();
            const winW = window.innerWidth;
            const winH = window.innerHeight;
            
            let newTop = y + 10; // Default offset
            let newLeft = x + 10;

            // Check Bottom
            if (newTop + rect.height > winH - 20) {
                newTop = y - rect.height - 10;
            }
            
            // Check Top (if flipped up goes off screen)
            if (newTop < 10) {
                newTop = 10; // Stick to top edge
            }

            // Check Right
            if (newLeft + rect.width > winW - 20) {
                newLeft = x - rect.width - 10;
            }

            setPos({ top: newTop, left: newLeft });
        }
    }, [x, y]);

    if (!data) return null;
    const isPositive = (data.change || 0) >= 0;

    return createPortal(
        <div 
            ref={tooltipRef}
            className="fixed z-[9999] pointer-events-none animate-in fade-in zoom-in-95 duration-100"
            style={{ 
                top: pos.top, 
                left: pos.left,
                maxWidth: '240px'
            }} 
        >
            <div className="bg-[#121314]/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] overflow-hidden flex flex-col">
                <div className="bg-white/5 p-2.5 flex items-center justify-between border-b border-white/5">
                    <div className="flex items-center gap-2.5">
                        {data.image && <img src={data.image} className="w-8 h-8 rounded-full border border-white/10 bg-white p-0.5" alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />}
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-black text-white leading-none truncate">{data.symbol}</span>
                                <span className="text-[9px] font-bold text-gray-400 bg-white/10 px-1 py-0.5 rounded">#{data.rank}</span>
                            </div>
                            <span className="text-[9px] font-medium text-gray-400 truncate max-w-[100px] block mt-0.5">{data.fullName}</span>
                        </div>
                    </div>
                    <div className="text-right whitespace-nowrap ml-2">
                        <div className="text-base font-mono font-bold text-white">{formatPrice(data.price)}</div>
                        <div className={`text-[10px] font-black ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                            {isPositive ? '+' : ''}{Number(data.change || 0).toFixed(2)}%
                        </div>
                    </div>
                </div>

                <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
                    <div className="flex flex-col">
                        <span className="text-gray-500 font-bold uppercase tracking-wide">Mkt Cap</span>
                        <span className="font-mono font-medium text-gray-200 text-xs">{formatCompact(data.mcap)}</span>
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="text-gray-500 font-bold uppercase tracking-wide">Vol 24h</span>
                        <span className="font-mono font-medium text-[#dd9933] text-xs">{formatCompact(data.vol)}</span>
                    </div>
                    <div className="col-span-2 border-t border-white/5 my-0.5"></div>
                    <div className="flex justify-between items-center col-span-2">
                        <span className="text-gray-500 font-bold uppercase">High 24h</span>
                        <span className="font-mono font-medium text-green-400">{formatPrice(data.high24)}</span>
                    </div>
                    <div className="flex justify-between items-center col-span-2">
                        <span className="text-gray-500 font-bold uppercase">Low 24h</span>
                        <span className="font-mono font-medium text-red-400">{formatPrice(data.low24)}</span>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

// Conteúdo Otimizado - Tooltip SOMENTE no conteúdo interno
const CustomTreemapContent = (props: any) => {
  const { 
      x, y, width, height, 
      change, image, symbol, price, 
      onClick, zoomLevel = 1,
      // Custom handler passed from parent
      onContentHover, 
      onContentLeave 
  } = props;
  
  if (!width || !height || width < 0 || height < 0 || !symbol) return null;

  const color = getColorForChange(change || 0);
  
  // Zoom visual calculation
  const visualW = width * zoomLevel;
  const visualH = height * zoomLevel;

  const isTiny = visualW < 45 || visualH < 45;
  const isLarge = !isTiny && (visualW > 110 && visualH > 90);

  // Font scaling adjusted: Reduced max visual size to prevent "giant text"
  // Previous: 24 / zoomLevel -> Now: 16 / zoomLevel
  const baseFontSize = Math.min(width / 3.5, height / 3.5, 24); 
  const maxFontSizeSVG = 16 / zoomLevel; 
  const finalFontSize = Math.min(baseFontSize, maxFontSizeSVG);
  
  const maxLogoSizeSVG = 45 / zoomLevel; 

  return (
    <g>
      {/* BACKGROUND (Passive) */}
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
          strokeWidth: 2 / zoomLevel,
          pointerEvents: 'none'
        }}
      />
      
      {/* HIT AREA (Background Interactivity only, NO TOOLTIP) */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{ fill: 'transparent', cursor: 'grab' }}
        onClick={onClick}
        onMouseEnter={onContentLeave} // Close tooltip if moved to empty space
      />

      {!isTiny && (
        <foreignObject 
            x={x} 
            y={y} 
            width={width} 
            height={height} 
            style={{ pointerEvents: 'none', overflow: 'visible' }}
        >
            <div className="w-full h-full flex items-center justify-center p-0.5">
                {/* 
                    CONTENT CONTAINER (Active Tooltip Trigger) 
                    - pointer-events: auto 
                    - onMouseEnter triggers parent state
                */}
                <div 
                    className="flex flex-col items-center justify-center bg-black/10 hover:bg-black/30 rounded-lg transition-colors p-1 max-w-full max-h-full overflow-hidden cursor-default"
                    style={{ 
                        backdropFilter: 'blur(2px)',
                        pointerEvents: 'auto'
                    }}
                    onMouseEnter={(e) => {
                        e.stopPropagation();
                        // Call parent handler to show tooltip at mouse pos
                        onContentHover(props, e.clientX, e.clientY);
                    }}
                    onMouseLeave={onContentLeave}
                    onClick={onClick}
                >
                    {image && (
                        <div style={{ 
                            width: 'auto', 
                            height: 'auto', 
                            maxWidth: `${maxLogoSizeSVG}px`, 
                            maxHeight: `${maxLogoSizeSVG}px`,
                            marginBottom: isLarge ? '2%' : '0',
                            display: 'flex', 
                            justifyContent: 'center'
                        }}>
                            <img 
                                src={image} 
                                alt={symbol} 
                                className="rounded-full shadow-sm drop-shadow-md object-contain aspect-square"
                                style={{ 
                                    width: '100%', 
                                    height: '100%',
                                    imageRendering: '-webkit-optimize-contrast' 
                                }}
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                        </div>
                    )}

                    {isLarge && (
                        <div className="flex flex-col items-center justify-center text-center w-full leading-none mt-[1%]">
                            <span 
                                className="font-black text-white drop-shadow-md truncate max-w-[95%]"
                                style={{ fontSize: `${finalFontSize}px`, lineHeight: 1.1 }}
                            >
                                {symbol}
                            </span>
                            <span 
                                className="font-bold text-white/90 drop-shadow-sm truncate max-w-[95%] mt-[2%]"
                                style={{ fontSize: `${finalFontSize * 0.75}px`, lineHeight: 1.1 }}
                            >
                                {formatPrice(price)}
                            </span>
                            <span 
                                className={`font-black drop-shadow-sm mt-[2%] truncate max-w-[95%] ${(change || 0) >= 0 ? 'text-green-50' : 'text-red-50'}`}
                                style={{ fontSize: `${finalFontSize * 0.65}px`, lineHeight: 1.1 }}
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

const HeatmapWidget: React.FC<Props> = ({ item, title = "Crypto Heatmap", onClose }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState<'mcap' | 'change'>('mcap');
  const [isFullscreen, setIsFullscreen] = useState(item?.isMaximized || false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number, y: number, ix: number, iy: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Manual Tooltip State
  const [tooltipState, setTooltipState] = useState<{ visible: boolean, data: any, x: number, y: number }>({ 
      visible: false, data: null, x: 0, y: 0 
  });

  const handleContentHover = useCallback((data: any, clientX: number, clientY: number) => {
      setTooltipState({
          visible: true,
          data: data,
          x: clientX,
          y: clientY
      });
  }, []);

  const handleContentLeave = useCallback(() => {
      setTooltipState(prev => ({ ...prev, visible: false }));
  }, []);

  useEffect(() => {
      setTransform({ k: 1, x: 0, y: 0 });
  }, [metric, data, isFullscreen]);

  const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setTooltipState(prev => ({ ...prev, visible: false })); // Hide tooltip on zoom

      const sensitivity = 0.001;
      const delta = -e.deltaY * sensitivity;
      const oldK = transform.k;
      const newK = Math.min(Math.max(1, oldK + delta), 20); 
      if (newK === oldK) return;
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const worldX = (mx - transform.x) / oldK;
      const worldY = (my - transform.y) / oldK;
      const newX = mx - worldX * newK;
      const newY = my - worldY * newK;
      setTransform({ k: newK, x: newX, y: newY });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      if (transform.k <= 1) return;
      e.preventDefault(); 
      setIsDragging(true);
      setTooltipState(prev => ({ ...prev, visible: false })); // Hide tooltip on drag
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
          const uniqueMap = new Map();
          
          rawList.forEach((coin: any) => {
              if (!coin || !coin.symbol) return;
              const sym = coin.symbol.toUpperCase();
              if (!uniqueMap.has(sym)) {
                  uniqueMap.set(sym, {
                      id: coin.id || sym, 
                      name: (coin.s || coin.symbol || '').toUpperCase(),
                      fullName: coin.n || coin.name,
                      symbol: sym,
                      image: coin.image || coin.i || '', 
                      price: Number(coin.p ?? coin.current_price ?? 0),
                      change: Number(coin.p24 ?? coin.price_change_percentage_24h ?? 0),
                      mcap: Number(coin.mc ?? coin.market_cap ?? 0),
                      vol: Number(coin.v ?? coin.total_volume ?? 0),
                      rank: coin.market_cap_rank || coin.r || 0,
                      high24: Number(coin.h24 ?? coin.high_24h ?? 0),
                      low24: Number(coin.l24 ?? coin.low_24h ?? 0),
                      ath: Number(coin.ath ?? 0),
                      ath_p: Number(coin.ath_p ?? coin.ath_change_percentage ?? 0),
                      supply: Number(coin.cs ?? coin.circulating_supply ?? 0)
                  });
              }
          });

          const mapped = Array.from(uniqueMap.values()).filter(c => c.mcap > 0);
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
    const limit = 1000;
    const sorted = [...data].sort((a, b) => b.mcap - a.mcap).slice(0, limit);

    const leaves = sorted.map((coin, index) => {
        let sizeValue = 0;
        if (metric === 'mcap') {
            sizeValue = coin.mcap;
        } else {
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
        {/* Custom Tooltip Portal */}
        {tooltipState.visible && tooltipState.data && (
            <ManualTooltip 
                data={tooltipState.data} 
                x={tooltipState.x} 
                y={tooltipState.y} 
            />
        )}

        <div className="flex justify-between items-center px-4 py-2 border-b border-gray-800 bg-[#1a1c1e] shrink-0 z-10">
            <div className="flex items-center gap-4">
                <span className="text-sm font-black uppercase tracking-wider hidden sm:inline text-gray-300">{title}</span>
                {!loading && !error && (
                    <div className="flex bg-black/40 p-0.5 rounded-lg border border-gray-700">
                        <button onClick={() => setMetric('mcap')} className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded flex items-center gap-1.5 transition-all ${metric === 'mcap' ? 'bg-[#dd9933] text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}><PieChart size={12} /> MarketCap</button>
                        <button onClick={() => setMetric('change')} className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded flex items-center gap-1.5 transition-all ${metric === 'change' ? 'bg-[#dd9933] text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}><BarChart2 size={12} /> Variação 24h</button>
                    </div>
                )}
            </div>
            
            <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-gray-800/50 rounded text-[10px] font-bold text-gray-400"><Layers size={12} />{data.length > 0 ? `Top 1000` : '0 moedas'}</div>
                <button onClick={() => setRefreshKey(k => k + 1)} className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
                <button onClick={toggleFullscreen} className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors">{isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
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
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"><Loader2 className="animate-spin text-[#dd9933]" size={40} /><span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Carregando Mercado...</span></div>
            ) : error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 gap-2"><AlertTriangle size={24} /><span className="text-xs font-bold">{error}</span><button onClick={() => setRefreshKey(k => k + 1)} className="px-3 py-1 bg-red-900/20 rounded text-xs hover:bg-red-900/30 transition-colors">Tentar Novamente</button></div>
            ) : (
                <div style={{ 
                    width: '100%', 
                    height: '100%', 
                    transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.k})`, 
                    transformOrigin: '0 0',
                    cursor: transform.k > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                    willChange: isDragging ? 'transform' : 'auto',
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <Treemap
                            data={treeData}
                            dataKey="size"
                            stroke="#0f1011" 
                            fill="#1a1c1e"
                            content={
                                <CustomTreemapContent 
                                    zoomLevel={transform.k}
                                    onContentHover={handleContentHover}
                                    onContentLeave={handleContentLeave}
                                />
                            }
                            animationDuration={600}
                            aspectRatio={1.6} 
                            isAnimationActive={false}
                        />
                    </ResponsiveContainer>
                </div>
            )}
            {transform.k > 1 && (
                <button onClick={() => setTransform({ k: 1, x: 0, y: 0 })} className="absolute bottom-4 right-4 z-50 bg-[#dd9933] text-black px-3 py-1.5 rounded-lg shadow-xl font-bold text-xs flex items-center gap-2 hover:scale-105 transition-transform"><ZoomOut size={14} /> Reset Zoom</button>
            )}
        </div>
        
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
        <div className="fixed inset-0 z-[9999] w-screen h-screen bg-[#1a1c1e]">{renderContent()}</div>,
        document.body
    );
  }

  return (
    <div className="w-full h-full overflow-hidden rounded-xl border border-gray-800 shadow-xl bg-[#1a1c1e]">{renderContent()}</div>
  );
};

export default HeatmapWidget;
