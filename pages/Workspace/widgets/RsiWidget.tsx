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

const TogglePill: React.FC<{ value: XMode, onChange: (v: XMode) => void }> = ({ value, onChange }) => {
  return (
    <div className="inline-flex rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
      <button
        onClick={() => onChange('marketCap')}
        className={`px-3 py-1 text-[11px] font-black uppercase tracking-wider ${value === 'marketCap'
          ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white'
          : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
          }`}
      >
        MarketCap
      </button>
      <button
        onClick={() => onChange('price24h')}
        className={`px-3 py-1 text-[11px] font-black uppercase tracking-wider ${value === 'price24h'
          ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white'
          : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
          }`}
      >
        Price 24h%
      </button>
      <button
        onClick={() => onChange('volume24h')}
        className={`px-3 py-1 text-[11px] font-black uppercase tracking-wider ${value === 'volume24h'
          ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white'
          : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
          }`}
      >
        Volume 24h
      </button>
    </div>
  );
};

const AverageRsiGaugeCard: React.FC<{
  avgRsi: number;
  label: string;
  isDark: boolean;
  timeframe: Timeframe;
  onInfoClick?: () => void;
}> = ({ avgRsi, label, isDark, timeframe, onInfoClick }) => {
  const GAUGE_CX = 100;
  const GAUGE_CY = 75;
  const GAUGE_R = 65;
  const GAUGE_RY = 65;
  const GAUGE_STROKE = 10;

  const rsiVal = clamp(avgRsi, 0, 100);
  const rotation = -90 + (rsiVal / 100) * 180;

  const pillClass =
    rsiVal > 70 ? 'bg-red-500/15 text-red-400' :
      rsiVal < 30 ? 'bg-green-500/15 text-green-400' :
        'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-slate-200';

  return (
    <div className="bg-white dark:bg-[#15191c] rounded-xl shadow-xl border-0 dark:border dark:border-slate-800 p-4 relative overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
            Average RSI
          </div>
          <button
            type="button"
            onClick={onInfoClick}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
            aria-label="info"
          >
            <Info size={16} />
          </button>
        </div>

        <div className={`text-[10px] font-black px-2 py-1 rounded-full ${pillClass}`}>
          {label} ({timeframe.toUpperCase()})
        </div>
      </div>

      <div className="flex items-center justify-center">
        <svg viewBox="0 0 200 145" className="w-full max-w-[320px] overflow-visible">
          <defs>
            <linearGradient id="rsiGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#548f3f" />
              <stop offset="50%" stopColor="#FFD700" />
              <stop offset="100%" stopColor="#CD534B" />
            </linearGradient>
          </defs>

          <path
            d={`M ${GAUGE_CX - GAUGE_R} ${GAUGE_CY} A ${GAUGE_R} ${GAUGE_RY} 0 0 1 ${GAUGE_CX + GAUGE_R} ${GAUGE_CY}`}
            fill="none"
            stroke={isDark ? '#0b0f14' : '#e5e7eb'}
            strokeWidth={GAUGE_STROKE}
            strokeLinecap="round"
          />
          <path
            d={`M ${GAUGE_CX - GAUGE_R} ${GAUGE_CY} A ${GAUGE_R} ${GAUGE_RY} 0 0 1 ${GAUGE_CX + GAUGE_R} ${GAUGE_CY}`}
            fill="none"
            stroke="url(#rsiGradient)"
            strokeWidth={GAUGE_STROKE}
            strokeLinecap="round"
          />

          <g transform={`rotate(${rotation} ${GAUGE_CX} ${GAUGE_CY})`}>
            <path
              d={`M ${GAUGE_CX} ${GAUGE_CY} L ${GAUGE_CX} ${GAUGE_CY - GAUGE_RY + 2}`}
              stroke={isDark ? '#e5e7eb' : '#111827'}
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx={GAUGE_CX} cy={GAUGE_CY} r="5" fill={isDark ? '#e5e7eb' : '#111827'} />
          </g>

          <text
            x={GAUGE_CX}
            y={112}
            textAnchor="middle"
            fill="#dd9933"
            fontSize="28"
            fontWeight="900"
            fontFamily="monospace"
          >
            {rsiVal.toFixed(2)}
          </text>

          <text
            x={GAUGE_CX}
            y={130}
            textAnchor="middle"
            fill={isDark ? '#e5e7eb' : '#111827'}
            fontSize="12"
            fontWeight="900"
            letterSpacing="1"
            style={{ textTransform: 'uppercase' }}
          >
            {label}
          </text>
        </svg>
      </div>
    </div>
  );
};

const OvsObBarCard: React.FC<{ oversold: number; overbought: number; total: number }> = ({ oversold, overbought, total }) => {
  const o = total > 0 ? (oversold / total) * 100 : 0;
  const b = total > 0 ? (overbought / total) * 100 : 0;

  return (
    <div className="bg-white dark:bg-[#15191c] rounded-xl shadow-xl border-0 dark:border dark:border-slate-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
          Oversold vs Overbought
        </div>
        <div className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest">
          by count
        </div>
      </div>

      <div className="flex items-center justify-between text-sm mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-gray-700 dark:text-slate-200 font-black">Oversold</span>
        </div>
        <div className="font-mono font-black text-gray-900 dark:text-white">{o.toFixed(2)}%</div>
      </div>

      <div className="flex items-center justify-between text-sm mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-gray-700 dark:text-slate-200 font-black">Overbought</span>
        </div>
        <div className="font-mono font-black text-gray-900 dark:text-white">{b.toFixed(2)}%</div>
      </div>

      <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
        <div className="h-full bg-green-400" style={{ width: `${o}%` }} />
      </div>
      <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden mt-2">
        <div className="h-full bg-red-400" style={{ width: `${b}%` }} />
      </div>

      <div className="mt-3 text-[11px] text-gray-500 dark:text-slate-400 font-mono">
        Oversold: {oversold} | Overbought: {overbought} | Total: {total}
      </div>
    </div>
  );
};

const HistoricalCard: React.FC<{ data: RsiAvgData | null }> = ({ data }) => {
  const renderVal = (v: any) => (typeof v === 'number' ? v.toFixed(0) : '—');

  return (
    <div className="bg-white dark:bg-[#15191c] rounded-xl shadow-xl border-0 dark:border dark:border-slate-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
          Historical RSI
        </div>
        <div className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest">
          market average
        </div>
      </div>

      <div className="space-y-2">
        <Row label="Yesterday" value={renderVal(data?.yesterday)} />
        <Row label="7 days ago" value={renderVal(data?.days7Ago)} />
        <Row label="30 days ago" value={renderVal(data?.days30Ago)} />
        <Row label="90 days ago" value={renderVal((data as any)?.days90Ago)} />
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  return (
    <div className="flex items-center justify-between bg-gray-50 dark:bg-white/5 rounded-lg px-3 py-2">
      <div className="text-[11px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest">
        {label}
      </div>
      <div className="text-sm font-mono font-black text-gray-900 dark:text-white">
        {value}
      </div>
    </div>
  );
};

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
    if (!rows || rows.length === 0) return;

    const bgColor = isDark ? '#15191c' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#333333';
    const gridColor = isDark ? '#334155' : '#f1f5f9';
    const lineColor = isDark ? '#444' : '#e2e8f0';

    const isLog = xMode === 'marketCap' || xMode === 'volume24h';

    const safeRows = rows
      .filter(r => {
        const x =
          xMode === 'marketCap' ? r.marketCap :
            xMode === 'volume24h' ? r.volume24h :
              (r.change ?? 0);
        if (xMode === 'price24h') return typeof x === 'number';
        return typeof x === 'number' && x > 1000;
      })
      .slice(0, 300);

    const seriesData = safeRows.map(r => {
      const y = (r.rsi?.[timeframe] ?? 50);
      const x =
        xMode === 'marketCap' ? r.marketCap :
          xMode === 'volume24h' ? r.volume24h :
            (r.change ?? 0);

      return {
        x: x as number,
        y: y as number,
        name: r.symbol || r.name || '—',
        symbol: r.symbol,
        marketCap: r.marketCap,
        volume24h: r.volume24h,
        price24h: r.change,
        price: r.price
      };
    });

    const xTitle =
      xMode === 'marketCap' ? 'Market Cap (Log USD)' :
        xMode === 'volume24h' ? 'Volume 24h (Log USD)' :
          'Price Change 24h (%)';

    Highcharts.chart(chartRef.current, {
      chart: {
        type: 'scatter',
        backgroundColor: bgColor,
        zoomType: 'xy',
        style: { fontFamily: 'Inter, sans-serif' },
      },
      title: {
        text: 'Crypto RSI Scatter',
        align: 'left',
        style: { color: textColor, fontWeight: 'bold' }
      },
      credits: { enabled: false },
      exporting: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        title: { text: xTitle, style: { color: isDark ? '#666' : '#9ca3af' } },
        type: isLog ? 'logarithmic' : 'linear',
        gridLineColor: gridColor,
        labels: {
          style: { color: isDark ? '#666' : '#6b7280' },
          formatter: function (this: any) {
            if (xMode === 'price24h') return `${this.value}%`;
            return `$${formatCompactNumber(this.value)}`;
          }
        },
        lineColor: lineColor,
        tickColor: lineColor,
        plotLines: xMode === 'price24h'
          ? [{ value: 0, color: lineColor, width: 1 }]
          : undefined
      },
      yAxis: {
        title: { text: 'Relative Strength Index', style: { color: isDark ? '#666' : '#9ca3af' } },
        min: 0,
        max: 100,
        gridLineColor: gridColor,
        labels: { style: { color: isDark ? '#666' : '#6b7280' } },
        plotLines: [
          { value: 70, color: '#f87171', dashStyle: 'ShortDash', width: 1, label: { text: 'Overbought', style: { color: '#f87171' }, align: 'right' } },
          { value: 30, color: '#4ade80', dashStyle: 'ShortDash', width: 1, label: { text: 'Oversold', style: { color: '#4ade80' }, align: 'right' } },
          { value: 50, color: lineColor, width: 1 }
        ],
        plotBands: [
          { from: 70, to: 100, color: 'rgba(248, 113, 113, 0.08)' },
          { from: 0, to: 30, color: 'rgba(74, 222, 128, 0.08)' }
        ]
      },
      tooltip: {
        useHTML: true,
        backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)',
        borderColor: isDark ? '#333' : '#e5e7eb',
        style: { color: textColor },
        shadow: true,
        formatter: function (this: any) {
          const p = this.point;
          const xLabel =
            xMode === 'marketCap' ? `Mkt Cap: $${formatCompactNumber(p.marketCap)}` :
              xMode === 'volume24h' ? `Vol 24h: $${formatCompactNumber(p.volume24h)}` :
                `Price 24h: ${(p.price24h ?? 0).toFixed(2)}%`;
          return `
            <div style="min-width:170px">
              <div style="font-weight:900">${p.symbol || p.name}</div>
              <div>RSI (${timeframe.toUpperCase()}): <b>${(p.y ?? 0).toFixed(2)}</b></div>
              <div>${xLabel}</div>
            </div>
          `;
        }
      },
      plotOptions: {
        scatter: {
          marker: {
            radius: 5,
            symbol: 'circle',
            states: { hover: { enabled: true, lineColor: 'rgb(100,100,100)' } }
          },
          tooltip: { headerFormat: '' }
        }
      },
      series: [{
        name: 'Coins',
        data: seriesData,
        color: 'rgba(255,255,255,0.5)',
        zones: [
          { value: 30, color: '#4ade80' },
          { value: 70, color: isDark ? '#94a3b8' : '#64748b' },
          { color: '#f87171' }
        ]
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

const TableCard: React.FC<{
  rows: RsiTableItem[];
  loading: boolean;
  timeframe: Timeframe;
  page: number;
  totalPages: number;
  pageSize: number;
  search: string;
  onSearchChange: (v: string) => void;
  onPageChange: (p: number) => void;
  onPageSizeChange: (n: number) => void;
}> = ({
  rows,
  loading,
  timeframe,
  page,
  totalPages,
  pageSize,
  search,
  onSearchChange,
  onPageChange,
  onPageSizeChange
}) => {
    const filtered = useMemo(() => {
      if (!search) return rows;
      const q = search.toLowerCase().trim();
      return rows.filter(i =>
        (i.symbol || '').toLowerCase().includes(q) ||
        (i.name || '').toLowerCase().includes(q)
      );
    }, [rows, search]);

    return (
      <div className="bg-white dark:bg-[#15191c] rounded-xl shadow-xl border-0 dark:border dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white">Cryptocurrency RSI</h3>
            <div className="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">
              Table (timeframe highlight: {timeframe.toUpperCase()})
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search coin..."
                className="pl-8 pr-3 py-2 text-sm rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white outline-none w-[220px]"
              />
            </div>

            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
              className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm rounded-lg px-2 py-2 text-gray-900 dark:text-white font-black outline-none"
            >
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-[1.6fr_0.9fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_0.9fr_0.9fr] gap-2 px-6 py-3 bg-gray-50 dark:bg-[#111315] text-[10px] font-black text-gray-500 uppercase tracking-widest sticky top-0 z-10 border-b border-gray-100 dark:border-white/5">
          <span>Asset</span>
          <span className="text-right">Price</span>
          <span className="text-center">15m</span>
          <span className="text-center">1h</span>
          <span className="text-center">4h</span>
          <span className="text-center">24h</span>
          <span className="text-center">7d</span>
          <span className="text-right">MCap</span>
          <span className="text-right">Vol 24h</span>
        </div>

        <div className="max-h-[640px] overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="h-60 flex items-center justify-center">
              <Loader2 className="animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-gray-500 text-xs font-bold uppercase">
              Sem dados
            </div>
          ) : (
            filtered.slice(0, pageSize).map((item, i) => (
              <div
                key={(item.id || '') + i}
                className="grid grid-cols-[1.6fr_0.9fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_0.9fr_0.9fr] gap-2 px-6 py-3 border-b border-gray-50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors items-center text-sm group"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="text-xs text-gray-500 font-mono w-10 shrink-0">{item.rank || ''}</span>
                  {item.logo && (
                    <img
                      src={item.logo}
                      className="w-6 h-6 rounded-full grayscale group-hover:grayscale-0 transition-all shrink-0"
                      onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                    />
                  )}
                  <span className="font-bold text-gray-700 dark:text-gray-300 group-hover:text-black dark:group-hover:text-white transition-colors truncate">
                    {item.name}
                    <span className="text-xs text-gray-500 ml-1">{item.symbol}</span>
                  </span>
                </div>

                <div className="text-right font-mono text-gray-700 dark:text-gray-300 font-bold">
                  ${item.price < 1 ? item.price.toFixed(5) : item.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  <span className={`ml-2 text-xs font-black ${((item.change ?? 0) >= 0) ? 'text-green-500' : 'text-red-500'}`}>
                    {(item.change ?? 0) >= 0 ? '+' : ''}{(item.change ?? 0).toFixed(2)}%
                  </span>
                </div>

                <div className={`text-center font-bold font-mono ${getRsiColor(item.rsi?.["15m"] as any, true)}`}>{(item.rsi?.["15m"] ?? 0).toFixed(0)}</div>
                <div className={`text-center font-bold font-mono ${getRsiColor(item.rsi?.["1h"] as any, true)}`}>{(item.rsi?.["1h"] ?? 0).toFixed(0)}</div>
                <div className={`text-center font-bold font-mono ${getRsiColor(item.rsi?.["4h"] as any, true)}`}>{(item.rsi?.["4h"] ?? 0).toFixed(0)}</div>
                <div className={`text-center font-bold font-mono ${getRsiColor(item.rsi?.["24h"] as any, true)}`}>{(item.rsi?.["24h"] ?? 0).toFixed(0)}</div>
                <div className={`text-center font-bold font-mono ${getRsiColor(item.rsi?.["7d"] as any, true)}`}>{(item.rsi?.["7d"] ?? 0).toFixed(0)}</div>

                <div className="text-right font-mono font-black text-gray-700 dark:text-gray-300">
                  ${formatCompactNumber(item.marketCap)}
                </div>
                <div className="text-right font-mono font-black text-gray-700 dark:text-gray-300">
                  ${formatCompactNumber(item.volume24h)}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-widest">
            Page {page} / {totalPages || 1}
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange(Math.max(1, page - 1))}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white font-black disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white font-black disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  };

const FaqItem: React.FC<{ q: string; a: React.ReactNode }> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-[#15191c]">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-5 py-4 flex items-center justify-between text-left"
      >
        <div className="font-black text-gray-900 dark:text-white">{q}</div>
        <div className="text-gray-400">
          {open ? <Minus size={18} /> : <Plus size={18} />}
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
          {a}
        </div>
      )}
    </div>
  );
};

const RsiTrackerPage: React.FC<{ language?: Language }> = ({ language = 'pt' }) => {
  const isDark = useIsDark();
  const t = getTranslations(language as Language);

  const [timeframe, setTimeframe] = useState<Timeframe>('4h');
  const [xMode, setXMode] = useState<XMode>('marketCap');

  const [avgData, setAvgData] = useState<RsiAvgData | null>(null);
  const [avgLoading, setAvgLoading] = useState(true);

  const [tableLoading, setTableLoading] = useState(true);
  const [rows, setRows] = useState<RsiTableItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setAvgLoading(true);
    fetchRsiAverage()
      .then(d => setAvgData(d || null))
      .finally(() => setAvgLoading(false));
  }, []);

  useEffect(() => {
    let mounted = true;
    setTableLoading(true);

    fetchRsiTablePage({
      page,
      limit: pageSize,
      sort: `rsi${timeframe}` as any,
      ascendingOrder: false,
      filterText: search
    })
      .then(res => {
        if (!mounted) return;
        setRows(res.items || []);
        setTotalPages(res.totalPages || 1);
      })
      .catch(() => {
        if (!mounted) return;
        setRows([]);
        setTotalPages(1);
      })
      .finally(() => {
        if (!mounted) return;
        setTableLoading(false);
      });

    return () => { mounted = false; };
  }, [page, pageSize, timeframe, search]);

  const avgRsi = useMemo(() => computeAvgRsi(rows, timeframe), [rows, timeframe]);

  const label = useMemo(() => {
    if (avgRsi <= 30) return (t as any)?.dashboard?.widgets?.rsi?.oversold || 'Oversold';
    if (avgRsi >= 70) return (t as any)?.dashboard?.widgets?.rsi?.overbought || 'Overbought';
    return (t as any)?.dashboard?.widgets?.rsi?.neutral || 'Neutral';
  }, [avgRsi, t]);

  const counts = useMemo(() => computeCounts(rows, timeframe), [rows, timeframe]);

  const onTimeframeChange = (tf: Timeframe) => {
    setTimeframe(tf);
    setPage(1);
  };

  const onPageSizeChange = (n: number) => {
    setPageSize(n);
    setPage(1);
  };

  return (
    <div className="w-full h-full p-4 bg-white dark:bg-[#0f1113]">
      <div className="mb-4">
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Crypto Market RSI Dashboard</h1>
        <div className="text-sm text-gray-600 dark:text-slate-300 mt-1">
          Use RSI across multiple timeframes to read momentum extremes and context.
        </div>
      </div>

      {/* TOP GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-4">
        {/* LEFT STACK */}
        <div className="flex flex-col gap-4">
          {tableLoading ? (
            <div className="bg-white dark:bg-[#15191c] rounded-xl shadow-xl border-0 dark:border dark:border-slate-800 p-8 flex items-center justify-center">
              <Loader2 className="animate-spin text-gray-400" />
            </div>
          ) : (
            <AverageRsiGaugeCard
              avgRsi={avgRsi}
              label={label}
              isDark={isDark}
              timeframe={timeframe}
            />
          )}

          {tableLoading ? (
            <div className="bg-white dark:bg-[#15191c] rounded-xl shadow-xl border-0 dark:border dark:border-slate-800 p-8 flex items-center justify-center">
              <Loader2 className="animate-spin text-gray-400" />
            </div>
          ) : (
            <OvsObBarCard oversold={counts.oversold} overbought={counts.overbought} total={counts.valid} />
          )}

          {avgLoading ? (
            <div className="bg-white dark:bg-[#15191c] rounded-xl shadow-xl border-0 dark:border dark:border-slate-800 p-8 flex items-center justify-center">
              <Loader2 className="animate-spin text-gray-400" />
            </div>
          ) : (
            <HistoricalCard data={avgData} />
          )}
        </div>

        {/* RIGHT SCATTER .*/}
        <ScatterCard
          rows={rows}
          timeframe={timeframe}
          xMode={xMode}
          isDark={isDark}
          onTimeframeChange={onTimeframeChange}
          onXModeChange={setXMode}
        />
      </div>

      {/* TABLE */}
      <div className="mt-6">
        <TableCard
          rows={rows}
          loading={tableLoading}
          timeframe={timeframe}
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          search={search}
          onSearchChange={setSearch}
          onPageChange={setPage}
          onPageSizeChange={onPageSizeChange}
        />
      </div>

      {/* FAQ */}
      <div className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-xl font-black text-gray-900 dark:text-white">FAQ: RSI</h2>
          <Info size={18} className="text-gray-400" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <FaqItem
            q="O que é RSI?"
            a={<span>RSI (Relative Strength Index) é um oscilador que mede a força do movimento recente do preço numa escala de 0 a 100.</span>}
          />
          <FaqItem
            q="Para que serve?"
            a={<span>Ajuda a identificar momentos de “estresse” do preço (extremos), comparando força de altas vs baixas recentes.</span>}
          />
          <FaqItem
            q="Como usar os níveis 70/30?"
            a={<span>Acima de 70 costuma indicar região de sobrecompra; abaixo de 30, sobrevenda. Isso não é gatilho automático: serve como contexto.</span>}
          />
          <FaqItem
            q="RSI alto significa que vai cair?"
            a={<span>Não necessariamente. Em tendência forte, RSI pode ficar alto por bastante tempo. O valor é mais útil quando combinado com tendência, suporte/resistência e fluxo.</span>}
          />
          <FaqItem
            q="O que são divergências?"
            a={<span>Divergência acontece quando o preço faz um novo topo/fundo, mas o RSI não confirma com novo topo/fundo correspondente, sugerindo perda de força do movimento.</span>}
          />
          <FaqItem
            q="Qual timeframe devo olhar?"
            a={<span>Curto prazo (15m/1h) reage rápido. Médio (4h/24h) filtra ruído. Longo (7d) mostra contexto de ciclo. O ideal é cruzar leituras.</span>}
          />
          <FaqItem
            q="Como esse dashboard ajuda?"
            a={<span>O scatter te mostra RSI contra MarketCap/Volume/Price Change, e a tabela te dá ranking e comparação de timeframes em escala.</span>}
          />
          <FaqItem
            q="Dá pra criar setup de trade só com RSI?"
            a={<span>Dá, mas costuma ser frágil. RSI sozinho gera falsos sinais em tendência forte. Use RSI como filtro/confirmador, não como santo graal.</span>}
          />
        </div>
      </div>
    </div>
  );
};

export default RsiTrackerPage;

export const RsiGauge: React.FC<{ language?: Language }> = ({ language = 'pt' }) => {
  const isDark = useIsDark();
  const [avgData, setAvgData] = useState<RsiAvgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RsiTableItem[]>([]);
  
  useEffect(() => {
    setLoading(true);
    Promise.all([
        fetchRsiAverage(),
        fetchRsiTable({ force: false })
    ]).then(([avg, r]) => {
        setAvgData(avg);
        setRows(r);
        setLoading(false);
    });
  }, []);

  const timeframe = '4h';
  const avgRsi = useMemo(() => computeAvgRsi(rows, timeframe), [rows, timeframe]);
  const counts = useMemo(() => computeCounts(rows, timeframe), [rows, timeframe]);
  
  const label = avgRsi <= 30 ? 'Oversold' : avgRsi >= 70 ? 'Overbought' : 'Neutral';

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto custom-scrollbar">
       <AverageRsiGaugeCard avgRsi={avgRsi} label={label} isDark={isDark} timeframe={timeframe} />
       <OvsObBarCard oversold={counts.oversold} overbought={counts.overbought} total={counts.valid} />
       <HistoricalCard data={avgData} />
    </div>
  );
};

export const RsiScatterChart: React.FC = () => {
  const isDark = useIsDark();
  const [timeframe, setTimeframe] = useState<Timeframe>('4h');
  const [xMode, setXMode] = useState<XMode>('marketCap');
  const [rows, setRows] = useState<RsiTableItem[]>([]);
  
  useEffect(() => {
      fetchRsiTable({ force: false }).then(setRows);
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
