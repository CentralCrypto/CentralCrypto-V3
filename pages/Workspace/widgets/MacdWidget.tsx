
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, Info, Search, ChevronLeft, ChevronRight, BarChart2, DollarSign, Percent, ZoomOut, MousePointer2, GripVertical, ChevronsUpDown, ChevronDown } from 'lucide-react';
import Highcharts from 'highcharts';
import addMouseWheelZoom from 'highcharts/modules/mouse-wheel-zoom';
import { Language, DashboardItem } from '../../../types';
import { getTranslations } from '../../../locales';
import {
  MacdAvgData,
  MacdTrackerPoint,
  fetchMacdAverage,
  fetchMacdTracker,
  fetchMacdTablePage
} from '../services/api';

// DND Kit Imports for Table
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Inicializa o módulo de zoom com proteção
if (typeof addMouseWheelZoom === 'function') {
    addMouseWheelZoom(Highcharts);
}

const TIMEFRAMES = ['15m', '1h', '4h', '24h', '7d'] as const;
type Timeframe = typeof TIMEFRAMES[number];
type XAxisMode = 'mcap' | 'change';

const formatCompactNumber = (number: number) => {
  if (!number || number === 0) return "---";
  if (number < 1000) return number.toString();
  const suffixes = ["", "K", "M", "B", "T"];
  const suffixNum = Math.floor(("" + Math.floor(number)).length / 3);
  let shortValue = parseFloat((number / Math.pow(1000, suffixNum)).toPrecision(3));
  if (shortValue % 1 !== 0) shortValue = parseFloat(shortValue.toFixed(2));
  return shortValue + suffixes[suffixNum];
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const getMacdColor = (val: number, isText = false) => {
  if (val === null || val === undefined || Number.isNaN(val)) return isText ? 'text-gray-400' : '';
  if (val > 0) return isText ? 'text-green-500 font-bold' : 'bg-green-500/20 text-green-500';
  if (val < 0) return isText ? 'text-red-500 font-bold' : 'bg-red-500/20 text-red-500';
  return isText ? 'text-gray-700 dark:text-slate-300' : 'text-gray-700 dark:text-slate-300';
};

const useIsDark = () => {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
};

// --- COMPONENTS FOR LEFT SIDEBAR ---

// Sidebar Gauge (MACD Specific - Adjusted Geometry)
const MacdGauge: React.FC<{ bullishPct: number, avgNMacd: number }> = ({ bullishPct, avgNMacd }) => {
    const rotation = -90 + (clamp(bullishPct, 0, 100) / 100) * 180;
    const label = avgNMacd > 0.5 ? "Strong Buy" : avgNMacd > 0 ? "Buy" : avgNMacd < -0.5 ? "Strong Sell" : "Sell";
    
    // Geometry Optimization: Center Y raised to 80 (was 95)
    return (
        <div className="flex flex-col items-center justify-center h-full py-2">
            <div className="relative w-full max-w-[240px] -mt-2">
                <svg viewBox="0 0 200 100" className="w-full overflow-visible">
                    <defs>
                        <linearGradient id="macdSidebarGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#ef4444" />
                            <stop offset="50%" stopColor="#fbbf24" />
                            <stop offset="100%" stopColor="#22c55e" />
                        </linearGradient>
                    </defs>
                    <path d="M 15 80 A 85 85 0 0 1 185 80" fill="none" className="stroke-[#eeeeee] dark:stroke-[#333]" strokeWidth="16" strokeLinecap="round"/>
                    <path d="M 15 80 A 85 85 0 0 1 185 80" fill="none" stroke="url(#macdSidebarGrad)" strokeWidth="16" strokeDasharray={`${(bullishPct/100)*267} 267`} strokeLinecap="round" />
                    <g transform={`rotate(${rotation} 100 80)`}>
                        <path d="M 100 80 L 100 10" className="stroke-gray-800 dark:stroke-white" strokeWidth="4" /><circle cx={100} cy={80} r="5" className="fill-gray-800 dark:fill-white" />
                    </g>
                </svg>
            </div>
            {/* Added more margin-top (mt-5) for requested spacing */}
            <div className="flex flex-col items-center mt-5 z-10">
                <div className="text-3xl font-black text-[#dd9933] leading-none font-mono tracking-tighter">{avgNMacd.toFixed(2)}</div>
                <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mt-1 tracking-widest">Avg Normalized MACD</div>
                <div className={`text-xs font-black uppercase mt-1 ${avgNMacd > 0 ? 'text-green-500' : 'text-red-500'}`}>{label}</div>
            </div>
        </div>
    );
};

// 1. Left Sidebar Container
export const MacdSidebar: React.FC<{ language?: Language }> = ({ language = 'pt' }) => {
  const [avgData, setAvgData] = useState<MacdAvgData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMacdAverage().then((avg) => {
        setAvgData(avg);
        setLoading(false);
    });
  }, []);

  if (loading || !avgData) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

  const bullishPct = avgData.bullishPercentage || 50;
  const bearishPct = avgData.bearishPercentage || 50;

  return (
    <div className="flex flex-col gap-3 h-full">
        {/* Box 1: Gauge */}
        <div className="flex-1 bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-center mb-1 shrink-0">
                <h3 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider">Global Trend (Bullish %)</h3>
                <Info size={14} className="text-slate-400" />
            </div>
            <MacdGauge bullishPct={bullishPct} avgNMacd={avgData.averageNMacd} />
        </div>

        {/* Box 2: Market State Bar */}
        <div className="shrink-0 bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider">Market Breath</h3>
            </div>
            <div className="flex justify-between text-[9px] font-black uppercase mb-1.5 opacity-80">
                <span className="text-red-500">Bearish {bearishPct.toFixed(1)}%</span>
                <span className="text-green-500">Bullish {bullishPct.toFixed(1)}%</span>
            </div>
            <div className="w-full h-3 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden flex relative border border-gray-200 dark:border-slate-700">
                <div className="h-full bg-red-500" style={{ width: `${bearishPct}%` }}></div>
                <div className="h-full bg-green-500 flex-1"></div>
            </div>
        </div>

        {/* Box 3: Historical */}
        <div className="shrink-0 bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider">Histórico (N-MACD)</h3>
            </div>
            <div className="space-y-1.5">
                {[
                    { l: 'Ontem', v: avgData?.yesterdayNMacd },
                    // Using normalized history if available, fallback to regular
                    { l: '7 Dias', v: avgData?.days7Ago > 100 ? avgData?.days7Ago / 1000 : avgData?.days7Ago },
                    { l: '30 Dias', v: avgData?.days30Ago > 100 ? avgData?.days30Ago / 1000 : avgData?.days30Ago }
                ].map((h, i) => (
                    <div key={i} className="flex justify-between items-center bg-gray-50 dark:bg-white/5 p-1.5 rounded px-3">
                        <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase">{h.l}</span>
                        <span className={`text-xs font-black font-mono ${getMacdColor(h.v || 0, true)}`}>
                            {h.v ? h.v.toFixed(3) : '-'}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

// 2. Scatter Chart (MACD Normalized vs Market Cap/Change)
export const MacdScatterChart: React.FC = () => {
  const isDark = useIsDark();
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<Highcharts.Chart | null>(null);
  
  const [points, setPoints] = useState<MacdTrackerPoint[]>([]);
  
  // Controls
  const [timeframe, setTimeframe] = useState<Timeframe>('4h');
  const [xMode, setXMode] = useState<XAxisMode>('mcap');

  useEffect(() => {
      fetchMacdTracker().then(data => {
          if (data && data.length > 0) setPoints(data);
      });
  }, []);

  const resetZoom = () => {
      if (chartInstance.current) {
          chartInstance.current.zoomOut();
      }
  };

  useEffect(() => {
    if (!chartRef.current || points.length === 0) return;

    const bgColor = 'transparent';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';
    const crosshairColor = isDark ? '#64748b' : '#94a3b8'; 

    const seriesData = points
        .filter(r => r.marketCap && r.marketCap > 0 && r.macd?.[timeframe])
        .map(r => {
            let xVal = 0;
            if (xMode === 'mcap') xVal = r.marketCap || 0;
            else xVal = r.change24h || 0;

            const macdData = r.macd?.[timeframe];
            const yVal = macdData?.nmacd || 0; // Use NORMALIZED MACD
            const isBullish = yVal > 0;
            const symbolShort = r.symbol.substring(0, 3).toUpperCase();

            // Generate fallback SVG for this point
            const fallbackSVG = `data:image/svg+xml;base64,${btoa(`
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="12" fill="#334155"/>
                    <text x="50%" y="50%" dy=".35em" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="bold" font-size="8px">${symbolShort}</text>
                </svg>
            `)}`;
            
            // Standardize Logo URL to avoid errors
            const logoUrl = r.logo || `https://assets.coincap.io/assets/icons/${r.symbol.toLowerCase()}@2x.png`;

            return {
                x: xVal,
                y: yVal,
                z: r.marketCap,
                name: r.symbol,
                fullName: r.name,
                price: r.price,
                change: r.change24h,
                isBullish: isBullish,
                logoUrl: logoUrl,
                fallbackSVG: fallbackSVG
            };
        });

    const xAxisType = xMode === 'change' ? 'linear' : 'logarithmic';
    const xTitle = xMode === 'mcap' ? 'Market Cap (Log)' : 'Variação 24h (%)';

    const xPlotLines = xMode === 'change' ? [{
        value: 0,
        color: textColor,
        width: 1,
        dashStyle: 'Dash',
        zIndex: 2
    }] : [];

    chartInstance.current = Highcharts.chart(chartRef.current, {
        chart: {
            type: 'scatter',
            backgroundColor: bgColor,
            style: { fontFamily: 'Inter, sans-serif' },
            height: null, 
            zooming: {
                mouseWheel: { enabled: true },
                type: 'xy'
            },
            events: {
                // Resize logic
                render: function() {
                    const chart = this;
                    if (!chart.xAxis[0].dataMin || !chart.xAxis[0].dataMax) return;
                    const xExtremes = chart.xAxis[0].getExtremes();
                    const dataRange = chart.xAxis[0].dataMax - chart.xAxis[0].dataMin;
                    const viewRange = xExtremes.max - xExtremes.min;
                    let zoomFactor = Math.min(Math.max(dataRange / viewRange, 1), 3);
                    let newSize = 24 + (zoomFactor - 1) * 8; 
                    newSize = Math.min(newSize, 48);

                    const currentSize = chart.series[0].options.marker?.width;
                    if (currentSize && Math.abs(currentSize - newSize) > 2) {
                        chart.series[0].update({
                            marker: { width: newSize, height: newSize },
                            dataLabels: { x: (newSize / 2) + 2, y: 0 } 
                        }, true, false);
                    }
                }
            }
        },
        title: { text: null },
        credits: { enabled: false },
        legend: { enabled: false },
        xAxis: {
            type: xAxisType,
            reversed: xMode === 'mcap', 
            title: { text: xTitle, style: { color: textColor, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' } },
            gridLineColor: gridColor,
            labels: {
                style: { color: textColor, fontSize: '10px' },
                formatter: function (this: any) { 
                    if (xMode === 'change') return this.value + '%';
                    return '$' + formatCompactNumber(this.value); 
                }
            },
            lineColor: gridColor,
            tickColor: gridColor,
            plotLines: xPlotLines,
            crosshair: { width: 1, color: crosshairColor, dashStyle: 'Dot', snap: false, zIndex: 5 }
        },
        yAxis: {
            title: { text: 'Normalized MACD', style: { color: textColor, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' } },
            gridLineColor: gridColor,
            gridLineDashStyle: 'Dash',
            labels: { style: { color: textColor, fontSize: '10px' } },
            plotLines: [
                { value: 0, color: textColor, width: 2, zIndex: 5 }
            ],
            crosshair: { width: 1, color: crosshairColor, dashStyle: 'Dot', snap: false, zIndex: 5 }
        },
        tooltip: {
            useHTML: true,
            backgroundColor: isDark ? 'rgba(26, 28, 30, 0.98)' : 'rgba(255, 255, 255, 0.98)',
            borderColor: gridColor,
            borderRadius: 8,
            style: { 
                color: isDark ? '#fff' : '#000',
                zIndex: 9999 
            },
            outside: true, 
            formatter: function (this: any) {
                const p = this.point;
                return `
                    <div style="display:flex; align-items:center; gap:8px; min-width:140px; padding: 4px; z-index:9999;">
                        <div style="font-weight:900; font-size:14px;">${p.name}</div>
                    </div>
                    <div style="font-size:12px; opacity:0.7; margin-bottom:4px;">$${formatCompactNumber(p.options.price)}</div>
                    <div style="margin-top:4px; font-size:12px;">
                        <span style="opacity:0.7;">N-MACD (${timeframe}):</span> <b>${p.y.toFixed(4)}</b>
                    </div>
                    <div style="font-size:12px;">
                        <span style="opacity:0.7;">Var 24h:</span> <b style="color:${p.options.change >= 0 ? '#4ade80' : '#f87171'}">${p.options.change.toFixed(2)}%</b>
                    </div>
                `;
            }
        },
        plotOptions: {
            scatter: {
                marker: {
                    radius: 12, // Hit area
                    fillColor: 'rgba(0,0,0,0)',
                    lineWidth: 0,
                    states: { hover: { enabled: false } }
                },
                dataLabels: {
                    enabled: true,
                    useHTML: true,
                    allowOverlap: true,
                    // Center the custom HTML on the point coordinates
                    y: -12,
                    x: -12,
                    formatter: function (this: any) {
                        const p = this.point;
                        const isBullish = p.options.isBullish;
                        const color = isBullish ? '#4ade80' : '#f87171';
                        const symbol = isBullish ? '▲' : '▼'; 
                        const logo = p.options.logoUrl;
                        const fallback = p.options.fallbackSVG;

                        // HTML Structure: Image with onError fallback + Absolute positioned Triangle
                        // Adjusted position: right -4px, bottom -2px as requested
                        return `
                        <div style="position: relative; width: 24px; height: 24px;">
                            <img src="${logo}" 
                                 style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; background: #334155;" 
                                 onerror="this.onerror=null; this.src='${fallback}';" 
                            />
                            <div style="position: absolute; right: -4px; bottom: -2px; color: ${color}; font-size: 10px; font-weight: bold; text-shadow: 0px 1px 2px rgba(0,0,0,0.8); line-height: 1;">
                                ${symbol}
                            </div>
                        </div>`;
                    },
                    style: { textOutline: 'none' }
                }
            }
        },
        series: [{
            name: 'Coins',
            data: seriesData,
            color: 'rgba(156, 163, 175, 0.5)'
        }]
    } as any);

  }, [points, timeframe, xMode, isDark]);

  return (
    <div className="bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-4 h-full flex flex-col relative overflow-hidden">
        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.05] z-0">
            <img src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" alt="watermark" className="w-1/2 h-auto grayscale filter" />
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 z-10 relative">
            <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900 dark:text-white uppercase text-sm tracking-wider">MACD Scatter Map</h3>
                <div className="flex bg-gray-100 dark:bg-[#2f3032] rounded p-0.5 ml-2">
                    {TIMEFRAMES.map(t => (
                        <button 
                            key={t}
                            onClick={() => setTimeframe(t)}
                            className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${timeframe === t ? 'bg-white dark:bg-[#1a1c1e] text-[#dd9933] shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button onClick={resetZoom} className="p-1.5 bg-gray-100 dark:bg-[#2f3032] hover:bg-gray-200 dark:hover:bg-white/10 rounded text-gray-500 hover:text-[#dd9933] transition-colors" title="Reset Zoom">
                    <ZoomOut size={16} />
                </button>
                <div className="w-px h-4 bg-gray-200 dark:bg-white/10 mx-1"></div>
                <div className="flex bg-gray-100 dark:bg-[#2f3032] rounded p-0.5">
                    <button onClick={() => setXMode('mcap')} className={`px-2 py-1 text-[10px] font-bold rounded flex items-center gap-1 ${xMode === 'mcap' ? 'bg-white dark:bg-[#1a1c1e] text-[#dd9933] shadow-sm' : 'text-gray-500'}`}>
                        <DollarSign size={10} /> MC
                    </button>
                    <button onClick={() => setXMode('change')} className={`px-2 py-1 text-[10px] font-bold rounded flex items-center gap-1 ${xMode === 'change' ? 'bg-white dark:bg-[#1a1c1e] text-[#dd9933] shadow-sm' : 'text-gray-500'}`}>
                        <Percent size={10} /> 24h
                    </button>
                </div>
            </div>
        </div>
        
        <div className="flex-1 w-full min-h-0 relative rounded-lg overflow-hidden border border-gray-100 dark:border-slate-800/50 z-10">
            {points.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500"><Loader2 className="animate-spin" /></div>
            ) : (
                <div ref={chartRef} className="absolute inset-0" />
            )}
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-white/80 dark:bg-black/60 backdrop-blur rounded text-[9px] font-bold text-gray-500 pointer-events-none">
                <MousePointer2 size={10} /> Scroll to Zoom
            </div>
        </div>
    </div>
  );
};

// 3. Table List (Updated for MACD data with Fallback Images)
// Column IDs
const COLS = {
    asset: { id: 'asset', label: 'Ativo' },
    price: { id: 'price', label: 'Preço' },
    mcap: { id: 'mcap', label: 'Mkt Cap' },
    macd15m: { id: 'macd15m', label: '15m' },
    macd1h: { id: 'macd1h', label: '1h' },
    macd4h: { id: 'macd4h', label: '4h' },
    macd24h: { id: 'macd24h', label: '24h' },
    macd7d: { id: 'macd7d', label: '7d' },
};

const SortableTh = ({ colId, label, sortKey, activeKey, onSort }: any) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: colId });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 100 : 'auto',
    };

    return (
        <th ref={setNodeRef} style={style} className={`p-3 text-center bg-gray-100 dark:bg-[#2f3032] cursor-pointer group select-none ${colId === 'asset' ? 'text-left' : 'text-center'}`} onClick={() => onSort(sortKey)}>
            <div className={`flex items-center gap-1 ${colId === 'asset' ? 'justify-start' : 'justify-center'}`}>
                <span className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`} {...attributes} {...listeners} onClick={e => e.stopPropagation()}>
                    <GripVertical size={12} className="text-gray-400" />
                </span>
                <span className="text-[10px] uppercase font-black text-gray-500 dark:text-slate-400">{label}</span>
                <ChevronsUpDown size={12} className={`text-gray-400 transition-colors ${activeKey === sortKey ? 'text-[#dd9933]' : 'opacity-0 group-hover:opacity-100'}`} />
            </div>
        </th>
    );
};

export const MacdTableList: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MacdTrackerPoint[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  
  // Sort State
  const [sortKey, setSortKey] = useState('nmacd');
  const [sortTf, setSortTf] = useState<Timeframe>('4h');
  const [sortAsc, setSortAsc] = useState(false);

  // Column Order State
  const [colOrder, setColOrder] = useState<string[]>([
      'asset', 'price', 'mcap', 'macd15m', 'macd1h', 'macd4h', 'macd24h', 'macd7d'
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchMacdTablePage({
      page,
      limit: pageSize,
      sort: sortKey as any,
      timeframe: sortTf,
      ascendingOrder: sortAsc,
      filterText: search
    }).then(res => {
        if(!mounted) return;
        setRows(res.items);
        setTotalPages(res.totalPages);
        setLoading(false);
    });
    return () => { mounted = false; };
  }, [page, pageSize, search, sortKey, sortTf, sortAsc]);

  const handleSort = (key: string) => {
      // Determine TF based on key if it is a macd column
      let tf: Timeframe = '4h';
      if (key.includes('15m')) tf = '15m';
      else if (key.includes('1h')) tf = '1h';
      else if (key.includes('4h')) tf = '4h';
      else if (key.includes('24h')) tf = '24h';
      else if (key.includes('7d')) tf = '7d';

      // Determine Sort Key (nmacd, marketCap, change)
      let sk = 'nmacd';
      if (key === 'mcap') sk = 'marketCap';
      else if (key === 'price') sk = 'change24h'; // use change for price sort proxy or implement price sort

      if (sortKey === sk && sortTf === tf) {
          setSortAsc(!sortAsc);
      } else {
          setSortKey(sk);
          setSortTf(tf);
          setSortAsc(false); 
      }
  };

  const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
          setColOrder((items) => {
              const oldIndex = items.indexOf(active.id as string);
              const newIndex = items.indexOf(over.id as string);
              return arrayMove(items, oldIndex, newIndex);
          });
      }
  };

  // Helper to render cell based on col ID
  const renderCell = (r: MacdTrackerPoint, colId: string) => {
      // Fallback logo logic
      const logoUrl = r.logo || `https://assets.coincap.io/assets/icons/${r.symbol.toLowerCase()}@2x.png`;

      switch (colId) {
          case 'asset': return (
              <td key={colId} className="p-3">
                  <div className="flex items-center gap-3">
                      <img 
                          src={logoUrl} 
                          className="w-6 h-6 rounded-full bg-white p-0.5 border border-gray-200 dark:border-white/10" 
                          alt="" 
                          onError={(e) => {
                                // Fallback to circle div with first char
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                    e.currentTarget.style.display = 'none';
                                    const fallback = document.createElement('div');
                                    fallback.className = "w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-gray-500 dark:text-gray-300";
                                    fallback.innerText = r.symbol.charAt(0).toUpperCase();
                                    parent.prepend(fallback);
                                }
                           }} 
                      />
                      <div className="flex flex-col">
                          <span className="font-bold text-gray-900 dark:text-slate-200 leading-none">{r.name}</span>
                          <span className="text-[10px] font-bold text-gray-500 uppercase">{r.symbol}</span>
                      </div>
                  </div>
              </td>
          );
          case 'price': return (
              <td key={colId} className="p-3 text-center font-mono font-bold text-gray-700 dark:text-slate-300">
                  ${r.price < 1 ? r.price.toFixed(5) : r.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </td>
          );
          case 'mcap': return <td key={colId} className="p-3 text-center font-mono text-gray-500 dark:text-slate-400 text-xs">${formatCompactNumber(r.marketCap || 0)}</td>;
          
          // MACD Columns (Normalized Value) - SAFE ACCESSORS
          case 'macd15m': return <td key={colId} className={`p-3 text-center font-mono font-bold ${getMacdColor(r.macd?.["15m"]?.nmacd, true)}`}>{r.macd?.["15m"]?.nmacd?.toFixed(3)}</td>;
          case 'macd1h': return <td key={colId} className={`p-3 text-center font-mono font-bold ${getMacdColor(r.macd?.["1h"]?.nmacd, true)}`}>{r.macd?.["1h"]?.nmacd?.toFixed(3)}</td>;
          case 'macd4h': return <td key={colId} className={`p-3 text-center font-mono font-bold bg-gray-50 dark:bg-white/5 ${getMacdColor(r.macd?.["4h"]?.nmacd, true)}`}>{r.macd?.["4h"]?.nmacd?.toFixed(3)}</td>;
          case 'macd24h': return <td key={colId} className={`p-3 text-center font-mono font-bold ${getMacdColor(r.macd?.["24h"]?.nmacd, true)}`}>{r.macd?.["24h"]?.nmacd?.toFixed(3)}</td>;
          case 'macd7d': return <td key={colId} className={`p-3 text-center font-mono font-bold ${getMacdColor(r.macd?.["7d"]?.nmacd, true)}`}>{r.macd?.["7d"]?.nmacd?.toFixed(3)}</td>;
          default: return <td key={colId}></td>;
      }
  };

  // Map sort keys 
  const sortKeyMap: Record<string, string> = {
      asset: 'mcap', price: 'price', mcap: 'mcap',
      macd15m: 'macd15m', macd1h: 'macd1h', macd4h: 'macd4h', macd24h: 'macd24h', macd7d: 'macd7d'
  };

  return (
      <div className="bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden h-full min-h-[500px]">
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 bg-gray-50 dark:bg-black/20">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wider">Dados Detalhados</h3>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-2 bg-white dark:bg-[#2f3032] border border-gray-200 dark:border-slate-700 rounded px-2 py-1.5">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Linhas:</span>
                    <select 
                        value={pageSize}
                        onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                        className="bg-transparent text-xs font-bold outline-none text-gray-900 dark:text-white"
                    >
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </div>

                <div className="relative flex-1 sm:w-64">
                    <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                    <input 
                        type="text" 
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Buscar ativo..." 
                        className="w-full bg-white dark:bg-[#2f3032] border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-slate-200 text-xs py-2 pl-9 pr-3 rounded focus:border-[#dd9933] outline-none transition-colors"
                    />
                </div>
            </div>
        </div>
        
        <div className="flex-1 overflow-auto custom-scrollbar">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-gray-100 dark:bg-[#2f3032] border-b border-gray-200 dark:border-slate-800">
                            <SortableContext items={colOrder} strategy={horizontalListSortingStrategy}>
                                {colOrder.map(colId => (
                                    <SortableTh 
                                        key={colId} 
                                        colId={colId} 
                                        label={COLS[colId as keyof typeof COLS].label} 
                                        sortKey={sortKeyMap[colId]} 
                                        activeKey={sortTf === (colId.replace('macd','') as any) ? colId : ''} // basic active highlight logic
                                        onSort={handleSort} 
                                    />
                                ))}
                            </SortableContext>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-sm">
                        {loading ? (
                            <tr><td colSpan={colOrder.length} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-[#dd9933]" /></td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={colOrder.length} className="p-10 text-center text-gray-500">Sem dados</td></tr>
                        ) : rows.map((r) => (
                            <tr key={r.symbol} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                {colOrder.map(colId => renderCell(r, colId))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </DndContext>
        </div>

        <div className="p-3 border-t border-gray-200 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-[#2f3032]">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 hover:bg-white dark:hover:bg-white/10 rounded disabled:opacity-50 text-gray-600 dark:text-white transition-colors border border-transparent hover:border-gray-200 dark:hover:border-slate-700"><ChevronLeft size={16}/></button>
            <span className="text-xs font-bold text-gray-500 dark:text-slate-400">Página {page} de {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 hover:bg-white dark:hover:bg-white/10 rounded disabled:opacity-50 text-gray-600 dark:text-white transition-colors border border-transparent hover:border-gray-200 dark:hover:border-slate-700"><ChevronRight size={16}/></button>
        </div>
      </div>
  );
};

// 4. FAQ Component
export const MacdFaq: React.FC = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    
    const items = [
        { q: "O que é o Rastreador MACD?", a: "É um sistema que normaliza os valores do MACD para comparar centenas de criptomoedas em uma única escala (-1 a +1 normalmente), independente do preço do ativo." },
        { q: "Como interpretar o gráfico Scatter?", a: "O eixo X mostra o Market Cap (tamanho do ativo) e o eixo Y mostra o MACD Normalizado. Pontos acima da linha zero (verdes) estão em tendência de alta; abaixo (vermelhos), em baixa." },
        { q: "O que é N-MACD (Normalized)?", a: "É o valor do histograma MACD dividido pelo preço do ativo ou normalizado estatisticamente. Isso permite comparar se o Bitcoin (preço alto) está mais esticado que uma memecoin (preço baixo)." },
        { q: "Para que serve a Média Global?", a: "Ela soma o sentimento de todos os ativos monitorados. Se a média está muito alta, o mercado todo pode estar sobrecomprado. Se muito baixa, pode indicar um fundo de mercado." }
    ];

    return (
        <div className="max-w-4xl mx-auto mt-8">
            <h3 className="text-xl font-black text-gray-800 dark:text-[#dd9933] uppercase tracking-widest text-center mb-6">Entendendo o MACD Tracker</h3>
            <div className="space-y-3">
                {items.map((item, i) => (
                    <div key={i} className="bg-white dark:bg-[#1a1c1e] border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-all">
                        <button
                            onClick={() => setOpenIndex(openIndex === i ? null : i)}
                            className="w-full flex items-center justify-between p-4 text-left group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                        >
                            <span className={`font-bold text-sm ${openIndex === i ? 'text-[#dd9933]' : 'text-gray-700 dark:text-gray-300'}`}>{item.q}</span>
                            <ChevronDown size={16} className={`text-gray-400 transition-transform duration-300 ${openIndex === i ? 'rotate-180 text-[#dd9933]' : ''}`} />
                        </button>
                        <div className={`transition-all duration-300 ease-in-out ${openIndex === i ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                            <div className="p-4 pt-0 text-sm text-gray-600 dark:text-slate-400 leading-relaxed border-t border-transparent dark:border-white/5">
                                {item.a}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Default Widget Export
const MacdWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
    // Reuse the Gauge Logic for the widget
    const [avgData, setAvgData] = useState<MacdAvgData | null>(null);
    const [loading, setLoading] = useState(true);
    const t = getTranslations(language as Language).dashboard.widgets.macd;
    const tTime = getTranslations(language as Language).dashboard.widgets.time;

    useEffect(() => {
        setLoading(true);
        fetchMacdAverage().then(data => {
            if(data) setAvgData(data);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const Watermark = () => <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-[0.05] z-0"><img src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" alt="watermark" className="w-3/4 h-auto grayscale filter" /></div>;

    if (loading) return <div className="flex items-center justify-center h-full text-gray-400 dark:text-slate-500"><Loader2 className="animate-spin" /></div>;

    const macdVal = avgData?.averageNMacd ?? 0;
    const macdLabel = macdVal > 0.5 ? "Strong Buy" : macdVal > 0 ? "Buy" : macdVal < -0.5 ? "Strong Sell" : "Sell";
    
    // Scale for widget gauge: arbitrary scaling since N-MACD can vary. 
    // Assuming typical range -2 to +2
    const rotation = -90 + (Math.min(Math.max((macdVal + 2) / 4, 0), 1) * 180);

    if (item.isMaximized) {
        return (
            <div className="h-full w-full bg-white dark:bg-[#1a1c1e] p-2">
               <MacdScatterChart />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col justify-center gap-1 p-2 relative text-center bg-white dark:bg-[#2f3032]">
            <Watermark />
            <div className="flex items-center justify-center relative mt-3 z-10">
                <svg viewBox="0 0 200 110" className="w-[85%] max-w-[280px]">
                    <defs>
                        <linearGradient id="macdGaugeGradWidget" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#ef4444" />
                            <stop offset="50%" stopColor="#fbbf24" />
                            <stop offset="100%" stopColor="#22c55e" />
                        </linearGradient>
                    </defs>
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" className="stroke-[#eeeeee] dark:stroke-[#333]" strokeWidth="18" strokeLinecap="round"/>
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#macdGaugeGradWidget)" strokeWidth="18" strokeDasharray={`${((Math.min(Math.max((macdVal + 2) / 4, 0), 1)))*251} 251`} strokeLinecap="round" />
                    <g transform={`rotate(${rotation} 100 100)`}>
                        <path d="M 100 100 L 100 35" className="stroke-gray-800 dark:stroke-white" strokeWidth="3" /><circle cx={100} cy={100} r="5" className="fill-gray-800 dark:fill-white" />
                    </g>
                </svg>
            </div>
            <div className="flex flex-col items-center mt-2 z-10">
                <div className="text-3xl font-black text-[#dd9933] leading-none font-mono tracking-tighter">{macdVal.toFixed(3)}</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white uppercase mt-0.5">{macdLabel}</div>
            </div>
            <div className="flex justify-around w-full mt-2 text-center z-10 border-t border-gray-200 dark:border-slate-700/30 pt-2 pb-2">
                <div><div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">{tTime.yesterday}</div><div className="text-sm font-bold text-gray-800 dark:text-white">{avgData?.yesterdayNMacd?.toFixed(3) || '-'}</div></div>
                <div><div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">{tTime.d7}</div><div className="text-sm font-bold text-gray-800 dark:text-white">{(avgData?.days7Ago > 100 ? avgData?.days7Ago/1000 : avgData?.days7Ago)?.toFixed(2) || '-'}</div></div>
                <div><div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">{tTime.d30}</div><div className="text-sm font-bold text-gray-800 dark:text-white">{(avgData?.days30Ago > 100 ? avgData?.days30Ago/1000 : avgData?.days30Ago)?.toFixed(2) || '-'}</div></div>
            </div>
        </div>
    );
};

export default MacdWidget;
