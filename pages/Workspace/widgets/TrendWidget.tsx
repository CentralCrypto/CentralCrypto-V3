
import React, { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { getTrendAnalysis } from '../services/technicalAnalysis';
import { DashboardItem, Language } from '../../../types';
import { getTranslations } from '../../../locales';

interface Props {
  item: DashboardItem;
  sparkline?: number[];
  language?: Language;
}

const TrendWidget: React.FC<Props> = ({ item, sparkline = [], language = 'pt' }) => {
    const [analysisTimeframe, setAnalysisTimeframe] = useState('1H');
    const t = getTranslations(language as Language).workspace.widgets.trend;

    const resampledSparkline = useMemo(() => {
        const prices = sparkline;
        if (!prices || prices.length === 0) return [];
        const step = analysisTimeframe === '1D' ? 24 : analysisTimeframe === '4H' ? 4 : 1;
        // Ensure we don't filter out everything
        if (prices.length <= step) return prices;
        return prices.filter((_, i) => i % step === 0);
    }, [sparkline, analysisTimeframe]);
    
    const trend = useMemo(() => resampledSparkline.length > 0 ? getTrendAnalysis(resampledSparkline) : null, [resampledSparkline]);

    if (!trend) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-slate-500"/></div>
    }

    const TrendIcon = () => {
        if (trend.status.includes('BUY')) return <TrendingUp size={64} className="text-green-500" />;
        if (trend.status.includes('SELL')) return <TrendingDown size={64} className="text-red-500" />;
        return <Minus size={64} className="text-slate-500" />;
    };
    
    const trendColorClass = () => {
        if (trend.status.includes('BUY')) return 'border-green-500/30 bg-green-500/10';
        if (trend.status.includes('SELL')) return 'border-red-500/30 bg-red-500/10';
        return 'border-slate-500/30 bg-slate-500/10';
    };

    const getLocalizedLabel = () => {
        if (trend.status.includes('BUY')) return t.bullish;
        if (trend.status.includes('SELL')) return t.bearish;
        return t.neutral;
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
                <div className={`p-4 rounded-full border-4 ${trendColorClass()}`}>
                    <TrendIcon />
                </div>
                <div>
                    <div className="text-2xl font-black text-white tracking-tight">{getLocalizedLabel()}</div>
                    <div className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-wider">{t.strength}: <span className="text-[#dd9933] text-base">{trend.strength}</span></div>
                    <div className="text-base font-bold text-slate-400 mt-2">{t.basedOn} <span className="text-white">{analysisTimeframe}</span> data</div>
                </div>
            </div>
        </div>
    );
};

export default TrendWidget;
