import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiCoin, Language } from '../../../types';
import {
Search,
XCircle,
Settings,
Droplets,
X as CloseIcon,
Atom,
Coins,
Maximize,
Wind,
Info,
Globe,
Rss
} from 'lucide-react';
import { fetchTopCoins } from '../services/api';

interface Particle {
id: string;
x: number; y: number;
vx: number; vy: number;
radius: number;
targetRadius: number;
color: string;
coin: ApiCoin;
trail: { x: number; y: number; age: number }[];
phase: number;
isFixed?: boolean;
mass: number;

isFalling?: boolean;
fallT?: number;
fallPocket?: { x: number; y: number; r: number } | null;
fallFromX?: number;
fallFromY?: number;

// map transition
mapFromX?: number;
mapFromY?: number;
mapToX?: number;
mapToY?: number;
mapT?: number;
}

type ChartMode = 'performance' | 'valuation';
type Status = 'loading' | 'running' | 'demo' | 'error';
type Timeframe = '1h' | '24h' | '7d';

interface MarketWindSwarmProps { language: Language; onClose: () => void; }

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(val, max));

const formatCompact = (v?: number) => {
const n = Number(v);
if (!isFinite(n)) return '-';
const abs = Math.abs(n);
if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
return `$${n.toFixed(0)}`;
};

const formatPrice = (v?: number) => {
const n = Number(v);
if (!isFinite(n)) return '-';
if (n < 0.01) return `$${n.toPrecision(3)}`;
return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getSpark = (coin: any): number[] | null => {
const arr = coin?.sparkline_in_7d?.price;
if (!Array.isArray(arr) || arr.length < 2) return null;
return arr.map((x: any) => Number(x)).filter((x: number) => isFinite(x));
};

const computeSparkChange = (coin: any, tf: Timeframe) => {
const spark = getSpark(coin);
if (!spark || spark.length < 2) {
const fallback = Number(coin?.price_change_percentage_24h);
const pct = isFinite(fallback) ? fallback : 0;
return { pct, absPct: Math.abs(pct), series: null as number[] | null, inferredMinutesPerPoint: null as number | null };
}

const len = spark.length;
const totalMinutes = 7 * 24 * 60;
const minutesPerPoint = totalMinutes / Math.max(1, (len - 1));

const hours = tf === '1h' ? 1 : tf === '24h' ? 24 : 7 * 24;
const points = Math.max(2, Math.min(len, Math.round((hours * 60) / minutesPerPoint)));

const slice = spark.slice(len - points);
const first = slice[0];
const last = slice[slice.length - 1];

const pct = first > 0 ? ((last - first) / first) * 100 : 0;
return {
pct: isFinite(pct) ? pct : 0,
absPct: isFinite(pct) ? Math.abs(pct) : 0,
series: spark,
inferredMinutesPerPoint: minutesPerPoint
};
};

// watermark
const WATERMARK_LOCAL = '/logo2-transp.png';
const WATERMARK_REMOTE = '';

const drawWatermark = (
ctx: CanvasRenderingContext2D,
width: number,
height: number,
img: HTMLImageElement | null,
isDark: boolean,
isGameMode: boolean
) => {
if (!img || !img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return;

const maxW = width * 0.78;
const maxH = height * 0.78;
const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);

const w = img.naturalWidth * scale;
const h = img.naturalHeight * scale;

const x = (width - w) / 2;
const y = (height - h) / 2;

const alphaBase = isDark ? 0.055 : 0.035;
const alpha = isGameMode ? alphaBase * 0.85 : alphaBase;

ctx.save();
ctx.globalAlpha = alpha;
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';
ctx.drawImage(img, x, y, w, h);
ctx.restore();
};

// audio (internal config)
const SFX_CUE_HIT = '/widgets/sfx-cue-hit.wav';
const SFX_POCKET = '/widgets/sfx-pocket.wav';

// GAME CONFIG
const GAME_BALL_RADIUS = 26;
const GAME_CUE_RADIUS = 34;
const GAME_WALL_PAD = 14;

// Stop + feel (tuned lighter)
const GAME_LINEAR_DAMP = 0.975;
const GAME_STOP_EPS = 1.2;

// Mass scale (lighter balls)
const GAME_MASS_SCALE = 0.24;

// FREE MODE physics
const FREE_LINEAR_DAMP = 0.992;
const FREE_MAX_SPEED = 420;
const FREE_REPULSE = 0.95;

// reset transform animation
type Transform = { k: number; x: number; y: number };
type TransformTween = { active: boolean; from: Transform; to: Transform; t: number; dur: number };

type MagazinePost = {
id: number;
title: string;
excerpt: string;
date: string;
link: string;
image?: string;
};

const MarketWindSwarm = ({ language, onClose }: MarketWindSwarmProps) => {
const containerRef = useRef<HTMLDivElement>(null);
const stageRef = useRef<HTMLDivElement>(null);
const canvasRef = useRef<HTMLCanvasElement>(null);

const particlesRef = useRef<Particle[]>([]);
const imageCache = useRef(new Map<string, HTMLImageElement>());
const reqIdRef = useRef<number>(0);
const dprRef = useRef(1);

const [status, setStatus] = useState<Status>('loading');
const [coins, setCoins] = useState<ApiCoin[]>([]);

const [hoveredParticle, setHoveredParticle] = useState<Particle | null>(null);
const [selectedParticle, setSelectedParticle] = useState<Particle | null>(null);
const [searchTerm, setSearchTerm] = useState('');

const [chartMode, setChartMode] = useState<ChartMode>('performance');
const [timeframe, setTimeframe] = useState<Timeframe>('24h');

const [settingsOpen, setSettingsOpen] = useState(false);
const [legendTipOpen, setLegendTipOpen] = useState(false);

const [isGameMode, setIsGameMode] = useState(false);
const [isFreeMode, setIsFreeMode] = useState(false);

const [numCoins, setNumCoins] = useState(50);

const [floatStrengthRaw, setFloatStrengthRaw] = useState(1.0);
const [trailLength, setTrailLength] = useState(25);

const [cuePowerRaw, setCuePowerRaw] = useState(0.7);

const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

// detail panel
const [detailOpen, setDetailOpen] = useState(false);
const [detailCoin, setDetailCoin] = useState<ApiCoin | null>(null);
const [detailAnimKey, setDetailAnimKey] = useState(0);

// magazine
const [magPosts, setMagPosts] = useState<MagazinePost[]>([]);
const [magIndex, setMagIndex] = useState(0);

// Transform
const transformRef = useRef<Transform>({ k: 1, x: 0, y: 0 });
const tweenRef = useRef<TransformTween>({ active: false, from: { k: 1, x: 0, y: 0 }, to: { k: 1, x: 0, y: 0 }, t: 0, dur: 0.35 });

const isPanningRef = useRef(false);
const panStartRef = useRef({ clientX: 0, clientY: 0, x: 0, y: 0 });
const draggedParticleRef = useRef<Particle | null>(null);
const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

const watermarkRef = useRef<HTMLImageElement | null>(null);

// Map stats cache
const statsRef = useRef<{
minX: number, maxX: number,
minY: number, maxY: number,
minR: number, maxR: number,
logMinX: number, logMaxX: number,
logMinY: number, logMaxY: number
} | null>(null);

const hoveredParticleRef = useRef(hoveredParticle);
hoveredParticleRef.current = hoveredParticle;

const selectedParticleRef = useRef(selectedParticle);
selectedParticleRef.current = selectedParticle;

const detailOpenRef = useRef(detailOpen);
detailOpenRef.current = detailOpen;

// score + audio
const pocketedCountRef = useRef(0);
const pocketedMaxRef = useRef(0);
const [pocketedUI, setPocketedUI] = useState({ count: 0, max: 0 });

const sfxHitRef = useRef<HTMLAudioElement | null>(null);
const sfxPocketRef = useRef<HTMLAudioElement | null>(null);

// ====== GAME 2-CLICK MECHANIC ======
// phase: 0 idle | 1 aiming (holding) | 2 aimLocked waiting 2nd click | 3 power (holding)
const gameCtlRef = useRef<{
phase: 0 | 1 | 2 | 3;
aimX: number; aimY: number;
aimPulseT: number;
powerPull: number;
holdStart: number;
}>({ phase: 0, aimX: 0, aimY: 0, aimPulseT: 0, powerPull: 0, holdStart: 0 });

const cueHideUntilRef = useRef<number>(0);

useEffect(() => {
const a1 = new Audio(SFX_CUE_HIT);
const a2 = new Audio(SFX_POCKET);
a1.preload = 'auto';
a2.preload = 'auto';
sfxHitRef.current = a1;
sfxPocketRef.current = a2;
}, []);

const playHit = useCallback(() => {
const a = sfxHitRef.current;
if (!a) return;
try { a.currentTime = 0; void a.play(); } catch {}
}, []);

const playPocket = useCallback(() => {
const a = sfxPocketRef.current;
if (!a) return;
try { a.currentTime = 0; void a.play(); } catch {}
}, []);

useEffect(() => {
const prevBody = document.body.style.overflow;
const prevHtml = document.documentElement.style.overflow;
document.body.style.overflow = 'hidden';
document.documentElement.style.overflow = 'hidden';
return () => {
document.body.style.overflow = prevBody;
document.documentElement.style.overflow = prevHtml;
};
}, []);

useEffect(() => {
const tryLoad = (src: string, onOk: () => void, onFail: () => void) => {
if (!src) { onFail(); return; }
const img = new Image();
img.crossOrigin = 'anonymous';
img.onload = () => { watermarkRef.current = img; onOk(); };
img.onerror = () => onFail();
img.src = src;
};
tryLoad(
WATERMARK_LOCAL,
() => {},
() => { if (WATERMARK_REMOTE) tryLoad(WATERMARK_REMOTE, () => {}, () => {}); }
);
}, []);

useEffect(() => {
const onKey = (e: KeyboardEvent) => {
if (e.key === 'Escape') {
setDetailOpen(false);
setSettingsOpen(false);
setLegendTipOpen(false);

if (draggedParticleRef.current) {
draggedParticleRef.current.isFixed = false;
draggedParticleRef.current = null;
}
isPanningRef.current = false;

gameCtlRef.current.phase = 0;
gameCtlRef.current.powerPull = 0;
}
};
window.addEventListener('keydown', onKey);
return () => window.removeEventListener('keydown', onKey);
}, []);

const screenToWorld = (clientX: number, clientY: number) => {
const canvas = canvasRef.current;
if (!canvas) return { x: 0, y: 0, mx: 0, my: 0 };
const rect = canvas.getBoundingClientRect();
const mouseX = clientX - rect.left;
const mouseY = clientY - rect.top;

const { k, x, y } = transformRef.current;
return {
x: (mouseX - x) / k,
y: (mouseY - y) / k,
mx: mouseX,
my: mouseY
};
};

const loadData = useCallback(async () => {
if (particlesRef.current.length === 0) setStatus('loading');
try {
const data = await fetchTopCoins({ force: true });
if (data && data.length > 0) {
setCoins(data);
setStatus('running');
} else if (particlesRef.current.length === 0) setStatus('demo');
} catch {
if (particlesRef.current.length === 0) setStatus('error');
}
}, []);

const animateTransformTo = useCallback((to: Transform, dur = 0.35) => {
tweenRef.current = { active: true, from: { ...transformRef.current }, to, t: 0, dur };
}, []);

const resetZoom = useCallback(() => {
gameCtlRef.current.phase = 0;
gameCtlRef.current.powerPull = 0;
if (draggedParticleRef.current) {
draggedParticleRef.current.isFixed = false;
draggedParticleRef.current = null;
}
isPanningRef.current = false;

// animate transform reset to avoid blackout
animateTransformTo({ k: 1, x: 0, y: 0 }, 0.35);
}, [animateTransformTo]);

const getCoinPerf = useCallback((coin: any) => computeSparkChange(coin, timeframe), [timeframe]);
const getCoinPerfPct = useCallback((coin: any) => getCoinPerf(coin).pct, [getCoinPerf]);
const getCoinAbsPct = useCallback((coin: any) => getCoinPerf(coin).absPct, [getCoinPerf]);

const sizeMetricPerf = useCallback((coin: any) => {
const absPct = Math.max(0, getCoinAbsPct(coin));
const vol = Math.max(0, Number(coin?.total_volume) || 0);
const volFactor = Math.log10(vol + 1);
return absPct * volFactor;
}, [getCoinAbsPct]);

const sizeLogScale = useCallback((metric: number, minR: number, maxR: number) => {
const safeMin = Math.max(1, minR);
const safeMax = Math.max(safeMin + 1, maxR);
const lnMin = Math.log10(safeMin);
const lnMax = Math.log10(safeMax);
const lnV = Math.log10(Math.max(1, metric));
const t = (lnV - lnMin) / (lnMax - lnMin || 1);
return clamp(t, 0, 1);
}, []);

const recomputeStatsAndTargets = useCallback((coinsList: ApiCoin[], mode: ChartMode) => {
const topCoins = coinsList.slice(0, isGameMode ? Math.min(50, numCoins) : numCoins);
if (topCoins.length === 0) return;

const xData: number[] = [];
const yData: number[] = [];
const rData: number[] = [];

for (const c of topCoins) {
const vol = Math.max(1, Number(c.total_volume) || 1);
yData.push(vol);

if (mode === 'performance') {
const x = getCoinPerfPct(c) || 0;
xData.push(x);
rData.push(Math.max(0.000001, sizeMetricPerf(c)));
} else {
const mc = Math.max(1, Number(c.market_cap) || 1);
xData.push(mc);
rData.push(mc);
}
}

const minX = Math.min(...xData), maxX = Math.max(...xData);
const minY = Math.min(...yData), maxY = Math.max(...yData);
const minR = Math.min(...rData), maxR = Math.max(...rData);

const logMinX = (mode === 'valuation') ? Math.log10(Math.max(1, minX)) : 0;
const logMaxX = (mode === 'valuation') ? Math.log10(Math.max(1, maxX)) : 0;

statsRef.current = {
minX, maxX, minY, maxY, minR, maxR,
logMinX, logMaxX,
logMinY: Math.log10(Math.max(1, minY)),
logMaxY: Math.log10(Math.max(1, maxY))
};

const coinMap = new Map<string, ApiCoin>(topCoins.map(c => [c.id, c]));
for (const p of particlesRef.current) {
const updated = coinMap.get(p.id);
if (updated) p.coin = updated;

const pct = getCoinPerfPct(p.coin) || 0;
const baseColor = pct >= 0 ? '#089981' : '#f23645';
const isBTC = String(p.coin.id).toLowerCase() === 'bitcoin';

let metric = 1;
if (mode === 'performance') metric = Math.max(0.000001, sizeMetricPerf(p.coin));
else metric = Math.max(1, Number(p.coin.market_cap) || 1);

let targetRadius = 24;
if (mode === 'performance') {
const t = (metric - minR) / (maxR - minR || 1);
targetRadius = 15 + clamp(t, 0, 1) * 55;
} else {
const tlog = sizeLogScale(metric, minR, maxR);
targetRadius = 16 + tlog * 74;
}

if (!isGameMode) {
p.targetRadius = targetRadius;
p.mass = Math.max(1, p.targetRadius);
}

p.color = isBTC ? '#ffffff' : baseColor;
}
}, [getCoinPerfPct, sizeMetricPerf, sizeLogScale, numCoins, isGameMode]);

// Map targets calculation (safe + NO NaN)
const computeMapTargets = useCallback(() => {
if (!statsRef.current) return;
const canvas = canvasRef.current;
if (!canvas) return;

const s = statsRef.current;
if (
!isFinite(s.minX) || !isFinite(s.maxX) ||
!isFinite(s.minY) || !isFinite(s.maxY) ||
!isFinite(s.logMinY) || !isFinite(s.logMaxY)
) return;

const dpr = dprRef.current || 1;
const width = canvas.width / dpr;
const height = canvas.height / dpr;

const margin = { top: 18, right: 18, bottom: 92, left: 86 };
const chartW = Math.max(50, width - margin.left - margin.right);
const chartH = Math.max(50, height - margin.top - margin.bottom);

const originX = margin.left;
const originY = margin.top + chartH;

const projectX = (v: number) => {
let norm = 0;
if (chartMode === 'valuation') {
if (v <= 0 || !isFinite(v) || !isFinite(s.logMinX) || !isFinite(s.logMaxX)) return originX;
const denom = (s.logMaxX - s.logMinX) || 1;
norm = (Math.log10(v) - s.logMinX) / denom;
} else {
const denom = (s.maxX - s.minX) || 1;
norm = (v - s.minX) / denom;
}
const out = originX + clamp(norm, 0, 1) * chartW;
return isFinite(out) ? out : originX;
};

const projectY = (v: number) => {
if (v <= 0 || !isFinite(v)) return originY;
const denom = (s.logMaxY - s.logMinY) || 1;
const norm = (Math.log10(v) - s.logMinY) / denom;
const out = margin.top + (1 - clamp(norm, 0, 1)) * chartH;
return isFinite(out) ? out : originY;
};

for (const p of particlesRef.current) {
const yVal = Math.max(1, Number(p.coin.total_volume) || 1);
let xVal = 0;

if (chartMode === 'performance') xVal = getCoinPerfPct(p.coin) || 0;
else xVal = Math.max(1, Number(p.coin.market_cap) || 1);

const tx = projectX(xVal);
const ty = projectY(yVal);
if (!isFinite(tx) || !isFinite(ty)) continue;

// capture current to transition, no snap
p.mapFromX = p.x;
p.mapFromY = p.y;
p.mapToX = tx;
p.mapToY = ty;
p.mapT = 0;
}
}, [chartMode, getCoinPerfPct]);

const setupGameLayout = useCallback(() => {
const canvas = canvasRef.current;
if (!canvas) return;

const dpr = dprRef.current || 1;
const width = canvas.width / dpr;
const height = canvas.height / dpr;

const w = width;
const h = height;

const cue = particlesRef.current.find(p => String(p.coin.id).toLowerCase() === 'bitcoin');
const others = particlesRef.current
.filter(p => String(p.coin.id).toLowerCase() !== 'bitcoin')
.sort((a, b) => (Number(a.coin.market_cap_rank) || 99999) - (Number(b.coin.market_cap_rank) || 99999));

for (const p of particlesRef.current) {
const isBTC = String(p.coin.id).toLowerCase() === 'bitcoin';
p.targetRadius = isBTC ? GAME_CUE_RADIUS : GAME_BALL_RADIUS;
p.radius = p.targetRadius;

// lighter mass
p.mass = Math.max(0.8, p.targetRadius * GAME_MASS_SCALE);

p.vx = 0; p.vy = 0;
p.trail = [];
p.isFixed = false;
p.isFalling = false;
p.fallT = 0;
p.fallPocket = null;
p.mapT = 1;
}

if (cue) {
cue.x = w * 0.78;
cue.y = h * 0.5;
}

const rackApexX = w * 0.20;
const rackApexY = h * 0.50;
const spacing = GAME_BALL_RADIUS * 2.08;

const N = others.length;
let rows = 1;
while ((rows * (rows + 1)) / 2 < N) rows++;

let idx = 0;
for (let r = 0; r < rows; r++) {
const ballsInRow = r + 1;
const rowX = rackApexX + r * spacing;
const rowYStart = rackApexY - (r * spacing) / 2;

for (let c = 0; c < ballsInRow; c++) {
if (idx >= others.length) break;
const p = others[idx++];
p.x = rowX;
p.y = rowYStart + c * spacing;
}
}

const minX = GAME_WALL_PAD + GAME_BALL_RADIUS;
const maxX = w - GAME_WALL_PAD - GAME_BALL_RADIUS;
const minY = GAME_WALL_PAD + GAME_BALL_RADIUS;
const maxY = h - GAME_WALL_PAD - GAME_BALL_RADIUS;

for (const p of particlesRef.current) {
p.x = clamp(p.x, minX, maxX);
p.y = clamp(p.y, minY, maxY);
}

pocketedCountRef.current = 0;
const maxPocket = Math.max(0, others.length);
pocketedMaxRef.current = maxPocket;
setPocketedUI({ count: 0, max: maxPocket });

gameCtlRef.current.phase = 0;
gameCtlRef.current.powerPull = 0;
cueHideUntilRef.current = 0;
}, []);

const snapBackToMap = useCallback(() => {
if (!statsRef.current) return;
computeMapTargets();
}, [computeMapTargets]);

// magazine fetch: 6 latest posts, 3 per slide
const fetchMagazine = useCallback(async () => {
try {
const res = await fetch('/2/wp-json/wp/v2/posts?per_page=6&_embed=1', { cache: 'no-store' });
if (!res.ok) return;
const data = await res.json();
if (!Array.isArray(data)) return;

const mapped: MagazinePost[] = data.map((p: any) => {
const img = p?._embedded?.['wp:featuredmedia']?.[0]?.source_url;
const title = String(p?.title?.rendered ?? '').replace(/<[^>]*>/g, '').trim();
const excerpt = String(p?.excerpt?.rendered ?? '').replace(/<[^>]*>/g, '').trim();
return {
id: Number(p?.id ?? 0),
title,
excerpt,
date: String(p?.date ?? ''),
link: String(p?.link ?? ''),
image: img
};
}).filter((p: MagazinePost) => p.id);

setMagPosts(mapped);
setMagIndex(0);
} catch {}
}, []);

useEffect(() => { void fetchMagazine(); }, [fetchMagazine]);

useEffect(() => {
loadData();
const interval = setInterval(loadData, 60000);

const canvas = canvasRef.current;
const stage = stageRef.current;
if (!canvas || !stage) return;

const resizeCanvas = () => {
const ratio = window.devicePixelRatio || 1;
dprRef.current = ratio;

const rect = stage.getBoundingClientRect();
const cssW = Math.max(1, Math.floor(rect.width));
const cssH = Math.max(1, Math.floor(rect.height));

canvas.width = Math.max(1, Math.floor(cssW * ratio));
canvas.height = Math.max(1, Math.floor(cssH * ratio));
canvas.style.width = `${cssW}px`;
canvas.style.height = `${cssH}px`;

if (!isGameMode && !isFreeMode) computeMapTargets();
};

resizeCanvas();

const ro = new ResizeObserver(() => resizeCanvas());
ro.observe(stage);

window.addEventListener('resize', resizeCanvas);

const observer = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')));
observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

return () => {
clearInterval(interval);
ro.disconnect();
observer.disconnect();
window.removeEventListener('resize', resizeCanvas);
};
}, [loadData, computeMapTargets, isGameMode, isFreeMode]);

useEffect(() => {
const up = () => handleMouseUp();
window.addEventListener('mouseup', up);
return () => window.removeEventListener('mouseup', up);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

useEffect(() => {
const effectiveNum = isGameMode ? Math.min(50, numCoins) : numCoins;
const topCoins = coins.slice(0, effectiveNum);
if (topCoins.length === 0) return;

for (const c of topCoins) {
if (c?.image && !imageCache.current.has(c.image)) {
const img = new Image();
img.src = c.image;
imageCache.current.set(c.image, img);
}
}

const existingMap = new Map<string, Particle>(particlesRef.current.map(p => [p.id, p]));
const w = stageRef.current?.clientWidth || 1000;
const h = stageRef.current?.clientHeight || 800;

const newParticles: Particle[] = topCoins.map(coin => {
const existing = existingMap.get(coin.id);
if (existing) {
existing.coin = coin;
return existing;
}

return {
id: coin.id,
x: Math.random() * w,
y: Math.random() * h,
vx: (Math.random() - 0.5) * 80,
vy: (Math.random() - 0.5) * 80,
radius: 0,
targetRadius: 24,
color: '#dd9933',
coin,
trail: [],
phase: Math.random() * Math.PI * 2,
isFixed: false,
mass: 24,
isFalling: false,
fallT: 0,
fallPocket: null,
mapT: 0
};
});

particlesRef.current = newParticles;

// only recompute (no snap)
recomputeStatsAndTargets(coins, chartMode);
if (!isGameMode && !isFreeMode) computeMapTargets();
}, [coins, numCoins, recomputeStatsAndTargets, chartMode, isGameMode, isFreeMode, computeMapTargets]);

useEffect(() => {
if (coins.length === 0) return;
recomputeStatsAndTargets(coins, chartMode);
if (!isGameMode && !isFreeMode) computeMapTargets();
}, [chartMode, timeframe, coins, recomputeStatsAndTargets, isGameMode, isFreeMode, computeMapTargets]);

useEffect(() => {
if (isGameMode) {
resetZoom();
setDetailOpen(false);
setSelectedParticle(null);
setHoveredParticle(null);

setIsFreeMode(false);
if (numCoins > 50) setNumCoins(50);

setupGameLayout();
} else {
resetZoom();
setDetailOpen(false);
setSettingsOpen(false);
setLegendTipOpen(false);

if (draggedParticleRef.current) {
draggedParticleRef.current.isFixed = false;
draggedParticleRef.current = null;
}

if (!isFreeMode) snapBackToMap();
}
}, [isGameMode, isFreeMode, resetZoom, setupGameLayout, snapBackToMap, numCoins]);

// Free mode: guarantee visible + alive (fix “shows nothing”)
useEffect(() => {
if (isGameMode) return;
if (!isFreeMode) return;

resetZoom();

const canvas = canvasRef.current;
if (!canvas) return;

const dpr = dprRef.current || 1;
const width = canvas.width / dpr;
const height = canvas.height / dpr;

for (const p of particlesRef.current) {
p.isFixed = false;
p.isFalling = false;
p.fallT = 0;
p.fallPocket = null;

// inject velocity so it moves immediately
p.vx = (Math.random() - 0.5) * 220;
p.vy = (Math.random() - 0.5) * 220;

// clamp into view
p.x = clamp(p.x, p.radius || 10, width - (p.radius || 10));
p.y = clamp(p.y, p.radius || 10, height - (p.radius || 10));

// ensure mapT not controlling anything
p.mapT = 1;
}
}, [isFreeMode, isGameMode, resetZoom]);

const handleMouseMove = (e: React.MouseEvent) => {
const canvas = canvasRef.current; if (!canvas) return;

const wpos = screenToWorld(e.clientX, e.clientY);
const worldMouseX = wpos.x;
const worldMouseY = wpos.y;

lastMousePosRef.current = { x: worldMouseX, y: worldMouseY };

// game phases
if (isGameMode) {
const cue = particlesRef.current.find(pp => String(pp.coin.id).toLowerCase() === 'bitcoin');
if (!cue || cue.isFalling) return;

if (gameCtlRef.current.phase === 1) {
gameCtlRef.current.aimX = worldMouseX;
gameCtlRef.current.aimY = worldMouseY;
return;
}

if (gameCtlRef.current.phase === 3) {
const dx = gameCtlRef.current.aimX - cue.x;
const dy = gameCtlRef.current.aimY - cue.y;
const distDir = Math.hypot(dx, dy) || 0.0001;
const nx = dx / distDir;
const ny = dy / distDir;

const along = (worldMouseX - cue.x) * nx + (worldMouseY - cue.y) * ny;

// power pull: mouse behind the cue ball along aim dir
const MAX_PULL = 220;
const pull = clamp(-along, 0, MAX_PULL);
gameCtlRef.current.powerPull = pull;
return;
}
}

// dragging
if (draggedParticleRef.current) {
const p = draggedParticleRef.current;
p.x = worldMouseX;
p.y = worldMouseY;
return;
}

if (!isGameMode && isPanningRef.current) {
const dx = e.clientX - panStartRef.current.clientX;
const dy = e.clientY - panStartRef.current.clientY;
transformRef.current.x = panStartRef.current.x + dx;
transformRef.current.y = panStartRef.current.y + dy;
return;
}

const rect = canvas.getBoundingClientRect();
const mouseX = e.clientX - rect.left;
const mouseY = e.clientY - rect.top;

const { k, x, y } = transformRef.current;

let found: Particle | null = null;
for (let i = particlesRef.current.length - 1; i >= 0; i--) {
const p = particlesRef.current[i];
if (p.isFalling) continue;

const sx = p.x * k + x;
const sy = p.y * k + y;
const sr = p.radius;

const dx = sx - mouseX;
const dy = sy - mouseY;

if (dx * dx + dy * dy < (sr + 5) * (sr + 5)) {
found = p;
break;
}
}
setHoveredParticle(found);
};

const openDetailFor = (p: Particle) => {
setSelectedParticle(p);
setDetailCoin(p.coin);
setDetailAnimKey(k => k + 1);
setDetailOpen(true);
};

const handleMouseDown = (e: React.MouseEvent) => {
if (detailOpenRef.current) return;

if (isGameMode) {
if (e.button !== 0) return;

const cue = particlesRef.current.find(pp => String(pp.coin.id).toLowerCase() === 'bitcoin');
if (!cue || cue.isFalling) return;

const w = screenToWorld(e.clientX, e.clientY);

if (gameCtlRef.current.phase === 0) {
gameCtlRef.current.phase = 1;
gameCtlRef.current.aimX = w.x;
gameCtlRef.current.aimY = w.y;
gameCtlRef.current.powerPull = 0;
gameCtlRef.current.holdStart = performance.now();
return;
}

if (gameCtlRef.current.phase === 2) {
gameCtlRef.current.phase = 3;
gameCtlRef.current.powerPull = 0;
gameCtlRef.current.holdStart = performance.now();
return;
}

return;
}

// non-game
if (hoveredParticleRef.current) {
openDetailFor(hoveredParticleRef.current);
return;
}

// click empty: close card
setDetailOpen(false);
setSelectedParticle(null);

if (!isFreeMode) {
isPanningRef.current = true;
panStartRef.current = {
clientX: e.clientX,
clientY: e.clientY,
x: transformRef.current.x,
y: transformRef.current.y
};
}
};

const handleMouseUp = () => {
if (isGameMode) {
const cue = particlesRef.current.find(pp => String(pp.coin.id).toLowerCase() === 'bitcoin');
if (!cue || cue.isFalling) {
gameCtlRef.current.phase = 0;
gameCtlRef.current.powerPull = 0;
return;
}

if (gameCtlRef.current.phase === 1) {
// release to lock aim
gameCtlRef.current.phase = 2;
gameCtlRef.current.aimPulseT = performance.now();
return;
}

if (gameCtlRef.current.phase === 3) {
// release to shoot
const dx = gameCtlRef.current.aimX - cue.x;
const dy = gameCtlRef.current.aimY - cue.y;
const dist = Math.hypot(dx, dy) || 0.0001;

const nx = dx / dist;
const ny = dy / dist;

const MAX_PULL = 220;
const pull = clamp(gameCtlRef.current.powerPull, 0, MAX_PULL);
const pullNorm = pull / MAX_PULL;

// calibrated stronger shot + lighter masses
const basePower = 9800;
const power = basePower * pullNorm * (0.35 + cuePowerRaw * 1.65);

cue.vx += nx * (power / Math.max(0.8, cue.mass));
cue.vy += ny * (power / Math.max(0.8, cue.mass));

// hide cue: 3s, AND only show again after cue ball fully stops
cueHideUntilRef.current = performance.now() + 3000;
playHit();

gameCtlRef.current.phase = 0;
gameCtlRef.current.powerPull = 0;
return;
}
}

if (draggedParticleRef.current) {
draggedParticleRef.current.isFixed = false;
draggedParticleRef.current = null;
}
isPanningRef.current = false;
};

const handleWheel = (e: React.WheelEvent) => {
e.preventDefault();
if (detailOpenRef.current) return;
if (isGameMode) return;
if (isFreeMode) return;

const canvas = canvasRef.current; if (!canvas) return;
const rect = canvas.getBoundingClientRect();
const mouseX = e.clientX - rect.left;
const mouseY = e.clientY - rect.top;

const worldX = (mouseX - transformRef.current.x) / transformRef.current.k;
const worldY = (mouseY - transformRef.current.y) / transformRef.current.k;

const zoomFactor = 1.1;
const oldK = transformRef.current.k;
const newK = e.deltaY < 0 ? oldK * zoomFactor : oldK / zoomFactor;
const clampedK = clamp(newK, 0.1, 10.0);

const newX = mouseX - worldX * clampedK;
const newY = mouseY - worldY * clampedK;

transformRef.current = { k: clampedK, x: newX, y: newY };
};

const legendText = useMemo(() => {
if (isGameMode) {
return (
<>
<div><span className="font-black">Modo Game (2 cliques)</span></div>
<div>• 1º clique e segura: mira (pulsando). Soltou: trava a mira.</div>
<div>• 2º clique e segura: regula força (distância do taco). Soltou: tacada.</div>
<div>• Taco some 3s e só volta quando a bola branca parar.</div>
<div>• Bolas encaçapadas saem definitivamente.</div>
</>
);
}
if (isFreeMode) {
return (
<>
<div><span className="font-black">Modo Livre</span></div>
<div>• Bolhas flutuam livres com colisão (não atravessa).</div>
<div>• Market Cap / Variação alteram tamanho e cor.</div>
</>
);
}
if (chartMode === 'performance') {
return (
<>
<div><span className="font-black">Modo Variação</span></div>
<div>• X: Variação {timeframe} (%)</div>
<div>• Y: Volume 24h (log)</div>
<div>• Tamanho: |%| × log(volume)</div>
</>
);
}
return (
<>
<div><span className="font-black">Modo Market Cap</span></div>
<div>• X: Market Cap (log)</div>
<div>• Y: Volume 24h (log)</div>
<div>• Tamanho: Market Cap (escala log)</div>
</>
);
}, [chartMode, timeframe, isGameMode, isFreeMode]);

const detailPerf24 = useMemo(() => detailCoin ? computeSparkChange(detailCoin, '24h') : null, [detailCoin]);
const detailPerf1h = useMemo(() => detailCoin ? computeSparkChange(detailCoin, '1h') : null, [detailCoin]);
const detailPerf7d = useMemo(() => detailCoin ? computeSparkChange(detailCoin, '7d') : null, [detailCoin]);

const perfColor = (pct?: number) => (Number(pct) >= 0 ? '#089981' : '#f23645');

const effectiveNumCoins = useMemo(() => (isGameMode ? Math.min(50, numCoins) : numCoins), [isGameMode, numCoins]);
const gameCoinOptions = useMemo(() => [10, 20, 30], []);
const normalCoinOptions = useMemo(() => [50, 100, 150, 200, 250], []);

const siteSocials = useMemo(() => ([
{ name: 'Site', icon: Globe, href: 'https://centralcrypto.com.br' },
{ name: 'RSS', icon: Rss, href: 'https://centralcrypto.com.br/2/feed/' }
]), []);

const magSlides = useMemo(() => {
const out: MagazinePost[][] = [];
for (let i = 0; i < magPosts.length; i += 3) out.push(magPosts.slice(i, i + 3));
return out;
}, [magPosts]);

// ===== RENDER LOOP =====
useEffect(() => {
const canvas = canvasRef.current;
const ctx = canvas?.getContext('2d', { alpha: false });
if (!ctx || !canvas) return;

let lastTime = performance.now();

const loop = () => {
const now = performance.now();
const dtRaw = (now - lastTime) / 1000;
const dt = Math.min(dtRaw, 1 / 30);
lastTime = now;

const dpr = dprRef.current || 1;
const width = canvas.width / dpr;
const height = canvas.height / dpr;

if (tweenRef.current.active) {
const tw = tweenRef.current;
tw.t = clamp(tw.t + dt / tw.dur, 0, 1);
const e = 1 - Math.pow(1 - tw.t, 3);
transformRef.current = {
k: tw.from.k + (tw.to.k - tw.from.k) * e,
x: tw.from.x + (tw.to.x - tw.from.x) * e,
y: tw.from.y + (tw.to.y - tw.from.y) * e
};
if (tw.t >= 1) tw.active = false;
}

ctx.setTransform(1, 0, 0, 1, 0, 0);
ctx.fillStyle = isGameMode ? (isDark ? '#08110c' : '#e8f3ea') : (isDark ? '#0b0f14' : '#ffffff');
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.scale(dpr, dpr);

drawWatermark(ctx, width, height, watermarkRef.current, isDark, isGameMode);

const { k, x: panX, y: panY } = transformRef.current;
const toScreenX = (val: number) => val * k + panX;
const toScreenY = (val: number) => val * k + panY;

const particles = particlesRef.current;

// smooth radius in all modes
for (const p of particles) {
const viewRadius = p.targetRadius * Math.pow(k, 0.25);
p.radius += (viewRadius - p.radius) * 0.15;
if (isGameMode) {
p.mass = Math.max(0.8, p.targetRadius * GAME_MASS_SCALE);
} else {
p.mass = Math.max(1, p.radius);
}
}

// pockets + rails
let pockets: { x: number; y: number; r: number }[] = [];
if (isGameMode) {
const worldW = width / k;
const worldH = height / k;
const pr = Math.max(26, Math.min(40, Math.min(worldW, worldH) * 0.04));
pockets = [
{ x: pr, y: pr, r: pr },
{ x: worldW / 2, y: pr, r: pr },
{ x: worldW - pr, y: pr, r: pr },
{ x: pr, y: worldH - pr, r: pr },
{ x: worldW / 2, y: worldH - pr, r: pr },
{ x: worldW - pr, y: worldH - pr, r: pr }
];

ctx.save();
ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';
ctx.lineWidth = 4;
ctx.strokeRect(8, 8, width - 16, height - 16);
ctx.restore();

ctx.save();
for (const pk of pockets) {
const sx = toScreenX(pk.x);
const sy = toScreenY(pk.y);
ctx.beginPath();
ctx.arc(sx, sy, pk.r * k, 0, Math.PI * 2);
ctx.fillStyle = isDark ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.18)';
ctx.fill();
ctx.beginPath();
ctx.arc(sx, sy, pk.r * k, 0, Math.PI * 2);
ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
ctx.lineWidth = 2;
ctx.stroke();
}
ctx.restore();
}

// axes (mapped only, not free, not game)
if (!isGameMode && !isFreeMode && statsRef.current) {
const s = statsRef.current;
const margin = { top: 18, right: 18, bottom: 92, left: 86 };
const chartW = Math.max(50, width - margin.left - margin.right);
const chartH = Math.max(50, height - margin.top - margin.bottom);
const originX = margin.left;
const originY = margin.top + chartH;

ctx.save();
ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
ctx.lineWidth = 1;
ctx.font = 'bold 12px Inter';
ctx.fillStyle = isDark ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.72)';
ctx.textBaseline = 'middle';

const projectX = (v: number) => {
let norm = 0;
if (chartMode === 'valuation') {
if (v <= 0) return originX;
norm = (Math.log10(v) - s.logMinX) / (s.logMaxX - s.logMinX || 1);
} else {
norm = (v - s.minX) / (s.maxX - s.minX || 1);
}
return originX + norm * chartW;
};
const xSteps = 6;

for (let i = 0; i <= xSteps; i++) {
const percent = i / xSteps;
let val = 0;
if (chartMode === 'valuation') val = Math.pow(10, s.logMinX + percent * (s.logMaxX - s.logMinX));
else val = s.minX + percent * (s.maxX - s.minX);

const worldX = projectX(val);
const screenX = toScreenX(worldX);

ctx.beginPath();
ctx.moveTo(screenX, toScreenY(margin.top));
ctx.lineTo(screenX, toScreenY(originY));
ctx.stroke();

ctx.textAlign = 'center';
const label = (chartMode === 'performance') ? `${val.toFixed(1)}%` : formatCompact(val);
const tickY = clamp(toScreenY(originY) + 18, 12, height - 14);
ctx.fillText(label, screenX, tickY);
}

const ySteps = 5;
const projectY = (v: number) => {
if (v <= 0) return originY;
const norm = (Math.log10(v) - s.logMinY) / (s.logMaxY - s.logMinY || 1);
return margin.top + (1 - norm) * chartH;
};

for (let i = 0; i <= ySteps; i++) {
const percent = i / ySteps;
const val = Math.pow(10, s.logMinY + percent * (s.logMaxY - s.logMinY));
const worldY = projectY(val);
const screenY = toScreenY(worldY);

ctx.beginPath();
ctx.moveTo(toScreenX(originX), screenY);
ctx.lineTo(toScreenX(originX + chartW), screenY);
ctx.stroke();

ctx.textAlign = 'right';
ctx.fillText(formatCompact(val), toScreenX(originX) - 10, screenY);
}

ctx.beginPath();
ctx.moveTo(toScreenX(originX), toScreenY(originY));
ctx.lineTo(toScreenX(originX + chartW), toScreenY(originY));
ctx.stroke();

ctx.beginPath();
ctx.moveTo(toScreenX(originX), toScreenY(margin.top));
ctx.lineTo(toScreenX(originX), toScreenY(originY));
ctx.stroke();

ctx.font = 'bold 14px Inter';
ctx.textAlign = 'center';
ctx.fillStyle = isDark ? '#dd9933' : '#333';
const xLabel = chartMode === 'performance' ? `Variação ${timeframe} (%)` : 'Market Cap (Log)';
const xLabelY = clamp(toScreenY(originY) + 56, 20, height - 10);
ctx.fillText(xLabel, width / 2, xLabelY);

ctx.save();
ctx.translate(18, height / 2);
ctx.rotate(-Math.PI / 2);
ctx.fillText('Volume 24h (Log)', 0, 0);
ctx.restore();
ctx.restore();
}

// PHYSICS
if (isGameMode) {
const subSteps = 3;
const stepDt = dt / subSteps;
const worldW = width / k;
const worldH = height / k;

for (let step = 0; step < subSteps; step++) {
const drag = Math.pow(GAME_LINEAR_DAMP, stepDt * 60);

// integrate
for (const p of particles) {
if (p.isFalling) continue;
if (p.isFixed) continue;

p.vx *= drag;
p.vy *= drag;

if (Math.hypot(p.vx, p.vy) < GAME_STOP_EPS) { p.vx = 0; p.vy = 0; }

p.x += p.vx * stepDt;
p.y += p.vy * stepDt;

if (p.x < p.radius + GAME_WALL_PAD) { p.x = p.radius + GAME_WALL_PAD; p.vx *= -0.95; }
else if (p.x > worldW - p.radius - GAME_WALL_PAD) { p.x = worldW - p.radius - GAME_WALL_PAD; p.vx *= -0.95; }

if (p.y < p.radius + GAME_WALL_PAD) { p.y = p.radius + GAME_WALL_PAD; p.vy *= -0.95; }
else if (p.y > worldH - p.radius - GAME_WALL_PAD) { p.y = worldH - p.radius - GAME_WALL_PAD; p.vy *= -0.95; }
}

// collisions
for (let i = 0; i < particles.length; i++) {
const p1 = particles[i];
if (p1.isFalling) continue;

for (let j = i + 1; j < particles.length; j++) {
const p2 = particles[j];
if (p2.isFalling) continue;

const dx = p2.x - p1.x;
const dy = p2.y - p1.y;
const minDist = p1.radius + p2.radius;
const distSq = dx * dx + dy * dy;
if (distSq >= minDist * minDist) continue;

const dist = Math.sqrt(distSq) || 0.001;
const nx = dx / dist;
const ny = dy / dist;

const overlap = minDist - dist;
const totalMass = (p1.mass + p2.mass) || 1;
const move1 = (p2.mass / totalMass);
const move2 = (p1.mass / totalMass);

if (!p1.isFixed) { p1.x -= nx * overlap * move1; p1.y -= ny * overlap * move1; }
if (!p2.isFixed) { p2.x += nx * overlap * move2; p2.y += ny * overlap * move2; }

const rvx = p2.vx - p1.vx;
const rvy = p2.vy - p1.vy;
const velAlongNormal = rvx * nx + rvy * ny;
if (velAlongNormal > 0) continue;

const restitution = 0.92;
let impulse = -(1 + restitution) * velAlongNormal;
impulse /= (1 / p1.mass + 1 / p2.mass);

const ix = impulse * nx;
const iy = impulse * ny;

if (!p1.isFixed) { p1.vx -= ix / p1.mass; p1.vy -= iy / p1.mass; }
if (!p2.isFixed) { p2.vx += ix / p2.mass; p2.vy += iy / p2.mass; }
}
}

// pockets detect
for (const p of particles) {
if (p.isFalling) continue;
if (p.isFixed) continue;

for (const pk of pockets) {
const dist = Math.hypot(p.x - pk.x, p.y - pk.y);
if (dist < (pk.r + p.radius)) {
p.isFalling = true;
p.fallT = 0;
p.vx = 0;
p.vy = 0;
p.fallPocket = pk;
p.fallFromX = p.x;
p.fallFromY = p.y;
break;
}
}
}

// falling animation + remove
for (const p of [...particles]) {
if (!p.isFalling) continue;
p.fallT = (p.fallT || 0) + stepDt;

const t = clamp((p.fallT || 0) / 0.35, 0, 1);
const ease = 1 - Math.pow(1 - t, 3);

const pk = p.fallPocket;
if (pk) {
const fx = p.fallFromX ?? p.x;
const fy = p.fallFromY ?? p.y;
p.x = fx + (pk.x - fx) * ease;
p.y = fy + (pk.y - fy) * ease;
}

if (t >= 1) {
const wasCue = String(p.coin.id).toLowerCase() === 'bitcoin';
particlesRef.current = particlesRef.current.filter(pp => pp !== p);

if (!wasCue) {
pocketedCountRef.current += 1;
setPocketedUI({ count: pocketedCountRef.current, max: pocketedMaxRef.current });
}
playPocket();
}
}
}
} else if (isFreeMode) {
const subSteps = 2;
const stepDt = dt / subSteps;
const worldW = width / k;
const worldH = height / k;

for (let step = 0; step < subSteps; step++) {
const drag = Math.pow(FREE_LINEAR_DAMP, stepDt * 60);

for (const p of particles) {
if (p.isFalling) continue;
if (p.isFixed) continue;

p.vx *= drag;
p.vy *= drag;

const drift = 18 * (0.25 + floatStrengthRaw);
p.vx += Math.sin(now * 0.0007 + p.phase) * drift * stepDt;
p.vy += Math.cos(now * 0.0009 + p.phase) * drift * stepDt;

const sp = Math.hypot(p.vx, p.vy);
if (sp > FREE_MAX_SPEED) {
p.vx = (p.vx / sp) * FREE_MAX_SPEED;
p.vy = (p.vy / sp) * FREE_MAX_SPEED;
}

p.x += p.vx * stepDt;
p.y += p.vy * stepDt;

if (p.x < p.radius) { p.x = p.radius; p.vx *= -0.92; }
else if (p.x > worldW - p.radius) { p.x = worldW - p.radius; p.vx *= -0.92; }

if (p.y < p.radius) { p.y = p.radius; p.vy *= -0.92; }
else if (p.y > worldH - p.radius) { p.y = worldH - p.radius; p.vy *= -0.92; }
}

for (let i = 0; i < particles.length; i++) {
const p1 = particles[i];
if (p1.isFalling) continue;

for (let j = i + 1; j < particles.length; j++) {
const p2 = particles[j];
if (p2.isFalling) continue;

const dx = p2.x - p1.x;
const dy = p2.y - p1.y;
const minDist = p1.radius + p2.radius;
const distSq = dx * dx + dy * dy;
if (distSq >= minDist * minDist) continue;

const dist = Math.sqrt(distSq) || 0.001;
const nx = dx / dist;
const ny = dy / dist;

const overlap = minDist - dist;
const totalMass = (p1.mass + p2.mass) || 1;
const move1 = (p2.mass / totalMass);
const move2 = (p1.mass / totalMass);

if (!p1.isFixed) { p1.x -= nx * overlap * move1 * FREE_REPULSE; p1.y -= ny * overlap * move1 * FREE_REPULSE; }
if (!p2.isFixed) { p2.x += nx * overlap * move2 * FREE_REPULSE; p2.y += ny * overlap * move2 * FREE_REPULSE; }

const rvx = p2.vx - p1.vx;
const rvy = p2.vy - p1.vy;
const velAlongNormal = rvx * nx + rvy * ny;
if (velAlongNormal > 0) continue;

const restitution = 0.90;
let impulse = -(1 + restitution) * velAlongNormal;
impulse /= (1 / p1.mass + 1 / p2.mass);

const ix = impulse * nx;
const iy = impulse * ny;

if (!p1.isFixed) { p1.vx -= ix / p1.mass; p1.vy -= iy / p1.mass; }
if (!p2.isFixed) { p2.vx += ix / p2.mass; p2.vy += iy / p2.mass; }
}
}
}
} else {
// MAPPED MODE: lock to map targets, no “free drift”
for (const p of particles) {
const t0 = p.mapT ?? 1;
const t1 = clamp(t0 + dt / 0.55, 0, 1);
p.mapT = t1;

const ease = 1 - Math.pow(1 - t1, 3);
const fx = p.mapFromX ?? p.x;
const fy = p.mapFromY ?? p.y;
const tx = p.mapToX ?? p.x;
const ty = p.mapToY ?? p.y;

const baseX = fx + (tx - fx) * ease;
const baseY = fy + (ty - fy) * ease;

// micro jitter only, never “free”
const jitterAmp = 1.6 * floatStrengthRaw;
const jx = Math.sin(now * 0.002 + p.phase) * jitterAmp;
const jy = Math.cos(now * 0.0024 + p.phase) * jitterAmp;

p.x = baseX + jx;
p.y = baseY + jy;
}
}

// DRAW particles
for (const p of particlesRef.current) {
const screenX = toScreenX(p.x);
const screenY = toScreenY(p.y);

if (screenX + p.radius < 0 || screenX - p.radius > width || screenY + p.radius < 0 || screenY - p.radius > height) continue;

let drawRadius = p.radius;
let alpha = 1.0;

if (p.isFalling) {
const t = clamp((p.fallT || 0) / 0.35, 0, 1);
drawRadius = p.radius * (1 - t);
alpha = 1 - t;
}

const isHovered = hoveredParticleRef.current?.id === p.id;
const isSelected = selectedParticleRef.current?.id === p.id;

const isDimmed = searchTerm
&& !p.coin.name.toLowerCase().includes(searchTerm.toLowerCase())
&& !p.coin.symbol.toLowerCase().includes(searchTerm.toLowerCase());

if (isDimmed) alpha *= 0.12;

if (trailLength > 0 && alpha > 0.05) {
const last = p.trail[p.trail.length - 1];
const ddx = last ? screenX - last.x : 10;
const ddy = last ? screenY - last.y : 10;

if (!last || (ddx * ddx + ddy * ddy > 4)) p.trail.push({ x: screenX, y: screenY, age: 1.0 });

for (let tIdx = 0; tIdx < p.trail.length; tIdx++) p.trail[tIdx].age -= 0.02;
p.trail = p.trail.filter(t => t.age > 0);

if (p.trail.length > 1) {
const grad = ctx.createLinearGradient(p.trail[0].x, p.trail[0].y, screenX, screenY);
grad.addColorStop(0, 'rgba(0,0,0,0)');
grad.addColorStop(1, p.color);

ctx.beginPath();
ctx.moveTo(p.trail[0].x, p.trail[0].y);
for (let i = 1; i < p.trail.length; i++) ctx.lineTo(p.trail[i].x, p.trail[i].y);

ctx.strokeStyle = grad;
ctx.globalAlpha = alpha;
ctx.lineWidth = Math.min(drawRadius * 0.4, 4);
ctx.stroke();
ctx.globalAlpha = 1.0;
}
} else {
p.trail = [];
}

if (drawRadius <= 0.5) continue;

const isBTC = String(p.coin.id).toLowerCase() === 'bitcoin';

ctx.save();
ctx.globalAlpha = alpha;

ctx.beginPath();
ctx.arc(screenX, screenY, drawRadius, 0, Math.PI * 2);

const img = imageCache.current.get(p.coin.image);
if (img?.complete) {
ctx.save();
ctx.clip();
ctx.drawImage(img, screenX - drawRadius, screenY - drawRadius, drawRadius * 2, drawRadius * 2);
ctx.restore();

ctx.strokeStyle = isBTC && isGameMode ? (isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.35)') : p.color;
ctx.lineWidth = isSelected ? 4 : 2;
ctx.stroke();
} else {
ctx.fillStyle = isBTC && isGameMode ? '#ffffff' : p.color;
ctx.fill();
}

if (!isGameMode && drawRadius > 12) {
ctx.fillStyle = '#fff';
ctx.font = `bold ${Math.max(11, drawRadius * 0.42)}px Inter`;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.shadowColor = 'rgba(0,0,0,0.8)';
ctx.shadowBlur = 4;
ctx.fillText(p.coin.symbol.toUpperCase(), screenX, screenY);
ctx.shadowBlur = 0;
}

if (isHovered || isSelected) {
ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)';
ctx.lineWidth = 2;
ctx.beginPath();
ctx.arc(screenX, screenY, drawRadius + 4, 0, Math.PI * 2);
ctx.stroke();
}

ctx.restore();
}

// draw cue + aim marker (game)
if (isGameMode) {
const cueBall = particlesRef.current.find(p => String(p.coin.id).toLowerCase() === 'bitcoin');
if (cueBall) {
let anyMoving = false;
for (const p of particlesRef.current) {
if (p.isFalling) continue;
if (Math.hypot(p.vx, p.vy) > GAME_STOP_EPS) { anyMoving = true; break; }
}

const canShowCue = (now >= cueHideUntilRef.current) && !anyMoving && !cueBall.isFalling;

if (canShowCue) {
const cx = toScreenX(cueBall.x);
const cy = toScreenY(cueBall.y);

const aimX = gameCtlRef.current.aimX;
const aimY = gameCtlRef.current.aimY;

let tx = cx + 120;
let ty = cy;

if (gameCtlRef.current.phase === 1 || gameCtlRef.current.phase === 2 || gameCtlRef.current.phase === 3) {
tx = toScreenX(aimX);
ty = toScreenY(aimY);
} else if (lastMousePosRef.current) {
tx = toScreenX(lastMousePosRef.current.x);
ty = toScreenY(lastMousePosRef.current.y);
}

const dx = tx - cx;
const dy = ty - cy;
const dist = Math.hypot(dx, dy) || 0.0001;
const ux = dx / dist;
const uy = dy / dist;

const contactGap = 12;

// Idle animation (vai-e-vem) ONLY when phase 0 and balls stopped
const idlePull = 14 + Math.sin(now * 0.010) * 8;

// Pull when power phase
const pull = (gameCtlRef.current.phase === 3) ? gameCtlRef.current.powerPull : (gameCtlRef.current.phase === 0 ? idlePull : 14);

const tipX = cx - ux * (cueBall.radius + contactGap + pull);
const tipY = cy - uy * (cueBall.radius + contactGap + pull);

const stickLen = Math.max(260, cueBall.radius * 7.5);
const buttX = tipX - ux * stickLen;
const buttY = tipY - uy * stickLen;

const thick = Math.max(8, cueBall.radius * 0.40);
const tipThick = Math.max(5, thick * 0.55);

ctx.save();
ctx.globalAlpha = 0.92;
ctx.lineCap = 'round';

ctx.beginPath();
ctx.moveTo(buttX, buttY);
ctx.lineTo(tipX, tipY);
ctx.strokeStyle = isDark ? 'rgba(210,170,120,0.78)' : 'rgba(120,85,45,0.72)';
ctx.lineWidth = thick;
ctx.stroke();

const tipLen = Math.min(30, stickLen * 0.12);
ctx.beginPath();
ctx.moveTo(tipX - ux * tipLen, tipY - uy * tipLen);
ctx.lineTo(tipX, tipY);
ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.78)';
ctx.lineWidth = tipThick;
ctx.stroke();

ctx.restore();
}

// aim marker locked (phase 2 / 3) always pulsing
if (gameCtlRef.current.phase === 2 || gameCtlRef.current.phase === 3) {
const sx = toScreenX(gameCtlRef.current.aimX);
const sy = toScreenY(gameCtlRef.current.aimY);
const pulse = 1 + Math.sin(now * 0.012) * 0.12;

ctx.save();
ctx.globalAlpha = 0.9;
ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)';
ctx.lineWidth = 2;

ctx.beginPath();
ctx.arc(sx, sy, 12 * pulse, 0, Math.PI * 2);
ctx.stroke();

ctx.beginPath();
ctx.moveTo(sx - 18, sy);
ctx.lineTo(sx + 18, sy);
ctx.stroke();

ctx.beginPath();
ctx.moveTo(sx, sy - 18);
ctx.lineTo(sx, sy + 18);
ctx.stroke();
ctx.restore();
}

// power meter while holding phase 3
if (gameCtlRef.current.phase === 3 && cueBall) {
const cx = toScreenX(cueBall.x);
const cy = toScreenY(cueBall.y);

const MAX_PULL = 220;
const pct = Math.round(clamp((gameCtlRef.current.powerPull / MAX_PULL) * 100, 1, 100));

ctx.save();
ctx.globalAlpha = 0.92;
ctx.font = 'bold 16px Inter';
ctx.textAlign = 'center';
ctx.textBaseline = 'bottom';

ctx.shadowColor = 'rgba(0,0,0,0.65)';
ctx.shadowBlur = 6;

ctx.fillStyle = isDark ? '#dd9933' : '#222';
ctx.fillText(`${pct}%`, cx, cy - cueBall.radius - 10);

ctx.shadowBlur = 0;
ctx.restore();
}
}
}

reqIdRef.current = requestAnimationFrame(loop);
};

reqIdRef.current = requestAnimationFrame(loop);
return () => cancelAnimationFrame(reqIdRef.current);
}, [
isDark,
chartMode,
isGameMode,
isFreeMode,
timeframe,
floatStrengthRaw,
trailLength,
searchTerm,
cuePowerRaw,
playHit,
playPocket
]);

// UI
return (
<div
ref={containerRef}
className="fixed inset-0 z-[2000] bg-white dark:bg-[#0b0f14] text-gray-900 dark:text-white flex flex-col overflow-hidden touch-none select-none overscroll-none h-[100dvh]"
>
<div className="flex justify-between items-start p-4 z-20 bg-white/80 dark:bg-black/50 backdrop-blur-sm border-b border-gray-200 dark:border-white/10 shrink-0">
<div className="flex items-center gap-4">
<Coins size={28} className="text-[#dd9933]" />
<div>
<h3 className="text-xl font-black uppercase tracking-wider">Crypto Bubbles</h3>
<p className="text-xs text-gray-500 dark:text-gray-400 font-bold">
{status === 'demo' ? 'MODO DEMO' : isGameMode ? 'MODO GAME' : isFreeMode ? 'MODO LIVRE' : 'MODO MAPA'}
</p>
</div>

{isGameMode && (
<div className="ml-3 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
<div className="text-[11px] font-black text-gray-500 dark:text-gray-400">Encaçapadas</div>
<div className="text-sm font-black">{pocketedUI.count}/{pocketedUI.max}</div>
</div>
)}

<div className="w-px h-8 bg-gray-200 dark:bg-white/10 mx-4"></div>

<div className="flex items-center gap-2">
<div className="flex bg-gray-100 dark:bg-black/50 p-1 rounded-lg border border-gray-200 dark:border-white/10">
<button
onClick={() => setChartMode('valuation')}
className={`px-4 py-1.5 text-xs font-black rounded transition-colors ${chartMode === 'valuation' ? 'bg-white dark:bg-[#2f3032] shadow text-[#dd9933]' : 'text-gray-500 dark:text-gray-300'}`}
disabled={isGameMode}
>
Market Cap
</button>
</div>

<div className="flex items-center bg-gray-100 dark:bg-black/50 p-1 rounded-lg border border-gray-200 dark:border-white/10">
<button
onClick={() => setChartMode('performance')}
className={`px-4 py-1.5 text-xs font-black rounded transition-colors ${chartMode === 'performance' ? 'bg-white dark:bg-[#2f3032] shadow text-[#dd9933]' : 'text-gray-500 dark:text-gray-300'}`}
disabled={isGameMode}
>
Variação:
</button>

<div className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-1"></div>

<div className="flex items-center gap-2 px-2 py-1">
<Wind size={14} className="text-gray-400" />
<select
value={timeframe}
onChange={(e) => setTimeframe(e.target.value as Timeframe)}
className="bg-white dark:bg-[#2f3032] text-gray-900 dark:text-gray-100 px-2 py-1 rounded text-xs font-black border border-gray-200 dark:border-white/10 outline-none"
disabled={isGameMode}
>
<option value="1h">1h</option>
<option value="24h">24h</option>
<option value="7d">7d</option>
</select>
</div>
</div>
</div>

<div className="flex items-center gap-2 bg-gray-100 dark:bg-black/50 p-2 rounded-lg border border-gray-200 dark:border-white/10">
<Coins size={16} className="text-gray-400" />
<select
value={effectiveNumCoins}
onChange={e => setNumCoins(parseInt(e.target.value))}
className="bg-white dark:bg-[#2f3032] text-gray-900 dark:text-gray-100 px-2 py-1 rounded text-xs font-black border border-gray-200 dark:border-white/10 outline-none"
>
{(isGameMode ? gameCoinOptions : normalCoinOptions).map(n => (
<option key={n} value={n}>{n} moedas</option>
))}
</select>
</div>

<div className="flex items-center gap-2 bg-gray-100 dark:bg-black/50 p-2 rounded-lg border border-gray-200 dark:border-white/10">
<Search size={16} className="text-gray-400" />
<input
type="text"
value={searchTerm}
onChange={(e) => setSearchTerm(e.target.value)}
placeholder="Buscar ativo..."
className="bg-transparent outline-none text-sm w-48 text-gray-900 dark:text-white"
disabled={false}
/>
{searchTerm && (
<button onClick={() => { setSearchTerm(''); setSelectedParticle(null); }}>
<XCircle size={16} className="text-gray-500 hover:text-white" />
</button>
)}
</div>
</div>

<div className="flex items-center gap-3 relative">
<button
onClick={resetZoom}
className="p-3 bg-[#dd9933]/10 hover:bg-[#dd9933]/20 text-[#dd9933] rounded-lg border border-[#dd9933]/30 transition-colors"
title="Reset Zoom"
>
<Maximize size={20} />
</button>

<div className="relative">
<button
onMouseEnter={() => setLegendTipOpen(true)}
onMouseLeave={() => setLegendTipOpen(false)}
className="p-3 rounded-lg border transition-colors backdrop-blur-sm bg-gray-100 dark:bg-black/50 border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10"
title="Legenda / Instruções"
>
<Info size={20} />
</button>

{legendTipOpen && (
<div
className="absolute right-0 mt-2 w-80 bg-white/95 dark:bg-black/85 border border-gray-200 dark:border-white/10 rounded-xl p-3 shadow-xl backdrop-blur-md text-sm"
onMouseEnter={() => setLegendTipOpen(true)}
onMouseLeave={() => setLegendTipOpen(false)}
>
<div className="space-y-1 text-gray-800 dark:text-gray-100">
{legendText}
</div>
</div>
)}
</div>

<button
onClick={() => setSettingsOpen(v => !v)}
className={`p-3 rounded-lg border transition-colors backdrop-blur-sm ${settingsOpen ? 'bg-[#dd9933] text-black border-[#dd9933]' : 'bg-gray-100 dark:bg-black/50 border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10'}`}
title="Settings"
>
<Settings size={20} />
</button>

<button
onClick={() => onClose()}
className="p-3 bg-gray-100 dark:bg-black/50 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-red-500/10 text-gray-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
title="Close"
>
<CloseIcon size={20} />
</button>
</div>
</div>

{settingsOpen && (
<div
className="absolute top-24 right-4 bg-white/90 dark:bg-black/80 p-4 rounded-lg border border-gray-200 dark:border-white/10 backdrop-blur-md w-80 z-30 shadow-xl"
onWheel={(e) => e.stopPropagation()}
onMouseDown={(e) => e.stopPropagation()}
>
<div className="flex items-center justify-between gap-3">
<div className="flex items-center gap-2">
<Atom size={14} />
<span className="text-xs font-black uppercase tracking-wider">Modo Game</span>
</div>

<button
onClick={() => setIsGameMode(!isGameMode)}
className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isGameMode ? 'bg-[#dd9933]' : 'bg-gray-200 dark:bg-[#2f3032]'}`}
title="Modo Game"
>
<span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isGameMode ? 'translate-x-6' : 'translate-x-1'}`} />
</button>
</div>

{!isGameMode && (
<div className="mt-3 flex items-center justify-between gap-3">
<div className="flex items-center gap-2">
<Wind size={14} />
<span className="text-xs font-black uppercase tracking-wider">Modo Livre</span>
</div>

<button
onClick={() => setIsFreeMode(v => !v)}
className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isFreeMode ? 'bg-[#dd9933]' : 'bg-gray-200 dark:bg-[#2f3032]'}`}
title="Modo Livre"
>
<span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isFreeMode ? 'translate-x-6' : 'translate-x-1'}`} />
</button>
</div>
)}

<div className="mt-4 space-y-4">
<div className={isGameMode ? 'opacity-50' : ''}>
<div className="flex items-center justify-between gap-3">
<div className="flex items-center gap-2">
<Wind size={14} />
<span className="text-xs font-black uppercase tracking-wider">Flutuação</span>
</div>
<span className="text-xs font-bold text-gray-500 dark:text-gray-400">{Math.round(floatStrengthRaw * 100)}%</span>
</div>
<input
type="range"
min="0"
max="1"
step="0.05"
value={floatStrengthRaw}
onChange={e => setFloatStrengthRaw(parseFloat(e.target.value))}
className="w-full accent-[#dd9933] mt-2"
/>
</div>

<div>
<div className="flex items-center justify-between gap-3">
<div className="flex items-center gap-2">
<Droplets size={14} />
<span className="text-xs font-black uppercase tracking-wider">Rastro (Trail)</span>
</div>
<span className="text-xs font-bold text-gray-500 dark:text-gray-400">{trailLength}</span>
</div>
<input
type="range"
min="0"
max="50"
step="1"
value={trailLength}
onChange={e => setTrailLength(parseInt(e.target.value))}
className="w-full accent-[#dd9933] mt-2"
/>
</div>

{isGameMode && (
<div>
<div className="flex items-center justify-between gap-3">
<div className="flex items-center gap-2">
<Atom size={14} />
<span className="text-xs font-black uppercase tracking-wider">Força Base</span>
</div>
<span className="text-xs font-bold text-gray-500 dark:text-gray-400">{Math.round(cuePowerRaw * 100)}%</span>
</div>
<input
type="range"
min="0"
max="1"
step="0.05"
value={cuePowerRaw}
onChange={e => setCuePowerRaw(parseFloat(e.target.value))}
className="w-full accent-[#dd9933] mt-2"
/>
</div>
)}
</div>
</div>
)}

{/* DETAIL CARD FULL */}
{detailOpen && detailCoin && (
<div
className="absolute inset-0 z-[80] flex items-center justify-center bg-black/55"
onMouseDown={() => setDetailOpen(false)}
>
<div
key={detailAnimKey}
className="w-[92vw] max-w-[760px] rounded-2xl border border-gray-200 dark:border-white/10 bg-white/95 dark:bg-black/80 backdrop-blur-md shadow-2xl p-5 animate-[dropin_0.28s_ease-out]"
onMouseDown={(e) => e.stopPropagation()}
>
<style>
{`@keyframes dropin{0%{transform:translateY(-18px) scale(0.96);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}`}
</style>

<div className="flex items-start justify-between gap-4">
<div className="flex items-center gap-3">
<img src={detailCoin.image} alt={detailCoin.name} className="w-12 h-12 rounded-full" />
<div>
<div className="text-lg font-black leading-tight">{detailCoin.name}</div>
<div className="text-xs font-bold text-gray-500 dark:text-gray-400">
{detailCoin.symbol?.toUpperCase()} • Rank #{detailCoin.market_cap_rank ?? '-'}
</div>
</div>
</div>

<button
onClick={() => setDetailOpen(false)}
className="p-2 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 border border-gray-200 dark:border-white/10"
title="Fechar"
>
<CloseIcon size={18} />
</button>
</div>

<div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
<div className="rounded-xl p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
<div className="text-xs font-black text-gray-500 dark:text-gray-400 mb-2">Detalhes</div>

<div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
<div className="text-gray-500 dark:text-gray-400 font-bold">Preço</div>
<div className="font-black">{formatPrice(detailCoin.current_price)}</div>

<div className="text-gray-500 dark:text-gray-400 font-bold">Market Cap</div>
<div className="font-black">{formatCompact(detailCoin.market_cap)}</div>

<div className="text-gray-500 dark:text-gray-400 font-bold">Volume 24h</div>
<div className="font-black">{formatCompact(detailCoin.total_volume)}</div>

<div className="text-gray-500 dark:text-gray-400 font-bold">High 24h</div>
<div className="font-black">{formatPrice((detailCoin as any).high_24h)}</div>

<div className="text-gray-500 dark:text-gray-400 font-bold">Low 24h</div>
<div className="font-black">{formatPrice((detailCoin as any).low_24h)}</div>

<div className="text-gray-500 dark:text-gray-400 font-bold">ATH</div>
<div className="font-black">{formatPrice((detailCoin as any).ath)}</div>

<div className="text-gray-500 dark:text-gray-400 font-bold">ATL</div>
<div className="font-black">{formatPrice((detailCoin as any).atl)}</div>

<div className="text-gray-500 dark:text-gray-400 font-bold">Supply</div>
<div className="font-black">{Number((detailCoin as any).circulating_supply || 0).toLocaleString()}</div>
</div>
</div>

<div className="rounded-xl p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
<div className="text-xs font-black text-gray-500 dark:text-gray-400 mb-2">Variações</div>

<div className="flex items-center justify-between text-sm">
<div className="font-bold text-gray-500 dark:text-gray-400">1h</div>
<div className="font-black" style={{ color: perfColor(detailPerf1h?.pct) }}>{(detailPerf1h?.pct ?? 0).toFixed(2)}%</div>
</div>
<div className="flex items-center justify-between text-sm mt-2">
<div className="font-bold text-gray-500 dark:text-gray-400">24h</div>
<div className="font-black" style={{ color: perfColor(detailPerf24?.pct) }}>{(detailPerf24?.pct ?? 0).toFixed(2)}%</div>
</div>
<div className="flex items-center justify-between text-sm mt-2">
<div className="font-bold text-gray-500 dark:text-gray-400">7d</div>
<div className="font-black" style={{ color: perfColor(detailPerf7d?.pct) }}>{(detailPerf7d?.pct ?? 0).toFixed(2)}%</div>
</div>

<div className="mt-4 flex items-center gap-3">
{siteSocials.map(s => {
const Icon = s.icon;
return (
<a
key={s.name}
href={s.href}
target="_blank"
rel="noreferrer"
className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-xs font-black"
>
<Icon size={14} />
<span>{s.name}</span>
</a>
);
})}
</div>
</div>

<div className="md:col-span-2 rounded-xl p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
<div className="flex items-center justify-between">
<div className="text-xs font-black text-gray-500 dark:text-gray-400">Magazine</div>

<div className="flex items-center gap-2">
<button
onClick={() => setMagIndex(i => (i - 1 + Math.max(1, magSlides.length)) % Math.max(1, magSlides.length))}
className="px-3 py-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-xs font-black"
disabled={magSlides.length <= 1}
>
◀
</button>
<button
onClick={() => setMagIndex(i => (i + 1) % Math.max(1, magSlides.length))}
className="px-3 py-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-xs font-black"
disabled={magSlides.length <= 1}
>
▶
</button>
</div>
</div>

<div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
{(magSlides[magIndex] ?? []).map(p => (
<a
key={p.id}
href={p.link}
target="_blank"
rel="noreferrer"
className="group rounded-xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors overflow-hidden"
>
<div className="h-24 w-full bg-black/5 dark:bg-white/5">
{p.image ? (
<img src={p.image} alt={p.title} className="w-full h-full object-cover" />
) : (
<div className="w-full h-full flex items-center justify-center text-xs font-black text-gray-500 dark:text-gray-400">Sem imagem</div>
)}
</div>
<div className="p-3">
<div className="text-sm font-black line-clamp-2">{p.title}</div>
<div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{p.excerpt}</div>
</div>
</a>
))}
</div>

{magPosts.length === 0 && (
<div className="mt-2 text-xs font-bold text-gray-500 dark:text-gray-400">
Nenhum post carregado (verifique /2/wp-json/wp/v2/posts).
</div>
)}
</div>
</div>
</div>
</div>
)}

<div ref={stageRef} className="flex-1 w-full relative cursor-crosshair overflow-hidden">
<canvas
ref={canvasRef}
onMouseMove={handleMouseMove}
onMouseDown={(e) => { e.preventDefault(); handleMouseDown(e); }}
onMouseUp={(e) => { e.preventDefault(); handleMouseUp(); }}
onMouseLeave={() => { setHoveredParticle(null); handleMouseUp(); }}
onWheel={handleWheel}
className="absolute inset-0 w-full h-full block"
/>
</div>
</div>
);
};

export default MarketWindSwarm;
