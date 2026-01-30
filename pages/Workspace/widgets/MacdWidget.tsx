
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, Info, Search, ChevronLeft, ChevronRight, BarChart2, DollarSign, Percent, ZoomOut, MousePointer2, GripVertical, ChevronsUpDown, ChevronDown, Coins } from 'lucide-react';
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
import CoinLogo from '../../../components/CoinLogo';
import { initLogoService, getBestLocalLogo } from '../../../services/logo';

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

if (typeof addMouseWheelZoom === 'function') {
    (addMouseWheelZoom as any)(Highcharts);
}

const TIMEFRAMES = ['15m', '1h', '4h', '24h', '7d'] as const;
type Timeframe = typeof TIMEFRAMES[number];
type XAxisMode = 'mcap' | 'change';
const LIMIT_OPTIONS = [50, 100, 150, 200, 250];

const COLOR_GREEN = '#4e843c';
const COLOR_RED = '#C2544E';

// SITE LOGO PARA FALLBACK FINAL
const SITE_LOGO = 'https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png';

// Helper for Unicode-safe Base64 Encoding
const safeEncodeBase64 = (str: string) => {
    try {
        return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
        return '';
    }
};

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
  if (val > 0) return isText ? `text-[${COLOR_GREEN}] font-bold` : `bg-[${COLOR_GREEN}]/20 text-[${COLOR_GREEN}]`;
  if (val < 0) return isText ? `text-[${COLOR_RED}] font-bold` : `bg-[${COLOR_RED}]/20 text-[${COLOR_RED}]`;
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

// ... Sidebar components remain same ... 
const MacdGauge: React.FC<{ bullishPct: number, avgNMacd: number }> = ({ bullishPct, avgNMacd }) => {
    const rotation = -90 + (clamp(bullishPct, 0, 100) / 100) * 180;
    const label = avgNMacd > 0.5 ? "Strong Buy" : avgNMacd > 0 ? "Buy" : avgNMacd < -0.5 ? "Strong Sell" : "Sell";
    
    return (
        <div className="flex flex-col items-center justify-center h-full py-2">
            <div className="relative w-full max-w-[240px] -mt-2">
                <svg viewBox="0 0 200 100" className="w-full overflow-visible">
                    <defs>
                        <linearGradient id="macdSidebarGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={COLOR_RED} />
                            <stop offset="50%" stopColor="#fbbf24" />
                            <stop offset="100%" stopColor={COLOR_GREEN} />
                        </linearGradient>
                    </defs>
                    <path d="M 15 80 A 85 85 0 0 1 185 80" fill="none" className="stroke-[#eeeeee] dark:stroke-[#333]" strokeWidth="16" strokeLinecap="round"/>
                    <path d="M 15 80 A 85 85 0 0 1 185 80" fill="none" stroke="url(#macdSidebarGrad)" strokeWidth="16" strokeDasharray={`${(bullishPct/100)*267} 267`} strokeLinecap="round" />
                    <g transform={`rotate(${rotation} 100 80)`}>
                        <path d="M 100 80 L 100 10" className="stroke-gray-800 dark:stroke-white" strokeWidth="4" /><circle cx={100} cy={80} r="5" className="fill-gray-800 dark:fill-white" />
                    </g>
                </svg>
            </div>
            <div className="flex flex-col items-center -mt-1 z-10">
                <div className="text-3xl font-black text-[#dd9933] leading-none font-mono tracking-tighter">{avgNMacd.toFixed(2)}</div>
                <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mt-1 tracking-widest">Avg Normalized MACD</div>
                <div className={`text-xs font-black uppercase mt-1 ${avgNMacd > 0 ? `text-[${COLOR_GREEN}]` : `text-[${COLOR_RED}]`}`}>{label}</div>
            </div>
        </div>
    );
};

// === COMPONENTE DEDICADO PARA GRID (MAIN BOARD) ===
const MacdGridWidget: React.FC<{ language: Language }> = ({ language }) => {
    const [avgData, setAvgData] = useState<MacdAvgData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMacdAverage().then((avg) => {
            setAvgData(avg);
            setLoading(false);
        });
    }, []);

    const Watermark = () => <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-[0.05] z-0"><img src={SITE_LOGO} alt="watermark" className="w-3/4 h-auto grayscale filter" /></div>;

    if (loading || !avgData) return <div className="flex items-center justify-center h-full text-slate-500"><Loader2 className="animate-spin" /></div>;

    const bullishPct = avgData.bullishPercentage || 50;
    const avgNMacd = avgData.averageNMacd || 0;
    const rotation = -90 + (clamp(bullishPct, 0, 100) / 100) * 180;
    const label = avgNMacd > 0.5 ? "Strong Buy" : avgNMacd > 0 ? "Buy" : avgNMacd < -0.5 ? "Strong Sell" : "Sell";

    return (
        <div className="h-full flex flex-col justify-center gap-1 p-2 relative text-center bg-white dark:bg-[#2f3032]">
            <Watermark />
            <div className="flex items-center justify-center relative mt-3 z-10">
                <svg viewBox="0 0 200 110" className="w-[85%] max-w-[280px]">
                    <defs>
                        <linearGradient id="macdGridGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={COLOR_RED} />
                            <stop offset="50%" stopColor="#fbbf24" />
                            <stop offset="100%" stopColor={COLOR_GREEN} />
                        </linearGradient>
                    </defs>
                    <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" className="stroke-[#eeeeee] dark:stroke-[#333]" strokeWidth="18" strokeLinecap="round"/>
                    <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="url(#macdGridGrad)" strokeWidth="18" strokeDasharray={`${(bullishPct/100)*283} 283`} strokeLinecap="round" />
                    <g transform={`rotate(${rotation} 100 100)`}>
                        <path d="M 100 100 L 100 20" className="stroke-gray-800 dark:stroke-white" strokeWidth="3" /><circle cx={100} cy={100} r="5" className="fill-gray-800 dark:fill-white" />
                    </g>
                </svg>
            </div>
            <div className="flex flex-col items-center mt-2 z-10">
                <div className="text-3xl font-black text-[#dd9933] leading-none font-mono tracking-tighter">{avgNMacd.toFixed(2)}</div>
                <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mt-1 tracking-widest">Avg Normalized MACD</div>
                <div className={`text-xs font-black uppercase mt-1 ${avgNMacd > 0 ? `text-[${COLOR_GREEN}]` : `text-[${COLOR_RED}]`}`}>{label}</div>
            </div>
            <div className="flex justify-around w-full mt-2 text-center z-10 border-t border-gray-200 dark:border-slate-700/30 pt-2 pb-2">
                <div><div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">Ontem</div><div className={`text-sm font-bold font-mono ${getMacdColor(avgData.yesterdayNMacd, true)}`}>{avgData.yesterdayNMacd.toFixed(3)}</div></div>
                <div><div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">7 Dias</div><div className="text-sm font-bold font-mono text-gray-800 dark:text-white">{(avgData.days7Ago > 100 ? avgData.days7Ago / 1000 : avgData.days7Ago).toFixed(3)}</div></div>
                <div><div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">30 Dias</div><div className="text-sm font-bold font-mono text-gray-800 dark:text-white">{(avgData.days30Ago > 100 ? avgData.days30Ago / 1000 : avgData.days30Ago).toFixed(3)}</div></div>
            </div>
        </div>
    );
};

export const MacdSidebar: React.FC<{ language?: Language }> = ({ language = 'pt' }) => {
    // ... existing ...
    const [avgData, setAvgData] = useState<MacdAvgData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMacdAverage().then((avg) => {
            setAvgData(avg);
            setLoading(false);
        });
    }, []);

    if (loading || !avgData) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;
    // ... render logic from before ...
    const bullishPct = avgData.bullishPercentage || 50;
    const bearishPct = avgData.bearishPercentage || 50;
    return (
        <div className="flex flex-col gap-3 h-full">
            <div className="flex-1 bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm flex flex-col relative overflow-hidden">
                <div className="flex justify-between items-center mb-1 shrink-0">
                    <h3 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider">Global Trend (Bullish %)</h3>
                    <Info size={14} className="text-slate-400" />
                </div>
                <MacdGauge bullishPct={bullishPct} avgNMacd={avgData.averageNMacd} />
            </div>
            <div className="shrink-0 bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider">Market Breath</h3>
                </div>
                <div className="flex justify-between text-[9px] font-black uppercase mb-1.5 opacity-80">
                    <span style={{ color: COLOR_RED }}>Bearish {bearishPct.toFixed(1)}%</span>
                    <span style={{ color: COLOR_GREEN }}>Bullish {bullishPct.toFixed(1)}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden flex relative border border-gray-200 dark:border-slate-700">
                    <div className="h-full" style={{ width: `${bearishPct}%`, backgroundColor: COLOR_RED }}></div>
                    <div className="h-full flex-1" style={{ backgroundColor: COLOR_GREEN }}></div>
                </div>
            </div>
            <div className="shrink-0 bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider">Histórico (N-MACD)</h3>
                </div>
                <div className="space-y-1.5">
                    {[
                        { l: 'Ontem', v: avgData?.yesterdayNMacd },
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
  const [logoReady, setLogoReady] = useState(false);
  
  const [points, setPoints] = useState<MacdTrackerPoint[]>([]);
  
  // Controls
  const [timeframe, setTimeframe] = useState<Timeframe>('4h');
  const [xMode, setXMode] = useState<XAxisMode>('mcap');
  const [limit, setLimit] = useState(50); // New limit state

  useEffect(() => {
    let mounted = true;
    initLogoService()
      .then(() => { if (mounted) setLogoReady(true); })
      .catch(() => { if (mounted) setLogoReady(true); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
      fetchMacdTracker().then(data => {
          if (data && Array.isArray(data) && data.length > 0) setPoints(data);
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

    // Apply slice limit here
    const seriesData = points
        .filter(r => r.marketCap && r.marketCap > 0 && r.macd?.[timeframe])
        .slice(0, limit)
        .map(r => {
            let xVal = 0;
            if (xMode === 'mcap') xVal = r.marketCap || 0;
            else xVal = r.change24h || 0;

            const macdData = r.macd?.[timeframe];
            const yVal = macdData?.nmacd || 0; 
            const isBullish = yVal > 0;
            const symbolShort = (r.symbol || 'UNK').substring(0, 3).toUpperCase();

            const coinId = (r as any).id || (r.symbol ? r.symbol.toLowerCase() : 'unknown');
            const logoUrl = `https://s2.coinmarketcap.com/static/img/coins/64x64/${coinId}.png`;
            const fallbackLogo = r.logo || SITE_LOGO;
            
            return {
                id: coinId,
                x: xVal, // X = Market Cap / Change
                y: yVal, // Y = MACD
                z: r.marketCap,
                name: r.symbol,
                fullName: r.name,
                price: r.price,
                change: r.change24h,
                isBullish: isBullish,
                logoUrl,
                fallbackLogo,
                symbolShort,
                allMacd: r.macd // Pass ALL data for tooltip
            };
        });
    
    seriesData.sort((a, b) => a.name.localeCompare(b.name));

    if (chartInstance.current) {
        chartInstance.current.series[0].setData(seriesData, true, { duration: 1000, easing: 'easeOutQuart' }, true);
        
        const xAxisType = xMode === 'change' ? 'linear' : 'logarithmic';
        const xTitle = xMode === 'mcap' ? 'Market Cap (Log)' : 'Variação 24h (%)';
        
        chartInstance.current.xAxis[0].update({
             type: xAxisType,
             reversed: xMode === 'mcap',
             title: { text: xTitle },
             plotLines: xMode === 'change' ? [{ value: 0, color: textColor, width: 1, dashStyle: 'Dash', zIndex: 2 }] : []
        });

        return;
    }

    const xAxisType = xMode === 'change' ? 'linear' : 'logarithmic';
    const xTitle = xMode === 'mcap' ? 'Market Cap (Log)' : 'Variação 24h (%)';
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
            borderRadius: 12,
            style: { color: isDark ? '#fff' : '#000', zIndex: 9999 },
            outside: true, 
            snap: 2,
            positioner: function (labelWidth: number, labelHeight: number, point: any) {
                return { x: point.plotX - labelWidth / 2, y: point.plotY - labelHeight - 40 };
            },
            formatter: function (this: any) {
                const p = this.point;
                const logo = p.options.logoUrl || p.options.fallbackLogo;
                const changeColor = p.options.change >= 0 ? COLOR_GREEN : COLOR_RED;

                // Helper for color
                const getValColor = (v: number) => (v > 0 ? COLOR_GREEN : v < 0 ? COLOR_RED : (isDark ? '#94a3b8' : '#64748b'));

                const tfHtml = TIMEFRAMES.map(tf => {
                    // Extract N-MACD from nested structure
                    const val = p.options.allMacd?.[tf]?.nmacd || 0;
                    const c = getValColor(val);
                    return `
                        <div style="display:flex; flex-direction:column; align-items:center;">
                            <span style="font-size:9px; font-weight:700; color:${isDark ? '#555' : '#888'}; text-transform:uppercase;">${tf}</span>
                            <span style="font-size:11px; font-weight:800; color:${c}; font-family:monospace;">${val.toFixed(3)}</span>
                        </div>
                    `;
                }).join('');

                return `
                    <div style="padding: 8px; min-width: 180px;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; border-bottom:1px solid ${isDark ? '#334155' : '#e2e8f0'}; padding-bottom:8px;">
                            <img src="${logo}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;" />
                            <div>
                                <div style="font-weight:900; font-size:14px; line-height:1;">${p.name}</div>
                                <div style="font-size:10px; font-weight:700; color:${isDark ? '#64748b' : '#94a3b8'}; text-transform:uppercase; margin-top:2px;">N-MACD Matrix</div>
                            </div>
                        </div>
                        
                        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px;">
                            <div style="font-size:16px; font-weight:800; font-family:monospace;">$${formatCompactNumber(p.options.price)}</div>
                            <div style="font-size:12px; font-weight:800; color:${changeColor};">${p.options.change > 0 ? '+' : ''}${p.options.change.toFixed(2)}%</div>
                        </div>

                        <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:8px; background:${isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)'}; padding:6px; border-radius:6px;">
                            ${tfHtml}
                        </div>
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
                    align: 'center',
                    verticalAlign: 'middle',
                    y: 0,
                    x: 0,
                    formatter: function (this: any) {
                        const p = this.point;
                        const isBullish = p.options.isBullish;
                        const color = isBullish ? COLOR_GREEN : COLOR_RED;
                        const symbol = isBullish ? '▲' : '▼'; 
                        const logo = p.options.logoUrl;
                        const short = p.options.symbolShort || '';

                        return `
                        <div style="position: relative; width: 24px; height: 24px;">
                            <div style="position: absolute; inset: 0; background: #334155; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: bold; color: #fff; z-index: 1;">${short.charAt(0)}</div>
                            <img src="${logo}" 
                                 style="position: relative; width: 24px; height: 24px; border-radius: 50%; object-fit: cover; z-index: 2; background: transparent;" 
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
        series: [{ name: 'Coins', data: seriesData, color: 'rgba(156, 163, 175, 0.5)' }]
    } as any);

  }, [points, timeframe, xMode, isDark, limit, logoReady]);

  return (
    <div className="bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-4 h-full flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.05] z-0">
            <img src={SITE_LOGO} alt="watermark" className="w-1/2 h-auto grayscale filter" />
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 z-10 relative">
            <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900 dark:text-white uppercase text-sm tracking-wider">MACD Scatter Map</h3>
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

// ... MacdTableList ...
export const MacdTableList: React.FC<{ isPage?: boolean }> = ({ isPage = false }) => {
    
    const renderMacdCell = (r: MacdTrackerPoint, tf: string) => {
        const val = r.macd?.[tf]?.nmacd;
        let colorClass = 'text-gray-500 dark:text-slate-400';
        if (val > 0) colorClass = 'text-green-600 dark:text-green-400';
        if (val < 0) colorClass = 'text-red-600 dark:text-red-400';
        
        return (
            <td key={`macd${tf}`} className={`p-3 text-center font-mono font-black ${colorClass}`}>
                {val?.toFixed(4)}
            </td>
        );
    };

    const renderCell = (r: MacdTrackerPoint, colId: string) => {
      switch (colId) {
          case 'asset': return (
              <td key={colId} className="p-3">
                  <div className="flex items-center gap-3">
                      <img 
                            src={`https://s2.coinmarketcap.com/static/img/coins/64x64/${r.id}.png`}
                            className="w-6 h-6 rounded-full border border-gray-200 dark:border-white/10"
                            alt={r.symbol}
                            onError={(e) => { e.currentTarget.src = SITE_LOGO; }}
                      />
                      <div className="flex flex-col"><span className="font-bold text-gray-900 dark:text-slate-200 leading-none">{r.name}</span><span className="text-[10px] font-bold text-gray-500 uppercase">{r.symbol}</span></div>
                  </div>
              </td>
          );
          case 'price': return <td key={colId} className="p-3 text-center font-mono font-bold text-gray-700 dark:text-slate-300">${r.price < 1 ? r.price.toFixed(5) : r.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>;
          case 'mcap': return <td key={colId} className="p-3 text-center font-mono text-gray-500 dark:text-slate-400 text-xs">${formatCompactNumber(r.marketCap || 0)}</td>;
          case 'macd15m': return renderMacdCell(r, '15m');
          case 'macd1h': return renderMacdCell(r, '1h');
          case 'macd4h': return renderMacdCell(r, '4h');
          case 'macd24h': return renderMacdCell(r, '24h');
          case 'macd7d': return renderMacdCell(r, '7d');
          default: return <td key={colId}></td>;
      }
    };
    
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<MacdTrackerPoint[]>([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState('nmacd');
    const [sortTf, setSortTf] = useState<Timeframe>('4h');
    const [sortAsc, setSortAsc] = useState(false);
    const [colOrder, setColOrder] = useState<string[]>(['asset', 'price', 'mcap', 'macd15m', 'macd1h', 'macd4h', 'macd24h', 'macd7d']);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        fetchMacdTablePage({ page, limit: pageSize, sort: sortKey as any, timeframe: sortTf, ascendingOrder: sortAsc, filterText: search })
        .then(res => {
            if(!mounted) return;
            setRows(res.items);
            setTotalPages(res.totalPages);
            setLoading(false);
        });
        return () => { mounted = false; };
    }, [page, pageSize, search, sortKey, sortTf, sortAsc]);

    const handleSort = (key: string) => {
        let tf: Timeframe = '4h';
        if (key.includes('15m')) tf = '15m'; else if (key.includes('1h')) tf = '1h'; else if (key.includes('4h')) tf = '4h'; else if (key.includes('24h')) tf = '24h'; else if (key.includes('7d')) tf = '7d';
        let sk = 'nmacd';
        if (key === 'mcap') sk = 'marketCap'; else if (key === 'price') sk = 'change24h';
        if (sortKey === sk && sortTf === tf) { setSortAsc(!sortAsc); } else { setSortKey(sk); setSortTf(tf); setSortAsc(false); }
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
    
    const sortKeyMap: Record<string, string> = { 
        asset: 'asset', price: 'change24h', mcap: 'marketCap', 
        macd15m: 'macd15m', macd1h: 'macd1h', macd4h: 'macd4h', macd24h: 'macd24h', macd7d: 'macd7d' 
    };
    
    const COLS: Record<string, { id: string; label: string }> = {
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
                            {loading ? <tr><td colSpan={colOrder.length} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-[#dd9933]" /></td></tr> : rows.map(r => <tr key={r.symbol} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">{colOrder.map(colId => renderCell(r, colId))}</tr>)}
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

export const MacdFaq: React.FC<{ language?: Language }> = ({ language = 'pt' }) => {
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const t = getTranslations(language as Language).workspace.pages.faq.macd;
    
    if (!t) return null;

    const items = [
        { q: t.q1, a: t.a1 },
        { q: t.q2, a: t.a2 },
        { q: t.q3, a: t.a3 },
        { q: t.q4, a: t.a4 }
    ];

    return (
        <div className="mt-8 mb-12 max-w-4xl mx-auto px-4">
            <h3 className="text-xl font-black text-gray-800 dark:text-[#dd9933] uppercase tracking-widest text-center mb-8">Metodologia e FAQ</h3>
            <div className="space-y-3">
                {items.map((item, i) => (
                    <div key={i} className="bg-white dark:bg-[#1a1c1e] border border-gray-100 dark:border-tech-800 rounded-xl overflow-hidden shadow-sm transition-all duration-500">
                        <button
                            onClick={() => setOpenIndex(openIndex === i ? null : i)}
                            className="w-full flex items-center justify-between p-5 text-left group"
                        >
                            <span className={`font-bold text-base transition-colors ${openIndex === i ? 'text-[#dd9933]' : 'text-gray-700 dark:text-gray-300'}`}>{item.q}</span>
                            <ChevronDown size={20} className={`text-gray-400 transition-transform duration-500 ${openIndex === i ? 'rotate-180 text-[#dd9933]' : ''}`} />
                        </button>
                        <div className={`transition-all duration-500 ease-in-out ${openIndex === i ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                            <div className="p-5 pt-0 text-base text-gray-500 dark:text-slate-400 leading-relaxed border-t border-transparent dark:border-white/5">
                                <div dangerouslySetInnerHTML={{ __html: item.a }} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const MacdWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
    // 1. Grid Mode: Only Sidebar
    if (!item.isMaximized) {
        return <MacdGridWidget language={language} />;
    }
    
    // 2. Maximized Mode: JUST SCATTER CHART
    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#1a1c1e] p-4 overflow-hidden">
             <div className="flex-1 min-h-0 shadow-sm border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
                 <MacdScatterChart />
             </div>
        </div>
    );
};

export default MacdWidget;
