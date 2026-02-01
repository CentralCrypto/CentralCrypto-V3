
/**
 * Calculates the Simple Moving Average (SMA)
 */
export const calculateSMA = (data: number[], windowSize: number): number => {
  if (data.length < windowSize) return 0;
  const slice = data.slice(data.length - windowSize);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / windowSize;
};

/**
 * Calculates the Exponential Moving Average (EMA)
 */
export const calculateEMA = (data: number[], windowSize: number): number => {
  // Relaxed requirement: if we have some data but less than window, fallback to SMA or available average
  if (data.length === 0) return 0;
  if (data.length < windowSize) {
      const sum = data.reduce((a, b) => a + b, 0);
      return sum / data.length;
  }
  
  const k = 2 / (windowSize + 1);
  let ema = calculateSMA(data.slice(0, windowSize), windowSize);
  
  for (let i = windowSize; i < data.length; i++) {
    ema = (data[i] * k) + (ema * (1 - k));
  }
  
  return ema;
};

export const calculateRSI = (prices: number[], period: number = 14): number => {
  if (prices.length < 2) return 50;
  // Adjust period if not enough data
  const effectivePeriod = Math.min(period, prices.length - 1);

  let gains = 0;
  let losses = 0;

  for (let i = prices.length - effectivePeriod; i < prices.length; i++) {
    const difference = prices[i] - prices[i - 1];
    if (difference >= 0) gains += difference;
    else losses += Math.abs(difference);
  }

  const avgGain = gains / effectivePeriod;
  const avgLoss = losses / effectivePeriod;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
};

export const getTrendAnalysis = (prices: number[]) => {
  // Relaxed data requirement from 55 to 10 to support resampled 7-day data (e.g. 1D view has only 7 points)
  if (!prices || prices.length < 5) return { status: 'NEUTRAL', label: 'Analyzing...', description: 'Gathering data.' };

  const currentPrice = prices[prices.length - 1];
  
  // Adaptive window sizes based on data length
  // Standard: EMA8 vs SMA21. If data is short, use shorter windows.
  const w1 = Math.min(8, Math.floor(prices.length / 3));
  const w2 = Math.min(21, Math.floor(prices.length / 2));
  const w3 = Math.min(55, prices.length - 1);

  const shortMA = calculateEMA(prices, w1);
  const longMA = calculateSMA(prices, w2);
  const refMA = calculateEMA(prices, w3);

  const trendUp = shortMA > longMA;
  
  let isStrong = false;
  
  if (trendUp) {
      isStrong = currentPrice > refMA;
      return { 
        status: isStrong ? 'STRONG_BUY' : 'BUY', 
        label: 'Bullish Trend',
        description: 'Short-term momentum is positive.',
        strength: isStrong ? 'High' : 'Moderate'
    };
  } else {
      isStrong = currentPrice < refMA;
      return { 
        status: isStrong ? 'STRONG_SELL' : 'SELL', 
        label: 'Bearish Trend',
        description: 'Short-term momentum is negative.',
        strength: isStrong ? 'High' : 'Moderate'
    };
  }
};

export const getDetailedSentiment = (prices: number[]) => {
    if (!prices || prices.length < 14) return { status: 'NEUTRAL', rsi: 50, sma: 50, isRising: false };
    
    // Calculate Historical RSI to get SMA
    const rsiHistory = [];
    for(let i = 14; i <= prices.length; i++) {
        rsiHistory.push(calculateRSI(prices.slice(0, i)));
    }
    
    const currentRsi = rsiHistory[rsiHistory.length - 1];
    const prevRsi = rsiHistory[rsiHistory.length - 2] || currentRsi;
    
    // SMA of RSI (21 periods)
    const smaRsi = calculateSMA(rsiHistory, Math.min(21, rsiHistory.length));
    
    let status = 'NEUTRAL';
    if (smaRsi > 60) status = 'BULLISH CONTEXT';
    else if (smaRsi < 40) status = 'BEARISH CONTEXT';
    
    return {
        rsi: currentRsi,
        sma: smaRsi,
        isRising: currentRsi > prevRsi,
        crossUp: currentRsi > smaRsi,
        status
    };
}
