
import React, { useEffect, useRef, useState, useMemo } from 'react';
import Highcharts from 'highcharts';
import TreemapModule from 'highcharts/modules/treemap';
import HeatmapModule from 'highcharts/modules/heatmap';
import { createPortal } from 'react-dom';
import { Loader2, Maximize2, X, RefreshCw, AlertTriangle } from 'lucide-react';
import { fetchHeatmapCategories, HeatmapCategory } from '../services/api';
import { DashboardItem } from '../../../types';

// Initialize Highcharts modules
try {
  if (typeof Highcharts === 'object') {
    (TreemapModule as any)(Highcharts);
    (HeatmapModule as any)(Highcharts);
  }
} catch (e) {
  console.error("Highcharts init error", e);
}

// Extend Highcharts for the custom font size logic provided in the prompt
(function (H: any) {
    H.addEvent(H.Series, 'drawDataLabels', function (this: any) {
        if (this.type === 'treemap') {
            this.points.forEach((point: any) => {
                // Color the level 2 headers with the combined performance of its children
                if (point.node.level === 2 && Number.isFinite(point.value) && point.node.children.length > 0) {
                    const previousValue = point.node.children.reduce(
                        (acc: number, child: any) => {
                            const val = child.point.value || 0;
                            const perf = child.point.colorValue || 0; // colorValue holds percentage
                            // Reverse calculate "previous" value based on percentage change
                            // New = Old * (1 + pct/100) => Old = New / (1 + pct/100)
                            const old = val / (1 + perf / 100);
                            return acc + old;
                        },
                        0
                    );

                    // Percentage change from previous value to point.value
                    const perf = previousValue !== 0 ? 100 * (point.value - previousValue) / previousValue : 0;

                    point.custom = point.custom || {};
                    point.custom.performance = (perf < 0 ? '' : '+') + perf.toFixed(2) + '%';

                    if (point.dlOptions && this.colorAxis) {
                        point.dlOptions.backgroundColor = this.colorAxis.toColor(perf);
                    }
                }

                // Set font size based on area of the point for Level 3 (Leaves/Coins)
                if (point.node.level === 3 && point.shapeArgs) {
                    const area = point.shapeArgs.width * point.shapeArgs.height;
                    const fontSize = Math.min(32, 7 + Math.round(area * 0.0008));
                    
                    if (point.dataLabel && point.dataLabel.css) {
                        point.dataLabel.css({
                            fontSize: `${fontSize}px`
                        });
                    }
                }
            });
        }
    });
}(Highcharts));

interface Props {
  item?: DashboardItem;
  title?: string;
  // Backward compatibility props (optional)
  data?: any[]; 
  onClose?: () => void;
}

const HeatmapWidget: React.FC<Props> = ({ item, title = "Crypto Heatmap" }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<Highcharts.Chart | null>(null);
  
  const [categories, setCategories] = useState<HeatmapCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load Data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchHeatmapCategories();
        if (data && data.length > 0) {
          setCategories(data);
        } else {
          setError('No category data available.');
        }
      } catch (e) {
        console.error(e);
        setError('Failed to load heatmap data.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshKey]);

  // Process Data for Highcharts
  const chartData = useMemo(() => {
    if (!categories.length) return [];

    const data: any[] = [];
    
    // Level 1: Root Categories
    categories.forEach(cat => {
        // Only include categories that have coins
        if (cat.coins && cat.coins.length > 0) {
            data.push({
                id: cat.id,
                name: cat.name,
                color: '#252931' // Dark background for container
            });

            // Level 2: Coins
            cat.coins.forEach((coin: any) => {
                const change = coin.price_change_percentage_24h || 0;
                const mcap = coin.market_cap || 0;
                
                data.push({
                    id: `${cat.id}_${coin.id}`,
                    name: coin.symbol.toUpperCase(),
                    parent: cat.id,
                    value: mcap,
                    colorValue: change, // Used by ColorAxis
                    custom: {
                        fullName: coin.name,
                        performance: (change < 0 ? '' : '+') + change.toFixed(2) + '%'
                    }
                });
            });
        }
    });

    return data;
  }, [categories]);

  // Init/Update Chart
  useEffect(() => {
    if (!chartContainerRef.current || loading || chartData.length === 0) return;

    const options: Highcharts.Options = {
        chart: {
            backgroundColor: '#1a1c1e',
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
            name: 'Crypto Market',
            layoutAlgorithm: 'squarified',
            allowDrillToNode: true,
            animationLimit: 1000,
            borderColor: '#1a1c1e',
            borderWidth: 1,
            data: chartData,
            dataLabels: {
                enabled: false,
                allowOverlap: true,
                style: { textOutline: 'none' }
            },
            levels: [
                {
                    level: 1,
                    dataLabels: {
                        enabled: true,
                        align: 'left',
                        verticalAlign: 'top',
                        style: {
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: '#9ca3af', // Gray-400
                            textTransform: 'uppercase'
                        },
                        padding: 5
                    },
                    borderWidth: 3,
                    borderColor: '#1a1c1e'
                },
                {
                    level: 2,
                    dataLabels: {
                        enabled: true,
                        align: 'center',
                        verticalAlign: 'middle',
                        format: '<span style="font-weight:900; color: white;">{point.name}</span><br><span style="font-size: 0.8em; font-weight:normal; opacity:0.9;">{point.custom.performance}</span>',
                        style: {
                            color: 'white',
                            textOutline: 'none'
                        },
                        filter: {
                            property: 'value',
                            operator: '>',
                            value: 0
                        }
                    }
                }
            ],
            // Breadcrumbs style
            breadcrumbs: {
                buttonTheme: {
                    style: { color: '#9ca3af' },
                    states: {
                        hover: { fill: '#333', style: { color: '#fff' } },
                        select: { fill: '#333', style: { color: '#fff' } }
                    }
                }
            }
        } as any], // Cast to any because Highcharts types can be strict with custom levels
        tooltip: {
            useHTML: true,
            followPointer: true,
            backgroundColor: '#232528',
            borderColor: '#374151',
            borderRadius: 8,
            style: { color: '#fff' },
            headerFormat: '<span style="font-size: 13px; font-weight: bold; color: #dd9933">{point.key}</span><br/>',
            pointFormat: 
                '<span style="color: #9ca3af">Market Cap:</span> <b>${point.value:,.0f}</b><br/>' +
                '<span style="color: #9ca3af">24h Change:</span> <b>{point.custom.performance}</b>'
        },
        colorAxis: {
            minColor: '#ef4444', // Red 500
            maxColor: '#22c55e', // Green 500
            stops: [
                [0, '#ef4444'],
                [0.5, '#374151'], // Gray 700 (Neutral)
                [1, '#22c55e']
            ],
            min: -10,
            max: 10,
            labels: {
                style: { color: '#9ca3af' },
                format: '{value}%'
            }
        },
        plotOptions: {
            treemap: {
                animation: true
            }
        }
    };

    if (chartInstanceRef.current) {
        chartInstanceRef.current.update(options);
        chartInstanceRef.current.reflow();
    } else {
        chartInstanceRef.current = Highcharts.chart(chartContainerRef.current, options);
    }

    return () => {
        // Don't destroy on every render, let ref handle it. 
        // Cleanup happens when component unmounts completely.
    };
  }, [chartData, isFullscreen, loading]);

  // Handle Resize
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

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  // Widget Content (Rendered inside normal layout or portal)
  const WidgetContent = (
    <div className={`relative w-full h-full flex flex-col ${isFullscreen ? 'bg-[#1a1c1e]' : 'bg-[#1a1c1e]'} overflow-hidden`}>
        {/* Header Bar */}
        <div className="flex justify-between items-center px-4 py-2 border-b border-gray-800 bg-[#1a1c1e] shrink-0 z-10">
            <div className="flex items-center gap-3">
                <span className="text-sm font-black text-gray-200 uppercase tracking-wider">{title}</span>
                {!loading && !error && (
                    <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">
                        {chartData.filter((d:any) => d.parent).length} Assets
                    </span>
                )}
            </div>
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setRefreshKey(k => k + 1)} 
                    className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
                    title="Reload"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
                <button 
                    onClick={toggleFullscreen} 
                    className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
                    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                    {isFullscreen ? <X size={16} /> : <Maximize2 size={16} />}
                </button>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 relative w-full h-full min-h-0">
            {loading && chartData.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-[#1a1c1e]">
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                        <Loader2 className="animate-spin text-[#dd9933]" size={32} />
                        <span className="text-xs font-bold uppercase tracking-widest">Carregando Mapa...</span>
                    </div>
                </div>
            ) : error ? (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-[#1a1c1e]">
                    <div className="flex flex-col items-center gap-2 text-red-500">
                        <AlertTriangle size={32} />
                        <span className="text-xs font-bold uppercase tracking-widest">{error}</span>
                        <button onClick={() => setRefreshKey(k => k + 1)} className="mt-2 px-3 py-1 bg-red-900/20 rounded text-xs hover:bg-red-900/40">Retry</button>
                    </div>
                </div>
            ) : null}
            
            <div ref={chartContainerRef} className="w-full h-full" />
        </div>
    </div>
  );

  if (isFullscreen) {
    return createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-[#1a1c1e] animate-in fade-in zoom-in-95 duration-200">
            {WidgetContent}
        </div>,
        document.body
    );
  }

  return (
    <div className="w-full h-full overflow-hidden rounded-xl border border-gray-800 shadow-xl">
        {WidgetContent}
    </div>
  );
};

export default HeatmapWidget;
