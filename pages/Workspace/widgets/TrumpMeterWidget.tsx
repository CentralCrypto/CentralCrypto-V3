
import React, { useState, useEffect } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { TrumpData, fetchTrumpData } from '../services/api';
import { DashboardItem, Language } from '../../../types';
import { getTranslations } from '../../../locales';

const getSarcasticQualification = (dir: string, mag: string, t: any): string => {
    const sarcastic = t.dashboard.widgets.trump.sarcastic;

    if (dir === 'negative') {
        if (mag === 'Small') return sarcastic.negativeSmall;
        if (mag === 'Medium') return sarcastic.negativeMedium;
        if (mag === 'Large') return sarcastic.negativeLarge;
    }
    if (dir === 'positive') {
        if (mag === 'Small') return sarcastic.positiveSmall;
        if (mag === 'Medium') return sarcastic.positiveMedium;
        if (mag === 'Large') return sarcastic.positiveLarge;
    }
    return sarcastic.neutral;
};


const TrumpMeterWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
    const [trumpData, setTrumpData] = useState<TrumpData | null>(null);
    const [animatedImpact, setAnimatedImpact] = useState(0);
    const t = getTranslations(language as Language);
    const tWs = t.workspace.widgets.trump;

    useEffect(() => {
        fetchTrumpData().then(data => {
            setTrumpData(data);
            if (data) {
                setTimeout(() => {
                    setAnimatedImpact(data.impact_value || 0);
                }, 100);
            }
        });
    }, []);
    
    const Watermark = () => <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-[0.05] z-0"><img src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" alt="watermark" className="w-3/4 h-auto grayscale filter" /></div>;

    if (!trumpData) {
        return <div className="flex items-center justify-center h-full text-gray-400 dark:text-slate-500"><Loader2 className="animate-spin" /></div>;
    }

    const impactColor = trumpData.impact_color || '#dd9933';
    const customQualification = getSarcasticQualification(trumpData.impact_direction, trumpData.impact_magnitude, t);
    
    // Calculate percentage for the indicator (Range -50 to 50 maps to 0% to 100%)
    const getPct = (val: number) => Math.max(0, Math.min(100, ((val + 50) / 100) * 100));
    
    // UPDATED SCALE AS REQUESTED
    const ticks = [-50, -30, -15, 0, 15, 30, 50];

    // MAXIMIZED VIEW
    if (item.isMaximized) {
        return (
            <div className="h-full flex flex-col p-6 relative bg-white dark:bg-[#2f3032] overflow-hidden">
                <Watermark />
                
                {/* 1. Header (User Info) */}
                <div className="flex justify-between items-start mb-2 flex-shrink-0 z-10 border-b border-gray-100 dark:border-gray-700/50 pb-2">
                    <div className="flex items-center gap-2">
                        <img src={trumpData.image_url} alt={trumpData.author_name} className="w-10 h-10 rounded-full border-2 border-gray-300 dark:border-slate-600"/>
                        <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">{trumpData.author_name}</h3>
                            <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold">Truth Social</p>
                        </div>
                    </div>
                    <a href={trumpData.post_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-slate-700/50 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 text-xs font-bold uppercase tracking-wide rounded transition-colors">
                        {tWs.viewPost} <ExternalLink size={12} />
                    </a>
                </div>

                <div className="flex-1 flex flex-col items-center z-10 min-h-0 overflow-y-auto custom-scrollbar pt-2">
                    
                    {/* 2. SCALE BAR (TOP) */}
                    <div className="w-full max-w-3xl mb-2 relative px-6 mt-4">
                        <div className="h-4 bg-gradient-to-r from-[#E03A3E] via-[#dd9933] to-[#009E4F] rounded-full shadow-inner relative">
                             {ticks.map((val) => (
                                 <div key={val} className="absolute top-0 bottom-0 w-0.5 bg-black/20 dark:bg-white/30" style={{left: `${getPct(val)}%`}}></div>
                             ))}
                        </div>
                        <div className="absolute top-[-8px] transition-all duration-1000 ease-out will-change-left z-20" style={{ left: `calc(${getPct(animatedImpact)}% - 8px)` }}>
                            <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[12px] border-t-gray-900 dark:border-t-white drop-shadow-md"></div>
                        </div>
                        <div className="relative h-6 mt-1 w-full">
                            {ticks.map((val) => (
                                <div key={val} className="absolute text-[10px] font-bold text-gray-500 dark:text-slate-400 font-mono transform -translate-x-1/2" style={{left: `${getPct(val)}%`}}>
                                    {val > 0 ? '+' : ''}{val}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 3. BIG NUMBER (CENTERED) - REDUCED SIZE */}
                    <div className="text-[100px] leading-none font-black tracking-tighter drop-shadow-2xl transition-colors duration-500 -mt-2 mb-0" style={{color: impactColor}}>
                            {animatedImpact > 0 ? '+' : ''}{animatedImpact}
                    </div>

                    {/* 4. RANK TEXT (BELOW NUMBER) */}
                    <div className="text-2xl font-black uppercase tracking-widest opacity-100 transition-colors duration-500 text-center px-4 leading-none" style={{color: impactColor}}>
                        {customQualification}
                    </div>

                    {/* 5. DOTTED BOX (EXACT 10px MARGIN FROM RANK) */}
                    <div 
                        className="w-full max-w-4xl p-6 border-2 border-dashed rounded-xl bg-gray-50/80 dark:bg-black/30 mt-[10px] relative"
                        style={{ borderColor: impactColor }}
                    >
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white dark:bg-[#2f3032] px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            Official Post Content
                        </div>
                        <p className="text-center text-lg md:text-xl text-gray-800 dark:text-slate-200 font-medium leading-relaxed italic">
                            "{trumpData.post_text}"
                        </p>
                    </div>

                </div>
            </div>
        );
    }
    
    // MINIMIZED VIEW
    return (
        <div className="h-full flex flex-col p-2 relative bg-white dark:bg-[#2f3032] overflow-hidden">
            <Watermark />

            {/* 1. Header Small */}
            <div className="flex justify-between items-start z-10 flex-shrink-0 mb-1 h-6">
                <div className="flex items-center gap-2">
                    <img src={trumpData.image_url} alt="Trump" className="w-6 h-6 rounded-full border border-gray-300 dark:border-slate-600" />
                    <div className="text-left">
                        <h3 className="text-[10px] font-bold text-gray-900 dark:text-white truncate max-w-[80px]">{trumpData.author_name}</h3>
                    </div>
                </div>
                <a href={trumpData.post_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#dd9933]">
                    <ExternalLink size={12} />
                </a>
            </div>

            {/* 2. SCALE BAR (TOP of Content) - With Numbers */}
            <div className="w-full relative mt-2 mb-4 z-10 flex-shrink-0">
                <div className="h-2 bg-gradient-to-r from-[#E03A3E] via-[#dd9933] to-[#009E4F] rounded-full w-full relative">
                     {ticks.map((val) => (
                         <div key={val} className="absolute top-0 bottom-0 w-px bg-black/20 dark:bg-white/30" style={{left: `${getPct(val)}%`}}></div>
                     ))}
                </div>
                <div 
                    className="absolute top-[-3px]" 
                    style={{ 
                        left: `calc(${(animatedImpact + 50)}% - 4px)`,
                        transition: 'left 1.2s cubic-bezier(0.25, 1, 0.5, 1)'
                    }}
                >
                    <div className="w-0 h-0 
                        border-l-[4px] border-l-transparent
                        border-r-[4px] border-r-transparent
                        border-t-[6px] border-t-gray-800 dark:border-t-white">
                    </div>
                </div>
                {/* Scale Numbers */}
                <div className="relative h-3 w-full mt-1">
                    {ticks.map((t, i) => {
                        // Only show specific labels if needed, but requested all
                        return (
                            <div key={t} className="absolute text-[7px] font-bold text-gray-500 dark:text-slate-500 transform -translate-x-1/2" style={{left: `${getPct(t)}%`}}>
                                {t}
                            </div>
                        )
                    })}
                </div>
            </div>
            
            {/* 3. NUMBER (CENTER) */}
            <div className="text-center z-10 flex-shrink-0 flex items-center justify-center mt-0 mb-0">
                 <span className="text-4xl font-black tracking-tighter leading-none" style={{color: impactColor}}>
                    {animatedImpact > 0 ? '+' : ''}{animatedImpact}
                 </span>
            </div>

            {/* 4. RANK (BELOW NUMBER) */}
            <div className="text-center z-10 flex-shrink-0 mb-2">
                 <div className="text-[9px] font-black uppercase tracking-wider leading-none truncate max-w-full opacity-90" style={{color: impactColor}}>
                    {customQualification}
                 </div>
            </div>

            {/* 5. POST BOX (10px MARGIN) - Larger Font */}
            <div className="flex-1 z-10 min-h-0 relative mt-1">
                <div 
                    className="absolute inset-0 p-2 border border-dashed rounded-lg overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-black/20 hover:bg-gray-100 dark:hover:bg-black/30 transition-colors"
                    style={{ borderColor: impactColor }}
                >
                    <p className="text-left text-xs text-gray-800 dark:text-slate-300 whitespace-pre-wrap leading-snug font-medium">
                        {trumpData.post_text}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default TrumpMeterWidget;
