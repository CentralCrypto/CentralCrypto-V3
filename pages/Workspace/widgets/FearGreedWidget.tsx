
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
    
    // Get translations for the current language
    const t = getTranslations(language as Language).dashboard.widgets.fng;
    const tWs = getTranslations(language as Language).workspace.widgets.fng;
    const tTime = getTranslations(language as Language).dashboard.widgets.time;

    // Helper function to classify value using translated strings
    const classifyFearGreed = (v: number): string => {
        if (v >= 0 && v <= 25)  return t.s0;
        if (v > 25 && v <= 40)  return t.s1;
        if (v > 40 && v <= 60)  return t.s2;
        if (v > 60 && v <= 75)  return t.s3;
        if (v > 75 && v <= 95)  return t.s4;
        if (v > 95 && v <= 100) return t.s5;
        return 'Neutral';
    };

    const CustomFngTick = ({ x, y, payload }: any) => <text x={x} y={y} dy={4} textAnchor="start" className="fill-gray-500 dark:fill-slate-400" fontSize={10} fontWeight="bold">{classifyFearGreed(payload.value)}</text>;
    const CustomXAxisTick = ({ x, y, payload }: any) => { const date = new Date(payload.value); return (<g transform={`translate(${x},${y})`}><text x={0} y={0} dy={10} textAnchor="middle" className="fill-gray-500 dark:fill-slate-400" fontSize={10}>{date.toLocaleDateString(undefined, {month:'short', day:'numeric'})}</text><text x={0} y={0} dy={22} textAnchor="middle" className="fill-gray-600 dark:fill-slate-500" fontSize={9} fontWeight="bold">{date.getFullYear()}</text></g>); };
    const CustomChartTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const p = payload[0].payload;
            return (<div className="bg-white dark:bg-[#2f3032] border border-gray-200 dark:border-slate-700 rounded-lg p-4 shadow-xl z-50"><div className="text-sm text-gray-500 dark:text-slate-400 mb-1">{new Date(p.date).toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'})}</div><div className="text-2xl font-bold text-[#dd9933] mb-1">{tWs.index}: {p.value}</div><div className="text-xs font-bold text-gray-600 dark:text-slate-300">{classifyFearGreed(p.value)}</div></div>);
        }
        return null;
    };

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

    const fgSeries = useMemo(() => fngData.map(d => ({ date: Number(d.timestamp) * 1000, value: parseInt(d.value, 10) })).filter(p => !isNaN(p.date) && !isNaN(p.value)).sort((a, b) => a.date - b.date), [fngData]);
    const Watermark = () => <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-[0.05] z-0"><img src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" alt="watermark" className="w-3/4 h-auto grayscale filter" /></div>;

    if (loading) {
        return <div className="flex items-center justify-center h-full text-gray-400 dark:text-slate-500"><Loader2 className="animate-spin" /></div>;
    }

    if (error || !fngData || fngData.length === 0) {
        return <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-slate-500"><AlertTriangle className="mb-2" size={24} /><span className="text-xs">Data Unavailable</span></div>;
    }

    const fgValue = parseInt(fngData[0].value);
    const fgLabel = classifyFearGreed(fgValue);
    const rotation = -90 + (fgValue / 100) * 180;

    if (item.isMaximized) {
        return (
            <div className="h-full flex flex-col p-4 relative bg-white dark:bg-[#2f3032]">
                <Watermark />
                <div className="z-10 mb-2 flex justify-between items-start">
                    <div><div className="text-4xl font-black text-[#dd9933]">{fgValue}</div><div className="text-xl font-bold text-gray-900 dark:text-white uppercase">{fgLabel}</div></div>
                    <div className="text-right"><div className="text-sm font-bold text-gray-500 dark:text-slate-400 uppercase">{tWs.historical}</div></div>
                </div>
                <div className="flex-1 min-h-0 w-full z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={fgSeries} margin={{ top: 10, right: 60, left: 0, bottom: 0 }}>
                            <defs><linearGradient id="gradFg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#dd9933" stopOpacity={0.8}/><stop offset="95%" stopColor="#dd9933" stopOpacity={0}/></linearGradient></defs>
                            <ReferenceArea y1={0} y2={25} fill="#E03A3E" fillOpacity={0.08} /><ReferenceArea y1={25} y2={40} fill="#F47C20" fillOpacity={0.08} /><ReferenceArea y1={40} y2={60} fill="#FFD700" fillOpacity={0.05} /><ReferenceArea y1={60} y2={75} fill="#7AC74F" fillOpacity={0.08} /><ReferenceArea y1={75} y2={100} fill="#009E4F" fillOpacity={0.08} />
                            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-slate-700" opacity={0.3} />
                            <XAxis dataKey="date" type="number" domain={['dataMin', 'dataMax']} tick={<CustomXAxisTick />} minTickGap={50} interval="preserveStartEnd" />
                            <YAxis orientation="right" domain={[0, 100]} tick={<CustomFngTick />} ticks={[12.5, 32.5, 50, 67.5, 85, 98]} interval={0} width={80} />
                            <Tooltip content={<CustomChartTooltip />} cursor={{stroke: '#94a3b8'}} />
                            <Area type="monotone" dataKey="value" stroke="#dd9933" fill="url(#gradFg)" />
                            <ReferenceLine y={25} className="stroke-gray-300 dark:stroke-slate-600" strokeDasharray="3 3" opacity={0.5} /><ReferenceLine y={40} className="stroke-gray-300 dark:stroke-slate-600" strokeDasharray="3 3" opacity={0.5} /><ReferenceLine y={60} className="stroke-gray-300 dark:stroke-slate-600" strokeDasharray="3 3" opacity={0.5} /><ReferenceLine y={75} className="stroke-gray-300 dark:stroke-slate-600" strokeDasharray="3 3" opacity={0.5} /><ReferenceLine y={95} className="stroke-gray-300 dark:stroke-slate-600" strokeDasharray="3 3" opacity={0.5} />
                            <Brush dataKey="date" height={30} stroke="#dd9933" fill="transparent" tickFormatter={() => ''} opacity={0.5} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }
    
    // Safety checks for historical data
    const fgYesterday = fngData.length > 1 ? fngData[1].value : '--'; 
    const fgWeek = fngData.length > 7 ? fngData[7].value : '--'; 
    const fgMonth = fngData.length > 30 ? fngData[30].value : '--';
    
    const uniqueGradId = `grad-fg-${item.id}`; // Unique ID to prevent conflicts

    return (
        <div className="h-full flex flex-col justify-center gap-2 p-2 relative text-center bg-white dark:bg-[#2f3032]">
            <Watermark />
            <div className="flex items-center justify-center relative mt-6 z-10">
                <svg viewBox="0 0 200 110" className="w-[85%] max-w-[280px]">
                    <defs>
                        <linearGradient id={uniqueGradId} x1="0" x2="1" y1="0" y2="0">
                            <stop offset="0%" stopColor="#E03A3E"/>
                            <stop offset="25%" stopColor="#F47C20"/>
                            <stop offset="50%" stopColor="#FFD700"/>
                            <stop offset="75%" stopColor="#7AC74F"/>
                            <stop offset="100%" stopColor="#009E4F"/>
                        </linearGradient>
                    </defs>
                    <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" className="stroke-[#eeeeee] dark:stroke-[#333]" strokeWidth="18" strokeLinecap="round"/>
                    <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke={`url(#${uniqueGradId})`} strokeWidth="18" strokeDasharray={`${(fgValue/100)*283} 283`} strokeLinecap="round" />
                    <g transform={`rotate(${rotation} 100 100)`}>
                        <path d="M 100 100 L 100 20" className="stroke-gray-800 dark:stroke-white" strokeWidth="3" /><circle cx="100" cy="100" r="5" className="fill-gray-800 dark:fill-white" />
                    </g>
                </svg>
            </div>
            <div className="flex flex-col items-center mt-2 z-10">
                <div className="text-4xl font-black text-[#dd9933] leading-none">{fgValue}</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white uppercase mt-1 px-2 py-1 bg-transparent rounded border border-transparent">{fgLabel}</div>
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
