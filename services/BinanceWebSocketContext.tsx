
import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';

interface TickerData {
  s: string; // Symbol
  c: string; // Close Price
  o: string; // Open Price
  h: string; // High
  l: string; // Low
  v: string; // Volume
  q: string; // Quote Volume
}

interface BinanceContextType {
  tickers: Record<string, TickerData>; // Map symbol -> Data
  isConnected: boolean;
}

const BinanceWebSocketContext = createContext<BinanceContextType>({
  tickers: {},
  isConnected: false,
});

export const useBinanceWS = () => useContext(BinanceWebSocketContext);

export const BinanceWebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tickers, setTickers] = useState<Record<string, TickerData>>({});
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const bufferRef = useRef<Record<string, TickerData>>({});
  const flushTimerRef = useRef<number | null>(null);

  // Throttled update to avoid re-rendering the whole app on every single ticker msg (approx 1s)
  const flushBuffer = () => {
    if (Object.keys(bufferRef.current).length > 0) {
      setTickers(prev => ({ ...prev, ...bufferRef.current }));
      bufferRef.current = {};
    }
    flushTimerRef.current = null;
  };

  useEffect(() => {
    const connect = () => {
      // Connect to All Mini Tickers Stream
      const ws = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr');
      wsRef.current = ws;

      ws.onopen = () => setIsConnected(true);
      
      ws.onclose = () => {
        setIsConnected(false);
        // Auto-reconnect after 5s
        setTimeout(connect, 5000);
      };

      ws.onerror = (err) => {
        console.warn('Binance Global WS Error', err);
        ws.close();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (Array.isArray(data)) {
            for (const item of data) {
              // item = { e: '24hrMiniTicker', E: 123456789, s: 'BTCUSDT', c: '65000.00', ... }
              bufferRef.current[item.s] = {
                  s: item.s,
                  c: item.c,
                  o: item.o,
                  h: item.h,
                  l: item.l,
                  v: item.v,
                  q: item.q
              };
            }

            // Schedule flush if not scheduled
            if (!flushTimerRef.current) {
              flushTimerRef.current = window.setTimeout(flushBuffer, 1000);
            }
          }
        } catch (e) {
          // ignore parsing errors
        }
      };
    };

    connect();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, []);

  return (
    <BinanceWebSocketContext.Provider value={{ tickers, isConnected }}>
      {children}
    </BinanceWebSocketContext.Provider>
  );
};
