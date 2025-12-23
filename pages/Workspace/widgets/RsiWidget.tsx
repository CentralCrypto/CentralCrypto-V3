
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { RsiAvgData, RsiTrackerPoint, fetchRsiAverage, fetchRsiTracker } from '../services/api';
import { DashboardItem, Language } from '../../../types';
import { getTranslations } from '../../../locales';

declare global {
  interface Window { Highcharts: any; }
}

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

const HighchartsRsiTracker: React.FC<{ data: RsiTrackerPoint[], timeframe: string, xMode: XMode }> = ({ data, timeframe, xMode }) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const isDark = useIsDark();

    useEffect(() => {
        if (!chartRef.current || !window.Highcharts) return;
        
        const textColor = isDark ? '#94a3b8' : '#475569';
        const gridColor = isDark ? '#334155' : '#e2e8f0';
        const tooltipBg = isDark ? '#1a1c1e' : '#ffffff';
        
        const seriesData = data.map(p => {
            let xVal = p.marketCap;
            if (xMode === 'change') xVal = p.change24h;
            if (xMode === 'marketCap' && (!xVal || xVal <= 0)) return null;

            const rsiVal = p.rsi[timeframe] || 50;
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

        window.Highcharts.chart(chartRef.current, {
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
        });
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
    const [rsiAvgData, setRsiAvgData] = useState<RsiAvgData | null>(null);
    const [rsiTrackerData, setRsiTrackerData] = useState<RsiTrackerPoint[]>([]);
    const [rsiTrackerLoading, setRsiTrackerLoading] = useState(false);
    const [rsiTimeframe, setRsiTimeframe] = useState('7d');
    const [coinLimit, setCoinLimit] = useState(100);
    const [xMode, setXMode] = useState<XMode>('marketCap');

    const t = getTranslations(language as Language).dashboard.widgets.rsi;

    const currentRsiPoints = useMemo(() => {
        return rsiTrackerData
            .filter(p => p.rsi[rsiTimeframe] > 0)
            .slice(0, coinLimit);
    }, [rsiTrackerData, rsiTimeframe, coinLimit]);

    const dynamicRsiAvg = useMemo(() => currentRsiPoints.length === 0 ? 50 : currentRsiPoints.reduce((acc, p) => acc + p.rsi[rsiTimeframe], 0) / currentRsiPoints.length, [currentRsiPoints, rsiTimeframe]);

    useEffect(() => {
        fetchRsiAverage().then(setRsiAvgData);
        if (item.isMaximized) {
            setRsiTrackerLoading(true);
            fetchRsiTracker().then(data => { setRsiTrackerData(data); setRsiTrackerLoading(false); });
        }
    }, [item.isMaximized]);
    
    if (!rsiAvgData && !item.isMaximized) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-slate-500" /></div>;

    const rsiVal = item.isMaximized ? dynamicRsiAvg : (rsiAvgData?.averageRsi || 50);
    const label = rsiVal < 30 ? t.oversold : rsiVal > 70 ? t.overbought : t.neutral;

    if (item.isMaximized) {
        return (
            <div className="h-full flex flex-col p-4 relative bg-white dark:bg-[#2f3032]">
                <div className="z-10 flex justify-between items-start mb-4">
                    <div>
                        <div className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">Média Global RSI</div>
                        <div className="text-4xl font-black text-[#dd9933]">{rsiVal.toFixed(1)}</div>
                        <div className="text-sm font-bold text-gray-900 dark:text-white uppercase">{label}</div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex gap-2">
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Período</span>
                                <select value={rsiTimeframe} onChange={(e) => setRsiTimeframe(e.target.value)} className="bg-gray-100 dark:bg-[#1a1c1e] text-xs font-bold p-1 rounded border-none outline-none text-gray-900 dark:text-white">
                                    {TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf.toUpperCase()}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Moedas</span>
                                <select value={coinLimit} onChange={(e) => setCoinLimit(parseInt(e.target.value))} className="bg-gray-100 dark:bg-[#1a1c1e] text-xs font-bold p-1 rounded border-none outline-none text-gray-900 dark:text-white">
                                    {LIMIT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <button onClick={() => setXMode('marketCap')} className={`px-2 py-1 text-[10px] font-bold rounded ${xMode === 'marketCap' ? 'bg-[#dd9933] text-black' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>Mkt Cap</button>
                            <button onClick={() => setXMode('change')} className={`px-2 py-1 text-[10px] font-bold rounded ${xMode === 'change' ? 'bg-[#dd9933] text-black' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>24h %</button>
                        </div>
                    </div>
                </div>
                <div className="flex-1 min-h-0">
                    {rsiTrackerLoading ? <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-slate-500" /></div> : <HighchartsRsiTracker data={currentRsiPoints} timeframe={rsiTimeframe} xMode={xMode} />}
                </div>
            </div>
        );
    }
    
    return (
        <div className="h-full flex flex-col justify-center p-4 relative text-center bg-white dark:bg-[#2f3032]">
            <svg viewBox="0 0 200 110" className="w-[85%] mx-auto">
                <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" className="stroke-[#eeeeee] dark:stroke-[#333]" strokeWidth="18" strokeLinecap="round"/>
                <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="#dd9933" strokeWidth="18" strokeDasharray={`${(rsiVal/100)*283} 283`} strokeLinecap="round" />
                <g transform={`rotate(${(rsiVal/100)*180 - 90} 100 100)`}><path d="M 100 100 L 100 20" className="stroke-gray-800 dark:stroke-white" strokeWidth="3" /><circle cx="100" cy="100" r="5" className="fill-gray-800 dark:fill-white" /></g>
            </svg>
            <div className="mt-4"><div className="text-4xl font-black text-[#dd9933]">{rsiAvgData?.averageRsi.toFixed(0)}</div><div className="text-xs font-bold text-gray-500 dark:text-white uppercase">{label}</div></div>
            <div className="flex justify-around mt-4 pt-2 border-t border-gray-100 dark:border-slate-700">
                <div><div className="text-[10px] text-gray-400 uppercase">Ontem</div><div className="font-bold text-sm text-gray-900 dark:text-white">{rsiAvgData?.yesterday.toFixed(0)}</div></div>
                <div><div className="text-[10px] text-gray-400 uppercase">7D</div><div className="font-bold text-sm text-gray-900 dark:text-white">{rsiAvgData?.days7Ago.toFixed(0)}</div></div>
                <div><div className="text-[10px] text-gray-400 uppercase">30D</div><div className="font-bold text-sm text-gray-900 dark:text-white">{rsiAvgData?.days30Ago.toFixed(0)}</div></div>
            </div>
        </div>
    );
};

export default RsiWidget;
