
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CircleDashed, RefreshCw, ChevronDown, X } from 'lucide-react';
import { fetchTopCoins } from '../services/api';
import { DashboardItem, Language, ApiCoin } from '../../../types';

interface Props {
  item: DashboardItem;
  language?: Language;
}

const formatUSD = (val: number) => {
    if (!val || val === 0) return "$0";
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
};

const LIMIT_OPTIONS = [50, 100, 150, 200, 250];

const BubbleHeatmapWidget: React.FC<Props> = ({ item, language = 'pt' }) => {
    const [marketPool, setMarketPool] = useState<ApiCoin[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [mode, setMode] = useState<'marketCap' | 'percentChange24h'>('percentChange24h');
    const [activeRanges, setActiveRanges] = useState<number[]>([0, 1, 2, 3, 4]); 
    const [coinLimit, setCoinLimit] = useState(50);
    const [isFullscreen, setIsFullscreen] = useState(false);
    
    const [chartVersion, setChartVersion] = useState(0);
    const chartRef = useRef<HTMLDivElement>(null);
    const chartInstance = useRef<any>(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const coins = await fetchTopCoins();
            if (coins && coins.length > 0) {
                const processed = coins
                    .filter(c => c && c.symbol)
                    .map(c => ({
                        id: c.id,
                        symbol: (c.symbol || '').toUpperCase(),
                        name: c.name || c.symbol,
                        current_price: c.current_price || 0,
                        price_change_percentage_24h: c.price_change_percentage_24h || 0,
                        market_cap: c.market_cap || 0,
                        total_volume: c.total_volume || 0,
                        image: c.image || '',
                        ath: c.ath || 0,
                        ath_change_percentage: c.ath_change_percentage || 0,
                        atl: c.atl || 0,
                        atl_change_percentage: c.atl_change_percentage || 0,
                        high_24h: c.high_24h || 0,
                        low_24h: c.low_24h || 0
                    }));
                setMarketPool(processed);
            }
        } catch (e) {
            console.error("Bubble Heatmap Error:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const getRangeIndex = (change: number) => {
        if (change >= 5) return 4;   
        if (change >= 1.5) return 3; 
        if (change <= -5) return 0;  
        if (change <= -1.5) return 1; 
        return 2;                    
    };

    const getBubbleGradient = (index: number) => {
        const configs = [
          // CORES MUITO SUAVES (GLASS STYLE)
          { edge: 'rgba(239, 68, 68, 0.45)', center: 'rgba(255, 180, 180, 0.15)' }, 
          { edge: 'rgba(245, 120, 120, 0.35)', center: 'rgba(255, 200, 200, 0.12)' }, 
          { edge: 'rgba(120, 140, 160, 0.25)', center: 'rgba(200, 210, 220, 0.1)' }, 
          { edge: 'rgba(80, 210, 150, 0.35)', center: 'rgba(180, 255, 210, 0.12)' }, 
          { edge: 'rgba(50, 190, 130, 0.45)', center: 'rgba(150, 255, 200, 0.15)' }  
        ];
        const conf = configs[index];
        return {
            radialGradient: { cx: 0.4, cy: 0.3, r: 0.8 },
            stops: [[0, conf.center], [1, conf.edge]]
        };
    };

    const bubbleSizes = useMemo(() => {
        const width = isFullscreen ? window.innerWidth : (chartRef.current?.clientWidth || 800);
        const height = isFullscreen ? window.innerHeight - 200 : (chartRef.current?.clientHeight || 600);
        
        const totalArea = width * height;
        const targetUsage = 0.90; 
        const availableArea = totalArea * targetUsage;
        
        const avgAreaPerBubble = availableArea / coinLimit;
        const avgRadius = Math.sqrt(avgAreaPerBubble / Math.PI);
        
        const maxRadius = Math.floor(avgRadius * 3.8); 
        const minRadius = Math.floor(avgRadius * 0.35);

        return { 
            min: `${Math.max(minRadius, 12)}px`, 
            max: `${Math.max(maxRadius, 50)}px` 
        };
    }, [coinLimit, isFullscreen, chartVersion]);

    const filteredBubbleData = useMemo(() => {
        if (marketPool.length === 0) return [];

        let sorted = [...marketPool];
        if (mode === 'marketCap') {
            sorted.sort((a, b) => b.market_cap - a.market_cap);
        } else {
            sorted.sort((a, b) => Math.abs(b.price_change_percentage_24h) - Math.abs(a.price_change_percentage_24h));
        }

        const selected = sorted.slice(0, coinLimit);
        const values = selected.map(c => mode === 'marketCap' ? Math.pow(c.market_cap, 0.85) : Math.pow(Math.abs(c.price_change_percentage_24h) + 0.2, 1.4));
        const maxVal = Math.max(...values) || 1;
        const minVal = Math.min(...values) || 0;
        const range = (maxVal - minVal) || 1;

        return selected
            .map(coin => {
                const change = coin.price_change_percentage_24h || 0;
                const rangeIdx = getRangeIndex(change);
                if (!activeRanges.includes(rangeIdx)) return null;

                const rawVal = mode === 'marketCap' ? Math.pow(coin.market_cap, 0.85) : Math.pow(Math.abs(change) + 0.2, 1.4);
                const normalizedValue = ((rawVal - minVal) / range) * 95 + 5;

                return {
                    name: coin.symbol,
                    value: normalizedValue, 
                    change: change,
                    price: coin.current_price,
                    mkt: coin.market_cap,
                    vol: coin.total_volume,
                    logo: coin.image,
                    fullName: coin.name,
                    ath: coin.ath,
                    ath_p: coin.ath_change_percentage,
                    atl: coin.atl,
                    atl_p: coin.atl_change_percentage,
                    high24: coin.high_24h,
                    low24: coin.low_24h,
                    color: getBubbleGradient(rangeIdx)
                };
            })
            .filter(p => p !== null);
    }, [marketPool, mode, activeRanges, coinLimit]);

    useEffect(() => {
        if (!chartRef.current || !window.Highcharts || filteredBubbleData.length === 0) return;

        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        chartInstance.current = window.Highcharts.chart(chartRef.current, {
            chart: {
                type: 'packedbubble',
                backgroundColor: 'transparent',
                animation: { duration: 1500 },
                style: { fontFamily: 'Inter, sans-serif' },
                margin: [0, 0, 0, 0],
                spacing: [0, 0, 0, 0]
            },
            title: { text: null },
            credits: { enabled: false },
            legend: { enabled: false },
            exporting: { enabled: false },
            tooltip: {
                enabled: true,
                useHTML: true,
                outside: true,
                followPointer: true,
                backgroundColor: 'rgba(10, 11, 12, 0.98)',
                borderColor: 'rgba(221, 153, 51, 0.9)',
                borderRadius: 16,
                shadow: true,
                padding: 0,
                style: { pointerEvents: 'none', zIndex: 9999 },
                formatter: function (this: any) {
                    const p = this.point;
                    const changeColor = p.change >= 0 ? '#22c55e' : '#ef4444';
                    return `
                        <div style="padding: 16px; min-width: 320px; color: #ffffff; pointer-events: none; font-family: Inter, sans-serif;">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px;">
                                ${p.logo ? `<img src="${p.logo}" style="width: 42px; height: 42px; border-radius: 50%; background: #fff; border: 2px solid #dd9933;">` : ''}
                                <div>
                                    <div style="font-size: 20px; font-weight: 900; line-height: 1;">${p.name}</div>
                                    <div style="font-size: 11px; color: #dd9933; font-weight: 800; text-transform: uppercase; margin-top: 4px;">${p.fullName}</div>
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                                <div><div style="font-size: 9px; color: #999; font-weight: bold;">PREÇO</div><div style="font-size: 15px; font-weight: 800;">$${(p.price || 0).toLocaleString()}</div></div>
                                <div><div style="font-size: 9px; color: #999; font-weight: bold;">VAR 24H</div><div style="font-size: 15px; font-weight: 900; color: ${changeColor};">${p.change.toFixed(2)}%</div></div>
                                <div><div style="font-size: 9px; color: #999; font-weight: bold;">MKT CAP</div><div style="font-size: 15px; font-weight: 800; color: #60a5fa;">${formatUSD(p.mkt)}</div></div>
                                <div><div style="font-size: 9px; color: #999; font-weight: bold;">VOL 24H</div><div style="font-size: 15px; font-weight: 800; color: #dd9933;">${formatUSD(p.vol)}</div></div>
                            </div>

                            <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 8px;">
                                    <div><div style="font-size: 8px; color: #666; font-weight: bold;">HIGH 24H</div><div style="font-size: 11px; font-weight: 700; color: #22c55e;">$${(p.high24 || 0).toLocaleString()}</div></div>
                                    <div><div style="font-size: 8px; color: #666; font-weight: bold;">LOW 24H</div><div style="font-size: 11px; font-weight: 700; color: #ef4444;">$${(p.low24 || 0).toLocaleString()}</div></div>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                    <div><div style="font-size: 8px; color: #666; font-weight: bold;">ALL TIME HIGH</div><div style="font-size: 11px; font-weight: 700; color: #fff;">$${(p.ath || 0).toLocaleString()}</div><div style="font-size: 9px; font-weight: 800; color: #ef4444;">${p.ath_p?.toFixed(1)}% (DROP)</div></div>
                                    <div><div style="font-size: 8px; color: #666; font-weight: bold;">ALL TIME LOW</div><div style="font-size: 11px; font-weight: 700; color: #fff;">$${(p.atl || 0).toLocaleString()}</div><div style="font-size: 9px; font-weight: 800; color: #22c55e;">+${p.atl_p?.toFixed(0)}% (PUMP)</div></div>
                                </div>
                            </div>
                        </div>
                    `;
                }
            },
            plotOptions: {
                packedbubble: {
                    minSize: bubbleSizes.min,
                    maxSize: bubbleSizes.max,
                    zMin: 0,
                    zMax: 100,
                    layoutAlgorithm: {
                        initialPositions: 'random',
                        initialPositionRadius: 500, 
                        gravitationalConstant: 0.0001,
                        friction: 0.93, 
                        splitSeries: false,
                        seriesInteraction: true,
                        dragBetweenSeries: true,
                        parentNodeLimit: true,
                        enableSimulation: true,
                        maxIterations: 6000,
                        bubblePadding: 15, 
                        frictionCoefficient: 0.02
                    },
                    dataLabels: {
                        enabled: true,
                        useHTML: true,
                        style: { pointerEvents: 'none', textOutline: 'none', userSelect: 'none' },
                        formatter: function (this: any) {
                            if (!this.point || !this.point.name) return '';
                            const p = this.point;
                            const r = p.marker ? p.marker.radius : 0;
                            const labelValue = mode === 'marketCap' ? formatUSD(p.mkt) : `${p.change.toFixed(1)}%`;
                            if (r < 14) return `<div style="font-size: 7px; font-weight: 900; color: #fff; text-shadow: 0 1px 2px #000; pointer-events: none;">${p.name}</div>`;
                            const logoSize = Math.min(Math.max(r * 0.58, 12), 110);
                            const fontSize = Math.min(Math.max(r * 0.52, 8), 58);
                            const subSize = Math.max(fontSize * 0.55, 7);
                            return `
                                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; pointer-events: none; user-select: none; width: 100%;">
                                    ${p.logo && r > 24 ? `<img src="${p.logo}" style="width: ${logoSize}px; height: ${logoSize}px; border-radius: 50%; background: #fff; border: 1.5px solid rgba(255,255,255,0.5); margin-bottom: 2px; pointer-events: none; -webkit-user-drag: none;">` : ''}
                                    <div style="font-size: ${fontSize}px; font-weight: 1000; color: #ffffff; text-shadow: 0 2px 8px rgba(0,0,0,1); line-height: 0.9; pointer-events: none;">${p.name}</div>
                                    <div style="font-size: ${subSize}px; font-weight: 800; color: #ffffff; opacity: 0.95; text-shadow: 0 1px 4px rgba(0,0,0,1); pointer-events: none;">${labelValue}</div>
                                </div>
                            `;
                        }
                    },
                    marker: { fillOpacity: 0.95, lineWidth: 1.5, lineColor: 'rgba(255,255,255,0.2)' }
                }
            },
            series: [{ name: 'MarketData', data: filteredBubbleData }]
        });

        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
                chartInstance.current = null;
            }
        };
    }, [filteredBubbleData, mode, bubbleSizes, chartVersion, isFullscreen]);

    const handleModeSwitch = (newMode: 'marketCap' | 'percentChange24h') => {
        setMode(newMode);
        if (newMode === 'marketCap') setIsFullscreen(true);
        setChartVersion(v => v + 1);
    };

    const closeFullscreen = () => {
        setIsFullscreen(false);
        setMode('percentChange24h');
        setChartVersion(v => v + 1);
    };

    const ChartArea = (
        <div className="flex-1 relative bg-black overflow-hidden">
            {/* MARCA D'ÁGUA CENTRALIZADA - 80% ALTURA */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                <img 
                    src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" 
                    alt="Watermark" 
                    className="h-[80%] w-auto object-contain opacity-[0.07] grayscale brightness-200"
                />
            </div>
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none z-0" style={{ backgroundImage: 'radial-gradient(#666 1.2px, transparent 1.2px)', backgroundSize: '100px 100px' }}></div>
            <div ref={chartRef} className="absolute inset-0 w-full h-full z-10 bg-transparent" />
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-black relative overflow-hidden">
            {isFullscreen && (
                <div className="fixed inset-0 z-[2000] bg-black flex flex-col animate-in fade-in duration-600">
                    <div className="flex justify-between items-center px-10 py-6 bg-[#0a0b0c] border-b border-white/10 shrink-0">
                        <div className="flex items-center gap-6">
                            <div className="p-2.5 bg-tech-800 rounded border border-[#dd9933]/60 shadow-xl shadow-orange-500/10">
                                <CircleDashed size={30} className="text-[#dd9933]" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-white uppercase tracking-[0.18em]">{mode === 'marketCap' ? 'Crypto Bubbles Marketcap' : 'Crypto Bubbles Variação'}</h2>
                            </div>
                        </div>
                        <button onClick={closeFullscreen} className="p-3 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-full transition-all border border-white/10 hover:border-red-500/60 group">
                            <X size={34} className="group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>
                    {ChartArea}
                    <div className="h-24 bg-[#0a0b0c] border-t border-white/5 flex items-center justify-center px-10 gap-8">
                        <div className="flex gap-5">
                            {LIMIT_OPTIONS.map(opt => (
                                <button 
                                    key={opt}
                                    onClick={() => { setCoinLimit(opt); setChartVersion(v => v + 1); }}
                                    className={`px-8 py-3 rounded-full text-xs font-black transition-all border ${coinLimit === opt ? 'bg-[#dd9933] text-black border-[#dd9933] shadow-xl shadow-orange-500/30 scale-110' : 'bg-white/5 text-gray-500 border-white/10 hover:text-white'}`}
                                >
                                    {opt} ATIVOS
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {!isFullscreen && (
                <>
                    <div className="flex flex-col z-30 border-b border-white/10 bg-[#0a0b0c]/98 backdrop-blur-2xl shrink-0">
                        <div className="flex justify-between items-center px-4 py-3.5">
                            <div className="flex items-center gap-2">
                                <CircleDashed size={18} className="text-[#dd9933]" />
                                <div className="flex flex-col">
                                    <span className="text-xs font-black uppercase text-white tracking-tight leading-none">Crypto Bubbles</span>
                                    <span className="text-[7px] font-bold text-gray-600 uppercase mt-1">Smart Selection Top Movers</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative group">
                                    <select 
                                        value={coinLimit} 
                                        onChange={(e) => { setCoinLimit(parseInt(e.target.value)); setChartVersion(v => v + 1); }}
                                        className="bg-white/5 border border-white/10 text-[9px] font-black text-gray-400 rounded px-2 py-1.5 outline-none hover:text-white hover:border-[#dd9933] transition-all cursor-pointer appearance-none pr-6"
                                    >
                                        {LIMIT_OPTIONS.map(opt => (
                                            <option key={opt} value={opt} className="bg-[#0a0b0c] text-white">{opt} ATIVOS</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={10} className="absolute right-2 top-2 text-gray-500 pointer-events-none" />
                                </div>
                                <div className="flex bg-white/5 p-0.5 rounded border border-white/10">
                                    <button onClick={() => handleModeSwitch('marketCap')} className={`px-3 py-1 text-[9px] font-black rounded transition-all ${mode === 'marketCap' ? 'bg-[#dd9933] text-black shadow' : 'text-gray-500 hover:text-white'}`}>MARKET CAP</button>
                                    <button onClick={() => handleModeSwitch('percentChange24h')} className={`px-3 py-1 text-[9px] font-black rounded transition-all ${mode === 'percentChange24h' ? 'bg-[#dd9933] text-black shadow' : 'text-gray-500 hover:text-white'}`}>VAR % 24H</button>
                                </div>
                                <button onClick={() => { loadData(); setChartVersion(v => v + 1); }} className={`p-1.5 hover:text-[#dd9933] transition-colors rounded ${isLoading ? 'animate-spin' : ''}`}>
                                    <RefreshCw size={16} className="text-gray-500" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {ChartArea}
                    
                    <div className="h-14 bg-[#0a0b0c] border-t border-white/5 flex flex-col justify-center px-6 z-20 shrink-0">
                         <div className="flex flex-col max-w-lg mx-auto w-full gap-2">
                            <div className="h-3 w-full flex border border-white/5 rounded-full overflow-hidden shadow-inner">
                                {[0, 1, 2, 3, 4].map(idx => (
                                    <button 
                                        key={idx} 
                                        onClick={() => setActiveRanges(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])}
                                        className={`flex-1 transition-all duration-300 relative group ${activeRanges.includes(idx) ? '' : 'grayscale opacity-10'}`}
                                        style={{ backgroundColor: (getBubbleGradient(idx).stops[1][1] as string) }}
                                    >
                                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    </button>
                                ))}
                            </div>
                            <div className="flex justify-between w-full text-[7px] font-black text-gray-700 uppercase tracking-widest">
                                <span>BEARISH</span>
                                <span>QUEDA</span>
                                <span>NEUTRO</span>
                                <span>ALTA</span>
                                <span>BULLISH</span>
                            </div>
                         </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default BubbleHeatmapWidget;
