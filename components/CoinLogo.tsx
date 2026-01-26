
import React, { useState, useEffect, useRef } from 'react';
import { resolveLogoUrls, validatedLogoCache, initLogoService, resolveCoinId } from '../services/logo';

interface CoinLogoProps {
  coin: {
    id?: string;
    symbol?: string;
    name?: string;
    image?: string;
  };
  className?: string;
  alt?: string;
  style?: React.CSSProperties;
}

const CoinLogo: React.FC<CoinLogoProps> = ({ coin, className, alt, style }) => {
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const candidatesRef = useRef<string[]>([]);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);
  
  // Resolve ID único para cache
  const coinId = resolveCoinId(coin);

  useEffect(() => {
    mountedRef.current = true;
    
    // Inicia serviço (idempotente)
    initLogoService();

    // Cache hit?
    if (validatedLogoCache.has(coinId)) {
      setCurrentUrl(validatedLogoCache.get(coinId)!);
      return;
    }

    // Gera lista
    candidatesRef.current = resolveLogoUrls(coin);
    attemptRef.current = 0;
    
    if (candidatesRef.current.length > 0) {
      setCurrentUrl(candidatesRef.current[0]);
    }

    return () => {
      mountedRef.current = false;
    };
  }, [coinId, coin.symbol, coin.image]);

  const handleError = () => {
    const nextIndex = attemptRef.current + 1;
    if (nextIndex < candidatesRef.current.length) {
      attemptRef.current = nextIndex;
      if (mountedRef.current) {
        setCurrentUrl(candidatesRef.current[nextIndex]);
      }
    }
  };

  const handleLoad = () => {
    if (currentUrl && !validatedLogoCache.has(coinId)) {
      validatedLogoCache.set(coinId, currentUrl);
    }
  };

  if (!currentUrl) {
    return <div className={`rounded-full animate-pulse bg-white/10 ${className}`} style={style} />;
  }

  // Removido bg-gray-200/bg-gray-800 para transparência
  return (
    <img
      src={currentUrl}
      alt={alt || coin.symbol || 'coin'}
      className={`object-contain ${className}`}
      style={style}
      onError={handleError}
      onLoad={handleLoad}
      loading="lazy"
    />
  );
};

export default React.memo(CoinLogo);
