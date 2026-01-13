
import React, { useEffect, useRef, useState, useMemo } from 'react';
import Highcharts from 'highcharts';
import TreemapModule from 'highcharts/modules/treemap';
import HeatmapModule from 'highcharts/modules/heatmap';
import { createPortal } from 'react-dom';
import { Loader2, Maximize2, X, RefreshCw, AlertTriangle, Minimize2, BarChart2, PieChart } from 'lucide-react';
import { fetchTopCoins } from '../services/api';
import { DashboardItem, ApiCoin } from '../../../types';

// Initialize Highcharts modules
try {
  if (typeof Highcharts === 'object') {
    (TreemapModule as any)(Highcharts);
    (HeatmapModule as any)(Highcharts);
  }
} catch (e) {
  console.error("Highcharts init error", e);
}

interface Props {
  item?: DashboardItem;
  title?: string;
  onClose?: () => void;
  language?: string;
}

const HeatmapWidget: React.FC<Props> = ({ item, title = "Crypto Heatmap", onClose }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<Highcharts.Chart | null>(null);
  
  const [coins, setCoins] = useState<ApiCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState<'mcap' | 'vol'>('mcap');
  
  // Initialize fullscreen state based on prop
  const [isFullscreen, setIsFullscreen] = useState(item?.isMaximized || false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load Data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchTopCoins({ force: true });
        if (data && data.length > 0) {
          setCoins(data);
        } else {
          setError('No data available.');
        }
      } catch (e) {
        console.error(e);
        setError('Failed to load market data.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshKey]);

  // Process Data for Highcharts (Flat List)
  const chartData = useMemo(() => {
    if (!coins.length) return [];

    return coins
      .filter(c => c && c.symbol) // Filter invalid entries
      .map(coin => {
        const change = coin.price_change_percentage_24h || 0;
        const val = metric === 'mcap' ? (coin.market_cap || 0) : (coin.total_volume || 0);
        
        return {
            id: coin.id,
            name: (coin.symbol || '').toUpperCase(),
            value: val,       
            colorValue: change,
            custom: {
                fullName: coin.name || '',
                price: coin.current_price || 0,
                performance: (change < 0 ? '' : '+') + change.toFixed(2) + '%'
            }
        };
      })
      .filter(p => p.value > 0); // Remove zero value items
  }, [coins, metric]);

  // Init/Update Chart
  useEffect(() => {
    if (!chartContainerRef.current || loading || chartData.length === 0) return;

    const isDark = document.documentElement.classList.contains('dark');
    const bgColor = isDark ? '#1a1c1e' : '#ffffff';
    const borderColor = isDark ? '#2f3032' : '#e2e8f0';

    const options: Highcharts.Options = {
        chart: {
            backgroundColor: bgColor,
            style: { fontFamily: 'Inter, sans-serif' },
            margin: [0, 0, 0, 0],
            spacing: [0, 0, 0, 0],
            height: isFullscreen ? '100%' : '100%'
        },
        title: { text: undefined },
        credits: { enabled: false },
        exporting: { enabled: false },
        series: [{
            type: 'treemap',
            layoutAlgorithm: 'squarified',
            allowDrillToNode: false,
            alternateStartingDirection: true,
            levelIsConstant: false,
            dataLabels: {
                enabled: true,
                style: {
                    textOutline: 'none',
                    fontWeight: 'bold',
                    fontSize: '14px'
                },
                // Format: SYMBOL <br> +2.5%
                formatter: function() {
                    const point = this.point as any;
                    const fontSize = Math.min(24, Math.max(10, Math.sqrt(point.shapeArgs.width * point.shapeArgs.height) / 5));
                    if (point.shapeArgs.width < 30 || point.shapeArgs.height < 30) return ''; // Hide if too small
                    
                    return `<span style="font-size: ${fontSize}px; color: white;">${point.name}</span><br/>` +
                           `<span style="font-size: ${fontSize * 0.7}px; font-weight: normal; opacity: 0.9; color: white;">${point.custom.performance}</span>`;
                }
            },
            levels: [{
                level: 1,
                borderWidth: 1,
                borderColor: borderColor,
                dataLabels: {
                    enabled: true,
                    align: 'center',
                    verticalAlign: 'middle',
                    style: { color: '#FFFFFF' }
                }
            }],
            data: chartData
        } as any],
        tooltip: {
            useHTML: true,
            followPointer: true,
            backgroundColor: 'rgba(20, 20, 20, 0.95)',
            borderColor: '#dd9933',
            borderRadius: 8,
            shadow: true,
            padding: 12,
            style: { color: '#fff' },
            headerFormat: '<span style="font-size: 14px; font-weight: bold; color: #dd9933">{point.key}</span><br/>',
            pointFormat: 
                '<div style="margin-top: 4px">' +
                '<span style="color: #9ca3af">Preço:</span> <b>${point.custom.price}</b><br/>' +
                `<span style="color: #9ca3af">${metric === 'mcap' ? 'Market Cap' : 'Volume'}:</span> <b>\${point.value:,.0f}</b><br/>` +
                '<span style="color: #9ca3af">Variação 24h:</span> <b style="color:{point.color}">{point.custom.performance}</b>' +
                '</div>'
        },
        colorAxis: {
            minColor: '#ef4444', // Red
            maxColor: '#22c55e', // Green
            stops: [
                [0, '#ef4444'],
                [0.5, '#2f3032'], // Dark Grey (Neutral)
                [1, '#22c55e']
            ],
            min: -8, 
            max: 8,  
        },
        plotOptions: {
            treemap: {
                animation: true,
                states: { hover: { brightness: 0.1 } }
            }
        }
    };

    if (chartInstanceRef.current) {
        chartInstanceRef.current.update(options);
        setTimeout(() => chartInstanceRef.current?.reflow(), 50);
    } else {
        chartInstanceRef.current = Highcharts.chart(chartContainerRef.current, options);
    }

  }, [chartData, isFullscreen, loading, metric]);

  // Handle Resize Events
  useEffect(() => {
      const handleResize = () => {
          if (chartInstanceRef.current) {
              chartInstanceRef.current.reflow();
          }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Force reflow when fullscreen toggles
  useEffect(() => {
      setTimeout(() => {
          if (chartInstanceRef.current) {
              chartInstanceRef.current.reflow();
          }
      }, 100);
  }, [isFullscreen]);

  const handleToggleFullscreen = () => {
      if (item?.isMaximized && onClose) {
          onClose(); // Go back if in dedicated page mode
      } else {
          setIsFullscreen(!isFullscreen);
      }
  };

  // Widget Content
  const WidgetContent = (
    <div className={`relative w-full h-full flex flex-col ${isFullscreen ? 'bg-[#1a1c1e]' : 'bg-transparent'} overflow-hidden`}>
        {/* Header Control Bar */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-800 bg-[#1a1c1e] shrink-0 z-10">
            <div className="flex items-center gap-3">
                <span className="text-sm font-black text-white uppercase tracking-wider">{title}</span>
                {!loading && !error && (
                    <div className="flex bg-black/20 p-0.5 rounded-lg border border-gray-700">
                        <button 
                            onClick={() => setMetric('mcap')} 
                            className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md flex items-center gap-1 transition-all ${metric === 'mcap' ? 'bg-[#dd9933] text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}
                        >
                            <PieChart size={12} /> Market Cap
                        </button>
                        <button 
                            onClick={() => setMetric('vol')} 
                            className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md flex items-center gap-1 transition-all ${metric === 'vol' ? 'bg-[#dd9933] text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}
                        >
                            <BarChart2 size={12} /> Volume 24h
                        </button>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 mr-4 hidden sm:flex">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    <span className="text-[10px] text-gray-400 mr-2 font-mono">-8%</span>
                    <span className="w-2 h-2 bg-[#2f3032] rounded-full"></span>
                    <span className="text-[10px] text-gray-400 mr-2 font-mono">0%</span>
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="text-[10px] text-gray-400 font-mono">+8%</span>
                </div>

                <button 
                    onClick={() => setRefreshKey(k => k + 1)} 
                    className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
                    title="Recarregar"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
                <button 
                    onClick={handleToggleFullscreen} 
                    className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
                    title={isFullscreen ? "Fechar / Minimizar" : "Tela Cheia"}
                >
                    {isFullscreen ? <X size={18} /> : <Maximize2 size={16} />}
                </button>
            </div>
        </div>

        {/* Chart Area */}
        <div className="flex-1 relative w-full h-full min-h-0 bg-[#1a1c1e]">
            {loading && chartData.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-[#1a1c1e]">
                    <div className="flex flex-col items-center gap-3 text-gray-500">
                        <Loader2 className="animate-spin text-[#dd9933]" size={40} />
                        <span className="text-xs font-bold uppercase tracking-widest animate-pulse">Carregando Mercado...</span>
                    </div>
                </div>
            ) : error ? (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-[#1a1c1e]">
                    <div className="flex flex-col items-center gap-3 text-red-500">
                        <AlertTriangle size={40} />
                        <span className="text-sm font-bold uppercase tracking-widest">{error}</span>
                        <button onClick={() => setRefreshKey(k => k + 1)} className="mt-2 px-4 py-2 bg-red-900/20 border border-red-900/50 rounded text-xs font-bold hover:bg-red-900/40 uppercase">Tentar Novamente</button>
                    </div>
                </div>
            ) : null}
            
            <div ref={chartContainerRef} className="w-full h-full" />
        </div>
    </div>
  );

  // Render via Portal if fullscreen to ensure top layer
  if (isFullscreen) {
    return createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-[#1a1c1e] animate-in fade-in zoom-in-95 duration-200">
            {WidgetContent}
        </div>,
        document.body
    );
  }

  // Normal render inside grid/card
  return (
    <div className="w-full h-full overflow-hidden rounded-xl border border-gray-800 shadow-xl bg-[#1a1c1e]">
        {WidgetContent}
    </div>
  );
};

export default HeatmapWidget;
