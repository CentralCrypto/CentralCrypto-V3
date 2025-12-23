
import { WorkspaceCoinData } from '../../../types';

export const generateMockData = (
    symbol: string, 
    realPrice?: number, 
    realChange?: number, 
    realSparkline?: number[],
    realVolume?: number
): WorkspaceCoinData => {
  // Use real price if available, otherwise fallback
  const basePrice = realPrice !== undefined ? realPrice : (symbol === 'BTC' ? 65000 : 100);
  const percentageChange = realChange !== undefined ? realChange : (Math.random() * 10 - 5);
  
  // Create a realistic-looking volatility based on the price
  const volatility = basePrice * 0.02; 
  
  let dataPoints: { name: string; value: number; volume: number; sentiment: number }[] = [];

  // IF WE HAVE REAL SPARKLINE DATA (Real Chart!)
  if (realSparkline && realSparkline.length > 0) {
      // Downsample if too large to keep performance high (optional, but 168 points is fine)
      dataPoints = realSparkline.map((val, i) => ({
          name: i.toString(),
          value: val,
          // We don't have historical volume in sparkline, so we simulate it relative to realVolume if present
          volume: realVolume ? (realVolume / 24) * (0.8 + Math.random() * 0.4) : Math.floor(Math.random() * 10000),
          sentiment: Math.floor(Math.random() * 100)
      }));
  } else {
      // --- FALLBACK MOCK DATA GENERATION ---
      let currentVal = basePrice * (1 - (percentageChange / 100)); // Start approximate based on change

      for (let i = 0; i < 20; i++) {
        // If it's the last point, align exactly with current price
        if (i === 19) {
            currentVal = basePrice;
        } else {
            currentVal = currentVal + (Math.random() - 0.45) * volatility; 
        }
        
        dataPoints.push({
            name: i.toString(),
            value: Math.max(0, currentVal),
            volume: realVolume ? (realVolume / 20) * (0.8 + Math.random() * 0.4) : Math.floor(Math.random() * 10000),
            sentiment: Math.floor(Math.random() * 100),
        });
      }
  }

  return {
    name: symbol,
    symbol: symbol,
    price: basePrice,
    change: percentageChange,
    data: dataPoints,
  };
};
