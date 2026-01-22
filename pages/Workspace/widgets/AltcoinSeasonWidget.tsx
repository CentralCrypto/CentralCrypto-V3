
import React, { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Brush } from 'recharts';
import { AltSeasonData, fetchAltcoinSeason, fetchAltcoinSeasonHistory, AltSeasonHistoryPoint } from '../services/api';
import { DashboardItem, Language } from '../../../types';
import { getTranslations } from '../../../locales';

const formatCompactNumber = (number: number) => {
  if (!number || number === 0) return "---";
  if (number < 1000) return number.toString();
  const suffixes = ["", "K", "M", "B", "T"];
  const suffixNum = Math.floor(("" + Math.floor(number)).length / 3);
  let shortValue = parseFloat((number / Math.pow(1000, suffixNum)).toPrecision(3));
  if (shortValue % 1 !== 0) shortValue = parseFloat(shortValue.toFixed(2));
  return shortValue + suffixes[suffixNum];
};

const CustomChartTooltip = ({ active, payload, labels, language }: any) => {
    if (active && payload && payload.length) {
        const p = payload[0].payload;
        return (
            <div className="bg-white dark:bg-[#1a1c1e] border border-gray-200 dark:border-slate-700 rounded-lg p-4 shadow-xl z-50">
                <div className="text-[10px] text-gray-500 dark:text-gray-400 font-black uppercase mb-2 border-b border-gray-100 dark:border-white/5 pb-1">
                    {new Date(p.date).toLocaleDateString(language, {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}
                </div>
                {payload.map((entry: any) => (
                    <div key={entry.name} className="flex justify-between items-center gap-4 mb-1">
                        <span className="text-[10px] text-gray-600 dark:text-gray-400 font-black uppercase">
                            {entry.name === 'altcoinIndex' ? `${labels.index}:` : `${labels.altsMcap}:`}
                        </span>
                        <span className="text-base font-black" style={{color: entry.color}}>
                            {entry.name === 'altcoinIndex' ? entry.value : '$' + formatCompactNumber(entry.value)}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const AltcoinSeasonWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
    const [altSeason, setAltSeason] = useState<AltSeasonData | null>(null);
    const [altHistory, setAltHistory] = useState<AltSeasonHistoryPoint[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAsi, setShowAsi] = useState(true);
    const [showAltsMc, setShowAltsMc] = useState(true);
    
    const t = getTranslations(language as Language).dashboard.widgets.altseason;
    const tWs = getTranslations(language as Language).workspace.widgets.altseason;

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            const [curr, hist] = await Promise.all([fetchAltcoinSeason(), fetchAltcoinSeasonHistory()]);
            if (curr) setAltSeason(curr);
            if (hist) setAltHistory(hist);
            setIsLoading(false);
        };
        load();
    }, []);

    const chartSeries = useMemo(() => {
        return altHistory.map(p => ({
            date: p.timestamp * 1000,
            altcoinIndex: p.altcoinIndex,
            altcoinMarketcap: p.altcoinMarketcap
        })).sort((a, b) => a.date - b.date);
    }, [altHistory]);

    const Watermark = () => <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-[0.05] z-0"><img src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" alt="watermark" className="w-3/4 h-auto grayscale filter" /></div>;

    if (isLoading) return <div className="flex items-center justify-center h-full text-gray-400 dark:text-slate-500"><Loader2 className="animate-spin" /></div>;
    if (!altSeason) return null;

    const asi = altSeason.index || 0;
    const seasonLabel = asi <= 25 ? t.bitcoinSeason : asi >= 75 ? t.altcoinSeason : t.transition;

    if (item.isMaximized) {
        return (
            <div className="h-full flex flex-col p-4 relative bg-white dark:bg-[#1a1c1e]">
                <Watermark />
                <div className="z-10 mb-2 flex flex-col items-start p-2">
                    <div className="flex items-baseline gap-4">
                        <span className="text-6xl font-black text-[#dd9933] leading-none font-mono">{asi}</span>
                        <span className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest">{seasonLabel}</span>
                    </div>
                    <div className="flex justify-between w-full mt-4 items-center">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-l-2 border-[#dd9933] pl-2">Análise de Temporada de Altcoins (90d)</div>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-gray-300 cursor-pointer"><input type="checkbox" checked={showAsi} onChange={() => setShowAsi(!showAsi)} className="accent-[#dd9933]" />{tWs.index}</label>
                            <label className="flex items-center gap-2 text-xs font-bold text-blue-500 dark:text-blue-400 cursor-pointer"><input type="checkbox" checked={showAltsMc} onChange={() => setShowAltsMc(!showAltsMc)} className="accent-blue-500" />{tWs.altsMcap}</label>
                        </div>
                    </div>
                </div>
                <div className="flex-1 min-h-0 w-full z-10 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartSeries} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <defs><linearGradient id="colorAlt" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#dd9933" stopOpacity={0.4}/><stop offset="95%" stopColor="#dd9933" stopOpacity={0}/></linearGradient></defs>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-slate-800" vertical={false} />
                            <XAxis dataKey="date" type="number" domain={['dataMin', 'dataMax']} hide />
                            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} ticks={[0,25,50,75,100]} tick={{ fontSize: 10, fill: '#dd9933', fontWeight: 'bold' }} stroke="#dd9933" axisLine={false} tickLine={false} hide={!showAsi} />
                            <YAxis yAxisId="left" orientation="left" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#3b82f6', fontWeight: 'bold' }} tickFormatter={(val) => `$${formatCompactNumber(val)}`} stroke="#3b82f6" axisLine={false} tickLine={false} hide={!showAltsMc} />
                            <Tooltip content={<CustomChartTooltip labels={tWs} language={language} />} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }} />
                            {showAsi && (<Area yAxisId="right" type="monotone" dataKey="altcoinIndex" stroke="#dd9933" fill="url(#colorAlt)" strokeWidth={1} dot={false} />)}
                            {showAltsMc && (<Line yAxisId="left" type="monotone" dataKey="altcoinMarketcap" stroke="#3b82f6" strokeWidth={1} dot={false} strokeDasharray="5 5" />)}
                            <Brush dataKey="date" height={30} stroke="#dd9933" fill="transparent" tickFormatter={() => ''} opacity={0.3} />
                        </ComposedChart>
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
                    <defs><linearGradient id="grad-alt" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stopColor="#0ea5e9" /><stop offset="25%" stopColor="#a855f7" /><stop offset="75%" stopColor="#f97316" /><stop offset="100%" stopColor="#ef4444" /></linearGradient></defs>
                    <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" className="stroke-[#eeeeee] dark:stroke-[#333]" strokeWidth="18" strokeLinecap="round" />
                    <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="url(#grad-alt)" strokeWidth="18" strokeDasharray={`${(asi / 100) * 283} 283`} strokeLinecap="round" />
                    <g transform={`rotate(${(asi / 100) * 180 - 90} 100 100)`}>
                        <path d="M 100 100 L 100 20" className="stroke-gray-800 dark:stroke-white" strokeWidth="3" /><circle cx={100} cy={100} r="5" className="fill-gray-800 dark:fill-white" />
                    </g>
                </svg>
            </div>
            {/* Margem ajustada: mt-2 para dar "respiro" entre o ponteiro e o número */}
            <div className="flex flex-col items-center mt-2 z-10">
                <div className="text-3xl font-black text-[#dd9933] leading-none font-mono tracking-tighter">{asi}</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white uppercase mt-0.5">{seasonLabel}</div>
            </div>
            <div className="flex justify-around w-full mt-2 text-center z-10 border-t border-gray-200 dark:border-slate-700/30 pt-2 pb-2">
                <div><div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">{t.yesterday}</div><div className="text-sm font-bold text-gray-800 dark:text-white">{altSeason.yesterday}</div></div>
                <div><div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">{t.week}</div><div className="text-sm font-bold text-gray-800 dark:text-white">{altSeason.lastWeek}</div></div>
                <div><div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">{t.month}</div><div className="text-sm font-bold text-gray-800 dark:text-white">{altSeason.lastMonth}</div></div>
            </div>
        </div>
    );
};

export default AltcoinSeasonWidget;
