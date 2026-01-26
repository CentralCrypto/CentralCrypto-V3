
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Info, Search, ChevronLeft, ChevronRight, BarChart2, DollarSign, Percent, ZoomOut, MousePointer2, GripVertical, ChevronsUpDown, Filter, TrendingUp, TrendingDown } from 'lucide-react';
import Highcharts from 'highcharts';
import addMouseWheelZoom from 'highcharts/modules/mouse-wheel-zoom';
import { Language, DashboardItem } from '../../../types';
import {
  RsiAvgData,
  RsiTableItem,
  RsiTrackerPoint,
  fetchRsiAverage,
  fetchRsiTable,
  fetchRsiTablePage,
  fetchRsiTrackerHist
} from '../services/api';
import CoinLogo from '../../../components/CoinLogo';

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

if (typeof addMouseWheelZoom === 'function') {
    addMouseWheelZoom(Highcharts);
}

const TIMEFRAMES = ['15m', '1h', '4h', '24h', '7d'] as const;
type Timeframe = typeof TIMEFRAMES[number];
type XAxisMode = 'mcap' | 'volume' | 'change';
const LIMIT_OPTIONS = [50, 100, 150, 200, 250];

// CORES EXATAS SOLICITADAS
const COLOR_GREEN = '#4e843c';
const COLOR_RED = '#C2544E';
const COLOR_NEUTRAL = '#475569'; // Slate 600

// NOVOS LIMITES SOLICITADOS
const RSI_LOW = 20;
const RSI_HIGH = 80;

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
  if (val >= RSI_HIGH) return isText ? `text-[${COLOR_RED}] font-black` : `bg-[${COLOR_RED}]/20 text-[${COLOR_RED}]`;
  if (val <= RSI_LOW) return isText ? `text-[${COLOR_GREEN}] font-black` : `bg-[${COLOR_GREEN}]/20 text-[${COLOR_GREEN}]`;
  return isText ? 'text-gray-700 dark:text-slate-300 font-bold' : 'text-gray-700 dark:text-slate-300';
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
    if (v <= RSI_LOW) oversold++;
    if (v >= RSI_HIGH) overbought++;
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

const SidebarGauge: React.FC<{ value: number }> = ({ value }) => {
    const rsiVal = clamp(value, 0, 100);
    const rotation = -90 + (rsiVal / 100) * 180;
    
    let label = "Neutro";
    if (rsiVal >= RSI_HIGH) label = "Sobrecompra";
    if (rsiVal <= RSI_LOW) label = "Sobrevenda";

    return (
        <div className="flex flex-col items-center justify-center h-full py-2">
            <div className="relative w-full max-w-[240px] -mt-2">
                <svg viewBox="0 0 200 100" className="w-full overflow-visible">
                    <defs>
                        <linearGradient id="rsiSidebarGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={COLOR_GREEN} />
                            <stop offset="50%" stopColor="#fbbf24" />
                            <stop offset="100%" stopColor={COLOR_RED} />
                        </linearGradient>
                    </defs>
                    <path d="M 15 80 A 85 85 0 0 1 185 80" fill="none" className="stroke-[#eeeeee] dark:stroke-[#333]" strokeWidth="16" strokeLinecap="round"/>
                    <path d="M 15 80 A 85 85 0 0 1 185 80" fill="none" stroke="url(#rsiSidebarGrad)" strokeWidth="16" strokeDasharray={`${(rsiVal/100)*267} 267`} strokeLinecap="round" />
                    <g transform={`rotate(${rotation} 100 80)`}>
                        <path d="M 100 80 L 100 10" className="stroke-gray-800 dark:stroke-white" strokeWidth="4" /><circle cx={100} cy={80} r="5" className="fill-gray-800 dark:fill-white" />
                    </g>
                </svg>
            </div>
            <div className="flex flex-col items-center -mt-4 z-10">
                <div className="text-3xl font-black text-[#dd9933] leading-none font-mono tracking-tighter">{rsiVal.toFixed(2)}</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white uppercase mt-0.5 tracking-widest">{label}</div>
            </div>
        </div>
    );
};

// === COMPONENTE DEDICADO PARA GRID (MAIN BOARD) ===
const RsiGridWidget: React.FC<{ language: Language }> = ({ language }) => {
    const [avgData, setAvgData] = useState<RsiAvgData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRsiAverage().then(data => {
            setAvgData(data);
            setLoading(false);
        });
    }, []);

    const Watermark = () => <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-[0.05] z-0"><img src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" alt="watermark" className="w-3/4 h-auto grayscale filter" /></div>;

    if (loading) return <div className="flex items-center justify-center h-full text-slate-500"><Loader2 className="animate-spin" /></div>;

    const rsiVal = avgData?.averageRsi || 50;
    const rotation = -90 + (clamp(rsiVal, 0, 100) / 100) * 180;
    
    let label = "Neutro";
    if (rsiVal >= RSI_HIGH) label = "Sobrecompra";
    if (rsiVal <= RSI_LOW) label = "Sobrevenda";

    return (
        <div className="h-full flex flex-col justify-center gap-1 p-2 relative text-center bg-white dark:bg-[#2f3032]">
            <Watermark />
            <div className="flex items-center justify-center relative mt-3 z-10">
                <svg viewBox="0 0 200 110" className="w-[85%] max-w-[280px]">
                    <defs>
                        <linearGradient id="rsiGridGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={COLOR_GREEN} />
                            <stop offset="50%" stopColor="#fbbf24" />
                            <stop offset="100%" stopColor={COLOR_RED} />
                        </linearGradient>
                    </defs>
                    <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" className="stroke-[#eeeeee] dark:stroke-[#333]" strokeWidth="18" strokeLinecap="round"/>
                    <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="url(#rsiGridGrad)" strokeWidth="18" strokeDasharray={`${(rsiVal/100)*283} 283`} strokeLinecap="round" />
                    <g transform={`rotate(${rotation} 100 100)`}>
                        <path d="M 100 100 L 100 20" className="stroke-gray-800 dark:stroke-white" strokeWidth="3" /><circle cx={100} cy={100} r="5" className="fill-gray-800 dark:fill-white" />
                    </g>
                </svg>
            </div>
            <div className="flex flex-col items-center mt-2 z-10">
                <div className="text-3xl font-black text-[#dd9933] leading-none font-mono tracking-tighter">{rsiVal.toFixed(2)}</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white uppercase mt-0.5">{label}</div>
            </div>
            <div className="flex justify-around w-full mt-2 text-center z-10 border-t border-gray-200 dark:border-slate-700/30 pt-2 pb-2">
                <div><div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">Ontem</div><div className={`text-sm font-bold font-mono ${getRsiColor(avgData?.yesterday || 50, true)}`}>{avgData?.yesterday?.toFixed(0)}</div></div>
                <div><div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">7 Dias</div><div className={`text-sm font-bold font-mono ${getRsiColor(avgData?.days7Ago || 50, true)}`}>{avgData?.days7Ago?.toFixed(0)}</div></div>
                <div><div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">30 Dias</div><div className={`text-sm font-bold font-mono ${getRsiColor(avgData?.days30Ago || 50, true)}`}>{avgData?.days30Ago?.toFixed(0)}</div></div>
            </div>
        </div>
    );
};

// === COMPONENTE SIDEBAR PARA PAGINA DE DETALHES (3 Cards) ===
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
  const avgRsi = avgData?.averageRsi ?? computeAvgRsi(tableData, timeframe);
  const counts = useMemo(() => computeCounts(tableData, timeframe), [tableData, timeframe]);
  const total = counts.valid || 1;
  const osPct = (counts.oversold / total) * 100;
  const obPct = (counts.overbought / total) * 100;
  const neutralPct = 100 - osPct - obPct;

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="flex flex-col gap-3 h-full">
        <div className="flex-1 bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-center mb-1 shrink-0">
                <h3 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider">Average RSI (4h)</h3>
                <Info size={14} className="text-slate-400" />
            </div>
            <SidebarGauge value={avgRsi} />
        </div>
        <div className="shrink-0 bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider">Estado do Mercado</h3>
            </div>
            <div className="flex justify-between text-[9px] font-black uppercase mb-1.5 opacity-80">
                <span style={{ color: COLOR_GREEN }}>Oversold {osPct.toFixed(0)}%</span>
                <span className="text-gray-400">Neutral {neutralPct.toFixed(0)}%</span>
                <span style={{ color: COLOR_RED }}>Overbought {obPct.toFixed(0)}%</span>
            </div>
            <div className="w-full h-3 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden flex relative border border-gray-200 dark:border-slate-700">
                <div className="h-full transition-all duration-500" style={{ width: `${osPct}%`, backgroundColor: COLOR_GREEN }} title={`Sobrevenda: ${counts.oversold}`}></div>
                <div className="h-full bg-slate-500 dark:bg-slate-600 transition-all duration-500" style={{ width: `${neutralPct}%` }} title={`Neutro`}></div>
                <div className="h-full transition-all duration-500" style={{ width: `${obPct}%`, backgroundColor: COLOR_RED }} title={`Sobrecompra: ${counts.overbought}`}></div>
            </div>
            <div className="text-[9px] text-center text-gray-400 mt-1.5 font-mono">Total Monitorado: {total} ativos</div>
        </div>
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
                    <div key={i} className="flex justify-between items-center bg-gray-5 dark:bg-white/5 p-1.5 rounded px-3">
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

export const RsiScatterChart: React.FC = () => {
  const isDark = useIsDark();
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<Highcharts.Chart | null>(null);
  
  const [points, setPoints] = useState<RsiTrackerPoint[]>([]);
  const [timeframe, setTimeframe] = useState<Timeframe>('4h');
  const [xMode, setXMode] = useState<XAxisMode>('mcap');
  const [limit, setLimit] = useState(50); 
  
  // Filters
  const [visibleZones, setVisibleZones] = useState<string[]>(['oversold', 'neutral', 'overbought']);

  useEffect(() => {
      fetchRsiTrackerHist().then(data => {
          if (data && Array.isArray(data)) setPoints(data);
      });
  }, []);

  const resetZoom = () => {
      if (chartInstance.current) {
          chartInstance.current.zoomOut();
      }
  };

  const toggleZone = (zone: string) => {
      setVisibleZones(prev => 
          prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone]
      );
  };

  useEffect(() => {
    if (!chartRef.current || points.length === 0) return;

    const bgColor = 'transparent';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';
    const crosshairColor = isDark ? '#64748b' : '#94a3b8'; 

    const seriesData = points
        .filter(r => r.marketCap && r.marketCap > 0 && r.rsi?.[timeframe])
        .slice(0, limit)
        .map(r => {
            let xVal = 0;
            if (xMode === 'mcap') xVal = r.marketCap || 0;
            else if (xMode === 'volume') xVal = r.volume24h || 0;
            else xVal = r.change24h || 0;

            const cur = r.rsi?.[timeframe];
            
            // FIX: Filters match the 20/80 logic
            const isOversold = cur <= RSI_LOW;
            const isOverbought = cur >= RSI_HIGH;
            const isNeutral = !isOversold && !isOverbought;

            if (isOversold && !visibleZones.includes('oversold')) return null;
            if (isOverbought && !visibleZones.includes('overbought')) return null;
            if (isNeutral && !visibleZones.includes('neutral')) return null;

            const last = r.lastRsi; 
            const isRising = (last !== undefined && cur > last);
            const symbolShort = (r.symbol || 'UNK').substring(0, 3).toUpperCase();
            
            // Construct Image Paths with Fallback
            const id = r.symbol.toLowerCase();
            const localLogo = `/cachecko/logos/${id}.webp`;
            const fallbackLogo = r.logo || `https://assets.coincap.io/assets/icons/${id}@2x.png`;
            
            return {
                id: r.symbol, 
                x: xVal, // X Axis = Metric (Mcap/Vol/Change)
                y: cur,  // Y Axis = RSI
                z: r.volume24h,
                name: r.symbol,
                fullName: r.name,
                price: r.price,
                change: r.change24h,
                isRising: isRising,
                logoUrl: localLogo,
                fallbackLogo: fallbackLogo,
                symbolShort
            };
        })
        .filter(p => p !== null); // Remove filtered out points

    seriesData.sort((a, b) => a!.name.localeCompare(b!.name));

    if (chartInstance.current) {
        chartInstance.current.series[0].setData(seriesData as any, true, { duration: 1000, easing: 'easeOutQuart' }, true);
        const xAxisType = xMode === 'change' ? 'linear' : 'logarithmic';
        const xTitle = xMode === 'mcap' ? 'Market Cap (Log)' : xMode === 'volume' ? 'Volume 24h (Log)' : 'Variação 24h (%)';
        
        chartInstance.current.xAxis[0].update({
             type: xAxisType,
             reversed: xMode === 'mcap',
             title: { text: xTitle },
             plotLines: xMode === 'change' ? [{ value: 0, color: textColor, width: 1, dashStyle: 'Dash', zIndex: 2 }] : []
        });
        return;
    }

    const xAxisType = xMode === 'change' ? 'linear' : 'logarithmic';
    const xTitle = xMode === 'mcap' ? 'Market Cap (Log)' : xMode === 'volume' ? 'Volume 24h (Log)' : 'Variação 24h (%)';
    const xPlotLines = xMode === 'change' ? [{ value: 0, color: textColor, width: 1, dashStyle: 'Dash', zIndex: 2 }] : [];

    chartInstance.current = Highcharts.chart(chartRef.current, {
        chart: {
            type: 'scatter',
            backgroundColor: bgColor,
            style: { fontFamily: 'Inter, sans-serif' },
            height: null, 
            zooming: { mouseWheel: { enabled: true }, type: 'xy' }, // Mouse Wheel Enabled
            animation: { duration: 1000 }
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
            title: { text: 'Relative Strength Index', style: { color: textColor, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' } },
            min: 0, 
            max: 100,
            gridLineColor: gridColor,
            gridLineDashStyle: 'Dash',
            labels: { style: { color: textColor, fontSize: '10px' } },
            // FIX: Lines at 20 and 80
            plotLines: [
                { value: RSI_HIGH, color: COLOR_RED, dashStyle: 'ShortDash', width: 2, label: { text: 'Overbought (80)', align: 'right', style: { color: COLOR_RED, fontSize: '10px' } }, zIndex: 5 },
                { value: RSI_LOW, color: COLOR_GREEN, dashStyle: 'ShortDash', width: 2, label: { text: 'Oversold (20)', align: 'right', style: { color: COLOR_GREEN, fontSize: '10px' } }, zIndex: 5 },
                { value: 50, color: textColor, width: 1, zIndex: 1 }
            ],
            plotBands: [
                { from: RSI_HIGH, to: 100, color: 'rgba(194, 84, 78, 0.08)' }, // Red with opacity
                { from: 0, to: RSI_LOW, color: 'rgba(78, 132, 60, 0.08)' } // Green with opacity
            ],
            crosshair: { width: 1, color: crosshairColor, dashStyle: 'Dot', snap: false, zIndex: 5 }
        },
        tooltip: {
            useHTML: true,
            backgroundColor: isDark ? 'rgba(26, 28, 30, 0.98)' : 'rgba(255, 255, 255, 0.98)',
            borderColor: gridColor,
            borderRadius: 8,
            style: { color: isDark ? '#fff' : '#000', zIndex: 9999 },
            outside: true,
            snap: 2,
            positioner: function (labelWidth: number, labelHeight: number, point: any) {
                return { x: point.plotX - labelWidth / 2, y: point.plotY - labelHeight - 40 };
            },
            formatter: function (this: any) {
                const p = this.point;
                const changeColor = p.options.change >= 0 ? COLOR_GREEN : COLOR_RED;
                return `
                    <div style="display:flex; align-items:center; gap:8px; min-width:140px; padding: 4px; z-index:9999;">
                        <div style="font-weight:900; font-size:14px;">${p.name}</div>
                    </div>
                    <div style="font-size:12px; opacity:0.7; margin-bottom:4px;">$${formatCompactNumber(p.options.price)}</div>
                    <div style="margin-top:4px; font-size:12px;">
                        <span style="opacity:0.7;">RSI (${timeframe}):</span> <b>${p.y.toFixed(2)}</b>
                    </div>
                    <div style="font-size:12px;">
                        <span style="opacity:0.7;">Var 24h:</span> <b style="color:${changeColor}">${p.options.change.toFixed(2)}%</b>
                    </div>
                `;
            }
        },
        plotOptions: {
            scatter: {
                stickyTracking: false,
                marker: {
                    radius: 12, 
                    fillColor: 'rgba(0,0,0,0)',
                    lineWidth: 0,
                    states: { hover: { enabled: false } }
                },
                dataLabels: {
                    enabled: true,
                    useHTML: true,
                    allowOverlap: true,
                    y: -12,
                    x: -12,
                    formatter: function (this: any) {
                        const p = this.point;
                        const isRising = p.options.isRising;
                        const color = isRising ? COLOR_GREEN : COLOR_RED;
                        const symbol = isRising ? '▲' : '▼'; 
                        const localLogo = p.options.logoUrl;
                        const fallbackLogo = p.options.fallbackLogo;
                        const short = p.options.symbolShort || '';
                        
                        // Robust Double Fallback Logic
                        // 1. Try local. 2. On error, try fallback. 3. On error, hide image and show only letter.
                        return `
                        <div style="position: relative; width: 24px; height: 24px;">
                            <div style="position: absolute; inset: 0; background: #334155; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: bold; color: #fff; z-index: 1;">${short.charAt(0)}</div>
                            <img src="${localLogo}" 
                                 style="position: relative; width: 24px; height: 24px; border-radius: 50%; object-fit: cover; z-index: 2; background: transparent;" 
                                 onerror="this.onerror=null;this.src='${fallbackLogo}';this.onerror=function(){this.style.display='none'};"
                            />
                            <div style="position: absolute; right: -4px; bottom: -2px; color: ${color}; font-size: 10px; font-weight: bold; text-shadow: 0px 1px 2px rgba(0,0,0,0.8); line-height: 1; z-index: 3;">
                                ${symbol}
                            </div>
                        </div>`;
                    },
                    style: { textOutline: 'none' }
                }
            }
        },
        series: [{ name: 'Coins', data: seriesData as any, color: 'rgba(156, 163, 175, 0.5)' }]
    } as any);
  }, [points, timeframe, xMode, isDark, limit, visibleZones]);

  return (
    <div className="bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-4 h-full flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.05] z-0">
            <img src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" alt="watermark" className="w-1/2 h-auto grayscale filter" />
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 z-10 relative">
            <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900 dark:text-white uppercase text-sm tracking-wider">RSI Scatter Map</h3>
                <div className="flex bg-gray-100 dark:bg-[#2f3032] rounded p-0.5 ml-2 items-center">
                    <span className="text-[9px] font-bold text-gray-500 uppercase px-2">Nº Moedas:</span>
                    <select 
                        value={limit} 
                        onChange={(e) => setLimit(parseInt(e.target.value))}
                        className="bg-transparent text-[10px] font-bold outline-none text-gray-900 dark:text-white cursor-pointer px-1"
                    >
                        {LIMIT_OPTIONS.map(opt => <option key={opt} value={opt} className="bg-white dark:bg-[#1a1c1e] text-gray-900 dark:text-white">{opt}</option>)}
                    </select>
                </div>
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
                {/* ZONE FILTERS - CORES ESCURAS */}
                <div className="flex bg-gray-100 dark:bg-[#2f3032] rounded p-0.5 ml-2">
                     <button onClick={() => toggleZone('oversold')} className={`px-2 py-1 text-[10px] font-bold rounded transition-all flex items-center gap-1 ${visibleZones.includes('oversold') ? `bg-[${COLOR_GREEN}] text-white shadow-sm` : `text-[${COLOR_GREEN}] opacity-60 border border-[${COLOR_GREEN}]/30`}`}>
                        <Filter size={10} /> Oversold
                     </button>
                     <button onClick={() => toggleZone('neutral')} className={`px-2 py-1 text-[10px] font-bold rounded transition-all flex items-center gap-1 ${visibleZones.includes('neutral') ? `bg-[${COLOR_NEUTRAL}] text-white shadow-sm` : `text-[${COLOR_NEUTRAL}] opacity-60 border border-[${COLOR_NEUTRAL}]/30`}`}>
                        <Filter size={10} /> Neutral
                     </button>
                     <button onClick={() => toggleZone('overbought')} className={`px-2 py-1 text-[10px] font-bold rounded transition-all flex items-center gap-1 ${visibleZones.includes('overbought') ? `bg-[${COLOR_RED}] text-white shadow-sm` : `text-[${COLOR_RED}] opacity-60 border border-[${COLOR_RED}]/30`}`}>
                        <Filter size={10} /> Overbought
                     </button>
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

export const RsiTableList: React.FC<{ isPage?: boolean }> = ({ isPage = false }) => {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<RsiTableItem[]>([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState('rsi4h');
    const [sortAsc, setSortAsc] = useState(false);
    const [colOrder, setColOrder] = useState<string[]>(['rank', 'asset', 'price', 'mcap', 'vol', 'rsi15m', 'rsi1h', 'rsi4h', 'rsi24h', 'rsi7d']);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        fetchRsiTablePage({ page, limit: pageSize, sort: sortKey as any, ascendingOrder: sortAsc, filterText: search })
        .then(res => {
            if(!mounted) return;
            setRows(res.items);
            setTotalPages(res.totalPages);
            setLoading(false);
        });
        return () => { mounted = false; };
    }, [page, pageSize, search, sortKey, sortAsc]);

    const handleSort = (key: string) => {
        if (sortKey === key) setSortAsc(!sortAsc);
        else { setSortKey(key); setSortAsc(false); }
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

    const renderRsiCell = (r: RsiTableItem, tf: '15m'|'1h'|'4h'|'24h'|'7d') => {
        const val = r.rsi[tf];
        // Use os limites 20/80 para determinar a seta
        let Icon = null;
        if (val >= RSI_HIGH) Icon = <TrendingUp size={12} />;
        if (val <= RSI_LOW) Icon = <TrendingDown size={12} />;
        
        return (
            <td key={`rsi${tf}`} className={`p-3 text-center font-mono font-black ${getRsiColor(val, true)}`}>
                <div className="flex items-center justify-center gap-1">
                    {val?.toFixed(0)}
                    {Icon}
                </div>
            </td>
        );
    };

    const renderCell = (r: RsiTableItem, colId: string) => {
        switch (colId) {
            case 'rank': return <td key={colId} className="p-3 text-center text-gray-400 dark:text-slate-500 font-mono text-xs">{r.rank}</td>;
            case 'asset': return (
                <td key={colId} className="p-3">
                    <div className="flex items-center gap-3">
                        <CoinLogo 
                            coin={{
                                id: r.id || (r.symbol ? r.symbol.toLowerCase() : 'unknown'), 
                                symbol: r.symbol,
                                name: r.name,
                                image: r.logo
                            }}
                            className="w-6 h-6 rounded-full border border-gray-200 dark:border-white/10"
                        />
                        <div className="flex flex-col"><span className="font-bold text-gray-900 dark:text-slate-200 leading-none">{r.name}</span><span className="text-[10px] font-bold text-gray-500 uppercase">{r.symbol}</span></div>
                    </div>
                </td>
            );
            case 'price': return <td key={colId} className="p-3 text-center font-mono font-bold text-gray-700 dark:text-slate-300">${r.price < 1 ? r.price.toFixed(5) : r.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>;
            case 'mcap': return <td key={colId} className="p-3 text-center font-mono text-gray-500 dark:text-slate-400 text-xs">${formatCompactNumber(r.marketCap || 0)}</td>;
            case 'vol': return <td key={colId} className="p-3 text-center font-mono text-gray-500 dark:text-slate-400 text-xs">${formatCompactNumber(r.volume24h || 0)}</td>;
            case 'rsi15m': return renderRsiCell(r, '15m');
            case 'rsi1h': return renderRsiCell(r, '1h');
            case 'rsi4h': return renderRsiCell(r, '4h');
            case 'rsi24h': return renderRsiCell(r, '24h');
            case 'rsi7d': return renderRsiCell(r, '7d');
            default: return <td key={colId}></td>;
        }
    };
    
    const sortKeyMap: Record<string, string> = { rank: 'rank', asset: 'rank', price: 'price24h', mcap: 'marketCap', vol: 'volume24h', rsi15m: 'rsi15m', rsi1h: 'rsi1h', rsi4h: 'rsi4h', rsi24h: 'rsi24h', rsi7d: 'rsi7d' };
    const COLS = {
        rank: { id: 'rank', label: '#' }, asset: { id: 'asset', label: 'Ativo' }, price: { id: 'price', label: 'Preço' },
        mcap: { id: 'mcap', label: 'Mkt Cap' }, vol: { id: 'vol', label: 'Vol 24h' },
        rsi15m: { id: 'rsi15m', label: '15m' }, rsi1h: { id: 'rsi1h', label: '1h' },
        rsi4h: { id: 'rsi4h', label: '4h' }, rsi24h: { id: 'rsi24h', label: '24h' }, rsi7d: { id: 'rsi7d', label: '7d' },
    };
    const SortableTh = ({ colId, label, sortKey, activeKey, onSort }: any) => {
        const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: colId });
        const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 100 : 'auto' };
        return (
            <th ref={setNodeRef} style={style} className={`p-3 text-center bg-gray-100 dark:bg-[#2f3032] cursor-pointer group select-none ${colId === 'asset' ? 'text-left' : 'text-center'}`} onClick={() => onSort(sortKey)}>
                <div className={`flex items-center gap-1 ${colId === 'asset' ? 'justify-start' : 'justify-center'}`}>
                    <span className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`} {...attributes} {...listeners} onClick={e => e.stopPropagation()}><GripVertical size={12} className="text-gray-400" /></span>
                    <span className="text-[10px] uppercase font-black text-gray-500 dark:text-slate-400">{label}</span>
                    <ChevronsUpDown size={12} className={`text-gray-400 transition-colors ${activeKey === sortKey ? 'text-[#dd9933]' : 'opacity-0 group-hover:opacity-100'}`} />
                </div>
            </th>
        );
    };

    return (
        <div className={`bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col ${isPage ? 'w-full h-auto block' : 'h-full overflow-hidden min-h-[500px]'}`}>
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 bg-gray-50 dark:bg-black/20">
                {/* Header Controls Reorganized */}
                <div className="flex flex-wrap items-center justify-between gap-4 w-full">
                    {/* Left Group: Search + Rows */}
                    <div className="flex items-center gap-4 flex-1">
                        <div className="relative w-full sm:max-w-xs">
                            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                            <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar ativo..." className="w-full bg-white dark:bg-[#2f3032] border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-slate-200 text-xs py-2 pl-9 pr-3 rounded focus:border-[#dd9933] outline-none transition-colors"/>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
                             <span>Linhas:</span>
                             <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="bg-transparent text-gray-900 dark:text-white outline-none cursor-pointer font-black hover:text-[#dd9933] transition-colors">
                                <option value={50} className="bg-white dark:bg-[#2f3032] text-black dark:text-white">50</option>
                                <option value={100} className="bg-white dark:bg-[#2f3032] text-black dark:text-white">100</option>
                            </select>
                        </div>
                    </div>
                    
                    {/* Right Group: Pagination */}
                    <div className="flex items-center gap-2">
                         <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-1 hover:text-[#dd9933] transition-colors disabled:opacity-30 text-gray-600 dark:text-white"><ChevronLeft size={16}/></button>
                         <div className="flex items-center gap-1 text-xs font-bold text-gray-500 dark:text-gray-400">
                            <span>Pág</span>
                            <select value={page} onChange={(e) => setPage(Number(e.target.value))} className="bg-transparent text-gray-900 dark:text-white outline-none cursor-pointer font-black hover:text-[#dd9933] transition-colors">
                                {Array.from({length: totalPages}, (_, i) => i + 1).map(p => <option key={p} value={p} className="bg-white dark:bg-[#2f3032] text-black dark:text-white">{p}</option>)}
                            </select>
                            <span>de {totalPages}</span>
                         </div>
                         <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1 hover:text-[#dd9933] transition-colors disabled:opacity-30 text-gray-600 dark:text-white"><ChevronRight size={16}/></button>
                    </div>
                </div>
            </div>
            <div className={isPage ? 'w-full overflow-visible' : 'flex-1 overflow-auto custom-scrollbar'}>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-gray-100 dark:bg-[#2f3032] border-b border-gray-200 dark:border-slate-800">
                                <SortableContext items={colOrder} strategy={horizontalListSortingStrategy}>
                                    {colOrder.map(colId => (
                                        <SortableTh key={colId} colId={colId} label={COLS[colId as keyof typeof COLS].label} sortKey={sortKeyMap[colId]} activeKey={sortKey} onSort={handleSort} />
                                    ))}
                                </SortableContext>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-sm">
                            {loading ? <tr><td colSpan={colOrder.length} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-[#dd9933]" /></td></tr> : rows.map(r => <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">{colOrder.map(colId => renderCell(r, colId))}</tr>)}
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

export const RsiFaq: React.FC = () => { return null; };

const RsiWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
    // 1. Grid Mode: Simplified Widget
    if (!item.isMaximized) {
        return <RsiGridWidget language={language} />;
    }
    
    // 2. Maximized Mode: JUST SCATTER CHART (as requested)
    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#1a1c1e] p-4 overflow-hidden">
             <div className="flex-1 min-h-0 shadow-sm border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
                 <RsiScatterChart />
             </div>
        </div>
    );
};

export default RsiWidget;
