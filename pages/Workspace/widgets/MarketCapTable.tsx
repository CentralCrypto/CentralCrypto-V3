import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
ChevronLeft,
ChevronRight,
ChevronsUpDown,
ExternalLink,
GripVertical,
Loader2,
Search,
Star,
TrendingDown,
TrendingUp,
RefreshCw,
RotateCcw,
ChevronDown
} from 'lucide-react';
import {
DndContext,
closestCenter,
PointerSensor,
useSensor,
useSensors
} from '@dnd-kit/core';
import {
SortableContext,
arrayMove,
horizontalListSortingStrategy,
useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';

import { ApiCoin, Language } from '../../../types';
import { fetchTopCoins } from '../services/api';
import { getTranslations } from '../../../locales';

// ======================
// CORES PADRONIZADAS (FIXAS)
// ======================
const GREEN = '#548F3F';
const RED = '#ff6961';

const FLASH_GREEN_BG = 'rgba(38, 71, 56, 0.22)';
const FLASH_RED_BG = 'rgba(75, 44, 50, 0.22)';

const formatUSD = (val: number, compact = false) => {
if (val === undefined || val === null) return '---';
if (!isFinite(val)) return '---';

if (compact) {
const abs = Math.abs(val);
if (abs >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
if (abs >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
if (abs >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
if (abs >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
}
return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatCompactNumber = (val: number) => {
if (val === undefined || val === null) return '---';
if (!isFinite(val)) return '---';
const abs = Math.abs(val);

if (abs >= 1e9) return `${(val / 1e9).toFixed(2)}Bi`;
if (abs >= 1e6) return `${(val / 1e6).toFixed(2)}Mi`;
if (abs >= 1e3) return `${(val / 1e3).toFixed(2)}K`;
return `${Number(val).toFixed(2)}`;
};

const safePct = (v: number) => {
if (!isFinite(v)) return '--';
const s = v >= 0 ? '+' : '';
return `${s}${v.toFixed(2)}%`;
};

// sparkline 7d (168 pts) => estimativas
const pctFromSpark = (prices?: number[], pointsBack: number = 1) => {
const arr = Array.isArray(prices) ? prices.filter(n => typeof n === 'number' && isFinite(n)) : [];
if (arr.length < 2) return NaN;
const last = arr[arr.length - 1];
const idx = Math.max(0, arr.length - 1 - Math.max(1, pointsBack));
const prev = arr[idx];
if (!isFinite(prev) || prev === 0) return NaN;
return ((last - prev) / prev) * 100;
};

const pct7dFromSpark = (prices?: number[]) => {
const arr = Array.isArray(prices) ? prices.filter(n => typeof n === 'number' && isFinite(n)) : [];
if (arr.length < 2) return NaN;
const first = arr[0];
const last = arr[arr.length - 1];
if (!isFinite(first) || first === 0) return NaN;
return ((last - first) / first) * 100;
};

type BinanceMiniTicker = {
e?: string;
E?: number;
s: string;
c: string;
o?: string;
h?: string;
l?: string;
v?: string;
q?: string;
};

const normalizeBinanceSymbol = (coin: ApiCoin) => {
const sym = String(coin?.symbol || '').trim().toUpperCase();
if (!sym) return null;
return `${sym}USDT`;
};

type MarketCapTableProps = {
language: Language;
scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
};

const MarketCapTable = ({ language, scrollContainerRef }: MarketCapTableProps) => {
const t = getTranslations(language).workspace.marketCapTable;

const [coins, setCoins] = useState<ApiCoin[]>([]);
const [loading, setLoading] = useState(true);

// view swap: coins <-> categories
const [viewMode, setViewMode] = useState<'coins' | 'categories'>('coins');

// search/sort/pagination
const [searchTerm, setSearchTerm] = useState('');
const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
key: 'market_cap_rank',
direction: 'asc',
});

const [pageSize, setPageSize] = useState<number>(100);
const [page, setPage] = useState(0);

// buy dropdown
const [buyOpen, setBuyOpen] = useState(false);
const buyRef = useRef<HTMLDivElement | null>(null);

// favorites
const [favorites, setFavorites] = useState<Record<string, boolean>>({});
const [favOnly, setFavOnly] = useState(false);

// Category context (MASTER -> SUB -> categoryIds)
const [activeMasterId, setActiveMasterId] = useState<string | null>(null);
const [activeSubId, setActiveSubId] = useState<string>('__all__');

// Fallback single category
const [activeCategoryId, setActiveCategoryId] = useState<string>('__all__');

// categories datasets
const [catLoading, setCatLoading] = useState(false);
const [catWarn, setCatWarn] = useState<string>('');
const [catWarnDismissed, setCatWarnDismissed] = useState(false);

const [taxonomy, setTaxonomy] = useState<any>(null);
const [catList, setCatList] = useState<any[]>([]);
const [catMarket, setCatMarket] = useState<any[]>([]);
const [catCoinMap, setCatCoinMap] = useState<Record<string, string[]> | null>(null);

// top buttons
const [topMode, setTopMode] = useState<'none' | 'gainers' | 'losers'>('none');

// Column reorder - coins
const DEFAULT_COLS: string[] = [
'rank',
'asset',
'price',
'ch1h',
'ch24h',
'ch7d',
'mcap',
'vol24h',
'supply',
'spark7d',
];
const [colOrder, setColOrder] = useState<string[]>(DEFAULT_COLS);

// Column reorder - categories
const CAT_DEFAULT_COLS: string[] = [
'category',
'gainers',
'losers',
'ch1h',
'ch24h',
'ch7d',
'mcap',
'vol24h',
'coins',
'spark7d',
];
const [catColOrder, setCatColOrder] = useState<string[]>(CAT_DEFAULT_COLS);

// category sort config
const [catSortConfig, setCatSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
key: 'marketCap',
direction: 'desc',
});

const sensors = useSensors(
useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
);

// ✅ Binance MiniTicker live (price + 24h% via (c-o)/o)
const [binanceLive, setBinanceLive] = useState<Record<string, { price: number; ch24: number }>>({});
const wsRef = useRef<WebSocket | null>(null);
const watchSymbolsRef = useRef<Set<string>>(new Set());
const flushTimerRef = useRef<number | null>(null);
const pendingRef = useRef<Record<string, { price: number; ch24: number }>>({});
const reconnectTimerRef = useRef<number | null>(null);
const reconnectAttemptRef = useRef<number>(0);

// ✅ Price flash (pisca vermelho/verde quando muda)
const [priceFlash, setPriceFlash] = useState<Record<string, 'up' | 'down' | null>>({});
const prevPriceRef = useRef<Record<string, number>>({});
const flashTimersRef = useRef<Record<string, number>>({});

// ✅ Reset icon spin (1x por clique)
const [resetRot, setResetRot] = useState(0);

const flushPending = useCallback(() => {
const payload = pendingRef.current;
pendingRef.current = {};
if (Object.keys(payload).length === 0) return;

setBinanceLive(prev => {
const next = { ...prev };
for (const [s, v] of Object.entries(payload)) next[s] = v;
return next;
});
}, []);

const scheduleFlush = useCallback(() => {
if (flushTimerRef.current) return;
flushTimerRef.current = window.setTimeout(() => {
flushTimerRef.current = null;
flushPending();
}, 250);
}, [flushPending]);

const clearTimers = useCallback(() => {
if (flushTimerRef.current) {
window.clearTimeout(flushTimerRef.current);
flushTimerRef.current = null;
}
if (reconnectTimerRef.current) {
window.clearTimeout(reconnectTimerRef.current);
reconnectTimerRef.current = null;
}
}, []);

// ✅ Scroll-to-top helper (corrige abrir “lá embaixo”)
const scrollToTop = useCallback(() => {
const el = scrollContainerRef?.current;
if (el) el.scrollTo({ top: 0, behavior: 'auto' });
else window.scrollTo({ top: 0, behavior: 'auto' });
}, [scrollContainerRef]);

const fetchJsonSafe = async (url: string) => {
const r = await fetch(url, { cache: 'no-store' });
if (!r.ok) throw new Error(`${url} -> ${r.status}`);
return r.json();
};

const loadCoins = useCallback(async () => {
setLoading(true);
try {
const data = await fetchTopCoins();
if (data && Array.isArray(data)) setCoins(data);
} catch (e) {
console.error('MarketCap load error', e);
} finally {
setLoading(false);
}
}, []);

// ✅ Fix do loop infinito (pisca/pisca + spinner)
const catInFlightRef = useRef(false);
const loadCategoriesLocal = useCallback(async () => {
if (catInFlightRef.current) return;
catInFlightRef.current = true;

setCatLoading(true);
setCatWarn('');

try {
const base = '/cachecko/categories';

const [taxonomyJson, listJson, marketJson] = await Promise.all([
fetchJsonSafe(`${base}/taxonomy-master.json`).catch(() => null),
fetchJsonSafe(`${base}/coingecko_categories_list.json`).catch(() => []),
fetchJsonSafe(`${base}/coingecko_categories_market.json`).catch(() => []),
]);

setTaxonomy(taxonomyJson);
setCatList(Array.isArray(listJson) ? listJson : []);
setCatMarket(Array.isArray(marketJson) ? marketJson : []);

const mapJson = await fetchJsonSafe(`${base}/category_coins_map.json`).catch(() => null);

if (mapJson && typeof mapJson === 'object') {
const categories = (mapJson as any).categories && typeof (mapJson as any).categories === 'object'
? (mapJson as any).categories
: mapJson;

if (categories && typeof categories === 'object') {
setCatCoinMap(categories as Record<string, string[]>);
} else {
setCatCoinMap(null);
}
} else {
setCatCoinMap(null);
if (!catWarnDismissed) {
setCatWarn('Dados de categoria sem mapping local (category_coins_map.json ausente). Gainers/Losers e filtro por moedas dependem desse mapping.');
}
}
} catch (e: any) {
console.error('Categories load error', e);
setCatWarn('Falha ao carregar categorias locais em /cachecko/categories/.');
} finally {
setCatLoading(false);
catInFlightRef.current = false;
}
}, [catWarnDismissed]);

useEffect(() => { loadCoins(); }, [loadCoins]);

useEffect(() => {
const onDocClick = (e: MouseEvent) => {
const t = e.target as Node;
if (buyRef.current && !buyRef.current.contains(t)) setBuyOpen(false);
};
document.addEventListener('mousedown', onDocClick);
return () => document.removeEventListener('mousedown', onDocClick);
}, []);

// ✅ Carrega categorias apenas quando entra no modo categories
useEffect(() => {
if (viewMode === 'categories') loadCategoriesLocal();
}, [viewMode, loadCategoriesLocal]);

// ✅ Sempre que trocar “view” ou “nível”, sobe pro topo
useEffect(() => {
scrollToTop();
}, [viewMode, activeMasterId, activeSubId, activeCategoryId, scrollToTop]);

const refresh = useCallback(() => {
if (viewMode === 'categories') loadCategoriesLocal();
else loadCoins();
}, [viewMode, loadCategoriesLocal, loadCoins]);

const handleSort = (key: string) => {
let direction: 'asc' | 'desc' = 'desc';
if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
setSortConfig({ key, direction });
setTopMode('none');
setPage(0);
scrollToTop();
};

const handleCatSort = (key: string) => {
let direction: 'asc' | 'desc' = 'desc';
if (catSortConfig.key === key && catSortConfig.direction === 'desc') direction = 'asc';
setCatSortConfig({ key, direction });
scrollToTop();
};

// ---------- Taxonomy parsing (masters + subs) ----------
const parsedTaxonomy = useMemo(() => {
const raw = taxonomy;
let masters: any[] = [];

if (Array.isArray(raw)) masters = raw;
else if (raw && Array.isArray((raw as any).masters)) masters = (raw as any).masters;
else if (raw && Array.isArray((raw as any).items)) masters = (raw as any).items;

return masters
.filter(Boolean)
.map((m: any) => ({
id: String(m.id ?? m.key ?? m.name ?? '').trim(),
name: String(m.name ?? m.title ?? m.id ?? '').trim(),
categoryIds: Array.isArray(m.categoryIds) ? m.categoryIds.map(String) : Array.isArray(m.categories) ? m.categories.map(String) : [],
children: Array.isArray(m.children) ? m.children : Array.isArray(m.groups) ? m.groups : [],
}))
.filter((m: any) => m.id);
}, [taxonomy]);

const masterById = useMemo(() => {
const map = new Map<string, any>();
for (const m of parsedTaxonomy) map.set(m.id, m);
return map;
}, [parsedTaxonomy]);

const selectedMaster = useMemo(() => {
if (!activeMasterId) return null;
return masterById.get(activeMasterId) || null;
}, [activeMasterId, masterById]);

const subOptions = useMemo(() => {
if (!selectedMaster || !Array.isArray(selectedMaster.children) || selectedMaster.children.length === 0) return [];
const subs = selectedMaster.children
.filter(Boolean)
.map((c: any) => ({
id: String(c.id ?? c.key ?? c.name ?? '').trim(),
name: String(c.name ?? c.title ?? c.id ?? '').trim(),
categoryIds: Array.isArray(c.categoryIds) ? c.categoryIds.map(String) : Array.isArray(c.categories) ? c.categories.map(String) : [],
}))
.filter((x: any) => x.id);

return [{ id: '__all__', name: 'Todas', categoryIds: [] as string[] }, ...subs];
}, [selectedMaster]);

// category name resolver
const categoryNameById = useMemo(() => {
const map = new Map<string, string>();
for (const c of catList) {
const id = String((c as any).category_id ?? (c as any).id ?? '').trim();
const nm = String((c as any).name ?? '').trim();
if (id && nm) map.set(id, nm);
}
for (const c of catMarket) {
const id = String((c as any).category_id ?? (c as any).id ?? (c as any).categoryId ?? '').trim();
const nm = String((c as any).name ?? '').trim();
if (id && nm) map.set(id, nm);
}
return map;
}, [catList, catMarket]);

// ✅ Nome “humano” da categoria atual pro cabeçalho
const activeCategoryLabel = useMemo(() => {
if (viewMode !== 'coins') return '';
if (activeMasterId && selectedMaster) {
const masterName = String(selectedMaster.name || '').trim();
if (activeSubId && activeSubId !== '__all__') {
const sub = subOptions.find(s => s.id === activeSubId);
const subName = String(sub?.name || '').trim();
return subName ? `${masterName} / ${subName}` : masterName;
}
return masterName;
}
if (activeCategoryId && activeCategoryId !== '__all__') {
return categoryNameById.get(activeCategoryId) || activeCategoryId;
}
return '';
}, [viewMode, activeMasterId, selectedMaster, activeSubId, subOptions, activeCategoryId, categoryNameById]);

// ---------- Coin map -> sets ----------
const coinById = useMemo(() => {
const m = new Map<string, ApiCoin>();
for (const c of coins) {
if (c?.id) m.set(String(c.id), c);
}
return m;
}, [coins]);

const categoryCoinIds = useMemo(() => {
const map = new Map<string, Set<string>>();
if (!catCoinMap) return map;

for (const [catId, arr] of Object.entries(catCoinMap)) {
if (!catId || !Array.isArray(arr)) continue;
map.set(String(catId), new Set(arr.map(x => String(x))));
}
return map;
}, [catCoinMap]);

const getCoinPct24h = (c: ApiCoin) => {
const v = (c as any).price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h;
return isFinite(v) ? Number(v) : 0;
};

const getCoinPct1h = (c: ApiCoin) => {
const v = (c as any).price_change_percentage_1h_in_currency;
if (isFinite(v)) return Number(v);
return pctFromSpark(c.sparkline_in_7d?.price, 1);
};

const getCoinPct7d = (c: ApiCoin) => {
const v = (c as any).price_change_percentage_7d_in_currency;
if (isFinite(v)) return Number(v);
return pct7dFromSpark(c.sparkline_in_7d?.price);
};

const buildCategorySpark = (members: ApiCoin[]) => {
const valid = members.filter(c => Array.isArray(c.sparkline_in_7d?.price) && c.sparkline_in_7d!.price!.length > 10);
if (valid.length < 2) return null;

const N = Math.min(...valid.map(c => c.sparkline_in_7d!.price!.length));
if (!isFinite(N) || N < 10) return null;

const weights = valid.map(c => Math.max(0, Number(c.market_cap || 0)));
const wSum = weights.reduce((a, b) => a + b, 0) || 0;
const useWeighted = wSum > 0;

const series: { i: number; v: number }[] = [];
for (let i = 0; i < N; i++) {
let acc = 0;
let accW = 0;

for (let k = 0; k < valid.length; k++) {
const arr = valid[k].sparkline_in_7d!.price!;
const first = arr[0];
const cur = arr[i];
if (!isFinite(first) || first === 0 || !isFinite(cur)) continue;

const pct = ((cur - first) / first) * 100;
const w = useWeighted ? weights[k] : 1;
if (w <= 0) continue;

acc += pct * w;
accW += w;
}

if (accW <= 0) return null;
series.push({ i, v: acc / accW });
}
return series;
};

const membersFromCategoryIds = useCallback((catIds: string[]) => {
const seen = new Set<string>();
const members: ApiCoin[] = [];

for (const cid of catIds) {
const setIds = categoryCoinIds.get(cid);
if (!setIds) continue;

for (const id of setIds) {
if (seen.has(id)) continue;
seen.add(id);

const c = coinById.get(id);
if (c) members.push(c);
}
}
return members;
}, [categoryCoinIds, coinById]);

const computeStatsFromCatIds = useCallback((catIds: string[], displayName: string) => {
const members = membersFromCategoryIds(catIds);

const coinsCount = members.length;
const marketCap = members.reduce((s, c) => s + (Number(c.market_cap || 0) || 0), 0);
const volume24h = members.reduce((s, c) => s + (Number(c.total_volume || 0) || 0), 0);

const wSum = members.reduce((s, c) => s + (Number(c.market_cap || 0) || 0), 0);
const wAvg = (getter: (c: ApiCoin) => number) => {
if (wSum > 0) {
let acc = 0;
for (const c of members) {
const w = Number(c.market_cap || 0) || 0;
const v = getter(c);
if (!isFinite(v)) continue;
acc += w * v;
}
return acc / wSum;
}
const vals = members.map(getter).filter(v => isFinite(v));
if (vals.length === 0) return NaN;
return vals.reduce((a, b) => a + b, 0) / vals.length;
};

const ch1h = wAvg(getCoinPct1h);
const ch24h = wAvg(getCoinPct24h);
const ch7d = wAvg(getCoinPct7d);

const by24h = [...members].sort((a, b) => (getCoinPct24h(b) - getCoinPct24h(a)));
const gainers = by24h.slice(0, 3);
const losers = by24h.slice(-3).reverse();

const spark = buildCategorySpark(members);

return {
name: displayName,
coinsCount,
marketCap,
volume24h,
ch1h,
ch24h,
ch7d,
gainers,
losers,
spark,
members
};
}, [membersFromCategoryIds]);

// --------- category rows (MASTERS ONLY) ----------
const masterRows = useMemo(() => {
const q = (searchTerm || '').toLowerCase().trim();

const rows = parsedTaxonomy
.filter(m => {
if (!q) return true;
return String(m.name || '').toLowerCase().includes(q) || String(m.id || '').toLowerCase().includes(q);
})
.map((m) => {
const masterCatIds: string[] = [];

for (const id of (Array.isArray(m.categoryIds) ? m.categoryIds : [])) masterCatIds.push(String(id));

const kids = Array.isArray(m.children) ? m.children : [];
for (const k of kids) {
const arr = Array.isArray((k as any).categoryIds) ? (k as any).categoryIds : Array.isArray((k as any).categories) ? (k as any).categories : [];
for (const id of arr) masterCatIds.push(String(id));
}

const uniqueCatIds = Array.from(new Set(masterCatIds)).filter(Boolean);
const stats = computeStatsFromCatIds(uniqueCatIds, m.name || m.id);

return {
id: m.id,
displayName: m.name || m.id,
catIds: uniqueCatIds,
...stats
};
})
.filter(r => Number(r.coinsCount || 0) > 0);

const dir = catSortConfig.direction === 'asc' ? 1 : -1;
rows.sort((a: any, b: any) => {
const av = a[catSortConfig.key];
const bv = b[catSortConfig.key];

if (typeof av === 'string' || typeof bv === 'string') {
const r = String(av ?? '').localeCompare(String(bv ?? ''));
return r * dir;
}

const an = isFinite(av) ? Number(av) : 0;
const bn = isFinite(bv) ? Number(bv) : 0;
if (an < bn) return -1 * dir;
if (an > bn) return 1 * dir;
return 0;
});

return rows;
}, [parsedTaxonomy, searchTerm, computeStatsFromCatIds, catSortConfig]);

// --------- COINS table filtering ----------
const activeFilter = useMemo(() => {
if (activeMasterId && selectedMaster) {
if (activeSubId && activeSubId !== '__all__') {
const sub = (subOptions || []).find(s => s.id === activeSubId);
const catIds = sub?.categoryIds && sub.categoryIds.length > 0 ? sub.categoryIds : [];
return { mode: 'master-sub', catIds };
}

const catIds: string[] = [];
for (const id of (Array.isArray(selectedMaster.categoryIds) ? selectedMaster.categoryIds : [])) catIds.push(String(id));

const kids = Array.isArray(selectedMaster.children) ? selectedMaster.children : [];
for (const k of kids) {
const arr = Array.isArray((k as any).categoryIds) ? (k as any).categoryIds : Array.isArray((k as any).categories) ? (k as any).categories : [];
for (const id of arr) catIds.push(String(id));
}

const unique = Array.from(new Set(catIds)).filter(Boolean);
return { mode: 'master-all', catIds: unique };
}

if (activeCategoryId !== '__all__') {
return { mode: 'single', catIds: [activeCategoryId] };
}

return { mode: 'none', catIds: [] as string[] };
}, [activeMasterId, selectedMaster, activeSubId, subOptions, activeCategoryId]);

const allowedCoinIdsSet = useMemo(() => {
if (!activeFilter.catIds || activeFilter.catIds.length === 0) return null;

const union = new Set<string>();
for (const cid of activeFilter.catIds) {
const setIds = categoryCoinIds.get(cid);
if (!setIds) continue;
for (const id of setIds) union.add(id);
}
return union;
}, [activeFilter, categoryCoinIds]);

const filteredSortedCoins = useMemo(() => {
let items = [...coins];

if (searchTerm) {
const q = searchTerm.toLowerCase();
items = items.filter(c => c.name?.toLowerCase().includes(q) || c.symbol?.toLowerCase().includes(q));
}

if (favOnly) {
items = items.filter(c => !!favorites[c.id]);
// ✅ UNIVERSAL FAVORITES: quando favOnly=true, NÃO aplica filtro de categoria
} else {
if (allowedCoinIdsSet) {
items = items.filter(c => allowedCoinIdsSet.has(String(c.id)));
}
}

const getVal = (c: ApiCoin, key: string) => {
const prices = c.sparkline_in_7d?.price;
if (key === 'change_1h_est') return pctFromSpark(prices, 1);
if (key === 'change_7d_est') return pct7dFromSpark(prices);
// @ts-ignore
return c[key];
};

items.sort((a: any, b: any) => {
const aVal = getVal(a, sortConfig.key);
const bVal = getVal(b, sortConfig.key);

if (typeof aVal === 'string' || typeof bVal === 'string') {
const as = String(aVal ?? '');
const bs = String(bVal ?? '');
const r = as.localeCompare(bs);
return sortConfig.direction === 'asc' ? r : -r;
}

const an = isFinite(aVal) ? Number(aVal) : 0;
const bn = isFinite(bVal) ? Number(bVal) : 0;

if (an < bn) return sortConfig.direction === 'asc' ? -1 : 1;
if (an > bn) return sortConfig.direction === 'asc' ? 1 : -1;
return 0;
});

return items;
}, [coins, searchTerm, favOnly, favorites, allowedCoinIdsSet, sortConfig]);

const totalCount = filteredSortedCoins.length;
const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
const safePage = Math.min(page, totalPages - 1);

const pageCoins = useMemo(() => {
const start = safePage * pageSize;
return filteredSortedCoins.slice(start, start + pageSize);
}, [filteredSortedCoins, safePage, pageSize]);

useEffect(() => { setPage(0); }, [
searchTerm,
favOnly,
pageSize,
activeMasterId,
activeSubId,
activeCategoryId,
viewMode
]);

// ✅ atualiza watch-list pro WS (o que está na página atual, inclusive quando filtrou por categoria)
useEffect(() => {
if (viewMode !== 'coins') {
watchSymbolsRef.current = new Set();
return;
}
const set = new Set<string>();
for (const c of pageCoins) {
const s = normalizeBinanceSymbol(c);
if (s) set.add(s);
}
watchSymbolsRef.current = set;
}, [pageCoins, viewMode]);

const closeWs = useCallback(() => {
if (wsRef.current) {
try { wsRef.current.close(); } catch {}
wsRef.current = null;
}
}, []);

const connectWs = useCallback(() => {
closeWs();
clearTimers();

const ws = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr');
wsRef.current = ws;

ws.onopen = () => {
reconnectAttemptRef.current = 0;
};

ws.onmessage = (ev) => {
try {
const data = JSON.parse(ev.data);
const arr: BinanceMiniTicker[] = Array.isArray(data) ? data : [data];
const watch = watchSymbolsRef.current;

for (const tick of arr) {
if (!tick?.s || !watch.has(tick.s)) continue;

const price = Number(tick.c);
const open = Number(tick.o);
const ch24 = (isFinite(open) && open > 0 && isFinite(price)) ? ((price - open) / open) * 100 : NaN;

if (!isFinite(price) || !isFinite(ch24)) continue;

pendingRef.current[tick.s] = { price, ch24 };
}

scheduleFlush();
} catch {}
};

ws.onerror = () => {};

ws.onclose = () => {
wsRef.current = null;

if (viewMode !== 'coins') return;

const attempt = Math.min(6, reconnectAttemptRef.current + 1);
reconnectAttemptRef.current = attempt;

const delay = Math.min(10000, 1200 * attempt);
reconnectTimerRef.current = window.setTimeout(() => {
reconnectTimerRef.current = null;
if (viewMode === 'coins') connectWs();
}, delay);
};
}, [closeWs, clearTimers, scheduleFlush, viewMode]);

// ✅ liga/desliga WS Binance (price + 24h% via (c-o)/o)
useEffect(() => {
if (viewMode !== 'coins') {
clearTimers();
closeWs();
return;
}

if (!wsRef.current) connectWs();

return () => {
clearTimers();
closeWs();
};
}, [viewMode, connectWs, closeWs, clearTimers]);

// ✅ aplica flash quando o live price muda (piscada curta)
useEffect(() => {
if (viewMode !== 'coins') return;

const watch = watchSymbolsRef.current;
if (!watch || watch.size === 0) return;

for (const sym of Array.from(watch)) {
const live = binanceLive[sym];
if (!live || !isFinite(live.price)) continue;

const prev = prevPriceRef.current[sym];
const now = live.price;

if (isFinite(prev) && prev !== now) {
const dir: 'up' | 'down' = now > prev ? 'up' : 'down';

setPriceFlash(p => ({ ...p, [sym]: dir }));

if (flashTimersRef.current[sym]) window.clearTimeout(flashTimersRef.current[sym]);
flashTimersRef.current[sym] = window.setTimeout(() => {
setPriceFlash(p => {
const next = { ...p };
next[sym] = null;
return next;
});
}, 520);
}

prevPriceRef.current[sym] = now;
}
}, [binanceLive, viewMode]);

// ✅ cleanup dos timers de flash
useEffect(() => {
return () => {
for (const k of Object.keys(flashTimersRef.current)) {
window.clearTimeout(flashTimersRef.current[k]);
}
flashTimersRef.current = {};
};
}, []);

const Paginator = ({ compact = false }: { compact?: boolean }) => {
const start = safePage * pageSize + 1;
const end = Math.min(totalCount, (safePage + 1) * pageSize);

return (
<div className={`flex items-center gap-2 ${compact ? '' : 'justify-between w-full'}`}>
{!compact && (
<div className="text-xs font-bold text-gray-500 dark:text-slate-400">
{totalCount === 0 ? t.noResults : `${t.showing} ${start}-${end} ${t.of} ${totalCount}`}
</div>
)}

<div className="flex items-center gap-2">
<button
onClick={() => { setPage(p => Math.max(0, p - 1)); scrollToTop(); }}
disabled={safePage === 0}
className={`px-2.5 py-2 rounded-lg border text-sm font-black transition-colors
${safePage === 0
? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-700 text-gray-400'
: 'border-slate-200 dark:border-slate-700 text-gray-600 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700'
}`}
title={t.prev}
>
<ChevronLeft size={18} />
</button>

<div className="text-xs font-black text-gray-600 dark:text-slate-300 px-2">
{safePage + 1} / {totalPages}
</div>

<button
onClick={() => { setPage(p => Math.min(totalPages - 1, p + 1)); scrollToTop(); }}
disabled={safePage >= totalPages - 1}
className={`px-2.5 py-2 rounded-lg border text-sm font-black transition-colors
${safePage >= totalPages - 1
? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-700 text-gray-400'
: 'border-slate-200 dark:border-slate-700 text-gray-600 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700'
}`}
title={t.next}
>
<ChevronRight size={18} />
</button>
</div>
</div>
);
};

// ✅ Larguras por % (coins)
const COIN_COL_WIDTH: Record<string, string> = {
fav: '3%',
rank: '4%',
asset: '18%',
price: '10%',
ch1h: '6%',
ch24h: '6%',
ch7d: '6%',
mcap: '10%',
vol24h: '9%',
supply: '7%',
spark7d: '21%',
};

const COLS: Record<string, { id: string; label: React.ReactNode; sortKey?: string; }> = {
rank: { id: 'rank', label: t.rank, sortKey: 'market_cap_rank' },
asset: { id: 'asset', label: t.asset, sortKey: 'name' },
price: { id: 'price', label: t.price, sortKey: 'current_price' },
ch1h: { id: 'ch1h', label: '1h %', sortKey: 'change_1h_est' },
ch24h: { id: 'ch24h', label: '24h %', sortKey: 'price_change_percentage_24h' },
ch7d: { id: 'ch7d', label: '7d %', sortKey: 'change_7d_est' },
mcap: { id: 'mcap', label: (<span className="leading-[1.05]">Market<br />Cap</span>), sortKey: 'market_cap' },
vol24h: { id: 'vol24h', label: (<span className="leading-[1.05]">{t.vol}<br />(24h)</span>), sortKey: 'total_volume' },
supply: { id: 'supply', label: (<span className="leading-[1.05]">{t.supply}<br /></span>), sortKey: 'circulating_supply' },
spark7d: { id: 'spark7d', label: t.chart, sortKey: undefined },
};

// ✅ widths reais por coluna (categories) pra spark não ficar anão
const CAT_COL_WIDTH: Record<string, string> = {
category: '28%',
gainers: '10%',
losers: '10%',
ch1h: '6%',
ch24h: '6%',
ch7d: '6%',
mcap: '10%',
vol24h: '10%',
coins: '6%',
spark7d: '18%', // vai ficar maior e “preencher”
};

const CAT_COLS: Record<string, { id: string; label: string; sortKey?: string; }> = {
category: { id: 'category', label: t.categories, sortKey: 'displayName' },
gainers: { id: 'gainers', label: t.gainers, sortKey: undefined },
losers: { id: 'losers', label: t.losers, sortKey: undefined },
ch1h: { id: 'ch1h', label: '1h', sortKey: 'ch1h' },
ch24h: { id: 'ch24h', label: '24h', sortKey: 'ch24h' },
ch7d: { id: 'ch7d', label: '7d', sortKey: 'ch7d' },
mcap: { id: 'mcap', label: 'Market Cap', sortKey: 'marketCap' },
vol24h: { id: 'vol24h', label: '24h Volume', sortKey: 'volume24h' },
coins: { id: 'coins', label: '# Coins', sortKey: 'coinsCount' },
spark7d: { id: 'spark7d', label: t.chart, sortKey: undefined },
};

const SortIcon = ({ active }: { active: boolean }) => (
<ChevronsUpDown size={12} className={`text-gray-400 group-hover:text-[#dd9933] ${active ? 'text-[#dd9933]' : ''}`} />
);

const SortableThGeneric = ({
colId,
label,
sortKey,
activeKey,
onSort,
className,
}: {
colId: string;
label: React.ReactNode;
sortKey?: string;
activeKey: string;
onSort: (k: string) => void;
className?: string;
}) => {
const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: colId });
const style: React.CSSProperties = {
transform: CSS.Transform.toString(transform),
transition,
opacity: isDragging ? 0.6 : 1,
};

return (
<th
ref={setNodeRef}
style={style}
className={`p-2 select-none group border-b border-gray-100 dark:border-slate-800
hover:bg-gray-100 dark:hover:bg-white/5 transition-colors ${className || ''}`}
>
<div className="grid grid-cols-[18px_1fr_14px] items-center gap-0">
<span
className={`inline-flex items-center justify-center w-5 h-5 rounded text-gray-400
hover:bg-gray-200 dark:hover:bg-white/10 transition-opacity
${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
onClick={(e) => e.stopPropagation()}
{...attributes}
{...listeners}
title="Arraste para reordenar"
>
<GripVertical size={14} />
</span>

<button
type="button"
className="min-w-0 inline-flex items-center justify-center font-black uppercase tracking-widest text-[11px] text-gray-400 dark:text-slate-400 w-full px-1"
onClick={() => sortKey && onSort(sortKey)}
disabled={!sortKey}
>
<span className="whitespace-normal leading-[1.05] text-center">
{label}
</span>
</button>

<span className="inline-flex items-center justify-center">
{sortKey ? <SortIcon active={activeKey === sortKey} /> : null}
</span>
</div>
</th>
);
};

// ✅ FIX drag coins
const onDragEnd = (event: any) => {
const { active, over } = event;
if (!over) return;
if (active.id === over.id) return;

const oldIndex = colOrder.indexOf(active.id);
const newIndex = colOrder.indexOf(over.id);
if (oldIndex === -1 || newIndex === -1) return;

setColOrder(prev => arrayMove(prev, oldIndex, newIndex));
};

const onCatDragEnd = (event: any) => {
const { active, over } = event;
if (!over) return;
if (active.id === over.id) return;

const oldIndex = catColOrder.indexOf(active.id);
const newIndex = catColOrder.indexOf(over.id);
if (oldIndex === -1 || newIndex === -1) return;

setCatColOrder(prev => arrayMove(prev, oldIndex, newIndex));
};

const CategoryRowLogos = ({ arr }: { arr: ApiCoin[] }) => {
return (
<div className="flex items-center justify-center gap-1">
{arr.slice(0, 3).map((c, i) => (
<img
key={`${c.id}_${i}`}
src={c.image}
alt=""
className="w-6 h-6 rounded-full bg-slate-100 dark:bg-[#242628] p-0.5 border border-slate-200 dark:border-white/10"
onError={(e) => { e.currentTarget.style.display = 'none'; }}
/>
))}
{arr.length === 0 && <span className="text-xs font-bold text-gray-400 dark:text-slate-500">—</span>}
</div>
);
};

const CategoriesTable = () => {
return (
<div className="custom-scrollbar overflow-x-auto overflow-y-hidden">
<div className="overflow-visible">
{catLoading && masterRows.length === 0 ? (
<div className="flex flex-col items-center justify-center py-16 text-gray-500">
<Loader2 className="animate-spin mb-2" size={32} />
<span className="font-bold text-sm uppercase tracking-widest animate-pulse">Carregando Categorias...</span>
</div>
) : (
<table className="w-full text-left border-collapse min-w-[1200px] table-fixed">
<colgroup>
{catColOrder.map((cid) => (
<col key={`cat_col_${cid}`} style={{ width: CAT_COL_WIDTH[cid] || 'auto' }} />
))}
</colgroup>

<thead className="sticky top-0 z-20 bg-white dark:bg-[#2f3032]">
<tr className="border-b border-gray-100 dark:border-slate-800">
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onCatDragEnd}>
<SortableContext items={catColOrder} strategy={horizontalListSortingStrategy}>
{catColOrder.map((cid) => {
const c = CAT_COLS[cid];
return (
<SortableThGeneric
key={c.id}
colId={c.id}
label={c.label}
sortKey={c.sortKey}
activeKey={catSortConfig.key}
onSort={handleCatSort}
/>
);
})}
</SortableContext>
</DndContext>
</tr>
</thead>

<tbody className="divide-y divide-slate-50 dark:divide-slate-800">
{masterRows.map((r: any) => {
const pos24 = isFinite(r.ch24h) ? (Number(r.ch24h) >= 0) : true;

return (
<tr
key={r.id}
className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors cursor-pointer h-[56px]"
onClick={() => {
setActiveMasterId(r.id);
setActiveSubId('__all__');
setActiveCategoryId('__all__');
setViewMode('coins');
setPage(0);
setTopMode('none');
setSortConfig({ key: 'market_cap', direction: 'desc' });
scrollToTop();

if (!catCoinMap && !catWarnDismissed) {
setCatWarn('Sem category_coins_map.json: não dá pra listar moedas por categoria. Gere o mapping.');
}
}}
title="Ver moedas desta categoria"
>
{catColOrder.map((cid) => {
if (cid === 'category') {
return (
<td key={cid} className="p-2">
<div className="flex flex-col min-w-0">
<span className="text-[14px] font-black text-gray-900 dark:text-white truncate">
{r.displayName}
</span>
</div>
</td>
);
}

if (cid === 'gainers') {
return (
<td key={cid} className="p-2 text-center">
<CategoryRowLogos arr={r.gainers || []} />
</td>
);
}

if (cid === 'losers') {
return (
<td key={cid} className="p-2 text-center">
<CategoryRowLogos arr={r.losers || []} />
</td>
);
}

if (cid === 'ch1h') {
const v = Number(r.ch1h);
return (
<td
key={cid}
className="p-2 text-center font-mono text-[13px] font-black"
style={!isFinite(v) ? { color: '#94a3b8' } : { color: v >= 0 ? GREEN : RED }}
>
{safePct(v)}
</td>
);
}

if (cid === 'ch24h') {
const v = Number(r.ch24h);
return (
<td
key={cid}
className="p-2 text-center font-mono text-[13px] font-black"
style={!isFinite(v) ? { color: '#94a3b8' } : { color: v >= 0 ? GREEN : RED }}
>
{safePct(v)}
</td>
);
}

if (cid === 'ch7d') {
const v = Number(r.ch7d);
return (
<td
key={cid}
className="p-2 text-center font-mono text-[13px] font-black"
style={!isFinite(v) ? { color: '#94a3b8' } : { color: v >= 0 ? GREEN : RED }}
>
{safePct(v)}
</td>
);
}

if (cid === 'mcap') {
return (
<td key={cid} className="p-2 text-center font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400">
{formatUSD(Number(r.marketCap || 0), true)}
</td>
);
}

if (cid === 'vol24h') {
return (
<td key={cid} className="p-2 text-center font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400">
{formatUSD(Number(r.volume24h || 0), true)}
</td>
);
}

if (cid === 'coins') {
return (
<td key={cid} className="p-2 text-center font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400">
{Number(r.coinsCount || 0).toLocaleString()}
</td>
);
}

if (cid === 'spark7d') {
return (
<td key={cid} className="p-2 overflow-hidden">
<div className="w-full h-12 overflow-hidden">
{Array.isArray(r.spark) && r.spark.length > 5 ? (
<ResponsiveContainer width="100%" height="100%">
<AreaChart data={r.spark}>
<defs>
<linearGradient id={`cg_${r.id}`} x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stopColor={pos24 ? GREEN : RED} stopOpacity={0.55} />
<stop offset="75%" stopColor={pos24 ? GREEN : RED} stopOpacity={0.18} />
<stop offset="100%" stopColor={pos24 ? GREEN : RED} stopOpacity={0.02} />
</linearGradient>
</defs>
<Area
type="monotone"
dataKey="v"
stroke={pos24 ? GREEN : RED}
strokeWidth={2}
fill={`url(#cg_${r.id})`}
fillOpacity={1}
isAnimationActive={false}
dot={false}
/>
<YAxis domain={['auto', 'auto']} hide />
</AreaChart>
</ResponsiveContainer>
) : (
<div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400 dark:text-slate-500">
—
</div>
)}
</div>
</td>
);
}

return <td key={cid} className="p-2" />;
})}
</tr>
);
})}

{masterRows.length === 0 && (
<tr>
<td colSpan={catColOrder.length} className="p-8 text-center text-sm font-bold text-gray-500 dark:text-slate-400">
Nenhuma categoria encontrada.
</td>
</tr>
)}
</tbody>
</table>
)}
</div>
</div>
);
};

const setTop = (mode: 'gainers' | 'losers') => {
setTopMode(mode);
setPage(0);
setSortConfig({
key: 'price_change_percentage_24h',
direction: mode === 'gainers' ? 'desc' : 'asc',
});
scrollToTop();
};

const goBackToCategories = () => {
setActiveMasterId(null);
setActiveSubId('__all__');
setActiveCategoryId('__all__');
setViewMode('categories');
setTopMode('none');
scrollToTop();
};

const goBackToCoins = () => {
setViewMode('coins');
setSearchTerm('');
scrollToTop();
};

const canShowBack =
viewMode === 'categories' || (viewMode === 'coins' && !!activeMasterId);

const handleBack = () => {
if (viewMode === 'categories') goBackToCoins();
else goBackToCategories();
};

const TopToggleButton = ({
active,
variant,
icon,
label,
onClick,
title
}: {
active: boolean;
variant: 'gainers' | 'losers';
icon: React.ReactNode;
label: string;
onClick: () => void;
title: string;
}) => {
const activeStyle =
variant === 'gainers'
? { backgroundColor: '#122A21', color: '#ffffff', borderColor: 'transparent' }
: { backgroundColor: '#C33B40', color: '#ffffff', borderColor: 'transparent' };

return (
<button
type="button"
onClick={onClick}
style={active ? activeStyle : undefined}
className={`px-3 py-2 rounded-lg border font-black transition-colors whitespace-nowrap flex items-center gap-2
${active
? 'shadow-md'
: 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2f3032] text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5'
}`}
title={title}
>
{icon}
{label}
</button>
);
};

// ✅ Reset “voltou o ícone” e realmente faz algo útil + giro 360° no clique.
const handleResetUI = () => {
setResetRot(r => r + 360);

setColOrder(DEFAULT_COLS);
setCatColOrder(CAT_DEFAULT_COLS);
setSortConfig({ key: 'market_cap_rank', direction: 'asc' });
setCatSortConfig({ key: 'marketCap', direction: 'desc' });
setTopMode('none');
setSearchTerm('');
setFavOnly(false);
setPage(0);
scrollToTop();
};

return (
<div className="bg-white dark:bg-[#1a1c1e] rounded-xl border border-gray-100 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col">
{/* Header */}
<div className="p-4 border-b border-gray-100 dark:border-slate-800 flex flex-col gap-3 bg-gray-50/50 dark:bg-black/20 shrink-0">
<div className="flex flex-col lg:flex-row justify-between items-center gap-3">
{/* LEFT GROUP */}
<div className="flex items-center gap-2 w-full lg:w-auto">
{/* BACK ICON BUTTON */}
{canShowBack && (
<button
type="button"
onClick={handleBack}
className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2f3032] hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
title="Voltar"
>
<ChevronLeft size={20} className="text-gray-700 dark:text-slate-200" />
</button>
)}

{/* FAVORITES ICON BUTTON */}
<button
type="button"
onClick={() => { setFavOnly(v => !v); setPage(0); scrollToTop(); }}
className={`p-2 rounded-lg border font-black transition-colors
${favOnly
? 'bg-[#dd9933] text-black border-transparent'
: 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2f3032] hover:bg-gray-100 dark:hover:bg-white/5'
}`}
title="Filtrar favoritos (universal)"
>
<Star
size={20}
color={favOnly ? '#000000' : '#dd9933'}
fill={favOnly ? '#000000' : 'transparent'}
/>
</button>

{/* SEARCH INPUT */}
<div className="relative w-full lg:w-[420px]">
<Search size={18} className="absolute left-3 top-2.5 text-gray-500" />
<input
type="text"
placeholder={viewMode === 'categories' ? t.searchCategory : t.searchPlaceholder}
value={searchTerm}
onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
className="w-full bg-white dark:bg-[#2f3032] rounded-lg py-2.5 pl-11 pr-4 text-[15px] text-gray-900 dark:text-white focus:border-[#dd9933] outline-none transition-all shadow-inner border border-slate-100 dark:border-slate-700"
/>
</div>

{/* Subcategorias */}
{viewMode === 'coins' && activeMasterId && subOptions.length > 1 && (
<select
value={activeSubId}
onChange={(e) => {
setActiveSubId(e.target.value);
setPage(0);
scrollToTop();
}}
className="appearance-none bg-white text-gray-900 dark:!bg-[#2f3032] dark:text-slate-200 dark:[color-scheme:dark]
border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-black
hover:bg-gray-100 dark:hover:bg-white/5 outline-none"
title="Subcategorias"
>
{subOptions.map((o: any) => (
<option key={o.id} value={o.id}>{o.name}</option>
))}
</select>
)}

{/* Categorias */}
{viewMode === 'coins' && !activeMasterId && (
<button
type="button"
onClick={() => { setViewMode('categories'); scrollToTop(); }}
className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2f3032] text-gray-700 dark:text-slate-200 font-black hover:bg-gray-100 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
title="Abrir categorias"
>
{t.categories}
</button>
)}

{/* Gainers/Losers só na tabela principal */}
{viewMode === 'coins' && !activeMasterId && (
<>
<TopToggleButton
active={topMode === 'gainers'}
variant="gainers"
icon={<TrendingUp size={18} />}
label={t.gainers}
onClick={() => setTop('gainers')}
title="Ordenar por Gainers (24h%)"
/>

<TopToggleButton
active={topMode === 'losers'}
variant="losers"
icon={<TrendingDown size={18} />}
label={t.losers}
onClick={() => setTop('losers')}
title="Ordenar por Losers (24h%)"
/>
</>
)}

{/* BUY dropdown */}
<div className="relative" ref={buyRef}>
<button
onClick={() => setBuyOpen(v => !v)}
className="px-3 py-2 rounded-lg bg-[#dd9933] text-black font-black hover:opacity-90 transition-opacity flex items-center gap-2 whitespace-nowrap"
title="BUY"
>
{t.buy} <ChevronDown size={16} />
</button>

{buyOpen && (
<div className="absolute left-0 mt-2 w-56 bg-white dark:bg-[#2f3032] border border-slate-100 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
<a
href="https://www.bybit.com/invite?ref=JMBYZW"
target="_blank"
rel="noreferrer"
className="px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-white/5 text-sm font-black text-gray-800 dark:text-slate-200"
>
Bybit
<ExternalLink size={16} className="text-gray-400" />
</a>
</div>
)}
</div>

{/* ✅ Header da categoria: texto solto (sem cara de botão) */}
{activeCategoryLabel ? (
<span className="ml-2 text-sm font-black text-[#dd9933] whitespace-nowrap">
{activeCategoryLabel}
</span>
) : null}
</div>

{/* RIGHT GROUP */}
<div className="flex items-center gap-2 w-full lg:w-auto justify-end">
<div className="flex items-center gap-2">
<span className="text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest">
{t.items}
</span>

<select
value={pageSize}
onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(0); scrollToTop(); }}
className="appearance-none bg-white text-gray-900 dark:!bg-[#2f3032] dark:!text-slate-200 dark:[color-scheme:dark]
border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-black
hover:bg-gray-100 dark:hover:bg-white/5 outline-none"
title="Quantidade por página"
>
<option value={25}>25</option>
<option value={50}>50</option>
<option value={75}>75</option>
<option value={100}>100</option>
</select>
</div>

<Paginator compact />

{/* ✅ Reset com 1 giro */}
<button
onClick={handleResetUI}
className="p-2.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-gray-500 transition-colors"
title="Reset UI"
>
<span
className="inline-flex"
style={{
transform: `rotate(${resetRot}deg)`,
transition: 'transform 520ms ease'
}}
>
<RotateCcw size={22} />
</span>
</button>

<button
onClick={refresh}
className="p-2.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-gray-500 transition-colors"
title={t.refresh}
>
<RefreshCw size={22} className={(loading || catLoading) ? 'animate-spin' : ''} />
</button>
</div>
</div>

{viewMode === 'categories' && catWarn && !catWarnDismissed && (
<div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20">
<div className="text-xs font-bold text-amber-900 dark:text-amber-200">
{catWarn}
</div>
<button
type="button"
onClick={() => setCatWarnDismissed(true)}
className="text-xs font-black px-2 py-1 rounded-md bg-amber-200/70 dark:bg-amber-800/40 text-amber-900 dark:text-amber-100 hover:opacity-90"
>
OK
</button>
</div>
)}
</div>

{/* BODY */}
{viewMode === 'categories' ? (
<CategoriesTable />
) : (
<div className="custom-scrollbar overflow-x-auto overflow-y-hidden">
<div className="overflow-visible">
{loading && coins.length === 0 ? (
<div className="flex flex-col items-center justify-center py-16 text-gray-500">
<Loader2 className="animate-spin mb-2" size={32} />
<span className="font-bold text-sm uppercase tracking-widest animate-pulse">Sincronizando Mercado...</span>
</div>
) : (
<table className="w-full text-left border-collapse min-w-[1180px] table-fixed">
<colgroup>
<col style={{ width: COIN_COL_WIDTH.fav }} />
{colOrder.map((cid) => (
<col key={`col_${cid}`} style={{ width: COIN_COL_WIDTH[cid] || 'auto' }} />
))}
</colgroup>

<thead className="sticky top-0 z-20 bg-white dark:bg-[#2f3032]">
<tr className="border-b border-gray-100 dark:border-slate-800">
<th className="p-2 text-center">
<span className="text-[11px] font-black uppercase tracking-widest text-gray-400 dark:text-slate-400">
{t.favs}
</span>
</th>

<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
<SortableContext items={colOrder} strategy={horizontalListSortingStrategy}>
{colOrder.map((cid) => {
const c = COLS[cid];
return (
<SortableThGeneric
key={c.id}
colId={c.id}
label={c.label}
sortKey={c.sortKey}
activeKey={sortConfig.key}
onSort={(k) => { handleSort(k); }}
/>
);
})}
</SortableContext>
</DndContext>
</tr>
</thead>

<tbody className="divide-y divide-slate-50 dark:divide-slate-800">
{pageCoins.map((coin) => {
const binSym = normalizeBinanceSymbol(coin);
const live = binSym ? binanceLive[binSym] : undefined;

const livePrice = live && isFinite(live.price) ? live.price : Number(coin.current_price || 0);

const change24Base =
(coin as any).price_change_percentage_24h_in_currency ??
coin.price_change_percentage_24h ??
0;

const change24 = live && isFinite(live.ch24) ? live.ch24 : Number(change24Base || 0);
const isPos24 = Number(change24 || 0) >= 0;

const prices = coin.sparkline_in_7d?.price;
const c1h = pctFromSpark(prices, 1);
const c7d = pct7dFromSpark(prices);

const sparkData = Array.isArray(prices) ? prices.map((v, i) => ({ i, v })) : [];
const isFav = !!favorites[coin.id];

const flash = binSym ? priceFlash[binSym] : null;

return (
<tr key={coin.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors group h-[56px]">
<td className="p-2 text-center">
<button
type="button"
onClick={() => setFavorites(prev => ({ ...prev, [coin.id]: !prev[coin.id] }))}
className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
title={isFav ? 'Remover dos favoritos' : 'Favoritar'}
>
<Star
size={18}
color="#dd9933"
fill={isFav ? '#dd9933' : 'transparent'}
/>
</button>
</td>

{colOrder.map((cid) => {
if (cid === 'rank') {
return (
<td key={cid} className="p-2 text-[13px] font-black text-gray-400 text-center">
#{coin.market_cap_rank}
</td>
);
}

if (cid === 'asset') {
return (
<td key={cid} className="p-2">
<div className="flex items-center gap-3 min-w-0">
<img
src={coin.image}
alt={coin.symbol}
className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#242628] p-1 border border-slate-200 dark:border-white/10 shadow-sm shrink-0"
onError={(e) => { e.currentTarget.style.display = 'none'; }}
/>
<div className="flex flex-col min-w-0">
<span className="text-[15px] font-black text-gray-900 dark:text-white leading-none group-hover:text-[#dd9933] transition-colors truncate">
{coin.name}
</span>
<span className="text-xs font-bold text-gray-500 uppercase mt-1 truncate">
{coin.symbol}
</span>
</div>
</div>
</td>
);
}

if (cid === 'price') {
const flashBg =
flash === 'up'
? FLASH_GREEN_BG
: flash === 'down'
? FLASH_RED_BG
: 'transparent';

return (
<td
key={cid}
className="p-2 text-right font-mono text-[15px] font-black text-gray-900 dark:text-slate-200 transition-colors"
>
{/* ✅ PISCA NO BACKGROUND DO TEXTO (não na borda / não no td inteiro) */}
<span
className="inline-block rounded-md px-2 py-1"
style={flash ? { backgroundColor: flashBg } : undefined}
>
{formatUSD(livePrice)}
</span>
</td>
);
}

if (cid === 'ch1h') {
return (
<td
key={cid}
className="p-2 text-right font-mono text-[13px] font-black"
style={!isFinite(c1h) ? { color: '#94a3b8' } : { color: c1h >= 0 ? GREEN : RED }}
title="Estimativa via sparkline 7d"
>
{safePct(c1h)}
</td>
);
}

if (cid === 'ch24h') {
return (
<td
key={cid}
className="p-2 text-right font-mono text-[13px] font-black"
style={{ color: isPos24 ? GREEN : RED }}
>
{isPos24 ? '+' : ''}{Number(change24 || 0).toFixed(2)}%
</td>
);
}

if (cid === 'ch7d') {
return (
<td
key={cid}
className="p-2 text-right font-mono text-[13px] font-black"
style={!isFinite(c7d) ? { color: '#94a3b8' } : { color: c7d >= 0 ? GREEN : RED }}
title="Estimativa via sparkline 7d"
>
{safePct(c7d)}
</td>
);
}

if (cid === 'mcap') {
return (
<td key={cid} className="p-2 text-right font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400">
{formatUSD(Number(coin.market_cap || 0), true)}
</td>
);
}

if (cid === 'vol24h') {
return (
<td key={cid} className="p-2 text-right font-mono text-[13px] font-bold text-gray-600 dark:text-slate-400">
{formatUSD(Number(coin.total_volume || 0), true)}
</td>
);
}

if (cid === 'supply') {
return (
<td key={cid} className="p-2 text-right font-mono text-[12px] font-black text-gray-600 dark:text-slate-400">
{formatCompactNumber(Number(coin.circulating_supply || 0))}
</td>
);
}

if (cid === 'spark7d') {
return (
<td key={cid} className="p-2 overflow-hidden">
<div className="w-full h-12 min-w-[320px] overflow-hidden">
{sparkData.length > 1 ? (
<ResponsiveContainer width="100%" height="100%">
<AreaChart data={sparkData}>
<defs>
<linearGradient id={`g_${coin.id}`} x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stopColor={isPos24 ? GREEN : RED} stopOpacity={0.55} />
<stop offset="75%" stopColor={isPos24 ? GREEN : RED} stopOpacity={0.18} />
<stop offset="100%" stopColor={isPos24 ? GREEN : RED} stopOpacity={0.02} />
</linearGradient>
</defs>
<Area
type="monotone"
dataKey="v"
stroke={isPos24 ? GREEN : RED}
strokeWidth={2}
fill={`url(#g_${coin.id})`}
fillOpacity={1}
isAnimationActive={false}
dot={false}
/>
<YAxis domain={['auto', 'auto']} hide />
</AreaChart>
</ResponsiveContainer>
) : (
<div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400 dark:text-slate-500">
—
</div>
)}
</div>
</td>
);
}

return <td key={cid} className="p-2" />;
})}
</tr>
);
})}

{pageCoins.length === 0 && (
<tr>
<td colSpan={1 + colOrder.length} className="p-8 text-center text-sm font-bold text-gray-500 dark:text-slate-400">
{t.noResults}
</td>
</tr>
)}
</tbody>
</table>
)}
</div>
</div>
)}

<div className="p-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-black/20 shrink-0">
<Paginator />
</div>
</div>
);
};

export default MarketCapTable;
