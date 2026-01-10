// HeatmapWidget.tsx
// ✅ Demo-style Treemap (igual S&P) + drilldown + headers no TOPO
// ✅ Popup fullscreen com X pra fechar (e pronto)
// ✅ Consome JSON via HTTP em /cachecko/... (nunca filesystem)
// ✅ Sem import de breadcrumbs module (pra não quebrar teu build)

import React, { useEffect, useMemo, useRef, useState } from 'react';
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

type TaxonomyCategory = {
  id: string;
  name: string;
  parent?: string | null;
  parentId?: string | null;
  parent_id?: string | null;
  master?: string | null;
  masterId?: string | null;
  group?: string | null;
  groupId?: string | null;
};

type CategoryCoinsMap = Record<string, string[]>;

type TreemapPoint = {
  id: string;
  name?: string;
  parent?: string;
  value?: number;
  colorValue?: number;
  custom?: {
    fullName?: string;
    performance?: string;
    logo?: string;
    marketCap?: number;
    change24h?: number;
    kind?: 'root' | 'category' | 'coin';
  };
};

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

  // ✅ Plugin do demo (com correção do toColor)
  Highcharts.addEvent(Highcharts.Series, 'drawDataLabels', function () {
    // @ts-ignore
    if (this.type !== 'treemap') return;

    // @ts-ignore
    const ca = this.chart?.colorAxis?.[0];

    // @ts-ignore
    this.points.forEach((p: any) => {
      // pinta header de level 1/2 com base no colorValue
      if ((p?.node?.level === 1 || p?.node?.level === 2) && p?.dlOptions && ca && Number.isFinite(p.colorValue)) {
        try {
          p.dlOptions.backgroundColor = ca.toColor(p.colorValue);
        } catch {
          // no-op
        }
      }

      // leaf font-size baseado na área
      if (p?.node?.level === 3 && p?.shapeArgs && p?.dlOptions?.style) {
        const area = Number(p.shapeArgs.width || 0) * Number(p.shapeArgs.height || 0);
        const px = Math.min(32, 7 + Math.round(area * 0.0008));
        p.dlOptions.style.fontSize = `${px}px`;
      }
    });
  });
}

function getCacheckoUrl(path: string) {
  if (!path) return '/cachecko';
  return path.startsWith('/cachecko') ? path : `/cachecko/${path.replace(/^\/+/, '')}`;
}

const ENDPOINTS = {
  COINS_LITE: getCacheckoUrl('cachecko_lite.json'),
  TAXONOMY: getCacheckoUrl('categories/taxonomy-master.json'),
  CAT_MAP: getCacheckoUrl('categories/category_coins_map.json') // ajusta se teu nome for outro
};

function withCb(url: string) {
  const salt = Math.floor(Date.now() / 60000);
  return url.includes('?') ? `${url}&_cb=${salt}` : `${url}?_cb=${salt}`;
}

async function httpGetJson(url: string, opts?: { timeoutMs?: number; retries?: number }) {
  const timeoutMs = opts?.timeoutMs ?? 10000;
  const retries = opts?.retries ?? 2;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const r = await fetch(withCb(url), { signal: ctrl.signal, cache: 'no-store' });
      if (!r.ok) throw new Error(`${url} -> ${r.status}`);
      return await r.json();
    } catch (e) {
      if (attempt === retries) throw e;
    } finally {
      window.clearTimeout(t);
    }
  }
  throw new Error('httpGetJson: unreachable');
}

function safeUpper(s?: string) {
  return (s || '').toUpperCase();
}

function fmtPct(v: number) {
  const n = Number.isFinite(v) ? v : 0;
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function fmtMc(v: number) {
  const n = Number.isFinite(v) ? v : 0;
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return `${Math.round(n)}`;
}

function pickParentId(c: TaxonomyCategory): string | null {
  const v = c.parent ?? c.parentId ?? c.parent_id ?? c.master ?? c.masterId ?? c.group ?? c.groupId ?? null;
  if (!v) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function weightedPerf(coinIds: string[], coinById: Map<string, Coin>) {
  let totalMc = 0;
  let acc = 0;

  for (const id of coinIds) {
    const c = coinById.get(id);
    if (!c) continue;
    const mc = Number(c.market_cap || 0);
    const ch = Number(c.price_change_percentage_24h ?? 0);
    totalMc += mc;
    acc += mc * ch;
  }

  if (totalMc <= 0) return 0;
  const v = acc / totalMc;
  return Number.isFinite(v) ? v : 0;
}

function buildTreemapData(params: {
  coins: Coin[];
  taxonomy: TaxonomyCategory[];
  catMap: CategoryCoinsMap;
}) {
  const { coins, taxonomy, catMap } = params;

  const coinById = new Map<string, Coin>();
  for (const c of coins) if (c?.id) coinById.set(c.id, c);

  const data: TreemapPoint[] = [
    {
      id: 'All',
      name: 'All',
      custom: { fullName: 'All', kind: 'root' }
    }
  ];

  const catById = new Map<string, TaxonomyCategory>();
  taxonomy.forEach(c => {
    if (c?.id) catById.set(c.id, c);
  });

  function ensureNode(id: string, name: string, parent: string) {
    if (!id) return;
    if (data.find(p => p.id === id)) return;
    data.push({
      id,
      parent,
      name,
      custom: { fullName: name, kind: 'category' }
    });
  }

  // categorias e subcategorias
  taxonomy.forEach(cat => {
    if (!cat?.id || !cat?.name) return;
    const parentId = pickParentId(cat) || 'All';

    if (parentId !== 'All' && !catById.has(parentId)) {
      ensureNode(parentId, parentId, 'All');
    }

    ensureNode(cat.id, cat.name, parentId);
  });

  // moedas dentro das categorias
  Object.entries(catMap || {}).forEach(([catId, coinIds]) => {
    if (!catId || !Array.isArray(coinIds) || coinIds.length === 0) return;

    if (!data.find(p => p.id === catId)) {
      ensureNode(catId, catId, 'All');
    }

    const uniq = Array.from(new Set(coinIds));
    const perf = weightedPerf(uniq, coinById);

    const node = data.find(p => p.id === catId);
    if (node) {
      node.colorValue = perf;
      node.custom = node.custom || {};
      node.custom.performance = fmtPct(perf);
    }

    for (const coinId of uniq) {
      const c = coinById.get(coinId);
      if (!c) continue;

      const mc = Number(c.market_cap || 0) || 1;
      const ch = Number(c.price_change_percentage_24h ?? 0);

      data.push({
        id: `${catId}:${coinId}`,
        parent: catId,
        name: safeUpper(c.symbol) || safeUpper(c.name) || coinId,
        value: mc,
        colorValue: ch,
        custom: {
          fullName: c.name || coinId,
          performance: fmtPct(ch),
          logo: c.image,
          marketCap: mc,
          change24h: ch,
          kind: 'coin'
        }
      });
    }
  });

  return data;
}

export default function HeatmapWidget() {
  const [open, setOpen] = useState(true); // abre direto
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>('');

  const [coins, setCoins] = useState<Coin[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyCategory[]>([]);
  const [catMap, setCatMap] = useState<CategoryCoinsMap>({});

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<Highcharts.Chart | null>(null);

  useEffect(() => {
    initHighchartsOnce();
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr('');

    Promise.allSettled([
      httpGetJson(ENDPOINTS.COINS_LITE, { timeoutMs: 12000, retries: 2 }),
      httpGetJson(ENDPOINTS.TAXONOMY, { timeoutMs: 12000, retries: 1 }),
      httpGetJson(ENDPOINTS.CAT_MAP, { timeoutMs: 12000, retries: 1 })
    ])
      .then(res => {
        if (!alive) return;

        const [rCoins, rTax, rMap] = res;

        if (rCoins.status === 'fulfilled' && Array.isArray(rCoins.value)) setCoins(rCoins.value);
        else setErr(prev => prev || `Falha ao carregar ${ENDPOINTS.COINS_LITE}`);

        if (rTax.status === 'fulfilled' && Array.isArray(rTax.value)) setTaxonomy(rTax.value);
        else setErr(prev => prev || `Falha ao carregar ${ENDPOINTS.TAXONOMY}`);

        if (rMap.status === 'fulfilled' && rMap.value && typeof rMap.value === 'object') setCatMap(rMap.value);
        else setErr(prev => prev || `Falha ao carregar ${ENDPOINTS.CAT_MAP}`);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const treemapData = useMemo(() => {
    if (!coins.length) return [];
    return buildTreemapData({ coins, taxonomy, catMap });
  }, [coins, taxonomy, catMap]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!containerRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const chart = Highcharts.chart(containerRef.current, {
      chart: {
        backgroundColor: '#252931',
        spacing: [12, 12, 12, 12]
      },
      title: {
        text: 'Market Heatmap',
        align: 'left',
        style: { color: 'white', fontWeight: '800' }
      },
      subtitle: {
        text: 'Click points to drill down.',
        align: 'left',
        style: { color: 'silver' }
      },
      credits: { enabled: false },
      exporting: { enabled: false },
      accessibility: { enabled: true },
      tooltip: {
        followPointer: true,
        outside: true,
        useHTML: true,
        headerFormat: '<span style="font-size: 0.9em">{point.custom.fullName}</span><br/>',
        pointFormatter: function () {
          // @ts-ignore
          const p = this as any;
          const mc = Number(p?.custom?.marketCap ?? p.value ?? 0);
          const perf = p?.custom?.performance ?? (Number.isFinite(p.colorValue) ? fmtPct(p.colorValue) : '');
          const isLeaf = p?.custom?.kind === 'coin';

          if (!isLeaf) return `<b>Performance:</b> ${perf}<br/><b>Market Cap:</b> $${fmtMc(mc)}`;
          return `<b>Market Cap:</b> $${fmtMc(mc)}<br/><b>24h:</b> ${perf}`;
        }
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
            style: { fontSize: '0.9em', textOutline: 'none' }
          },

          // ✅ HEADERS NO TOPO (igual demo)
          levels: [
            {
              level: 1,
              dataLabels: {
                enabled: true,
                headers: true,
                align: 'left',
                verticalAlign: 'top',
                x: 6,
                y: 4,
                style: {
                  fontWeight: 'bold',
                  fontSize: '0.75em',
                  lineClamp: 1,
                  textTransform: 'uppercase',
                  textOutline: 'none'
                },
                padding: 3
              },
              borderWidth: 3,
              levelIsConstant: false
            },
            {
              level: 2,
              dataLabels: {
                enabled: true,
                headers: true,
                align: 'left',
                verticalAlign: 'top',
                x: 6,
                y: 4,
                shape: 'callout',
                borderWidth: 1,
                borderColor: '#252931',
                padding: 0,
                style: {
                  color: 'white',
                  fontWeight: 'normal',
                  fontSize: '0.65em',
                  lineClamp: 1,
                  textOutline: 'none',
                  textTransform: 'uppercase'
                }
              },
              groupPadding: 1
            },
            {
              level: 3,
              dataLabels: {
                enabled: true,
                align: 'center',
                format: '{point.name}<br><span style="font-size: 0.7em">{point.custom.performance}</span>',
                style: { color: 'white', textOutline: 'none' }
              }
            }
          ],

          accessibility: { exposeAsGroupOnly: true },

          // Breadcrumbs funciona em várias versões sem módulo extra.
          // Se a tua versão não renderizar, não quebra nada.
          breadcrumbs: {
            buttonTheme: {
              style: { color: 'silver' },
              states: {
                hover: { fill: '#333' },
                select: { style: { color: 'white' } }
              }
            }
          },

          colorKey: 'colorValue',
          data: treemapData as any
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
  }, [open, treemapData]);

  const modal = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)'
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
            position: 'relative'
          }}
        >
          <button
            onClick={() => setOpen(false)}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              width: 44,
              height: 44,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(0,0,0,0.35)',
              color: 'white',
              fontWeight: 900,
              cursor: 'pointer',
              zIndex: 10
            }}
            aria-label="Fechar"
            title="Fechar"
          >
            ✕
          </button>

          {(loading || err) && (
            <div
              style={{
                position: 'absolute',
                left: 12,
                bottom: 12,
                zIndex: 10,
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.10)',
                background: 'rgba(0,0,0,0.35)',
                color: 'white',
                fontWeight: 800,
                maxWidth: 520
              }}
            >
              {loading ? 'Carregando dados…' : null}
              {!loading && err ? `Erro: ${err}` : null}
              <div style={{ opacity: 0.8, fontWeight: 700, marginTop: 6, fontSize: 12 }}>
                {ENDPOINTS.COINS_LITE} | {ENDPOINTS.TAXONOMY} | {ENDPOINTS.CAT_MAP}
              </div>
            </div>
          )}

          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ width: '100%' }}>
      {!open && (
        <button
          onClick={() => setOpen(true)}
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
          Abrir Heatmap
        </button>
      )}

      {open && createPortal(modal, document.body)}
    </div>
  );
}
