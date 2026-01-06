import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

// ========================
// GAME CONFIG
// ========================
const GAME_BALL_RADIUS = 26;
const GAME_CUE_RADIUS = 34;
const GAME_WALL_PAD = 14;

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
  const [numCoins, setNumCoins] = useState(50);

  const [floatStrengthRaw, setFloatStrengthRaw] = useState(0.5);
  const [trailLength, setTrailLength] = useState(25);

  const [cuePowerRaw, setCuePowerRaw] = useState(0.5);

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  // Detail panel
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCoin, setDetailCoin] = useState<ApiCoin | null>(null);

  // Transform
  const transformRef = useRef({ k: 1, x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ clientX: 0, clientY: 0, x: 0, y: 0 });
  const draggedParticleRef = useRef<Particle | null>(null);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

  // aiming
  const aimingRef = useRef<{
    active: boolean;
    holdStart: number;
    targetX: number;
    targetY: number;
    pull: number;
  }>({ active: false, holdStart: 0, targetX: 0, targetY: 0, pull: 0 });

  const cueHideUntilRef = useRef<number>(0);

  const watermarkRef = useRef<HTMLImageElement | null>(null);

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

        aimingRef.current.active = false;
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

  const getCoinPerf = useCallback((coin: any) => computeSparkChange(coin, timeframe), [timeframe]);
  const getCoinPerfPct = useCallback((coin: any) => getCoinPerf(coin).pct, [getCoinPerf]);
  const getCoinAbsPct = useCallback((coin: any) => getCoinPerf(coin).absPct, [getCoinPerf]);

  const sizeMetricPerf = useCallback((coin: any) => {
    const absPct = Math.max(0, getCoinAbsPct(coin));
    const vol = Math.max(0, Number(coin?.total_volume) || 0);
    const volFactor = Math.log10(vol + 1);
    return absPct * volFactor;
  }, [getCoinAbsPct]);

  const recomputeStatsAndTargets = useCallback((coinsList: ApiCoin[], mode: ChartMode) => {
    const topCoins = coinsList.slice(0, numCoins);
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

    const coinMap = new Map(topCoins.map(c => [c.id, c] as const));
    for (const p of particlesRef.current) {
      const updated = coinMap.get(p.id);
      if (updated) p.coin = updated;

      const pct = getCoinPerfPct(p.coin) || 0;
      const baseColor = pct >= 0 ? '#089981' : '#f23645';
      const isBTC = String(p.coin.id).toLowerCase() === 'bitcoin';

      let metric = 1;
      if (mode === 'performance') metric = Math.max(0.000001, sizeMetricPerf(p.coin));
      else metric = Math.max(1, Number(p.coin.market_cap) || 1);

      const rrMin = minR;
      const rrMax = maxR;
      const t = (metric - rrMin) / (rrMax - rrMin || 1);
      const targetRadius = 15 + clamp(t, 0, 1) * 55;

      if (!isGameMode) {
        p.targetRadius = targetRadius;
        p.mass = Math.max(1, p.targetRadius);
      }

      p.color = isBTC ? '#ffffff' : baseColor;
    }
  }, [getCoinPerfPct, numCoins, sizeMetricPerf, isGameMode]);

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
      p.vx = 0;
      p.vy = 0;
      p.trail = [];
      p.isFixed = false;
      p.isFalling = false;
      p.fallT = 0;
      p.fallPocket = null;

      const yVal = Math.max(1, Number(p.coin.total_volume) || 1);
      let xVal = 0;

      if (chartMode === 'performance') xVal = getCoinPerfPct(p.coin) || 0;
      else xVal = Math.max(1, Number(p.coin.market_cap) || 1);

      p.x = projectX(xVal);
      p.y = projectY(yVal);
    }
  }, [chartMode, getCoinPerfPct]);

  // init + resize
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

  // global mouseup (shot)
  useEffect(() => {
    const up = () => handleMouseUp();
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================
  // IMPORTANT: build particles ONLY when coins/numCoins changes
  // (this fixes the "wipe/reposition on chart switch")
  // =========================
  useEffect(() => {
    const topCoins = coins.slice(0, numCoins);
    if (topCoins.length === 0) return;

    for (const c of topCoins) {
      if (c?.image && !imageCache.current.has(c.image)) {
        const img = new Image();
        img.src = c.image;
        imageCache.current.set(c.image, img);
      }
    }

    const existingMap = new Map(particlesRef.current.map(p => [p.id, p] as const));
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
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 60,
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

    // stats/targets update after rebuild
    recomputeStatsAndTargets(coins, chartMode);
  }, [coins, numCoins, recomputeStatsAndTargets, chartMode]);

  // when chartMode or timeframe changes: DO NOT rebuild particles, only update targets/colors
  useEffect(() => {
    if (coins.length === 0) return;
    recomputeStatsAndTargets(coins, chartMode);
  }, [chartMode, timeframe, coins, recomputeStatsAndTargets]);

  // enter/exit game
  useEffect(() => {
    if (isGameMode) {
      resetZoom();
      setDetailOpen(false);
      setSelectedParticle(null);
      setHoveredParticle(null);

      aimingRef.current.active = false;
      aimingRef.current.pull = 0;

      cueHideUntilRef.current = 0;

      setupGameLayout();
    } else {
      resetZoom();
      setDetailOpen(false);
      setSettingsOpen(false);
      setLegendTipOpen(false);

      aimingRef.current.active = false;
      aimingRef.current.pull = 0;

      if (draggedParticleRef.current) {
        draggedParticleRef.current.isFixed = false;
        draggedParticleRef.current = null;
      }

      snapBackToMap();
    }
  }, [isGameMode, resetZoom, setupGameLayout, snapBackToMap]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current; if (!canvas) return;

    const wpos = screenToWorld(e.clientX, e.clientY);
    const worldMouseX = wpos.x;
    const worldMouseY = wpos.y;

    lastMousePosRef.current = { x: worldMouseX, y: worldMouseY };

    if (isGameMode && aimingRef.current.active) {
      const now = performance.now();
      const held = now - aimingRef.current.holdStart;
      const maxPull = 190;
      aimingRef.current.pull = clamp((held / 900) * maxPull, 0, maxPull);
      return;
    }

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

    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
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
    setDetailOpen(true);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (detailOpenRef.current) return;

    if (isGameMode) {
      if (e.button !== 0) return;

      const cue = particlesRef.current.find(pp => String(pp.coin.id).toLowerCase() === 'bitcoin');
      if (!cue || cue.isFalling) return;

      const w = screenToWorld(e.clientX, e.clientY);

      aimingRef.current.active = true;
      aimingRef.current.holdStart = performance.now();
      aimingRef.current.targetX = w.x;
      aimingRef.current.targetY = w.y;
      aimingRef.current.pull = 0;

      setSelectedParticle(cue);
      return;
    }

    if (hoveredParticleRef.current) {
      openDetailFor(hoveredParticleRef.current);
      return;
    }

    isPanningRef.current = true;
    panStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      x: transformRef.current.x,
      y: transformRef.current.y
    };
  };

  const handleMouseUp = () => {
    if (isGameMode && aimingRef.current.active) {
      const cue = particlesRef.current.find(pp => String(pp.coin.id).toLowerCase() === 'bitcoin');
      if (cue && !cue.isFalling) {
        const tx = aimingRef.current.targetX;
        const ty = aimingRef.current.targetY;

        const dx = tx - cue.x;
        const dy = ty - cue.y;
        const dist = Math.hypot(dx, dy) || 0.0001;

        const nx = dx / dist;
        const ny = dy / dist;

        const pull = aimingRef.current.pull;
        const pullNorm = clamp(pull / 190, 0, 1);

        const basePower = 2800;
        const power = basePower * pullNorm * (0.35 + cuePowerRaw * 1.65);

        cue.vx += nx * (power / Math.max(1, cue.mass));
        cue.vy += ny * (power / Math.max(1, cue.mass));

        cueHideUntilRef.current = performance.now() + 5000;
      }

      aimingRef.current.active = false;
      aimingRef.current.pull = 0;
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
          <div><span className="font-black">Modo Game (Bilhar)</span></div>
          <div>• A bola branca é o BTC.</div>
          <div>• Clique no alvo (onde você quer que a bola vá).</div>
          <div>• Segure o botão esquerdo para puxar o taco (mais força).</div>
          <div>• Solte para tacar.</div>
          <div>• Após tacar, o taco some por 5s.</div>
        </>
      );
    }

    if (chartMode === 'performance') {
      return (
        <>
          <div><span className="font-black">Modo Variação</span></div>
          <div>• X: Variação de preço {timeframe} (%)</div>
          <div>• Y: Volume 24h (log)</div>
          <div>• Tamanho: |%var {timeframe}| × log(volume)</div>
          <div>• Cor: verde/vermelho pela variação</div>
        </>
      );
    }

    return (
      <>
        <div><span className="font-black">Modo Market Cap</span></div>
        <div>• X: Market Cap (log)</div>
        <div>• Y: Volume 24h (log)</div>
        <div>• Tamanho: Market Cap</div>
        <div>• Cor: verde/vermelho pela variação</div>
      </>
    );
  }, [chartMode, timeframe, isGameMode]);

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

    let lastTime = performance.now();

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

      let tx = cx + 120;
      let ty = cy;

      if (aimingRef.current.active) {
        tx = toScreenX(aimingRef.current.targetX);
        ty = toScreenY(aimingRef.current.targetY);
      } else if (lastMousePosRef.current) {
        tx = toScreenX(lastMousePosRef.current.x);
        ty = toScreenY(lastMousePosRef.current.y);
      } else {
        tx = cx + Math.cos(now * 0.0006) * 140;
        ty = cy + Math.sin(now * 0.0006) * 140;
      }

      const dx = tx - cx;
      const dy = ty - cy;
      const dist = Math.hypot(dx, dy) || 0.0001;

      const ux = dx / dist;
      const uy = dy / dist;

      const contactGap = 12;
      const pullBase = aimingRef.current.active ? aimingRef.current.pull : (10 + Math.sin(now * 0.0022) * 6);
      const pull = pullBase;

      const tipX = cx - ux * (cueBall.radius + contactGap + pull);
      const tipY = cy - uy * (cueBall.radius + contactGap + pull);

      const stickLen = Math.max(260, cueBall.radius * 7.5);
      const buttX = tipX - ux * stickLen;
      const buttY = tipY - uy * stickLen;

      const thick = Math.max(8, cueBall.radius * 0.40);
      const tipThick = Math.max(5, thick * 0.55);

      ctx2.save();
      ctx2.globalAlpha = 0.92;
      ctx2.lineCap = 'round';

      // body
      ctx2.beginPath();
      ctx2.moveTo(buttX, buttY);
      ctx2.lineTo(tipX, tipY);
      ctx2.strokeStyle = isDarkTheme ? 'rgba(210,170,120,0.78)' : 'rgba(120,85,45,0.72)';
      ctx2.lineWidth = thick;
      ctx2.stroke();

      // tip
      const tipLen = Math.min(30, stickLen * 0.12);
      ctx2.beginPath();
      ctx2.moveTo(tipX - ux * tipLen, tipY - uy * tipLen);
      ctx2.lineTo(tipX, tipY);
      ctx2.strokeStyle = isDarkTheme ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.78)';
      ctx2.lineWidth = tipThick;
      ctx2.stroke();

      ctx2.restore();
    };

    const drawAimMarker = (
      ctx2: CanvasRenderingContext2D,
      toScreenX: (v: number) => number,
      toScreenY: (v: number) => number,
      isDarkTheme: boolean
    ) => {
      if (!aimingRef.current.active) return;
      const sx = toScreenX(aimingRef.current.targetX);
      const sy = toScreenY(aimingRef.current.targetY);

      ctx2.save();
      ctx2.globalAlpha = 0.9;
      ctx2.strokeStyle = isDarkTheme ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)';
      ctx2.lineWidth = 2;

      ctx2.beginPath();
      ctx2.arc(sx, sy, 10, 0, Math.PI * 2);
      ctx2.stroke();

      ctx2.beginPath();
      ctx2.moveTo(sx - 16, sy);
      ctx2.lineTo(sx + 16, sy);
      ctx2.stroke();

      ctx2.beginPath();
      ctx2.moveTo(sx, sy - 16);
      ctx2.lineTo(sx, sy + 16);
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

      const particles = particlesRef.current;

      for (const p of particles) {
        const viewRadius = p.targetRadius * Math.pow(k, 0.25);
        p.radius += (viewRadius - p.radius) * 0.15;
        p.mass = Math.max(1, p.radius);
      }

      // GAME pockets
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

        drawAimMarker(ctx, toScreenX, toScreenY, isDark);
      }

      // MAP axes
      if (!isGameMode && statsRef.current) {
        const s = statsRef.current;

        const margin = { top: 18, right: 18, bottom: 92, left: 86 };
        const chartW = Math.max(50, width - margin.left - margin.right);
        const chartH = Math.max(50, height - margin.top - margin.bottom);

        const originX = margin.left;
        const originY = margin.top + chartH;

        const xSteps = 6;

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

        const projectY = (v: number) => {
          if (v <= 0) return originY;
          const norm = (Math.log10(v) - s.logMinY) / (s.logMaxY - s.logMinY || 1);
          return margin.top + (1 - norm) * chartH;
        };

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

        const xLabel = chartMode === 'performance'
          ? `Variação de preço ${timeframe} (%)`
          : 'Market Cap (Log)';
        const xLabelY = clamp(toScreenY(originY) + 56, 20, height - 10);
        ctx.fillText(xLabel, width / 2, xLabelY);

        ctx.save();
        ctx.translate(18, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Volume 24h (Log)', 0, 0);
        ctx.restore();

        ctx.restore();
      }

      // =======================
      // PHYSICS / MAPPING
      // =======================
      if (isGameMode) {
        const subSteps = 3;
        const stepDt = dt / subSteps;

        const worldW = width / k;
        const worldH = height / k;

        const dampingPerFrame = 0.985;
        const stopEps = 0.8;

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

              const restitution = 0.96;
              let impulse = -(1 + restitution) * velAlongNormal;
              impulse /= (1 / p1.mass + 1 / p2.mass);

              const impulseX = impulse * nx;
              const impulseY = impulse * ny;

              if (!p1.isFixed) { p1.vx -= impulseX / p1.mass; p1.vy -= impulseY / p1.mass; }
              if (!p2.isFixed) { p2.vx += impulseX / p2.mass; p2.vy += impulseY / p2.mass; }
            }
          }

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
      // DRAW PARTICLES
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

      // Draw cue stick LAST so it stays visible and never "under the ball"
      if (isGameMode) {
        const cueBall = particlesRef.current.find(p => String(p.coin.id).toLowerCase() === 'bitcoin');
        if (cueBall) drawCueStick(ctx, cueBall, now, toScreenX, toScreenY, k, isDark);
      }

      reqIdRef.current = requestAnimationFrame(loop);
    };

    reqIdRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(reqIdRef.current);
  }, [isDark, chartMode, isGameMode, timeframe, floatStrengthRaw, trailLength, searchTerm, getCoinPerfPct, cuePowerRaw]);

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
            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold">{status === 'demo' ? 'MODO DEMO' : isGameMode ? 'MODO GAME' : 'MODO MAPA'}</p>
          </div>

          <div className="w-px h-8 bg-gray-200 dark:bg-white/10 mx-4"></div>

          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 dark:bg-black/50 p-1 rounded-lg border border-gray-200 dark:border-white/10">
              <button
                onClick={() => setChartMode('valuation')}
                className={`px-4 py-1.5 text-xs font-black rounded transition-colors ${chartMode === 'valuation' ? 'bg-white dark:bg-[#2f3032] shadow text-[#dd9933]' : 'text-gray-500 dark:text-gray-300'}`}
              >
                Market Cap
              </button>
            </div>

            <div className="flex items-center bg-gray-100 dark:bg-black/50 p-1 rounded-lg border border-gray-200 dark:border-white/10">
              <button
                onClick={() => setChartMode('performance')}
                className={`px-4 py-1.5 text-xs font-black rounded transition-colors ${chartMode === 'performance' ? 'bg-white dark:bg-[#2f3032] shadow text-[#dd9933]' : 'text-gray-500 dark:text-gray-300'}`}
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
                >
                  <option value="1h">1h</option>
                  <option value="24h">24h</option>
                  <option value="7d">7d</option>
                </select>
              </div>
            </div>
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

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Coins size={14} />
              <span className="text-xs font-black uppercase tracking-wider"># Moedas</span>
            </div>

            <select
              value={numCoins}
              onChange={e => setNumCoins(parseInt(e.target.value))}
              className="bg-white dark:bg-[#2f3032] text-gray-900 dark:text-gray-100 px-2 py-1.5 rounded text-xs border border-gray-200 dark:border-white/10 outline-none"
              onWheel={(e) => e.stopPropagation()}
            >
              {[50, 100, 150, 200, 250].map(n => <option key={n} value={n}>{n} moedas</option>)}
            </select>
          </div>

          <div className="mt-4 space-y-4">
            <div className={isGameMode ? 'opacity-50' : ''}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Wind size={14} />
                  <span className="text-xs font-black uppercase tracking-wider">Flutuação (Mapa)</span>
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

            <div className={isGameMode ? '' : 'opacity-50'}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Atom size={14} />
                  <span className="text-xs font-black uppercase tracking-wider">Força da Tacada</span>
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
                disabled={!isGameMode}
              />
            </div>
          </div>
        </div>
      )}

      {/* DETAIL PANEL */}
      {detailOpen && detailCoin && (
        <div
          className="absolute inset-0 z-[60] flex items-center justify-center bg-black/45"
          onMouseDown={() => setDetailOpen(false)}
        >
          <div
            className="w-[92vw] max-w-[560px] rounded-2xl border border-gray-200 dark:border-white/10 bg-white/95 dark:bg-black/80 backdrop-blur-md shadow-2xl p-5"
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
                onClick={() => setDetailOpen(false)}
                className="p-2 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 border border-gray-200 dark:border-white/10"
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
