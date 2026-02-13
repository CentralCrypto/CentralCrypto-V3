
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Highcharts from 'highcharts/highstock';
import HC3D from 'highcharts/highcharts-3d';
import HCWheelZoom from 'highcharts/modules/mouse-wheel-zoom';
import { Loader2, AlertTriangle, ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, ChevronsUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Filter } from 'lucide-react';
import { DashboardItem, Language } from '../../../types';
import { fetchLongShortRatio, LsrData } from '../../../services/api';
import { getTranslations } from '../../../locales';
import { useBinanceWS } from '../../../services/BinanceWebSocketContext';
import CoinLogo from '../../../components/CoinLogo';

// DnD Kit
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const init3D = (HC3D as any)?.default ?? HC3D;
const initWheelZoom = (HCWheelZoom as any)?.default ?? HCWheelZoom;

if (typeof init3D === 'function') init3D(Highcharts);
if (typeof initWheelZoom === 'function') initWheelZoom(Highcharts);

type Tf = '5m' | '1h' | '12h' | '1d';
type Sym = 'BTC' | 'ETH' | 'SOL';

const SYMBOLS: Sym[] = ['BTC', 'ETH', 'SOL'];

// NOVOS INTERVALOS DO JSON
type HistInterval = '5min' | '30min' | '1hour' | '4hour' | '12hour' | 'daily';

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
  id?: string;
  symbol: string;
  price?: number;
  marketCap?: number;
  openInterest?: number;
  volUsd?: number;
  ls5m?: number;
  ls15m?: number;
  ls30m?: number;
  ls1h?: number;
  ls4h?: number;
  ls12h?: number;
  ls24h?: number;
  iconUrl?: string;
};

const TFS: Tf[] = ['5m', '1h', '12h', '1d'];

const HIST_INTERVALS: HistInterval[] = ['5min', '30min', '1hour', '4hour', '12hour', 'daily'];

// Mapping for local files (symbol -> filename slug)
const SLUG_MAP: Record<string, string> = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'XRP': 'ripple',
    'DOGE': 'dogecoin',
    'ADA': 'cardano',
    'AVAX': 'avalanche-2',
    'DOT': 'polkadot',
    'TRX': 'tron',
    'LINK': 'chainlink',
    'LTC': 'litecoin',
    'BCH': 'bitcoin-cash',
    'NEAR': 'near',
    'UNI': 'uniswap',
    'ICP': 'internet-computer',
    'APT': 'aptos',
    'FIL': 'filecoin',
    'ATOM': 'cosmos',
    'ARB': 'arbitrum',
    'OP': 'optimism',
    'INJ': 'injective',
    'RNDR': 'render-token',
    'PEPE': 'pepe'
};

const cachePathForExchange = (sym: string, tf: Tf) => `/cachecko/lsr-exchange-${sym.toLowerCase()}-${tf}.json`;
const cachePathForTopCoins = () => `/cachecko/lsr-20-coins.json`;
const cachePathForHistoric = (interval: HistInterval) => `/cachecko/lsr-historic-${interval}.json`;

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
const fmtLSR = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : '-');

const sortByTotalVolDesc = (rows: ExchangeRow[]) =>
  [...rows].sort((a, b) => (b.buyVolUsd + b.sellVolUsd) - (a.buyVolUsd + a.sellVolUsd));

const Skeleton = ({ h = 180 }: { h?: number }) => (
  <div className="animate-pulse rounded-2xl bg-white/5 border border-white/10" style={{ height: h }} />
);

// Colors matching the boxes exactly (Emerald 500 / Rose 500) but with opacity for 3D bars
const COLOR_LONG_RGBA = 'rgba(16, 185, 129, 0.5)'; // Emerald 500 @ 50%
const COLOR_SHORT_RGBA = 'rgba(244, 63, 94, 0.5)'; // Rose 500 @ 50%
const COLOR_LONG_HEX = '#10b981';
const COLOR_SHORT_HEX = '#f43f5e';

async function fetchJsonStrict(url: string): Promise<any> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  try { return JSON.parse(raw); } catch { throw new Error(`Invalid JSON`); }
}

function getBaseSymbol(fullSymbol: string) {
    if (!fullSymbol) return 'BTC';
    // Remove suffix like 'USDT_PERP.A' or 'USDT'
    return fullSymbol.split('USDT')[0];
}

// --- SUB-COMPONENT: Live Coin Row with Flashing & WS ---
const LsrCoinRow = React.memo(({ coin, colOrder, renderCell }: { coin: Lsr20Coin, colOrder: string[], renderCell: (r: any, c: string, livePrice?: number, flashClass?: string) => React.ReactNode }) => {
    const { tickers } = useBinanceWS();
    const [displayPrice, setDisplayPrice] = useState(coin.price || 0);
    const [flashClass, setFlashClass] = useState('');
    const prevPriceRef = useRef(displayPrice);

    useEffect(() => {
        const tickerKey = `${coin.symbol.toUpperCase()}USDT`;
        const liveData = tickers[tickerKey];
        if (liveData) {
            const newPrice = parseFloat(liveData.c);
            if (!isNaN(newPrice)) setDisplayPrice(newPrice);
        }
    }, [tickers, coin.symbol]);

    useEffect(() => {
        if (prevPriceRef.current !== displayPrice) {
            const isUp = displayPrice > prevPriceRef.current;
            setFlashClass(isUp ? 'text-green-400 bg-green-900/20' : 'text-red-400 bg-red-900/20');
            prevPriceRef.current = displayPrice;
            const timer = setTimeout(() => setFlashClass(''), 300);
            return () => clearTimeout(timer);
        }
    }, [displayPrice]);

    return (
        <tr className="hover:bg-white/5 transition-colors">
            {colOrder.map(colId => renderCell(coin, colId, displayPrice, flashClass))}
        </tr>
    );
});

export function LsrCockpitPage() {
  // Use explicit symbol state, default 'BTC' base, but stores full ID from JSON
  const [selectedHistoricSymbol, setSelectedHistoricSymbol] = useState<string>('BTCUSDT_PERP.A');
  
  // Base symbol used for Exchange 3D Widget (BTC, ETH, SOL only usually available)
  const [exchangeSymbol, setExchangeSymbol] = useState<Sym>('BTC');
  
  const [tf, setTf] = useState<Tf>('5m');

  const [exchangeSnap, setExchangeSnap] = useState<ExchangeSnapshot | null>(null);
  const [topCoins, setTopCoins] = useState<Lsr20Coin[]>([]);

  const [loadingExchange, setLoadingExchange] = useState(false);
  const [loadingPulse, setLoadingPulse] = useState(false);
  const [errorExchange, setErrorExchange] = useState<string | null>(null);
  const [errorPulse, setErrorPulse] = useState<string | null>(null);

  // HISTORIC DATA
  const [histInterval, setHistInterval] = useState<HistInterval>('1hour');
  const [availableSymbols, setAvailableSymbols] = useState<string[]>([]);
  // Store 3 series
  const [histData, setHistData] = useState<{ r: [number, number][], l: [number, number][], s: [number, number][] } | null>(null);
  const [loadingHist, setLoadingHist] = useState(false);
  const [errorHist, setErrorHist] = useState<string | null>(null);
  
  // CHART FILTERS
  const [showHistRate, setShowHistRate] = useState(true);
  const [showHistLongs, setShowHistLongs] = useState(true);
  const [showHistShorts, setShowHistShorts] = useState(false); 

  const [showTable, setShowTable] = useState(true);
  const [activeTab, setActiveTab] = useState<'exchanges' | 'coins'>('exchanges');
  const [barsMode, setBarsMode] = useState<'usd' | 'ratio'>('usd');

  // Series Toggles (3D Chart)
  const [showLongs, setShowLongs] = useState(true);
  const [showShorts, setShowShorts] = useState(true);

  // Sorting
  const [sortKey, setSortKey] = useState<string>('totalUsd');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Column Orders
  const [exColOrder, setExColOrder] = useState(['exchange', 'longPct', 'shortPct', 'lsr', 'longUsd', 'shortUsd', 'totalUsd']);
  const [coinColOrder, setCoinColOrder] = useState(['asset', 'price', 'ls5m', 'ls15m', 'ls30m', 'ls1h', 'ls4h', 'ls24h']);

  const barsChartRef = useRef<Highcharts.Chart | null>(null);
  const histChartRef = useRef<Highcharts.Chart | null>(null);
  
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // FETCH EXCHANGE DATA
  useEffect(() => {
    let alive = true;
    const run = async () => {
      setLoadingExchange(true); setErrorExchange(null);
      try {
        const json = await fetchJsonStrict(cachePathForExchange(exchangeSymbol, tf));
        if (!alive) return;
        setExchangeSnap(Array.isArray(json) ? json[0] : json);
      } catch (e: any) {
        if (!alive) return;
        setErrorExchange(e?.message);
      } finally { if (alive) setLoadingExchange(false); }
    };
    run();
    return () => { alive = false; };
  }, [exchangeSymbol, tf]);

  // FETCH TOP COINS
  useEffect(() => {
    let alive = true;
    const run = async () => {
      setLoadingPulse(true); setErrorPulse(null);
      try {
        const json = await fetchJsonStrict(cachePathForTopCoins());
        if (!alive) return;
        let arr: any[] = [];
        if (Array.isArray(json)) arr = json[0]?.data || json;
        else if (json?.data) arr = json.data;
        
        const cleaned = arr.map(x => ({
            ...x,
            id: x.id || SLUG_MAP[String(x.symbol).toUpperCase()] || String(x.symbol).toLowerCase(),
            symbol: String(x.symbol).toUpperCase(),
            price: Number(x.price),
            ls5m: Number(x.ls5m), ls15m: Number(x.ls15m), ls30m: Number(x.ls30m),
            ls1h: Number(x.ls1h), ls4h: Number(x.ls4h), ls12h: Number(x.ls12h), ls24h: Number(x.ls24h),
            iconUrl: x.iconUrl || x.image || x.logo
        })) as Lsr20Coin[];
        setTopCoins(cleaned);
      } catch (e: any) {
        if (!alive) return;
        setErrorPulse(e?.message);
      } finally { if (alive) setLoadingPulse(false); }
    };
    run();
    return () => { alive = false; };
  }, []);

  // FETCH LSR HISTORIC & POPULATE SYMBOLS
  useEffect(() => {
    let alive = true;
    const run = async () => {
      setLoadingHist(true);
      setErrorHist(null);
      setHistData(null);
      
      try {
        const json = await fetchJsonStrict(cachePathForHistoric(histInterval));
        if (!alive) return;
        
        const dataArr = json.data || [];
        
        // Extract available symbols
        const symbols = dataArr.map((d: any) => d.symbol).sort();
        setAvailableSymbols(symbols);

        // Try to find currently selected, or default to BTC, or first available
        let targetSym = selectedHistoricSymbol;
        
        // If current selection not in new data, try to find matching base
        if (!dataArr.find((d: any) => d.symbol === targetSym)) {
             const base = getBaseSymbol(targetSym);
             const match = dataArr.find((d: any) => d.symbol.includes(base));
             if (match) {
                 targetSym = match.symbol;
                 setSelectedHistoricSymbol(targetSym);
             } else if (dataArr.length > 0) {
                 targetSym = dataArr[0].symbol;
                 setSelectedHistoricSymbol(targetSym);
             }
        }

        const coinData = dataArr.find((d: any) => d.symbol === targetSym);

        if (coinData && Array.isArray(coinData.history)) {
            const seriesR: [number, number][] = [];
            const seriesL: [number, number][] = [];
            const seriesS: [number, number][] = [];

            coinData.history.forEach((h: any) => {
                const ts = h.t * 1000; // API returns seconds
                if (h.r !== undefined) seriesR.push([ts, h.r]);
                if (h.l !== undefined) seriesL.push([ts, h.l]);
                if (h.s !== undefined) seriesS.push([ts, h.s]);
            });
            
            // Sort by time just in case
            const sortFn = (a:any, b:any) => a[0] - b[0];
            seriesR.sort(sortFn);
            seriesL.sort(sortFn);
            seriesS.sort(sortFn);

            setHistData({ r: seriesR, l: seriesL, s: seriesS });
        } else {
            setErrorHist(`Sem dados históricos para ${targetSym} neste intervalo.`);
        }

      } catch (e: any) {
        if (!alive) return;
        setErrorHist(e?.message || 'Erro ao carregar histórico');
      } finally {
        if (alive) setLoadingHist(false);
      }
    };
    run();
    return () => { alive = false; };
  }, [histInterval, selectedHistoricSymbol]); // Re-run if interval changes or if user selects new symbol manually

  // UPDATE CHART VISIBILITY WITHOUT RECREATING
  useEffect(() => {
      if (histChartRef.current) {
          const chart = histChartRef.current;
          if (chart.series[0]) chart.series[0].setVisible(showHistRate, false);
          if (chart.series[1]) chart.series[1].setVisible(showHistLongs, false);
          if (chart.series[2]) chart.series[2].setVisible(showHistShorts, false);
          chart.redraw();
      }
  }, [showHistRate, showHistLongs, showHistShorts]);

  // RENDER HISTORIC CHART
  useEffect(() => {
    if (loadingHist || !histData) return;

    const el = document.getElementById('lsr-historic-chart');
    if (!el) return;

    if (histChartRef.current) {
      try { histChartRef.current.destroy(); } catch {}
      histChartRef.current = null;
    }

    histChartRef.current = Highcharts.chart('lsr-historic-chart', {
      chart: {
        backgroundColor: 'transparent',
        height: 480, // INCREASED HEIGHT
        zooming: { 
            mouseWheel: { enabled: true },
            type: undefined // DISABLE SELECTION ZOOM (No blue box)
        },
        panning: { enabled: true, type: 'x' }, // ENABLE DRAG PANNING
        panKey: undefined, // Direct drag without key
        spacing: [10, 10, 10, 10]
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false }, 
      xAxis: {
        type: 'datetime',
        labels: { style: { color: 'rgba(255,255,255,0.55)', fontSize: '10px' } },
        lineColor: 'rgba(255,255,255,0.08)',
        tickColor: 'rgba(255,255,255,0.08)',
        crosshair: { width: 1, color: 'rgba(255,255,255,0.2)', dashStyle: 'Dash' }
      },
      yAxis: [{
        // Axis 0: LSR Rate (Left) - AUTO SCALING
        title: { text: 'LSR Rate', style: { color: '#dd9933' } },
        gridLineColor: 'rgba(255,255,255,0.1)', // Visible Grid Lines
        gridLineWidth: 1,
        labels: { style: { color: '#dd9933', fontSize: '10px' } },
        plotLines: [{ value: 1, color: '#ffffff', width: 1, dashStyle: 'Dot', zIndex: 2 }],
        min: null, // Auto scale
        max: null  // Auto scale
      }, {
        // Axis 1: Percentages (Right)
        title: { text: 'Ratio %', style: { color: '#ffffff' } },
        gridLineWidth: 0,
        opposite: true,
        min: 0, 
        max: 100,
        labels: { style: { color: 'rgba(255,255,255,0.6)', fontSize: '10px' } }
      }],
      tooltip: {
        shared: true,
        useHTML: true,
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderWidth: 0,
        style: { color: '#fff' },
        formatter: function () {
            // @ts-ignore
            const points = this.points || [];
            // @ts-ignore
            const date = new Date(this.x).toLocaleDateString('pt-BR'); // DD/MM/YYYY
            
            let s = `<div style="font-size:11px;color:#aaa;margin-bottom:4px;">${date}</div>`;
            points.forEach((p: any) => {
                s += `<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;">
                        <span style="color:${p.series.color}">●</span> 
                        <span>${p.series.name}:</span> 
                        <b>${p.y.toFixed(2)}</b>
                        ${p.series.name !== 'Rate' ? '%' : ''}
                      </div>`;
            });
            return s;
        }
      },
      series: [
        {
          type: 'line',
          name: 'Rate',
          data: histData.r,
          color: '#dd9933', // Gold/Orange
          lineWidth: 1, // 1 PIXEL
          states: { hover: { lineWidthPlus: 0 } }, // Keep thin on hover
          yAxis: 0,
          visible: showHistRate,
          zIndex: 3
        },
        {
          type: 'line',
          name: 'Longs',
          data: histData.l,
          color: '#22c55e', // Green
          lineWidth: 1, // 1 PIXEL
          states: { hover: { lineWidthPlus: 0 } },
          yAxis: 1,
          visible: showHistLongs,
          zIndex: 2
        },
        {
          type: 'line',
          name: 'Shorts',
          data: histData.s,
          color: '#ef4444', // Red
          lineWidth: 1, // 1 PIXEL
          states: { hover: { lineWidthPlus: 0 } },
          yAxis: 1,
          visible: showHistShorts,
          zIndex: 1
        }
      ]
    } as any);

    return () => {
      if (histChartRef.current) {
        try { histChartRef.current.destroy(); } catch {}
        histChartRef.current = null;
      }
    };
  }, [histData, histInterval, selectedHistoricSymbol]); 

  // COMPUTED DATA
  const exchangeRows = useMemo(() => {
    const list = exchangeSnap?.data?.[0]?.list || [];
    const cleaned = list.map(x => ({
        exchange: x.exchange,
        buyRatio: Number(x.buyRatio)||0, sellRatio: Number(x.sellRatio)||0,
        buyVolUsd: Number(x.buyVolUsd)||0, sellVolUsd: Number(x.sellVolUsd)||0,
        iconUrl: x.iconUrl
    }));
    return sortByTotalVolDesc(cleaned);
  }, [exchangeSnap]);

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

  const aggLsrValue = useMemo(() => {
      if (!agg || agg.sellVolUsd === 0) return 0;
      return agg.buyVolUsd / agg.sellVolUsd;
  }, [agg]);

  // SORTING & DnD Logic
  const handleSort = (key: string) => {
      if (sortKey === key) setSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
      else { setSortKey(key); setSortDir('desc'); }
  };

  const sortedData = useMemo(() => {
      const data = activeTab === 'exchanges' ? [...exchangeRows] : [...topCoins];
      const dir = sortDir === 'asc' ? 1 : -1;
      
      data.sort((a: any, b: any) => {
          let av = 0, bv = 0;
          if (activeTab === 'exchanges') {
              if (sortKey === 'totalUsd') { av = a.buyVolUsd + a.sellVolUsd; bv = b.buyVolUsd + b.sellVolUsd; }
              else if (sortKey === 'lsr') { av = a.sellVolUsd ? a.buyVolUsd/a.sellVolUsd : 0; bv = b.sellVolUsd ? b.buyVolUsd/b.sellVolUsd : 0; }
              else if (sortKey === 'exchange') return a.exchange.localeCompare(b.exchange) * dir;
              else av = a[sortKey]; bv = b[sortKey];
          } else {
              if (sortKey === 'asset') return a.symbol.localeCompare(b.symbol) * dir;
              av = a[sortKey]; bv = b[sortKey];
          }
          return (av - bv) * dir;
      });
      return data;
  }, [activeTab, exchangeRows, topCoins, sortKey, sortDir]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
        const setOrder = activeTab === 'exchanges' ? setExColOrder : setCoinColOrder;
        setOrder((items) => {
            const oldIndex = items.indexOf(active.id as string);
            const newIndex = items.indexOf(over.id as string);
            return arrayMove(items, oldIndex, newIndex);
        });
    }
  };

  // 3D CHART EFFECT (For Exchanges Panel)
  useEffect(() => {
    if (barsChartRef.current) {
        const chart = barsChartRef.current;
        if (chart.series[0]) chart.series[0].setVisible(showLongs, false);
        if (chart.series[1]) chart.series[1].setVisible(showShorts, false);
        chart.redraw();
    }
  }, [showLongs, showShorts]);

  useEffect(() => {
    if (loadingExchange || !exchangeRows.length) return;
    if (barsChartRef.current) { barsChartRef.current.destroy(); barsChartRef.current = null; }

    const el = document.getElementById('lsr-exchange-3d');
    if (!el) return;

    const longData = exchangeRows.map(r => ({ y: barsMode === 'ratio' ? clamp(r.buyRatio, 0, 100) : r.buyVolUsd, exchange: r.exchange, iconUrl: r.iconUrl }));
    const shortData = exchangeRows.map(r => ({ y: barsMode === 'ratio' ? clamp(r.sellRatio, 0, 100) : r.sellVolUsd, exchange: r.exchange, iconUrl: r.iconUrl }));

    barsChartRef.current = Highcharts.chart('lsr-exchange-3d', {
      chart: {
        type: 'column',
        backgroundColor: 'transparent',
        height: 420, // INCREASED HEIGHT
        marginTop: 10,
        marginLeft: undefined, 
        marginRight: 0,
        marginBottom: 50,
        spacing: [0, 0, 0, 0],
        options3d: {
          enabled: true,
          alpha: 10, beta: 18, depth: 250, viewDistance: 25,
          frame: {
            bottom: { size: 1, color: 'rgba(255,255,255,0.05)' },
            side: { size: 1, color: 'rgba(255,255,255,0.05)' },
            back: { size: 1, color: 'rgba(255,255,255,0.05)' }
          }
        }
      },
      title: { text: null }, 
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        categories: exchangeRows.map(x => x.exchange),
        gridLineWidth: 0,
        tickLength: 0,
        labels: {
          style: { color: 'rgba(255,255,255,0.70)', fontSize: '10px', fontWeight: 'normal' },
          rotation: -45, autoRotation: [-45], y: 20, step: 1
        }
      },
      yAxis: {
        min: 0,
        title: { text: null },
        gridLineColor: 'rgba(255,255,255,0.05)',
        labels: { 
            enabled: true,
            style: { color: 'rgba(255,255,255,0.50)', fontSize: '9px' },
            formatter: function() { return barsMode === 'ratio' ? this.value + '%' : fmtUSD(this.value as any); }
        }
      },
      tooltip: {
        shared: true,
        useHTML: true,
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        style: { color: '#fff' },
        borderWidth: 0,
        formatter: function () {
          const pts: any[] = (this as any).points || [];
          const pLong = pts.find(p => p.series.name === 'Long');
          const pShort = pts.find(p => p.series.name === 'Short');
          const point = pLong ? pLong.point : (pShort ? pShort.point : null);
          if (!point) return '';
          
          const lVal = pLong?.y ?? 0;
          const sVal = pShort?.y ?? 0;
          const lsr = sVal > 0 ? lVal/sVal : 0;
          const head = point.iconUrl 
            ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><img src="${point.iconUrl}" style="width:20px;height:20px;border-radius:4px" /><b>${point.exchange}</b></div>` 
            : `<b>${point.exchange}</b>`;

          return `${head}
            <div>Long: <b style="color:${COLOR_LONG_HEX}">${barsMode==='ratio'?lVal.toFixed(2)+'%':fmtUSD(lVal)}</b></div>
            <div>Short: <b style="color:${COLOR_SHORT_HEX}">${barsMode==='ratio'?sVal.toFixed(2)+'%':fmtUSD(sVal)}</b></div>
            <div style="margin-top:4px;border-top:1px solid rgba(255,255,255,0.1)">LSR: <b style="color:#dd9933">${fmtLSR(lsr)}</b></div>`;
        }
      },
      plotOptions: {
        column: {
          depth: 40,
          stacking: 'normal',
          borderWidth: 0,
          groupPadding: 0.1,
          pointPadding: 0.02
        }
      },
      series: [
        { name: 'Long', color: COLOR_LONG_RGBA, data: longData, visible: showLongs },
        { name: 'Short', color: COLOR_SHORT_RGBA, data: shortData, visible: showShorts }
      ]
    } as any);
  }, [loadingExchange, exchangeRows, barsMode]);

  // TABLE COLUMNS & COMPONENTS
  const EX_COLS: Record<string, { label: string, key?: string, align?: string }> = {
      exchange: { label: "Exchange", key: "exchange", align: "left" },
      longPct: { label: "Long %", key: "buyRatio", align: "right" },
      shortPct: { label: "Short %", key: "sellRatio", align: "right" },
      lsr: { label: "LSR", key: "lsr", align: "right" },
      longUsd: { label: "Long $", key: "buyVolUsd", align: "right" },
      shortUsd: { label: "Short $", key: "sellVolUsd", align: "right" },
      totalUsd: { label: "Total $", key: "totalUsd", align: "right" }
  };

  const COIN_COLS: Record<string, { label: string, key?: string, align?: string }> = {
      asset: { label: "Ativo", key: "asset", align: "left" },
      price: { label: "Preço", key: "price", align: "right" },
      ls5m: { label: "LSR 5m", key: "ls5m", align: "center" },
      ls15m: { label: "LSR 15m", key: "ls15m", align: "center" },
      ls30m: { label: "LSR 30m", key: "ls30m", align: "center" },
      ls1h: { label: "LSR 1h", key: "ls1h", align: "center" },
      ls4h: { label: "LSR 4h", key: "ls4h", align: "center" },
      ls12h: { label: "LSR 12h", key: "ls12h", align: "center" },
      ls24h: { label: "LSR 24h", key: "ls24h", align: "center" }
  };

  const SortableTh = ({ colId, label, sortKey, activeKey, onSort, align }: any) => {
        const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: colId });
        const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 100 : 'auto' };
        return (
            <th ref={setNodeRef} style={style} className={`p-3 bg-[#0b0e11] cursor-pointer group select-none ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`} onClick={() => sortKey && onSort(sortKey)}>
                <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
                    <span className={`p-1 rounded hover:bg-white/10 cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`} {...attributes} {...listeners} onClick={e => e.stopPropagation()}><GripVertical size={12} className="text-gray-600" /></span>
                    <span className="text-xs font-black text-gray-400 uppercase">{label}</span>
                    {sortKey && <ChevronsUpDown size={12} className={`text-gray-600 transition-colors ${activeKey === sortKey ? 'text-[#dd9933]' : 'opacity-0 group-hover:opacity-100'}`} />}
                </div>
            </th>
        );
  };

  const renderExchangeCell = (r: any, colId: string, _lp?: number) => {
      const lsr = r.sellVolUsd > 0 ? r.buyVolUsd/r.sellVolUsd : 0;
      switch(colId) {
          case 'exchange': return (
              <td className="p-3">
                  <div className="flex items-center gap-3">
                      {r.iconUrl ? <img src={r.iconUrl} className="w-6 h-6 rounded bg-white p-0.5" /> : <div className="w-6 h-6 rounded bg-white/10" />}
                      <span className="font-bold text-white">{r.exchange}</span>
                  </div>
              </td>
          );
          case 'longPct': return <td className="p-3 text-right font-black" style={{color: COLOR_LONG_HEX}}>{fmtPct(r.buyRatio)}</td>;
          case 'shortPct': return <td className="p-3 text-right font-black" style={{color: COLOR_SHORT_HEX}}>{fmtPct(r.sellRatio)}</td>;
          case 'lsr': return <td className="p-3 text-right font-black font-mono text-[#dd9933]">{fmtLSR(lsr)}</td>;
          case 'longUsd': return <td className="p-3 text-right font-mono text-gray-400 text-xs">{fmtUSD(r.buyVolUsd)}</td>;
          case 'shortUsd': return <td className="p-3 text-right font-mono text-gray-400 text-xs">{fmtUSD(r.sellVolUsd)}</td>;
          case 'totalUsd': return <td className="p-3 text-right font-mono font-bold text-gray-300 text-xs">{fmtUSD(r.buyVolUsd + r.sellVolUsd)}</td>;
          default: return <td className="p-3"></td>;
      }
  };

  const renderCoinCell = (r: Lsr20Coin, colId: string, livePrice?: number, flashClass?: string) => {
      const getTrendArrow = (val: number, prevTFVal?: number) => {
          if (!prevTFVal) return null;
          if (val > prevTFVal) return <ArrowUp size={10} className="text-green-500 inline ml-1" />;
          if (val < prevTFVal) return <ArrowDown size={10} className="text-red-500 inline ml-1" />;
          return null;
      };
      const lsrColor = (v: number) => {
          if (v >= 2) return 'text-red-500';
          if (v <= 0.8) return 'text-green-500';
          return 'text-gray-400';
      };
      const priceToUse = livePrice || r.price || 0;
      const coinObj = { id: r.id || r.symbol.toLowerCase(), symbol: r.symbol, image: r.iconUrl };

      switch(colId) {
          case 'asset': return (
              <td className="p-3">
                  <div className="flex items-center gap-3">
                      <CoinLogo coin={coinObj} className="w-6 h-6 rounded-full" />
                      <div className="flex flex-col"><span className="font-bold text-white leading-none">{r.symbol}</span></div>
                  </div>
              </td>
          );
          case 'price': return (
              <td className="p-3 text-right">
                  <span className={`font-mono font-bold text-gray-300 transition-colors duration-300 px-1 py-0.5 rounded ${flashClass}`}>
                      ${priceToUse < 1 ? priceToUse.toFixed(4) : priceToUse.toLocaleString()}
                  </span>
              </td>
          );
          case 'ls5m': return <td className={`p-3 text-center font-mono font-black ${lsrColor(r.ls5m||0)}`}>{fmtLSR(r.ls5m||0)}{getTrendArrow(r.ls5m||0, r.ls15m)}</td>;
          case 'ls15m': return <td className={`p-3 text-center font-mono font-black ${lsrColor(r.ls15m||0)}`}>{fmtLSR(r.ls15m||0)}{getTrendArrow(r.ls15m||0, r.ls30m)}</td>;
          case 'ls30m': return <td className={`p-3 text-center font-mono font-black ${lsrColor(r.ls30m||0)}`}>{fmtLSR(r.ls30m||0)}{getTrendArrow(r.ls30m||0, r.ls1h)}</td>;
          case 'ls1h': return <td className={`p-3 text-center font-mono font-black ${lsrColor(r.ls1h||0)}`}>{fmtLSR(r.ls1h||0)}{getTrendArrow(r.ls1h||0, r.ls4h)}</td>;
          case 'ls4h': return <td className={`p-3 text-center font-mono font-black ${lsrColor(r.ls4h||0)}`}>{fmtLSR(r.ls4h||0)}{getTrendArrow(r.ls4h||0, r.ls12h)}</td>;
          case 'ls12h': return <td className={`p-3 text-center font-mono font-black ${lsrColor(r.ls12h||0)}`}>{fmtLSR(r.ls12h||0)}{getTrendArrow(r.ls12h||0, r.ls24h)}</td>;
          case 'ls24h': return <td className={`p-3 text-center font-mono font-black ${lsrColor(r.ls24h||0)}`}>{fmtLSR(r.ls24h||0)}</td>;
          default: return <td className="p-3"></td>;
      }
  };

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white" style={{ paddingBottom: '140px' }}>
      <div className="max-w-[1400px] mx-auto p-4 sm:p-6">
        
        {/* HEADER CONTROLS */}
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-6">Long/Short Ratio Cockpit</h1>

        {/* TOP SECTION: LSR HISTORIC + AGGREGATED */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
          
          {/* LSR HISTORIC CHART (LEFT) */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 pb-8 overflow-visible h-full flex flex-col">
            <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
              <div className="flex items-center gap-3">
                <div className="text-sm font-black text-white/80 uppercase tracking-widest">LSR Historic</div>
                
                {/* Coin Selector with Logo */}
                <div className="relative group">
                    <select 
                        value={selectedHistoricSymbol}
                        onChange={(e) => setSelectedHistoricSymbol(e.target.value)}
                        className="appearance-none bg-black/40 border border-white/10 rounded-lg py-1.5 pl-9 pr-8 text-xs font-bold text-white hover:bg-black/60 cursor-pointer outline-none focus:border-[#dd9933]"
                    >
                        {availableSymbols.map(sym => (
                            <option key={sym} value={sym} className="bg-[#1a1c1e] text-white">
                                {getBaseSymbol(sym)}
                            </option>
                        ))}
                    </select>
                    <div className="absolute left-2 top-1.5 pointer-events-none">
                        <CoinLogo 
                            coin={{ 
                                id: SLUG_MAP[getBaseSymbol(selectedHistoricSymbol)] || getBaseSymbol(selectedHistoricSymbol).toLowerCase(), 
                                symbol: getBaseSymbol(selectedHistoricSymbol) 
                            }} 
                            className="w-5 h-5 rounded-full" 
                        />
                    </div>
                    <ChevronDown size={14} className="absolute right-2 top-2 text-gray-400 pointer-events-none" />
                </div>

                {/* Interval Selector (Dropdown) */}
                 <div className="relative group">
                    <select
                      value={histInterval}
                      onChange={(e) => setHistInterval(e.target.value as HistInterval)}
                      className="appearance-none bg-black/40 border border-white/10 rounded-lg py-1.5 pl-3 pr-8 text-xs font-bold text-white hover:bg-black/60 cursor-pointer outline-none focus:border-[#dd9933]"
                    >
                      {HIST_INTERVALS.map(x => (
                        <option key={x} value={x} className="bg-[#1a1c1e]">
                          {x.replace('min','m').replace('hour','h').replace('daily','D').toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2 top-2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Series Toggles (Aligned Right) */}
              <div className="flex gap-2 ml-auto">
                  <button onClick={() => setShowHistRate(!showHistRate)} className={`px-2 py-1 text-[10px] font-bold rounded border ${showHistRate ? 'bg-[#dd9933]/20 border-[#dd9933] text-[#dd9933]' : 'border-white/10 text-gray-500'}`}>Rate</button>
                  <button onClick={() => setShowHistLongs(!showHistLongs)} className={`px-2 py-1 text-[10px] font-bold rounded border ${showHistLongs ? 'bg-green-500/20 border-green-500 text-green-500' : 'border-white/10 text-gray-500'}`}>Longs</button>
                  <button onClick={() => setShowHistShorts(!showHistShorts)} className={`px-2 py-1 text-[10px] font-bold rounded border ${showHistShorts ? 'bg-red-500/20 border-red-500 text-red-500' : 'border-white/10 text-gray-500'}`}>Shorts</button>
              </div>

              {loadingHist && <Loader2 className="animate-spin text-[#dd9933]" size={18} />}
            </div>

            <div className="flex-1 min-h-[480px] mt-4">
                {errorHist ? (
                  <div className="p-4 text-red-200 bg-red-900/20 border border-red-900/50 rounded flex items-center justify-center h-full">{errorHist}</div>
                ) : loadingHist ? (
                  <Skeleton h={480} />
                ) : (
                  <div id="lsr-historic-chart" className="h-full" />
                )}
            </div>
          </div>

          {/* EXCHANGE 3D (RIGHT) */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 pb-3 overflow-visible flex flex-col h-full">
            
            {/* Header: Controls + Stats */}
            <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
              <div className="flex items-center gap-4">
                  <div className="text-sm font-black text-white/80 uppercase tracking-widest">LSR Agregado</div>
                  <div className="w-px h-4 bg-white/10"></div>
                  {agg && (
                      <div className="text-[#dd9933] font-mono font-black text-lg">
                          {fmtLSR(aggLsrValue)}
                      </div>
                  )}
                  {loadingExchange && <Loader2 className="animate-spin text-[#dd9933]" size={18} />}
              </div>

              {/* Right Side: Dropdowns + Toggle */}
              <div className="flex items-center gap-3 ml-auto">
                   {/* Exchange Coin Selector (Dropdown) */}
                   <div className="relative group">
                    <select
                        value={exchangeSymbol}
                        onChange={(e) => setExchangeSymbol(e.target.value as Sym)}
                        className="appearance-none bg-black/40 border border-white/10 rounded-lg py-1.5 pl-3 pr-8 text-xs font-bold text-white hover:bg-black/60 cursor-pointer outline-none focus:border-[#dd9933]"
                    >
                        {SYMBOLS.map(s => <option key={s} value={s} className="bg-[#1a1c1e]">{s}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-2 top-2 text-gray-400 pointer-events-none" />
                   </div>

                   {/* Timeframe Selector (Dropdown) */}
                   <div className="relative group">
                    <select
                        value={tf}
                        onChange={(e) => setTf(e.target.value as Tf)}
                        className="appearance-none bg-black/40 border border-white/10 rounded-lg py-1.5 pl-3 pr-8 text-xs font-bold text-white hover:bg-black/60 cursor-pointer outline-none focus:border-[#dd9933]"
                    >
                        {TFS.map(x => <option key={x} value={x} className="bg-[#1a1c1e]">{x.toUpperCase()}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-2 top-2 text-gray-400 pointer-events-none" />
                   </div>
                   
                   {/* Toggle USD/% */}
                   <div className="flex bg-black/40 rounded p-0.5 border border-white/10">
                      <button onClick={() => setBarsMode('usd')} className={`px-2 py-0.5 text-[10px] font-bold rounded transition ${barsMode === 'usd' ? 'bg-[#dd9933] text-black' : 'text-gray-400 hover:text-white'}`}>USD</button>
                      <button onClick={() => setBarsMode('ratio')} className={`px-2 py-0.5 text-[10px] font-bold rounded transition ${barsMode === 'ratio' ? 'bg-[#dd9933] text-black' : 'text-gray-400 hover:text-white'}`}>%</button>
                   </div>
              </div>
            </div>

            <div className="relative overflow-visible flex-1 min-h-[420px] mt-4 mb-4">
                {errorExchange ? <div className="p-4 text-red-200 bg-red-900/20 border border-red-900/50 rounded h-full flex items-center justify-center">{errorExchange}</div> :
                 loadingExchange ? <Skeleton h={420} /> : 
                 <div id="lsr-exchange-3d" className="h-full min-h-[420px]" />
                }
            </div>

            {agg && (
              <div className="mt-1 grid grid-cols-2 gap-3 shrink-0">
                <button onClick={() => setShowLongs(!showLongs)} className={`rounded-xl border px-3 py-2 transition-all text-left group flex items-center justify-between ${showLongs ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-black/20 border-white/5 opacity-50'}`}>
                  <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                          <div className="text-[10px] text-emerald-400 uppercase font-black tracking-widest flex items-center gap-1">{showLongs ? <Eye size={10}/> : <EyeOff size={10}/>} Long</div>
                          <div className={`text-lg font-black leading-none mt-0.5 ${showLongs ? 'text-white' : 'text-gray-500'}`}>{fmtPct(agg.buyRatio)}</div>
                      </div>
                  </div>
                  <div className="text-xs text-white/50 font-mono bg-black/20 px-2 py-1 rounded">{fmtUSD(agg.buyVolUsd)}</div>
                </button>
                
                <button onClick={() => setShowShorts(!showShorts)} className={`rounded-xl border px-3 py-2 transition-all text-left group flex items-center justify-between ${showShorts ? 'bg-rose-900/20 border-rose-500/30' : 'bg-black/20 border-white/5 opacity-50'}`}>
                  <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                          <div className="text-[10px] text-rose-400 uppercase font-black tracking-widest flex items-center gap-1">{showShorts ? <Eye size={10}/> : <EyeOff size={10}/>} Short</div>
                          <div className={`text-lg font-black leading-none mt-0.5 ${showShorts ? 'text-white' : 'text-gray-500'}`}>{fmtPct(agg.sellRatio)}</div>
                      </div>
                  </div>
                  <div className="text-xs text-white/50 font-mono bg-black/20 px-2 py-1 rounded">{fmtUSD(agg.sellVolUsd)}</div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM TABLE SECTION */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-4">
                <button onClick={() => setActiveTab('exchanges')} className={`text-sm font-black uppercase tracking-widest pb-1 border-b-2 transition-colors ${activeTab === 'exchanges' ? 'text-[#dd9933] border-[#dd9933]' : 'text-gray-500 border-transparent hover:text-white'}`}>Exchanges (Detail)</button>
                <button onClick={() => setActiveTab('coins')} className={`text-sm font-black uppercase tracking-widest pb-1 border-b-2 transition-colors ${activeTab === 'coins' ? 'text-[#dd9933] border-[#dd9933]' : 'text-gray-500 border-transparent hover:text-white'}`}>Coins (LSR Overview)</button>
            </div>
            <button onClick={() => setShowTable(v => !v)} className="px-3 py-2 rounded-xl bg-black/20 border border-white/10 hover:bg-black/30 transition flex items-center gap-2 text-sm font-black">
              {showTable ? <ChevronUp size={16} /> : <ChevronDown size={16} />}{showTable ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>

          {showTable && (
            <div className="overflow-auto rounded-xl border border-white/10">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#0b0e11] z-10">
                  <tr className="border-b border-white/10">
                    <SortableContext items={activeTab === 'exchanges' ? exColOrder : coinColOrder} strategy={horizontalListSortingStrategy}>
                        {(activeTab === 'exchanges' ? exColOrder : coinColOrder).map(colId => {
                            const def = activeTab === 'exchanges' ? EX_COLS[colId] : COIN_COLS[colId];
                            return <SortableTh key={colId} colId={colId} label={def.label} sortKey={def.key} activeKey={sortKey} onSort={handleSort} align={def.align} />;
                        })}
                    </SortableContext>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {activeTab === 'exchanges' ? (
                      loadingExchange ? <tr><td colSpan={exColOrder.length} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-[#dd9933]" /></td></tr> :
                      sortedData.map((r: any) => <tr key={r.exchange} className="hover:bg-white/5 transition">{exColOrder.map(c => renderExchangeCell(r, c))}</tr>)
                  ) : (
                      loadingPulse ? <tr><td colSpan={coinColOrder.length} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-[#dd9933]" /></td></tr> :
                      sortedData.map((r: any) => <LsrCoinRow key={r.symbol} coin={r} colOrder={coinColOrder} renderCell={renderCoinCell} />)
                  )}
                </tbody>
              </table>
              </DndContext>
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
