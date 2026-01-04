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

  pocketHold?: number;
  isFalling?: boolean;
  fallT?: number;
  fallPocket?: { x: number; y: number; r: number } | null;
}

type ChartMode = 'performance' | 'valuation';
type Status = 'loading' | 'running' | 'demo' | 'error';
type Timeframe = '1h' | '24h' | '7d';

interface MarketWindSwarmProps { language: Language; onClose: () => void; }

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
    return {
      pct,
      absPct: Math.abs(pct),
      series: null as number[] | null,
      inferredMinutesPerPoint: null as number | null
    };
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

const Sparkline = ({ series, color }: { series: number[]; color: string }) => {
  const w = 320;
  const h = 70;
  const pad = 4;

  const points = useMemo(() => {
    const min = Math.min(...series);
    const max = Math.max(...series);
    const range = (max - min) || 1;
    return series.map((v, i) => {
      const x = pad + (i / Math.max(1, series.length - 1)) * (w - pad * 2);
      const y = pad + (1 - ((v - min) / range)) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }, [series]);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[70px]">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

const MarketWindSwarm = ({ language, onClose }: MarketWindSwarmProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const particlesRef = useRef<Particle[]>([]);
  const imageCache = useRef(new Map<string, HTMLImageElement>());
  const animationLoopFn = useRef<(() => void) | null>(null);
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

  // defaults em 50%
  const [floatStrengthRaw, setFloatStrengthRaw] = useState(0.5);
  const [freeSpeedRaw, setFreeSpeedRaw] = useState(0.5);
  const [trailLength, setTrailLength] = useState(25);

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  // Detail panel
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCoin, setDetailCoin] = useState<ApiCoin | null>(null);

  // Interaction
  const transformRef = useRef({ k: 1, x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ clientX: 0, clientY: 0, x: 0, y: 0 });
  const draggedParticleRef = useRef<Particle | null>(null);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

  // NEW: aiming (tacada) no BTC
  const aimingRef = useRef<{
    active: boolean;
    cueId: string | null;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    power: number;
  }>({
    active: false,
    cueId: null,
    fromX: 0,
    fromY: 0,
    toX: 0,
    toY: 0,
    power: 0
  });

  const hoveredParticleRef = useRef(hoveredParticle);
  hoveredParticleRef.current = hoveredParticle;

  const selectedParticleRef = useRef(selectedParticle);
  selectedParticleRef.current = selectedParticle;

  const detailOpenRef = useRef(detailOpen);
  detailOpenRef.current = detailOpen;

  const statsRef = useRef<{
    minX: number, maxX: number,
    minY: number, maxY: number,
    minR: number, maxR: number,
    logMinX: number, logMaxX: number,
    logMinY: number, logMaxY: number
  } | null>(null);

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDetailOpen(false);
        setSettingsOpen(false);
        setLegendTipOpen(false);

        // cancel aim / drag
        aimingRef.current.active = false;
        aimingRef.current.cueId = null;
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

  useEffect(() => {
    if (isGameMode) {
      resetZoom();
      setFreeSpeedRaw(0.2);
      setDetailOpen(false);
      setSelectedParticle(null);
      setHoveredParticle(null);

      // clear aim
      aimingRef.current.active = false;
      aimingRef.current.cueId = null;
    }
  }, [isGameMode, resetZoom]);

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
  }, []);

  const getCoinPerfPct = useCallback((coin: any) => computeSparkChange(coin, timeframe).pct, [timeframe]);
  const getCoinAbsPct = useCallback((coin: any) => computeSparkChange(coin, timeframe).absPct, [timeframe]);

  const sizeMetricPerf = useCallback((coin: any) => {
    const absPct = Math.max(0, getCoinAbsPct(coin));
    const vol = Math.max(0, Number(coin?.total_volume) || 0);
    const volFactor = Math.log10(vol + 1);
    return absPct * volFactor;
  }, [getCoinAbsPct]);

  useEffect(() => {
    const topCoins = coins.slice(0, numCoins);
    if (topCoins.length === 0) return;

    const xData: number[] = [];
    const yData: number[] = [];
    const rData: number[] = [];

    for (const c of topCoins) {
      const vol = Math.max(1, Number(c.total_volume) || 1);
      yData.push(vol);

      if (chartMode === 'performance') {
        xData.push(getCoinPerfPct(c) || 0);
        rData.push(Math.max(0.000001, sizeMetricPerf(c)));
      } else {
        xData.push(Math.max(1, Number(c.market_cap) || 1));
        rData.push(Math.max(0.0001, getCoinAbsPct(c)));
      }
    }

    const minX = Math.min(...xData), maxX = Math.max(...xData);
    const minY = Math.min(...yData), maxY = Math.max(...yData);
    const minR = Math.min(...rData), maxR = Math.max(...rData);

    const logMinX = (chartMode === 'valuation') ? Math.log10(Math.max(1, minX)) : 0;
    const logMaxX = (chartMode === 'valuation') ? Math.log10(Math.max(1, maxX)) : 0;

    statsRef.current = {
      minX, maxX, minY, maxY, minR, maxR,
      logMinX, logMaxX,
      logMinY: Math.log10(Math.max(1, minY)),
      logMaxY: Math.log10(Math.max(1, maxY))
    };

    const existingMap = new Map(particlesRef.current.map(p => [p.id, p] as const));

    const w = stageRef.current?.clientWidth || 1000;
    const h = stageRef.current?.clientHeight || 800;

    const newParticles = topCoins.map(coin => {
      const existing = existingMap.get(coin.id);

      if (!imageCache.current.has(coin.image)) {
        const img = new Image();
        img.src = coin.image;
        imageCache.current.set(coin.image, img);
      }

      const pct = getCoinPerfPct(coin);
      const baseColor = pct >= 0 ? '#089981' : '#f23645';

      const radiusVal = chartMode === 'performance'
        ? Math.max(0.000001, sizeMetricPerf(coin))
        : Math.max(0.0001, getCoinAbsPct(coin));

      const rrMin = minR;
      const rrMax = maxR;
      const t = (radiusVal - rrMin) / (rrMax - rrMin || 1);
      const targetRadius = 15 + mathClamp(t, 0, 1) * 55;

      const isBTC = String(coin.id).toLowerCase() === 'bitcoin';

      const vx = (Math.random() - 0.5) * 60;
      const vy = (Math.random() - 0.5) * 60;

      if (existing) {
        existing.coin = coin;
        existing.targetRadius = targetRadius;
        existing.color = isBTC ? '#ffffff' : baseColor;
        existing.mass = Math.max(1, targetRadius);

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
        color: isBTC ? '#ffffff' : baseColor,
        coin,
        trail: [],
        phase: Math.random() * Math.PI * 2,
        mass: Math.max(1, targetRadius),
        pocketHold: 0,
        isFalling: false,
        fallT: 0,
        fallPocket: null
      };
    });

    particlesRef.current = newParticles;
  }, [coins, numCoins, chartMode, timeframe, getCoinPerfPct, getCoinAbsPct, sizeMetricPerf]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!ctx || !canvas) return;

    let lastTime = performance.now();

    animationLoopFn.current = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const dpr = dprRef.current || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // background
      if (isGameMode) {
        ctx.fillStyle = isDark ? '#08110c' : '#e8f3ea';
      } else {
        ctx.fillStyle = isDark ? '#0b0f14' : '#ffffff';
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const { k, x: panX, y: panY } = transformRef.current;
      const toScreenX = (val: number) => val * k + panX;
      const toScreenY = (val: number) => val * k + panY;

      const particles = particlesRef.current;

      for (const p of particles) {
        const viewRadius = p.targetRadius * Math.pow(k, 0.25);
        p.radius += (viewRadius - p.radius) * 0.15;
        p.mass = Math.max(1, p.radius);
      }

      // pockets (game)
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

        // table border
        ctx.save();
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';
        ctx.lineWidth = 4;
        ctx.strokeRect(8, 8, width - 16, height - 16);
        ctx.restore();

        // pockets
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

      // axes (map)
      if (!isGameMode && statsRef.current) {
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

        ctx.save();
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
        ctx.lineWidth = 1;

        ctx.font = 'bold 12px Inter';
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.72)';
        ctx.textBaseline = 'middle';

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
          const tickY = mathClamp(toScreenY(originY) + 18, 12, height - 14);
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
        const xLabelY = mathClamp(toScreenY(originY) + 56, 20, height - 10);
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
        const physicsSpeed = 0.1 + (0.2 * 0.4);

        const worldW = width / k;
        const worldH = height / k;

        const drag = Math.pow(0.93, dt * 60);
        const stopEps = 3.0;

        for (const p of particles) {
          if (p.isFalling) continue;
          if (p.isFixed) continue;

          p.vx *= drag;
          p.vy *= drag;

          if (Math.hypot(p.vx, p.vy) < stopEps) {
            p.vx = 0;
            p.vy = 0;
          }

          p.x += p.vx * dt * physicsSpeed;
          p.y += p.vy * dt * physicsSpeed;

          if (p.x < p.radius) { p.x = p.radius; p.vx *= -1; }
          else if (p.x > worldW - p.radius) { p.x = worldW - p.radius; p.vx *= -1; }

          if (p.y < p.radius) { p.y = p.radius; p.vy *= -1; }
          else if (p.y > worldH - p.radius) { p.y = worldH - p.radius; p.vy *= -1; }
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

            if (!p1.isFixed) {
              p1.x -= nx * overlap * move1;
              p1.y -= ny * overlap * move1;
            }
            if (!p2.isFixed) {
              p2.x += nx * overlap * move2;
              p2.y += ny * overlap * move2;
            }

            const rvx = p2.vx - p1.vx;
            const rvy = p2.vy - p1.vy;
            const velAlongNormal = rvx * nx + rvy * ny;
            if (velAlongNormal > 0) continue;

            const restitution = 0.98;
            let impulse = -(1 + restitution) * velAlongNormal;
            impulse /= (1 / p1.mass + 1 / p2.mass);

            const impulseX = impulse * nx;
            const impulseY = impulse * ny;

            if (!p1.isFixed) {
              p1.vx -= impulseX / p1.mass;
              p1.vy -= impulseY / p1.mass;
            }
            if (!p2.isFixed) {
              p2.vx += impulseX / p2.mass;
              p2.vy += impulseY / p2.mass;
            }
          }
        }

        // pockets
        const holdNeeded = 0.35;
        const speedForPocket = 0.0;

        for (const p of particles) {
          if (p.isFalling) {
            p.fallT = (p.fallT || 0) + dt;
            if (p.fallT >= 0.35) {
              particlesRef.current = particlesRef.current.filter(pp => pp !== p);
            }
            continue;
          }

          const speed = Math.hypot(p.vx, p.vy);
          if (speed !== speedForPocket) {
            p.pocketHold = 0;
            p.fallPocket = null;
            continue;
          }

          let onPocket = false;
          let picked: { x: number; y: number; r: number } | null = null;

          for (const pk of pockets) {
            const dist = Math.hypot(p.x - pk.x, p.y - pk.y);
            if (dist <= pk.r * 0.65) {
              onPocket = true;
              picked = pk;
              break;
            }
          }

          if (onPocket && picked) {
            p.pocketHold = (p.pocketHold || 0) + dt;
            p.fallPocket = picked;

            if ((p.pocketHold || 0) >= holdNeeded) {
              p.isFalling = true;
              p.fallT = 0;
              p.vx = 0; p.vy = 0;
            }
          } else {
            p.pocketHold = 0;
            p.fallPocket = null;
          }
        }
      } else {
        if (!statsRef.current) return;
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

      // NEW: draw aim line (Game + aiming active)
      if (isGameMode && aimingRef.current.active && aimingRef.current.cueId) {
        const a = aimingRef.current;

        const fromSX = toScreenX(a.fromX);
        const fromSY = toScreenY(a.fromY);
        const toSX = toScreenX(a.toX);
        const toSY = toScreenY(a.toY);

        const dx = toSX - fromSX;
        const dy = toSY - fromSY;
        const len = Math.hypot(dx, dy) || 1;

        const nx = dx / len;
        const ny = dy / len;

        const showLen = mathClamp(len, 20, 240);

        // line goes opposite (like cue push)
        const endX = fromSX - nx * showLen;
        const endY = fromSY - ny * showLen;

        ctx.save();
        ctx.lineWidth = 3;
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.moveTo(fromSX, fromSY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // power ticks
        const ticks = Math.round((showLen / 240) * 8);
        for (let i = 1; i <= ticks; i++) {
          const tx = fromSX - nx * (i * (showLen / Math.max(1, ticks)));
          const ty = fromSY - ny * (i * (showLen / Math.max(1, ticks)));
          ctx.beginPath();
          ctx.arc(tx, ty, 2.2, 0, Math.PI * 2);
          ctx.fillStyle = isDark ? 'rgba(221,153,51,0.85)' : 'rgba(221,153,51,0.75)';
          ctx.fill();
        }

        ctx.restore();
      }

      // RENDER PARTICLES
      const particlesToDraw = particlesRef.current;

      for (const p of particlesToDraw) {
        const screenX = toScreenX(p.x);
        const screenY = toScreenY(p.y);

        if (screenX + p.radius < 0 || screenX - p.radius > width || screenY + p.radius < 0 || screenY - p.radius > height) continue;

        let drawRadius = p.radius;
        let alpha = 1.0;
        if (p.isFalling) {
          const t = mathClamp((p.fallT || 0) / 0.35, 0, 1);
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
          const dx = last ? screenX - last.x : 10;
          const dy = last ? screenY - last.y : 10;

          if (!last || (dx * dx + dy * dy > 4)) p.trail.push({ x: screenX, y: screenY, age: 1.0 });

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

          if (drawRadius > 12) {
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
    };
  }, [isDark, chartMode, isGameMode, timeframe, floatStrengthRaw, trailLength, searchTerm, getCoinPerfPct]);

  useEffect(() => {
    const loop = () => {
      if (animationLoopFn.current) animationLoopFn.current();
      reqIdRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(reqIdRef.current);
  }, []);

  const screenToWorld = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
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

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current; if (!canvas) return;

    const wpos = screenToWorld(e.clientX, e.clientY);
    const worldMouseX = wpos.x;
    const worldMouseY = wpos.y;

    // aiming: update end point
    if (isGameMode && aimingRef.current.active) {
      aimingRef.current.toX = worldMouseX;
      aimingRef.current.toY = worldMouseY;
    }

    if (lastMousePosRef.current && draggedParticleRef.current) {
      const dx = worldMouseX - lastMousePosRef.current.x;
      const dy = worldMouseY - lastMousePosRef.current.y;
      draggedParticleRef.current.vx = dx * 50;
      draggedParticleRef.current.vy = dy * 50;
      draggedParticleRef.current.x = worldMouseX;
      draggedParticleRef.current.y = worldMouseY;
    }
    lastMousePosRef.current = { x: worldMouseX, y: worldMouseY };

    if (draggedParticleRef.current) return;
    if (aimingRef.current.active) return;

    if (isPanningRef.current) {
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

    // click a particle
    if (hoveredParticleRef.current) {
      const p = hoveredParticleRef.current;
      const isBTC = String(p.coin.id).toLowerCase() === 'bitcoin';

      if (isGameMode) {
        // NEW: BTC = aim shot
        if (isBTC) {
          const w = screenToWorld(e.clientX, e.clientY);
          aimingRef.current.active = true;
          aimingRef.current.cueId = p.id;
          aimingRef.current.fromX = p.x;
          aimingRef.current.fromY = p.y;
          aimingRef.current.toX = w.x;
          aimingRef.current.toY = w.y;
          aimingRef.current.power = 0;

          setSelectedParticle(p);
          return;
        }

        // keep old behavior for other balls: drag push
        draggedParticleRef.current = p;
        draggedParticleRef.current.isFixed = true;
        setSelectedParticle(p);
        return;
      }

      // mapped: open detail
      openDetailFor(p);
      return;
    }

    // not on a particle => pan (only in map)
    if (!isGameMode) {
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
    // finish aiming -> shoot
    if (aimingRef.current.active && aimingRef.current.cueId && isGameMode) {
      const cue = particlesRef.current.find(pp => pp.id === aimingRef.current.cueId);
      if (cue && !cue.isFalling) {
        const dx = aimingRef.current.toX - aimingRef.current.fromX;
        const dy = aimingRef.current.toY - aimingRef.current.fromY;

        const dist = Math.hypot(dx, dy);
        const clamped = mathClamp(dist, 0, 280);

        // power scale: tuned to feel like billiard
        const power = (clamped / 280) * 1400;

        const nx = dist > 0 ? dx / dist : 0;
        const ny = dist > 0 ? dy / dist : 0;

        // cue moves opposite direction (pull back and release)
        cue.vx += -nx * power / Math.max(1, cue.mass);
        cue.vy += -ny * power / Math.max(1, cue.mass);

        // ensure it starts moving
        if (Math.hypot(cue.vx, cue.vy) < 1) {
          cue.vx += (Math.random() - 0.5) * 15;
          cue.vy += (Math.random() - 0.5) * 15;
        }
      }

      aimingRef.current.active = false;
      aimingRef.current.cueId = null;
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
    const clampedK = mathClamp(newK, 0.1, 10.0);

    const newX = mouseX - worldX * clampedK;
    const newY = mouseY - worldY * clampedK;

    transformRef.current = { k: clampedK, x: newX, y: newY };
  };

  const detailPerf = useMemo(() => {
    if (!detailCoin) return null;
    return computeSparkChange(detailCoin, timeframe);
  }, [detailCoin, timeframe]);

  const detailColor = useMemo(() => {
    if (!detailPerf) return '#dd9933';
    return detailPerf.pct >= 0 ? '#089981' : '#f23645';
  }, [detailPerf]);

  const legendText = useMemo(() => {
    if (chartMode === 'performance') {
      return (
        <>
          <div><span className="font-black">Modo Variação (preço)</span></div>
          <div>• <span className="font-bold">X</span>: Variação de preço {timeframe} (%)</div>
          <div>• <span className="font-bold">Y</span>: Volume 24h (log)</div>
          <div>• <span className="font-bold">Tamanho</span>: |%var {timeframe}| × log(volume)</div>
          <div>• <span className="font-bold">Cor</span>: verde/ vermelho pela variação {timeframe}</div>
          <div className="mt-2 opacity-80"><span className="font-black">Modo Game:</span> arraste o <span className="font-black">BTC</span> pra mirar e soltar pra tacar.</div>
        </>
      );
    }
    return (
      <>
        <div><span className="font-black">Modo Market Cap</span></div>
        <div>• <span className="font-bold">X</span>: Market Cap (log)</div>
        <div>• <span className="font-bold">Y</span>: Volume 24h (log)</div>
        <div>• <span className="font-bold">Tamanho</span>: |%var {timeframe}|</div>
        <div>• <span className="font-bold">Cor</span>: verde/ vermelho pela variação {timeframe}</div>
        <div className="mt-2 opacity-80"><span className="font-black">Modo Game:</span> arraste o <span className="font-black">BTC</span> pra mirar e soltar pra tacar.</div>
      </>
    );
  }, [chartMode, timeframe]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[2000] bg-white dark:bg-[#0b0f14] text-gray-900 dark:text-white flex flex-col overflow-hidden touch-none select-none overscroll-none h-[100dvh]"
    >
      {/* HEADER */}
      <div className="flex justify-between items-start p-4 z-20 bg-white/80 dark:bg-black/50 backdrop-blur-sm border-b border-gray-200 dark:border-white/10 shrink-0">
        <div className="flex items-center gap-4">
          <Coins size={28} className="text-[#dd9933]" />
          <div>
            <h3 className="text-xl font-black uppercase tracking-wider">Crypto Bubbles</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold">{status === 'demo' ? 'MODO DEMO' : isGameMode ? 'MODO GAME' : 'MODO MAPA'}</p>
          </div>

          <div className="w-px h-8 bg-gray-200 dark:bg-white/10 mx-4"></div>

          {/* Market Cap + Variação + TF */}
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

          {/* search */}
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

          {/* Legend */}
          <div className="relative">
            <button
              onMouseEnter={() => setLegendTipOpen(true)}
              onMouseLeave={() => setLegendTipOpen(false)}
              className="p-3 rounded-lg border transition-colors backdrop-blur-sm bg-gray-100 dark:bg-black/50 border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10"
              title="Legenda"
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

          {/* SETTINGS */}
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

      {/* SETTINGS POPUP */}
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

            <div className={isGameMode ? '' : 'opacity-50'}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Wind size={14} />
                  <span className="text-xs font-black uppercase tracking-wider">Velocidade (Game)</span>
                </div>
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">20%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={0.2}
                readOnly
                className="w-full accent-[#dd9933] mt-2"
                disabled={!isGameMode}
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
          </div>
        </div>
      )}

      {/* DETAIL PANEL */}
      <div className={`absolute inset-0 z-40 flex items-center justify-center ${detailOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div
          className={`w-[min(720px,92vw)] rounded-2xl border border-white/10 bg-white/90 dark:bg-black/80 backdrop-blur-xl shadow-2xl transition-all duration-200 ease-out
          ${detailOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between p-5 border-b border-gray-200/60 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full overflow-hidden border border-white/10">
                {detailCoin?.image ? <img src={detailCoin.image} alt={detailCoin.name} className="h-full w-full object-cover" /> : null}
              </div>
              <div>
                <div className="text-lg font-black">{detailCoin?.name || '—'}</div>
                <div className="text-xs font-bold opacity-70">{detailCoin?.symbol?.toUpperCase() || '—'} • TF {timeframe}</div>
              </div>
            </div>

            <button
              onClick={() => setDetailOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-200/60 dark:hover:bg-white/10 transition"
              title="Fechar"
            >
              <CloseIcon size={18} />
            </button>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-black/5 dark:bg-white/5 p-4">
              <div className="text-xs font-black uppercase tracking-wider opacity-70">Preço</div>
              <div className="mt-2 text-2xl font-black">{formatPrice(detailCoin?.current_price)}</div>

              <div className="mt-2 flex items-center justify-between">
                <div className="text-xs font-bold opacity-70">Variação {timeframe}</div>
                <div className="text-sm font-black" style={{ color: detailColor }}>
                  {detailPerf ? `${detailPerf.pct >= 0 ? '+' : ''}${detailPerf.pct.toFixed(2)}%` : '—'}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="opacity-80">
                  <div className="text-xs font-bold opacity-70">High 24h</div>
                  <div className="font-black">{formatPrice(detailCoin?.high_24h)}</div>
                </div>
                <div className="opacity-80">
                  <div className="text-xs font-bold opacity-70">Low 24h</div>
                  <div className="font-black">{formatPrice(detailCoin?.low_24h)}</div>
                </div>
              </div>

              {detailPerf?.series && (
                <div className="mt-4">
                  <div className="text-xs font-bold opacity-70 mb-2">Sparkline 7d</div>
                  <Sparkline series={detailPerf.series} color={detailColor} />
                </div>
              )}
            </div>

            <div className="rounded-xl bg-black/5 dark:bg-white/5 p-4">
              <div className="text-xs font-black uppercase tracking-wider opacity-70">Dados</div>

              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="opacity-70 font-bold">Market Cap</span>
                  <span className="font-black">{formatCompact(detailCoin?.market_cap)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="opacity-70 font-bold">Volume 24h</span>
                  <span className="font-black">{formatCompact(detailCoin?.total_volume)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="opacity-70 font-bold">Rank</span>
                  <span className="font-black">#{(detailCoin as any)?.market_cap_rank ?? '—'}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="opacity-70 font-bold">ATH</span>
                  <span className="font-black">{formatPrice((detailCoin as any)?.ath)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="opacity-70 font-bold">ATL</span>
                  <span className="font-black">{formatPrice((detailCoin as any)?.atl)}</span>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setDetailOpen(false)}
                  className="flex-1 py-2 rounded-lg bg-[#dd9933] text-black font-black hover:opacity-90 transition"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

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
