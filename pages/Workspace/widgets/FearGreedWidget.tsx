
import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, ReferenceArea, Brush } from 'recharts';
import { FngData, fetchFearAndGreed } from '../services/api';
import { DashboardItem, Language } from '../../../types';
import { getTranslations } from '../../../locales';

const FearGreedWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
    const [fngData, setFngData] = useState<FngData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    
    const t = getTranslations(language as Language).dashboard.widgets.fng;
    const tWs = getTranslations(language as Language).workspace.widgets.fng;
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

    const getClassification = (point: FngData): string => {
        return point?.value_classification_i18n?.[language] || point?.value_classification || '---';
    };

    const getLabelByValue = (val: number): string => {
        if (val <= 25) return fngData[0]?.value_classification_i18n?.[language] || t.s0;
        if (val <= 40) return t.s1;
        if (val <= 60) return t.s2;
        if (val <= 75) return t.s3;
        if (val <= 95) return t.s4;
        return t.s5;
    };

    const CustomFngTick = ({ x, y, payload }: any) => {
        const label = getLabelByValue(payload.value);
        return <text x={x} y={y} dy={4} textAnchor="start" className="fill-gray-500 dark:fill-slate-400" fontSize={10} fontWeight="bold">{label}</text>;
    };

    const CustomXAxisTick = ({ x, y, payload }: any) => { 
        const date = new Date(payload.value); 
        return (<g transform={`translate(${x},${y})`}><text x={0} y={0} dy={10} textAnchor="middle" className="fill-gray-500 dark:fill-slate-400" fontSize={10}>{date.toLocaleDateString(undefined, {month:'short', day:'numeric'})}</text><text x={0} y={0} dy={22} textAnchor="middle" className="fill-gray-600 dark:fill-slate-500" fontSize={9} fontWeight="bold">{date.getFullYear()}</text></g>); 
    };

    const fgSeries = useMemo(() => {
        return fngData.map(d => ({ 
            date: Number(d.timestamp) * 1000, 
            value: parseInt(d.value, 10),
            label: getClassification(d)
        })).filter(p => !isNaN(p.date) && !isNaN(p.value)).sort((a, b) => a.date - b.date);
    }, [fngData, language]);

    const Watermark = () => <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-[0.05] z-0"><img src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" alt="watermark" className="w-3/4 h-auto grayscale filter" /></div>;

    if (loading) return <div className="flex items-center justify-center h-full text-gray-400"><Loader2 className="animate-spin" /></div>;
    if (error || !fngData.length) return <div className="flex flex-col items-center justify-center h-full text-gray-400"><AlertTriangle className="mb-2" size={24} />Data Unavailable</div>;

    const currentPoint = fngData[0];
    const fgValue = parseInt(currentPoint.value);
    const fgLabel = getClassification(currentPoint);
    const rotation = -90 + (fgValue / 100) * 180;

    const fgYesterday = fngData[1]?.value || '--';
    const fgWeek = fngData[7]?.value || '--';
    const fgMonth = fngData[30]?.value || '--';

    if (item.isMaximized) {
        return (
            <div className="h-full flex flex-col p-6 relative bg-white dark:bg-[#1a1c1e] overflow-hidden">
                <Watermark />
                <div className="z-10 flex flex-col lg:flex-row items-center justify-center gap-12 mb-10 shrink-0">
                    <div className="w-full max-w-[320px] flex flex-col items-center">
                        <svg viewBox="0 0 200 120" className="w-full overflow-visible">
                            <defs>
                                <linearGradient id="fngGradMax" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#E03A3E" />
                                    <stop offset="25%" stopColor="#F47C20" />
                                    <stop offset="50%" stopColor="#FFD700" />
                                    <stop offset="75%" stopColor="#7AC74F" />
                                    <stop offset="100%" stopColor="#009E4F" />
                                </linearGradient>
                            </defs>
                            <path d="M 35 75 A 65 65 0 0 1 165 75" fill="none" stroke="currentColor" className="text-gray-200 dark:text-tech-800" strokeWidth={8} strokeLinecap="round" />
                            <path d="M 35 75 A 65 65 0 0 1 165 75" fill="none" stroke="url(#fngGradMax)" strokeWidth={8} strokeLinecap="round" />
                            <g transform={`rotate(${rotation} 100 75)`}>
                                <path d="M 100 75 L 100 15" className="stroke-gray-900 dark:stroke-white" strokeWidth="3" strokeLinecap="round" />
                                <circle cx={100} cy={75} r="5" className="fill-gray-900 dark:fill-white" />
                            </g>
                            <text x="100" y="105" textAnchor="middle" className="fill-gray-900 dark:fill-[#dd9933]" fontSize="32" fontWeight="900" fontFamily="monospace">{fgValue}</text>
                            <text x="100" y="125" textAnchor="middle" className="fill-gray-600 dark:fill-gray-300" fontSize="14" fontWeight="900" letterSpacing="1">{fgLabel}</text>
                        </svg>
                    </div>
                    <div className="flex flex-wrap justify-center gap-4">
                        {[
                            { label: tTime.yesterday, val: fgYesterday, sub: getLabelByValue(parseInt(fgYesterday)) },
                            { label: tTime.d7, val: fgWeek, sub: getLabelByValue(parseInt(fgWeek)) },
                            { label: tTime.d30, val: fgMonth, sub: getLabelByValue(parseInt(fgMonth)) }
                        ].map((card, i) => (
                            <div key={i} className="bg-gray-50 dark:bg-tech-900 border border-gray-100 dark:border-tech-800 p-4 rounded-2xl w-36 text-center shadow-lg">
                                <div className="text-[10px] font-black text-gray-400 uppercase mb-1">{card.label}</div>
                                <div className="text-3xl font-black text-[#dd9933] mb-1">{card.val}</div>
                                <div className="text-[9px] font-bold text-gray-500 uppercase leading-tight">{card.sub}</div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex-1 min-h-0 w-full z-10 border-t border-gray-100 dark:border-tech-800 pt-6">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={fgSeries} margin={{ top: 10, right: 100, left: 10, bottom: 0 }}>
                            <defs><linearGradient id="gradFg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#dd9933" stopOpacity={0.8}/><stop offset="95%" stopColor="#dd9933" stopOpacity={0}/></linearGradient></defs>
                            <ReferenceArea y1={0} y2={25} fill="#E03A3E" fillOpacity={0.08} /><ReferenceArea y1={25} y2={40} fill="#F47C20" fillOpacity={0.08} /><ReferenceArea y1={40} y2={60} fill="#FFD700" fillOpacity={0.05} /><ReferenceArea y1={60} y2={75} fill="#7AC74F" fillOpacity={0.08} /><ReferenceArea y1={75} y2={100} fill="#009E4F" fillOpacity={0.08} />
                            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-slate-700" opacity={0.3} />
                            <XAxis dataKey="date" type="number" domain={['dataMin', 'dataMax']} tick={<CustomXAxisTick />} minTickGap={50} />
                            <YAxis orientation="right" domain={[0, 100]} tick={<CustomFngTick />} ticks={[12.5, 32.5, 50, 67.5, 85, 98]} width={100} />
                            <Tooltip />
                            <Area type="monotone" dataKey="value" stroke="#dd9933" fill="url(#gradFg)" strokeWidth={3} />
                            <Brush dataKey="date" height={30} stroke="#dd9933" fill="transparent" tickFormatter={() => ''} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }
    
    return (
        <div className="h-full flex flex-col justify-center gap-2 p-2 relative text-center bg-white dark:bg-[#2f3032]">
            <Watermark />
            <div className="flex items-center justify-center relative mt-6 z-10">
                <svg viewBox="0 0 200 110" className="w-[85%] max-w-[280px]">
                    <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" className="stroke-[#eeeeee] dark:stroke-[#333]" strokeWidth="18" strokeLinecap="round"/>
                    <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="#dd9933" strokeWidth="18" strokeDasharray={`${(fgValue/100)*283} 283`} strokeLinecap="round" />
                    <g transform={`rotate(${rotation} 100 100)`}>
                        <path d="M 100 100 L 100 20" className="stroke-gray-800 dark:stroke-white" strokeWidth="3" /><circle cx="100" cy="100" r="5" className="fill-gray-800 dark:fill-white" />
                    </g>
                </svg>
            </div>
            <div className="flex flex-col items-center mt-2 z-10">
                <div className="text-4xl font-black text-[#dd9933] leading-none">{fgValue}</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white uppercase mt-1">{fgLabel}</div>
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
