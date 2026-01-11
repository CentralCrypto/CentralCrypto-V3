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
  price_change_percentage_24h_in_currency?: number;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;

  circulating_supply?: number;
  total_supply?: number;
  max_supply?: number;

  high_24h?: number;
  low_24h?: number;
  ath?: number;

  last_updated?: string;
};

type CacheckoLiteWrapper = {
  updated_at?: string;
  source?: string;
  stats?: any;
  data?: Coin[];
};

type TreemapPoint = {
  id: string;
  name: string;
  value: number;
  colorValue: number;
  custom?: any;
};

const ENDPOINTS = {
  COINS_LITE: '/cachecko/cachecko_lite.json'
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
  return safeNum(v) >= 0 ? '#2ecc59' : '#f73539';
}

function normalizeCoins(raw: any): Coin[] {
  if (!raw) return [];

  // Caso A: wrapper array -> pega o primeiro elemento com .data
  if (Array.isArray(raw)) {
    const first = raw[0] as CacheckoLiteWrapper | any;

    if (first && Array.isArray(first.data)) {
      return first.data as Coin[];
    }

    // Caso B: array já é lista de coins
    if (raw.length > 0 && raw[0] && typeof raw[0] === 'object' && 'id' in raw[0]) {
      return raw as Coin[];
    }

    // Caso C: algum item tem .data
    const anyWithData = raw.find((x: any) => x && Array.isArray(x.data));
    if (anyWithData) return anyWithData.data as Coin[];

    return [];
  }

  // Caso D: objeto com .data
  if (raw && Array.isArray(raw.data)) return raw.data as Coin[];

  return [];
}

function dedupById(coins: Coin[]) {
  const m = new Map<string, Coin>();
  for (const c of coins) {
    if (!c?.id) continue;
    if (!m.has(c.id)) m.set(c.id, c);
  }
  return Array.from(m.values());
}

interface HeatmapWidgetProps {
  item?: DashboardItem;
  language?: Language;
}

export default function HeatmapWidget({ item, language }: HeatmapWidgetProps) {
  const [open, setOpen] = useState(true);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>('');

  const [coins, setCoins] = useState<Coin[]>([]);
  const [valueMode, setValueMode] = useState<ValueMode>('marketcap');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<Highcharts.Chart | null>(null);

  useEffect(() => {
    initHighchartsOnce();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr('');

    try {
      const raw = await httpGetJson<any>(ENDPOINTS.COINS_LITE, { timeoutMs: 12000, retries: 2 });
      const arr = dedupById(normalizeCoins(raw));
      setCoins(arr);
    } catch (e: any) {
      console.error('Heatmap load error:', e);
      setErr(e?.message || 'Falha ao carregar dados do heatmap');
      setCoins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // trava scroll no popup
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const chartData: TreemapPoint[] = useMemo(() => {
    const list = [...coins]
      .filter(c => c && c.id && (c.symbol || c.name));

    // ordena só pra ficar mais “bonito” no layout
    list.sort((a, b) => safeNum(b.market_cap) - safeNum(a.market_cap));

    return list.map(c => {
      const sym = safeUpper(c.symbol) || safeUpper(c.name) || c.id;

      const ch24 =
        safeNum(c.price_change_percentage_24h_in_currency) ||
        safeNum(c.price_change_percentage_24h);

      const mc = Math.max(1, safeNum(c.market_cap));

      // tamanho do quadrado muda conforme toggle
      const value =
        valueMode === 'marketcap'
          ? mc
          : Math.max(0.01, Math.abs(ch24)); // variação (magnitude) como size

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
          ath: safeNum(c.ath),

          lastUpdated: c.last_updated || ''
        }
      };
    });
  }, [coins, valueMode]);

  const renderChart = useCallback(() => {
    if (!containerRef.current) return () => {};
    if (!chartData.length) return () => {};

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
              <span style="color:#fff; font-weight:1000;">${value}</span>
            </div>
          `;

          return `
            <div style="min-width:340px; padding:12px; color:#fff; font-family:Inter,system-ui,sans-serif;">
              <div style="display:flex; align-items:center; gap:10px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.10);">
                ${c.logo ? `<img src="${c.logo}" style="width:30px;height:30px;border-radius:50%;"/>` : ''}
                <div style="min-width:0">
                  <div style="font-weight:1100; font-size:14px; line-height:1.1;">${p.name}</div>
                  <div style="color:rgba(255,255,255,0.6); font-size:11px; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:280px;">
                    ${full}${c.rank ? ` • #${c.rank}` : ''}${c.lastUpdated ? ` • ${c.lastUpdated}` : ''}
                  </div>
                </div>
              </div>

              <div style="margin-top:10px; display:flex; align-items:flex-end; justify-content:space-between; gap:10px;">
                <div style="font-size:20px; font-weight:1100;">
                  ${fmtPrice(c.price)}
                </div>
                <div style="font-size:14px; font-weight:1100; color:${colorFor(c.change24h)};">
                  ${fmtPct(c.change24h)}
                </div>
              </div>

              <div style="margin-top:10px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
                <div style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:8px; text-align:center;">
                  <div style="font-size:10px; color:rgba(255,255,255,0.55); font-weight:900;">1H</div>
                  <div style="font-size:12px; font-weight:1100; color:${colorFor(c.change1h)}">${fmtPct(c.change1h)}</div>
                </div>
                <div style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:8px; text-align:center;">
                  <div style="font-size:10px; color:rgba(255,255,255,0.55); font-weight:900;">24H</div>
                  <div style="font-size:12px; font-weight:1100; color:${colorFor(c.change24h)}">${fmtPct(c.change24h)}</div>
                </div>
                <div style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:8px; text-align:center;">
                  <div style="font-size:10px; color:rgba(255,255,255,0.55); font-weight:900;">7D</div>
                  <div style="font-size:12px; font-weight:1100; color:${colorFor(c.change7d)}">${fmtPct(c.change7d)}</div>
                </div>
              </div>

              <div style="margin-top:10px;">
                ${row('Market Cap', fmtMoney(c.marketCap))}
                ${row('Volume 24h', fmtMoney(c.volume24h))}
                ${row('Circulating', c.circulating ? fmtNum(c.circulating) : '—')}
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
            style: { textOutline: 'none' },
            formatter: function () {
              const p: any = (this as any).point;
              const c = p?.custom || {};
              const w = p.shapeArgs?.width || 0;
              const h = p.shapeArgs?.height || 0;

              if (w < 46 || h < 34) return '';

              const area = w * h;
              const symFont = Math.min(24, Math.max(11, Math.round(7 + area * 0.00025)));

              const showLogo = !!c.logo && w >= 68 && h >= 58;
              const logoSize = Math.min(30, Math.max(16, Math.round(symFont + 6)));

              const showPrice = w >= 86 && h >= 68;
              const priceTxt = fmtPrice(c.price);

              return `
                <div style="pointer-events:none; text-align:center; line-height:1.05;">
                  ${showLogo ? `<img src="${c.logo}" style="width:${logoSize}px;height:${logoSize}px;border-radius:50%;margin-bottom:4px; box-shadow:0 1px 2px rgba(0,0,0,0.6);" />` : ''}
                  <div style="color:white; font-weight:1100; font-size:${symFont}px; text-shadow:0 1px 2px rgba(0,0,0,0.75);">
                    ${p.name}
                  </div>
                  ${showPrice ? `
                    <div style="color:rgba(255,255,255,0.92); font-weight:1000; font-size:${Math.max(10, Math.round(symFont * 0.72))}px; text-shadow:0 1px 2px rgba(0,0,0,0.75); margin-top:2px;">
                      ${priceTxt}
                    </div>
                  ` : ''}
                </div>
              `;
            }
          }
        } as any
      ]
    });

    const ro = new ResizeObserver(() => chartRef.current?.reflow());
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

    const cleanup = renderChart();
    const t = setTimeout(() => chartRef.current?.reflow(), 80);

    return () => {
      clearTimeout(t);
      cleanup?.();
    };
  }, [open, loading, renderChart]);

  function close() {
    setOpen(false);
  }

  if (!open) return null;

  const modal = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <div style={{ position: 'absolute', inset: 0, padding: 12 }}>
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
              <div style={{ color: '#fff', fontWeight: 1100, fontSize: 13, whiteSpace: 'nowrap' }}>
                Heatmap
              </div>

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
                    fontWeight: 1100,
                    fontSize: 11,
                    color: valueMode === 'marketcap' ? '#0b0d10' : 'rgba(255,255,255,0.75)',
                    background: valueMode === 'marketcap' ? '#dd9933' : 'transparent'
                  }}
                >
                  MarketCap
                </button>

                <button
                  onClick={() => setValueMode('var24h')}
                  style={{
                    cursor: 'pointer',
                    border: 'none',
                    borderRadius: 10,
                    padding: '7px 10px',
                    fontWeight: 1100,
                    fontSize: 11,
                    color: valueMode === 'var24h' ? '#0b0d10' : 'rgba(255,255,255,0.75)',
                    background: valueMode === 'var24h' ? '#dd9933' : 'transparent'
                  }}
                >
                  Var.Preço 24Hs
                </button>
              </div>

              <div style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 900, fontSize: 11, whiteSpace: 'nowrap' }}>
                {loading ? 'Carregando…' : `${chartData.length} moedas`}
              </div>
            </div>

            <button
              onClick={close}
              style={{
                cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.06)',
                color: '#fff',
                borderRadius: 12,
                padding: '8px 12px',
                fontWeight: 1100,
                fontSize: 12
              }}
              aria-label="Fechar"
              title="Fechar"
            >
              ✕
            </button>
          </div>

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

            {!loading && !!err && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.30)',
                  color: '#ff6b6b',
                  fontWeight: 1100,
                  padding: 20,
                  textAlign: 'center'
                }}
              >
                {err}
              </div>
            )}

            {!loading && !err && chartData.length === 0 && (
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
                Sem moedas para renderizar.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
