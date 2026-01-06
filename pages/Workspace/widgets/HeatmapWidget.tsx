
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DashboardItem, Language, ApiCoin } from '../../../types';
import { fetchTopCoins } from '../services/api';
import { ENDPOINTS, ENDPOINT_FALLBACKS } from '../../../services/endpoints';
import { Loader2, LayoutGrid, Layers, RefreshCw } from 'lucide-react';

// Use global Highcharts from index.html to avoid module linking errors
declare global {
  interface Window {
    Highcharts: any;
  }
}

interface HeatmapWidgetProps {
  item: DashboardItem;
  language?: Language;
}

type ViewMode = 'global' | 'categories';

const HeatmapWidget: React.FC<HeatmapWidgetProps> = ({ item, language = 'pt' }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);

  const [mode, setMode] = useState<ViewMode>('global');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Data State
  const [coins, setCoins] = useState<ApiCoin[]>([]);
  const [taxonomy, setTaxonomy] = useState<any[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string[]>>({});

  // --- DATA FETCHING ---
  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
        const [coinsData, taxData, mapData] = await Promise.all([
            fetchTopCoins({ force: true }),
            fetch(ENDPOINTS.taxonomy).then(r => r.json()).catch(() => []),
            fetch(ENDPOINT_FALLBACKS.CAT_MAP_ANY[0])
                .then(r => r.json())
                .catch(() => fetch(ENDPOINT_FALLBACKS.CAT_MAP_ANY[1]).then(r => r.json()).catch(() => ({})))
        ]);

        if (coinsData && coinsData.length > 0) setCoins(coinsData);
        
        let masters = [];
        if (Array.isArray(taxData)) masters = taxData;
        else if (taxData?.masters) masters = taxData.masters;
        setTaxonomy(masters);

        let cMap = {};
        if (mapData && typeof mapData === 'object') {
            cMap = mapData.categories || mapData;
        }
        setCategoryMap(cMap);

    } catch (e) {
        console.error(e);
        setErrorMsg('Erro ao carregar dados.');
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- DATA TRANSFORMATION ---
  const chartSeriesData = useMemo(() => {
    if (!coins.length) return [];

    const coinMap = new Map(coins.map(c => [String(c.id), c]));

    const formatCoinPoint = (c: ApiCoin, parentId?: string) => ({
        id: parentId ? `${c.id}_${parentId}` : c.id, // Unique ID if nested
        name: c.symbol?.toUpperCase() || c.name,
        parent: parentId,
        value: Number(c.market_cap || 0),
        colorValue: Number(c.price_change_percentage_24h || 0),
        custom: {
            fullName: c.name,
            price: c.current_price,
            change: c.price_change_percentage_24h,
            mcap: c.market_cap
        }
    });

    // 1. GLOBAL MODE (Flat)
    if (mode === 'global') {
        return coins
            .slice(0, 100)
            .map(c => formatCoinPoint(c));
    }

    // 2. CATEGORIES MODE (Hierarchical)
    if (mode === 'categories') {
        const points: any[] = [];
        const addedCoins = new Set<string>();

        // Create Category Parents
        taxonomy.forEach((cat: any) => {
            const catId = String(cat.id);
            const catName = cat.name || cat.title || catId;
            
            // Add Category Node
            points.push({
                id: catId,
                name: catName,
                color: window.Highcharts?.getOptions().colors?.[0] || '#333' // Placeholder, overwritten by colorAxis usually or series
            });

            // Find Coins in this Category
            const allCatIds = new Set<string>();
            if (Array.isArray(cat.categoryIds)) cat.categoryIds.forEach((id: any) => allCatIds.add(String(id)));
            if (Array.isArray(cat.children)) {
                cat.children.forEach((child: any) => {
                    const cIds = child.categoryIds || child.categories;
                    if(Array.isArray(cIds)) cIds.forEach((id:any) => allCatIds.add(String(id)));
                });
            }

            const catCoinsIds = new Set<string>();
            allCatIds.forEach(cid => {
                const mapped = categoryMap[cid];
                if (Array.isArray(mapped)) mapped.forEach(mid => catCoinsIds.add(String(mid)));
            });

            // Add Coin Nodes (Children)
            catCoinsIds.forEach(coinId => {
                const coin = coinMap.get(coinId);
                if (coin) {
                    points.push(formatCoinPoint(coin, catId));
                }
            });
        });

        // Filter out empty categories? (Highcharts handles empty parents automatically usually, but keeps them small)
        return points;
    }

    return [];
  }, [mode, coins, taxonomy, categoryMap]);

  // --- CHART RENDERING ---
  useEffect(() => {
    if (!chartContainerRef.current || !window.Highcharts || chartSeriesData.length === 0) return;

    const isDark = document.documentElement.classList.contains('dark');
    const bg = 'transparent';
    const text = isDark ? '#ffffff' : '#333333';

    // Levels config for hierarchy
    const levels = mode === 'categories' ? [
        {
            level: 1,
            dataLabels: {
                enabled: true,
                align: 'left',
                verticalAlign: 'top',
                style: { fontSize: '12px', fontWeight: 'bold', textOutline: 'none', color: text }
            },
            borderWidth: 3,
            borderColor: isDark ? '#0b0d10' : '#ffffff',
            levelIsConstant: false
        },
        {
            level: 2,
            dataLabels: {
                enabled: true,
                style: { fontSize: '10px', textOutline: 'none' }
            },
            borderWidth: 1,
            borderColor: isDark ? '#0b0d10' : '#ffffff',
        }
    ] : undefined;

    if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
    }

    chartInstanceRef.current = window.Highcharts.chart(chartContainerRef.current, {
        chart: {
            type: 'treemap',
            backgroundColor: bg,
            style: { fontFamily: 'Inter, sans-serif' },
            animation: false
        },
        title: { text: null },
        credits: { enabled: false },
        exporting: { enabled: false },
        tooltip: {
            useHTML: true,
            backgroundColor: isDark ? 'rgba(20, 20, 20, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: isDark ? '#333' : '#ccc',
            borderRadius: 8,
            shadow: true,
            style: { color: text },
            formatter: function (this: any) {
                const p = this.point;
                // If it's a category header
                if (!p.custom && p.node && p.node.children.length > 0) {
                    return `<b>${p.name}</b><br/>${p.node.children.length} Assets`;
                }
                // If it's a coin
                if (p.custom) {
                    const val = p.custom.change;
                    const color = val >= 0 ? '#22c55e' : '#ef4444';
                    return `
                        <div style="padding: 4px">
                            <div style="font-weight:800; font-size: 14px; margin-bottom:2px">${p.custom.fullName} (${p.name})</div>
                            <div>Price: <b>$${p.custom.price?.toLocaleString()}</b></div>
                            <div>Change: <b style="color:${color}">${val > 0 ? '+' : ''}${val?.toFixed(2)}%</b></div>
                            <div>Mkt Cap: $${(p.value/1e9).toFixed(2)}B</div>
                        </div>
                    `;
                }
                return `<b>${p.name}</b>`;
            }
        },
        colorAxis: {
            min: -10,
            max: 10,
            stops: [
                [0, '#ef4444'], // Red
                [0.5, '#1f2937'], // Neutral Dark (or Gray)
                [1, '#22c55e']  // Green
            ]
        },
        series: [{
            type: 'treemap',
            layoutAlgorithm: 'squarified',
            allowDrillToNode: true,
            alternateStartingDirection: true,
            levels: levels,
            data: chartSeriesData,
            dataLabels: {
                enabled: true,
                style: { textOutline: 'none', color: '#fff', fontWeight: 'bold', fontSize: '13px' },
                formatter: function (this: any) {
                    const p = this.point;
                    // Dont show label for categories in this formatter (handled by levels) if mode is categories
                    if (mode === 'categories' && !p.parent) return null; 
                    
                    const ch = p.custom?.change;
                    if (typeof ch !== 'number') return p.name;
                    
                    if (this.point.shapeArgs && (this.point.shapeArgs.width < 40 || this.point.shapeArgs.height < 30)) return '';

                    return `<div style="text-align:center">
                        <span style="font-size:12px">${p.name}</span><br/>
                        <span style="font-size:10px; opacity:0.8">${ch > 0 ? '+' : ''}${ch.toFixed(1)}%</span>
                    </div>`;
                },
                useHTML: true
            }
        }]
    });

  }, [chartSeriesData, mode, item.isMaximized]);

  return (
    <div className="w-full h-full flex flex-col relative bg-white dark:bg-[#1a1c1e]">
        {/* Header / Toolbar */}
        <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
                <div className="flex bg-gray-100 dark:bg-[#2f3032] p-0.5 rounded-lg border border-gray-200 dark:border-slate-700">
                    <button 
                        onClick={() => setMode('global')}
                        className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${mode === 'global' ? 'bg-[#dd9933] text-black shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        <LayoutGrid size={12} /> Geral
                    </button>
                    <button 
                        onClick={() => setMode('categories')}
                        className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${mode === 'categories' ? 'bg-[#dd9933] text-black shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        <Layers size={12} /> Setores
                    </button>
                </div>
            </div>
            
            <div className="flex items-center gap-2">
               {loading && <div className="flex items-center gap-1 text-xs text-gray-400"><Loader2 className="animate-spin" size={12}/> Loading...</div>}
               <button onClick={loadData} className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#2f3032] rounded text-gray-500"><RefreshCw size={14}/></button>
            </div>
        </div>

        {/* Chart */}
        <div className="flex-1 w-full min-h-0 relative p-1">
            <div ref={chartContainerRef} className="absolute inset-0" />
            {errorMsg && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                    <span className="text-red-400 font-bold">{errorMsg}</span>
                </div>
            )}
        </div>
    </div>
  );
};

export default HeatmapWidget;
