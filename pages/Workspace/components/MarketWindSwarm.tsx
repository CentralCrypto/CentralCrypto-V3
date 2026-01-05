import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ApiCoin, Language } from '../../../types';
import {
Search,
XCircle,
Settings,
Droplets,
FastForward,
Wind,
X as CloseIcon,
Atom,
Coins,
Maximize,
Info,
Trophy
} from 'lucide-react';
import { fetchTopCoins } from '../services/api';

// --- TYPES ---
interface Pocket {
x: number;
y: number;
r: number;
}

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

// Game
isFalling?: boolean;
fallT?: number;
pocketHold?: number;
fallPocket?: Pocket | null;
}

type ChartMode = 'marketcap' | 'variation';
type TimeframeKey = '1h' | '24h' | '7d';
type Status = 'loading' | 'running' | 'demo' | 'error';

interface MarketWindSwarmProps {
language: Language;
onClose: () => void;
}

// --- HELPERS ---
const mathClamp = (val: number, min: number, max: number) => Math.max(min, Math.min(val, max));

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

const safeLog10 = (n: number) => {
if (!isFinite(n) || n <= 0) return 0;
return Math.log10(n);
};

// Infer percent change from sparkline_7d
const inferChangePctFromSparkline = (coin: ApiCoin, tf: TimeframeKey) => {
const arr = coin?.sparkline_in_7d?.price;
if (!arr || !Array.isArray(arr) || arr.length < 4) return coin?.price_change_percentage_24h ?? 0;

const last = arr[arr.length - 1];
if (!isFinite(last)) return coin?.price_change_percentage_24h ?? 0;

// Infer minutes per point (7 days ~ 10080 minutes)
const points = arr.length;
const minsPerPoint = 10080 / Math.max(1, points - 1);

const tfMinutes = tf === '1h' ? 60 : tf === '24h' ? 1440 : 10080;
const backPoints = mathClamp(Math.round(tfMinutes / minsPerPoint), 1, points - 1);

const prev = arr[arr.length - 1 - backPoints];
if (!isFinite(prev) || prev === 0) return 0;

return ((last - prev) / prev) * 100;
};

// Local “user name” (fallback). Swap this for your real auth when you want.
const getLocalDisplayName = () => {
try {
const fromLocal = localStorage.getItem('cct_display_name');
if (fromLocal && fromLocal.trim()) return fromLocal.trim();

// Optional: if you have a global auth object, map it here
// const w = window as any;
// if (w?.__CCT_USER__?.name) return String(w.__CCT_USER__.name);

return 'Guest';
} catch {
return 'Guest';
}
};

// Leaderboard (localStorage)
type LeaderboardEntry = { name: string; best: number; updatedAt: number };
const LB_KEY = 'cct_billiards_leaderboard_v1';

const readLeaderboard = (): LeaderboardEntry[] => {
try {
const raw = localStorage.getItem(LB_KEY);
if (!raw) return [];
const parsed = JSON.parse(raw);
if (!Array.isArray(parsed)) return [];
return parsed
.filter(e => e && typeof e.name === 'string' && typeof e.best === 'number')
.map(e => ({ name: e.name, best: e.best, updatedAt: Number(e.updatedAt) || Date.now() }));
} catch {
return [];
}
};

const writeLeaderboard = (entries: LeaderboardEntry[]) => {
try {
localStorage.setItem(LB_KEY, JSON.stringify(entries.slice(0, 100)));
} catch {}
};

const upsertLeaderboard = (name: string, score: number) => {
const entries = readLeaderboard();
const idx = entries.findIndex(e => e.name.toLowerCase() === name.toLowerCase());
const now = Date.now();

if (idx >= 0) {
if (score > entries[idx].best) entries[idx] = { name, best: score, updatedAt: now };
} else {
entries.push({ name, best: score, updatedAt: now });
}

entries.sort((a, b) => b.best - a.best || b.updatedAt - a.updatedAt);
writeLeaderboard(entries);
};

// --- MAIN COMPONENT ---
const MarketWindSwarm = ({ language, onClose }: MarketWindSwarmProps) => {
const containerRef = useRef<HTMLDivElement>(null);
const canvasRef = useRef<HTMLCanvasElement>(null);

const particlesRef = useRef<Particle[]>([]);
const imageCache = useRef(new Map<string, HTMLImageElement>());
const watermarkRef = useRef<HTMLImageElement | null>(null);

const animationLoopFn = useRef<(() => void) | null>(null);
const reqIdRef = useRef<number>(0);

// State
const [status, setStatus] = useState<Status>('loading');
const [coins, setCoins] = useState<ApiCoin[]>([]);

const [hoveredParticle, setHoveredParticle] = useState<Particle | null>(null);
const [selectedParticle, setSelectedParticle] = useState<Particle | null>(null);
const [searchTerm, setSearchTerm] = useState('');

// Settings
const [settingsOpen, setSettingsOpen] = useState(false);
const [isGameMode, setIsGameMode] = useState(false);

const [numCoins, setNumCoins] = useState(50);
const [chartMode, setChartMode] = useState<ChartMode>('marketcap');

const [tf, setTf] = useState<TimeframeKey>('24h');

const [floatStrength, setFloatStrength] = useState(0.5); // 50% default
const [motionSpeed, setMotionSpeed] = useState(0.5);     // 50% default
const [trailLength, setTrailLength] = useState(20);

const [dpr, setDpr] = useState(1);
const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

// Ranking modal
const [rankOpen, setRankOpen] = useState(false);

// Interaction Refs
const transformRef = useRef({ k: 1, x: 0, y: 0 });
const isPanningRef = useRef(false);
const panStartRef = useRef({ clientX: 0, clientY: 0, x: 0, y: 0 });
const draggedParticleRef = useRef<Particle | null>(null);
const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

// “Aim & cue” for game
const MAX_CUE_PULL = 260;
const aimingRef = useRef<{
active: boolean;
cueId: string | null;
fromX: number;
fromY: number;
aimX: number;
aimY: number;
pull: number;
releasePull: number;
releaseT: number;
}>({
active: false,
cueId: null,
fromX: 0,
fromY: 0,
aimX: 0,
aimY: 0,
pull: 0,
releasePull: 0,
releaseT: 0
});

// Session score
const sessionPocketedRef = useRef(0);

// Refs for loop access
const hoveredParticleRef = useRef(hoveredParticle);
hoveredParticleRef.current = hoveredParticle;
const selectedParticleRef = useRef(selectedParticle);
selectedParticleRef.current = selectedParticle;

// Cache stats
const statsRef = useRef<{
minX: number; maxX: number;
minY: number; maxY: number;
minR: number; maxR: number;
logMinX: number; logMaxX: number;
logMinY: number; logMaxY: number;
logMinR: number; logMaxR: number;
} | null>(null);

const resetZoom = useCallback(() => {
transformRef.current = { k: 1, x: 0, y: 0 };
}, []);

const initWatermark = useCallback(() => {
if (watermarkRef.current) return;
const img = new Image();
img.src = '/logo2-transp.png';
watermarkRef.current = img;
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

useEffect(() => {
initWatermark();
loadData();
const interval = setInterval(loadData, 60000);

const handleResize = () => {
if (containerRef.current && canvasRef.current) {
const ratio = window.devicePixelRatio || 1;
setDpr(ratio);
const rect = containerRef.current.getBoundingClientRect();
canvasRef.current.width = Math.floor(rect.width * ratio);
canvasRef.current.height = Math.floor(rect.height * ratio);
canvasRef.current.style.width = `${rect.width}px`;
canvasRef.current.style.height = `${rect.height}px`;
}
};

window.addEventListener('resize', handleResize);
setTimeout(handleResize, 50);

const observer = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')));
observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

return () => {
clearInterval(interval);
observer.disconnect();
window.removeEventListener('resize', handleResize);
};
}, [loadData, initWatermark]);

// --- Build particles ---
const buildMappedParticles = useCallback(() => {
const topCoins = coins.slice(0, numCoins);
if (topCoins.length === 0) return;

const xData: number[] = [];
const yData: number[] = [];
const rData: number[] = [];

for (const c of topCoins) {
const y = Number(c.total_volume || 1);
yData.push(isFinite(y) && y > 0 ? y : 1);

if (chartMode === 'marketcap') {
const x = Number(c.market_cap || 1);
xData.push(isFinite(x) && x > 0 ? x : 1);
const r = Number(c.market_cap || 1);
rData.push(isFinite(r) && r > 0 ? r : 1);
} else {
const ch = inferChangePctFromSparkline(c, tf);
xData.push(isFinite(ch) ? ch : 0);

const vol = Number(c.total_volume || 1);
const volBoost = 1 + safeLog10(vol + 1);
const radiusMetric = Math.abs(ch) * volBoost;
rData.push(isFinite(radiusMetric) && radiusMetric > 0 ? radiusMetric : 0.0001);
}
}

const minX = Math.min(...xData), maxX = Math.max(...xData);
const minY = Math.min(...yData), maxY = Math.max(...yData);
const minR = Math.min(...rData), maxR = Math.max(...rData);

statsRef.current = {
minX, maxX, minY, maxY, minR, maxR,
logMinX: (minX > 0) ? Math.log10(minX) : 0,
logMaxX: (maxX > 0) ? Math.log10(maxX) : 0,
logMinY: (minY > 0) ? Math.log10(minY) : 0,
logMaxY: (maxY > 0) ? Math.log10(maxY) : 0,
logMinR: (minR > 0) ? Math.log10(minR) : 0,
logMaxR: (maxR > 0) ? Math.log10(maxR) : 0
};

const existingMap = new Map(particlesRef.current.map(p => [p.id, p]));
const w = containerRef.current?.clientWidth || 1200;
const h = containerRef.current?.clientHeight || 800;

const newParticles = topCoins.map(coin => {
const existing = existingMap.get(coin.id);

if (!imageCache.current.has(coin.image)) {
const img = new Image();
img.src = coin.image;
imageCache.current.set(coin.image, img);
}

const isBTC = String(coin.id).toLowerCase() === 'bitcoin';
const change24 = Number(coin.price_change_percentage_24h || 0);
const baseColor = change24 >= 0 ? '#089981' : '#f23645';
const color = isBTC && isGameMode ? '#ffffff' : baseColor;

let radiusVal = 1;
if (chartMode === 'marketcap') {
radiusVal = Number(coin.market_cap || 1);
} else {
const ch = inferChangePctFromSparkline(coin, tf);
const vol = Number(coin.total_volume || 1);
const volBoost = 1 + safeLog10(vol + 1);
radiusVal = Math.abs(ch) * volBoost;
if (!isFinite(radiusVal) || radiusVal <= 0) radiusVal = 0.0001;
}

// When game mode: normalize sizes
let targetRadius = 14;
if (isGameMode) {
targetRadius = isBTC ? 26 : 18;
} else {
const s = statsRef.current!;
if (chartMode === 'marketcap') {
const logMinR = s.logMinR, logMaxR = s.logMaxR;
const logVal = safeLog10(radiusVal);
targetRadius = 14 + (logVal - logMinR) / (logMaxR - logMinR || 1) * 56;
} else {
targetRadius = 14 + (radiusVal - s.minR) / (s.maxR - s.minR || 1) * 56;
}
targetRadius = mathClamp(targetRadius, 10, 70);
}

const vx = (Math.random() - 0.5) * 40;
const vy = (Math.random() - 0.5) * 40;

if (existing) {
existing.coin = coin;
existing.targetRadius = targetRadius;
existing.color = color;
existing.mass = Math.max(1, targetRadius);
if (!isGameMode && (Math.abs(existing.vx) < 2 && Math.abs(existing.vy) < 2)) {
existing.vx = (Math.random() - 0.5) * 50;
existing.vy = (Math.random() - 0.5) * 50;
}
return existing;
}

return {
id: coin.id,
x: Math.random() * w,
y: Math.random() * h,
vx,
vy,
radius: 0,
targetRadius,
color,
coin,
trail: [],
phase: Math.random() * Math.PI * 2,
mass: Math.max(1, targetRadius),
isFalling: false,
fallT: 0,
pocketHold: 0,
fallPocket: null
} as Particle;
});

particlesRef.current = newParticles;
}, [coins, numCoins, chartMode, tf, isGameMode]);

const setupGameTable = useCallback(() => {
const canvas = canvasRef.current;
if (!canvas) return;

const width = canvas.width / dpr;
const height = canvas.height / dpr;

const pad = 60;
const tableW = width - pad * 2;
const tableH = height - pad * 2;

const rackX = pad + tableW * 0.22;
const rackY = pad + tableH * 0.5;

const cueStartX = pad + tableW * 0.78;
const cueStartY = rackY;

const coinsList = coins.slice(0, numCoins);
if (coinsList.length === 0) return;

const getCoinById = (id: string) => coinsList.find(c => String(c.id).toLowerCase() === id);

const cueCoin = getCoinById('bitcoin') || coinsList[0];
const otherCoins = coinsList.filter(c => String(c.id).toLowerCase() !== 'bitcoin');

const all: ApiCoin[] = [cueCoin, ...otherCoins].slice(0, numCoins);

// Build particles using existing map
const existingMap = new Map(particlesRef.current.map(p => [p.id, p]));

const makeParticle = (coin: ApiCoin, x: number, y: number, isCue: boolean): Particle => {
if (!imageCache.current.has(coin.image)) {
const img = new Image();
img.src = coin.image;
imageCache.current.set(coin.image, img);
}

const existing = existingMap.get(coin.id);
const targetRadius = isCue ? 26 : 18;

if (existing) {
existing.coin = coin;
existing.x = x;
existing.y = y;
existing.vx = 0;
existing.vy = 0;
existing.targetRadius = targetRadius;
existing.radius = targetRadius;
existing.mass = Math.max(1, targetRadius);
existing.color = isCue ? '#ffffff' : ((Number(coin.price_change_percentage_24h || 0) >= 0) ? '#089981' : '#f23645');
existing.trail = [];
existing.isFalling = false;
existing.fallT = 0;
existing.pocketHold = 0;
existing.fallPocket = null;
return existing;
}

return {
id: coin.id,
x,
y,
vx: 0,
vy: 0,
radius: targetRadius,
targetRadius,
color: isCue ? '#ffffff' : ((Number(coin.price_change_percentage_24h || 0) >= 0) ? '#089981' : '#f23645'),
coin,
trail: [],
phase: Math.random() * Math.PI * 2,
mass: Math.max(1, targetRadius),
isFalling: false,
fallT: 0,
pocketHold: 0,
fallPocket: null
};
};

// Arrange rack triangle on LEFT
const ballR = 18;
const gap = 1.5;
const dx = (ballR * 2 + gap) * 0.98;
const dy = (ballR * 2 + gap) * 0.56;

const rackParticles: Particle[] = [];
let idx = 0;
for (let row = 0; row < 5; row++) {
for (let col = 0; col <= row; col++) {
if (idx >= otherCoins.length) break;

const px = rackX + row * dx;
const py = rackY + (col - row / 2) * (ballR * 2 + gap) * 0.98;

rackParticles.push(makeParticle(otherCoins[idx], px, py, false));
idx++;
}
}

// Cue ball
const cueParticle = makeParticle(cueCoin, cueStartX, cueStartY, true);

// Fill remaining coins scattered lightly (optional)
const extra: Particle[] = [];
const remaining = otherCoins.slice(idx);
for (let i = 0; i < remaining.length; i++) {
const rx = pad + Math.random() * tableW;
const ry = pad + Math.random() * tableH;
extra.push(makeParticle(remaining[i], rx, ry, false));
}

// Keep total at numCoins
particlesRef.current = [cueParticle, ...rackParticles, ...extra].slice(0, numCoins);

// Reset session score
sessionPocketedRef.current = 0;

// Reset aim
aimingRef.current.active = false;
aimingRef.current.cueId = null;
aimingRef.current.pull = 0;
aimingRef.current.releasePull = 0;
aimingRef.current.releaseT = 0;
}, [coins, numCoins, dpr]);

// Rebuild particles on relevant changes
useEffect(() => {
if (coins.length === 0) return;

if (isGameMode) {
setupGameTable();
} else {
buildMappedParticles();
}
}, [coins, numCoins, chartMode, tf, isGameMode, buildMappedParticles, setupGameTable]);

// Reset zoom when game toggles on, and reset graph when toggles off
useEffect(() => {
if (isGameMode) {
resetZoom();
setSelectedParticle(null);
setHoveredParticle(null);
} else {
resetZoom();
setSelectedParticle(null);
setHoveredParticle(null);
}
}, [isGameMode, resetZoom]);

// --- Utils: screen/world mapping ---
const screenToWorld = useCallback((clientX: number, clientY: number) => {
const canvas = canvasRef.current;
if (!canvas) return { x: 0, y: 0 };
const rect = canvas.getBoundingClientRect();
const mouseX = clientX - rect.left;
const mouseY = clientY - rect.top;

const { k, x, y } = transformRef.current;
return {
x: (mouseX - x) / k,
y: (mouseY - y) / k
};
}, []);

// --- Rendering helpers ---
const drawWatermark = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
const img = watermarkRef.current;
if (!img || !img.complete) return;

ctx.save();
ctx.globalAlpha = isDark ? 0.06 : 0.05;

const scale = 0.78;
const targetW = Math.min(width * 0.9, img.width ? img.width * scale : width * 0.6);
const aspect = img.width > 0 ? (img.height / img.width) : 0.35;
const targetH = targetW * aspect;

const x = (width - targetW) / 2;
const y = (height - targetH) / 2;

ctx.drawImage(img, x, y, targetW, targetH);
ctx.restore();
}, [isDark]);

const computeGamePockets = useCallback((width: number, height: number): Pocket[] => {
const pad = 60;
const tableW = width - pad * 2;
const tableH = height - pad * 2;

const left = pad;
const right = pad + tableW;
const top = pad;
const bottom = pad + tableH;

const r = 34;

return [
{ x: left, y: top, r },
{ x: left + tableW / 2, y: top, r },
{ x: right, y: top, r },
{ x: left, y: bottom, r },
{ x: left + tableW / 2, y: bottom, r },
{ x: right, y: bottom, r }
];
}, []);

const drawGameTable = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
const pad = 60;
const tableW = width - pad * 2;
const tableH = height - pad * 2;

ctx.save();

// Table felt
ctx.fillStyle = isDark ? 'rgba(18, 40, 28, 0.95)' : 'rgba(20, 120, 70, 0.18)';
ctx.fillRect(pad, pad, tableW, tableH);

// Border
ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';
ctx.lineWidth = 2;
ctx.strokeRect(pad, pad, tableW, tableH);

// Pockets
const pockets = computeGamePockets(width, height);
for (const pk of pockets) {
ctx.beginPath();
ctx.arc(pk.x, pk.y, pk.r, 0, Math.PI * 2);
ctx.fillStyle = isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.18)';
ctx.fill();
}

// Rack triangle (left side)
const rackX = pad + tableW * 0.16;
const rackY = pad + tableH * 0.5;
const rackW = 170;
const rackH = 190;

ctx.beginPath();
ctx.moveTo(rackX, rackY);
ctx.lineTo(rackX + rackW, rackY - rackH / 2);
ctx.lineTo(rackX + rackW, rackY + rackH / 2);
ctx.closePath();
ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';
ctx.lineWidth = 2;
ctx.stroke();

ctx.restore();
}, [computeGamePockets, isDark]);

const drawCueStick = useCallback((
ctx2: CanvasRenderingContext2D,
cueBall: Particle,
now: number,
toScreenX: (v: number) => number,
toScreenY: (v: number) => number
) => {
const cx = toScreenX(cueBall.x);
const cy = toScreenY(cueBall.y);

// Determine aim point
let ax = cx + 160;
let ay = cy;

if (aimingRef.current.active) {
ax = toScreenX(aimingRef.current.aimX);
ay = toScreenY(aimingRef.current.aimY);
} else if (lastMousePosRef.current) {
ax = toScreenX(lastMousePosRef.current.x);
ay = toScreenY(lastMousePosRef.current.y);
} else {
ax = cx + Math.cos(now * 0.0007) * 160;
ay = cy + Math.sin(now * 0.0007) * 160;
}

let dx = ax - cx;
let dy = ay - cy;
let dist = Math.hypot(dx, dy);
if (dist < 0.001) { dx = 1; dy = 0; dist = 1; }

const nx = dx / dist;
const ny = dy / dist;

// Pull visual
if (!aimingRef.current.active && aimingRef.current.releasePull > 0.5) {
aimingRef.current.releaseT += 1 / 60;
aimingRef.current.releasePull *= 0.85;
if (aimingRef.current.releasePull < 0.5) aimingRef.current.releasePull = 0;
}

let pullVisual = 0;
if (aimingRef.current.active) pullVisual = aimingRef.current.pull;
else pullVisual = aimingRef.current.releasePull || 0;

// Stick geometry: ALWAYS behind the cue ball along -aim direction
const gap = 10;
const tipDist = cueBall.radius + gap;
const stickLen = 320;
const stickThick = 10;

// Tip near ball
const tipX = cx - nx * tipDist;
const tipY = cy - ny * tipDist;

// Butt pulled back
const buttX = cx - nx * (tipDist + stickLen + pullVisual);
const buttY = cy - ny * (tipDist + stickLen + pullVisual);

ctx2.save();
ctx2.globalAlpha = 0.92;
ctx2.lineCap = 'round';

// Body
ctx2.beginPath();
ctx2.moveTo(buttX, buttY);
ctx2.lineTo(tipX, tipY);
ctx2.strokeStyle = isDark ? 'rgba(210,170,120,0.78)' : 'rgba(120,85,45,0.72)';
ctx2.lineWidth = stickThick;
ctx2.stroke();

// Tip
ctx2.beginPath();
ctx2.moveTo(tipX - nx * 22, tipY - ny * 22);
ctx2.lineTo(tipX, tipY);
ctx2.strokeStyle = 'rgba(255,255,255,0.72)';
ctx2.lineWidth = 6;
ctx2.stroke();

ctx2.restore();
}, [isDark]);

// --- DRAW LOOP ---
useEffect(() => {
const canvas = canvasRef.current;
const ctx = canvas?.getContext('2d', { alpha: false });
if (!ctx || !canvas) return;

let lastTime = performance.now();

animationLoopFn.current = () => {
try {
const now = performance.now();
const dt = Math.min((now - lastTime) / 1000, 0.05);
lastTime = now;

const width = canvas.width / dpr;
const height = canvas.height / dpr;

ctx.setTransform(1, 0, 0, 1, 0, 0);
ctx.fillStyle = isDark ? '#0b0f14' : '#ffffff';
ctx.fillRect(0, 0, canvas.width, canvas.height);

ctx.scale(dpr, dpr);

drawWatermark(ctx, width, height);

const { k, x: panX, y: panY } = transformRef.current;

const toScreenX = (val: number) => val * k + panX;
const toScreenY = (val: number) => val * k + panY;

const particles = particlesRef.current;

if (isGameMode) {
drawGameTable(ctx, width, height);

const pockets = computeGamePockets(width, height);

// Physics params (game feel)
const physicsSpeed = 0.20; // fixed 20% as requested
const drag = Math.pow(0.84, dt * 60); // strong
const rollingDecel = 520;
const stopEps = 0.45;

// 1) Update motion + friction
for (const p of particles) {
if (p.isFalling) {
p.fallT = (p.fallT || 0) + dt;

if (p.fallPocket) {
p.x += (p.fallPocket.x - p.x) * 0.28;
p.y += (p.fallPocket.y - p.y) * 0.28;
}

if ((p.fallT || 0) >= 0.48) {
// Remove pocketed ball, count score (don’t count BTC cue ball)
const isBTC = String(p.coin.id).toLowerCase() === 'bitcoin';
if (!isBTC) sessionPocketedRef.current += 1;

particlesRef.current = particlesRef.current.filter(pp => pp !== p);
}
continue;
}

p.vx *= drag;
p.vy *= drag;

const sp = Math.hypot(p.vx, p.vy);
if (sp > 0) {
const ns = Math.max(0, sp - rollingDecel * dt);
const s = ns / sp;
p.vx *= s;
p.vy *= s;
}

if (Math.hypot(p.vx, p.vy) < stopEps) {
p.vx = 0;
p.vy = 0;
}

p.x += p.vx * dt * physicsSpeed;
p.y += p.vy * dt * physicsSpeed;

// Wall bounce inside table
const pad = 60;
const worldW = width - pad * 2;
const worldH = height - pad * 2;
const left = pad;
const top = pad;
const right = pad + worldW;
const bottom = pad + worldH;

if (p.x < left + p.radius) { p.x = left + p.radius; p.vx *= -1; }
else if (p.x > right - p.radius) { p.x = right - p.radius; p.vx *= -1; }

if (p.y < top + p.radius) { p.y = top + p.radius; p.vy *= -1; }
else if (p.y > bottom - p.radius) { p.y = bottom - p.radius; p.vy *= -1; }
}

// 2) Collisions (billiard)
for (let i = 0; i < particles.length; i++) {
const p1 = particles[i];
if (p1.isFalling) continue;

for (let j = i + 1; j < particles.length; j++) {
const p2 = particles[j];
if (p2.isFalling) continue;

const dx = p2.x - p1.x;
const dy = p2.y - p1.y;
const distSq = dx * dx + dy * dy;
const minDist = p1.radius + p2.radius;

if (distSq < minDist * minDist) {
const dist = Math.sqrt(distSq) || 0.001;
const nx = dx / dist;
const ny = dy / dist;

// Separate overlap
const overlap = minDist - dist;
const totalMass = p1.mass + p2.mass;
const m1Ratio = p2.mass / totalMass;
const m2Ratio = p1.mass / totalMass;

p1.x -= nx * overlap * m1Ratio;
p1.y -= ny * overlap * m1Ratio;
p2.x += nx * overlap * m2Ratio;
p2.y += ny * overlap * m2Ratio;

// Bounce
const vrelx = p2.vx - p1.vx;
const vrely = p2.vy - p1.vy;
const velAlongNormal = vrelx * nx + vrely * ny;
if (velAlongNormal > 0) continue;

const restitution = 1.0;
let jimp = -(1 + restitution) * velAlongNormal;
jimp /= (1 / p1.mass + 1 / p2.mass);

const impulseX = jimp * nx;
const impulseY = jimp * ny;

p1.vx -= impulseX / p1.mass;
p1.vy -= impulseY / p1.mass;
p2.vx += impulseX / p2.mass;
p2.vy += impulseY / p2.mass;
}
}
}

// 3) Pocket detection (slow + centered)
for (const p of particlesRef.current) {
if (p.isFalling) continue;

const speed = Math.hypot(p.vx, p.vy);
const slowEnough = speed < 0.65;

if (!slowEnough) {
p.pocketHold = 0;
p.fallPocket = null;
continue;
}

let onPocket = false;
let picked: Pocket | null = null;

for (const pk of pockets) {
const distPk = Math.hypot(p.x - pk.x, p.y - pk.y);
if (distPk <= pk.r * 0.60) {
onPocket = true;
picked = pk;
break;
}
}

if (onPocket && picked) {
p.pocketHold = (p.pocketHold || 0) + dt;
p.fallPocket = picked;

if ((p.pocketHold || 0) >= 0.25) {
p.isFalling = true;
p.fallT = 0;
p.vx = 0;
p.vy = 0;
}
} else {
p.pocketHold = 0;
p.fallPocket = null;
}
}

// 4) Render balls (top layer)
for (const p of particlesRef.current) {
const isBTC = String(p.coin.id).toLowerCase() === 'bitcoin';

// Falling animation
let drawRadius = p.targetRadius;
if (p.isFalling) {
const t = mathClamp((p.fallT || 0) / 0.48, 0, 1);
drawRadius = p.targetRadius * (1 - t);
if (drawRadius < 0.5) continue;
}

p.radius += (p.targetRadius - p.radius) * 0.18;

const sx = toScreenX(p.x);
const sy = toScreenY(p.y);

ctx.save();

// Bubble base
ctx.beginPath();
ctx.arc(sx, sy, drawRadius, 0, Math.PI * 2);

if (isBTC) {
ctx.fillStyle = '#ffffff';
ctx.fill();

const img = imageCache.current.get(p.coin.image);
if (img?.complete) {
ctx.save();
ctx.clip();
const inset = drawRadius * 0.10;
ctx.drawImage(img, sx - drawRadius + inset, sy - drawRadius + inset, (drawRadius * 2) - inset * 2, (drawRadius * 2) - inset * 2);
ctx.restore();
}

ctx.strokeStyle = 'rgba(0,0,0,0.20)';
ctx.lineWidth = 2;
ctx.stroke();
} else {
const img = imageCache.current.get(p.coin.image);
if (img?.complete) {
ctx.save();
ctx.clip();
ctx.drawImage(img, sx - drawRadius, sy - drawRadius, drawRadius * 2, drawRadius * 2);
ctx.restore();
ctx.strokeStyle = p.color;
ctx.lineWidth = 2;
ctx.stroke();
} else {
ctx.fillStyle = p.color;
ctx.fill();
}
}

ctx.restore();
}

// 5) Render cue stick LAST (above balls)
const cueBall = particlesRef.current.find(p => String(p.coin.id).toLowerCase() === 'bitcoin');
if (cueBall && !cueBall.isFalling) {
drawCueStick(ctx, cueBall, now, toScreenX, toScreenY);
}
return;
}

// --------------------
// MAPPED MODE (chart)
// --------------------
if (!statsRef.current) return;
const s = statsRef.current;

const marginBottom = 110;
const marginLeft = 70;
const chartW = width - marginLeft - 20;
const chartH = height - marginBottom;

// Movement controls (mapped):
// motionSpeed controls “how fast it converges”
// floatStrength controls amplitude (0..1.3 range). 0 = dead still.
const physicsSpeed = 0.08 + (motionSpeed * 0.42);
const floatStrengthScaled = mathClamp(floatStrength * 1.3, 0, 1.3);
const floatAmpBase = floatStrengthScaled * 6.5; // 30% max boost already baked

// Projection
const projectX = (v: number) => {
let norm = 0;
if (chartMode === 'marketcap') {
if (v <= 0) return marginLeft;
norm = (Math.log10(v) - s.logMinX) / (s.logMaxX - s.logMinX || 1);
} else {
norm = (v - s.minX) / (s.maxX - s.minX || 1);
}
return marginLeft + norm * chartW;
};

const projectY = (v: number) => {
if (v <= 0) return chartH;
const norm = (Math.log10(v) - s.logMinY) / (s.logMaxY - s.logMinY || 1);
return chartH - norm * (chartH - 20) + 20;
};

// Axes
ctx.save();
ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
ctx.lineWidth = 1;
ctx.font = `bold 11px Inter`;
ctx.fillStyle = isDark ? 'rgba(255,255,255,0.70)' : 'rgba(0,0,0,0.70)';

// X grid + labels
const xSteps = 6;
for (let i = 0; i <= xSteps; i++) {
const pct = i / xSteps;

let val = 0;
let worldX = 0;

if (chartMode === 'marketcap') {
val = Math.pow(10, s.logMinX + pct * (s.logMaxX - s.logMinX));
worldX = projectX(val);
} else {
val = s.minX + pct * (s.maxX - s.minX);
worldX = projectX(val);
}

const sx = toScreenX(worldX);
if (sx >= 0 && sx <= width) {
ctx.beginPath();
ctx.moveTo(sx, 0);
ctx.lineTo(sx, chartH);
ctx.stroke();

ctx.textAlign = 'center';
const label = chartMode === 'marketcap' ? formatCompact(val) : `${val.toFixed(1)}%`;
ctx.fillText(label, sx, height - 48);
}
}

// Y grid + labels
const ySteps = 5;
for (let i = 0; i <= ySteps; i++) {
const pct = i / ySteps;
const val = Math.pow(10, s.logMinY + pct * (s.logMaxY - s.logMinY));
const wy = projectY(val);
const sy = toScreenY(wy);

if (sy >= 0 && sy <= chartH) {
ctx.beginPath();
ctx.moveTo(marginLeft, sy);
ctx.lineTo(width, sy);
ctx.stroke();

ctx.textAlign = 'right';
ctx.fillText(formatCompact(val), marginLeft - 10, sy + 4);
}
}

// Axis lines
ctx.beginPath();
ctx.moveTo(marginLeft, toScreenY(chartH));
ctx.lineTo(width, toScreenY(chartH));
ctx.stroke();

// Axis titles
ctx.font = 'bold 12px Inter';
ctx.textAlign = 'center';
ctx.fillStyle = isDark ? '#dd9933' : '#333';

const xLabel = chartMode === 'marketcap' ? 'Market Cap (Log)' : `Variação ${tf.toUpperCase()} (%)`;
ctx.fillText(xLabel, width / 2, height - 18);

ctx.save();
ctx.translate(18, height / 2);
ctx.rotate(-Math.PI / 2);
ctx.fillText('Volume 24h (Log)', 0, 0);
ctx.restore();

ctx.restore();

// Update mapped physics
for (const p of particles) {
let xVal = 0;
const yVal = Number(p.coin.total_volume || 1);

if (chartMode === 'marketcap') {
xVal = Number(p.coin.market_cap || 1);
} else {
xVal = inferChangePctFromSparkline(p.coin, tf);
}

const tx = projectX(xVal);
const ty = projectY(yVal);

const floatFreq = 0.00018 * (1 + motionSpeed);
const floatX = Math.sin(now * floatFreq + p.phase) * floatAmpBase;
const floatY = Math.cos(now * (floatFreq * 1.25) + p.phase) * floatAmpBase;

const targetX = tx + floatX;
const targetY = ty + floatY;

p.x += (targetX - p.x) * physicsSpeed;
p.y += (targetY - p.y) * physicsSpeed;
}

// Render particles
for (const p of particles) {
const viewRadius = p.targetRadius * Math.pow(transformRef.current.k, 0.25);
p.radius += (viewRadius - p.radius) * 0.12;

const sx = toScreenX(p.x);
const sy = toScreenY(p.y);

if (sx + p.radius < 0 || sx - p.radius > width || sy + p.radius < 0 || sy - p.radius > height) continue;

const isDimmed =
searchTerm &&
!p.coin.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
!p.coin.symbol.toLowerCase().includes(searchTerm.toLowerCase());

if (isDimmed) ctx.globalAlpha = 0.08;

if (trailLength > 0) {
const last = p.trail[p.trail.length - 1];
const ddx = last ? sx - last.x : 10;
const ddy = last ? sy - last.y : 10;

if (!last || (ddx * ddx + ddy * ddy > 4)) {
p.trail.push({ x: sx, y: sy, age: 1.0 });
}

for (let tIdx = 0; tIdx < p.trail.length; tIdx++) p.trail[tIdx].age -= 0.02;
p.trail = p.trail.filter(t => t.age > 0);

if (p.trail.length > 1) {
ctx.beginPath();
ctx.moveTo(p.trail[0].x, p.trail[0].y);
for (let ti = 1; ti < p.trail.length; ti++) ctx.lineTo(p.trail[ti].x, p.trail[ti].y);

const grad = ctx.createLinearGradient(p.trail[0].x, p.trail[0].y, sx, sy);
grad.addColorStop(0, 'rgba(0,0,0,0)');
grad.addColorStop(1, p.color);
ctx.strokeStyle = grad;
ctx.lineWidth = Math.min(p.radius * 0.4, 4);
ctx.stroke();
}
} else {
p.trail = [];
}

ctx.beginPath();
ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);

const img = imageCache.current.get(p.coin.image);
if (img?.complete) {
ctx.save();
ctx.clip();
ctx.drawImage(img, sx - p.radius, sy - p.radius, p.radius * 2, p.radius * 2);
ctx.restore();

ctx.strokeStyle = p.color;
ctx.lineWidth = 2;
ctx.stroke();
} else {
ctx.fillStyle = p.color;
ctx.fill();
}

if (p.radius > 12) {
ctx.fillStyle = '#fff';
ctx.font = `bold ${Math.max(10, p.radius * 0.4)}px Inter`;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.shadowColor = 'rgba(0,0,0,0.8)';
ctx.shadowBlur = 4;
ctx.fillText(p.coin.symbol.toUpperCase(), sx, sy);
ctx.shadowBlur = 0;
}

ctx.globalAlpha = 1.0;
}
} catch (e) {
console.error('Animation Loop Error', e);
}
};
}, [dpr, isDark, isGameMode, searchTerm, trailLength, motionSpeed, floatStrength, chartMode, tf, drawWatermark, drawGameTable, computeGamePockets, drawCueStick]);

useEffect(() => {
const loop = () => {
if (animationLoopFn.current) animationLoopFn.current();
reqIdRef.current = requestAnimationFrame(loop);
};
loop();
return () => cancelAnimationFrame(reqIdRef.current);
}, []);

// --- EVENTS ---
const handleMouseMove = (e: React.MouseEvent) => {
const canvas = canvasRef.current;
if (!canvas) return;

const rect = canvas.getBoundingClientRect();
const mouseX = e.clientX - rect.left;
const mouseY = e.clientY - rect.top;

const { k, x, y } = transformRef.current;
const worldMouseX = (mouseX - x) / k;
const worldMouseY = (mouseY - y) / k;

lastMousePosRef.current = { x: worldMouseX, y: worldMouseY };

if (isGameMode) {
if (aimingRef.current.active) {
aimingRef.current.aimX = worldMouseX;
aimingRef.current.aimY = worldMouseY;

const dx = aimingRef.current.aimX - aimingRef.current.fromX;
const dy = aimingRef.current.aimY - aimingRef.current.fromY;
const dist = Math.hypot(dx, dy);
aimingRef.current.pull = mathClamp(dist, 0, MAX_CUE_PULL);
}
return;
}

if (draggedParticleRef.current) return;

if (isPanningRef.current) {
const dx = e.clientX - panStartRef.current.clientX;
const dy = e.clientY - panStartRef.current.clientY;
transformRef.current.x = panStartRef.current.x + dx;
transformRef.current.y = panStartRef.current.y + dy;
return;
}

let found: Particle | null = null;
for (let i = particlesRef.current.length - 1; i >= 0; i--) {
const p = particlesRef.current[i];
const sx = p.x * k + x;
const sy = p.y * k + y;
const sr = p.radius;

const ddx = sx - mouseX;
const ddy = sy - mouseY;

if (ddx * ddx + ddy * ddy < (sr + 5) * (sr + 5)) {
found = p;
break;
}
}

if (found) setHoveredParticle(found);
else setHoveredParticle(null);
};

const handleMouseDown = (e: React.MouseEvent) => {
if (isGameMode) {
// Only cue ball aiming
const cueBall = particlesRef.current.find(p => String(p.coin.id).toLowerCase() === 'bitcoin');
if (!cueBall || cueBall.isFalling) return;

const w = screenToWorld(e.clientX, e.clientY);

aimingRef.current.active = true;
aimingRef.current.cueId = cueBall.id;
aimingRef.current.fromX = cueBall.x;
aimingRef.current.fromY = cueBall.y;
aimingRef.current.aimX = w.x;
aimingRef.current.aimY = w.y;
aimingRef.current.pull = 0;

aimingRef.current.releasePull = 0;
aimingRef.current.releaseT = 0;

setSelectedParticle(cueBall);
return;
}

if (!hoveredParticleRef.current) setSelectedParticle(null);

if (hoveredParticleRef.current) {
setSelectedParticle(hoveredParticleRef.current);
} else {
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
if (aimingRef.current.active && aimingRef.current.cueId) {
const cue = particlesRef.current.find(pp => pp.id === aimingRef.current.cueId);

if (cue && !cue.isFalling) {
const dx = aimingRef.current.aimX - cue.x;
const dy = aimingRef.current.aimY - cue.y;
const dist = Math.hypot(dx, dy) || 0.0001;

const nx = dx / dist;
const ny = dy / dist;

const pull = mathClamp(aimingRef.current.pull, 0, MAX_CUE_PULL);
const t = pull / MAX_CUE_PULL;
const power = Math.pow(t, 1.15) * 2100;

cue.vx += -nx * power / Math.max(1, cue.mass);
cue.vy += -ny * power / Math.max(1, cue.mass);
}

aimingRef.current.releasePull = aimingRef.current.pull;
aimingRef.current.releaseT = 0;

aimingRef.current.active = false;
aimingRef.current.cueId = null;
aimingRef.current.pull = 0;
}
return;
}

isPanningRef.current = false;
draggedParticleRef.current = null;
};

const handleWheel = (e: React.WheelEvent) => {
if (isGameMode) return;
e.preventDefault();

const canvas = canvasRef.current;
if (!canvas) return;

const rect = canvas.getBoundingClientRect();
const mouseX = e.clientX - rect.left;
const mouseY = e.clientY - rect.top;

const worldX = (mouseX - transformRef.current.x) / transformRef.current.k;
const worldY = (mouseY - transformRef.current.y) / transformRef.current.k;

const zoomFactor = 1.1;
const oldK = transformRef.current.k;
const newK = e.deltaY < 0 ? oldK * zoomFactor : oldK / zoomFactor;
const clampedK = mathClamp(newK, 0.2, 10.0);

const newX = mouseX - worldX * clampedK;
const newY = mouseY - worldY * clampedK;

transformRef.current = { k: clampedK, x: newX, y: newY };
};

// Save leaderboard when leaving game or closing
const finalizeGameScore = useCallback(() => {
const name = getLocalDisplayName();
const score = sessionPocketedRef.current;
if (score > 0) upsertLeaderboard(name, score);
}, []);

useEffect(() => {
return () => {
if (isGameMode) finalizeGameScore();
};
}, [isGameMode, finalizeGameScore]);

const legendText = useMemo(() => {
if (isGameMode) {
return 'Modo Game: segure o botão do mouse para “puxar” o taco. Solte para tacar. As bolas perdem força e caem nas caçapas quando param em cima.';
}

if (chartMode === 'marketcap') {
return 'Market Cap: eixo X em log; tamanho da bolha acompanha o Market Cap. Volume no eixo Y (log).';
}

return 'Variação: mede variação de preço no timeframe selecionado (inferido do sparkline 7d). Tamanho da bolha = |%var(TF)| × peso por volume.';
}, [isGameMode, chartMode]);

const leaderboard = useMemo(() => {
const list = readLeaderboard();
return list.slice(0, 10);
}, [rankOpen]);

return (
<div
ref={containerRef}
className="fixed inset-0 z-[2000] bg-white dark:bg-[#0b0f14] text-gray-900 dark:text-white flex flex-col overflow-hidden touch-none select-none"
>
{/* HEADER */}
<div className="flex justify-between items-start p-4 z-20 bg-white/80 dark:bg-black/50 backdrop-blur-sm border-b border-gray-200 dark:border-white/10 shrink-0">
<div className="flex items-center gap-4">
<Coins size={28} className="text-[#dd9933]" />
<div>
<h3 className="text-xl font-black uppercase tracking-wider">Crypto Bubbles</h3>
<p className="text-xs text-gray-500 dark:text-gray-400 font-bold">
{status === 'demo' ? 'MODO DEMO' : isGameMode ? 'MODO GAME' : 'Live Physics'}
</p>
</div>

<div className="w-px h-8 bg-gray-200 dark:bg-white/10 mx-4"></div>

{/* Controls group */}
<div className="flex bg-gray-100 dark:bg-black/50 p-1 rounded-lg border border-gray-200 dark:border-white/10 mr-2">
<button
onClick={() => setChartMode('marketcap')}
className={`px-4 py-1.5 text-xs font-bold rounded transition-colors ${
chartMode === 'marketcap'
? 'bg-white dark:bg-[#2f3032] shadow text-[#dd9933]'
: 'text-gray-500 dark:text-gray-300'
}`}
>
Market Cap
</button>

<div className="flex items-center gap-2 ml-2 pr-1">
<span className="text-xs font-black text-gray-600 dark:text-gray-300">Variação:</span>

<button
onClick={() => setChartMode('variation')}
className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${
chartMode === 'variation'
? 'bg-white dark:bg-[#2f3032] shadow text-[#dd9933]'
: 'text-gray-500 dark:text-gray-300'
}`}
>
Preço
</button>

<select
value={tf}
onChange={e => setTf(e.target.value as TimeframeKey)}
className="ml-2 text-xs font-bold rounded px-2 py-1.5 outline-none border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2f3032] text-gray-900 dark:text-gray-100"
title="Timeframe (inferido do sparkline 7d)"
>
<option value="1h">1h</option>
<option value="24h">24h</option>
<option value="7d">7d</option>
</select>
</div>
</div>

{/* Search */}
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

<div className="flex items-center gap-3">
{/* Legend button */}
<div className="relative">
<button
className="p-3 bg-gray-100 dark:bg-black/50 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
title={legendText}
>
<Info size={20} className="text-[#dd9933]" />
</button>
</div>

{/* Ranking */}
<button
onClick={() => setRankOpen(v => !v)}
className={`p-3 rounded-lg border transition-colors backdrop-blur-sm ${
rankOpen
? 'bg-[#dd9933] text-black border-[#dd9933]'
: 'bg-gray-100 dark:bg-black/50 border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10'
}`}
title="Ranking (local)"
>
<Trophy size={20} />
</button>

{/* Reset Zoom */}
<button
onClick={resetZoom}
className="p-3 bg-[#dd9933]/10 hover:bg-[#dd9933]/20 text-[#dd9933] rounded-lg border border-[#dd9933]/30 transition-colors"
title="Reset Zoom"
>
<Maximize size={20} />
</button>

{/* Settings */}
<button
onClick={() => setSettingsOpen(!settingsOpen)}
className={`p-3 rounded-lg border transition-colors backdrop-blur-sm ${
settingsOpen
? 'bg-[#dd9933] text-black border-[#dd9933]'
: 'bg-gray-100 dark:bg-black/50 border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10'
}`}
title="Settings"
>
<Settings size={20} />
</button>

{/* Close */}
<button
onClick={() => {
if (isGameMode) finalizeGameScore();
onClose();
}}
className="p-3 bg-gray-100 dark:bg-black/50 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-red-500/10 text-gray-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
title="Close"
>
<CloseIcon size={20} />
</button>
</div>
</div>

{/* SETTINGS POPUP */}
{settingsOpen && (
<div className="absolute top-24 right-4 bg-white/90 dark:bg-black/80 p-4 rounded-lg border border-gray-200 dark:border-white/10 backdrop-blur-md w-80 z-30 space-y-4 animate-in fade-in slide-in-from-top-4 shadow-xl">
{/* Game mode */}
<div className="flex justify-between items-center">
<label className="text-xs font-bold flex items-center gap-2">
<Atom size={14} /> Modo Game
</label>
<button
onClick={() => {
setIsGameMode(v => {
const next = !v;
if (v && !next) finalizeGameScore();
return next;
});
resetZoom();
}}
className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
isGameMode ? 'bg-[#dd9933]' : 'bg-gray-200 dark:bg-tech-700'
}`}
>
<span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isGameMode ? 'translate-x-6' : 'translate-x-1'}`} />
</button>
</div>

{/* Num coins */}
<div className="space-y-2">
<label className="text-xs font-bold flex items-center gap-2">
<Coins size={14} /> # Moedas
</label>
<select
value={numCoins}
onChange={e => setNumCoins(parseInt(e.target.value))}
className="w-full bg-gray-100 dark:bg-[#2f3032] text-gray-900 dark:text-gray-100 p-2 rounded text-xs border border-gray-200 dark:border-white/10 outline-none"
>
{[50, 100, 150, 200, 250].map(n => (
<option key={n} value={n}>{n} Moedas</option>
))}
</select>
</div>

{/* Separated sliders */}
<div className="space-y-2">
<label className="text-xs font-bold flex items-center gap-2">
<Wind size={14} /> Flutuação (Mapa)
</label>
<input
type="range"
min="0"
max="1"
step="0.05"
value={floatStrength}
onChange={e => setFloatStrength(parseFloat(e.target.value))}
className="w-full accent-[#dd9933]"
disabled={isGameMode}
/>
<p className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold">
0% = parado. Máximo = +30% amplitude.
</p>
</div>

<div className="space-y-2">
<label className="text-xs font-bold flex items-center gap-2">
<FastForward size={14} /> Velocidade (Mapa)
</label>
<input
type="range"
min="0"
max="1"
step="0.05"
value={motionSpeed}
onChange={e => setMotionSpeed(parseFloat(e.target.value))}
className="w-full accent-[#dd9933]"
disabled={isGameMode}
/>
<p className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold">
No modo game a velocidade fica travada em 20%.
</p>
</div>

<div className="space-y-2">
<label className="text-xs font-bold flex items-center gap-2">
<Droplets size={14} /> Rastro (Trail)
</label>
<input
type="range"
min="0"
max="50"
step="1"
value={trailLength}
onChange={e => setTrailLength(parseInt(e.target.value))}
className="w-full accent-[#dd9933]"
disabled={isGameMode}
/>
</div>
</div>
)}

{/* RANKING MODAL */}
{rankOpen && (
<div className="absolute top-24 right-4 bg-white/90 dark:bg-black/80 p-4 rounded-lg border border-gray-200 dark:border-white/10 backdrop-blur-md w-80 z-30 shadow-xl">
<div className="flex items-center justify-between mb-3">
<div className="text-sm font-black flex items-center gap-2">
<Trophy size={16} className="text-[#dd9933]" /> Ranking (local)
</div>
<button
onClick={() => setRankOpen(false)}
className="p-2 rounded hover:bg-black/5 dark:hover:bg-white/10"
>
<CloseIcon size={16} />
</button>
</div>

<div className="text-xs text-gray-600 dark:text-gray-300 font-semibold mb-2">
Seu nome no ranking: <span className="font-black text-gray-900 dark:text-white">{getLocalDisplayName()}</span>
</div>

<div className="space-y-2">
{leaderboard.length === 0 && (
<div className="text-xs text-gray-500 dark:text-gray-400">
Sem registros ainda. Jogue uma rodada e encaçape bolas.
</div>
)}
{leaderboard.map((e, idx) => (
<div key={e.name + idx} className="flex justify-between items-center text-xs font-bold bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded px-2 py-2">
<span className="truncate max-w-[190px]">{idx + 1}. {e.name}</span>
<span className="text-[#dd9933]">{e.best}</span>
</div>
))}
</div>
</div>
)}

{/* CANVAS */}
<div className="flex-1 w-full relative cursor-crosshair overflow-hidden">
<canvas
ref={canvasRef}
onMouseMove={handleMouseMove}
onMouseDown={handleMouseDown}
onMouseUp={handleMouseUp}
onMouseLeave={() => { setHoveredParticle(null); handleMouseUp(); }}
onWheel={handleWheel}
className="absolute inset-0 w-full h-full block"
/>
</div>
</div>
);
};

export default MarketWindSwarm;
