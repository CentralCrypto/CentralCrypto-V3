import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ApiCoin, Language } from '../../../types';
import { Search, XCircle, Settings, Droplets, FastForward, Wind, X as CloseIcon, Atom, Coins, Maximize } from 'lucide-react';
import { fetchTopCoins } from '../services/api';

// --- TYPES ---
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
  const reqIdRef = useRef<number>(0);
  
  // State
  const [status, setStatus] = useState<Status>('loading');
  const [coins, setCoins] = useState<ApiCoin[]>([]);
  
  const [hoveredParticle, setHoveredParticle] = useState<Particle | null>(null);
  const [selectedParticle, setSelectedParticle] = useState<Particle | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isFreeMode, setIsFreeMode] = useState(false);
  const [numCoins, setNumCoins] = useState(50); // Start with 50 coins
  const [animSpeedRaw, setAnimSpeedRaw] = useState(0.3); 
  const [chartMode, setChartMode] = useState<ChartMode>('performance');
  const [trailLength, setTrailLength] = useState(20);
  
  const [dpr, setDpr] = useState(1); 
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  
  // Interaction Refs
  const transformRef = useRef({ k: 1, x: 0, y: 0 }); 
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ clientX: 0, clientY: 0, x: 0, y: 0 });
  const draggedParticleRef = useRef<Particle | null>(null);
  const lastMousePosRef = useRef<{x: number; y: number} | null>(null);
  
  // Refs for loop access
  const hoveredParticleRef = useRef(hoveredParticle);
  hoveredParticleRef.current = hoveredParticle;
  const selectedParticleRef = useRef(selectedParticle);
  selectedParticleRef.current = selectedParticle;

  // Cache stats
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
            // Strictly fit container
            canvasRef.current.width = rect.width * ratio;
            canvasRef.current.height = rect.height * ratio;
            canvasRef.current.style.width = `${rect.width}px`;
            canvasRef.current.style.height = `${rect.height}px`;
        }
    };
    
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);

    const observer = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => { clearInterval(interval); observer.disconnect(); window.removeEventListener('resize', handleResize); };
  }, [loadData]);

  // --- RE-INITIALIZE PARTICLES ON MODE CHANGE ---
  useEffect(() => {
      const topCoins = coins.slice(0, numCoins);
      if (topCoins.length === 0) return;

      let xData: number[], radiusData: number[];
      const yData = topCoins.map(p => p.total_volume || 1); 

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

      const { logMinR, logMaxR } = statsRef.current!;
      
      const existingMap = new Map(particlesRef.current.map(p => [p.id, p]));
      
      const w = containerRef.current?.clientWidth || 1000;
      const h = containerRef.current?.clientHeight || 800;

      const newParticles = topCoins.map(coin => {
          const existing = existingMap.get(coin.id);
          
          let radiusVal = 0;
          if (chartMode === 'performance') radiusVal = coin.market_cap || 1;
          else radiusVal = Math.abs(coin.price_change_percentage_24h || 0);

          let targetRadius = 8;
          if (chartMode === 'performance') {
             targetRadius = (15 + (Math.log10(radiusVal) - logMinR) / (logMaxR - logMinR || 1) * 55); 
          } else {
             targetRadius = (15 + (radiusVal - minR) / (maxR - minR || 1) * 55);
          }
          
          if (!imageCache.current.has(coin.image)) {
              const img = new Image(); img.src = coin.image;
              imageCache.current.set(coin.image, img);
          }

          const color = (coin.price_change_percentage_24h || 0) >= 0 ? '#089981' : '#f23645';

          let vx = (Math.random() - 0.5) * 120;
          let vy = (Math.random() - 0.5) * 120;

          if (existing) {
              existing.coin = coin;
              existing.targetRadius = targetRadius;
              existing.color = color;
              existing.mass = targetRadius; 
              
              if (isFreeMode && (Math.abs(existing.vx) < 5 && Math.abs(existing.vy) < 5)) {
                  existing.vx = (Math.random() - 0.5) * 150;
                  existing.vy = (Math.random() - 0.5) * 150;
              }
              return existing;
          } else {
              return {
                  id: coin.id,
                  x: Math.random() * w,
                  y: Math.random() * h,
                  vx: vx,
                  vy: vy,
                  radius: 0,
                  targetRadius,
                  color,
                  coin,
                  trail: [],
                  phase: Math.random() * Math.PI * 2,
                  mass: targetRadius
              };
          }
      });
      
      particlesRef.current = newParticles;

  }, [coins, numCoins, chartMode, isFreeMode]);

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
            
            const { k, x: panX, y: panY } = transformRef.current;

            if (!statsRef.current) return;
            const s = statsRef.current;
            
            // INCREASED MARGIN FOR X AXIS
            const marginBottom = 60; 
            const marginLeft = 60;
            const chartW = width - marginLeft - 20;
            const chartH = height - marginBottom;

            const physicsSpeed = 0.5 + (animSpeedRaw * 0.5); 
            const floatAmpBase = 2 + (animSpeedRaw * 5);

            // --- PROJECTION ---
            const projectX = (v: number) => {
                let norm = 0;
                if (chartMode === 'valuation') {
                   if (v <= 0) return marginLeft;
                   norm = (Math.log10(v) - s.logMinX) / (s.logMaxX - s.logMinX || 1);
                } else {
                   norm = (v - s.minX) / (s.maxX - s.minX || 1);
                }
                return marginLeft + norm * chartW;
            };

            const projectY = (v: number) => {
                let norm = 0;
                if (v <= 0) return chartH;
                norm = (Math.log10(v) - s.logMinY) / (s.logMaxY - s.logMinY || 1);
                return chartH - norm * (chartH - 20) + 20; 
            };

            const toScreenX = (val: number) => val * k + panX;
            const toScreenY = (val: number) => val * k + panY;

            // --- AXES ---
            if (!isFreeMode) {
                ctx.save();
                ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'; 
                ctx.lineWidth = 1;
                ctx.font = `bold 10px Inter`;
                ctx.fillStyle = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';

                // X-Axis
                const xSteps = 6;
                for (let i = 0; i <= xSteps; i++) {
                    const percent = i / xSteps;
                    let val, worldX;
                    if (chartMode === 'valuation') {
                        val = Math.pow(10, s.logMinX + percent * (s.logMaxX - s.logMinX));
                        worldX = projectX(val);
                    } else {
                        val = s.minX + percent * (s.maxX - s.minX);
                        worldX = projectX(val);
                    }

                    const screenX = toScreenX(worldX);

                    // Visible check
                    if (screenX >= 0 && screenX <= width) {
                        ctx.beginPath(); 
                        ctx.moveTo(screenX, 0); 
                        ctx.lineTo(screenX, chartH); // Stop at axis line
                        ctx.stroke();
                        
                        ctx.textAlign = 'center';
                        let label = "";
                        if (chartMode === 'performance') label = `${val.toFixed(1)}%`;
                        else label = formatCompact(val);
                        // Labels drawn in the margin area
                        ctx.fillText(label, screenX, height - 25);
                    }
                }

                // Y-Axis
                const ySteps = 5;
                for (let i = 0; i <= ySteps; i++) {
                    const percent = i / ySteps;
                    const val = Math.pow(10, s.logMinY + percent * (s.logMaxY - s.logMinY));
                    const worldY = projectY(val);
                    const screenY = toScreenY(worldY);

                    if (screenY >= 0 && screenY <= chartH) {
                        ctx.beginPath(); ctx.moveTo(marginLeft, screenY); ctx.lineTo(width, screenY); ctx.stroke();
                        ctx.textAlign = 'right';
                        ctx.fillText(formatCompact(val), marginLeft - 8, screenY + 3);
                    }
                }

                // Axis line
                ctx.beginPath(); ctx.moveTo(marginLeft, toScreenY(chartH)); ctx.lineTo(width, toScreenY(chartH)); ctx.stroke();

                // Axis Titles
                ctx.font = 'bold 12px Inter';
                ctx.textAlign = 'center';
                ctx.fillStyle = isDark ? '#dd9933' : '#333';
                const xLabel = chartMode === 'performance' ? 'Variação 24h (%)' : 'Market Cap (Log)';
                ctx.fillText(xLabel, width / 2, height - 8);
                
                ctx.save();
                ctx.translate(15, height / 2);
                ctx.rotate(-Math.PI / 2);
                ctx.fillText('Volume 24h (Log)', 0, 0);
                ctx.restore();
                
                ctx.restore();
            }

            const particles = particlesRef.current;

            // --- PHYSICS ENGINE ---
            if (isFreeMode) {
                const worldW = width / k; 
                const worldH = height / k;

                // 1. Movement
                for (const p of particles) {
                    if (p.isFixed) continue;
                    
                    p.x += p.vx * dt * physicsSpeed;
                    p.y += p.vy * dt * physicsSpeed;

                    // Wall Bounce
                    if (p.x < p.radius) { 
                        p.x = p.radius; 
                        p.vx = Math.abs(p.vx); 
                    } else if (p.x > worldW - p.radius) { 
                        p.x = worldW - p.radius; 
                        p.vx = -Math.abs(p.vx); 
                    }

                    if (p.y < p.radius) { 
                        p.y = p.radius; 
                        p.vy = Math.abs(p.vy); 
                    } else if (p.y > worldH - p.radius) { 
                        p.y = worldH - p.radius; 
                        p.vy = -Math.abs(p.vy); 
                    }
                }

                // 2. Collisions (Elastic Billiard - NO STICKING)
                for (let i = 0; i < particles.length; i++) {
                    const p1 = particles[i];
                    for (let j = i + 1; j < particles.length; j++) {
                        const p2 = particles[j];
                        
                        const dx = p2.x - p1.x;
                        const dy = p2.y - p1.y;
                        const distSq = dx * dx + dy * dy;
                        const minDist = p1.radius + p2.radius;

                        if (distSq < minDist * minDist) {
                            const dist = Math.sqrt(distSq) || 0.001;
                            
                            // Normal vector (p1 -> p2)
                            const nx = dx / dist; 
                            const ny = dy / dist;

                            // 1. HARD POSITION SEPARATION (Prevents sticking)
                            // Push particles apart so they don't overlap in the next frame
                            const overlap = minDist - dist + 0.5; // +0.5 buffer
                            const totalMass = p1.mass + p2.mass;
                            const m1Ratio = p2.mass / totalMass;
                            const m2Ratio = p1.mass / totalMass;

                            if (!p1.isFixed) {
                                p1.x -= nx * overlap * m1Ratio;
                                p1.y -= ny * overlap * m1Ratio;
                            }
                            if (!p2.isFixed) {
                                p2.x += nx * overlap * m2Ratio;
                                p2.y += ny * overlap * m2Ratio;
                            }

                            // 2. ELASTIC BOUNCE
                            const dvx = p1.vx - p2.vx;
                            const dvy = p1.vy - p2.vy;
                            const velAlongNormal = dvx * nx + dvy * ny;

                            // Only resolve if moving towards each other
                            if (velAlongNormal > 0) continue;

                            const restitution = 1.0; // Perfectly elastic
                            let jImpulse = -(1 + restitution) * velAlongNormal;
                            jImpulse /= (1 / p1.mass + 1 / p2.mass);

                            const impulseX = jImpulse * nx;
                            const impulseY = jImpulse * ny;

                            if (!p1.isFixed) {
                                p1.vx += (impulseX / p1.mass);
                                p1.vy += (impulseY / p1.mass);
                            }
                            if (!p2.isFixed) {
                                p2.vx -= (impulseX / p2.mass);
                                p2.vy -= (impulseY / p2.mass);
                            }
                        }
                    }
                }
            } else {
                // Mapped Mode Logic
                for (const p of particles) {
                    let xVal = 0, yVal = p.coin.total_volume || 1;
                    if (chartMode === 'performance') xVal = p.coin.price_change_percentage_24h || 0;
                    else xVal = p.coin.market_cap || 1;

                    const tx = projectX(xVal);
                    const ty = projectY(yVal);
                    
                    const floatFreq = 0.0005 * (1 + animSpeedRaw);
                    const floatX = Math.sin(now * floatFreq + p.phase) * floatAmpBase;
                    const floatY = Math.cos(now * (floatFreq * 1.3) + p.phase) * floatAmpBase;

                    const targetX = tx + floatX;
                    const targetY = ty + floatY;

                    p.x += (targetX - p.x) * 0.05;
                    p.y += (targetY - p.y) * 0.05;
                }
            }

            // --- RENDER PARTICLES ---
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                
                // ZOOM SCALING - Smoother (Power 0.2 instead of 0.4)
                const viewRadius = p.targetRadius * Math.pow(k, 0.25);
                p.radius += (viewRadius - p.radius) * 0.1;

                const screenX = toScreenX(p.x);
                const screenY = toScreenY(p.y);

                // Culling
                if (screenX + p.radius < 0 || screenX - p.radius > width || screenY + p.radius < 0 || screenY - p.radius > height) {
                    continue; 
                }

                // Trails
                if (trailLength > 0) {
                    const last = p.trail[p.trail.length-1];
                    const dx = last ? screenX - last.x : 10;
                    const dy = last ? screenY - last.y : 10;
                    
                    if (!last || (dx*dx + dy*dy > 4)) {
                        p.trail.push({ x: screenX, y: screenY, age: 1.0 });
                    }
                    
                    for (let tIdx = 0; tIdx < p.trail.length; tIdx++) {
                        p.trail[tIdx].age -= 0.02; 
                    }
                    p.trail = p.trail.filter(t => t.age > 0);

                    if (p.trail.length > 1) {
                        ctx.beginPath();
                        ctx.moveTo(p.trail[0].x, p.trail[0].y);
                        for (let k = 1; k < p.trail.length; k++) ctx.lineTo(p.trail[k].x, p.trail[k].y);
                        
                        const grad = ctx.createLinearGradient(p.trail[0].x, p.trail[0].y, screenX, screenY);
                        grad.addColorStop(0, "rgba(0,0,0,0)");
                        grad.addColorStop(1, p.color); 
                        ctx.strokeStyle = grad;
                        ctx.lineWidth = Math.min(p.radius * 0.4, 4); 
                        ctx.stroke();
                    }
                } else {
                    p.trail = [];
                }

                // Bubble
                const isHovered = hoveredParticleRef.current?.id === p.id;
                const isSelected = selectedParticleRef.current?.id === p.id;
                const isDimmed = searchTerm && !p.coin.name.toLowerCase().includes(searchTerm.toLowerCase()) && !p.coin.symbol.toLowerCase().includes(searchTerm.toLowerCase());

                if (isDimmed) ctx.globalAlpha = 0.1;

                ctx.beginPath();
                ctx.arc(screenX, screenY, p.radius, 0, Math.PI * 2);
                
                const img = imageCache.current.get(p.coin.image);
                if (img?.complete) {
                    ctx.save();
                    ctx.clip();
                    ctx.drawImage(img, screenX - p.radius, screenY - p.radius, p.radius * 2, p.radius * 2);
                    ctx.restore();
                    ctx.strokeStyle = p.color;
                    ctx.lineWidth = isSelected ? 4 : 2;
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
                    ctx.fillText(p.coin.symbol.toUpperCase(), screenX, screenY);
                    ctx.shadowBlur = 0;
                }

                if (isHovered || isSelected) {
                    ctx.strokeStyle = isDark ? '#fff' : '#000';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, p.radius + 4, 0, Math.PI * 2);
                    ctx.stroke();
                }

                ctx.globalAlpha = 1.0;
            }
            
            const p = hoveredParticleRef.current || selectedParticleRef.current;
            if (p) {
                const sx = toScreenX(p.x);
                const sy = toScreenY(p.y);
                drawTooltip(ctx, p, sx, sy, width, height);
            }
        } catch (e) {
            console.error("Animation Loop Error", e);
        }
    };
  }, [animSpeedRaw, trailLength, isDark, chartMode, isFreeMode, dpr, numCoins]);

  const drawTooltip = (ctx: CanvasRenderingContext2D, p: Particle, x: number, y: number, width: number, height: number) => {
        const boxW = 200;
        const boxH = 110;
        let bx = x + p.radius + 15;
        let by = y - boxH / 2;

        if (bx + boxW > width) bx = x - p.radius - boxW - 15;
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
        if (ctx.roundRect) ctx.roundRect(bx, by, boxW, boxH, 8);
        else ctx.rect(bx, by, boxW, boxH);
        
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = isDark ? '#fff' : '#000';
        ctx.font = 'bold 14px Inter';
        ctx.textAlign = 'left';
        ctx.fillText(p.coin.name, bx + 12, by + 20);
        
        ctx.fillStyle = '#888';
        ctx.font = '11px Inter';
        ctx.fillText(p.coin.symbol.toUpperCase(), bx + 12, by + 35);

        ctx.font = 'bold 16px Inter';
        ctx.fillStyle = isDark ? '#eee' : '#111';
        ctx.fillText(formatPrice(p.coin.current_price), bx + 12, by + 60);

        const change = p.coin.price_change_percentage_24h || 0;
        ctx.fillStyle = change >= 0 ? '#089981' : '#f23645';
        ctx.font = 'bold 12px Inter';
        ctx.textAlign = 'right';
        ctx.fillText(`${change > 0 ? '+' : ''}${change.toFixed(2)}%`, bx + boxW - 12, by + 20);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#666';
        ctx.font = '10px Inter';
        ctx.fillText('Vol 24h: ' + formatCompact(p.coin.total_volume), bx + 12, by + 85);
        ctx.fillText('Mkt Cap: ' + formatCompact(p.coin.market_cap), bx + 12, by + 98);

        ctx.restore();
  };

  useEffect(() => {
    const loop = () => {
      if (animationLoopFn.current) animationLoopFn.current();
      reqIdRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(reqIdRef.current);
  }, []);

  const resetZoom = () => {
      transformRef.current = { k: 1, x: 0, y: 0 };
  };

  // --- EVENTS ---
  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const { k, x, y } = transformRef.current;
    const worldMouseX = (mouseX - x) / k;
    const worldMouseY = (mouseY - y) / k;

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

        const dx = sx - mouseX;
        const dy = sy - mouseY;
        
        if (dx*dx + dy*dy < (sr + 5) * (sr + 5)) {
            found = p;
            break;
        }
    }
    
    if (found) {
        setHoveredParticle(found);
    } else {
        setHoveredParticle(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!hoveredParticleRef.current) {
        setSelectedParticle(null);
    }

    if (hoveredParticleRef.current && isFreeMode) {
        draggedParticleRef.current = hoveredParticleRef.current;
        draggedParticleRef.current.isFixed = true;
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
    if (draggedParticleRef.current) {
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
  
  return (
    <div ref={containerRef} className="fixed inset-0 z-[2000] bg-white dark:bg-[#0b0f14] text-gray-900 dark:text-white flex flex-col overflow-hidden touch-none select-none">
      
      {/* HEADER */}
      <div className="flex justify-between items-start p-4 z-20 bg-white/80 dark:bg-black/50 backdrop-blur-sm border-b border-gray-200 dark:border-white/10 shrink-0">
        <div className="flex items-center gap-4">
            <Coins size={28} className="text-[#dd9933]" />
            <div><h3 className="text-xl font-black uppercase tracking-wider">Crypto Bubbles</h3><p className="text-xs text-gray-500 dark:text-gray-400 font-bold">{status === 'demo' ? 'MODO DEMO' : 'Live Physics'}</p></div>
            <div className="w-px h-8 bg-gray-200 dark:bg-white/10 mx-4"></div>
            
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
            {/* RESET ZOOM BUTTON RELOCATED */}
            <button onClick={resetZoom} className="p-3 bg-[#dd9933]/10 hover:bg-[#dd9933]/20 text-[#dd9933] rounded-lg border border-[#dd9933]/30 transition-colors" title="Reset Zoom">
                <Maximize size={20} />
            </button>

            <button onClick={() => setSettingsOpen(!settingsOpen)} className={`p-3 rounded-lg border transition-colors backdrop-blur-sm ${settingsOpen ? 'bg-[#dd9933] text-black border-[#dd9933]' : 'bg-gray-100 dark:bg-black/50 border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10'}`}><Settings size={20} /></button>
            <button onClick={() => onClose()} className="p-3 bg-gray-100 dark:bg-black/50 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-red-500/10 text-gray-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Close"><CloseIcon size={20} /></button>
        </div>
      </div>
      
      {settingsOpen && (
          <div className="absolute top-24 right-4 bg-white/90 dark:bg-black/80 p-4 rounded-lg border border-gray-200 dark:border-white/10 backdrop-blur-md w-72 z-30 space-y-4 animate-in fade-in slide-in-from-top-4 shadow-xl">
              <div className="flex justify-between items-center"><label className="text-xs font-bold flex items-center gap-2"><Atom size={14} /> Modo Livre (Sem Alvo)</label><button onClick={()=> setIsFreeMode(!isFreeMode)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isFreeMode ? 'bg-[#dd9933]' : 'bg-gray-200 dark:bg-tech-700'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isFreeMode ? 'translate-x-6' : 'translate-x-1'}`}/></button></div>
              <div className="space-y-2"><label className="text-xs font-bold flex items-center gap-2"><Coins size={14} /> # Moedas</label>
                  <select value={numCoins} onChange={e => setNumCoins(parseInt(e.target.value))} className="w-full bg-gray-100 dark:bg-tech-800 text-gray-900 dark:text-gray-100 p-2 rounded text-xs border border-gray-200 dark:border-white/10 outline-none">
                      {[50, 100, 150, 200, 250].map(n => <option key={n} value={n}>{n} Moedas</option>)}
                  </select>
              </div>
              <div className="space-y-2"><label className="text-xs font-bold flex items-center gap-2"><FastForward size={14} /> Flutuação / Velocidade</label><input type="range" min="0" max="1" step="0.05" value={animSpeedRaw} onChange={e => setAnimSpeedRaw(parseFloat(e.target.value))} className="w-full accent-[#dd9933]" /></div>
              <div className="space-y-2"><label className="text-xs font-bold flex items-center gap-2"><Droplets size={14} /> Rastro (Trail)</label><input type="range" min="0" max="50" step="1" value={trailLength} onChange={e => setTrailLength(parseInt(e.target.value))} className="w-full accent-[#dd9933]" /></div>
          </div>
      )}

      {/* Flex-1 ensures it fills the rest of the column, relative for absolute canvas positioning */}
      <div className="flex-1 w-full relative cursor-crosshair overflow-hidden">
        <canvas ref={canvasRef} onMouseMove={handleMouseMove} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onMouseLeave={() => { setHoveredParticle(null); handleMouseUp(); }} onWheel={handleWheel} className="absolute inset-0 w-full h-full block" />
      </div>
    </div>
  );
};

export default MarketWindSwarm;