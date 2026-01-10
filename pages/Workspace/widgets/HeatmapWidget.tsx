
// HeatmapWidget.tsx
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

  // CoinGecko-ish fields (dependem do teu cachecko_lite.json)
  current_price?: number;
  market_cap?: number;
  market_cap_rank?: number;
  fully_diluted_valuation?: number;

  total_volume?: number;
  volume_24h?: number; // caso teu json use esse nome

  price_change_percentage_24h?: number;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;

  price_change_24h?: number;

  circulating_supply?: number;
  total_supply?: number;
  max_supply?: number;

  ath?: number;
  atl?: number;
  high_24h?: number;
  low_24h?: number;
};

type CategoryRow = {
  id: string;
  name: string;
};

type TaxonomyRow = {
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

type ValueMode = 'marketcap' | 'var24h';

type TreemapPoint = {
  id: string;
  name: string;
  value: number;
  colorValue: number;
  custom?: any;
};

let HC_INITED = false;
function initHighchartsOnce() {
  if (HC_INITED) return;
  HC_INITED = true;

  try { (TreemapModule as any)(Highcharts); } catch (e) { console.error('Highcharts Treemap error', e); }
  try { (ExportingModule as any)(Highcharts); } catch (e) { }
  try { (AccessibilityModule as any)(Highcharts); } catch (e) { }

  Highcharts.setOptions({
    chart: {
      style: {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
      }
    }
  });

  // Font size automático p/ leaf baseado em área (bem leve)
  Highcharts.addEvent(Highcharts.Series, 'drawDataLabels', function () {
    // @ts-ignore
    if (this.type !== 'treemap') return;
    // @ts-ignore
    this.points.forEach((p: any) => {
      if (!p?.shapeArgs || !p?.dlOptions?.style) return;
      const area = Number(p.shapeArgs.width || 0) * Number(p.shapeArgs.height || 0);
      const px = Math.min(34, 9 + Math.round(area * 0.0008));
      p.dlOptions.style.fontSize = `${px}px`;
    });
  });
}

// =============================
// HTTP robusto & Endpoints
// =============================

// URLs fixas para o VPS (baseadas na estrutura do MarketCapTable)
const ENDPOINTS = {
  COINS_LITE: '/cachecko/cachecko_lite.json',
  TAXONOMY: '/cachecko/categories/taxonomy-master.json',
  CAT_MAP: '/cachecko/categories/category_coins_map.json'
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

// =============================
// Format helpers
// =============================
function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtPct(v: number) {
  const n = Number.isFinite(v) ? v : 0;
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function fmtMoney(v: number) {
  const n = Number.isFinite(v) ? v : 0;
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtNumber(v: number) {
  const n = Number.isFinite(v) ? v : 0;
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return `${Math.round(n)}`;
}

function safeUpper(s?: string) {
  return (s || '').toUpperCase();
}

// =============================
// Categories normalizer
// =============================
function normalizeCategories(raw: any): CategoryRow[] {
  if (!raw) return [];

  // Se vier empacotado como { data: [...] }
  if (raw && !Array.isArray(raw) && Array.isArray(raw.data)) {
      return normalizeCategories(raw.data);
  }

  // taxonomy array
  if (Array.isArray(raw)) {
      // Tenta achar sub-array se for wrapper
      const sub = raw.find(x => x && Array.isArray(x.data));
      if (sub) return normalizeCategories(sub.data);

      return raw
        .map((r: any) => ({ id: String(r.id), name: String(r.name) }))
        .filter(x => x.id && x.name);
  }

  return [];
}

// =============================
// Build Treemap points
// =============================
function buildPoints(coins: Coin[], valueMode: ValueMode): TreemapPoint[] {
  // Default sort por market cap para estabilidade visual
  const sorted = [...coins]
    .filter(c => c && c.id)
    .sort((a, b) => safeNum(b.market_cap) - safeNum(a.market_cap))
    .slice(0, 450); // evita virar uma sopa de pixels

  return sorted.map(c => {
    const change24 = safeNum(c.price_change_percentage_24h);
    const mc = Math.max(1, safeNum(c.market_cap));
    const value =
      valueMode === 'marketcap'
        ? mc
        : Math.max(0.01, Math.abs(change24)); // área pela magnitude da variação (%)

    const vol = safeNum((c as any).total_volume ?? (c as any).volume_24h);

    return {
      id: c.id,
      name: safeUpper(c.symbol) || safeUpper(c.name) || c.id,
      value,
      colorValue: change24,
      custom: {
        fullName: c.name || c.id,
        symbol: safeUpper(c.symbol),
        logo: c.image,
        price: safeNum((c as any).current_price),
        change24h: change24,
        change24hAbs: Math.abs(change24),
        priceChange24h: safeNum((c as any).price_change_24h),
        marketCap: mc,
        marketCapRank: safeNum((c as any).market_cap_rank),
        volume24h: vol,
        fdv: safeNum((c as any).fully_diluted_valuation),
        circ: safeNum((c as any).circulating_supply),
        total: safeNum((c as any).total_supply),
        max: safeNum((c as any).max_supply),
        high24: safeNum((c as any).high_24h),
        low24: safeNum((c as any).low_24h),
        ath: safeNum((c as any).ath),
        atl: safeNum((c as any).atl)
      }
    };
  });
}

// =============================
// Main Component
// =============================
export default function HeatmapWidget() {
  const [open, setOpen] = useState(true);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>('');

  const [coins, setCoins] = useState<Coin[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [catMap, setCatMap] = useState<CategoryCoinsMap>({});

  const [valueMode, setValueMode] = useState<ValueMode>('marketcap');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(''); // '' => All

  const [loadedTaxonomyUrl, setLoadedTaxonomyUrl] = useState<string>('');
  const [loadedMapUrl, setLoadedMapUrl] = useState<string>('');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<Highcharts.Chart | null>(null);

  useEffect(() => {
    initHighchartsOnce();
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr('');

    (async () => {
      try {
        // Fetch paralelo para os 3 endpoints fixos
        const [coinsData, taxonomyData, mapData] = await Promise.all([
            httpGetJson(ENDPOINTS.COINS_LITE, { timeoutMs: 15000, retries: 2 }),
            httpGetJson(ENDPOINTS.TAXONOMY, { timeoutMs: 15000, retries: 2 }).catch(() => []), 
            httpGetJson(ENDPOINTS.CAT_MAP, { timeoutMs: 15000, retries: 2 }).catch(() => ({}))
        ]);

        if (!alive) return;

        // Processa Coins com lógica robusta (igual ao api.ts)
        let coinsArr: any[] = [];
        if (Array.isArray(coinsData)) {
            // Tenta encontrar um item que tenha propriedade .data (formato n8n/wrapper)
            const subData = coinsData.find(item => item && Array.isArray(item.data));
            if (subData) {
                coinsArr = subData.data;
            } else if (coinsData.length > 0 && Array.isArray(coinsData[0])) {
                // Array de arrays?
                coinsArr = coinsData[0];
            } else {
                // Array plano
                coinsArr = coinsData;
            }
        } else if (coinsData && typeof coinsData === 'object') {
            if (Array.isArray(coinsData.data)) {
                coinsArr = coinsData.data;
            } else {
                // Fallback: se for objeto único mas não tem .data, talvez seja vazio ou erro
                coinsArr = []; 
            }
        }

        if (!Array.isArray(coinsArr) || coinsArr.length === 0) {
             throw new Error(`Dados vazios ou formato inválido em ${ENDPOINTS.COINS_LITE}`);
        }

        // Processa Map
        const mapObj = mapData && typeof mapData === 'object' ? mapData : {};
        // Se vier aninhado em "categories" ou "data" (depende do formato exato)
        const finalMap = mapObj.categories || mapObj.data || mapObj;

        setCoins(coinsArr as Coin[]);
        setCategories(normalizeCategories(taxonomyData));
        setCatMap(finalMap as CategoryCoinsMap);
        
        setLoadedTaxonomyUrl(ENDPOINTS.TAXONOMY);
        setLoadedMapUrl(ENDPOINTS.CAT_MAP);

      } catch (e: any) {
        if (!alive) return;
        console.error("Heatmap Load Error:", e);
        setErr(e?.message ? String(e.message) : 'Falha ao carregar dados do Heatmap.');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // trava scroll quando modal está aberto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const coinById = useMemo(() => {
    const m = new Map<string, Coin>();
    for (const c of coins) if (c?.id) m.set(c.id, c);
    return m;
  }, [coins]);

  const categoryOptions = useMemo(() => {
    // Só lista categorias que existem no map
    const idsInMap = new Set(Object.keys(catMap || {}));
    const base = categories
      .filter(c => c?.id && c?.name)
      .filter(c => idsInMap.size === 0 ? true : idsInMap.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    return base;
  }, [categories, catMap]);

  const filteredCoins = useMemo(() => {
    if (!selectedCategoryId) return coins;

    const ids = Array.isArray(catMap?.[selectedCategoryId]) ? catMap[selectedCategoryId] : [];
    if (!ids.length) return [];

    const uniq = Array.from(new Set(ids));
    const arr = uniq.map(id => coinById.get(id)).filter(Boolean) as Coin[];
    return arr;
  }, [selectedCategoryId, coins, catMap, coinById]);

  const points = useMemo(() => {
    return buildPoints(filteredCoins, valueMode);
  }, [filteredCoins, valueMode]);

  const subtitle = useMemo(() => {
    const modeText = valueMode === 'marketcap' ? 'Área = Market Cap' : 'Área = |Variação 24h|';
    const catText = selectedCategoryId
      ? `Categoria filtrada`
      : 'Todas as moedas';
    return `${catText} • Cor = Variação 24h • ${modeText}`;
  }, [valueMode, selectedCategoryId]);

  // Render chart
  useEffect(() => {
    if (!open) return;
    if (!containerRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    if (points.length === 0 && !loading) {
        return; // Don't render empty chart if data isn't ready
    }

    const chart = Highcharts.chart(containerRef.current, {
      chart: {
        backgroundColor: '#252931',
        spacing: [10, 10, 10, 10],
        animation: true
      },
      title: {
        text: '',
        align: 'left',
        style: { color: 'white' }
      },
      subtitle: {
        text: subtitle,
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
        backgroundColor: 'rgba(18,20,26,0.96)',
        borderColor: 'rgba(255,255,255,0.10)',
        style: { color: 'white' },
        formatter: function () {
          // @ts-ignore
          const p: any = this.point;
          const c = p?.custom || {};
          const logo = c.logo
            ? `<img src="${c.logo}" style="width:18px;height:18px;border-radius:50%;vertical-align:-3px;margin-right:8px" />`
            : '';

          const line = (label: string, value: string) =>
            `<div style="display:flex;justify-content:space-between;gap:12px">
               <span style="opacity:.78">${label}</span>
               <span style="font-weight:800">${value}</span>
             </div>`;

          const nameLine = `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              ${logo}
              <div style="font-weight:900;font-size:13px;line-height:1.1">
                ${c.fullName || p.name}
                <div style="opacity:.75;font-weight:800;font-size:11px;margin-top:2px">
                  ${c.symbol ? c.symbol : p.name}${c.marketCapRank ? ` • Rank #${Math.round(c.marketCapRank)}` : ''}
                </div>
              </div>
            </div>
          `;

          const parts: string[] = [];
          parts.push(nameLine);

          if (Number.isFinite(c.price) && c.price) parts.push(line('Preço', fmtMoney(c.price)));
          if (Number.isFinite(c.change24h)) parts.push(line('Variação 24h', fmtPct(c.change24h)));
          if (Number.isFinite(c.priceChange24h) && c.priceChange24h) parts.push(line('Δ preço 24h', fmtMoney(c.priceChange24h)));

          if (Number.isFinite(c.marketCap) && c.marketCap) parts.push(line('Market Cap', fmtMoney(c.marketCap)));
          if (Number.isFinite(c.volume24h) && c.volume24h) parts.push(line('Volume 24h', fmtMoney(c.volume24h)));
          if (Number.isFinite(c.fdv) && c.fdv) parts.push(line('FDV', fmtMoney(c.fdv)));

          const supplyParts: string[] = [];
          if (Number.isFinite(c.circ) && c.circ) supplyParts.push(`Circ ${fmtNumber(c.circ)}`);
          if (Number.isFinite(c.total) && c.total) supplyParts.push(`Total ${fmtNumber(c.total)}`);
          if (Number.isFinite(c.max) && c.max) supplyParts.push(`Max ${fmtNumber(c.max)}`);
          if (supplyParts.length) {
            parts.push(`<div style="margin-top:6px;opacity:.8;font-weight:800;font-size:11px">Supply: ${supplyParts.join(' • ')}</div>`);
          }

          const rangeParts: string[] = [];
          if (Number.isFinite(c.low24) && c.low24) rangeParts.push(`Low ${fmtMoney(c.low24)}`);
          if (Number.isFinite(c.high24) && c.high24) rangeParts.push(`High ${fmtMoney(c.high24)}`);
          if (rangeParts.length) {
            parts.push(`<div style="margin-top:6px;opacity:.8;font-weight:800;font-size:11px">24h Range: ${rangeParts.join(' • ')}</div>`);
          }

          const athAtlParts: string[] = [];
          if (Number.isFinite(c.ath) && c.ath) athAtlParts.push(`ATH ${fmtMoney(c.ath)}`);
          if (Number.isFinite(c.atl) && c.atl) athAtlParts.push(`ATL ${fmtMoney(c.atl)}`);
          if (athAtlParts.length) {
            parts.push(`<div style="margin-top:6px;opacity:.8;font-weight:800;font-size:11px">${athAtlParts.join(' • ')}</div>`);
          }

          return `<div style="min-width:280px">${parts.join('')}</div>`;
        }
      },

      colorAxis: {
        min: -10,
        max: 10,
        stops: [
          [0, '#f73539'],
          [0.5, '#414555'],
          [1, '#2ecc59']
        ],
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
          allowDrillToNode: false,
          animationLimit: 1000,
          borderColor: '#252931',
          color: '#252931',
          opacity: 0.01,
          nodeSizeBy: 'leaf',
          colorKey: 'colorValue',
          data: points as any,

          dataLabels: {
            enabled: true,
            allowOverlap: false,
            useHTML: true,
            formatter: function () {
              // @ts-ignore
              const p: any = this.point;
              const c = p?.custom || {};
              const perf = Number.isFinite(c.change24h) ? fmtPct(c.change24h) : fmtPct(p.colorValue);
              return `<div style="text-align:center;line-height:1.05">
                        <div style="font-weight:900;color:white;text-shadow:none">${p.name}</div>
                        <div style="font-weight:900;color:white;opacity:.9;font-size:.85em">${perf}</div>
                      </div>`;
            },
            style: {
              textOutline: 'none'
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
  }, [open, points, subtitle, loading]);

  const canFilterCategory = useMemo(() => {
    return Object.keys(catMap || {}).length > 0 && categoryOptions.length > 0;
  }, [catMap, categoryOptions]);

  const header = (
    <div
      style={{
        padding: '12px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ color: 'white', fontWeight: 900, fontSize: 14 }}>
          Market Heatmap
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Toggle valor */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 800, fontSize: 12 }}>Área:</span>

            <button
              onClick={() => setValueMode('marketcap')}
              style={{
                padding: '7px 10px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.15)',
                background: valueMode === 'marketcap' ? 'rgba(46,204,89,0.18)' : 'rgba(255,255,255,0.06)',
                color: 'white',
                fontWeight: 900,
                cursor: 'pointer'
              }}
            >
              Market Cap
            </button>

            <button
              onClick={() => setValueMode('var24h')}
              style={{
                padding: '7px 10px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.15)',
                background: valueMode === 'var24h' ? 'rgba(247,53,57,0.18)' : 'rgba(255,255,255,0.06)',
                color: 'white',
                fontWeight: 900,
                cursor: 'pointer'
              }}
            >
              Var 24h
            </button>
          </div>

          {/* Dropdown categorias */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 800, fontSize: 12 }}>Categoria:</span>

            <select
              value={selectedCategoryId}
              onChange={e => setSelectedCategoryId(e.target.value)}
              disabled={!canFilterCategory}
              style={{
                padding: '7px 10px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(0,0,0,0.25)',
                color: 'white',
                fontWeight: 900,
                cursor: canFilterCategory ? 'pointer' : 'not-allowed',
                minWidth: 260
              }}
              title={!canFilterCategory ? 'Categoria indisponível (taxonomy/map não carregou)' : ''}
            >
              <option value="">Todas</option>
              {categoryOptions.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status pequeno */}
          <div style={{ color: 'rgba(255,255,255,0.60)', fontWeight: 800, fontSize: 12 }}>
            {selectedCategoryId ? `Moedas na categoria: ${filteredCoins.length}` : `Moedas: ${coins.length}`}
            {loading ? ' • carregando…' : ''}
          </div>
        </div>
      </div>

      <button
        onClick={() => setOpen(false)}
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.18)',
          background: 'rgba(0,0,0,0.35)',
          color: 'white',
          fontWeight: 900,
          cursor: 'pointer'
        }}
        aria-label="Fechar"
        title="Fechar"
      >
        ✕
      </button>
    </div>
  );

  const footer = (
    <div
      style={{
        padding: '10px 14px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        color: 'rgba(255,255,255,0.60)',
        fontWeight: 800,
        fontSize: 12,
        gap: 12,
        flexWrap: 'wrap'
      }}
    >
      <span>
        Cor = variação 24h • {valueMode === 'marketcap' ? 'Área = Market Cap' : 'Área = |Var 24h|'}
      </span>
    </div>
  );

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
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {header}

          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            {!!err && (
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
                  fontWeight: 900,
                  maxWidth: 680
                }}
              >
                {err}
              </div>
            )}

            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
          </div>

          {footer}
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
