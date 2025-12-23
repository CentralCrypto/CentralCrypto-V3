
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Layers, RefreshCw, AlertTriangle } from 'lucide-react';
import { fetchTopCoins, isStablecoin } from '../services/api';
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

const HeatmapWidget: React.FC<Props> = ({ item, language = 'pt' }) => {
    const [marketData, setMarketData] = useState<ApiCoin[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [mode, setMode] = useState<'marketCap' | 'percentChange24h'>('marketCap');
    const chartRef = useRef<HTMLDivElement>(null);
    const chartInstance = useRef<any>(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const coins = await fetchTopCoins();
            if (coins && coins.length > 0) {
                const processed = coins
                    .filter(c => c && c.symbol)
                    .filter(c => !isStablecoin(c.symbol))
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
                    }))
                    .sort((a, b) => b.market_cap - a.market_cap)
                    .slice(0, 100);
                
                setMarketData(processed);
            }
        } catch (e) {
            console.error("Heatmap Error:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const getBgColor = (change: number) => {
        if (change >= 3) return 'rgba(8, 153, 129, 0.9)'; 
        if (change >= 1) return 'rgba(11, 191, 155, 0.85)';
        if (change > 0) return 'rgba(27, 67, 61, 0.85)';
        if (change <= -3) return 'rgba(242, 54, 69, 0.9)'; 
        if (change <= -1) return 'rgba(124, 37, 43, 0.85)';
        if (change < 0) return 'rgba(67, 28, 31, 0.85)';
        return 'rgba(54, 58, 69, 0.85)'; 
    };

    useEffect(() => {
        if (!chartRef.current || !window.Highcharts || marketData.length === 0) return;

        if (chartInstance.current) {
            chartInstance.current.destroy();
            chartInstance.current = null;
        }

        const treemapData = marketData.map(coin => {
            const change = coin.price_change_percentage_24h || 0;
            let areaVal = mode === 'marketCap' ? coin.market_cap : Math.abs(change) * 1000000;
            if (areaVal <= 0) areaVal = 1;

            return {
                id: `${coin.symbol}_${coin.id}`,
                name: coin.symbol,
                value: areaVal,
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
                color: getBgColor(change)
            };
        });

        chartInstance.current = window.Highcharts.chart(chartRef.current, {
            chart: {
                type: 'treemap',
                backgroundColor: 'transparent',
                animation: false,
                style: { fontFamily: 'Inter, sans-serif' },
                spacing: [0, 0, 0, 0],
                margin: [0, 0, 0, 0]
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
                style: { zIndex: 9999, color: '#ffffff', pointerEvents: 'none' },
                formatter: function (this: any) {
                    const p = this.point;
                    const changeColor = p.change >= 0 ? '#22c55e' : '#ef4444';
                    return `
                        <div style="padding: 16px; min-width: 320px; color: #ffffff; pointer-events: none; font-family: 'Inter', sans-serif;">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px;">
                                ${p.logo ? `<img src="${p.logo}" style="width: 42px; height: 42px; border-radius: 50%; background: #fff; border: 2px solid #dd9933;">` : ''}
                                <div>
                                    <div style="font-size: 20px; font-weight: 900; line-height: 1;">${p.name}</div>
                                    <div style="font-size: 11px; color: #dd9933; font-weight: 800; text-transform: uppercase; margin-top: 4px;">${p.fullName}</div>
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                                <div>
                                    <div style="font-size: 9px; color: #999; font-weight: bold; text-transform: uppercase;">PREÇO</div>
                                    <div style="font-size: 15px; font-weight: 800;">$${(p.price || 0).toLocaleString()}</div>
                                </div>
                                <div>
                                    <div style="font-size: 9px; color: #999; font-weight: bold; text-transform: uppercase;">VAR 24H</div>
                                    <div style="font-size: 15px; font-weight: 900; color: ${changeColor};">${p.change.toFixed(2)}%</div>
                                </div>
                                <div>
                                    <div style="font-size: 9px; color: #999; font-weight: bold; text-transform: uppercase;">MKT CAP</div>
                                    <div style="font-size: 14px; font-weight: 800; color: #60a5fa;">${formatUSD(p.mkt)}</div>
                                </div>
                                <div>
                                    <div style="font-size: 9px; color: #999; font-weight: bold; text-transform: uppercase;">VOL 24H</div>
                                    <div style="font-size: 14px; font-weight: 800; color: #dd9933;">${formatUSD(p.vol)}</div>
                                </div>
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
            series: [{
                data: treemapData,
                layoutAlgorithm: 'squarified',
                borderColor: 'rgba(0,0,0,0.3)',
                borderWidth: 1,
                dataLabels: {
                    enabled: true,
                    useHTML: true,
                    formatter: function (this: any) {
                        const p = this.point;
                        const w = p.shapeArgs?.width || 0;
                        const h = p.shapeArgs?.height || 0;
                        if (w < 35 || h < 35) return null;
                        
                        const fontSize = Math.min(Math.max(w / 4.8, 10), 34);
                        const subFontSize = Math.max(fontSize * 0.55, 8.5);
                        
                        let logoHtml = '';
                        if (w > 55 && h > 80 && p.logo) {
                            const imgSize = Math.min(Math.max(w * 0.28, 20), 48);
                            logoHtml = `<img src="${p.logo}" style="width: ${imgSize}px; height: ${imgSize}px; border-radius: 50%; margin-bottom: 5px; background: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2);">`;
                        }
                        const displayVal = mode === 'marketCap' ? formatUSD(p.mkt) : `${p.change.toFixed(2)}%`;
                        
                        return `
                            <div style="text-align: center; color: #ffffff; line-height: 1.1; pointer-events: none; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%;">
                                ${logoHtml}
                                <div style="font-size: ${fontSize}px; font-weight: 900; text-shadow: 0 1px 4px rgba(0,0,0,1);">${p.name}</div>
                                <div style="font-size: ${subFontSize}px; font-weight: 800; opacity: 0.9; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">${displayVal}</div>
                            </div>
                        `;
                    },
                    style: { textOutline: 'none' }
                }
            }]
        });

        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
                chartInstance.current = null;
            }
        };
    }, [marketData, mode]);

    return (
        <div className="h-full flex flex-col bg-black relative overflow-hidden">
            {/* MARCA D'ÁGUA CENTRALIZADA - AJUSTADA PARA 0.12 */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                <img 
                    src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" 
                    alt="Watermark" 
                    className="h-[80%] w-auto object-contain opacity-[0.12] grayscale"
                />
            </div>

            <div className="flex flex-col z-30 border-b border-white/10 bg-[#0a0b0c]/90 backdrop-blur-md shrink-0">
                <div className="flex justify-between items-center px-4 py-2.5">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-tech-800 rounded border border-[#dd9933]/30">
                            <Layers size={14} className="text-[#dd9933]" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-black uppercase text-white tracking-tighter">Market Heatmap</span>
                            <span className="text-[8px] font-bold text-gray-500 uppercase">Análise Matricial Completa</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-white/5 p-0.5 rounded border border-white/10">
                            <button onClick={() => setMode('marketCap')} className={`px-3 py-1 text-[9px] font-black rounded transition-all ${mode === 'marketCap' ? 'bg-[#dd9933] text-black shadow' : 'text-gray-500 hover:text-white'}`}>MARKET CAP</button>
                            <button onClick={() => setMode('percentChange24h')} className={`px-3 py-1 text-[9px] font-black rounded transition-all ${mode === 'percentChange24h' ? 'bg-[#dd9933] text-black shadow' : 'text-gray-500 hover:text-white'}`}>VAR % 24H</button>
                        </div>
                        <button onClick={loadData} className={`p-1.5 hover:text-[#dd9933] transition-colors rounded ${isLoading ? 'animate-spin' : ''}`}>
                            <RefreshCw size={14} className="text-gray-500" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 relative bg-transparent overflow-hidden z-10">
                <div ref={chartRef} className="absolute inset-0 w-full h-full" />
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-[100]">
                        <div className="flex items-center gap-2 bg-black/80 border border-[#dd9933]/50 px-4 py-3 rounded-lg shadow-2xl">
                             <Loader2 className="animate-spin text-[#dd9933]" size={20} />
                             <span className="text-[10px] font-black text-white uppercase tracking-widest">Sincronizando Mercado...</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="h-10 bg-[#0a0b0c] border-t border-white/5 flex flex-col justify-center px-6 z-20 shrink-0">
                 <div className="flex items-center justify-between max-w-lg mx-auto w-full gap-4">
                    <div className="flex flex-col gap-0.5 w-full">
                        <div className="h-1.5 w-full rounded-full overflow-hidden flex border border-white/5">
                            <div className="flex-1 bg-[#f23645]"></div>
                            <div className="flex-1 bg-[#7c252b]"></div>
                            <div className="flex-1 bg-[#363a45]"></div>
                            <div className="flex-1 bg-[#1b433d]"></div>
                            <div className="flex-1 bg-[#089981]"></div>
                        </div>
                        <div className="flex justify-between w-full text-[8px] font-black text-gray-600 uppercase">
                            <span>MUITO BEARISH</span><span>QUEDA</span><span>NEUTRO</span><span>ALTA</span><span>MUITO BULLISH</span>
                        </div>
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default HeatmapWidget;
