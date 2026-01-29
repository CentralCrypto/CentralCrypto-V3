
import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceArea, Brush } from 'recharts';
import { FngData, fetchFearAndGreed } from '../services/api';
import { DashboardItem, Language } from '../../../types';
import { getTranslations } from '../../../locales';

const FearGreedWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
    const [fngData, setFngData] = useState<FngData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    
    const t = getTranslations(language as Language).dashboard.widgets.fng;
    const tTime = getTranslations(language as Language).dashboard.widgets.time;

    useEffect(() => {
        setLoading(true);
        fetchFearAndGreed().then(data => {
            if (Array.isArray(data) && data.length > 0) {
                setFngData(data);
                setError(false);
            } else {
                setError(true);
            }
            setLoading(false);
        }).catch(() => {
            setError(true);
            setLoading(false);
        });
    }, []);

    const getClassification = (val: number): string => {
        if (val <= 25) return t.s0; 
        if (val <= 45) return t.s1; 
        if (val <= 55) return t.s2; 
        if (val <= 75) return t.s3; 
        if (val <= 94) return t.s4; 
        return t.s5; 
    };

    const CustomFngTick = ({ x, y, payload }: any) => {
        const label = getClassification(payload.value);
        return <text x={x} y={y} dy={4} textAnchor="start" className="fill-gray-500 dark:fill-slate-400" fontSize={10} fontStyle="italic" fontWeight="900" style={{ textTransform: 'uppercase' }}>{label}</text>;
    };

    const CustomXAxisTick = ({ x, y, payload }: any) => { 
        const date = new Date(payload.value); 
        return (<g transform={`translate(${x},${y})`}><text x={0} y={0} dy={12} textAnchor="middle" className="fill-gray-500 dark:fill-slate-400" fontSize={11} fontWeight="bold">{date.toLocaleDateString(language, {month:'short', day:'numeric'})}</text></g>); 
    };

    const fgSeries = useMemo(() => {
        return fngData.map(d => ({ 
            date: Number(d.timestamp) * 1000, 
            value: parseInt(d.value, 10),
            label: getClassification(parseInt(d.value, 10))
        })).filter(p => !isNaN(p.date) && !isNaN(p.value)).sort((a, b) => a.date - b.date);
    }, [fngData, language, t]);

    const Watermark = () => <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-[0.05] z-0"><img src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" alt="watermark" className="w-3/4 h-auto grayscale filter" /></div>;

    if (loading) return <div className="flex items-center justify-center h-full text-gray-400"><Loader2 className="animate-spin" /></div>;
    if (error || !fngData.length) return <div className="flex flex-col items-center justify-center h-full text-gray-400"><AlertTriangle className="mb-2" size={24} />Data Unavailable</div>;

    const currentPoint = fngData[0];
    const fgValue = parseInt(currentPoint.value);
    const fgLabel = getClassification(fgValue);
    const rotation = -90 + (fgValue / 100) * 180;

    const fgYesterday = fngData[1]?.value || '--';
    const fgWeek = fngData[7]?.value || '--';
    const fgMonth = fngData[30]?.value || '--';

    if (item.isMaximized) {
        return (
            <div className="h-full flex flex-col relative bg-white dark:bg-[#1a1c1e] overflow-hidden">
                <Watermark />
                <div className="z-10 flex flex-col lg:flex-row items-center justify-center gap-16 p-8 mb-4 shrink-0 animate-in fade-in duration-500">
                    <div className="w-full max-w-[280px] flex flex-col items-center">
                        <svg viewBox="0 0 200 130" className="w-full overflow-visible">
                            <defs>
                                <linearGradient id="fngGradFull" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#CD534B" />
                                    <stop offset="50%" stopColor="#FFD700" />
                                    <stop offset="100%" stopColor="#548f3f" />
                                </linearGradient>
                            </defs>
                            <path d="M 35 75 A 65 65 0 0 1 165 75" fill="none" stroke="currentColor" className="text-gray-200 dark:text-tech-800" strokeWidth={10} strokeLinecap="round" />
                            <path d="M 35 75 A 65 65 0 0 1 165 75" fill="none" stroke="url(#fngGradFull)" strokeWidth={10} strokeLinecap="round" />
                            <g transform={`rotate(${rotation} 100 75)`}>
                                <path d="M 100 75 L 100 15" className="stroke-gray-900 dark:stroke-white" strokeWidth="4" strokeLinecap="round" />
                                <circle cx={100} cy={75} r="6" className="fill-gray-900 dark:fill-white" />
                            </g>
                            <text x={100} y={105} textAnchor="middle" className="fill-gray-900 dark:fill-[#dd9933]" fontSize="38" fontWeight="1000" fontFamily="monospace">{fgValue}</text>
                            <text x={100} y={122} textAnchor="middle" className="fill-gray-600 dark:fill-gray-300" fontSize="8" fontWeight="1000" letterSpacing="1" style={{ textTransform: 'uppercase' }}>{fgLabel}</text>
                        </svg>
                    </div>
                    <div className="flex flex-wrap justify-center gap-6">
                        {[
                            { label: tTime.yesterday, val: fgYesterday, sub: getClassification(parseInt(fgYesterday)) },
                            { label: tTime.d7, val: fgWeek, sub: getClassification(parseInt(fgWeek)) },
                            { label: tTime.d30, val: fgMonth, sub: getClassification(parseInt(fgMonth)) }
                        ].map((card, i) => (
                            <div key={i} className="bg-gray-5 dark:bg-tech-900 border border-gray-100 dark:border-tech-800 p-6 rounded-2xl w-44 text-center shadow-xl">
                                <div className="text-xs font-black text-gray-400 uppercase mb-2 tracking-widest">{card.label}</div>
                                <div className="text-4xl font-black text-[#dd9933] mb-2">{card.val}</div>
                                <div className="text-[10px] font-black text-gray-500 uppercase leading-tight tracking-wider">{card.sub}</div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="flex-1 min-h-0 w-full z-10 relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={fgSeries} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                            <defs><linearGradient id="gradFg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#dd9933" stopOpacity={0.4}/><stop offset="95%" stopColor="#dd9933" stopOpacity={0}/></linearGradient></defs>
                            <ReferenceArea y1={0} y2={25} fill="#CD534B" fillOpacity={0.06} />
                            <ReferenceArea y1={75} y2={100} fill="#548f3f" fillOpacity={0.08} />
                            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-slate-700" opacity={0.15} />
                            <XAxis dataKey="date" type="number" domain={['dataMin', 'dataMax']} tick={<CustomXAxisTick />} minTickGap={60} hide={!item.isMaximized} />
                            <YAxis orientation="right" domain={[0, 100]} tick={<CustomFngTick />} ticks={[12, 35, 50, 65, 85, 97]} width={140} axisLine={false} tickLine={false} />
                            <Tooltip content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const d = payload[0].payload;
                                    return (
                                        <div className="bg-white dark:bg-[#1a1c1e] border border-gray-200 dark:border-gray-700 p-5 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                                            <p className="text-gray-500 font-black text-xs uppercase mb-3 border-b border-gray-100 dark:border-white/5 pb-2">{new Date(d.date).toLocaleDateString(language)}</p>
                                            <div className="flex items-end gap-4"><span className="text-5xl font-black text-[#dd9933] leading-none">{d.value}</span><span className="text-sm font-black uppercase text-gray-900 dark:text-white">{d.label}</span></div>
                                        </div>
                                    );
                                }
                                return null;
                            }} />
                            <Area type="monotone" dataKey="value" stroke="#dd9933" fill="url(#gradFg)" strokeWidth={1} activeDot={{ r: 6, fill: '#dd9933', stroke: '#fff', strokeWidth: 1 }} />
                            <Brush dataKey="date" height={35} stroke="#dd9933" fill="transparent" tickFormatter={() => ''} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }
    
    return (
        <div className="h-full flex flex-col justify-center gap-1 p-2 relative text-center bg-white dark:bg-[#2f3032]">
            <Watermark />
            <div className="flex items-center justify-center relative mt-3 z-10">
                <svg viewBox="0 0 200 110" className="w-[85%] max-w-[280px]">
                    <defs>
                        <linearGradient id="lsr-grad-main" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#CD534B" />
                            <stop offset="50%" stopColor="#dd9933" />
                            <stop offset="100%" stopColor="#548f3f" />
                        </linearGradient>
                    </defs>
                    <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" className="stroke-[#eeeeee] dark:stroke-[#333]" strokeWidth="18" strokeLinecap="round"/>
                    <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="url(#lsr-grad-main)" strokeWidth="18" strokeDasharray={`${(fgValue/100)*283} 283`} strokeLinecap="round" />
                    <g transform={`rotate(${rotation} 100 100)`}>
                        <path d="M 100 100 L 100 20" className="stroke-gray-800 dark:stroke-white" strokeWidth="3" /><circle cx={100} cy={100} r="5" className="fill-gray-800 dark:fill-white" />
                    </g>
                </svg>
            </div>
            {/* Margem ajustada: mt-2 para dar "respiro" entre o ponteiro e o número */}
            <div className="flex flex-col items-center mt-2 z-10">
                <div className="text-3xl font-black text-[#dd9933] leading-none font-mono tracking-tighter">{fgValue}</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white uppercase mt-0.5">{fgLabel}</div>
            </div>
            <div className="flex justify-around w-full mt-2 text-center z-10 border-t border-gray-200 dark:border-slate-700/30 pt-2 pb-2">
                <div><div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">{tTime.yesterday}</div><div className="text-sm font-bold text-gray-800 dark:text-white">{fgYesterday}</div></div>
                <div><div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">{tTime.d7}</div><div className="text-sm font-bold text-gray-800 dark:text-white">{fgWeek}</div></div>
                <div><div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">{tTime.d30}</div><div className="text-sm font-bold text-gray-800 dark:text-white">{fgMonth}</div></div>
            </div>
        </div>
    );
};

export default FearGreedWidget;
