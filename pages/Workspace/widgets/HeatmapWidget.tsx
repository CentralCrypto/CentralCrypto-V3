import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Highcharts from 'highcharts';
import TreemapModule from 'highcharts/modules/treemap';
import ExportingModule from 'highcharts/modules/exporting';
import AccessibilityModule from 'highcharts/modules/accessibility';
import { DashboardItem, Language } from '../../../types';
import { httpGetJson } from '../../../services/http';
import { getCacheckoUrl } from '../../../services/endpoints';

// =============================
// ROUTES
// =============================
const COINS_URLS = [
  '/cachecko/cachecko_lite.json',
  '/cachecko/cachecko.json'
];

const CATEGORIES_URLS = [
  '/cachecko/categories/taxonomy-master.json',
  '/cachecko/taxonomy-master.json'
];

const CATEGORY_COIN_MAP_URLS = [
  '/cachecko/categories/category_coins_map.json',
  '/cachecko/category-coin-map.json'
];

// =============================
// TYPES
// =============================
type Coin = {
  id: string;
  symbol?: string;
  name?: string;
  image?: string;
  market_cap?: number;
  price_change_percentage_24h?: number;
};

type Category = {
  id: string;
  name: string;
  categoryIds?: string[]; // IDs das subcategorias (ou dele mesmo)
  children?: any[]; // Estrutura aninhada da taxonomia
};

type CategoryCoinMap = Record<string, string[]>;

type HeatmapView =
  | { mode: 'market' }
  | { mode: 'categories' }
  | { mode: 'categoryCoins'; masterId: string; categoryName: string };

type TreemapPoint = {
  id: string;
  name: string;
  value: number; // Market Cap (Weight)
  colorValue: number; // Performance (Color)
  custom?: {
    fullName?: string;
    logo?: string;
    change24h?: number;
    marketCap?: number;
    coinsCount?: number;
  };
};

// =============================
// HIGHCHARTS INIT
// =============================
let HC_INITED = false;
function initHighchartsOnce() {
  if (HC_INITED) return;
  HC_INITED = true;

  (TreemapModule as any)(Highcharts);
  (ExportingModule as any)(Highcharts);
  (AccessibilityModule as any)(Highcharts);

  Highcharts.setOptions({
    chart: {
      style: { fontFamily: 'Inter, sans-serif' }
    }
  });
}

// =============================
// HELPERS
// =============================
function withCb(url: string) {
  const salt = Math.floor(Date.now() / 60000);
  return url.includes('?') ? `${url}&_cb=${salt}` : `${url}?_cb=${salt}`;
}

async function httpGetJsonRobusto<T>(path: string): Promise<T> {
  const finalUrl = withCb(getCacheckoUrl(path));
  const { data } = await httpGetJson(finalUrl, { timeoutMs: 12000, retries: 2 });
  return data as T;
}

async function fetchFirstJson<T>(paths: string[], label: string): Promise<T> {
  let lastErr: any = null;
  for (const p of paths) {
    try {
      return await httpGetJsonRobusto<T>(p);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Falha ao carregar ${label}.`);
}

function formatPct(v: number) {
  const s = Number.isFinite(v) ? v : 0;
  const sign = s > 0 ? '+' : '';
  return `${sign}${s.toFixed(2)}%`;
}

function formatMc(mc: number) {
  const n = Number.isFinite(mc) ? mc : 0;
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return `${Math.round(n)}`;
}

function safeUpper(s?: string) {
  return (s || '').toUpperCase();
}

function dedupCoinsById(coins: Coin[]) {
  const map = new Map<string, Coin>();
  for (const c of coins) {
    if (!c?.id) continue;
    const prev = map.get(c.id);
    if (!prev) map.set(c.id, c);
    else {
      if ((Number(c.market_cap) || 0) > (Number(prev.market_cap) || 0)) map.set(c.id, c);
    }
  }
  return Array.from(map.values());
}

// =============================
// LOGIC: BUILD POINTS
// =============================

// 1. Heatmap Global (Moedas)
function buildMarketMonitorPoints(coins: Coin[], limit = 300): TreemapPoint[] {
  const arr = dedupCoinsById(coins)
    .filter(c => c && c.id && (c.market_cap || 0) > 0)
    .sort((a, b) => Number(b.market_cap || 0) - Number(a.market_cap || 0))
    .slice(0, limit);

  return arr.map(c => ({
    id: c.id,
    name: safeUpper(c.symbol) || safeUpper(c.name) || c.id,
    value: Number(c.market_cap || 1),
    colorValue: Number(c.price_change_percentage_24h ?? 0),
    custom: {
      fullName: c.name || c.id,
      logo: c.image,
      change24h: Number(c.price_change_percentage_24h ?? 0),
      marketCap: Number(c.market_cap || 0)
    }
  }));
}

// 2. Heatmap Categorias (Agregado)
function buildCategoryPoints(
  categories: Category[],
  categoryCoinMap: CategoryCoinMap,
  coinById: Map<string, Coin>
): TreemapPoint[] {
  
  const points: TreemapPoint[] = [];

  categories.forEach(cat => {
    // Coleta todos os sub-IDs da categoria e seus filhos
    const allCatIds = new Set<string>();
    
    // IDs diretos
    if (Array.isArray(cat.categoryIds)) cat.categoryIds.forEach(id => allCatIds.add(String(id)));
    
    // IDs dos filhos (subcategorias)
    if (Array.isArray(cat.children)) {
        cat.children.forEach(child => {
             const cIds = child.categoryIds || child.categories;
             if(Array.isArray(cIds)) cIds.forEach((id:any) => allCatIds.add(String(id)));
        });
    }

    // Coleta Moedas Únicas
    const coinIds = new Set<string>();
    allCatIds.forEach(catId => {
        // map pode vir como { categories: { ... } } ou direto. Ajustamos no fetch, mas por segurança:
        const mapped = categoryCoinMap[catId];
        if (Array.isArray(mapped)) {
            mapped.forEach(cid => coinIds.add(String(cid)));
        }
    });

    const members = Array.from(coinIds)
        .map(id => coinById.get(id))
        .filter((c): c is Coin => !!c && (c.market_cap || 0) > 0);

    if (members.length === 0) return;

    // Estatísticas Ponderadas
    const totalMc = members.reduce((acc, c) => acc + (c.market_cap || 0), 0);
    
    // Performance Ponderada pelo Market Cap
    let weightedSum = 0;
    members.forEach(c => {
        weightedSum += (c.market_cap || 0) * (c.price_change_percentage_24h || 0);
    });
    const weightedPerf = totalMc > 0 ? weightedSum / totalMc : 0;

    points.push({
      id: cat.id,
      name: cat.name,
      value: totalMc,
      colorValue: weightedPerf,
      custom: {
        fullName: cat.name,
        change24h: weightedPerf,
        marketCap: totalMc,
        coinsCount: members.length
      }
    });
  });

  // Ordena por tamanho para melhor layout
  return points.sort((a, b) => b.value - a.value);
}

// 3. Heatmap Moedas de uma Categoria Específica
function buildCategoryCoinsPoints(
  masterId: string,
  categories: Category[],
  categoryCoinMap: CategoryCoinMap,
  coinById: Map<string, Coin>,
  limit = 200
): TreemapPoint[] {
  
  const cat = categories.find(c => c.id === masterId);
  if (!cat) return [];

  // Mesma lógica de agregação de moedas
  const allCatIds = new Set<string>();
  if (Array.isArray(cat.categoryIds)) cat.categoryIds.forEach(id => allCatIds.add(String(id)));
  if (Array.isArray(cat.children)) {
      cat.children.forEach(child => {
            const cIds = child.categoryIds || child.categories;
            if(Array.isArray(cIds)) cIds.forEach((id:any) => allCatIds.add(String(id)));
      });
  }

  const coinIds = new Set<string>();
  allCatIds.forEach(catId => {
      const mapped = categoryCoinMap[catId];
      if (Array.isArray(mapped)) mapped.forEach(cid => coinIds.add(String(cid)));
  });

  const members = Array.from(coinIds)
      .map(id => coinById.get(id))
      .filter((c): c is Coin => !!c && (c.market_cap || 0) > 0)
      .sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0))
      .slice(0, limit);

  return members.map(c => ({
    id: c.id,
    name: safeUpper(c.symbol) || safeUpper(c.name) || c.id,
    value: Number(c.market_cap || 1),
    colorValue: Number(c.price_change_percentage_24h ?? 0),
    custom: {
      fullName: c.name || c.id,
      logo: c.image,
      change24h: Number(c.price_change_percentage_24h ?? 0),
      marketCap: Number(c.market_cap || 0)
    }
  }));
}

// =============================
// CHART COMPONENT
// =============================
function TreemapChart({
  view,
  coins,
  categories,
  categoryCoinMap,
  onSelectCategory
}: {
  view: HeatmapView;
  coins: Coin[];
  categories: Category[];
  categoryCoinMap: CategoryCoinMap;
  onSelectCategory: (id: string, name: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<Highcharts.Chart | null>(null);

  const coinById = useMemo(() => {
    const m = new Map<string, Coin>();
    for (const c of coins) if (c?.id) m.set(c.id, c);
    return m;
  }, [coins]);

  const points: TreemapPoint[] = useMemo(() => {
    if (view.mode === 'market') return buildMarketMonitorPoints(coins);
    if (view.mode === 'categories') return buildCategoryPoints(categories, categoryCoinMap, coinById);
    // categoryCoins
    return buildCategoryCoinsPoints(view.masterId, categories, categoryCoinMap, coinById);
  }, [view, coins, categories, categoryCoinMap, coinById]);

  const titleText = useMemo(() => {
    if (view.mode === 'market') return 'Market Monitor (Todas)';
    if (view.mode === 'categories') return 'Heatmap de Setores (Categorias)';
    return `Setor: ${view.categoryName}`;
  }, [view]);

  useEffect(() => {
    initHighchartsOnce();
    if (!containerRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const chart = Highcharts.chart(containerRef.current, {
      chart: {
        backgroundColor: '#0b0d10',
        spacing: [12, 12, 12, 12],
        animation: false // Disable intro animation for snappiness
      },
      title: {
        text: titleText,
        align: 'left',
        style: { color: '#fff', fontSize: '16px', fontWeight: '700' }
      },
      subtitle: {
        text: view.mode === 'categories' 
            ? 'Clique em um setor para ver os ativos.' 
            : 'Tamanho = Market Cap | Cor = Variação 24h',
        align: 'left',
        style: { color: 'rgba(255,255,255,0.5)', fontSize: '12px' }
      },
      credits: { enabled: false },
      exporting: { enabled: false },
      tooltip: {
        useHTML: true,
        outside: true,
        backgroundColor: 'rgba(15,18,22,0.95)',
        borderColor: '#333',
        borderRadius: 8,
        shadow: true,
        style: { color: '#fff', fontSize: '12px' },
        formatter: function () {
          const p: any = this.point;
          const full = p?.custom?.fullName || p.name;
          const ch = Number(p?.custom?.change24h ?? p.colorValue ?? 0);
          const mc = Number(p?.custom?.marketCap ?? p.value ?? 0);
          const count = p?.custom?.coinsCount;

          return `
            <div style="padding: 4px">
              <div style="font-weight:800; font-size: 14px; margin-bottom:4px; color: #fff;">${full}</div>
              ${count ? `<div style="margin-bottom:4px; color:#aaa;">${count} Moedas</div>` : ''}
              <div style="margin-bottom:2px"><span style="color:#aaa">Var 24h:</span> <b style="color:${ch >= 0 ? '#4ade80' : '#f87171'}">${formatPct(ch)}</b></div>
              <div><span style="color:#aaa">Mkt Cap:</span> <b style="color:#fff">$${formatMc(mc)}</b></div>
            </div>
          `;
        }
      },
      colorAxis: {
        min: -15,
        max: 15,
        stops: [
          [0, '#ef4444'], // Red
          [0.5, '#1f2937'], // Dark Grey (Neutral)
          [1, '#22c55e'] // Green
        ],
        labels: {
            style: { color: '#aaa' }
        }
      },
      series: [
        {
          type: 'treemap',
          layoutAlgorithm: 'squarified',
          alternateStartingDirection: true,
          levelIsConstant: false,
          allowDrillToNode: false, // We handle drilldown manually
          borderWidth: 1,
          borderColor: '#0b0d10',
          data: points as any,
          dataLabels: {
            enabled: true,
            style: { textOutline: 'none', color: '#fff', fontWeight: 'bold', fontSize: '13px' },
            formatter: function (this: any) {
              const p: any = this.point;
              const ch = Number(p?.custom?.change24h ?? p.colorValue ?? 0);
              
              // Simplificar label se for muito pequeno
              if (this.point.shapeArgs && (this.point.shapeArgs.width < 40 || this.point.shapeArgs.height < 30)) return '';

              if (view.mode === 'categories') {
                 return `<div style="text-align:center">
                    <span style="font-size:12px">${p.name}</span><br/>
                    <span style="font-size:11px; opacity:0.8">${formatPct(ch)}</span>
                 </div>`;
              }

              return `<div style="text-align:center">
                <span style="font-size:14px">${p.name}</span><br/>
                <span style="font-size:11px; opacity:0.8">${formatPct(ch)}</span>
              </div>`;
            }
          },
          events: {
            click: function (event: any) {
                if (view.mode === 'categories') {
                    const p = (event as any).point;
                    onSelectCategory(p.id, p.name);
                }
            }
          }
        } as any
      ]
    });

    chartRef.current = chart;

    const ro = new ResizeObserver(() => chart.reflow());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [points, titleText, view, onSelectCategory]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

// =============================
// MAIN COMPONENT
// =============================
interface HeatmapWidgetProps {
  item?: DashboardItem;
  language?: Language;
}

export default function CryptoHeatmaps({ item, language }: HeatmapWidgetProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<HeatmapView>({ mode: 'market' });

  const [coins, setCoins] = useState<Coin[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryCoinMap, setCategoryCoinMap] = useState<CategoryCoinMap>({});
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([
        fetchFirstJson<any>(COINS_URLS, 'coins'),
        fetchFirstJson<any>(CATEGORIES_URLS, 'categories'),
        fetchFirstJson<any>(CATEGORY_COIN_MAP_URLS, 'catMap')
    ]).then(([rawCoins, rawCats, rawMap]) => {
        if (!active) return;

        // Parse Coins
        const cList = Array.isArray(rawCoins) ? rawCoins : (rawCoins.coins || []);
        setCoins(cList);

        // Parse Categories (Robust)
        let catsList: any[] = [];
        if (Array.isArray(rawCats)) catsList = rawCats;
        else if (rawCats && Array.isArray(rawCats.masters)) catsList = rawCats.masters;
        else if (rawCats && Array.isArray(rawCats.items)) catsList = rawCats.items;
        
        // Normalize Categories Structure
        const cleanCats = catsList.map(c => ({
            id: String(c.id),
            name: String(c.name || c.title || c.id),
            categoryIds: c.categoryIds || c.categories || [],
            children: c.children || c.groups || []
        }));
        setCategories(cleanCats);

        // Parse Map
        let cleanMap: CategoryCoinMap = {};
        if (rawMap && typeof rawMap === 'object') {
             // Handle { categories: {...} } wrapper if present
             const root = (rawMap as any).categories || rawMap;
             cleanMap = root;
        }
        setCategoryCoinMap(cleanMap);

    }).catch(err => {
        console.error(err);
        if (active) setErrorMsg("Erro ao carregar dados.");
    }).finally(() => {
        if (active) setLoading(false);
    });

    return () => { active = false; };
  }, []);

  const hasCategories = categories.length > 0 && Object.keys(categoryCoinMap).length > 0;

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Modal Render
  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-[#0b0d10] w-full h-full rounded-2xl border border-gray-800 shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-[#121418]">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-white uppercase tracking-wider">
                        {view.mode === 'market' ? 'Mapa Geral' : view.mode === 'categories' ? 'Setores' : view.categoryName}
                    </h2>
                    
                    <div className="flex bg-gray-800 rounded-lg p-1 gap-1">
                        <button 
                            onClick={() => setView({ mode: 'market' })}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${view.mode === 'market' ? 'bg-[#dd9933] text-black' : 'text-gray-400 hover:text-white'}`}
                        >
                            GERAL
                        </button>
                        <button 
                            onClick={() => setView({ mode: 'categories' })}
                            disabled={!hasCategories}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${view.mode !== 'market' ? 'bg-[#dd9933] text-black' : 'text-gray-400 hover:text-white disabled:opacity-30'}`}
                        >
                            SETORES
                        </button>
                    </div>
                </div>

                <div className="flex gap-3">
                    {view.mode === 'categoryCoins' && (
                        <button onClick={() => setView({ mode: 'categories' })} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-bold uppercase transition-colors">
                            Voltar
                        </button>
                    )}
                    <button onClick={() => setOpen(false)} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold uppercase transition-colors">
                        Fechar
                    </button>
                </div>
            </div>

            {/* Chart Area */}
            <div className="flex-1 min-h-0 relative">
                <TreemapChart 
                    view={view}
                    coins={coins}
                    categories={categories}
                    categoryCoinMap={categoryCoinMap}
                    onSelectCategory={(id, name) => setView({ mode: 'categoryCoins', masterId: id, categoryName: name })}
                />
            </div>

            {/* Footer Status */}
            <div className="p-2 border-t border-gray-800 bg-[#121418] flex justify-between text-[10px] text-gray-500 font-mono uppercase">
                <span>{coins.length} Ativos Carregados</span>
                <span>Heatmap V2.0 • Data Source: Cachecko</span>
            </div>
        </div>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative p-4 bg-white dark:bg-[#1a1c1e]">
        <div className="text-center">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Crypto Heatmap</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Visualização global de mercado.</p>
            
            <div className="flex gap-3 justify-center">
                <button 
                    onClick={() => { setView({ mode: 'market' }); setOpen(true); }}
                    className="px-6 py-2 bg-[#dd9933] hover:bg-amber-600 text-black font-bold rounded-full shadow-lg transition-transform hover:scale-105"
                >
                    Abrir Mapa Geral
                </button>
                <button 
                    onClick={() => { setView({ mode: 'categories' }); setOpen(true); }}
                    disabled={!hasCategories}
                    className="px-6 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-bold rounded-full shadow-lg transition-transform hover:scale-105 disabled:opacity-50"
                >
                    Mapa de Setores
                </button>
            </div>

            {loading && <div className="mt-4 text-xs text-gray-400 animate-pulse">Carregando dados...</div>}
            {errorMsg && <div className="mt-4 text-xs text-red-500">{errorMsg}</div>}
        </div>

        {open && createPortal(modalContent, document.body)}
    </div>
  );
}