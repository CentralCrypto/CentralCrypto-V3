
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

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#334155';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    const containerHeight = chartRef.current.clientHeight || 400;
    const bullishSeries: any[] = [];
    const bearishSeries: any[] = [];

    const isMarketCapMode = xMode === 'marketCap';

    data.forEach(p => {
      const pointData = {
        x: isMarketCapMode ? (p.marketCap || 0) : (p.change24h || 0),
        y: p.macdNorm || 0,
        name: p.name || 'Unknown',
        symbol: p.symbol || '?',
        price: p.price || 0,
        change24h: p.change24h || 0,
        macdValues: p.macdValues || {},
        signalValues: p.signalValues || {},
        histValues: p.histValues || {},
        macdRaw: p.macd || 0,
        macdNorm: p.macdNorm || 0,
        logo: p.logo,
        marketCap: p.marketCap || 0, 
        marker: {
          symbol: p.logo ? `url(${p.logo})` : 'circle',
          width: 24,
          height: 24
        }
      };
      
      if (pointData.macdRaw >= 0) bullishSeries.push(pointData);
      else bearishSeries.push(pointData);
    });

    const xTitle = isMarketCapMode ? 'Market Cap' : 'Price Change 24h';

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
      exporting: { enabled: false },
      legend: {
        enabled: true,
        align: 'center',
        verticalAlign: 'top',
        y: -10,
        itemStyle: { color: textColor, fontWeight: 'bold' }
      },
      xAxis: {
        title: { text: xTitle, style: { color: textColor } },
        type: isMarketCapMode ? 'logarithmic' : 'linear',
        gridLineColor: gridColor,
        labels: {
          style: { color: textColor },
          formatter: function (this: any) {
            if (isMarketCapMode) return '$' + formatCompactNumber(this.value);
            return `${(this.value || 0).toFixed(1)}%`;
          }
        }
      },
      yAxis: {
        title: { text: 'Normalized MACD', style: { color: textColor } },
        gridLineColor: gridColor,
        labels: { style: { color: textColor } },
        plotLines: [{
          value: 0, color: textColor, dashStyle: 'ShortDash', width: 2, zIndex: 3
        }]
      },
      tooltip: {
        useHTML: true,
        backgroundColor: isDark ? '#1a1c1e' : '#ffffff',
        borderColor: gridColor,
        borderRadius: 8,
        formatter: function (this: any) {
          const p = this.point;
          const macdRaw = p.macdRaw ?? 0;
          const macdNorm = p.macdNorm ?? 0;
          return `
            <div style="padding: 10px; color: ${isDark ? '#fff' : '#000'};">
              <b>${p.name}</b> (${p.symbol})<br/>
              MACD: ${macdRaw.toFixed(4)}<br/>
              Norm: ${macdNorm.toFixed(2)}
            </div>`;
        }
      },
      series: [
        { name: 'Bullish', data: bullishSeries, color: 'rgba(0, 158, 79, 0.7)' },
        { name: 'Bearish', data: bearishSeries, color: 'rgba(224, 58, 62, 0.7)' }
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
    return macdTrackerData
      .map(p => ({
        ...p,
        macd: p.macd[macdTimeframe] || 0,
        macdValues: p.macd,
        signalValues: p.signal,
        histValues: p.histogram,
        macdNorm: 0 // Placeholder
      }))
      .filter(p => p.macd !== undefined);
  }, [macdTrackerData, macdTimeframe]);

  useEffect(() => {
    fetchMacdAverage().then(setMacdAvgData).catch(() => {});
    if (item.isMaximized) {
      setMacdTrackerLoading(true);
      fetchMacdTracker().then(data => {
        setMacdTrackerData(data);
        setMacdTrackerLoading(false);
      }).catch(() => setMacdTrackerLoading(false));
    }
  }, [item.isMaximized]);

  if (!macdAvgData && !item.isMaximized) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>;

  const macdVal = macdAvgData?.averageMacd ?? 0;
  const macdLabel = macdVal > 0.1 ? t.bullish : macdVal < -0.1 ? t.bearish : t.neutral;
  const normalizedForGauge = Math.max(0, Math.min(1, (macdVal + 1) / 2));
  const macdAngle = normalizedForGauge * 180;

  return (
    <div className="h-full flex flex-col justify-center gap-2 p-2 relative text-center bg-white dark:bg-[#2f3032]">
      <div className="flex items-center justify-center relative mt-6 z-10">
        <svg viewBox="0 0 200 110" className="w-[85%] max-w-[280px]">
          <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" className="stroke-[#eeeeee] dark:stroke-[#333]" strokeWidth="18" strokeLinecap="round" />
          <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="#dd9933" strokeWidth="18" strokeDasharray={`${(macdAngle / 180) * 283} 283`} strokeLinecap="round" />
          <g transform={`rotate(${macdAngle - 90} 100 100)`}>
            <path d="M 100 100 L 100 20" className="stroke-gray-800 dark:stroke-white" strokeWidth="3" />
            <circle cx={100} cy={100} r="5" className="fill-gray-800 dark:fill-white" />
          </g>
        </svg>
      </div>
      <div className="flex flex-col items-center mt-4 z-10">
        <div className="text-4xl font-black text-[#dd9933] leading-none">{macdVal.toFixed(2)}</div>
        <div className="text-sm font-bold text-gray-900 dark:text-white uppercase mt-1">{macdLabel}</div>
      </div>
      <div className="flex justify-around w-full mt-2 text-center z-10 border-t border-gray-200 dark:border-slate-700/30 pt-2">
        <div>
          <div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">{timeT.yesterday}</div>
          <div className="text-sm font-bold text-gray-800 dark:text-white">{(macdAvgData?.yesterday ?? 0).toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">{timeT.d7}</div>
          <div className="text-sm font-bold text-gray-800 dark:text-white">{(macdAvgData?.days7Ago ?? 0).toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">{timeT.d30}</div>
          <div className="text-sm font-bold text-gray-800 dark:text-white">{(macdAvgData?.days30Ago ?? 0).toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
};

export default MacdWidget;
