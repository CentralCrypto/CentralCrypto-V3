// HeatmapWidget.tsx
// Drop-in replacement. Fetches /cachecko/cachecko_lite.json, normalizes ANY shape into a coin array,
// renders a Treemap heatmap + shows the loaded coins list on-screen (with search + debug panel).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
ResponsiveContainer,
Treemap,
Tooltip
} from 'recharts';

type Metric = 'mcap' | 'vol' | 'change';

type AnyObj = Record<string, any>;

type Coin = {
id?: string;
symbol?: string;
name?: string;
image?: string;

price?: number; // USD
mcap?: number; // USD
vol?: number; // USD 24h
change?: number; // % 24h

category?: string;
sector?: string;

raw?: AnyObj;
};

type TreeNode = {
name: string;
size?: number;
change?: number;
symbol?: string;
price?: number;
mcap?: number;
vol?: number;
image?: string;
children?: TreeNode[];
};

const DEBUG_HEATMAP = true;

// ---------- helpers ----------
function isObj(v: any): v is AnyObj {
return !!v && typeof v === 'object' && !Array.isArray(v);
}

function toNum(v: any): number | undefined {
if (v === null || v === undefined) return undefined;
if (typeof v === 'number' && Number.isFinite(v)) return v;
if (typeof v === 'string') {
const n = Number(v.replace(/,/g, ''));
return Number.isFinite(n) ? n : undefined;
}
return undefined;
}

function pickFirst<T>(...vals: T[]): T | undefined {
for (const v of vals) {
if (v !== undefined && v !== null) return v;
}
return undefined;
}

function normalizeResponseToArray(response: any): any[] {
let list: any[] = [];

if (Array.isArray(response)) return response;

if (!isObj(response)) return list;

// common array holders
if (Array.isArray((response as any).data)) return (response as any).data;
if (Array.isArray((response as any).coins)) return (response as any).coins;
if (Array.isArray((response as any).items)) return (response as any).items;
if (Array.isArray((response as any).result)) return (response as any).result;
if (Array.isArray((response as any).rows)) return (response as any).rows;

// object-map holders -> values()
if (isObj((response as any).data)) {
const values = Object.values((response as any).data);
if (values.length && isObj(values[0])) return values as any[];
}
if (isObj((response as any).coins)) {
const values = Object.values((response as any).coins);
if (values.length && isObj(values[0])) return values as any[];
}
if (isObj((response as any).items)) {
const values = Object.values((response as any).items);
if (values.length && isObj(values[0])) return values as any[];
}

// LAST RESORT: if the response itself looks like a single coin-ish object, wrap it
const keys = Object.keys(response);
const looksCoinish = keys.some(k =>
['symbol', 'name', 'current_price', 'price', 'market_cap', 'mcap', 'total_volume', 'vol', 'price_change_percentage_24h', 'change'].includes(k)
);
if (looksCoinish) return [response];

return list;
}

function normalizeCoin(raw: AnyObj): Coin | null {
if (!raw || typeof raw !== 'object') return null;

const symbol = pickFirst<string>(
raw.symbol,
raw.s,
raw.ticker
);
const name = pickFirst<string>(
raw.name,
raw.n,
raw.full_name,
raw.title
);

const price = pickFirst<number>(
toNum(raw.current_price),
toNum(raw.price),
toNum(raw.p),
toNum(raw.last),
toNum(raw.usd)
);

const mcap = pickFirst<number>(
toNum(raw.market_cap),
toNum(raw.mcap),
toNum(raw.mc),
toNum(raw.marketcap)
);

const vol = pickFirst<number>(
toNum(raw.total_volume),
toNum(raw.volume_24h),
toNum(raw.vol24),
toNum(raw.v),
toNum(raw.volume)
);

const change = pickFirst<number>(
toNum(raw.price_change_percentage_24h),
toNum(raw.change_24h),
toNum(raw.change24),
toNum(raw.p24),
toNum(raw.change)
);

const id = pickFirst<string>(
raw.id,
raw.coingecko_id,
raw.cg_id
);

const image = pickFirst<string>(
raw.image,
raw.logo,
raw.icon
);

const category = pickFirst<string>(
raw.category,
raw.cat,
raw.group,
raw.sector,
raw.segment
);

if (!symbol && !name && !id) return null;

return {
id,
symbol: symbol ? String(symbol).toUpperCase() : undefined,
name: name ? String(name) : undefined,
image: image ? String(image) : undefined,
price,
mcap,
vol,
change,
category: category ? String(category) : undefined,
raw
};
}

function formatCompactUSD(n?: number): string {
if (n === undefined) return '-';
const abs = Math.abs(n);
if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
return n.toFixed(2);
}

function clamp(n: number, min: number, max: number): number {
return Math.min(max, Math.max(min, n));
}

function buildTree(coins: Coin[], metric: Metric): TreeNode[] {
const sizeKey: keyof Coin = metric === 'mcap' ? 'mcap' : metric === 'vol' ? 'vol' : 'mcap';

const valid = coins
.map(c => {
const size = (c[sizeKey] ?? 0) as number;
return {
...c,
__size: Number.isFinite(size) && size > 0 ? size : 0
};
})
.filter(c => (c as any).__size > 0);

if (!valid.length) {
return [{
name: 'Sem dados (size=0)',
children: [{
name: 'Verifique o JSON',
size: 1,
change: 0
}]
}];
}

const grouped = new Map<string, Coin[]>();
for (const c of valid) {
const g = c.category || 'Coins';
if (!grouped.has(g)) grouped.set(g, []);
grouped.get(g)!.push(c);
}

const tree: TreeNode[] = [];
for (const [groupName, arr] of grouped.entries()) {
arr.sort((a, b) => ((b as any).__size || 0) - ((a as any).__size || 0));
tree.push({
name: groupName,
children: arr.map(c => ({
name: c.name || c.symbol || c.id || 'Unknown',
symbol: c.symbol,
price: c.price,
mcap: c.mcap,
vol: c.vol,
change: c.change,
image: c.image,
size: (c as any).__size
}))
});
}
return tree;
}

// Tooltip content (simple, no custom colors requested)
function HeatTooltip({ active, payload }: any) {
if (!active || !payload || !payload.length) return null;
const p = payload[0]?.payload as any;
if (!p) return null;

return (
<div className="rounded-xl border border-white/10 bg-[#0f1113] px-3 py-2 shadow-lg">
<div className="text-sm font-semibold text-white">
{p.symbol ? `${p.symbol} ` : ''}{p.name || ''}
</div>
<div className="mt-1 text-xs text-white/70">
<div>Preço: {p.price !== undefined ? `$${p.price}` : '-'}</div>
<div>MCap: {p.mcap !== undefined ? `$${formatCompactUSD(p.mcap)}` : '-'}</div>
<div>Vol 24h: {p.vol !== undefined ? `$${formatCompactUSD(p.vol)}` : '-'}</div>
<div>24h: {p.change !== undefined ? `${p.change.toFixed(2)}%` : '-'}</div>
</div>
</div>
);
}

export default function HeatmapWidget() {
const [metric, setMetric] = useState<Metric>('mcap');
const [loading, setLoading] = useState(false);
const [err, setErr] = useState<string | null>(null);

const [coins, setCoins] = useState<Coin[]>([]);
const [rawPreview, setRawPreview] = useState<string>('');
const [search, setSearch] = useState('');
const [showDebug, setShowDebug] = useState(true);

const mountedRef = useRef(true);

useEffect(() => {
mountedRef.current = true;
return () => {
mountedRef.current = false;
};
}, []);

useEffect(() => {
let cancelled = false;

async function run() {
setLoading(true);
setErr(null);

try {
const url = '/cachecko/cachecko_lite.json';
const res = await fetch(url, { cache: 'no-store' });
if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar ${url}`);

const response = await res.json();

if (DEBUG_HEATMAP) {
console.log('[Heatmap] fetch ok', response);
console.log('[Heatmap] response keys', response && typeof response === 'object' ? Object.keys(response) : null);
console.log('[Heatmap] response JSON preview', JSON.stringify(response).slice(0, 1200));
}

const list = normalizeResponseToArray(response);

if (DEBUG_HEATMAP) {
console.log('[Heatmap] normalized list len', list.length);
if (list.length > 0) {
console.log('[Heatmap] sample coin keys', Object.keys(list[0] || {}));
console.log('[Heatmap] sample coin obj', list[0]);
}
}

const normalized = list
.map((x: any) => normalizeCoin(x))
.filter(Boolean) as Coin[];

if (DEBUG_HEATMAP) {
console.log('[Heatmap] normalized coins len', normalized.length);
}

if (cancelled || !mountedRef.current) return;

setCoins(normalized);
setRawPreview(JSON.stringify(response, null, 2).slice(0, 8000));
} catch (e: any) {
if (cancelled || !mountedRef.current) return;
setErr(e?.message || 'Erro desconhecido');
setCoins([]);
setRawPreview('');
} finally {
if (cancelled || !mountedRef.current) return;
setLoading(false);
}
}

run();
return () => {
cancelled = true;
};
}, []);

const filteredCoins = useMemo(() => {
const q = search.trim().toLowerCase();
if (!q) return coins;
return coins.filter(c => {
const s = (c.symbol || '').toLowerCase();
const n = (c.name || '').toLowerCase();
const id = (c.id || '').toLowerCase();
return s.includes(q) || n.includes(q) || id.includes(q);
});
}, [coins, search]);

const treeData = useMemo(() => {
const t = buildTree(filteredCoins, metric);
if (DEBUG_HEATMAP) {
const leavesLen = filteredCoins.filter(c => (metric === 'mcap' ? (c.mcap || 0) : metric === 'vol' ? (c.vol || 0) : (c.mcap || 0)) > 0).length;
console.log('[Heatmap] build treeData', {
metric,
rawLen: coins.length,
filteredLen: filteredCoins.length,
leavesLen,
sampleLeaves: filteredCoins.slice(0, 5).map(c => ({ symbol: c.symbol, mcap: c.mcap, vol: c.vol, change: c.change }))
});
}
return t;
}, [filteredCoins, metric, coins.length]);

return (
<div className="w-full">
<div className="rounded-2xl border border-white/10 bg-[#121416] p-3">
<div className="flex flex-wrap items-center justify-between gap-2">
<div className="flex items-center gap-2">
<div className="text-sm font-semibold text-white">Heatmap</div>
<div className="text-xs text-white/60">
{loading ? 'carregando…' : `coins: ${coins.length} | filtradas: ${filteredCoins.length}`}
</div>
</div>

<div className="flex flex-wrap items-center gap-2">
<input
value={search}
onChange={(e) => setSearch(e.target.value)}
placeholder="buscar (BTC, ETH…)…"
className="h-9 w-56 rounded-xl border border-white/10 bg-[#0f1113] px-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/20"
/>

<select
value={metric}
onChange={(e) => setMetric(e.target.value as Metric)}
className="h-9 rounded-xl border border-white/10 bg-[#0f1113] px-3 text-sm text-white outline-none focus:border-white/20"
>
<option value="mcap">Tamanho: MarketCap</option>
<option value="vol">Tamanho: Volume 24h</option>
<option value="change">Cor: Variação 24h (tooltip)</option>
</select>

<button
onClick={() => setShowDebug(v => !v)}
className="h-9 rounded-xl border border-white/10 bg-[#0f1113] px-3 text-sm text-white/90 hover:border-white/20"
>
{showDebug ? 'Esconder debug' : 'Mostrar debug'}
</button>
</div>
</div>

{err ? (
<div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
Erro: {err}
</div>
) : null}

{/* CHART AREA */}
<div
className="mt-3 w-full rounded-2xl border border-white/10 bg-[#1a1c1e] p-2"
style={{ minHeight: 520 }}
>
<div className="w-full" style={{ height: 520 }}>
<ResponsiveContainer width="100%" height="100%">
<Treemap
data={treeData as any}
dataKey="size"
nameKey="name"
stroke="#0b0c0d"
aspectRatio={4 / 3}
isAnimationActive={false}
/>
</ResponsiveContainer>
</div>

<div className="pointer-events-none">
{/* Tooltip must be inside chart context; Recharts still supports it as a sibling */}
</div>

{/* Put Tooltip in its own ResponsiveContainer context */}
<div className="hidden">
<ResponsiveContainer width="100%" height={0}>
<Treemap data={treeData as any} dataKey="size" nameKey="name">
<Tooltip content={<HeatTooltip />} />
</Treemap>
</ResponsiveContainer>
</div>
</div>

{/* COINS LIST (YOU ASKED TO SEE THEM HERE) */}
<div className="mt-3 rounded-2xl border border-white/10 bg-[#0f1113] p-3">
<div className="flex items-center justify-between">
<div className="text-sm font-semibold text-white">Moedas do cachecko_lite.json</div>
<div className="text-xs text-white/60">mostrando até 200</div>
</div>

<div className="mt-2 max-h-[420px] overflow-auto rounded-xl border border-white/10">
<table className="w-full border-collapse text-left text-xs">
<thead className="sticky top-0 bg-[#0f1113]">
<tr className="text-white/70">
<th className="px-3 py-2">Símbolo</th>
<th className="px-3 py-2">Nome</th>
<th className="px-3 py-2">Preço</th>
<th className="px-3 py-2">MCap</th>
<th className="px-3 py-2">Vol 24h</th>
<th className="px-3 py-2">24h%</th>
<th className="px-3 py-2">Categoria</th>
</tr>
</thead>
<tbody>
{filteredCoins.slice(0, 200).map((c, idx) => (
<tr key={`${c.id || c.symbol || 'coin'}-${idx}`} className="border-t border-white/5 text-white/90">
<td className="px-3 py-2 font-semibold">{c.symbol || '-'}</td>
<td className="px-3 py-2">{c.name || c.id || '-'}</td>
<td className="px-3 py-2">{c.price !== undefined ? `$${c.price}` : '-'}</td>
<td className="px-3 py-2">{c.mcap !== undefined ? `$${formatCompactUSD(c.mcap)}` : '-'}</td>
<td className="px-3 py-2">{c.vol !== undefined ? `$${formatCompactUSD(c.vol)}` : '-'}</td>
<td className="px-3 py-2">{c.change !== undefined ? `${c.change.toFixed(2)}%` : '-'}</td>
<td className="px-3 py-2">{c.category || '-'}</td>
</tr>
))}
{filteredCoins.length === 0 ? (
<tr>
<td colSpan={7} className="px-3 py-6 text-center text-white/50">
Nenhuma moeda carregada (ou filtro vazio).
</td>
</tr>
) : null}
</tbody>
</table>
</div>
</div>

{/* DEBUG PANEL */}
{showDebug ? (
<div className="mt-3 rounded-2xl border border-white/10 bg-[#0f1113] p-3">
<div className="text-sm font-semibold text-white">Debug</div>
<div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
<div className="rounded-xl border border-white/10 bg-[#121416] p-3">
<div className="text-xs text-white/70">Estado</div>
<div className="mt-1 text-xs text-white/90">
<div>loading: {String(loading)}</div>
<div>metric: {metric}</div>
<div>coins: {coins.length}</div>
<div>filtered: {filteredCoins.length}</div>
</div>
</div>

<div className="rounded-xl border border-white/10 bg-[#121416] p-3">
<div className="text-xs text-white/70">JSON preview (primeiros 8KB)</div>
<pre className="mt-2 max-h-[220px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-[#0b0c0d] p-2 text-[10px] text-white/80">
{rawPreview || '(vazio)'}
</pre>
</div>
</div>
</div>
) : null}
</div>
</div>
);
}
