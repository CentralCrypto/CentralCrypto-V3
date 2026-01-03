import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ApiCoin, Language } from '../../../types';
import { Loader2, Search, XCircle, Settings, Droplets, FastForward, Activity, Wind, X } from 'lucide-react';
import { fetchTopCoins } from '../services/api';

// --- TYPES ---
interface Particle {
  id: string;
  x: number; y: number;
  startX: number; startY: number; 
  targetX: number; targetY: number;
  animProgress: number;
  trailStartX: number;
  trailStartY: number;
  radius: number;
  color: string;
  coin: ApiCoin;
  trail: { x: number, y: number }[];
  phase: number; // For oscillation
}
type YAxisMode = 'total_volume' | 'market_cap';
type Status = 'loading' | 'running' | 'demo' | 'error';
interface MarketWindSwarmProps { language: Language; onClose: () => void; }

// --- HELPERS ---
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(val, max));
// @fix(46): `toFixed` was missing an argument and `$` prefix was inconsistent.
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

// --- MAIN COMPONENT ---
const MarketWindSwarm = ({ language, onClose }: MarketWindSwarmProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const imageCache = useRef(new Map<string, HTMLImageElement>());
  const animationLoopFn = useRef<() => void>();
  
  // State
  const [status, setStatus] = useState<Status>('loading');
  const [coins, setCoins] = useState<ApiCoin[]>([]);
  const previousCoinsRef = useRef<ApiCoin[]>([]);
  
  const [hoveredParticle, setHoveredParticle] = useState<Particle | null>(null);
  const [selectedParticle, setSelectedParticle] = useState<Particle | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [numCoins, setNumCoins] = useState(150);
  const [animSpeed, setAnimSpeed] = useState(2.0);
  const [yAxisMode, setYAxisMode] = useState<YAxisMode>('total_volume');
  const [trailLength, setTrailLength] = useState(15);
  
  const [chartVersion, setChartVersion] = useState(0);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  
  // Interaction Refs
  const zoomRef = useRef(1.0);
  const panRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ clientX: 0, clientY: 0, panX: 0, panY: 0 });
  const searchResultRef = useRef<Particle | null>(null);
  
  const hoveredParticleRef = useRef(hoveredParticle);
  hoveredParticleRef.current = hoveredParticle;
  const selectedParticleRef = useRef(selectedParticle);
  selectedParticleRef.current = selectedParticle;

  // --- SEARCH EFFECT ---
  useEffect(() => {
    if (!searchTerm) {
      searchResultRef.current = null;
      return;
    }
    const found = particlesRef.current.find(p => 
      p.coin.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.coin.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    );
    searchResultRef.current = found || null;
    if (found) setSelectedParticle(found);
  }, [searchTerm]);

  // --- DATA LOADING ---
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
  
  // --- MAPPING LOGIC (with zoom/pan) ---
  const calculateMappings = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || coins.length === 0) return null;
    
    const zoom = zoomRef.current;
    const pan = panRef.current;
    const { width, height } = canvas;
    const pad = 80;

    const topCoins = coins.slice(0, numCoins);
    
    const mCaps = topCoins.map(c => c.market_cap || 1).filter(mc => mc > 0);
    if (mCaps.length === 0) return null;
    
    const minLogMc = Math.log10(Math.min(...mCaps));
    const maxLogMc = Math.log10(Math.max(...mCaps));
    
    const xValues = topCoins.map(p => p.price_change_percentage_24h || 0);
    const yValues = topCoins.map(p => p[yAxisMode] || 1);
    const minX = Math.min(...xValues), maxX = Math.max(...xValues);
    const minY = Math.min(...yValues), maxY = Math.max(...yValues);
    // @fix(140, 141): Removed redundant check as `yAxisMode` can't be 'price_change_percentage_24h'.
    const logMinY = (minY > 0) ? Math.log10(minY) : 0;
    const logMaxY = (maxY > 0) ? Math.log10(maxY) : 0;

    const baseMapX = (v: number) => pad + (v - minX) / (maxX - minX || 1) * (width - pad * 2);
    const baseMapY = (v: number) => {
        if (v <= 0) return height - pad;
        return height - pad - (Math.log10(v) - logMinY) / (logMaxY - logMinY || 1) * (height - pad * 2);
    };

    const mapX = (v: number) => pan.x + (baseMapX(v) - width / 2) * zoom + width / 2;
    const mapY = (v: number) => pan.y + (baseMapY(v) - height / 2) * zoom + height / 2;
    
    const mapRadius = (mc: number) => {
        if (mc <= 0) return 8 * zoom;
        return (8 + (Math.log10(mc) - minLogMc) / (maxLogMc - minLogMc || 1) * 42) * zoom;
    };
    
    return { mapX, mapY, mapRadius, topCoins, minX, maxX, minY, maxY, pad, width, height };
  }, [coins, numCoins, yAxisMode, chartVersion]);


  // --- PARTICLE MANAGEMENT ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || coins.length === 0 || canvas.width === 0) return;

    const mappings = calculateMappings();
    if (!mappings) return;
    const { mapX, mapY, mapRadius, topCoins } = mappings;

    const existingParticleMap = new Map(particlesRef.current.map(p => [p.id, p]));
    const prevCoinMap = new Map(previousCoinsRef.current.map(c => [c.id, c]));

    const newParticles = topCoins.map(coin => {
      const existing = existingParticleMap.get(coin.id);
      const newTargetX = mapX(coin.price_change_percentage_24h || 0);
      const newTargetY = mapY(coin[yAxisMode] || 1);
      
      const prevCoin = prevCoinMap.get(coin.id);
      const trailStartX = prevCoin ? mapX(prevCoin.price_change_percentage_24h || 0) : newTargetX;
      const trailStartY = prevCoin ? mapY(prevCoin[yAxisMode] || 1) : newTargetY;

      if (existing) {
        existing.coin = coin;
        existing.radius = mapRadius(coin.market_cap);
        existing.color = (coin.price_change_percentage_24h || 0) > 0 ? '#089981' : '#f23645';
        existing.targetX = newTargetX;
        existing.targetY = newTargetY;
        existing.trailStartX = trailStartX;
        existing.trailStartY = trailStartY;
        return existing;
      } else {
        if (!imageCache.current.has(coin.image)) {
          const img = new Image(); img.src = coin.image;
          imageCache.current.set(coin.image, img);
        }
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        return {
          id: coin.id, x: centerX, y: centerY, startX: centerX, startY: centerY,
          targetX: newTargetX, targetY: newTargetY, trailStartX: newTargetX, trailStartY: newTargetY,
          animProgress: 0, radius: mapRadius(coin.market_cap),
          color: (coin.price_change_percentage_24h || 0) > 0 ? '#089981' : '#f23645',
          coin, trail: [], phase: Math.random() * Math.PI * 2,
        };
      }
    });
    particlesRef.current = newParticles;
  }, [coins, numCoins, yAxisMode, chartVersion, calculateMappings]);

  // --- EFFECT TO UPDATE DRAWING LOGIC ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    
    let lastUpdateTime = Date.now();

    const drawRoundedRect = (x:number, y:number, w:number, h:number, r:number) => {
        if (w < 2 * r) r = w / 2; if (h < 2 * r) r = h / 2;
        ctx.beginPath(); ctx.moveTo(x+r, y); ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r);
        ctx.arcTo(x, y+h, x, y, r); ctx.arcTo(x, y, x+w, y, r); ctx.closePath();
    };

    animationLoopFn.current = () => {
        const now = Date.now();
        const delta = Math.min(0.05, (now - lastUpdateTime) / 1000);
        lastUpdateTime = now;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const particles = particlesRef.current;
        if (particles.length === 0) return;

        const mappings = calculateMappings();
        if (!mappings) return;
        const { pad, width, height, minX, maxX, minY, maxY } = mappings;

        const zoom = zoomRef.current;
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1; ctx.font = `bold ${10 * Math.max(1, zoom * 0.5)}px Inter`;
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
        for (let i = 0; i <= 5; i++) {
          const val = Math.pow(10, Math.log10(minY) + i * (Math.log10(maxY) - Math.log10(minY)) / 5);
          const y = mappings.mapY(val);
          if (y > pad * 0.5 && y < height - pad * 0.5) {
            ctx.beginPath(); ctx.moveTo(mappings.mapX(minX) - 5, y); ctx.lineTo(mappings.mapX(maxX), y); ctx.stroke();
            ctx.fillText(`$${formatCompact(val)}`, 15, y + 3);
          }
        }
        for (let i = 0; i <= 10; i++) {
          const val = minX + i * (maxX - minX) / 10;
          const x = mappings.mapX(val);
          if (x > pad * 0.5 && x < width - pad * 0.5) {
            ctx.beginPath(); ctx.moveTo(x, mappings.mapY(minY)); ctx.lineTo(x, mappings.mapY(maxY) + 5); ctx.stroke();
            ctx.textAlign = 'center'; ctx.fillText(`${val.toFixed(1)}%`, x, height - pad + 15);
          }
        }

        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'; ctx.font = 'bold 12px Inter'; ctx.textAlign = 'center';
        ctx.fillText('Variação de Preço 24h (%)', width / 2, height - 15);
        ctx.save(); ctx.translate(25, height / 2); ctx.rotate(-Math.PI / 2);
        const yLabel = yAxisMode === 'total_volume' ? 'Volume 24h (Log)' : 'Market Cap (Log)';
        ctx.fillText(yLabel, 0, 0); ctx.restore();

        particles.forEach(p => {
            const isMatch = searchResultRef.current && p.id === searchResultRef.current.id;
            ctx.globalAlpha = (searchTerm && !isMatch) ? 0.05 : 1.0;

            if (p.animProgress < 1) {
                p.animProgress = Math.min(1, p.animProgress + delta * 2.5);
                const easedProgress = easeOutCubic(p.animProgress);
                p.x = lerp(p.startX, p.targetX, easedProgress);
                p.y = lerp(p.startY, p.targetY, easedProgress);
            } else {
                p.phase += delta * animSpeed;
                const t = (Math.sin(p.phase) + 1) / 2;
                p.x = lerp(p.trailStartX, p.targetX, t);
                p.y = lerp(p.trailStartY, p.targetY, t);
            }

            if (p.animProgress >=1 && (p.trailStartX !== p.targetX || p.trailStartY !== p.targetY)) {
                ctx.beginPath(); ctx.moveTo(p.trailStartX, p.trailStartY); ctx.lineTo(p.targetX, p.targetY);
                const baseColor = p.color === '#089981' ? '8, 153, 129' : '242, 54, 69';
                ctx.strokeStyle = `rgba(${baseColor}, 0.2)`; ctx.lineWidth = 1 * zoom; ctx.stroke();
            }

            p.trail.push({ x: p.x, y: p.y });
            while (p.trail.length > trailLength) { p.trail.shift(); }

            if (p.trail.length > 1 && trailLength > 0) {
                const baseColor = p.color === '#089981' ? '8, 153, 129' : '242, 54, 69';
                for (let i = 1; i < p.trail.length; i++) {
                    const alpha = Math.pow(i / p.trail.length, 2) * 0.7;
                    ctx.beginPath(); ctx.moveTo(p.trail[i-1].x, p.trail[i-1].y); ctx.lineTo(p.trail[i].x, p.trail[i].y);
                    ctx.strokeStyle = `rgba(${baseColor}, ${alpha})`; ctx.lineWidth = 2.5 * zoom; ctx.stroke();
                }
            }

            ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.clip();
            const img = imageCache.current.get(p.coin.image);
            if (img?.complete) { ctx.drawImage(img, p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2); } 
            else { ctx.fillStyle = p.color; ctx.fill(); }
            ctx.restore();
            
            ctx.globalAlpha = 1.0;
            if (selectedParticleRef.current?.id === p.id || hoveredParticleRef.current?.id === p.id) {
                ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.strokeStyle = '#dd9933'; ctx.lineWidth = selectedParticleRef.current?.id === p.id ? 4 * zoom : 2 * zoom; ctx.stroke();
            }
        });

        const particleForTooltip = selectedParticleRef.current || hoveredParticleRef.current;
        if (particleForTooltip) {
            const p = particleForTooltip; const ttWidth = 240, ttHeight = 145;
            let ttX = p.x + p.radius + 15; let ttY = p.y - ttHeight / 2;
            if (ttX + ttWidth > width - 10) ttX = p.x - p.radius - ttWidth - 15;
            ttX = clamp(ttX, 10, width - ttWidth - 10); ttY = clamp(ttY, 10, height - ttHeight - 10);
            
            ctx.fillStyle = isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)'; ctx.strokeStyle = '#dd9933'; ctx.lineWidth = 1;
            drawRoundedRect(ttX, ttY, ttWidth, ttHeight, 12); ctx.fill(); ctx.stroke();

            const img = imageCache.current.get(p.coin.image);
            if (img?.complete) ctx.drawImage(img, ttX + 15, ttY + 15, 40, 40);
            
            ctx.font = 'bold 16px Inter'; ctx.fillStyle = isDark ? '#fff' : '#000'; ctx.textAlign = 'left';
            ctx.fillText(p.coin.name, ttX + 65, ttY + 30);
            ctx.font = 'bold 12px Inter'; ctx.fillStyle = '#dd9933'; ctx.fillText(p.coin.symbol, ttX + 65, ttY + 48);

            const change = p.coin.price_change_percentage_24h || 0; const price = p.coin.current_price || 0;
            const data = [ { label: 'Preço', value: `$${price.toLocaleString()}`, color: isDark ? '#fff' : '#000' }, { label: '24h %', value: `${change.toFixed(2)}%`, color: change > 0 ? '#089981' : '#f23645' }, { label: 'Volume', value: formatCompact(p.coin.total_volume), color: isDark ? '#ccc' : '#333' }, { label: 'Mkt Cap', value: formatCompact(p.coin.market_cap), color: isDark ? '#ccc' : '#333' } ];
            
            ctx.font = '12px Inter';
            data.forEach((d, i) => { const yPos = ttY + 75 + (i * 18); ctx.fillStyle = isDark ? '#999' : '#666'; ctx.fillText(d.label, ttX + 15, yPos); ctx.fillStyle = d.color; ctx.font = 'bold 12px Inter'; ctx.fillText(d.value, ttX + 90, yPos); ctx.font = '12px Inter'; });
        }
    };
  }, [animSpeed, trailLength, isDark, calculateMappings, searchTerm, yAxisMode]);

  // --- EFFECT FOR SETUP & RUNNING THE ANIMATION LOOP ---
  useEffect(() => {
    const canvas = canvasRef.current; const container = containerRef.current;
    if (!canvas || !container) return;
    const resizeObserver = new ResizeObserver(entries => { for (const entry of entries) { const { width, height } = entry.contentRect; canvas.width = width; canvas.height = height; setChartVersion(v => v + 1); } });
    resizeObserver.observe(container);
    const { width, height } = container.getBoundingClientRect();
    if(width > 0 && height > 0) { canvas.width = width; canvas.height = height; }
    
    let frameId: number;
    const loop = () => { animationLoopFn.current?.(); frameId = requestAnimationFrame(loop); };
    frameId = requestAnimationFrame(loop);
    
    return () => { cancelAnimationFrame(frameId); resizeObserver.disconnect(); };
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current; if (!canvas) return;
    if (isPanningRef.current) { const dx = e.clientX - panStartRef.current.clientX; const dy = e.clientY - panStartRef.current.clientY; panRef.current = { x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy, }; setChartVersion(v => v + 1); return; }
    
    const rect = canvas.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top;
    let found: Particle | null = null;
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i]; const dx = p.x - mouseX; const dy = p.y - mouseY;
        const hitRadius = Math.max(p.radius, 12); 
        if (dx * dx + dy * dy < hitRadius * hitRadius) { found = p; break; }
    }
    setHoveredParticle(found);
  };

  const handleMouseDown = (e: React.MouseEvent) => { if (e.button !== 0) return; isPanningRef.current = true; panStartRef.current = { clientX: e.clientX, clientY: e.clientY, panX: panRef.current.x, panY: panRef.current.y }; };
  const handleWheel = (e: React.WheelEvent) => {
    const canvas = canvasRef.current; if (!canvas) return; e.preventDefault();
    const zoomSpeed = 0.1; const direction = e.deltaY < 0 ? 1 : -1; const newZoom = clamp(zoomRef.current * (1 + direction * zoomSpeed), 0.2, 10);
    const rect = canvas.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top;
    const worldX = (mouseX - panRef.current.x - canvas.width / 2) / zoomRef.current + canvas.width / 2;
    const worldY = (mouseY - panRef.current.y - canvas.height / 2) / zoomRef.current + canvas.height / 2;
    panRef.current.x = mouseX - (worldX - canvas.width / 2) * newZoom - canvas.width / 2;
    panRef.current.y = mouseY - (worldY - canvas.height / 2) * newZoom - canvas.height / 2;
    zoomRef.current = newZoom; setChartVersion(v => v + 1);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const dx = e.clientX - panStartRef.current.clientX; const dy = e.clientY - panStartRef.current.clientY;
    if (isPanningRef.current && Math.sqrt(dx * dx + dy * dy) < 5) {
        if (hoveredParticleRef.current) setSelectedParticle(p => p?.id === hoveredParticleRef.current?.id ? null : hoveredParticleRef.current);
        else setSelectedParticle(null);
    }
    isPanningRef.current = false;
  };

  const handleMouseLeave = () => { isPanningRef.current = false; setHoveredParticle(null); }

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
          <div className="absolute top-24 right-4 bg-white/90 dark:bg-black/80 p-4 rounded-lg border border-gray-200 dark:border-white/10 backdrop-blur-md w-64 z-20 space-y-4 animate-in fade-in slide-in-from-top-4 shadow-xl">
              <div className="space-y-2"><label className="text-xs font-bold flex items-center gap-2"><FastForward size={14} /> Flutuação</label><input type="range" min="0.1" max="3" step="0.1" value={animSpeed} onChange={e => setAnimSpeed(parseFloat(e.target.value))} className="w-full accent-[#dd9933]" /></div>
              <div className="space-y-2"><label className="text-xs font-bold flex items-center gap-2"><Droplets size={14} /> Rastro</label><input type="range" min="0" max="50" step="1" value={trailLength} onChange={e => setTrailLength(parseInt(e.target.value))} className="w-full accent-[#dd9933]" /></div>
              <div className="space-y-2"><label className="text-xs font-bold flex items-center gap-2"><Activity size={14} /> Eixo Y (Log)</label>
                  <select value={yAxisMode} onChange={e => setYAxisMode(e.target.value as YAxisMode)} className="w-full bg-gray-100 dark:bg-tech-800 text-gray-900 dark:text-gray-100 p-2 rounded text-xs border border-gray-200 dark:border-white/10 outline-none">
                      <option value="total_volume">Volume 24h</option><option value="market_cap">Market Cap</option>
                  </select>
              </div>
          </div>
      )}

      <div className="flex-1 w-full h-full relative">
        <canvas 
            ref={canvasRef} 
            onMouseMove={handleMouseMove} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave} onWheel={handleWheel}
            className="absolute inset-0 w-full h-full" 
        />
      </div>
    </div>
  );
};

export default MarketWindSwarm;