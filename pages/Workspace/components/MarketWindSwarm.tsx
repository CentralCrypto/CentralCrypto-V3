import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ApiCoin, Language } from '../../../types';
import { Search, XCircle, Settings, Droplets, FastForward, Activity, Wind, X, Atom, Scaling, Coins } from 'lucide-react';
import { fetchTopCoins } from '../services/api';

// --- TYPES ---
interface Particle {
  id: string;
  x: number; y: number;
  vx: number; vy: number; // Velocity
  radius: number; // Current Radius (animates)
  targetRadius: number; // Target Radius based on data
  targetX: number; targetY: number;
  color: string;
  coin: ApiCoin;
  trail: { x: number, y: number }[];
  mass: number;
  isFixed?: boolean; // User dragging
}

type ChartMode = 'performance' | 'valuation';
type Status = 'loading' | 'running' | 'demo' | 'error';

interface MarketWindSwarmProps { language: Language; onClose: () => void; }

// --- HELPERS ---
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

const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

// --- MAIN COMPONENT ---
const MarketWindSwarm = ({ language, onClose }: MarketWindSwarmProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Physics State
  const particlesRef = useRef<Particle[]>([]);
  const imageCache = useRef(new Map<string, HTMLImageElement>());
  const animationLoopFn = useRef<(() => void) | null>(null);
  
  // Data State
  const [status, setStatus] = useState<Status>('loading');
  const [coins, setCoins] = useState<ApiCoin[]>([]);
  const previousCoinsRef = useRef<ApiCoin[]>([]);
  
  // UI State
  const [hoveredParticle, setHoveredParticle] = useState<Particle | null>(null);
  const [selectedParticle, setSelectedParticle] = useState<Particle | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Configs
  const [isFreeMode, setIsFreeMode] = useState(false);
  const [numCoins, setNumCoins] = useState(100); 
  const [animSpeed, setAnimSpeed] = useState(1.0); // Physics Simulation Speed Multiplier
  const [chartMode, setChartMode] = useState<ChartMode>('performance');
  const [trailLength, setTrailLength] = useState(0); // Default off for cleaner bubbles look
  
  // Interaction
  const zoomRef = useRef(1.0);
  const panRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ clientX: 0, clientY: 0, panX: 0, panY: 0 });
  const draggedParticleRef = useRef<Particle | null>(null);
  const lastMousePosRef = useRef<{x: number; y: number} | null>(null);

  // Theme Detection
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  
  const hoveredParticleRef = useRef(hoveredParticle);
  hoveredParticleRef.current = hoveredParticle;
  const selectedParticleRef = useRef(selectedParticle);
  selectedParticleRef.current = selectedParticle;

  // Handle Search Selection
  useEffect(() => {
    if (!searchTerm) { setSelectedParticle(null); return; }
    const found = particlesRef.current.find(p => 
      p.coin.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.coin.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (found) setSelectedParticle(found);
  }, [searchTerm]);

  // Load Data
  const loadData = useCallback(async () => {
    if (particlesRef.current.length === 0) setStatus('loading');
    try {
      const data = await fetchTopCoins({ force: true });
      if (data && data.length > 0) {
        setCoins(currentCoins => {
          previousCoinsRef.current = currentCoins;
          return data;
        });
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
            canvasRef.current.width = containerRef.current.clientWidth;
            canvasRef.current.height = containerRef.current.clientHeight;
        }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => { clearInterval(interval); window.removeEventListener('resize', handleResize); };
  }, [loadData]);
  
  // --- MAPPING LOGIC (Determines Targets) ---
  const calculateTargets = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || coins.length === 0) return null;
    
    const { width, height } = canvas;
    const pad = 100; // Padding for axis labels

    const topCoins = coins.slice(0, numCoins);
    
    let xData: number[], radiusData: number[];
    const yData = topCoins.map(p => p.total_volume || 1); // Y is always Volume

    if (chartMode === 'performance') {
        xData = topCoins.map(p => p.price_change_percentage_24h || 0);
        radiusData = topCoins.map(p => p.market_cap || 1).filter(mc => mc > 0);
    } else {
        xData = topCoins.map(p => p.market_cap || 1).filter(mc => mc > 0);
        radiusData = topCoins.map(p => Math.abs(p.price_change_percentage_24h || 0));
    }

    if (xData.length === 0 || yData.length === 0 || radiusData.length === 0) return null;
    
    const minX = Math.min(...xData), maxX = Math.max(...xData);
    const minY = Math.min(...yData), maxY = Math.max(...yData);
    const minR = Math.min(...radiusData), maxR = Math.max(...radiusData);
    
    const logMinX = (chartMode === 'valuation' && minX > 0) ? Math.log10(minX) : 0;
    const logMaxX = (chartMode === 'valuation' && maxX > 0) ? Math.log10(maxX) : 0;
    const logMinY = (minY > 0) ? Math.log10(minY) : 0;
    const logMaxY = (maxY > 0) ? Math.log10(maxY) : 0;
    const logMinR = (chartMode === 'performance' && minR > 0) ? Math.log10(minR) : minR;
    const logMaxR = (chartMode === 'performance' && maxR > 0) ? Math.log10(maxR) : maxR;

    const baseMapX = (v: number) => {
        if (chartMode === 'valuation') {
            if (v <= 0) return pad;
            return pad + (Math.log10(v) - logMinX) / (logMaxX - logMinX || 1) * (width - pad * 2);
        }
        return pad + (v - minX) / (maxX - minX || 1) * (width - pad * 2);
    };
    
    const baseMapY = (v: number) => {
        if (v <= 0) return height - pad;
        return height - pad - (Math.log10(v) - logMinY) / (logMaxY - logMinY || 1) * (height - pad * 2);
    };

    // Apply Pan/Zoom to coordinates
    const mapX = (v: number) => panRef.current.x + (baseMapX(v) - width / 2) * zoomRef.current + width / 2;
    const mapY = (v: number) => panRef.current.y + (baseMapY(v) - height / 2) * zoomRef.current + height / 2;
    
    // Radius scaling (independent of zoom for better readability, but we apply a small factor)
    const mapRadius = (v: number) => {
        if (v <= 0) return 8;
        let r = 8;
        if (chartMode === 'performance') {
            r = (10 + (Math.log10(v) - logMinR) / (logMaxR - logMinR || 1) * 50); // Log scale for MarketCap
        } else {
            r = (10 + (v - minR) / (maxR - minR || 1) * 50); // Linear for %
        }
        return Math.max(10, r * Math.sqrt(zoomRef.current)); // Slight zoom scaling
    };
    
    return { mapX, mapY, mapRadius, topCoins, minX, maxX, minY, maxY, pad, width, height };
  }, [coins, numCoins, chartMode]);

  // --- SYNC PARTICLES ---
  useEffect(() => {
    const mappings = calculateTargets();
    if (!mappings) return;
    const { mapX, mapY, mapRadius, topCoins } = mappings;

    const existingMap = new Map(particlesRef.current.map(p => [p.id, p]));
    const canvas = canvasRef.current;
    
    const newParticles: Particle[] = topCoins.map(coin => {
      let xVal, radiusVal, yVal = coin.total_volume || 1;

      if (chartMode === 'performance') {
          xVal = coin.price_change_percentage_24h || 0;
          radiusVal = coin.market_cap || 1;
      } else {
          xVal = coin.market_cap || 1;
          radiusVal = Math.abs(coin.price_change_percentage_24h || 0);
      }

      const tx = mapX(xVal);
      const ty = mapY(yVal);
      const tr = mapRadius(radiusVal);
      
      const existing = existingMap.get(coin.id);
      
      if (existing) {
        existing.targetX = tx;
        existing.targetY = ty;
        existing.targetRadius = tr;
        existing.coin = coin;
        existing.color = (coin.price_change_percentage_24h || 0) >= 0 ? '#089981' : '#f23645';
        return existing;
      } else {
        // Preload image
        if (!imageCache.current.has(coin.image)) {
          const img = new Image(); img.src = coin.image;
          imageCache.current.set(coin.image, img);
        }
        
        // Spawn at random location if new
        const spawnX = canvas ? canvas.width/2 + (Math.random()-0.5)*100 : 0;
        const spawnY = canvas ? canvas.height/2 + (Math.random()-0.5)*100 : 0;

        return {
          id: coin.id,
          x: spawnX, y: spawnY,
          vx: 0, vy: 0,
          radius: 0, // Grow in
          targetRadius: tr,
          targetX: tx, targetY: ty,
          color: (coin.price_change_percentage_24h || 0) >= 0 ? '#089981' : '#f23645',
          coin,
          trail: [],
          mass: tr, // Approximation for physics
        };
      }
    });
    
    particlesRef.current = newParticles;
  }, [coins, numCoins, chartMode, calculateTargets]); // Re-run when data/settings change

  // --- PHYSICS ENGINE & RENDER LOOP ---
  useEffect(() => {
    const canvas = canvasRef.current; 
    const ctx = canvas?.getContext('2d', { alpha: false }); // Optimize
    if (!ctx || !canvas) return;
    
    let lastTime = performance.now();

    // Helper for rounded rect
    const roundedRect = (x:number, y:number, w:number, h:number, r:number) => {
        if (w < 2 * r) r = w / 2; if (h < 2 * r) r = h / 2;
        ctx.beginPath(); ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    };

    animationLoopFn.current = () => {
        const now = performance.now();
        const dt = Math.min((now - lastTime) / 1000, 0.05); // Cap at 50ms to prevent explosion
        lastTime = now;

        // Force mappings update every frame if panning/zooming to keep targets correct
        const mappings = calculateTargets();
        if(mappings) {
             const { mapX, mapY, mapRadius, topCoins } = mappings;
             // Update targets based on current zoom/pan
             for(const p of particlesRef.current) {
                 let xVal, radiusVal, yVal = p.coin.total_volume || 1;
                 if (chartMode === 'performance') {
                    xVal = p.coin.price_change_percentage_24h || 0;
                    radiusVal = p.coin.market_cap || 1;
                 } else {
                    xVal = p.coin.market_cap || 1;
                    radiusVal = Math.abs(p.coin.price_change_percentage_24h || 0);
                 }
                 p.targetX = mapX(xVal);
                 p.targetY = mapY(yVal);
                 p.targetRadius = mapRadius(radiusVal);
             }
        }

        // --- PHYSICS UPDATE ---
        const particles = particlesRef.current;
        const width = canvas.width;
        const height = canvas.height;
        
        // 1. Forces
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            
            // Mouse Drag override
            if (p.isFixed) continue;

            // Attraction to Target (Spring Force)
            if (!isFreeMode) {
                const k = 2.0 * animSpeed; // Spring constant
                const ax = (p.targetX - p.x) * k;
                const ay = (p.targetY - p.y) * k;
                p.vx += ax * dt;
                p.vy += ay * dt;
            } else {
                // Free mode: minimal friction, bounce off walls logic handled below
            }

            // Radius Animation
            p.radius += (p.targetRadius - p.radius) * 5 * dt;

            // Damping (Friction)
            const damping = isFreeMode ? 0.99 : 0.90;
            p.vx *= damping;
            p.vy *= damping;
            
            // Add slight jitter for "float" effect if settled
            if (!isFreeMode && Math.abs(p.vx) < 5 && Math.abs(p.vy) < 5) {
                p.vx += (Math.random() - 0.5) * 20 * animSpeed;
                p.vy += (Math.random() - 0.5) * 20 * animSpeed;
            }
        }

        // 2. Collision Detection & Resolution (Circle-Circle)
        // Optimization: Simple O(N^2) is fine for N=200. For N>1000 need Quadtree.
        for (let i = 0; i < particles.length; i++) {
            const p1 = particles[i];
            for (let j = i + 1; j < particles.length; j++) {
                const p2 = particles[j];
                
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distSq = dx*dx + dy*dy;
                const minDist = p1.radius + p2.radius + 2; // +2 padding
                
                if (distSq < minDist * minDist) {
                    const dist = Math.sqrt(distSq);
                    const overlap = minDist - dist;
                    const nx = dx / (dist || 1); // Normal X
                    const ny = dy / (dist || 1); // Normal Y
                    
                    // Separate circles
                    const totalMass = p1.radius + p2.radius;
                    const m1Ratio = p2.radius / totalMass; // Move smaller more
                    const m2Ratio = p1.radius / totalMass;
                    
                    const separationFactor = 0.8; // Smooth separation
                    
                    if (!p1.isFixed) {
                        p1.x -= nx * overlap * m1Ratio * separationFactor;
                        p1.y -= ny * overlap * m1Ratio * separationFactor;
                        // Bounce velocity
                        p1.vx -= nx * 20 * dt; 
                        p1.vy -= ny * 20 * dt;
                    }
                    if (!p2.isFixed) {
                        p2.x += nx * overlap * m2Ratio * separationFactor;
                        p2.y += ny * overlap * m2Ratio * separationFactor;
                        p2.vx += nx * 20 * dt;
                        p2.vy += ny * 20 * dt;
                    }
                }
            }
        }

        // 3. Integration & Boundary Check
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            if (!p.isFixed) {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
            }

            // Wall Collisions (Keep inside canvas)
            if (p.x < p.radius) { p.x = p.radius; p.vx *= -0.5; }
            if (p.x > width - p.radius) { p.x = width - p.radius; p.vx *= -0.5; }
            if (p.y < p.radius) { p.y = p.radius; p.vy *= -0.5; }
            if (p.y > height - p.radius) { p.y = height - p.radius; p.vy *= -0.5; }
            
            // Trail Update
            if (trailLength > 0 && Math.abs(p.vx) + Math.abs(p.vy) > 10) {
                p.trail.push({ x: p.x, y: p.y });
                if (p.trail.length > trailLength) p.trail.shift();
            } else if (p.trail.length > 0) {
                p.trail.shift(); // Fade trail when stopped
            }
        }

        // --- RENDER ---
        ctx.fillStyle = isDark ? '#0b0f14' : '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Draw Axes (if mapped)
        if (!isFreeMode && mappings) {
             const { pad, minX, maxX, minY, maxY } = mappings;
             ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
             ctx.fillStyle = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
             ctx.lineWidth = 1;
             ctx.font = `bold 10px Inter`;
             
             // Y-Axis
             ctx.beginPath();
             ctx.moveTo(mappings.mapX(minX), 0);
             ctx.lineTo(mappings.mapX(minX), height);
             ctx.stroke();
             
             // X-Axis (Bottom)
             ctx.beginPath();
             ctx.moveTo(0, mappings.mapY(minY));
             ctx.lineTo(width, mappings.mapY(minY));
             ctx.stroke();
             
             ctx.fillStyle = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
             ctx.font = 'bold 12px Inter';
             ctx.textAlign = 'center';
             ctx.fillText(chartMode === 'performance' ? 'Variação 24h (%)' : 'Market Cap', width/2, height - 20);
             
             ctx.save();
             ctx.translate(20, height/2);
             ctx.rotate(-Math.PI/2);
             ctx.fillText('Volume 24h', 0, 0);
             ctx.restore();
        }

        // Draw Particles
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            
            // Trail
            if (p.trail.length > 1) {
                ctx.beginPath();
                ctx.moveTo(p.trail[0].x, p.trail[0].y);
                for (let k=1; k<p.trail.length; k++) ctx.lineTo(p.trail[k].x, p.trail[k].y);
                ctx.strokeStyle = p.color;
                ctx.globalAlpha = 0.3;
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }

            // Bubble Body
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            
            // Selection Highlight
            const isSelected = selectedParticleRef.current?.id === p.id || hoveredParticleRef.current?.id === p.id;
            const isMatch = searchTerm && selectedParticleRef.current?.id === p.id;
            
            if (searchTerm && !isMatch) ctx.globalAlpha = 0.1;
            
            // Gradient Fill
            const grad = ctx.createRadialGradient(p.x - p.radius*0.3, p.y - p.radius*0.3, p.radius*0.1, p.x, p.y, p.radius);
            grad.addColorStop(0, isDark ? '#ffffff' : '#ffffff');
            grad.addColorStop(0.3, p.color);
            grad.addColorStop(1, p.color); // Solid edge
            
            ctx.fillStyle = grad;
            ctx.fill();
            
            // Border
            ctx.strokeStyle = isSelected ? '#fff' : 'rgba(0,0,0,0.2)';
            ctx.lineWidth = isSelected ? 3 : 1;
            ctx.stroke();
            
            // Image/Symbol
            if (p.radius > 8) {
                const img = imageCache.current.get(p.coin.image);
                if (img?.complete && p.radius > 15) {
                    const iconSize = p.radius;
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, iconSize/2, 0, Math.PI*2);
                    ctx.clip();
                    ctx.drawImage(img, p.x - iconSize/2, p.y - iconSize/2, iconSize, iconSize);
                    ctx.restore();
                } else {
                    // Fallback text
                    ctx.fillStyle = '#fff';
                    ctx.font = `bold ${Math.max(8, p.radius*0.6)}px Inter`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.shadowColor = 'rgba(0,0,0,0.5)';
                    ctx.shadowBlur = 2;
                    ctx.fillText(p.coin.symbol.substring(0,3).toUpperCase(), p.x, p.y);
                    ctx.shadowBlur = 0;
                }
            }
            
            // Percentage Text (if big enough)
            if (p.radius > 25) {
                const change = p.coin.price_change_percentage_24h || 0;
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${Math.max(9, p.radius*0.3)}px Inter`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 3;
                ctx.fillText(`${change > 0 ? '+' : ''}${change.toFixed(1)}%`, p.x, p.y + p.radius*0.6);
                ctx.shadowBlur = 0;
            }
            
            ctx.globalAlpha = 1.0;
        }

        // Draw Tooltip (CryptoBubbles Style)
        const p = hoveredParticleRef.current || selectedParticleRef.current;
        if (p) {
            const padding = 12;
            const boxW = 220;
            const boxH = 140; // Reduced height, compact
            let bx = p.x + p.radius + 10;
            let by = p.y - boxH/2;
            
            // Boundary checks for tooltip
            if (bx + boxW > width) bx = p.x - p.radius - boxW - 10;
            if (bx < 0) bx = 10;
            if (by < 0) by = 10;
            if (by + boxH > height) by = height - boxH - 10;

            // Background (Glassmorphism dark)
            ctx.save();
            ctx.shadowColor = "rgba(0,0,0,0.5)";
            ctx.shadowBlur = 15;
            ctx.fillStyle = "rgba(20, 20, 25, 0.95)";
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 1;
            roundedRect(bx, by, boxW, boxH, 8);
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            // 1. Header: Rank | Symbol | Name
            ctx.font = "bold 12px Inter";
            ctx.fillStyle = "#aaa";
            ctx.textAlign = "left";
            ctx.fillText(`#${p.coin.market_cap_rank}`, bx + padding, by + 20);
            
            ctx.font = "bold 14px Inter";
            ctx.fillStyle = "#fff";
            const nameWidth = ctx.measureText(p.coin.name).width;
            ctx.fillText(p.coin.name, bx + padding + 30, by + 20);
            
            ctx.font = "bold 10px Inter";
            ctx.fillStyle = "#666";
            ctx.fillText(p.coin.symbol.toUpperCase(), bx + padding + 30 + nameWidth + 6, by + 20);

            // 2. Big Price & Change
            const change = p.coin.price_change_percentage_24h || 0;
            const changeStr = `${change > 0 ? '+' : ''}${change.toFixed(2)}%`;
            const priceStr = formatPrice(p.coin.current_price);
            
            ctx.font = "900 24px Inter";
            ctx.fillStyle = "#fff";
            ctx.fillText(priceStr, bx + padding, by + 55);
            
            ctx.font = "bold 16px Inter";
            ctx.fillStyle = change >= 0 ? "#4ade80" : "#f87171";
            ctx.textAlign = "right";
            ctx.fillText(changeStr, bx + boxW - padding, by + 55);

            // 3. Divider
            ctx.strokeStyle = "rgba(255,255,255,0.1)";
            ctx.beginPath(); ctx.moveTo(bx+padding, by+70); ctx.lineTo(bx+boxW-padding, by+70); ctx.stroke();

            // 4. Stats Grid
            const labels = ["Mkt Cap", "Vol 24h"];
            const values = [formatCompact(p.coin.market_cap), formatCompact(p.coin.total_volume)];
            
            ctx.textAlign = "left";
            ctx.font = "10px Inter";
            ctx.fillStyle = "#888";
            ctx.fillText(labels[0], bx + padding, by + 90);
            ctx.fillText(labels[1], bx + padding, by + 115);
            
            ctx.textAlign = "right";
            ctx.font = "bold 11px Inter";
            ctx.fillStyle = "#ddd";
            ctx.fillText(values[0], bx + boxW - padding, by + 90);
            ctx.fillText(values[1], bx + boxW - padding, by + 115);
        }

    }; // End Loop
  }, [animSpeed, trailLength, isDark, calculateTargets, searchTerm, chartMode, isFreeMode]);

  // --- LOOP DRIVER ---
  useEffect(() => {
    let frameId: number;
    const loop = () => {
      if (animationLoopFn.current) animationLoopFn.current();
      frameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frameId);
  }, []);

  // --- EVENT HANDLERS ---
  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    lastMousePosRef.current = { x: mouseX, y: mouseY };

    if (draggedParticleRef.current) {
        draggedParticleRef.current.x = mouseX;
        draggedParticleRef.current.y = mouseY;
        // Apply impulse to velocity for throw effect
        draggedParticleRef.current.vx = (e.movementX) * 10;
        draggedParticleRef.current.vy = (e.movementY) * 10;
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
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        if (dx*dx + dy*dy < p.radius*p.radius) {
            found = p;
            break;
        }
    }
    setHoveredParticle(found);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (hoveredParticleRef.current) {
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
        draggedParticleRef.current.isFixed = false;
        draggedParticleRef.current = null;
    }
    isPanningRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const oldZoom = zoomRef.current;
    const newZoom = e.deltaY < 0 ? oldZoom * zoomFactor : oldZoom / zoomFactor;
    zoomRef.current = clamp(newZoom, 0.2, 8.0);
  };
  
  return (
    <div ref={containerRef} className="fixed inset-0 z-[2000] bg-white dark:bg-[#0b0f14] text-gray-900 dark:text-white flex flex-col">
      <div className="flex justify-between items-start p-4 z-10 bg-white/80 dark:bg-black/50 backdrop-blur-sm border-b border-gray-200 dark:border-white/10 shrink-0">
        <div className="flex items-center gap-4">
            <Wind size={28} className="text-[#dd9933]" />
            <div><h3 className="text-xl font-black uppercase tracking-wider">Market WindSwarm</h3><p className="text-xs text-gray-500 dark:text-gray-400 font-bold">{status === 'demo' ? 'MODO DEMO' : 'Live Physics Engine'}</p></div>
            <div className="w-px h-8 bg-gray-200 dark:bg-white/10 mx-4"></div>
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-black/50 p-2 rounded-lg border border-gray-200 dark:border-white/10">
                <Search size={16} className="text-gray-400" /><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar ativo..." className="bg-transparent outline-none text-sm w-48 text-gray-900 dark:text-white" />
                {searchTerm && <button onClick={() => { setSearchTerm(''); setSelectedParticle(null); }}><XCircle size={16} className="text-gray-500 hover:text-white" /></button>}
            </div>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={() => setSettingsOpen(!settingsOpen)} className={`p-3 rounded-lg border transition-colors backdrop-blur-sm ${settingsOpen ? 'bg-[#dd9933] text-black border-[#dd9933]' : 'bg-gray-100 dark:bg-black/50 border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10'}`}><Settings size={20} /></button>
            <button onClick={() => onClose()} className="p-3 bg-gray-100 dark:bg-black/50 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-red-500/10 text-gray-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Close"><X size={20} /></button>
        </div>
      </div>
      
      {settingsOpen && (
          <div className="absolute top-24 right-4 bg-white/90 dark:bg-black/80 p-4 rounded-lg border border-gray-200 dark:border-white/10 backdrop-blur-md w-72 z-20 space-y-4 animate-in fade-in slide-in-from-top-4 shadow-xl">
              <div className="flex justify-between items-center"><label className="text-xs font-bold flex items-center gap-2"><Atom size={14} /> Modo Livre (Sem Alvo)</label><button onClick={()=> setIsFreeMode(!isFreeMode)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isFreeMode ? 'bg-[#dd9933]' : 'bg-gray-200 dark:bg-tech-700'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isFreeMode ? 'translate-x-6' : 'translate-x-1'}`}/></button></div>
              <div className="space-y-2"><label className="text-xs font-bold flex items-center gap-2"><Scaling size={14} /> Escala da Bolha</label>
                  <div className="flex bg-gray-100 dark:bg-tech-800 p-1 rounded-lg border border-gray-200 dark:border-white/10">
                      <button onClick={()=> setChartMode('performance')} className={`flex-1 text-xs font-bold p-1.5 rounded ${chartMode==='performance' ? 'bg-white dark:bg-tech-900 shadow text-[#dd9933]': 'text-gray-500'}`}>Market Cap</button>
                      <button onClick={()=> setChartMode('valuation')} className={`flex-1 text-xs font-bold p-1.5 rounded ${chartMode==='valuation' ? 'bg-white dark:bg-tech-900 shadow text-[#dd9933]': 'text-gray-500'}`}>Variação 24h</button>
                  </div>
              </div>
              <div className="space-y-2"><label className="text-xs font-bold flex items-center gap-2"><Coins size={14} /> # Moedas</label>
                  <select value={numCoins} onChange={e => setNumCoins(parseInt(e.target.value))} className="w-full bg-gray-100 dark:bg-tech-800 text-gray-900 dark:text-gray-100 p-2 rounded text-xs border border-gray-200 dark:border-white/10 outline-none">
                      {[50, 100, 150, 200, 250].map(n => <option key={n} value={n}>{n} Moedas</option>)}
                  </select>
              </div>
              <div className="space-y-2"><label className="text-xs font-bold flex items-center gap-2"><FastForward size={14} /> Física (Mola)</label><input type="range" min="0.1" max="3" step="0.1" value={animSpeed} onChange={e => setAnimSpeed(parseFloat(e.target.value))} className="w-full accent-[#dd9933]" /></div>
              <div className="space-y-2"><label className="text-xs font-bold flex items-center gap-2"><Droplets size={14} /> Rastro</label><input type="range" min="0" max="50" step="1" value={trailLength} onChange={e => setTrailLength(parseInt(e.target.value))} className="w-full accent-[#dd9933]" /></div>
          </div>
      )}

      <div className="flex-1 w-full h-full relative cursor-crosshair">
        <canvas ref={canvasRef} onMouseMove={handleMouseMove} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onMouseLeave={() => { setHoveredParticle(null); handleMouseUp(); }} onWheel={handleWheel} className="absolute inset-0 w-full h-full" />
      </div>
    </div>
  );
};

export default MarketWindSwarm;