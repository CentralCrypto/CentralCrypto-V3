import * as React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ApiCoin, Language } from '../../../types';
import { Search, XCircle, Settings, Droplets, X as CloseIcon, Atom, Coins, Maximize, Wind, Info } from 'lucide-react';
import { fetchTopCoins } from '../services/api';

interface Particle {
id: string;
x: number; y: number;
vx: number; vy: number;
radius: number;
targetRadius: number;
color: string;
coin: ApiCoin;
trail: { x: number, y: number, age: number }[];
phase: number;
isFixed?: boolean;
mass: number;

isFalling?: boolean;
fallT?: number;
fallPocket?: { x: number; y: number; r: number } | null;
fallFromX?: number;
fallFromY?: number;
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

// ========================
// WATERMARK CONFIG
// ========================
const WATERMARK_LOCAL = '/logo2-transp.png';
const WATERMARK_REMOTE = '';

// ========================
// GAME CONFIG
// ========================
const GAME_BALL_RADIUS = 26;
const GAME_CUE_RADIUS = 34;
const GAME_WALL_PAD = 14;

// AIMING (2-CLICK)
type AimPhase = 'idle' | 'aiming' | 'powering_ready' | 'powering';

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
const chartModeRef = useRef<ChartMode>('performance');
chartModeRef.current = chartMode;

const [timeframe, setTimeframe] = useState<Timeframe>('24h');

const [settingsOpen, setSettingsOpen] = useState(false);
const [legendTipOpen, setLegendTipOpen] = useState(false);

const [isGameMode, setIsGameMode] = useState(false);
const [isFreeMode, setIsFreeMode] = useState(false);

// MAP count (quando não for game)
const [numCoins, setNumCoins] = useState(50);

// GAME count (bolas alvo: 10/20/30). BTC é a branca.
const [gameBallsCount, setGameBallsCount] = useState(20);

// default 100%
const [floatStrengthRaw, setFloatStrengthRaw] = useState(1.0);
const [trailLength, setTrailLength] = useState(25);

// força base (só aparece no game)
const [cuePowerRaw, setCuePowerRaw] = useState(0.7);

const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

const [detailOpen, setDetailOpen] = useState(false);
const [detailCoin, setDetailCoin] = useState<ApiCoin | null>(null);
const [detailAnimKey, setDetailAnimKey] = useState(0);

// contador de encaçapadas (só game)
const [pottedCount, setPottedCount] = useState(0);

// Transform
const transformRef = useRef({ k: 1, x: 0, y: 0 });
const isPanningRef = useRef(false);
const panStartRef = useRef({ clientX: 0, clientY: 0, x: 0, y: 0 });
const draggedParticleRef = useRef<Particle | null>(null);
const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

const invalidateRef = useRef(0);
const invalidate = useCallback(() => { invalidateRef.current++; }, []);

const aimingRef = useRef<{
phase: AimPhase;
cueX: number;
cueY: number;
dirX: number;
dirY: number;
targetX: number;
targetY: number;
pull: number;
powerStartX: number;
powerStartY: number;
maxPull: number;
}>({
phase: 'idle',
cueX: 0,
cueY: 0,
dirX: 1,
dirY: 0,
targetX: 0,
targetY: 0,
pull: 0,
powerStartX: 0,
powerStartY: 0,
maxPull: 220
});

const cueHideUntilRef = useRef<number>(0);

// “thrust” curto do taco ao bater
const cueThrustRef = useRef<{ t0: number; active: boolean }>({ t0: 0, active: false });

const watermarkRef = useRef<HTMLImageElement | null>(null);

const statsRef = useRef<{
minX: number, maxX: number,
minY: number, maxY: number,
minR: number, maxR: number,
logMinX: number, logMaxX: number,
logMinY: number, logMaxY: number,
maxMc: number
} | null>(null);

const hoveredParticleRef = useRef(hoveredParticle);
hoveredParticleRef.current = hoveredParticle;

const selectedParticleRef = useRef(selectedParticle);
selectedParticleRef.current = selectedParticle;

const detailOpenRef = useRef(detailOpen);
detailOpenRef.current = detailOpen;

// WebAudio “se der”
const audioRef = useRef<AudioContext | null>(null);
const playBeep = useCallback((type: 'hit' | 'pocket') => {
try {
if (!audioRef.current) audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
const ctx = audioRef.current;
if (!ctx) return;

const now = ctx.currentTime;
const osc = ctx.createOscillator();
const gain = ctx.createGain();

osc.type = 'sine';
osc.frequency.value = type === 'hit' ? 180 : 520;

gain.gain.setValueAtTime(0.0001, now);
gain.gain.exponentialRampToValueAtTime(type === 'hit' ? 0.08 : 0.06, now + 0.01);
gain.gain.exponentialRampToValueAtTime(0.0001, now + (type === 'hit' ? 0.09 : 0.12));

osc.connect(gain);
gain.connect(ctx.destination);

osc.start(now);
osc.stop(now + (type === 'hit' ? 0.10 : 0.13));
} catch {
}
}, []);

// lock scroll
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

aimingRef.current.phase = 'idle';
aimingRef.current.pull = 0;

if (draggedParticleRef.current) {
draggedParticleRef.current.isFixed = false;
draggedParticleRef.current = null;
}
isPanningRef.current = false;
}
};
window.addEventListener('keydown', onKey);
return () => window.removeEventListener('keydown', onKey);
}, []);

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

const resetZoom = useCallback(() => {
transformRef.current = { k: 1, x: 0, y: 0 };
invalidate();
}, [invalidate]);

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

const getCoinPerf = useCallback((coin: any) => computeSparkChange(coin, timeframe), [timeframe]);
const getCoinPerfPct = useCallback((coin: any) => getCoinPerf(coin).pct, [getCoinPerf]);
const getCoinAbsPct = useCallback((coin: any) => getCoinPerf(coin).absPct, [getCoinPerf]);

const sizeMetricPerf = useCallback((coin: any) => {
const absPct = Math.max(0, getCoinAbsPct(coin));
const vol = Math.max(0, Number(coin?.total_volume) || 0);
const volFactor = Math.log10(vol + 1);
return absPct * volFactor;
}, [getCoinAbsPct]);

const computeTargetRadius = useCallback((
coin: any,
mode: ChartMode,
minR: number,
maxR: number,
maxMc: number
) => {
let metric = 1;

if (mode === 'performance') metric = Math.max(0.000001, sizeMetricPerf(coin));
else metric = Math.max(1, Number(coin?.market_cap) || 1);

const rank = Number(coin?.market_cap_rank) || 99999;

if (mode === 'valuation') {
const mc = Math.max(1, Number(coin?.market_cap) || 1);

const logMin = Math.log10(Math.max(1, minR));
const logMax = Math.log10(Math.max(1, maxR));
const tLog = clamp((Math.log10(mc) - logMin) / (logMax - logMin || 1), 0, 1);

const topN = 12;
const tTop = clamp(Math.sqrt(mc / Math.max(1, maxMc)), 0, 1);
const wTop = rank <= topN ? (1 - (rank - 1) / (topN - 1)) : 0;
const t = clamp((tLog * (1 - 0.55 * wTop)) + (tTop * (0.55 * wTop)), 0, 1);

return 22 + t * 95;
}

const t = clamp((metric - minR) / (maxR - minR || 1), 0, 1);
return 15 + t * 70;
}, [sizeMetricPerf]);

const recomputeStatsAndTargets = useCallback((coinsList: ApiCoin[], mode: ChartMode) => {
let topCoins: ApiCoin[] = [];

if (isGameMode) {
const btc = coinsList.find(c => String(c.id).toLowerCase() === 'bitcoin');
const others = coinsList.filter(c => String(c.id).toLowerCase() !== 'bitcoin');
const need = Math.min(50, Math.max(10, gameBallsCount)) ; // bolas alvo (10/20/30), max 50
topCoins = [
...(btc ? [btc] : []),
...others.slice(0, need)
];
} else {
topCoins = coinsList.slice(0, numCoins);
}

if (topCoins.length === 0) return;

const xData: number[] = [];
const yData: number[] = [];
const rData: number[] = [];
let maxMc = 1;

for (const c of topCoins) {
const vol = Math.max(1, Number(c.total_volume) || 1);
yData.push(vol);

if (mode === 'performance') {
const x = getCoinPerfPct(c) || 0;
xData.push(x);
rData.push(Math.max(0.000001, sizeMetricPerf(c)));
} else {
const mc = Math.max(1, Number(c.market_cap) || 1);
maxMc = Math.max(maxMc, mc);
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
logMaxY: Math.log10(Math.max(1, maxY)),
maxMc
};

const coinMap = new Map<string, ApiCoin>(topCoins.map(c => [c.id, c]));
for (const p of particlesRef.current) {
const updated = coinMap.get(p.id);
if (updated) p.coin = updated;

const pct = getCoinPerfPct(p.coin) || 0;
const baseColor = pct >= 0 ? '#089981' : '#f23645';
const isBTC = String(p.coin.id).toLowerCase() === 'bitcoin';

const targetRadius = !isGameMode
? computeTargetRadius(p.coin, mode, minR, maxR, maxMc)
: p.targetRadius;

if (!isGameMode) {
p.targetRadius = targetRadius;
p.mass = Math.max(1, p.targetRadius);
}

p.color = isBTC ? '#ffffff' : baseColor;
}
}, [getCoinPerfPct, numCoins, sizeMetricPerf, isGameMode, computeTargetRadius, gameBallsCount]);

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
}, []);

const snapBackToMap = useCallback(() => {
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
if (chartModeRef.current === 'valuation') {
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
p.vx = 0;
p.vy = 0;
p.trail = [];
p.isFixed = false;
p.isFalling = false;
p.fallT = 0;
p.fallPocket = null;

const yVal = Math.max(1, Number(p.coin.total_volume) || 1);
let xVal = 0;

if (chartModeRef.current === 'performance') xVal = getCoinPerfPct(p.coin) || 0;
else xVal = Math.max(1, Number(p.coin.market_cap) || 1);

p.x = projectX(xVal);
p.y = projectY(yVal);
}
}, [getCoinPerfPct]);

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
}, [loadData]);

useEffect(() => {
const up = () => handleMouseUp();
window.addEventListener('mouseup', up);
return () => window.removeEventListener('mouseup', up);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

useEffect(() => {
// ✅ regra de exclusão
if (isGameMode) setIsFreeMode(false);
}, [isGameMode]);

// enter/exit game
useEffect(() => {
if (isGameMode) {
resetZoom();
setSettingsOpen(false);
setLegendTipOpen(false);
setHoveredParticle(null);
setSelectedParticle(null);

aimingRef.current.phase = 'idle';
aimingRef.current.pull = 0;
cueHideUntilRef.current = 0;

setPottedCount(0); // zera placar ao entrar
setupGameLayout();
} else {
resetZoom();
setSettingsOpen(false);
setLegendTipOpen(false);

aimingRef.current.phase = 'idle';
aimingRef.current.pull = 0;

if (draggedParticleRef.current) {
draggedParticleRef.current.isFixed = false;
draggedParticleRef.current = null;
}

snapBackToMap();
}
}, [isGameMode, resetZoom, setupGameLayout, snapBackToMap]);

const buildParticleSet = useCallback(() => {
if (coins.length === 0) return;

let pick: ApiCoin[] = [];

if (isGameMode) {
const btc = coins.find(c => String(c.id).toLowerCase() === 'bitcoin');
const others = coins.filter(c => String(c.id).toLowerCase() !== 'bitcoin');

const wantTargets = Math.min(50, Math.max(10, gameBallsCount));
pick = [
...(btc ? [btc] : []),
...others.slice(0, wantTargets)
];
} else {
pick = coins.slice(0, numCoins);
}

if (pick.length === 0) return;

for (const c of pick) {
if (c?.image && !imageCache.current.has(c.image)) {
const img = new Image();
img.src = c.image;
imageCache.current.set(c.image, img);
}
}

const existingMap = new Map<string, Particle>(particlesRef.current.map(p => [p.id, p]));
const w = stageRef.current?.clientWidth || 1000;
const h = stageRef.current?.clientHeight || 800;

const newParticles: Particle[] = pick.map(coin => {
const existing = existingMap.get(coin.id);
if (existing) { existing.coin = coin; return existing; }

return {
id: coin.id,
x: Math.random() * w,
y: Math.random() * h,
vx: (Math.random() - 0.5) * 90,
vy: (Math.random() - 0.5) * 90,
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
fallPocket: null
};
});

particlesRef.current = newParticles;
recomputeStatsAndTargets(coins, chartModeRef.current);
}, [coins, numCoins, recomputeStatsAndTargets, isGameMode, gameBallsCount]);

useEffect(() => {
buildParticleSet();
}, [buildParticleSet]);

useEffect(() => {
if (coins.length === 0) return;
recomputeStatsAndTargets(coins, chartMode);
}, [chartMode, timeframe, coins, recomputeStatsAndTargets]);

const hitTestParticle = useCallback((clientX: number, clientY: number) => {
const canvasEl = canvasRef.current;
if (!canvasEl) return null;

const rect = canvasEl.getBoundingClientRect();
const mouseX = clientX - rect.left;
const mouseY = clientY - rect.top;

const { k, x, y } = transformRef.current;

for (let i = particlesRef.current.length - 1; i >= 0; i--) {
const p = particlesRef.current[i];
if (p.isFalling) continue;

const sx = p.x * k + x;
const sy = p.y * k + y;
const sr = p.radius;

const dx = sx - mouseX;
const dy = sy - mouseY;

if (dx * dx + dy * dy < (sr + 5) * (sr + 5)) return p;
}
return null;
}, []);

const openDetailForParticle = useCallback((p: Particle) => {
setSelectedParticle(p);
setDetailCoin(p.coin);
setDetailAnimKey(v => v + 1);
setDetailOpen(true);
}, []);

const handleMouseMove = (e: React.MouseEvent) => {
const wpos = screenToWorld(e.clientX, e.clientY);
lastMousePosRef.current = { x: wpos.x, y: wpos.y };

if (isGameMode) {
const a = aimingRef.current;

if (a.phase === 'aiming') {
a.targetX = wpos.x;
a.targetY = wpos.y;

const cue = particlesRef.current.find(pp => String(pp.coin.id).toLowerCase() === 'bitcoin');
if (cue && !cue.isFalling) {
const dx = wpos.x - cue.x;
const dy = wpos.y - cue.y;
const dist = Math.hypot(dx, dy) || 0.0001;
a.dirX = dx / dist;
a.dirY = dy / dist;
a.cueX = cue.x;
a.cueY = cue.y;
}
return;
}

if (a.phase === 'powering') {
const mx = wpos.x - a.powerStartX;
const my = wpos.y - a.powerStartY;

const proj = mx * a.dirX + my * a.dirY;
a.pull = clamp(-proj, 0, a.maxPull);
return;
}

return;
}

if (draggedParticleRef.current) {
const p = draggedParticleRef.current;
p.x = wpos.x;
p.y = wpos.y;
return;
}

if (!isGameMode && !isFreeMode && isPanningRef.current) {
const dx = e.clientX - panStartRef.current.clientX;
const dy = e.clientY - panStartRef.current.clientY;
transformRef.current.x = panStartRef.current.x + dx;
transformRef.current.y = panStartRef.current.y + dy;
invalidate();
return;
}

const found = hitTestParticle(e.clientX, e.clientY);
setHoveredParticle(found);
};

const handleMouseDown = (e: React.MouseEvent) => {
// clicar no “vazio” fecha card
if (detailOpenRef.current) {
const found = hitTestParticle(e.clientX, e.clientY);
if (!found) {
setDetailOpen(false);
setSelectedParticle(null);
}
return;
}

const found = hitTestParticle(e.clientX, e.clientY);

if (isGameMode) {
// ✅ card funciona no game: se clicou em bola (qualquer uma) abre card
if (found) {
openDetailForParticle(found);
return;
}

if (e.button !== 0) return;

const cue = particlesRef.current.find(pp => String(pp.coin.id).toLowerCase() === 'bitcoin');
if (!cue || cue.isFalling) return;

const w = screenToWorld(e.clientX, e.clientY);
const a = aimingRef.current;

if (a.phase === 'idle') {
a.phase = 'aiming';
a.cueX = cue.x;
a.cueY = cue.y;

a.targetX = w.x;
a.targetY = w.y;

const dx = w.x - cue.x;
const dy = w.y - cue.y;
const dist = Math.hypot(dx, dy) || 0.0001;
a.dirX = dx / dist;
a.dirY = dy / dist;

a.pull = 0;
setSelectedParticle(cue);
return;
}

if (a.phase === 'powering_ready') {
a.phase = 'powering';
a.powerStartX = w.x;
a.powerStartY = w.y;
return;
}

return;
}

// MAP / FREE
if (found) {
openDetailForParticle(found);
return;
}

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
const a = aimingRef.current;

if (!cue || cue.isFalling) {
a.phase = 'idle';
a.pull = 0;
return;
}

if (a.phase === 'aiming') {
// ✅ mira fica fixa após 1º clique
a.phase = 'powering_ready';
a.pull = 0;
return;
}

if (a.phase === 'powering') {
const pullNorm = clamp(a.pull / a.maxPull, 0, 1);

// ✅ bolas mais leves + tacada mais forte
const basePower = 9800; // era 6800
const power = basePower * (0.25 + cuePowerRaw * 1.85) * pullNorm;

cue.vx += a.dirX * (power / Math.max(1, cue.mass));
cue.vy += a.dirY * (power / Math.max(1, cue.mass));

cueHideUntilRef.current = performance.now() + 5000;

// thrust curto do taco
cueThrustRef.current = { t0: performance.now(), active: true };

// som hit
playBeep('hit');

a.phase = 'idle';
a.pull = 0;
return;
}

return;
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
invalidate();
};

const legendText = useMemo(() => {
if (isGameMode) {
return (
<>
<div><span className="font-black">Modo Game (Bilhar)</span></div>
<div>• Clique numa bola: abre detalhes.</div>
<div>• 1º clique (segura): gira o taco (mira pulse).</div>
<div>• Soltou: direção fixa (mira fica).</div>
<div>• 2º clique (segura): ajusta força (mouse frente/atrás).</div>
<div>• Soltou no 2º clique: tacada.</div>
<div>• Após tacar, o taco some por 5s.</div>
</>
);
}

if (isFreeMode) {
return (
<>
<div><span className="font-black">Modo Livre</span></div>
<div>• Bolhas flutuam soltas.</div>
<div>• Batem e se repelem.</div>
<div>• MarketCap/Variação mudam só o tamanho.</div>
</>
);
}

if (chartMode === 'performance') {
return (
<>
<div><span className="font-black">Modo Variação</span></div>
<div>• X: Variação {timeframe} (%)</div>
<div>• Y: Volume 24h (log)</div>
<div>• Tamanho: |%var| × log(volume)</div>
</>
);
}

return (
<>
<div><span className="font-black">Modo Market Cap</span></div>
<div>• X: Market Cap (log)</div>
<div>• Y: Volume 24h (log)</div>
<div>• Tamanho: Market Cap (log + topo mais proporcional)</div>
</>
);
}, [chartMode, timeframe, isGameMode, isFreeMode]);

const detailPerf = useMemo(() => {
if (!detailCoin) return null;
return computeSparkChange(detailCoin, timeframe);
}, [detailCoin, timeframe]);

const detailColor = useMemo(() => {
if (!detailPerf) return '#dd9933';
return detailPerf.pct >= 0 ? '#089981' : '#f23645';
}, [detailPerf]);

// =======================
// RENDER LOOP
// =======================
useEffect(() => {
const canvas = canvasRef.current;
const ctx = canvas?.getContext('2d', { alpha: false });
if (!ctx || !canvas) return;

const drawWatermark = (
ctx2: CanvasRenderingContext2D,
width: number,
height: number,
img: HTMLImageElement | null,
isDarkTheme: boolean,
isGame: boolean
) => {
if (!img || !img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return;

const maxW = width * 0.78;
const maxH = height * 0.78;
const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);

const w = img.naturalWidth * scale;
const h = img.naturalHeight * scale;

const x = (width - w) / 2;
const y = (height - h) / 2;

const alphaBase = isDarkTheme ? 0.055 : 0.035;
const alpha = isGame ? alphaBase * 0.85 : alphaBase;

ctx2.save();
ctx2.globalAlpha = alpha;
ctx2.imageSmoothingEnabled = true;
ctx2.imageSmoothingQuality = 'high';
ctx2.drawImage(img, x, y, w, h);
ctx2.restore();
};

let lastTime = performance.now();

const resolveCollisions = (list: Particle[], restitution: number) => {
for (let i = 0; i < list.length; i++) {
const p1 = list[i];
if (p1.isFalling) continue;

for (let j = i + 1; j < list.length; j++) {
const p2 = list[j];
if (p2.isFalling) continue;

const dx = p2.x - p1.x;
const dy = p2.y - p1.y;
const minDist = p1.radius + p2.radius;

const distSq = dx * dx + dy * dy;
if (distSq >= minDist * minDist) continue;

const dist = Math.sqrt(distSq) || 0.0001;
const nx = dx / dist;
const ny = dy / dist;

const overlap = (minDist - dist);

const totalMass = (p1.mass + p2.mass) || 1;
const move1 = (p2.mass / totalMass);
const move2 = (p1.mass / totalMass);

if (!p1.isFixed) { p1.x -= nx * overlap * move1; p1.y -= ny * overlap * move1; }
if (!p2.isFixed) { p2.x += nx * overlap * move2; p2.y += ny * overlap * move2; }

const rvx = p2.vx - p1.vx;
const rvy = p2.vy - p1.vy;
const velAlongNormal = rvx * nx + rvy * ny;
if (velAlongNormal > 0) continue;

let impulse = -(1 + restitution) * velAlongNormal;
impulse /= (1 / p1.mass + 1 / p2.mass);

const impulseX = impulse * nx;
const impulseY = impulse * ny;

if (!p1.isFixed) { p1.vx -= impulseX / p1.mass; p1.vy -= impulseY / p1.mass; }
if (!p2.isFixed) { p2.vx += impulseX / p2.mass; p2.vy += impulseY / p2.mass; }
}
}
};

const drawAimMarker = (
ctx2: CanvasRenderingContext2D,
toScreenX: (v: number) => number,
toScreenY: (v: number) => number,
isDarkTheme: boolean,
now: number
) => {
const a = aimingRef.current;
// ✅ mira aparece e fica fixa após 1º clique
if (!(a.phase === 'aiming' || a.phase === 'powering_ready' || a.phase === 'powering')) return;

const sx = toScreenX(a.targetX);
const sy = toScreenY(a.targetY);

// pulse zoom in/out
const pulse = 1 + 0.08 * Math.sin(now * 0.008);

ctx2.save();
ctx2.globalAlpha = 0.92;
ctx2.strokeStyle = isDarkTheme ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.75)';
ctx2.lineWidth = 2;

ctx2.beginPath();
ctx2.arc(sx, sy, 10 * pulse, 0, Math.PI * 2);
ctx2.stroke();

ctx2.beginPath();
ctx2.moveTo(sx - 16 * pulse, sy);
ctx2.lineTo(sx + 16 * pulse, sy);
ctx2.stroke();

ctx2.beginPath();
ctx2.moveTo(sx, sy - 16 * pulse);
ctx2.lineTo(sx, sy + 16 * pulse);
ctx2.stroke();

ctx2.restore();
};

const drawCueStick = (
ctx2: CanvasRenderingContext2D,
cueBall: Particle,
now: number,
toScreenX: (v: number) => number,
toScreenY: (v: number) => number,
k: number,
isDarkTheme: boolean
) => {
if (now < cueHideUntilRef.current) return;

const cx = toScreenX(cueBall.x);
const cy = toScreenY(cueBall.y);

const a = aimingRef.current;

let ux = 1;
let uy = 0;

if (a.phase === 'aiming') {
const dx = toScreenX(a.targetX) - cx;
const dy = toScreenY(a.targetY) - cy;
const dist = Math.hypot(dx, dy) || 0.0001;
ux = dx / dist;
uy = dy / dist;
} else if (a.phase === 'powering_ready' || a.phase === 'powering') {
ux = a.dirX;
uy = a.dirY;
} else if (lastMousePosRef.current) {
const tx = toScreenX(lastMousePosRef.current.x);
const ty = toScreenY(lastMousePosRef.current.y);
const dx = tx - cx;
const dy = ty - cy;
const dist = Math.hypot(dx, dy) || 0.0001;
ux = dx / dist;
uy = dy / dist;
} else {
ux = 1; uy = 0;
}

// ✅ animação idle do taco (pequena)
const idleWiggle = 6 + 4 * Math.sin(now * 0.004);

// pull real no 2º clique
const pull = (a.phase === 'powering' || a.phase === 'powering_ready')
? a.pull
: idleWiggle;

// thrust curto após bater
let thrust = 0;
if (cueThrustRef.current.active) {
const t = (now - cueThrustRef.current.t0) / 120;
if (t >= 1) cueThrustRef.current.active = false;
else thrust = 10 * Math.sin(Math.PI * t);
}

const contactGap = 12;
const tipX = cx - ux * (cueBall.radius + contactGap + pull - thrust);
const tipY = cy - uy * (cueBall.radius + contactGap + pull - thrust);

const stickLen = Math.max(260, cueBall.radius * 7.5);
const buttX = tipX - ux * stickLen;
const buttY = tipY - uy * stickLen;

const thick = Math.max(8, cueBall.radius * 0.40);
const tipThick = Math.max(5, thick * 0.55);

ctx2.save();
ctx2.globalAlpha = 0.92;
ctx2.lineCap = 'round';

ctx2.beginPath();
ctx2.moveTo(buttX, buttY);
ctx2.lineTo(tipX, tipY);
ctx2.strokeStyle = isDarkTheme ? 'rgba(210,170,120,0.78)' : 'rgba(120,85,45,0.72)';
ctx2.lineWidth = thick;
ctx2.stroke();

const tipLen = Math.min(30, stickLen * 0.12);
ctx2.beginPath();
ctx2.moveTo(tipX - ux * tipLen, tipY - uy * tipLen);
ctx2.lineTo(tipX, tipY);
ctx2.strokeStyle = isDarkTheme ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.78)';
ctx2.lineWidth = tipThick;
ctx2.stroke();

ctx2.restore();
};

const loop = () => {
const now = performance.now();
const dtRaw = (now - lastTime) / 1000;
const dt = Math.min(dtRaw, 1 / 30);
lastTime = now;

const dpr = dprRef.current || 1;
const width = canvas.width / dpr;
const height = canvas.height / dpr;

ctx.setTransform(1, 0, 0, 1, 0, 0);

if (isGameMode) ctx.fillStyle = isDark ? '#08110c' : '#e8f3ea';
else ctx.fillStyle = isDark ? '#0b0f14' : '#ffffff';

ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.scale(dpr, dpr);

drawWatermark(ctx, width, height, watermarkRef.current, isDark, isGameMode);

const { k, x: panX, y: panY } = transformRef.current;
const toScreenX = (val: number) => val * k + panX;
const toScreenY = (val: number) => val * k + panY;

const particles: Particle[] = particlesRef.current;

for (const p of particles) {
const viewRadius = p.targetRadius * Math.pow(k, 0.25);
p.radius += (viewRadius - p.radius) * 0.15;
p.mass = Math.max(1, p.radius);
}

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

drawAimMarker(ctx, toScreenX, toScreenY, isDark, now);
}

// =======================
// PHYSICS
// =======================
if (isGameMode) {
const subSteps = 3;
const stepDt = dt / subSteps;

const worldW = width / k;
const worldH = height / k;

// ✅ menos atrito = bolas “leves”
const dampingPerFrame = 0.993;
const stopEps = 0.25;

for (let step = 0; step < subSteps; step++) {
const drag = Math.pow(dampingPerFrame, stepDt * 60);

for (const p of particles) {
if (p.isFalling) continue;
if (p.isFixed) continue;

p.vx *= drag;
p.vy *= drag;

if (Math.hypot(p.vx, p.vy) < stopEps) { p.vx = 0; p.vy = 0; }

p.x += p.vx * stepDt;
p.y += p.vy * stepDt;

if (p.x < p.radius + GAME_WALL_PAD) { p.x = p.radius + GAME_WALL_PAD; p.vx *= -1; }
else if (p.x > worldW - p.radius - GAME_WALL_PAD) { p.x = worldW - p.radius - GAME_WALL_PAD; p.vx *= -1; }

if (p.y < p.radius + GAME_WALL_PAD) { p.y = p.radius + GAME_WALL_PAD; p.vy *= -1; }
else if (p.y > worldH - p.radius - GAME_WALL_PAD) { p.y = worldH - p.radius - GAME_WALL_PAD; p.vy *= -1; }
}

resolveCollisions(particles, 0.965);

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

// ✅ conta só bolas alvo (não a branca)
if (String(p.coin.id).toLowerCase() !== 'bitcoin') {
setPottedCount(v => v + 1);
playBeep('pocket');
}
break;
}
}
}

for (const p of particles) {
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
particlesRef.current = particlesRef.current.filter(pp => pp !== p);
}
}
}
} else if (isFreeMode) {
const subSteps = 2;
const stepDt = dt / subSteps;

const worldW = width / k;
const worldH = height / k;

const maxAmp = 70 * floatStrengthRaw;
const drift = 12 + 58 * floatStrengthRaw;

const drag = Math.pow(0.992, stepDt * 60);

for (let step = 0; step < subSteps; step++) {
for (const p of particles) {
if (p.isFalling) continue;
if (p.isFixed) continue;

const fx = Math.sin(now * 0.00055 + p.phase) * (maxAmp * 0.02);
const fy = Math.cos(now * 0.00050 + p.phase) * (maxAmp * 0.02);

p.vx += fx;
p.vy += fy;

p.vx *= drag;
p.vy *= drag;

const sp = Math.hypot(p.vx, p.vy) || 0.0001;
const maxSp = drift;
if (sp > maxSp) {
p.vx = (p.vx / sp) * maxSp;
p.vy = (p.vy / sp) * maxSp;
}

p.x += p.vx * stepDt;
p.y += p.vy * stepDt;

if (p.x < p.radius + GAME_WALL_PAD) { p.x = p.radius + GAME_WALL_PAD; p.vx *= -1; }
else if (p.x > worldW - p.radius - GAME_WALL_PAD) { p.x = worldW - p.radius - GAME_WALL_PAD; p.vx *= -1; }

if (p.y < p.radius + GAME_WALL_PAD) { p.y = p.radius + GAME_WALL_PAD; p.vy *= -1; }
else if (p.y > worldH - p.radius - GAME_WALL_PAD) { p.y = worldH - p.radius - GAME_WALL_PAD; p.vy *= -1; }
}

resolveCollisions(particles, 0.90);
}
} else {
if (!statsRef.current) {
reqIdRef.current = requestAnimationFrame(loop);
return;
}
const s = statsRef.current;

const margin = { top: 18, right: 18, bottom: 92, left: 86 };
const chartW = Math.max(50, width - margin.left - margin.right);
const chartH = Math.max(50, height - margin.top - margin.bottom);

const originX = margin.left;
const originY = margin.top + chartH;

const mappedFloatMaxAmp = 5.2 * 1.3;
const mappedFloatAmp = floatStrengthRaw * mappedFloatMaxAmp;

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

for (const p of particles) {
let xVal = 0;
const yVal = p.coin.total_volume || 1;

if (chartMode === 'performance') xVal = getCoinPerfPct(p.coin) || 0;
else xVal = p.coin.market_cap || 1;

const tx = projectX(xVal);
const ty = projectY(yVal);

const floatFreq = 0.0002 * (1 + floatStrengthRaw);
const floatX = mappedFloatAmp > 0 ? Math.sin(now * floatFreq + p.phase) * mappedFloatAmp : 0;
const floatY = mappedFloatAmp > 0 ? Math.cos(now * (floatFreq * 1.3) + p.phase) * mappedFloatAmp : 0;

const targetX = tx + floatX;
const targetY = ty + floatY;

p.x += (targetX - p.x) * 0.05;
p.y += (targetY - p.y) * 0.05;
}
}

// =======================
// DRAW
// =======================
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

if (isBTC && isGameMode) {
ctx.beginPath();
ctx.arc(screenX, screenY, drawRadius, 0, Math.PI * 2);
ctx.fillStyle = '#ffffff';
ctx.fill();

ctx.beginPath();
ctx.arc(screenX, screenY, drawRadius, 0, Math.PI * 2);
ctx.strokeStyle = isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.35)';
ctx.lineWidth = 2;
ctx.stroke();

const img = imageCache.current.get(p.coin.image);
if (img?.complete) {
const logoSize = drawRadius * 1.2;
ctx.drawImage(img, screenX - logoSize / 2, screenY - logoSize / 2, logoSize, logoSize);
}
} else {
ctx.beginPath();
ctx.arc(screenX, screenY, drawRadius, 0, Math.PI * 2);

const img = imageCache.current.get(p.coin.image);
if (img?.complete) {
ctx.save();
ctx.clip();
ctx.drawImage(img, screenX - drawRadius, screenY - drawRadius, drawRadius * 2, drawRadius * 2);
ctx.restore();

ctx.strokeStyle = p.color;
ctx.lineWidth = isSelected ? 4 : 2;
ctx.stroke();
} else {
ctx.fillStyle = p.color;
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

if (isGameMode) {
const cueBall = particlesRef.current.find(p => String(p.coin.id).toLowerCase() === 'bitcoin');
if (cueBall) drawCueStick(ctx, cueBall, now, toScreenX, toScreenY, k, isDark);
}

void invalidateRef.current;
reqIdRef.current = requestAnimationFrame(loop);
};

reqIdRef.current = requestAnimationFrame(loop);
return () => cancelAnimationFrame(reqIdRef.current);
}, [isDark, chartMode, isGameMode, isFreeMode, timeframe, floatStrengthRaw, trailLength, searchTerm, getCoinPerfPct, cuePowerRaw, playBeep]);

const setMapMode = (mode: ChartMode) => {
setIsFreeMode(false);
setChartMode(mode);
};

// ======== UI =========
return (
<div
ref={containerRef}
className="fixed inset-0 z-[2000] bg-white dark:bg-[#0b0f14] text-gray-900 dark:text-white flex flex-col overflow-hidden touch-none select-none overscroll-none h-[100dvh]"
>
<style>{`
@keyframes cardDropZoom {
0% { transform: translateY(-28px) scale(0.96); opacity: 0; }
100% { transform: translateY(0px) scale(1); opacity: 1; }
}
`}</style>

<div className="flex justify-between items-start p-4 z-20 bg-white/80 dark:bg-black/50 backdrop-blur-sm border-b border-gray-200 dark:border-white/10 shrink-0">
<div className="flex items-center gap-4">
<Coins size={28} className="text-[#dd9933]" />
<div>
<h3 className="text-xl font-black uppercase tracking-wider">Crypto Bubbles</h3>
<p className="text-xs text-gray-500 dark:text-gray-400 font-bold">
{status === 'demo' ? 'MODO DEMO' : isGameMode ? 'MODO GAME' : isFreeMode ? 'MODO LIVRE' : 'MODO MAPA'}
</p>
</div>

{/* placar no game */}
{isGameMode && (
<div className="ml-4 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-black/40">
<div className="text-xs font-black text-gray-500 dark:text-gray-400">Encaçapadas</div>
<div className="text-sm font-black">{pottedCount}/{gameBallsCount}</div>
</div>
)}

<div className="w-px h-8 bg-gray-200 dark:bg-white/10 mx-4"></div>

<div className="flex items-center gap-2">
<div className="flex bg-gray-100 dark:bg-black/50 p-1 rounded-lg border border-gray-200 dark:border-white/10">
<button
onClick={() => setMapMode('valuation')}
className={`px-4 py-1.5 text-xs font-black rounded transition-colors ${chartMode === 'valuation' && !isFreeMode ? 'bg-white dark:bg-[#2f3032] shadow text-[#dd9933]' : 'text-gray-500 dark:text-gray-300'}`}
disabled={isGameMode}
>
Market Cap
</button>
</div>

<div className="flex items-center bg-gray-100 dark:bg-black/50 p-1 rounded-lg border border-gray-200 dark:border-white/10">
<button
onClick={() => setMapMode('performance')}
className={`px-4 py-1.5 text-xs font-black rounded transition-colors ${chartMode === 'performance' && !isFreeMode ? 'bg-white dark:bg-[#2f3032] shadow text-[#dd9933]' : 'text-gray-500 dark:text-gray-300'}`}
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
disabled={chartMode !== 'performance' || isFreeMode || isGameMode}
>
<option value="1h">1h</option>
<option value="24h">24h</option>
<option value="7d">7d</option>
</select>
</div>
</div>

{/* dropdown de quantidade muda no modo game */}
<div className="flex items-center gap-2 bg-gray-100 dark:bg-black/50 p-2 rounded-lg border border-gray-200 dark:border-white/10">
<span className="text-xs font-black text-gray-500 dark:text-gray-400">#</span>
{isGameMode ? (
<select
value={gameBallsCount}
onChange={e => setGameBallsCount(parseInt(e.target.value))}
className="bg-white dark:bg-[#2f3032] text-gray-900 dark:text-gray-100 px-2 py-1 rounded text-xs font-black border border-gray-200 dark:border-white/10 outline-none"
>
{[10, 20, 30].map(n => <option key={n} value={n}>{n}</option>)}
</select>
) : (
<select
value={numCoins}
onChange={e => setNumCoins(parseInt(e.target.value))}
className="bg-white dark:bg-[#2f3032] text-gray-900 dark:text-gray-100 px-2 py-1 rounded text-xs font-black border border-gray-200 dark:border-white/10 outline-none"
>
{[50, 100, 150, 200, 250].map(n => <option key={n} value={n}>{n}</option>)}
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
/>
{searchTerm && (
<button onClick={() => { setSearchTerm(''); setSelectedParticle(null); }}>
<XCircle size={16} className="text-gray-500 hover:text-white" />
</button>
)}
</div>
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
<div className="flex items-center justify-between gap-3 mt-3">
<div className="flex items-center gap-2">
<Atom size={14} />
<span className="text-xs font-black uppercase tracking-wider">Modo Livre</span>
</div>

<button
onClick={() => { setIsFreeMode(v => !v); }}
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
disabled={isGameMode}
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

{/* ✅ CARD BONITÃO (funciona no game também) */}
{detailOpen && detailCoin && (
<div
className="absolute inset-0 z-[60] flex items-center justify-center bg-black/45"
onMouseDown={() => { setDetailOpen(false); setSelectedParticle(null); }}
>
<div
key={detailAnimKey}
className="w-[92vw] max-w-[620px] rounded-2xl border border-gray-200 dark:border-white/10 bg-white/95 dark:bg-black/80 backdrop-blur-md shadow-2xl p-5"
style={{ animation: 'cardDropZoom 220ms ease-out' }}
onMouseDown={(e) => e.stopPropagation()}
>
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
onClick={() => { setDetailOpen(false); setSelectedParticle(null); }}
className="p-2 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 border border-gray-200 dark:border-white/10"
title="Fechar"
>
<CloseIcon size={18} />
</button>
</div>

<div className="mt-4 grid grid-cols-2 gap-3 text-sm">
<div className="rounded-xl p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
<div className="text-xs font-black text-gray-500 dark:text-gray-400">Preço</div>
<div className="text-base font-black">{formatPrice(detailCoin.current_price)}</div>
</div>

<div className="rounded-xl p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
<div className="text-xs font-black text-gray-500 dark:text-gray-400">Variação {timeframe}</div>
<div className="text-base font-black" style={{ color: detailColor }}>
{(detailPerf?.pct ?? 0).toFixed(2)}%
</div>
</div>

<div className="rounded-xl p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
<div className="text-xs font-black text-gray-500 dark:text-gray-400">Market Cap</div>
<div className="text-base font-black">{formatCompact(detailCoin.market_cap)}</div>
</div>

<div className="rounded-xl p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
<div className="text-xs font-black text-gray-500 dark:text-gray-400">Volume 24h</div>
<div className="text-base font-black">{formatCompact(detailCoin.total_volume)}</div>
</div>
</div>

<div className="mt-4 text-xs font-bold text-gray-500 dark:text-gray-400">
Clique fora para fechar.
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
