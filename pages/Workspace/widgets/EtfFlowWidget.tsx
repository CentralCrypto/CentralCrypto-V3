import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
const WATERMARK_OPACITY = 0.08;

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

    const size = Math.min(w, h) * 0.75;
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

const MarketSharePanel: React.FC<{ 
    currentFlowData: any, 
    currentVolData: any,
    allTickers: string[], 
    colorMap: Record<string, string>, 
    asset: string,
    stats: { d1: number, d7: number, d30: number },
    onPrev: () => void,
    onNext: () => void,
    isFirst: boolean,
    isLast: boolean
}> = ({ currentFlowData, currentVolData, allTickers, colorMap, asset, stats, onPrev, onNext, isFirst, isLast }) => {
    
    // Sort logic: Sort by VOLUME descending
    const sortedTickers = useMemo(() => {
        if (!currentFlowData && !currentVolData) return [];
        
        const items = allTickers.map(t => {
            const flow = Number(currentFlowData?.[t] || 0);
            const vol = Number(currentVolData?.[t] || 0);
            return { ticker: t, flow, vol };
        });

        // Sort descending by VOLUME
        return items.sort((a, b) => b.vol - a.vol);
    }, [currentFlowData, currentVolData, allTickers]);

    const dateStr = currentFlowData ? new Date(currentFlowData.date).toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }) : '---';

    const StatBox = ({ label, value }: { label: string, value: number }) => (
        <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-[#2f3032] rounded-lg p-2 border border-gray-200 dark:border-slate-700">
            <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
            <span className={`text-xs font-black ${value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                ${formatCompactNumber(value)}
            </span>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#1a1c1e] border-l border-gray-100 dark:border-slate-800/50">
            {/* STATS HEADER */}
            <div className="p-3 border-b border-gray-100 dark:border-slate-800/50">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 text-center">{asset} Net Flow</div>
                <div className="grid grid-cols-3 gap-2">
                    <StatBox label="1D" value={stats.d1} />
                    <StatBox label="7D" value={stats.d7} />
                    <StatBox label="30D" value={stats.d30} />
                </div>
            </div>

            {/* Date Paginator */}
            <div className="p-2 border-b border-gray-100 dark:border-slate-800/50 flex items-center justify-between bg-gray-50 dark:bg-black/20">
                <button 
                    onClick={onPrev} 
                    disabled={isFirst}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronLeft size={16} className="text-gray-600 dark:text-slate-300" />
                </button>
                <span className="text-xs font-black text-gray-700 dark:text-slate-200 uppercase">{dateStr}</span>
                <button 
                    onClick={onNext} 
                    disabled={isLast}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronRight size={16} className="text-gray-600 dark:text-slate-300" />
                </button>
            </div>
            
            {/* Table Header */}
             <div className="grid grid-cols-[1fr_1fr_1fr] px-2 py-1 bg-gray-50 dark:bg-black/10 border-b border-gray-100 dark:border-slate-800/50 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                <span>Ativo</span>
                <span className="text-right">Flow</span>
                <span className="text-right">Vol</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                <table className="w-full text-xs">
                    <tbody>
                        {sortedTickers.map(({ticker, flow, vol}) => {
                            const isZero = flow === 0 && vol === 0;
                            const isPositive = flow >= 0;
                            return (
                                <tr key={ticker} className="border-b border-gray-50 dark:border-slate-800/30 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                    <td className="py-2 pl-1 w-[40%]">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${isZero ? 'opacity-30 grayscale' : ''}`} style={{ backgroundColor: colorMap[ticker] || '#ccc' }} />
                                            <span className={`font-bold ${isZero ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>{ticker}</span>
                                        </div>
                                    </td>
                                    <td className={`py-2 text-right font-mono font-bold w-[30%] ${flow === 0 ? 'text-gray-300 dark:text-gray-600' : (isPositive ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500')}`}>
                                        ${formatCompactNumber(flow)}
                                    </td>
                                    <td className={`py-2 text-right font-mono font-bold w-[30%] text-gray-500 dark:text-slate-400`}>
                                        ${formatCompactNumber(vol)}
                                    </td>
                                </tr>
                            );
                        })}
                        {sortedTickers.length === 0 && (
                            <tr><td colSpan={3} className="text-center py-4 text-gray-400">Sem dados</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- PHYSICS BUBBLES ---
// Size based on Volume, Color based on Flow
const EtfBubbles: React.FC<{ currentFlowData: any, currentVolData: any, allTickers: string[], colorMap: Record<string,string> }> = ({ currentFlowData, currentVolData, allTickers, colorMap }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>(0);
    const particlesRef = useRef<any[]>([]);
    
    // Tooltip State
    const [tooltip, setTooltip] = useState<{visible: boolean, x: number, y: number, content: any} | null>(null);

    useEffect(() => {
        if (!currentFlowData && !currentVolData) {
            particlesRef.current = [];
            return;
        }

        // 1. Extract values
        // Size comes from Volume
        // Color comes from Flow
        const bubbleData: Record<string, { vol: number, flow: number }> = {};
        let maxVol = 0;
        
        allTickers.forEach(t => {
            const vol = Number(currentVolData?.[t] || 0);
            const flow = Number(currentFlowData?.[t] || 0);
            
            // Only show if there is Volume (activity) OR significant Flow
            if (vol > 0 || Math.abs(flow) > 0) {
                bubbleData[t] = { vol, flow };
                if (vol > maxVol) maxVol = vol;
            }
        });

        const activeTickers = Object.keys(bubbleData);
        
        // 2. Initialize Particles
        const container = containerRef.current;
        if (!container) return;
        const width = container.clientWidth;
        const height = container.clientHeight;

        const newParticles = activeTickers.map(t => {
            const data = bubbleData[t];
            
            // Radius proportional to sqrt of VOLUME (Area)
            // Min size 20, Max size 65
            const radius = 20 + (Math.sqrt(data.vol) / Math.sqrt(maxVol || 1)) * 55;
            
            // Reuse existing particle to keep position
            const existing = particlesRef.current.find(p => p.id === t);
            
            if (existing) {
                existing.targetRadius = radius;
                existing.vol = data.vol;
                existing.flow = data.flow;
                return existing;
            }

            return {
                id: t,
                x: Math.random() * (width - radius * 2) + radius,
                y: Math.random() * (height - radius * 2) + radius,
                vx: (Math.random() - 0.5) * 0.8,
                vy: (Math.random() - 0.5) * 0.8,
                radius: 0,
                targetRadius: radius,
                color: colorMap[t] || '#888',
                vol: data.vol,
                flow: data.flow,
                mass: radius
            };
        });
        
        particlesRef.current = newParticles;

    }, [currentFlowData, currentVolData, allTickers, colorMap]);

    useEffect(() => {
        const animate = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const w = canvas.width;
            const h = canvas.height;

            ctx.clearRect(0, 0, w, h);

            const particles = particlesRef.current;
            if (!particles || particles.length === 0) {
                 requestRef.current = requestAnimationFrame(animate);
                 return;
            }

            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                
                // Radius Animation
                p.radius += (p.targetRadius - p.radius) * 0.1;

                // Move
                p.x += p.vx;
                p.y += p.vy;

                // Walls
                if (p.x - p.radius < 0) { p.x = p.radius; p.vx *= -1; }
                if (p.x + p.radius > w) { p.x = w - p.radius; p.vx *= -1; }
                if (p.y - p.radius < 0) { p.y = p.radius; p.vy *= -1; }
                if (p.y + p.radius > h) { p.y = h - p.radius; p.vy *= -1; }

                // Collisions
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dx = p2.x - p.x;
                    const dy = p2.y - p.y;
                    const distSq = dx*dx + dy*dy;
                    const minDist = p.radius + p2.radius;
                    const minDistSq = minDist * minDist;

                    if (distSq < minDistSq) {
                        const dist = Math.sqrt(distSq) || 0.001;
                        const nx = dx / dist;
                        const ny = dy / dist;
                        const overlap = minDist - dist;
                        
                        // Push
                        const ax = nx * overlap * 0.05; 
                        const ay = ny * overlap * 0.05;
                        p.x -= ax; p.y -= ay;
                        p2.x += ax; p2.y += ay;

                        // Bounce
                        const tempVx = p.vx;
                        const tempVy = p.vy;
                        p.vx = p2.vx * 0.9; 
                        p.vy = p2.vy * 0.9;
                        p2.vx = tempVx * 0.9;
                        p2.vy = tempVy * 0.9;
                    }
                }
                
                // Friction
                p.vx *= 0.99;
                p.vy *= 0.99;
                p.vx += (Math.random() - 0.5) * 0.05;
                p.vy += (Math.random() - 0.5) * 0.05;

                // DRAW
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                
                if (p.flow >= 0) {
                    // Positive Flow: Solid Color (Using Ticker Color)
                    // Or Green? The requirement says "Colors normally but pastel" or "Metalized"
                    // Let's stick to the colorMap color if positive, or Green if requested.
                    // User said: "vINCULA o aparecimento ao FLOW... Se negativo bolha com anel vermelho"
                    // Interpretation: Positive = Normal (Color Map) / Negative = Hollow Red
                    
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = 0.85;
                    ctx.fill();
                    ctx.globalAlpha = 1.0;
                    
                    // Shine
                    ctx.beginPath();
                    ctx.arc(p.x - p.radius * 0.3, p.y - p.radius * 0.3, p.radius * 0.25, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255,255,255,0.2)';
                    ctx.fill();
                } else {
                    // Negative Flow: Hollow/Translucent with Red Ring
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = 0.2; // Very faint fill
                    ctx.fill();
                    ctx.globalAlpha = 1.0;
                    
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = '#ef4444'; // Red Stroke
                    ctx.stroke();
                }

                // Text
                if (p.radius > 12) {
                    ctx.fillStyle = "#ffffff";
                    ctx.font = `bold ${Math.max(10, p.radius/2.5)}px Inter, sans-serif`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.shadowColor = "rgba(0,0,0,0.8)";
                    ctx.shadowBlur = 4;
                    ctx.fillText(p.id, p.x, p.y);
                    ctx.shadowBlur = 0;
                }
            }

            requestRef.current = requestAnimationFrame(animate);
        };

        const handleResize = () => {
            if (containerRef.current && canvasRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const dpr = window.devicePixelRatio || 1;
                canvasRef.current.width = rect.width * dpr;
                canvasRef.current.height = rect.height * dpr;
                
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) ctx.scale(dpr, dpr);
                
                particlesRef.current.forEach(p => {
                    p.x = Math.min(p.x, rect.width - p.radius);
                    p.y = Math.min(p.y, rect.height - p.radius);
                });
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize();
        requestRef.current = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(requestRef.current);
        };
    }, []);

    const handleMouseMove = (e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if(!rect) return;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const found = particlesRef.current.find(p => {
            const dx = p.x - x;
            const dy = p.y - y;
            return dx*dx + dy*dy < p.radius*p.radius;
        });

        if (found) {
            setTooltip({
                visible: true,
                x: e.clientX,
                y: e.clientY,
                content: { name: found.id, flow: found.flow, vol: found.vol }
            });
        } else {
            setTooltip(null);
        }
    };

    const handleMouseLeave = () => setTooltip(null);

    return (
        <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-white dark:bg-[#1a1c1e] cursor-crosshair">
            <canvas 
                ref={canvasRef} 
                className="w-full h-full block" 
                style={{ width: '100%', height: '100%' }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            />
            {tooltip && createPortal(
                <div 
                    className="fixed z-[9999] pointer-events-none bg-black/90 backdrop-blur text-white p-3 rounded-xl border border-gray-700 shadow-2xl flex flex-col gap-1 min-w-[140px]"
                    style={{ top: tooltip.y + 10, left: tooltip.x + 10 }}
                >
                    <div className="font-black text-[#dd9933] uppercase text-sm border-b border-white/10 pb-1 mb-1">{tooltip.content.name}</div>
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Flow:</span> 
                        <span className={`font-mono font-bold ${tooltip.content.flow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            ${formatCompactNumber(tooltip.content.flow)}
                        </span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Vol:</span> 
                        <span className="font-mono font-bold text-gray-200">
                            ${formatCompactNumber(tooltip.content.vol)}
                        </span>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
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
  
  // New States for Simultaneous Data
  const [flowsData, setFlowsData] = useState<any[]>([]);
  const [volData, setVolData] = useState<any[]>([]);

  const [summaryData, setSummaryData] = useState<EtfFlowData | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  
  // PAGINATION STATE
  const [viewDateIndex, setViewDateIndex] = useState<number>(-1);

  const showExtras = item.id === 'etf-page';

  useEffect(() => {
    fetchEtfFlow().then(res => setSummaryData(res));
  }, []);

  // Fetch Logic Updated: Always fetch what's needed, but track the "main" data for the chart separately if needed
  // Actually, to support the table showing both Flow and Vol, we need both datasets loaded.
  useEffect(() => {
    setLoading(true);
    
    Promise.all([
        fetchEtfDetailed(asset, 'flows'),
        fetchEtfDetailed(asset, 'volume')
    ]).then(([flows, vols]) => {
        setFlowsData(flows || []);
        setVolData(vols || []);
        
        // Determine which one is used for the Main Chart based on `metric` toggle
        const primaryData = metric === 'flows' ? flows : vols;
        const arr = Array.isArray(primaryData) ? primaryData : [];
        setData(arr);
        
        // Set to last available date by default based on primary data
        setViewDateIndex(arr.length > 0 ? arr.length - 1 : -1);
        setLoading(false);
    });
  }, [asset, metric]);

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

  const sidebarStats = useMemo(() => {
      if (!data || data.length === 0) return { d1: 0, d7: 0, d30: 0 };
      
      const sumFlow = (slice: any[]) => {
          let sum = 0;
          slice.forEach(day => sum += Number(day.totalGlobal || 0));
          return sum;
      };

      // Ensure data exists before slicing
      const d1 = data.length > 0 ? sumFlow(data.slice(-1)) : 0;
      const d7 = data.length > 6 ? sumFlow(data.slice(-7)) : 0;
      const d30 = data.length > 29 ? sumFlow(data.slice(-30)) : 0;

      return { d1, d7, d30 };
  }, [data]);

  // Derive Current Day Data for Table/Bubbles
  // We need to sync Flow and Vol data by Date.
  // Assuming arrays are sorted by date and roughly align, we try to match by timestamp.
  const { currentFlowData, currentVolData } = useMemo(() => {
      if (viewDateIndex < 0) return { currentFlowData: null, currentVolData: null };
      
      // Get date from primary data
      const primaryItem = data[viewDateIndex];
      if (!primaryItem) return { currentFlowData: null, currentVolData: null };

      const targetDate = primaryItem.date;

      // Find matching in Flows
      const f = flowsData.find(d => Math.abs(d.date - targetDate) < 86400000); // 24h slack just in case
      // Find matching in Vols
      const v = volData.find(d => Math.abs(d.date - targetDate) < 86400000);

      return { currentFlowData: f, currentVolData: v };

  }, [data, flowsData, volData, viewDateIndex]);

  const handlePrevDay = () => setViewDateIndex(i => Math.max(0, i - 1));
  const handleNextDay = () => setViewDateIndex(i => Math.min(data.length - 1, i + 1));

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

      {showExtras ? (
          <div className="grid grid-cols-12 gap-4" style={{ height: '620px', minHeight: '620px' }}>
              <div className="col-span-12 lg:col-span-2 overflow-hidden bg-gray-5 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-slate-800/50 flex flex-col">
                  <MarketSharePanel 
                    currentFlowData={currentFlowData} 
                    currentVolData={currentVolData}
                    allTickers={allTickers} 
                    colorMap={colorMap} 
                    asset={asset}
                    stats={sidebarStats}
                    onPrev={handlePrevDay}
                    onNext={handleNextDay}
                    isFirst={viewDateIndex <= 0}
                    isLast={viewDateIndex >= data.length - 1}
                  />
              </div>
              <div className="col-span-12 lg:col-span-7 overflow-hidden relative bg-gray-5 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-slate-800/50 p-4 flex flex-col">
                  <div className="relative flex-1 min-h-0">
                      <ChartArea />
                  </div>
                  <HelpTooltip />
              </div>
              <div className="col-span-12 lg:col-span-3 overflow-hidden bg-gray-5 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-slate-800/50 p-4 flex flex-col relative">
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 text-center tracking-widest">Share Volumétrico (Dia)</h4>
                  <div className="flex-1 min-h-0 relative bg-black/5 dark:bg-black/20 rounded-lg">
                      <EtfBubbles 
                        currentFlowData={currentFlowData} 
                        currentVolData={currentVolData} 
                        allTickers={allTickers} 
                        colorMap={colorMap} 
                      />
                  </div>
              </div>
          </div>
      ) : (
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

  const assets = [
      { name: 'BTC', val: etfData.btcValue, color: '#f7931a' },
      { name: 'ETH', val: etfData.ethValue, color: '#627eea' },
      { name: 'SOL', val: etfData.solValue, color: '#14f195' },
      { name: 'XRP', val: etfData.xrpValue, color: '#23292f' },
  ];

  return (
    <div className="h-full flex flex-col p-3 relative text-center bg-white dark:bg-[#2f3032]">
      <div className="flex flex-col items-center shrink-0">
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t.dailyFlow}</div>
        <div className={`mt-0.5 flex items-center justify-center gap-1`}>
          <FlowArrow size={24} strokeWidth={4} className={arrowColor} />
          <span className="text-3xl font-black text-black dark:text-white tracking-tighter">
            ${formatCompactNumber(Math.abs(totalFlow))}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar my-2 pr-1 border-y border-gray-100 dark:border-slate-700/50 py-2">
          <div className="flex flex-col gap-1.5">
              {assets.map(asset => (
                  <div key={asset.name} className="flex items-center justify-between px-2 py-1 bg-gray-50 dark:bg-black/10 rounded">
                      <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: asset.color}}></div>
                          <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{asset.name}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">
                          ${formatCompactNumber(asset.val)}
                      </span>
                  </div>
              ))}
          </div>
      </div>

      <div className="grid grid-cols-3 gap-1 shrink-0">
        <div className="bg-gray-50 dark:bg-black/10 rounded p-1">
          <div className={`text-xs font-bold ${etfData.history.lastWeek >= 0 ? 'text-green-500' : 'text-red-500'}`}>${formatCompactNumber(etfData.history.lastWeek)}</div>
          <div className="text-[8px] text-slate-500 font-bold uppercase">{t.last7d}</div>
        </div>
        <div className="bg-gray-50 dark:bg-black/10 rounded p-1">
          <div className={`text-xs font-bold ${etfData.history.lastMonth >= 0 ? 'text-green-500' : 'text-red-500'}`}>${formatCompactNumber(etfData.history.lastMonth)}</div>
          <div className="text-[8px] text-slate-500 font-bold uppercase">{t.last30d}</div>
        </div>
        <div className="bg-gray-50 dark:bg-black/10 rounded p-1">
          <div className={`text-xs font-bold ${etfData.history.last90d >= 0 ? 'text-green-500' : 'text-red-500'}`}>${formatCompactNumber(etfData.history.last90d)}</div>
          <div className="text-[8px] text-slate-500 font-bold uppercase">{t.last90d}</div>
        </div>
      </div>
      
      <div className="text-[8px] text-slate-600 mt-1 uppercase tracking-widest opacity-60">
          Total Market Net Flow
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