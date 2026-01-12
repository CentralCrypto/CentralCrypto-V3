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
  BarChart2
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
  if (n < 0.01) return `$${n.toPrecision(3)}`;
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
const MAGAZINE_FALLBACK_LINK_BASE = '/magazine';

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
// SOCIAL ICONS (inline SVG, no CDN)
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
  if (type === 'reddit') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none">
        <path fill="currentColor" d="M14.7 3.8c.1 0 .2 0 .3.1l2.8 2.1c.2-.1.5-.2.8-.2 1 0 1.8.8 1.8 1.8S19.6 9.4 18.6 9.4c-.5 0-1-.2-1.3-.6-1.3.9-3 1.5-4.9 1.6l-.7-3.4 2-.2c.2-.9.8-1.5 1.6-1.6ZM8.2 10.1c-2 0-3.6 1.6-3.6 3.6 0 2.3 2.8 4.1 7.4 4.1s7.4-1.8 7.4-4.1c0-2-1.6-3.6-3.6-3.6-.9 0-1.7.3-2.4.9-1-.6-2.1-.9-3.4-.9s-2.4.3-3.4.9c-.7-.6-1.5-.9-2.4-.9Zm2 4.4c-.5 0-.9-.4-.9-.9s.4-.9.9-.9.9.4.9.9-.4.9-.9.9Zm4.6 0c-.5 0-.9-.4-.9-.9s.4-.9.9-.9.9.4.9.9-.4.9-.9.9Zm-5 1.7c.7.6 1.8 1 3.2 1s2.5-.4 3.2-1c.2-.2.6-.2.8 0 .2.2.2.6 0 .8-1 1-2.4 1.5-4 1.5s-3-.5-4-1.5c-.2-.2-.2-.6 0-.8.2-.2.6-.2.8 0Z"/>
      </svg>
    );
  }
  if (type === 'discord') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none">
        <path fill="currentColor" d="M19.5 6.3a14.8 14.8 0 0 0-3.6-1.1l-.5 1.1a13.6 13.6 0 0 0-3.8 0l-.5-1.1c-1.2.2-2.4.6-3.6 1.1C5.4 9 5 11.6 5.1 14.2c1.5 1.1 2.9 1.8 4.4 2.2l.7-1.2c-.8-.3-1.5-.6-2.2-1.1l.5-.4c1.3.6 2.7.9 4.1.9s2.8-.3 4.1-.9l.5.4c-.7.5-1.4.8-2.2 1.1l.7 1.2c1.5-.4 2.9-1.1 4.4-2.2.2-2.9-.3-5.5-1.9-7.9ZM9.6 13.5c-.6 0-1.1-.6-1.1-1.3s.5-1.3 1.1-1.3c.6 0 1.1.6 1.1 1.3s-.5 1.3-1.1 1.3Zm4.8 0c-.6 0-1.1-.6-1.1-1.3s.5-1.3 1.1-1.3c.6 0 1.1.6 1.1 1.3s-.5 1.3-1.1 1.3Z"/>
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

const buildSocialLinksFromCoin = (coin: any): SocialLink[] => {
  const out: SocialLink[] = [];

  const links = coin?.links || coin?.link || null;

  // website (try common fields)
  const homepage =
    (Array.isArray(links?.homepage) && links.homepage.find((x: any) => String(x || '').trim())) ||
    links?.homepage ||
    coin?.homepage ||
    coin?.website ||
    null;

  if (homepage) out.push({ type: 'website', label: 'Website', url: normalizeUrl(homepage) });

  // X / Twitter
  const twitter =
    links?.twitter_screen_name ||
    coin?.twitter_screen_name ||
    null;
  if (twitter) out.push({ type: 'x', label: 'X', url: normalizeUrl(`https://x.com/${twitter}`) });

  // Telegram
  const telegram =
    links?.telegram_channel_identifier ||
    coin?.telegram_channel_identifier ||
    null;
  if (telegram) out.push({ type: 'telegram', label: 'Telegram', url: normalizeUrl(`https://t.me/${telegram}`) });

  // Discord
  const discord =
    links?.chat_url?.find?.((x: any) => String(x || '').includes('discord.gg')) ||
    links?.discord_url ||
    coin?.discord_url ||
    null;
  if (discord) out.push({ type: 'discord', label: 'Discord', url: normalizeUrl(discord) });

  // Reddit
  const reddit = links?.subreddit_url || coin?.subreddit_url || null;
  if (reddit) out.push({ type: 'reddit', label: 'Reddit', url: normalizeUrl(reddit) });

  // GitHub
  const gh = links?.repos_url?.github?.[0] || links?.github || coin?.github || null;
  if (gh) out.push({ type: 'github', label: 'GitHub', url: normalizeUrl(gh) });

  // dedupe
  const seen = new Set<string>();
  return out.filter(x => {
    const key = `${x.type}:${x.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

  // Magazine posts
  const [magPosts, setMagPosts] = useState<MagazinePost[]>([]);
  const [magLoading, setMagLoading] = useState(false);
  const [magError, setMagError] = useState<string | null>(null);
  const [magIndex, setMagIndex] = useState(0); // page index 0..1 for 6 posts showing 3 at a time
  const magTimerRef = useRef<number>(0);

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

  const projectCoinToMapXY = useCallback((coin: ApiCoin, mode: ChartMode) => {
    const s = statsRef.current;
    const canvas = canvasRef.current;
    if (!s || !canvas) return { x: 0, y: 0 };

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
  }, [getCoinPerfPct]);

  const beginMapTransition = useCallback((mode: ChartMode) => {
    if (!statsRef.current) return;
    const now = performance.now();

    const dur = 780;
    for (const p of particlesRef.current) {
      if (p.isFalling) continue;
      p.tweenActive = true;
      p.tweenStart = now;
      p.tweenDur = dur + (Math.sin(p.phase) * 80);
      p.tweenFromX = p.x;
      p.tweenFromY = p.y;

      const to = projectCoinToMapXY(p.coin, mode);
      p.tweenToX = to.x;
      p.tweenToY = to.y;
    }
  }, [projectCoinToMapXY]);

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

      p.tweenActive = false;
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

  // build particles when coins/numCoins changes
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

        tweenActive: false
      };
    });

    particlesRef.current = newParticles;

    recomputeStatsAndTargets(coins, chartModeRef.current);
    if (!isGameModeRef.current) beginMapTransition(chartModeRef.current);
  }, [coins, numCoins, recomputeStatsAndTargets, beginMapTransition]);

  // mode/timeframe changes: update stats + tween (no rebuild)
  useEffect(() => {
    if (coins.length === 0) return;
    if (isGameMode) return;

    recomputeStatsAndTargets(coins, chartMode);
    beginMapTransition(chartMode);
  }, [chartMode, timeframe, coins, isGameMode, recomputeStatsAndTargets, beginMapTransition]);

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

      if (coins.length > 0) {
        recomputeStatsAndTargets(coins, chartModeRef.current);
        beginMapTransition(chartModeRef.current);
      }
    }
  }, [isGameMode, coins, resetZoom, setupGameLayout, recomputeStatsAndTargets, beginMapTransition]);

  // =========================
  // Magazine fetch + carousel timer (only when detail opens)
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

    lastMousePosRef.current = { x: worldMouseX, y: worldMouseY };

    if (isGameModeRef.current && aimingRef.current.active) {
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

    if (isGameModeRef.current) {
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
    if (isGameModeRef.current && aimingRef.current.active) {
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
        const power = basePower * pullNorm * (0.35 + cuePowerRef.current * 1.65);

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
          <div>• A bola branca é o BTC.</div>
          <div>• Clique no alvo.</div>
          <div>• Segure para puxar (mais força).</div>
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

  // Detail computed fields
  const detailPerf = useMemo(() => {
    if (!detailCoin) return null;
    return computeSparkChange(detailCoin, timeframe);
  }, [detailCoin, timeframe]);

  const detailColor = useMemo(() => {
    if (!detailPerf) return '#dd9933';
    return detailPerf.pct >= 0 ? '#089981' : '#f23645';
  }, [detailPerf]);

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

    const athChange = c.ath_change_percentage ?? null;
    const atlChange = c.atl_change_percentage ?? null;

    return { p1h, p24, p7d, athChange, atlChange };
  }, [detailCoin]);

  const socialLinks = useMemo(() => {
    if (!detailCoin) return [];
    return buildSocialLinksFromCoin(detailCoin);
  }, [detailCoin]);

  // Extra info rows: show more fields if present
  const extraRows = useMemo(() => {
    if (!detailCoin) return [];
    const c: any = detailCoin;

    const rows: { k: string; v: React.ReactNode }[] = [];

    const add = (k: string, v: any, fmt?: (x: any) => string) => {
      if (v === null || v === undefined) return;
      const s = fmt ? fmt(v) : String(v);
      if (s === 'undefined' || s === 'null' || s.trim() === '') return;
      rows.push({ k, v: s });
    };

    add('Símbolo', c.symbol ? String(c.symbol).toUpperCase() : null);
    add('Rank', c.market_cap_rank ?? null);
    add('Preço', c.current_price ?? null, formatPrice);
    add('Market Cap', c.market_cap ?? null, formatCompact);
    add('Fully Diluted Valuation', c.fully_diluted_valuation ?? null, formatCompact);
    add('Volume 24h', c.total_volume ?? null, formatCompact);
    add('Volume/MC', (c.total_volume && c.market_cap) ? (Number(c.total_volume) / Math.max(1, Number(c.market_cap))) : null, (x) => Number(x).toFixed(3));
    add('Circulating Supply', c.circulating_supply ?? null, (x) => Number(x).toLocaleString());
    add('Total Supply', c.total_supply ?? null, (x) => Number(x).toLocaleString());
    add('Max Supply', c.max_supply ?? null, (x) => Number(x).toLocaleString());
    add('ATH', c.ath ?? null, formatPrice);
    add('ATH Date', c.ath_date ?? null, (x) => new Date(x).toLocaleString());
    add('ATL', c.atl ?? null, formatPrice);
    add('ATL Date', c.atl_date ?? null, (x) => new Date(x).toLocaleString());
    add('Last Updated', c.last_updated ?? null, (x) => new Date(x).toLocaleString());

    return rows;
  }, [detailCoin]);

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
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const dark = isDarkRef.current;
      const game = isGameModeRef.current;

      ctx.fillStyle = game ? (dark ? '#08110c' : '#e8f3ea') : (dark ? '#0b0f14' : '#ffffff');
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      // watermark
      const img = watermarkRef.current;
      if (img && img.complete && img.naturalWidth > 0) {
        const maxW = width * 0.78;
        const maxH = height * 0.78;
        const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;
        const x = (width - w) / 2;
        const y = (height - h) / 2;

        ctx.save();
        ctx.globalAlpha = dark ? 0.055 : 0.035;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, x, y, w, h);
        ctx.restore();
      }

      const { k, x: panX, y: panY } = transformRef.current;
      const toScreenX = (val: number) => val * k + panX;
      const toScreenY = (val: number) => val * k + panY;

      const particles = particlesRef.current;

      // radius smoothing
      for (const p of particles) {
        const viewRadius = p.targetRadius * Math.pow(k, 0.25);
        p.radius += (viewRadius - p.radius) * 0.15;
        p.mass = Math.max(1, p.radius);
      }

      // MAP motion with tween
      if (!game) {
        const s2 = statsRef.current;
        const mode = chartModeRef.current;
        if (s2) {
          const mappedFloatMaxAmp = 5.2 * 1.3;
          const mappedFloatAmp = floatStrengthRef.current * mappedFloatMaxAmp;

          for (const p of particles) {
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

            const to = projectCoinToMapXY(p.coin, mode);
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

      // draw particles
      const st = searchTermRef.current;
      const tl = trailLengthRef.current;

      for (const p of particlesRef.current) {
        const screenX = toScreenX(p.x);
        const screenY = toScreenY(p.y);

        if (screenX + p.radius < 0 || screenX - p.radius > width || screenY + p.radius < 0 || screenY - p.radius > height) continue;

        let alpha = 1.0;

        const isHovered = hoveredParticleRef.current?.id === p.id;
        const isSelected = selectedParticleRef.current?.id === p.id;

        const isDimmed = st
          && !p.coin.name.toLowerCase().includes(st.toLowerCase())
          && !p.coin.symbol.toLowerCase().includes(st.toLowerCase());

        if (isDimmed) alpha *= 0.12;

        if (tl > 0 && alpha > 0.05) {
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
            ctx.lineWidth = Math.min(p.radius * 0.4, 4);
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
          ctx.font = `bold ${Math.max(11, p.radius * 0.42)}px Inter`;
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

      reqIdRef.current = requestAnimationFrame(loop);
    };

    reqIdRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(reqIdRef.current);
  }, [projectCoinToMapXY]);

  // =======================
  // UI: click close, etc.
  // =======================
  const detailHeader = useMemo(() => {
    if (!detailCoin) return null;
    return {
      name: detailCoin.name,
      symbol: detailCoin.symbol?.toUpperCase(),
      rank: (detailCoin as any).market_cap_rank ?? '-',
      image: detailCoin.image
    };
  }, [detailCoin]);

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailCoin(null);
    setSelectedParticle(null);
  };

  // =======================
  // RENDER
  // =======================
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

      {/* DETAIL MODAL (DECENTE) */}
      {detailOpen && detailCoin && (
        <div
          className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55"
          onMouseDown={() => closeDetail()}
        >
          <div
            className="w-[94vw] max-w-[980px] rounded-2xl border border-gray-200 dark:border-white/10 bg-white/95 dark:bg-black/80 backdrop-blur-md shadow-2xl p-5"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <img src={detailHeader?.image} alt={detailHeader?.name} className="w-14 h-14 rounded-2xl" />
                <div>
                  <div className="text-2xl font-black leading-tight">{detailHeader?.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
                    <span className="px-2 py-1 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                      {detailHeader?.symbol}
                    </span>
                    <span className="px-2 py-1 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                      Rank #{detailHeader?.rank}
                    </span>
                    <a
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10"
                      href={(detailCoin as any)?.link || (detailCoin as any)?.links?.homepage?.[0] || '#'}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir fonte"
                    >
                      <ExternalLink size={14} />
                      <span>Fonte</span>
                    </a>
                  </div>
                </div>
              </div>

              <button
                onClick={() => closeDetail()}
                className="p-2 rounded-xl bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 border border-gray-200 dark:border-white/10"
                title="Fechar"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            {/* Main grid */}
            <div className="mt-5 grid grid-cols-12 gap-4">
              {/* Left: Metrics */}
              <div className="col-span-12 lg:col-span-7">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-2xl p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                    <div className="text-xs font-black text-gray-500 dark:text-gray-400">Preço</div>
                    <div className="text-lg font-black mt-1">{formatPrice((detailCoin as any).current_price)}</div>
                  </div>

                  <div className="rounded-2xl p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                    <div className="text-xs font-black text-gray-500 dark:text-gray-400">Market Cap</div>
                    <div className="text-lg font-black mt-1">{formatCompact((detailCoin as any).market_cap)}</div>
                  </div>

                  <div className="rounded-2xl p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                    <div className="text-xs font-black text-gray-500 dark:text-gray-400">Volume 24h</div>
                    <div className="text-lg font-black mt-1">{formatCompact((detailCoin as any).total_volume)}</div>
                  </div>

                  <div className="rounded-2xl p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                    <div className="text-xs font-black text-gray-500 dark:text-gray-400">FDV</div>
                    <div className="text-lg font-black mt-1">{formatCompact((detailCoin as any).fully_diluted_valuation)}</div>
                  </div>
                </div>

                {/* Variations row */}
                <div className="mt-4 rounded-2xl p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart2 size={16} className="text-[#dd9933]" />
                      <div className="text-sm font-black">Variações</div>
                    </div>

                    <div className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-2">
                      <Clock size={14} />
                      <span>1h / 24h / 7d</span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div className="rounded-xl p-3 border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-black/30">
                      <div className="text-xs font-black text-gray-500 dark:text-gray-400">1h</div>
                      <div className="text-xl font-black mt-1" style={{ color: pctColor(changes?.p1h as any) }}>
                        {fmtPct(changes?.p1h as any)}
                      </div>
                    </div>

                    <div className="rounded-xl p-3 border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-black/30">
                      <div className="text-xs font-black text-gray-500 dark:text-gray-400">24h</div>
                      <div className="text-xl font-black mt-1" style={{ color: pctColor(changes?.p24 as any) }}>
                        {fmtPct(changes?.p24 as any)}
                      </div>
                    </div>

                    <div className="rounded-xl p-3 border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-black/30">
                      <div className="text-xs font-black text-gray-500 dark:text-gray-400">7d</div>
                      <div className="text-xl font-black mt-1" style={{ color: pctColor(changes?.p7d as any) }}>
                        {fmtPct(changes?.p7d as any)}
                      </div>
                    </div>
                  </div>

                  {(changes?.athChange != null || changes?.atlChange != null) && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="rounded-xl p-3 border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-black/30">
                        <div className="text-xs font-black text-gray-500 dark:text-gray-400">ATH change</div>
                        <div className="text-base font-black mt-1" style={{ color: pctColor(changes?.athChange as any) }}>
                          {fmtPct(changes?.athChange as any)}
                        </div>
                      </div>
                      <div className="rounded-xl p-3 border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-black/30">
                        <div className="text-xs font-black text-gray-500 dark:text-gray-400">ATL change</div>
                        <div className="text-base font-black mt-1" style={{ color: pctColor(changes?.atlChange as any) }}>
                          {fmtPct(changes?.atlChange as any)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Extra details table */}
                <div className="mt-4 rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-100/70 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                    <div className="text-sm font-black">Detalhes</div>
                    <div className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-2">
                      <Calendar size={14} />
                      <span>dados do endpoint</span>
                    </div>
                  </div>

                  <div className="p-4 bg-white/70 dark:bg-black/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {extraRows.map((r) => (
                        <div key={r.k} className="flex items-center justify-between gap-3 rounded-xl p-3 border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5">
                          <div className="text-xs font-black text-gray-500 dark:text-gray-400">{r.k}</div>
                          <div className="text-sm font-black text-gray-900 dark:text-gray-100 text-right">{r.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Social */}
                {socialLinks.length > 0 && (
                  <div className="mt-4 rounded-2xl p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                    <div className="text-sm font-black mb-3">Redes sociais</div>
                    <div className="flex flex-wrap gap-2">
                      {socialLinks.map((s) => (
                        <a
                          key={`${s.type}:${s.url}`}
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-black/30 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                          title={s.label}
                        >
                          <span className="text-gray-700 dark:text-gray-200">
                            <SocialIcon type={s.type} />
                          </span>
                          <span className="text-xs font-black">{s.label}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Magazine carousel */}
              <div className="col-span-12 lg:col-span-5">
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden bg-gray-50 dark:bg-white/5">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                    <div className="text-sm font-black">Magazine</div>

                    <div className="flex items-center gap-2">
                      <a
                        href={MAGAZINE_FALLBACK_LINK_BASE}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-black/30 hover:bg-gray-100 dark:hover:bg-white/10 text-xs font-black inline-flex items-center gap-1"
                        title="Abrir Magazine"
                      >
                        <ExternalLink size={14} />
                        <span>Abrir</span>
                      </a>

                      <button
                        onClick={goMagPrev}
                        className="p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-black/30 hover:bg-gray-100 dark:hover:bg-white/10"
                        title="Anterior"
                        disabled={magPageCount <= 1}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={goMagNext}
                        className="p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-black/30 hover:bg-gray-100 dark:hover:bg-white/10"
                        title="Próximo"
                        disabled={magPageCount <= 1}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="p-4">
                    {magLoading && (
                      <div className="text-sm font-bold text-gray-500 dark:text-gray-400">
                        Carregando últimas do Magazine...
                      </div>
                    )}

                    {!magLoading && magError && (
                      <div className="text-sm font-bold text-red-600 dark:text-red-400">
                        Falha ao carregar: {magError}
                      </div>
                    )}

                    {!magLoading && !magError && magVisible.length === 0 && (
                      <div className="text-sm font-bold text-gray-500 dark:text-gray-400">
                        Sem posts disponíveis.
                      </div>
                    )}

                    {!magLoading && !magError && magVisible.length > 0 && (
                      <div className="space-y-3">
                        {magVisible.map((p) => {
                          const img = pickFeatured(p);
                          const title = safeTitle(p?.title?.rendered || '');
                          const excerpt = stripHtml(p?.excerpt?.rendered || '').slice(0, 120);
                          const dt = p?.date ? new Date(p.date) : null;

                          return (
                            <a
                              key={p.id}
                              href={p.link}
                              target="_blank"
                              rel="noreferrer"
                              className="group block rounded-2xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-black/30 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors overflow-hidden"
                              title={title}
                            >
                              <div className="flex gap-3 p-3">
                                <div className="w-20 h-16 rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-200/60 dark:bg-white/5 shrink-0">
                                  {img ? (
                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs font-black text-gray-500 dark:text-gray-400">
                                      NEWS
                                    </div>
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-black text-gray-900 dark:text-gray-100 line-clamp-2">
                                    {title}
                                  </div>
                                  <div className="mt-1 text-xs font-bold text-gray-500 dark:text-gray-400 line-clamp-2">
                                    {excerpt || 'Abrir matéria'}
                                  </div>

                                  {dt && (
                                    <div className="mt-2 text-[11px] font-black text-gray-400 dark:text-gray-500 flex items-center gap-2">
                                      <Calendar size={12} />
                                      <span>{dt.toLocaleDateString()}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    )}

                    {/* Previews footer (6 thumbs) */}
                    {magPosts.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/10">
                        <div className="text-[11px] font-black text-gray-500 dark:text-gray-400 mb-2">
                          Últimas 6 (previews)
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                          {magPosts.slice(0, 6).map((p, idx) => {
                            const img = pickFeatured(p);
                            const active = (magIndex === 0 && idx < 3) || (magIndex === 1 && idx >= 3);
                            return (
                              <button
                                key={p.id}
                                onClick={() => setMagIndex(idx < 3 ? 0 : 1)}
                                className={`h-10 rounded-lg overflow-hidden border transition-colors ${
                                  active ? 'border-[#dd9933]' : 'border-gray-200 dark:border-white/10'
                                } bg-gray-200/60 dark:bg-white/5 hover:opacity-90`}
                                title={safeTitle(p?.title?.rendered || '')}
                              >
                                {img ? (
                                  <img src={img} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-gray-500 dark:text-gray-400">
                                    {idx + 1}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 text-[11px] font-bold text-gray-500 dark:text-gray-400">
                  Dica: o carrossel troca automático a cada ~6.5s, em blocos de 3.
                </div>
              </div>
            </div>

            <div className="mt-4 text-xs font-bold text-gray-500 dark:text-gray-400">
              Clique fora para fechar.
            </div>
          </div>
        </div>
      )}

      {/* STAGE */}
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
