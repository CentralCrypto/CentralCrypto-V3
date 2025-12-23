
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, Info } from 'lucide-react';
import { MacdAvgData, MacdTrackerPoint, fetchMacdAverage, fetchMacdTracker } from '../services/api';
import { DashboardItem, Language } from '../../../types';
import { getTranslations } from '../../../locales';

declare global {
  interface Window { Highcharts: any; }
}

const TIMEFRAMES = ['15m', '1h', '4h', '24h', '7d'] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

type XAxisMode = 'marketCap' | 'priceChange';

const formatCompactNumber = (number: number) => {
  if (!number || number === 0) return '---';
  if (number < 1000) return number.toString();
  const suffixes = ['', 'K', 'M', 'B', 'T'];
  const suffixNum = Math.floor(("" + Math.floor(number)).length / 3);
  let shortValue = parseFloat((number / Math.pow(1000, suffixNum)).toPrecision(3));
  if (shortValue % 1 !== 0) shortValue = parseFloat(shortValue.toFixed(2));
  return shortValue + suffixes[suffixNum];
};

interface HighchartsMacdTrackerProps {
  data: any[];
  timeframe: Timeframe;
  xMode: XAxisMode;
  labels: any; 
}

const HighchartsMacdTracker: React.FC<HighchartsMacdTrackerProps> = ({ data, timeframe, xMode, labels }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || !window.Highcharts) return;

    // Check Theme
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#334155';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    const containerHeight = chartRef.current.clientHeight || 400;
    const bullishSeries: any[] = [];
    const bearishSeries: any[] = [];

    const isMarketCapMode = xMode === 'marketCap';

    data.forEach(p => {
      const pointData = {
        x: isMarketCapMode ? p.marketCap : p.change24h,
        y: p.macdNorm,
        name: p.name,
        symbol: p.symbol,
        price: p.price,
        change24h: p.change24h,
        macdValues: p.macdValues,
        signalValues: p.signalValues,
        histValues: p.histValues,
        macdRaw: p.macd,
        macdNorm: p.macdNorm,
        logo: p.logo,
        marketCap: p.marketCap, 
        marker: {
          symbol: p.logo ? `url(${p.logo})` : 'circle',
          width: 24,
          height: 24
        }
      };
      
      if (p.macd >= 0) bullishSeries.push(pointData);
      else bearishSeries.push(pointData);
    });

    const xTitle = isMarketCapMode
      ? 'Market Cap (Log Scale)'
      : 'Price Change 24h (%)';

    window.Highcharts.chart(chartRef.current, {
      chart: {
        type: 'scatter',
        backgroundColor: 'transparent',
        zoomType: 'xy', 
        style: { fontFamily: 'Inter, sans-serif' },
        marginTop: 60,
        height: containerHeight,
      },
      title: { text: null },
      credits: { enabled: false },
      exporting: { enabled: false }, // DISABLE MENU
      legend: {
        enabled: true,
        align: 'center',
        verticalAlign: 'top',
        y: -10,
        itemStyle: { color: textColor, fontWeight: 'bold' },
        itemHoverStyle: { color: '#dd9933' },
        itemMarginTop: 10
      },
      xAxis: {
        title: { text: xTitle, style: { color: textColor } },
        type: isMarketCapMode ? 'logarithmic' : 'linear',
        gridLineColor: gridColor,
        gridLineWidth: 1,
        gridLineDashStyle: 'Dash',
        labels: {
          style: { color: textColor },
          formatter: function (this: any) {
            if (isMarketCapMode) return '$' + formatCompactNumber(this.value);
            return `${this.value.toFixed(1)}%`;
          }
        },
        lineColor: gridColor,
        tickColor: gridColor
      },
      yAxis: {
        title: { text: 'Normalized MACD (Z-Score)', style: { color: textColor } },
        gridLineColor: gridColor,
        gridLineWidth: 1,
        gridLineDashStyle: 'Dash',
        labels: { style: { color: textColor } },
        plotLines: [{
          value: 0,
          color: textColor,
          dashStyle: 'ShortDash',
          width: 2,
          zIndex: 3,
          label: { text: 'Centerline (0)', style: { color: textColor } }
        }],
        plotBands: [
          { from: 0, to: 10, color: 'rgba(0, 158, 79, 0.08)', label: { text: 'BULLISH ZONE', style: { color: '#009E4F', fontWeight: 'bold' }, align: 'center', y: 20 } },
          { from: -10, to: 0, color: 'rgba(224, 58, 62, 0.08)', label: { text: 'BEARISH ZONE', style: { color: '#E03A3E', fontWeight: 'bold' }, align: 'center', y: -10 } }
        ]
      },
      tooltip: {
        useHTML: true,
        backgroundColor: isDark ? '#1a1c1e' : '#ffffff',
        borderColor: gridColor,
        borderRadius: 8,
        shadow: true,
        padding: 0,
        snap: 0, // Disable snapping to nearest point
        hideDelay: 0, // Hide immediately on mouse out
        formatter: function (this: any) {
          const p = this.point;
          let breakdownHtml = '<div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-top: 10px; text-align: center;">';
          TIMEFRAMES.forEach(tf => {
            const macd = p.macdValues?.[tf] ?? 0;
            const signal = p.signalValues?.[tf] ?? 0;
            const hist = p.histValues?.[tf] ?? 0;
            const isCurrent = tf === timeframe;
            const bg = isCurrent ? 'rgba(221, 153, 51, 0.2)' : isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(203, 213, 225, 0.5)';
            const border = isCurrent ? '1px solid rgba(221, 153, 51, 0.5)' : '1px solid transparent';
            breakdownHtml += `
              <div style="background: ${bg}; border: ${border}; padding: 5px; border-radius: 4px; text-align: center;">
                <div style="font-size: 10px; color: ${isCurrent ? '#dd9933' : '#64748b'}; font-weight: bold;">${tf.toUpperCase()}</div>
                <div style="font-size: 10px; color: #3b82f6;">${macd.toFixed(3)}</div>
                <div style="font-size: 10px; color: #f97316;">${signal.toFixed(3)}</div>
                <div style="font-size: 10px; color: ${hist > 0 ? '#4ade80' : '#f87171'};">${hist.toFixed(3)}</div>
              </div>`;
          });
          breakdownHtml += '</div>';

          return `
            <div style="padding: 14px; min-width: 280px; font-family: 'Inter', sans-serif;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #334155;">
                ${p.logo ? `<img src="${p.logo}" style="width: 28px; height: 28px; border-radius: 50%;">` : ''}
                <span style="font-size: 18px; font-weight: 900; color: ${isDark ? '#fff' : '#000'};">${p.name} (${p.symbol})</span>
              </div>
              <div style="font-size: 11px; color: #94a3b8; font-weight: bold; text-transform: uppercase;">Current TF (${timeframe.toUpperCase()})</div>
              <div style="font-size: 12px; color: ${isDark ? '#e5e7eb' : '#334155'}; margin-top: 2px;">
                MACD: <span style="font-weight:bold;">${p.macdRaw.toFixed(4)}</span> ·
                Normalized: <span style="font-weight:bold; color:${p.macdNorm >= 0 ? '#4ade80' : '#f87171'};">${p.macdNorm.toFixed(2)}</span>
              </div>
              
              <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 5px; border-top: 1px solid rgba(51, 65, 85, 0.3);">
                 <span style="font-size: 11px; color: #94a3b8;">${labels.price}:</span>
                 <span style="font-size: 11px; color: ${isDark ? '#fff' : '#000'}; font-weight: bold;">$${p.price > 1 ? p.price.toFixed(2) : p.price.toFixed(5)}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                 <span style="font-size: 11px; color: #94a3b8;">${labels.mcap}:</span>
                 <span style="font-size: 11px; color: ${isDark ? '#fff' : '#000'}; font-weight: bold;">$${formatCompactNumber(p.marketCap)}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                 <span style="font-size: 11px; color: #94a3b8;">${labels.change}:</span>
                 <span style="font-size: 11px; font-weight: bold; color: ${p.change24h >= 0 ? '#4ade80' : '#f87171'};">${p.change24h > 0 ? '+' : ''}${p.change24h.toFixed(2)}%</span>
              </div>

              <div style="font-size: 11px; color: #94a3b8; font-weight: bold; text-transform: uppercase; margin-top: 10px; text-align:center;">
                 <span style="color:#3b82f6">MACD</span> / <span style="color:#f97316">${labels.signal}</span> / <span style="color:#4ade80">${labels.hist}</span>
              </div>
              ${breakdownHtml}
            </div>`;
        }
      },
      plotOptions: {
          scatter: {
              stickyTracking: false,
              marker: {
                  radius: 5,
                  states: { hover: { enabled: true, lineColor: 'rgb(100,100,100)' } }
              },
              states: { hover: { marker: { enabled: false } } }
          }
      },
      series: [
        { name: 'Bullish (MACD > 0)', data: bullishSeries, color: 'rgba(0, 158, 79, 0.7)' },
        { name: 'Bearish (MACD < 0)', data: bearishSeries, color: 'rgba(224, 58, 62, 0.7)' }
      ]
    });
  }, [data, timeframe, xMode, labels]);

  return <div ref={chartRef} style={{ width: '100%', height: '100%', minHeight: '300px' }} />;
};

const MacdWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
  const [macdAvgData, setMacdAvgData] = useState<MacdAvgData | null>(null);
  const [macdTrackerData, setMacdTrackerData] = useState<MacdTrackerPoint[]>([]);
  const [macdTrackerLoading, setMacdTrackerLoading] = useState(false);
  const [macdTimeframe, setMacdTimeframe] = useState<Timeframe>('7d');
  const [xMode, setXMode] = useState<XAxisMode>('marketCap');

  const t = getTranslations(language as Language).dashboard.widgets.macd;
  const tWs = getTranslations(language as Language).workspace.widgets.macd;
  const timeT = getTranslations(language as Language).dashboard.widgets.time;

  const currentMacdPoints = useMemo(() => {
    const withMacd = macdTrackerData
      .map(p => ({
        ...p,
        macd: p.macd[macdTimeframe] || 0,
        macdValues: p.macd,
        signalValues: p.signal,
        histValues: p.histogram
      }))
      .filter(p => (p.marketCap > 0 || p.volume24h > 0) && typeof p.macd === 'number' && !isNaN(p.macd));
      
    if (withMacd.length < 2) return withMacd.map(p => ({ ...p, macdNorm: p.macd > 0 ? 0.5 : -0.5 }));

    const macdValues = withMacd.map(p => p.macd as number);
    const mean = macdValues.reduce((a, b) => a + b) / macdValues.length;
    const stdDev = Math.sqrt(macdValues.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / macdValues.length);

    if (stdDev === 0) return withMacd.map(p => ({ ...p, macdNorm: 0 }));
    
    return withMacd.map(p => {
        const zScore = (p.macd as number - mean) / stdDev;
        const macdNorm = Math.tanh(zScore / 2); 
        return { ...p, macdNorm };
    });

  }, [macdTrackerData, macdTimeframe]);

  const dynamicMacdAvg = useMemo(
    () =>
      currentMacdPoints.length === 0
        ? 0
        : currentMacdPoints.reduce((acc, p) => acc + (p.macdNorm as number), 0) /
          currentMacdPoints.length,
    [currentMacdPoints]
  );

  useEffect(() => {
    fetchMacdAverage().then(setMacdAvgData);

    if (item.isMaximized) {
      setMacdTrackerLoading(true);
      fetchMacdTracker().then(data => {
        setMacdTrackerData(data);
        setMacdTrackerLoading(false);
      });
    }
  }, [item.isMaximized]);

  const Watermark = () => (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-[0.05] z-0">
      <img
        src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png"
        alt="watermark"
        className="w-3/4 h-auto grayscale filter"
      />
    </div>
  );

  if (!macdAvgData && !item.isMaximized) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-slate-500">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const macdVal = item.isMaximized
    ? dynamicMacdAvg
    : (macdAvgData?.averageMacd ?? 0);

  const macdLabel = macdVal > 0.1 ? t.bullish : macdVal < -0.1 ? t.bearish : t.neutral;
  const normalizedForGauge = Math.max(0, Math.min(1, (macdVal + 1) / 2));
  const macdAngle = normalizedForGauge * 180;

  if (item.isMaximized) {
    return (
      <div className="h-full flex flex-col p-4 relative bg-white dark:bg-[#2f3032]">
        <Watermark />
        <div className="z-10 mb-2 flex justify-between items-end w-full">
          <div className="flex flex-col items-start">
            <div className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">{tWs.avgLabel}</div>
            <div className="text-4xl font-black text-[#dd9933]">
              {dynamicMacdAvg.toFixed(2)}
            </div>
            <div className="text-sm font-bold text-gray-900 dark:text-white uppercase">
              {macdLabel}
            </div>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase mb-1">
                {tWs.timeframe}
              </span>
              <select
                value={macdTimeframe}
                onChange={e => setMacdTimeframe(e.target.value as Timeframe)}
                className="bg-gray-100 dark:bg-[#1a1c1e] text-xs font-bold text-gray-900 dark:text-white border-0 dark:border dark:border-slate-600 rounded px-2 py-1 focus:border-[#dd9933] outline-none"
              >
                {TIMEFRAMES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col items-end relative group">
              <span className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase mb-1">
                {tWs.xAxis}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setXMode('marketCap')}
                  className={`px-2 py-1 text-[10px] font-bold rounded border ${
                    xMode === 'marketCap'
                      ? 'bg-[#dd9933] border-[#dd9933] text-black'
                      : 'bg-gray-100 dark:bg-[#1a1c1e] border-0 dark:border dark:border-slate-600 text-gray-700 dark:text-slate-300'
                  }`}
                >
                  Mkt Cap
                </button>
                <button
                  type="button"
                  onClick={() => setXMode('priceChange')}
                  className={`px-2 py-1 text-[10px] font-bold rounded border ${
                    xMode === 'priceChange'
                      ? 'bg-[#dd9933] border-[#dd9933] text-black'
                      : 'bg-gray-100 dark:bg-[#1a1c1e] border-0 dark:border dark:border-slate-600 text-gray-700 dark:text-slate-300'
                  }`}
                >
                  24h %
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Contextual Info Block */}
        <div className="z-10 mb-2 px-3 py-2 bg-gray-100 dark:bg-black/20 border-0 dark:border dark:border-slate-700 rounded-lg flex items-start gap-2 text-[10px] text-gray-600 dark:text-slate-400">
            <Info size={14} className="flex-shrink-0 mt-0.5 text-[#dd9933]" />
            <span>
                {xMode === 'marketCap' ? tWs.context.mcap : tWs.context.priceChange}
            </span>
        </div>

        <div className="flex-1 min-h-0 w-full z-10">
          {macdTrackerLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-slate-500">
              <Loader2 className="animate-spin mr-2" /> {tWs.loading}
            </div>
          ) : currentMacdPoints.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              No Data Available
            </div>
          ) : (
            <HighchartsMacdTracker
              data={currentMacdPoints}
              timeframe={macdTimeframe}
              xMode={xMode}
              labels={tWs.tooltip}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col justify-center gap-2 p-2 relative text-center bg-white dark:bg-[#2f3032]">
      <Watermark />
      <div className="flex items-center justify-center relative mt-6 z-10">
        <svg viewBox="0 0 200 110" className="w-[85%] max-w-[280px]">
          <defs>
            <linearGradient id="grad-macd" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#E03A3E" />
              <stop offset="50%" stopColor="#FFD700" />
              <stop offset="100%" stopColor="#009E4F" />
            </linearGradient>
          </defs>
          <path
            d="M 10 100 A 90 90 0 0 1 190 100"
            fill="none"
            className="stroke-[#eeeeee] dark:stroke-[#333]"
            strokeWidth="18"
            strokeLinecap="round"
          />
          <path
            d="M 10 100 A 90 90 0 0 1 190 100"
            fill="none"
            stroke="url(#grad-macd)"
            strokeWidth="18"
            strokeDasharray={`${(macdAngle / 180) * 283} 283`}
            strokeLinecap="round"
          />
          <g transform={`rotate(${macdAngle - 90} 100 100)`}>
            <path d="M 100 100 L 100 20" className="stroke-gray-800 dark:stroke-white" strokeWidth="3" />
            <circle cx="100" cy="100" r="5" className="fill-gray-800 dark:fill-white" />
          </g>
        </svg>
      </div>
      <div className="flex flex-col items-center mt-4 z-10">
        <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">{tWs.avgLabel}</div>
        <div className="text-4xl font-black text-[#dd9933] leading-none">
          {macdAvgData?.averageMacd?.toFixed(2) || '--'}
        </div>
        <div className="text-sm font-bold text-gray-900 dark:text-white uppercase mt-1">
          {macdLabel}
        </div>
      </div>
      <div className="flex justify-around w-full mt-2 text-center z-10 border-t border-gray-200 dark:border-slate-700/30 pt-2">
        <div>
          <div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">{timeT.yesterday}</div>
          <div className="text-sm font-bold text-gray-800 dark:text-white">
            {macdAvgData?.yesterday?.toFixed(2) || '--'}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">{timeT.d7}</div>
          <div className="text-sm font-bold text-gray-800 dark:text-white">
            {macdAvgData?.days7Ago?.toFixed(2) || '--'}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">{timeT.d30}</div>
          <div className="text-sm font-bold text-gray-800 dark:text-white">
            {macdAvgData?.days30Ago?.toFixed(2) || '--'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MacdWidget;
