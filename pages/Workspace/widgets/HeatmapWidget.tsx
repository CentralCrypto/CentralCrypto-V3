import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Highcharts from 'highcharts';
import TreemapModule from 'highcharts/modules/treemap';
import ExportingModule from 'highcharts/modules/exporting';
import AccessibilityModule from 'highcharts/modules/accessibility';
import { DashboardItem, Language } from '../../../types';

type ValueMode = 'marketcap' | 'var24h';

type Coin = {
  id: string;
  symbol?: string;
  name?: string;
  image?: string;

  current_price?: number;
  market_cap?: number;
  market_cap_rank?: number;
  total_volume?: number;

  price_change_percentage_24h?: number;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;

  circulating_supply?: number;
  total_supply?: number;
  max_supply?: number;

  high_24h?: number;
  low_24h?: number;
  ath?: number;
};

type CategoryRow = { id: string; name: string };
type CategoryCoinsMap = Record<string, string[]>;

type TreemapPoint = {
  id: string;
  name: string;
  value: number;
  colorValue: number;
  custom?: any;
};

const ENDPOINTS = {
  COINS_LITE: '/cachecko/cachecko_lite.json',
  TAXONOMY: '/cachecko/categories/taxonomy-master.json',
  CAT_LIST: '/cachecko/categories/coingecko_categories_list.json',
  CAT_MAP: '/cachecko/categories/category_coins_map.json'
};

let HC_INITED = false;
function initHighchartsOnce() {
  if (HC_INITED) return;
  HC_INITED = true;

  try { (TreemapModule as any)(Highcharts); } catch {}
  try { (ExportingModule as any)(Highcharts); } catch {}
  try { (AccessibilityModule as any)(Highcharts); } catch {}

  Highcharts.setOptions({
    chart: {
      style: {
        fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
      }
    }
  });
}

function withCb(url: string) {
  const salt = Math.floor(Date.now() / 60000);
  return url.includes('?') ? `${url}&_cb=${salt}` : `${url}?_cb=${salt}`;
}

async function httpGetJson<T = any>(
  url: string,
  opts?: { timeoutMs?: number; retries?: number }
): Promise<T> {
  const timeoutMs = opts?.timeoutMs ?? 12000;
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

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function safeUpper(s?: string) {
  return (s || '').toUpperCase();
}
function fmtPct(v: number) {
  const n = safeNum(v);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}
function fmtMoney(v: number) {
  const n = safeNum(v);
  const a = Math.abs(n);

  if (a >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}
function fmtNum(v: number) {
  const n = safeNum(v);
  const a = Math.abs(n);
  if (a >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return `${n.toLocaleString()}`;
}
function fmtPrice(p: number) {
  const n = safeNum(p);
  if (n === 0) return '$0';
  if (n < 0.01) return `$${n.toFixed(6)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function colorFor(v: number) {
  const n = safeNum(v);
  return n >= 0 ? '#2ecc59' : '#f73539';
}

function normalizeCoins(raw: any): Coin[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Coin[];
  if (Array.isArray(raw?.data)) return raw.data as Coin[];
  if (Array.isArray(raw?.[0]?.data)) return raw[0].data as Coin[];
  return [];
}

function normalizeCategories(raw: any): CategoryRow[] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    const direct = raw
      .filter(x => x && (x.id || x.category_id) && (x.name || x.category_name))
      .map(x => ({
        id: String(x.id ?? x.category_id),
        name: String(x.name ?? x.category_name)
      }));
    if (direct.length) return direct;

    const maybe = raw.find(x => x && Array.isArray(x.data));
    if (maybe) return normalizeCategories(maybe.data);
  }

  if (raw?.data && Array.isArray(raw.data)) {
    return normalizeCategories(raw.data);
  }

  return [];
}

function normalizeCatMap(raw: any): CategoryCoinsMap {
  if (!raw) return {};
  if (raw.categories && typeof raw.categories === 'object') return raw.categories;
  if (raw.data && typeof raw.data === 'object') return raw.data;
  if (typeof raw === 'object') return raw;
  return {};
}

interface HeatmapWidgetProps {
  item?: DashboardItem;
  language?: Language;
}

export default function HeatmapWidget({ item, language }: HeatmapWidgetProps) {
  const [open, setOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>('');

  const [coins, setCoins] = useState<Coin[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [catMap, setCatMap] = useState<CategoryCoinsMap>({});

  const [valueMode, setValueMode] = useState<ValueMode>('marketcap');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<Highcharts.Chart | null>(null);

  useEffect(() => {
    initHighchartsOnce();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr('');

    try {
      const coinsRaw = await httpGetJson<any>(ENDPOINTS.COINS_LITE, { timeoutMs: 12000, retries: 2 });
      const coinArr = normalizeCoins(coinsRaw);
      setCoins(Array.isArray(coinArr) ? coinArr : []);

      const mapRaw = await httpGetJson<any>(ENDPOINTS.CAT_MAP, { timeoutMs: 12000, retries: 1 }).catch(() => ({}));
      const mapObj = normalizeCatMap(mapRaw);
      setCatMap(mapObj || {});

      // taxonomy pode falhar, então: taxonomy -> cat_list -> fallback ids do map
      let cats: CategoryRow[] = [];
      const taxRaw = await httpGetJson<any>(ENDPOINTS.TAXONOMY, { timeoutMs: 9000, retries: 0 }).catch(() => null);
      cats = normalizeCategories(taxRaw);

      if (!cats.length) {
        const listRaw = await httpGetJson<any>(ENDPOINTS.CAT_LIST, { timeoutMs: 9000, retries: 0 }).catch(() => null);
        cats = normalizeCategories(listRaw);
      }

      if (!cats.length) {
        const ids = Object.keys(mapObj || {});
        cats = ids.map(id => ({ id, name: id }));
      }

      cats = cats
        .filter(c => c && c.id && c.name)
        .sort((a, b) => a.name.localeCompare(b.name));

      setCategories(cats);
    } catch (e: any) {
      console.error('Heatmap load error:', e);
      setErr(e?.message || 'Falha ao carregar dados do heatmap');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // carrega uma vez (sem loop)
    loadData();
  }, [loadData]);

  // trava scroll ao abrir popup
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const hasCategories = categories.length > 0;

  const filteredCoins = useMemo(() => {
    let list = coins;

    if (selectedCategoryId && catMap[selectedCategoryId]) {
      const ids = new Set((catMap[selectedCategoryId] || []).map(String));
      list = list.filter(c => ids.has(String(c.id)));
    }

    return list;
  }, [coins, selectedCategoryId, catMap]);

  const chartData: TreemapPoint[] = useMemo(() => {
    const list = [...filteredCoins]
      .filter(c => c && c.id && (c.symbol || c.name))
      .sort((a, b) => safeNum(b.market_cap) - safeNum(a.market_cap))
      .slice(0, 450);

    return list.map(c => {
      const sym = safeUpper(c.symbol) || safeUpper(c.name) || c.id;
      const mc = Math.max(1, safeNum(c.market_cap));
      const ch24 = safeNum(c.price_change_percentage_24h);

      // tamanho = marketcap OU magnitude da var24h (escalada)
      const value =
        valueMode === 'marketcap'
          ? mc
          : Math.max(1, Math.abs(ch24) * 1000);

      return {
        id: String(c.id),
        name: sym,
        value,
        colorValue: ch24,
        custom: {
          fullName: c.name || c.id,
          logo: c.image || '',
          rank: safeNum(c.market_cap_rank),
          price: safeNum(c.current_price),

          change1h: safeNum(c.price_change_percentage_1h_in_currency),
          change24h: ch24,
          change7d: safeNum(c.price_change_percentage_7d_in_currency),

          marketCap: mc,
          volume24h: safeNum(c.total_volume),

          circulating: safeNum(c.circulating_supply),
          totalSupply: safeNum(c.total_supply),
          maxSupply: safeNum(c.max_supply),

          high24h: safeNum(c.high_24h),
          low24h: safeNum(c.low_24h),
          ath: safeNum(c.ath)
        }
      };
    });
  }, [filteredCoins, valueMode]);

  const renderChart = useCallback(() => {
    if (!containerRef.current) return;
    if (!chartData.length) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    chartRef.current = Highcharts.chart(containerRef.current, {
      chart: {
        backgroundColor: '#252931',
        animation: false,
        spacing: [10, 10, 10, 10]
      },
      title: { text: null },
      credits: { enabled: false },
      exporting: { enabled: false },
      accessibility: { enabled: true },
      tooltip: {
        useHTML: true,
        outside: true,
        followPointer: true,
        backgroundColor: 'rgba(20,20,25,0.96)',
        borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: 14,
        padding: 0,
        shadow: true,
        formatter: function () {
          const p: any = (this as any).point;
          const c = p?.custom || {};
          const full = c.fullName || p.name;

          const row = (label: string, value: string) => `
            <div style="display:flex; justify-content:space-between; gap:12px; margin-top:6px;">
              <span style="color:rgba(255,255,255,0.55); font-weight:800;">${label}</span>
              <span style="color:#fff; font-weight:900;">${value}</span>
            </div>
          `;

          return `
            <div style="min-width:280px; padding:12px 12px 10px; color:#fff; font-family:Inter,system-ui,sans-serif;">
              <div style="display:flex; align-items:center; gap:10px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.10);">
                ${c.logo ? `<img src="${c.logo}" style="width:28px;height:28px;border-radius:50%;"/>` : ''}
                <div style="min-width:0">
                  <div style="font-weight:1000; font-size:14px; line-height:1.1;">${p.name}</div>
                  <div style="color:rgba(255,255,255,0.6); font-size:11px; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:220px;">
                    ${full}${c.rank ? ` • #${c.rank}` : ''}
                  </div>
                </div>
              </div>

              <div style="margin-top:10px; font-size:18px; font-weight:1000;">
                ${fmtPrice(c.price)}
              </div>

              <div style="margin-top:10px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
                <div style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:8px; text-align:center;">
                  <div style="font-size:10px; color:rgba(255,255,255,0.55); font-weight:900;">1H</div>
                  <div style="font-size:12px; font-weight:1000; color:${colorFor(c.change1h)}">${fmtPct(c.change1h)}</div>
                </div>
                <div style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:8px; text-align:center;">
                  <div style="font-size:10px; color:rgba(255,255,255,0.55); font-weight:900;">24H</div>
                  <div style="font-size:12px; font-weight:1000; color:${colorFor(c.change24h)}">${fmtPct(c.change24h)}</div>
                </div>
                <div style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:8px; text-align:center;">
                  <div style="font-size:10px; color:rgba(255,255,255,0.55); font-weight:900;">7D</div>
                  <div style="font-size:12px; font-weight:1000; color:${colorFor(c.change7d)}">${fmtPct(c.change7d)}</div>
                </div>
              </div>

              <div style="margin-top:10px;">
                ${row('Market Cap', fmtMoney(c.marketCap))}
                ${row('Volume 24h', fmtMoney(c.volume24h))}
                ${row('Circulating', fmtNum(c.circulating))}
                ${row('Total Supply', c.totalSupply ? fmtNum(c.totalSupply) : '—')}
                ${row('Max Supply', c.maxSupply ? fmtNum(c.maxSupply) : '—')}
                ${row('High 24h', c.high24h ? fmtPrice(c.high24h) : '—')}
                ${row('Low 24h', c.low24h ? fmtPrice(c.low24h) : '—')}
                ${row('ATH', c.ath ? fmtPrice(c.ath) : '—')}
              </div>
            </div>
          `;
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
          style: { color: 'white', fontWeight: '700' },
          format: '{#gt value 0}+{value}{else}{value}{/gt}%'
        }
      },
      series: [
        {
          name: 'All',
          type: 'treemap',
          layoutAlgorithm: 'squarified',
          allowDrillToNode: false,
          animationLimit: 1000,
          borderColor: '#252931',
          borderWidth: 2,
          colorKey: 'colorValue',
          data: chartData as any,
          dataLabels: {
            enabled: true,
            useHTML: true,
            align: 'center',
            verticalAlign: 'middle',
            style: {
              textOutline: 'none'
            },
            formatter: function () {
              const p: any = (this as any).point;
              const w = p.shapeArgs?.width || 0;
              const h = p.shapeArgs?.height || 0;

              if (w < 40 || h < 28) return '';

              const fontSize = Math.min(30, Math.max(11, Math.round((w * h) * 0.00035)));
              const showLogo = w > 70 && h > 60 && p.custom?.logo;

              return `
                <div style="pointer-events:none; text-align:center; line-height:1.05;">
                  ${showLogo ? `<img src="${p.custom.logo}" style="width:${Math.min(28, fontSize + 6)}px;height:${Math.min(28, fontSize + 6)}px;border-radius:50%;margin-bottom:4px;"/>` : ''}
                  <div style="color:white; font-weight:1000; font-size:${fontSize}px; text-shadow:0 1px 2px rgba(0,0,0,0.75);">
                    ${p.name}
                  </div>
                  <div style="color:white; opacity:0.92; font-weight:900; font-size:${Math.max(10, Math.round(fontSize * 0.7))}px; text-shadow:0 1px 2px rgba(0,0,0,0.75);">
                    ${fmtPct(p.colorValue)}
                  </div>
                </div>
              `;
            }
          }
        } as any
      ]
    });

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
  }, [chartData]);

  useEffect(() => {
    if (!open) return;
    if (!containerRef.current) return;
    if (loading) return;

    // render e reflow “garantido” ao abrir modal
    const cleanup = renderChart();
    const t = setTimeout(() => chartRef.current?.reflow(), 60);

    return () => {
      clearTimeout(t);
      if (typeof cleanup === 'function') cleanup();
    };
  }, [open, loading, renderChart]);

  function close() {
    setOpen(false);
  }

  const modal = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(8px)'
      }}
      onMouseDown={(e) => {
        // não fecha clicando fora (você queria X, então X)
        e.stopPropagation();
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: 12
        }}
      >
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
          {/* HEADER */}
          <div
            style={{
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              borderBottom: '1px solid rgba(255,255,255,0.10)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{ color: '#fff', fontWeight: 1000, fontSize: 13, whiteSpace: 'nowrap' }}>
                Heatmap
              </div>

              {/* Toggle tamanho */}
              <div
                style={{
                  display: 'flex',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 12,
                  padding: 3,
                  gap: 4
                }}
              >
                <button
                  onClick={() => setValueMode('marketcap')}
                  style={{
                    cursor: 'pointer',
                    border: 'none',
                    borderRadius: 10,
                    padding: '7px 10px',
                    fontWeight: 1000,
                    fontSize: 11,
                    color: valueMode === 'marketcap' ? '#0b0d10' : 'rgba(255,255,255,0.75)',
                    background: valueMode === 'marketcap' ? '#dd9933' : 'transparent'
                  }}
                >
                  Tamanho: MKT CAP
                </button>
                <button
                  onClick={() => setValueMode('var24h')}
                  style={{
                    cursor: 'pointer',
                    border: 'none',
                    borderRadius: 10,
                    padding: '7px 10px',
                    fontWeight: 1000,
                    fontSize: 11,
                    color: valueMode === 'var24h' ? '#0b0d10' : 'rgba(255,255,255,0.75)',
                    background: valueMode === 'var24h' ? '#dd9933' : 'transparent'
                  }}
                >
                  Tamanho: |VAR 24H|
                </button>
              </div>

              {/* Dropdown categorias */}
              {hasCategories && (
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  style={{
                    maxWidth: 240,
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    color: 'rgba(255,255,255,0.9)',
                    fontWeight: 900,
                    fontSize: 12,
                    padding: '8px 10px',
                    borderRadius: 12,
                    outline: 'none'
                  }}
                  title="Filtrar por categoria"
                >
                  <option value="">Todas as categorias</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* X fechar */}
            <button
              onClick={close}
              style={{
                cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.06)',
                color: '#fff',
                borderRadius: 12,
                padding: '8px 12px',
                fontWeight: 1000,
                fontSize: 12
              }}
              aria-label="Fechar"
              title="Fechar"
            >
              ✕
            </button>
          </div>

          {/* BODY */}
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

            {loading && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.35)',
                  color: '#fff',
                  fontWeight: 900
                }}
              >
                Carregando…
              </div>
            )}

            {!loading && !chartData.length && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.20)',
                  color: 'rgba(255,255,255,0.85)',
                  fontWeight: 900,
                  padding: 20,
                  textAlign: 'center'
                }}
              >
                Nada para renderizar (sem moedas após filtro).
              </div>
            )}
          </div>

          {/* FOOTER (debug leve, sem botão) */}
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
              flexWrap: 'wrap'
            }}
          >
            <span>
              coins: {chartData.length} {selectedCategoryId ? `• cat=${selectedCategoryId}` : ''}
            </span>
            <span style={{ opacity: 0.9 }}>
              {err ? `Erro: ${err}` : `src: ${ENDPOINTS.COINS_LITE} • ${ENDPOINTS.TAXONOMY} • ${ENDPOINTS.CAT_MAP}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {/* Botão simples pra abrir o popup */}
      <button
        onClick={() => setOpen(true)}
        style={{
          cursor: 'pointer',
          border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(255,255,255,0.06)',
          color: '#fff',
          borderRadius: 12,
          padding: '10px 12px',
          fontWeight: 1000,
          fontSize: 12
        }}
        title="Abrir Heatmap"
      >
        Abrir Heatmap
      </button>

      {/* Mensagem de erro de load (sem overlay chato) */}
      {!loading && !!err && (
        <div style={{ marginTop: 10, color: '#ff6b6b', fontWeight: 900, fontSize: 12 }}>
          {err}
        </div>
      )}

      {open && createPortal(modal, document.body)}
    </div>
  );
}
