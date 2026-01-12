import React, { useEffect, useMemo, useRef, useState } from 'react';
import Highcharts from 'highcharts';
import TreemapModule from 'highcharts/modules/treemap';
import ExportingModule from 'highcharts/modules/exporting';
import AccessibilityModule from 'highcharts/modules/accessibility';
import { DashboardItem, Language } from '../../../types';
import { Loader2 } from 'lucide-react';

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

let HC_INITED = false;

function initHighchartsOnce() {
if (HC_INITED) return;
HC_INITED = true;

try { (TreemapModule as any)(Highcharts); } catch (e) { console.error(e); }
try { (ExportingModule as any)(Highcharts); } catch (e) { /* ignore */ }
try { (AccessibilityModule as any)(Highcharts); } catch (e) { /* ignore */ }

Highcharts.setOptions({
chart: { style: { fontFamily: 'Inter, system-ui, sans-serif' } },
lang: { thousandsSep: ',' }
});
}

const ENDPOINTS = {
COINS_LITE: '/cachecko/cachecko_lite.json'
};

async function httpGetJson(url: string) {
const salt = Math.floor(Date.now() / 60000);
const finalUrl = url.includes('?') ? `${url}&_cb=${salt}` : `${url}?_cb=${salt}`;
const r = await fetch(finalUrl, { cache: 'no-store' });
if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
return r.json();
}

function safeNum(v: any) {
const n = Number(v);
return Number.isFinite(n) ? n : 0;
}

function safeUpper(s?: string) {
return (s || '').toUpperCase();
}

function fmtPct(v: number) {
if (!Number.isFinite(v)) return '0.00%';
return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function fmtMoney(v: number) {
const n = safeNum(v);
const abs = Math.abs(n);
if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
if (abs >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
return `$${n.toLocaleString()}`;
}

function fmtPrice(v: number) {
const n = safeNum(v);
if (n === 0) return '$0';
if (n < 0.0001) return `$${n.toExponential(2)}`;
if (n < 1) return `$${n.toFixed(6)}`;
if (n < 100) return `$${n.toFixed(4)}`;
return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function clamp(v: number, min: number, max: number) {
return Math.max(min, Math.min(max, v));
}

interface HeatmapWidgetProps {
item: DashboardItem;
language?: Language;
}

export default function HeatmapWidget({ item, language }: HeatmapWidgetProps) {
const [loading, setLoading] = useState(true);
const [coins, setCoins] = useState<Coin[]>([]);
const [valueMode, setValueMode] = useState<ValueMode>('marketcap');

const containerRef = useRef<HTMLDivElement>(null);
const chartRef = useRef<Highcharts.Chart | null>(null);

useEffect(() => { initHighchartsOnce(); }, []);

const loadData = async () => {
setLoading(true);
try {
const cData = await httpGetJson(ENDPOINTS.COINS_LITE);

// cachecko-lite pode vir como:
// 1) [{ updated_at, stats, data:[...] }]
// 2) { data:[...] }
// 3) diretamente array de moedas
let arr: any[] = [];

if (Array.isArray(cData)) {
if (cData.length > 0 && cData[0]?.data && Array.isArray(cData[0].data)) {
arr = cData[0].data;
} else {
arr = cData;
}
} else if (cData?.data && Array.isArray(cData.data)) {
arr = cData.data;
}

setCoins(arr as Coin[]);
} catch (e) {
console.error('[Heatmap] load error', e);
setCoins([]);
} finally {
setLoading(false);
}
};

useEffect(() => { loadData(); }, []);

const chartData = useMemo(() => {
const list = coins
.filter(c => c && c.id && c.symbol)
.map(c => {
const change24 = safeNum(c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h);
const mc = safeNum(c.market_cap);

// size:
let value = 1;
if (valueMode === 'marketcap') {
value = Math.max(1, mc);
} else {
// tamanho = magnitude da variação 24h (abs %)
value = Math.max(0.01, Math.abs(change24));
}

// color ALWAYS = % 24h
const colorValue = clamp(change24, -50, 50);

return {
id: String(c.id),
name: safeUpper(c.symbol),
value,
colorValue,
custom: {
fullName: c.name || '',
logo: c.image || '',
rank: safeNum(c.market_cap_rank),
price: safeNum(c.current_price),
change24,
mcap: mc,
fdv: safeNum(c.fully_diluted_valuation),
vol: safeNum(c.total_volume),
high24: safeNum(c.high_24h),
low24: safeNum(c.low_24h),
priceCh24: safeNum(c.price_change_24h),
mcapCh24: safeNum(c.market_cap_change_24h),
mcapChPct24: safeNum(c.market_cap_change_percentage_24h),
circ: safeNum(c.circulating_supply),
supply: safeNum(c.total_supply),
max: c.max_supply ?? null,
ath: safeNum(c.ath),
athCh: safeNum(c.ath_change_percentage),
athDate: c.ath_date || '',
atl: safeNum(c.atl),
atlCh: safeNum(c.atl_change_percentage),
atlDate: c.atl_date || '',
lastUpdated: c.last_updated || ''
}
};
});

// IMPORTANTÍSSIMO: garantir id único (defensivo)
const seen = new Set<string>();
const unique = [];
for (const p of list) {
let id = p.id;
if (seen.has(id)) {
let k = 2;
while (seen.has(`${id}__${k}`)) k++;
id = `${id}__${k}`;
p.id = id;
}
seen.add(id);
unique.push(p);
}

return unique;
}, [coins, valueMode]);

// Build/update chart
useEffect(() => {
if (!containerRef.current) return;

// se container ainda não tem tamanho, espera
const rect = containerRef.current.getBoundingClientRect();
if (rect.width < 10 || rect.height < 10) return;

const hasTreemap = !!(Highcharts as any).seriesTypes?.treemap;
if (!hasTreemap) {
console.error('[Heatmap] Treemap module not loaded');
return;
}

const options: Highcharts.Options = {
chart: {
backgroundColor: '#111216',
margin: 0,
spacing: [0, 0, 0, 0],
height: rect.height,
animation: false
},
title: { text: null },
subtitle: { text: null },
credits: { enabled: false },
exporting: { enabled: false },
legend: { enabled: false },
accessibility: { enabled: false },
tooltip: {
useHTML: true,
outside: false,
followPointer: true,
backgroundColor: 'rgba(20,20,25,0.95)',
borderColor: '#2a2d39',
borderRadius: 12,
shadow: true,
padding: 0,
formatter: function () {
const p: any = this.point;
const c = p.custom || {};
const pct = safeNum(c.change24);
const pctColor = pct >= 0 ? '#2ecc59' : '#f73539';

return `
<div style="padding:12px; min-width:260px; color:#fff; font-family:Inter,system-ui,sans-serif;">
<div style="display:flex; align-items:center; gap:10px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.08);">
${c.logo ? `<img src="${c.logo}" style="width:28px; height:28px; border-radius:50%; background:#0b0c10;">` : ''}
<div style="min-width:0;">
<div style="font-weight:900; font-size:14px; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
${p.name} <span style="opacity:0.75; font-weight:700;">${c.fullName || ''}</span>
</div>
<div style="font-size:11px; opacity:0.75; margin-top:2px;">
Rank: <b style="color:#ddd;">#${c.rank || '-'}</b>
<span style="margin-left:10px; color:${pctColor}; font-weight:900;">${fmtPct(pct)}</span>
</div>
</div>
</div>

<div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:10px;">
<div style="font-size:22px; font-weight:900; letter-spacing:-0.02em;">
${fmtPrice(safeNum(c.price))}
</div>
<div style="font-size:11px; opacity:0.8; text-align:right;">
<div>High 24h: <b style="color:#ddd;">${fmtPrice(safeNum(c.high24))}</b></div>
<div>Low 24h: <b style="color:#ddd;">${fmtPrice(safeNum(c.low24))}</b></div>
</div>
</div>

<div style="margin-top:10px; display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:11px;">
<div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:10px;">
<div style="opacity:0.7;">Market Cap</div>
<div style="font-weight:900; margin-top:2px;">${fmtMoney(safeNum(c.mcap))}</div>
<div style="opacity:0.7; margin-top:6px;">FDV</div>
<div style="font-weight:800; margin-top:2px;">${fmtMoney(safeNum(c.fdv))}</div>
</div>
<div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:10px;">
<div style="opacity:0.7;">Volume 24h</div>
<div style="font-weight:900; margin-top:2px;">${fmtMoney(safeNum(c.vol))}</div>
<div style="opacity:0.7; margin-top:6px;">Price chg 24h</div>
<div style="font-weight:800; margin-top:2px; color:${safeNum(c.priceCh24) >= 0 ? '#2ecc59' : '#f73539'};">${fmtPrice(safeNum(c.priceCh24))}</div>
</div>
</div>

<div style="margin-top:10px; display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:11px;">
<div style="background:rgba(255,255,255,0.04); padding:8px; border-radius:10px;">
<div style="opacity:0.7;">Supply</div>
<div style="margin-top:2px;">
<span style="opacity:0.8;">Circ:</span> <b style="color:#ddd;">${safeNum(c.circ).toLocaleString()}</b><br/>
<span style="opacity:0.8;">Total:</span> <b style="color:#ddd;">${safeNum(c.supply).toLocaleString()}</b><br/>
<span style="opacity:0.8;">Max:</span> <b style="color:#ddd;">${c.max === null ? '-' : Number(c.max).toLocaleString()}</b>
</div>
</div>
<div style="background:rgba(255,255,255,0.04); padding:8px; border-radius:10px;">
<div style="opacity:0.7;">ATH / ATL</div>
<div style="margin-top:2px;">
<span style="opacity:0.8;">ATH:</span> <b style="color:#ddd;">${fmtPrice(safeNum(c.ath))}</b> <span style="opacity:0.8;">(${fmtPct(safeNum(c.athCh))})</span><br/>
<span style="opacity:0.8;">ATL:</span> <b style="color:#ddd;">${fmtPrice(safeNum(c.atl))}</b> <span style="opacity:0.8;">(${fmtPct(safeNum(c.atlCh))})</span>
</div>
</div>
</div>

<div style="margin-top:10px; font-size:10px; opacity:0.65;">
Last updated: ${c.lastUpdated || '-'}
</div>
</div>
`;
}
},
colorAxis: {
min: -50,
max: 50,
minColor: '#f73539',
maxColor: '#2ecc59',
stops: [
[0, '#f73539'],
[0.5, '#414555'],
[1, '#2ecc59']
],
gridLineWidth: 0,
labels: { enabled: false }
},
plotOptions: {
series: {
animation: false,
states: { inactive: { opacity: 1 } }
},
treemap: {
layoutAlgorithm: 'squarified',
borderColor: '#111216',
borderWidth: 1,
colorByPoint: false
}
},
series: [{
type: 'treemap',
name: 'All',
data: chartData as any,
colorAxis: 0 as any,
colorKey: 'colorValue' as any,

// CRÍTICO: evita o Warning #12 com 2000+ objetos
turboThreshold: 0,

allowDrillToNode: false,
animationLimit: 1000,
opacity: 1,
dataLabels: {
enabled: true,
useHTML: true,
allowOverlap: true,
style: { textOutline: 'none' },
formatter: function () {
const p: any = this.point;
const c = p.custom || {};
const shape = p.shapeArgs || {};
const w = safeNum(shape.width);
const h = safeNum(shape.height);
const area = w * h;

// muito pequeno? não desenha nada (só tooltip)
if (w < 55 || h < 40 || area < 2600) return '';

const showLogo = !!c.logo && w >= 90 && h >= 70;
const pct = safeNum(c.change24);
const pctColor = pct >= 0 ? '#2ecc59' : '#f73539';

// tamanhos dinâmicos
const symSize = Math.floor(clamp(10 + area * 0.00006, 12, 38));
const priceSize = Math.floor(clamp(9 + area * 0.000045, 10, 28));
const logoSize = Math.floor(clamp(symSize * 1.15, 16, 34));

// se o texto vai ficar ridículo, mata o preço
const showPrice = w >= 110 && h >= 85;

return `
<div style="pointer-events:none; text-align:center; line-height:1.05;">
${showLogo ? `<img src="${c.logo}" style="width:${logoSize}px; height:${logoSize}px; border-radius:50%; margin:0 auto 4px auto; box-shadow:0 2px 6px rgba(0,0,0,0.35);" />` : ''}
<div style="font-weight:900; font-size:${symSize}px; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,0.65);">
${p.name}
</div>
${showPrice ? `<div style="font-weight:800; font-size:${priceSize}px; opacity:0.95; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,0.65);">${fmtPrice(safeNum(c.price))}</div>` : ''}
<div style="font-weight:900; font-size:${Math.max(10, Math.floor(symSize * 0.62))}px; color:${pctColor}; text-shadow:0 1px 2px rgba(0,0,0,0.65);">
${fmtPct(pct)}
</div>
</div>
`;
}
}
}] as any
};

const raf = requestAnimationFrame(() => {
if (!containerRef.current) return;

// cria uma vez, depois só atualiza
if (!chartRef.current) {
chartRef.current = Highcharts.chart(containerRef.current, options as any);
} else {
const s0 = chartRef.current.series?.[0];
if (s0) {
s0.setData(chartData as any, false, false, false);
}
chartRef.current.redraw(false);
chartRef.current.reflow();
}
});

return () => cancelAnimationFrame(raf);
}, [chartData]);

// reflow em resize (pra não “vazar” e nem criar scroll)
useEffect(() => {
if (!containerRef.current) return;

const ro = new ResizeObserver(() => {
if (chartRef.current) {
chartRef.current.reflow();
}
});
ro.observe(containerRef.current);

return () => ro.disconnect();
}, []);

useEffect(() => {
return () => {
if (chartRef.current) {
chartRef.current.destroy();
chartRef.current = null;
}
};
}, []);

return (
<div className="h-full w-full bg-[#111216] overflow-hidden flex flex-col">
{/* Header */}
<div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-[#111216] shrink-0 z-20">
<div className="flex bg-white/5 rounded p-0.5">
<button
type="button"
onClick={() => setValueMode('marketcap')}
className={`px-3 py-1 text-[11px] font-black rounded transition-colors ${valueMode === 'marketcap' ? 'bg-[#dd9933] text-black' : 'text-gray-300 hover:text-white'}`}
>
MarketCap
</button>
<button
type="button"
onClick={() => setValueMode('var24h')}
className={`px-3 py-1 text-[11px] font-black rounded transition-colors ${valueMode === 'var24h' ? 'bg-[#dd9933] text-black' : 'text-gray-300 hover:text-white'}`}
>
Var.Preço 24Hs
</button>
</div>

<div className="ml-2 flex items-center gap-2 text-[11px] text-gray-300">
<span className="opacity-70">-50%</span>
<div className="h-[6px] w-[180px] rounded-full"
style={{ background: 'linear-gradient(90deg, #f73539 0%, #414555 50%, #2ecc59 100%)' }}
/>
<span className="opacity-70">+50%</span>
</div>

<div className="ml-auto text-[11px] text-gray-400">
{coins.length ? `${coins.length.toLocaleString()} moedas` : ''}
</div>
</div>

{/* Chart */}
<div className="relative flex-1 min-h-0 overflow-hidden">
<div ref={containerRef} className="absolute inset-0 overflow-hidden" />
{loading && (
<div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30">
<div className="flex items-center gap-2 text-[#dd9933] font-black">
<Loader2 className="animate-spin" size={18} />
<span className="text-[12px]">Carregando heatmap…</span>
</div>
</div>
)}
</div>
</div>
);
}
