
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, Info } from 'lucide-react';
import { RsiAvgData, RsiTrackerPoint, RsiTableItem, fetchRsiAverage, fetchRsiTrackerHist, fetchRsiTable } from '../services/api';
import { DashboardItem, Language } from '../../../types';
import { getTranslations } from '../../../locales';
import Highcharts from 'highcharts';

const TIMEFRAMES = ['15m', '1h', '4h', '24h', '7d'];
const LIMIT_OPTIONS = [50, 100, 150, 200, 300];
type XMode = 'marketCap' | 'change';

const formatCompactNumber = (number: number) => {
  if (!number || number === 0) return "---";
  if (number < 1000) return number.toString();
  const suffixes = ["", "K", "M", "B", "T"];
  const suffixNum = Math.floor(("" + Math.floor(number)).length / 3);
  let shortValue = parseFloat((number / Math.pow(1000, suffixNum)).toPrecision(3));
  if (shortValue % 1 !== 0) shortValue = parseFloat(shortValue.toFixed(2));
  return shortValue + suffixes[suffixNum];
};

const getRsiColor = (val: number, isText = false) => {
    if (!val) return isText ? 'text-gray-400' : '';
    if (val >= 70) return isText ? 'text-red-500 font-bold' : 'bg-red-500/20 text-red-500';
    if (val <= 30) return isText ? 'text-green-500 font-bold' : 'bg-green-500/20 text-green-500';
    return isText ? 'text-gray-700 dark:text-slate-300' : 'text-gray-700 dark:text-slate-300';
};

// --- COMPONENT 1: RSI TABLE ---
export const RsiTableList: React.FC<{ filterText?: string }> = ({ filterText }) => {
    const [data, setData] = useState<RsiTableItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetchRsiTable().then(d => {
            if (d && d.length > 0) setData(d);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const filtered = useMemo(() => {
        if (!filterText) return data;
        const q = filterText.toLowerCase();
        return data.filter(i => 
            (i.symbol || '').toLowerCase().includes(q) || 
            (i.name || '').toLowerCase().includes(q)
        );
    }, [data, filterText]);

    if (loading) return <div className="h-60 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;
    if (!data || data.length === 0) return <div className="h-60 flex items-center justify-center text-gray-500 text-xs font-bold uppercase">Sem dados da tabela</div>;

    return (
        <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-[#15191c] rounded-xl border border-gray-100 dark:border-slate-800 shadow-xl">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-[#15191c]">
                <h3 className="text-lg font-bold text-white">Crypto Market RSI Leaders</h3>
            </div>
            <div className="grid grid-cols-[1.5fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-2 px-6 py-3 bg-[#111315] text-[10px] font-black text-gray-500 uppercase tracking-widest sticky top-0 z-10 border-b border-white/5">
                <span>Asset</span>
                <span className="text-right">Price</span>
                <span className="text-center">15m</span>
                <span className="text-center">1h</span>
                <span className="text-center">4h</span>
                <span className="text-center">24h</span>
                <span className="text-center">7d</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-[400px]">
                {filtered.map((item, i) => (
                    <div key={item.id + i} className="grid grid-cols-[1.5fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-2 px-6 py-3 border-b border-white/5 hover:bg-white/5 transition-colors items-center text-sm group">
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 font-mono w-4">{item.rank || i+1}</span>
                            {item.logo && <img src={item.logo} className="w-6 h-6 rounded-full grayscale group-hover:grayscale-0 transition-all" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />}
                            <span className="font-bold text-gray-300 group-hover:text-white transition-colors">{item.name} <span className="text-xs text-gray-500 ml-1">{item.symbol}</span></span>
                        </div>
                        <div className="text-right font-mono text-gray-300 font-bold">
                            ${item.price < 1 ? item.price.toFixed(5) : item.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </div>
                        <div className={`text-center font-bold font-mono ${getRsiColor(item.rsi?.["15m"], true)}`}>{(item.rsi?.["15m"] ?? 0).toFixed(0)}</div>
                        <div className={`text-center font-bold font-mono ${getRsiColor(item.rsi?.["1h"], true)}`}>{(item.rsi?.["1h"] ?? 0).toFixed(0)}</div>
                        <div className={`text-center font-bold font-mono ${getRsiColor(item.rsi?.["4h"], true)}`}>{(item.rsi?.["4h"] ?? 0).toFixed(0)}</div>
                        <div className={`text-center font-bold font-mono ${getRsiColor(item.rsi?.["24h"], true)}`}>{(item.rsi?.["24h"] ?? 0).toFixed(0)}</div>
                        <div className={`text-center font-bold font-mono ${getRsiColor(item.rsi?.["7d"], true)}`}>{(item.rsi?.["7d"] ?? 0).toFixed(0)}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- COMPONENT 2: SCATTER CHART ---
export const RsiScatterChart: React.FC = () => {
    const [data, setData] = useState<RsiTrackerPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState('4h');
    const chartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLoading(true);
        fetchRsiTrackerHist().then(d => {
            if (d && d.length > 0) setData(d);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!chartRef.current || loading || data.length === 0) return;
        
        const seriesData = data
            .slice(0, 300)
            .map(p => {
                const xVal = p.marketCap;
                if (!xVal || xVal <= 0) return null;
                // Allow explicit timeframe access or default to 50
                const rsiVal = (p.rsi as any)?.[timeframe] || 50;
                return {
                    x: xVal, 
                    y: rsiVal, 
                    name: p.symbol, 
                    marketCap: p.marketCap, 
                    rsiVal: rsiVal,
                    marker: { radius: 4 }
                };
            }).filter(p => p !== null);

        Highcharts.chart(chartRef.current, {
            chart: { 
                type: 'scatter', 
                backgroundColor: '#15191c', 
                zoomType: 'xy', 
                style: { fontFamily: 'Inter, sans-serif' }, 
            },
            title: { text: 'Crypto RSI Heatmap', align: 'left', style: { color: '#fff', fontWeight: 'bold' } }, 
            credits: { enabled: false }, 
            exporting: { enabled: false },
            legend: { enabled: false },
            xAxis: { 
                title: { text: 'Market Cap (USD)', style: { color: '#666' } }, 
                type: 'logarithmic', 
                gridLineColor: '#222', 
                labels: { style: { color: '#666' } } 
            },
            yAxis: { 
                title: { text: 'Relative Strength Index', style: { color: '#666' } }, 
                min: 0, 
                max: 100, 
                gridLineColor: '#222', 
                plotLines: [
                    { value: 70, color: '#f87171', dashStyle: 'ShortDash', width: 1, label: { text: 'Overbought', style: { color: '#f87171' }, align: 'right' } },
                    { value: 30, color: '#4ade80', dashStyle: 'ShortDash', width: 1, label: { text: 'Oversold', style: { color: '#4ade80' }, align: 'right' } },
                    { value: 50, color: '#444', width: 1 }
                ],
                plotBands: [
                    { from: 70, to: 100, color: 'rgba(248, 113, 113, 0.1)' },
                    { from: 0, to: 30, color: 'rgba(74, 222, 128, 0.1)' }
                ]
            },
            tooltip: { 
                useHTML: true, 
                backgroundColor: 'rgba(0,0,0,0.8)', 
                borderColor: '#333', 
                style: { color: '#fff' },
                formatter: function(this: any) {
                    return `<b>${this.point.name}</b><br/>RSI: ${this.point.y.toFixed(2)}<br/>Mkt Cap: $${formatCompactNumber(this.point.x)}`;
                }
            },
            plotOptions: {
                scatter: {
                    marker: {
                        radius: 5,
                        symbol: 'circle',
                        states: { hover: { enabled: true, lineColor: 'rgb(100,100,100)' } }
                    },
                    tooltip: { headerFormat: '' }
                }
            },
            series: [{ 
                name: 'Coins', 
                data: seriesData, 
                color: 'rgba(255,255,255,0.5)',
                colorKey: 'y',
                zones: [
                    { value: 30, color: '#4ade80' },
                    { value: 70, color: '#94a3b8' },
                    { color: '#f87171' }
                ]
            }]
        } as any);
    }, [data, loading, timeframe]);

    if (loading) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;
    if (data.length === 0) return <div className="h-96 flex items-center justify-center text-gray-500 text-xs font-bold uppercase">Sem dados do gráfico</div>;

    return (
        <div className="relative w-full h-full bg-[#15191c] rounded-xl border border-slate-800 p-4 shadow-xl">
            <div className="absolute top-4 right-4 z-10">
                <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className="bg-[#222] text-xs font-bold text-white p-1 rounded border border-[#333] outline-none cursor-pointer">
                    {TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf.toUpperCase()}</option>)}
                </select>
            </div>
            {/* Added w-full h-full to container to ensure Highcharts renders */}
            <div ref={chartRef} className="rounded-lg overflow-hidden w-full h-full" />
        </div>
    );
};

// --- COMPONENT 3: GAUGE (SPEEDOMETER) ---
export const RsiGauge: React.FC<{ language?: Language }> = ({ language = 'pt' }) => {
    const [data, setData] = useState({ averageRsi: 50, yesterday: 50, days7Ago: 50, days30Ago: 50 });
    const [loading, setLoading] = useState(true);
    const t = getTranslations(language as Language).dashboard.widgets.rsi;

    const GAUGE_CX = 100;
    const GAUGE_CY = 75;
    const GAUGE_R = 65;
    const GAUGE_RY = 65;
    const GAUGE_STROKE = 10;
    const TEXT_VAL_Y = 104;
    const TEXT_LBL_Y = 122;

    useEffect(() => {
        fetchRsiAverage().then(d => {
            if (d) setData(d);
            setLoading(false);
        });
    }, []);

    const Watermark = () => <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-[0.05] z-0"><img src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" alt="watermark" className="w-3/4 h-auto grayscale filter" /></div>;

    if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-slate-500" /></div>;

    const rsiVal = data?.averageRsi ?? 50;
    const label = rsiVal < 30 ? t.oversold : rsiVal > 70 ? t.overbought : t.neutral;
    const rotation = -90 + (Math.max(0, Math.min(100, rsiVal)) / 100) * 180;

    return (
        <div className="h-full flex flex-col justify-center gap-2 p-2 relative text-center bg-white dark:bg-[#2f3032]">
            <Watermark />
            
            {/* GAUGE */}
            <div className="flex items-center justify-center relative mt-6 z-10">
                <svg viewBox="0 0 200 135" className="w-[85%] max-w-[280px] overflow-visible">
                    <defs>
                        <linearGradient id="rsiGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#548f3f" />
                            <stop offset="50%" stopColor="#FFD700" />
                            <stop offset="100%" stopColor="#CD534B" />
                        </linearGradient>
                    </defs>

                    <path
                        d={`M ${GAUGE_CX - GAUGE_R} ${GAUGE_CY} A ${GAUGE_R} ${GAUGE_RY} 0 0 1 ${GAUGE_CX + GAUGE_R} ${GAUGE_CY}`}
                        fill="none"
                        stroke="currentColor"
                        className="text-gray-200 dark:text-slate-800"
                        strokeWidth={GAUGE_STROKE}
                        strokeLinecap="round"
                    />
                    <path
                        d={`M ${GAUGE_CX - GAUGE_R} ${GAUGE_CY} A ${GAUGE_R} ${GAUGE_RY} 0 0 1 ${GAUGE_CX + GAUGE_R} ${GAUGE_CY}`}
                        fill="none"
                        stroke="url(#rsiGradient)"
                        strokeWidth={GAUGE_STROKE}
                        strokeLinecap="round"
                    />

                    <g transform={`rotate(${rotation} ${GAUGE_CX} ${GAUGE_CY})`}>
                        <path
                            d={`M ${GAUGE_CX} ${GAUGE_CY} L ${GAUGE_CX} ${GAUGE_CY - GAUGE_RY + 2}`}
                            stroke="var(--color-text-main)"
                            strokeWidth="4"
                            strokeLinecap="round"
                        />
                        <circle cx={GAUGE_CX} cy={GAUGE_CY} r="5" fill="var(--color-text-main)" />
                    </g>

                    <text
                        x={GAUGE_CX}
                        y={TEXT_VAL_Y}
                        textAnchor="middle"
                        fill="#dd9933"
                        fontSize="24"
                        fontWeight="900"
                        fontFamily="monospace"
                    >
                        {rsiVal.toFixed(2)}
                    </text>

                    <text
                        x={GAUGE_CX}
                        y={TEXT_LBL_Y}
                        textAnchor="middle"
                        fill="var(--color-text-main)"
                        fontSize="12"
                        fontWeight="900"
                        letterSpacing="1"
                        style={{ textTransform: 'uppercase' }}
                    >
                        {label}
                    </text>
                </svg>
            </div>

            {/* HORIZONTAL FOOTER */}
            <div className="flex justify-around w-full mt-2 text-center z-10 border-t border-gray-200 dark:border-slate-700/30 pt-2 pb-2">
                <div>
                    <div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">ONTEM</div>
                    <div className="text-sm font-bold text-gray-800 dark:text-white">{(data?.yesterday ?? 0).toFixed(0)}</div>
                </div>
                <div>
                    <div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">SEMANA</div>
                    <div className="text-sm font-bold text-gray-800 dark:text-white">{(data?.days7Ago ?? 0).toFixed(0)}</div>
                </div>
                <div>
                    <div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">MÊS</div>
                    <div className="text-sm font-bold text-gray-800 dark:text-white">{(data?.days30Ago ?? 0).toFixed(0)}</div>
                </div>
            </div>
        </div>
    );
};

// --- MAIN WIDGET EXPORT ---
const RsiWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
    if (item.isMaximized) {
        return (
            <div className="h-full flex flex-col p-4 bg-white dark:bg-[#1a1c1e] relative">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 px-2">RSI Tracker (Scatter Analysis)</h3>
                <div className="flex-1 overflow-hidden">
                    <RsiScatterChart />
                </div>
            </div>
        );
    }
    return <RsiGauge language={language} />;
};

export default RsiWidget;
