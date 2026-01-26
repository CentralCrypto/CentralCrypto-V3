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

    // dispara init (async), mas não bloqueia
    initLogoService().catch(() => {});

    // cache validado
    if (validatedLogoCache.has(coin.id)) {
      setCurrentUrl(validatedLogoCache.get(coin.id)!);
      return () => { mountedRef.current = false; };
    }

    candidatesRef.current = getCandidateLogoUrls(coin);
    attemptRef.current = 0;

    setCurrentUrl(candidatesRef.current[0] || '');

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
    }
  };

  const handleLoad = () => {
    if (currentUrl) {
      validatedLogoCache.set(coin.id, currentUrl);
    }
  };

  // placeholder transparente (sem caixa cinza)
  if (!currentUrl) {
    return <span className={className} style={style} />;
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
      decoding="async"
    />
  );
};

export default React.memo(CoinLogo);
