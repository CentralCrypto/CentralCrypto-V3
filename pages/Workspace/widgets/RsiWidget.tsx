
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2 } from 'lucide-react';
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

const useIsDark = () => {
    const [isDark, setIsDark] = useState(false);
    useEffect(() => {
        const check = () => setIsDark(document.documentElement.classList.contains('dark'));
        check();
        const observer = new MutationObserver(check);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);
    return isDark;
};

// --- COMPONENT 1: RSI TABLE ---
export const RsiTableList: React.FC<{ filterText?: string }> = ({ filterText }) => {
    const [data, setData] = useState<RsiTableItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetchRsiTable().then(d => {
            setData(d);
            setLoading(false);
        });
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

    return (
        <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-[#1a1c1e] rounded-b-xl border-t border-gray-100 dark:border-slate-800">
            <div className="grid grid-cols-[1.5fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-2 px-4 py-3 bg-gray-50 dark:bg-black/20 text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest sticky top-0 z-10">
                <span>Ativo</span>
                <span className="text-right">Preço</span>
                <span className="text-center">15m</span>
                <span className="text-center">1h</span>
                <span className="text-center">4h</span>
                <span className="text-center">24h</span>
                <span className="text-center">7d</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-[400px]">
                {filtered.map((item, i) => (
                    <div key={item.id + i} className="grid grid-cols-[1.5fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-2 px-4 py-3 border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors items-center text-sm">
                        <div className="flex items-center gap-3">
                            {item.logo && <img src={item.logo} className="w-5 h-5 rounded-full" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />}
                            <span className="font-black text-gray-900 dark:text-white">{item.symbol}</span>
                        </div>
                        <div className="text-right font-mono text-gray-700 dark:text-slate-300 font-bold">
                            ${item.price < 1 ? item.price.toFixed(5) : item.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </div>
                        <div className={`text-center font-bold font-mono ${getRsiColor(item.rsi?.["15m"], true)}`}>
                            {item.rsi?.["15m"]?.toFixed(0) || '-'}
                        </div>
                        <div className={`text-center font-bold font-mono ${getRsiColor(item.rsi?.["1h"], true)}`}>
                            {item.rsi?.["1h"]?.toFixed(0) || '-'}
                        </div>
                        <div className={`text-center font-bold font-mono ${getRsiColor(item.rsi?.["4h"], true)}`}>
                            {item.rsi?.["4h"]?.toFixed(0) || '-'}
                        </div>
                        <div className={`text-center font-bold font-mono ${getRsiColor(item.rsi?.["24h"], true)}`}>
                            {item.rsi?.["24h"]?.toFixed(0) || '-'}
                        </div>
                        <div className={`text-center font-bold font-mono ${getRsiColor(item.rsi?.["7d"], true)}`}>
                            {item.rsi?.["7d"]?.toFixed(0) || '-'}
                        </div>
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
    const [xMode, setXMode] = useState<XMode>('marketCap');
    const [limit, setLimit] = useState(150);

    const chartRef = useRef<HTMLDivElement>(null);
    const isDark = useIsDark();

    useEffect(() => {
        setLoading(true);
        fetchRsiTrackerHist().then(d => {
            setData(d);
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        if (!chartRef.current || loading || data.length === 0) return;
        
        const textColor = isDark ? '#94a3b8' : '#475569';
        const gridColor = isDark ? '#334155' : '#e2e8f0';
        const tooltipBg = isDark ? '#1a1c1e' : '#ffffff';
        
        // Filter and limit data
        const seriesData = data
            .slice(0, limit)
            .map(p => {
                let xVal = p.marketCap;
                if (xMode === 'change') xVal = p.change24h;
                if (xMode === 'marketCap' && (!xVal || xVal <= 0)) return null;

                const rsiVal = p.rsi?.[timeframe] || 50;
                const isUp = (p.currentRsi || 0) >= (p.lastRsi || 0);

                return {
                    x: xVal, 
                    y: rsiVal, 
                    name: p.symbol, 
                    price: p.price, 
                    change24h: p.change24h,
                    rsiValues: p.rsi, 
                    currentRsi: p.currentRsi, 
                    lastRsi: p.lastRsi,
                    marketCap: p.marketCap, 
                    isTrendUp: isUp,
                    marker: {
                        symbol: p.logo ? `url(${p.logo})` : 'circle',
                        width: 24,
                        height: 24
                    }
                };
            }).filter(p => p !== null);

        const overbought = seriesData.filter(p => p!.y >= 70);
        const neutral = seriesData.filter(p => p!.y > 30 && p!.y < 70);
        const oversold = seriesData.filter(p => p!.y <= 30);

        Highcharts.chart(chartRef.current, {
            chart: { 
                type: 'scatter', 
                backgroundColor: 'transparent', 
                zoomType: 'xy', 
                style: { fontFamily: 'Inter, sans-serif' }, 
                marginTop: 60,
                height: 500, // Fixed height for page/maximized
            },
            title: { text: null }, 
            credits: { enabled: false }, 
            exporting: { enabled: false },
            legend: { 
                enabled: true, 
                align: 'center', 
                verticalAlign: 'top', 
                y: -10, 
                itemStyle: { color: textColor, fontWeight: 'bold' } 
            },
            xAxis: { 
                title: { text: xMode === 'marketCap' ? 'Market Cap (Log)' : '24h Change (%)', style: { color: textColor } }, 
                type: xMode === 'marketCap' ? 'logarithmic' : 'linear', 
                gridLineColor: gridColor, 
                labels: { style: { color: textColor }, formatter: function(this: any) { return xMode === 'marketCap' ? '$' + formatCompactNumber(this.value) : this.value + '%'; } } 
            },
            yAxis: { 
                title: { text: 'RSI Strength', style: { color: textColor } }, 
                min: 0, 
                max: 100, 
                gridLineColor: gridColor, 
                plotLines: [{ value: 50, color: textColor, dashStyle: 'Dash', width: 1, zIndex: 2 }], 
                plotBands: [{ from: 70, to: 100, color: 'rgba(224, 58, 62, 0.08)' }, { from: 0, to: 30, color: 'rgba(0, 158, 79, 0.08)' }] 
            },
            tooltip: { 
                enabled: true,
                useHTML: true, 
                outside: true, 
                zIndex: 10001, 
                backgroundColor: tooltipBg, 
                borderColor: '#dd9933', 
                borderRadius: 12,
                shadow: true,
                padding: 0,
                formatter: function(this: any) {
                    const p = this.point;
                    const isUp = p.isTrendUp;
                    
                    let breakdownHtml = '<div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin-top: 8px; border-top: 1px solid rgba(128,128,128,0.2); padding-top: 8px;">';
                    TIMEFRAMES.forEach(tf => {
                        const val = p.rsiValues?.[tf] || 0;
                        const color = val >= 70 ? '#f87171' : val <= 30 ? '#4ade80' : (isDark ? '#fff' : '#333');
                        breakdownHtml += `
                            <div style="text-align: center;">
                                <div style="font-size: 8px; color: #999; font-weight: bold; text-transform: uppercase;">${tf}</div>
                                <div style="font-size: 11px; font-weight: 900; color: ${color};">${val.toFixed(0)}</div>
                            </div>`;
                    });
                    breakdownHtml += '</div>';

                    return `<div style="padding: 12px; min-width: 240px; pointer-events: none; font-family: Inter, sans-serif;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                            ${p.marker && p.marker.symbol.includes('url') ? `<img src="${p.marker.symbol.slice(4, -1)}" style="width: 32px; height: 32px; border-radius: 50%;">` : ''}
                            <div style="flex: 1;">
                                <div style="font-size: 16px; font-weight: 900; color: ${isDark ? '#fff' : '#333'}">${p.name} <span style="color: ${isUp ? '#4ade80' : '#f87171'}">${isUp ? '↗' : '↘'}</span></div>
                                <div style="font-size: 11px; font-weight: bold; color: ${p.change24h >= 0 ? '#4ade80' : '#f87171'}">${p.change24h > 0 ? '+' : ''}${p.change24h.toFixed(2)}%</div>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 11px; color: ${isDark ? '#ccc' : '#666'}; margin-bottom: 2px;">
                            <span>Price:</span> <b style="color: #dd9933;">$${p.price.toLocaleString()}</b>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 11px; color: ${isDark ? '#ccc' : '#666'}; margin-bottom: 2px;">
                            <span>Mkt Cap:</span> <b style="color: #60a5fa;">$${formatCompactNumber(p.marketCap)}</b>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 11px; color: ${isDark ? '#ccc' : '#666'};">
                            <span>RSI (${timeframe}):</span> <b style="color: ${isDark ? '#fff' : '#333'};">${p.y.toFixed(1)}</b>
                        </div>
                        ${breakdownHtml}
                    </div>`;
                }
            },
            series: [
                { name: 'Overbought (>70)', data: overbought, color: '#f87171' }, 
                { name: 'Neutral', data: neutral, color: '#94a3b8' }, 
                { name: 'Oversold (<30)', data: oversold, color: '#4ade80' }
            ]
        } as any);
    }, [data, loading, timeframe, xMode, limit, isDark]);

    if (loading) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

    return (
        <div className="relative w-full h-full bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-100 dark:border-slate-800 p-4">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] z-0 overflow-hidden">
                <img src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" className="w-1/2 opacity-20 filter grayscale" alt="" />
            </div>
            
            <div className="flex justify-end gap-2 relative z-10 mb-4">
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Período</span>
                    <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className="bg-gray-100 dark:bg-[#2f3032] text-xs font-bold p-1 rounded border-none outline-none text-gray-900 dark:text-white cursor-pointer">
                        {TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf.toUpperCase()}</option>)}
                    </select>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Moedas</span>
                    <select value={limit} onChange={(e) => setLimit(parseInt(e.target.value))} className="bg-gray-100 dark:bg-[#2f3032] text-xs font-bold p-1 rounded border-none outline-none text-gray-900 dark:text-white cursor-pointer">
                        {LIMIT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>
                <div className="flex items-end pt-4 gap-1">
                    <button onClick={() => setXMode('marketCap')} className={`px-2 py-1 text-[10px] font-bold rounded ${xMode === 'marketCap' ? 'bg-[#dd9933] text-black' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>Mkt Cap</button>
                    <button onClick={() => setXMode('change')} className={`px-2 py-1 text-[10px] font-bold rounded ${xMode === 'change' ? 'bg-[#dd9933] text-black' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>24h %</button>
                </div>
            </div>

            <div ref={chartRef} className="relative z-10" />
        </div>
    );
};

// --- COMPONENT 3: GAUGE (MINIMIZED VIEW) ---
export const RsiGauge: React.FC<{ language?: Language }> = ({ language = 'pt' }) => {
    const [data, setData] = useState({ averageRsi: 50, yesterday: 50, days7Ago: 50, days30Ago: 50 });
    const [loading, setLoading] = useState(true);
    const t = getTranslations(language as Language).dashboard.widgets.rsi;

    useEffect(() => {
        fetchRsiAverage().then(d => {
            if (d) setData(d);
            setLoading(false);
        });
    }, []);

    if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-slate-500" /></div>;

    const rsiVal = data.averageRsi || 50;
    const label = rsiVal < 30 ? t.oversold : rsiVal > 70 ? t.overbought : t.neutral;
    const rotation = -90 + (Math.max(0, Math.min(100, rsiVal)) / 100) * 180;

    return (
        <div className="h-full flex flex-col justify-center p-4 relative text-center bg-white dark:bg-[#2f3032]">
            <div className="w-[85%] mx-auto overflow-visible relative">
                <svg viewBox="0 0 200 110" className="overflow-visible">
                    <defs>
                        <linearGradient id="rsiGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#4ade80" />
                            <stop offset="50%" stopColor="#facc15" />
                            <stop offset="100%" stopColor="#ef4444" />
                        </linearGradient>
                    </defs>
                    <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" className="stroke-[#eeeeee] dark:stroke-[#333]" strokeWidth="18" strokeLinecap="round"/>
                    <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="url(#rsiGrad)" strokeWidth="18" strokeDasharray={`${(rsiVal/100)*283} 283`} strokeLinecap="round" />
                    <g transform={`rotate(${rotation} 100 100)`}><path d="M 100 100 L 100 20" className="stroke-gray-800 dark:stroke-white" strokeWidth="3" /><circle cx={100} cy={100} r="5" className="fill-gray-800 dark:fill-white" /></g>
                </svg>
            </div>
            <div className="mt-4">
                <div className="text-[24px] font-black text-[#dd9933]">{data.averageRsi.toFixed(0)}</div>
                <div className="text-[8px] font-black text-gray-900 dark:text-white uppercase tracking-widest mt-1">{label}</div>
            </div>
            <div className="flex justify-around mt-4 pt-2 border-t border-gray-100 dark:border-slate-700">
                <div><div className="text-[10px] text-gray-400 uppercase">Ontem</div><div className="font-bold text-sm text-gray-900 dark:text-white">{data.yesterday.toFixed(0)}</div></div>
                <div><div className="text-[10px] text-gray-400 uppercase">7D</div><div className="font-bold text-sm text-gray-900 dark:text-white">{data.days7Ago.toFixed(0)}</div></div>
                <div><div className="text-[10px] text-gray-400 uppercase">30D</div><div className="font-bold text-sm text-gray-900 dark:text-white">{data.days30Ago.toFixed(0)}</div></div>
            </div>
        </div>
    );
};

// --- MAIN WIDGET EXPORT ---
const RsiWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
    // Logic: 
    // Minimized = Gauge
    // Maximized (Dashboard) = Scatter Chart (with controls inside)
    
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
