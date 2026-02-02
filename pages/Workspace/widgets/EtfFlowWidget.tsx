
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, TrendingUp, BarChart3, Layers, AlertTriangle, LineChart, Info, ChevronLeft, ChevronRight, DollarSign, ArrowUp, ArrowDown } from 'lucide-react';
import { fetchEtfFlow, fetchEtfDetailed, EtfFlowData } from '../../../services/api';
import { DashboardItem, Language } from '../../../types';
import { getTranslations } from '../../../locales';
import Highcharts from 'highcharts';
import mouseWheelZoom from 'highcharts/modules/mouse-wheel-zoom';
import highchartsMore from 'highcharts/highcharts-more';

if (typeof mouseWheelZoom === 'function') {
  (mouseWheelZoom as any)(Highcharts);
}
if (typeof highchartsMore === 'function') {
  (highchartsMore as any)(Highcharts);
}

const formatCompactNumber = (number: number) => {
  if (number === null || number === undefined || !Number.isFinite(Number(number))) return "---";
  const n = Number(number);
  if (n === 0) return "0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs < 1000) return sign + abs.toFixed(0);
  const suffixes = ["", "K", "M", "B", "T"];
  const suffixNum = Math.min(suffixes.length - 1, Math.floor(("" + Math.floor(abs)).length / 3));
  let shortValue = parseFloat((abs / Math.pow(1000, suffixNum)).toPrecision(3));
  if (shortValue % 1 !== 0) shortValue = parseFloat(shortValue.toFixed(2));
  return sign + shortValue + suffixes[suffixNum];
};

const PALETTE = [
  '#F7931A', '#627EEA', '#26A17B', '#E84142', '#8C8C8C',
  '#D97706', '#9333EA', '#2563EB', '#059669', '#DB2777',
  '#22c55e', '#eab308', '#38bdf8', '#f97316'
];

const WATERMARK_URL = 'https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png';
const WATERMARK_OPACITY = 0.055;

type Metric = 'flows' | 'volume';
type Asset = 'BTC' | 'ETH' | 'SOL' | 'XRP' | 'DOGE' | 'LTC';
type ViewMode = 'stacked' | 'total' | 'lines';

const ASSETS_CONFIG: Record<Asset, { label: string, color: string, logo: string }> = {
  BTC: { label: 'BTC', color: '#f7931a', logo: 'https://assets.coincap.io/assets/icons/btc@2x.png' },
  ETH: { label: 'ETH', color: '#627eea', logo: 'https://assets.coincap.io/assets/icons/eth@2x.png' },
  SOL: { label: 'SOL', color: '#14f195', logo: 'https://assets.coincap.io/assets/icons/sol@2x.png' },
  XRP: { label: 'XRP', color: '#23292f', logo: 'https://assets.coincap.io/assets/icons/xrp@2x.png' },
  DOGE: { label: 'DOGE', color: '#c2a633', logo: 'https://assets.coincap.io/assets/icons/doge@2x.png' },
  LTC: { label: 'LTC', color: '#b8b8b8', logo: 'https://assets.coincap.io/assets/icons/ltc@2x.png' },
};

interface ChartBaseProps {
  data: any[];
  metric: Metric;
  asset: Asset;
  allTickers: string[];
  colorMap: Record<string, string>;
}

const useChartTheme = () => {
  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#cbd5e1' : '#475569';
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  return { isDark, textColor, gridColor };
};

const applyWatermark = (chart: Highcharts.Chart) => {
  try {
    const anyChart = chart as any;
    if (anyChart.__wm) {
      anyChart.__wm.destroy();
      anyChart.__wm = null;
    }
    const w = chart.chartWidth;
    const h = chart.chartHeight;
    if (!w || !h) return;

    const size = Math.min(w, h) * 0.52;
    const x = (w - size) / 2;
    const y = (h - size) / 2;

    anyChart.__wm = chart.renderer
      .image(WATERMARK_URL, x, y, size, size)
      .attr({ opacity: WATERMARK_OPACITY })
      .add();
  } catch (e) { }
};

const getTickerKeysUnion = (data: any[]) => {
  const keys = new Set<string>();
  data.forEach(d => {
    Object.keys(d || {}).forEach(k => {
      if (k !== 'date' && k !== 'totalGlobal' && k !== 'timestamp') keys.add(k);
    });
  });
  return Array.from(keys);
};

const getAllTickersFromData = (data: any[]) => {
  const meta = (data as any)?.__etfs;
  if (Array.isArray(meta) && meta.length > 0) return meta.filter(Boolean);
  return getTickerKeysUnion(data);
};

const makeColorMap = (tickers: string[]) => {
  const map: Record<string, string> = {};
  tickers.forEach((t, i) => { map[t] = PALETTE[i % PALETTE.length]; });
  return map;
};

const MissingDataOverlay: React.FC = () => (
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="px-4 py-2 rounded-xl bg-black/35 backdrop-blur-sm border border-white/10 text-white font-black tracking-wide">
      Em breve! Aguardem!
    </div>
  </div>
);

// --- COMPONENTES VISUAIS (Charts, Tables) ---

const StackedEtfChart: React.FC<ChartBaseProps> = ({ data, metric, allTickers, colorMap }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<Highcharts.Chart | null>(null);
  const { isDark, textColor, gridColor } = useChartTheme();

  useEffect(() => {
    if (!chartRef.current) return;
    if (!data || data.length === 0 || allTickers.length === 0) return;

    const series: any[] = allTickers.map((key) => ({
      name: key,
      data: data.map(d => [d.date, Number(d[key] ?? 0)]),
      color: colorMap[key],
      type: 'column',
      stack: 'etf',
    }));

    if (chartInstance.current) chartInstance.current.destroy();

    chartInstance.current = Highcharts.chart(chartRef.current, {
      time: { useUTC: true },
      chart: {
        backgroundColor: 'transparent',
        style: { fontFamily: 'Inter, sans-serif' },
        spacing: [10, 10, 10, 10],
        zooming: { mouseWheel: { enabled: true, type: 'x' } },
        panning: { enabled: true, type: 'x' },
        events: {
          load: function () { applyWatermark(this as any); },
          redraw: function () { applyWatermark(this as any); }
        }
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
          formatter: function (this: any) { return '$' + formatCompactNumber(this.value); }
        }
      },
      plotOptions: {
        column: { stacking: 'normal', borderWidth: 0, dataLabels: { enabled: false } },
        series: { stickyTracking: false, states: { inactive: { opacity: 1 } } }
      },
      tooltip: { enabled: false },
      series
    } as any);

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [data, metric, allTickers.join('|'), isDark, textColor, gridColor]);

  return <div ref={chartRef} className="w-full h-full" />;
};

const TotalBarChart: React.FC<ChartBaseProps> = ({ data, metric }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<Highcharts.Chart | null>(null);
  const { isDark, textColor, gridColor } = useChartTheme();

  useEffect(() => {
    if (!chartRef.current) return;
    if (!data || data.length === 0) return;

    const label = metric === 'flows' ? 'Total Net Flow' : 'Total Volume';

    const seriesData = data.map(d => {
      const val = Number(d.totalGlobal ?? 0);
      return {
        x: d.date,
        y: val,
        color: metric === 'volume'
          ? (isDark ? '#60a5fa' : '#2563eb')
          : (val >= 0 ? '#16a34a' : '#dc2626')
      };
    });

    if (chartInstance.current) chartInstance.current.destroy();

    chartInstance.current = Highcharts.chart(chartRef.current, {
      time: { useUTC: true },
      chart: {
        backgroundColor: 'transparent',
        style: { fontFamily: 'Inter, sans-serif' },
        spacing: [10, 10, 10, 10],
        zooming: { mouseWheel: { enabled: true, type: 'x' } },
        panning: { enabled: true, type: 'x' },
        events: {
          load: function () { applyWatermark(this as any); },
          redraw: function () { applyWatermark(this as any); }
        }
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
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
          formatter: function (this: any) { return '$' + formatCompactNumber(this.value); }
        }
      },
      tooltip: { enabled: false },
      plotOptions: {
        column: { borderWidth: 0, pointPadding: 0.1, groupPadding: 0.1 },
        series: { stickyTracking: false }
      },
      series: [{ name: label, type: 'column', data: seriesData, lineWidth: 1 }]
    } as any);

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [data, metric, isDark, textColor, gridColor]);

  return <div ref={chartRef} className="w-full h-full" />;
};

const EtfLinesChart: React.FC<ChartBaseProps & { selectedTicker: string | null }> = ({ data, metric, selectedTicker, colorMap }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<Highcharts.Chart | null>(null);
  const { isDark, textColor, gridColor } = useChartTheme();

  useEffect(() => {
    if (!chartRef.current) return;
    if (!data || data.length === 0 || !selectedTicker) return;

    const label = `${selectedTicker} ${metric === 'flows' ? 'Net Flow' : 'Volume'}`;
    if (chartInstance.current) chartInstance.current.destroy();

    chartInstance.current = Highcharts.chart(chartRef.current, {
      time: { useUTC: true },
      chart: {
        backgroundColor: 'transparent',
        style: { fontFamily: 'Inter, sans-serif' },
        spacing: [10, 10, 10, 10],
        zooming: { mouseWheel: { enabled: true, type: 'x' } },
        panning: { enabled: true, type: 'x' },
        events: {
          load: function () { applyWatermark(this as any); },
          redraw: function () { applyWatermark(this as any); }
        }
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
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
          formatter: function (this: any) { return '$' + formatCompactNumber(this.value); }
        }
      },
      tooltip: { enabled: false },
      series: [{
        name: label,
        type: 'spline',
        data: data.map(d => [d.date, Number(d[selectedTicker] ?? 0)]),
        color: colorMap[selectedTicker] ?? (isDark ? '#ffffff' : '#000000'),
        lineWidth: 2,
        marker: { enabled: false }
      }]
    } as any);

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [data, metric, selectedTicker, isDark, textColor, gridColor]);

  if (!selectedTicker) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400">
        <div className="flex flex-col items-center gap-2">
          <LineChart size={28} />
          <span className="text-xs font-black uppercase">Selecione uma ETF</span>
        </div>
      </div>
    );
  }

  return <div ref={chartRef} className="w-full h-full" />;
};

const MarketSharePanel: React.FC<{ data: any[], allTickers: string[] }> = ({ data, allTickers }) => {
    const aggregate = useMemo(() => {
        const map: Record<string, number> = {};
        let total = 0;
        data.forEach(d => {
            allTickers.forEach(t => {
                const val = Number(d[t] || 0);
                if (val > 0) { // Only positive flows count for share visual
                    map[t] = (map[t] || 0) + val;
                    total += val;
                }
            });
        });
        const sorted = Object.entries(map).sort((a,b) => b[1] - a[1]);
        return { sorted, total };
    }, [data, allTickers]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#1a1c1e] border-l border-gray-100 dark:border-slate-800/50">
            <div className="p-3 border-b border-gray-100 dark:border-slate-800/50 font-black text-xs text-gray-500 uppercase tracking-widest">
                Market Share (Period)
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                <table className="w-full text-xs">
                    <tbody>
                        {aggregate.sorted.map(([ticker, val]) => {
                            const pct = aggregate.total > 0 ? (val / aggregate.total) * 100 : 0;
                            return (
                                <tr key={ticker} className="border-b border-gray-50 dark:border-slate-800/30">
                                    <td className="py-2 font-bold text-gray-700 dark:text-gray-300">{ticker}</td>
                                    <td className="py-2 text-right font-mono text-gray-500">${formatCompactNumber(val)}</td>
                                    <td className="py-2 text-right font-bold text-[#dd9933]">{pct.toFixed(1)}%</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const EtfBubbles: React.FC<{ data: any[], allTickers: string[], colorMap: Record<string,string> }> = ({ data, allTickers, colorMap }) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const { isDark, textColor } = useChartTheme();

    useEffect(() => {
        if(!chartRef.current || !data.length) return;

        // Aggregate total positive volume for bubble size
        const seriesData = allTickers.map(t => {
            const totalVal = data.reduce((acc, curr) => acc + Math.max(0, Number(curr[t]||0)), 0);
            return {
                name: t,
                value: totalVal,
                color: colorMap[t]
            };
        }).filter(d => d.value > 0);

        Highcharts.chart(chartRef.current, {
            chart: { type: 'packedbubble', backgroundColor: 'transparent', height: '100%' },
            title: { text: null },
            tooltip: { useHTML: true, pointFormat: '<b>{point.name}:</b> ${point.value:,.0f}' },
            plotOptions: {
                packedbubble: {
                    minSize: '30%',
                    maxSize: '120%',
                    layoutAlgorithm: { gravitationalConstant: 0.05, splitSeries: false, seriesInteraction: true, dragBetweenSeries: true, parentNodeLimit: true },
                    dataLabels: { enabled: true, format: '{point.name}', filter: { property: 'y', operator: '>', value: 0 }, style: { color: 'black', textOutline: 'none', fontWeight: 'normal' } }
                }
            },
            series: [{ name: 'ETFs', data: seriesData }],
            credits: { enabled: false },
            legend: { enabled: false }
        } as any);
    }, [data, allTickers, colorMap, isDark]);

    return <div ref={chartRef} className="w-full h-full" />;
};

// --- PORTAL TOOLTIP COMPONENT ---
const PortalTooltip = ({ content }: { content: string }) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const show = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({ top: rect.top - 8, left: rect.left });
      setVisible(true);
    }
  };

  return (
    <>
      <div 
        ref={triggerRef} 
        onMouseEnter={show} 
        onMouseLeave={() => setVisible(false)}
        className="inline-flex items-center ml-1 cursor-help"
      >
        <Info size={12} className="text-gray-500 hover:text-[#dd9933]" />
      </div>
      {visible && createPortal(
        <div 
          className="fixed z-[9999] pointer-events-none bg-black text-white text-[10px] p-2 rounded border border-gray-700 shadow-xl max-w-[200px] leading-relaxed"
          style={{ top: coords.top, left: coords.left, transform: 'translateY(-100%)' }}
        >
          {content}
          <div className="absolute top-full left-2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-black"></div>
        </div>,
        document.body
      )}
    </>
  );
};

// --- PORTAL HELP TOOLTIP ---
const HelpTooltip = () => {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const show = () => {
      if(ref.current) {
          const rect = ref.current.getBoundingClientRect();
          setPos({ top: rect.bottom + 8, left: rect.right - 256 });
          setVisible(true);
      }
  };

  return (
    <>
        <div ref={ref} onMouseEnter={show} onMouseLeave={() => setVisible(false)} className="absolute top-2 right-2 group z-20">
            <Info size={16} className="text-gray-400 hover:text-[#dd9933] cursor-help" />
        </div>
        {visible && createPortal(
            <div 
                className="fixed z-[9999] w-64 p-3 bg-white dark:bg-[#1a1c1e] border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl opacity-100 pointer-events-none text-xs text-gray-600 dark:text-gray-300"
                style={{ top: pos.top, left: pos.left }}
            >
                <p className="font-bold mb-1">Como ler?</p>
                <p>Empilhado: contribuição por ETF no dia.</p>
                <p className="mt-1">Use roda do mouse para zoom horizontal e arraste para pan.</p>
            </div>,
            document.body
        )}
    </>
  );
};

// --- MAXIMIZED WIDGET ---
const EtfMaximized: React.FC<{ language: Language, onClose?: () => void, item: DashboardItem }> = ({ language, item }) => {
  const [asset, setAsset] = useState<Asset>('BTC');
  const [metric, setMetric] = useState<Metric>('flows');
  const [viewMode, setViewMode] = useState<ViewMode>('stacked');

  const [data, setData] = useState<any[]>([]);
  const [summaryData, setSummaryData] = useState<EtfFlowData | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // DETECT IF THIS IS THE "FULL PAGE" OR "MAIN BOARD MAXIMIZED"
  // If item.id is 'etf-page' (from IndicatorPage.tsx), show extras.
  // If item.id is anything else (e.g. 'main-etf' from Workspace/constants), hide extras.
  const showExtras = item.id === 'etf-page';

  // Summary (top KPI)
  useEffect(() => {
    fetchEtfFlow().then(res => setSummaryData(res));
  }, []);

  // Fetch main data ONLY when header toggles change
  useEffect(() => {
    setLoading(true);
    fetchEtfDetailed(asset, metric).then(res => {
      const arr = Array.isArray(res) ? res : [];
      setData(arr);
      setSelectedIndex(arr.length > 0 ? arr.length - 1 : -1);
      setLoading(false);
    });
  }, [asset, metric]);

  useEffect(() => {
    if (!Array.isArray(data) || data.length === 0) {
      if (selectedIndex !== -1) setSelectedIndex(-1);
      return;
    }
    const last = data.length - 1;
    if (selectedIndex < 0 || selectedIndex > last) setSelectedIndex(last);
  }, [data, selectedIndex]);

  const allTickers = useMemo(() => {
    return getAllTickersFromData(data);
  }, [data]);

  const colorMap = useMemo(() => {
    return makeColorMap(allTickers);
  }, [allTickers.join('|')]);

  useEffect(() => {
    if (viewMode !== 'lines') return;
    if (!allTickers.length) return;
    if (!selectedTicker || !allTickers.includes(selectedTicker)) setSelectedTicker(allTickers[0]);
  }, [viewMode, allTickers.join('|')]);

  const displayTotal = useMemo(() => {
    if (!summaryData) return 0;
    const sum =
      Number(summaryData.btcValue ?? 0) +
      Number(summaryData.ethValue ?? 0) +
      Number(summaryData.solValue ?? 0) +
      Number(summaryData.xrpValue ?? 0);
    return Number.isFinite(sum) && sum !== 0 ? sum : Number(summaryData.netFlow ?? 0);
  }, [summaryData]);

  const flowColor = displayTotal >= 0 ? 'text-green-400' : 'text-red-400';

  const isMissingCombo = useMemo(() => {
    if ((asset === 'DOGE' || asset === 'LTC') && metric === 'flows') return true;
    return false;
  }, [asset, metric]);

  const tickerButtons = useMemo(() => allTickers, [allTickers.join('|')]);

  const ChartArea = () => {
    if (isMissingCombo) {
      return (
        <div className="relative w-full h-full min-h-[300px]">
          <div className="w-full h-full rounded-xl bg-black/10 blur-[2px]" />
          <MissingDataOverlay />
        </div>
      );
    }

    if (loading) return <div className="flex items-center justify-center h-full min-h-[300px]"><Loader2 className="animate-spin text-gray-400" /></div>;

    if (!data || data.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center text-gray-400 gap-2 h-full min-h-[300px]">
          <AlertTriangle size={32} />
          <span className="text-sm font-bold uppercase">Sem dados disponíveis</span>
        </div>
      );
    }

    if (viewMode === 'total') return <TotalBarChart data={data} metric={metric} asset={asset} allTickers={allTickers} colorMap={colorMap} />;
    if (viewMode === 'lines') return <EtfLinesChart data={data} metric={metric} asset={asset} allTickers={allTickers} colorMap={colorMap} selectedTicker={selectedTicker} />;
    return <StackedEtfChart data={data} metric={metric} asset={asset} allTickers={allTickers} colorMap={colorMap} />;
  };

  return (
    <div className="w-full flex flex-col bg-white dark:bg-[#1a1c1e] text-gray-900 dark:text-white p-6 h-full min-h-0">
      {/* TOP BAR */}
      <div className="flex flex-col gap-3 mb-6 border-b border-gray-100 dark:border-slate-800 pb-4 shrink-0">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-1 text-xs font-black text-gray-400 uppercase tracking-widest">
                 Total Net Flow
                 <PortalTooltip content="Soma do valor em USD de todos os ETFs monitorados (diário)." />
              </div>
              <div className={`text-xl font-black font-mono mt-0.5 ${summaryData ? flowColor : 'text-gray-400'}`}>
                {summaryData ? '$' + formatCompactNumber(displayTotal) : '---'}
              </div>
            </div>

            <div className="w-px h-8 bg-gray-200 dark:bg-slate-700 hidden md:block mx-2" />

            {/* ASSET SELECTOR */}
            <div className="flex bg-gray-100 dark:bg-black/30 p-1 rounded-lg border border-gray-200 dark:border-slate-700">
              {(Object.keys(ASSETS_CONFIG) as Asset[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setAsset(key)}
                  className={`px-3 py-1.5 text-xs font-black rounded flex items-center gap-2 transition-all ${asset === key ? 'bg-white dark:bg-[#2f3032] shadow text-black dark:text-white' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
                >
                  <img src={ASSETS_CONFIG[key].logo} className="w-4 h-4 rounded-full" alt={key} />
                  {ASSETS_CONFIG[key].label}
                </button>
              ))}
            </div>

            {/* METRIC */}
            <div className="flex bg-gray-100 dark:bg-black/30 p-1 rounded-lg border border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setMetric('flows')}
                className={`px-4 py-1.5 text-xs font-black rounded flex items-center gap-2 transition-all ${metric === 'flows' ? 'bg-white dark:bg-[#2f3032] text-[#dd9933] shadow' : 'text-gray-500 hover:text-white'}`}
              >
                <TrendingUp size={14} /> Flows
              </button>
              <button
                onClick={() => setMetric('volume')}
                className={`px-4 py-1.5 text-xs font-black rounded flex items-center gap-2 transition-all ${metric === 'volume' ? 'bg-white dark:bg-[#2f3032] text-blue-400 shadow' : 'text-gray-500 hover:text-white'}`}
              >
                <BarChart3 size={14} /> Volume
              </button>
            </div>

            {/* VIEW MODE */}
            <div className="flex bg-gray-100 dark:bg-black/30 p-1 rounded-lg border border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode('stacked')}
                className={`px-4 py-1.5 text-xs font-black rounded flex items-center gap-2 transition-all ${viewMode === 'stacked' ? 'bg-white dark:bg-[#2f3032] text-gray-900 dark:text-white shadow' : 'text-gray-500 hover:text-white'}`}
              >
                <Layers size={14} /> Empilhado
              </button>
              <button
                onClick={() => setViewMode('total')}
                className={`px-4 py-1.5 text-xs font-black rounded flex items-center gap-2 transition-all ${viewMode === 'total' ? 'bg-white dark:bg-[#2f3032] text-gray-900 dark:text-white shadow' : 'text-gray-500 hover:text-white'}`}
              >
                <LineChart size={14} /> Total
              </button>
              <button
                onClick={() => setViewMode('lines')}
                className={`px-4 py-1.5 text-xs font-black rounded flex items-center gap-2 transition-all ${viewMode === 'lines' ? 'bg-white dark:bg-[#2f3032] text-gray-900 dark:text-white shadow' : 'text-gray-500 hover:text-white'}`}
              >
                <BarChart3 size={14} /> ETFs
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'lines' && !isMissingCombo && (
          <div className="flex gap-2 flex-wrap mt-2">
            {tickerButtons.map(t => (
              <button
                key={t}
                onClick={() => setSelectedTicker(t)}
                className={`px-3 py-1 text-xs font-black rounded-lg border transition-all ${selectedTicker === t ? 'bg-[#dd9933] text-white border-transparent shadow' : 'bg-gray-5 dark:bg-black/20 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-800 hover:text-gray-900 dark:hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* GRID CONTAINER - CONDITIONAL RENDER */}
      {showExtras ? (
          <div className="flex-1 min-h-0 grid grid-cols-12 gap-4">
              <div className="col-span-12 lg:col-span-2 overflow-hidden bg-gray-5 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-slate-800/50">
                  <MarketSharePanel data={data} allTickers={allTickers} />
              </div>
              <div className="col-span-12 lg:col-span-7 overflow-hidden relative bg-gray-5 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-slate-800/50 p-4 flex flex-col">
                  <div className="relative flex-1 min-h-0">
                      <ChartArea />
                  </div>
                  <HelpTooltip />
              </div>
              <div className="col-span-12 lg:col-span-3 overflow-hidden bg-gray-5 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-slate-800/50 p-4 flex flex-col">
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 text-center tracking-widest">Share Volumétrico</h4>
                  <div className="flex-1 min-h-0">
                      <EtfBubbles data={data} allTickers={allTickers} colorMap={colorMap} />
                  </div>
              </div>
          </div>
      ) : (
          /* SIMPLE MODE (MAIN BOARD MAXIMIZED) */
          <div className="flex-1 min-h-0 relative bg-gray-5 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-slate-800/50 p-4 flex flex-col">
             <div className="relative flex-1 min-h-0">
                 <ChartArea />
             </div>
             <HelpTooltip />
          </div>
      )}
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
          {t.lastUpdate} {new Date(etfData.timestamp).toLocaleDateString(undefined, { timeZone: 'UTC' })}
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
    return <EtfMaximized language={language} item={item} />;
  }
  return <EtfSummary language={language} />;
};

export default EtfFlowWidget;
