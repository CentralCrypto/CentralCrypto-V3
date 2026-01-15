import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Treemap, Tooltip } from 'recharts';
import { createPortal } from 'react-dom';
import { Loader2, Maximize2, RefreshCw, AlertTriangle, BarChart2, PieChart, Minimize2 } from 'lucide-react';
import { fetchWithFallback } from '../services/api';
import { DashboardItem } from '../../../types';

interface Props {
item?: DashboardItem;
title?: string;
onClose?: () => void;
language?: string;
}

// ======================
// Helpers
// ======================
type AnyObj = Record<string, any>;

function isObj(v: any): v is AnyObj {
return !!v && typeof v === 'object' && !Array.isArray(v);
}

function safeNum(v: any, fallback = 0): number {
if (v === null || v === undefined) return fallback;
if (typeof v === 'number' && Number.isFinite(v)) return v;
if (typeof v === 'string') {
const n = Number(v.replace(/,/g, ''));
return Number.isFinite(n) ? n : fallback;
}
return fallback;
}

function pickFirst<T>(...vals: T[]): T | undefined {
for (const v of vals) {
if (v !== undefined && v !== null) return v;
}
return undefined;
}

/**
* Resolve qualquer formato de /cachecko/cachecko_lite.json para array de moedas
* Aceita:
* - array de moedas
* - array wrapper [ { data: [...] } ]
* - object wrapper { data: [...] }
* - object map { BTC: {...}, ETH: {...} }
*/
function resolveCoinsList(response: any): any[] {
if (!response) return [];

const tryUnwrap = (w: any): any[] => {
if (!w) return [];
if (Array.isArray(w)) return w;
if (isObj(w)) {
const vals = Object.values(w);
if (vals.length && isObj(vals[0])) return vals as any[];
}
return [];
};

if (Array.isArray(response)) {
// normal list
if (response.length > 1) return response;

// array wrapper [ { ... } ]
if (response.length === 1 && isObj(response[0])) {
const w = response[0];
const candidates = [
w.data,
w.coins,
w.items,
w.list,
w.result,
w.rows,
w.market,
w.cachecko,
w.cachecko_lite
];
for (const c of candidates) {
const out = tryUnwrap(c);
if (out.length) return out;
}
// fallback: values of wrapper itself
const out = tryUnwrap(w);
if (out.length) return out;
}
return response;
}

if (isObj(response)) {
const candidates = [
response.data,
response.coins,
response.items,
response.list,
response.result,
response.rows,
response.market,
response.cachecko,
response.cachecko_lite
];
for (const c of candidates) {
const out = tryUnwrap(c);
if (out.length) return out;
}
// object-map
const vals = Object.values(response);
if (vals.length && isObj(vals[0])) return vals as any[];
}

return [];
}

function useBoxSize<T extends HTMLElement>() {
const ref = useRef<T | null>(null);
const [size, setSize] = useState({ w: 0, h: 0 });

useEffect(() => {
if (!ref.current) return;

const el = ref.current;
const ro = new ResizeObserver((entries) => {
for (const entry of entries) {
const cr = entry.contentRect;
setSize({
w: Math.max(0, Math.floor(cr.width)),
h: Math.max(0, Math.floor(cr.height))
});
}
});
ro.observe(el);

return () => ro.disconnect();
}, []);

return { ref, size };
}

// ======================
// Colors / formatting
// ======================
const getColorForChange = (change: number) => {
if (change >= 15) return '#052e16';
if (change >= 7) return '#14532d';
if (change >= 5) return '#15803d';
if (change >= 3) return '#16a34a';
if (change >= 2) return '#22c55e';
if (change > 0) return '#4ade80';

if (change <= -15) return '#450a0a';
if (change <= -7) return '#7f1d1d';
if (change <= -5) return '#991b1b';
if (change <= -3) return '#dc2626';
if (change <= -2) return '#ef4444';
if (change < 0) return '#f87171';

return '#334155';
};

const formatUSD = (val: number) => {
if (!Number.isFinite(val)) return '-';
if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
return `$${val.toLocaleString()}`;
};

// ======================
// Treemap blocks
// ======================
const CustomTreemapContent = (props: any) => {
const { x, y, width, height, name, change } = props;

if (!width || !height || width < 5 || height < 5) return null;

const color = getColorForChange(change || 0);
const fontSizeSymbol = Math.min(width / 3, height / 3, 24);
const fontSizePct = Math.min(width / 5, height / 5, 14);
const showText = width > 40 && height > 35;

return (
<g>
<rect
x={x}
y={y}
width={width}
height={height}
style={{
fill: color,
stroke: '#1a1c1e',
strokeWidth: 2,
rx: 4,
ry: 4
}}
/>
{showText ? (
<>
<text
x={x + width / 2}
y={y + height / 2 - fontSizeSymbol * 0.2}
textAnchor="middle"
fill="#fff"
fontWeight="900"
fontSize={fontSizeSymbol}
style={{ pointerEvents: 'none', textShadow: '0px 2px 4px rgba(0,0,0,0.6)' }}
>
{name}
</text>
<text
x={x + width / 2}
y={y + height / 2 + fontSizeSymbol * 0.8}
textAnchor="middle"
fill="rgba(255,255,255,0.95)"
fontSize={fontSizePct}
fontWeight="700"
style={{ pointerEvents: 'none', textShadow: '0px 1px 2px rgba(0,0,0,0.8)' }}
>
{(change || 0) > 0 ? '+' : ''}
{(change || 0).toFixed(2)}%
</text>
</>
) : null}
</g>
);
};

const CustomTooltip = ({ active, payload }: any) => {
if (active && payload && payload.length) {
const data = payload[0].payload;
return (
<div className="bg-[#1a1c1e] border border-gray-700 p-4 rounded-xl shadow-2xl text-xs z-[9999] min-w-[200px]">
<div className="flex justify-between items-start mb-2">
<div className="flex flex-col">
<span className="font-black text-lg text-white">{data.name}</span>
<span className="text-gray-400 text-[10px] uppercase font-bold">{data.fullName}</span>
</div>
<span className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-[10px] font-bold">
Rank #{data.rank}
</span>
</div>

<div className="space-y-2 border-t border-gray-800 pt-2">
<div className="flex justify-between gap-6">
<span className="text-gray-400 font-medium">Preço Atual</span>
<span className="font-mono font-bold text-white">
{Number.isFinite(data.price)
? data.price < 1
? `$${data.price.toFixed(6)}`
: `$${data.price.toLocaleString()}`
: '-'}
</span>
</div>
<div className="flex justify-between gap-6">
<span className="text-gray-400 font-medium">Market Cap</span>
<span className="font-mono font-bold text-blue-400">{formatUSD(data.mcap)}</span>
</div>
<div className="flex justify-between gap-6">
<span className="text-gray-400 font-medium">Volume 24h</span>
<span className="font-mono font-bold text-yellow-500">{formatUSD(data.vol)}</span>
</div>
<div className="flex justify-between gap-6 pt-2 border-t border-gray-800 mt-1">
<span className="text-gray-400 font-bold uppercase">Variação 24h</span>
<span className={`font-mono font-black text-sm ${data.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
{data.change > 0 ? '+' : ''}
{safeNum(data.change, 0).toFixed(2)}%
</span>
</div>
</div>
</div>
);
}
return null;
};

// ======================
// Component
// ======================
const HeatmapWidget: React.FC<Props> = ({ item, title = "Crypto Heatmap", onClose }) => {
const [rawData, setRawData] = useState<any[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');

const [metric, setMetric] = useState<'mcap' | 'change'>('mcap');
const [isFullscreen, setIsFullscreen] = useState(item?.isMaximized || false);
const [refreshKey, setRefreshKey] = useState(0);

// sizes for chart container
const { ref: chartBoxRef, size: chartBox } = useBoxSize<HTMLDivElement>();

// Carregar Dados
useEffect(() => {
let cancelled = false;

const load = async () => {
setLoading(true);
setError('');
try {
const resAny: any = await fetchWithFallback('/cachecko/cachecko_lite.json');

// fetchWithFallback às vezes já devolve JSON, às vezes devolve Response
let response: any = resAny;
if (resAny && typeof resAny.json === 'function') {
response = await resAny.json();
}

const list = resolveCoinsList(response);

if (!cancelled) {
if (list.length > 0) {
setRawData(list);
} else {
setRawData([]);
setError('Sem dados disponíveis (lista 0).');
}
}
} catch (e) {
console.error(e);
if (!cancelled) {
setRawData([]);
setError('Erro ao carregar dados.');
}
} finally {
if (!cancelled) setLoading(false);
}
};

load();

return () => {
cancelled = true;
};
}, [refreshKey]);

// Processamento de Dados
const leaves = useMemo(() => {
if (!rawData.length) return [];

const mapped = rawData
.map((coin: any, index: number) => {
const symbol = String(pickFirst(coin.s, coin.symbol, coin.ticker) || '').toUpperCase();
const name = String(pickFirst(coin.n, coin.name, coin.full_name, symbol) || symbol);

const price = safeNum(pickFirst(coin.p, coin.current_price, coin.price, coin.last), 0);
const change = safeNum(pickFirst(coin.p24, coin.price_change_percentage_24h, coin.change_24h, coin.change24, coin.change), 0);
const mcap = safeNum(pickFirst(coin.mc, coin.market_cap, coin.mcap, coin.marketcap), 0);
const vol = safeNum(pickFirst(coin.v, coin.total_volume, coin.volume_24h, coin.vol24, coin.volume), 0);

if (!symbol) return null;

let sizeValue = 0;
if (metric === 'mcap') {
sizeValue = mcap;
} else {
sizeValue = Math.pow(Math.abs(change) + 1, 3) * Math.max(1, Math.log10(mcap || 1000));
}

if (!Number.isFinite(sizeValue) || sizeValue <= 0) return null;

return {
name: symbol,
fullName: name,
size: sizeValue,
change,
price,
mcap,
vol,
rank: index + 1
};
})
.filter((x): x is any => !!x)
.sort((a, b) => b.size - a.size)
.slice(0, 80);

return mapped;
}, [rawData, metric]);

const treeData = useMemo(() => {
if (!leaves.length) return [];
return [{ name: 'Market', children: leaves }];
}, [leaves]);

const handleToggleFullscreen = () => {
if (item?.isMaximized && onClose) {
onClose();
return;
}
setIsFullscreen(v => !v);
};

const chartW = Math.max(0, chartBox.w);
const chartH = Math.max(0, chartBox.h);

// render chart only when measured
const canRenderChart = chartW >= 50 && chartH >= 50 && treeData.length > 0;

const renderContent = () => (
<div className="relative w-full h-full flex flex-col bg-[#1a1c1e] overflow-hidden">
{/* Header */}
<div className="flex justify-between items-center px-4 py-3 border-b border-gray-800 bg-[#1a1c1e] shrink-0 z-10">
<div className="flex items-center gap-4">
<span className="text-sm font-black text-white uppercase tracking-wider hidden sm:inline">{title}</span>
{!loading && !error && (
<div className="flex bg-black/40 p-0.5 rounded-lg border border-gray-700">
<button
onClick={() => setMetric('mcap')}
className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded flex items-center gap-1.5 transition-all ${metric === 'mcap' ? 'bg-[#dd9933] text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}
title="Tamanho proporcional ao Market Cap"
>
<PieChart size={14} /> MarketCap
</button>
<button
onClick={() => setMetric('change')}
className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded flex items-center gap-1.5 transition-all ${metric === 'change' ? 'bg-[#dd9933] text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}
title="Tamanho proporcional à Variação de Preço (Volatilidade)"
>
<BarChart2 size={14} /> Var. Price 24h
</button>
</div>
)}
</div>

<div className="flex items-center gap-2">
<button
onClick={() => setRefreshKey(k => k + 1)}
className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
title="Atualizar Dados"
>
<RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
</button>
<button
onClick={handleToggleFullscreen}
className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
title={isFullscreen ? "Minimizar" : "Tela Cheia"}
>
{isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
</button>
</div>
</div>

{/* Legenda */}
<div className="bg-[#121416] border-b border-gray-800 px-4 py-2 flex items-center justify-between shrink-0 overflow-x-auto no-scrollbar">
<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-4 whitespace-nowrap">Escala (Var. Price 24h)</span>
<div className="flex items-center gap-1 flex-1 min-w-[200px] h-3">
<div className="flex-1 h-full rounded-sm bg-[#7f1d1d]" title="-7% ou pior"></div>
<div className="flex-1 h-full rounded-sm bg-[#dc2626]" title="-5%"></div>
<div className="flex-1 h-full rounded-sm bg-[#ef4444]" title="-3%"></div>
<div className="flex-1 h-full rounded-sm bg-[#f87171]" title="-2%"></div>
<div className="flex-1 h-full rounded-sm bg-[#334155]" title="0%"></div>
<div className="flex-1 h-full rounded-sm bg-[#4ade80]" title="+2%"></div>
<div className="flex-1 h-full rounded-sm bg-[#22c55e]" title="+3%"></div>
<div className="flex-1 h-full rounded-sm bg-[#16a34a]" title="+5%"></div>
<div className="flex-1 h-full rounded-sm bg-[#14532d]" title="+7% ou melhor"></div>
</div>
<div className="flex text-[9px] font-mono font-bold text-gray-500 gap-10 ml-4">
<span>-7%</span>
<span>0%</span>
<span>+7%</span>
</div>
</div>

{/* Chart */}
<div className="flex-1 w-full relative bg-[#1a1c1e]">
<div ref={chartBoxRef} className="absolute inset-0">
{loading ? (
<div className="absolute inset-0 flex items-center justify-center z-20">
<div className="flex flex-col items-center gap-3">
<Loader2 className="animate-spin text-[#dd9933]" size={40} />
<span className="text-xs font-bold uppercase text-gray-500 tracking-widest animate-pulse">Carregando Mapa...</span>
</div>
</div>
) : error ? (
<div className="absolute inset-0 flex flex-col items-center justify-center z-20 text-red-500 gap-3 p-4 text-center">
<AlertTriangle size={32} />
<span className="font-bold">{error}</span>
<button
onClick={() => setRefreshKey(k => k + 1)}
className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 rounded text-red-200 text-xs font-bold uppercase"
>
Tentar Novamente
</button>
</div>
) : !canRenderChart ? (
<div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs font-bold uppercase tracking-widest">
{treeData.length === 0 ? 'Sem folhas válidas (mcap/vol=0?)' : 'Medindo área do gráfico…'}
</div>
) : (
<Treemap
width={chartW}
height={chartH}
data={treeData}
dataKey="size"
stroke="#1a1c1e"
fill="#1a1c1e"
content={<CustomTreemapContent />}
isAnimationActive={false}
aspectRatio={16 / 9}
>
<Tooltip content={<CustomTooltip />} cursor={false} allowEscapeViewBox={{ x: true, y: true }} />
</Treemap>
)}
</div>
</div>

{/* LISTA DAS MOEDAS (DO JSON) */}
<div className="shrink-0 border-t border-gray-800 bg-[#121416]">
<div className="px-4 py-2 flex items-center justify-between">
<div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
Moedas do cachecko_lite.json
</div>
<div className="text-[10px] font-mono text-gray-500">
raw: {rawData.length} | leaves: {leaves.length} | box: {chartW}x{chartH}
</div>
</div>

<div className="max-h-[260px] overflow-auto border-t border-gray-800">
<table className="w-full border-collapse text-left text-[11px]">
<thead className="sticky top-0 bg-[#0f1113]">
<tr className="text-white/70">
<th className="px-3 py-2">Símbolo</th>
<th className="px-3 py-2">Nome</th>
<th className="px-3 py-2">Preço</th>
<th className="px-3 py-2">MCap</th>
<th className="px-3 py-2">Vol 24h</th>
<th className="px-3 py-2">24h%</th>
</tr>
</thead>
<tbody>
{rawData.slice(0, 200).map((coin: any, idx: number) => {
const symbol = String(pickFirst(coin.s, coin.symbol, coin.ticker) || '').toUpperCase();
const name = String(pickFirst(coin.n, coin.name, coin.full_name, symbol) || symbol);
const price = safeNum(pickFirst(coin.p, coin.current_price, coin.price, coin.last), 0);
const change = safeNum(pickFirst(coin.p24, coin.price_change_percentage_24h, coin.change_24h, coin.change24, coin.change), 0);
const mcap = safeNum(pickFirst(coin.mc, coin.market_cap, coin.mcap, coin.marketcap), 0);
const vol = safeNum(pickFirst(coin.v, coin.total_volume, coin.volume_24h, coin.vol24, coin.volume), 0);

return (
<tr key={`${symbol || 'coin'}-${idx}`} className="border-t border-white/5 text-white/90">
<td className="px-3 py-2 font-semibold">{symbol || '-'}</td>
<td className="px-3 py-2">{name || '-'}</td>
<td className="px-3 py-2 font-mono">{price ? (price < 1 ? `$${price.toFixed(6)}` : `$${price.toLocaleString()}`) : '-'}</td>
<td className="px-3 py-2 font-mono">{mcap ? formatUSD(mcap) : '-'}</td>
<td className="px-3 py-2 font-mono">{vol ? formatUSD(vol) : '-'}</td>
<td className={`px-3 py-2 font-mono font-bold ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
{change > 0 ? '+' : ''}{change.toFixed(2)}%
</td>
</tr>
);
})}
{rawData.length === 0 ? (
<tr>
<td colSpan={6} className="px-3 py-8 text-center text-gray-500">
Nada carregado do JSON.
</td>
</tr>
) : null}
</tbody>
</table>
</div>
</div>
</div>
);

if (isFullscreen) {
return createPortal(
<div className="fixed inset-0 z-[9999] w-screen h-screen bg-[#1a1c1e] flex flex-col overflow-hidden animate-in fade-in duration-200">
{renderContent()}
</div>,
document.body
);
}

return (
<div className="w-full h-full overflow-hidden rounded-xl border border-gray-800 shadow-xl bg-[#1a1c1e] flex flex-col">
{renderContent()}
</div>
);
};

export default HeatmapWidget;
