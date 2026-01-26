
import React, { useState, useEffect, useRef } from 'react';
import { getCandidateLogoUrls, validatedLogoCache, initLogoService } from '../services/logo';

interface CoinLogoProps {
  coin: {
    id: string;
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

  useEffect(() => {
    mountedRef.current = true;
    
    // Inicia o serviço de logos se necessário (lazy load)
    initLogoService();

    // Se já temos no cache validado, usa direto
    if (validatedLogoCache.has(coin.id)) {
      setCurrentUrl(validatedLogoCache.get(coin.id)!);
      return;
    }

    // Gera lista de candidatos
    candidatesRef.current = getCandidateLogoUrls(coin);
    attemptRef.current = 0;
    
    // Tenta o primeiro
    if (candidatesRef.current.length > 0) {
      setCurrentUrl(candidatesRef.current[0]);
    }

    return () => {
      mountedRef.current = false;
    };
  }, [coin.id, coin.image]);

  const handleError = () => {
    const nextIndex = attemptRef.current + 1;
    
    if (nextIndex < candidatesRef.current.length) {
      attemptRef.current = nextIndex;
      if (mountedRef.current) {
        setCurrentUrl(candidatesRef.current[nextIndex]);
      }
    } else {
      // Se falhou tudo, não faz nada (deixa a última url quebrada ou placeholder)
      // O último item de getCandidateLogoUrls é sempre o placeholder do site
    }
  };

  const handleLoad = () => {
    // Sucesso! Cacheia esta URL para este ID para não tentar as outras na próxima vez
    if (currentUrl && !validatedLogoCache.has(coin.id)) {
      validatedLogoCache.set(coin.id, currentUrl);
    }
  };

  // Se não tiver URL ainda, renderiza um placeholder transparente ou skeleton
  if (!currentUrl) {
    return <div className={`bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse ${className}`} style={style} />;
  }

  return (
    <img
      src={currentUrl}
      alt={alt || coin.symbol || 'coin'}
      className={className}
      style={style}
      onError={handleError}
      onLoad={handleLoad}
      loading="lazy"
    />
  );
};

export default React.memo(CoinLogo);
