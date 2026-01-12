import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Highcharts from 'highcharts';
import TreemapModule from 'highcharts/modules/treemap';
import ExportingModule from 'highcharts/modules/exporting';
import AccessibilityModule from 'highcharts/modules/accessibility';
import { X } from 'lucide-react';
import type { DashboardItem, Language } from '../../../types';

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
  market_cap_change_24h?: number;
  market_cap_change_percentage_24h?: number;
  circulating_supply?: number;
  total_supply?: number;
  max_supply?: number | null;
  ath?: number;
  ath_change_percentage?: number;
  ath_date?: string;
  atl?: number;
  atl_change_percentage?: number;
  atl_date?: string;
  last_updated?: string;
  price_change_percentage_24h_in_currency?: number;
};

type ValueMode = 'marketcap' | 'var24h';

const ENDPOINTS = {
  COINS_LITE: '/cachecko/cachecko_lite.json',
};

let HC_INITED = false;
function initHighchartsOnce() {
  if (HC_INITED) return;
  HC_INITED = true;

  try { (TreemapModule as any)(Highcharts); } catch {}
  try { (ExportingModule as any)(Highcharts); } catch {}
  try { (AccessibilityModule as any)(Highcharts); } catch {}

  Highcharts.setOptions({
    chart: { style: { fontFamily: 'Inter, system-ui, sans-serif' } },
    lang: { thousandsSep: ',' }
  });
}

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtCompactMoney(v: number) {
  const a = Math.abs(v);
  if (a >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(2)}K`;
  return `$${v.toFixed(2)}`;
}

function fmtCompactNum(v: number) {
  const a = Math.abs(v);
  if (a >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  return `${v.toFixed(2)}`;
}

function fmtPrice(p: number) {
  if (!Number.isFinite(p)) return '-';
  if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (p >= 1) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (p >= 0.01) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
  return `$${p.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
}

function fmtPct(v: number) {
  if (!Number.isFinite(v)) return '-';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

async function httpGetJson(url: string, timeoutMs = 15000, retries = 2) {
  const salt = Math.floor(Date.now() / 60000);
  const finalUrl = url.includes('?') ? `${url}&_cb=${salt}` : `${url}?_cb=${salt}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const r = await fetch(finalUrl, { cache: 'no-store', signal: ctrl.signal });
      if (!r.ok) throw new Error(`${finalUrl} -> ${r.status}`);
      return await r.json();
    } catch (e) {
      if (attempt === retries) throw e;
    } finally {
      window.clearTimeout(t);
    }
  }

  throw new Error('httpGetJson: unreachable');
}

// cachecko_lite pode vir como:
// 1) [{ updated_at,..., data:[coins...] }]
// 2) { data:[coins...] }
// 3) [coins...]
function extractCoins(raw: any): Coin[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    if (raw.length === 1 && raw[0] && Array.isArray(raw[0].data)) return raw[0].data as Coin[];
    if (raw.length > 0 && raw[0] && typeof raw[0] === 'object' && 'id' in raw[0]) return raw as Coin[];
    if (raw[0] && Array.isArray(raw[0]?.data)) return raw[0].data as Coin[];
    return [];
  }
  if (Array.isArray(raw.data)) return raw.data as Coin[];
  return [];
}

interface HeatmapWidgetProps {
  item: DashboardItem;
  language?: Language;
}

export default function HeatmapWidget({ item, language }: HeatmapWidgetProps) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [coins, setCoins] = useState<Coin[]>([]);
  const [valueMode, setValueMode] = useState<ValueMode>('marketcap');
  const [errMsg, setErrMsg] = useState<string>('');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<Highcharts.Chart | null>(null);

  useEffect(() => { initHighchartsOnce(); }, []);

  // trava scroll do body enquanto o popup estiver aberto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrMsg('');
    try {
      const raw = await httpGetJson(ENDPOINTS.COINS_LITE, 20000, 2);
      const list = extractCoins(raw);
      setCoins(list);
    } catch (e: any) {
      console.error('Heatmap load error', e);
      setErrMsg(e?.message || 'Falha ao carregar dados');
      setCoins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const { points, maxAbsChange } = useMemo(() => {
    const list = coins
      .filter(c => c && c.id && c.symbol)
      .map(c => {
        const change24 = safeNum(c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h);
        const mc = safeNum(c.market_cap);
        const price = safeNum(c.current_price);

        const sizeMarketCap = Math.max(1, mc);
        const sizeVar = Math.max(0.0001, Math.abs(change24)); // treemap precisa > 0

        return {
          id: String(c.id),
          name: String(c.symbol || '').toUpperCase(),
          value: valueMode === 'marketcap' ? sizeMarketCap : sizeVar,
          // IMPORTANTÍSSIMO: esse é o valor que vai pro colorAxis
          colorValue: change24,
          custom: {
            fullName: c.name || c.id,
            image: c.image,
            rank: safeNum(c.market_cap_rank),
            price,
            marketCap: mc,
            fdv: safeNum(c.fully_diluted_valuation),
            vol: safeNum(c.total_volume),
            high24: safeNum(c.high_24h),
            low24: safeNum(c.low_24h),
            chg24Abs: safeNum(c.price_change_24h),
            chg24Pct: change24,
            mcChgAbs: safeNum(c.market_cap_change_24h),
            mcChgPct: safeNum(c.market_cap_change_percentage_24h),
            circ: safeNum(c.circulating_supply),
            supply: safeNum(c.total_supply),
            maxSupply: c.max_supply ?? null,
            ath: safeNum(c.ath),
            athChg: safeNum(c.ath_change_percentage),
            atl: safeNum(c.atl),
            atlChg: safeNum(c.atl_change_percentage),
            updated: c.last_updated || ''
          }
        };
      });

    let maxAbs = 10;
    for (const p of list) maxAbs = Math.max(maxAbs, Math.abs(safeNum((p as any).colorValue)));
    maxAbs = Math.min(50, Math.ceil(maxAbs));
    return { points: list, maxAbsChange: maxAbs };
  }, [coins, valueMode]);

  // Cria o chart 1x
  useEffect(() => {
    if (!open) return;
    if (!containerRef.current) return;

    if (chartRef.current) {
      chartRef.current.reflow();
      return;
    }

    chartRef.current = Highcharts.chart(containerRef.current, {
      chart: {
        backgroundColor: '#111216',
        margin: [8, 8, 8, 8],
        animation: false,
        height: '100%'
      },
      title: { text: null },
      credits: { enabled: false },
      exporting: { enabled: false },
      accessibility: { enabled: true },

      tooltip: {
        useHTML: true,
        backgroundColor: 'rgba(15, 16, 20, 0.96)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 14,
        shadow: true,
        padding: 0,
        outside: true,
        followPointer: true,
        formatter: function () {
          // @ts-ignore
          const p = this.point as any;
          const c = p.custom || {};
          const isPos = safeNum(c.chg24Pct) >= 0;
          const accent = isPos ? '#2ecc59' : '#f73539';

          return `
            <div style="min-width: 280px; color: #fff; padding: 12px 12px 10px 12px;">
              <div style="display:flex; gap:10px; align-items:center; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.08);">
                ${c.image ? `<img src="${c.image}" style="width:34px; height:34px; border-radius:50%; background:#0b0c10;" />` : ''}
                <div style="min-width:0;">
                  <div style="font-weight:900; font-size:14px; letter-spacing:0.3px;">${p.name} <span style="opacity:0.7; font-weight:700; font-size:12px;">#${c.rank || '-'}</span></div>
                  <div style="opacity:0.75; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:220px;">${c.fullName || ''}</div>
                </div>
                <div style="margin-left:auto; font-weight:900; font-size:12px; color:${accent};">${fmtPct(safeNum(c.chg24Pct))}</div>
              </div>

              <div style="margin-top:10px; display:flex; justify-content:space-between; gap:10px;">
                <div>
                  <div style="opacity:0.65; font-size:10px;">Preço</div>
                  <div style="font-weight:900; font-size:18px;">${fmtPrice(safeNum(c.price))}</div>
                </div>
                <div style="text-align:right;">
                  <div style="opacity:0.65; font-size:10px;">Δ 24h</div>
                  <div style="font-weight:800; font-size:12px; color:${accent};">${fmtCompactMoney(safeNum(c.chg24Abs))} (${fmtPct(safeNum(c.chg24Pct))})</div>
                </div>
              </div>

              <div style="margin-top:10px; display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:8px;">
                  <div style="opacity:0.65; font-size:10px;">Market Cap</div>
                  <div style="font-weight:900; font-size:12px;">${fmtCompactMoney(safeNum(c.marketCap))}</div>
                  <div style="opacity:0.7; font-size:10px; margin-top:2px;">Δ ${fmtCompactMoney(safeNum(c.mcChgAbs))} (${fmtPct(safeNum(c.mcChgPct))})</div>
                </div>
                <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:8px;">
                  <div style="opacity:0.65; font-size:10px;">Volume 24h</div>
                  <div style="font-weight:900; font-size:12px;">${fmtCompactMoney(safeNum(c.vol))}</div>
                  <div style="opacity:0.7; font-size:10px; margin-top:2px;">FDV: ${fmtCompactMoney(safeNum(c.fdv))}</div>
                </div>
              </div>

              <div style="margin-top:10px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;">
                <div style="background:rgba(255,255,255,0.04); border-radius:10px; padding:8px;">
                  <div style="opacity:0.65; font-size:10px;">Low 24h</div>
                  <div style="font-weight:800; font-size:11px;">${fmtPrice(safeNum(c.low24))}</div>
                </div>
                <div style="background:rgba(255,255,255,0.04); border-radius:10px; padding:8px;">
                  <div style="opacity:0.65; font-size:10px;">High 24h</div>
                  <div style="font-weight:800; font-size:11px;">${fmtPrice(safeNum(c.high24))}</div>
                </div>
                <div style="background:rgba(255,255,255,0.04); border-radius:10px; padding:8px;">
                  <div style="opacity:0.65; font-size:10px;">Supply</div>
                  <div style="font-weight:800; font-size:11px;">${fmtCompactNum(safeNum(c.circ))}</div>
                </div>
              </div>

              <div style="margin-top:10px; opacity:0.55; font-size:10px;">
                ATH: ${fmtPrice(safeNum(c.ath))} (${fmtPct(safeNum(c.athChg))}) •
                ATL: ${fmtPrice(safeNum(c.atl))} (${fmtPct(safeNum(c.atlChg))})
              </div>
            </div>
          `;
        }
      },

      // ESCALA DE CORES (vermelho -> cinza -> verde)
      colorAxis: {
        min: -10,
        max: 10,
        stops: [
          [0, '#4b2c32'],   // vermelho (teu)
          [0.5, '#414555'], // neutro
          [1, '#264738']    // verde (teu)
        ],
        labels: {
          style: { color: '#cfd3dc' },
          format: '{#gt value 0}+{value}{else}{value}{/gt}%'
        }
      },

      legend: { enabled: false },
      plotOptions: {
        series: { animation: false }
      },

      series: [{
        type: 'treemap',
        name: 'All',
        layoutAlgorithm: 'squarified',
        allowDrillToNode: false,
        animationLimit: 1000,
        borderColor: '#111216',
        borderWidth: 1,
        opacity: 1,

        // CRÍTICO: garante que o treemap use colorAxis pelo colorValue
        colorAxis: 0,
        colorKey: 'colorValue',
        colorByPoint: false,

        // CRÍTICO: evita warning #12 com 2000 pontos (objetos)
        turboThreshold: 0,

        dataLabels: {
          enabled: true,
          useHTML: true,
          allowOverlap: true,
          style: { textOutline: 'none' },
          formatter: function () {
            // @ts-ignore
            const p = this.point as any;
            const w = p.shapeArgs?.width || 0;
            const h = p.shapeArgs?.height || 0;

            const showLogo = w >= 56 && h >= 44 && p.custom?.image;
            const showSymbol = w >= 44 && h >= 28;
            const showPrice = w >= 72 && h >= 52;

            if (!showSymbol && !showLogo && !showPrice) return '';

            const symFont = Math.min(18, Math.max(10, Math.floor(Math.min(w, h) / 4)));
            const priceFont = Math.max(9, Math.min(12, symFont - 4));
            const logoSize = Math.min(26, Math.max(14, Math.floor(Math.min(w, h) / 3.2)));

            const price = safeNum(p.custom?.price);
            const priceStr = fmtPrice(price);
            const priceTooLong = priceStr.length > 12 && w < 110;

            return `
              <div style="pointer-events:none; width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; line-height:1.05;">
                ${showLogo ? `<img src="${p.custom.image}" style="width:${logoSize}px; height:${logoSize}px; border-radius:50%; margin-bottom:3px; background:#0b0c10; box-shadow:0 2px 10px rgba(0,0,0,0.35);" />` : ''}
                ${showSymbol ? `<div style="font-weight:900; font-size:${symFont}px; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,0.65);">${p.name}</div>` : ''}
                ${showPrice && !priceTooLong ? `<div style="margin-top:2px; font-weight:800; font-size:${priceFont}px; opacity:0.92; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,0.65);">${priceStr}</div>` : ''}
              </div>
            `;
          }
        },

        data: []
      }] as any
    } as any);

    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      if (chartRef.current) chartRef.current.reflow();
    });
    if (el) ro.observe(el);

    return () => ro.disconnect();
  }, [open]);

  // Atualiza dados + min/max do colorAxis dinamicamente
  useEffect(() => {
    if (!open) return;
    if (!chartRef.current) return;

    const ch = chartRef.current;

    const maxAbs = Math.max(10, safeNum(maxAbsChange));
    const min = -maxAbs;
    const max = maxAbs;

    ch.update({ colorAxis: { min, max } } as any, false);

    const s0 = ch.series[0] as any;
    s0.setData(points as any, false, undefined, false);

    ch.redraw(false);
  }, [open, points, maxAbsChange]);

  useEffect(() => {
    if (open) return;
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
  }, [open]);

  if (!open) return null;

  const maxAbs = Math.max(10, safeNum(maxAbsChange));

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 overflow-hidden">
      <div className="absolute inset-0 flex flex-col bg-[#0f1014] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex bg-white/5 rounded p-0.5 shrink-0">
              <button
                onClick={() => setValueMode('marketcap')}
                className={[
                  'px-3 py-1 text-[11px] font-extrabold rounded transition-colors',
                  valueMode === 'marketcap' ? 'bg-[#dd9933] text-black' : 'text-gray-300 hover:text-white'
                ].join(' ')}
              >
                MarketCap
              </button>
              <button
                onClick={() => setValueMode('var24h')}
                className={[
                  'px-3 py-1 text-[11px] font-extrabold rounded transition-colors',
                  valueMode === 'var24h' ? 'bg-[#dd9933] text-black' : 'text-gray-300 hover:text-white'
                ].join(' ')}
              >
                Var.Preço 24Hs
              </button>
            </div>

            {/* Escala de cores no header (sem rodapé) */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-[10px] text-gray-400 whitespace-nowrap">
                -{maxAbs}%
              </div>
              <div
                className="h-2 w-[180px] rounded overflow-hidden border border-white/10 shrink-0"
                style={{
                  background: 'linear-gradient(90deg, #4b2c32 0%, #414555 50%, #264738 100%)'
                }}
                title="Escala de cor por Var.24Hs"
              />
              <div className="text-[10px] text-gray-400 whitespace-nowrap">
                +{maxAbs}%
              </div>

              <div className="text-[11px] text-gray-400 ml-2 truncate">
                {loading ? 'Carregando…' : `${coins.length.toLocaleString()} moedas`}
                {errMsg ? <span className="text-red-400 ml-2">{errMsg}</span> : null}
              </div>
            </div>
          </div>

          <button
            onClick={() => setOpen(false)}
            className="p-2 rounded hover:bg-white/5 text-gray-300 hover:text-white transition-colors shrink-0"
            aria-label="Fechar"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Chart */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          <div ref={containerRef} className="absolute inset-0" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-gray-300 text-sm">Carregando heatmap…</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
