
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Highcharts from 'highcharts/highstock';
import HC3D from 'highcharts/highcharts-3d';
import HCWheelZoom from 'highcharts/modules/mouse-wheel-zoom';
import { Loader2, AlertTriangle, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { DashboardItem, Language } from '../../../types';
import { fetchLongShortRatio, LsrData } from '../../../services/api';
import { getTranslations } from '../../../locales';

const init3D = (HC3D as any)?.default ?? HC3D;
const initWheelZoom = (HCWheelZoom as any)?.default ?? HCWheelZoom;

if (typeof init3D === 'function') init3D(Highcharts);
if (typeof initWheelZoom === 'function') initWheelZoom(Highcharts);

type Tf = '5m' | '1h' | '12h' | '1d';
type Sym = 'BTC' | 'ETH' | 'SOL';

type ExchangeRow = {
  exchange: string;
  buyRatio: number;
  sellRatio: number;
  buyVolUsd: number;
  sellVolUsd: number;
  iconUrl?: string;
};

type ExchangeSnapshot = {
  updatedAt?: string;
  range: string;
  symbol: string;
  data: Array<{
    symbol: string;
    buyRatio: number;
    sellRatio: number;
    buyVolUsd: number;
    sellVolUsd: number;
    list: ExchangeRow[];
  }>;
};

type Lsr20Coin = {
  symbol: string;
  price?: number;
  marketCap?: number;
  openInterest?: number;
  volUsd?: number;
  liquidationUsd24h?: number;
  liquidationUsd12h?: number;
  liquidationUsd4h?: number;
  liquidationUsd1h?: number;
  ls5m?: number;
  ls15m?: number;
  ls30m?: number;
  ls1h?: number;
  ls4h?: number;
  ls12h?: number;
  ls24h?: number;
  longVolUsd5m?: number;
  shortVolUsd5m?: number;
  longVolUsd1h?: number;
  shortVolUsd1h?: number;
  longVolUsd12h?: number;
  shortVolUsd12h?: number;
  longVolUsd24h?: number;
  shortVolUsd24h?: number;
  iconUrl?: string;
};

const SYMBOLS: Sym[] = ['BTC', 'ETH', 'SOL'];
const TFS: Tf[] = ['5m', '1h', '12h', '1d'];

const cachePathForExchange = (sym: Sym, tf: Tf) => `/cachecko/lsr-exchange-${sym.toLowerCase()}-${tf}.json`;
const cachePathForTopCoins = () => `/cachecko/lsr-20-coins.json`;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

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

const sortByTotalVolDesc = (rows: ExchangeRow[]) =>
  [...rows].sort((a, b) => (b.buyVolUsd + b.sellVolUsd) - (a.buyVolUsd + a.sellVolUsd));

const Skeleton = ({ h = 180 }: { h?: number }) => (
  <div className="animate-pulse rounded-2xl bg-white/5 border border-white/10" style={{ height: h }} />
);

const Badge = ({ children }: { children: React.ReactNode }) => (
  <span className="px-2 py-1 rounded-md text-xs font-black bg-white/5 border border-white/10 text-white/80">
    {children}
  </span>
);

async function fetchJsonStrict(url: string): Promise<any> {
  const res = await fetch(url, { cache: 'no-store' });
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} (${url})${text ? ` | ${text.slice(0, 80)}...` : ''}`);
  }
  const raw = await res.text();
  const trimmed = raw.trim();
  if (!ct.includes('application/json')) {
    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
      throw new Error(`Resposta não é JSON (${url}). Recebi HTML (SPA/404).`);
    }
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`Conteúdo inválido (não é JSON) em ${url}.`);
  }
}

function pickLsrByTf(coin: Lsr20Coin, tf: Tf) {
  if (tf === '5m') return Number(coin.ls5m) || 0;
  if (tf === '1h') return Number(coin.ls1h) || 0;
  if (tf === '12h') return Number(coin.ls12h) || 0;
  return Number(coin.ls24h) || 0;
}

function pickLiqByTf(coin: Lsr20Coin, tf: Tf) {
  if (tf === '5m') return Number(coin.liquidationUsd1h) || 0;
  if (tf === '1h') return Number(coin.liquidationUsd1h) || 0;
  if (tf === '12h') return Number(coin.liquidationUsd12h) || 0;
  return Number(coin.liquidationUsd24h) || 0;
}

export function LsrCockpitPage() {
  const [symbol, setSymbol] = useState<Sym>('BTC');
  const [tf, setTf] = useState<Tf>('5m');

  const [exchangeSnap, setExchangeSnap] = useState<ExchangeSnapshot | null>(null);
  const [topCoins, setTopCoins] = useState<Lsr20Coin[]>([]);

  const [loadingExchange, setLoadingExchange] = useState(false);
  const [loadingPulse, setLoadingPulse] = useState(false);
  const [errorExchange, setErrorExchange] = useState<string | null>(null);
  const [errorPulse, setErrorPulse] = useState<string | null>(null);

  const [showTable, setShowTable] = useState(true);
  const [barsMode, setBarsMode] = useState<'usd' | 'ratio'>('usd');

  const [sortKey, setSortKey] = useState<'exchange' | 'longPct' | 'shortPct' | 'longUsd' | 'shortUsd' | 'totalUsd'>('totalUsd');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Series Toggles
  const [showLongs, setShowLongs] = useState(true);
  const [showShorts, setShowShorts] = useState(true);

  const pulseChartRef = useRef<Highcharts.Chart | null>(null);
  const barsChartRef = useRef<Highcharts.Chart | null>(null);
  
  // 3D Rotation State
  const rotationStartRef = useRef<{ x: number, y: number, alpha: number, beta: number } | null>(null);

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

  useEffect(() => {
    let alive = true;
    const run = async () => {
      setLoadingPulse(true);
      setErrorPulse(null);
      try {
        const json = await fetchJsonStrict(cachePathForTopCoins());
        if (!alive) return;

        let arr: any[] = [];
        if (Array.isArray(json)) {
          if (json.length && json[0]?.data && Array.isArray(json[0].data)) arr = json[0].data;
          else arr = json;
        } else if (json?.data && Array.isArray(json.data)) {
          arr = json.data;
        }

        const cleaned = arr
          .filter(x => x && x.symbol)
          .map(x => ({
            ...x,
            symbol: String(x.symbol).toUpperCase(),
            openInterest: Number(x.openInterest) || 0,
            volUsd: Number(x.volUsd) || 0
          })) as Lsr20Coin[];

        setTopCoins(cleaned);
      } catch (e: any) {
        if (!alive) return;
        setTopCoins([]);
        setErrorPulse(e?.message || 'Falha ao carregar /cachecko/lsr-20-coins.json');
      } finally {
        if (!alive) return;
        setLoadingPulse(false);
      }
    };
    run();
    return () => { alive = false; };
  }, []);

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

  const pulseCoin = useMemo(() => {
    const c = topCoins.find(x => String(x.symbol).toUpperCase() === symbol);
    return c || null;
  }, [topCoins, symbol]);

  const pulseMetrics = useMemo(() => {
    if (!pulseCoin) return null;

    const lsr = pickLsrByTf(pulseCoin, tf);
    const liq = pickLiqByTf(pulseCoin, tf);

    return {
      iconUrl: pulseCoin.iconUrl || '',
      price: Number(pulseCoin.price) || 0,
      openInterest: Number(pulseCoin.openInterest) || 0,
      volUsd: Number(pulseCoin.volUsd) || 0,
      liquidationUsd: Number(liq) || 0,
      lsr: Number(lsr) || 0
    };
  }, [pulseCoin, tf]);

  // Update Series Visibility without recreating chart
  useEffect(() => {
      if (barsChartRef.current) {
          const chart = barsChartRef.current;
          if (chart.series[0]) chart.series[0].setVisible(showLongs, false);
          if (chart.series[1]) chart.series[1].setVisible(showShorts, false);
          chart.redraw();
      }
  }, [showLongs, showShorts]);

  // 3D Interaction Handlers
  const handle3DMouseDown = (e: React.MouseEvent) => {
      if (barsChartRef.current) {
          const chart = barsChartRef.current;
          e.preventDefault();
          rotationStartRef.current = {
              x: e.clientX,
              y: e.clientY,
              alpha: chart.options.chart?.options3d?.alpha || 10,
              beta: chart.options.chart?.options3d?.beta || 18
          };
      }
  };

  const handle3DMouseMove = (e: React.MouseEvent) => {
      if (rotationStartRef.current && barsChartRef.current) {
          const start = rotationStartRef.current;
          const chart = barsChartRef.current;
          
          const sensitivity = 5;
          const newBeta = start.beta + (e.clientX - start.x) / sensitivity;
          const newAlpha = start.alpha + (e.clientY - start.y) / sensitivity;

          chart.update({
              chart: {
                  options3d: {
                      alpha: Math.max(0, Math.min(60, newAlpha)), // Limit Elevation
                      beta: newBeta
                  }
              }
          }, false, false, false); // No redraw for performance
          
          // Request simple redraw frame
          requestAnimationFrame(() => chart.redraw(false));
      }
  };

  const handle3DMouseUp = () => {
      rotationStartRef.current = null;
  };

  useEffect(() => {
    if (loadingPulse || errorPulse) return;
    if (!pulseMetrics) return;

    if (pulseChartRef.current) {
      pulseChartRef.current.destroy();
      pulseChartRef.current = null;
    }

    const el = document.getElementById('lsr-pulse-chart');
    if (!el) return;

    const categories = ['Open Interest', 'Volume', 'Liquidations', 'LSR'];

    const usdVals = [
      pulseMetrics.openInterest,
      pulseMetrics.volUsd,
      pulseMetrics.liquidationUsd,
      null
    ];

    const lsrVals = [
      null,
      null,
      null,
      pulseMetrics.lsr
    ];

    pulseChartRef.current = Highcharts.chart('lsr-pulse-chart', {
      chart: {
        backgroundColor: 'transparent',
        height: 520, // Reduced height
        animation: false,
        zooming: {
          mouseWheel: { enabled: true, sensitivity: 1.15 },
          type: 'x'
        },
        panning: { enabled: true, type: 'x' },
        panKey: 'shift',
        spacingBottom: 40, 
        marginBottom: 80
      },
      title: { text: '' },
      credits: { enabled: false },

      xAxis: {
        categories,
        lineColor: 'rgba(255,255,255,0.10)',
        tickColor: 'rgba(255,255,255,0.08)',
        labels: {
          style: {
            color: 'rgba(255,255,255,0.75)',
            fontWeight: '400'
          }
        }
      },

      yAxis: [
        {
          title: { text: 'USD' },
          gridLineWidth: 1,
          gridLineColor: 'rgba(255,255,255,0.05)',
          minorGridLineWidth: 0,
          lineWidth: 0,
          tickWidth: 0,
          labels: {
            style: { color: 'rgba(255,255,255,0.70)' },
            formatter: function () {
              return fmtUSD(Number((this as any).value));
            }
          }
        },
        {
          title: { text: 'LSR' },
          opposite: true,
          min: 0,
          max: 3,
          gridLineWidth: 0,
          lineWidth: 0,
          tickWidth: 0,
          labels: {
            style: { color: 'rgba(255,255,255,0.70)' },
            formatter: function () {
              return Number((this as any).value).toFixed(2);
            }
          }
        }
      ],

      legend: {
        enabled: true,
        align: 'center',
        verticalAlign: 'bottom',
        itemStyle: {
          color: 'rgba(255,255,255,0.75)',
          fontWeight: '400'
        }
      },

      tooltip: {
        shared: true,
        useHTML: true,
        borderWidth: 0,
        backgroundColor: 'rgba(17, 24, 39, 0.92)',
        style: { color: '#fff' },
        headerFormat: '',
        pointFormat: '',
        formatter: function () {
          const icon = pulseMetrics.iconUrl
            ? `<img src="${pulseMetrics.iconUrl}" style="width:22px;height:22px;border-radius:6px;background:#fff;padding:1px" />`
            : '';
          const head = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">${icon}<div style="font-weight:800">${symbol} · ${tf.toUpperCase()}</div></div>`;

          const usdLine = (label: string, val: number) => `<div>${label}: <b>${fmtUSD(val)}</b></div>`;

          return `
            ${head}
            ${usdLine('Open Interest', pulseMetrics.openInterest)}
            ${usdLine('Volume', pulseMetrics.volUsd)}
            ${usdLine('Liquidations', pulseMetrics.liquidationUsd)}
            <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.12)">
              LSR: <b>${fmtLSR(pulseMetrics.lsr)}</b>
            </div>
          `;
        }
      },

      plotOptions: {
        series: { animation: false }
      },

      series: [
        {
          type: 'column',
          name: 'USD Metrics',
          yAxis: 0,
          data: usdVals as any,
          color: 'rgba(221,153,51,0.70)',
          borderWidth: 0
        },
        {
          type: 'line',
          name: 'LSR',
          yAxis: 1,
          data: lsrVals as any,
          color: 'rgba(255,255,255,0.80)',
          lineWidth: 2,
          marker: { enabled: true, radius: 4 }
        }
      ]
    } as any);

    return () => {
      if (pulseChartRef.current) {
        pulseChartRef.current.destroy();
        pulseChartRef.current = null;
      }
    };
  }, [loadingPulse, errorPulse, pulseMetrics, symbol, tf]);

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

    // DARKER PASTEL COLORS
    const LONG_PASTEL = 'rgba(34, 197, 94, 0.85)'; // Emerald 500, higher opacity
    const SHORT_PASTEL = 'rgba(239, 68, 68, 0.85)'; // Red 500, higher opacity

    barsChartRef.current = Highcharts.chart('lsr-exchange-3d', {
      chart: {
        type: 'column',
        backgroundColor: 'transparent',
        height: 520, // Reduced from 740
        spacingBottom: 50,
        marginBottom: 90,
        options3d: {
          enabled: true,
          alpha: 10,
          beta: 18,
          depth: 250, // Increased depth for better look
          viewDistance: 25,
          frame: {
            bottom: { size: 1, color: 'rgba(255,255,255,0.05)' },
            side: { size: 1, color: 'rgba(255,255,255,0.05)' },
            back: { size: 1, color: 'rgba(255,255,255,0.05)' }
          }
        }
      },
      title: { text: '' },
      credits: { enabled: false },

      legend: {
        enabled: true,
        align: 'center',
        verticalAlign: 'bottom',
        margin: 10,
        padding: 10,
        itemStyle: {
          color: 'rgba(255,255,255,0.75)',
          fontWeight: '400'
        },
        itemHoverStyle: { color: 'rgba(255,255,255,1)' }
      },

      xAxis: {
        categories,
        gridLineWidth: 0,
        lineColor: 'rgba(255,255,255,0.10)',
        tickColor: 'rgba(255,255,255,0.08)',
        tickLength: 0,
        labels: {
          useHTML: false, // Turned off HTML
          style: {
              color: 'rgba(255,255,255,0.60)',
              fontSize: '10px',
              fontWeight: '600'
          },
          formatter: function () {
             return String(this.value); // Just the name
          }
        }
      },

      yAxis: {
        min: 0,
        title: { text: barsMode === 'ratio' ? 'Long/Short (%)' : 'Volume (USD)' },
        gridLineWidth: 1,
        gridLineColor: 'rgba(255,255,255,0.05)',
        minorGridLineWidth: 0,
        lineWidth: 0,
        tickWidth: 0,
        labels: {
          formatter: function () {
            const v = Number((this as any).value);
            return barsMode === 'ratio' ? `${v.toFixed(0)}%` : fmtUSD(v);
          },
          style: { color: 'rgba(255,255,255,0.70)', fontWeight: '400' }
        }
      },

      tooltip: {
        shared: true,
        useHTML: true,
        borderWidth: 0,
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        style: { color: '#fff' },
        headerFormat: '',
        pointFormat: '',
        formatter: function () {
          const ctx: any = this as any;
          const pts: any[] = ctx.points || [];

          const pLong = pts.find(p => p?.series?.name === 'Long');
          const pShort = pts.find(p => p?.series?.name === 'Short');
          
          // Get correct point to extract data from
          const point = pLong ? pLong.point : (pShort ? pShort.point : null);
          if (!point) return '';

          const exName = point.exchange;
          const icon = point.iconUrl;

          const longY = Number(pLong?.y ?? 0);
          const shortY = Number(pShort?.y ?? 0);

          const longTxt = barsMode === 'ratio' ? `${longY.toFixed(2)}%` : fmtUSD(longY);
          const shortTxt = barsMode === 'ratio' ? `${shortY.toFixed(2)}%` : fmtUSD(shortY);

          const lsr = shortY > 0 ? (longY / shortY) : 0;

          const head = icon
            ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                 <img src="${icon}" style="width:24px;height:24px;border-radius:6px;background:#fff;padding:1px" />
                 <div style="font-weight:900;font-size:14px;text-transform:uppercase;">${exName}</div>
               </div>`
            : `<div style="font-weight:900;font-size:14px;text-transform:uppercase;margin-bottom:8px">${exName}</div>`;

          return `
            ${head}
            <div>Long: <b style="color:#4ade80">${longTxt}</b></div>
            <div>Short: <b style="color:#f87171">${shortTxt}</b></div>
            <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.12)">
              LSR: <b style="color:#dd9933">${fmtLSR(lsr)}</b>
            </div>
          `;
        }
      },

      plotOptions: {
        column: {
          depth: 40, // Increased depth per column
          borderWidth: 0,
          stacking: 'normal',
          groupPadding: 0.1,
          pointPadding: 0.05,
          dataLabels: { enabled: false }
        },
        series: { animation: false }
      },

      series: [
        {
          name: 'Long',
          color: LONG_PASTEL,
          data: longData as any,
          visible: showLongs
        },
        {
          name: 'Short',
          color: SHORT_PASTEL,
          data: shortData as any,
          visible: showShorts
        }
      ]
    } as any);

    return () => {
      if (barsChartRef.current) {
        barsChartRef.current.destroy();
        barsChartRef.current = null;
      }
    };
  }, [loadingExchange, errorExchange, exchangeRows, barsMode, exchangeIconByName]);

  const lastUpdated = useMemo(() => {
    const a = exchangeSnap?.updatedAt ? new Date(exchangeSnap.updatedAt).toLocaleString() : null;
    return { exchange: a };
  }, [exchangeSnap]);

  return (
    <div
      className="min-h-screen bg-[#0b0e11] text-white"
      style={{
        paddingBottom: 'calc(140px + env(safe-area-inset-bottom))'
      }}
    >
      <div className="max-w-[1400px] mx-auto p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Long/Short Ratio Cockpit
              <span className="ml-3 text-sm font-black text-white/60">{symbol} · {tf.toUpperCase()}</span>
            </h1>
            <p className="text-white/60 text-sm mt-1">
              Market Pulse usa /cachecko/lsr-20-coins.json (snapshot). Exchange 3D usa cache por TF/símbolo.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge>Pulse: OI + Vol + Liq + LSR</Badge>
              <Badge>3D: Stack Long+Short (Draggable)</Badge>
              <Badge>Toggle: Click Box to Filter</Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center justify-start lg:justify-end">
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

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6 items-stretch">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 pb-8 overflow-visible">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-black text-white/80 uppercase tracking-widest">Market Pulse</div>
                <div className="text-xs text-white/50 mt-1">
                  Fonte: /cachecko/lsr-20-coins.json
                </div>
              </div>
              {loadingPulse && <Loader2 className="animate-spin text-[#dd9933]" size={18} />}
            </div>

            {errorPulse ? (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 flex gap-2">
                <AlertTriangle size={18} className="mt-0.5" />
                <div className="text-sm">
                  <div className="font-black">Falha no Market Pulse</div>
                  <div className="opacity-80">{errorPulse}</div>
                </div>
              </div>
            ) : loadingPulse ? (
              <Skeleton h={520} />
            ) : (
              <div id="lsr-pulse-chart" className="min-h-[520px]" />
            )}

            <div className="mt-3 text-xs text-white/50">
              Pan: Shift + arrastar. Zoom: scroll.
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 pb-10 overflow-visible flex flex-col">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div>
                <div className="text-sm font-black text-white/80 uppercase tracking-widest">Exchange 3D</div>
                <div className="text-xs text-white/50 mt-1">
                  {lastUpdated.exchange ? `Atualizado: ${lastUpdated.exchange}` : 'Sem timestamp'}
                </div>
              </div>
              {loadingExchange && <Loader2 className="animate-spin text-[#dd9933]" size={18} />}
            </div>

            <div className="flex-1 min-h-0 relative">
                {errorExchange ? (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 flex gap-2">
                    <AlertTriangle size={18} className="mt-0.5" />
                    <div className="text-sm">
                    <div className="font-black">Falha no snapshot de Exchanges</div>
                    <div className="opacity-80">{errorExchange}</div>
                    </div>
                </div>
                ) : loadingExchange ? (
                <Skeleton h={520} />
                ) : (
                <div 
                    id="lsr-exchange-3d" 
                    className="min-h-[520px] cursor-move"
                    onMouseDown={handle3DMouseDown}
                    onMouseMove={handle3DMouseMove}
                    onMouseUp={handle3DMouseUp}
                    onMouseLeave={handle3DMouseUp}
                />
                )}
                <div className="absolute top-2 right-2 text-[10px] bg-black/40 px-2 py-1 rounded text-white/50 pointer-events-none">
                    Arraste para girar
                </div>
            </div>

            {agg && (
              <div className="mt-4 grid grid-cols-2 gap-3 shrink-0">
                <button 
                    onClick={() => setShowLongs(!showLongs)}
                    className={`rounded-xl border p-3 transition-all text-left group ${showLongs ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-black/20 border-white/5 opacity-50'}`}
                >
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-emerald-400 uppercase font-black tracking-widest flex items-center gap-2">
                        {showLongs ? <Eye size={12}/> : <EyeOff size={12}/>} Aggregated Long
                    </div>
                    {showLongs && <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>}
                  </div>
                  <div className={`text-lg font-black mt-1 ${showLongs ? 'text-white' : 'text-gray-500'}`}>{fmtPct(agg.buyRatio)}</div>
                  <div className="text-sm text-white/70">{fmtUSD(agg.buyVolUsd)}</div>
                </button>
                
                <button 
                    onClick={() => setShowShorts(!showShorts)}
                    className={`rounded-xl border p-3 transition-all text-left group ${showShorts ? 'bg-rose-900/20 border-rose-500/30' : 'bg-black/20 border-white/5 opacity-50'}`}
                >
                  <div className="flex justify-between items-center">
                     <div className="text-xs text-rose-400 uppercase font-black tracking-widest flex items-center gap-2">
                        {showShorts ? <Eye size={12}/> : <EyeOff size={12}/>} Aggregated Short
                     </div>
                     {showShorts && <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></div>}
                  </div>
                  <div className={`text-lg font-black mt-1 ${showShorts ? 'text-white' : 'text-gray-500'}`}>{fmtPct(agg.sellRatio)}</div>
                  <div className="text-sm text-white/70">{fmtUSD(agg.sellVolUsd)}</div>
                </button>
              </div>
            )}
          </div>
        </div>

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
                          <td className="p-3 text-right font-black text-emerald-400">{fmtPct(r.buyRatio)}</td>
                          <td className="p-3 text-right font-black text-rose-400">{fmtPct(r.sellRatio)}</td>
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
        <div className="h-12" />
      </div>
    </div>
  );
}

// === LsrGridWidget (Minimized) ===
const LsrGridWidget: React.FC<{ language: Language }> = ({ language }) => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [period, setPeriod] = useState('5m');
  const [data, setData] = useState<LsrData | null>(null);
  const t = getTranslations(language).dashboard.widgets.lsr;

  useEffect(() => {
    fetchLongShortRatio(symbol, period).then(setData).catch(() => setData(null));
  }, [symbol, period]);

  const val = data?.lsr ?? 1;
  const clampedVal = Math.min(Math.max(val, 1), 5);
  const rotation = -90 + ((clampedVal - 1) / 4) * 180;

  const GAUGE_CX = 100;
  const GAUGE_CY = 75;
  const MINI_GAUGE_R = 70;
  const MINI_GAUGE_RY = 70;
  const GAUGE_STROKE = 10;
  const LABEL_R = MINI_GAUGE_R + (GAUGE_STROKE / 2) + 8;
  const CAP_PAD = (GAUGE_STROKE / 2) + 4;
  const TEXT_VAL_Y = 104;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#2f3032] p-2 relative">
      <div className="flex justify-center gap-1 mb-1 z-10 relative">
        <select
          value={symbol}
          onChange={e => setSymbol(e.target.value)}
          className="bg-gray-100 dark:bg-[#1a1c1e] text-gray-800 dark:text-gray-200 text-[10px] font-bold rounded px-1.5 py-0.5 border border-transparent dark:border-slate-700 outline-none"
        >
          <option value="BTCUSDT">BTC</option>
          <option value="ETHUSDT">ETH</option>
          <option value="SOLUSDT">SOL</option>
        </select>

        <select
          value={period}
          onChange={e => setPeriod(e.target.value)}
          className="bg-gray-100 dark:bg-[#1a1c1e] text-gray-800 dark:text-gray-200 text-[10px] font-bold rounded px-1.5 py-0.5 border border-transparent dark:border-slate-700 outline-none"
        >
          <option value="5m">5m</option>
          <option value="1h">1h</option>
          <option value="1D">1D</option>
        </select>
      </div>

      <div className="flex-1 relative w-full flex justify-center items-center pb-1 overflow-visible">
        <svg viewBox="0 0 200 110" className="w-[85%] overflow-visible" preserveAspectRatio="xMidYMax meet">
          <defs>
            <linearGradient id="lsrGradientMinimized" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#CD534B" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#548f3f" />
            </linearGradient>
          </defs>

          <path
            d={`M ${GAUGE_CX - MINI_GAUGE_R} ${GAUGE_CY} A ${MINI_GAUGE_R} ${MINI_GAUGE_RY} 0 0 1 ${GAUGE_CX + MINI_GAUGE_R} ${GAUGE_CY}`}
            fill="none"
            stroke="currentColor"
            className="text-gray-200 dark:text-[#333]"
            strokeWidth={GAUGE_STROKE}
            strokeLinecap="round"
          />

          <path
            d={`M ${GAUGE_CX - MINI_GAUGE_R} ${GAUGE_CY} A ${MINI_GAUGE_R} ${MINI_GAUGE_RY} 0 0 1 ${GAUGE_CX + MINI_GAUGE_R} ${GAUGE_CY}`}
            fill="none"
            stroke="url(#lsrGradientMinimized)"
            strokeWidth={GAUGE_STROKE}
            strokeLinecap="round"
          />

          {[1, 2, 3, 4, 5].map(v => {
            const angleDeg = 180 - ((v - 1) / 4) * 180;
            const theta = (angleDeg * Math.PI) / 180;
            const px = GAUGE_CX + MINI_GAUGE_R * Math.cos(theta);
            const py = GAUGE_CY - MINI_GAUGE_RY * Math.sin(theta);
            const nx = Math.cos(theta);
            const ny = -Math.sin(theta);
            let tx = px + nx * (LABEL_R - MINI_GAUGE_R);
            let ty = py + ny * (LABEL_R - MINI_GAUGE_R);
            if (v === 1) tx -= CAP_PAD;
            if (v === 5) tx += CAP_PAD;
            const anchor: 'start' | 'middle' | 'end' = v === 1 ? 'start' : v === 5 ? 'end' : 'middle';

            return (
              <text
                key={v}
                x={tx}
                y={ty}
                textAnchor={anchor}
                dominantBaseline="middle"
                fill="currentColor"
                className="text-gray-500 dark:text-gray-400 font-black"
                fontSize="8"
              >
                {v}
              </text>
            );
          })}

          <g transform={`rotate(${rotation} ${GAUGE_CX} ${GAUGE_CY})`}>
            <path
              d={`M ${GAUGE_CX} ${GAUGE_CY} L ${GAUGE_CX} ${GAUGE_CY - MINI_GAUGE_RY + 2}`}
              stroke="var(--color-text-main)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx={GAUGE_CX} cy={GAUGE_CY} r="5" fill="var(--color-text-main)" />
          </g>

          <text
            x={GAUGE_CX}
            y={TEXT_VAL_Y - 3}
            textAnchor="middle"
            fill="var(--color-gauge-val)"
            fontSize="22"
            fontWeight="900"
            fontFamily="monospace"
          >
            {Number.isFinite(val) ? val.toFixed(2) : '--'}
          </text>
        </svg>
      </div>

      <div className="flex justify-between px-2 pt-1 border-t border-gray-100 dark:border-slate-700/50 mt-1">
        <div className="text-center">
          <div className="text-[10px] text-gray-500 dark:text-slate-500 font-black uppercase tracking-tighter">Shorts</div>
          <div className="text-base font-mono font-black text-red-500">
            {data?.shorts != null ? `${data.shorts.toFixed(1)}%` : '--'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-gray-500 dark:text-slate-500 font-black uppercase tracking-tighter">Longs</div>
          <div className="text-base font-mono font-black text-green-500">
            {data?.longs != null ? `${data.longs.toFixed(1)}%` : '--'}
          </div>
        </div>
      </div>
    </div>
  );
};

const LsrWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
  if (item.isMaximized) {
    return <LsrCockpitPage />;
  }
  return <LsrGridWidget language={language} />;
};

export default LsrWidget;
