
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

    useEffect(() => {
        if (tooltipRef.current) {
            const rect = tooltipRef.current.getBoundingClientRect();
            const winW = window.innerWidth;
            const winH = window.innerHeight;
            
            let newTop = y + 10; 
            let newLeft = x + 10;

            if (newTop + rect.height > winH - 20) newTop = y - rect.height - 10;
            newTop = Math.max(10, newTop);
            if (newLeft + rect.width > winW - 20) newLeft = x - rect.width - 10;

            setPos({ top: newTop, left: newLeft });
        }
    }, [x, y]);

    if (!data) return null;
    const isPositive = (data.change || 0) >= 0;

    return createPortal(
        <div 
            ref={tooltipRef}
            className="fixed z-[9999] pointer-events-none animate-in fade-in zoom-in-95 duration-100"
            style={{ top: pos.top, left: pos.left, maxWidth: '240px' }} 
        >
            <div className="bg-white/95 dark:bg-[#121314]/95 backdrop-blur-xl border border-gray-200 dark:border-gray-700/50 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] overflow-hidden flex flex-col">
                <div className="bg-gray-50 dark:bg-white/5 p-2.5 flex items-center justify-between border-b border-gray-200 dark:border-white/5">
                    <div className="flex items-center gap-2.5">
                        {data.image && <img src={data.image} className="w-8 h-8 rounded-full border border-gray-200 dark:border-white/10 bg-white p-0.5" alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />}
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-black text-gray-900 dark:text-white leading-none truncate">{data.symbol}</span>
                                <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-white/10 px-1 py-0.5 rounded">#{data.rank}</span>
                            </div>
                            <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400 truncate max-w-[100px] block mt-0.5">{data.fullName}</span>
                        </div>
                    </div>
                    <div className="text-right whitespace-nowrap ml-2">
                        <div className="text-base font-mono font-bold text-gray-900 dark:text-white">{formatPrice(data.price)}</div>
                        <div className={`text-[10px] font-black ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {isPositive ? '+' : ''}{Number(data.change || 0).toFixed(2)}%
                        </div>
                    </div>
                </div>
                <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
                    <div className="flex flex-col"><span className="text-gray-500 font-bold uppercase tracking-wide">Mkt Cap</span><span className="font-mono font-medium text-gray-700 dark:text-gray-200 text-xs">{formatCompact(data.mcap)}</span></div>
                    <div className="flex flex-col text-right"><span className="text-gray-500 font-bold uppercase tracking-wide">Vol 24h</span><span className="font-mono font-medium text-[#dd9933] text-xs">{formatCompact(data.vol)}</span></div>
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
      metric,
      containerTransform = { k: 1, x: 0, y: 0 },
      containerSize = { w: 1000, h: 800 }
  } = props;
  
  if (!width || !height || width < 0 || height < 0 || !symbol) return null;

  // Culling optimization
  const hasValidSize = containerSize.w > 0 && containerSize.h > 0;
  let isVisible = true;
  if (hasValidSize) {
      const worldX = x * containerTransform.k + containerTransform.x;
      const worldY = y * containerTransform.k + containerTransform.y;
      const worldW = width * containerTransform.k;
      const worldH = height * containerTransform.k;
      const BUFFER = 1000;
      isVisible = (
          worldX + worldW > -BUFFER && 
          worldX < containerSize.w + BUFFER &&
          worldY + worldH > -BUFFER && 
          worldY < containerSize.h + BUFFER
      );
  }

  const color = getColorForChange(change || 0);

  // Border logic: At higher zooms, remove stroke completely to avoid gaps
  const strokeWidth = zoomLevel > 1.5 ? 0 : (1 / zoomLevel);
  // Dark mode stroke vs Light mode stroke (handled via JS since SVG props)
  const isDark = document.documentElement.classList.contains('dark');
  const strokeColor = isDark ? '#0f1011' : '#ffffff'; 
  
  if (!isVisible) {
      // Render simple rect placeholder for off-screen items to maintain layout integrity
      return <rect x={x} y={y} width={width} height={height} fill={color} stroke={strokeColor} strokeWidth={strokeWidth} />;
  }

  // Calculate visual size on screen
  const visualW = width * zoomLevel;
  const visualH = height * zoomLevel;

  // Rendering thresholds
  const isTiny = visualW < 20 || visualH < 15;
  const isSmall = visualW < 60 || visualH < 50;
  
  // Font sizes relative to box dimensions (Data Units)
  const minDim = Math.min(width, height);
  const logoSize = Math.min(minDim * 0.4, 60); 
  const symbolFontSize = Math.min(width * 0.25, height * 0.25, 30); 
  const priceFontSize = Math.min(width * 0.15, height * 0.15, 16);

  // Positioning
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const textGap = symbolFontSize * 0.2;
  const logoGap = logoSize * 0.1;
  
  // Total content height approximation
  let totalContentH = symbolFontSize;
  if (image && !isSmall) totalContentH += logoSize + logoGap;
  if (!isSmall) totalContentH += priceFontSize + textGap;
  
  // Start Y position (centered)
  let startY = centerY - totalContentH / 2 + symbolFontSize / 2;

  // Unique clip path ID for this cell
  const clipId = `clip-${symbol}-${x}-${y}`;

  const secondaryValue = metric === 'mcap' 
      ? formatPrice(price)
      : `${(change || 0) > 0 ? '+' : ''}${(change || 0).toFixed(2)}%`;

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
            <rect x={x} y={y} width={width} height={height} />
        </clipPath>
      </defs>

      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{ fill: color, stroke: strokeColor, strokeWidth: strokeWidth }}
        shapeRendering="crispEdges"
      />
      
      {/* Interactive Layer */}
      <rect x={x} y={y} width={width} height={height} style={{ fill: 'transparent', cursor: 'grab' }} onClick={onClick} onMouseEnter={onContentLeave} />

      {!isTiny && (
        <g clipPath={`url(#${clipId})`} style={{ pointerEvents: 'none' }}>
            
            {image && !isSmall && (
                <image
                    x={centerX - logoSize / 2}
                    y={startY}
                    width={logoSize}
                    height={logoSize}
                    href={image}
                    style={{ opacity: 0.9 }}
                />
            )}

            <text
                x={centerX}
                y={image && !isSmall ? startY + logoSize + logoGap + symbolFontSize * 0.8 : centerY + symbolFontSize * 0.3}
                textAnchor="middle"
                fill="#ffffff"
                style={{ 
                    fontSize: `${symbolFontSize}px`, 
                    fontWeight: 900, 
                    textShadow: '0px 1px 3px rgba(0,0,0,0.5)',
                    fontFamily: 'Inter, sans-serif'
                }}
            >
                {symbol}
            </text>

            {!isSmall && (
                <text
                    x={centerX}
                    y={startY + logoSize + logoGap + symbolFontSize + textGap + priceFontSize * 0.8}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.9)"
                    style={{ 
                        fontSize: `${priceFontSize}px`, 
                        fontWeight: 700,
                        textShadow: '0px 1px 2px rgba(0,0,0,0.5)',
                        fontFamily: 'JetBrains Mono, monospace'
                    }}
                >
                    {secondaryValue}
                </text>
            )}
        </g>
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
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number, y: number, ix: number, iy: number } | null>(null);
  const transformRef = useRef({ k: 1, x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 1000, h: 800 });

  const [tooltipState, setTooltipState] = useState<{ visible: boolean, data: any, x: number, y: number }>({ visible: false, data: null, x: 0, y: 0 });

  useEffect(() => {
      const updateSize = () => {
          if (containerRef.current) {
              setContainerSize({ w: containerRef.current.clientWidth, h: containerRef.current.clientHeight });
          }
      };
      updateSize();
      const ro = new ResizeObserver(entries => {
          for (let entry of entries) {
              setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height });
          }
      });
      if (containerRef.current) ro.observe(containerRef.current);
      return () => ro.disconnect();
  }, [loading]);

  const handleContentHover = useCallback((data: any, clientX: number, clientY: number) => {
      if (isDragging) return;
      setTooltipState({ visible: true, data: data, x: clientX, y: clientY });
  }, [isDragging]);

  const handleContentLeave = useCallback(() => {
      setTooltipState(prev => ({ ...prev, visible: false }));
  }, []);

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

  const resetZoom = () => { 
      setTransform({ k: 1, x: 0, y: 0 }); 
      applyDirectTransform(1, 0, 0); 
  };

  const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault(); e.stopPropagation();
      setTooltipState(prev => ({ ...prev, visible: false }));
      const sensitivity = 0.001;
      const delta = -e.deltaY * sensitivity;
      const oldK = transformRef.current.k;
      const newK = Math.min(Math.max(1, oldK + delta), 50); 
      if (newK === oldK || !containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const parentRect = containerRef.current.parentElement?.getBoundingClientRect() || rect;
      const mx = e.clientX - parentRect.left;
      const my = e.clientY - parentRect.top;
      const worldX = (mx - transformRef.current.x) / oldK;
      const worldY = (my - transformRef.current.y) / oldK;
      const newX = mx - worldX * newK;
      const newY = my - worldY * newK;
      
      applyDirectTransform(newK, newX, newY);
      setTransform({ k: newK, x: newX, y: newY });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      if (transformRef.current.k <= 1) return;
      e.preventDefault(); 
      setIsDragging(true);
      setTooltipState(prev => ({ ...prev, visible: false }));
      dragStart.current = { x: e.clientX, y: e.clientY, ix: transformRef.current.x, iy: transformRef.current.y };
      if (containerRef.current) { containerRef.current.style.cursor = 'grabbing'; containerRef.current.style.transition = 'none'; }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging || !dragStart.current) return;
      if (rafRef.current) return; 
      const cx = e.clientX; const cy = e.clientY;
      rafRef.current = requestAnimationFrame(() => {
          if (!dragStart.current) return;
          const dx = cx - dragStart.current.x;
          const dy = cy - dragStart.current.y;
          applyDirectTransform(transformRef.current.k, dragStart.current.ix + dx, dragStart.current.iy + dy);
          rafRef.current = null;
      });
  };

  const handleMouseUp = () => {
      if (!isDragging) return;
      setIsDragging(false); dragStart.current = null;
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      if (containerRef.current) { containerRef.current.style.cursor = 'grab'; containerRef.current.style.transition = 'transform 0.1s ease-out'; }
      setTransform({ ...transformRef.current });
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError('');
      try {
        const response = await fetchWithFallback('/cachecko/cachecko_lite.json');
        let rawList: any[] = [];
        if (Array.isArray(response)) rawList = (response[0]?.data && Array.isArray(response[0].data)) ? response[0].data : response;
        else if (response?.data && Array.isArray(response.data)) rawList = response.data;

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
                  });
              }
          });
          const mapped = Array.from(uniqueMap.values()).filter(c => c.mcap > 0);
          setData(mapped);
          
          if (mapped.length > 0) {
              mapped.slice(0, 100).forEach(coin => { if (coin.image) { const img = new Image(); img.src = coin.image; } });
          }
        } else setError('Sem dados.');
      } catch (e) { setError('Erro ao carregar.'); } finally { setLoading(false); }
    };
    load();
  }, [refreshKey]);

  const treeData = useMemo(() => {
    if (!data.length) return [];
    const limit = 1000;
    const sorted = [...data].sort((a, b) => b.mcap - a.mcap).slice(0, limit);

    const leaves = sorted.map((coin, index) => {
        let sizeValue = coin.mcap;
        
        if (metric === 'change') {
            const absChange = Math.abs(coin.change);
            const cappedChange = Math.min(absChange, 8);
            sizeValue = Math.pow(cappedChange + 3, 2) * 100; 
        }

        return { ...coin, size: sizeValue, rank: index + 1 };
    });

    return [{ name: 'Market', children: leaves }];
  }, [data, metric]);

  const toggleFullscreen = () => { if (item?.isMaximized && onClose) onClose(); else setIsFullscreen(!isFullscreen); };

  const renderContent = () => (
    <div className="flex flex-col w-full h-full bg-white dark:bg-[#1a1c1e] text-gray-900 dark:text-white overflow-hidden relative font-sans transition-colors">
        {tooltipState.visible && tooltipState.data && <ManualTooltip data={tooltipState.data} x={tooltipState.x} y={tooltipState.y} />}

        <div className="flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-[#1a1c1e] border-b border-gray-100 dark:border-gray-800 shrink-0 z-10 shadow-sm dark:shadow-none">
            <div className="flex items-center gap-4">
                <span className="text-sm font-black uppercase tracking-wider hidden sm:inline text-gray-500 dark:text-gray-300">{title}</span>
                {!loading && !error && (
                    <div className="flex bg-gray-200 dark:bg-black/40 p-0.5 rounded-lg border border-gray-300 dark:border-gray-700">
                        <button onClick={() => { setMetric('mcap'); resetZoom(); }} className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded flex items-center gap-1.5 transition-all ${metric === 'mcap' ? 'bg-white dark:bg-[#dd9933] text-gray-900 dark:text-black shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}><PieChart size={12} /> MarketCap</button>
                        <button onClick={() => { setMetric('change'); resetZoom(); }} className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded flex items-center gap-1.5 transition-all ${metric === 'change' ? 'bg-white dark:bg-[#dd9933] text-gray-900 dark:text-black shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}><BarChart2 size={12} /> Variação 24h</button>
                    </div>
                )}
            </div>
            
            <div className="flex items-center gap-2">
                {/* Reset Zoom Button in Header */}
                {transform.k > 1 && (
                    <button onClick={resetZoom} className="p-1.5 bg-[#dd9933]/20 hover:bg-[#dd9933] rounded text-[#dd9933] hover:text-black transition-colors" title="Reset Zoom">
                        <ZoomOut size={14} />
                    </button>
                )}
                
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800/50 rounded text-[10px] font-bold text-gray-500 dark:text-gray-400"><Layers size={12} />{data.length > 0 ? `Top 1000` : '0 moedas'}</div>
                <button onClick={() => setRefreshKey(k => k + 1)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
                <button onClick={toggleFullscreen} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">{isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
            </div>
        </div>

        <div className="flex-1 w-full min-h-0 relative bg-white dark:bg-[#0f1011] overflow-hidden" 
             onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
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
                        willChange: isDragging ? 'transform' : 'auto' 
                    }}
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <Treemap
                            data={treeData}
                            dataKey="size"
                            stroke="transparent" 
                            fill="transparent"
                            content={
                                <CustomTreemapContent 
                                    zoomLevel={transform.k}
                                    onContentHover={handleContentHover}
                                    onContentLeave={handleContentLeave}
                                    metric={metric}
                                    containerTransform={transform}
                                    containerSize={containerSize}
                                />
                            }
                            animationDuration={600}
                            aspectRatio={1.6} 
                            isAnimationActive={false}
                        />
                    </ResponsiveContainer>
                </div>
            )}
        </div>
        
        <div className="h-8 bg-gray-50 dark:bg-[#121416] border-t border-gray-100 dark:border-gray-800 flex items-center justify-center gap-1 px-4 shrink-0 overflow-hidden z-20">
            <span className="text-[9px] text-gray-500 font-bold mr-2">-20%</span>
            <div className="w-8 h-3 bg-[#b93c3c] rounded-sm" title="<= -20%"></div>
            <div className="w-8 h-3 bg-[#e0524e] rounded-sm" title="-7% to -20%"></div>
            <div className="w-8 h-3 bg-[#ff6961] rounded-sm" title="0% to -7% (User Red)"></div>
            <div className="w-6 h-3 bg-[#2d3748] rounded-sm border border-gray-300 dark:border-gray-700 mx-2" title="0% (Neutral)"></div>
            <div className="w-8 h-3 bg-[#548F3F] rounded-sm" title="0% to +7% (User Green)"></div>
            <div className="w-8 h-3 bg-[#467a33] rounded-sm" title="+7% to +20%"></div>
            <div className="w-8 h-3 bg-[#345e2a] rounded-sm" title=">= +20%"></div>
            <span className="text-[9px] text-gray-500 font-bold ml-2">+20%</span>
        </div>
    </div>
  );

  if (isFullscreen) {
    return createPortal(<div className="fixed inset-0 z-[9999] w-screen h-screen bg-white dark:bg-[#1a1c1e]">{renderContent()}</div>, document.body);
  }

  return (
    <div className="w-full h-full overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 shadow-xl bg-white dark:bg-[#1a1c1e]">{renderContent()}</div>
  );
};

export default HeatmapWidget;
