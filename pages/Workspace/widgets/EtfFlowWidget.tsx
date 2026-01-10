
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, ArrowUp, ArrowDown, XCircle } from 'lucide-react';
import { EtfFlowData, fetchEtfFlow } from '../services/api';
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

const generatePalette = (count: number) => {
    const palette = [];
    for (let i = 0; i < count; i++) {
        const hue = (i * 137.508) % 360; 
        palette.push(`hsl(${hue}, 70%, 50%)`);
    }
    return palette;
};

// Common Reset Zoom Button Theme
const RESET_ZOOM_THEME = (isDark: boolean) => ({
    position: {
        align: 'right',
        verticalAlign: 'top',
        x: -10,
        y: 10
    },
    relativeTo: 'chart',
    theme: {
        fill: isDark ? '#1a1c1e' : '#f1f5f9',
        stroke: '#dd9933',
        r: 4,
        style: {
            color: '#dd9933',
            fontSize: '10px',
            fontWeight: 'bold',
            textTransform: 'uppercase'
        },
        states: {
            hover: {
                fill: '#dd9933',
                style: {
                    color: isDark ? '#000000' : '#ffffff'
                }
            }
        }
    }
});

interface HighchartsEtfChartProps {
    data: any[];
    title: string;
    colorBase: string;
    chartId?: string;
    onReset?: () => void;
}

const HighchartsEtfChart: React.FC<HighchartsEtfChartProps> = ({ data, title, colorBase, chartId }) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const chartInstance = useRef<any>(null);

    const resetFilters = () => {
        if (chartInstance.current && chartInstance.current.series) {
            chartInstance.current.series.forEach((s: any) => {
                s.setVisible(true, false);
            });
            chartInstance.current.redraw();
        }
    };

    useEffect(() => {
        if (!chartRef.current) return;

        // Check Theme for Text Colors
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94a3b8' : '#334155';
        const lineColor = isDark ? '#334155' : '#e2e8f0';
        const hoverColor = isDark ? '#ffffff' : '#dd9933'; // White on dark, Gold on light

        // Ensure data is sorted
        const sortedData = [...data].sort((a, b) => a.date - b.date);

        const allKeys = new Set<string>();
        sortedData.forEach(point => {
            Object.keys(point).forEach(k => {
                if (k !== 'date' && k !== 'total') {
                    allKeys.add(k);
                }
            });
        });
        const keysArray = Array.from(allKeys);
        
        const palette = generatePalette(keysArray.length);
        const series = keysArray.map((key, index) => {
            const seriesData = sortedData.map(point => [point.date, point[key] || 0]);
            return {
                name: key,
                data: seriesData,
                color: palette[index],
                tooltip: { valueDecimals: 0, valuePrefix: '$' }
            };
        });

        chartInstance.current = Highcharts.chart(chartRef.current, {
            chart: {
                type: 'column',
                backgroundColor: 'transparent',
                zoomType: 'x',
                style: { fontFamily: 'Inter, sans-serif' },
                marginTop: 50,
                height: 350,
                resetZoomButton: RESET_ZOOM_THEME(isDark)
            },
            title: { text: null },
            exporting: { enabled: false },
            subtitle: {
                text: isDark ? 'Drag to zoom' : 'Arraste para zoom',
                style: { color: textColor, fontSize: '10px' }
            },
            credits: { enabled: false },
            legend: {
                enabled: true,
                itemStyle: { color: textColor, fontSize: '10px' },
                itemHoverStyle: { color: hoverColor },
                maxHeight: 60
            },
            xAxis: {
                type: 'datetime',
                gridLineColor: lineColor,
                gridLineWidth: 0,
                labels: { style: { color: textColor } },
                lineColor: lineColor,
                tickColor: lineColor
            },
            yAxis: {
                title: { text: 'Net Flow', style: { color: textColor } },
                gridLineColor: lineColor,
                gridLineDashStyle: 'Dash',
                labels: { 
                    style: { color: textColor },
                    formatter: function (this: any) { return '$' + formatCompactNumber(this.value); }
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
                backgroundColor: isDark ? '#1a1c1e' : '#ffffff',
                borderColor: lineColor,
                borderRadius: 8,
                style: { color: isDark ? '#fff' : '#000' },
                shared: true,
                valueDecimals: 0
            },
            series: series.length > 0 ? series : [{ name: 'No Data', data: [] }]
        } as any);

    }, [data, title, colorBase]);

    return (
        <div className="w-full h-full min-h-[350px] relative group">
            <div ref={chartRef} className="w-full h-full" />
            <button 
                onClick={resetFilters}
                className="absolute bottom-2 right-2 bg-gray-100 dark:bg-[#1a1c1e] text-gray-500 dark:text-gray-400 hover:text-[#dd9933] border border-gray-300 dark:border-slate-700 rounded px-2 py-1 text-[9px] font-bold uppercase shadow-sm flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <XCircle size={10} /> Limpar Filtros
            </button>
        </div>
    );
};

const EtfFlowWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
    const [etfData, setEtfData] = useState<EtfFlowData | null>(null);
    const t = getTranslations(language as Language).workspace.widgets.etf;

    useEffect(() => {
        fetchEtfFlow().then(res => {
            if (res) setEtfData(res);
        });
    }, []);

    if (!etfData) {
        return <div className="flex items-center justify-center h-full text-slate-500"><Loader2 className="animate-spin" /></div>;
    }
    
    const totalFlow = etfData.netFlow || 0;
    const FlowArrow = totalFlow >= 0 ? ArrowUp : ArrowDown;
    const arrowColor = totalFlow >= 0 ? 'text-green-400' : 'text-red-400';

    if (item.isMaximized) {
        const latestBTC = etfData.chartDataBTC[etfData.chartDataBTC.length - 1];
        const btcTotal = latestBTC?.total || 0;
        const btcDate = latestBTC ? new Date(latestBTC.date).toLocaleDateString() : '--/--/----';
        
        const latestETH = etfData.chartDataETH[etfData.chartDataETH.length - 1];
        const ethTotal = latestETH?.total || 0;
        const ethDate = latestETH ? new Date(latestETH.date).toLocaleDateString() : '--/--/----';

        return (
            <div className="h-full flex flex-col bg-white dark:bg-[#2f3032] overflow-hidden p-2 gap-14">
                <div className="flex-1 flex flex-col min-h-0 border-b border-gray-100 dark:border-slate-700/50 pb-4 relative justify-center">
                    <div className="absolute top-2 left-4 z-10 bg-white/80 dark:bg-black/50 px-3 py-1 rounded shadow-sm border border-transparent dark:border-slate-700 flex items-center gap-3">
                        <h4 className="text-center text-xs font-bold text-[#f7931a] uppercase tracking-wider">Bitcoin ETFs</h4>
                        <span className={`text-xs font-mono font-bold ${btcTotal >= 0 ? 'text-green-500' : 'text-red-500'}`}>${formatCompactNumber(btcTotal)}</span>
                        <span className="text-[10px] text-gray-400">({btcDate})</span>
                    </div>
                    <div className="flex-1 w-full min-h-0">
                        <HighchartsEtfChart data={etfData.chartDataBTC} title="Bitcoin ETFs" colorBase="#f7931a" />
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0 relative justify-center">
                    <div className="absolute top-2 left-4 z-10 bg-white/80 dark:bg-black/50 px-3 py-1 rounded shadow-sm border border-transparent dark:border-slate-700 flex items-center gap-3">
                        <h4 className="text-center text-xs font-bold text-[#627eea] uppercase tracking-wider">Ethereum ETFs</h4>
                        <span className={`text-xs font-mono font-bold ${ethTotal >= 0 ? 'text-green-500' : 'text-red-500'}`}>${formatCompactNumber(ethTotal)}</span>
                        <span className="text-[10px] text-gray-400">({ethDate})</span>
                    </div>
                    <div className="flex-1 w-full min-h-0">
                        <HighchartsEtfChart data={etfData.chartDataETH} title="Ethereum ETFs" colorBase="#627eea" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col justify-between p-4 relative text-center bg-white dark:bg-[#2f3032]">
            <div className="flex flex-col items-center">
                <div className="text-xs text-slate-400 font-bold uppercase">{t.dailyFlow}</div>
                <div className={`mt-1 p-2 rounded flex items-center justify-center gap-2 bg-transparent`}>
                    <FlowArrow size={48} strokeWidth={3} className={arrowColor} />
                    <span className="text-6xl md:text-5xl lg:text-6xl font-black text-black dark:text-white">
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
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">${formatCompactNumber(etfData.btcValue)}</div>
                        <div className="text-xs text-slate-500 font-bold uppercase">{t.btcEtf}</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">${formatCompactNumber(etfData.ethValue)}</div>
                        <div className="text-xs text-slate-500 font-bold uppercase">{t.ethEtf}</div>
                    </div>
                 </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 text-center border-t border-gray-100 dark:border-slate-700/50 pt-3">
                <div>
                    <div className={`text-base font-bold ${etfData.history.lastWeek >= 0 ? 'text-green-500' : 'text-red-500'}`}>${formatCompactNumber(etfData.history.lastWeek)}</div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase">{t.last7d}</div>
                </div>
                 <div>
                    <div className={`text-base font-bold ${etfData.history.lastMonth >= 0 ? 'text-green-500' : 'text-red-500'}`}>${formatCompactNumber(etfData.history.lastMonth)}</div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase">{t.last30d}</div>
                </div>
                 <div>
                    <div className={`text-base font-bold ${etfData.history.last90d >= 0 ? 'text-green-500' : 'text-red-500'}`}>${formatCompactNumber(etfData.history.last90d)}</div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase">{t.last90d}</div>
                </div>
            </div>
        </div>
    );
};

export default EtfFlowWidget;
