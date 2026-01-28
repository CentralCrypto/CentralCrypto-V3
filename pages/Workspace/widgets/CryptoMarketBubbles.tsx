import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CircleDashed, RefreshCw, ChevronDown, X, Maximize2, Minimize2 } from 'lucide-react';
import { fetchTopCoins } from '../services/api';
import { DashboardItem, Language, ApiCoin } from '../../../types';
import Highcharts from 'highcharts';
import addHighchartsMore from 'highcharts/highcharts-more';
import { createPortal } from 'react-dom';

// Initialize Highcharts module
if (typeof addHighchartsMore === 'function') {
    (addHighchartsMore as any)(Highcharts);
}

interface Props {
  item?: DashboardItem;
  language?: Language;
  isWidget?: boolean;
  onClose?: () => void;
}

const formatUSD = (val: number) => {
    if (!val || val === 0) return "$0";
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
};

const LIMIT_OPTIONS = [50, 100, 150, 200, 250];

const CryptoMarketBubbles: React.FC<Props> = ({ item, language = 'pt', isWidget = false, onClose }) => {
    const [marketPool, setMarketPool] = useState<ApiCoin[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [mode, setMode] = useState<'marketCap' | 'percentChange24h'>('percentChange24h');
    const [activeRanges, setActiveRanges] = useState<number[]>([0, 1, 2, 3, 4]); 
    const [coinLimit, setCoinLimit] = useState(50);
    const [chartVersion, setChartVersion] = useState(0);
    
    // Internal fullscreen state for page mode
    const [isFullscreen, setIsFullscreen] = useState(false);
    
    // If it's a widget, maximized state comes from item
    const isMaximized = item?.isMaximized || isFullscreen;

    const chartRef = useRef<HTMLDivElement>(null);
    const chartInstance = useRef<any>(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const coins = await fetchTopCoins();
            if (coins && coins.length > 0) {
                // Ensure data structure
                const processed = coins.filter(c => c && c.symbol).map(c => ({
                    ...c,
                    symbol: (c.symbol || '').toUpperCase(),
                    name: c.name || c.symbol,
                    current_price: c.current_price || 0,
                    price_change_percentage_24h: c.price_change_percentage_24h || 0,
                    market_cap: c.market_cap || 0,
                    total_volume: c.total_volume || 0
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
        // Estimate chart size
        const width = isMaximized ? window.innerWidth : (chartRef.current?.clientWidth || 800);
        const height = isMaximized ? window.innerHeight - 200 : (chartRef.current?.clientHeight || 600);
        
        const totalArea = width * height;
        const targetUsage = 0.90; 
        const availableArea = totalArea * targetUsage;
        
        const avgAreaPerBubble = availableArea / Math.max(1, coinLimit);
        const avgRadius = Math.sqrt(avgAreaPerBubble / Math.PI);
        
        const maxRadius = Math.floor(avgRadius * 3.8); 
        const minRadius = Math.floor(avgRadius * 0.35);

        return { 
            min: `${Math.max(minRadius, 15)}px`, 
            max: `${Math.max(maxRadius, 60)}px` 
        };
    }, [coinLimit, isMaximized, chartVersion]);

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
        if (!chartRef.current || !Highcharts || filteredBubbleData.length === 0) return;

        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        chartInstance.current = Highcharts.chart(chartRef.current, {
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
                borderRadius: 20,
                shadow: true,
                padding: 0,
                style: { pointerEvents: 'none', zIndex: 9999 },
                formatter: function (this: any) {
                    const p = this.point;
                    const changeColor = p.change >= 0 ? '#22c55e' : '#ef4444';
                    return `
                        <div style="padding: 20px; min-width: 360px; color: #ffffff; pointer-events: none; font-family: Inter, sans-serif;">
                            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px; border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 16px;">
                                ${p.logo ? `<img src="${p.logo}" style="width: 52px; height: 52px; border-radius: 50%; background: #fff; border: 3px solid #dd9933;">` : ''}
                                <div>
                                    <div style="font-size: 24px; font-weight: 900; line-height: 1;">${p.name}</div>
                                    <div style="font-size: 13px; color: #dd9933; font-weight: 800; text-transform: uppercase; margin-top: 5px; tracking-widest: 1px;">${p.fullName}</div>
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                                <div><div style="font-size: 10px; color: #999; font-weight: bold; text-transform: uppercase;">PREÇO</div><div style="font-size: 18px; font-weight: 900;">$${(p.price || 0).toLocaleString()}</div></div>
                                <div><div style="font-size: 10px; color: #999; font-weight: bold; text-transform: uppercase;">VAR 24H</div><div style="font-size: 18px; font-weight: 1000; color: ${changeColor};">${p.change.toFixed(2)}%</div></div>
                                <div><div style="font-size: 10px; color: #999; font-weight: bold; text-transform: uppercase;">MKT CAP</div><div style="font-size: 17px; font-weight: 900; color: #60a5fa;">${formatUSD(p.mkt)}</div></div>
                                <div><div style="font-size: 10px; color: #999; font-weight: bold; text-transform: uppercase;">VOL 24H</div><div style="font-size: 17px; font-weight: 900; color: #dd9933;">${formatUSD(p.vol)}</div></div>
                            </div>

                            <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08);">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 12px;">
                                    <div><div style="font-size: 9px; color: #666; font-weight: 900; text-transform: uppercase;">HIGH 24H</div><div style="font-size: 13px; font-weight: 800; color: #22c55e;">$${(p.high24 || 0).toLocaleString()}</div></div>
                                    <div><div style="font-size: 9px; color: #666; font-weight: 900; text-transform: uppercase;">LOW 24H</div><div style="font-size: 13px; font-weight: 800; color: #ef4444;">$${(p.low24 || 0).toLocaleString()}</div></div>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                    <div><div style="font-size: 9px; color: #666; font-weight: 900; text-transform: uppercase;">ALL TIME HIGH</div><div style="font-size: 13px; font-weight: 800; color: #fff;">$${(p.ath || 0).toLocaleString()}</div><div style="font-size: 10px; font-weight: 1000; color: #ef4444;">${p.ath_p?.toFixed(1)}% (DROP)</div></div>
                                    <div><div style="font-size: 9px; color: #666; font-weight: 900; text-transform: uppercase;">ALL TIME LOW</div><div style="font-size: 13px; font-weight: 800; color: #fff;">$${(p.atl || 0).toLocaleString()}</div><div style="font-size: 10px; font-weight: 1000; color: #22c55e;">+${p.atl_p?.toFixed(0)}% (PUMP)</div></div>
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
                        bubblePadding: 18, 
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
                            if (r < 16) return `<div style="font-size: 9px; font-weight: 1000; color: #fff; text-shadow: 0 1px 3px #000; pointer-events: none;">${p.name}</div>`;
                            const logoSize = Math.min(Math.max(r * 0.62, 14), 130);
                            const fontSize = Math.min(Math.max(r * 0.55, 10), 64);
                            const subSize = Math.max(fontSize * 0.6, 9);
                            return `
                                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; pointer-events: none; user-select: none; width: 100%;">
                                    ${p.logo && r > 28 ? `<img src="${p.logo}" style="width: ${logoSize}px; height: ${logoSize}px; border-radius: 50%; background: #fff; border: 2px solid rgba(255,255,255,0.6); margin-bottom: 4px; pointer-events: none; -webkit-user-drag: none;">` : ''}
                                    <div style="font-size: ${fontSize}px; font-weight: 1000; color: #ffffff; text-shadow: 0 2px 10px rgba(0,0,0,1); line-height: 0.9; pointer-events: none;">${p.name}</div>
                                    <div style="font-size: ${subSize}px; font-weight: 900; color: #ffffff; opacity: 0.98; text-shadow: 0 2px 6px rgba(0,0,0,1); pointer-events: none; margin-top: 2px;">${labelValue}</div>
                                </div>
                            `;
                        }
                    },
                    marker: { fillOpacity: 1, lineWidth: 2, lineColor: 'rgba(255,255,255,0.3)' }
                }
            },
            series: [{ name: 'MarketData', data: filteredBubbleData }]
        } as any);

        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
                chartInstance.current = null;
            }
        };
    }, [filteredBubbleData, mode, bubbleSizes, chartVersion, isMaximized]);

    const handleModeSwitch = (newMode: 'marketCap' | 'percentChange24h') => {
        setMode(newMode);
        setChartVersion(v => v + 1);
    };

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
        setChartVersion(v => v + 1);
        if (onClose && isFullscreen) onClose(); // Trigger close if exiting fullscreen in page mode
    };

    const ChartArea = (
        <div className="flex-1 relative bg-black overflow-hidden">
            <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#888 1.5px, transparent 1.5px)', backgroundSize: '120px 120px' }}></div>
            <div ref={chartRef} className="absolute inset-0 w-full h-full" />
        </div>
    );

    // Fullscreen View (Widget Max or Page)
    if (isMaximized) {
        // If it's a page component (not widget), we use portal to cover everything if fullscreen requested
        // OR if it is already in a dedicated page route, we render inline.
        // `isWidget` flag tells us if we are inside the grid.
        
        const content = (
            <div className={`flex flex-col bg-black ${isWidget ? 'absolute inset-0' : 'fixed inset-0 z-[2000]'} animate-in fade-in duration-600`}>
                <div className="flex justify-between items-center px-6 py-4 bg-[#0a0b0c] border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-tech-800 rounded-lg border border-[#dd9933]/60 shadow-lg shadow-orange-500/10">
                            <CircleDashed size={24} className="text-[#dd9933]" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white uppercase tracking-[0.1em]">{mode === 'marketCap' ? 'Bubbles Marketcap' : 'Bubbles Variação'}</h2>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                         <div className="hidden md:flex bg-white/5 p-0.5 rounded border border-white/10">
                            <button onClick={() => handleModeSwitch('marketCap')} className={`px-4 py-2 text-xs font-black rounded transition-all ${mode === 'marketCap' ? 'bg-[#dd9933] text-black shadow' : 'text-gray-500 hover:text-white'}`}>MARKET CAP</button>
                            <button onClick={() => handleModeSwitch('percentChange24h')} className={`px-4 py-2 text-xs font-black rounded transition-all ${mode === 'percentChange24h' ? 'bg-[#dd9933] text-black shadow' : 'text-gray-500 hover:text-white'}`}>VAR % 24H</button>
                        </div>
                        
                        {!isWidget && (
                            <button onClick={onClose} className="p-2 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-full transition-all border border-white/10 hover:border-red-500/60 group">
                                <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                            </button>
                        )}
                    </div>
                </div>
                
                {ChartArea}
                
                <div className="h-20 bg-[#0a0b0c] border-t border-white/5 flex items-center justify-center px-6 gap-6 shrink-0">
                    {LIMIT_OPTIONS.map(opt => (
                        <button 
                            key={opt}
                            onClick={() => { setCoinLimit(opt); setChartVersion(v => v + 1); }}
                            className={`px-6 py-2 rounded-full text-xs font-black transition-all border ${coinLimit === opt ? 'bg-[#dd9933] text-black border-[#dd9933] shadow-lg shadow-orange-500/30' : 'bg-white/5 text-gray-500 border-white/10 hover:text-white'}`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            </div>
        );

        if (!isWidget) {
            return createPortal(content, document.body);
        }
        return content;
    }

    // Minimized / Grid Widget View
    return (
        <div className="h-full flex flex-col bg-black relative overflow-hidden">
            <div className="flex flex-col z-30 border-b border-white/10 bg-[#0a0b0c]/98 backdrop-blur-2xl shrink-0">
                <div className="flex justify-between items-center px-4 py-2">
                    <div className="flex items-center gap-2">
                        <CircleDashed size={18} className="text-[#dd9933]" />
                        <span className="text-xs font-black uppercase text-white tracking-tight">Bubbles</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <select 
                            value={coinLimit} 
                            onChange={(e) => { setCoinLimit(parseInt(e.target.value)); setChartVersion(v => v + 1); }}
                            className="bg-white/5 border border-white/10 text-[10px] font-black text-gray-400 rounded px-2 py-1 outline-none hover:text-white transition-all cursor-pointer"
                        >
                            {LIMIT_OPTIONS.map(opt => (
                                <option key={opt} value={opt} className="bg-[#0a0b0c] text-white">{opt}</option>
                            ))}
                        </select>
                        <button onClick={() => handleModeSwitch(mode === 'marketCap' ? 'percentChange24h' : 'marketCap')} className="p-1.5 hover:text-[#dd9933] text-gray-500 transition-colors">
                            {mode === 'marketCap' ? '$' : '%'}
                        </button>
                    </div>
                </div>
            </div>

            {ChartArea}
            
            <div className="h-10 bg-[#0a0b0c] border-t border-white/5 flex flex-col justify-center px-4 z-20 shrink-0">
                 <div className="flex flex-col w-full gap-1">
                    <div className="h-2 w-full flex border border-white/5 rounded-full overflow-hidden shadow-inner">
                        {[0, 1, 2, 3, 4].map(idx => (
                            <button 
                                key={idx} 
                                onClick={() => setActiveRanges(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])}
                                className={`flex-1 transition-all duration-300 relative group ${activeRanges.includes(idx) ? '' : 'grayscale opacity-10'}`}
                                style={{ backgroundColor: (getBubbleGradient(idx).stops[1][1] as string) }}
                            />
                        ))}
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default CryptoMarketBubbles;
