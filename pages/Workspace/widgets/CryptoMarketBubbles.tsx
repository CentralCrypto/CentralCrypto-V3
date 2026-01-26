
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiCoin, Language, DashboardItem } from '../../../types';
import { fetchTopCoins } from '../services/api';
import { getBestLocalLogo, initLogoService } from '../../../services/logo';
import { Loader2, AlertTriangle, Maximize2, Minimize2, RefreshCw, X, Play, Pause } from 'lucide-react';

export interface CryptoMarketBubblesProps {
  language: Language;
  onClose?: () => void;
  isWidget?: boolean;
  item?: DashboardItem;
}

type ChartMode = 'performance' | 'marketcap';

interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  targetRadius: number;
  color: string;
  coin: ApiCoin;
}

const CryptoMarketBubbles = ({ language, onClose, isWidget = false, item }: CryptoMarketBubblesProps) => {
  const [topCoins, setTopCoins] = useState<ApiCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [chartMode, setChartMode] = useState<ChartMode>('performance');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  
  const isMaximized = item?.isMaximized ?? !isWidget;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const coins = await fetchTopCoins();
      if (coins && coins.length > 0) {
        setTopCoins(coins.slice(0, isWidget && !isMaximized ? 20 : 100));
        setError(false);
      } else {
        setError(true);
      }
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [isWidget, isMaximized]);

  useEffect(() => {
    initLogoService();
    loadData();
  }, [loadData]);

  const initParticles = useCallback(() => {
    if (!canvasRef.current || topCoins.length === 0) return;
    const { width, height } = canvasRef.current;
    
    // Create particles if not exists or update existing
    const newParticles: Particle[] = topCoins.map(coin => {
      const existing = particlesRef.current.find(p => p.id === coin.id);
      const change = coin.price_change_percentage_24h || 0;
      const color = change >= 0 ? '#22c55e' : '#ef4444';
      
      // Calculate radius based on mode
      let r = 20; // base
      if (chartMode === 'marketCap') {
         r = Math.sqrt(coin.market_cap || 0) / 5000; 
      } else {
         r = 25 + Math.abs(change) * 2;
      }
      
      // Normalize radius to bounds
      const minR = isWidget ? 10 : 20;
      const maxR = isWidget ? 40 : 100;
      r = Math.max(minR, Math.min(maxR, r));

      return {
        id: coin.id,
        x: existing ? existing.x : width / 2 + (Math.random() - 0.5) * 50,
        y: existing ? existing.y : height / 2 + (Math.random() - 0.5) * 50,
        vx: existing ? existing.vx : 0,
        vy: existing ? existing.vy : 0,
        radius: existing ? existing.radius : 0,
        targetRadius: r,
        color: color,
        coin: coin
      };
    });
    
    particlesRef.current = newParticles;
  }, [topCoins, chartMode, isWidget]);

  // Update loop
  const update = useCallback(() => {
    if (!canvasRef.current || isPaused) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    // Physics
    const particles = particlesRef.current;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      
      // Grow/Shrink
      p.radius += (p.targetRadius - p.radius) * 0.1;

      // Center gravity
      const dx = centerX - p.x;
      const dy = centerY - p.y;
      p.vx += dx * 0.0005;
      p.vy += dy * 0.0005;

      // Collisions
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx2 = p2.x - p.x;
        const dy2 = p2.y - p.y;
        const dist = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        const minDist = p.radius + p2.radius + 2; // + padding

        if (dist < minDist) {
          const angle = Math.atan2(dy2, dx2);
          const tx = Math.cos(angle);
          const ty = Math.sin(angle);
          const ax = tx * (minDist - dist) * 0.05; // Force
          const ay = ty * (minDist - dist) * 0.05;

          p.vx -= ax;
          p.vy -= ay;
          p2.vx += ax;
          p2.vy += ay;
        }
      }

      // Damping
      p.vx *= 0.94;
      p.vy *= 0.94;

      p.x += p.vx;
      p.y += p.vy;

      // Render
      if (p.radius <= 0.5) continue;

      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      
      // Image Logic
      const localLogoUrl = getBestLocalLogo({ id: p.coin.id, symbol: p.coin.symbol });
      let img = imageCache.current.get(localLogoUrl);
      
      // Fallback color fill background first
      ctx.fillStyle = p.color;
      ctx.fill();

      // If image not in cache, load it
      if (!img && !imageCache.current.has(localLogoUrl)) {
          const newImg = new Image();
          newImg.src = localLogoUrl;
          newImg.onload = () => { imageCache.current.set(localLogoUrl, newImg); };
          // Mark as loading to prevent spam
          imageCache.current.set(localLogoUrl, newImg); 
          img = newImg;
      }

      if (img && img.complete && img.naturalWidth > 0) {
          ctx.save();
          ctx.clip();
          ctx.globalAlpha = 0.8;
          ctx.drawImage(img, p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
          ctx.restore();
          
          // Border
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.lineWidth = 2;
          ctx.stroke();
      }

      // Text
      if (p.radius > 15) {
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.max(10, p.radius * 0.35)}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 4;
          
          ctx.fillText(p.coin.symbol?.toUpperCase() || '', p.x, p.y - p.radius * 0.15);
          
          const change = p.coin.price_change_percentage_24h || 0;
          ctx.font = `bold ${Math.max(8, p.radius * 0.25)}px Inter, sans-serif`;
          ctx.fillText(`${change >= 0 ? '+' : ''}${change.toFixed(1)}%`, p.x, p.y + p.radius * 0.25);
      }

      ctx.restore();
    }

    requestRef.current = requestAnimationFrame(update);
  }, [isPaused, isWidget]);

  useEffect(() => {
    initParticles();
  }, [initParticles]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [update]);

  useEffect(() => {
      const handleResize = () => {
          if(canvasRef.current) {
              // Get parent dimensions
              const parent = canvasRef.current.parentElement;
              if(parent) {
                  canvasRef.current.width = parent.clientWidth;
                  canvasRef.current.height = parent.clientHeight;
                  initParticles(); // Re-center
              }
          }
      };
      window.addEventListener('resize', handleResize);
      handleResize();
      return () => window.removeEventListener('resize', handleResize);
  }, [initParticles]);

  if (loading) return <div className="h-full flex items-center justify-center text-slate-500"><Loader2 className="animate-spin" /></div>;
  if (error) return <div className="h-full flex items-center justify-center text-slate-500"><AlertTriangle /> Error loading data</div>;

  return (
    <div className="w-full h-full relative bg-gray-900 overflow-hidden flex flex-col">
       {/* Toolbar */}
       {!isWidget && (
           <div className="absolute top-4 left-4 z-20 flex gap-2">
               <button onClick={() => setChartMode('performance')} className={`px-3 py-1.5 rounded text-xs font-bold ${chartMode === 'performance' ? 'bg-[#dd9933] text-black' : 'bg-black/50 text-white'}`}>Performance</button>
               <button onClick={() => setChartMode('marketcap')} className={`px-3 py-1.5 rounded text-xs font-bold ${chartMode === 'marketcap' ? 'bg-[#dd9933] text-black' : 'bg-black/50 text-white'}`}>Market Cap</button>
               <button onClick={() => setIsPaused(!isPaused)} className="p-1.5 bg-black/50 text-white rounded hover:bg-[#dd9933] hover:text-black transition-colors">
                   {isPaused ? <Play size={16}/> : <Pause size={16}/>}
               </button>
               <button onClick={loadData} className="p-1.5 bg-black/50 text-white rounded hover:bg-[#dd9933] hover:text-black transition-colors"><RefreshCw size={16}/></button>
           </div>
       )}
       {onClose && (
           <button onClick={onClose} className="absolute top-4 right-4 z-20 p-2 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors"><X size={20}/></button>
       )}
       
       <div className="flex-1 w-full h-full relative">
           <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
       </div>
    </div>
  );
};

export default CryptoMarketBubbles;
