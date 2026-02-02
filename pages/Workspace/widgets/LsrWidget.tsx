import React, { useEffect, useMemo, useRef, useState } from 'react';
import Highcharts from 'highcharts/highstock';
import HC3D from 'highcharts/highcharts-3d';
import HCWheelZoom from 'highcharts/modules/mouse-wheel-zoom';
import { Loader2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

// ---- Highcharts module init (Vite/ESM-safe) ----
const init3D = (HC3D as any)?.default ?? HC3D;
const initWheelZoom = (HCWheelZoom as any)?.default ?? HCWheelZoom;

if (typeof init3D === 'function') init3D(Highcharts);
if (typeof initWheelZoom === 'function') initWheelZoom(Highcharts);

type Tf = '5m' | '1h' | '12h' | '1d';
type Sym = 'BTC' | 'ETH' | 'SOL';

type ExchangeRow = {
  exchange: string;
  buyRatio: number;   // long %
  sellRatio: number;  // short %
  buyVolUsd: number;  // long usd
  sellVolUsd: number; // short usd
  iconUrl?: string;
};

type ExchangeSnapshot = {
  updatedAt?: string;
  range: Tf;
  symbol: Sym;
  data: Array<{
    symbol: Sym;
    buyRatio: number;
    sellRatio: number;
    buyVolUsd: number;
    sellVolUsd: number;
    list: ExchangeRow[];
  }>;
};

type MarketPoint = {
  ts: number; // ms epoch
  price?: number;
  openInterest?: number;
  ls?: number;
  longVolUsd?: number;
  shortVolUsd?: number;
  liquidationUsd?: number;
};

type MarketHistory = {
  symbol: Sym;
  updatedAt: number;
  points: MarketPoint[];
};

const SYMBOLS: Sym[] = ['BTC', 'ETH', 'SOL'];
const TFS: Tf[] = ['5m', '1h', '12h', '1d'];

const cachePathForExchange = (sym: Sym, tf: Tf) => `/cachecko/lsr-exchange-${sym.toLowerCase()}-${tf}.json`;

// Se você ainda não tem o endpoint, pode trocar para um cache assim:
// /cachecko/lsr-market-btc.json
const apiPathForMarketHistory = (sym: Sym) => `/api/lsr/market-history?symbol=${sym}`;
const cachePathForMarketHistory = (sym: Sym) => `/cachecko/lsr-market-${sym.toLowerCase()}.json`;

const fmtUSD = (v: number) => {
  const n = Number.isFinite(v) ? v : 0;
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(0)}`;
};

const fmtPct = (v: number) => `${(Number.isFinite(v) ? v : 0).toFixed(2)}%`;
const fmtLSR = (v: number) => (Number.isFinite(v) ? v.toFixed(3) : '-');

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const sortByTotalVolDesc = (rows: ExchangeRow[]) =>
  [...rows].sort((a, b) => (b.buyVolUsd + b.sellVolUsd) - (a.buyVolUsd + a.sellVolUsd));

const Skeleton = ({ h = 180 }: { h?: number }) => (
  <div className="animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" style={{ height: h }} />
);

const Badge = ({ children }: { children: React.ReactNode }) => (
  <span className="px-2 py-1 rounded-md text-xs font-black bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200">
    {children}
  </span>
);

// Fetch JSON robusto: evita o erro "Unexpected token '<'"
async function fetchJsonStrict(url: string): Promise<any> {
  const res = await fetch(url, { cache: 'no-store' });
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} (${url})${text ? ` | ${text.slice(0, 80)}...` : ''}`);
  }
  if (!ct.includes('application/json')) {
    const text = await res.text().catch(() => '');
    // se vier HTML (<!DOCTYPE ...), estoura aqui com mensagem clara
    throw new Error(`Resposta não é JSON (${url}). Recebi: ${text.slice(0, 60)}...`);
  }
  return res.json();
}

export default function LsrCockpitPage() {
  const [symbol, setSymbol] = useState<Sym>('BTC');
  const [tf, setTf] = useState<Tf>('5m');

  const [exchangeSnap, setExchangeSnap] = useState<ExchangeSnapshot | null>(null);
  const [marketHist, setMarketHist] = useState<MarketHistory | null>(null);

  const [loadingExchange, setLoadingExchange] = useState(false);
  const [loadingMarket, setLoadingMarket] = useState(false);
  const [errorExchange, setErrorExchange] = useState<string | null>(null);
  const [errorMarket, setErrorMarket] = useState<string | null>(null);

  const [showTable, setShowTable] = useState(true);
  const [barsMode, setBarsMode] = useState<'usd' | 'ratio'>('usd');

  const [sortKey, setSortKey] = useState<'exchange' | 'longPct' | 'shortPct' | 'longUsd' | 'shortUsd' | 'totalUsd'>('totalUsd');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const pulseChartRef = useRef<Highcharts.Chart | null>(null);
  const barsChartRef = useRef<Highcharts.Chart | null>(null);

  // --- Fetch Exchange Snapshot (cache) ---
  useEffect(() => {
    let alive = true;
    const run = async () => {
      setLoadingExchange(true);
      setErrorExchange(null);
      try {
        const url = cachePathForExchange(symbol, tf);
        const json = await fetchJsonStrict(url);
        if (!alive) return;

        const snap: ExchangeSnapshot = Array.isArray(json) ? json[0] : json;
        setExchangeSnap(snap);
      } catch (e: any) {
        if (!alive) return;
        setExchangeSnap(null);
        setErrorExchange(e?.message || 'Falha ao carregar snapshot de exchanges');
      } finally {
        if (!alive) return;
        setLoadingExchange(false);
      }
    };
    run();
    return () => { alive = false; };
  }, [symbol, tf]);

  // --- Fetch Market History (Pulse) ---
  useEffect(() => {
    let alive = true;
    const run = async () => {
      setLoadingMarket(true);
      setErrorMarket(null);

      try {
        // 1) tenta endpoint
        const json = await fetchJsonStrict(apiPathForMarketHistory(symbol));
        if (!alive) return;
        setMarketHist(json);
      } catch (e1: any) {
        // 2) fallback opcional: tenta cache local (se você criar)
        try {
          const json2 = await fetchJsonStrict(cachePathForMarketHistory(symbol));
          if (!alive) return;
          setMarketHist(json2);
        } catch (e2: any) {
          if (!alive) return;
          setMarketHist(null);
          setErrorMarket(e1?.message || e2?.message || 'Falha ao carregar histórico do mercado');
        }
      } finally {
        if (!alive) return;
        setLoadingMarket(false);
      }
    };

    run();
    return () => { alive = false; };
  }, [symbol]);

  // --- Compute Exchange Rows ---
  const exchangeRows = useMemo(() => {
    const list = exchangeSnap?.data?.[0]?.list || [];
    const cleaned = list
      .filter(x => x && x.exchange)
      .map(x => ({
        ...x,
        buyRatio: Number(x.buyRatio) || 0,
        sellRatio: Number(x.sellRatio) || 0,
        buyVolUsd: Number(x.buyVolUsd) || 0,
        sellVolUsd: Number(x.sellVolUsd) || 0,
      }));
    return sortByTotalVolDesc(cleaned);
  }, [exchangeSnap]);

  const exchangeIconByName = useMemo(() => {
    const m = new Map<string, string>();
    exchangeRows.forEach(r => {
      if (r.iconUrl) m.set(r.exchange, r.iconUrl);
    });
    return m;
  }, [exchangeRows]);

  const agg = useMemo(() => {
    const d = exchangeSnap?.data?.[0];
    if (!d) return null;
    return {
      buyRatio: Number(d.buyRatio) || 0,
      sellRatio: Number(d.sellRatio) || 0,
      buyVolUsd: Number(d.buyVolUsd) || 0,
      sellVolUsd: Number(d.sellVolUsd) || 0,
    };
  }, [exchangeSnap]);

  // --- Sort Table Rows ---
  const sortedTableRows = useMemo(() => {
    const rows = [...exchangeRows];
    const dir = sortDir === 'asc' ? 1 : -1;

    rows.sort((a, b) => {
      const aTotal = a.buyVolUsd + a.sellVolUsd;
      const bTotal = b.buyVolUsd + b.sellVolUsd;

      if (sortKey === 'totalUsd') return (aTotal - bTotal) * dir;

      const pick = (r: ExchangeRow) => {
        if (sortKey === 'exchange') return r.exchange.toLowerCase().charCodeAt(0);
        if (sortKey === 'longPct') return r.buyRatio;
        if (sortKey === 'shortPct') return r.sellRatio;
        if (sortKey === 'longUsd') return r.buyVolUsd;
        if (sortKey === 'shortUsd') return r.sellVolUsd;
        return 0;
      };

      return (pick(a) - pick(b)) * dir;
    });

    return rows;
  }, [exchangeRows, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(prev => (prev === 'desc' ? 'asc' : 'desc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  // --- Build Pulse Series ---
  const pulseSeries = useMemo(() => {
    const pts = marketHist?.points || [];
    const p = pts
      .filter(x => Number.isFinite(x.ts))
      .sort((a, b) => a.ts - b.ts);

    const price = p.map(x => [x.ts, Number(x.price) || 0]);
    const oi = p.map(x => [x.ts, Number(x.openInterest) || 0]);
    const lsr = p.map(x => [x.ts, Number(x.ls) || 0]);
    const liq = p.map(x => [x.ts, Number(x.liquidationUsd) || 0]);

    return { price, oi, lsr, liq };
  }, [marketHist]);

  // --- Render Pulse Chart ---
  useEffect(() => {
    if (loadingMarket || errorMarket) return;
    if (!marketHist || !pulseSeries.price.length) return;

    if (pulseChartRef.current) {
      pulseChartRef.current.destroy();
      pulseChartRef.current = null;
    }

    const el = document.getElementById('lsr-pulse-chart');
    if (!el) return;

    pulseChartRef.current = Highcharts.stockChart('lsr-pulse-chart', {
      chart: {
        backgroundColor: 'transparent',
        height: 480, // 👈 mais alto pra não cortar navigator/scrollbar
        animation: false,
        zooming: {
          mouseWheel: { enabled: true, sensitivity: 1.15 },
          type: 'x'
        },
        panning: { enabled: true, type: 'x' },
        panKey: 'shift'
      },
      title: { text: '' },
      credits: { enabled: false },
      rangeSelector: { enabled: false },
      navigator: { enabled: true },
      scrollbar: { enabled: true },
      xAxis: { type: 'datetime' },
      yAxis: [
        {
          title: { text: 'LSR' },
          opposite: false,
          min: 0,
          max: 3,
          gridLineColor: 'rgba(255,255,255,0.06)'
        },
        {
          title: { text: 'USD' },
          opposite: true,
          gridLineColor: 'rgba(255,255,255,0.06)',
          labels: { formatter: function () { return fmtUSD(Number((this as any).value)); } }
        }
      ],
      tooltip: {
        shared: true,
        borderWidth: 0,
        backgroundColor: 'rgba(17, 24, 39, 0.92)',
        style: { color: '#fff' }
      },
      plotOptions: {
        series: {
          animation: false,
          dataGrouping: { enabled: false }
        },
        column: { borderWidth: 0 }
      },
      series: [
        { type: 'line', name: 'LSR', yAxis: 0, data: pulseSeries.lsr, tooltip: { valueDecimals: 3 } },
        {
          type: 'line',
          name: 'Open Interest',
          yAxis: 1,
          data: pulseSeries.oi,
          tooltip: { pointFormatter: function () { return `<span>OI: <b>${fmtUSD(Number((this as any).y))}</b></span><br/>`; } }
        },
        {
          type: 'column',
          name: 'Liquidations',
          yAxis: 1,
          data: pulseSeries.liq,
          tooltip: { pointFormatter: function () { return `<span>Liq: <b>${fmtUSD(Number((this as any).y))}</b></span><br/>`; } }
        },
        {
          type: 'line',
          name: 'Price',
          yAxis: 1,
          data: pulseSeries.price,
          tooltip: { pointFormatter: function () { return `<span>Price: <b>${fmtUSD(Number((this as any).y))}</b></span><br/>`; } }
        }
      ]
    } as any);

    return () => {
      if (pulseChartRef.current) {
        pulseChartRef.current.destroy();
        pulseChartRef.current = null;
      }
    };
  }, [loadingMarket, errorMarket, marketHist, pulseSeries]);

  // --- Render 3D Bars Chart (STACKED: 1 bar per exchange) ---
  useEffect(() => {
    if (loadingExchange || errorExchange) return;
    if (!exchangeRows.length) return;

    if (barsChartRef.current) {
      barsChartRef.current.destroy();
      barsChartRef.current = null;
    }

    const el = document.getElementById('lsr-exchange-3d');
    if (!el) return;

    const categories = exchangeRows.map(x => x.exchange);

    // data points carry iconUrl for tooltip/labels
    const longData = exchangeRows.map(r => ({
      y: barsMode === 'ratio' ? clamp(r.buyRatio, 0, 100) : r.buyVolUsd,
      exchange: r.exchange,
      iconUrl: r.iconUrl || ''
    }));

    const shortData = exchangeRows.map(r => ({
      y: barsMode === 'ratio' ? clamp(r.sellRatio, 0, 100) : r.sellVolUsd,
      exchange: r.exchange,
      iconUrl: r.iconUrl || ''
    }));

    barsChartRef.current = Highcharts.chart('lsr-exchange-3d', {
      chart: {
        type: 'column',
        backgroundColor: 'transparent',
        height: 560, // 👈 mais alto pra caber tudo (legenda + labels)
        spacingBottom: 26,
        options3d: {
          enabled: true,
          alpha: 10,
          beta: 18,
          depth: 70,
          viewDistance: 25
        }
      },
      title: { text: '' },
      credits: { enabled: false },

      legend: {
        enabled: true,
        align: 'center',
        verticalAlign: 'bottom',
        margin: 14,
        padding: 8,
        itemStyle: { color: 'rgba(255,255,255,0.85)', fontWeight: '800' },
        itemHoverStyle: { color: 'rgba(255,255,255,1)' }
      },

      xAxis: {
        categories,
        lineColor: 'rgba(255,255,255,0.12)',
        tickLength: 0,
        labels: {
          useHTML: true,
          formatter: function () {
            const name = String((this as any).value);
            const icon = exchangeIconByName.get(name);
            if (!icon) {
              return `<div style="font-weight:800;color:rgba(255,255,255,0.75)">${name}</div>`;
            }
            return `
              <div style="display:flex;align-items:center;justify-content:center;gap:8px">
                <img src="${icon}" style="width:18px;height:18px;border-radius:4px;background:#fff;padding:1px" />
                <span style="font-weight:800;color:rgba(255,255,255,0.75)">${name}</span>
              </div>
            `;
          }
        }
      },

      yAxis: {
        min: 0,
        title: { text: barsMode === 'ratio' ? 'Long/Short (%)' : 'Volume (USD)' },
        gridLineColor: 'rgba(255,255,255,0.06)',
        labels: {
          formatter: function () {
            const v = Number((this as any).value);
            return barsMode === 'ratio' ? `${v.toFixed(0)}%` : fmtUSD(v);
          },
          style: { color: 'rgba(255,255,255,0.75)' }
        }
      },

      tooltip: {
        shared: true,
        useHTML: true,
        borderWidth: 0,
        backgroundColor: 'rgba(17, 24, 39, 0.92)',
        style: { color: '#fff' },
        formatter: function () {
          const ctx: any = this as any;
          const pts: any[] = ctx.points || [];

          const pLong = pts.find(p => p?.series?.name === 'Long');
          const pShort = pts.find(p => p?.series?.name === 'Short');

          const longY = Number(pLong?.y ?? 0);
          const shortY = Number(pShort?.y ?? 0);

          const longTxt = barsMode === 'ratio' ? `${longY.toFixed(2)}%` : fmtUSD(longY);
          const shortTxt = barsMode === 'ratio' ? `${shortY.toFixed(2)}%` : fmtUSD(shortY);

          const lsr = shortY > 0 ? (longY / shortY) : 0;

          const exName = String(ctx.x);
          const icon = exchangeIconByName.get(exName);

          const head = icon
            ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
                 <img src="${icon}" style="width:22px;height:22px;border-radius:6px;background:#fff;padding:1px" />
                 <div style="font-weight:900">${exName}</div>
               </div>`
            : `<div style="font-weight:900;margin-bottom:6px">${exName}</div>`;

          return `
            ${head}
            <div>Long: <b>${longTxt}</b></div>
            <div>Short: <b>${shortTxt}</b></div>
            <div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.12)">
              LSR: <b>${fmtLSR(lsr)}</b>
            </div>
          `;
        }
      },

      plotOptions: {
        column: {
          depth: 35,
          borderWidth: 0,
          stacking: 'normal', // 👈 empilha: 1 barra por exchange
          groupPadding: 0.15,
          pointPadding: 0.05
        },
        series: { animation: false }
      },

      series: [
        { name: 'Long', data: longData as any, showInLegend: true },
        { name: 'Short', data: shortData as any, showInLegend: true }
      ]
    } as any);

    return () => {
      if (barsChartRef.current) {
        barsChartRef.current.destroy();
        barsChartRef.current = null;
      }
    };
  }, [loadingExchange, errorExchange, exchangeRows, barsMode, exchangeIconByName]);

  // --- UI Header values ---
  const lastUpdated = useMemo(() => {
    const a = exchangeSnap?.updatedAt ? new Date(exchangeSnap.updatedAt).toLocaleString() : null;
    const b = marketHist?.updatedAt ? new Date(marketHist.updatedAt).toLocaleString() : null;
    return { exchange: a, market: b };
  }, [exchangeSnap, marketHist]);

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              LSR Cockpit
              <span className="ml-3 text-sm font-black text-white/60">{symbol} · {tf.toUpperCase()}</span>
            </h1>
            <p className="text-white/60 text-sm mt-1">
              Zoom no scroll e pan com Shift. Exchange 3D empilhado (1 barra por exchange).
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge>Pulse: OI + LSR + Liq + Price</Badge>
              <Badge>3D: Stack Long+Short</Badge>
              <Badge>Tooltip: LSR por exchange</Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center justify-start lg:justify-end">
            {/* Symbol */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-1 flex">
              {SYMBOLS.map(s => (
                <button
                  key={s}
                  onClick={() => setSymbol(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-black transition ${
                    symbol === s ? 'bg-[#dd9933] text-black' : 'text-white/70 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* TF */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-1 flex">
              {TFS.map(x => (
                <button
                  key={x}
                  onClick={() => setTf(x)}
                  className={`px-4 py-2 rounded-lg text-sm font-black transition ${
                    tf === x ? 'bg-[#dd9933] text-black' : 'text-white/70 hover:text-white'
                  }`}
                >
                  {x.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Bars Mode */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-1 flex">
              <button
                onClick={() => setBarsMode('usd')}
                className={`px-4 py-2 rounded-lg text-sm font-black transition ${
                  barsMode === 'usd' ? 'bg-[#dd9933] text-black' : 'text-white/70 hover:text-white'
                }`}
              >
                USD
              </button>
              <button
                onClick={() => setBarsMode('ratio')}
                className={`px-4 py-2 rounded-lg text-sm font-black transition ${
                  barsMode === 'ratio' ? 'bg-[#dd9933] text-black' : 'text-white/70 hover:text-white'
                }`}
              >
                %
              </button>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
          {/* Pulse */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 relative overflow-visible">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-black text-white/80 uppercase tracking-widest">Market Pulse</div>
                <div className="text-xs text-white/50 mt-1">
                  {lastUpdated.market ? `Atualizado: ${lastUpdated.market}` : 'Sem timestamp'}
                </div>
              </div>
              {loadingMarket && <Loader2 className="animate-spin text-[#dd9933]" size={18} />}
            </div>

            {errorMarket ? (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 flex gap-2">
                <AlertTriangle size={18} className="mt-0.5" />
                <div className="text-sm">
                  <div className="font-black">Falha no Market Pulse</div>
                  <div className="opacity-80">{errorMarket}</div>
                  <div className="opacity-70 mt-1">
                    Isso acontece quando o endpoint devolve HTML (SPA/404). Se você ainda não tem o endpoint,
                    crie um cache em {cachePathForMarketHistory(symbol)} e ele vai cair no fallback.
                  </div>
                </div>
              </div>
            ) : loadingMarket ? (
              <Skeleton h={480} />
            ) : (
              <div id="lsr-pulse-chart" className="min-h-[480px]" />
            )}

            <div className="mt-3 text-xs text-white/50">
              Pan: Shift + arrastar. Zoom: scroll.
            </div>
          </div>

          {/* 3D Bars */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 relative overflow-visible">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-black text-white/80 uppercase tracking-widest">Exchange 3D</div>
                <div className="text-xs text-white/50 mt-1">
                  {lastUpdated.exchange ? `Atualizado: ${lastUpdated.exchange}` : 'Sem timestamp'}
                </div>
              </div>
              {loadingExchange && <Loader2 className="animate-spin text-[#dd9933]" size={18} />}
            </div>

            {errorExchange ? (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 flex gap-2">
                <AlertTriangle size={18} className="mt-0.5" />
                <div className="text-sm">
                  <div className="font-black">Falha no snapshot de Exchanges</div>
                  <div className="opacity-80">{errorExchange}</div>
                </div>
              </div>
            ) : loadingExchange ? (
              <Skeleton h={560} />
            ) : (
              <div id="lsr-exchange-3d" className="min-h-[560px]" />
            )}

            {agg && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-black/20 border border-white/10 p-3">
                  <div className="text-xs text-white/50 uppercase font-black tracking-widest">Aggregated Long</div>
                  <div className="text-lg font-black mt-1">{fmtPct(agg.buyRatio)}</div>
                  <div className="text-sm text-white/70">{fmtUSD(agg.buyVolUsd)}</div>
                </div>
                <div className="rounded-xl bg-black/20 border border-white/10 p-3">
                  <div className="text-xs text-white/50 uppercase font-black tracking-widest">Aggregated Short</div>
                  <div className="text-lg font-black mt-1">{fmtPct(agg.sellRatio)}</div>
                  <div className="text-sm text-white/70">{fmtUSD(agg.sellVolUsd)}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-black text-white/80 uppercase tracking-widest">Exchanges Table</div>
              <div className="text-xs text-white/50 mt-1">
                Clique nos headers para ordenar.
              </div>
            </div>
            <button
              onClick={() => setShowTable(v => !v)}
              className="px-3 py-2 rounded-xl bg-black/20 border border-white/10 hover:bg-black/30 transition flex items-center gap-2 text-sm font-black"
            >
              {showTable ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {showTable ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>

          {showTable && (
            <div className="mt-4 overflow-auto rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#0b0e11]">
                  <tr className="text-white/70">
                    <th className="p-3 text-left cursor-pointer" onClick={() => toggleSort('exchange')}>Exchange</th>
                    <th className="p-3 text-right cursor-pointer" onClick={() => toggleSort('longPct')}>Long %</th>
                    <th className="p-3 text-right cursor-pointer" onClick={() => toggleSort('shortPct')}>Short %</th>
                    <th className="p-3 text-right cursor-pointer" onClick={() => toggleSort('longUsd')}>Long USD</th>
                    <th className="p-3 text-right cursor-pointer" onClick={() => toggleSort('shortUsd')}>Short USD</th>
                    <th className="p-3 text-right cursor-pointer" onClick={() => toggleSort('totalUsd')}>Total USD</th>
                    <th className="p-3 text-right">LSR</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingExchange ? (
                    <tr><td colSpan={7} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-[#dd9933]" /></td></tr>
                  ) : errorExchange ? (
                    <tr><td colSpan={7} className="p-6 text-red-200">{errorExchange}</td></tr>
                  ) : (
                    sortedTableRows.map((r) => {
                      const total = r.buyVolUsd + r.sellVolUsd;
                      const lsr = r.sellVolUsd > 0 ? (r.buyVolUsd / r.sellVolUsd) : 0;
                      return (
                        <tr key={r.exchange} className="border-t border-white/10 hover:bg-white/5 transition">
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              {r.iconUrl ? (
                                <img src={r.iconUrl} alt="" className="w-7 h-7 rounded-lg bg-white p-0.5" loading="lazy" />
                              ) : (
                                <div className="w-7 h-7 rounded-lg bg-white/10" />
                              )}
                              <div className="font-black text-white">{r.exchange}</div>
                            </div>
                          </td>
                          <td className="p-3 text-right font-black text-emerald-300">{fmtPct(r.buyRatio)}</td>
                          <td className="p-3 text-right font-black text-rose-300">{fmtPct(r.sellRatio)}</td>
                          <td className="p-3 text-right text-white/80 font-mono">{fmtUSD(r.buyVolUsd)}</td>
                          <td className="p-3 text-right text-white/80 font-mono">{fmtUSD(r.sellVolUsd)}</td>
                          <td className="p-3 text-right text-white font-mono font-black">{fmtUSD(total)}</td>
                          <td className="p-3 text-right text-[#dd9933] font-black font-mono">{fmtLSR(lsr)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
