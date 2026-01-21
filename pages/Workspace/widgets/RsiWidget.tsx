
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, LayoutList, Activity } from 'lucide-react';
import { RsiAvgData, RsiTrackerPoint, RsiTableItem, fetchRsiAverage, fetchRsiTrackerHist, fetchRsiTable } from '../services/api';
import { DashboardItem, Language } from '../../../types';
import { getTranslations } from '../../../locales';
import Highcharts from 'highcharts';

const TIMEFRAMES = ['15m', '1h', '4h', '24h', '7d'];
const LIMIT_OPTIONS = [50, 100, 150, 200, 300];
type XMode = 'marketCap' | 'change';
type ViewMode = 'chart' | 'table';

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

// --- TABLE COMPONENT ---
const RsiTable: React.FC<{ data: RsiTableItem[], filterText?: string }> = ({ data, filterText }) => {
    const filtered = useMemo(() => {
        if (!filterText) return data;
        const q = filterText.toLowerCase();
        return data.filter(i => 
            (i.symbol || '').toLowerCase().includes(q) || 
            (i.name || '').toLowerCase().includes(q)
        );
    }, [data, filterText]);

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
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {filtered.map((item, i) => (
                    <div key={i} className="grid grid-cols-[1.5fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-2 px-4 py-3 border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors items-center text-sm">
                        <div className="flex items-center gap-3">
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
                        <div className={`text-center font-bold font-mono ${getRsiColor(item.rsi?.["24h"] || item.rsi?.["1d"] as any, true)}`}>
                            {(item.rsi?.["24h"] || item.rsi?.["1d"] as any)?.toFixed(0) || '-'}
                        </div>
                        <div className={`text-center font-bold font-mono ${getRsiColor(item.rsi?.["7d"] || item.rsi?.["1w"] as any, true)}`}>
                            {(item.rsi?.["7d"] || item.rsi?.["1w"] as any)?.toFixed(0) || '-'}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const HighchartsRsiTracker: React.FC<{ data: RsiTrackerPoint[], timeframe: string, xMode: XMode }> = ({ data, timeframe, xMode }) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const isDark = useIsDark();

    useEffect(() => {
        if (!chartRef.current) return;
        
        const textColor = isDark ? '#94a3b8' : '#475569';
        const gridColor = isDark ? '#334155' : '#e2e8f0';
        const tooltipBg = isDark ? '#1a1c1e' : '#ffffff';
        
        const seriesData = data.map(p => {
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

        const resetBtnTheme = {
            theme: {
                fill: isDark ? '#1a1c1e' : '#ffffff',
                stroke: '#dd9933',
                strokeWidth: 2,
                r: 6,
                padding: 10,
                style: {
                    color: isDark ? '#ffffff' : '#dd9933',
                    fontSize: '11px',
                    fontWeight: '900',
                    textTransform: 'uppercase'
                },
                states: {
                    hover: {
                        fill: '#dd9933',
                        style: { color: isDark ? '#000000' : '#ffffff' }
                    }
                }
            }
        };

        Highcharts.chart(chartRef.current, {
            chart: { 
                type: 'scatter', 
                backgroundColor: 'transparent', 
                zoomType: 'xy', 
                style: { fontFamily: 'Inter, sans-serif' }, 
                marginTop: 60,
                height: chartRef.current.clientHeight || 400,
                resetZoomButton: resetBtnTheme
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
                hideDelay: 50,
                distance: 40, 
                anchorX: 'center',
                anchorY: 'middle',
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
            plotOptions: { 
                scatter: { 
                    stickyTracking: false,
                    findNearestPointBy: 'xy',
                    states: {
                        hover: {
                            halo: { size: 0 } 
                        }
                    },
                    dataLabels: {
                        enabled: true,
                        useHTML: true,
                        allowOverlap: true,
                        overflow: 'allow',
                        crop: false,
                        padding: 0,
                        zIndex: 1,
                        align: 'center',
                        verticalAlign: 'middle',
                        x: 0,
                        y: 0,
                        style: { pointerEvents: 'none' }, 
                        formatter: function(this: any) {
                            const p = this.point;
                            const isUp = p.isTrendUp;
                            const arrowColor = isUp ? '#4ade80' : '#f87171';
                            const arrowIcon = isUp ? '▲' : '▼';
                            const arrowPos = isUp ? 'top: -5px; right: -5px;' : 'bottom: -5px; right: -5px;';
                            
                            return `
                            <div style="width: 26px; height: 26px; position: relative; pointer-events: none;">
                                <div style="position: absolute; ${arrowPos} font-size: 11px; font-weight: 900; color: ${arrowColor}; text-shadow: 0 0 3px rgba(0,0,0,1); z-index: 2;">
                                    ${arrowIcon}
                                </div>
                            </div>`;
                        }
                    }
                } 
            },
            series: [
                { name: 'Overbought (>70)', data: overbought, color: '#f87171' }, 
                { name: 'Neutral', data: neutral, color: '#94a3b8' }, 
                { name: 'Oversold (<30)', data: oversold, color: '#4ade80' }
            ]
        } as any);
    }, [data, timeframe, xMode, isDark]);

    return (
        <>
            <style>{`
                .highcharts-tooltip-container { z-index: 10001 !important; }
                .highcharts-tooltip { pointer-events: none !important; }
                .highcharts-button { cursor: pointer !important; }
                .highcharts-data-label { pointer-events: none !important; border: none !important; outline: none !important; }
                .highcharts-point { stroke-width: 0 !important; outline: none !important; }
                .highcharts-halo { display: none !important; }
            `}</style>
            <div ref={chartRef} style={{ width: '100%', height: '100%', minHeight: '350px' }} />
        </>
    );
};

const RsiWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
    // Shared State
    const [rsiAvgData, setRsiAvgData] = useState<RsiAvgData | null>(null);
    const [isLoadingAvg, setIsLoadingAvg] = useState(true);
    
    // View State (Maximized)
    const [viewMode, setViewMode] = useState<ViewMode>('chart');
    
    // Chart State
    const [rsiTrackerData, setRsiTrackerData] = useState<RsiTrackerPoint[]>([]);
    const [rsiTrackerLoading, setRsiTrackerLoading] = useState(false);
    const [rsiTimeframe, setRsiTimeframe] = useState('7d');
    const [coinLimit, setCoinLimit] = useState(100);
    const [xMode, setXMode] = useState<XMode>('marketCap');

    // Table State
    const [rsiTableData, setRsiTableData] = useState<RsiTableItem[]>([]);
    const [rsiTableLoading, setRsiTableLoading] = useState(false);

    const t = getTranslations(language as Language).dashboard.widgets.rsi;

    // Derived Logic for Chart
    const currentRsiPoints = useMemo(() => {
        return rsiTrackerData
            .filter(p => p.rsi && p.rsi[rsiTimeframe] > 0)
            .slice(0, coinLimit);
    }, [rsiTrackerData, rsiTimeframe, coinLimit]);

    const dynamicRsiAvg = useMemo(() => currentRsiPoints.length === 0 ? 50 : currentRsiPoints.reduce((acc, p) => acc + p.rsi[rsiTimeframe], 0) / currentRsiPoints.length, [currentRsiPoints, rsiTimeframe]);

    // Initial Load - Gauge Data
    useEffect(() => {
        setIsLoadingAvg(true);
        fetchRsiAverage().then(data => {
            setRsiAvgData(data);
            setIsLoadingAvg(false);
        }).catch(() => {
            setIsLoadingAvg(false);
        });
    }, []);

    // Maximized Data Fetching Logic
    useEffect(() => {
        if (!item.isMaximized) return;

        if (viewMode === 'chart' && rsiTrackerData.length === 0) {
            setRsiTrackerLoading(true);
            fetchRsiTrackerHist().then(data => { 
                setRsiTrackerData(data); 
                setRsiTrackerLoading(false); 
            });
        }

        if (viewMode === 'table' && rsiTableData.length === 0) {
            setRsiTableLoading(true);
            fetchRsiTable().then(data => {
                setRsiTableData(data);
                setRsiTableLoading(false);
            });
        }
    }, [item.isMaximized, viewMode]);
    
    // Minimized View (Gauge)
    if (!item.isMaximized) {
        if (isLoadingAvg && !rsiAvgData) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-slate-500" /></div>;
        if (!rsiAvgData) return <div className="flex items-center justify-center h-full text-xs text-slate-500">Sem dados</div>;

        const rsiVal = rsiAvgData.averageRsi || 50;
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
                    <div className="text-[24px] font-black text-[#dd9933]">{rsiAvgData.averageRsi.toFixed(0)}</div>
                    <div className="text-[8px] font-black text-gray-900 dark:text-white uppercase tracking-widest mt-1">{label}</div>
                </div>
                <div className="flex justify-around mt-4 pt-2 border-t border-gray-100 dark:border-slate-700">
                    <div><div className="text-[10px] text-gray-400 uppercase">Ontem</div><div className="font-bold text-sm text-gray-900 dark:text-white">{rsiAvgData.yesterday.toFixed(0)}</div></div>
                    <div><div className="text-[10px] text-gray-400 uppercase">7D</div><div className="font-bold text-sm text-gray-900 dark:text-white">{rsiAvgData.days7Ago.toFixed(0)}</div></div>
                    <div><div className="text-[10px] text-gray-400 uppercase">30D</div><div className="font-bold text-sm text-gray-900 dark:text-white">{rsiAvgData.days30Ago.toFixed(0)}</div></div>
                </div>
            </div>
        );
    }

    // Maximized View
    const rsiVal = viewMode === 'chart' ? dynamicRsiAvg : (rsiAvgData?.averageRsi || 50);
    const label = rsiVal < 30 ? t.oversold : rsiVal > 70 ? t.overbought : t.neutral;

    return (
        <div className="h-full flex flex-col p-4 relative bg-white dark:bg-[#2f3032]">
            <div className="z-10 flex justify-between items-start mb-4">
                <div>
                    <div className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">Média Global RSI</div>
                    <div className="text-[24px] font-black text-[#dd9933]">{rsiVal.toFixed(1)}</div>
                    <div className="text-[8px] font-black text-gray-900 dark:text-white uppercase tracking-widest">{label}</div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                    <div className="flex bg-gray-100 dark:bg-black/20 p-1 rounded-lg gap-1">
                        <button 
                            onClick={() => setViewMode('chart')} 
                            className={`px-3 py-1.5 text-xs font-black uppercase rounded transition-all flex items-center gap-2 ${viewMode === 'chart' ? 'bg-white dark:bg-[#2f3032] text-[#dd9933] shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                        >
                            <Activity size={14} /> Chart
                        </button>
                        <button 
                            onClick={() => setViewMode('table')} 
                            className={`px-3 py-1.5 text-xs font-black uppercase rounded transition-all flex items-center gap-2 ${viewMode === 'table' ? 'bg-white dark:bg-[#2f3032] text-[#dd9933] shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                        >
                            <LayoutList size={14} /> Table
                        </button>
                    </div>

                    {viewMode === 'chart' && (
                        <div className="flex gap-2">
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Período</span>
                                <select value={rsiTimeframe} onChange={(e) => setRsiTimeframe(e.target.value)} className="bg-gray-100 dark:bg-[#1a1c1e] text-xs font-bold p-1 rounded border-none outline-none text-gray-900 dark:text-white cursor-pointer">
                                    {TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf.toUpperCase()}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Moedas</span>
                                <select value={coinLimit} onChange={(e) => setCoinLimit(parseInt(e.target.value))} className="bg-gray-100 dark:bg-[#1a1c1e] text-xs font-bold p-1 rounded border-none outline-none text-gray-900 dark:text-white cursor-pointer">
                                    {LIMIT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                            <div className="flex items-end pt-4 gap-1">
                                <button onClick={() => setXMode('marketCap')} className={`px-2 py-1 text-[10px] font-bold rounded ${xMode === 'marketCap' ? 'bg-[#dd9933] text-black' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>Mkt Cap</button>
                                <button onClick={() => setXMode('change')} className={`px-2 py-1 text-[10px] font-bold rounded ${xMode === 'change' ? 'bg-[#dd9933] text-black' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>24h %</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="flex-1 min-h-0 relative">
                {viewMode === 'chart' ? (
                    rsiTrackerLoading ? <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-slate-500" /></div> : <HighchartsRsiTracker data={currentRsiPoints} timeframe={rsiTimeframe} xMode={xMode} />
                ) : (
                    rsiTableLoading ? <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-slate-500" /></div> : <RsiTable data={rsiTableData} />
                )}
            </div>
        </div>
    );
};

export default RsiWidget;
