
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
    return '#2d3748'; // Neutro
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
            
            let newTop = y + 10; 
            let newLeft = x + 10;

            // Check Bottom Overflow
            if (newTop + rect.height > winH - 20) {
                newTop = y - rect.height - 10;
            }
            
            // Check Top Overflow (Clamp if it goes off screen after flipping)
            newTop = Math.max(10, newTop);

            // Check Right Overflow
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

const CustomTreemapContent = (props: any) => {
  const { 
      x, y, width, height, 
      change, image, symbol, price, 
      onClick, zoomLevel = 1,
      onContentHover, 
      onContentLeave,
      metric 
  } = props;
  
  if (!width || !height || width < 0 || height < 0 || !symbol) return null;

  // Cor baseada na variação
  const color = getColorForChange(change || 0);
  
  const visualW = width * zoomLevel;
  const visualH = height * zoomLevel;

  const isTiny = visualW < 45 || visualH < 45;
  const isLarge = !isTiny && (visualW > 110 && visualH > 80);

  // Font Scaling (Reduced to prevent text overflow)
  const baseFontSize = Math.min(width / 4, height / 4, 18); 
  const maxFontSizeSVG = 14 / zoomLevel; 
  const finalFontSize = Math.min(baseFontSize, maxFontSizeSVG);
  
  const maxLogoSizeSVG = 36 / zoomLevel; 

  // Determine o que mostrar como valor secundário
  const secondaryValue = metric === 'mcap' 
      ? formatPrice(price)
      : `${(change || 0) > 0 ? '+' : ''}${(change || 0).toFixed(2)}%`;

  return (
    <g>
      {/* Background (Tile) */}
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
      
      {/* Hit Area (Close Tooltip on hover blank space) */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{ fill: 'transparent', cursor: 'grab' }}
        onClick={onClick}
        onMouseEnter={onContentLeave} 
      />

      {!isTiny && (
        <foreignObject 
            x={x} 
            y={y} 
            width={width} 
            height={height} 
            style={{ pointerEvents: 'none', overflow: 'visible' }}
        >
            <div className="w-full h-full flex items-center justify-center p-[2px]">
                <div 
                    className="flex flex-col items-center justify-center bg-black/10 hover:bg-black/30 rounded-lg transition-colors p-0.5 overflow-hidden cursor-default pointer-events-auto w-full h-full"
                    style={{ 
                        backdropFilter: 'blur(2px)'
                    }}
                    onMouseEnter={(e) => {
                        e.stopPropagation();
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
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            <img 
                                src={image} 
                                alt={symbol} 
                                className="rounded-full shadow-sm drop-shadow-md object-contain aspect-square bg-white/10"
                                style={{ 
                                    width: '100%', 
                                    height: '100%',
                                    imageRendering: '-webkit-optimize-contrast' 
                                }}
                                onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        </div>
                    )}

                    {isLarge && (
                        <div className="flex flex-col items-center justify-center text-center w-full leading-none mt-[1%] min-w-0">
                            <span 
                                className="font-black text-white drop-shadow-md truncate w-full"
                                style={{ fontSize: `${finalFontSize}px`, lineHeight: 1.1 }}
                            >
                                {symbol}
                            </span>
                            <span 
                                className="font-bold text-white/90 drop-shadow-sm truncate w-full mt-[1%]"
                                style={{ fontSize: `${finalFontSize * 0.85}px`, lineHeight: 1.1 }}
                            >
                                {secondaryValue}
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

  // Transform State (React state for render sync)
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  // Refs for High Performance Dragging (Avoid React Render Loop)
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number, y: number, ix: number, iy: number } | null>(null);
  const transformRef = useRef({ k: 1, x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  // Tooltip State
  const [tooltipState, setTooltipState] = useState<{ visible: boolean, data: any, x: number, y: number }>({ 
      visible: false, data: null, x: 0, y: 0 
  });

  const handleContentHover = useCallback((data: any, clientX: number, clientY: number) => {
      if (isDragging) return; // Don't show tooltip while dragging
      setTooltipState({
          visible: true,
          data: data,
          x: clientX,
          y: clientY
      });
  }, [isDragging]);

  const handleContentLeave = useCallback(() => {
      setTooltipState(prev => ({ ...prev, visible: false }));
  }, []);

  // Sync transformRef when state changes (e.g. zoom buttons)
  useEffect(() => {
      transformRef.current = transform;
      if (containerRef.current) {
          containerRef.current.style.transform = `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.k})`;
      }
  }, [transform]);

  const applyDirectTransform = (k: number, x: number, y: number) => {
      if (containerRef.current) {
          containerRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${k})`;
      }
      transformRef.current = { k, x, y };
  };

  const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setTooltipState(prev => ({ ...prev, visible: false }));

      const sensitivity = 0.001;
      const delta = -e.deltaY * sensitivity;
      const oldK = transformRef.current.k;
      const newK = Math.min(Math.max(1, oldK + delta), 20); 
      
      if (newK === oldK || !containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const parentRect = containerRef.current.parentElement?.getBoundingClientRect() || rect;
      
      const mx = e.clientX - parentRect.left;
      const my = e.clientY - parentRect.top;
      
      const worldX = (mx - transformRef.current.x) / oldK;
      const worldY = (my - transformRef.current.y) / oldK;
      
      const newX = mx - worldX * newK;
      const newY = my - worldY * newK;
      
      // Update DOM directly for smoothness
      applyDirectTransform(newK, newX, newY);
      
      // Debounce state update to prevent lag
      // (Optional: can just update state on mouse up/end of zoom if needed)
      setTransform({ k: newK, x: newX, y: newY });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      if (transformRef.current.k <= 1) return;
      e.preventDefault(); 
      setIsDragging(true);
      setTooltipState(prev => ({ ...prev, visible: false }));
      
      dragStart.current = { 
          x: e.clientX, 
          y: e.clientY, 
          ix: transformRef.current.x, 
          iy: transformRef.current.y 
      };
      
      if (containerRef.current) {
          containerRef.current.style.cursor = 'grabbing';
          containerRef.current.style.transition = 'none'; // Disable transition for drag
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      // Fix: Strict null check to prevent crash "reading 'ix'"
      if (!isDragging || !dragStart.current) return;
      
      const clientX = e.clientX;
      const clientY = e.clientY;

      if (rafRef.current) return; // Prevent stacking frames

      rafRef.current = requestAnimationFrame(() => {
          if (!dragStart.current) return;
          const dx = clientX - dragStart.current.x;
          const dy = clientY - dragStart.current.y;
          
          const newX = dragStart.current.ix + dx;
          const newY = dragStart.current.iy + dy;
          
          // Direct DOM manipulation for zero-lag dragging
          applyDirectTransform(transformRef.current.k, newX, newY);
          rafRef.current = null;
      });
  };

  const handleMouseUp = () => {
      if (!isDragging) return;
      
      setIsDragging(false);
      dragStart.current = null;
      if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
      }
      
      if (containerRef.current) {
          containerRef.current.style.cursor = 'grab';
          containerRef.current.style.transition = 'transform 0.1s ease-out';
      }
      
      // Sync React state at the end of drag
      setTransform({ ...transformRef.current });
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

          // IMAGE PRELOADER BUFFERING
          if (mapped.length > 0) {
              const topCoins = mapped.slice(0, 50); // Preload top 50
              topCoins.forEach(coin => {
                  if (coin.image) {
                      const img = new Image();
                      img.src = coin.image;
                  }
              });
          }

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
        let sizeValue = coin.mcap;
        
        // Se métrica for 'change', use valor absoluto da variação para tamanho
        // EXPONENCIAL para forçar diferença de tamanho e evitar colunas
        if (metric === 'change') {
            const absChange = Math.abs(coin.change);
            // Power 3 creates strong variance: 1% -> 1, 5% -> 125, 10% -> 1000
            // Adding a tiny base to ensure very small movers are visible but tiny
            sizeValue = Math.pow(absChange + 0.5, 3) * 1000; 
        }

        return {
            ...coin,
            size: sizeValue,
            rank: index + 1
        };
    });

    return [{ name: 'Market', children: leaves }];
  }, [data, metric]); // Added metric back as dependency

  const toggleFullscreen = () => {
      if (item?.isMaximized && onClose) onClose();
      else setIsFullscreen(!isFullscreen);
  };

  const resetZoom = () => {
      setTransform({ k: 1, x: 0, y: 0 });
      applyDirectTransform(1, 0, 0);
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
                <div 
                    ref={containerRef}
                    style={{ 
                        width: '100%', 
                        height: '100%', 
                        transformOrigin: '0 0',
                        cursor: transform.k > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                        willChange: 'transform',
                        // Initial transform set via effect
                    }}
                >
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
                                    metric={metric}
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
                <button onClick={resetZoom} className="absolute bottom-4 right-4 z-50 bg-[#dd9933] text-black px-3 py-1.5 rounded-lg shadow-xl font-bold text-xs flex items-center gap-2 hover:scale-105 transition-transform"><ZoomOut size={14} /> Reset Zoom</button>
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
