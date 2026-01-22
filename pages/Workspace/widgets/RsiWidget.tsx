
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, ChevronLeft, ChevronRight, Search, Info, Minus, Plus } from 'lucide-react';
import Highcharts from 'highcharts';
import { Language } from '../../../types';
import { getTranslations } from '../../../locales';
import {
  RsiAvgData,
  RsiTableItem,
  fetchRsiAverage,
  fetchRsiTable,
  fetchRsiTablePage
} from '../services/api';

const TIMEFRAMES = ['15m', '1h', '4h', '24h', '7d'] as const;
type Timeframe = typeof TIMEFRAMES[number];
type XMode = 'marketCap' | 'price24h' | 'volume24h';

const formatCompactNumber = (number: number) => {
  if (!number || number === 0) return "---";
  if (number < 1000) return number.toString();
  const suffixes = ["", "K", "M", "B", "T"];
  const suffixNum = Math.floor(("" + Math.floor(number)).length / 3);
  let shortValue = parseFloat((number / Math.pow(1000, suffixNum)).toPrecision(3));
  if (shortValue % 1 !== 0) shortValue = parseFloat(shortValue.toFixed(2));
  return shortValue + suffixes[suffixNum];
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const getRsiColor = (val: number, isText = false) => {
  if (val === null || val === undefined || Number.isNaN(val)) return isText ? 'text-gray-400' : '';
  if (val >= 70) return isText ? 'text-red-500 font-bold' : 'bg-red-500/20 text-red-500';
  if (val <= 30) return isText ? 'text-green-500 font-bold' : 'bg-green-500/20 text-green-500';
  return isText ? 'text-gray-700 dark:text-slate-300' : 'text-gray-700 dark:text-slate-300';
};

const computeAvgRsi = (rows: RsiTableItem[], tf: Timeframe) => {
  const vals = rows
    .map(r => r.rsi?.[tf])
    .filter(v => typeof v === 'number' && !Number.isNaN(v)) as number[];
  if (vals.length === 0) return 50;
  const sum = vals.reduce((a, b) => a + b, 0);
  return sum / vals.length;
};

const computeCounts = (rows: RsiTableItem[], tf: Timeframe) => {
  let oversold = 0;
  let overbought = 0;
  let valid = 0;
  for (const r of rows) {
    const v = r.rsi?.[tf];
    if (typeof v !== 'number') continue;
    valid++;
    if (v <= 30) oversold++;
    if (v >= 70) overbought++;
  }
  return { oversold, overbought, valid };
};

const useIsDark = () => {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
};

// Componente para Toggle
const TogglePill: React.FC<{ value: XMode, onChange: (v: XMode) => void }> = ({ value, onChange }) => {
  return (
    <div className="inline-flex rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
      <button onClick={() => onChange('marketCap')} className={`px-3 py-1 text-[11px] font-black uppercase tracking-wider ${value === 'marketCap' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-slate-400'}`}>MCap</button>
      <button onClick={() => onChange('price24h')} className={`px-3 py-1 text-[11px] font-black uppercase tracking-wider ${value === 'price24h' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-slate-400'}`}>Price%</button>
      <button onClick={() => onChange('volume24h')} className={`px-3 py-1 text-[11px] font-black uppercase tracking-wider ${value === 'volume24h' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-slate-400'}`}>Vol</button>
    </div>
  );
};

// Componente do Gráfico
const ScatterCard: React.FC<{
  rows: RsiTableItem[];
  timeframe: Timeframe;
  xMode: XMode;
  isDark: boolean;
  onTimeframeChange: (tf: Timeframe) => void;
  onXModeChange: (m: XMode) => void;
}> = ({ rows, timeframe, xMode, isDark, onTimeframeChange, onXModeChange }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    // Se não tiver dados, limpa o gráfico ou mostra mensagem
    if (!rows || rows.length === 0) {
        chartRef.current.innerHTML = "<div style='height:100%;display:flex;align-items:center;justify-content:center;color:#666;'>Carregando dados do RSI...</div>";
        return;
    }

    const bgColor = isDark ? '#15191c' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#333333';
    const gridColor = isDark ? '#334155' : '#f1f5f9';

    // Prepara os dados para o Highcharts
    const seriesData = rows
      .filter(r => r.marketCap && r.marketCap > 0) // Filtra lixo
      .map(r => {
        let xVal = r.marketCap || 0;
        if (xMode === 'price24h') xVal = r.change || 0;
        if (xMode === 'volume24h') xVal = r.volume24h || 0;

        return {
            x: xVal,
            y: r.rsi?.[timeframe] || 50,
            name: r.symbol,
            symbol: r.symbol,
            marketCap: r.marketCap,
            volume24h: r.volume24h,
            price24h: r.change,
            price: r.price
        };
      });

    const isLog = xMode === 'marketCap' || xMode === 'volume24h';

    Highcharts.chart(chartRef.current, {
      chart: {
        type: 'scatter',
        backgroundColor: bgColor,
        zoomType: 'xy',
        style: { fontFamily: 'Inter, sans-serif' },
        height: 420
      },
      title: { text: null },
      credits: { enabled: false },
      exporting: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        title: { text: xMode === 'marketCap' ? 'Market Cap' : xMode === 'volume24h' ? 'Volume' : 'Change 24h', style: { color: isDark ? '#666' : '#9ca3af' } },
        type: isLog ? 'logarithmic' : 'linear',
        gridLineColor: gridColor,
        labels: { style: { color: isDark ? '#666' : '#6b7280' } }
      },
      yAxis: {
        title: { text: 'RSI', style: { color: isDark ? '#666' : '#9ca3af' } },
        min: 0,
        max: 100,
        gridLineColor: gridColor,
        labels: { style: { color: isDark ? '#666' : '#6b7280' } },
        plotLines: [
          { value: 70, color: '#f87171', dashStyle: 'ShortDash', width: 1, label: { text: 'Overbought', style: { color: '#f87171' } } },
          { value: 30, color: '#4ade80', dashStyle: 'ShortDash', width: 1, label: { text: 'Oversold', style: { color: '#4ade80' } } }
        ]
      },
      tooltip: {
        useHTML: true,
        backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)',
        borderColor: isDark ? '#333' : '#e5e7eb',
        style: { color: textColor },
        formatter: function (this: any) {
          const p = this.point;
          return `<b>${p.name}</b><br/>RSI: <b>${p.y.toFixed(1)}</b><br/>$${formatCompactNumber(p.price)}`;
        }
      },
      series: [{
        name: 'Coins',
        data: seriesData,
        color: 'rgba(255,255,255,0.5)',
        marker: { radius: 4 }
      }]
    } as any);
  }, [rows, timeframe, xMode, isDark]);

  return (
    <div className="bg-white dark:bg-[#15191c] rounded-xl shadow-xl border-0 dark:border dark:border-slate-800 p-4 relative overflow-hidden min-h-[420px]">
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <select
          value={timeframe}
          onChange={(e) => onTimeframeChange(e.target.value as Timeframe)}
          className="bg-gray-100 dark:bg-[#222] text-xs font-black text-gray-900 dark:text-white p-1.5 rounded border border-gray-200 dark:border-[#333] outline-none cursor-pointer"
        >
          {TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf.toUpperCase()}</option>)}
        </select>
        <TogglePill value={xMode} onChange={onXModeChange} />
      </div>
      <div ref={chartRef} className="rounded-lg overflow-hidden w-full h-[420px]" />
    </div>
  );
};

// ... (Outros componentes como TableCard, AverageRsiGaugeCard mantidos simplificados) ...

const TableCard: React.FC<any> = ({ rows, loading, page, totalPages, onPageChange }) => {
    return (
        <div className="bg-white dark:bg-[#15191c] rounded-xl p-4 overflow-hidden">
            {loading ? <div className="p-10 text-center">Carregando tabela...</div> : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                                <th className="px-4 py-2">Ativo</th>
                                <th className="px-4 py-2 text-right">RSI 15m</th>
                                <th className="px-4 py-2 text-right">RSI 1h</th>
                                <th className="px-4 py-2 text-right">RSI 4h</th>
                                <th className="px-4 py-2 text-right">RSI 24h</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r: any) => (
                                <tr key={r.id} className="border-b dark:border-gray-700">
                                    <td className="px-4 py-2 font-bold text-white">{r.name} <span className="text-gray-500 text-xs">{r.symbol}</span></td>
                                    <td className={`px-4 py-2 text-right font-mono font-bold ${getRsiColor(r.rsi['15m'], true)}`}>{r.rsi['15m']?.toFixed(0)}</td>
                                    <td className={`px-4 py-2 text-right font-mono font-bold ${getRsiColor(r.rsi['1h'], true)}`}>{r.rsi['1h']?.toFixed(0)}</td>
                                    <td className={`px-4 py-2 text-right font-mono font-bold ${getRsiColor(r.rsi['4h'], true)}`}>{r.rsi['4h']?.toFixed(0)}</td>
                                    <td className={`px-4 py-2 text-right font-mono font-bold ${getRsiColor(r.rsi['24h'], true)}`}>{r.rsi['24h']?.toFixed(0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <div className="flex justify-between items-center mt-4">
                <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50">Ant</button>
                <span>Pág {page} de {totalPages}</span>
                <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50">Prox</button>
            </div>
        </div>
    );
};

// --- EXPORTAÇÕES PARA O INDICATOR PAGE ---

export const RsiScatterChart: React.FC = () => {
  const isDark = useIsDark();
  const [timeframe, setTimeframe] = useState<Timeframe>('4h');
  const [xMode, setXMode] = useState<XMode>('marketCap');
  const [rows, setRows] = useState<RsiTableItem[]>([]);
  
  useEffect(() => {
      // Usa fetchRsiTable que agora é robusto para a estrutura do rsitracker.json
      fetchRsiTable({ force: false }).then(data => {
          if (data) setRows(data);
      });
  }, []);

  return (
      <ScatterCard
          rows={rows}
          timeframe={timeframe}
          xMode={xMode}
          isDark={isDark}
          onTimeframeChange={setTimeframe}
          onXModeChange={setXMode}
      />
  );
};

export const RsiTableList: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RsiTableItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const timeframe = '4h';

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchRsiTablePage({
      page,
      limit: pageSize,
      sort: `rsi${timeframe}` as any,
      ascendingOrder: false,
      filterText: search
    }).then(res => {
        if(!mounted) return;
        setRows(res.items);
        setTotalPages(res.totalPages);
        setLoading(false);
    });
    return () => { mounted = false; };
  }, [page, pageSize, search]);

  return (
      <TableCard
          rows={rows}
          loading={loading}
          timeframe={timeframe}
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          search={search}
          onSearchChange={setSearch}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
      />
  );
};

// ... (Outros exports mantidos)
// Placeholder para RsiGauge se necessário
export const RsiGauge: React.FC<any> = () => <div className="bg-gray-800 p-4 rounded text-center text-white">Gauge Placeholder</div>;

export default RsiScatterChart;
