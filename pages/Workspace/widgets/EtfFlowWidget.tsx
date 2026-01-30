import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, ArrowUp, ArrowDown, TrendingUp, BarChart3, Layers, AlertTriangle } from 'lucide-react';
import { fetchEtfFlow, fetchEtfDetailed, EtfFlowData } from '../services/api';
import { DashboardItem, Language } from '../../../types';
import { getTranslations } from '../../../locales';
import Highcharts from 'highcharts';

const formatCompactNumber = (number: number) => {
  if (number === null || number === undefined) return "---";
  if (Number.isNaN(number)) return "---";
  if (number === 0) return "0";
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

// Normaliza qualquer shape “provável” vindo do backend/cache
// para o shape que o gráfico/tabela já esperam.
const normalizeDailySeries = (input: any): any[] => {
  let arr: any[] = [];

  // Se vier { daily: [...] }
  if (input && Array.isArray(input.daily)) arr = input.daily;
  // Se vier array direto
  else if (Array.isArray(input)) arr = input;
  // Se vier { data: [...] } (alguns endpoints fazem isso)
  else if (input && Array.isArray(input.data)) arr = input.data;
  else arr = [];

  const out = arr
    .filter(Boolean)
    .map((d: any) => {
      // timestamp pode vir em segundos; Highcharts datetime espera milissegundos
      const tsRaw =
        d.timestamp ??
        d.Timestamp ??
        d.date ??
        d.Date ??
        d.time ??
        null;

      const tsNum = typeof tsRaw === 'string' ? Number(tsRaw) : tsRaw;
      const tsSeconds = (typeof tsNum === 'number' && tsNum > 1e12) ? Math.floor(tsNum / 1000) : tsNum; // se já vier em ms, converte p/ sec
      const dateMs =
        typeof tsNum === 'number'
          ? (tsNum > 1e12 ? tsNum : tsNum * 1000)
          : null;

      const perEtf =
        d.perEtf ??
        d.etfs ??
        d.ETFs ??
        null;

      // Se já estiver “flattened”, usa como está
      // Se estiver nested em perEtf, espalha pro nível raiz
      const flattened = {
        ...d,
        ...(perEtf && typeof perEtf === 'object' ? perEtf : {}),
        // padroniza campos que o seu gráfico usa:
        timestamp: typeof tsSeconds === 'number' ? tsSeconds : d.timestamp,
        date: typeof dateMs === 'number' ? dateMs : d.date, // usado no chart
        totalGlobal: (d.totalGlobal ?? d.total ?? d.netFlow ?? 0)
      };

      return flattened;
    })
    .filter((d: any) => typeof d.date === 'number') // sem data, sem gráfico
    .sort((a: any, b: any) => a.date - b.date);

  return out;
};

interface StackedChartProps {
  data: any[];
  metric: 'flows' | 'volume';
  asset: 'BTC' | 'ETH';
}

const StackedBarChart: React.FC<StackedChartProps> = ({ data, metric, asset }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<Highcharts.Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!data || data.length === 0) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
      return;
    }

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    // Extract series keys (Tickers) excluding date/totalGlobal/timestamp/perEtf
    const keys = new Set<string>();
    data.forEach(d => {
      Object.keys(d).forEach(k => {
        if (k !== 'date' && k !== 'totalGlobal' && k !== 'timestamp' && k !== 'perEtf' && k !== 'etfs') {
          // garante que é número ou pode ser coerçado
          const v = d[k];
          if (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)))) {
            keys.add(k);
          }
        }
      });
    });

    const seriesKeys = Array.from(keys);

    // Se não há tickers, ainda podemos plotar a linha do totalGlobal
    const series: any[] = [];

    seriesKeys.forEach((key, idx) => {
      series.push({
        name: key,
        data: data.map(d => [d.date, Number(d[key] || 0)]),
        color: PALETTE[idx % PALETTE.length],
        type: 'column',
        stack: 'etf'
      });
    });

    series.push({
      name: metric === 'flows' ? 'Net Flow' : 'Total Volume',
      type: 'spline',
      data: data.map(d => [d.date, Number(d.totalGlobal || 0)]),
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
  }, [data, metric, asset]);

  return <div ref={chartRef} className="w-full h-full min-h-[300px]" />;
};

const EtfRankingTable: React.FC<{ data: any[], metric: 'flows' | 'volume' }> = ({ data, metric }) => {
  const lastDay = data[data.length - 1];
  if (!lastDay) return null;

  const keys = Object.keys(lastDay).filter(k => k !== 'date' && k !== 'totalGlobal' && k !== 'timestamp' && k !== 'perEtf' && k !== 'etfs');
  const total = Number(lastDay.totalGlobal ?? 0);

  // Se total for 0, evita divisão por zero e mantém table útil
  const safeTotal = total === 0 ? 1 : Math.abs(total);

  // Fallback se não houver tickers (ex: ETH volume agregado)
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

  const ranking = keys.map(k => ({
    ticker: k,
    value: Number(lastDay[k] || 0)
  })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

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
            const share = (Math.abs(item.value) / safeTotal) * 100;
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
  const [rawData, setRawData] = useState<any>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchEtfDetailed(asset, metric).then(res => {
      setRawData(res);
      setLoading(false);
    }).catch(() => {
      setRawData([]);
      setLoading(false);
    });
  }, [asset, metric]);

  const data = useMemo(() => normalizeDailySeries(rawData), [rawData]);
  const hasData = data && data.length > 0;

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
            <button onClick={() => setMetric('flows')} className={`px-4 py-1.5 text-xs font-black rounded flex items-center gap-2 transition-all ${metric === 'flows' ? 'bg-white dark:bg-[#2f3032] text-[#dd9933] shadow' : 'text-gray-500 hover:text-white'}`}><TrendingUp size={14} /> Flows</button>
            <button onClick={() => setMetric('volume')} className={`px-4 py-1.5 text-xs font-black rounded flex items-center gap-2 transition-all ${metric === 'volume' ? 'bg-white dark:bg-[#2f3032] text-blue-400 shadow' : 'text-gray-500 hover:text-white'}`}><BarChart3 size={14} /> Volume</button>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest">Total {metric === 'flows' ? 'Net Flow' : 'Volume'} (Último dia)</div>
          <div className={`text-2xl font-black font-mono ${hasData && (data[data.length - 1].totalGlobal >= 0 || metric === 'volume') ? 'text-gray-900 dark:text-white' : 'text-red-500'}`}>
            {hasData ? '$' + formatCompactNumber(Number(data[data.length - 1].totalGlobal || 0)) : '---'}
          </div>
        </div>
      </div>

      {/* CONTENT GRID */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 relative bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-slate-800/50 p-4">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
          ) : hasData ? (
            <StackedBarChart data={data} metric={metric} asset={asset} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
              <AlertTriangle size={32} />
              <span className="text-sm font-bold uppercase">Sem dados disponíveis</span>
            </div>
          )}
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
    fetchEtfFlow().then(res => { if (res) setEtfData(res); }).catch(() => {});
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
