
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Info, Search, ChevronLeft, ChevronRight, BarChart2, DollarSign, Percent, ChevronDown, ZoomOut, MousePointer2, GripVertical, ChevronsUpDown } from 'lucide-react';
import Highcharts from 'highcharts';
import addMouseWheelZoom from 'highcharts/modules/mouse-wheel-zoom';
import { Language, DashboardItem } from '../../../types';
import { getTranslations } from '../../../locales';
import {
  RsiAvgData,
  RsiTableItem,
  RsiTrackerPoint,
  fetchRsiAverage,
  fetchRsiTable,
  fetchRsiTablePage,
  fetchRsiTrackerHist
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

// Inicializa o módulo de zoom com proteção contra erro "is not a function"
if (typeof addMouseWheelZoom === 'function') {
    addMouseWheelZoom(Highcharts);
}

const TIMEFRAMES = ['15m', '1h', '4h', '24h', '7d'] as const;
type Timeframe = typeof TIMEFRAMES[number];
type XAxisMode = 'mcap' | 'volume' | 'change';

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

const getRsiColor = (val: number, isText = false) => {
  if (val === null || val === undefined || Number.isNaN(val)) return isText ? 'text-gray-400' : '';
  if (val >= 70) return isText ? 'text-red-500 font-bold' : 'bg-red-500/20 text-red-500';
  if (val <= 30) return isText ? 'text-green-500 font-bold' : 'bg-green-500/20 text-green-500';
  return isText ? 'text-gray-700 dark:text-slate-300' : 'text-gray-700 dark:text-slate-300';
};

const computeAvgRsi = (rows: RsiTableItem[], tf: Timeframe) => {
  const vals = rows
    .map(r => r.rsi?.[tf])
    .filter(v => typeof v === 'number' && !Number.isNaN(v)) as number[];
  if (vals.length === 0) return 50;
  const sum = vals.reduce((a, b) => a + b, 0);
  return sum / vals.length;
};

const computeCounts = (rows: RsiTableItem[], tf: Timeframe) => {
  let oversold = 0;
  let overbought = 0;
  let valid = 0;
  for (const r of rows) {
    const v = r.rsi?.[tf];
    if (typeof v !== 'number') continue;
    valid++;
    if (v <= 30) oversold++;
    if (v >= 70) overbought++;
  }
  return { oversold, overbought, valid };
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

// Sidebar Gauge (Tamanho Reduzido)
const SidebarGauge: React.FC<{ value: number }> = ({ value }) => {
    const rsiVal = clamp(value, 0, 100);
    const rotation = -90 + (rsiVal / 100) * 180;
    
    let label = "Neutro";
    if (rsiVal >= 70) label = "Sobrecompra";
    if (rsiVal <= 30) label = "Sobrevenda";

    // Adjusted Geometry: Raised Center Y to 85, Radius reduced to 65 to prevent text cutoff
    return (
        <div className="flex flex-col items-center justify-center h-full py-4">
            <div className="relative w-full max-w-[220px]">
                <svg viewBox="0 0 200 110" className="w-full overflow-visible">
                    <defs>
                        <linearGradient id="rsiSidebarGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#4ade80" />
                            <stop offset="50%" stopColor="#fbbf24" />
                            <stop offset="100%" stopColor="#f87171" />
                        </linearGradient>
                    </defs>
                    <path d="M 35 85 A 65 65 0 0 1 165 85" fill="none" className="stroke-[#eeeeee] dark:stroke-[#333]" strokeWidth="14" strokeLinecap="round"/>
                    <path d="M 35 85 A 65 65 0 0 1 165 85" fill="none" stroke="url(#rsiSidebarGrad)" strokeWidth="14" strokeDasharray={`${(rsiVal/100)*204} 204`} strokeLinecap="round" />
                    <g transform={`rotate(${rotation} 100 85)`}>
                        <path d="M 100 85 L 100 35" className="stroke-gray-800 dark:stroke-white" strokeWidth="3" /><circle cx={100} cy={85} r="4" className="fill-gray-800 dark:fill-white" />
                    </g>
                </svg>
            </div>
            {/* Text positioned absolutely relative to container to avoid SVG clipping issues */}
            <div className="flex flex-col items-center -mt-4 z-10">
                <div className="text-3xl font-black text-[#dd9933] leading-none font-mono tracking-tighter">{rsiVal.toFixed(2)}</div>
                <div className="text-xs font-bold text-gray-900 dark:text-white uppercase mt-1 tracking-widest">{label}</div>
            </div>
        </div>
    );
};

// 1. Left Sidebar Container
export const RsiGauge: React.FC<{ language?: Language }> = ({ language = 'pt' }) => {
  const [avgData, setAvgData] = useState<RsiAvgData | null>(null);
  const [tableData, setTableData] = useState<RsiTableItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
        fetchRsiAverage(),
        fetchRsiTable({ force: false })
    ]).then(([avg, table]) => {
        setAvgData(avg);
        setTableData(table);
        setLoading(false);
    });
  }, []);

  const timeframe: Timeframe = '4h'; 
  const avgRsi = useMemo(() => computeAvgRsi(tableData, timeframe), [tableData, timeframe]);
  const counts = useMemo(() => computeCounts(tableData, timeframe), [tableData, timeframe]);
  const total = counts.valid || 1;
  const osPct = (counts.oversold / total) * 100;
  const obPct = (counts.overbought / total) * 100;

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="flex flex-col gap-3 h-full">
        {/* Box 1: Average RSI Gauge (Flex 1 to take remaining space) */}
        <div className="flex-1 bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-center mb-1 shrink-0">
                <h3 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider">Average RSI (4h)</h3>
                <Info size={14} className="text-slate-400" />
            </div>
            <SidebarGauge value={avgRsi} />
        </div>

        {/* Box 2: OB vs OS (Fixed height) */}
        <div className="shrink-0 bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider">Estado do Mercado</h3>
            </div>
            <div className="flex justify-between text-[10px] font-black uppercase mb-1.5">
                <span className="text-green-500 flex items-center gap-1">Sobrevenda {osPct.toFixed(0)}%</span>
                <span className="text-red-500 flex items-center gap-1">Sobrecompra {obPct.toFixed(0)}%</span>
            </div>
            <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden flex relative">
                <div className="h-full bg-green-500" style={{ width: `${osPct}%` }}></div>
                <div className="h-full flex-1"></div>
                <div className="h-full bg-red-500" style={{ width: `${obPct}%` }}></div>
            </div>
            <div className="text-[10px] text-center text-gray-400 mt-1 font-mono">Total: {total} ativos</div>
        </div>

        {/* Box 3: Historical (Fixed height) */}
        <div className="shrink-0 bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider">Histórico da Média</h3>
            </div>
            <div className="space-y-1.5">
                {[
                    { l: 'Ontem', v: avgData?.yesterday },
                    { l: '7 Dias', v: avgData?.days7Ago },
                    { l: '30 Dias', v: avgData?.days30Ago }
                ].map((h, i) => (
                    <div key={i} className="flex justify-between items-center bg-gray-50 dark:bg-white/5 p-1.5 rounded px-3">
                        <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase">{h.l}</span>
                        <span className={`text-xs font-black font-mono ${getRsiColor(h.v || 50, true)}`}>
                            {h.v ? h.v.toFixed(2) : '-'}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

// 2. Scatter Chart (Updated with Trend Arrows and Zoom Reset)
export const RsiScatterChart: React.FC = () => {
  const isDark = useIsDark();
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<Highcharts.Chart | null>(null);
  
  // Use Tracker History for Scatter (Contains lastRsi)
  const [points, setPoints] = useState<RsiTrackerPoint[]>([]);
  
  // Controls
  const [timeframe, setTimeframe] = useState<Timeframe>('4h');
  const [xMode, setXMode] = useState<XAxisMode>('mcap');

  useEffect(() => {
      fetchRsiTrackerHist().then(data => {
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
    // Lighter crosshair color for visibility
    const crosshairColor = isDark ? '#64748b' : '#94a3b8'; 

    const seriesData = points
        .filter(r => r.marketCap && r.marketCap > 0 && r.rsi?.[timeframe])
        .map(r => {
            let xVal = 0;
            if (xMode === 'mcap') xVal = r.marketCap || 0;
            else if (xMode === 'volume') xVal = r.volume24h || 0;
            else xVal = r.change24h || 0;

            const cur = r.rsi?.[timeframe];
            const last = r.lastRsi; // Use specific field or infer
            const isRising = (last !== undefined && cur > last);

            return {
                x: xVal,
                y: cur,
                z: r.volume24h,
                name: r.symbol,
                fullName: r.name,
                price: r.price,
                change: r.change24h,
                isRising: isRising,
                marker: {
                    symbol: `url(${r.logo})`,
                    width: 24, // Initial size
                    height: 24
                }
            };
        });

    const xAxisType = xMode === 'change' ? 'linear' : 'logarithmic';
    const xTitle = xMode === 'mcap' ? 'Market Cap (Log)' : xMode === 'volume' ? 'Volume 24h (Log)' : 'Variação 24h (%)';

    // Plot lines for X Axis (Zero line for change)
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
                // Feature: Resize markers slightly on zoom for better visibility
                render: function() {
                    const chart = this;
                    // Safe check if we have data to calculate scale
                    if (!chart.xAxis[0].dataMin || !chart.xAxis[0].dataMax) return;
                    
                    const xExtremes = chart.xAxis[0].getExtremes();
                    const dataRange = chart.xAxis[0].dataMax - chart.xAxis[0].dataMin;
                    const viewRange = xExtremes.max - xExtremes.min;
                    
                    // Simple zoom factor: 1 (full view) to X (zoomed in)
                    // We cap magnification to avoid huge icons
                    let zoomFactor = Math.min(Math.max(dataRange / viewRange, 1), 3);
                    // Smooth scaling: base 24px, max 48px
                    let newSize = 24 + (zoomFactor - 1) * 8; 
                    newSize = Math.min(newSize, 48);

                    // Update series only if significant change to prevent loops
                    const currentSize = chart.series[0].options.marker?.width;
                    if (currentSize && Math.abs(currentSize - newSize) > 2) {
                        chart.series[0].update({
                            marker: {
                                width: newSize,
                                height: newSize
                            },
                            dataLabels: {
                                // Adjust label offset based on new size
                                x: newSize / 2 - 2, 
                                y: newSize / 2 - 2
                            }
                        }, true, false); // Redraw: true, Animation: false
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
            // Crosshair Feature (Mira no X)
            crosshair: {
                width: 1,
                color: crosshairColor,
                dashStyle: 'Dot',
                snap: false, // Continuous movement
                zIndex: 5
            }
        },
        yAxis: {
            title: { text: 'Relative Strength Index', style: { color: textColor, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' } },
            min: 0, 
            max: 100,
            gridLineColor: gridColor,
            gridLineDashStyle: 'Dash',
            labels: { style: { color: textColor, fontSize: '10px' } },
            plotLines: [
                { value: 80, color: '#f87171', dashStyle: 'ShortDash', width: 2, label: { text: 'Overbought (80)', align: 'right', style: { color: '#f87171', fontSize: '10px' } }, zIndex: 5 },
                { value: 20, color: '#4ade80', dashStyle: 'ShortDash', width: 2, label: { text: 'Oversold (20)', align: 'right', style: { color: '#4ade80', fontSize: '10px' } }, zIndex: 5 },
                { value: 50, color: textColor, width: 1, zIndex: 1 }
            ],
            plotBands: [
                { from: 80, to: 100, color: 'rgba(248, 113, 113, 0.08)' },
                { from: 0, to: 20, color: 'rgba(74, 222, 128, 0.08)' } 
            ],
            // Crosshair Feature (Mira no Y)
            crosshair: {
                width: 1,
                color: crosshairColor,
                dashStyle: 'Dot',
                snap: false,
                zIndex: 5
            }
        },
        tooltip: {
            useHTML: true,
            backgroundColor: isDark ? 'rgba(26, 28, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: gridColor,
            borderRadius: 8,
            style: { color: isDark ? '#fff' : '#000' },
            formatter: function (this: any) {
                const p = this.point;
                return `
                    <div style="display:flex; align-items:center; gap:8px; min-width:140px; padding: 4px;">
                        <div style="font-weight:900; font-size:14px;">${p.name}</div>
                    </div>
                    <div style="font-size:12px; opacity:0.7; margin-bottom:4px;">$${formatCompactNumber(p.options.price)}</div>
                    <div style="margin-top:4px; font-size:12px;">
                        <span style="opacity:0.7;">RSI (${timeframe}):</span> <b>${p.y.toFixed(2)}</b>
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
                    radius: 5,
                    states: { hover: { enabled: true, lineColor: 'rgb(100,100,100)' } }
                },
                // Trend Triangle Feature using DataLabels
                dataLabels: {
                    enabled: true,
                    useHTML: true,
                    allowOverlap: true,
                    formatter: function (this: any) {
                        const p = this.point;
                        const isRising = p.options.isRising;
                        const color = isRising ? '#4ade80' : '#f87171'; // Green / Red
                        const symbol = isRising ? '▲' : '▼'; 
                        // Small triangle, positioned carefully
                        return `<span style="color: ${color}; font-size: 10px; font-weight: bold; text-shadow: 0px 1px 2px rgba(0,0,0,0.8);">${symbol}</span>`;
                    },
                    align: 'right', // Align right relative to point
                    verticalAlign: 'bottom', // Align bottom relative to point
                    x: 8, // Offset right
                    y: 8, // Offset bottom
                    style: { textOutline: 'none' } // Remove SVG text stroke
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
                <h3 className="font-bold text-gray-900 dark:text-white uppercase text-sm tracking-wider">RSI Scatter Map</h3>
                
                {/* Timeframe Selector */}
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

            {/* X-Axis Toggle + Zoom Reset */}
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
                    <button onClick={() => setXMode('volume')} className={`px-2 py-1 text-[10px] font-bold rounded flex items-center gap-1 ${xMode === 'volume' ? 'bg-white dark:bg-[#1a1c1e] text-[#dd9933] shadow-sm' : 'text-gray-500'}`}>
                        <BarChart2 size={10} /> Vol
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

// 3. Table List (Enhanced with Sortable Columns & DND)
// Column IDs
const COLS = {
    rank: { id: 'rank', label: '#' },
    asset: { id: 'asset', label: 'Ativo' },
    price: { id: 'price', label: 'Preço' },
    mcap: { id: 'mcap', label: 'Mkt Cap' },
    vol: { id: 'vol', label: 'Vol 24h' },
    rsi15m: { id: 'rsi15m', label: '15m' },
    rsi1h: { id: 'rsi1h', label: '1h' },
    rsi4h: { id: 'rsi4h', label: '4h' },
    rsi24h: { id: 'rsi24h', label: '24h' },
    rsi7d: { id: 'rsi7d', label: '7d' },
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

export const RsiTableList: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RsiTableItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  
  // Sort State
  const [sortKey, setSortKey] = useState('rsi4h');
  const [sortAsc, setSortAsc] = useState(false);

  // Column Order State
  const [colOrder, setColOrder] = useState<string[]>([
      'rank', 'asset', 'price', 'mcap', 'vol', 'rsi15m', 'rsi1h', 'rsi4h', 'rsi24h', 'rsi7d'
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchRsiTablePage({
      page,
      limit: pageSize,
      sort: sortKey as any,
      ascendingOrder: sortAsc,
      filterText: search
    }).then(res => {
        if(!mounted) return;
        setRows(res.items);
        setTotalPages(res.totalPages);
        setLoading(false);
    });
    return () => { mounted = false; };
  }, [page, pageSize, search, sortKey, sortAsc]);

  const handleSort = (key: string) => {
      if (sortKey === key) {
          setSortAsc(!sortAsc);
      } else {
          setSortKey(key);
          setSortAsc(false); // Default to desc for new metrics
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
  const renderCell = (r: RsiTableItem, colId: string) => {
      switch (colId) {
          case 'rank': return <td key={colId} className="p-3 text-center text-gray-400 dark:text-slate-500 font-mono text-xs">{r.rank}</td>;
          case 'asset': return (
              <td key={colId} className="p-3">
                  <div className="flex items-center gap-3">
                      <img src={r.logo} className="w-6 h-6 rounded-full bg-white p-0.5 border border-gray-200 dark:border-white/10" alt="" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
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
          case 'vol': return <td key={colId} className="p-3 text-center font-mono text-gray-500 dark:text-slate-400 text-xs">${formatCompactNumber(r.volume24h || 0)}</td>;
          
          // RSI Columns
          case 'rsi15m': return <td key={colId} className={`p-3 text-center font-mono font-bold ${getRsiColor(r.rsi["15m"], true)}`}>{r.rsi["15m"]?.toFixed(0)}</td>;
          case 'rsi1h': return <td key={colId} className={`p-3 text-center font-mono font-bold ${getRsiColor(r.rsi["1h"], true)}`}>{r.rsi["1h"]?.toFixed(0)}</td>;
          case 'rsi4h': return <td key={colId} className={`p-3 text-center font-mono font-bold bg-gray-50 dark:bg-white/5 ${getRsiColor(r.rsi["4h"], true)}`}>{r.rsi["4h"]?.toFixed(0)}</td>;
          case 'rsi24h': return <td key={colId} className={`p-3 text-center font-mono font-bold ${getRsiColor(r.rsi["24h"], true)}`}>{r.rsi["24h"]?.toFixed(0)}</td>;
          case 'rsi7d': return <td key={colId} className={`p-3 text-center font-mono font-bold ${getRsiColor(r.rsi["7d"], true)}`}>{r.rsi["7d"]?.toFixed(0)}</td>;
          default: return <td key={colId}></td>;
      }
  };

  // Map sort keys for the API
  const sortKeyMap: Record<string, string> = {
      rank: 'rank', asset: 'rank', price: 'price24h', // Asset sorts by rank by default
      mcap: 'marketCap', vol: 'volume24h',
      rsi15m: 'rsi15m', rsi1h: 'rsi1h', rsi4h: 'rsi4h', rsi24h: 'rsi24h', rsi7d: 'rsi7d'
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
                                        activeKey={sortKey} 
                                        onSort={handleSort} 
                                    />
                                ))}
                            </SortableContext>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-sm">
                        {loading ? (
                            <tr><td colSpan={colOrder.length} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-[#dd9933]" /></td></tr>
                        ) : rows.map((r) => (
                            <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
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
export const RsiFaq: React.FC = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    
    const items = [
        { q: "O que é o RSI (Índice de Força Relativa)?", a: "O RSI é um oscilador de momentum que mede a velocidade e a mudança dos movimentos de preço. Ele oscila entre 0 e 100." },
        { q: "Como a fórmula é calculada?", a: "RSI = 100 - (100 / (1 + RS)), onde RS é a média dos ganhos dos dias de alta dividida pela média das perdas dos dias de baixa." },
        { q: "Para que serve o RSI?", a: "Principalmente para identificar condições de sobrecompra (potencial topo) ou sobrevenda (potencial fundo) de um ativo." },
        { q: "O que é Divergência?", a: "Ocorre quando o preço faz um novo topo/fundo, mas o RSI não acompanha. Isso geralmente sinaliza uma reversão de tendência iminente." },
        { q: "Quais são os níveis críticos?", a: "Tradicionalmente, acima de 70 é considerado sobrecompra (risco de queda) e abaixo de 30 é sobrevenda (oportunidade de compra). Em mercados de forte tendência, esses níveis podem ser ajustados para 80/20." }
    ];

    return (
        <div className="max-w-4xl mx-auto mt-8">
            <h3 className="text-xl font-black text-gray-800 dark:text-[#dd9933] uppercase tracking-widest text-center mb-6">Entendendo o RSI</h3>
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
const RsiWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
    // Reuse the Gauge Logic for the widget
    const [avgData, setAvgData] = useState<RsiAvgData | null>(null);
    const [loading, setLoading] = useState(true);
    const t = getTranslations(language as Language).dashboard.widgets.rsi;
    const tTime = getTranslations(language as Language).dashboard.widgets.time;

    useEffect(() => {
        setLoading(true);
        fetchRsiAverage().then(data => {
            if(data) setAvgData(data);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const Watermark = () => <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-[0.05] z-0"><img src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" alt="watermark" className="w-3/4 h-auto grayscale filter" /></div>;

    if (loading) return <div className="flex items-center justify-center h-full text-gray-400 dark:text-slate-500"><Loader2 className="animate-spin" /></div>;

    const rsiVal = avgData?.averageRsi ?? 50;
    const rsiLabel = rsiVal >= 70 ? t.overbought : rsiVal <= 30 ? t.oversold : t.neutral;
    const rotation = -90 + (Math.min(Math.max(rsiVal, 0), 100) / 100) * 180;

    if (item.isMaximized) {
        return (
            <div className="h-full w-full bg-white dark:bg-[#1a1c1e] p-2">
               <RsiScatterChart />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col justify-center gap-1 p-2 relative text-center bg-white dark:bg-[#2f3032]">
            <Watermark />
            <div className="flex items-center justify-center relative mt-3 z-10">
                <svg viewBox="0 0 200 110" className="w-[85%] max-w-[280px]">
                    <defs>
                        <linearGradient id="rsiGaugeGradWidget" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#4ade80" />
                            <stop offset="50%" stopColor="#fbbf24" />
                            <stop offset="100%" stopColor="#f87171" />
                        </linearGradient>
                    </defs>
                    {/* Adjusted path to match sidebar version */}
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" className="stroke-[#eeeeee] dark:stroke-[#333]" strokeWidth="18" strokeLinecap="round"/>
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#rsiGaugeGradWidget)" strokeWidth="18" strokeDasharray={`${(rsiVal/100)*251} 251`} strokeLinecap="round" />
                    <g transform={`rotate(${rotation} 100 100)`}>
                        <path d="M 100 100 L 100 35" className="stroke-gray-800 dark:stroke-white" strokeWidth="3" /><circle cx={100} cy={100} r="5" className="fill-gray-800 dark:fill-white" />
                    </g>
                </svg>
            </div>
            <div className="flex flex-col items-center mt-2 z-10">
                <div className="text-3xl font-black text-[#dd9933] leading-none font-mono tracking-tighter">{rsiVal.toFixed(2)}</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white uppercase mt-0.5">{rsiLabel}</div>
            </div>
            <div className="flex justify-around w-full mt-2 text-center z-10 border-t border-gray-200 dark:border-slate-700/30 pt-2 pb-2">
                <div><div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">{tTime.yesterday}</div><div className="text-sm font-bold text-gray-800 dark:text-white">{avgData?.yesterday?.toFixed(0) || '-'}</div></div>
                <div><div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">{tTime.d7}</div><div className="text-sm font-bold text-gray-800 dark:text-white">{avgData?.days7Ago?.toFixed(0) || '-'}</div></div>
                <div><div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">{tTime.d30}</div><div className="text-sm font-bold text-gray-800 dark:text-white">{avgData?.days30Ago?.toFixed(0) || '-'}</div></div>
            </div>
        </div>
    );
};

export default RsiWidget;
