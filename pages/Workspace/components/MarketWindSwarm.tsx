import * as React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ApiCoin, Language } from '../../../types';
import { Search, XCircle, Settings, Droplets, X as CloseIcon, Atom, Coins, Maximize, Wind, Info, Volume2 } from 'lucide-react';
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

// ========================
// SOCIALS (SUAS REDES)
// ========================
const SITE_SOCIALS: { id: string; label: string; href: string }[] = [
  { id: 'site', label: 'Site', href: 'https://centralcrypto.com.br' },
  // Preenche do seu jeito (sem choro):
  // { id: 'x', label: 'X', href: 'https://x.com/SEUUSER' },
  // { id: 'tg', label: 'Telegram', href: 'https://t.me/SEUCANAL' },
  // { id: 'ig', label: 'Instagram', href: 'https://instagram.com/SEUUSER' },
  // { id: 'yt', label: 'YouTube', href: 'https://youtube.com/@SEUCANAL' },
  // { id: 'tt', label: 'TikTok', href: 'https://tiktok.com/@SEUUSER' },
];

// ========================
// AUDIO (coloque os arquivos na mesma pasta do widget)
// ========================
const SFX_CUE_HIT = '/widgets/sfx-cue-hit.wav';
const SFX_POCKET = '/widgets/sfx-pocket.wav';

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

  const [floatStrengthRaw, setFloatStrengthRaw] = useState(1.0); // default 100%
  const [trailLength, setTrailLength] = useState(25);

  const [cuePowerRaw, setCuePowerRaw] = useState(0.65);

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  // Detail panel
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCoin, setDetailCoin] = useState<ApiCoin | null>(null);
  const [detailSeq, setDetailSeq] = useState(0);

  // Transform
  const transformRef = useRef({ k: 1, x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ clientX: 0, clientY: 0, x: 0, y: 0 });
  const draggedParticleRef = useRef<Particle | null>(null);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

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

  // GAME STATE: potted balls persist in this session
  const pottedIdsRef = useRef<Set<string>>(new Set());
  const totalBallsRef = useRef<number>(0);
  const pottedCountRef = useRef<number>(0);

  // AUDIO
  const audioRef = useRef<{ cue?: HTMLAudioElement; pocket?: HTMLAudioElement } | null>(null);
  useEffect(() => {
    audioRef.current = {
      cue: new Audio(SFX_CUE_HIT),
      pocket: new Audio(SFX_POCKET)
    };
    if (audioRef.current.cue) audioRef.current.cue.volume = 0.85;
    if (audioRef.current.pocket) audioRef.current.pocket.volume = 0.85;
  }, []);

  const playCue = useCallback(() => {
    try {
      const a = audioRef.current?.cue;
      if (!a) return;
      a.currentTime = 0;
      void a.play();
    } catch {}
  }, []);

  const playPocket = useCallback(() => {
    try {
      const a = audioRef.current?.pocket;
      if (!a) return;
      a.currentTime = 0;
      void a.play();
    } catch {}
  }, []);

  // ==========================================
  // TWO-CLICK AIMING MECHANIC (GAME)
  // ==========================================
  // Phase 0: idle
  // Phase 1: aiming direction (mouse down rotates, mouse up locks dir and shows pulsating marker)
  // Phase 2: power set (mouse down controls pull distance by forward/back; mouse up shoots)
  const aim2Ref = useRef<{
    phase: 0 | 1 | 2;
    dirAngle: number;
    lockedTargetX: number;
    lockedTargetY: number;
    anchorX: number;
    anchorY: number;
    powerPull: number; // 0..1
    activeHold: boolean;
  }>({ phase: 0, dirAngle: 0, lockedTargetX: 0, lockedTargetY: 0, anchorX: 0, anchorY: 0, powerPull: 0, activeHold: false });

  const cueHideUntilRef = useRef<number>(0);

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

        aim2Ref.current.phase = 0;
        aim2Ref.current.activeHold = false;
        aim2Ref.current.powerPull = 0;

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

  // LOG scaling for marketcap sizes (big guys proportional, small guys compressed)
  const sizeMetricMcapLog = useCallback((coin: any) => {
    const mc = Math.max(1, Number(coin?.market_cap) || 1);
    return Math.log10(mc);
  }, []);

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
        rData.push(Math.max(0.000001, sizeMetricMcapLog(c)));
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
      else metric = Math.max(0.000001, sizeMetricMcapLog(p.coin));

      const rrMin = minR;
      const rrMax = maxR;
      const t = (metric - rrMin) / (rrMax - rrMin || 1);

      // bigger range so it fills space better
      const targetRadius = 16 + clamp(t, 0, 1) * 72;

      if (!isGameMode) {
        p.targetRadius = targetRadius;
        p.mass = Math.max(1, p.targetRadius);
      }

      p.color = isBTC ? '#ffffff' : baseColor;
    }
  }, [getCoinPerfPct, numCoins, sizeMetricPerf, sizeMetricMcapLog, isGameMode]);

  const setupGameLayout = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // reset session state
    pottedIdsRef.current = new Set();
    pottedCountRef.current = 0;

    const dpr = dprRef.current || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    const w = width;
    const h = height;

    const cue = particlesRef.current.find(p => String(p.coin.id).toLowerCase() === 'bitcoin');

    const others = particlesRef.current
      .filter(p => String(p.coin.id).toLowerCase() !== 'bitcoin')
      .sort((a, b) => (Number(a.coin.market_cap_rank) || 99999) - (Number(b.coin.market_cap_rank) || 99999));

    // max 50 balls in game
    const limitedOthers = others.slice(0, Math.max(0, Math.min(49, numCoins - 1)));

    totalBallsRef.current = limitedOthers.length;

    // keep only cue + limited set
    particlesRef.current = [
      ...(cue ? [cue] : []),
      ...limitedOthers
    ];

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

    const N = limitedOthers.length;
    let rows = 1;
    while ((rows * (rows + 1)) / 2 < N) rows++;

    let idx = 0;
    for (let r = 0; r < rows; r++) {
      const ballsInRow = r + 1;
      const rowX = rackApexX + r * spacing;
      const rowYStart = rackApexY - (r * spacing) / 2;

      for (let c = 0; c < ballsInRow; c++) {
        if (idx >= limitedOthers.length) break;
        const p = limitedOthers[idx++];
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

    // reset aim
    aim2Ref.current.phase = 0;
    aim2Ref.current.activeHold = false;
    aim2Ref.current.powerPull = 0;
    cueHideUntilRef.current = 0;
  }, [numCoins]);

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

  const resetZoom = useCallback(() => {
    transformRef.current = { k: 1, x: 0, y: 0 };
    isPanningRef.current = false;
    draggedParticleRef.current = null;

    if (!isGameMode && !isFreeMode) {
      snapBackToMap();
    }
  }, [isGameMode, isFreeMode, snapBackToMap]);

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

  // global mouseup
  useEffect(() => {
    const up = () => handleMouseUpGlobal();
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build particles ONLY when coins/numCoins changes (but DO NOT rebuild during game)
  useEffect(() => {
    if (coins.length === 0) return;

    // preload images
    const topCoins = coins.slice(0, numCoins);
    for (const c of topCoins) {
      if (c?.image && !imageCache.current.has(c.image)) {
        const img = new Image();
        img.src = c.image;
        imageCache.current.set(c.image, img);
      }
    }

    // during game: only refresh coin references, do not rebuild/reset physics/layout
    if (isGameMode) {
      const map = new Map<string, ApiCoin>(coins.map(c => [c.id, c]));
      for (const p of particlesRef.current) {
        const updated = map.get(p.id);
        if (updated) p.coin = updated;
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

    recomputeStatsAndTargets(coins, chartMode);
  }, [coins, numCoins, recomputeStatsAndTargets, chartMode, isGameMode]);

  // update targets/colors on mode/timeframe change
  useEffect(() => {
    if (coins.length === 0) return;
    if (isGameMode) return;
    recomputeStatsAndTargets(coins, chartMode);
  }, [chartMode, timeframe, coins, recomputeStatsAndTargets, isGameMode]);

  // enter/exit game
  useEffect(() => {
    if (isGameMode) {
      // entering game disables free mode
      setIsFreeMode(false);

      resetZoom();
      setDetailOpen(false);
      setSelectedParticle(null);
      setHoveredParticle(null);

      setupGameLayout();
    } else {
      // leaving game: rebuild map positions
      resetZoom();
      setDetailOpen(false);
      setSettingsOpen(false);
      setLegendTipOpen(false);

      // restore full set (coins change effect rebuilds map particles)
      pottedIdsRef.current = new Set();
      pottedCountRef.current = 0;

      snapBackToMap();
    }
  }, [isGameMode, resetZoom, setupGameLayout, snapBackToMap]);

  // if free mode toggled on, disable game and reset
  useEffect(() => {
    if (isFreeMode) {
      setIsGameMode(false);
      resetZoom();
      setDetailOpen(false);
      setSelectedParticle(null);
      setHoveredParticle(null);

      // give them a nice spread
      const stage = stageRef.current;
      if (stage) {
        const w = stage.clientWidth || 1200;
        const h = stage.clientHeight || 800;
        for (const p of particlesRef.current) {
          p.x = Math.random() * w;
          p.y = Math.random() * h;
          p.vx = (Math.random() - 0.5) * 220;
          p.vy = (Math.random() - 0.5) * 220;
          p.trail = [];
        }
      }
    } else {
      // returning to map
      if (!isGameMode) {
        resetZoom();
        snapBackToMap();
      }
    }
  }, [isFreeMode, isGameMode, resetZoom, snapBackToMap]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current; if (!canvas) return;

    const wpos = screenToWorld(e.clientX, e.clientY);
    const worldMouseX = wpos.x;
    const worldMouseY = wpos.y;

    lastMousePosRef.current = { x: worldMouseX, y: worldMouseY };

    // GAME: update aim only while holding in phase 1 or 2
    if (isGameMode && aim2Ref.current.activeHold) {
      const cue = particlesRef.current.find(pp => String(pp.coin.id).toLowerCase() === 'bitcoin');
      if (!cue || cue.isFalling) return;

      if (aim2Ref.current.phase === 1) {
        // rotate: direction = from cue -> mouse
        const dx = worldMouseX - cue.x;
        const dy = worldMouseY - cue.y;
        aim2Ref.current.dirAngle = Math.atan2(dy, dx);
        aim2Ref.current.lockedTargetX = worldMouseX;
        aim2Ref.current.lockedTargetY = worldMouseY;
        return;
      }

      if (aim2Ref.current.phase === 2) {
        // power: based on mouse move forward/back relative to anchor vector
        const ax = aim2Ref.current.anchorX;
        const ay = aim2Ref.current.anchorY;
        const mx = worldMouseX;
        const my = worldMouseY;

        const dx = mx - ax;
        const dy = my - ay;

        // project on aim direction
        const ux = Math.cos(aim2Ref.current.dirAngle);
        const uy = Math.sin(aim2Ref.current.dirAngle);
        const along = dx * ux + dy * uy;

        // pull back = negative along gives more power
        const maxBack = 220;
        const pull = clamp((-along) / maxBack, 0, 1);

        aim2Ref.current.powerPull = pull;
        return;
      }
    }

    if (draggedParticleRef.current) {
      const p = draggedParticleRef.current;
      p.x = worldMouseX;
      p.y = worldMouseY;
      return;
    }

    if (!isGameMode && !isFreeMode && isPanningRef.current) {
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

  const openDetailFor = useCallback((p: Particle) => {
    setSelectedParticle(p);
    setDetailCoin(p.coin);
    setDetailOpen(true);
    setDetailSeq(v => v + 1);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (detailOpenRef.current) return;

    // click on empty closes card (requirement)
    if (!hoveredParticleRef.current) {
      setDetailOpen(false);
      setSelectedParticle(null);
    }

    if (isGameMode) {
      if (e.button !== 0) return;

      const cue = particlesRef.current.find(pp => String(pp.coin.id).toLowerCase() === 'bitcoin');
      if (!cue || cue.isFalling) return;

      const w = screenToWorld(e.clientX, e.clientY);

      // Phase logic:
      // If phase 0 or 1 => start/continue aiming direction (hold)
      // If phase 2 => start/continue power hold
      if (aim2Ref.current.phase === 0) {
        aim2Ref.current.phase = 1;
        aim2Ref.current.activeHold = true;
        aim2Ref.current.dirAngle = Math.atan2(w.y - cue.y, w.x - cue.x);
        aim2Ref.current.lockedTargetX = w.x;
        aim2Ref.current.lockedTargetY = w.y;
        aim2Ref.current.powerPull = 0;
        return;
      }

      if (aim2Ref.current.phase === 1) {
        // still aiming: keep holding
        aim2Ref.current.activeHold = true;
        return;
      }

      if (aim2Ref.current.phase === 2) {
        // start holding power
        aim2Ref.current.activeHold = true;
        aim2Ref.current.anchorX = w.x;
        aim2Ref.current.anchorY = w.y;
        return;
      }

      return;
    }

    if (hoveredParticleRef.current) {
      openDetailFor(hoveredParticleRef.current);
      return;
    }

    if (!isGameMode && !isFreeMode) {
      isPanningRef.current = true;
      panStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        x: transformRef.current.x,
        y: transformRef.current.y
      };
    }
  };

  const handleMouseUpGlobal = () => {
    if (isGameMode && aim2Ref.current.activeHold) {
      // releasing in phase 1 locks direction and shows fixed marker
      if (aim2Ref.current.phase === 1) {
        aim2Ref.current.activeHold = false;
        aim2Ref.current.phase = 2; // next click = power set
        // keep locked target
        return;
      }

      // releasing in phase 2 shoots
      if (aim2Ref.current.phase === 2) {
        const cue = particlesRef.current.find(pp => String(pp.coin.id).toLowerCase() === 'bitcoin');
        if (cue && !cue.isFalling) {
          const pullNorm = clamp(aim2Ref.current.powerPull, 0, 1);

          const ux = Math.cos(aim2Ref.current.dirAngle);
          const uy = Math.sin(aim2Ref.current.dirAngle);

          // heavier hit so 100% crosses table
          const basePower = 34000;
          const power = basePower * pullNorm * (0.55 + cuePowerRaw * 1.15);

          cue.vx += ux * (power / Math.max(1, cue.mass));
          cue.vy += uy * (power / Math.max(1, cue.mass));

          cueHideUntilRef.current = performance.now() + 900;
          playCue();
        }

        aim2Ref.current.activeHold = false;
        aim2Ref.current.powerPull = 0;
        aim2Ref.current.phase = 0; // reset cycle
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
          <div className="mt-2 font-bold">Mecânica 2 cliques:</div>
          <div>1) Clique e segure: gira o taco (mira). Solta: trava a direção.</div>
          <div>2) Clique e segure: puxa/empurra o mouse (força). Solta: dispara.</div>
          <div className="mt-2">• Bola branca é o BTC.</div>
          <div>• Encaçapou: sai do jogo nesta sessão.</div>
        </>
      );
    }

    if (isFreeMode) {
      return (
        <>
          <div><span className="font-black">Modo Livre</span></div>
          <div>• Bolhas soltas, com colisão e flutuação.</div>
          <div>• Market Cap / Variação só muda tamanho e cor.</div>
          <div>• Sem escala.</div>
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
        <div>• Tamanho: Market Cap (LOG size)</div>
        <div>• Cor: verde/vermelho pela variação</div>
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

  const pct1h = useMemo(() => {
    const v = Number((detailCoin as any)?.price_change_percentage_1h_in_currency ?? (detailCoin as any)?.price_change_percentage_1h ?? NaN);
    return isFinite(v) ? v : null;
  }, [detailCoin]);

  const pct24h = useMemo(() => {
    const v = Number((detailCoin as any)?.price_change_percentage_24h_in_currency ?? (detailCoin as any)?.price_change_percentage_24h ?? NaN);
    return isFinite(v) ? v : null;
  }, [detailCoin]);

  const pct7d = useMemo(() => {
    const v = Number((detailCoin as any)?.price_change_percentage_7d_in_currency ?? (detailCoin as any)?.price_change_percentage_7d ?? NaN);
    return isFinite(v) ? v : null;
  }, [detailCoin]);

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

      // direction from locked angle; if phase 1 active, use current angle; if phase 2 locked, use locked dirAngle
      const ang = aim2Ref.current.phase === 0
        ? (lastMousePosRef.current ? Math.atan2(toScreenY(lastMousePosRef.current.y) - cy, toScreenX(lastMousePosRef.current.x) - cx) : 0)
        : aim2Ref.current.dirAngle;

      const ux = Math.cos(ang);
      const uy = Math.sin(ang);

      // pull animation: in phase2 show pull according to power; else subtle idle
      const pullNorm = aim2Ref.current.phase === 2 ? aim2Ref.current.powerPull : 0;
      const pull = aim2Ref.current.phase === 2
        ? (12 + pullNorm * 140)
        : (10 + Math.sin(now * 0.0022) * 6);

      // small forward/back animation even when locked dir
      const micro = (aim2Ref.current.phase !== 2) ? Math.sin(now * 0.007) * 4 : 0;

      const contactGap = 12;
      const tipX = cx - ux * (cueBall.radius + contactGap + pull + micro);
      const tipY = cy - uy * (cueBall.radius + contactGap + pull + micro);

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

    const drawLockedAimMarker = (
      ctx2: CanvasRenderingContext2D,
      toScreenX: (v: number) => number,
      toScreenY: (v: number) => number,
      now: number,
      isDarkTheme: boolean
    ) => {
      // show marker when direction locked (phase 2) OR while aiming (phase 1)
      if (!isGameMode) return;
      if (aim2Ref.current.phase !== 1 && aim2Ref.current.phase !== 2) return;

      const sx = toScreenX(aim2Ref.current.lockedTargetX);
      const sy = toScreenY(aim2Ref.current.lockedTargetY);

      const pulse = 1 + Math.sin(now * 0.008) * 0.10;

      ctx2.save();
      ctx2.globalAlpha = 0.9;
      ctx2.strokeSty
