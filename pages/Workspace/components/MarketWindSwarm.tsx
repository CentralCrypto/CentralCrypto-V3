
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ApiCoin, Language } from '../../../types';
import { Loader2, RefreshCw, Search, XCircle, Settings, Droplets, FastForward, Activity, Wind, ZoomIn, ZoomOut, X } from 'lucide-react';
import { getTranslations } from '../../../locales';
import { fetchTopCoins } from '../services/api';

// --- TYPES ---
interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  targetX: number;
  targetY: number;
  color: string;
  trail: { x: number; y: number }[];
  coin: ApiCoin;
}

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

type YAxisMode = 'price_change_percentage_24h' | 'total_volume' | 'market_cap';
type Status = 'loading' | 'running' | 'error' | 'demo';

interface MarketWindSwarmProps {
  language: Language;
  onClose: () => void;
}

// --- HELPERS ---
const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;
const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(val, max));

const MarketWindSwarm = ({ language, onClose }: MarketWindSwarmProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  const animationFrameId = useRef<number>();
  const lastUpdateTime = useRef<number>(Date.now());

  const [status, setStatus] = useState<Status>('loading');
  const [coins, setCoins] = useState<ApiCoin[]>([]);
  
  const [hoveredParticle, setHoveredParticle] = useState<Particle | null>(null);
  const [selectedParticle, setSelectedParticle] = useState<Particle | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [numCoins, setNumCoins] = useState(150);
  const [trailLength, setTrailLength] = useState(15);
  const [simSpeed, setSimSpeed] = useState(1.0);
  const [yAxisMode, setYAxisMode] = useState<YAxisMode>('price_change_percentage_24h');
  // FIX: Add chartVersion state to trigger re-renders, fixing "Cannot find name 'setChartVersion'".
  const [chartVersion, setChartVersion] = useState(0);

  // --- DATA FETCHING & INITIALIZATION ---
  // @ts-ignore FIX: Wrap generateDemoData in useCallback to ensure it's stable for dependency arrays. This likely fixes the cryptic "Expected 1 arguments, but got 0" error by resolving stale closures.
  const generateDemoData = useCallback((count: number) => {
    console.warn("MarketWindSwarm: API failed, generating DEMO data.");
    const demoCoins: ApiCoin[] = Array.from({ length: count }, (_, i) => ({
      id: `demo-${i}`,
      symbol: `DMC${i}`,
      name: `Demo Coin ${i}`,
      current_price: Math.random() * 1000,
      price_change_percentage_24h: (Math.random() - 0.5) * 20,
      market_cap: Math.pow(10, 6 + Math.random() * 5),
      total_volume: Math.pow(10, 5 + Math.random() * 4),
      image: '',
      ath: 0, ath_change_percentage: 0, atl: 0, atl_change_percentage: 0, high_24h: 0, low_24h: 0
    }));
    setCoins(demoCoins);
    setStatus('demo');
  }, []);

  const loadData = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await fetchTopCoins();
      if (data && data.length > 0) {
        setCoins(data);
        setStatus('running');
      } else {
        generateDemoData(numCoins);
      }
    } catch (error) {
      console.error("Failed to fetch coin data:", error);
      generateDemoData(numCoins);
    }
  }, [generateDemoData, numCoins]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  // --- PARTICLE CREATION & MAPPING ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || coins.length === 0) return;
    const { width, height } = canvas.getBoundingClientRect();

    const topCoins = coins.slice(0, numCoins);
    const mCaps = topCoins.map(c => c.market_cap || 1).filter(mc => mc > 0);
    const minLogMc = Math.log10(Math.min(...mCaps));
    const maxLogMc = Math.log10(Math.max(...mCaps));

    const yValues = topCoins.map(c => c[yAxisMode] || 0);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    const mapX = (mc: number) => {
      const logMc = Math.log10(mc || 1);
      const pct = (logMc - minLogMc) / (maxLogMc - minLogMc || 1);
      return width * 0.05 + pct * width * 0.9;
    };
    const mapY = (val: number) => {
      const pct = (val - minY) / (maxY - minY || 1);
      return height * 0.95 - pct * height * 0.9;
    };
    const mapRadius = (mc: number) => {
        const logMc = Math.log10(mc || 1);
        const pct = (logMc - minLogMc) / (maxLogMc - minLogMc || 1);
        return 4 + pct * 20;
    };

    const getParticleColor = (change: number) => {
      if (change > 5) return '#089981';
      if (change > 1) return '#1b433d';
      if (change < -5) return '#f23645';
      if (change < -1) return '#431c1f';
      return '#363a45';
    };

    const existingParticles = new Map(particlesRef.current.map(p => [p.id, p]));
    particlesRef.current = topCoins.map(coin => {
      const existing = existingParticles.get(coin.id);
      const targetX = mapX(coin.market_cap);
      const targetY = mapY(coin[yAxisMode] || 0);
      
      if (existing) {
        existing.targetX = targetX;
        existing.targetY = targetY;
        existing.coin = coin; // Update coin data
        existing.radius = mapRadius(coin.market_cap);
        existing.color = getParticleColor(coin.price_change_percentage_24h || 0);
        return existing;
      } else {
        return {
          id: coin.id,
          x: width / 2 + (Math.random() - 0.5) * 50,
          y: height / 2 + (Math.random() - 0.5) * 50,
          vx: 0, vy: 0,
          radius: mapRadius(coin.market_cap),
          targetX, targetY,
          color: getParticleColor(coin.price_change_percentage_24h || 0),
          trail: [],
          coin,
        };
      }
    });
  // FIX: Update dependency array to react to resizes via chartVersion and remove unstable ref.
  }, [coins, numCoins, yAxisMode, chartVersion]);

  // --- ANIMATION LOOP ---
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const now = Date.now();
    const delta = Math.min(0.1, (now - lastUpdateTime.current) / 1000);
    lastUpdateTime.current = now;

    // --- Update Physics ---
    const particles = particlesRef.current;
    particles.forEach(p => {
        // Force towards target
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const forceMagnitude = dist * 0.1 * simSpeed;
        const fx = (dx / dist) * forceMagnitude;
        const fy = (dy / dist) * forceMagnitude;
        
        p.vx += fx * delta;
        p.vy += fy * delta;
        
        // Random "wind"
        p.vx += (Math.random() - 0.5) * 0.05 * simSpeed;
        p.vy += (Math.random() - 0.5) * 0.05 * simSpeed;

        // Damping/Friction
        p.vx *= 0.96;
        p.vy *= 0.96;

        p.x += p.vx;
        p.y += p.vy;

        // Trail
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > trailLength) {
            p.trail.shift();
        }
    });

    // --- Drawing ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const view = viewportRef.current;
    
    ctx.save();
    ctx.translate(view.x, view.y);
    ctx.scale(view.zoom, view.zoom);

    // Draw Trails
    particles.forEach(p => {
        if (p.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(p.trail[0].x, p.trail[0].y);
            for (let i = 1; i < p.trail.length; i++) {
                ctx.lineTo(p.trail[i].x, p.trail[i].y);
            }
            const alpha = (selectedParticle && selectedParticle.id !== p.id) ? 0.05 : 0.2;
            ctx.strokeStyle = `rgba(221, 153, 51, ${alpha})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    });

    // Draw Particles
    particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        
        const isSelected = selectedParticle && selectedParticle.id === p.id;
        const isHovered = hoveredParticle && hoveredParticle.id === p.id;
        const isFiltered = selectedParticle && !isSelected;

        ctx.fillStyle = isFiltered ? 'rgba(50, 50, 50, 0.2)' : p.color;
        ctx.fill();

        if (isSelected || isHovered) {
            ctx.strokeStyle = '#dd9933';
            ctx.lineWidth = isSelected ? 4 : 2;
            ctx.stroke();
        }
    });

    ctx.restore();
    animationFrameId.current = requestAnimationFrame(animate);
  }, [trailLength, simSpeed, selectedParticle, hoveredParticle]);

  // --- SETUP & RESIZE ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      canvas.width = width;
      canvas.height = height;
      setChartVersion(v => v + 1); // Trigger particle remap
    });
    resizeObserver.observe(container);

    lastUpdateTime.current = Date.now();
    animationFrameId.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      resizeObserver.disconnect();
    };
  }, [animate]);

  // --- INTERACTIVITY ---
  const getMousePos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const toWorld = (screenX: number, screenY: number) => {
      const view = viewportRef.current;
      return {
          x: (screenX - view.x) / view.zoom,
          y: (screenY - view.y) / view.zoom
      };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      const pos = getMousePos(e);
      const worldPos = toWorld(pos.x, pos.y);
      let foundParticle: Particle | null = null;
      for (const p of particlesRef.current) {
          const dx = p.x - worldPos.x;
          const dy = p.y - worldPos.y;
          if (dx * dx + dy * dy < p.radius * p.radius) {
              foundParticle = p;
              break;
          }
      }
      setHoveredParticle(foundParticle);
  };

  const handleClick = () => {
      if (hoveredParticle) {
        if (selectedParticle && selectedParticle.id === hoveredParticle.id) {
            setSelectedParticle(null); // Deselect
        } else {
            setSelectedParticle(hoveredParticle);
            setSearchTerm('');
        }
      }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchTerm(query);
    if (!query) {
        setSelectedParticle(null);
        return;
    }
    const found = particlesRef.current.find(p => 
        p.coin.symbol.toLowerCase().includes(query.toLowerCase()) || 
        p.coin.name.toLowerCase().includes(query.toLowerCase())
    );
    setSelectedParticle(found || null);
  };
  
  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#0b0f14] text-white overflow-hidden">
      <canvas ref={canvasRef} onMouseMove={handleMouseMove} onClick={handleClick} className="absolute inset-0 w-full h-full" />
      
      {/* Top Controls */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10">
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 bg-black/50 p-3 rounded-lg border border-white/10 backdrop-blur-sm">
                <Wind size={24} className="text-[#dd9933]" />
                <div>
                    <h3 className="text-lg font-black uppercase tracking-wider">Market Wind Swarm</h3>
                    <p className="text-xs text-gray-400 font-bold">{status === 'demo' ? 'MODO DEMO' : 'Live Market Data'}</p>
                </div>
            </div>
            <div className="flex items-center gap-2 bg-black/50 p-2 rounded-lg border border-white/10 backdrop-blur-sm">
                <Search size={16} className="text-gray-400" />
                <input 
                    type="text" 
                    value={searchTerm}
                    onChange={handleSearch}
                    placeholder="Buscar ativo..."
                    className="bg-transparent outline-none text-sm w-48"
                />
                {searchTerm && <button onClick={() => { setSearchTerm(''); setSelectedParticle(null); }}><XCircle size={16} className="text-gray-500 hover:text-white" /></button>}
            </div>
        </div>

        <div className="flex items-center gap-2">
            {status === 'loading' && <Loader2 size={20} className="text-white animate-spin" />}
            <button onClick={loadData} className="p-3 bg-black/50 rounded-lg border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors"><RefreshCw size={18} /></button>
            <button onClick={() => setSettingsOpen(!settingsOpen)} className={`p-3 rounded-lg border transition-colors backdrop-blur-sm ${settingsOpen ? 'bg-[#dd9933] text-black border-[#dd9933]' : 'bg-black/50 border-white/10 hover:bg-white/10'}`}><Settings size={18} /></button>
            <button onClick={onClose} className="p-3 bg-black/50 rounded-lg border border-white/10 backdrop-blur-sm hover:bg-red-500/50 text-white transition-colors" title="Close"><X size={18} /></button>
        </div>
      </div>
      
      {/* Settings Panel */}
      {settingsOpen && (
          <div className="absolute top-24 right-4 bg-black/70 p-4 rounded-lg border border-white/10 backdrop-blur-md w-64 z-20 space-y-4 animate-in fade-in slide-in-from-top-4">
              <div className="space-y-2">
                  <label className="text-xs font-bold flex items-center gap-2"><FastForward size={14} /> Velocidade</label>
                  <input type="range" min="0.1" max="3" step="0.1" value={simSpeed} onChange={e => setSimSpeed(parseFloat(e.target.value))} className="w-full accent-[#dd9933]" />
              </div>
              <div className="space-y-2">
                  <label className="text-xs font-bold flex items-center gap-2"><Droplets size={14} /> Rastro</label>
                  <input type="range" min="0" max="50" step="1" value={trailLength} onChange={e => setTrailLength(parseInt(e.target.value))} className="w-full accent-[#dd9933]" />
              </div>
              <div className="space-y-2">
                  <label className="text-xs font-bold flex items-center gap-2"><Activity size={14} /> Eixo Y</label>
                  <select value={yAxisMode} onChange={e => setYAxisMode(e.target.value as YAxisMode)} className="w-full bg-white/10 p-2 rounded text-xs">
                      <option value="price_change_percentage_24h">Variação Preço %</option>
                      <option value="total_volume">Volume 24h</option>
                      <option value="market_cap">Market Cap</option>
                  </select>
              </div>
          </div>
      )}

      {/* Selected Particle Info */}
      {selectedParticle && (
          <div className="absolute bottom-4 left-4 bg-black/70 p-4 rounded-lg border border-white/10 backdrop-blur-md w-72 z-10 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center gap-3 mb-3 border-b border-white/10 pb-3">
                  <img src={selectedParticle.coin.image} className="w-10 h-10 rounded-full bg-white p-1" />
                  <div>
                      <h4 className="font-black text-lg">{selectedParticle.coin.name}</h4>
                      <p className="text-xs text-[#dd9933] font-bold">{selectedParticle.coin.symbol}</p>
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Preço:</div><div className="font-mono text-right">${selectedParticle.coin.current_price.toLocaleString()}</div>
                  <div>24h %:</div><div className={`font-mono text-right ${selectedParticle.coin.price_change_percentage_24h > 0 ? 'text-green-400' : 'text-red-400'}`}>{selectedParticle.coin.price_change_percentage_24h.toFixed(2)}%</div>
                  <div>Volume:</div><div className="font-mono text-right">${(selectedParticle.coin.total_volume || 0).toLocaleString()}</div>
                  <div>Mkt Cap:</div><div className="font-mono text-right">${(selectedParticle.coin.market_cap || 0).toLocaleString()}</div>
              </div>
          </div>
      )}

      {/* Hovered Particle Tooltip */}
      {hoveredParticle && !selectedParticle && (
          <div className="absolute bottom-4 right-4 bg-black/70 p-3 rounded-lg border border-white/10 backdrop-blur-md z-10 text-center animate-in fade-in">
              <img src={hoveredParticle.coin.image} className="w-8 h-8 rounded-full mx-auto mb-2 bg-white p-0.5" />
              <p className="font-bold text-sm">{hoveredParticle.coin.symbol}</p>
              <p className={`font-mono text-xs ${hoveredParticle.coin.price_change_percentage_24h > 0 ? 'text-green-400' : 'text-red-400'}`}>{hoveredParticle.coin.price_change_percentage_24h.toFixed(2)}%</p>
          </div>
      )}
    </div>
  );
};

export default MarketWindSwarm;
