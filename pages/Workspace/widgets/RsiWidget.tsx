
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Info, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import Highcharts from 'highcharts';
import { Language, DashboardItem } from '../../../types';
import { getTranslations } from '../../../locales';
import {
  RsiAvgData,
  RsiTableItem,
  fetchRsiAverage,
  fetchRsiTable,
  fetchRsiTablePage
} from '../services/api';

const TIMEFRAMES = ['15m', '1h', '4h', '24h', '7d'] as const;
type Timeframe = typeof TIMEFRAMES[number];

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

const GaugeChart: React.FC<{ value: number, label: string, isDark: boolean }> = ({ value, label, isDark }) => {
    const cx = 100;
    const cy = 100; // Half circle bottom
    const r = 80;
    const strokeWidth = 12;
    
    // Convert 0-100 to angle -90 to +90
    const angle = Math.min(Math.max((value / 100) * 180 - 90, -90), 90);
    
    return (
        <div className="flex flex-col items-center justify-center relative h-[160px]">
            <svg viewBox="0 0 200 120" className="w-full h-full overflow-visible">
                <defs>
                    <linearGradient id="rsiGaugeGradSidebar" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#4ade80" /> {/* Green (Oversold) */}
                        <stop offset="50%" stopColor="#fbbf24" /> {/* Yellow */}
                        <stop offset="100%" stopColor="#f87171" /> {/* Red (Overbought) */}
                    </linearGradient>
                </defs>
                {/* Background Arc */}
                <path 
                    d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} 
                    fill="none" 
                    stroke={isDark ? "#334155" : "#e2e8f0"} 
                    strokeWidth={strokeWidth} 
                    strokeLinecap="round" 
                />
                {/* Value Arc */}
                <path 
                    d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} 
                    fill="none" 
                    stroke="url(#rsiGaugeGradSidebar)" 
                    strokeWidth={strokeWidth} 
                    strokeLinecap="round"
                    strokeDasharray={`${(Math.PI * r)}`}
                    strokeDashoffset={`${(Math.PI * r) * (1 - value/100)}`} 
                    className="transition-all duration-1000 ease-out"
                />
                {/* Needle */}
                <g transform={`rotate(${angle}, ${cx}, ${cy})`} className="transition-all duration-700 ease-out">
                    <path d={`M ${cx} ${cy} L ${cx} ${cy - r + 5}`} stroke={isDark ? "#fff" : "#1f2937"} strokeWidth="3" />
                    <circle cx={cx} cy={cy} r="4" fill={isDark ? "#fff" : "#1f2937"} />
                </g>
                
                <text x={cx} y={cy - 25} textAnchor="middle" className="text-4xl font-black fill-white dark:fill-white font-mono" style={{ fontSize: '32px' }}>
                    {value.toFixed(2)}
                </text>
            </svg>
            <div className="flex justify-between w-full px-4 -mt-4 text-[10px] font-bold text-gray-500 uppercase">
                <span>Oversold</span>
                <span>Overbought</span>
            </div>
        </div>
    );
};

// 1. Left Sidebar Container (Exported as RsiGauge for compatibility)
export const RsiGauge: React.FC<{ language?: Language }> = ({ language = 'pt' }) => {
  const isDark = useIsDark();
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

  const timeframe: Timeframe = '4h'; // Default for avg calc
  const avgRsi = useMemo(() => computeAvgRsi(tableData, timeframe), [tableData, timeframe]);
  const counts = useMemo(() => computeCounts(tableData, timeframe), [tableData, timeframe]);
  const total = counts.valid || 1;
  const osPct = (counts.oversold / total) * 100;
  const obPct = (counts.overbought / total) * 100;

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="flex flex-col gap-4 h-full">
        {/* Box 1: Average RSI */}
        <div className="bg-[#1a1c1e] rounded-xl border border-slate-800 p-5 shadow-lg">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-white text-sm uppercase">Average Crypto RSI</h3>
                <Info size={14} className="text-slate-500" />
            </div>
            <GaugeChart value={avgRsi} label="" isDark={isDark} />
        </div>

        {/* Box 2: OB vs OS */}
        <div className="bg-[#1a1c1e] rounded-xl border border-slate-800 p-5 shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white text-sm uppercase">Overbought vs Oversold</h3>
                <Info size={14} className="text-slate-500" />
            </div>
            <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-green-400 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-400"></div> Oversold {osPct.toFixed(1)}%</span>
                <span className="text-red-400 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400"></div> Overbought {obPct.toFixed(1)}%</span>
            </div>
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex relative">
                <div className="h-full bg-green-500" style={{ width: `${osPct}%` }}></div>
                <div className="h-full bg-slate-700 flex-1"></div> {/* Neutral space */}
                <div className="h-full bg-red-500" style={{ width: `${obPct}%` }}></div>
            </div>
        </div>

        {/* Box 3: Historical */}
        <div className="bg-[#1a1c1e] rounded-xl border border-slate-800 p-5 shadow-lg flex-1">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white text-sm uppercase">Historical RSI Values</h3>
                <Info size={14} className="text-slate-500" />
            </div>
            <div className="space-y-2">
                {[
                    { l: 'Yesterday', v: avgData?.yesterday },
                    { l: '7 Days Ago', v: avgData?.days7Ago },
                    { l: '30 Days Ago', v: avgData?.days30Ago },
                    { l: '90 Days Ago', v: avgData?.days90Ago }
                ].map((h, i) => (
                    <div key={i} className="flex justify-between items-center bg-white/5 p-2 rounded px-3">
                        <span className="text-xs font-bold text-slate-400 uppercase">{h.l}</span>
                        <span className={`text-sm font-black font-mono ${getRsiColor(h.v || 50, true)}`}>
                            {h.v ? h.v.toFixed(2) : '-'}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

// 2. Scatter Chart (Exported as RsiScatterChart)
export const RsiScatterChart: React.FC = () => {
  const isDark = useIsDark();
  const chartRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<RsiTableItem[]>([]);
  const [timeframe, setTimeframe] = useState<Timeframe>('4h');

  useEffect(() => {
      fetchRsiTable({ force: false }).then(data => {
          if (data) setRows(data);
      });
  }, []);

  useEffect(() => {
    if (!chartRef.current || rows.length === 0) return;

    const bgColor = isDark ? '#1a1c1e' : '#ffffff';
    const textColor = isDark ? '#e2e8f0' : '#334155';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    const seriesData = rows
        .filter(r => r.marketCap && r.marketCap > 0 && r.rsi?.[timeframe])
        .map(r => ({
            x: r.marketCap,
            y: r.rsi?.[timeframe],
            z: r.volume24h, // Size bubble by volume if wanted, or plain scatter
            name: r.symbol,
            fullName: r.name,
            price: r.price,
            marker: {
                symbol: `url(${r.logo})`,
                width: 24,
                height: 24
            }
        }));

    Highcharts.chart(chartRef.current, {
        chart: {
            type: 'scatter',
            backgroundColor: bgColor,
            style: { fontFamily: 'Inter, sans-serif' },
            height: 420
        },
        title: { text: null },
        credits: { enabled: false },
        legend: { enabled: false },
        xAxis: {
            type: 'logarithmic',
            reversed: true, // High Mcap on left (like in screenshot)
            title: { text: 'Market Cap (USD)', style: { color: '#64748b' } },
            gridLineColor: gridColor,
            labels: {
                style: { color: '#64748b' },
                formatter: function (this: any) { return '$' + formatCompactNumber(this.value); }
            },
            lineColor: gridColor,
            tickColor: gridColor
        },
        yAxis: {
            title: { text: 'Relative Strength Index', style: { color: '#64748b' } },
            min: 0, 
            max: 100,
            gridLineColor: gridColor,
            gridLineDashStyle: 'Dash',
            labels: { style: { color: '#64748b' } },
            plotLines: [
                { value: 70, color: '#f87171', dashStyle: 'ShortDash', width: 1, label: { text: 'Overbought', align: 'right', style: { color: '#f87171' } }, zIndex: 5 },
                { value: 30, color: '#4ade80', dashStyle: 'ShortDash', width: 1, label: { text: 'Oversold', align: 'right', style: { color: '#4ade80' } }, zIndex: 5 },
                { value: 50, color: '#64748b', width: 1, zIndex: 5 }
            ],
            plotBands: [
                { from: 70, to: 100, color: 'rgba(248, 113, 113, 0.08)' }, // Red Tint
                { from: 0, to: 30, color: 'rgba(74, 222, 128, 0.08)' }    // Green Tint
            ]
        },
        tooltip: {
            useHTML: true,
            backgroundColor: isDark ? 'rgba(26, 28, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: '#334155',
            borderRadius: 8,
            style: { color: textColor },
            formatter: function (this: any) {
                const p = this.point;
                return `
                    <div style="display:flex; align-items:center; gap:8px; min-width:120px;">
                        <div style="font-weight:900; font-size:14px;">${p.name}</div>
                        <div style="font-size:12px; color:#94a3b8;">$${formatCompactNumber(p.options.price)}</div>
                    </div>
                    <div style="margin-top:4px;">
                        <span style="color:#94a3b8;">RSI:</span> <b>${p.y.toFixed(2)}</b>
                    </div>
                    <div>
                        <span style="color:#94a3b8;">Mcap:</span> <b>$${formatCompactNumber(p.x)}</b>
                    </div>
                `;
            }
        },
        plotOptions: {
            scatter: {
                marker: {
                    radius: 5, // Fallback radius
                    states: { hover: { enabled: true, lineColor: 'rgb(100,100,100)' } }
                }
            }
        },
        series: [{
            name: 'Coins',
            data: seriesData
        }]
    } as any);

  }, [rows, timeframe, isDark]);

  return (
    <div className="bg-[#1a1c1e] rounded-xl border border-slate-800 shadow-lg p-4 h-full flex flex-col">
        <div className="flex justify-between items-center mb-4 px-2">
            <div className="flex items-center gap-2">
                <h3 className="font-bold text-white uppercase text-sm">Crypto RSI Heatmap</h3>
                <Info size={14} className="text-slate-500" />
            </div>
            <select 
                value={timeframe} 
                onChange={e => setTimeframe(e.target.value as Timeframe)}
                className="bg-[#2f3032] text-white text-xs font-bold px-3 py-1 rounded border border-slate-700 outline-none"
            >
                {TIMEFRAMES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
            </select>
        </div>
        <div className="flex-1 w-full min-h-[350px] relative rounded-lg overflow-hidden">
            {rows.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500"><Loader2 className="animate-spin" /></div>
            ) : (
                <div ref={chartRef} className="absolute inset-0" />
            )}
        </div>
    </div>
  );
};

// 3. Table List (Exported as RsiTableList)
export const RsiTableList: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RsiTableItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const timeframe = '4h';

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchRsiTablePage({
      page,
      limit: pageSize,
      sort: `rsi${timeframe}` as any,
      ascendingOrder: false,
      filterText: search
    }).then(res => {
        if(!mounted) return;
        setRows(res.items);
        setTotalPages(res.totalPages);
        setLoading(false);
    });
    return () => { mounted = false; };
  }, [page, pageSize, search]);

  return (
      <div className="bg-[#1a1c1e] rounded-xl border border-slate-800 shadow-lg flex flex-col overflow-hidden h-full">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3">
            <h3 className="font-bold text-white text-sm uppercase">RSI Data Table</h3>
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                    <input 
                        type="text" 
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search coin..." 
                        className="w-full bg-[#2f3032] border border-slate-700 text-slate-200 text-xs py-2 pl-9 pr-3 rounded focus:border-[#dd9933] outline-none"
                    />
                </div>
            </div>
        </div>
        
        <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
                <thead className="bg-[#2f3032] sticky top-0 z-10 text-[10px] uppercase font-black text-slate-400">
                    <tr>
                        <th className="p-3 text-center w-12">#</th>
                        <th className="p-3">Asset</th>
                        <th className="p-3 text-right">Price</th>
                        <th className="p-3 text-center">15m</th>
                        <th className="p-3 text-center">1h</th>
                        <th className="p-3 text-center bg-[#222] text-[#dd9933]">4h</th>
                        <th className="p-3 text-center">24h</th>
                        <th className="p-3 text-center">7d</th>
                        <th className="p-3 text-right">Mkt Cap</th>
                        <th className="p-3 text-right">Vol 24h</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm">
                    {loading ? (
                        <tr><td colSpan={10} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-[#dd9933]" /></td></tr>
                    ) : rows.map((r, i) => (
                        <tr key={r.id} className="hover:bg-white/5 transition-colors">
                            <td className="p-3 text-center text-slate-500 font-mono text-xs">{r.rank}</td>
                            <td className="p-3">
                                <div className="flex items-center gap-3">
                                    <img src={r.logo} className="w-6 h-6 rounded-full bg-white p-0.5" alt="" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-200 leading-none">{r.name}</span>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">{r.symbol}</span>
                                    </div>
                                </div>
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-300">
                                ${r.price < 1 ? r.price.toFixed(5) : r.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </td>
                            <td className={`p-3 text-center font-mono font-bold ${getRsiColor(r.rsi["15m"], true)}`}>{r.rsi["15m"]?.toFixed(0)}</td>
                            <td className={`p-3 text-center font-mono font-bold ${getRsiColor(r.rsi["1h"], true)}`}>{r.rsi["1h"]?.toFixed(0)}</td>
                            <td className={`p-3 text-center font-mono font-bold bg-white/5 ${getRsiColor(r.rsi["4h"], true)}`}>{r.rsi["4h"]?.toFixed(0)}</td>
                            <td className={`p-3 text-center font-mono font-bold ${getRsiColor(r.rsi["24h"], true)}`}>{r.rsi["24h"]?.toFixed(0)}</td>
                            <td className={`p-3 text-center font-mono font-bold ${getRsiColor(r.rsi["7d"], true)}`}>{r.rsi["7d"]?.toFixed(0)}</td>
                            <td className="p-3 text-right font-mono text-slate-400 text-xs">${formatCompactNumber(r.marketCap || 0)}</td>
                            <td className="p-3 text-right font-mono text-slate-400 text-xs">${formatCompactNumber(r.volume24h || 0)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        <div className="p-3 border-t border-slate-800 flex justify-between items-center bg-[#2f3032]">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 hover:bg-white/10 rounded disabled:opacity-50 text-white"><ChevronLeft size={16}/></button>
            <span className="text-xs font-bold text-slate-400">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 hover:bg-white/10 rounded disabled:opacity-50 text-white"><ChevronRight size={16}/></button>
        </div>
      </div>
  );
};

// Default export for Workspace Grid Widget (Reformatted to match Fear&Greed/AltSeason)
const RsiWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
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
            <div className="h-full flex flex-col p-4 bg-white dark:bg-[#1a1c1e] relative">
                <Watermark />
                <div className="flex-1 overflow-auto z-10 custom-scrollbar">
                    <div className="flex items-center justify-center h-full">
                        {/* We reuse the sidebar gauge chart component for maximized view but bigger */}
                        <div className="scale-150">
                            <GaugeChart value={rsiVal} label="" isDark={document.documentElement.classList.contains('dark')} />
                        </div>
                    </div>
                </div>
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
                    <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" className="stroke-[#eeeeee] dark:stroke-[#333]" strokeWidth="18" strokeLinecap="round"/>
                    <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="url(#rsiGaugeGradWidget)" strokeWidth="18" strokeDasharray={`${(rsiVal/100)*283} 283`} strokeLinecap="round" />
                    <g transform={`rotate(${rotation} 100 100)`}>
                        <path d="M 100 100 L 100 20" className="stroke-gray-800 dark:stroke-white" strokeWidth="3" /><circle cx={100} cy={100} r="5" className="fill-gray-800 dark:fill-white" />
                    </g>
                </svg>
            </div>
            {/* Margem ajustada: mt-2 para dar "respiro" entre o ponteiro e o número */}
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
