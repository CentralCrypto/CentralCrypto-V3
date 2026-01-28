import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Gamepad2, X, Maximize2, Minimize2 } from 'lucide-react';
import { fetchTopCoins } from '../services/api';
import { ApiCoin, DashboardItem, Language } from '../../../types';
import CoinLogo from '../../../components/CoinLogo';

interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  coin: ApiCoin;
  color: string;
  isFalling?: boolean;
  isFixed?: boolean;
}

interface GameControl {
  phase: number;
  aimX: number;
  aimY: number;
  powerPull: number;
  holdStart: number;
  aimPulseT: number;
}

interface Props {
  item?: DashboardItem;
  language?: Language;
  onClose?: () => void;
  isWidget?: boolean;
}

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

const CryptoMarketBubbles: React.FC<Props> = ({ item, language = 'pt', onClose, isWidget = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [selectedParticle, setSelectedParticle] = useState<Particle | null>(null);
  const [isGameMode, setIsGameMode] = useState(false);
  const [gameHasShot, setGameHasShot] = useState(false);

  // Refs
  const particlesRef = useRef<Particle[]>([]);
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, clientX: 0, clientY: 0 });
  const pointerDownRef = useRef(false);
  const hoveredParticleRef = useRef<Particle | null>(null);
  const draggedParticleRef = useRef<Particle | null>(null);
  const detailOpenRef = useRef(false);
  const requestRef = useRef<number>();
  
  const gameCtlRef = useRef<GameControl>({
    phase: 0,
    aimX: 0,
    aimY: 0,
    powerPull: 0,
    holdStart: 0,
    aimPulseT: 0
  });
  const cueHideUntilRef = useRef(0);

  useEffect(() => {
    fetchTopCoins().then(data => {
      // Init particles mock
      if (data && data.length > 0) {
          particlesRef.current = data.slice(0, 50).map((c, i) => ({
              id: c.id,
              x: Math.random() * 800,
              y: Math.random() * 600,
              vx: 0,
              vy: 0,
              radius: 20 + Math.random() * 30,
              mass: 1,
              coin: c,
              color: c.price_change_percentage_24h >= 0 ? '#22c55e' : '#ef4444'
          }));
      }
      setLoading(false);
    });
  }, []);

  const screenToWorld = (sx: number, sy: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = (sx - rect.left - transformRef.current.x) / transformRef.current.k;
    const y = (sy - rect.top - transformRef.current.y) / transformRef.current.k;
    return { x, y };
  };

  const playHit = useCallback(() => {
    // Sound mock
  }, []);

  const openDetailFor = (p: Particle) => {
    setSelectedParticle(p);
    detailOpenRef.current = true;
  };

  const setDetailOpen = (open: boolean) => {
    if (!open) setSelectedParticle(null);
    detailOpenRef.current = open;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (detailOpenRef.current) return;
    
    // STOP PROPAGATION to prevent dragging the widget container
    e.stopPropagation(); 
    
    pointerDownRef.current = true;

    if (e.button !== 0) return;

    if (isGameMode) {
      // Force disable panning in game mode
      isPanningRef.current = false;

      const cue = particlesRef.current.find(pp => String(pp.coin.id).toLowerCase() === 'bitcoin');
      if (!cue || cue.isFalling) return;

      const w = screenToWorld(e.clientX, e.clientY);

      if (gameCtlRef.current.phase === 0) {
        gameCtlRef.current.phase = 1;
        gameCtlRef.current.aimX = w.x;
        gameCtlRef.current.aimY = w.y;
        gameCtlRef.current.powerPull = 0;
        gameCtlRef.current.holdStart = performance.now();
        return;
      }

      if (gameCtlRef.current.phase === 2) {
        gameCtlRef.current.phase = 3;
        gameCtlRef.current.powerPull = 0;
        gameCtlRef.current.holdStart = performance.now();
        return;
      }

      return;
    }

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

    if (isGameMode) {
      // Ensure panning is off
      isPanningRef.current = false;

      const cue = particlesRef.current.find(pp => String(pp.coin.id).toLowerCase() === 'bitcoin');
      if (!cue || cue.isFalling) {
        gameCtlRef.current.phase = 0;
        gameCtlRef.current.powerPull = 0;
        return;
      }

      if (gameCtlRef.current.phase === 1) {
        gameCtlRef.current.phase = 2;
        gameCtlRef.current.aimPulseT = performance.now();
        return;
      }

      if (gameCtlRef.current.phase === 3) {
        const dx = gameCtlRef.current.aimX - cue.x;
        const dy = gameCtlRef.current.aimY - cue.y;
        const dist = Math.hypot(dx, dy) || 0.0001;

        const nx = dx / dist;
        const ny = dy / dist;

        const pull = clamp(gameCtlRef.current.powerPull, 0, 220);
        const pullNorm = clamp(pull / 220, 0.01, 1);

        const basePower = 42000;
        const power = basePower * pullNorm;

        cue.vx += nx * (power / Math.max(1, cue.mass));
        cue.vy += ny * (power / Math.max(1, cue.mass));

        cueHideUntilRef.current = performance.now() + 5000;
        playHit();

        setGameHasShot(true);
        
        gameCtlRef.current.phase = 0;
        gameCtlRef.current.powerPull = 0;
        return;
      }
    }

    if (draggedParticleRef.current) {
      draggedParticleRef.current.isFixed = false;
      draggedParticleRef.current = null;
    }
    isPanningRef.current = false;
  }, [isGameMode, playHit]);

  // Mock render loop for canvas
  useEffect(() => {
      const canvas = canvasRef.current;
      if(!canvas) return;
      const ctx = canvas.getContext('2d');
      if(!ctx) return;

      const render = () => {
          ctx.clearRect(0,0, canvas.width, canvas.height);
          // Draw particles mock
          particlesRef.current.forEach(p => {
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
              ctx.fillStyle = p.color;
              ctx.fill();
              ctx.fillStyle = '#fff';
              ctx.font = '10px sans-serif';
              ctx.fillText(p.coin.symbol || '', p.x - 10, p.y);
          });
          requestRef.current = requestAnimationFrame(render);
      };
      requestRef.current = requestAnimationFrame(render);
      return () => { if(requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, []);

  return (
    <div 
        ref={containerRef}
        className="w-full h-full relative bg-[#111] overflow-hidden" 
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
    >
        {loading && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><Loader2 className="animate-spin text-white"/></div>}
        <canvas ref={canvasRef} width={800} height={600} className="block w-full h-full" />
        
        <div className="absolute top-4 right-4 flex gap-2 z-10">
            <button onClick={() => setIsGameMode(!isGameMode)} className={`p-2 rounded-full transition-colors ${isGameMode ? 'bg-green-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                <Gamepad2 size={20} />
            </button>
            {onClose && (
                <button onClick={onClose} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20">
                    <X size={20} />
                </button>
            )}
        </div>

        {selectedParticle && (
            <div className="absolute bottom-4 left-4 p-4 bg-black/80 text-white rounded-xl backdrop-blur-md border border-white/10 w-64 z-20 animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-3 mb-2">
                    <CoinLogo coin={selectedParticle.coin} className="w-8 h-8 rounded-full" />
                    <div>
                        <h3 className="font-bold">{selectedParticle.coin.name}</h3>
                        <p className="text-xs text-gray-400">{selectedParticle.coin.symbol}</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Price: <span className="font-mono">${selectedParticle.coin.current_price?.toLocaleString()}</span></div>
                    <div className={selectedParticle.coin.price_change_percentage_24h >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {selectedParticle.coin.price_change_percentage_24h?.toFixed(2)}%
                    </div>
                </div>
                <button onClick={() => setDetailOpen(false)} className="mt-3 w-full py-1.5 bg-white/10 hover:bg-white/20 rounded text-xs font-bold transition-colors">Close</button>
            </div>
        )}
    </div>
  );
};

export default CryptoMarketBubbles;