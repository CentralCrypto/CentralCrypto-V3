
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, TrendingUp, BarChart3, Layers, AlertTriangle, LineChart, Info, ChevronLeft, ChevronRight, DollarSign, ArrowUp, ArrowDown } from 'lucide-react';
import { fetchEtfFlow, fetchEtfDetailed, EtfFlowData } from '../../../services/api';
import { DashboardItem, Language } from '../../../types';
import { getTranslations } from '../../../locales';
import Highcharts from 'highcharts';
import mouseWheelZoom from 'highcharts/modules/mouse-wheel-zoom';

if (typeof mouseWheelZoom === 'function') {
  (mouseWheelZoom as any)(Highcharts);
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

  return <div ref={chartRef} className="w-full h-full min-h-[300px]" />;
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

  return <div ref={chartRef} className="w-full h-full min-h-[300px]" />;
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
      <div className="w-full h-full min-h-[300px] flex items-center justify-center text-gray-400">
        <div className="flex flex-col items-center gap-2">
          <LineChart size={28} />
          <span className="text-xs font-black uppercase">Selecione uma ETF</span>
        </div>
      </div>
    );
  }

  return <div ref={chartRef} className="w-full h-full min-h-[300px]" />;
};

// --- MINI TABLE (NO INTERNAL SCROLL) ---

const MarketSharePanel: React.FC<{
  data: any[];
  metric: Metric;
  asset: Asset;
  selectedIndex: number;
  onIndexChange: (idx: number) => void;
  allTickers: string[];
  colorMap: Record<string, string>;
}> = ({ data, metric, selectedIndex, onIndexChange, allTickers, colorMap }) => {

  const clampIndex = (idx: number) => {
    if (!Array.isArray(data) || data.length === 0) return -1;
    return Math.max(0, Math.min(idx, data.length - 1));
  };

  const safeIndex = clampIndex(selectedIndex);
  const currentDay = safeIndex >= 0 ? data[safeIndex] : null;

  const handlePrev = () => {
    const next = clampIndex((safeIndex >= 0 ? safeIndex : 0) - 1);
    if (next >= 0) onIndexChange(next);
  };
  const handleNext = () => {
    const next = clampIndex((safeIndex >= 0 ? safeIndex : 0) + 1);
    if (next >= 0) onIndexChange(next);
  };

  const dateStr = currentDay
    ? new Date(currentDay.date).toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' })
    : '--/--/----';

  const sumTickersAtIndex = (idx: number) => {
    const day = data[idx];
    if (!day) return 0;
    let s = 0;
    for (const t of allTickers) s += Number(day[t] ?? 0);
    return s;
  };

  const stats = useMemo(() => {
    if (!currentDay || safeIndex < 0) return { d1: 0 };
    const val = sumTickersAtIndex(safeIndex);
    return { d1: val };
  }, [currentDay, safeIndex, data, allTickers]);

  return (
    <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-white/5 rounded-lg text-xs">
        <button onClick={handlePrev} className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded"><ChevronLeft size={16}/></button>
        <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{dateStr}</span>
        <div className="flex gap-4">
            <div className="flex flex-col items-end">
                <span className="text-[9px] text-gray-500 uppercase">Total</span>
                <span className="font-mono font-black text-[#dd9933]">${formatCompactNumber(stats.d1)}</span>
            </div>
        </div>
        <button onClick={handleNext} className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded"><ChevronRight size={16}/></button>
    </div>
  );
};

const EtfFlowWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
    const [data, setData] = useState<any[]>([]);
    const [metric, setMetric] = useState<Metric>('flows');
    const [asset, setAsset] = useState<Asset>('BTC');
    const [viewMode, setViewMode] = useState<ViewMode>('stacked');
    const [loading, setLoading] = useState(true);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    
    const [allTickers, setAllTickers] = useState<string[]>([]);
    const [colorMap, setColorMap] = useState<Record<string, string>>({});

    useEffect(() => {
        setLoading(true);
        fetchEtfDetailed(asset, metric).then(res => {
            setData(res);
            const tickers = getAllTickersFromData(res);
            setAllTickers(tickers);
            setColorMap(makeColorMap(tickers));
            setSelectedIndex(res.length - 1);
            setLoading(false);
        });
    }, [asset, metric]);

    if (loading) return <div className="flex items-center justify-center h-full text-slate-500"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#1a1c1e] p-4 relative">
            <div className="flex justify-between items-center mb-4 z-10 relative">
                <div className="flex gap-2">
                    {Object.keys(ASSETS_CONFIG).map(k => (
                        <button 
                            key={k} 
                            onClick={() => setAsset(k as Asset)}
                            className={`px-3 py-1 text-xs font-bold rounded ${asset === k ? 'bg-[#dd9933] text-black' : 'bg-gray-100 dark:bg-white/10 text-gray-500'}`}
                        >
                            {k}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2 bg-gray-100 dark:bg-white/10 p-1 rounded">
                    <button onClick={() => setMetric('flows')} className={`px-2 py-1 text-[10px] uppercase font-bold rounded ${metric === 'flows' ? 'bg-white dark:bg-[#2f3032] shadow text-[#dd9933]' : 'text-gray-500'}`}>Flows</button>
                    <button onClick={() => setMetric('volume')} className={`px-2 py-1 text-[10px] uppercase font-bold rounded ${metric === 'volume' ? 'bg-white dark:bg-[#2f3032] shadow text-[#dd9933]' : 'text-gray-500'}`}>Volume</button>
                </div>
            </div>

            <div className="flex-1 min-h-0 relative z-0">
                {viewMode === 'stacked' && <StackedEtfChart data={data} metric={metric} asset={asset} allTickers={allTickers} colorMap={colorMap} />}
                {viewMode === 'total' && <TotalBarChart data={data} metric={metric} asset={asset} allTickers={allTickers} colorMap={colorMap} />}
                {viewMode === 'lines' && <EtfLinesChart data={data} metric={metric} asset={asset} allTickers={allTickers} colorMap={colorMap} selectedTicker={allTickers[0]} />}
            </div>

            <div className="mt-4 z-10 relative">
                <MarketSharePanel 
                    data={data} 
                    metric={metric} 
                    asset={asset} 
                    selectedIndex={selectedIndex} 
                    onIndexChange={setSelectedIndex}
                    allTickers={allTickers}
                    colorMap={colorMap}
                />
            </div>
        </div>
    );
};

export default EtfFlowWidget;
