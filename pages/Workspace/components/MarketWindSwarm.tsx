import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ApiCoin, Language } from '../../../types';
import { Loader2, Search, XCircle, Settings, Droplets, FastForward, Activity, Wind, X } from 'lucide-react';
import { fetchTopCoins } from '../services/api';

// --- TYPES ---
interface Particle {
  id: string;
  x: number; y: number;
  vx: number; vy: number; // For physics
  startX: number; startY: number; // For lerp animation
  targetX: number; targetY: number;
  animProgress: number;
  radius: number;
  color: string;
  coin: ApiCoin;
  trail: { x: number, y: number }[];
}
type YAxisMode = 'total_volume' | 'market_cap' | 'price_change_percentage_24h';
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
    if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return n.toFixed(0);
};

const MarketWindSwarm = ({ language, onClose }: MarketWindSwarmProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const imageCache = useRef(new Map<string, HTMLImageElement>());
  const animationFrameId = useRef<number>();
  
  const [status, setStatus] = useState<Status>('loading');
  const [coins, setCoins] = useState<ApiCoin[]>([]);
  
  const [hoveredParticle, setHoveredParticle] = useState<Particle | null>(null);
  const [selectedParticle, setSelectedParticle] = useState<Particle | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [numCoins, setNumCoins] = useState(150);
  const [animSpeed, setAnimSpeed] = useState(0.8);
  const [yAxisMode, setYAxisMode] = useState<YAxisMode>('total_volume');
  const [trailLength, setTrailLength] = useState(25);
  
  const [chartVersion, setChartVersion] = useState(0);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  
  const lastUpdateTime = useRef<number>(Date.now());

  // --- MAPPING LOGIC (needs to be stable) ---
  const getParticleMappings = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || coins.length === 0) return null;
    
    const { width, height } = canvas;
    const pad = 80;

    const topCoins = coins.slice(0, numCoins);
    
    const mCaps = topCoins.map(c => c.market_cap || 1).filter(mc => mc > 0);
    const minLogMc = Math.log10(Math.min(...mCaps));
    const maxLogMc = Math.log10(Math.max(...mCaps));
    
    const xValues = topCoins.map(p => p.price_change_percentage_24h || 0);
    const yValues = topCoins.map(p => p[yAxisMode] || 1);
    const minX = Math.min(...xValues), maxX = Math.max(...xValues);
    const minY = Math.min(...yValues), maxY = Math.max(...yValues);
    // FIX: Guard against taking log of negative numbers for price change percentage
    const logMinY = (yAxisMode !== 'price_change_percentage_24h' && minY > 0) ? Math.log10(minY) : 0;
    const logMaxY = (yAxisMode !== 'price_change_percentage_24h' && maxY > 0) ? Math.log10(maxY) : 0;
    
    const mapX = (v: number) => pad + (v - minX) / (maxX - minX || 1) * (width - pad * 2);
    const mapY = (v: number) => {
        if (yAxisMode === 'price_change_percentage_24h') {
            return height - pad - (v - minY) / (maxY - minY || 1) * (height - pad * 2);
        }
        return height - pad - (Math.log10(v) - logMinY) / (logMaxY - logMinY || 1) * (height - pad * 2);
    };
    const mapRadius = (mc: number) => 8 + (Math.log10(mc || 1) - minLogMc) / (maxLogMc - minLogMc || 1) * 42;

    // FIX: Add pad, width, and height to the returned object so they can be destructured later.
    return { mapX, mapY, mapRadius, topCoins, minX, maxX, minY, maxY, logMinY, logMaxY, pad, width, height };
  }, [coins, numCoins, yAxisMode, chartVersion]);


  // --- DATA & PARTICLE UPDATE ---
  const updateParticlesFromData = useCallback((data: ApiCoin[]) => {
      const mappings = getParticleMappings();
      if (!mappings) return;

      const { mapX, mapY, mapRadius } = mappings;
      const coinMap = new Map(data.map(c => [c.id, c]));

      particlesRef.current.forEach(p => {
          const newCoinData = coinMap.get(p.id);
          if (newCoinData) {
              p.startX = p.x;
              p.startY = p.y;
              p.targetX = mapX(newCoinData.price_change_percentage_24h || 0);
              p.targetY = mapY(newCoinData[yAxisMode] || 1);
              p.coin = newCoinData;
              p.radius = mapRadius(newCoinData.market_cap);
              p.color = (newCoinData.price_change_percentage_24h || 0) > 0 ? '#089981' : '#f23645';
              p.animProgress = 0;
          }
      });
  }, [getParticleMappings, yAxisMode]);

  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) setStatus('loading');
    try {
      const data = await fetchTopCoins({ force: true });
      if (data && data.length > 0) {
        if (isInitial || particlesRef.current.length === 0) {
          setCoins(data);
        } else {
          updateParticlesFromData(data);
        }
        setStatus('running');
      } else if (isInitial) { setStatus('demo'); }
    } catch (error) {
      if (isInitial) setStatus('error');
    }
  }, [updateParticlesFromData]);

  useEffect(() => {
    loadData(true);
    const interval = setInterval(() => loadData(false), 60000);
    const observer = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => { clearInterval(interval); observer.disconnect(); };
  }, [loadData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || coins.length === 0) return;

    const mappings = getParticleMappings();
    if (!mappings) return;
    const { mapX, mapY, mapRadius, topCoins } = mappings;

    const existingParticles = new Map(particlesRef.current.map(p => [p.id, p]));
    particlesRef.current = topCoins.map(coin => {
      const existing = existingParticles.get(coin.id);
      if (existing) return existing; 

      if (!imageCache.current.has(coin.image)) {
          const img = new Image(); img.src = coin.image;
          imageCache.current.set(coin.image, img);
      }
      
      const targetX = mapX(coin.price_change_percentage_24h || 0);
      const targetY = mapY(coin[yAxisMode] || 1);

      return {
        id: coin.id,
        x: targetX, y: targetY,
        vx: 0, vy: 0,
        startX: targetX, startY: targetY,
        targetX, targetY,
        animProgress: 1,
        radius: mapRadius(coin.market_cap),
        color: (coin.price_change_percentage_24h || 0) > 0 ? '#089981' : '#f23645',
        coin,
        trail: [],
      };
    });
  }, [coins, numCoins, yAxisMode, chartVersion, getParticleMappings]);

  // --- ANIMATION & DRAWING ---
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const now = Date.now();
    const delta = Math.min(0.05, (now - lastUpdateTime.current) / 1000);
    lastUpdateTime.current = now;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const particles = particlesRef.current;
    if (particles.length === 0) {
      animationFrameId.current = requestAnimationFrame(animate); return;
    }

    const mappings = getParticleMappings();
    if (!mappings) {
        animationFrameId.current = requestAnimationFrame(animate); return;
    }
    const { pad, width, height, minX, maxX, minY, maxY, logMinY, logMaxY } = mappings;

    // --- Draw Axes ---
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1; ctx.font = 'bold 10px Inter';
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
    for (let i = 0; i <= 5; i++) {
      const y = pad + i * (height - pad * 2) / 5;
      ctx.beginPath(); ctx.moveTo(pad - 5, y); ctx.lineTo(width - pad, y); ctx.stroke();
      const val = (yAxisMode === 'price_change_percentage_24h') ? maxY - i * (maxY - minY) / 5 : Math.pow(10, logMaxY - i * (logMaxY - logMinY) / 5);
      ctx.fillText(yAxisMode === 'price_change_percentage_24h' ? `${val.toFixed(1)}%` : `$${formatCompact(val)}`, 15, y + 3);
    }
    for (let i = 0; i <= 10; i++) {
      const x = pad + i * (width - pad * 2) / 10;
      ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, height - pad + 5); ctx.stroke();
      const val = minX + i * (maxX - minX) / 10;
      ctx.textAlign = 'center'; ctx.fillText(`${val.toFixed(1)}%`, x, height - pad + 15);
    }
    
    // --- Update & Draw Particles/Trails ---
    particles.forEach(p => {
        // --- ANIMATION ---
        if (p.animProgress < 1) { // Mode 1: Lerp Transition
            p.animProgress = Math.min(1, p.animProgress + delta * animSpeed);
            const easedProgress = easeOutCubic(p.animProgress);
            p.x = lerp(p.startX, p.targetX, easedProgress);
            p.y = lerp(p.startY, p.targetY, easedProgress);
            p.vx = 0; p.vy = 0;
        } else { // Mode 2: Physics Wind
            const dx = p.targetX - p.x; const dy = p.targetY - p.y;
            p.vx += dx * 0.005; p.vy += dy * 0.005;
            p.vx += (Math.random() - 0.5) * 0.2; p.vy += (Math.random() - 0.5) * 0.2;
            p.vx *= 0.94; p.vy *= 0.94;
            p.x += p.vx; p.y += p.vy;
        }

        // --- TRAIL ---
        p.trail.push({ x: p.x, y: p.y });
        while (p.trail.length > trailLength) { p.trail.shift(); }

        // Draw Trail
        if (p.trail.length > 1) {
            ctx.beginPath(); ctx.moveTo(p.trail[0].x, p.trail[0].y);
            for (let i = 1; i < p.trail.length; i++) {
                const alpha = (i / p.trail.length) * 0.3;
                ctx.strokeStyle = `rgba(221, 153, 51, ${alpha})`;
                ctx.lineTo(p.trail[i].x, p.trail[i].y);
            }
            ctx.lineWidth = 1.5; ctx.stroke();
        }

        // Draw Bubble
        ctx.save();
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.clip();
        const img = imageCache.current.get(p.coin.image);
        if (img && img.complete) { ctx.drawImage(img, p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2); } 
        else { ctx.fillStyle = p.color; ctx.fill(); }
        ctx.restore();
        if (selectedParticle?.id === p.id || hoveredParticle?.id === p.id) {
            ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.strokeStyle = '#dd9933'; ctx.lineWidth = selectedParticle?.id === p.id ? 4 : 2;
            ctx.stroke();
        }
    });

    // --- Draw Tooltip ---
    if (hoveredParticle && !selectedParticle) {
        const p = hoveredParticle; const ttWidth = 200, ttHeight = 100;
        let ttX = p.x - ttWidth / 2; let ttY = p.y - p.radius - ttHeight - 10;
        if (ttY < 10) ttY = p.y + p.radius + 10;
        ttX = clamp(ttX, 10, width - ttWidth - 10);
        
        ctx.fillStyle = isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)'; ctx.strokeStyle = '#dd9933'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(ttX, ttY, ttWidth, ttHeight, 8); ctx.fill(); ctx.stroke();
        ctx.font = 'bold 14px Inter'; ctx.fillStyle = isDark ? '#fff' : '#000'; ctx.textAlign = 'left';
        ctx.fillText(p.coin.name, ttX + 10, ttY + 20);
        ctx.font = '12px Inter'; ctx.fillStyle = isDark ? '#ccc' : '#333';
        ctx.fillText(`$${p.coin.current_price.toLocaleString()}`, ttX + 10, ttY + 40);
        const change = p.coin.price_change_percentage_24h || 0;
        ctx.fillStyle = change > 0 ? '#089981' : '#f23645';
        ctx.fillText(`${change.toFixed(2)}%`, ttX + 10, ttY + 58);
        ctx.fillStyle = isDark ? '#ccc' : '#333';
        ctx.fillText(`M.Cap: $${formatCompact(p.coin.market_cap)}`, ttX + 10, ttY + 76);
    }

    animationFrameId.current = requestAnimationFrame(animate);
  }, [animSpeed, selectedParticle, hoveredParticle, yAxisMode, isDark, getParticleMappings, trailLength]);

  // --- SETUP & RESIZE ---
  useEffect(() => {
    lastUpdateTime.current = Date.now();
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      canvas.width = width; canvas.height = height;
      setChartVersion(v => v + 1);
    });
    resizeObserver.observe(container);
    animationFrameId.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      resizeObserver.disconnect();
    };
  }, [animate]);

  // --- INTERACTIVITY ---
  const handleMouseMove = (e: React.MouseEvent) => {
      const canvas = canvasRef.current; if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      let foundParticle: Particle | null = null;
      for (const p of particlesRef.current) {
          const dx = p.x - pos.x; const dy = p.y - pos.y;
          if (dx * dx + dy * dy < p.radius * p.radius) { foundParticle = p; break; }
      }
      setHoveredParticle(foundParticle);
  };

  const handleClick = () => { setSelectedParticle(hoveredParticle); setSearchTerm(''); };

  return (
    <div ref={containerRef} className="fixed inset-0 z-[2000] bg-white dark:bg-[#0b0f14] text-gray-900 dark:text-white flex flex-col">
      {/* Top Controls */}
      <div className="flex justify-between items-start p-4 z-10 bg-white/80 dark:bg-black/50 backdrop-blur-sm border-b border-gray-200 dark:border-white/10 shrink-0">
        <div className="flex items-center gap-4">
            <Wind size={28} className="text-[#dd9933]" />
            <div><h3 className="text-xl font-black uppercase tracking-wider">CentralCrypto WindSwarm</h3><p className="text-xs text-gray-500 dark:text-gray-400 font-bold">{status === 'demo' ? 'MODO DEMO' : 'Live Market Data'}</p></div>
            <div className="w-px h-8 bg-gray-200 dark:bg-white/10 mx-4"></div>
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-black/50 p-2 rounded-lg border border-gray-200 dark:border-white/10">
                <Search size={16} className="text-gray-400" /><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar ativo..." className="bg-transparent outline-none text-sm w-48 text-gray-900 dark:text-white" />
                {searchTerm && <button onClick={() => { setSearchTerm(''); setSelectedParticle(null); }}><XCircle size={16} className="text-gray-500 hover:text-white" /></button>}
            </div>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={() => setSettingsOpen(!settingsOpen)} className={`p-3 rounded-lg border transition-colors backdrop-blur-sm ${settingsOpen ? 'bg-[#dd9933] text-black border-[#dd9933]' : 'bg-gray-100 dark:bg-black/50 border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10'}`}><Settings size={20} /></button>
            <button onClick={onClose} className="p-3 bg-gray-100 dark:bg-black/50 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-red-500/10 text-gray-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Close"><X size={20} /></button>
        </div>
      </div>
      
      {settingsOpen && (
          <div className="absolute top-24 right-4 bg-white/90 dark:bg-black/80 p-4 rounded-lg border border-gray-200 dark:border-white/10 backdrop-blur-md w-64 z-20 space-y-4 animate-in fade-in slide-in-from-top-4 shadow-xl">
              <div className="space-y-2"><label className="text-xs font-bold flex items-center gap-2"><FastForward size={14} /> Animação</label><input type="range" min="0.1" max="2" step="0.1" value={animSpeed} onChange={e => setAnimSpeed(parseFloat(e.target.value))} className="w-full accent-[#dd9933]" /></div>
              <div className="space-y-2"><label className="text-xs font-bold flex items-center gap-2"><Droplets size={14} /> Rastro</label><input type="range" min="0" max="50" step="1" value={trailLength} onChange={e => setTrailLength(parseInt(e.target.value))} className="w-full accent-[#dd9933]" /></div>
              <div className="space-y-2"><label className="text-xs font-bold flex items-center gap-2"><Activity size={14} /> Eixo Y (Log)</label>
                  <select value={yAxisMode} onChange={e => setYAxisMode(e.target.value as YAxisMode)} className="w-full bg-gray-100 dark:bg-tech-800 text-gray-900 dark:text-gray-100 p-2 rounded text-xs border border-gray-200 dark:border-white/10 outline-none">
                      <option value="total_volume">Volume 24h</option><option value="market_cap">Market Cap</option><option value="price_change_percentage_24h">Variação Preço %</option>
                  </select>
              </div>
          </div>
      )}

      <div className="flex-1 w-full h-full relative">
        <canvas ref={canvasRef} onMouseMove={handleMouseMove} onClick={handleClick} className="absolute inset-0 w-full h-full" />
      </div>

      {selectedParticle && (
          <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-black/80 p-4 rounded-lg border border-gray-200 dark:border-white/10 backdrop-blur-md w-72 z-10 animate-in fade-in slide-in-from-bottom-4 shadow-2xl">
              <div className="flex items-center gap-3 mb-3 border-b border-gray-200 dark:border-white/10 pb-3">
                  <img src={selectedParticle.coin.image} className="w-10 h-10 rounded-full bg-white p-1" />
                  <div><h4 className="font-black text-lg">{selectedParticle.coin.name}</h4><p className="text-xs text-[#dd9933] font-bold">{selectedParticle.coin.symbol}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Preço:</div><div className="font-mono text-right">${selectedParticle.coin.current_price.toLocaleString()}</div>
                  <div>24h %:</div><div className={`font-mono text-right ${selectedParticle.coin.price_change_percentage_24h > 0 ? 'text-green-500' : 'text-red-500'}`}>{selectedParticle.coin.price_change_percentage_24h.toFixed(2)}%</div>
                  <div>Volume:</div><div className="font-mono text-right">${formatCompact(selectedParticle.coin.total_volume)}</div>
                  <div>Mkt Cap:</div><div className="font-mono text-right">${formatCompact(selectedParticle.coin.market_cap)}</div>
              </div>
          </div>
      )}
    </div>
  );
};

export default MarketWindSwarm;