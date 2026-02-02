import React, { useState, useEffect } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { TrumpData, fetchTrumpData } from '../../../services/api';
import { DashboardItem, Language } from '../../../types';
import { getTranslations } from '../../../locales';

const TrumpMeterWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
    const [trumpData, setTrumpData] = useState<TrumpData | null>(null);
    const [animatedImpact, setAnimatedImpact] = useState(0);
    const t = getTranslations(language as Language);
    const tWs = t.workspace.widgets.trump;

    const OFFICIAL_TRUMP_AVATAR = "https://static-assets-1.truthsocial.com/tmtg:prime-ts-assets/accounts/avatars/107/780/257/626/128/497/original/454286ac07a6f6e6.jpeg";

    useEffect(() => {
        fetchTrumpData().then(data => {
            setTrumpData(data);
            if (data) {
                setTimeout(() => {
                    setAnimatedImpact(data.trump_rank_50 || 0);
                }, 100);
            }
        });
    }, []);
    
    const Watermark = () => <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-[0.05] z-0"><img src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" alt="watermark" className="w-3/4 h-auto grayscale filter" /></div>;

    if (!trumpData) {
        return <div className="flex items-center justify-center h-full text-gray-400 dark:text-slate-500"><Loader2 className="animate-spin" /></div>;
    }

    const impactScore = trumpData.trump_rank_50 || 0;
    const impactPercent = ((impactScore + 50) / 100) * 100;
    const impactColor = impactPercent > 60 ? '#009E4F' : impactPercent < 40 ? '#E03A3E' : '#dd9933';
    const ticks = [-50, -30, -15, 0, 15, 30, 50];

    const getTickColor = (tick: number) => {
        if (tick <= -30) return '#E03A3E';
        if (tick < 0) return '#eda05d';
        if (tick === 0) return '#FFD700';
        if (tick <= 30) return '#a4bd29';
        return '#009E4F';
    };

    const ScaleRow = ({ score }: { score: number }) => (
        <div className="relative h-4 w-full mt-2 flex justify-between px-0.5">
            {ticks.map(tick => {
                const isHighlighted = Math.abs(score - tick) < 8;
                return (
                    <span key={tick} className={`text-[8px] font-black font-mono transition-all duration-500 ${isHighlighted ? 'scale-125' : 'opacity-40'}`} style={{ color: getTickColor(tick) }}>
                        {tick > 0 ? '+' : ''}{tick}
                    </span>
                );
            })}
        </div>
    );

    const CustomTooltipBox = () => (
        <div className="absolute inset-0 bg-white dark:bg-[#1a1c1e] opacity-0 group-hover/post:opacity-100 transition-all p-4 overflow-y-auto custom-scrollbar z-[70] shadow-2xl border border-tech-700 rounded-lg translate-y-3 group-hover/post:translate-y-0 duration-300">
            <div className="flex items-center gap-3 mb-3 border-b border-gray-100 dark:border-white/5 pb-2">
                <img src={OFFICIAL_TRUMP_AVATAR} className="w-6 h-6 rounded-full border border-[#dd9933]/50 shadow-md" alt="Trump" />
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-[#dd9933] uppercase tracking-[0.2em] leading-none">Truth Social Intelligence</span>
                    <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest mt-1">Official Post Analysis</span>
                </div>
            </div>
            <p className="text-xs font-bold text-gray-800 dark:text-gray-100 leading-relaxed italic border-l-2 border-[#dd9933] pl-3 py-1">
                "{trumpData.title}"
            </p>
        </div>
    );

    if (item.isMaximized) {
        return (
            <div className="h-full flex flex-col p-6 relative bg-white dark:bg-[#1a1c1e] overflow-hidden">
                <Watermark />
                <div className="flex justify-between items-start mb-2 z-10 border-b border-gray-100 dark:border-white/5 pb-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-tech-800 flex items-center justify-center text-white border-2 border-[#dd9933] shadow-lg overflow-hidden">
                            <img src={OFFICIAL_TRUMP_AVATAR} alt="Trump" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-gray-900 dark:text-white leading-none">Donald J. Trump</h3>
                            <p className="text-[10px] text-[#dd9933] font-black uppercase mt-1 tracking-widest">Real-time Impact Analysis</p>
                        </div>
                    </div>
                    <a href={trumpData.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-tech-800 hover:bg-[#dd9933] hover:text-black text-gray-600 dark:text-gray-300 text-xs font-black uppercase tracking-widest rounded-lg transition-all shadow-sm">
                        {tWs.viewPost} <ExternalLink size={14} />
                    </a>
                </div>

                <div className="flex-1 flex flex-col items-center z-10 pt-4">
                    <div className="w-full max-w-2xl mb-4 relative px-6">
                        <div className="h-4 bg-gradient-to-r from-[#E03A3E] via-[#FFD700] to-[#009E4F] rounded-full shadow-inner relative overflow-hidden">
                             {ticks.map((val) => (
                                 <div key={val} className="absolute top-0 bottom-0 w-0.5 bg-black/10" style={{left: `${(val+50)}%`}}></div>
                             ))}
                        </div>
                        <div className="absolute top-[-10px] transition-all duration-1000 ease-out z-20" style={{ left: `calc(${impactPercent}% - 8px)` }}>
                            <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[14px] border-t-gray-900 dark:border-t-white drop-shadow-lg"></div>
                        </div>
                        <ScaleRow score={animatedImpact} />
                    </div>

                    <div className="text-[60px] leading-none font-black tracking-tighter drop-shadow-2xl transition-colors duration-500 mb-2" style={{color: impactColor}}>
                            {animatedImpact > 0 ? '+' : ''}{animatedImpact}
                    </div>

                    <div className="text-xl font-black uppercase tracking-[0.2em] mb-6 text-center px-4" style={{color: impactColor}}>
                        {trumpData.sarcastic_label}
                    </div>

                    <div className="w-full max-w-3xl p-6 border-2 border-dashed rounded-2xl bg-gray-50/50 dark:bg-black/20 relative flex-1 min-h-0 overflow-y-auto group/post" style={{ borderColor: impactColor }}>
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-white dark:bg-[#1a1c1e] px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Official Post Text</div>
                        <p className="text-center text-lg text-gray-800 dark:text-slate-200 font-bold leading-relaxed italic">
                            "{trumpData.title}"
                        </p>
                        <CustomTooltipBox />
                    </div>
                </div>
            </div>
        );
    }
    
    return (
        <div className="h-full flex flex-col p-3 relative bg-white dark:bg-[#2f3032] overflow-hidden">
            <Watermark />
            <div className="flex justify-between items-center z-10 mb-2">
                <div className="flex items-center gap-2">
                    <img src={OFFICIAL_TRUMP_AVATAR} className="w-5 h-5 rounded-full border border-[#dd9933]/50 shadow-sm" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Sentiment Impact</span>
                </div>
                <a href={trumpData.link} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#dd9933] transition-colors"><ExternalLink size={12} /></a>
            </div>
            
            <div className="px-2 mt-4 relative">
                <div className="relative h-2 w-full bg-gray-100 dark:bg-tech-950 rounded-full mb-1 overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#E03A3E] via-yellow-500 to-[#009E4F] w-full opacity-30"></div>
                    <div className="absolute top-[-8px] transition-all duration-1000 ease-out z-20" style={{ left: `calc(${impactPercent}% - 5px)` }}>
                         <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[8px] border-t-gray-800 dark:border-t-white drop-shadow-sm"></div>
                    </div>
                </div>
                <ScaleRow score={animatedImpact} />
            </div>

            <div className="text-center mb-1 mt-2">
                 <div className="text-[11px] font-black uppercase tracking-tight" style={{color: impactColor}}>
                    {trumpData.sarcastic_label}
                 </div>
                 <div className="text-[20px] font-black tracking-tighter" style={{color: impactColor}}>
                    {animatedImpact > 0 ? '+' : ''}{animatedImpact}
                 </div>
            </div>

            <div className="flex-1 min-h-0 relative border border-dashed border-gray-200 dark:border-slate-700/50 rounded-lg p-2 bg-gray-50/50 dark:bg-black/10 overflow-hidden group/post">
                <p className="text-[11px] text-gray-600 dark:text-slate-300 font-bold leading-snug line-clamp-3 italic">"{trumpData.title}"</p>
                <CustomTooltipBox />
            </div>
        </div>
    );
};

export default TrumpMeterWidget;
