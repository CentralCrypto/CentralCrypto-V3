import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, TrendingUp, BarChart3, Layers, AlertTriangle, LineChart, Info, ChevronLeft, ChevronRight, DollarSign, ArrowUp, ArrowDown } from 'lucide-react';
import { fetchEtfFlow, fetchEtfDetailed, EtfFlowData } from '../services/api';
import { DashboardItem, Language } from '../../../types';
import { getTranslations } from '../../../locales';
import Highcharts from 'highcharts';
import mouseWheelZoom from 'highcharts/modules/mouse-wheel-zoom';

if (typeof mouseWheelZoom === 'function') {
  (mouseWheelZoom as any)(Highcharts);
}

const NO_DATA_MSG = 'Em breve! Aguardem!';

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

const WATERMARK_URL = '/v3/img/logo.png';
const WATERMARK_OPACITY = 0.06;

type Metric = 'flows' | 'volume';
type Asset = 'BTC' | 'ETH' | 'SOL' | 'XRP' | 'DOGE' | 'LTC';
type ViewMode = 'stacked' | 'total' | 'lines';

const ASSETS_CONFIG: Record<Asset, { label: string, color: string, logo: string }> = {
  BTC: { label: 'BTC', color: '#f7931a', logo: 'https://assets.coincap.io/assets/icons/btc@2x.png' },
  ETH: { label: 'ETH', color: '#627eea', logo: 'https://assets.coincap.io/assets/icons/eth@2x.png' },
  SOL: { label: 'SOL', color: '#14f195', logo: 'https://assets.coincap.io/assets/icons/sol@2x.png' },
  XRP: { label: 'XRP', color: '#23292f', logo: 'https://assets.coincap.io/assets/icons/xrp@2x.png' },
  DOGE: { label: 'DOGE', color: '#c2a633', logo: 'https://assets.coincap.io/assets/icons/doge@2x.png' },
  LTC: { label: 'LTC', color: '#345d9d', logo: 'https://assets.coincap.io/assets/icons/ltc@2x.png' }
};

interface ChartBaseProps {
  data: any[];
  metric: Metric;
  asset: Asset;
}

const useChartTheme = () => {
  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#94a3b8' : '#475569';
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
    const size = Math.min(w, h) * 0.48;
    const x = (w - size) / 2;
    const y = (h - size) / 2;
    anyChart.__wm = chart.renderer
      .image(WATERMARK_URL, x, y, size, size)
      .attr({ opacity: WATERMARK_OPACITY })
      .add();
  } catch (e) {}
};

const getAllTickerKeys = (data: any[]) => {
  const keys = new Set<string>();
  data.forEach(d => {
    Object.keys(d || {}).forEach(k => {
      if (k !== 'date' && k !== 'totalGlobal' && k !== 'timestamp') keys.add(k);
    });
  });
  return Array.from(keys);
};

const NoDataChart: React.FC = () => {
  return (
    <div className="w-full h-full min-h-[360px] rounded-xl border border-gray-100 dark:border-slate-800/50 bg-gray-50 dark:bg-black/20 overflow-hidden relative">
      <div className="absolute inset-0 blur-[2px] opacity-40">
        <div className="w-full h-full bg-gradient-to-b from-transparent via-white/5 to-transparent" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="px-4 py-2 rounded-lg bg-black/40 text-white text-sm font-black">
          {NO_DATA_MSG}
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <img src={WATERMARK_URL} className="w-[42%] opacity-[0.06]" alt="watermark" />
      </div>
    </div>
  );
};

// --- CHARTS ---
const StackedEtfChart: React.FC<ChartBaseProps> = React.memo(({ data, metric }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<Highcharts.Chart | null>(null);
  const { isDark, textColor, gridColor } = useChartTheme();

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

    const seriesKeys = getAllTickerKeys(data);
    const series: any[] = seriesKeys.map((key, idx) => ({
      name: key,
      data: data.map(d => [d.date, Number(d[key] ?? 0)]),
      color: PALETTE[idx % PALETTE.length],
      type: 'column',
      stack: 'etf'
    }));

    if (chartInstance.current) chartInstance.current.destroy();

    chartInstance.current = Highcharts.chart(chartRef.current, {
      chart: {
        backgroundColor: 'transparent',
        style: { fontFamily: 'Inter, sans-serif' },
        spacing: [10, 10, 28, 10],
        zooming: { mouseWheel: { enabled: true, type: 'x' }, type: undefined },
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
        layout: 'horizontal',
        align: 'center',
        verticalAlign: 'bottom',
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
      tooltip: {
        backgroundColor: isDark ? 'rgba(26, 28, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        borderColor: gridColor,
        borderRadius: 8,
        style: { color: isDark ? '#fff' : '#000' },
        shared: true,
        valuePrefix: '$',
        valueDecimals: 0,
        followPointer: false
      },
      series
    } as any);

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [data, metric, isDark, textColor, gridColor]);

  return <div ref={chartRef} className="w-full h-full min-h-[420px]" />;
});

const TotalBarChart: React.FC<ChartBaseProps> = React.memo(({ data, metric }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<Highcharts.Chart | null>(null);
  const { isDark, textColor, gridColor } = useChartTheme();

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

    const label = metric === 'flows' ? 'Total Net Flow' : 'Total Volume';
    const seriesData = data.map(d => {
      const val = Number(d.totalGlobal ?? 0);
      return {
        x: d.date,
        y: val,
        color: metric === 'volume'
          ? (isDark ? '#3b82f6' : '#2563eb')
          : (val >= 0 ? '#16a34a' : '#dc2626')
      };
    });

    if (chartInstance.current) chartInstance.current.destroy();

    chartInstance.current = Highcharts.chart(chartRef.current, {
      chart: {
        backgroundColor: 'transparent',
        style: { fontFamily: 'Inter, sans-serif' },
        spacing: [10, 10, 10, 10],
        zooming: { mouseWheel: { enabled: true, type: 'x' }, type: undefined },
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
      tooltip: {
        backgroundColor: isDark ? 'rgba(26, 28, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        borderColor: gridColor,
        borderRadius: 8,
        style: { color: isDark ? '#fff' : '#000' },
        shared: false,
        valuePrefix: '$',
        valueDecimals: 0,
        followPointer: false
      },
      plotOptions: {
        column: { borderWidth: 0, pointPadding: 0.1, groupPadding: 0.1 },
        series: { stickyTracking: false }
      },
      series: [{ name: label, type: 'column', data: seriesData }]
    } as any);

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [data, metric, isDark, textColor, gridColor]);

  return <div ref={chartRef} className="w-full h-full min-h-[420px]" />;
});

const EtfLinesChart: React.FC<ChartBaseProps & { selectedTicker: string | null }> = React.memo(({ data, metric, selectedTicker }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<Highcharts.Chart | null>(null);
  const { isDark, textColor, gridColor } = useChartTheme();

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0 || !selectedTicker) return;

    const label = `${selectedTicker} ${metric === 'flows' ? 'Net Flow' : 'Volume'}`;
    if (chartInstance.current) chartInstance.current.destroy();

    chartInstance.current = Highcharts.chart(chartRef.current, {
      chart: {
        backgroundColor: 'transparent',
        style: { fontFamily: 'Inter, sans-serif' },
        spacing: [10, 10, 10, 10],
        zooming: { mouseWheel: { enabled: true, type: 'x' }, type: undefined },
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
      tooltip: {
        backgroundColor: isDark ? 'rgba(26, 28, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        borderColor: gridColor,
        borderRadius: 8,
        style: { color: isDark ? '#fff' : '#000' },
        shared: false,
        valuePrefix: '$',
        valueDecimals: 0
      },
      plotOptions: { series: { marker: { enabled: false } } },
      series: [{
        name: label,
        type: 'spline',
        data: data.map(d => [d.date, Number(d[selectedTicker] ?? 0)]),
        color: isDark ? '#ffffff' : '#000000',
        lineWidth: 1
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
      <div className="w-full h-full min-h-[420px] flex items-center justify-center text-gray-400">
        <div className="flex flex-col items-center gap-2">
          <LineChart size={28} />
          <span className="text-xs font-black uppercase">Selecione uma ETF</span>
        </div>
      </div>
    );
  }

  return <div ref={chartRef} className="w-full h-full min-h-[420px]" />;
});

// --- MINI TABLE WITH PAGINATION & CARDS ---
const MarketSharePanel: React.FC<{
  data: any[],
  metric: Metric,
  selectedIndex: number,
  onIndexChange: (idx: number) => void,
  allTickers: string[]
}> = ({ data, metric, selectedIndex, onIndexChange, allTickers }) => {

  const handlePrev = () => { if (selectedIndex > 0) onIndexChange(selectedIndex - 1); };
  const handleNext = () => { if (selectedIndex < data.length - 1) onIndexChange(selectedIndex + 1); };

  const currentDay = data[selectedIndex];

  const dateStr = currentDay
    ? new Date(currentDay.date).toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' })
    : '--/--/----';

  const stats = useMemo(() => {
    if (!currentDay) return { d1: 0, d7: 0, d30: 0 };
    const val1 = Number(currentDay.totalGlobal ?? 0);

    let sum7 = 0;
    for (let i = selectedIndex; i > Math.max(-1, selectedIndex - 7); i--) sum7 += Number(data[i]?.totalGlobal ?? 0);

    let sum30 = 0;
    for (let i = selectedIndex; i > Math.max(-1, selectedIndex - 30); i--) sum30 += Number(data[i]?.totalGlobal ?? 0);

    return { d1: val1, d7: sum7, d30: sum30 };
  }, [data, selectedIndex, currentDay]);

  const ranking = useMemo(() => {
    if (!currentDay) return [];
    return allTickers
      .map(ticker => ({ ticker, value: Number(currentDay[ticker] ?? 0) }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }, [currentDay, allTickers]);

  const SummaryCard = ({ label, value }: { label: string, value: number }) => (
    <div className="flex flex-col items-center justify-center p-2 bg-gray-50 dark:bg-black/30 rounded-lg border border-gray-200 dark:border-slate-800 shadow-sm flex-1">
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`text-sm font-black font-mono ${metric === 'volume' ? 'text-blue-500' : (value >= 0 ? 'text-green-500' : 'text-red-500')}`}>
        ${formatCompactNumber(value)}
      </span>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex gap-2 mb-3 shrink-0">
        <SummaryCard label="1D" value={stats.d1} />
        <SummaryCard label="7D" value={stats.d7} />
        <SummaryCard label="30D" value={stats.d30} />
      </div>

      <div className="p-3 bg-gray-50 dark:bg-black/30 border-b border-gray-100 dark:border-slate-800 font-black text-xs uppercase text-gray-500 tracking-widest flex items-center justify-between">
        <div className="flex items-center gap-2"><Layers size={14} /> Market Share</div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrev} disabled={selectedIndex <= 0} className="p-1 hover:text-[#dd9933] disabled:opacity-30 disabled:hover:text-gray-500">
            <ChevronLeft size={16} />
          </button>
          <span className="text-gray-800 dark:text-gray-200 font-mono">{dateStr}</span>
          <button onClick={handleNext} disabled={selectedIndex >= data.length - 1} className="p-1 hover:text-[#dd9933] disabled:opacity-30 disabled:hover:text-gray-500">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {ranking.length === 0 ? (
          <div className="p-4 text-center text-xs text-gray-500">Sem dados para esta data.</div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-gray-50 dark:bg-black/20 text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-800">
              <tr>
                <th className="p-2 font-black uppercase">ETF</th>
                <th className="p-2 text-right font-black uppercase">Value (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {ranking.map(item => {
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// --- BUBBLES ---
const EtfBubbles: React.FC<{
  data: any[],
  selectedIndex: number,
  metric: Metric,
  allTickers: string[]
}> = ({ data, selectedIndex, metric, allTickers }) => {

  const currentDay = data[selectedIndex];

  const bubbles = useMemo(() => {
    if (!currentDay) return [];
    return allTickers.map(ticker => {
      const hasVal = Object.prototype.hasOwnProperty.call(currentDay, ticker);
      const val = Number(currentDay[ticker] ?? 0);
      return {
        id: ticker,
        val,
        absVal: Math.abs(val),
        hasVal
      };
    }).sort((a, b) => b.absVal - a.absVal);
  }, [currentDay, allTickers]);

  if (!currentDay || bubbles.length === 0) {
    return (
      <div className="h-full min-h-[380px] flex items-center justify-center text-xs text-gray-500">
        {NO_DATA_MSG}
      </div>
    );
  }

  const maxVal = Math.max(...bubbles.map(b => b.absVal)) || 1;
  const minSize = 38;
  const maxSize = 128;

  const scaleMarks = useMemo(() => {
    const a = maxVal;
    return {
      p10: a * 0.10,
      p50: a * 0.50,
      p100: a
    };
  }, [maxVal]);

  const BubbleScale = () => {
    const sizes = [
      { label: '10%', v: scaleMarks.p10 },
      { label: '50%', v: scaleMarks.p50 },
      { label: 'MAX', v: scaleMarks.p100 }
    ];
    return (
      <div className="flex items-end gap-6">
        {sizes.map(s => {
          const size = minSize + ((Math.abs(s.v) / maxVal) * (maxSize - minSize));
          return (
            <div key={s.label} className="flex items-center gap-2">
              <div
                className="rounded-full border border-gray-300/40 dark:border-white/10 bg-gray-200/30 dark:bg-white/5 shadow-inner"
                style={{ width: size * 0.38, height: size * 0.38 }}
              />
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] font-black text-gray-400 uppercase">{s.label}</span>
                <span className="text-[10px] font-mono font-black text-gray-600 dark:text-gray-300">
                  ${formatCompactNumber(s.v)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-[420px] bg-gray-50 dark:bg-black/20 rounded-xl p-4 border border-gray-100 dark:border-slate-800 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <img src={WATERMARK_URL} className="w-[40%] opacity-[0.05]" alt="watermark" />
      </div>

      <div className="flex justify-between items-start mb-3 gap-3 relative z-10">
        <div className="flex items-center gap-2 text-xs font-black uppercase text-gray-500 dark:text-gray-400">
          <DollarSign size={14} /> ETF Bubbles
        </div>
        <BubbleScale />
      </div>

      <div className="flex-1 relative overflow-hidden flex flex-wrap content-center justify-center gap-4 p-4 z-10">
        {bubbles.map(b => {
          const size = b.hasVal
            ? (minSize + ((b.absVal / maxVal) * (maxSize - minSize)))
            : 44;

          const colorClass = !b.hasVal
            ? 'bg-gray-400/15 border-gray-400/30 text-gray-300'
            : (metric === 'volume'
              ? 'bg-blue-500/20 border-blue-500/50 text-blue-100'
              : (b.val >= 0 ? 'bg-green-500/20 border-green-500/50 text-green-100' : 'bg-red-500/20 border-red-500/50 text-red-100'));

          return (
            <div
              key={b.id}
              className={`rounded-full border flex flex-col items-center justify-center transition-all duration-300 hover:scale-105 shadow-lg cursor-default backdrop-blur-sm ${colorClass}`}
              style={{ width: size, height: size }}
            >
              <span className="font-black text-[10px] sm:text-xs leading-none">{b.id}</span>
              <span className="text-[9px] sm:text-[10px] font-bold mt-0.5">
                ${formatCompactNumber(b.val)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- TOOLTIP (kept) ---
const HelpTooltip = () => (
  <div className="absolute top-2 right-2 group z-20">
    <Info size={16} className="text-gray-400 hover:text-[#dd9933] cursor-help" />
    <div className="absolute right-0 top-6 w-64 p-3 bg-white dark:bg-[#1a1c1e] border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-xs text-gray-600 dark:text-gray-300 z-50">
      <p className="font-bold mb-1">Como ler este gráfico?</p>
      <p>Os dados mostram o fluxo líquido (Net Flow) ou Volume diário dos ETFs Spot nos EUA.</p>
      <p className="mt-1">Valores positivos indicam entrada de capital. Valores negativos indicam saída.</p>
    </div>
  </div>
);

// --- MAXIMIZED ---
const EtfMaximized: React.FC<{ language: Language, onClose?: () => void }> = ({ language }) => {
  const [asset, setAsset] = useState<Asset>('BTC');
  const [metric, setMetric] = useState<Metric>('flows');
  const [viewMode, setViewMode] = useState<ViewMode>('stacked');

  const [data, setData] = useState<any[]>([]);
  const [summaryData, setSummaryData] = useState<EtfFlowData | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  useEffect(() => {
    fetchEtfFlow().then(res => setSummaryData(res));
  }, []);

  useEffect(() => {
    setLoading(true);

    fetchEtfDetailed(asset as any, metric as any).then(res => {
      const arr = Array.isArray(res) ? res : [];
      setData(arr);
      setSelectedIndex(arr.length > 0 ? arr.length - 1 : -1);

      const allKeys = getAllTickerKeys(arr);
      if (viewMode === 'lines') setSelectedTicker(allKeys[0] || null);

      setLoading(false);
    });
  }, [asset, metric]);

  const allTickers = useMemo(() => {
    return getAllTickerKeys(data);
  }, [data]);

  useEffect(() => {
    if (viewMode !== 'lines') return;
    if (!allTickers.length) return;
    if (!selectedTicker || !allTickers.includes(selectedTicker)) setSelectedTicker(allTickers[0] || null);
  }, [viewMode, allTickers, selectedTicker]);

  const totalHeaderFlow = useMemo(() => {
    if (!summaryData) return 0;
    const sum = (summaryData.btcValue || 0) + (summaryData.ethValue || 0) + (summaryData.solValue || 0) + (summaryData.xrpValue || 0);
    return sum !== 0 ? sum : (summaryData.netFlow || 0);
  }, [summaryData]);

  const flowColor = totalHeaderFlow >= 0 ? 'text-green-500' : 'text-red-500';

  const unsupportedCombo = useMemo(() => {
    const flowsNotAvailable = (asset === 'DOGE' || asset === 'LTC') && metric === 'flows';
    return flowsNotAvailable;
  }, [asset, metric]);

  const ChartAreaEl = useMemo(() => {
    if (loading) {
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="animate-spin text-gray-400" />
        </div>
      );
    }

    if (unsupportedCombo) return <NoDataChart />;

    if (!data || data.length === 0) {
      return <NoDataChart />;
    }

    if (viewMode === 'total') return <TotalBarChart data={data} metric={metric} asset={asset} />;
    if (viewMode === 'lines') return <EtfLinesChart data={data} metric={metric} asset={asset} selectedTicker={selectedTicker} />;
    return <StackedEtfChart data={data} metric={metric} asset={asset} />;
  }, [loading, data, metric, asset, viewMode, selectedTicker, unsupportedCombo]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1a1c1e] text-gray-900 dark:text-white overflow-hidden p-6">
      {/* TOP BAR */}
      <div className="flex flex-col gap-3 mb-6 border-b border-gray-100 dark:border-slate-800 pb-4">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-baseline gap-2">
              <div className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Net Flow</div>
              <div className={`text-xl font-black font-mono ${summaryData ? flowColor : 'text-gray-400'}`}>
                {summaryData ? '$' + formatCompactNumber(totalHeaderFlow) : '---'}
              </div>
            </div>

            <div className="w-px h-6 bg-gray-200 dark:bg-slate-700 hidden md:block"></div>

            {/* ASSET */}
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
                <BarChart3 size={14} /> Linhas
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'lines' && !unsupportedCombo && (
          <div className="flex gap-2 flex-wrap mt-2">
            {allTickers.map(t => (
              <button
                key={t}
                onClick={() => setSelectedTicker(t)}
                className={`px-3 py-1 text-xs font-black rounded-lg border transition-all ${selectedTicker === t ? 'bg-[#dd9933] text-white border-transparent shadow' : 'bg-gray-50 dark:bg-black/20 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-800 hover:text-gray-900 dark:hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* MAIN GRID LAYOUT (no hard height lock / no % split) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-2 flex flex-col gap-6 min-h-0 overflow-visible">
          <div className="relative bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-slate-800/50 p-4 overflow-visible min-h-[460px]">
            {ChartAreaEl}
            {!unsupportedCombo && !loading && data.length > 0 && <HelpTooltip />}
          </div>

          <div className="min-h-[460px] overflow-visible">
            {unsupportedCombo || loading || data.length === 0 ? (
              <NoDataChart />
            ) : (
              <EtfBubbles
                data={data}
                selectedIndex={selectedIndex}
                metric={metric}
                allTickers={allTickers}
              />
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="bg-white dark:bg-[#1a1c1e] border border-gray-100 dark:border-slate-800 rounded-xl flex flex-col overflow-hidden min-h-0">
          {loading ? (
            <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
          ) : (
            <MarketSharePanel
              data={data}
              metric={metric}
              selectedIndex={selectedIndex}
              onIndexChange={setSelectedIndex}
              allTickers={allTickers}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// --- MINIMIZED ---
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
  if (item.isMaximized) return <EtfMaximized language={language} />;
  return <EtfSummary language={language} />;
};

export default EtfFlowWidget;
