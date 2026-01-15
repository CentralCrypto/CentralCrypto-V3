
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

// audio
const SFX_CUE_HIT = '/widgets/sfx-cue-hit.wav';
const SFX_POCKET = '/widgets/sfx-pocket.wav';

// GAME CONFIG
const GAME_BALL_RADIUS = 26;
const GAME_CUE_RADIUS = 34;
const GAME_WALL_PAD = 14;

const GAME_LINEAR_DAMP = 0.962;
const GAME_STOP_EPS = 1.6;

// FREE MODE physics
const FREE_LINEAR_DAMP = 0.992;
const FREE_MAX_SPEED = 420;
const FREE_REPULSE = 0.95;

// Transform
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

// GAME: agora é “bolas alvo” (exclui o BTC bola branca)
const [gameBalls, setGameBalls] = useState(12);

const [floatStrengthRaw, setFloatStrengthRaw] = useState(1.0);
const [trailLength, setTrailLength] = useState(25);

// base power (continua existindo como ajuste fino)
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

// ====== GAME 2-CLICK MECHANIC (NOVA) ======
// phase 0: mira livre (segue mouse)
// phase 2: mira travada (1º clique)
// phase 3: puxando taco (2º clique segurando + arrastando)
const gameCtlRef = useRef<{
phase: 0 | 2 | 3;
aimX: number; aimY: number;
powerPull: number;
}>({ phase: 0, aimX: 0, aimY: 0, powerPull: 0 });

const cueHideUntilRef = useRef<number>(0);
const pointerDownRef = useRef(false);

// ===== Helpers: coordinate transforms =====
const screenToWorld = (clientX: number, clientY: number) => {
const canvas = canvasRef.current;
if (!canvas) return { x: 0, y: 0, mx: 0, my: 0 };
const rect = canvas.getBoundingClientRect();
const mx = clientX - rect.left;
const my = clientY - rect.top;

const { k, x, y } = transformRef.current;
return {
x: (mx - x) / k,
y: (my - y) / k,
mx,
my
};
};

const getBgCss = useCallback(() => {
if (isGameMode) return (isDark ? '#08110c' : '#e8f3ea');
return (isDark ? '#0b0f14' : '#ffffff');
}, [isDark, isGameMode]);

// ===== audio =====
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
pointerDownRef.current = false;
}
};
window.addEventListener('keydown', onKey);
return () => window.removeEventListener('keydown', onKey);
}, []);

// ===== Data loading =====
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

// ===== Transform animation =====
const animateTransformTo = useCallback((to: Transform, dur = 0.35) => {
tweenRef.current = { active: true, from: { ...transformRef.current }, to, t: 0, dur };
}, []);

const resetZoom = useCallback(() => {
gameCtlRef.current.phase = 0;
gameCtlRef.current.powerPull = 0;
pointerDownRef.current = false;

if (draggedParticleRef.current) {
draggedParticleRef.current.isFixed = false;
draggedParticleRef.current = null;
}
isPanningRef.current = false;

animateTransformTo({ k: 1, x: 0, y: 0 }, 0.35);
}, [animateTransformTo]);

// Reset “de verdade”: também sai do Modo Livre pro início do gráfico (MAPA)
const handleResetAll = useCallback(() => {
resetZoom();
setDetailOpen(false);
setSelectedParticle(null);
setHoveredParticle(null);
setSearchTerm('');

if (isFreeMode) setIsFreeMode(false);

// no game, reset vira “re-rack” (não tira game)
if (isGameMode) {
setTimeout(() => {
setupGameLayout();
}, 0);
} else {
setTimeout(() => {
computeMapTargets();
}, 0);
}
}, [resetZoom, isFreeMode, isGameMode]);

// ===== Metrics =====
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

// ===== Stats + targets =====
const recomputeStatsAndTargets = useCallback((coinsList: ApiCoin[], mode: ChartMode) => {
const effectiveNum = isGameMode ? Math.min(50, gameBalls + 1) : numCoins;
const topCoins = coinsList.slice(0, effectiveNum);
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
}, [getCoinPerfPct, sizeMetricPerf, sizeLogScale, numCoins, isGameMode, gameBalls]);

// ===== Map targets (world coords = "map space") =====
const computeMapTargets = useCallback(() => {
if (!statsRef.current) return;
const canvas = canvasRef.current;
if (!canvas) return;

const dpr = dprRef.current || 1;
const width = canvas.width / dpr;
const height = canvas.height / dpr;
const s = statsRef.current;

const margin = { top: 18, right: 18, bottom: 92, left: 86 };
const chartW = Math.max(50, width - margin.left - margin.right);
const chartH = Math.max(50, height - margin.top - margin.bottom);

const originX = margin.left;
const originY = margin.top + chartH;

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

const projectY = (v: number) => {
if (v <= 0) return originY;
const norm = (Math.log10(v) - s.logMinY) / (s.logMaxY - s.logMinY || 1);
return margin.top + (1 - norm) * chartH;
};

for (const p of particlesRef.current) {
const yVal = Math.max(1, Number(p.coin.total_volume) || 1);
let xVal = 0;

if (chartMode === 'performance') xVal = getCoinPerfPct(p.coin) || 0;
else xVal = Math.max(1, Number(p.coin.market_cap) || 1);

const tx = projectX(xVal);
const ty = projectY(yVal);

// transição suave SEM “flash”: parte sempre da posição atual
p.mapFromX = p.x;
p.mapFromY = p.y;
p.mapToX = tx;
p.mapToY = ty;
p.mapT = 0;
}
}, [chartMode, getCoinPerfPct]);

// ===== Game layout =====
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
p.mass = Math.max(1, p.targetRadius);
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

// rack triangular
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

// reset controls
gameCtlRef.current.phase = 0;
gameCtlRef.current.powerPull = 0;

// inicializa mira livre no centro pra não “pular”
gameCtlRef.current.aimX = w * 0.5;
gameCtlRef.current.aimY = h * 0.5;

cueHideUntilRef.current = 0;
pointerDownRef.current = false;
}, []);

// ===== Magazine fetch =====
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
} catch {}
}, []);

useEffect(() => { void fetchMagazine(); }, [fetchMagazine]);

useEffect(() => {
// keep magIndex valid always
const slides = Math.max(1, Math.ceil((magPosts.length || 0) / 3));
setMagIndex(i => clamp(i, 0, slides - 1));
}, [magPosts]);

// ===== Init + resize =====
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

// IMPORTANTE: setar background CSS evita “flash preto” quando canvas é recriado/limpo
canvas.style.background = getBgCss();

canvas.width = Math.max(1, Math.floor(cssW * ratio));
canvas.height = Math.max(1, Math.floor(cssH * ratio));
canvas.style.width = `${cssW}px`;
canvas.style.height = `${cssH}px`;

// pinta imediatamente 1 frame “seguro” depois do resize (evita flash)
const ctx = canvas.getContext('2d');
if (ctx) {
ctx.setTransform(1, 0, 0, 1, 0, 0);
ctx.fillStyle = getBgCss();
ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// do not recompute map targets in game/free
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
}, [loadData, computeMapTargets, isGameMode, isFreeMode, getBgCss]);

// ===== Build particles (but DO NOT rebuild in game, or it "resets from beyond") =====
useEffect(() => {
const effectiveNum = isGameMode ? Math.min(50, gameBalls + 1) : numCoins;
const topCoins = coins.slice(0, effectiveNum);
if (topCoins.length === 0) return;

for (const c of topCoins) {
if (c?.image && !imageCache.current.has(c.image)) {
const img = new Image();
img.src = c.image;
imageCache.current.set(c.image, img);
}
}

if (isGameMode) {
// update coin data on existing particles only
const map = new Map<string, ApiCoin>(topCoins.map(c => [c.id, c]));
for (const p of particlesRef.current) {
const up = map.get(p.id);
if (up) p.coin = up;
}
return;
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

recomputeStatsAndTargets(coins, chartMode);
if (!isFreeMode) computeMapTargets();
}, [coins, numCoins, gameBalls, recomputeStatsAndTargets, chartMode, isGameMode, isFreeMode, computeMapTargets]);

useEffect(() => {
if (coins.length === 0) return;
if (isGameMode) return;
recomputeStatsAndTargets(coins, chartMode);
if (!isFreeMode) computeMapTargets();
}, [chartMode, timeframe, coins, recomputeStatsAndTargets, isGameMode, isFreeMode, computeMapTargets]);

// ===== Mode toggles =====
useEffect(() => {
if (isGameMode) {
resetZoom();
setDetailOpen(false);
setSelectedParticle(null);
setHoveredParticle(null);

setIsFreeMode(false);

// inicia SEMPRE com 12 bolas no game
setGameBalls(12);

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

if (!isFreeMode) computeMapTargets();
}
}, [isGameMode]);

useEffect(() => {
// FREE MODE must "release from current position", no snap recalcs
if (isFreeMode) {
for (const p of particlesRef.current) {
p.mapT = 1;
p.mapFromX = p.x;
p.mapFromY = p.y;
p.mapToX = p.x;
p.mapToY = p.y;
}
}
}, [isFreeMode]);

useEffect(() => {
// quando sair do free mode: recalcula targets e faz transição suave (sem flash)
if (!isFreeMode && !isGameMode && coins.length) {
recomputeStatsAndTargets(coins, chartMode);
computeMapTargets();
}
}, [isFreeMode, isGameMode, coins, chartMode, recomputeStatsAndTargets, computeMapTargets]);

// ===== UI helpers =====
const openDetailFor = (p: Particle) => {
setSelectedParticle(p);
setDetailCoin(p.coin);
setDetailAnimKey(k => k + 1);
setDetailOpen(true);
};

const handlePointerMove = (e: React.PointerEvent) => {
const wpos = screenToWorld(e.clientX, e.clientY);
lastMousePosRef.current = { x: wpos.x, y: wpos.y };

if (detailOpenRef.current) return;

// game aiming / power drag
if (isGameMode) {
const cue = particlesRef.current.find(pp => String(pp.coin.id).toLowerCase() === 'bitcoin');
if (!cue || cue.isFalling) return;

// mira SEMPRE acompanha mouse no phase 0 (mira livre)
if (gameCtlRef.current.phase === 0) {
gameCtlRef.current.aimX = wpos.x;
gameCtlRef.current.aimY = wpos.y;
return;
}

// puxando força no phase 3 (segurando)
if (gameCtlRef.current.phase === 3) {
const dx = gameCtlRef.current.aimX - cue.x;
const dy = gameCtlRef.current.aimY - cue.y;
const distDir = Math.hypot(dx, dy) || 0.0001;
const nx = dx / distDir;
const ny = dy / distDir;

// projeção ao longo do eixo do taco: arrastar “pra trás” aumenta força
const along = (wpos.x - cue.x) * nx + (wpos.y - cue.y) * ny;

// distancia mínima -> 1% de força
const pullMax = 240;
const pull = clamp(-along, 0, pullMax);
gameCtlRef.current.powerPull = pull;
return;
}

return;
}

// dragging
if (draggedParticleRef.current) {
const p = draggedParticleRef.current;
p.x = wpos.x;
p.y = wpos.y;
return;
}

if (!isGameMode && isPanningRef.current) {
const dx = e.clientX - panStartRef.current.clientX;
const dy = e.clientY - panStartRef.current.clientY;
transformRef.current.x = panStartRef.current.x + dx;
transformRef.current.y = panStartRef.current.y + dy;
return;
}

const canvas = canvasRef.current;
if (!canvas) return;

const rect = canvas.getBoundingClientRect();
const mx = e.clientX - rect.left;
const my = e.clientY - rect.top;

const { k, x, y } = transformRef.current;

let found: Particle | null = null;
for (let i = particlesRef.current.length - 1; i >= 0; i--) {
const p = particlesRef.current[i];
if (p.isFalling) continue;

const sx = p.x * k + x;
const sy = p.y * k + y;
const sr = p.radius;

const dx = sx - mx;
const dy = sy - my;

if (dx * dx + dy * dy < (sr + 5) * (sr + 5)) {
found = p;
break;
}
}
setHoveredParticle(found);
};

const handlePointerDown = (e: React.PointerEvent) => {
if (detailOpenRef.current) return;
pointerDownRef.current = true;

if (e.button !== 0) return;

if (isGameMode) {
const cue = particlesRef.current.find(pp => String(pp.coin.id).toLowerCase() === 'bitcoin');
if (!cue || cue.isFalling) return;

const w = screenToWorld(e.clientX, e.clientY);

// 1º clique: trava a mira onde está o mouse (phase 0 -> 2)
if (gameCtlRef.current.phase === 0) {
gameCtlRef.current.phase = 2;
gameCtlRef.current.aimX = w.x;
gameCtlRef.current.aimY = w.y;
gameCtlRef.current.powerPull = 0;
return;
}

// 2º clique: segura e arrasta pra trás (phase 2 -> 3)
if (gameCtlRef.current.phase === 2) {
gameCtlRef.current.phase = 3;
gameCtlRef.current.powerPull = 0;
return;
}

return;
}

// non-game: click coin opens detail
if (hoveredParticleRef.current) {
openDetailFor(hoveredParticleRef.current);
return;
}

setDetailOpen(false);
setSelectedParticle(null);

isPanningRef.current = true;
panStartRef.current = {
clientX: e.clientX,
clientY: e.clientY,
x: transformRef.current.x,
y: transformRef.current.y
};
};

const handlePointerUp = useCallback(() => {
if (!pointerDownRef.current) return;
pointerDownRef.current = false;

if (isGameMode) {
const cue = particlesRef.current.find(pp => String(pp.coin.id).toLowerCase() === 'bitcoin');
if (!cue || cue.isFalling) {
gameCtlRef.current.phase = 0;
gameCtlRef.current.powerPull = 0;
return;
}

// soltar no phase 3: dispara tacada
if (gameCtlRef.current.phase === 3) {
const dx = gameCtlRef.current.aimX - cue.x;
const dy = gameCtlRef.current.aimY - cue.y;
const dist = Math.hypot(dx, dy) || 0.0001;

const nx = dx / dist;
const ny = dy / dist;

const pullMax = 240;
const pull = clamp(gameCtlRef.current.powerPull, 0, pullMax);

// distancia mínima vira 1% (não 0)
const pullNorm = clamp(pull / pullMax, 0.01, 1.0);

const basePower = 5200;
const power = basePower * pullNorm * (0.35 + cuePowerRaw * 1.65);

cue.vx += nx * (power / Math.max(1, cue.mass));
cue.vy += ny * (power / Math.max(1, cue.mass));

cueHideUntilRef.current = performance.now() + 5000;
playHit();

gameCtlRef.current.phase = 0;
gameCtlRef.current.powerPull = 0;
return;
}

// se soltou no phase 2, mantém mira travada (ok)
return;
}

if (draggedParticleRef.current) {
draggedParticleRef.current.isFixed = false;
draggedParticleRef.current = null;
}
isPanningRef.current = false;
}, [isGameMode, cuePowerRaw, playHit]);

useEffect(() => {
const up = () => handlePointerUp();
window.addEventListener('pointerup', up);
return () => window.removeEventListener('pointerup', up);
}, [handlePointerUp]);

const handleWheel = (e: React.WheelEvent) => {
e.preventDefault();
if (detailOpenRef.current) return;
if (isGameMode) return;

const canvas = canvasRef.current; if (!canvas) return;
const rect = canvas.getBoundingClientRect();
const mx = e.clientX - rect.left;
const my = e.clientY - rect.top;

const worldX = (mx - transformRef.current.x) / transformRef.current.k;
const worldY = (my - transformRef.current.y) / transformRef.current.k;

const zoomFactor = 1.1;
const oldK = transformRef.current.k;
const newK = e.deltaY < 0 ? oldK * zoomFactor : oldK / zoomFactor;
const clampedK = clamp(newK, 0.1, 10.0);

const newX = mx - worldX * clampedK;
const newY = my - worldY * clampedK;

transformRef.current = { k: clampedK, x: newX, y: newY };
};

const legendText = useMemo(() => {
if (isGameMode) {
return (
<>
<div><span className="font-black">Modo Game (2 cliques)</span></div>
<div>• Mira aparece no mouse; taco acompanha.</div>
<div>• 1º clique: trava a mira.</div>
<div>• 2º clique (segura + arrasta): define força. Soltou: tacada.</div>
<div>• Bolas encaçapadas saem definitivamente.</div>
</>
);
}
if (isFreeMode) {
return (
<>
<div><span className="font-black">Modo Livre</span></div>
<div>• Bolhas flutuam com colisão (não atravessa).</div>
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

const effectiveNumCoins = useMemo(() => (isGameMode ? Math.min(50, gameBalls + 1) : numCoins), [isGameMode, numCoins, gameBalls]);

const siteSocials = useMemo(() => ([
{ name: 'Site', icon: Globe, href: 'https://centralcrypto.com.br' },
{ name: 'RSS', icon: Rss, href: 'https://centralcrypto.com.br/2/feed/' }
]), []);

const magSlides = useMemo(() => {
const out: MagazinePost[][] = [];
for (let i = 0; i < magPosts.length; i += 3) out.push(magPosts.slice(i, i + 3));
return out.length ? out : [[]];
}, [magPosts]);

// ===== RENDER LOOP =====
useEffect(() => {
const canvas = canvasRef.current;

// alpha true + CSS bg = sem “flash preto”
const ctx = canvas?.getContext('2d', { alpha: true });
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

// tween transform
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

// clear background (screen space)
ctx.setTransform(1, 0, 0, 1, 0, 0);
ctx.fillStyle = getBgCss();
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.scale(dpr, dpr);

drawWatermark(ctx, width, height, watermarkRef.current, isDark, isGameMode);

// APPLY WORLD TRANSFORM ONCE
const { k, x: panX, y: panY } = transformRef.current;
ctx.save();
ctx.translate(panX, panY);
ctx.scale(k, k);

const particles = particlesRef.current;

// update radii
for (const p of particles) {
const viewRadius = p.targetRadius * Math.pow(k, 0.25);
p.radius += (viewRadius - p.radius) * 0.15;
p.mass = Math.max(1, p.radius);
}

// pockets + rails (WORLD SPACE)
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
ctx.lineWidth = 4 / k;
ctx.strokeRect(8 / k, 8 / k, (width - 16) / k, (height - 16) / k);
ctx.restore();

ctx.save();
for (const pk of pockets) {
ctx.beginPath();
ctx.arc(pk.x, pk.y, pk.r, 0, Math.PI * 2);
ctx.fillStyle = isDark ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.18)';
ctx.fill();

ctx.beginPath();
ctx.arc(pk.x, pk.y, pk.r, 0, Math.PI * 2);
ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
ctx.lineWidth = 2 / k;
ctx.stroke();
}
ctx.restore();
}

// axes (WORLD SPACE)
if (!isGameMode && !isFreeMode && statsRef.current) {
const s = statsRef.current;
const margin = { top: 18, right: 18, bottom: 92, left: 86 };
const chartW = Math.max(50, width - margin.left - margin.right);
const chartH = Math.max(50, height - margin.top - margin.bottom);
const originX = margin.left;
const originY = margin.top + chartH;

ctx.save();
ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
ctx.lineWidth = 1 / k;
ctx.font = `${12 / k}px Inter`;
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

ctx.beginPath();
ctx.moveTo(worldX, margin.top);
ctx.lineTo(worldX, originY);
ctx.stroke();

ctx.textAlign = 'center';
const label = (chartMode === 'performance') ? `${val.toFixed(1)}%` : formatCompact(val);
ctx.fillText(label, worldX, originY + 18 / k);
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

ctx.beginPath();
ctx.moveTo(originX, worldY);
ctx.lineTo(originX + chartW, worldY);
ctx.stroke();

ctx.textAlign = 'right';
ctx.fillText(formatCompact(val), originX - 10 / k, worldY);
}

ctx.beginPath();
ctx.moveTo(originX, originY);
ctx.lineTo(originX + chartW, originY);
ctx.stroke();

ctx.beginPath();
ctx.moveTo(originX, margin.top);
ctx.lineTo(originX, originY);
ctx.stroke();

ctx.font = `${14 / k}px Inter`;
ctx.textAlign = 'center';
ctx.fillStyle = isDark ? '#dd9933' : '#333';
const xLabel = chartMode === 'performance' ? `Variação ${timeframe} (%)` : 'Market Cap (Log)';
ctx.fillText(xLabel, (width / 2) / k, originY + 56 / k);

ctx.save();
ctx.translate(18 / k, (height / 2) / k);
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

// integra movimento + parede
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

// colisões
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

// checa pockets
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

// anima queda + remove
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
// MAPPED MODE
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

const jitterAmp = 1.6 * floatStrengthRaw;
const jx = Math.sin(now * 0.002 + p.phase) * jitterAmp;
const jy = Math.cos(now * 0.0024 + p.phase) * jitterAmp;

p.x = baseX + jx;
p.y = baseY + jy;
}
}

// DRAW particles (WORLD SPACE)
for (const p of particlesRef.current) {
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
const sx = p.x;
const sy = p.y;

const last = p.trail[p.trail.length - 1];
const ddx = last ? sx - last.x : 10;
const ddy = last ? sy - last.y : 10;

if (!last || (ddx * ddx + ddy * ddy > 4)) p.trail.push({ x: sx, y: sy, age: 1.0 });

for (let tIdx = 0; tIdx < p.trail.length; tIdx++) p.trail[tIdx].age -= 0.02;
p.trail = p.trail.filter(t => t.age > 0);

if (p.trail.length > 1) {
const grad = ctx.createLinearGradient(p.trail[0].x, p.trail[0].y, sx, sy);
grad.addColorStop(0, 'rgba(0,0,0,0)');
grad.addColorStop(1, p.color);

ctx.beginPath();
ctx.moveTo(p.trail[0].x, p.trail[0].y);
for (let i = 1; i < p.trail.length; i++) ctx.lineTo(p.trail[i].x, p.trail[i].y);

ctx.strokeStyle = grad;
ctx.globalAlpha = alpha;
ctx.lineWidth = Math.min(drawRadius * 0.18, 4 / k);
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
ctx.arc(p.x, p.y, drawRadius, 0, Math.PI * 2);

const img = imageCache.current.get(p.coin.image);
if (img?.complete) {
ctx.save();
ctx.clip();
ctx.drawImage(img, p.x - drawRadius, p.y - drawRadius, drawRadius * 2, drawRadius * 2);
ctx.restore();

ctx.strokeStyle = isBTC && isGameMode ? (isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.35)') : p.color;
ctx.lineWidth = (isSelected ? 4 : 2) / k;
ctx.stroke();
} else {
ctx.fillStyle = isBTC && isGameMode ? '#ffffff' : p.color;
ctx.fill();
}

if (!isGameMode && drawRadius > 12) {
ctx.fillStyle = '#fff';
ctx.font = `bold ${Math.max(11, drawRadius * 0.42) / k}px Inter`;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.shadowColor = 'rgba(0,0,0,0.8)';
ctx.shadowBlur = 4 / k;
ctx.fillText(p.coin.symbol.toUpperCase(), p.x, p.y);
ctx.shadowBlur = 0;
}

if (isHovered || isSelected) {
ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)';
ctx.lineWidth = 2 / k;
ctx.beginPath();
ctx.arc(p.x, p.y, drawRadius + 4 / k, 0, Math.PI * 2);
ctx.stroke();
}

ctx.restore();
}

// draw cue + aim marker (game) WORLD SPACE
if (isGameMode) {
const cueBall = particlesRef.current.find(p => String(p.coin.id).toLowerCase() === 'bitcoin');
if (cueBall && now >= cueHideUntilRef.current) {
const cx = cueBall.x;
const cy = cueBall.y;

const aimX = gameCtlRef.current.aimX;
const aimY = gameCtlRef.current.aimY;

const dx = aimX - cx;
const dy = aimY - cy;
const dist = Math.hypot(dx, dy) || 0.0001;
const ux = dx / dist;
const uy = dy / dist;

// pull (phase 3) define a distância do taco
const pull = (gameCtlRef.current.phase === 3) ? gameCtlRef.current.powerPull : 14;

// “vai e vem” suave apenas quando não está puxando
const bob = (gameCtlRef.current.phase === 3) ? 0 : (Math.sin(now * 0.012) * 6);

const contactGap = 12;
const tipX = cx - ux * (cueBall.radius + contactGap + pull + bob);
const tipY = cy - uy * (cueBall.radius + contactGap + pull + bob);

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
ctx.lineWidth = thick / k;
ctx.stroke();

const tipLen = Math.min(30, stickLen * 0.12);
ctx.beginPath();
ctx.moveTo(tipX - ux * tipLen, tipY - uy * tipLen);
ctx.lineTo(tipX, tipY);
ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.78)';
ctx.lineWidth = tipThick / k;
ctx.stroke();

ctx.restore();
}

// mira: aparece SEMPRE (livre ou travada)
{
const sx = gameCtlRef.current.aimX;
const sy = gameCtlRef.current.aimY;

const locked = (gameCtlRef.current.phase === 2 || gameCtlRef.current.phase === 3);
const pulse = locked ? (1 + Math.sin(now * 0.012) * 0.12) : 1;

ctx.save();
ctx.globalAlpha = locked ? 0.9 : 0.65;
ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)';
ctx.lineWidth = 2 / k;

ctx.beginPath();
ctx.arc(sx, sy, (12 * pulse) / k, 0, Math.PI * 2);
ctx.stroke();

ctx.beginPath();
ctx.moveTo(sx - 18 / k, sy);
ctx.lineTo(sx + 18 / k, sy);
ctx.stroke();

ctx.beginPath();
ctx.moveTo(sx, sy - 18 / k);
ctx.lineTo(sx, sy + 18 / k);
ctx.stroke();

ctx.restore();
}
}

// restore from world transform
ctx.restore();

// ===== POWER HUD flutuante (screen space) =====
if (isGameMode) {
const cueBall = particlesRef.current.find(p => String(p.coin.id).toLowerCase() === 'bitcoin');
if (cueBall && now >= cueHideUntilRef.current) {
const { k: zk, x: zx, y: zy } = transformRef.current;

const cxS = cueBall.x * zk + zx;
const cyS = cueBall.y * zk + zy;

const pullMax = 240;
const pull = clamp(gameCtlRef.current.powerPull, 0, pullMax);
const pct = Math.round(clamp(pull / pullMax, 0.01, 1) * 100);

// só mostra forte quando está puxando
const show = (gameCtlRef.current.phase === 3);

if (show) {
const wBox = 92;
const hBox = 34;
const bx = cxS + 18;
const by = cyS - 58;

ctx.save();
ctx.setTransform(1, 0, 0, 1, 0, 0);
ctx.globalAlpha = 0.92;

ctx.fillStyle = isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.78)';
ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)';
ctx.lineWidth = 1;

const r = 10;
ctx.beginPath();
ctx.moveTo(bx + r, by);
ctx.lineTo(bx + wBox - r, by);
ctx.quadraticCurveTo(bx + wBox, by, bx + wBox, by + r);
ctx.lineTo(bx + wBox, by + hBox - r);
ctx.quadraticCurveTo(bx + wBox, by + hBox, bx + wBox - r, by + hBox);
ctx.lineTo(bx + r, by + hBox);
ctx.quadraticCurveTo(bx, by + hBox, bx, by + hBox - r);
ctx.lineTo(bx, by + r);
ctx.quadraticCurveTo(bx, by, bx + r, by);
ctx.closePath();
ctx.fill();
ctx.stroke();

// barra
const barX = bx + 10;
const barY = by + 20;
const barW = wBox - 20;
const barH = 6;

ctx.fillStyle = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.10)';
ctx.fillRect(barX, barY, barW, barH);

ctx.fillStyle = '#dd9933';
ctx.fillRect(barX, barY, barW * (pct / 100), barH);

ctx.fillStyle = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.78)';
ctx.font = `bold 12px Inter`;
ctx.textAlign = 'left';
ctx.textBaseline = 'middle';
ctx.fillText(`Força ${pct}%`, barX, by + 12);

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
playPocket,
getBgCss
]);

// ===== UI derived options =====
const gameBallOptions = useMemo(() => [12, 18, 24], []);
const normalCoinOptions = useMemo(() => [50, 100, 150, 200, 250], []);

return (
<div
ref={containerRef}
className="fixed inset-0 z-[2000] bg-white dark:bg-[#0b0f14] text-gray-900 dark:text-white flex flex-col overflow-hidden touch-none select-none overscroll-none h-[100dvh]"
>
<div className="flex justify-between items-start p-4 z-20 bg-white/80 dark:bg-black/50 backdrop-blur-sm border-b border-gray-200 dark:border-white/10 shrink-0">
<div className="flex items-center justify-between w-full">
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
<div className="text-[11px] font-black text-gray-500 dark:text-gray-400">Bolas fora</div>
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
</div>

<div className="flex items-center gap-2 bg-gray-100 dark:bg-black/50 p-2 rounded-lg border border-gray-200 dark:border-white/10">
<Coins size={16} className="text-gray-400" />

{isGameMode ? (
<select
value={gameBalls}
onChange={e => setGameBalls(parseInt(e.target.value))}
className="bg-white dark:bg-[#2f3032] text-gray-900 dark:text-gray-100 px-2 py-1 rounded text-xs font-black border border-gray-200 dark:border-white/10 outline-none"
>
{gameBallOptions.map(n => (
<option key={n} value={n}>{n} bolas</option>
))}
</select>
) : (
<select
value={effectiveNumCoins}
onChange={e => setNumCoins(parseInt(e.target.value))}
className="bg-white dark:bg-[#2f3032] text-gray-900 dark:text-gray-100 px-2 py-1 rounded text-xs font-black border border-gray-200 dark:border-white/10 outline-none"
>
{normalCoinOptions.map(n => (
<option key={n} value={n}>{n} moedas</option>
))}
</select>
)}
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
onClick={handleResetAll}
className="p-3 bg-[#dd9933]/10 hover:bg-[#dd9933]/20 text-[#dd9933] rounded-lg border border-[#dd9933]/30 transition-colors"
title="Reset"
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
onPointerDown={(e) => e.stopPropagation()}
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

{/* DETAIL CARD SIMPLE LIST */}
{detailOpen && detailCoin && (
<div
className="absolute inset-0 z-[80] flex items-center justify-center bg-black/55"
onPointerDown={() => setDetailOpen(false)}
>
<div
key={detailAnimKey}
className="w-[92vw] max-w-[760px] rounded-2xl border border-gray-200 dark:border-white/10 bg-white/95 dark:bg-black/80 backdrop-blur-md shadow-2xl p-5 animate-[dropin_0.28s_ease-out]"
onPointerDown={(e) => e.stopPropagation()}
>
<style>{`@keyframes dropin{0%{transform:translateY(-18px) scale(0.96);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}`}</style>

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

<div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
<div className="text-sm space-y-2">
<div className="flex justify-between gap-4"><span className="font-bold text-gray-500 dark:text-gray-400">Preço</span><span className="font-black">{formatPrice(detailCoin.current_price)}</span></div>
<div className="flex justify-between gap-4"><span className="font-bold text-gray-500 dark:text-gray-400">Market Cap</span><span className="font-black">{formatCompact(detailCoin.market_cap)}</span></div>
<div className="flex justify-between gap-4"><span className="font-bold text-gray-500 dark:text-gray-400">Volume 24h</span><span className="font-black">{formatCompact(detailCoin.total_volume)}</span></div>
<div className="flex justify-between gap-4"><span className="font-bold text-gray-500 dark:text-gray-400">High 24h</span><span className="font-black">{formatPrice((detailCoin as any).high_24h)}</span></div>
<div className="flex justify-between gap-4"><span className="font-bold text-gray-500 dark:text-gray-400">Low 24h</span><span className="font-black">{formatPrice((detailCoin as any).low_24h)}</span></div>
<div className="flex justify-between gap-4"><span className="font-bold text-gray-500 dark:text-gray-400">ATH</span><span className="font-black">{formatPrice((detailCoin as any).ath)}</span></div>
<div className="flex justify-between gap-4"><span className="font-bold text-gray-500 dark:text-gray-400">ATL</span><span className="font-black">{formatPrice((detailCoin as any).atl)}</span></div>
</div>

<div className="text-sm space-y-2">
<div className="flex justify-between gap-4"><span className="font-bold text-gray-500 dark:text-gray-400">1h</span><span className="font-black" style={{ color: perfColor(detailPerf1h?.pct) }}>{(detailPerf1h?.pct ?? 0).toFixed(2)}%</span></div>
<div className="flex justify-between gap-4"><span className="font-bold text-gray-500 dark:text-gray-400">24h</span><span className="font-black" style={{ color: perfColor(detailPerf24?.pct) }}>{(detailPerf24?.pct ?? 0).toFixed(2)}%</span></div>
<div className="flex justify-between gap-4"><span className="font-bold text-gray-500 dark:text-gray-400">7d</span><span className="font-black" style={{ color: perfColor(detailPerf7d?.pct) }}>{(detailPerf7d?.pct ?? 0).toFixed(2)}%</span></div>

<div className="pt-2 flex items-center gap-2">
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

<div className="md:col-span-2 pt-2">
<div className="flex items-center justify-between">
<div className="text-xs font-black text-gray-500 dark:text-gray-400">Magazine</div>
<div className="flex items-center gap-2">
<button
onClick={() => setMagIndex(i => (i - 1 + magSlides.length) % magSlides.length)}
className="px-3 py-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-xs font-black"
disabled={magSlides.length <= 1}
>
◀
</button>
<button
onClick={() => setMagIndex(i => (i + 1) % magSlides.length)}
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
onPointerMove={handlePointerMove}
onPointerDown={(e) => { e.preventDefault(); handlePointerDown(e); }}
onPointerLeave={() => { setHoveredParticle(null); handlePointerUp(); }}
onWheel={handleWheel}
className="absolute inset-0 w-full h-full block"
/>
</div>
</div>
);
};

export default MarketWindSwarm;
