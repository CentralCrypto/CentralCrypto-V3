
import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

declare global {
  interface Window {
    TradingView: any;
  }
}

interface TVChartContainerProps {
  symbol: string;
  containerId: string;
  theme: 'dark' | 'light';
}

const TVChartContainer: React.FC<TVChartContainerProps> = ({ symbol, containerId, theme }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initWidget = () => {
        if (typeof window === 'undefined' || !window.TradingView) {
            console.warn("TradingView script not loaded yet...");
            return;
        }

        // Garantir formato BINANCE para o Widget Público
        const formattedSymbol = symbol.includes(':') ? symbol : `BINANCE:${symbol}`;

        if (chartContainerRef.current) {
            chartContainerRef.current.innerHTML = '';
            
            try {
                widgetRef.current = new window.TradingView.widget({
                    "autosize": true,
                    "symbol": formattedSymbol,
                    "interval": "60",
                    "timezone": "Etc/UTC",
                    "theme": theme,
                    "style": "1",
                    "locale": "br",
                    "toolbar_bg": theme === 'dark' ? "#1a1c1e" : "#f1f5f9",
                    "enable_publishing": false,
                    "hide_side_toolbar": false,
                    "allow_symbol_change": true,
                    "container_id": containerId,
                    "studies": [
                        "RSI@tv-basicstudies",
                        "MASimple@tv-basicstudies"
                    ],
                });
                setLoading(false);
            } catch (e) {
                console.error("Error creating TV widget", e);
            }
        }
    };

    // Pequeno intervalo para garantir que o script da CDN carregou
    const checkScript = setInterval(() => {
        if (window.TradingView) {
            clearInterval(checkScript);
            initWidget();
        }
    }, 500);

    return () => {
        clearInterval(checkScript);
    };
  }, [symbol, theme, containerId]);

  return (
    <div className="w-full h-full relative bg-black overflow-hidden">
        {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1c1e] z-20">
                <Loader2 className="animate-spin text-[#dd9933] mb-4" size={32} />
                <span className="text-[10px] font-black text-white uppercase tracking-widest animate-pulse">
                    Conectando Binance via TV...
                </span>
            </div>
        )}
        
        <div 
            id={containerId} 
            ref={chartContainerRef} 
            className="w-full h-full"
        />
    </div>
  );
};

export default TVChartContainer;
