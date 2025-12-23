
import React, { useMemo, useState } from 'react';
import { getDetailedSentiment } from '../services/technicalAnalysis';
import { DashboardItem, Language } from '../../../types';
import { Minus, TrendingUp, TrendingDown, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { getTranslations } from '../../../locales';

interface Props {
  item: DashboardItem;
  sparkline?: number[];
  language?: Language;
}

const SentimentWidget: React.FC<Props> = ({ item, sparkline = [], language = 'pt' }) => {
    const [analysisTimeframe, setAnalysisTimeframe] = useState('1H');
    const t = getTranslations(language as Language).workspace.widgets.sentiment;
    const tTrend = getTranslations(language as Language).workspace.widgets.trend;

    const resampledSparkline = useMemo(() => {
        const prices = sparkline;
        if (!prices || prices.length === 0) return [];
        const step = analysisTimeframe === '1D' ? 24 : analysisTimeframe === '4H' ? 4 : 1;
        if (prices.length <= step) return prices;
        return prices.filter((_, i) => i % step === 0);
    }, [sparkline, analysisTimeframe]);
    
    const sentimentDetailed = useMemo(() => resampledSparkline.length > 0 ? getDetailedSentiment(resampledSparkline) : null, [resampledSparkline]);
    
    if (!sentimentDetailed) {
         return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-slate-500"/></div>
    }

    const { rsi: sentRsi, crossUp, isRising } = sentimentDetailed;
    let sentLabel = '', sentColor = '', sentBg = '';
    let SentIcon = Minus;

    if (sentRsi >= 70) {
        sentLabel = crossUp ? `${t.extremeGreed} (${t.strong})` : `${t.extremeGreed} (${t.weak})`;
        sentColor = 'text-green-500'; sentBg = 'bg-green-500/10 border-green-500/30'; SentIcon = TrendingUp;
    } else if (sentRsi >= 60) {
        sentLabel = crossUp ? `${t.greed} (${t.consistent})` : `${t.greed} (${t.easing})`;
        sentColor = 'text-green-400'; sentBg = 'bg-green-400/10 border-green-400/30'; SentIcon = TrendingUp;
    } else if (sentRsi <= 30) {
        sentLabel = crossUp ? `${t.extremeFear} (${t.recovering})` : `${t.extremeFear} (${t.strong})`;
        sentColor = 'text-red-500'; sentBg = 'bg-red-500/10 border-red-500/30'; SentIcon = TrendingDown;
    } else if (sentRsi <= 40) {
        sentLabel = crossUp ? `${t.fear} (${t.easing})` : `${t.fear} (${t.consistent})`;
        sentColor = 'text-red-400'; sentBg = 'bg-red-400/10 border-red-400/30'; SentIcon = TrendingDown;
    } else { // Neutral (41-59)
        sentLabel = crossUp ? t.neutralBiasUp : t.neutralBiasDown;
        sentColor = 'text-slate-400'; sentBg = 'bg-slate-500/10 border-slate-500/30'; SentIcon = Minus;
    }
    
    return (
        <div className="h-full flex flex-col items-center justify-center p-4 relative text-center">
            <div className="absolute top-2 right-2 z-20">
                <select value={analysisTimeframe} onChange={(e) => setAnalysisTimeframe(e.target.value)} className="bg-[#1a1c1e] text-xs text-white border border-slate-600 rounded px-2 py-1">
                    <option value="1H">1H</option>
                    <option value="4H">4H</option>
                    <option value="1D">1D</option>
                </select>
            </div>
            <div className="z-10 flex flex-col items-center gap-2">
                <div className="relative group">
                    <div 
                       className={`p-4 rounded-full border-4 ${sentBg} flex items-center justify-center w-24 h-24`} 
                    >
                       <SentIcon size={64} className={sentColor} />
                    </div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black border border-slate-700 text-white text-xs p-2 rounded z-50 pointer-events-none whitespace-nowrap shadow-xl">
                       <span className="text-[#dd9933] font-bold">RSI:</span> {sentRsi.toFixed(2)} <span className="text-slate-500 mx-1">|</span> <span className="text-blue-400 font-bold">SMA21:</span> {sentimentDetailed.sma.toFixed(2) || 'N/A'}
                    </div>
                </div>
                
                <div className="flex flex-col items-center">
                   <div className={`text-3xl font-black ${sentColor} flex items-center gap-2`}>
                       {sentRsi.toFixed(0)} 
                       {isRising ? <ArrowUp size={24} className="text-green-500" /> : <ArrowDown size={24} className="text-red-500" />}
                   </div>
                   <div className={`text-lg font-bold uppercase tracking-wider ${sentColor}`}>{sentLabel}</div>
                   <div className="text-base font-bold text-slate-400 mt-2">{tTrend.basedOn} <span className="text-white">{analysisTimeframe}</span> data</div>
                </div>
            </div>
        </div>
    );
};

export default SentimentWidget;
