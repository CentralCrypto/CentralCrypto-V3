
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, ArrowUp, ArrowDown, TrendingUp, BarChart3, Database, Layers } from 'lucide-react';
import { fetchEtfFlow, fetchEtfDetailed, EtfFlowData } from '../services/api';
import { DashboardItem, Language } from '../../../types';
import { getTranslations } from '../../../locales';
import Highcharts from 'highcharts';

const formatCompactNumber = (number: number) => {
  if (!number || number === 0) return "---";
  const abs = Math.abs(number);
  const sign = number < 0 ? "-" : "";
  if (abs < 1000) return sign + abs.toString();
  const suffixes = ["", "K", "M", "B", "T"];
  const suffixNum = Math.floor(("" + Math.floor(abs)).length / 3);
  let shortValue = parseFloat((abs / Math.pow(1000, suffixNum)).toPrecision(3));
  if (shortValue % 1 !== 0) shortValue = parseFloat(shortValue.toFixed(2));
  return sign + shortValue + suffixes[suffixNum];
};

const PALETTE = [
    '#F7931A', '#627EEA', '#26A17B', '#E84142', '#8C8C8C', 
    '#D97706', '#9333EA', '#2563EB', '#059669', '#DB2777'
];

interface StackedChartProps {
    data: any[];
    metric: 'flows' | 'volume';
    asset: 'BTC' | 'ETH';
}

const StackedBarChart: React.FC<StackedChartProps> = ({ data, metric, asset }) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const chartInstance = useRef<Highcharts.Chart | null>(null);

    useEffect(() => {
        if (!chartRef.current || data.length === 0) return;

        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94a3b8' : '#475569';
        const gridColor = isDark ? '#334155' : '#e2e8f0';

        // Extract series keys (Tickers) excluding 'date' and 'totalGlobal'
        const keys = new Set<string>();
        data.forEach(d => Object.keys(d).forEach(k => {
            if (k !== 'date' && k !== 'totalGlobal' && k !== 'timestamp') keys.add(k);
        }));
        
        const seriesKeys = Array.from(keys);
        const series: any[] = seriesKeys.map((key, idx) => ({
            name: key,
            data: data.map(d => [d.date, d[key] || 0]),
            color: PALETTE[idx % PALETTE.length],
            type: 'column',
            stack: 'etf' // Same stack group
        }));

        // Add Total Line Overlay
        series.push({
            name: metric === 'flows' ? 'Net Flow' : 'Total Volume',
            type: 'spline',
            data: data.map(d => [d.date, d.totalGlobal || 0]),
            color: isDark ? '#ffffff' : '#000000',
            lineWidth: 2,
            marker: { enabled: false, states: { hover: { enabled: true } } },
            yAxis: 0,
            zIndex: 10
        });

        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        chartInstance.current = Highcharts.chart(chartRef.current, {
            chart: {
                backgroundColor: 'transparent',
                style: { fontFamily: 'Inter, sans-serif' },
                height: 380,
                spacing: [10, 10, 10, 10]
            },
            title: { text: null },
            credits: { enabled: false },
            legend: {
                enabled: true,
                itemStyle: { color: textColor, fontSize: '10px' },
                itemHoverStyle: { color: isDark ? '#fff' : '#000' }
            },
            xAxis: {
                type: 'datetime',
                lineColor: gridColor,
                tickColor: gridColor,
                labels: { style: { color: textColor, fontSize: '10px' } },
                crosshair: { width: 1, color: gridColor, dashStyle: 'Dash' }
            },
            yAxis: {
                title: { text: 'USD Value', style: { color: textColor } },
                gridLineColor: gridColor,
                gridLineDashStyle: 'Dash',
                labels: { 
                    style: { color: textColor, fontSize: '10px' },
                    formatter: function(this: any) { return '$' + formatCompactNumber(this.value); }
                }
            },
            plotOptions: {
                column: {
                    stacking: 'normal',
                    borderWidth: 0,
                    dataLabels: { enabled: false }
                }
            },
            tooltip: {
                backgroundColor: isDark ? 'rgba(26, 28, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderColor: gridColor,
                borderRadius: 8,
                style: { color: isDark ? '#fff' : '#000' },
                shared: true,
                valuePrefix: '$',
                valueDecimals: 0
            },
            series: series
        } as any);

        return () => {
             if (chartInstance.current) {
                 chartInstance.current.destroy();
                 chartInstance.current = null;
             }
        };

    }, [data, metric, asset]);

    return <div ref={chartRef} className="w-full h-full" />;
};

const EtfRankingTable: React.FC<{ data: any[], metric: 'flows' | 'volume' }> = ({ data, metric }) => {
    // Get last data point
    const lastDay = data[data.length - 1];
    if (!lastDay) return null;

    const keys = Object.keys(lastDay).filter(k => k !== 'date' && k !== 'totalGlobal' && k !== 'timestamp');
    
    // Sort tickers by value magnitude desc
    const ranking = keys.map(k => ({
        ticker: k,
        value: lastDay[k] || 0
    })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

    const total = lastDay.totalGlobal || 1;

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-gray-50 dark:bg-black/20 text-gray-500 dark:text-slate-400">
                    <tr>
                        <th className="p-2 font-black uppercase">ETF</th>
                        <th className="p-2 text-right font-black uppercase">Value (USD)</th>
                        <th className="p-2 text-right font-black uppercase">% Share</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {ranking.map(item => {
                        const share = Math.abs(item.value / total) * 100;
                        const isPos = item.value >= 0;
                        const colorClass = metric === 'volume' 
                            ? 'text-gray-900 dark:text-white' 
                            : (isPos ? 'text-green-500' : 'text-red-500');

                        return (
                            <tr key={item.ticker} className="hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                                <td className="p-2 font-bold text-gray-700 dark:text-slate-300">{item.ticker}</td>
                                <td className={`p-2 text-right font-mono font-black ${colorClass}`}>
                                    ${formatCompactNumber(item.value)}
                                </td>
                                <td className="p-2 text-right text-gray-500 font-mono">
                                    {share.toFixed(1)}%
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

// --- MAXIMIZED WIDGET (DEEP DIVE) ---
const EtfMaximized: React.FC<{ language: Language, onClose?: () => void }> = ({ language }) => {
    const [asset, setAsset] = useState<'BTC' | 'ETH'>('BTC');
    const [metric, setMetric] = useState<'flows' | 'volume'>('flows');
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetchEtfDetailed(asset, metric).then(res => {
            setData(res);
            setLoading(false);
        });
    }, [asset, metric]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#1a1c1e] text-gray-900 dark:text-white overflow-hidden p-6">
            {/* CONTROLS */}
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-4">
                    <div className="flex bg-gray-100 dark:bg-black/30 p-1 rounded-lg border border-gray-200 dark:border-slate-700">
                        <button onClick={() => setAsset('BTC')} className={`px-4 py-1.5 text-xs font-black rounded transition-all ${asset === 'BTC' ? 'bg-[#f7931a] text-white shadow' : 'text-gray-500 hover:text-white'}`}>BTC</button>
                        <button onClick={() => setAsset('ETH')} className={`px-4 py-1.5 text-xs font-black rounded transition-all ${asset === 'ETH' ? 'bg-[#627eea] text-white shadow' : 'text-gray-500 hover:text-white'}`}>ETH</button>
                    </div>
                    <div className="w-px h-6 bg-gray-200 dark:bg-slate-700"></div>
                    <div className="flex bg-gray-100 dark:bg-black/30 p-1 rounded-lg border border-gray-200 dark:border-slate-700">
                        <button onClick={() => setMetric('flows')} className={`px-4 py-1.5 text-xs font-black rounded flex items-center gap-2 transition-all ${metric === 'flows' ? 'bg-white dark:bg-[#2f3032] text-[#dd9933] shadow' : 'text-gray-500 hover:text-white'}`}><TrendingUp size={14}/> Flows</button>
                        <button onClick={() => setMetric('volume')} className={`px-4 py-1.5 text-xs font-black rounded flex items-center gap-2 transition-all ${metric === 'volume' ? 'bg-white dark:bg-[#2f3032] text-blue-400 shadow' : 'text-gray-500 hover:text-white'}`}><BarChart3 size={14}/> Volume</button>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest">Total {metric === 'flows' ? 'Net Flow' : 'Volume'} (Último dia)</div>
                    <div className={`text-2xl font-black font-mono ${data.length > 0 && (data[data.length-1].totalGlobal >= 0 || metric === 'volume') ? 'text-gray-900 dark:text-white' : 'text-red-500'}`}>
                        {data.length > 0 ? '$' + formatCompactNumber(data[data.length-1].totalGlobal) : '---'}
                    </div>
                </div>
            </div>

            {/* CONTENT GRID */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 relative bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-slate-800/50 p-4">
                    {loading ? <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div> : (
                        <StackedBarChart data={data} metric={metric} asset={asset} />
                    )}
                </div>
                <div className="bg-white dark:bg-[#1a1c1e] border border-gray-100 dark:border-slate-800 rounded-xl flex flex-col overflow-hidden">
                    <div className="p-3 bg-gray-50 dark:bg-black/30 border-b border-gray-100 dark:border-slate-800 font-black text-xs uppercase text-gray-500 tracking-widest flex items-center gap-2">
                        <Layers size={14} /> Market Share (Dia)
                    </div>
                    {loading ? <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400"/></div> : (
                        <EtfRankingTable data={data} metric={metric} />
                    )}
                </div>
            </div>
        </div>
    );
};

// --- MINIMIZED WIDGET (SUMMARY) ---
const EtfSummary: React.FC<{ language: Language }> = ({ language }) => {
    const [etfData, setEtfData] = useState<EtfFlowData | null>(null);
    const t = getTranslations(language).workspace.widgets.etf;

    useEffect(() => {
        fetchEtfFlow().then(res => { if (res) setEtfData(res); });
    }, []);

    if (!etfData) return <div className="flex items-center justify-center h-full text-slate-500"><Loader2 className="animate-spin" /></div>;
    
    const totalFlow = etfData.netFlow || 0;
    const FlowArrow = totalFlow >= 0 ? ArrowUp : ArrowDown;
    const arrowColor = totalFlow >= 0 ? 'text-green-400' : 'text-red-400';

    return (
        <div className="h-full flex flex-col justify-between p-4 relative text-center bg-white dark:bg-[#2f3032]">
            <div className="flex flex-col items-center">
                <div className="text-xs text-slate-400 font-bold uppercase">{t.dailyFlow}</div>
                <div className={`mt-1 p-2 rounded flex items-center justify-center gap-2 bg-transparent`}>
                    <FlowArrow size={48} strokeWidth={3} className={arrowColor} />
                    <span className="text-5xl font-black text-black dark:text-white">
                        ${formatCompactNumber(Math.abs(totalFlow))}
                    </span>
                </div>
                <div className="text-xs text-slate-500">
                    {t.lastUpdate} {new Date(etfData.timestamp).toLocaleDateString()}
                </div>
            </div>
            
            <div className="flex flex-col gap-1 mt-2 text-center">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <div className="text-xl font-bold text-gray-900 dark:text-white">${formatCompactNumber(etfData.btcValue)}</div>
                        <div className="text-xs text-slate-500 font-bold uppercase">{t.btcEtf}</div>
                    </div>
                    <div>
                        <div className="text-xl font-bold text-gray-900 dark:text-white">${formatCompactNumber(etfData.ethValue)}</div>
                        <div className="text-xs text-slate-500 font-bold uppercase">{t.ethEtf}</div>
                    </div>
                 </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 text-center border-t border-gray-100 dark:border-slate-700/50 pt-3">
                <div>
                    <div className={`text-sm font-bold ${etfData.history.lastWeek >= 0 ? 'text-green-500' : 'text-red-500'}`}>${formatCompactNumber(etfData.history.lastWeek)}</div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">{t.last7d}</div>
                </div>
                 <div>
                    <div className={`text-sm font-bold ${etfData.history.lastMonth >= 0 ? 'text-green-500' : 'text-red-500'}`}>${formatCompactNumber(etfData.history.lastMonth)}</div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">{t.last30d}</div>
                </div>
                 <div>
                    <div className={`text-sm font-bold ${etfData.history.last90d >= 0 ? 'text-green-500' : 'text-red-500'}`}>${formatCompactNumber(etfData.history.last90d)}</div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">{t.last90d}</div>
                </div>
            </div>
        </div>
    );
};

const EtfFlowWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
    if (item.isMaximized) {
        return <EtfMaximized language={language} />;
    }
    return <EtfSummary language={language} />;
};

export default EtfFlowWidget;
