import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ApiCoin, Language } from '../../../types';
import { Search, XCircle, Settings, Droplets, FastForward, Activity, Wind, X, Atom, Scaling, Coins } from 'lucide-react';
import { fetchTopCoins } from '../services/api';

// --- TYPES ---
interface Particle {
  id: string;
  x: number; y: number;
  vx: number; vy: number; // Velocity for free mode
  startX: number; startY: number; 
  targetX: number; targetY: number;
  animProgress: number;
  trailStartX: number;
  trailStartY: number;
  radius: number; // Base radius, unzoomed
  color: string;
  coin: ApiCoin;
  trail: { x: number, y: number }[];
  phase: number; // For oscillation
  isReturning?: boolean;
  isFixed?: boolean;
}

type ChartMode = 'performance' | 'valuation'; // performance = Size by MktCap; valuation = Size by Change%
type Status = 'loading' | 'running' | 'demo' | 'error';

interface MarketWindSwarmProps { language: Language; onClose: () => void; }

// --- HELPERS ---
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
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
  const previousCoinsRef = useRef<ApiCoin[]>([]);
  
  const [hoveredParticle, setHoveredParticle] = useState<Particle | null>(null);
  const [selectedParticle, setSelectedParticle] = useState<Particle | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isFreeMode, setIsFreeMode] = useState(false);
  const [numCoins, setNumCoins] = useState(100); // Default 100
  const [animSpeed, setAnimSpeed] = useState(1.0);
  const [chartMode, setChartMode] = useState<ChartMode>('performance');
  const [trailLength, setTrailLength] = useState(10);
  
  // Dimensions state to trigger re-renders on resize
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [chartVersion, setChartVersion] = useState(0);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  
  // Interaction Refs
  const zoomRef = useRef(1.0);
  const panRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ clientX: 0, clientY: 0, panX: 0, panY: 0 });
  const searchResultRef = useRef<Particle | null>(null);
  const draggedParticleRef = useRef<Particle | null>(null);
  const lastMousePosRef = useRef<{x: number; y: number} | null>(null);
  
  const hoveredParticleRef = useRef(hoveredParticle);
  hoveredParticleRef.current = hoveredParticle;
  const selectedParticleRef = useRef(selectedParticle);
  selectedParticleRef.current = selectedParticle;

  // Handle Resize - CRITICAL FIX FOR RESOLUTION
  useEffect(() => {
    const handleResize = () => {
        if (containerRef.current && canvasRef.current) {
            const { clientWidth, clientHeight } = containerRef.current;
            // Set internal canvas resolution to match display size
            canvasRef.current.width = clientWidth;
            canvasRef.current.height = clientHeight;
            setDimensions({ width: clientWidth, height: clientHeight });
        }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial sizing

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset particles on mode switch
  useEffect(() => {
      if (!isFreeMode) {
          particlesRef.current.forEach(p => {
              p.isReturning = true;
              p.startX = p.x;
              p.startY = p.y;
              p.animProgress = 0;
          });
      }
  }, [isFreeMode]);

  // Handle Search
  useEffect(() => {
    if (!searchTerm) { searchResultRef.current = null; return; }
    const found = particlesRef.current.find(p => 
      p.coin.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.coin.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    );
    searchResultRef.current = found || null;
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
    const observer = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => { clearInterval(interval); observer.disconnect(); };
  }, [loadData]);
  
  // --- MAPPING LOGIC ---
  const calculateMappings = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || coins.length === 0) return null;
    
    // Use dimensions from state or canvas direct
    const { width, height } = canvas;
    if (width === 0 || height === 0) return null; // Wait for resize

    const pad = 80;

    const topCoins = coins.slice(0, numCoins);
    
    let xData: number[], radiusData: number[];
    const yData = topCoins.map(p => p.total_volume || 1); // Y sempre Volume

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

    const mapX = (v: number) => panRef.current.x + (baseMapX(v) - width / 2) * zoomRef.current + width / 2;
    const mapY = (v: number) => panRef.current.y + (baseMapY(v) - height / 2) * zoomRef.current + height / 2;
    
    const mapRadius = (v: number) => {
        if (v <= 0) return 8;
        if (chartMode === 'performance') {
            return (8 + (Math.log10(v) - logMinR) / (logMaxR - logMinR || 1) * 42);
        } else {
            return (8 + (v - minR) / (maxR - minR || 1) * 42);
        }
    };
    
    return { mapX, mapY, mapRadius, topCoins, minX, maxX, minY, maxY, pad, width, height };
  }, [coins, numCoins, chartMode, chartVersion, dimensions]); // Added dimensions dependency

  // --- PARTICLE UPDATE ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || coins.length === 0 || canvas.width === 0) return;

    const mappings = calculateMappings();
    if (!mappings) return;
    const { mapX, mapY, mapRadius, topCoins } = mappings;

    const existingParticleMap = new Map(particlesRef.current.map(p => [p.id, p]));
    const prevCoinMap = new Map(previousCoinsRef.current.map(c => [c.id, c]));

    const newParticles = topCoins.map(coin => {
      let xVal, radiusVal, yVal = coin.total_volume || 1;
      let prevXVal: number | undefined, prevYVal: number | undefined;
      
      const prevCoin = prevCoinMap.get(coin.id);

      if (chartMode === 'performance') {
          xVal = coin.price_change_percentage_24h || 0;
          radiusVal = coin.market_cap || 1;
          if (prevCoin) {
              prevXVal = prevCoin.price_change_percentage_24h || 0;
              prevYVal = prevCoin.total_volume || 1;
          }
      } else {
          xVal = coin.market_cap || 1;
          radiusVal = Math.abs(coin.price_change_percentage_24h || 0);
          if (prevCoin) {
              prevXVal = prevCoin.market_cap || 1;
              prevYVal = prevCoin.total_volume || 1;
          }
      }

      const newTargetX = mapX(xVal);
      const newTargetY = mapY(yVal);
      
      const existing = existingParticleMap.get(coin.id);
      
      if (existing) {
        existing.coin = coin;
        existing.radius = mapRadius(radiusVal);
        existing.color = (coin.price_change_percentage_24h || 0) > 0 ? '#089981' : '#f23645';
        existing.targetX = newTargetX;
        existing.targetY = newTargetY;
        existing.trailStartX = prevCoin && prevXVal !== undefined ? mapX(prevXVal) : existing.x;
        existing.trailStartY = prevCoin && prevYVal !== undefined ? mapY(prevYVal) : existing.y;
        return existing;
      } else {
        if (!imageCache.current.has(coin.image)) {
          const img = new Image(); img.src = coin.image;
          imageCache.current.set(coin.image, img);
        }
        
        const trailStartX = newTargetX + (Math.random() - 0.5) * 30;
        const trailStartY = newTargetY + (Math.random() - 0.5) * 30;

        return {
          id: coin.id, x: trailStartX, y: trailStartY,
          vx: (Math.random() - 0.5) * 50, vy: (Math.random() - 0.5) * 50,
          startX: trailStartX, startY: trailStartY,
          targetX: newTargetX, targetY: newTargetY,
          trailStartX, trailStartY,
          animProgress: 0, radius: mapRadius(radiusVal),
          color: (coin.price_change_percentage_24h || 0) > 0 ? '#089981' : '#f23645',
          coin, trail: [], phase: Math.random() * Math.PI * 2,
        };
      }
    });
    particlesRef.current = newParticles;
  }, [coins, numCoins, chartMode, chartVersion, calculateMappings, dimensions]);

  // --- DRAW LOOP ---
  useEffect(() => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    
    let lastUpdateTime = Date.now();

    const drawRoundedRect = (x:number, y:number, w:number, h:number, r:number) => {
        if (w < 2 * r) r = w / 2; if (h < 2 * r) r = h / 2;
        ctx.beginPath(); ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    };

    animationLoopFn.current = () => {
        const now = Date.now();
        const delta = Math.min(0.05, (now - lastUpdateTime) / 1000);
        lastUpdateTime = now;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const particles = particlesRef.current;
        if (particles.length === 0) return;

        const mappings = calculateMappings();
        const zoom = zoomRef.current;

        // Draw Axes if mapped
        if (!isFreeMode && mappings) {
          const { pad, width, height, minX, maxX, minY, maxY } = mappings;
          ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
          ctx.lineWidth = 1; ctx.font = `bold ${10 * Math.max(1, zoom * 0.5)}px Inter`;
          ctx.fillStyle = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
          
          // Y-Axis (Volume)
          for (let i = 0; i <= 5; i++) {
            const val = Math.pow(10, Math.log10(minY) + i * (Math.log10(maxY) - Math.log10(minY)) / 5);
            const y = mappings.mapY(val);
            if (y > pad * 0.5 && y < height - pad * 0.5) {
              ctx.beginPath(); ctx.moveTo(mappings.mapX(minX) - 5, y); ctx.lineTo(mappings.mapX(maxX), y); ctx.stroke();
              ctx.fillText(`${formatCompact(val)}`, 15, y + 3);
            }
          }
          
          // X-Axis
          if (chartMode === 'performance') {
              for (let i = 0; i <= 10; i++) {
                const val = minX + i * (maxX - minX) / 10;
                const x = mappings.mapX(val);
                if (x > pad * 0.5 && x < width - pad * 0.5) {
                  ctx.beginPath(); ctx.moveTo(x, mappings.mapY(minY)); ctx.lineTo(x, mappings.mapY(maxY) + 5); ctx.stroke();
                  ctx.textAlign = 'center'; ctx.fillText(`${val.toFixed(1)}%`, x, height - pad + 15);
                }
              }
          } else {
              for (let i = 0; i <= 5; i++) {
                const val = Math.pow(10, Math.log10(minX) + i * (Math.log10(maxX) - Math.log10(minX)) / 5);
                const x = mappings.mapX(val);
                if (x > pad * 0.5 && x < width - pad * 0.5) {
                  ctx.beginPath(); ctx.moveTo(x, mappings.mapY(minY)); ctx.lineTo(x, mappings.mapY(maxY) + 5); ctx.stroke();
                  ctx.textAlign = 'center'; ctx.fillText(`${formatCompact(val)}`, x, height - pad + 15);
                }
              }
          }

          ctx.fillStyle = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'; ctx.font = 'bold 12px Inter'; ctx.textAlign = 'center';
          const xLabel = chartMode === 'performance' ? 'Variação de Preço 24h (%)' : 'Market Cap (Log)';
          ctx.fillText(xLabel, width / 2, height - 15);
          ctx.save(); ctx.translate(25, height / 2); ctx.rotate(-Math.PI / 2);
          ctx.fillText('Volume 24h (Log)', 0, 0); ctx.restore();
        }

        particles.forEach(p => {
            // Update Position
            if (p.isReturning && p.animProgress < 1) {
                // Slower lerp return as requested - Adjusted from 0.7 to 0.5 for smoother
                p.animProgress = Math.min(1, p.animProgress + delta * 0.5); 
                const easedProgress = easeOutCubic(p.animProgress);
                p.x = lerp(p.startX, p.targetX, easedProgress);
                p.y = lerp(p.startY, p.targetY, easedProgress);
                if (p.animProgress >= 1) p.isReturning = false;
            } else if (isFreeMode) {
                if (!p.isFixed) {
                    p.x += p.vx * delta; p.y += p.vy * delta;
                    if (p.x < p.radius || p.x > canvas.width - p.radius) p.vx *= -0.9;
                    if (p.y < p.radius || p.y > canvas.height - p.radius) p.vy *= -0.9;
                }
            } else {
                if (p.animProgress < 1) {
                    p.animProgress = Math.min(1, p.animProgress + delta * animSpeed);
                    const easedProgress = easeOutCubic(p.animProgress);
                    p.x = lerp(p.startX, p.targetX, easedProgress);
                    p.y = lerp(p.startY, p.targetY, easedProgress);
                } else {
                    p.x = p.targetX;
                    p.y = p.targetY;
                    p.startX = p.x; p.startY = p.y;
                }
            }

            p.trail.push({ x: p.x, y: p.y });
            while (p.trail.length > trailLength) { p.trail.shift(); }
            
            const isMatch = searchResultRef.current && p.id === searchResultRef.current.id;
            ctx.globalAlpha = (searchTerm && !isMatch) ? 0.05 : 1.0;
            
            if (p.trail.length > 1 && trailLength > 0) {
                ctx.beginPath(); ctx.moveTo(p.trail[0].x, p.trail[0].y);
                for (let i = 1; i < p.trail.length; i++) {
                    ctx.lineTo(p.trail[i].x, p.trail[i].y);
                }
                ctx.strokeStyle = `${p.color}80`; ctx.lineWidth = 1 * zoom; ctx.stroke();
            }
            
            const drawRadius = p.radius * (isFreeMode ? 1.8 : zoom);
            ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, drawRadius, 0, Math.PI * 2); ctx.clip();
            const img = imageCache.current.get(p.coin.image);
            if (img?.complete) { ctx.drawImage(img, p.x - drawRadius, p.y - drawRadius, drawRadius * 2, drawRadius * 2); } 
            else { ctx.fillStyle = p.color; ctx.fill(); }
            ctx.restore();
            
            ctx.globalAlpha = 1.0;
            if (selectedParticleRef.current?.id === p.id || hoveredParticleRef.current?.id === p.id) {
                ctx.beginPath(); ctx.arc(p.x, p.y, drawRadius + 4, 0, Math.PI * 2);
                ctx.strokeStyle = '#dd9933'; 
                ctx.lineWidth = selectedParticleRef.current?.id === p.id ? 4 : 2;
                ctx.stroke();
            }
        });

        const particleForTooltip = selectedParticleRef.current || hoveredParticleRef.current;
        if (particleForTooltip) {
            const p = particleForTooltip; 
            const drawRadius = p.radius * (isFreeMode ? 1.8 : zoom);
            const ttWidth = 280, ttHeight = 220; 
            
            let ttX = p.x + drawRadius + 15;
            let ttY = p.y - ttHeight / 2;
            
            if (ttX + ttWidth > canvas.width - 10) ttX = p.x - drawRadius - ttWidth - 15;
            ttX = clamp(ttX, 10, canvas.width - ttWidth - 10);
            ttY = clamp(ttY, 10, canvas.height - ttHeight - 10);
            
            ctx.fillStyle = isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)';
            ctx.strokeStyle = '#dd9933';
            ctx.lineWidth = 1;
            drawRoundedRect(ttX, ttY, ttWidth, ttHeight, 12);
            ctx.fill();
            ctx.stroke();

            const img = imageCache.current.get(p.coin.image);
            if (img?.complete) ctx.drawImage(img, ttX + 15, ttY + 20, 50, 50);
            
            ctx.font = 'bold 20px Inter'; ctx.fillStyle = isDark ? '#fff' : '#000'; ctx.textAlign = 'left';
            ctx.fillText(p.coin.name, ttX + 75, ttY + 40);
            ctx.font = 'bold 14px Inter'; ctx.fillStyle = '#dd9933';
            ctx.fillText(p.coin.symbol.toUpperCase(), ttX + 75, ttY + 62);

            const change = p.coin.price_change_percentage_24h || 0;
            const price = p.coin.current_price || 0;
            
            const dataRows = [
              { label: 'Preço', value: formatPrice(price), color: isDark ? '#fff' : '#000' },
              { label: '24h %', value: `${change.toFixed(2)}%`, color: change > 0 ? '#089981' : '#f23645' },
              { label: 'Volume', value: formatCompact(p.coin.total_volume) },
              { label: 'Mkt Cap', value: formatCompact(p.coin.market_cap) },
              { label: 'Máx 24h', value: formatPrice(p.coin.high_24h), color: '#089981' },
              { label: 'Mín 24h', value: formatPrice(p.coin.low_24h), color: '#f23645' },
              { label: 'ATH', value: formatPrice(p.coin.ath) },
              { label: 'ATL', value: formatPrice(p.coin.atl) },
            ];
            
            ctx.font = '12px Inter';
            dataRows.forEach((d, i) => {
              const col = i % 2;
              const row = Math.floor(i / 2);
              const xPos = ttX + 15 + col * (ttWidth/2);
              const yPos = ttY + 95 + row * 28;
              
              ctx.fillStyle = isDark ? '#999' : '#666';
              ctx.fillText(d.label, xPos, yPos);
              
              ctx.fillStyle = d.color || (isDark ? '#ccc' : '#333');
              ctx.font = 'bold 14px Inter';
              ctx.fillText(d.value, xPos, yPos + 14);
              ctx.font = '12px Inter';
            });
        }
    };
  }, [animSpeed, trailLength, isDark, calculateMappings, searchTerm, chartMode, isFreeMode, dimensions]);

  useEffect(() => {
    let frameId: number;
    const loop = () => {
      animationLoopFn.current?.();
      frameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frameId);
  }, []);

  // --- INTERACTION HANDLERS ---
  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    lastMousePosRef.current = { x: mouseX, y: mouseY };

    if (draggedParticleRef.current) {
        const p = draggedParticleRef.current;
        p.x = mouseX; p.y = mouseY;
        p.vx = 0; p.vy = 0;
        return;
    }
    
    if (isPanningRef.current) {
        const dx = e.clientX - panStartRef.current.clientX;
        const dy = e.clientY - panStartRef.current.clientY;
        panRef.current = { x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy };
        return;
    }
    
    let found: Particle | null = null;
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        const drawRadius = p.radius * (isFreeMode ? 1.8 : zoomRef.current);
        const hitRadius = Math.max(drawRadius * 1.4, 16); // Hitbox matches visual + margin
        
        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        
        if (dx * dx + dy * dy < hitRadius * hitRadius) {
            found = p;
            break;
        }
    }
    setHoveredParticle(found);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (hoveredParticleRef.current && isFreeMode) {
        draggedParticleRef.current = hoveredParticleRef.current;
        draggedParticleRef.current.isFixed = true;
    } else {
        isPanningRef.current = true;
        panStartRef.current = { clientX: e.clientX, clientY: e.clientY, panX: panRef.current.x, panY: panRef.current.y };
    }
    setSelectedParticle(hoveredParticleRef.current);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (draggedParticleRef.current) {
        draggedParticleRef.current.isFixed = false;
        draggedParticleRef.current = null;
    }
    isPanningRef.current = false;
  };

  const handleMouseLeave = () => {
    setHoveredParticle(null);
    isPanningRef.current = false;
    if (draggedParticleRef.current) {
        draggedParticleRef.current.isFixed = false;
        draggedParticleRef.current = null;
    }
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
    zoomRef.current = clamp(newZoom, 0.2, 8.0);
    
    const zoomRatio = zoomRef.current / oldZoom;
    
    panRef.current.x = mouseX - (mouseX - panRef.current.x) * zoomRatio;
    panRef.current.y = mouseY - (mouseY - panRef.current.y) * zoomRatio;
  };
  
  return (
    <div ref={containerRef} className="fixed inset-0 z-[2000] bg-white dark:bg-[#0b0f14] text-gray-900 dark:text-white flex flex-col">
      <div className="flex justify-between items-start p-4 z-10 bg-white/80 dark:bg-black/50 backdrop-blur-sm border-b border-gray-200 dark:border-white/10 shrink-0">
        <div className="flex items-center gap-4">
            <Wind size={28} className="text-[#dd9933]" />
            <div><h3 className="text-xl font-black uppercase tracking-wider">Market WindSwarm</h3><p className="text-xs text-gray-500 dark:text-gray-400 font-bold">{status === 'demo' ? 'MODO DEMO' : 'Live Market Data'}</p></div>
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
              <div className="flex justify-between items-center"><label className="text-xs font-bold flex items-center gap-2"><Atom size={14} /> Modo Livre</label><button onClick={()=> setIsFreeMode(!isFreeMode)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isFreeMode ? 'bg-[#dd9933]' : 'bg-gray-200 dark:bg-tech-700'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isFreeMode ? 'translate-x-6' : 'translate-x-1'}`}/></button></div>
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
              <div className="space-y-2"><label className="text-xs font-bold flex items-center gap-2"><FastForward size={14} /> Flutuação</label><input type="range" min="0.1" max="5" step="0.1" value={animSpeed} onChange={e => setAnimSpeed(parseFloat(e.target.value))} className="w-full accent-[#dd9933]" /></div>
              <div className="space-y-2"><label className="text-xs font-bold flex items-center gap-2"><Droplets size={14} /> Rastro</label><input type="range" min="0" max="100" step="1" value={trailLength} onChange={e => setTrailLength(parseInt(e.target.value))} className="w-full accent-[#dd9933]" /></div>
          </div>
      )}

      <div className="flex-1 w-full h-full relative">
        <canvas ref={canvasRef} onMouseMove={handleMouseMove} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave} onWheel={handleWheel} className="absolute inset-0 w-full h-full" />
      </div>
    </div>
  );
};

export default MarketWindSwarm;
