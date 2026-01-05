import React, { useEffect, useMemo, useRef, useState } from 'react';
import Highcharts from 'highcharts';
import TreemapModule from 'highcharts/modules/treemap';
import ExportingModule from 'highcharts/modules/exporting';
import AccessibilityModule from 'highcharts/modules/accessibility';

// =============================
// CONFIG (AJUSTE OS ENDPOINTS)
// =============================
const COINS_URL = '/cachecko/cachecko_lite.json';
const CATEGORIES_URL = '/cachecko/taxonomy-master.json';
const CATEGORY_COIN_MAP_URL = '/cachecko/category-coin-map.json'; // { [categoryId]: string[] }

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
};

type CategoryCoinMap = Record<string, string[]>;

type HeatmapMode = 'market' | 'categories' | 'categoryCoins';

type HeatmapView =
  | { mode: 'market' }
  | { mode: 'categories' }
  | { mode: 'categoryCoins'; categoryId: string; categoryName: string };

type TreemapPoint = {
  id: string;
  name: string;
  value: number;
  colorValue: number;
  custom?: {
    fullName?: string;
    logo?: string;
    change24h?: number;
    marketCap?: number;
  };
};

// =============================
// HIGHCHARTS ONE-TIME INIT
// =============================
let HC_INITED = false;
function initHighchartsOnce() {
  if (HC_INITED) return;
  HC_INITED = true;

  TreemapModule(Highcharts);
  ExportingModule(Highcharts);
  AccessibilityModule(Highcharts);

  // Opcional: ajustar animação default e estilos globais
  Highcharts.setOptions({
    chart: { style: { fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif' } }
  });
}

// =============================
// HELPERS
// =============================
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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

// Dedup moedas (por id) e mantém as maiores por market cap no topo
function dedupCoinsById(coins: Coin[]) {
  const map = new Map<string, Coin>();
  for (const c of coins) {
    if (!c?.id) continue;
    const prev = map.get(c.id);
    if (!prev) map.set(c.id, c);
    else {
      const prevMc = Number(prev.market_cap || 0);
      const mc = Number(c.market_cap || 0);
      if (mc > prevMc) map.set(c.id, c);
    }
  }
  return Array.from(map.values());
}

// =============================
// BUILD DATASETS
// =============================
function buildMarketMonitorPoints(coins: Coin[], limit = 300): TreemapPoint[] {
  const arr = dedupCoinsById(coins)
    .filter(c => c && c.id)
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

function buildCategoryPoints(
  categories: Category[],
  categoryCoinMap: CategoryCoinMap,
  coinById: Map<string, Coin>
): TreemapPoint[] {
  return categories.map(cat => {
    const ids = Array.from(new Set(categoryCoinMap[cat.id] || []));
    const members = ids.map(id => coinById.get(id)).filter(Boolean) as Coin[];

    const totalMc = members.reduce((a, c) => a + Number(c.market_cap || 0), 0) || 1;

    const weightedPerf =
      members.reduce((a, c) => {
        const mc = Number(c.market_cap || 0);
        const ch = Number(c.price_change_percentage_24h ?? 0);
        return a + mc * ch;
      }, 0) / (totalMc || 1);

    return {
      id: cat.id,
      name: cat.name,
      value: totalMc,
      colorValue: Number.isFinite(weightedPerf) ? weightedPerf : 0,
      custom: {
        fullName: cat.name,
        change24h: Number.isFinite(weightedPerf) ? weightedPerf : 0,
        marketCap: totalMc
      }
    };
  });
}

function buildCategoryCoinsPoints(
  categoryId: string,
  categoryCoinMap: CategoryCoinMap,
  coinById: Map<string, Coin>,
  limit = 300
): TreemapPoint[] {
  const ids = Array.from(new Set(categoryCoinMap[categoryId] || []));
  const members = ids.map(id => coinById.get(id)).filter(Boolean) as Coin[];

  return members
    .sort((a, b) => Number(b.market_cap || 0) - Number(a.market_cap || 0))
    .slice(0, limit)
    .map(c => ({
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
    return buildCategoryCoinsPoints(view.categoryId, categoryCoinMap, coinById);
  }, [view, coins, categories, categoryCoinMap, coinById]);

  const title = useMemo(() => {
    if (view.mode === 'market') return 'Market Monitor';
    if (view.mode === 'categories') return 'Categorias';
    return `Categoria: ${view.categoryName}`;
  }, [view]);

  useEffect(() => {
    initHighchartsOnce();
    if (!containerRef.current) return;

    // Destroy anterior
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const hasData = points && points.length > 0;

    const chart = Highcharts.chart(containerRef.current, {
      chart: {
        backgroundColor: '#0b0d10',
        spacing: [12, 12, 12, 12],
        animation: true
      },
      title: {
        text: title,
        align: 'left',
        style: { color: '#fff', fontSize: '16px', fontWeight: '700' }
      },
      subtitle: {
        text:
          view.mode === 'categories'
            ? 'Clique numa categoria para abrir as moedas'
            : view.mode === 'market'
              ? 'Mapa geral por market cap (cor = variação 24h)'
              : 'Mapa da categoria (cor = variação 24h)',
        align: 'left',
        style: { color: 'rgba(255,255,255,0.65)', fontSize: '12px' }
      },
      credits: { enabled: false },
      exporting: { enabled: false },
      accessibility: { enabled: true },
      tooltip: {
        useHTML: true,
        outside: true,
        backgroundColor: 'rgba(15,18,22,0.96)',
        borderColor: 'rgba(255,255,255,0.10)',
        style: { color: '#fff' },
        formatter: function () {
          const p: any = this.point;
          const full = p?.custom?.fullName || p.name;
          const ch = Number(p?.custom?.change24h ?? p.colorValue ?? 0);
          const mc = Number(p?.custom?.marketCap ?? p.value ?? 0);

          return `
            <div style="min-width:220px">
              <div style="font-weight:800; margin-bottom:6px">${full}</div>
              <div><b>24h:</b> ${formatPct(ch)}</div>
              <div><b>Market Cap:</b> $${formatMc(mc)}</div>
            </div>
          `;
        }
      },
      colorAxis: {
        // escala igual teu exemplo (vermelho -> neutro -> verde)
        min: -10,
        max: 10,
        stops: [
          [0, '#f73539'],
          [0.5, '#414555'],
          [1, '#2ecc59']
        ],
        gridLineWidth: 0,
        labels: {
          style: { color: 'rgba(255,255,255,0.8)' },
          format: '{#gt value 0}+{value}{else}{value}{/gt}%'
        }
      },
      series: [
        {
          type: 'treemap',
          name: 'All',
          layoutAlgorithm: 'squarified',
          allowDrillToNode: false,
          animationLimit: 1000,
          borderColor: '#0b0d10',
          borderWidth: 2,
          colorKey: 'colorValue', // <<< CRÍTICO PRA PEGAR O COLORAXIS
          data: hasData ? (points as any) : [],
          dataLabels: {
            enabled: true,
            allowOverlap: false,
            style: {
              color: '#fff',
              textOutline: 'none',
              fontWeight: '800'
            },
            formatter: function () {
              const p: any = this.point;
              const isCat = view.mode === 'categories';
              const ch = Number(p?.custom?.change24h ?? p.colorValue ?? 0);

              // Ajuste simples: menos texto nas categorias, mais nas moedas
              if (isCat) {
                return `<span style="font-size:11px; opacity:.95">${p.name}</span><br/>
                        <span style="font-size:11px; opacity:.85">${formatPct(ch)}</span>`;
              }

              return `<span style="font-size:14px">${p.name}</span><br/>
                      <span style="font-size:12px; opacity:.85">${formatPct(ch)}</span>`;
            }
          },
          // eventos de clique
          point: {
            events: {
              click: function () {
                const p: any = this;
                if (view.mode === 'categories') {
                  onSelectCategory(p.id, p.name);
                }
              }
            }
          }
        } as any
      ]
    });

    chartRef.current = chart;

    // Resize reativo
    const ro = new ResizeObserver(() => {
      chart.reflow();
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [points, title, view, onSelectCategory]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

// =============================
// FULLSCREEN MODAL + CONTROLS
// =============================
export default function CryptoHeatmaps() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<HeatmapView>({ mode: 'market' });

  const [coins, setCoins] = useState<Coin[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryCoinMap, setCategoryCoinMap] = useState<CategoryCoinMap>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>('');

  const canCategories = useMemo(() => {
    return categories.length > 0 && Object.keys(categoryCoinMap).length > 0;
  }, [categories, categoryCoinMap]);

  // Load all datasets once
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr('');

    Promise.allSettled([
      fetchJson<Coin[]>(COINS_URL),
      fetchJson<Category[]>(CATEGORIES_URL),
      fetchJson<CategoryCoinMap>(CATEGORY_COIN_MAP_URL)
    ])
      .then(results => {
        if (!alive) return;

        const [rCoins, rCats, rMap] = results;

        if (rCoins.status === 'fulfilled') setCoins(Array.isArray(rCoins.value) ? rCoins.value : []);
        else setErr(prev => prev || `Falha ao carregar moedas (${COINS_URL})`);

        if (rCats.status === 'fulfilled') setCategories(Array.isArray(rCats.value) ? rCats.value : []);
        else setErr(prev => prev || `Falha ao carregar categorias (${CATEGORIES_URL})`);

        if (rMap.status === 'fulfilled' && rMap.value && typeof rMap.value === 'object') setCategoryCoinMap(rMap.value);
        else setErr(prev => prev || `Falha ao carregar mapa categoria→moedas (${CATEGORY_COIN_MAP_URL})`);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  function openMarket() {
    setView({ mode: 'market' });
    setOpen(true);
  }

  function openCategories() {
    setView({ mode: 'categories' });
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setView({ mode: 'market' });
  }

  function back() {
    setView({ mode: 'categories' });
  }

  const headerRight = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      {view.mode === 'categoryCoins' && (
        <button
          onClick={back}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.06)',
            color: '#fff',
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          Voltar
        </button>
      )}

      <button
        onClick={close}
        style={{
          padding: '10px 14px',
          borderRadius: 12,
          border: '1px solid rgba(0,0,0,0.25)',
          background: '#dd9933',
          color: '#0b0d10',
          fontWeight: 900,
          cursor: 'pointer'
        }}
      >
        Fechar ✕
      </button>
    </div>
  );

  return (
    <div style={{ width: '100%' }}>
      {/* Botões de abertura */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={openMarket}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.06)',
            color: '#fff',
            fontWeight: 900,
            cursor: 'pointer'
          }}
        >
          Market Monitor
        </button>

        <button
          onClick={openCategories}
          disabled={!canCategories}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.15)',
            background: canCategories ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
            color: canCategories ? '#fff' : 'rgba(255,255,255,0.45)',
            fontWeight: 900,
            cursor: canCategories ? 'pointer' : 'not-allowed'
          }}
          title={!canCategories ? 'Categorias indisponíveis (faltou categories/map)' : ''}
        >
          Heatmap por Categoria
        </button>

        {loading && <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Carregando dados…</span>}
        {!!err && !loading && <span style={{ color: '#ff6b6b', fontWeight: 800 }}>{err}</span>}
      </div>

      {/* Modal fullscreen */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0,0,0,0.78)',
            backdropFilter: 'blur(8px)'
          }}
        >
          <div style={{ position: 'absolute', inset: 0, padding: 14 }}>
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 18,
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.10)',
                background: '#0b0d10',
                boxShadow: '0 30px 90px rgba(0,0,0,0.55)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Barra do topo */}
              <div
                style={{
                  padding: '12px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <div style={{ color: '#fff', fontWeight: 900, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ opacity: 0.9 }}>
                    {view.mode === 'market'
                      ? 'Market Monitor'
                      : view.mode === 'categories'
                        ? 'Categorias'
                        : `Categoria: ${view.categoryName}`}
                  </span>

                  {/* Botões rápidos dentro do modal */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setView({ mode: 'market' })}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: view.mode === 'market' ? 'rgba(221,153,51,0.22)' : 'rgba(255,255,255,0.05)',
                        color: '#fff',
                        fontWeight: 900,
                        cursor: 'pointer'
                      }}
                    >
                      Geral
                    </button>

                    <button
                      onClick={() => setView({ mode: 'categories' })}
                      disabled={!canCategories}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: view.mode !== 'market' ? 'rgba(221,153,51,0.22)' : 'rgba(255,255,255,0.05)',
                        color: canCategories ? '#fff' : 'rgba(255,255,255,0.45)',
                        fontWeight: 900,
                        cursor: canCategories ? 'pointer' : 'not-allowed'
                      }}
                      title={!canCategories ? 'Categorias indisponíveis' : ''}
                    >
                      Categorias
                    </button>
                  </div>
                </div>

                {headerRight}
              </div>

              {/* Área do gráfico */}
              <div style={{ flex: 1, minHeight: 0 }}>
                <TreemapChart
                  view={view}
                  coins={coins}
                  categories={categories}
                  categoryCoinMap={categoryCoinMap}
                  onSelectCategory={(id, name) => setView({ mode: 'categoryCoins', categoryId: id, categoryName: name })}
                />
              </div>

              {/* Rodapé simples */}
              <div
                style={{
                  padding: '10px 12px',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: 'rgba(255,255,255,0.55)',
                  fontWeight: 700,
                  fontSize: 12
                }}
              >
                <span>
                  {view.mode === 'market'
                    ? `Moedas: ${Math.min(300, coins.length)} (ordenado por market cap)`
                    : view.mode === 'categories'
                      ? `Categorias: ${categories.length}`
                      : `Moedas na categoria: ${view.categoryName}`}
                </span>
                <span>Cor = variação 24h | Área = market cap</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
