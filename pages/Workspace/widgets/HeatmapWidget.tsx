
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Highcharts from 'highcharts';
import TreemapModule from 'highcharts/modules/treemap';
import { DashboardItem, Language, ApiCoin } from '../../../types';
import { fetchTopCoins } from '../services/api';
import { ENDPOINTS, ENDPOINT_FALLBACKS } from '../../../services/endpoints';
import { Loader2, LayoutGrid, Layers, ArrowLeft } from 'lucide-react';

// Init Highcharts Module
if (typeof Highcharts === 'object') {
    TreemapModule(Highcharts as any);
}

interface HeatmapWidgetProps {
  item: DashboardItem;
  language?: Language;
}

type ViewMode = 'global' | 'categories' | 'drilldown';

const HeatmapWidget: React.FC<HeatmapWidgetProps> = ({ item, language = 'pt' }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<Highcharts.Chart | null>(null);

  const [mode, setMode] = useState<ViewMode>('global');
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<{id: string, name: string} | null>(null);

  // Data State
  const [coins, setCoins] = useState<ApiCoin[]>([]);
  const [taxonomy, setTaxonomy] = useState<any[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string[]>>({});

  // 1. Fetch Data (Similar to MarketCapTable logic)
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Parallel fetch for speed
        const [coinsData, taxonomyData, mapData] = await Promise.all([
            fetchTopCoins({ force: true }),
            fetch(ENDPOINTS.taxonomy).then(r => r.json()).catch(() => []),
            fetch(ENDPOINT_FALLBACKS.CAT_MAP_ANY[0]).then(r => r.json()).catch(() => fetch(ENDPOINT_FALLBACKS.CAT_MAP_ANY[1]).then(r => r.json()).catch(() => ({})))
        ]);

        if (coinsData) setCoins(coinsData);
        
        // Normalize Taxonomy
        let masters = [];
        if (Array.isArray(taxonomyData)) masters = taxonomyData;
        else if (taxonomyData?.masters) masters = taxonomyData.masters;
        setTaxonomy(masters);

        // Normalize Map
        let cMap = {};
        if (mapData && typeof mapData === 'object') {
            cMap = mapData.categories || mapData;
        }
        setCategoryMap(cMap as Record<string, string[]>);

      } catch (error) {
        console.error("Heatmap Data Error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // 2. Process Data for Chart
  const chartData = useMemo(() => {
    if (!coins.length) return [];

    const formatPoint = (coin: ApiCoin) => ({
        id: coin.id,
        name: coin.symbol.toUpperCase(),
        fullName: coin.name,
        value: coin.market_cap || 0,
        colorValue: coin.price_change_percentage_24h || 0,
        formattedPrice: coin.current_price,
        formattedChange: coin.price_change_percentage_24h,
    });

    // MODE: GLOBAL (Top 100 Coins)
    if (mode === 'global') {
        return coins
            .slice(0, 100) // Limit to top 100 for performance
            .map(formatPoint);
    }

    // MODE: CATEGORIES (Aggregated)
    if (mode === 'categories') {
        return taxonomy.map((cat: any) => {
            const catId = cat.id;
            const catName = cat.name || cat.title || catId;
            
            // Gather all coin IDs in this master category + subcategories
            const allCatIds = new Set<string>();
            if (Array.isArray(cat.categoryIds)) cat.categoryIds.forEach((id: any) => allCatIds.add(String(id)));
            if (Array.isArray(cat.children)) {
                cat.children.forEach((child: any) => {
                    const cIds = child.categoryIds || child.categories;
                    if(Array.isArray(cIds)) cIds.forEach((id:any) => allCatIds.add(String(id)));
                });
            }

            // Find coins
            const coinIds = new Set<string>();
            allCatIds.forEach(cid => {
                const mapped = categoryMap[cid];
                if (Array.isArray(mapped)) mapped.forEach(mid => coinIds.add(String(mid)));
            });

            const categoryCoins = coins.filter(c => coinIds.has(String(c.id)));
            
            if (categoryCoins.length === 0) return null;

            // Aggregations
            const totalMcap = categoryCoins.reduce((acc, c) => acc + (c.market_cap || 0), 0);
            
            // Weighted Performance
            let weightedSum = 0;
            let weightTotal = 0;
            categoryCoins.forEach(c => {
                const w = c.market_cap || 0;
                weightedSum += (c.price_change_percentage_24h || 0) * w;
                weightTotal += w;
            });
            const avgChange = weightTotal > 0 ? weightedSum / weightTotal : 0;

            return {
                id: catId,
                name: catName,
                value: totalMcap,
                colorValue: avgChange,
                isCategory: true,
                coinsCount: categoryCoins.length
            };
        }).filter(Boolean);
    }

    // MODE: DRILLDOWN (Specific Category)
    if (mode === 'drilldown' && selectedCategory) {
        // Logic similar to aggregation to find coins, but return individual coin points
        const cat = taxonomy.find(c => c.id === selectedCategory.id);
        if (!cat) return [];

        const allCatIds = new Set<string>();
        if (Array.isArray(cat.categoryIds)) cat.categoryIds.forEach((id: any) => allCatIds.add(String(id)));
        if (Array.isArray(cat.children)) {
            cat.children.forEach((child: any) => {
                const cIds = child.categoryIds || child.categories;
                if(Array.isArray(cIds)) cIds.forEach((id:any) => allCatIds.add(String(id)));
            });
        }

        const coinIds = new Set<string>();
        allCatIds.forEach(cid => {
            const mapped = categoryMap[cid];
            if (Array.isArray(mapped)) mapped.forEach(mid => coinIds.add(String(mid)));
        });

        return coins
            .filter(c => coinIds.has(String(c.id)))
            .sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0))
            .slice(0, 50) // Limit drilldown to top 50 of category
            .map(formatPoint);
    }

    return [];
  }, [coins, taxonomy, categoryMap, mode, selectedCategory]);

  // 3. Render Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const isDark = document.documentElement.classList.contains('dark');
    const bgColor = 'transparent';
    const textColor = isDark ? '#ffffff' : '#000000';

    const options: Highcharts.Options = {
        chart: {
            backgroundColor: bgColor,
            style: { fontFamily: 'Inter, sans-serif' },
            height: item.isMaximized ? '100%' : '300px'
        },
        title: { text: '' },
        credits: { enabled: false },
        exporting: { enabled: false },
        tooltip: {
            useHTML: true,
            backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)',
            borderColor: isDark ? '#333' : '#ccc',
            style: { color: textColor },
            formatter: function(this: any) {
                const p = this.point as any;
                const change = p.colorValue?.toFixed(2);
                const color = (p.colorValue || 0) >= 0 ? '#22c55e' : '#ef4444';
                
                if (p.isCategory) {
                    return `
                        <div style="padding:5px; text-align:center">
                            <strong style="font-size:14px">${p.name}</strong><br/>
                            <span style="font-size:11px; opacity:0.8">${p.coinsCount} Coins</span><br/>
                            <span style="font-weight:bold; color:${color}">${change > 0 ? '+' : ''}${change}%</span>
                        </div>
                    `;
                }

                return `
                    <div style="padding:5px; text-align:center">
                        <strong style="font-size:14px">${p.fullName} (${p.name})</strong><br/>
                        <span style="font-size:12px">Price: $${p.formattedPrice?.toLocaleString()}</span><br/>
                        <span style="font-size:12px; font-weight:bold; color:${color}">24h: ${change > 0 ? '+' : ''}${change}%</span><br/>
                        <span style="font-size:10px; opacity:0.7">Mkt Cap: $${(p.value/1e9).toFixed(2)}B</span>
                    </div>
                `;
            }
        },
        colorAxis: {
            min: -10,
            max: 10,
            stops: [
                [0, '#ef4444'], // Red
                [0.5, '#1f2937'], // Neutral Dark (or gray)
                [1, '#22c55e']  // Green
            ]
        },
        series: [{
            type: 'treemap',
            layoutAlgorithm: 'squarified',
            allowDrillToNode: true,
            animationLimit: 1000,
            dataLabels: {
                enabled: true,
                style: {
                    textOutline: 'none',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 'bold'
                },
                formatter: function(this: any) {
                    const p = this.point as any;
                    if ((this.point.shapeArgs?.width || 0) < 40 || (this.point.shapeArgs?.height || 0) < 30) return null;
                    const change = p.colorValue?.toFixed(2);
                    return `<div>${p.name}</div><div style="font-size:11px; font-weight:normal; opacity:0.9">${change > 0 ? '+' : ''}${change}%</div>`;
                }
            },
            levels: [{
                level: 1,
                dataLabels: {
                    enabled: true
                },
                borderWidth: 2,
                borderColor: isDark ? '#000000' : '#ffffff'
            }],
            data: chartData,
            events: {
                click: (event) => {
                    const p = event.point as any;
                    if ((mode as string) === 'categories' && p.isCategory) {
                        setSelectedCategory({ id: p.id, name: p.name });
                        setMode('drilldown');
                    }
                }
            }
        } as any]
    };

    if (chartInstanceRef.current) {
        chartInstanceRef.current.update(options);
    } else {
        chartInstanceRef.current = Highcharts.chart(chartContainerRef.current, options);
    }

  }, [chartData, item.isMaximized, mode]);

  const handleBack = () => {
      setMode('categories');
      setSelectedCategory(null);
  };

  if (loading && !coins.length) {
      return <div className="flex items-center justify-center h-full text-gray-500"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="w-full h-full flex flex-col relative bg-white dark:bg-[#2f3032] overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-2 border-b border-gray-100 dark:border-slate-700/50 bg-gray-50 dark:bg-black/20 shrink-0 z-10">
            <div className="flex items-center gap-2">
                {mode === 'drilldown' ? (
                    <button onClick={handleBack} className="flex items-center gap-1 text-xs font-bold bg-white dark:bg-[#1a1c1e] px-2 py-1 rounded shadow-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <ArrowLeft size={12} /> Voltar
                    </button>
                ) : (
                    <div className="flex bg-white dark:bg-[#1a1c1e] p-0.5 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm">
                        <button 
                            onClick={() => setMode('global')}
                            className={`flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-md transition-colors ${mode === 'global' ? 'bg-[#dd9933] text-black' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                        >
                            <LayoutGrid size={12} /> Geral
                        </button>
                        <button 
                            onClick={() => setMode('categories')}
                            className={`flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-md transition-colors ${mode === 'categories' || mode === 'drilldown' ? 'bg-[#dd9933] text-black' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                        >
                            <Layers size={12} /> Setores
                        </button>
                    </div>
                )}
            </div>
            
            {mode === 'drilldown' && selectedCategory && (
                <div className="text-xs font-black text-gray-700 dark:text-white uppercase tracking-wider">
                    {selectedCategory.name}
                </div>
            )}
        </div>

        {/* Chart Area */}
        <div className="flex-1 w-full min-h-0 relative">
            <div ref={chartContainerRef} className="absolute inset-0" />
        </div>
    </div>
  );
};

export default HeatmapWidget;
