import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Highcharts from 'highcharts';
import TreemapModule from 'highcharts/modules/treemap';
import ExportingModule from 'highcharts/modules/exporting';
import AccessibilityModule from 'highcharts/modules/accessibility';
import ColorAxisModule from 'highcharts/modules/coloraxis';
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
  fully_diluted_valuation?: number;
  total_volume?: number;

  high_24h?: number;
  low_24h?: number;

  price_change_24h?: number;
  price_change_percentage_24h?: number;
  price_change_percentage_24h_in_currency?: number;

  market_cap_change_24h?: number;
  market_cap_change_percentage_24h?: number;

  circulating_supply?: number;
  total_supply?: number;
  max_supply?: number;

  ath?: number;
  ath_change_percentage?: number;
  ath_date?: string;

  atl?: number;
  atl_change_percentage?: number;
  atl_date?: string;

  last_updated?: string;
};

type CacheckoLiteWrapper = {
  updated_at?: string;
  source?: string;
  stats?: any;
  data?: Coin[];
};

const ENDPOINTS = {
  COINS_LITE: '/cachecko/cachecko_lite.json'
};

let HC_INITED = false;
function initHighchartsOnce() {
  if (HC_INITED) return;
  HC_INITED = true;

  try { (TreemapModule as any)(Highcharts); } catch (e) { console.error(e); }
  try { (ExportingModule as any)(Highcharts); } catch (e) { console.error(e); }
  try { (AccessibilityModule as any)(Highcharts); } catch (e) { console.error(e); }
  try { (ColorAxisModule as any)(Highcharts); } catch (e) { console.error(e); }

  Highcharts.setOptions({
    chart: {
      style: {
        fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
      }
    }
  });
}

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function upper(s?: string) {
  return (s || '').toUpperCase();
}
function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
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
function withCb(url: string) {
  const salt = Math.floor(Date.now() / 60000);
  return url.includes('?') ? `${url}&_cb=${salt}` : `${url}?_cb=${salt}`;
}
async function httpGetJson<T = any>(url: string): Promise<T> {
  const r = await fetch(withCb(url), { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return (await r.json()) as T;
}
function normalizeCoins(raw: any): Coin[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    const first = raw[0] as CacheckoLiteWrapper | any;
    if (first && Array.isArray(first.data)) return first.data as Coin[];
    if (raw.length > 0 && raw[0] && typeof raw[0] === 'object' && 'id' in raw[0]) return raw as Coin[];
    const anyWithData = raw.find((x: any) => x && Array.isArray(x.data));
    if (anyWithData) return anyWithData.data as Coin[];
    return [];
  }
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
  item: DashboardItem;
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
  const roRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    initHighchartsOnce();
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const raw = await httpGetJson<any>(ENDPOINTS.COINS_LITE);
      const arr = dedupById(normalizeCoins(raw));
      setCoins(arr);
    } catch (e: any) {
      console.error('Heatmap load error:', e);
      setErr(e?.message || 'Falha ao carregar cachecko_lite.json');
      setCoins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const treemapData = useMemo(() => {
    const list = [...coins].filter(c => c && c.id && (c.symbol || c.name));
    list.sort((a, b) => safeNum(b.market_cap) - safeNum(a.market_cap));

    return list.map(c => {
      const sym = upper(c.symbol) || upper(c.name) || c.id;

      const ch24 =
        safeNum(c.price_change_percentage_24h_in_currency) ||
        safeNum(c.price_change_percentage_24h);

      const size =
        valueMode === 'marketcap'
          ? Math.max(1, safeNum(c.market_cap))
          : Math.max(0.0001, Math.abs(ch24));

      return {
        id: String(c.id),
        name: sym,
        value: size,
        colorValue: clamp(ch24, -10, 10),
        custom: {
          fullName: c.name || c.id,
          logo: c.image || '',
          rank: safeNum(c.market_cap_rank),

          price: safeNum(c.current_price),
          change24h: ch24,
          price_change_24h: safeNum(c.price_change_24h),

          marketCap: safeNum(c.market_cap),
          fdv: safeNum(c.fully_diluted_valuation),
          volume24h: safeNum(c.total_volume),

          high24h: safeNum(c.high_24h),
          low24h: safeNum(c.low_24h),

          marketCapChange24h: safeNum(c.market_cap_change_24h),
          marketCapChangePct24h: safeNum(c.market_cap_change_percentage_24h),

          circulating: safeNum(c.circulating_supply),
          totalSupply: safeNum(c.total_supply),
          maxSupply: safeNum(c.max_supply),

          ath: safeNum(c.ath),
          athChangePct: safeNum(c.ath_change_percentage),
          athDate: c.ath_date || '',

          atl: safeNum(c.atl),
          atlChangePct: safeNum(c.atl_change_percentage),
          atlDate: c.atl_date || '',

          lastUpdated: c.last_updated || ''
        }
      };
    });
  }, [coins, valueMode]);

  const destroyChart = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
  }, []);

  const renderChart = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 50) return;

    destroyChart();

    chartRef.current = Highcharts.chart(el, {
      chart: {
        backgroundColor: '#252931',
        animation: false,
        margin: [10, 10, 10, 10]
      },
      title: { text: null },
      subtitle: { text: null },
      credits: { enabled: false },
      exporting: { enabled: false },

      tooltip: {
        followPointer: true,
        outside: true,
        useHTML: true,
        backgroundColor: 'rgba(20,20,25,0.96)',
        borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: 14,
        padding: 0,
        formatter: function () {
          const p: any = (this as any).point;
          const c = p?.custom || {};

          const row = (label: string, value: string) => `
            <div style="display:flex; justify-content:space-between; gap:12px; margin-top:6px;">
              <span style="color:rgba(255,255,255,0.55); font-weight:900;">${label}</span>
              <span style="color:#fff; font-weight:1100;">${value}</span>
            </div>
          `;

          return `
            <div style="min-width:360px; padding:12px; color:#fff; font-family:Inter,system-ui,sans-serif;">
              <div style="display:flex; align-items:center; gap:10px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.10);">
                ${c.logo ? `<img src="${c.logo}" style="width:30px;height:30px;border-radius:50%;" />` : ''}
                <div style="min-width:0">
                  <div style="font-weight:1200; font-size:14px; line-height:1.1;">${p.name}${c.rank ? ` <span style="color:rgba(255,255,255,0.55); font-weight:900; font-size:12px;">#${c.rank}</span>` : ''}</div>
                  <div style="color:rgba(255,255,255,0.60); font-size:11px; font-weight:900; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:300px;">
                    ${c.fullName}${c.lastUpdated ? ` • ${c.lastUpdated}` : ''}
                  </div>
                </div>
              </div>

              <div style="margin-top:10px; display:flex; align-items:flex-end; justify-content:space-between; gap:10px;">
                <div style="font-size:20px; font-weight:1200;">${fmtPrice(c.price)}</div>
                <div style="font-size:14px; font-weight:1200; color:${colorFor(c.change24h)};">${fmtPct(c.change24h)}</div>
              </div>

              <div style="margin-top:10px;">
                ${row('Market Cap', fmtMoney(c.marketCap))}
                ${row('FDV', c.fdv ? fmtMoney(c.fdv) : '—')}
                ${row('Volume 24h', fmtMoney(c.volume24h))}
                ${row('MCap Δ 24h', `${fmtMoney(c.marketCapChange24h)} (${fmtPct(c.marketCapChangePct24h)})`)}
              </div>

              <div style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.10); padding-top:10px;">
                ${row('High 24h', c.high24h ? fmtPrice(c.high24h) : '—')}
                ${row('Low 24h', c.low24h ? fmtPrice(c.low24h) : '—')}
                ${row('Price Δ 24h', c.price_change_24h ? fmtPrice(c.price_change_24h) : '—')}
              </div>

              <div style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.10); padding-top:10px;">
                ${row('Circulating', c.circulating ? fmtNum(c.circulating) : '—')}
                ${row('Total Supply', c.totalSupply ? fmtNum(c.totalSupply) : '—')}
                ${row('Max Supply', c.maxSupply ? fmtNum(c.maxSupply) : '—')}
              </div>

              <div style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.10); padding-top:10px;">
                ${row('ATH', c.ath ? `${fmtPrice(c.ath)} (${fmtPct(c.athChangePct)})` : '—')}
                ${row('ATH Date', c.athDate || '—')}
                ${row('ATL', c.atl ? `${fmtPrice(c.atl)} (${fmtPct(c.atlChangePct)})` : '—')}
                ${row('ATL Date', c.atlDate || '—')}
              </div>
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
        labels: {
          style: { color: '#fff', fontWeight: '900' },
          format: '{#gt value 0}+{value}{else}{value}{/gt}%'
        }
      },

      series: [
        {
          type: 'treemap',
          layoutAlgorithm: 'squarified',
          allowDrillToNode: false,
          animationLimit: 1000,
          borderColor: '#252931',
          borderWidth: 1,
          colorKey: 'colorValue',
          colorAxis: 0,
          data: treemapData as any,

          dataLabels: {
            enabled: true,
            useHTML: true,
            allowOverlap: true,
            style: { textOutline: 'none' },
            formatter: function () {
              const p: any = (this as any).point;
              const c = p?.custom || {};
              const w = p.shapeArgs?.width || 0;
              const h = p.shapeArgs?.height || 0;

              if (w < 46 || h < 34) return '';

              const area = w * h;
              const symFont = Math.min(22, Math.max(11, Math.round(7 + area * 0.00025)));

              const showLogo = !!c.logo && w >= 68 && h >= 58;
              const logoSize = Math.min(30, Math.max(16, Math.round(symFont + 6)));

              const showPrice = w >= 92 && h >= 72;
              const priceTxt = fmtPrice(c.price);

              return `
                <div style="pointer-events:none; text-align:center; line-height:1.05;">
                  ${showLogo ? `<img src="${c.logo}" style="width:${logoSize}px;height:${logoSize}px;border-radius:50%;margin-bottom:4px; box-shadow:0 1px 2px rgba(0,0,0,0.6);" />` : ''}
                  <div style="color:white; font-weight:1200; font-size:${symFont}px; text-shadow:0 1px 2px rgba(0,0,0,0.75);">
                    ${p.name}
                  </div>
                  ${showPrice ? `
                    <div style="color:rgba(255,255,255,0.92); font-weight:1100; font-size:${Math.max(10, Math.round(symFont * 0.72))}px; text-shadow:0 1px 2px rgba(0,0,0,0.75); margin-top:2px;">
                      ${priceTxt}
                    </div>
                  ` : ''}
                </div>
              `;
            }
          }
        } as any
      ]
    } as any);
  }, [destroyChart, treemapData]);

  // render + reflow garantido com ResizeObserver
  useEffect(() => {
    if (!open) return;
    if (loading) return;

    const raf1 = requestAnimationFrame(() => {
      renderChart();
      const raf2 = requestAnimationFrame(() => {
        renderChart();
        chartRef.current?.reflow();
      });
      return () => cancelAnimationFrame(raf2);
    });

    const el = containerRef.current;
    if (el && !roRef.current) {
      roRef.current = new ResizeObserver(() => {
        if (!chartRef.current) return;
        chartRef.current.reflow();
      });
      roRef.current.observe(el);
    }

    return () => {
      cancelAnimationFrame(raf1);
      if (roRef.current && el) {
        roRef.current.unobserve(el);
      }
      destroyChart();
    };
  }, [open, loading, renderChart, destroyChart]);

  const close = useCallback(() => setOpen(false), []);

  if (!open) return null;

  return (
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
          {/* HEADER sem texto Heatmap */}
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

          {/* CHART */}
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            <div
              ref={containerRef}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                background: '#252931'
              }}
            />

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

            {!loading && !err && treemapData.length === 0 && (
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
}
