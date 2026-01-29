import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiCoin, Language, DashboardItem } from '../../../types';
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
  Play,
  AlertTriangle,
  RefreshCw,
  Trophy,
  LogOut,
  RotateCcw,
  Target,
  Crosshair,
  Volume2,
  VolumeX
} from 'lucide-react';
import { 
  Twitter, 
  Instagram, 
  Youtube, 
  Send, 
  TikTok, 
  Spotify 
} from '../../../components/Icons';
import { fetchTopCoins } from '../services/api';

// --- SOUND PATHS (served from /public) .---
const runtimeBase = window.location.pathname.startsWith('/v3/') ? '/v3/' : '/';
const sfx = (name: string) => `${runtimeBase}sfx/${name}`;

const SND_FUNDO = sfx('fundo.mp3');
const SND_BOLAS = sfx('bolas.mp3');
const SND_CACAPA = sfx('cacapa.mp3');
const SND_GAMEOVER = sfx('gameover.mp3');
const SND_VITORIA = sfx('vitoria.mp3');
const SND_FALL = sfx('fall.mp3');




// --- INTERFACES ---
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
  
  // Flag para evitar pontuação duplicada nos sub-steps de física
  scoreCounted?: boolean;

  // map transition
  mapFromX?: number;
  mapFromY?: number;
  mapToX?: number;
  mapToY?: number;
  mapT?: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  subText: string;
  age: number; // 1.0 a 0.0
  color: string;
}

type ChartMode = 'performance' | 'valuation';
type Status = 'loading' | 'running' | 'demo' | 'error';
type Timeframe = '1h' | '24h' | '7d';

interface CryptoMarketBubblesProps { 
    language: Language; 
    onClose?: () => void;
    // Widget Props
    isWidget?: boolean;
    item?: DashboardItem;
}

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

// FIX: Real calculation based on Timeframe
const computeSparkChange = (coin: any, tf: Timeframe) => {
  let pct = 0;
  
  if (tf === '24h') {
      // Use direct API field for 24h to be precise
      pct = Number(coin?.price_change_percentage_24h);
  } else {
      // Calculate from Sparkline for 1h and 7d
      const prices = coin?.sparkline_in_7d?.price;
      if (Array.isArray(prices) && prices.length > 1) {
          const last = prices[prices.length - 1];
          let start = prices[0];

          if (tf === '1h') {
              // Assuming ~168 points for 7 days (hourly resolution from CoinGecko)
              // We take the second to last point as approx 1h ago
              const idx = Math.max(0, prices.length - 2); 
              start = prices[idx];
          } else if (tf === '7d') {
              start = prices[0];
          }

          if (start !== 0 && isFinite(start) && isFinite(last)) {
              pct = ((last - start) / start) * 100;
          } else {
              // Fallback if sparkline is weird
              pct = Number(coin?.price_change_percentage_24h); 
          }
      } else {
          // Fallback if no sparkline
          pct = Number(coin?.price_change_percentage_24h);
      }
  }

  // Safety check
  if (!isFinite(pct)) pct = 0;

  return { 
      pct, 
      absPct: Math.abs(pct), 
      series: null as number[] | null, 
      inferredMinutesPerPoint: null as number | null 
  };
};

// --- WATERMARK URL (Logo Central Crypto) ---
const WATERMARK_URL = 'https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png';

const drawWatermark = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  img: HTMLImageElement | null,
  opacity: number,
  // Optional specific dimensions (for drawing inside the pool table)
  rect?: { x: number, y: number, w: number, h: number }
) => {
  if (!img || !img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return;

  let x, y, w, h;

  if (rect) {
      // Draw inside specific rect (Pool Table felt)
      // Fit logo within 80% of rect dimensions
      const margin = 0.8;
      const scaleW = (rect.w * margin) / img.naturalWidth;
      const scaleH = (rect.h * margin) / img.naturalHeight;
      const scale = Math.min(scaleW, scaleH);

      w = img.naturalWidth * scale;
      h = img.naturalHeight * scale;
      x = rect.x + (rect.w - w) / 2;
      y = rect.y + (rect.h - h) / 2;
  } else {
      // Draw standard centered (Map mode)
      const minDim = Math.min(width, height);
      const targetW = minDim * 0.5;
      const scale = targetW / img.naturalWidth;
      w = img.naturalWidth * scale;
      h = img.naturalHeight * scale;
      x = (width - w) / 2;
      y = (height - h) / 2;
  }

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
};

// GAME CONFIG - TABLE DIMENSIONS
// Borda externa (chão)
const TABLE_FLOOR_MARGIN = 40; 
// Largura da madeira
const TABLE_WOOD_WIDTH = 30;
// Largura da borracha interna (cushion)
const TABLE_CUSHION_WIDTH = 10;

// O PAD de colisão física é a soma das bordas até a área jogável
const GAME_WALL_PAD = TABLE_FLOOR_MARGIN + TABLE_WOOD_WIDTH + TABLE_CUSHION_WIDTH;

const GAME_BALL_RADIUS = 26;
const GAME_CUE_RADIUS = 32;
const GAME_LINEAR_DAMP = 0.994;
const GAME_STOP_EPS = 0.6;

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

const CryptoMarketBubbles = ({ language, onClose, isWidget = false, item }: CryptoMarketBubblesProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null); // FIX: Ref for button

  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]); // New Floating Texts
  
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

  // Timer para fechar settings
  const settingsCloseTimerRef = useRef<number | null>(null);

  const [isGameMode, setIsGameMode] = useState(false);
  // Default to Free Mode if it's a widget, otherwise start in Map Mode
  const [isFreeMode, setIsFreeMode] = useState(isWidget); 
  
  // Game states
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [showGameIntro, setShowGameIntro] = useState(false);

  // Widget specific: Fewer coins when minimized
  const isMaximized = item?.isMaximized ?? !isWidget;
  const defaultCoins = isWidget && !isMaximized ? 25 : 100;

  const [numCoins, setNumCoins] = useState(defaultCoins);
  const [floatStrengthRaw, setFloatStrengthRaw] = useState(0.2);
  const [trailLength, setTrailLength] = useState(25);

  const [gameHasShot, setGameHasShot] = useState(false);
  const gameHasShotRef = useRef(false);
  useEffect(() => { gameHasShotRef.current = gameHasShot; }, [gameHasShot]);

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

  // ====== AUDIO SYSTEM ======
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(0.5);

  // Audio state refs to avoid stale closures in game loop
  const soundEnabledRef = useRef(soundEnabled);
  const soundVolumeRef = useRef(soundVolume);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { soundVolumeRef.current = soundVolume; }, [soundVolume]);

  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const sfxBolasRef = useRef<HTMLAudioElement | null>(null);
  const sfxCacapaRef = useRef<HTMLAudioElement | null>(null);
  const sfxGameOverRef = useRef<HTMLAudioElement | null>(null);
  const sfxVitoriaRef = useRef<HTMLAudioElement | null>(null);
  const sfxFallRef = useRef<HTMLAudioElement | null>(null);
  const lastCollisionTimeRef = useRef(0); // Debounce collisions

  const playSound = (audio: HTMLAudioElement | null, volumeMultiplier = 1.0) => {
      if (!audio || !soundEnabledRef.current) return;
      try {
          audio.currentTime = 0;
          audio.volume = Math.max(0, Math.min(1, soundVolumeRef.current * volumeMultiplier));
          audio.play().catch(() => {}); // Ignore interaction errors
      } catch (e) {}
  };

  const playCollision = () => {
      const now = performance.now();
      if (now - lastCollisionTimeRef.current > 80) { // Limit to 1 sound every 80ms
        playSound(sfxBolasRef.current, 0.8);
        lastCollisionTimeRef.current = now;
      }
  };

  useEffect(() => {
    // Helper to create and preload audio
    const createAudio = (src: string, loop = false) => {
        const a = new Audio(src);
        a.loop = loop;
        a.preload = 'auto';
        a.volume = soundVolume;
        return a;
    };

    bgMusicRef.current = createAudio(SND_FUNDO, true);
    sfxBolasRef.current = createAudio(SND_BOLAS);
    sfxCacapaRef.current = createAudio(SND_CACAPA);
    sfxGameOverRef.current = createAudio(SND_GAMEOVER);
    sfxVitoriaRef.current = createAudio(SND_VITORIA);
    sfxFallRef.current = createAudio(SND_FALL);

    return () => {
        if(bgMusicRef.current) {
            bgMusicRef.current.pause();
            bgMusicRef.current = null;
        }
    };
  }, []);

  // Update Volumes dynamically
  useEffect(() => {
     if(bgMusicRef.current) bgMusicRef.current.volume = Math.max(0, Math.min(1, soundVolume * 0.3)); // Background lower
  }, [soundVolume]);

  // Manage BG Music based on Game Mode and Settings
  useEffect(() => {
      if (isGameMode && soundEnabled && bgMusicRef.current) {
          // Play on interaction (handled in pointerDown) or try now
          bgMusicRef.current.play().catch(() => {});
      } else if (bgMusicRef.current) {
          bgMusicRef.current.pause();
          if(!isGameMode) bgMusicRef.current.currentTime = 0;
      }
  }, [isGameMode, soundEnabled]);

  // ====== GAME NEW MECHANIC ======
  // aimLocked: true when user clicks once. Then the slider UI appears.
  const [isAimLocked, setIsAimLocked] = useState(false);
  // shotPower: 0 to 100, controlled by UI Slider
  const [shotPower, setShotPower] = useState(0);
  // Position for the slider popup (clamped to screen)
  const [aimLockPos, setAimLockPos] = useState({ x: 0, y: 0 });
  
  // Refs for loop access
  const isAimLockedRef = useRef(false);
  const shotPowerRef = useRef(0);
  
  useEffect(() => { isAimLockedRef.current = isAimLocked; }, [isAimLocked]);
  useEffect(() => { shotPowerRef.current = shotPower; }, [shotPower]);

  // Game Aim State (Position of aim target)
  const gameAimRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

  const cueHideUntilRef = useRef<number>(0);
  const pointerDownRef = useRef(false);

  const prevNormalNumCoinsRef = useRef<number>(100);

  const centralSocials = useMemo(() => ([
    { icon: Twitter, href: "https://x.com/TradersCentral" },
    { icon: Instagram, href: "https://www.instagram.com/centralcrypto72/" },
    { icon: Youtube, href: "https://www.youtube.com/@centralcryptotraders" },
    { icon: Send, href: "https://t.me/+80XjLzFScH0yMWQx" },
    { icon: TikTok, href: "https://www.tiktok.com/@centralcrypto323" },
    { icon: Spotify, href: "https://open.spotify.com/show/1FurXwMBQIJOBKEBXDUiGb" }
  ]), []);

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

  // ===== Update Coins Count when Maximized Changes =====
  useEffect(() => {
      if (isWidget) {
          // Update coin count based on maximize state
          setNumCoins(isMaximized ? 100 : 25);
          
          // Reset transform to fit new size
          animateTransformTo({ k: 1, x: 0, y: 0 }, 0.5);
      }
  }, [isMaximized, isWidget]);

  // ===== Click outside settings to close =====
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (
            settingsOpen && 
            settingsPanelRef.current && 
            !settingsPanelRef.current.contains(event.target as Node) &&
            settingsBtnRef.current && // Check if click is NOT on the button
            !settingsBtnRef.current.contains(event.target as Node)
        ) {
            setSettingsOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [settingsOpen]);

  // ===== Auto Close Settings on Mouse Leave Logic =====
  const handleSettingsEnter = () => {
    if (settingsCloseTimerRef.current) {
        clearTimeout(settingsCloseTimerRef.current);
        settingsCloseTimerRef.current = null;
    }
  };

  const handleSettingsLeave = () => {
    settingsCloseTimerRef.current = window.setTimeout(() => {
        setSettingsOpen(false);
    }, 3000);
  };

  // Prevent Body Scroll only in Full Page Mode
  useEffect(() => {
    if (isWidget) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [isWidget]);

  // Load Watermark
  useEffect(() => {
    const tryLoad = (src: string, onOk: () => void, onFail: () => void) => {
      if (!src) { onFail(); return; }
      const img = new Image();
      // REMOVIDO crossOrigin para evitar bloqueio se o servidor não enviar header
      // img.crossOrigin = 'anonymous'; 
      img.onload = () => { watermarkRef.current = img; onOk(); };
      img.onerror = () => onFail();
      img.src = src;
    };
    tryLoad(WATERMARK_URL, () => {}, () => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDetailOpen(false);
        setSettingsOpen(false);
        setLegendTipOpen(false);
        
        // Cancel Aim
        setIsAimLocked(false);
        setShotPower(0);

        if (draggedParticleRef.current) {
          draggedParticleRef.current.isFixed = false;
          draggedParticleRef.current = null;
        }
        isPanningRef.current = false;
        pointerDownRef.current = false;
      }
      
      // Fire on Spacebar if Aim Locked
      if (e.code === 'Space' && isAimLockedRef.current) {
          e.preventDefault();
          executeShot();
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

  // ===== Stats + targets =====
  const recomputeStatsAndTargets = useCallback((coinsList: ApiCoin[], mode: ChartMode, effectiveCount: number) => {
    const topCoins = coinsList.slice(0, effectiveCount);
    if (topCoins.length === 0) return;

    const xData: number[] = [];
    const yData: number[] = [];
    const rData: number[] = [];

    // FORCE VALUATION MODE IN FREE MODE FOR SIZING
    const sizingMode = isFreeMode ? 'valuation' : mode;

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

      if (isGameMode) {
        // Fix: Force standard sizes in game mode, ignoring market data
        p.targetRadius = isBTC ? GAME_CUE_RADIUS : GAME_BALL_RADIUS;
      } else {
        let targetRadius = 24;
        
        if (sizingMode === 'performance') {
          let metric = Math.max(0.000001, sizeMetricPerf(p.coin));
          const t = (metric - minR) / (maxR - minR || 1);
          targetRadius = 15 + clamp(t, 0, 1) * 55;
        } else {
          // VALUATION MODE (Power Law scaling for Mkt Cap)
          const metric = Math.max(1, Number(p.coin.market_cap) || 1);
          // Recalculate maxR for valuation specifically if we are forcing valuation sizing in perf mode
          let valMaxR = maxR;
          if (mode === 'performance') {
             const mcaps = topCoins.map(c => Math.max(1, Number(c.market_cap) || 1));
             valMaxR = Math.max(...mcaps);
          }
          const ratio = Math.pow(metric, 0.55) / Math.pow(valMaxR, 0.55);
          targetRadius = 18 + ratio * 90;
        }
        
        // Widget Mini Mode scaling
        if (isWidget && !isMaximized) {
            targetRadius *= 0.7; // Reduce size for mini widget
        }

        p.targetRadius = targetRadius;
      }

      p.mass = Math.max(1, p.targetRadius);
      p.color = isBTC ? '#ffffff' : baseColor;
    }
  }, [getCoinPerfPct, sizeMetricPerf, isGameMode, isFreeMode, isWidget, isMaximized]);

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

    // ajuste: garante que o modo game não herda zoom/pan do modo mapa
    transformRef.current = { k: 1, x: 0, y: 0 };
    tweenRef.current.active = false;

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
      p.scoreCounted = false; // Reset score flag
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

    // GAME WALL PAD agora é maior (chão + madeira + borracha)
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
    floatingTextsRef.current = [];

    // Reset Controls
    setIsAimLocked(false);
    setShotPower(0);
    gameAimRef.current = { x: 0, y: 0 };
    cueHideUntilRef.current = 0;
    pointerDownRef.current = false;

    setGameHasShot(false);
    setGameWon(false);
  }, []);

  // ===== Reset button: reset zoom + also resets free mode to map start + resets game =====
  const hardResetView = useCallback(() => {
    setIsAimLocked(false);
    setShotPower(0);
    pointerDownRef.current = false;

    if (draggedParticleRef.current) {
      draggedParticleRef.current.isFixed = false;
      draggedParticleRef.current = null;
    }
    isPanningRef.current = false;

    animateTransformTo({ k: 1, x: 0, y: 0 }, 0.35);

    if (isFreeMode) {
      if (!isWidget) { // Only force map mode reset in Full Page
          setIsFreeMode(false);
          setTimeout(() => {
            computeMapTargets();
          }, 0);
      }
    }

    if (isGameMode) {
      setNumCoins(16);
      setTimeout(() => {
        setupGameLayout();
      }, 0);
      setGameOver(false);
      setGameWon(false);
      setShowGameIntro(true);
    }
  }, [animateTransformTo, isFreeMode, computeMapTargets, isGameMode, setupGameLayout, isWidget]);

  // NEW: Quick Retry Handler (Instantly resets physics, no re-fetching)
  const handleQuickRetry = useCallback(() => {
      setGameOver(false);
      setGameWon(false);
      setGameHasShot(false);
      
      // Reset score
      pocketedCountRef.current = 0;
      setPocketedUI(prev => ({ ...prev, count: 0 }));

      // Reset Physics Refs
      setIsAimLocked(false);
      setShotPower(0);
      pointerDownRef.current = false;

      // Force instant layout reset without waiting for state/effect chain
      setTimeout(() => {
          setupGameLayout();
      }, 0);
  }, [setupGameLayout]);

  const handleExitGame = useCallback(() => {
      setIsGameMode(false);
      setGameOver(false);
      setGameWon(false);
  }, []);

  // === NEW SHOOT MECHANISM ===
  const executeShot = useCallback(() => {
      if (!isAimLocked) return;
      
      const cue = particlesRef.current.find(pp => String(pp.coin.id).toLowerCase() === 'bitcoin');
      if (!cue || cue.isFalling) return;

      const aimTx = gameAimRef.current.x;
      const aimTy = gameAimRef.current.y;
      
      const dx = aimTx - cue.x;
      const dy = aimTy - cue.y;
      const dist = Math.hypot(dx, dy) || 0.0001;

      const nx = dx / dist;
      const ny = dy / dist;

      // Power is derived from the slider (0-100) mapped to game physics force
      // We start aiming with 0.01 pull, so min is 0.01
      const pullNorm = clamp(shotPower / 100, 0.01, 1);
      const basePower = 42000;
      const power = basePower * pullNorm;

      cue.vx += nx * (power / Math.max(1, cue.mass));
      cue.vy += ny * (power / Math.max(1, cue.mass));

      cueHideUntilRef.current = performance.now() + 5000;
      playSound(sfxBolasRef.current); // Som da tacada

      setGameHasShot(true);
      setIsAimLocked(false);
      setShotPower(0); // Reset slider
  }, [isAimLocked, shotPower, soundEnabled, soundVolume]);

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

  // ===== Build particles (rebuild allowed entering game / before first shot; locked after first shot) =====
  const getEffectiveCount = useCallback(() => {
    if (isGameMode) return clamp(numCoins, 16, 32);
    return numCoins;
  }, [isGameMode, numCoins]);

  useEffect(() => {
    const effectiveNum = getEffectiveCount();
    const topCoins = coins.slice(0, effectiveNum);
    if (topCoins.length === 0) return;

    for (const c of topCoins) {
      if (c?.image && !imageCache.current.has(c.image)) {
        const img = new Image();
        img.src = c.image;
        imageCache.current.set(c.image, img);
      }
    }

    const shouldRebuildInGame = isGameMode && (!gameHasShotRef.current) && (particlesRef.current.length !== effectiveNum);
    const shouldRebuildNormally = !isGameMode;

    if (!shouldRebuildNormally && !shouldRebuildInGame) {
      if (isGameMode) {
        const map = new Map<string, ApiCoin>(topCoins.map(c => [c.id, c]));
        for (const p of particlesRef.current) {
          const up = map.get(p.id);
          if (up) p.coin = up;
        }
      }
      return;
    }

    const existingMap = new Map<string, Particle>(particlesRef.current.map(p => [p.id, p]));
    const w = stageRef.current?.clientWidth || 1000;
    const h = stageRef.current?.clientHeight || 800;

    const newParticles: Particle[] = topCoins.map(coin => {
      const existing = existingMap.get(coin.id);
      if (existing && !isGameMode) {
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
        mapT: 0,
        scoreCounted: false
      };
    });

    particlesRef.current = newParticles;

    recomputeStatsAndTargets(coins, chartMode, effectiveNum);

    if (!isGameMode && !isFreeMode) computeMapTargets();
    if (isGameMode) setupGameLayout();
  }, [coins, numCoins, chartMode, timeframe, isGameMode, isFreeMode, getEffectiveCount, recomputeStatsAndTargets, computeMapTargets, setupGameLayout]);

  useEffect(() => {
    if (coins.length === 0) return;
    const effectiveNum = getEffectiveCount();
    recomputeStatsAndTargets(coins, chartMode, effectiveNum);
    if (!isGameMode && !isFreeMode) computeMapTargets();
  }, [chartMode, timeframe, coins, recomputeStatsAndTargets, isGameMode, isFreeMode, computeMapTargets, getEffectiveCount]);

  // ===== Mode toggles =====
  useEffect(() => {
    if (isGameMode) {
      prevNormalNumCoinsRef.current = numCoins;
      setNumCoins(16);
      setGameHasShot(false);

      setDetailOpen(false);
      setSelectedParticle(null);
      setHoveredParticle(null);

      setIsFreeMode(false);
      setSettingsOpen(false);
      setLegendTipOpen(false);
      
      setGameOver(false);
      setGameWon(false);
      setShowGameIntro(true);

      // ajuste: garante transform neutro ao entrar no game
      animateTransformTo({ k: 1, x: 0, y: 0 }, 0.2);

      setTimeout(() => {
        setupGameLayout();
      }, 0);
      
      // Attempt play bg music if allowed
      if(bgMusicRef.current && soundEnabled) bgMusicRef.current.play().catch(()=>{});

    } else {
      setGameHasShot(false);

      setDetailOpen(false);
      setSettingsOpen(false);
      setLegendTipOpen(false);
      
      setGameOver(false);
      setGameWon(false);
      setShowGameIntro(false);

      if (draggedParticleRef.current) {
        draggedParticleRef.current.isFixed = false;
        draggedParticleRef.current = null;
      }

      setNumCoins(prevNormalNumCoinsRef.current || 100);

      setTimeout(() => {
        computeMapTargets();
      }, 0);

      if(bgMusicRef.current) {
          bgMusicRef.current.pause();
          bgMusicRef.current.currentTime = 0;
      }
    }

    setIsAimLocked(false);
    setShotPower(0);
    pointerDownRef.current = false;
  }, [isGameMode]);

  useEffect(() => {
    if (isFreeMode) {
      for (const p of particlesRef.current) {
        p.mapT = 1;
        p.mapFromX = p.x;
        p.mapFromY = p.y;
        p.mapToX = p.x;
        p.mapToY = p.y;
      }
    } else {
      if (!isGameMode) computeMapTargets();
    }
  }, [isFreeMode, isGameMode, computeMapTargets]);

  // ===== UI helpers =====
  const openDetailFor = (p: Particle) => {
    setSelectedParticle(p);
    setDetailCoin(p.coin);
    setDetailAnimKey(k => k + 1);
    setDetailOpen(true);
  };

  // ===== Pointer handlers =====
  const handlePointerMove = (e: React.PointerEvent) => {
    const wpos = screenToWorld(e.clientX, e.clientY);
    lastMousePosRef.current = { x: wpos.x, y: wpos.y };

    if (detailOpenRef.current) return;

    // Game Aiming Logic
    if (isGameMode) {
      const cue = particlesRef.current.find(pp => String(pp.coin.id).toLowerCase() === 'bitcoin');
      if (!cue || cue.isFalling) return;

      // Only update aim ref if Aim IS NOT locked
      if (!isAimLocked) {
        gameAimRef.current = { x: wpos.x, y: wpos.y };
      }
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

    const { k, x, y } = transformRef.current;

    // Hover Detection
    if (!isGameMode) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

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
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (detailOpenRef.current) return;
    pointerDownRef.current = true;
    
    // Play music on first interaction if needed
    if (isGameMode && bgMusicRef.current && bgMusicRef.current.paused && soundEnabled) {
        bgMusicRef.current.play().catch(() => {});
    }

    if (e.button !== 0) return;

    if (isGameMode) {
      const cue = particlesRef.current.find(pp => String(pp.coin.id).toLowerCase() === 'bitcoin');
      if (!cue || cue.isFalling) return;

      if (!isAimLocked) {
         // Lock Aim on First Click
         setIsAimLocked(true);
         setShotPower(0); // RESET POWER TO 0 ON LOCK
         
         // Capture screen position for slider
         const rect = canvasRef.current?.getBoundingClientRect();
         if (rect) {
             const x = e.clientX;
             const y = e.clientY;
             
             // Clamp to viewport
             const PADDING = 20;
             const POPUP_W = 200;
             const POPUP_H = 100;
             
             let finalX = x;
             let finalY = y - 50;
             
             if (finalX + POPUP_W > window.innerWidth) finalX = window.innerWidth - POPUP_W - PADDING;
             if (finalX < PADDING) finalX = PADDING;
             if (finalY + POPUP_H > window.innerHeight) finalY = window.innerHeight - POPUP_H - PADDING;
             if (finalY < PADDING) finalY = PADDING;
             
             setAimLockPos({ x: finalX, y: finalY });
         }
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

    if (draggedParticleRef.current) {
      draggedParticleRef.current.isFixed = false;
      draggedParticleRef.current = null;
    }
    isPanningRef.current = false;
  }, []);

  useEffect(() => {
    const up = () => handlePointerUp();
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, [handlePointerUp]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (detailOpenRef.current) return;
    if (isGameMode || isFreeMode) return; // Disable zoom in Free Mode too

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
          <div><span className="font-black">Modo Game</span></div>
          <div>• Mova o mouse para mirar.</div>
          <div>• Clique para <b>TRAVAR A MIRA</b>.</div>
          <div>• Use o slider central para tacar.</div>
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

  const effectiveNumCoins = useMemo(() => getEffectiveCount(), [getEffectiveCount]);

  const magSlides = useMemo(() => {
    const out: MagazinePost[][] = [];
    for (let i = 0; i < magPosts.length; i += 3) out.push(magPosts.slice(i, i + 3));
    return out.length ? out : [[]];
  }, [magPosts]);
  
  // ====== “ANTI-PISCAR”: render loop roda uma vez e lê tudo por refs ======
  const renderStateRef = useRef({
    isDark,
    chartMode,
    isGameMode,
    isFreeMode,
    timeframe,
    floatStrengthRaw,
    trailLength,
    searchTerm,
    isWidget // Added
  });

  useEffect(() => {
    renderStateRef.current = {
      isDark,
      chartMode,
      isGameMode,
      isFreeMode,
      timeframe,
      floatStrengthRaw,
      trailLength,
      searchTerm,
      isWidget // Added
    };
  }, [isDark, chartMode, isGameMode, isFreeMode, timeframe, floatStrengthRaw, trailLength, searchTerm, isWidget]);

  // ===== RENDER LOOP (single mount, no flicker) =====
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: true });
    if (!ctx || !canvas) return;

    let lastTime = performance.now();

    const drawAimMarker = (ctx2: CanvasRenderingContext2D, x: number, y: number, k: number, isLocked: boolean, isDarkMode: boolean) => {
      const pulse = isLocked ? (1 + Math.sin(performance.now() * 0.012) * 0.12) : 1;
      ctx2.save();
      ctx2.globalAlpha = isLocked ? 0.92 : 0.75;
      // Change color when locked to indicate ready state
      ctx2.strokeStyle = isLocked ? '#22c55e' : (isDarkMode ? 'rgba(255,255,255,0.80)' : 'rgba(0,0,0,0.75)');
      ctx2.lineWidth = (isLocked ? 3 : 2) / k;

      ctx2.beginPath();
      ctx2.arc(x, y, (12 * pulse) / k, 0, Math.PI * 2);
      ctx2.stroke();

      ctx2.beginPath();
      ctx2.moveTo(x - 18 / k, y);
      ctx2.lineTo(x + 18 / k, y);
      ctx2.stroke();

      ctx2.beginPath();
      ctx2.moveTo(x, y - 18 / k);
      ctx2.lineTo(x, y + 18 / k);
      ctx2.stroke();

      ctx2.restore();
    };

    const loop = () => {
      const now = performance.now();
      const dtRaw = (now - lastTime) / 1000;
      const dt = Math.min(dtRaw, 1 / 30);
      lastTime = now;

      const rs = renderStateRef.current;

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

      // clear background
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      // Is Widget Mode Background? Use standard bg color
      if (rs.isWidget) { // Changed from isWidget to rs.isWidget
          ctx.fillStyle = rs.isDark ? '#0b0f14' : '#ffffff';
      } else {
          ctx.fillStyle = rs.isGameMode ? (rs.isDark ? '#08110c' : '#e8f3ea') : (rs.isDark ? '#0b0f14' : '#ffffff');
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      
      // Se não for Game Mode, desenha watermark aqui no centro (Map Mode)
      if (!rs.isGameMode) {
          // Fix: Argument of type 'boolean' is not assignable to parameter of type 'number'.
          drawWatermark(ctx, width, height, watermarkRef.current, rs.isDark ? 0.05 : 0.08);
      }

      const { k, x: panX, y: panY } = transformRef.current;
      ctx.save();
      ctx.translate(panX, panY);
      ctx.scale(k, k);

      const particles = particlesRef.current;

      // update radii
      for (const p of particles) {
        const viewRadius = rs.isGameMode ? p.targetRadius : (p.targetRadius / k);
        p.radius += (viewRadius - p.radius) * 0.15;
        p.mass = Math.max(1, p.radius);
      }

      // pockets + rails
      let pockets: { x: number; y: number; r: number }[] = [];
      if (rs.isGameMode) {
        const worldW = width / k;
        const worldH = height / k;

        // --- NEW TABLE VISUALS ---
        const FLOOR_MARGIN = 40; 
        const WOOD_WIDTH = 30;
        const CUSHION_WIDTH = 10;
        const RAIL_TOTAL = WOOD_WIDTH + CUSHION_WIDTH;
        const TOTAL_PAD = FLOOR_MARGIN + RAIL_TOTAL; // Should match GAME_WALL_PAD

        // 1. Draw Floor (Background behind table)
        ctx.fillStyle = '#1c1c1c'; // Dark Floor
        ctx.fillRect(0, 0, worldW, worldH);

        // 2. Draw Table Frame (Wood)
        // Outer wood rect
        const woodX = FLOOR_MARGIN;
        const woodY = FLOOR_MARGIN;
        const woodW = worldW - (FLOOR_MARGIN * 2);
        const woodH = worldH - (FLOOR_MARGIN * 2);

        // Gradient for Wood
        const woodGrad = ctx.createLinearGradient(woodX, woodY, woodX + woodW, woodY + woodH);
        woodGrad.addColorStop(0, '#5D4037');
        woodGrad.addColorStop(0.5, '#8D6E63');
        woodGrad.addColorStop(1, '#4E342E');

        ctx.fillStyle = woodGrad;
        ctx.beginPath();
        ctx.roundRect(woodX, woodY, woodW, woodH, 20); // Rounded outer corners
        ctx.fill();

        // 3. Draw Playing Surface (Felt)
        const feltX = TOTAL_PAD;
        const feltY = TOTAL_PAD;
        const feltW = worldW - (TOTAL_PAD * 2);
        const feltH = worldH - (TOTAL_PAD * 2);

        ctx.fillStyle = '#225533'; // Standard Pool Green
        ctx.fillRect(feltX, feltY, feltW, feltH);
        
        // --- DRAW WATERMARK ON TABLE (ON FELT) ---
        // Desenha a marca d'água dentro da área do feltro, com opacidade adequada
        // Fix: Expected 5-6 arguments, but got 7.
        drawWatermark(ctx, width, height, watermarkRef.current, 0.12, { x: feltX, y: feltY, w: feltW, h: feltH });

        // 4. Draw Inner Cushions (Rails)
        // These are the transition from wood to felt. Simple dark green rects.
        ctx.fillStyle = '#1a4025'; // Darker green for cushions
        
        // Top Cushion
        ctx.fillRect(feltX, woodY + WOOD_WIDTH, feltW, CUSHION_WIDTH);
        // Bottom Cushion
        ctx.fillRect(feltX, woodY + woodH - WOOD_WIDTH - CUSHION_WIDTH, feltW, CUSHION_WIDTH);
        // Left Cushion
        ctx.fillRect(woodX + WOOD_WIDTH, feltY, CUSHION_WIDTH, feltH);
        // Right Cushion
        ctx.fillRect(woodX + woodW - WOOD_WIDTH - CUSHION_WIDTH, feltY, CUSHION_WIDTH, feltH);


        // 5. Define Pockets (Partially inside cushion/wood)
        // Physics logic uses these coords for falling.
        const pr = Math.max(26, Math.min(40, Math.min(worldW, worldH) * 0.04));
        // Offset slightly into the rail for visual realism
        const pocketOffset = pr * 0.3; 
        
        // Top Left
        const p1 = { x: TOTAL_PAD + pocketOffset, y: TOTAL_PAD + pocketOffset, r: pr };
        // Top Mid
        const p2 = { x: worldW / 2, y: TOTAL_PAD, r: pr };
        // Top Right
        const p3 = { x: worldW - TOTAL_PAD - pocketOffset, y: TOTAL_PAD + pocketOffset, r: pr };
        // Bottom Left
        const p4 = { x: TOTAL_PAD + pocketOffset, y: worldH - TOTAL_PAD - pocketOffset, r: pr };
        // Bottom Mid
        const p5 = { x: worldW / 2, y: worldH - TOTAL_PAD, r: pr };
        // Bottom Right
        const p6 = { x: worldW - TOTAL_PAD - pocketOffset, y: worldH - TOTAL_PAD - pocketOffset, r: pr };

        pockets = [p1, p2, p3, p4, p5, p6];

        // Draw Pockets
        ctx.save();
        for (const pk of pockets) {
          ctx.beginPath();
          ctx.arc(pk.x, pk.y, pk.r, 0, Math.PI * 2);
          ctx.fillStyle = '#000000';
          ctx.fill();
          
          // Slight highlight on rim
          ctx.beginPath();
          ctx.arc(pk.x, pk.y, pk.r, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.1)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.restore();
      }

      // axes
      if (!rs.isGameMode && !rs.isFreeMode && statsRef.current) {
        const s = statsRef.current;
        const margin = { top: 18, right: 18, bottom: 92, left: 86 };
        const chartW = Math.max(50, width - margin.left - margin.right);
        const chartH = Math.max(50, height - margin.top - margin.bottom);
        const originX = margin.left;
        const originY = margin.top + chartH;

        ctx.save();
        ctx.strokeStyle = rs.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
        ctx.lineWidth = 1 / k;
        ctx.font = `${12 / k}px Inter`;
        ctx.fillStyle = rs.isDark ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.72)';
        ctx.textBaseline = 'middle';

        const projectX = (v: number) => {
          let norm = 0;
          if (rs.chartMode === 'valuation') {
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
          if (rs.chartMode === 'valuation') val = Math.pow(10, s.logMinX + percent * (s.logMaxX - s.logMinX));
          else val = s.minX + percent * (s.maxX - s.minX);

          const worldX = projectX(val);

          ctx.beginPath();
          ctx.moveTo(worldX, margin.top);
          ctx.lineTo(worldX, originY);
          ctx.stroke();

          ctx.textAlign = 'center';
          const label = (rs.chartMode === 'performance') ? `${val.toFixed(1)}%` : formatCompact(val);
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
        ctx.fillStyle = rs.isDark ? '#dd9933' : '#333';
        const xLabel = rs.chartMode === 'performance' ? `Variação ${rs.timeframe} (%)` : 'Market Cap (Log)';
        ctx.fillText(xLabel, (width / 2) / k, originY + 56 / k);

        ctx.save();
        ctx.translate(18 / k, (height / 2) / k);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Volume 24h (Log)', 0, 0);
        ctx.restore();

        ctx.restore();
      }

      // PHYSICS
      if (rs.isGameMode) {
        const subSteps = 3;
        const stepDt = dt / subSteps;
        const worldW = width / k;
        const worldH = height / k;
        
        // Check for WIN condition
        if (pocketedCountRef.current === pocketedMaxRef.current && !gameWon) {
             setGameWon(true);
             playSound(sfxVitoriaRef.current);
        }

        for (let step = 0; step < subSteps; step++) {
          const drag = Math.pow(GAME_LINEAR_DAMP, stepDt * 60);

          for (const p of particles) {
            if (p.isFalling) continue;
            if (p.isFixed) continue;

            p.vx *= drag;
            p.vy *= drag;

            if (Math.hypot(p.vx, p.vy) < GAME_STOP_EPS) { p.vx = 0; p.vy = 0; }

            p.x += p.vx * stepDt;
            p.y += p.vy * stepDt;
            
            // Wall Collision (Bounce off Cushions)
            const minX = GAME_WALL_PAD + p.radius;
            const maxX = worldW - GAME_WALL_PAD - p.radius;
            const minY = GAME_WALL_PAD + p.radius;
            const maxY = worldH - GAME_WALL_PAD - p.radius;

            if (p.x < minX) { p.x = minX; p.vx *= -0.98; }
            else if (p.x > maxX) { p.x = maxX; p.vx *= -0.98; }

            if (p.y < minY) { p.y = minY; p.vy *= -0.98; }
            else if (p.y > maxY) { p.y = maxY; p.vy *= -0.98; }
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
              
              // Audio trigger on collision
              if (!p1.isFixed && !p2.isFixed) {
                  playCollision();
              }

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

              const restitution = 0.95;
              let impulse = -(1 + restitution) * velAlongNormal;
              impulse /= (1 / p1.mass + 1 / p2.mass);

              const ix = impulse * nx;
              const iy = impulse * ny;

              if (!p1.isFixed) { p1.vx -= ix / p1.mass; p1.vy -= iy / p1.mass; }
              if (!p2.isFixed) { p2.vx += ix / p2.mass; p2.vy += iy / p2.mass; }
            }
          }

          for (const p of particles) {
            if (p.isFalling) continue;
            if (p.isFixed) continue;

            for (const pk of pockets) {
              const dist = Math.hypot(p.x - pk.x, p.y - pk.y);
              if (dist < (pk.r + p.radius * 0.5)) { // Slightly forgiving
                p.isFalling = true;
                p.fallT = 0;
                p.vx = 0;
                p.vy = 0;
                p.fallPocket = pk;
                p.fallFromX = p.x;
                p.fallFromY = p.y;
                
                // Add Score Pop Up
                floatingTextsRef.current.push({
                    x: pk.x,
                    y: pk.y,
                    text: p.coin.symbol,
                    subText: "+1",
                    age: 1.0,
                    color: p.color
                });
                break;
              }
            }
          }

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
              // Correção de Contagem Dupla: Verifica se já foi contabilizado
              if (!p.scoreCounted) {
                  p.scoreCounted = true;
                  
                  const wasCue = String(p.coin.id).toLowerCase() === 'bitcoin';
                  particlesRef.current = particlesRef.current.filter(pp => pp !== p);

                  if (wasCue) {
                    setGameOver(true);
                    playSound(sfxFallRef.current); // Som específico de queda da branca
                    setTimeout(() => playSound(sfxGameOverRef.current), 800); // Game over depois
                  } else {
                    pocketedCountRef.current += 1;
                    setPocketedUI({ count: pocketedCountRef.current, max: pocketedMaxRef.current });
                    playSound(sfxCacapaRef.current);
                  }
              }
            }
          }
        }
      } else if (rs.isFreeMode) {
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

            const drift = 18 * (0.25 + rs.floatStrengthRaw);
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

          const jitterAmp = 1.6 * rs.floatStrengthRaw;
          const jx = Math.sin(now * 0.002 + p.phase) * jitterAmp;
          const jy = Math.cos(now * 0.0024 + p.phase) * jitterAmp;

          p.x = baseX + jx;
          p.y = baseY + jy;
        }
      }
      // DRAW particles
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

        const isDimmed = rs.searchTerm
          && !p.coin.name.toLowerCase().includes(rs.searchTerm.toLowerCase())
          && !p.coin.symbol.toLowerCase().includes(rs.searchTerm.toLowerCase());

        if (isDimmed) alpha *= 0.12;

        if (rs.trailLength > 0 && alpha > 0.05) {
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

          ctx.strokeStyle = isBTC && rs.isGameMode ? (rs.isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.35)') : p.color;
          ctx.lineWidth = (isSelected ? 4 : 2) / k;
          ctx.stroke();
        } else {
          ctx.fillStyle = isBTC && rs.isGameMode ? '#ffffff' : p.color;
          ctx.fill();
        }

        if (!rs.isGameMode && drawRadius > 12) {
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
          ctx.strokeStyle = rs.isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)';
          ctx.lineWidth = 2 / k;
          ctx.beginPath();
          ctx.arc(p.x, p.y, drawRadius + 4 / k, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.restore();
      }

      // Draw Floating Texts
      if (rs.isGameMode) {
          for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
              const ft = floatingTextsRef.current[i];
              ft.age -= 0.02; // Fade out speed
              ft.y -= 1.5 / k; // Float up speed
              
              if (ft.age <= 0) {
                  floatingTextsRef.current.splice(i, 1);
                  continue;
              }

              ctx.save();
              ctx.globalAlpha = ft.age;
              ctx.fillStyle = '#ffffff';
              ctx.font = `black ${20 / k}px Inter`;
              ctx.textAlign = 'center';
              ctx.shadowColor = 'rgba(0,0,0,0.8)';
              ctx.shadowBlur = 4 / k;
              
              // Draw Symbol Text
              ctx.fillText(ft.text, ft.x, ft.y);
              
              // Draw +1 below
              ctx.fillStyle = '#22c55e'; // Green for score
              ctx.font = `bold ${16 / k}px Inter`;
              ctx.fillText(ft.subText, ft.x, ft.y + 20 / k);
              
              ctx.restore();
          }
      }

      // draw cue + aim marker + power meter (game)
      if (rs.isGameMode) {
        const cueBall = particlesRef.current.find(p => String(p.coin.id).toLowerCase() === 'bitcoin');
        if (cueBall && now >= cueHideUntilRef.current) {
          const cx = cueBall.x;
          const cy = cueBall.y;

          let aimTx = cx + 120;
          let aimTy = cy;

          // AIMING LOGIC
          if (isAimLockedRef.current) {
             // Locked: Use stored ref
             aimTx = gameAimRef.current.x;
             aimTy = gameAimRef.current.y;
          } else {
             // Free: Use Mouse Pos
             if (lastMousePosRef.current) {
                 aimTx = lastMousePosRef.current.x;
                 aimTy = lastMousePosRef.current.y;
             }
          }

          const dx = aimTx - cx;
          const dy = aimTy - cy;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const ux = dx / dist;
          const uy = dy / dist;

          const contactGap = 12;
          
          // Visual pullback depends on Slider now
          const pull = isAimLockedRef.current ? clamp(shotPowerRef.current * 1.5, 0, 200) : 14;

          const bob = (Math.sin(now * 0.012) * 6);

          const tipX = cx - ux * (cueBall.radius + contactGap + pull + bob);
          const tipY = cy - uy * (cueBall.radius + contactGap + pull + bob);

          const stickLen = Math.max(300, cueBall.radius * 9);
          const buttX = tipX - ux * stickLen;
          const buttY = tipY - uy * stickLen;

          // --- GHOST BALL (TARGET PREVIEW) ---
          // Desenha onde a bola branca estaria no ponto de mira (aimTx, aimTy)
          // Isso ajuda o usuário a mirar na borda da bola alvo
          ctx.save();
          ctx.beginPath();
          ctx.arc(aimTx, aimTy, cueBall.radius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'; // Semi-transparente
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 1 / k;
          ctx.setLineDash([5 / k, 5 / k]); // Borda tracejada
          ctx.stroke();
          ctx.setLineDash([]); // Reset dash
          ctx.restore();

          // CUE STICK DESIGN - DRAWN AS POLYGON
          ctx.save();
          ctx.globalAlpha = 0.95;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          // Vectors perpendicular to aim direction for width
          const perpX = -uy;
          const perpY = ux;

          const tipW = 6 / k;
          const buttW = 14 / k;

          // Stick body (Wood)
          ctx.beginPath();
          ctx.moveTo(buttX + perpX * buttW, buttY + perpY * buttW); // Butt Top
          ctx.lineTo(tipX + perpX * tipW, tipY + perpY * tipW); // Tip Top
          ctx.lineTo(tipX - perpX * tipW, tipY - perpY * tipW); // Tip Bottom
          ctx.lineTo(buttX - perpX * buttW, buttY - perpY * buttW); // Butt Bottom
          ctx.closePath();
          
          const grad = ctx.createLinearGradient(buttX, buttY, tipX, tipY);
          grad.addColorStop(0, '#5D4037'); // Dark wood
          grad.addColorStop(1, '#A1887F'); // Light wood
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.strokeStyle = rs.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)';
          ctx.lineWidth = 1.5 / k;
          ctx.stroke();

          // Ferrule (White tip part)
          const ferruleLen = 12 / k;
          const ferruleStartX = tipX - ux * ferruleLen;
          const ferruleStartY = tipY - uy * ferruleLen;
          
          ctx.beginPath();
          ctx.moveTo(ferruleStartX + perpX * (tipW * 1.1), ferruleStartY + perpY * (tipW * 1.1));
          ctx.lineTo(tipX + perpX * tipW, tipY + perpY * tipW);
          ctx.lineTo(tipX - perpX * tipW, tipY - perpY * tipW);
          ctx.lineTo(ferruleStartX - perpX * (tipW * 1.1), ferruleStartY - perpY * (tipW * 1.1));
          ctx.closePath();
          ctx.fillStyle = '#f5f5f5';
          ctx.fill();

          // Tip (Blue/Leather)
          const tipCapLen = 4 / k;
          ctx.beginPath();
          ctx.moveTo(tipX + perpX * tipW, tipY + perpY * tipW);
          ctx.lineTo(tipX + ux * tipCapLen + perpX * tipW, tipY + uy * tipCapLen + perpY * tipW);
          ctx.lineTo(tipX + ux * tipCapLen - perpX * tipW, tipY + uy * tipCapLen - perpY * tipW);
          ctx.lineTo(tipX - perpX * tipW, tipY - perpY * tipW);
          ctx.closePath();
          ctx.fillStyle = '#0284c7'; // Sky blue tip
          ctx.fill();

          ctx.restore();

          // aim marker
          drawAimMarker(ctx, aimTx, aimTy, k, isAimLockedRef.current, rs.isDark);
        }
      }

      ctx.restore();

      reqIdRef.current = requestAnimationFrame(loop);
    };

    reqIdRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(reqIdRef.current);
  }, []); // Fixed dependencies

  const containerClassName = isWidget 
        ? "w-full h-full relative flex flex-col bg-white dark:bg-[#0b0f14] overflow-hidden transition-colors" 
        : "fixed inset-0 z-[2000] bg-white dark:bg-[#0b0f14] text-gray-900 dark:text-white flex flex-col overflow-hidden touch-none select-none overscroll-none h-[100dvh] transition-colors";

  // If minimized widget, hide header complex controls
  const showControls = !isWidget || (isWidget && isMaximized);

  return (
    <div
      ref={containerRef}
      className={containerClassName}
    >
      {/* HEADER */}
      {showControls && (
        <div className="flex items-center p-4 z-20 bg-white/80 dark:bg-black/50 backdrop-blur-sm border-b border-transparent dark:border-white/10 shrink-0 transition-colors shadow-sm dark:shadow-none">
            {/* LEFT */}
            <div className="flex items-center gap-4 shrink-0">
            {!isWidget && <Coins size={28} className="text-[#dd9933]" />}
            <div>
                <h3 className="text-xl font-black uppercase tracking-wider hidden sm:block text-gray-900 dark:text-white">Crypto Bubbles</h3>
                {!isWidget && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-bold">
                    {status === 'demo' ? 'MODO DEMO' : isGameMode ? 'MODO GAME' : isFreeMode ? 'MODO LIVRE' : 'MODO MAPA'}
                    </p>
                )}
            </div>

            {isGameMode && (
                <div className="ml-2 px-3 py-1.5 rounded-lg border border-[#dd9933]/30 bg-[#dd9933]/10">
                <div className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Score</div>
                <div className="text-lg font-black text-[#dd9933]">{pocketedUI.count}/{pocketedUI.max}</div>
                </div>
            )}
            </div>

            {/* CENTER: qtdd + busca */}
            <div className="flex-1 flex items-center justify-center gap-3 px-4">
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-black/50 p-2 rounded-lg border border-transparent dark:border-white/10">
                <Coins size={16} className="text-gray-400" />
                <select
                value={getEffectiveCount()}
                onChange={e => {
                    const v = parseInt(e.target.value);
                    if (isGameMode && gameHasShotRef.current) return;
                    setNumCoins(v);
                }}
                className="bg-transparent text-gray-900 dark:text-gray-100 px-2 py-1 rounded text-xs font-black outline-none border-none cursor-pointer"
                disabled={isGameMode && gameHasShot}
                title={isGameMode && gameHasShot ? 'Travado após a 1ª tacada' : ''}
                >
                {(isGameMode ? [16, 24, 32] : [25, 50, 100, 150, 200, 250]).map(n => (
                    <option key={n} value={n} className="bg-white dark:bg-[#2f3032]">{isGameMode ? `${n} bolas` : `${n} moedas`}</option>
                ))}
                </select>
            </div>

            <div className="flex items-center gap-2 bg-gray-100 dark:bg-black/50 p-2 rounded-lg border border-transparent dark:border-white/10">
                <Search size={16} className="text-gray-400" />
                <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar..."
                className="bg-transparent outline-none text-sm w-24 sm:w-56 text-gray-900 dark:text-white placeholder-gray-500"
                disabled={false}
                />
                {searchTerm && (
                <button onClick={() => { setSearchTerm(''); setSelectedParticle(null); }}>
                    <XCircle size={16} className="text-gray-500 hover:text-gray-900 dark:hover:text-white" />
                </button>
                )}
            </div>
            </div>

            {/* RIGHT: botões + controles */}
            <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 hidden sm:flex">
                <div className="flex bg-gray-100 dark:bg-black/50 p-1 rounded-lg border border-transparent dark:border-white/10">
                <button
                    onClick={() => setChartMode('valuation')}
                    className={`px-4 py-1.5 text-xs font-black rounded transition-colors ${chartMode === 'valuation' ? 'bg-white dark:bg-[#2f3032] shadow-sm text-[#dd9933]' : 'text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
                    disabled={isGameMode}
                >
                    MarketCap
                </button>
                </div>

                <div className="flex items-center bg-gray-100 dark:bg-black/50 p-1 rounded-lg border border-transparent dark:border-white/10">
                <button
                    onClick={() => setChartMode('performance')}
                    className={`px-4 py-1.5 text-xs font-black rounded transition-colors ${chartMode === 'performance' ? 'bg-white dark:bg-[#2f3032] shadow-sm text-[#dd9933]' : 'text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
                    disabled={isGameMode}
                >
                    Var %
                </button>

                <div className="w-px h-5 bg-gray-300 dark:bg-white/10 mx-1"></div>

                <div className="flex items-center gap-2 px-2 py-1">
                    <Wind size={14} className="text-gray-400" />
                    <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value as Timeframe)}
                    className="bg-transparent text-gray-900 dark:text-gray-100 px-2 py-1 rounded text-xs font-black border-none outline-none cursor-pointer"
                    disabled={isGameMode}
                    >
                    <option value="1h" className="bg-white dark:bg-[#2f3032]">1h</option>
                    <option value="24h" className="bg-white dark:bg-[#2f3032]">24h</option>
                    <option value="7d" className="bg-white dark:bg-[#2f3032]">7d</option>
                    </select>
                </div>
                </div>
            </div>

            <div className="w-px h-7 bg-gray-200 dark:bg-white/10 mx-2 hidden sm:block"></div>

            <button
                onClick={hardResetView}
                className="p-3 bg-[#dd9933]/10 hover:bg-[#dd9933]/20 text-[#dd9933] rounded-lg border border-[#dd9933]/30 transition-colors"
                title="Reset View"
            >
                <RefreshCw size={20} />
            </button>

            <button
                ref={settingsBtnRef}
                onClick={() => setSettingsOpen(v => !v)}
                onMouseEnter={handleSettingsEnter}
                className={`p-3 rounded-lg border transition-colors backdrop-blur-sm ${settingsOpen ? 'bg-[#dd9933] text-black border-[#dd9933]' : 'bg-gray-100 dark:bg-black/50 border-transparent dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300'}`}
                title="Settings"
            >
                <Settings size={20} />
            </button>

            {!isWidget && (
                <button
                    onClick={() => onClose && onClose()}
                    className="p-3 bg-gray-100 dark:bg-black/50 rounded-lg border border-transparent dark:border-white/10 hover:bg-red-500/10 text-gray-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    title="Close"
                >
                    <CloseIcon size={20} />
                </button>
            )}
            </div>
        </div>
      )}

      {settingsOpen && (
        <div
          ref={settingsPanelRef}
          className="absolute top-24 right-4 bg-white/95 dark:bg-black/90 p-4 rounded-lg border border-gray-200 dark:border-white/10 backdrop-blur-md w-80 z-30 shadow-2xl"
          onMouseEnter={handleSettingsEnter}
          onMouseLeave={handleSettingsLeave}
          onWheel={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Atom size={14} className="text-gray-600 dark:text-gray-400" />
              <span className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-white">Modo Game</span>

              <div className="relative group">
                <button
                  className="ml-1 p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10"
                  title="Instruções do Modo Game"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Info size={14} className="text-gray-500 dark:text-gray-300" />
                </button>

                <div className="absolute right-0 top-6 w-72 bg-white dark:bg-black/95 border border-gray-200 dark:border-white/10 rounded-xl p-3 shadow-xl backdrop-blur-md text-xs opacity-0 pointer-events-none group-hover:opacity-100 z-50">
                  <div className="font-black text-gray-800 dark:text-gray-100 mb-1">Como jogar</div>
                  <div className="text-gray-700 dark:text-gray-200 leading-relaxed">
                    Clique 1 fixa a mira. Clique 2: segure e arraste o taco para trás para regular a força. Solte o botão para dar a tacada.
                  </div>
                </div>
              </div>
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
                <Wind size={14} className="text-gray-600 dark:text-gray-400" />
                <span className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-white">Modo Livre</span>
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
            {isGameMode && (
                <div className="bg-gray-100 dark:bg-[#1a1c1e] p-3 rounded-lg border border-transparent dark:border-white/10">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Áudio do Jogo</span>
                        <button onClick={() => setSoundEnabled(!soundEnabled)} className="text-gray-500 hover:text-[#dd9933]">
                            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                        </button>
                    </div>
                    <input 
                        type="range" 
                        min="0" max="1" step="0.1" 
                        value={soundVolume} 
                        onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                        disabled={!soundEnabled}
                        className="w-full accent-[#dd9933] bg-gray-200 dark:bg-gray-700 rounded-lg h-1.5"
                    />
                </div>
            )}

            <div className={isGameMode ? 'opacity-50' : ''}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Wind size={14} className="text-gray-600 dark:text-gray-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-white">Flutuação</span>
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
                className="w-full accent-[#dd9933] mt-2 bg-gray-200 dark:bg-gray-700 rounded-lg h-2"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Droplets size={14} className="text-gray-600 dark:text-gray-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-white">Rastro (Trail)</span>
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
                className="w-full accent-[#dd9933] mt-2 bg-gray-200 dark:bg-gray-700 rounded-lg h-2"
              />
            </div>

            {isGameMode && (
              <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 leading-relaxed">
                Força fica no medidor flutuante perto do taco. O seletor de bolas trava após a 1ª tacada.
              </div>
            )}
          </div>
        </div>
      )}

      {/* GAME INTRO POPUP */}
      {showGameIntro && isGameMode && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
            <div className="bg-white dark:bg-[#1a1c1e] p-8 rounded-2xl max-w-md text-center border border-gray-200 dark:border-white/10 shadow-2xl relative">
                <button onClick={() => setShowGameIntro(false)} className="absolute top-3 right-3 p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"><CloseIcon size={20}/></button>
                <div className="w-16 h-16 bg-[#dd9933]/10 rounded-full flex items-center justify-center mx-auto mb-4 text-[#dd9933]">
                    <Atom size={32} />
                </div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase mb-2">Modo Game</h2>
                <div className="text-sm text-gray-600 dark:text-gray-300 mb-6 space-y-2 text-left bg-gray-100 dark:bg-black/20 p-4 rounded-xl">
                    <p className="flex items-start gap-2"><span className="text-[#dd9933] font-bold">•</span><span>Use o mouse para mirar.</span></p>
                    <p className="flex items-start gap-2"><span className="text-[#dd9933] font-bold">•</span><span><b>Clique 1:</b> Trava a mira.</span></p>
                    <p className="flex items-start gap-2"><span className="text-[#dd9933] font-bold">•</span><span><b>Painel Inferior:</b> Ajuste a força no slider e clique em TACAR.</span></p>
                    <p className="flex items-start gap-2"><span className="text-[#dd9933] font-bold">•</span><span>Encaçape as moedas menores.</span></p>
                    <p className="flex items-start gap-2 text-red-500 font-bold"><span className="text-red-500 font-bold">•</span><span>Cuidado: Se o Bitcoin cair, GAME OVER!</span></p>
                </div>
                <button 
                    onClick={() => setShowGameIntro(false)} 
                    className="bg-[#dd9933] hover:bg-amber-600 text-white font-black py-3 px-8 rounded-full shadow-lg hover:scale-105 transition-all w-full flex items-center justify-center gap-2"
                >
                    <Play size={18} fill="currentColor" /> JOGAR AGORA
                </button>
            </div>
        </div>
      )}

      {/* WIN SCREEN */}
      {gameWon && isGameMode && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-green-900/90 backdrop-blur-md animate-in zoom-in duration-300 p-4">
            <div className="bg-white dark:bg-[#1a1c1e] p-8 rounded-3xl border-4 border-yellow-400 shadow-2xl relative w-full max-w-md text-center overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10"></div>
                
                <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                     <div className="w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(250,204,21,0.6)] border-4 border-white dark:border-[#1a1c1e] animate-bounce">
                        <Trophy size={48} className="text-black fill-white" />
                     </div>
                </div>

                <div className="mt-10 mb-6 relative z-10">
                    <h1 className="text-4xl font-black text-green-600 dark:text-green-400 uppercase tracking-tighter drop-shadow-sm">VITÓRIA!</h1>
                    <p className="text-sm font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest mt-2">A Dominância do Bitcoin é 100%</p>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-2xl mb-8 border border-green-200 dark:border-green-800 relative z-10">
                    <div className="text-xs font-black text-green-600 dark:text-green-400 uppercase tracking-[0.2em] mb-2">Pontuação Perfeita</div>
                    <div className="text-6xl font-black text-yellow-500 drop-shadow-md">
                        {pocketedUI.count} <span className="text-3xl text-gray-400">/ {pocketedUI.max}</span>
                    </div>
                </div>

                <div className="flex gap-4 relative z-10">
                    <button 
                        onClick={handleExitGame} 
                        className="flex-1 py-4 px-6 rounded-xl border-2 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 font-black text-sm uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                    >
                        <LogOut size={16} /> Sair
                    </button>
                    <button 
                        onClick={handleQuickRetry} 
                        className="flex-1 py-4 px-6 rounded-xl bg-[#dd9933] hover:bg-amber-600 text-black font-black text-sm uppercase tracking-wider transition-all shadow-xl hover:shadow-amber-500/20 active:scale-95 flex items-center justify-center gap-2"
                    >
                        <RotateCcw size={16} /> Jogar Novamente
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* GAME OVER SCREEN - NEW COMPACT VERSION */}
      {gameOver && isGameMode && !gameWon && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in zoom-in duration-300 p-4">
            <div className="bg-white dark:bg-[#1a1c1e] p-6 rounded-2xl border border-red-500/30 shadow-2xl relative w-full max-w-sm text-center">
                
                <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                     <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center shadow-lg border-4 border-white dark:border-[#1a1c1e] animate-bounce">
                        <AlertTriangle size={32} className="text-white" />
                     </div>
                </div>

                <div className="mt-8 mb-4">
                    <h1 className="text-3xl font-black text-red-600 dark:text-red-500 uppercase tracking-tighter">GAME OVER</h1>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-1">Bitcoin deu DUMP!</p>
                </div>

                <div className="bg-gray-100 dark:bg-black/40 p-4 rounded-xl mb-6 border border-gray-200 dark:border-white/5">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Placar Final</div>
                    <div className="text-4xl font-black text-[#dd9933]">
                        {pocketedUI.count} <span className="text-lg text-gray-400">/ {pocketedUI.max}</span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button 
                        onClick={handleExitGame} 
                        className="flex-1 py-3 px-4 rounded-xl border border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-300 font-bold text-xs uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                    >
                        <LogOut size={14} /> Sair
                    </button>
                    <button 
                        onClick={handleQuickRetry} 
                        className="flex-1 py-3 px-4 rounded-xl bg-[#dd9933] hover:bg-amber-600 text-black font-bold text-xs uppercase tracking-wider transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                    >
                        <RotateCcw size={14} /> Reiniciar
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* GAME CONTROLS (AIM LOCKED UI - DYNAMIC POSITION) */}
      {isGameMode && isAimLocked && !gameOver && !gameWon && (
          <div 
            className="absolute z-[90] flex flex-col items-center animate-in zoom-in duration-200"
            style={{ 
                left: aimLockPos.x, 
                top: aimLockPos.y,
                transform: 'translate(0, 0)', // Override any default centering
                pointerEvents: 'auto'
            }}
          >
              <div className="bg-[#1a1c1e]/95 backdrop-blur-xl border border-gray-700 rounded-2xl p-4 flex flex-col items-center gap-3 shadow-2xl relative">
                  {/* Close Button absolute inside */}
                  <button 
                      onClick={() => setIsAimLocked(false)} 
                      className="absolute -top-3 -right-3 p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-md"
                      title="Cancelar (Esc)"
                  >
                      <XCircle size={16} />
                  </button>

                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 drop-shadow-md">
                      Força da Tacada
                  </div>
                  
                  <div className="flex items-center gap-3 w-full">
                      <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          value={shotPower}
                          onChange={(e) => setShotPower(Number(e.target.value))}
                          onMouseUp={executeShot}
                          onTouchEnd={executeShot}
                          className="w-48 h-3 rounded-lg appearance-none cursor-pointer border border-gray-600/50"
                          style={{
                              // Técnica de Dual Gradient:
                              // 1. O primeiro gradiente vai de transparente (0%) até a cor cinza escuro na posição do cursor (shotPower%).
                              // 2. O segundo gradiente é o colorido completo, que fica "por baixo" e é revelado pelo primeiro.
                              background: `linear-gradient(to right, transparent ${shotPower}%, #374151 ${shotPower}%), linear-gradient(to right, #22c55e 0%, #eab308 50%, #ef4444 100%)`
                          }}
                      />
                      <span 
                          className="font-mono font-black text-lg w-10 text-right"
                          style={{ 
                              color: shotPower < 50 ? '#22c55e' : shotPower < 80 ? '#eab308' : '#ef4444' 
                          }}
                      >
                          {shotPower}%
                      </span>
                  </div>
                  
                  <div className="text-[9px] text-gray-500 italic mt-1">
                      Solte para tacar
                  </div>
              </div>
          </div>
      )}

      {/* DETAIL CARD SIMPLE LIST */}
      {detailOpen && detailCoin && (
        <div
          className="absolute inset-0 z-[80] flex items-center justify-center bg-black/55 backdrop-blur-sm"
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
                  <div className="text-lg font-black leading-tight text-gray-900 dark:text-white">{detailCoin.name}</div>
                  <div className="text-xs font-bold text-gray-500 dark:text-gray-400">
                    {detailCoin.symbol?.toUpperCase()} • Rank #{detailCoin.market_cap_rank ?? '-'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setDetailOpen(false)}
                className="p-2 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 border border-transparent dark:border-white/10 text-gray-600 dark:text-white"
                title="Fechar"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-sm space-y-2 text-gray-800 dark:text-gray-200">
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

                <div className="pt-2 flex items-center gap-2 flex-wrap justify-end">
                    {centralSocials.map((s, i) => {
                        const Icon = s.icon;
                        return (
                            <a
                                key={i}
                                href={s.href}
                                target="_blank"
                                rel="noreferrer"
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 hover:bg-[#dd9933] hover:text-white dark:hover:bg-[#dd9933] dark:hover:text-white transition-all shadow-sm text-gray-600 dark:text-gray-400"
                            >
                                <Icon size={16} />
                            </a>
                        );
                    })}
                </div>
              </div>
            </div>

            <div className="md:col-span-2 pt-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-black text-gray-500 dark:text-gray-400">Magazine</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMagIndex(i => (i - 1 + magSlides.length) % magSlides.length)}
                    className="px-3 py-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-xs font-black text-gray-600 dark:text-gray-300"
                    disabled={magSlides.length <= 1}
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <button
                    onClick={() => setMagIndex(i => (i + 1) % magSlides.length)}
                    className="px-3 py-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-xs font-black text-gray-600 dark:text-gray-300"
                    disabled={magSlides.length <= 1}
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                {(magSlides[magIndex] ?? []).map(p => (
                  <a
                    key={p.id}
                    href={p.link}
                    target="_blank"
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
                      <div className="text-sm font-black line-clamp-2 text-gray-800 dark:text-gray-200">{p.title}</div>
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

export default CryptoMarketBubbles;
