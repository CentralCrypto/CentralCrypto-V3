import * as React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Calendar,
  Clock,
  BarChart2,
  Newspaper,
  Link as LinkIcon
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
  trail: { x: number, y: number, age: number }[];
  phase: number;
  isFixed?: boolean;
  mass: number;

  // game
  isFalling?: boolean;
  fallT?: number;
  fallPocket?: { x: number; y: number; r: number } | null;
  fallFromX?: number;
  fallFromY?: number;
  isPocketed?: boolean;

  // tween map transition
  tweenActive?: boolean;
  tweenStart?: number;
  tweenDur?: number;
  tweenFromX?: number;
  tweenFromY?: number;
  tweenToX?: number;
  tweenToY?: number;
}

type ChartMode = 'performance' | 'valuation';
type Status = 'loading' | 'running' | 'demo' | 'error';
type Timeframe = '1h' | '24h' | '7d';

interface MarketWindSwarmProps { language: Language; onClose: () => void; }

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(val, max));

const easeInOutCubic = (t: number) => t < 0.5
  ? 4 * t * t * t
  : 1 - Math.pow(-2 * t + 2, 3) / 2;

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
  if (Math.abs(n) < 0.01) return `$${n.toPrecision(3)}`;
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtPct = (v?: number) => {
  const n = Number(v);
  if (!isFinite(n)) return '-';
  return `${n.toFixed(2)}%`;
};

const pctColor = (v?: number) => {
  const n = Number(v);
  if (!isFinite(n) || n === 0) return '#9aa4b2';
  return n > 0 ? '#089981' : '#f23645';
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
// WATERMARK
// ========================
const WATERMARK_LOCAL = '/logo2-transp.png';
const WATERMARK_REMOTE = '';

// ========================
// MAGAZINE (WordPress REST)
// ========================
const MAGAZINE_API_BASE = '/magazine/wp-json/wp/v2';
const MAGAZINE_POSTS_ENDPOINT = `${MAGAZINE_API_BASE}/posts?per_page=6&_embed=1&orderby=date&order=desc`;

type MagazinePost = {
  id: number;
  link: string;
  date: string;
  title: { rendered: string };
  excerpt?: { rendered: string };
  _embedded?: any;
};

const stripHtml = (html: string) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

const safeTitle = (s: string) => stripHtml(s || '').slice(0, 120);

const pickFeatured = (p: MagazinePost): string | null => {
  try {
    const media = p?._embedded?.['wp:featuredmedia']?.[0];
    const sizes = media?.media_details?.sizes;
    const url =
      sizes?.medium?.source_url ||
      sizes?.thumbnail?.source_url ||
      media?.source_url ||
      null;
    return url;
  } catch {
    return null;
  }
};

// ========================
// SOCIAL ICONS (inline SVG)
// ========================
const SocialIcon = ({ type }: { type: string }) => {
  const cls = "w-5 h-5";
  if (type === 'website') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Z" stroke="currentColor" strokeWidth="2"/>
        <path d="M2 12h20" stroke="currentColor" strokeWidth="2"/>
        <path d="M12 2c2.7 2.9 4 6.2 4 10s-1.3 7.1-4 10c-2.7-2.9-4-6.2-4-10s1.3-7.1 4-10Z" stroke="currentColor" strokeWidth="2"/>
      </svg>
    );
  }
  if (type === 'x') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none">
        <path d="M18.9 3H22l-6.8 7.8L23 21h-6.2l-4.9-6.4L6 21H3l7.4-8.5L1 3h6.4l4.4 5.8L18.9 3Z" fill="currentColor"/>
      </svg>
    );
  }
  if (type === 'telegram') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none">
        <path d="M21.8 4.6 19 20.2c-.2 1.1-.8 1.4-1.6.9l-4.5-3.3-2.2 2.1c-.2.2-.4.4-.8.4l.3-4.9 8.9-8c.4-.4-.1-.6-.6-.2l-11 6.9-4.7-1.5c-1-.3-1-1 .2-1.5L20 3.8c.9-.3 1.7.2 1.8.8Z" fill="currentColor"/>
      </svg>
    );
  }
  if (type === 'github') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none">
        <path fill="currentColor" d="M12 .6a11.4 11.4 0 0 0-3.6 22.2c.6.1.8-.2.8-.6v-2.1c-3.2.7-3.9-1.4-3.9-1.4-.5-1.2-1.2-1.6-1.2-1.6-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 1.7 2.7 1.2 3.3.9.1-.7.4-1.2.7-1.5-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.2 0 4.5-2.7 5.5-5.3 5.8.4.3.8 1 .8 2.1v3.1c0 .4.2.7.8.6A11.4 11.4 0 0 0 12 .6Z"/>
      </svg>
    );
  }
  if (type === 'instagram') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none">
        <path fill="currentColor" d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9A5.5 5.5 0 0 1 16.5 22h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9Zm10.3 1.8a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/>
      </svg>
    );
  }
  if (type === 'youtube') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none">
        <path fill="currentColor" d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.8 4.7 12 4.7 12 4.7s-5.8 0-7.5.4A3 3 0 0 0 2.4 7.2 31 31 0 0 0 2 12a31 31 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.7.4 7.5.4 7.5.4s5.8 0 7.5-.4a3 3 0 0 0 2.1-2.1A31 31 0 0 0 22 12a31 31 0 0 0-.4-4.8ZM10 15.3V8.7L16 12l-6 3.3Z"/>
      </svg>
    );
  }
  return null;
};

type SocialLink = { type: string; label: string; url: string };

const normalizeUrl = (u: string) => {
  if (!u) return '';
  const s = String(u).trim();
  if (!s) return '';
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  return `https://${s.replace(/^\/+/, '')}`;
};

// redes sociais DO SITE
const SITE_SOCIALS: SocialLink[] = [
  { type: 'website', label: 'Site', url: 'https://centralcrypto.com.br' },
  { type: 'x', label: 'X', url: 'https://x.com/centralcrypto' },
  { type: 'telegram', label: 'Telegram', url: 'https://t.me/centralcryptotr' },
  { type: 'instagram', label: 'Instagram', url: 'https://instagram.com/centralcrypto' },
  { type: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@LigaCrypto' },
  { type: 'github', label: 'GitHub', url: 'https://github.com/' }
];

// ========================
// GAME CONFIG
// ========================
const GAME_BALL_RADIUS = 24;
const GAME_CUE_RADIUS = 30;
const GAME_WALL_PAD = 14;
const POCKET_R = 34;
const POCKET_INNER_R = 18;

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

  const [cuePowerRaw, setCuePowerRaw] = useState(0.75);

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  // Detail panel
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCoin, setDetailCoin] = useState<ApiCoin | null>(null);

  // Magazine posts
  const [magPosts, setMagPosts] = useState<MagazinePost[]>([]);
  const [magLoading, setMagLoading] = useState(false);
  const [magError, setMagError] = useState<string | null>(null);
  const [magIndex, setMagIndex] = useState(0);
  const magTimerRef = useRef<number>(0);

  // Transform (map only)
  const transformRef = useRef({ k: 1, x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ clientX: 0, clientY: 0, x: 0, y: 0 });
  const draggedParticleRef = useRef<Particle | null>(null);

  // ✅ aiming travado de verdade: guarda um PONTO fixo de mira
  const aimingRef = useRef<{
    active: boolean;
    holdStart: number;
    pull: number;
    aimWorldX: number;
    aimWorldY: number;
    lockedNx: number;
    lockedNy: number;
    lockedAngle: number;
  }>({ active: false, holdStart: 0, pull: 0, aimWorldX: 0, aimWorldY: 0, lockedNx: 1, lockedNy: 0, lockedAngle: 0 });

  const cueHideUntilRef = useRef<number>(0);

  const watermarkRef = useRef<HTMLImageElement | null>(null);

  const statsRef = useRef<{
    minX: number, maxX: number,
    minY: number, maxY: number,
    minR: number, maxR: number,
    logMinX: number, logMaxX: number,
    logMinY: number, logMaxY: number
  } | null>(null);

  const pocketsRef = useRef<{ x: number; y: number; r: number }[]>([]);

  // refs mirroring states
  const hoveredParticleRef = useRef<Particle | null>(null);
  const selectedParticleRef = useRef<Particle | null>(null);
  const detailOpenRef = useRef(false);

  const chartModeRef = useRef<ChartMode>(chartMode);
  const timeframeRef = useRef<Timeframe>(timeframe);
  const isGameModeRef = useRef<boolean>(isGameMode);
  const isDarkRef = useRef<boolean>(isDark);
  const floatStrengthRef = useRef<number>(floatStrengthRaw);
  const trailLengthRef = useRef<number>(trailLength);
  const cuePowerRef = useRef<number>(cuePowerRaw);
  const searchTermRef = useRef<string>(searchTerm);

  // ✅ lock ids during game; no reshuffle / no relayout
  const gameLockedIdsRef = useRef<string[] | null>(null);

  useEffect(() => { hoveredParticleRef.current = hoveredParticle; }, [hoveredParticle]);
  useEffect(() => { selectedParticleRef.current = selectedParticle; }, [selectedParticle]);
  useEffect(() => { detailOpenRef.current = detailOpen; }, [detailOpen]);

  useEffect(() => { chartModeRef.current = chartMode; }, [chartMode]);
  useEffect(() => { timeframeRef.current = timeframe; }, [timeframe]);
  useEffect(() => { isGameModeRef.current = isGameMode; }, [isGameMode]);
  useEffect(() => { isDarkRef.current = isDark; }, [isDark]);
  useEffect(() => { floatStrengthRef.current = floatStrengthRaw; }, [floatStrengthRaw]);
  useEffect(() => { trailLengthRef.current = trailLength; }, [trailLength]);
  useEffect(() => { cuePowerRef.current = cuePowerRaw; }, [cuePowerRaw]);
  useEffect(() => { searchTermRef.current = searchTerm; }, [searchTerm]);

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

  const getCoinPerfPct = useCallback((coin: any) => computeSparkChange(coin, timeframeRef.current).pct, []);
  const getCoinAbsPct = useCallback((coin: any) => computeSparkChange(coin, timeframeRef.current).absPct, []);

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
      const vol = Math.max(1, Number(c?.total_volume) || 1);
      yData.push(vol);

      if (mode === 'performance') {
        const x = getCoinPerfPct(c) || 0;
        xData.push(x);
        rData.push(Math.max(0.000001, sizeMetricPerf(c)));
      } else {
        const mc = Math.max(1, Number(c?.market_cap) || 1);
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

      const rrMin = minR;
      const rrMax = maxR;
      const t = (metric - rrMin) / (rrMax - rrMin || 1);
      const targetRadius = 15 + clamp(t, 0, 1) * 55;

      if (!isGameModeRef.current) {
        p.targetRadius = targetRadius;
        p.mass = Math.max(1, p.targetRadius);
      }

      p.color = isBTC ? '#ffffff' : baseColor;
    }
  }, [getCoinPerfPct, numCoins, sizeMetricPerf]);

  const getPlotGeometry = useCallback((worldWidth: number, worldHeight: number) => {
    const s = statsRef.current;
    if (!s) return null;

    const margin = { top: 18, right: 18, bottom: 92, left: 86 };
    const chartW = Math.max(50, worldWidth - margin.left - margin.right);
    const chartH = Math.max(50, worldHeight - margin.top - margin.bottom);

    const originX = margin.left;
    const originY = margin.top + chartH;

    return { worldWidth, worldHeight, margin, chartW, chartH, originX, originY, s };
  }, []);

  const projectCoinToMapXY = useCallback((coin: ApiCoin, mode: ChartMode, worldW: number, worldH: number) => {
    const g = getPlotGeometry(worldW, worldH);
    if (!g) return { x: 0, y: 0 };

    const { originX, originY, margin, chartW, chartH, s } = g;

    const projectX = (v: number) => {
      let norm = 0;
      if (mode === 'valuation') {
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

    const yVal = Math.max(1, Number(coin.total_volume) || 1);
    let xVal = 0;

    if (mode === 'performance') xVal = getCoinPerfPct(coin) || 0;
    else xVal = Math.max(1, Number(coin.market_cap) || 1);

    return { x: projectX(xVal), y: projectY(yVal) };
  }, [getCoinPerfPct, getPlotGeometry]);

  const beginMapTransition = useCallback((mode: ChartMode, worldW: number, worldH: number) => {
    if (!statsRef.current) return;
    const now = performance.now();

    const dur = 780;
    for (const p of particlesRef.current) {
      if (p.isFalling || p.isPocketed) continue;
      p.tweenActive = true;
      p.tweenStart = now;
      p.tweenDur = dur + (Math.sin(p.phase) * 80);
      p.tweenFromX = p.x;
      p.tweenFromY = p.y;

      const to = projectCoinToMapXY(p.coin, mode, worldW, worldH);
      p.tweenToX = to.x;
      p.tweenToY = to.y;
    }
  }, [projectCoinToMapXY]);

  const buildPockets = useCallback((worldW: number, worldH: number) => {
    const pad = GAME_WALL_PAD;
    pocketsRef.current = [
      { x: pad, y: pad, r: POCKET_R },
      { x: worldW / 2, y: pad, r: POCKET_R },
      { x: worldW - pad, y: pad, r: POCKET_R },
      { x: pad, y: worldH - pad, r: POCKET_R },
      { x: worldW / 2, y: worldH - pad, r: POCKET_R },
      { x: worldW - pad, y: worldH - pad, r: POCKET_R }
    ];
  }, []);

  const setupGameLayout = useCallback((worldW: number, worldH: number) => {
    buildPockets(worldW, worldH);

    const cue = particlesRef.current.find(p => String(p.coin.id).toLowerCase() === 'bitcoin');

    const others = particlesRef.current
      .filter(p => String(p.coin.id).toLowerCase() !== 'bitcoin')
      .sort((a, b) => (Number(a.coin.market_cap_rank) || 99999) - (Number(b.coin.market_cap_rank) || 99999));

    for (const p of particlesRef.current) {
      const isBTC = String(p.coin.id).toLowerCase() === 'bitcoin';
      p.targetRadius = isBTC ? GAME_CUE_RADIUS : GAME_BALL_RADIUS;
      p.radius = p.targetRadius;

      // ✅ mais “leve” (menos massa) pra não parecer caminhão
      p.mass = Math.max(1, p.targetRadius * 0.55);

      p.vx = 0; p.vy = 0;
      p.trail = [];
      p.isFixed = false;
      p.isFalling = false;
      p.fallT = 0;
      p.fallPocket = null;
      p.fallFromX = undefined;
      p.fallFromY = undefined;

      // ✅ reset pocketed só ao ENTRAR no game
      p.isPocketed = false;

      p.tweenActive = false;
    }

    if (cue) {
      cue.x = worldW * 0.78;
      cue.y = worldH * 0.5;
    }

    const rackApexX = worldW * 0.22;
    const rackApexY = worldH * 0.50;
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
    const maxX = worldW - GAME_WALL_PAD - GAME_BALL_RADIUS;
    const minY = GAME_WALL_PAD + GAME_BALL_RADIUS;
    const maxY = worldH - GAME_WALL_PAD - GAME_BALL_RADIUS;

    for (const p of particlesRef.current) {
      p.x = clamp(p.x, minX, maxX);
      p.y = clamp(p.y, minY, maxY);
    }
  }, [buildPockets]);

  // ✅ update only coin fields during game (no rebuild, no relayout)
  const syncCoinDataOnly = useCallback((coinsList: ApiCoin[]) => {
    const ids = gameLockedIdsRef.current;
    const base = ids && ids.length > 0 ? ids : coinsList.slice(0, numCoins).map(c => c.id);

    const coinMap = new Map<string, ApiCoin>();
    for (const c of coinsList) coinMap.set(c.id, c);

    for (const p of particlesRef.current) {
      const updated = coinMap.get(p.id);
      if (updated) p.coin = updated;
    }

    for (const id of base) {
      const c = coinMap.get(id);
      if (c?.image && !imageCache.current.has(c.image)) {
        const img = new Image();
        img.src = c.image;
        imageCache.current.set(c.image, img);
      }
    }
  }, [numCoins]);

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

      // ✅ NO GAME, resize só recalcula pockets. NÃO relayout.
      if (isGameModeRef.current) {
        buildPockets(cssW, cssH);
      }
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
  }, [loadData, buildPockets]);

  // global mouseup
  useEffect(() => {
    const up = () => handleMouseUp();
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // build particles when coins/numCoins changes
  useEffect(() => {
    if (coins.length === 0) return;

    // ✅ if game: do NOT rebuild/reshuffle. Only sync coin fields.
    if (isGameModeRef.current) {
      syncCoinDataOnly(coins);
      return;
    }

    const topCoins = coins.slice(0, numCoins);
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
        fallPocket: null,
        isPocketed: false,
        tweenActive: false
      };
    });

    particlesRef.current = newParticles;

    const worldW = stageRef.current?.clientWidth || 1000;
    const worldH = stageRef.current?.clientHeight || 800;

    recomputeStatsAndTargets(coins, chartModeRef.current);
    beginMapTransition(chartModeRef.current, worldW, worldH);
  }, [coins, numCoins, recomputeStatsAndTargets, beginMapTransition, syncCoinDataOnly]);

  // mode/timeframe changes: update stats + tween
  useEffect(() => {
    if (coins.length === 0) return;
    if (isGameMode) return;

    const worldW = stageRef.current?.clientWidth || 1000;
    const worldH = stageRef.current?.clientHeight || 800;

    recomputeStatsAndTargets(coins, chartMode);
    beginMapTransition(chartMode, worldW, worldH);
  }, [chartMode, timeframe, coins, isGameMode, recomputeStatsAndTargets, beginMapTransition]);

  // enter/exit game
  useEffect(() => {
    const worldW = stageRef.current?.clientWidth || 1000;
    const worldH = stageRef.current?.clientHeight || 800;

    if (isGameMode) {
      resetZoom();
      setDetailOpen(false);
      setSelectedParticle(null);
      setHoveredParticle(null);

      aimingRef.current.active = false;
      aimingRef.current.pull = 0;

      cueHideUntilRef.current = 0;

      // ✅ lock current ids so refresh won't reshuffle
      gameLockedIdsRef.current = coins.slice(0, numCoins).map(c => c.id);

      if (particlesRef.current.length === 0) {
        const topCoins = coins.slice(0, numCoins);
        particlesRef.current = topCoins.map((coin) => ({
          id: coin.id,
          x: Math.random() * worldW,
          y: Math.random() * worldH,
          vx: 0, vy: 0,
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
          isPocketed: false,
          tweenActive: false
        }));
      }

      // ✅ setup ONLY once on entering game
      setupGameLayout(worldW, worldH);
    } else {
      resetZoom();
      setDetailOpen(false);
      setSettingsOpen(false);
      setLegendTipOpen(false);

      aimingRef.current.active = false;
      aimingRef.current.pull = 0;

      gameLockedIdsRef.current = null;

      if (draggedParticleRef.current) {
        draggedParticleRef.current.isFixed = false;
        draggedParticleRef.current = null;
      }

      if (coins.length > 0) {
        recomputeStatsAndTargets(coins, chartModeRef.current);
        beginMapTransition(chartModeRef.current, worldW, worldH);
      }
    }
  }, [isGameMode, coins, numCoins, resetZoom, setupGameLayout, recomputeStatsAndTargets, beginMapTransition]);

  // =========================
  // Magazine fetch + carousel timer
  // =========================
  const fetchMagazine = useCallback(async () => {
    setMagLoading(true);
    setMagError(null);
    try {
      const res = await fetch(MAGAZINE_POSTS_ENDPOINT, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const arr = Array.isArray(data) ? (data as MagazinePost[]) : [];
      setMagPosts(arr.slice(0, 6));
      setMagIndex(0);
    } catch (e: any) {
      setMagError(e?.message || 'Erro ao buscar posts');
      setMagPosts([]);
      setMagIndex(0);
    } finally {
      setMagLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!detailOpen) {
      setMagPosts([]);
      setMagLoading(false);
      setMagError(null);
      setMagIndex(0);
      if (magTimerRef.current) window.clearInterval(magTimerRef.current);
      magTimerRef.current = 0;
      return;
    }

    fetchMagazine();

    if (magTimerRef.current) window.clearInterval(magTimerRef.current);
    magTimerRef.current = window.setInterval(() => {
      setMagIndex((prev) => (prev === 0 ? 1 : 0));
    }, 6500);

    return () => {
      if (magTimerRef.current) window.clearInterval(magTimerRef.current);
      magTimerRef.current = 0;
    };
  }, [detailOpen, fetchMagazine]);

  const magPageCount = useMemo(() => {
    return magPosts.length >= 6 ? 2 : (magPosts.length > 0 ? 1 : 0);
  }, [magPosts]);

  const magVisible = useMemo(() => {
    if (magPosts.length === 0) return [];
    const start = magIndex * 3;
    return magPosts.slice(start, start + 3);
  }, [magPosts, magIndex]);

  const goMagPrev = () => setMagIndex((p) => (p === 0 ? Math.max(0, magPageCount - 1) : p - 1));
  const goMagNext = () => setMagIndex((p) => (p + 1 >= magPageCount ? 0 : p + 1));

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current; if (!canvas) return;

    const wpos = screenToWorld(e.clientX, e.clientY);
    const worldMouseX = wpos.x;
    const worldMouseY = wpos.y;

    // ✅ aiming: direção NÃO muda, só carrega força
    if (isGameModeRef.current && aimingRef.current.active) {
      const now = performance.now();
      const held = now - aimingRef.current.holdStart;
      const maxPull = 220;
      aimingRef.current.pull = clamp((held / 650) * maxPull, 0, maxPull);
      return;
    }

    if (draggedParticleRef.current) {
      const p = draggedParticleRef.current;
      p.x = worldMouseX;
      p.y = worldMouseY;
      return;
    }

    if (!isGameModeRef.current && isPanningRef.current) {
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
      if (p.isFalling || p.isPocketed) continue;

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

    if (isGameModeRef.current) {
      if (e.button !== 0) return;

      const cue = particlesRef.current.find(pp => String(pp.coin.id).toLowerCase() === 'bitcoin');
      if (!cue || cue.isFalling || cue.isPocketed) return;

      const w = screenToWorld(e.clientX, e.clientY);

      // ✅ trava ponto de mira + direção a partir desse ponto
      const dx = w.x - cue.x;
      const dy = w.y - cue.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const nx = dx / dist;
      const ny = dy / dist;

      aimingRef.current.active = true;
      aimingRef.current.holdStart = performance.now();
      aimingRef.current.pull = 0;
      aimingRef.current.aimWorldX = w.x;
      aimingRef.current.aimWorldY = w.y;
      aimingRef.current.lockedNx = nx;
      aimingRef.current.lockedNy = ny;
      aimingRef.current.lockedAngle = Math.atan2(ny, nx);

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
    if (isGameModeRef.current && aimingRef.current.active) {
      const cue = particlesRef.current.find(pp => String(pp.coin.id).toLowerCase() === 'bitcoin');
      if (cue && !cue.isFalling && !cue.isPocketed) {
        const nx = aimingRef.current.lockedNx;
        const ny = aimingRef.current.lockedNy;

        const pull = aimingRef.current.pull;
        const pullNorm = clamp(pull / 220, 0, 1);

        // ✅ força mais forte + mais “solta”
        const basePower = 19500;
        const power = basePower * pullNorm * (0.55 + cuePowerRef.current * 1.95);

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
    if (isGameModeRef.current) return;

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
          <div>• Clique para travar direção.</div>
          <div>• Segure para carregar força.</div>
          <div>• Enquanto segura, direção fica travada.</div>
          <div>• Solte para tacar.</div>
          <div>• Taco some por 5s após tacada.</div>
          <div>• Bola encaçapada sai da sessão.</div>
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
          <div>• Cor: verde/vermelho</div>
          <div>• Zoom afeta escala e mapa.</div>
        </>
      );
    }

    return (
      <>
        <div><span className="font-black">Modo Market Cap</span></div>
        <div>• X: Market Cap (log)</div>
        <div>• Y: Volume 24h (log)</div>
        <div>• Tamanho: Market Cap</div>
        <div>• Cor: verde/vermelho</div>
        <div>• Zoom afeta escala e mapa.</div>
      </>
    );
  }, [chartMode, timeframe, isGameMode]);

  // Detail computed fields
  const changes = useMemo(() => {
    if (!detailCoin) return null;
    const c: any = detailCoin;

    const p1h =
      c.price_change_percentage_1h_in_currency ??
      c.price_change_percentage_1h ??
      c.price_change_percentage_1h_in_currency_usd ??
      null;

    const p24 =
      c.price_change_percentage_24h_in_currency ??
      c.price_change_percentage_24h ??
      null;

    const p7d =
      c.price_change_percentage_7d_in_currency ??
      c.price_change_percentage_7d ??
      null;

    return { p1h, p24, p7d };
  }, [detailCoin]);

  const detailListRows = useMemo(() => {
    if (!detailCoin) return [];
    const c: any = detailCoin;

    const rows: { k: string; v: string }[] = [];
    const add = (k: string, v: any, fmt?: (x: any) => string) => {
      if (v === null || v === undefined) return;
      const s = fmt ? fmt(v) : String(v);
      if (!s || s === 'undefined' || s === 'null') return;
      rows.push({ k, v: s });
    };

    add('Símbolo', c.symbol ? String(c.symbol).toUpperCase() : null);
    add('Rank', c.market_cap_rank ?? null);
    add('Preço', c.current_price ?? null, formatPrice);
    add('Market Cap', c.market_cap ?? null, formatCompact);
    add('FDV', c.fully_diluted_valuation ?? null, formatCompact);
    add('Volume 24h', c.total_volume ?? null, formatCompact);
    add('Circ. Supply', c.circulating_supply ?? null, (x) => Number(x).toLocaleString());
    add('Total Supply', c.total_supply ?? null, (x) => Number(x).toLocaleString());
    add('Max Supply', c.max_supply ?? null, (x) => Number(x).toLocaleString());
    add('ATH', c.ath ?? null, formatPrice);
    add('ATL', c.atl ?? null, formatPrice);
    add('Updated', c.last_updated ?? null, (x) => new Date(x).toLocaleString());

    return rows;
  }, [detailCoin]);

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailCoin(null);
    setSelectedParticle(null);
  };

  // =======================
  // Axis & Grid (DRAW IN WORLD, THEN ZOOM TRANSFORM APPLIES)
  // =======================
  const niceStep = (min: number, max: number, ticks: number) => {
    const range = max - min;
    if (!isFinite(range) || range <= 0) return 1;
    const rough = range / Math.max(1, ticks);
    const pow = Math.pow(10, Math.floor(Math.log10(rough)));
    const scaled = rough / pow;
    let nice = 1;
    if (scaled >= 5) nice = 5;
    else if (scaled >= 2) nice = 2;
    else nice = 1;
    return nice * pow;
  };

  const drawAxisAndGridWorld = (ctx: CanvasRenderingContext2D, worldW: number, worldH: number) => {
    const g = getPlotGeometry(worldW, worldH);
    if (!g) return;
    if (isGameModeRef.current) return;

    const { margin, chartW, chartH, originX, originY, s } = g;
    const dark = isDarkRef.current;
    const mode = chartModeRef.current;

    ctx.save();
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)';
    ctx.fillRect(originX, margin.top, chartW, chartH);
    ctx.restore();

    const gridColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const axisColor = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
    const textColor = dark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)';

    const xTicks = 6;
    let xVals: number[] = [];

    if (mode === 'performance') {
      const minX = s.minX;
      const maxX = s.maxX;
      const step = niceStep(minX, maxX, xTicks);
      const start = Math.floor(minX / step) * step;
      for (let v = start; v <= maxX + step * 0.5; v += step) xVals.push(v);
    } else {
      const minL = Math.floor(s.logMinX);
      const maxL = Math.ceil(s.logMaxX);
      for (let p = minL; p <= maxL; p++) xVals.push(Math.pow(10, p));
    }

    const yVals: number[] = [];
    const minLY = Math.floor(s.logMinY);
    const maxLY = Math.ceil(s.logMaxY);
    for (let p = minLY; p <= maxLY; p++) yVals.push(Math.pow(10, p));

    const projX = (v: number) => {
      if (mode === 'valuation') {
        const norm = (Math.log10(Math.max(1, v)) - s.logMinX) / (s.logMaxX - s.logMinX || 1);
        return originX + norm * chartW;
      }
      const norm = (v - s.minX) / (s.maxX - s.minX || 1);
      return originX + norm * chartW;
    };

    const projY = (v: number) => {
      const norm = (Math.log10(Math.max(1, v)) - s.logMinY) / (s.logMaxY - s.logMinY || 1);
      return margin.top + (1 - norm) * chartH;
    };

    ctx.save();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    for (const xv of xVals) {
      const x = projX(xv);
      if (!isFinite(x)) continue;
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + chartH);
      ctx.stroke();
    }

    for (const yv of yVals) {
      const y = projY(yv);
      if (!isFinite(y)) continue;
      ctx.beginPath();
      ctx.moveTo(originX, y);
      ctx.lineTo(originX + chartW, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(originX, margin.top);
    ctx.lineTo(originX, originY);
    ctx.lineTo(originX + chartW, originY);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = textColor;
    ctx.font = `900 12px Inter`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const xLabel = mode === 'performance' ? `Variação ${timeframeRef.current} (%)` : `Market Cap (log)`;
    ctx.fillText(xLabel, originX + chartW / 2, originY + 54);

    ctx.save();
    ctx.translate(originX - 60, margin.top + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Volume 24h (log)', 0, 0);
    ctx.restore();

    ctx.font = `800 11px Inter`;
    ctx.textBaseline = 'top';
    for (const xv of xVals) {
      const x = projX(xv);
      if (!isFinite(x)) continue;

      ctx.beginPath();
      ctx.strokeStyle = axisColor;
      ctx.lineWidth = 1;
      ctx.moveTo(x, originY);
      ctx.lineTo(x, originY + 6);
      ctx.stroke();

      let txt = '';
      if (mode === 'performance') txt = `${xv.toFixed(0)}%`;
      else txt = formatCompact(xv).replace('$', '');
      ctx.fillStyle = textColor;
      ctx.fillText(txt, x, originY + 10);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const yv of yVals) {
      const y = projY(yv);
      if (!isFinite(y)) continue;

      ctx.beginPath();
      ctx.strokeStyle = axisColor;
      ctx.lineWidth = 1;
      ctx.moveTo(originX - 6, y);
      ctx.lineTo(originX, y);
      ctx.stroke();

      const txt = formatCompact(yv).replace('$', '');
      ctx.fillStyle = textColor;
      ctx.fillText(txt, originX - 10, y);
    }

    ctx.restore();

    if (mode === 'performance') {
      const x0 = projX(0);
      ctx.save();
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(x0, margin.top);
      ctx.lineTo(x0, margin.top + chartH);
      ctx.stroke();
      ctx.restore();
    }
  };

  // =======================
  // GAME PHYSICS
  // =======================
  const resolveCollisions = (particles: Particle[]) => {
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      if (a.isFalling || a.isPocketed) continue;

      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        if (b.isFalling || b.isPocketed) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = a.radius + b.radius;

        if (dist > 0 && dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (minDist - dist);

          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          const dvx = b.vx - a.vx;
          const dvy = b.vy - a.vy;
          const relVel = dvx * nx + dvy * ny;

          if (relVel < 0) {
            const restitution = 0.92;
            const invMa = 1 / Math.max(1, a.mass);
            const invMb = 1 / Math.max(1, b.mass);

            const impulse = -(1 + restitution) * relVel / (invMa + invMb);
            const ix = impulse * nx;
            const iy = impulse * ny;

            a.vx -= ix * invMa;
            a.vy -= iy * invMa;
            b.vx += ix * invMb;
            b.vy += iy * invMb;
          }
        }
      }
    }
  };

  const checkPockets = (p: Particle) => {
    if (p.isFalling || p.isPocketed) return;
    const pockets = pocketsRef.current;

    for (const pocket of pockets) {
      const dx = p.x - pocket.x;
      const dy = p.y - pocket.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= pocket.r) {
        p.isFalling = true;
        p.fallT = 0;
        p.fallPocket = pocket;
        p.fallFromX = p.x;
        p.fallFromY = p.y;
        p.vx = 0;
        p.vy = 0;
        return;
      }
    }
  };

  // =======================
  // RAF LOOP
  // =======================
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
      const worldW = canvas.width / dpr;
      const worldH = canvas.height / dpr;

      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const dark = isDarkRef.current;
      const game = isGameModeRef.current;

      ctx.fillStyle = game ? (dark ? '#07120c' : '#e8f3ea') : (dark ? '#0b0f14' : '#ffffff');
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const img = watermarkRef.current;
      if (img && img.complete && img.naturalWidth > 0) {
        const maxW = worldW * 0.78;
        const maxH = worldH * 0.78;
        const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;
        const x = (worldW - w) / 2;
        const y = (worldH - h) / 2;

        ctx.save();
        ctx.globalAlpha = dark ? 0.055 : 0.035;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, x, y, w, h);
        ctx.restore();
      }

      // ✅ Map transform applied to both axis/grid and particles
      const { k, x: panX, y: panY } = transformRef.current;

      if (!game) {
        ctx.save();
        ctx.translate(panX, panY);
        ctx.scale(k, k);
        drawAxisAndGridWorld(ctx, worldW, worldH);
        ctx.restore();
      }

      const toScreenX = (val: number) => val * k + panX;
      const toScreenY = (val: number) => val * k + panY;

      const particles = particlesRef.current;

      for (const p of particles) {
        if (p.isPocketed) continue;
        const viewRadius = p.targetRadius * Math.pow(k, 0.25);
        p.radius += (viewRadius - p.radius) * 0.15;
        p.mass = Math.max(1, p.radius * (game ? 0.55 : 1));
      }

      if (game) {
        // ✅ menos “pesado”: mais deslizamento e menor cutoff
        const friction = 0.9952;
        const speedStop = 1.6;

        const minX = GAME_WALL_PAD + GAME_BALL_RADIUS;
        const maxX = worldW - GAME_WALL_PAD - GAME_BALL_RADIUS;
        const minY = GAME_WALL_PAD + GAME_BALL_RADIUS;
        const maxY = worldH - GAME_WALL_PAD - GAME_BALL_RADIUS;

        for (const p of particles) {
          if (p.isPocketed) continue;

          if (p.isFalling) {
            p.fallT = (p.fallT || 0) + dt;
            const t = clamp((p.fallT || 0) / 0.45, 0, 1);
            const e = easeInOutCubic(t);

            const pocket = p.fallPocket;
            if (pocket && p.fallFromX != null && p.fallFromY != null) {
              p.x = p.fallFromX + (pocket.x - p.fallFromX) * e;
              p.y = p.fallFromY + (pocket.y - p.fallFromY) * e;
              p.radius = p.targetRadius * (1 - e);
            }

            // ✅ não reseta o jogo: só remove a bola
            if (t >= 1) {
              p.isFalling = false;
              p.isPocketed = true;
              p.vx = 0; p.vy = 0;
            }

            continue;
          }

          p.x += p.vx * dt;
          p.y += p.vy * dt;

          p.vx *= friction;
          p.vy *= friction;

          const sp = Math.hypot(p.vx, p.vy);
          if (sp < speedStop) { p.vx = 0; p.vy = 0; }

          if (p.x < minX) { p.x = minX; p.vx *= -0.9; }
          if (p.x > maxX) { p.x = maxX; p.vx *= -0.9; }
          if (p.y < minY) { p.y = minY; p.vy *= -0.9; }
          if (p.y > maxY) { p.y = maxY; p.vy *= -0.9; }
        }

        resolveCollisions(particles);
        for (const p of particles) checkPockets(p);
      }

      if (!game) {
        const mode = chartModeRef.current;
        const s2 = statsRef.current;

        if (s2) {
          const mappedFloatMaxAmp = 5.2 * 1.3;
          const mappedFloatAmp = floatStrengthRef.current * mappedFloatMaxAmp;

          for (const p of particles) {
            if (p.isPocketed) continue;

            if (p.tweenActive && p.tweenStart != null && p.tweenDur != null) {
              const tt = clamp((now - p.tweenStart) / p.tweenDur, 0, 1);
              const e = easeInOutCubic(tt);

              const fx = p.tweenFromX ?? p.x;
              const fy = p.tweenFromY ?? p.y;
              const tx = p.tweenToX ?? p.x;
              const ty = p.tweenToY ?? p.y;

              p.x = fx + (tx - fx) * e;
              p.y = fy + (ty - fy) * e;

              if (tt >= 1) {
                p.tweenActive = false;
                p.tweenStart = undefined;
                p.tweenDur = undefined;
                p.tweenFromX = undefined;
                p.tweenFromY = undefined;
                p.tweenToX = undefined;
                p.tweenToY = undefined;
              }

              continue;
            }

            const to = projectCoinToMapXY(p.coin, mode, worldW, worldH);
            const floatFreq = 0.0002 * (1 + floatStrengthRef.current);

            const floatX = mappedFloatAmp > 0 ? Math.sin(now * floatFreq + p.phase) * mappedFloatAmp : 0;
            const floatY = mappedFloatAmp > 0 ? Math.cos(now * (floatFreq * 1.3) + p.phase) * mappedFloatAmp : 0;

            const targetX = to.x + floatX;
            const targetY = to.y + floatY;

            p.x += (targetX - p.x) * 0.05;
            p.y += (targetY - p.y) * 0.05;
          }
        }
      }

      // Draw game table overlay: pockets + borders
      if (game) {
        ctx.save();
        ctx.strokeStyle = dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 6;
        ctx.strokeRect(GAME_WALL_PAD, GAME_WALL_PAD, worldW - GAME_WALL_PAD * 2, worldH - GAME_WALL_PAD * 2);
        ctx.restore();

        for (const pk of pocketsRef.current) {
          ctx.save();
          ctx.fillStyle = dark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.35)';
          ctx.beginPath();
          ctx.arc(pk.x, pk.y, pk.r, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = dark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.55)';
          ctx.beginPath();
          ctx.arc(pk.x, pk.y, POCKET_INNER_R, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      const st = searchTermRef.current;
      const tl = trailLengthRef.current;

      // Draw particles
      for (const p of particlesRef.current) {
        if (p.isPocketed) continue;

        const screenX = game ? p.x : toScreenX(p.x);
        const screenY = game ? p.y : toScreenY(p.y);

        if (screenX + p.radius < 0 || screenX - p.radius > worldW || screenY + p.radius < 0 || screenY - p.radius > worldH) continue;

        let alpha = 1.0;

        const isHovered = hoveredParticleRef.current?.id === p.id;
        const isSelected = selectedParticleRef.current?.id === p.id;

        const isDimmed = !game && st
          && !p.coin.name.toLowerCase().includes(st.toLowerCase())
          && !p.coin.symbol.toLowerCase().includes(st.toLowerCase());

        if (isDimmed) alpha *= 0.12;

        if (!game && tl > 0 && alpha > 0.05) {
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
            ctx.lineWidth = Math.min(p.radius * 0.35, 4);
            ctx.stroke();
            ctx.globalAlpha = 1.0;
          }
        } else {
          p.trail = [];
        }

        ctx.save();
        ctx.globalAlpha = alpha;

        const isBTC = String(p.coin.id).toLowerCase() === 'bitcoin';
        ctx.beginPath();
        ctx.arc(screenX, screenY, p.radius, 0, Math.PI * 2);

        const logo = imageCache.current.get(p.coin.image);
        if (logo?.complete) {
          ctx.save();
          ctx.clip();
          ctx.drawImage(logo, screenX - p.radius, screenY - p.radius, p.radius * 2, p.radius * 2);
          ctx.restore();

          ctx.strokeStyle = isBTC ? '#ffffff' : p.color;
          ctx.lineWidth = isSelected ? 4 : 2;
          ctx.stroke();
        } else {
          ctx.fillStyle = isBTC ? '#ffffff' : p.color;
          ctx.fill();
        }

        if (p.radius > 12) {
          ctx.fillStyle = '#fff';
          ctx.font = `bold ${Math.max(10, p.radius * 0.42)}px Inter`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 4;
          ctx.fillText(p.coin.symbol.toUpperCase(), screenX, screenY);
          ctx.shadowBlur = 0;
        }

        if (isHovered || isSelected) {
          ctx.strokeStyle = dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(screenX, screenY, p.radius + 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.restore();
      }

      // ✅ cue stick ALWAYS ABOVE balls (draw after)
      if (game) {
        const hide = now < cueHideUntilRef.current;

        if (!hide && aimingRef.current.active) {
          const cue = particlesRef.current.find(pp => String(pp.coin.id).toLowerCase() === 'bitcoin');
          if (cue && !cue.isFalling && !cue.isPocketed) {
            const nx = aimingRef.current.lockedNx;
            const ny = aimingRef.current.lockedNy;

            const pull = aimingRef.current.pull;
            const stickLen = 270;
            const back = cue.radius + 18 + pull;

            const x1 = cue.x - nx * back;
            const y1 = cue.y - ny * back;
            const x2 = cue.x - nx * (back + stickLen);
            const y2 = cue.y - ny * (back + stickLen);

            ctx.save();
            ctx.lineCap = 'round';

            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            ctx.strokeStyle = dark ? 'rgba(255,220,160,0.88)' : 'rgba(160,110,40,0.88)';
            ctx.lineWidth = 7;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(255,255,255,0.92)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x1 - nx * 18, y1 - ny * 18);
            ctx.stroke();

            ctx.restore();
          }
        }
      }

      reqIdRef.current = requestAnimationFrame(loop);
    };

    reqIdRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(reqIdRef.current);
  }, [projectCoinToMapXY, getPlotGeometry]);

  const detailHeader = useMemo(() => {
    if (!detailCoin) return null;
    return {
      name: detailCoin.name,
      symbol: detailCoin.symbol?.toUpperCase(),
      rank: (detailCoin as any).market_cap_rank ?? '-',
      image: detailCoin.image
    };
  }, [detailCoin]);

  // =======================
  // UI
  // =======================
  const cardContainerClass =
    "fixed right-4 top-[88px] z-40 w-[440px] max-w-[92vw] " +
    "bg-white/95 dark:bg-black/85 border border-gray-200 dark:border-white/10 " +
    "rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden";

  const cardInnerClass = "p-4";

  const StatRow = ({ k, v }: { k: string; v: string }) => (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="text-xs font-black text-gray-500 dark:text-gray-400">{k}</div>
      <div className="text-xs font-black text-gray-900 dark:text-gray-100 text-right">{v}</div>
    </div>
  );

  const MiniChip = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border border-gray-200 dark:border-white/10 bg-gray-100/60 dark:bg-white/5">
      <span className="text-[10px] font-black text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-xs font-black" style={{ color: color || (isDark ? '#fff' : '#111') }}>{value}</span>
    </div>
  );

  // =======================
  // Render
  // =======================
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[2000] bg-white dark:bg-[#0b0f14] text-gray-900 dark:text-white flex flex-col overflow-hidden touch-none select-none overscroll-none h-[100dvh]"
    >
      {/* HEADER */}
      <div className="flex justify-between items-start p-4 z-20 bg-white/80 dark:bg-black/50 backdrop-blur-sm border-b border-gray-200 dark:border-white/10 shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          <Coins size={28} className="text-[#dd9933]" />
          <div>
            <h3 className="text-xl font-black uppercase tracking-wider">Crypto Bubbles</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold">
              {status === 'demo' ? 'MODO DEMO' : isGameMode ? 'MODO GAME' : 'MODO MAPA'}
            </p>
          </div>

          <div className="w-px h-8 bg-gray-200 dark:bg-white/10 mx-2"></div>

          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 dark:bg-black/50 p-1 rounded-lg border border-gray-200 dark:border-white/10">
              <button
                onClick={() => setChartMode('valuation')}
                className={`px-4 py-1.5 text-xs font-black rounded transition-colors ${chartMode === 'valuation' ? 'bg-white dark:bg-[#2f3032] shadow text-[#dd9933]' : 'text-gray-500 dark:text-gray-300'}`}
              >
                Market Cap
              </button>
              <button
                onClick={() => setChartMode('performance')}
                className={`px-4 py-1.5 text-xs font-black rounded transition-colors ${chartMode === 'performance' ? 'bg-white dark:bg-[#2f3032] shadow text-[#dd9933]' : 'text-gray-500 dark:text-gray-300'}`}
              >
                Variação
              </button>
            </div>

            <div className="flex items-center bg-gray-100 dark:bg-black/50 p-1 rounded-lg border border-gray-200 dark:border-white/10">
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

            <div className="flex items-center bg-gray-100 dark:bg-black/50 p-1 rounded-lg border border-gray-200 dark:border-white/10">
              <div className="flex items-center gap-2 px-2 py-1">
                <span className="text-xs font-black text-gray-500 dark:text-gray-400">#</span>
                <select
                  value={numCoins}
                  onChange={e => setNumCoins(parseInt(e.target.value))}
                  className="bg-white dark:bg-[#2f3032] text-gray-900 dark:text-gray-100 px-2 py-1 rounded text-xs font-black border border-gray-200 dark:border-white/10 outline-none"
                >
                  {[50, 100, 150, 200, 250].map(n => <option key={n} value={n}>{n}</option>)}
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

      {/* SETTINGS */}
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

      {/* DETAIL CARD (compact, no scroll) */}
      {detailOpen && detailCoin && (
        <div className={cardContainerClass}>
          <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-200 dark:border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5 shrink-0">
                {detailHeader?.image ? (
                  <img src={detailHeader.image} alt={detailHeader.name} className="w-full h-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-black truncate">{detailHeader?.name}</div>
                  <div className="text-[11px] font-black text-gray-500 dark:text-gray-400 shrink-0">{detailHeader?.symbol}</div>
                  <div className="text-[11px] font-black text-gray-500 dark:text-gray-400 shrink-0">#{detailHeader?.rank}</div>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <MiniChip label="1h" value={changes ? fmtPct(changes.p1h ?? 0) : '-'} color={pctColor(changes?.p1h ?? 0)} />
                  <MiniChip label="24h" value={changes ? fmtPct(changes.p24 ?? 0) : '-'} color={pctColor(changes?.p24 ?? 0)} />
                  <MiniChip label="7d" value={changes ? fmtPct(changes.p7d ?? 0) : '-'} color={pctColor(changes?.p7d ?? 0)} />
                </div>
              </div>
            </div>

            <button
              onClick={closeDetail}
              className="p-2 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-red-500/10 text-gray-600 dark:text-gray-400 hover:text-red-500 transition-colors"
              title="Fechar"
            >
              <CloseIcon size={18} />
            </button>
          </div>

          <div className={cardInnerClass}>
            {/* DETAILS as "solta" list in 2 cols */}
            <div className="grid grid-cols-2 gap-x-4">
              {detailListRows.slice(0, 10).map((r) => (
                <StatRow key={r.k} k={r.k} v={r.v} />
              ))}
            </div>

            {/* remaining rows in single line to avoid scroll */}
            {detailListRows.length > 10 && (
              <div className="mt-2 grid grid-cols-2 gap-x-4">
                {detailListRows.slice(10, 12).map((r) => (
                  <StatRow key={r.k} k={r.k} v={r.v} />
                ))}
              </div>
            )}

            {/* Socials (site) inline */}
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-black text-gray-500 dark:text-gray-400">
                <LinkIcon size={14} />
                CentralCrypto
              </div>
              <div className="flex items-center gap-2">
                {SITE_SOCIALS.map((s) => (
                  <a
                    key={s.type}
                    href={normalizeUrl(s.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-100/60 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                    title={s.label}
                  >
                    <SocialIcon type={s.type} />
                  </a>
                ))}
              </div>
            </div>

            {/* MAGAZINE always below */}
            <div className="mt-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 text-xs font-black text-gray-500 dark:text-gray-400">
                  <Newspaper size={14} />
                  Magazine (últimas 6)
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={goMagPrev}
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-100/60 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                    title="Anterior"
                    disabled={magPageCount <= 1}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={goMagNext}
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-100/60 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                    title="Próximo"
                    disabled={magPageCount <= 1}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {magLoading && (
                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 py-2">Carregando…</div>
              )}

              {magError && (
                <div className="text-xs font-bold text-red-500 py-2">{magError}</div>
              )}

              {!magLoading && !magError && (
                <div className="grid grid-cols-3 gap-2">
                  {magVisible.map((p) => {
                    const img = pickFeatured(p);
                    const title = safeTitle(p.title?.rendered || '');
                    const date = p.date ? new Date(p.date).toLocaleDateString() : '';
                    return (
                      <a
                        key={p.id}
                        href={p.link || `${MAGAZINE_FALLBACK_LINK_BASE}/?p=${p.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="group rounded-xl border border-gray-200 dark:border-white/10 bg-gray-100/60 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors overflow-hidden"
                        title={title}
                      >
                        <div className="h-14 bg-gray-200 dark:bg-white/10">
                          {img ? <img src={img} alt={title} className="w-full h-full object-cover" /> : null}
                        </div>
                        <div className="p-2">
                          <div className="text-[10px] font-black text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Calendar size={12} />
                            {date}
                          </div>
                          <div className="text-[11px] font-black text-gray-900 dark:text-gray-100 mt-1 line-clamp-2">
                            {title}
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-[10px] font-black text-[#dd9933]">
                            Abrir <ExternalLink size={12} />
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CANVAS STAGE */}
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
