import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Highcharts from 'highcharts';
import TreemapModule from 'highcharts/modules/treemap';
import ExportingModule from 'highcharts/modules/exporting';
import AccessibilityModule from 'highcharts/modules/accessibility';
import { DashboardItem, Language } from '../../../types';

// =====================
// TIPOS
// =====================
type Coin = {
  id: string;
  symbol?: string;
  name?: string;
  image?: string;

  current_price?: number;
  market_cap?: number;
  market_cap_rank?: number;

  total_volume?: number;
  volume_24h?: number;

  price_change_percentage_24h?: number;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;

  high_24h?: number;
  low_24h?: number;
  ath?: number;

  circulating_supply?: number;
  total_supply?: number;
  max_supply?: number;
  fully_diluted_valuation?: number;
};

type CategoryRow = { id: string; name: string };
type CategoryCoinsMap = Record<string, string[]>;
type ValueMode = 'marketcap' | 'var24h';

// =====================
// HIGHCHARTS INIT
// =====================
let HC_INITED = false;
function initHighchartsOnce() {
  if (HC_INITED) return;
  HC_INITED = true;

  try { (TreemapModule as any)(Highcharts); } catch (e) { console.error(e); }
  try { (ExportingModule as any)(Highcharts); } catch {}
  try { (AccessibilityModule as any)(Highcharts); } catch {}

  Highcharts.setOptions({
    chart: { style: { fontFamily: 'Inter, system-ui, sans-serif' } }
  });

  // Ajuste de fonte por área (leve e útil)
  Highcharts.addEvent(Highcharts.Series, 'drawDataLabels', function () {
    // @ts-ignore
    if (this.type !== 'treemap') return;
    // @ts-ignore
    this.points.forEach((p: any) => {
      if (!p?.shapeArgs || !p?.dlOptions?.style) return;
      const area = Number(p.shapeArgs.width || 0) * Number(p.shapeArgs.height || 0);
      const px = Math.min(36, 9 + Math.round(area * 0.0008));
      p.dlOptions.style.fontSize = `${px}px`;
    });
  });
}

// =====================
// ENDPOINTS (HTTP)
// =====================
const ENDPOINTS = {
  COINS_LITE: '/cachecko/cachecko_lite.json'
};

// Fallbacks porque teu nome final pode variar
const TAXONOMY_CANDIDATES = [
  '/cachecko/categories/taxonomy-master.json',
  '/cachecko/categories/taxonomy_master.json',
  '/cachecko/categories/taxonomy.json',
  '/cachecko/categories/coingecko_categories_list.json',
  '/cachecko/categories/coingecko_categories_market.json'
];

const CATMAP_CANDIDATES = [
  '/cachecko/categories/category_coins_map.json',
  '/cachecko/categories/category-coins-map.json',
  '/cachecko/categories/category_coin_map.json',
  '/cachecko/categories/category-coin-map.json'
];

// =====================
// HTTP
// =====================
function withCb(url: string) {
  const salt = Math.floor(Date.now() / 60000);
  return url.includes('?') ? `${url}&_cb=${salt}` : `${url}?_cb=${salt}`;
}

async function httpGetJson(url: string, opts?: { timeoutMs?: number; retries?: number }) {
  const timeoutMs = opts?.timeoutMs ?? 12000;
  const retries = opts?.retries ?? 2;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(withCb(url), { cache: 'no-store', signal: ctrl.signal });
      if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (attempt === retries) throw e;
    } finally {
      window.clearTimeout(t);
    }
  }
  throw new Error('httpGetJson: unreachable');
}

async function loadFirstWorkingJson(candidates: string[]) {
  let last: any = null;
  for (const url of candidates) {
    try {
      const data = await httpGetJson(url, { timeoutMs: 12000, retries: 1 });
      return { url, data };
    } catch (e) {
      last = e;
    }
  }
  const msg = last?.message ? String(last.message) : 'unknown';
  throw new Error(`Falha ao carregar (tentativas): ${candidates.join(' | ')} | último erro: ${msg}`);
}

// =====================
// HELPERS
// =====================
function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function safeUpper(s?: string) { return (s || '').toUpperCase(); }

function fmtPct(v: number) {
  const n = Number.isFinite(v) ? v : 0;
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function fmtMoney(v: number) {
  const n = Number.isFinite(v) ? v : 0;
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtNumber(v: number) {
  const n = Number.isFinite(v) ? v : 0;
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return `${Math.round(n)}`;
}

// Normalizador: aceita array direto ou {data:[...]}
function normalizeCategories(raw: any): CategoryRow[] {
  const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x: any) => x && x.id && x.name)
    .map((x: any) => ({ id: String(x.id), name: String(x.name) }));
}

function normalizeCatMap(raw: any): CategoryCoinsMap {
  if (!raw) return {};
  if (raw?.categories && typeof raw.categories === 'object') return raw.categories;
  if (raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) return raw.data;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  return {};
}

// =====================
// COMPONENT
// =====================
interface HeatmapWidgetProps {
  item?: DashboardItem;
  language?: Language;
}

export default function HeatmapWidget({ item, language }: HeatmapWidgetProps) {
  const [open, setOpen] = useState(true);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>('');

  const [coins, setCoins] = useState<Coin[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [catMap, setCatMap] = useState<CategoryCoinsMap>({});

  const [valueMode, setValueMode] = useState<ValueMode>('marketcap');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  const [taxonomyUrl, setTaxonomyUrl] = useState<string>('');
  const [catMapUrl, setCatMapUrl] = useState<string>('');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<Highcharts.Chart | null>(null);

  useEffect(() => { initHighchartsOnce(); }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr('');

    try {
      const coinsData = await httpGetJson(ENDPOINTS.COINS_LITE, { timeoutMs: 15000, retries: 2 });

      let coinsArr: any[] = [];
      if (Array.isArray(coinsData)) coinsArr = coinsData;
      else if (Array.isArray(coinsData?.data)) coinsArr = coinsData.data;

      const tRes = await loadFirstWorkingJson(TAXONOMY_CANDIDATES).catch(() => ({ url: '', data: [] as any[] }));
      const mRes = await loadFirstWorkingJson(CATMAP_CANDIDATES).catch(() => ({ url: '', data: {} as any }));

      setCoins(coinsArr as Coin[]);
      setCategories(normalizeCategories(tRes.data));
      setCatMap(normalizeCatMap(mRes.data));

      setTaxonomyUrl(tRes.url || '');
      setCatMapUrl(mRes.url || '');

      if (!coinsArr.length) {
        setErr(`coins vazio/inesperado em ${ENDPOINTS.COINS_LITE}`);
      }
    } catch (e: any) {
      setErr(e?.message ? String(e.message) : 'Falha ao carregar dados do heatmap.');
      console.error('Heatmap load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // trava scroll quando popup aberto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const coinById = useMemo(() => {
    const m = new Map<string, Coin>();
    for (const c of coins) if (c?.id) m.set(c.id, c);
    return m;
  }, [coins]);

  const categoryOptions = useMemo(() => {
    const idsInMap = new Set(Object.keys(catMap || {}));
    return (categories || [])
      .filter(c => c?.id && c?.name)
      .filter(c => idsInMap.size === 0 ? true : idsInMap.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [categories, catMap]);

  const filteredCoins = useMemo(() => {
    if (!selectedCategoryId) return coins;
    const ids = Array.isArray(catMap?.[selectedCategoryId]) ? catMap[selectedCategoryId] : [];
    if (!ids.length) return [];
    const set = new Set(ids.map(String));
    return coins.filter(c => set.has(String(c.id)));
  }, [coins, selectedCategoryId, catMap]);

  const chartData = useMemo(() => {
    const list = filteredCoins;

    const sorted = [...list]
      .filter(c => c?.id && c?.symbol)
      .sort((a, b) => safeNum(b.market_cap) - safeNum(a.market_cap))
      .slice(0, 450);

    return sorted.map(c => {
      const change24 = safeNum(c.price_change_percentage_24h);
      const mc = Math.max(1, safeNum(c.market_cap));
      const vol = Math.max(1, safeNum(c.total_volume ?? c.volume_24h));

      // área: mcap OU volume (no teu botão você chamou de VOLUME)
      const value = valueMode === 'marketcap' ? mc : vol;

      return {
        id: c.id,
        name: safeUpper(c.symbol),
        value,
        colorValue: change24,
        custom: {
          fullName: c.name || c.id,
          logo: c.image,

          price: safeNum(c.current_price),
          rank: safeNum(c.market_cap_rank),

          change24,
          change1h: safeNum(c.price_change_percentage_1h_in_currency),
          change7d: safeNum(c.price_change_percentage_7d_in_currency),

          mcap: mc,
          vol: vol,

          fdv: safeNum(c.fully_diluted_valuation),
          circ: safeNum(c.circulating_supply),
          total: safeNum(c.total_supply),
          max: safeNum(c.max_supply),

          high24: safeNum(c.high_24h),
          low24: safeNum(c.low_24h),
          ath: safeNum(c.ath)
        }
      };
    });
  }, [filteredCoins, valueMode]);

  // RENDER CHART (com reflow/resize)
  useEffect(() => {
    if (!open) return;
    if (!containerRef.current) return;

    // Se o container ainda não tem tamanho, não tenta renderizar agora
    const w0 = containerRef.current.clientWidth;
    const h0 = containerRef.current.clientHeight;
    if (w0 < 10 || h0 < 10) return;

    if (!chartData.length) {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
      return;
    }

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    chartRef.current = Highcharts.chart(containerRef.current, {
      chart: {
        backgroundColor: '#252931',
        margin: 0,
        height: h0, // <- força altura real, evita 0px
        animation: false
      },
      title: { text: null },
      subtitle: { text: null },
      credits: { enabled: false },
      exporting: { enabled: false },

      tooltip: {
        useHTML: true,
        backgroundColor: 'rgba(20, 20, 25, 0.96)',
        borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: 12,
        shadow: true,
        padding: 0,
        followPointer: true,
        formatter: function () {
          // @ts-ignore
          const p: any = this.point;
          const c = p?.custom || {};
          const color = (v: number) => (v >= 0 ? '#2ecc59' : '#f73539');

          const line = (label: string, value: string) =>
            `<div style="display:flex;justify-content:space-between;gap:12px">
              <span style="opacity:.75">${label}</span>
              <span style="font-weight:900">${value}</span>
            </div>`;

          const supplyParts: string[] = [];
          if (c.circ) supplyParts.push(`Circ ${fmtNumber(c.circ)}`);
          if (c.total) supplyParts.push(`Total ${fmtNumber(c.total)}`);
          if (c.max) supplyParts.push(`Max ${fmtNumber(c.max)}`);

          const rangeParts: string[] = [];
          if (c.low24) rangeParts.push(`Low ${fmtMoney(c.low24)}`);
          if (c.high24) rangeParts.push(`High ${fmtMoney(c.high24)}`);

          return `
            <div style="font-family: Inter, system-ui, sans-serif; padding: 12px; min-width: 260px; color: white;">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.10);padding-bottom:8px;">
                ${c.logo ? `<img src="${c.logo}" style="width:24px;height:24px;border-radius:50%;">` : ''}
                <div>
                  <div style="font-weight: 950; font-size: 14px;">${p.name}</div>
                  <div style="font-size: 10px; color: #8a8f9b; text-transform: uppercase;">
                    ${c.fullName}${c.rank ? ` • #${Math.round(c.rank)}` : ''}
                  </div>
                </div>
              </div>

              ${c.price ? `<div style="font-size: 18px; font-weight: 950; margin-bottom: 8px;">${fmtMoney(c.price)}</div>` : ''}

              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center;background:rgba(255,255,255,0.05);padding:6px;border-radius:10px;">
                <div><div style="font-size:9px;opacity:.65">1H</div><div style="font-size:11px;font-weight:900;color:${color(c.change1h)}">${fmtPct(c.change1h)}</div></div>
                <div><div style="font-size:9px;opacity:.65">24H</div><div style="font-size:11px;font-weight:900;color:${color(c.change24)}">${fmtPct(c.change24)}</div></div>
                <div><div style="font-size:9px;opacity:.65">7D</div><div style="font-size:11px;font-weight:900;color:${color(c.change7d)}">${fmtPct(c.change7d)}</div></div>
              </div>

              <div style="margin-top:10px;display:grid;gap:6px;font-size:11px;">
                ${line('Market Cap', fmtMoney(c.mcap))}
                ${line('Volume 24h', fmtMoney(c.vol))}
                ${c.fdv ? line('FDV', fmtMoney(c.fdv)) : ''}
              </div>

              ${supplyParts.length ? `<div style="margin-top:10px;font-size:11px;opacity:.85"><b>Supply:</b> ${supplyParts.join(' • ')}</div>` : ''}
              ${rangeParts.length ? `<div style="margin-top:6px;font-size:11px;opacity:.85"><b>24h:</b> ${rangeParts.join(' • ')}</div>` : ''}
              ${c.ath ? `<div style="margin-top:6px;font-size:11px;opacity:.85"><b>ATH:</b> ${fmtMoney(c.ath)}</div>` : ''}
            </div>
          `;
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

      series: [{
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
        data: chartData as any,
        borderWidth: 1,
        dataLabels: {
          enabled: true,
          useHTML: true,
          style: { textOutline: 'none', color: '#fff' },
          formatter: function () {
            // @ts-ignore
            const p: any = this.point;
            const w = p.shapeArgs?.width || 0;
            const h = p.shapeArgs?.height || 0;
            if (w < 38 || h < 26) return '';

            const fontSize = Math.min(Math.max(10, w / 5), 40);
            const showLogo = w > 70 && h > 70 && p.custom?.logo;
            const logoSize = Math.min(30, Math.round(fontSize * 1.1));

            return `
              <div style="text-align:center;pointer-events:none;line-height:1.05;">
                ${showLogo ? `<img src="${p.custom.logo}" style="width:${logoSize}px;height:${logoSize}px;border-radius:50%;margin-bottom:4px;" /><br/>` : ''}
                <span style="font-size:${fontSize}px;font-weight:900;text-shadow:0 1px 2px rgba(0,0,0,0.8);">${p.name}</span><br/>
                <span style="font-size:${Math.max(10, fontSize * 0.7)}px;font-weight:900;opacity:.9;text-shadow:0 1px 2px rgba(0,0,0,0.8);">${fmtPct(p.colorValue)}</span>
              </div>
            `;
          }
        }
      }] as any
    } as any);

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      const h = containerRef.current.clientHeight;
      chartRef.current.setSize(undefined as any, h as any, false);
      chartRef.current.reflow();
    });

    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [open, chartData]);

  const hasCategories = categoryOptions.length > 0 && Object.keys(catMap || {}).length > 0;

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
            background: '#111216',
            boxShadow: '0 30px 90px rgba(0,0,0,0.55)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              background: '#111216'
            }}
          >
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 4 }}>
                <button
                  onClick={() => setValueMode('marketcap')}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 8,
                    border: '1px solid transparent',
                    background: valueMode === 'marketcap' ? '#dd9933' : 'transparent',
                    color: valueMode === 'marketcap' ? '#0b0d10' : 'rgba(255,255,255,0.75)',
                    fontWeight: 900,
                    cursor: 'pointer',
                    fontSize: 11
                  }}
                >
                  MKT CAP
                </button>
                <button
                  onClick={() => setValueMode('var24h')}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 8,
                    border: '1px solid transparent',
                    background: valueMode === 'var24h' ? '#dd9933' : 'transparent',
                    color: valueMode === 'var24h' ? '#0b0d10' : 'rgba(255,255,255,0.75)',
                    fontWeight: 900,
                    cursor: 'pointer',
                    fontSize: 11
                  }}
                >
                  VOLUME
                </button>
              </div>

              {hasCategories && (
                <select
                  value={selectedCategoryId}
                  onChange={e => setSelectedCategoryId(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: 11,
                    fontWeight: 900,
                    borderRadius: 10,
                    padding: '8px 10px',
                    outline: 'none',
                    minWidth: 260
                  }}
                >
                  <option value="">Todas as Categorias</option>
                  {categoryOptions.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}

              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 900 }}>
                {loading ? 'Carregando…' : `Coins: ${filteredCoins.length}`}
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
                cursor: 'pointer',
                fontSize: 18,
                lineHeight: '44px'
              }}
              aria-label="Fechar"
              title="Fechar"
            >
              ✕
            </button>
          </div>

          {/* Chart */}
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

            {!!err && (
              <div
                style={{
                  position: 'absolute',
                  left: 12,
                  bottom: 12,
                  zIndex: 5,
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.10)',
                  background: 'rgba(0,0,0,0.35)',
                  color: 'white',
                  fontWeight: 900,
                  maxWidth: 900
                }}
              >
                {err}
              </div>
            )}
          </div>

          {/* Footer debug (leve) */}
          <div
            style={{
              padding: '8px 12px',
              borderTop: '1px solid rgba(255,255,255,0.07)',
              color: 'rgba(255,255,255,0.45)',
              fontSize: 11,
              fontWeight: 800,
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
