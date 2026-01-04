
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ApiCoin, Language } from '../../../types';
import { Search, XCircle, Settings, Droplets, FastForward, Activity, Wind, X as CloseIcon, Atom, Scaling, Coins } from 'lucide-react';
import { fetchTopCoins } from '../services/api';

// --- TYPES ---
interface Particle {
  id: string;
  x: number; y: number;
  vx: number; vy: number;
  radius: number; 
  baseRadius: number; // Tamanho original calculado pelos dados
  color: string;
  coin: ApiCoin;
  trail: { x: number, y: number }[];
  phase: number; // Para oscilação senoidal individual
  isFixed?: boolean;
}

type ChartMode = 'performance' | 'valuation'; 
type Status = 'loading' | 'running' | 'demo' | 'error';

interface MarketWindSwarmProps { language: Language; onClose: () => void; }

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
    return `$${n.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

// --- MAIN COMPONENT ---
const MarketWindSwarm = ({ language, onClose }: MarketWindSwarmProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const imageCache = useRef(new Map<string, HTMLImageElement>());
  const animationLoopFn = useRef<(() => void) | null>(null);
  
  // State
  const [status, setStatus] = useState<Status>('loading');
  const [coins, setCoins] = useState<ApiCoin[]>([]);
  
  const [hoveredParticle, setHoveredParticle] = useState<Particle | null>(null);
  const [selectedParticle, setSelectedParticle] = useState<Particle | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isFreeMode, setIsFreeMode] = useState(false);
  const [numCoins, setNumCoins] = useState(100); 
  const [animSpeed, setAnimSpeed] = useState(1.0); // Intensidade Flutuação / Velocidade
  const [chartMode, setChartMode] = useState<ChartMode>('performance');
  const [trailLength, setTrailLength] = useState(20);
  
  const [dpr, setDpr] = useState(1); 
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  
  // Interaction Refs
  const zoomRef = useRef(1.0);
  const panRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ clientX: 0, clientY: 0, panX: 0, panY: 0 });
  const draggedParticleRef = useRef<Particle | null>(null);
  const lastMousePosRef = useRef<{x: number; y: number} | null>(null);
  
  const hoveredParticleRef = useRef(hoveredParticle);
  hoveredParticleRef.current = hoveredParticle;
  const selectedParticleRef = useRef(selectedParticle);
  selectedParticleRef.current = selectedParticle;

  // Cache de estatísticas para evitar recalculations no loop
  const statsRef = useRef<{
      minX: number, maxX: number, 
      minY: number, maxY: number, 
      minR: number, maxR: number,
      logMinX: number, logMaxX: number,
      logMinY: number, logMaxY: number,
      logMinR: number, logMaxR: number
  } | null>(null);

  // Load Data
  const loadData = useCallback(async () => {
    if (particlesRef.current.length === 0) setStatus('loading');
    try {
      const data = await fetchTopCoins({ force: true });
      if (data && data.length > 0) {
        setCoins(data);
        setStatus('running');
      } else if (particlesRef.current.length === 0) setStatus('demo');
    } catch (error) {
      if (particlesRef.current.length === 0) setStatus('error');
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    
    const handleResize = () => {
        if (containerRef.current && canvasRef.current) {
            const ratio = window.devicePixelRatio || 1;
            setDpr(ratio);
            const rect = containerRef.current.getBoundingClientRect();
            canvasRef.current.width = rect.width * ratio;
            canvasRef.current.height = rect.height * ratio;
            canvasRef.current.style.width = `${rect.width}px`;
            canvasRef.current.style.height = `${rect.height}px`;
        }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); 

    const observer = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => { clearInterval(interval); observer.disconnect(); window.removeEventListener('resize', handleResize); };
  }, [loadData]);

  // --- PRE-CALCULATE STATS (Optimization) ---
  useEffect(() => {
      const topCoins = coins.slice(0, numCoins);
      if (topCoins.length === 0) return;

      let xData: number[], radiusData: number[];
      const yData = topCoins.map(p => p.total_volume || 1); // Y sempre Volume

      if (chartMode === 'performance') {
          xData = topCoins.map(p => p.price_change_percentage_24h || 0);
          radiusData = topCoins.map(p => p.market_cap || 1).filter(mc => mc > 0);
      } else {
          xData = topCoins.map(p => p.market_cap || 1).filter(mc => mc > 0);
          radiusData = topCoins.map(p => Math.abs(p.price_change_percentage_24h || 0));
      }

      const minX = Math.min(...xData), maxX = Math.max(...xData);
      const minY = Math.min(...yData), maxY = Math.max(...yData);
      const minR = Math.min(...radiusData), maxR = Math.max(...radiusData);

      statsRef.current = {
          minX, maxX, minY, maxY, minR, maxR,
          logMinX: (minX > 0) ? Math.log10(minX) : 0,
          logMaxX: (maxX > 0) ? Math.log10(maxX) : 0,
          logMinY: (minY > 0) ? Math.log10(minY) : 0,
          logMaxY: (maxY > 0) ? Math.log10(maxY) : 0,
          logMinR: (minR > 0) ? Math.log10(minR) : minR,
          logMaxR: (maxR > 0) ? Math.log10(maxR) : maxR
      };

      // Re-initialize particles if needed or update their base props
      const existingMap = new Map(particlesRef.current.map(p => [p.id, p]));
      
      const newParticles = topCoins.map(coin => {
          const existing = existingMap.get(coin.id);
          
          let radiusVal = 0;
          if (chartMode === 'performance') radiusVal = coin.market_cap || 1;
          else radiusVal = Math.abs(coin.price_change_percentage_24h || 0);

          // Calculate Radius ONCE based on data
          const { logMinR, logMaxR, minR, maxR } = statsRef.current!;
          let baseRadius = 8;
          if (chartMode === 'performance') {
             baseRadius = (8 + (Math.log10(radiusVal) - logMinR) / (logMaxR - logMinR || 1) * 45); 
          } else {
             baseRadius = (8 + (radiusVal - minR) / (maxR - minR || 1) * 45);
          }
          
          // Image Preload
          if (!imageCache.current.has(coin.image)) {
              const img = new Image(); img.src = coin.image;
              imageCache.current.set(coin.image, img);
          }

          const color = (coin.price_change_percentage_24h || 0) >= 0 ? '#089981' : '#f23645';

          if (existing) {
              existing.coin = coin;
              existing.baseRadius = baseRadius;
              existing.color = color;
              return existing;
          } else {
              return {
                  id: coin.id,
                  x: containerRef.current ? containerRef.current.clientWidth / 2 : 0,
                  y: containerRef.current ? containerRef.current.clientHeight / 2 : 0,
                  vx: (Math.random() - 0.5) * 50,
                  vy: (Math.random() - 0.5) * 50,
                  radius: 0,
                  baseRadius,
                  color,
                  coin,
                  trail: [],
                  phase: Math.random() * Math.PI * 2
              };
          }
      });
      
      particlesRef.current = newParticles;

  }, [coins, numCoins, chartMode]);

  // --- DRAW LOOP ---
  useEffect(() => {
    const canvas = canvasRef.current; 
    const ctx = canvas?.getContext('2d', { alpha: false }); 
    if (!ctx || !canvas) return;
    
    let lastTime = performance.now();

    animationLoopFn.current = () => {
        const now = performance.now();
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        const width = canvas.width / dpr;
        const height = canvas.height / dpr;
        
        // Reset & Clear
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = isDark ? '#0b0f14' : '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.scale(dpr, dpr);

        if (!statsRef.current) return;
        const s = statsRef.current;
        const pad = 80;

        // --- MAP FUNCTIONS (Projection) ---
        // Agora aplicam o Zoom apenas na Coordenada, não no tamanho da bolha
        const projectX = (v: number) => {
            let norm = 0;
            if (chartMode === 'valuation') {
               if (v <= 0) return pad;
               norm = (Math.log10(v) - s.logMinX) / (s.logMaxX - s.logMinX || 1);
            } else {
               norm = (v - s.minX) / (s.maxX - s.minX || 1);
            }
            const baseX = pad + norm * (width - pad * 2);
            // Apply Pan & Zoom: Expand distance from center
            return panRef.current.x + (baseX - width / 2) * zoomRef.current + width / 2;
        };

        const projectY = (v: number) => {
            let norm = 0;
            if (v <= 0) return height - pad;
            norm = (Math.log10(v) - s.logMinY) / (s.logMaxY - s.logMinY || 1);
            const baseY = height - pad - norm * (height - pad * 2);
            return panRef.current.y + (baseY - height / 2) * zoomRef.current + height / 2;
        };

        // --- DRAW AXES ---
        if (!isFreeMode) {
            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 1;
            ctx.font = `bold 10px Inter`;
            ctx.fillStyle = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';

            // Grid Lines & Labels
            const xSteps = 6;
            for (let i = 0; i <= xSteps; i++) {
                const percent = i / xSteps;
                let val, px;
                
                if (chartMode === 'valuation') {
                    val = Math.pow(10, s.logMinX + percent * (s.logMaxX - s.logMinX));
                    px = projectX(val);
                } else {
                    val = s.minX + percent * (s.maxX - s.minX);
                    px = projectX(val);
                }

                if (px >= 0 && px <= width) {
                    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, height); ctx.stroke();
                    ctx.textAlign = 'center';
                    ctx.fillText(chartMode === 'valuation' ? formatCompact(val) : `${val.toFixed(1)}%`, px, height - 10);
                }
            }

            const ySteps = 5;
            for (let i = 0; i <= ySteps; i++) {
                const percent = i / ySteps;
                const val = Math.pow(10, s.logMinY + percent * (s.logMaxY - s.logMinY));
                const py = projectY(val);
                
                if (py >= 0 && py <= height) {
                    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(width, py); ctx.stroke();
                    ctx.textAlign = 'left';
                    ctx.fillText(formatCompact(val), 10, py - 5);
                }
            }

            // Axis Titles
            ctx.save();
            ctx.fillStyle = isDark ? '#fff' : '#000';
            ctx.font = 'bold 12px Inter';
            ctx.textAlign = 'center';
            const xLabel = chartMode === 'performance' ? 'Variação 24h (%)' : 'Market Cap (Log)';
            ctx.fillText(xLabel, width / 2, height - 25);
            
            ctx.translate(20, height / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText('Volume 24h (Log)', 0, 0);
            ctx.restore();
        }

        // --- UPDATE & DRAW PARTICLES ---
        const particles = particlesRef.current;
        
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            
            // Physics
            if (isFreeMode) {
                // Free Mode Physics
                if (draggedParticleRef.current?.id !== p.id) {
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                    
                    // Bounce off walls
                    const r = p.radius;
                    if (p.x < r) { p.x = r; p.vx *= -0.8; }
                    if (p.x > width - r) { p.x = width - r; p.vx *= -0.8; }
                    if (p.y < r) { p.y = r; p.vy *= -0.8; }
                    if (p.y > height - r) { p.y = height - r; p.vy *= -0.8; }
                    
                    // Apply minimal friction (inertia)
                    // Speed slider in free mode controls global velocity/energy
                    const speedMult = Math.max(0.5, animSpeed);
                    p.vx *= 0.99; 
                    p.vy *= 0.99;
                    
                    // Keep them moving if speed setting is high
                    if (Math.abs(p.vx) + Math.abs(p.vy) < 10 * speedMult) {
                        p.vx += (Math.random() - 0.5) * 5 * speedMult;
                        p.vy += (Math.random() - 0.5) * 5 * speedMult;
                    }
                }
            } else {
                // Mapped Mode Physics (Spring to Target)
                let xVal = 0, yVal = p.coin.total_volume || 1;
                if (chartMode === 'performance') xVal = p.coin.price_change_percentage_24h || 0;
                else xVal = p.coin.market_cap || 1;

                const tx = projectX(xVal);
                const ty = projectY(yVal);
                
                // Float Effect (Sine Wave based on ID phase)
                const floatX = Math.sin(now * 0.002 * animSpeed + p.phase) * (10 * animSpeed);
                const floatY = Math.cos(now * 0.003 * animSpeed + p.phase) * (10 * animSpeed);

                const targetX = tx + floatX;
                const targetY = ty + floatY;

                // Smoothly approach target (Spring)
                p.x += (targetX - p.x) * 0.1;
                p.y += (targetY - p.y) * 0.1;
                
                // Zero out velocity when locked
                p.vx = 0; p.vy = 0;
            }

            // Radius Interpolation (Zoom Scale)
            // User requested: "Zoom SCALE, not bubbles". 
            // We keep bubble size relatively stable but allow slight scaling so they don't disappear on huge zoom out
            // Scale radius slightly with zoom, but clamps it.
            const targetR = p.baseRadius * Math.pow(zoomRef.current, 0.2); 
            p.radius += (targetR - p.radius) * 0.1;

            // Trail Logic
            if (trailLength > 0 && (isFreeMode || Math.abs(p.vx)+Math.abs(p.vy) > 1 || Math.abs(p.x - p.trail[p.trail.length-1]?.x) > 1)) {
                p.trail.push({ x: p.x, y: p.y });
                if (p.trail.length > trailLength) p.trail.shift();
            }

            // Draw Trail (Gradient Fading)
            if (p.trail.length > 1) {
                // Create a gradient for the trail
                // Since gradient along path is hard, we draw segments with increasing opacity
                for (let k = 0; k < p.trail.length - 1; k++) {
                    const p1 = p.trail[k];
                    const p2 = p.trail[k+1];
                    const alpha = (k / p.trail.length); // 0 at tail, 1 at head
                    
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = p.color;
                    ctx.globalAlpha = alpha * 0.6; // Max opacity 0.6
                    ctx.lineWidth = p.radius * 0.2; // Trail width relative to size
                    ctx.stroke();
                }
                ctx.globalAlpha = 1.0;
            }

            // Draw Bubble
            const isHovered = hoveredParticleRef.current?.id === p.id;
            const isSelected = selectedParticleRef.current?.id === p.id;
            const isDimmed = searchTerm && !p.coin.name.toLowerCase().includes(searchTerm.toLowerCase()) && !p.coin.symbol.toLowerCase().includes(searchTerm.toLowerCase());

            if (isDimmed) ctx.globalAlpha = 0.1;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            
            // Image or Fill
            const img = imageCache.current.get(p.coin.image);
            if (img?.complete) {
                ctx.save();
                ctx.clip();
                ctx.drawImage(img, p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
                ctx.restore();
                
                // Border ring color
                ctx.strokeStyle = p.color;
                ctx.lineWidth = isSelected ? 4 : 2;
                ctx.stroke();
            } else {
                ctx.fillStyle = p.color;
                ctx.fill();
            }

            // Hover Halo
            if (isHovered || isSelected) {
                ctx.strokeStyle = isDark ? '#fff' : '#000';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius + 4, 0, Math.PI * 2);
                ctx.stroke();
            }

            ctx.globalAlpha = 1.0;
        }
        
        // Tooltip logic (same as before)
        const p = hoveredParticleRef.current || selectedParticleRef.current;
        if (p) {
             drawTooltip(ctx, p, width, height);
        }

    };
  }, [animSpeed, trailLength, isDark, chartMode, isFreeMode, dpr, numCoins]);

  const drawTooltip = (ctx: CanvasRenderingContext2D, p: Particle, width: number, height: number) => {
        const padding = 12;
        const boxW = 200;
        const boxH = 110;
        let bx = p.x + p.radius + 15;
        let by = p.y - boxH / 2;

        if (bx + boxW > width) bx = p.x - p.radius - boxW - 15;
        if (bx < 0) bx = 10;
        if (by < 0) by = 10;
        if (by + boxH > height) by = height - boxH - 10;

        ctx.save();
        ctx.fillStyle = isDark ? 'rgba(20, 20, 25, 0.95)' : 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 10;
        
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, boxH, 8);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = isDark ? '#fff' : '#000';
        ctx.font = 'bold 14px Inter';
        ctx.textAlign = 'left';
        ctx.fillText(p.coin.name, bx + padding, by + 20);
        
        ctx.fillStyle = '#888';
        ctx.font = '11px Inter';
        ctx.fillText(p.coin.symbol.toUpperCase(), bx + padding, by + 35);

        ctx.font = 'bold 16px Inter';
        ctx.fillStyle = isDark ? '#eee' : '#111';
        ctx.fillText(formatPrice(p.coin.current_price), bx + padding, by + 60);

        const change = p.coin.price_change_percentage_24h || 0;
        ctx.fillStyle = change >= 0 ? '#089981' : '#f23645';
        ctx.font = 'bold 12px Inter';
        ctx.textAlign = 'right';
        ctx.fillText(`${change > 0 ? '+' : ''}${change.toFixed(2)}%`, bx + boxW - padding, by + 20);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#666';
        ctx.font = '10px Inter';
        ctx.fillText('Vol 24h: ' + formatCompact(p.coin.total_volume), bx + padding, by + 85);
        ctx.fillText('Mkt Cap: ' + formatCompact(p.coin.market_cap), bx + padding, by + 98);

        ctx.restore();
  };

  useEffect(() => {
    let frameId: number;
    const loop = () => {
      if (animationLoopFn.current) animationLoopFn.current();
      frameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frameId);
  }, []);

  // --- EVENTS ---
  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Velocity tracking for throw
    if (lastMousePosRef.current) {
        const dx = mouseX - lastMousePosRef.current.x;
        const dy = mouseY - lastMousePosRef.current.y;
        if (draggedParticleRef.current) {
            draggedParticleRef.current.vx = dx * 15; // Impulse multiplier
            draggedParticleRef.current.vy = dy * 15;
        }
    }
    lastMousePosRef.current = { x: mouseX, y: mouseY };

    if (draggedParticleRef.current) {
        draggedParticleRef.current.x = mouseX;
        draggedParticleRef.current.y = mouseY;
        return;
    }
    
    if (isPanningRef.current) {
        const dx = e.clientX - panStartRef.current.clientX;
        const dy = e.clientY - panStartRef.current.clientY;
        panRef.current = { x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy };
        return;
    }
    
    // Hover Check
    let found: Particle | null = null;
    // Check reversely to pick top particle
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        // Hitbox slightly larger
        if (dx*dx + dy*dy < (p.radius + 5) * (p.radius + 5)) {
            found = p;
            break;
        }
    }
    setHoveredParticle(found);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (hoveredParticleRef.current && isFreeMode) {
        draggedParticleRef.current = hoveredParticleRef.current;
        draggedParticleRef.current.isFixed = true;
        setSelectedParticle(hoveredParticleRef.current);
    } else {
        isPanningRef.current = true;
        panStartRef.current = { clientX: e.clientX, clientY: e.clientY, panX: panRef.current.x, panY: panRef.current.y };
    }
  };

  const handleMouseUp = () => {
    if (draggedParticleRef.current) {
        // Release particle with momentum
        draggedParticleRef.current.isFixed = false;
        draggedParticleRef.current = null;
    }
    isPanningRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomFactor = 1.1;
    const oldZoom = zoomRef.current;
    const newZoom = e.deltaY < 0 ? oldZoom * zoomFactor : oldZoom / zoomFactor;
    
    // Clamp zoom
    const clampedZoom = mathClamp(newZoom, 0.2, 10.0);
    zoomRef.current = clampedZoom;
    
    // Zoom towards mouse pointer logic
    const scaleChange = clampedZoom - oldZoom;
    const zoomPointX = (mouseX - panRef.current.x) / oldZoom;
    const zoomPointY = (mouseY - panRef.current.y) / oldZoom;
    
    panRef.current.x -= zoomPointX * scaleChange;
    panRef.current.y -= zoomPointY * scaleChange;
  };
  
  return (
    <div ref={containerRef} className="fixed inset-0 z-[2000] bg-white dark:bg-[#0b0f14] text-gray-900 dark:text-white flex flex-col">
      <div className="flex justify-between items-start p-4 z-10 bg-white/80 dark:bg-black/50 backdrop-blur-sm border-b border-gray-200 dark:border-white/10 shrink-0">
        <div className="flex items-center gap-4">
            <Wind size={28} className="text-[#dd9933]" />
            <div><h3 className="text-xl font-black uppercase tracking-wider">Market WindSwarm</h3><p className="text-xs text-gray-500 dark:text-gray-400 font-bold">{status === 'demo' ? 'MODO DEMO' : 'Live Physics Engine'}</p></div>
            <div className="w-px h-8 bg-gray-200 dark:bg-white/10 mx-4"></div>
            
            {/* SCALE TOGGLES MOVED TO HEADER */}
            <div className="flex bg-gray-100 dark:bg-black/50 p-1 rounded-lg border border-gray-200 dark:border-white/10 mr-4">
                <button onClick={()=> setChartMode('performance')} className={`px-4 py-1.5 text-xs font-bold rounded transition-colors ${chartMode==='performance' ? 'bg-white dark:bg-[#2f3032] shadow text-[#dd9933]': 'text-gray-500'}`}>Market Cap</button>
                <button onClick={()=> setChartMode('valuation')} className={`px-4 py-1.5 text-xs font-bold rounded transition-colors ${chartMode==='valuation' ? 'bg-white dark:bg-[#2f3032] shadow text-[#dd9933]': 'text-gray-500'}`}>Variação 24h</button>
            </div>

            <div className="flex items-center gap-2 bg-gray-100 dark:bg-black/50 p-2 rounded-lg border border-gray-200 dark:border-white/10">
                <Search size={16} className="text-gray-400" /><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar ativo..." className="bg-transparent outline-none text-sm w-48 text-gray-900 dark:text-white" />
                {searchTerm && <button onClick={() => { setSearchTerm(''); setSelectedParticle(null); }}><XCircle size={16} className="text-gray-500 hover:text-white" /></button>}
            </div>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={() => setSettingsOpen(!settingsOpen)} className={`p-3 rounded-lg border transition-colors backdrop-blur-sm ${settingsOpen ? 'bg-[#dd9933] text-black border-[#dd9933]' : 'bg-gray-100 dark:bg-black/50 border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10'}`}><Settings size={20} /></button>
            <button onClick={() => onClose()} className="p-3 bg-gray-100 dark:bg-black/50 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-red-500/10 text-gray-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Close"><CloseIcon size={20} /></button>
        </div>
      </div>
      
      {settingsOpen && (
          <div className="absolute top-24 right-4 bg-white/90 dark:bg-black/80 p-4 rounded-lg border border-gray-200 dark:border-white/10 backdrop-blur-md w-72 z-20 space-y-4 animate-in fade-in slide-in-from-top-4 shadow-xl">
              <div className="flex justify-between items-center"><label className="text-xs font-bold flex items-center gap-2"><Atom size={14} /> Modo Livre (Sem Alvo)</label><button onClick={()=> setIsFreeMode(!isFreeMode)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isFreeMode ? 'bg-[#dd9933]' : 'bg-gray-200 dark:bg-tech-700'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isFreeMode ? 'translate-x-6' : 'translate-x-1'}`}/></button></div>
              <div className="space-y-2"><label className="text-xs font-bold flex items-center gap-2"><Coins size={14} /> # Moedas</label>
                  <select value={numCoins} onChange={e => setNumCoins(parseInt(e.target.value))} className="w-full bg-gray-100 dark:bg-tech-800 text-gray-900 dark:text-gray-100 p-2 rounded text-xs border border-gray-200 dark:border-white/10 outline-none">
                      {[50, 100, 150, 200, 250].map(n => <option key={n} value={n}>{n} Moedas</option>)}
                  </select>
              </div>
              <div className="space-y-2"><label className="text-xs font-bold flex items-center gap-2"><FastForward size={14} /> Flutuação / Velocidade</label><input type="range" min="0.1" max="5" step="0.1" value={animSpeed} onChange={e => setAnimSpeed(parseFloat(e.target.value))} className="w-full accent-[#dd9933]" /></div>
              <div className="space-y-2"><label className="text-xs font-bold flex items-center gap-2"><Droplets size={14} /> Rastro (Trail)</label><input type="range" min="0" max="100" step="1" value={trailLength} onChange={e => setTrailLength(parseInt(e.target.value))} className="w-full accent-[#dd9933]" /></div>
          </div>
      )}

      <div className="flex-1 w-full h-full relative cursor-crosshair">
        <canvas ref={canvasRef} onMouseMove={handleMouseMove} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onMouseLeave={() => { setHoveredParticle(null); handleMouseUp(); }} onWheel={handleWheel} className="absolute inset-0 w-full h-full" />
      </div>
    </div>
  );
};

export default MarketWindSwarm;
