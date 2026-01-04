// ... existing code ...
      const minX = Math.min(...xData), maxX = Math.max(...xData);
      const minY = Math.min(...yData), maxY = Math.max(...yData);
      const minR = Math.min(...radiusData), maxR = Math.max(...radiusData);

      statsRef.current = {
          minX, maxX, minY, maxY, minR, maxR,
          logMinX: (minX > 0) ? Math.log10(minX) : 0,
          logMaxX: (maxX > 0) ? Math.log10(maxX) : 0,
          logMinY: (minY > 0) ? Math.log10(minY) : 0,
          logMaxY: (maxY > 0) ? Math.log10(maxY) : 0,
          logMinR: (minR > 0) ? Math.log10(minR) : minR,
          logMaxR: (maxR > 0) ? Math.log10(maxR) : maxR
      };

      const { logMinR, logMaxR } = statsRef.current!;
      
      const existingMap = new Map(particlesRef.current.map(p => [p.id, p]));
      
      const newParticles = topCoins.map(coin => {
// ... existing code ...