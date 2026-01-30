
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, ArrowUp, ArrowDown, TrendingUp, BarChart3, Layers, AlertTriangle, LineChart, Info } from 'lucide-react';
import { fetchEtfFlow, fetchEtfDetailed, EtfFlowData } from '../services/api';
import { DashboardItem, Language } from '../../../types';
import { getTranslations } from '../../../locales';
import Highcharts from 'highcharts';
import mouseWheelZoom from 'highcharts/modules/mouse-wheel-zoom';

// Inicialização segura do módulo de zoom
if (typeof mouseWheelZoom === 'function') {
    (mouseWheelZoom as any)(Highcharts);
}

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

// ⚠️ Ajuste aqui se o caminho do teu logo for diferente:
const WATERMARK_URL = '/v3/img/logo.png';
const WATERMARK_OPACITY = 0.07;

type Metric = 'flows' | 'volume';
type Asset = 'BTC' | 'ETH';
type ViewMode = 'stacked' | 'total' | 'lines';

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

    // Tamanho proporcional
    const size = Math.min(w, h) * 0.45;
    const x = (w - size) / 2;
    const y = (h - size) / 2;

    anyChart.__wm = chart.renderer
      .image(WATERMARK_URL, x, y, size, size)
      .attr({ opacity: WATERMARK_OPACITY })
      .add();
  } catch (e) {
    // Não quebra o gráfico se a imagem falhar
  }
};

const getTickerKeys = (data: any[]) => {
  const keys = new Set<string>();
  data.forEach(d => {
    Object.keys(d).forEach(k => {
      if (k !== 'date' && k !== 'totalGlobal' && k !== 'timestamp') keys.add(k);
    });
  });
  return Array.from(keys);
};

// -------------------- CHART 1: STACKED (ETFs) --------------------
const StackedEtfChart: React.FC<ChartBaseProps> = ({ data, metric }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<Highcharts.Chart | null>(null);
  const { isDark, textColor, gridColor } = useChartTheme();

  useEffect(() => {
    if (!chartRef.current) return;

    if (!data || data.length === 0) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
      return;
    }

    const seriesKeys = getTickerKeys(data);

    const series: any[] = seriesKeys.map((key, idx) => ({
      name: key,
      data: data.map(d => [d.date, Number(d[key] || 0)]),
      color: PALETTE[idx % PALETTE.length],
      type: 'column',
      stack: 'etf'
    }));

    if (chartInstance.current) chartInstance.current.destroy();

    chartInstance.current = Highcharts.chart(chartRef.current, {
      chart: {
        backgroundColor: 'transparent',
        style: { fontFamily: 'Inter, sans-serif' },
        spacing: [10, 10, 10, 10],
        zooming: {
            mouseWheel: { enabled: true },
            type: 'x' // Required for scroll zoom to identify axis
        },
        panning: {
            enabled: true,
            type: 'x'
        },
        panKey: undefined,
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
        column: {
          stacking: 'normal',
          borderWidth: 0,
          dataLabels: { enabled: false }
        },
        series: {
          states: { inactive: { opacity: 1 } }
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
      series
    } as any);

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [data, metric, isDark, textColor, gridColor]);

  return <div ref={chartRef} className="w-full h-full min-h-[320px]" />;
};

// -------------------- CHART 2: TOTAL (Modificado para Colunas não-empilhadas) --------------------
const TotalBarChart: React.FC<ChartBaseProps> = ({ data, metric }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<Highcharts.Chart | null>(null);
  const { isDark, textColor, gridColor } = useChartTheme();

  useEffect(() => {
    if (!chartRef.current) return;

    if (!data || data.length === 0) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
      return;
    }

    const label = metric === 'flows' ? 'Total Net Flow' : 'Total Volume';

    // Prepara dados com cor condicional
    const seriesData = data.map(d => {
        const val = Number(d.totalGlobal || 0);
        return {
            x: d.date,
            y: val,
            color: metric === 'volume' 
                ? (isDark ? '#3b82f6' : '#2563eb') // Azul para volume
                : (val >= 0 ? '#16a34a' : '#dc2626') // Verde/Vermelho para flows
        };
    });

    if (chartInstance.current) chartInstance.current.destroy();

    chartInstance.current = Highcharts.chart(chartRef.current, {
      chart: {
        backgroundColor: 'transparent',
        style: { fontFamily: 'Inter, sans-serif' },
        spacing: [10, 10, 10, 10],
        zooming: {
            mouseWheel: { enabled: true },
            type: 'x'
        },
        panning: {
            enabled: true,
            type: 'x'
        },
        panKey: undefined,
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
      plotOptions: {
        column: {
            borderWidth: 0,
            pointPadding: 0.1,
            groupPadding: 0.1
        }
      },
      series: [{
        name: label,
        type: 'column',
        data: seriesData,
        lineWidth: 1
      }]
    } as any);

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [data, metric, isDark, textColor, gridColor]);

  return <div ref={chartRef} className="w-full h-full min-h-[320px]" />;
};

// -------------------- CHART 3: LINES (1 ETF por vez) --------------------
const EtfLinesChart: React.FC<ChartBaseProps & { selectedTicker: string | null }> = ({ data, metric, selectedTicker }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<Highcharts.Chart | null>(null);
  const { isDark, textColor, gridColor } = useChartTheme();

  useEffect(() => {
    if (!chartRef.current) return;

    if (!data || data.length === 0) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
      return;
    }

    if (!selectedTicker) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
      return;
    }

    const label = `${selectedTicker} ${metric === 'flows' ? 'Net Flow' : 'Volume'}`;

    if (chartInstance.current) chartInstance.current.destroy();

    chartInstance.current = Highcharts.chart(chartRef.current, {
      chart: {
        backgroundColor: 'transparent',
        style: { fontFamily: 'Inter, sans-serif' },
        spacing: [10, 10, 10, 10],
        zooming: {
            mouseWheel: { enabled: true },
            type: 'x'
        },
        panning: {
            enabled: true,
            type: 'x'
        },
        panKey: undefined,
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
      series: [{
        name: label,
        type: 'spline',
        data: data.map(d => [d.date, Number(d[selectedTicker] || 0)]),
        color: isDark ? '#ffffff' : '#000000',
        lineWidth: 1, // LINHA FINA 1PX
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
      <div className="w-full h-full min-h-[320px] flex items-center justify-center text-gray-400">
        <div className="flex flex-col items-center gap-2">
          <LineChart size={28} />
          <span className="text-xs font-black uppercase">Selecione uma ETF</span>
        </div>
      </div>
    );
  }

  return <div ref={chartRef} className="w-full h-full min-h-[320px]" />;
};

const EtfRankingTable: React.FC<{ data: any[], metric: Metric }> = ({ data, metric }) => {
  const lastDay = data[data.length - 1];
  if (!lastDay) return null;

  // Usa TODOS os tickers encontrados no dataset, não apenas os do último dia (para incluir 0)
  const allKeys = new Set<string>();
  data.forEach(d => {
      Object.keys(d).forEach(k => {
          if (k !== 'date' && k !== 'totalGlobal' && k !== 'timestamp') allKeys.add(k);
      });
  });
  
  const keys = Array.from(allKeys);
  const total = Number(lastDay.totalGlobal || 0);

  if (keys.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-gray-50 dark:bg-black/20 text-gray-500 dark:text-slate-400">
            <tr>
              <th className="p-2 font-black uppercase">Resumo</th>
              <th className="p-2 text-right font-black uppercase">Value (USD)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            <tr className="hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
              <td className="p-2 font-bold text-gray-700 dark:text-slate-300">Total Agregado</td>
              <td className={`p-2 text-right font-mono font-black ${metric === 'volume' ? 'text-gray-900 dark:text-white' : (total >= 0 ? 'text-green-500' : 'text-red-500')}`}>
                ${formatCompactNumber(total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // Ordena do maior para menor em absoluto
  const ranking = keys.map(k => ({
    ticker: k,
    value: Number(lastDay[k] || 0)
  })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
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
      </div>
      {/* TOTALIZADOR NO RODAPÉ */}
      <div className="bg-gray-50 dark:bg-black/20 border-t border-gray-100 dark:border-slate-800 p-2 text-xs">
          <div className="flex justify-between items-center">
              <span className="font-black text-gray-500 dark:text-slate-400 uppercase">TOTAL</span>
              <span className={`font-mono font-black ${metric === 'volume' ? 'text-gray-900 dark:text-white' : (total >= 0 ? 'text-green-500' : 'text-red-500')}`}>
                  ${formatCompactNumber(total)}
              </span>
          </div>
      </div>
    </div>
  );
};

// --- TOOLTIP DE AJUDA ---
const HelpTooltip = () => (
    <div className="absolute top-2 right-2 z-20 group">
        <div className="bg-white/10 p-1.5 rounded-full backdrop-blur-sm cursor-help hover:bg-white/20 transition-colors text-gray-400 hover:text-white border border-white/5">
            <Info size={14} />
        </div>
        <div className="absolute right-0 top-full mt-2 w-48 p-3 bg-white dark:bg-[#1a1c1e] border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-xs text-gray-600 dark:text-gray-300 z-50">
            <div className="font-bold mb-2 text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-700 pb-1">Navegação</div>
            <div className="flex justify-between mb-1"><span>Zoom:</span> <span className="font-mono bg-gray-100 dark:bg-white/10 px-1 rounded">Scroll</span></div>
            <div className="flex justify-between"><span>Pan:</span> <span className="font-mono bg-gray-100 dark:bg-white/10 px-1 rounded">Drag</span></div>
        </div>
    </div>
);

// --- MAXIMIZED WIDGET (DEEP DIVE) ---
const EtfMaximized: React.FC<{ language: Language, onClose?: () => void }> = ({ language }) => {
  const [asset, setAsset] = useState<Asset>('BTC');
  const [metric, setMetric] = useState<Metric>('flows');
  const [viewMode, setViewMode] = useState<ViewMode>('stacked');
  const [data, setData] = useState<any[]>([]);
  const [flowsData, setFlowsData] = useState<any[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Sempre mantém flows carregado pra mostrar Total Net Flow no topo (mesmo se o usuário estiver vendo volume)
  useEffect(() => {
    fetchEtfDetailed(asset, 'flows').then(res => {
      setFlowsData(Array.isArray(res) ? res : []);
    });
  }, [asset]);

  useEffect(() => {
    setLoading(true);
    fetchEtfDetailed(asset, metric).then(res => {
      const arr = Array.isArray(res) ? res : [];
      setData(arr);
      setLoading(false);

      // Auto-select no modo lines
      if (viewMode === 'lines') {
        const keys = getTickerKeys(arr);
        setSelectedTicker(keys[0] || null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, metric]);

  useEffect(() => {
    if (viewMode === 'lines') {
      const keys = getTickerKeys(data);
      if (!selectedTicker || !keys.includes(selectedTicker)) {
        setSelectedTicker(keys[0] || null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  const hasData = data && data.length > 0;
  const hasFlows = flowsData && flowsData.length > 0;

  const lastFlow = hasFlows ? Number(flowsData[flowsData.length - 1]?.totalGlobal || 0) : 0;
  const flowColor = lastFlow >= 0 ? 'text-green-500' : 'text-red-500';

  const tickerButtons = useMemo(() => {
    if (!hasData) return [];
    return getTickerKeys(data);
  }, [hasData, data]);

  const ChartArea = () => {
    if (loading) {
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="animate-spin text-gray-400" />
        </div>
      );
    }

    if (!hasData) {
      if (metric === 'volume') {
        console.warn('[ETF] Volume retornou vazio. Verifique ENDPOINTS.cachecko.files.etfBtcVolume/etfEthVolume e o JSON no VPS.');
      }
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
          <AlertTriangle size={32} />
          <span className="text-sm font-bold uppercase">Sem dados disponíveis</span>
          <span className="text-[11px] text-gray-500">
            Se isso for “Volume”, provavelmente é endpoint/arquivo vazio no VPS.
          </span>
        </div>
      );
    }

    if (viewMode === 'total') return <TotalBarChart data={data} metric={metric} asset={asset} />;
    if (viewMode === 'lines') return <EtfLinesChart data={data} metric={metric} asset={asset} selectedTicker={selectedTicker} />;

    return <StackedEtfChart data={data} metric={metric} asset={asset} />;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1a1c1e] text-gray-900 dark:text-white overflow-hidden p-6">
      {/* TOP BAR */}
      <div className="flex flex-col gap-3 mb-6 border-b border-gray-100 dark:border-slate-800 pb-4">
        <div className="flex justify-between items-center">
          {/* TOTAL NET FLOW (sempre) + CONTROLS */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-baseline gap-2">
              <div className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Net Flow</div>
              <div className={`text-xl font-black font-mono ${hasFlows ? flowColor : 'text-gray-400'}`}>
                {hasFlows ? '$' + formatCompactNumber(lastFlow) : '---'}
              </div>
            </div>

            <div className="w-px h-6 bg-gray-200 dark:bg-slate-700 hidden md:block"></div>

            {/* ASSET */}
            <div className="flex bg-gray-100 dark:bg-black/30 p-1 rounded-lg border border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setAsset('BTC')}
                className={`px-4 py-1.5 text-xs font-black rounded transition-all ${asset === 'BTC' ? 'bg-[#f7931a] text-white shadow' : 'text-gray-500 hover:text-white'}`}
              >
                BTC
              </button>
              <button
                onClick={() => setAsset('ETH')}
                className={`px-4 py-1.5 text-xs font-black rounded transition-all ${asset === 'ETH' ? 'bg-[#627eea] text-white shadow' : 'text-gray-500 hover:text-white'}`}
              >
                ETH
              </button>
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
                <BarChart3 size={14} /> Individuais
              </button>
            </div>
          </div>
        </div>

        {/* ETF BUTTONS (somente no modo lines) */}
        {viewMode === 'lines' && (
          <div className="flex gap-2 flex-wrap">
            {tickerButtons.length === 0 ? (
              <div className="text-xs text-gray-500">Nenhuma ETF encontrada no dataset.</div>
            ) : (
              tickerButtons.map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedTicker(t)}
                  className={`px-3 py-1 text-xs font-black rounded-lg border transition-all ${
                    selectedTicker === t
                      ? 'bg-[#dd9933] text-white border-transparent shadow'
                      : 'bg-gray-50 dark:bg-black/20 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-800 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* CONTENT GRID */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 relative bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-slate-800/50 p-4 overflow-hidden">
          <ChartArea />
          <HelpTooltip />
        </div>

        <div className="bg-white dark:bg-[#1a1c1e] border border-gray-100 dark:border-slate-800 rounded-xl flex flex-col overflow-hidden">
          <div className="p-3 bg-gray-50 dark:bg-black/30 border-b border-gray-100 dark:border-slate-800 font-black text-xs uppercase text-gray-500 tracking-widest flex items-center gap-2">
            <Layers size={14} /> Market Share (Dia)
          </div>
          {loading ? (
            <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
          ) : hasData ? (
            <EtfRankingTable data={data} metric={metric} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-gray-500">Tabela Vazia</div>
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
