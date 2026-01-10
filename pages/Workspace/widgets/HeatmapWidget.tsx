import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Highcharts from 'highcharts';
import TreemapModule from 'highcharts/modules/treemap';
import ExportingModule from 'highcharts/modules/exporting';
import AccessibilityModule from 'highcharts/modules/accessibility';

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

type Mode = 'market' | 'categories';

type TreemapPoint = {
  id: string;
  parent?: string;
  name?: string;
  value?: number;
  colorValue?: number;
  custom?: {
    fullName?: string;
    performance?: string;
    logo?: string;
    change24h?: number;
    marketCap?: number;
  };
};

// =============================
// URLS PÚBLICAS (HTTP)
// =============================
function getCacheckoUrl(path: string) {
  if (!path) return '/cachecko';
  return path.startsWith('/cachecko') ? path : `/cachecko/${path.replace(/^\/+/, '')}`;
}

const ENDPOINTS = {
  COINS_LITE: getCacheckoUrl('cachecko_lite.json'),
  COINS_FULL: getCacheckoUrl('cachecko.json'),
  TAXONOMY: getCacheckoUrl('categories/taxonomy-master.json')
};

// Map pode ter nome diferente no teu servidor, então tenta vários
const MAP_CANDIDATES = [
  getCacheckoUrl('categories/category_coins_map.json'),
  getCacheckoUrl('categories/category-coins-map.json'),
  getCacheckoUrl('categories/category_coin_map.json'),
  getCacheckoUrl('categories/category-coin-map.json'),
  getCacheckoUrl('categories/category_coins_map.json')
];

// =============================
// HTTP ROBUSTO (timeout + retry + cache-buster)
// =============================
function withCb(url: string) {
  const salt = Math.floor(Date.now() / 60000);
  return url.includes('?') ? `${url}&_cb=${salt}` : `${url}?_cb=${salt}`;
}

async function httpGetJson<T>(url: string, opts?: { timeoutMs?: number; retries?: number }) {
  const timeoutMs = opts?.timeoutMs ?? 10000;
  const retries = opts?.retries ?? 2;
  const finalUrl = withCb(url);

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const r = await fetch(finalUrl, { signal: ctrl.signal, cache: 'no-store' });
      if (!r.ok) throw new Error(`${finalUrl} -> HTTP ${r.status}`);
      return (await r.json()) as T;
    } catch (e) {
      if (attempt === retries) throw e;
    } finally {
      clearTimeout(t);
    }
  }

  throw new Error('httpGetJson: unreachable');
}

async function httpGetFirstJson<T>(urls: string[], opts?: { timeoutMs?: number; retries?: number }) {
  let lastErr: any = null;
  for (const u of urls) {
    try {
      const data = await httpGetJson<T>(u, opts);
      return { data, usedUrl: u };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('httpGetFirstJson: all failed');
}

// =============================
// HELPERS
// =============================
function safeUpper(s?: string) {
  return (s || '').toUpperCase();
}

function formatPct(v: number) {
  const n = Number.isFinite(v) ? v : 0;
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function formatMc(mc: number) {
  const n = Number.isFinite(mc) ? mc : 0;
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return `${Math.round(n)}`;
}

function normalizeCoinsPayload(data: any): Coin[] {
  if (Array.isArray(data)) return data as Coin[];
  if (Array.isArray(data?.coins)) return data.coins as Coin[];
  return [];
}

function makeCoinMap(coins: Coin[]) {
  const m = new Map<string, Coin>();
  for (const c of coins) if (c?.id) m.set(c.id, c);
  return m;
}

// Dedup forte: se o coin aparece em várias categorias, escolhe uma “primária” pela ordem da taxonomy
function buildPrimaryCategoryAssignment(categories: Category[], categoryCoinMap: CategoryCoinMap) {
  const assigned = new Map<string, string>(); // coinId -> categoryId

  for (const cat of categories) {
    const ids = Array.from(new Set(categoryCoinMap[cat.id] || []));
    for (const coinId of ids) {
      if (!assigned.has(coinId)) assigned.set(coinId, cat.id);
    }
  }

  return assigned;
}

// =============================
// HIGHCHARTS INIT + PLUGIN (igual demo)
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
      style: {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
      }
    }
  });

  // Plugin: pinta header nível 2 pela performance + ajusta fonte por área (nível 3)
  Highcharts.addEvent(Highcharts.Series as any, 'drawDataLabels', function () {
    // @ts-ignore
    if (this.type !== 'treemap') return;

    // @ts-ignore
    const axis = this.colorAxis;

    // @ts-ignore
    this.points.forEach((point: any) => {
      // Level 2 (categorias): aplica background no label usando colorAxis
      if (point?.node?.level === 2 && Number.isFinite(point?.colorValue)) {
        if (point.dlOptions) {
          const c = axis ? axis.toColor(point.colorValue) : undefined;
          if (c) point.dlOptions.backgroundColor = c;
        }
      }

      // Level 3 (moedas): fonte proporcional à área
      if (point?.node?.level === 3 && point?.shapeArgs && point?.dlOptions?.style) {
        const area = point.shapeArgs.width * point.shapeArgs.height;
        point.dlOptions.style.fontSize = `${Math.min(32, 7 + Math.round(area * 0.0008))}px`;
      }
    });
  });
}

// =============================
// BUILD SERIES DATA (demo style)
// =============================
function buildMarketData(coins: Coin[], limit = 350): TreemapPoint[] {
  const arr = coins
    .filter(c => c?.id)
    .slice()
    .sort((a, b) => Number(b.market_cap || 0) - Number(a.market_cap || 0))
    .slice(0, limit);

  const data: TreemapPoint[] = [{ id: 'All' }];

  for (const c of arr) {
    const ch = Number(c.price_change_percentage_24h ?? 0);
    const mc = Number(c.market_cap || 1);

    data.push({
      id: `coin:${c.id}`,
      parent: 'All',
      name: safeUpper(c.symbol) || safeUpper(c.name) || c.id,
      value: mc,
      colorValue: ch,
      custom: {
        fullName: c.name || c.id,
        logo: c.image,
        change24h: ch,
        marketCap: mc,
        performance: formatPct(ch)
      }
    });
  }

  return data;
}

function buildCategoryTreemapData(
  coins: Coin[],
  categories: Category[],
  categoryCoinMap: CategoryCoinMap,
  limitPerCategory = 200
): TreemapPoint[] {
  const coinById = makeCoinMap(coins);
  const primary = buildPrimaryCategoryAssignment(categories, categoryCoinMap);

  const data: TreemapPoint[] = [{ id: 'All' }];

  // Level 1: root->All, Level 2: categories, Level 3: coins
  // No demo: industries (lvl1) -> sectors (lvl2) -> companies (lvl3)
  // Aqui: All (lvl1) -> categorias (lvl2) -> moedas (lvl3)

  // Cria nós de categoria com value (marketcap total) e colorValue (perf ponderada)
  for (const cat of categories) {
    const ids = Array.from(new Set(categoryCoinMap[cat.id] || []))
      .filter(coinId => primary.get(coinId) === cat.id); // só os “primários”

    const members = ids
      .map(id => coinById.get(id))
      .filter(Boolean) as Coin[];

    const sorted = members
      .slice()
      .sort((a, b) => Number(b.market_cap || 0) - Number(a.market_cap || 0))
      .slice(0, limitPerCategory);

    const totalMc = sorted.reduce((a, c) => a + Number(c.market_cap || 0), 0);
    const denom = totalMc || 1;

    const weightedPerf =
      sorted.reduce((a, c) => {
        const mc = Number(c.market_cap || 0);
        const ch = Number(c.price_change_percentage_24h ?? 0);
        return a + mc * ch;
      }, 0) / denom;

    const perf = Number.isFinite(weightedPerf) ? weightedPerf : 0;

    // Categoria (lvl2)
    data.push({
      id: `cat:${cat.id}`,
      parent: 'All',
      name: cat.name,
      value: totalMc || 1,
      colorValue: perf,
      custom: {
        fullName: cat.name,
        change24h: perf,
        marketCap: totalMc,
        performance: formatPct(perf)
      }
    });

    // Moedas (lvl3)
    for (const c of sorted) {
      const ch = Number(c.price_change_percentage_24h ?? 0);
      const mc = Number(c.market_cap || 1);

      data.push({
        id: `cat:${cat.id}|coin:${c.id}`, // id único por categoria
        parent: `cat:${cat.id}`,
        name: safeUpper(c.symbol) || safeUpper(c.name) || c.id,
        value: mc,
        colorValue: ch,
        custom: {
          fullName: c.name || c.id,
          logo: c.image,
          change24h: ch,
          marketCap: mc,
          performance: formatPct(ch)
        }
      });
    }
  }

  return data;
}

// =============================
// CHART RENDER
// =============================
function renderChart(container: HTMLElement, mode: Mode, data: TreemapPoint[]) {
  const title = mode === 'market' ? 'Market Monitor' : 'Heatmap por Categoria';

  return Highcharts.chart(container, {
    chart: {
      backgroundColor: '#252931'
    },

    title: {
      text: title,
      align: 'left',
      style: { color: 'white' }
    },

    subtitle: {
      text: mode === 'categories'
        ? 'Clique nos blocos para navegar (drilldown)'
        : 'Mapa geral. Cor = variação 24h. Área = market cap.',
      align: 'left',
      style: { color: 'silver' }
    },

    credits: { enabled: false },

    exporting: { enabled: false },

    tooltip: {
      followPointer: true,
      outside: true,
      useHTML: true,
      headerFormat: '<span style="font-size: 0.95em">{point.custom.fullName}</span><br/>',
      pointFormat:
        '<b>Market Cap:</b> ${point.custom.marketCap}<br/>' +
        '<b>24h:</b> {point.custom.performance}'
    },

    colorAxis: {
      minColor: '#f73539',
      maxColor: '#2ecc59',
      stops: [
        [0, '#f73539'],
        [0.5, '#414555'],
        [1, '#2ecc59']
      ],
      min: -10,
      max: 10,
      gridLineWidth: 0,
      labels: {
        overflow: 'allow',
        format: '{#gt value 0}+{value}{else}{value}{/gt}%',
        style: { color: 'white' }
      }
    },

    legend: {
      itemStyle: { color: 'white' }
    },

    series: [
      {
        name: 'All',
        type: 'treemap',
        layoutAlgorithm: 'squarified',
        allowDrillToNode: true,
        animationLimit: 1000,
        borderColor: '#252931',
        color: '#252931',
        opacity: 0.01,
        nodeSizeBy: 'leaf',
        dataLabels: {
          enabled: false,
          allowOverlap: true,
          style: {
            fontSize: '0.9em',
            textOutline: 'none'
          }
        },

        levels: [
          {
            // Level 1 headers (All)
            level: 1,
            dataLabels: {
              enabled: true,
              headers: true,
              align: 'left',
              style: {
                fontWeight: 'bold',
                fontSize: '0.7em',
                lineClamp: 1,
                textTransform: 'uppercase'
              },
              padding: 3
            },
            borderWidth: 3,
            levelIsConstant: false
          },
          {
            // Level 2 headers (categorias)
            level: 2,
            dataLabels: {
              enabled: true,
              headers: true,
              align: 'center',
              shape: 'callout',
              backgroundColor: 'gray',
              borderWidth: 1,
              borderColor: '#252931',
              padding: 0,
              style: {
                color: 'white',
                fontWeight: 'normal',
                fontSize: '0.6em',
                lineClamp: 1,
                textOutline: 'none',
                textTransform: 'uppercase'
              }
            },
            groupPadding: 1
          },
          {
            // Level 3: moedas
            level: 3,
            dataLabels: {
              enabled: true,
              align: 'center',
              format:
                '{point.name}<br><span style="font-size: 0.7em">' +
                '{point.custom.performance}</span>',
              style: { color: 'white', textOutline: 'none' }
            }
          }
        ],

        accessibility: {
          exposeAsGroupOnly: true
        },

        breadcrumbs: {
          buttonTheme: {
            style: { color: 'silver' },
            states: {
              hover: { fill: '#333' },
              select: { style: { color: 'white' } }
            }
          }
        },

        data: data as any
      } as any
    ]
  });
}

// =============================
// MAIN COMPONENT (FULLSCREEN POPUP)
// =============================
export default function CryptoHeatmapDemoStyle() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('market');

  const [coins, setCoins] = useState<Coin[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catMap, setCatMap] = useState<CategoryCoinMap>({});

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<Highcharts.Chart | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr('');

    try {
      initHighchartsOnce();

      // Coins: tenta lite -> full
      const coinsRes = await httpGetFirstJson<any>(
        [ENDPOINTS.COINS_LITE, ENDPOINTS.COINS_FULL],
        { timeoutMs: 12000, retries: 2 }
      );
      const coinsArr = normalizeCoinsPayload(coinsRes.data);
      setCoins(coinsArr);

      // Taxonomy
      const tax = await httpGetJson<any>(ENDPOINTS.TAXONOMY, { timeoutMs: 12000, retries: 2 });
      setCategories(Array.isArray(tax) ? (tax as Category[]) : []);

      // Map (fallbacks)
      const mapRes = await httpGetFirstJson<any>(MAP_CANDIDATES, { timeoutMs: 12000, retries: 2 });
      const mapData = mapRes.data && typeof mapRes.data === 'object' ? (mapRes.data as CategoryCoinMap) : {};
      setCatMap(mapData);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Carrega 1x
  useEffect(() => {
    loadData();
  }, [loadData]);

  // trava scroll quando modal abre
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const treemapData = useMemo(() => {
    if (mode === 'market') return buildMarketData(coins);
    return buildCategoryTreemapData(coins, categories, catMap);
  }, [mode, coins, categories, catMap]);

  // Render chart quando abrir modal ou mudar modo/dados
  useEffect(() => {
    if (!open) return;
    if (!containerRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    chartRef.current = renderChart(containerRef.current, mode, treemapData);

    const ro = new ResizeObserver(() => {
      if (chartRef.current) chartRef.current.reflow();
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [open, mode, treemapData]);

  const openMarket = useCallback(() => {
    setMode('market');
    setOpen(true);
  }, []);

  const openCategories = useCallback(() => {
    setMode('categories');
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const modal = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        background: 'rgba(0,0,0,0.75)',
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
            background: '#252931',
            boxShadow: '0 30px 90px rgba(0,0,0,0.55)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Top bar */}
          <div
            style={{
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255,255,255,0.10)'
            }}
          >
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                onClick={() => setMode('market')}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: mode === 'market' ? 'rgba(221,153,51,0.22)' : 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontWeight: 900,
                  cursor: 'pointer'
                }}
              >
                Market Monitor
              </button>

              <button
                onClick={() => setMode('categories')}
                disabled={categories.length === 0 || Object.keys(catMap).length === 0}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: mode === 'categories' ? 'rgba(221,153,51,0.22)' : 'rgba(255,255,255,0.06)',
                  color:
                    categories.length === 0 || Object.keys(catMap).length === 0
                      ? 'rgba(255,255,255,0.45)'
                      : '#fff',
                  fontWeight: 900,
                  cursor:
                    categories.length === 0 || Object.keys(catMap).length === 0
                      ? 'not-allowed'
                      : 'pointer'
                }}
                title={
                  categories.length === 0 || Object.keys(catMap).length === 0
                    ? 'Sem taxonomy/map carregado'
                    : ''
                }
              >
                Por Categoria
              </button>

              <button
                onClick={loadData}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontWeight: 900,
                  cursor: 'pointer'
                }}
                title="Recarregar JSONs"
              >
                Recarregar
              </button>

              {loading && (
                <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 800 }}>
                  Carregando…
                </span>
              )}
              {!!err && !loading && (
                <span style={{ color: '#ff6b6b', fontWeight: 900 }}>
                  {err}
                </span>
              )}
            </div>

            {/* Close X */}
            <button
              onClick={close}
              aria-label="Fechar"
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontWeight: 1000,
                cursor: 'pointer',
                fontSize: 18,
                lineHeight: '40px',
                textAlign: 'center'
              }}
              title="Fechar"
            >
              ✕
            </button>
          </div>

          {/* Chart body */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '10px 12px',
              borderTop: '1px solid rgba(255,255,255,0.10)',
              display: 'flex',
              justifyContent: 'space-between',
              color: 'rgba(255,255,255,0.65)',
              fontWeight: 800,
              fontSize: 12
            }}
          >
            <span>
              {mode === 'market'
                ? `Moedas (top): ${Math.min(350, coins.length)}`
                : `Categorias: ${categories.length} | (cada categoria mostra top ${200})`}
            </span>
            <span>Cor = variação 24h | Área = market cap</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ width: '100%' }}>
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
          Abrir Market Monitor
        </button>

        <button
          onClick={openCategories}
          disabled={categories.length === 0 || Object.keys(catMap).length === 0}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.06)',
            color:
              categories.length === 0 || Object.keys(catMap).length === 0
                ? 'rgba(255,255,255,0.45)'
                : '#fff',
            fontWeight: 900,
            cursor:
              categories.length === 0 || Object.keys(catMap).length === 0
                ? 'not-allowed'
                : 'pointer'
          }}
          title={
            categories.length === 0 || Object.keys(catMap).length === 0
              ? 'Sem taxonomy/map carregado'
              : ''
          }
        >
          Abrir Por Categoria
        </button>

        <button
          onClick={loadData}
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
          Recarregar JSONs
        </button>

        {loading && <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 800 }}>Carregando…</span>}
        {!!err && !loading && <span style={{ color: '#ff6b6b', fontWeight: 900 }}>{err}</span>}
      </div>

      {open && createPortal(modal, document.body)}
    </div>
  );
}
