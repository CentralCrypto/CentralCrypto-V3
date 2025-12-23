
import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Brush } from 'recharts';
import { AltSeasonData, fetchAltcoinSeason, fetchAltcoinSeasonHistory } from '../services/api';
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

const CustomChartTooltip = ({ active, payload, labels }: any) => {
    if (active && payload && payload.length) {
        const p = payload[0].payload;
        return (
            <div className="bg-white dark:bg-[#2f3032] border border-gray-200 dark:border-slate-700 rounded-lg p-4 shadow-xl z-50">
                <div className="text-sm text-gray-500 dark:text-gray-200 font-bold mb-2 border-b border-gray-200 dark:border-gray-600 pb-1">
                    {new Date(p.date).toLocaleDateString(undefined, {year: 'numeric', month: 'long', day: 'numeric'})}
                </div>
                {payload.map((entry: any) => (
                    <div key={entry.name} className="flex justify-between items-center gap-4 mb-1">
                        <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                            {entry.name === 'value' ? `${labels.index}:` : `${labels.altsMcap}:`}
                        </span>
                        <span className="text-lg font-bold" style={{color: entry.color}}>
                            {entry.name === 'value' ? entry.value : '$' + formatCompactNumber(entry.value)}
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
    const [altHistory, setAltHistory] = useState<{date: number, value: number, marketCap?: number}[]>([]);
    const [showAsi, setShowAsi] = useState(true);
    const [showAltsMc, setShowAltsMc] = useState(true);
    
    const t = getTranslations(language as Language).dashboard.widgets.altseason;
    const tWs = getTranslations(language as Language).workspace.widgets.altseason;

    useEffect(() => {
        fetchAltcoinSeason().then(setAltSeason);
        if (item.isMaximized) {
            fetchAltcoinSeasonHistory().then(setAltHistory);
        }
    }, [item.isMaximized]);

    const Watermark = () => <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-[0.05] z-0"><img src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" alt="watermark" className="w-3/4 h-auto grayscale filter" /></div>;

    if (!altSeason) {
        return <div className="flex items-center justify-center h-full text-gray-400 dark:text-slate-500"><Loader2 className="animate-spin" /></div>;
    }

    const asi = altSeason.index || 0;
    let asiLabel = t.btcDomZone;
    if (asi <= 25) asiLabel = t.bitcoinSeason;
    else if (asi >= 75) asiLabel = t.altcoinSeason;
    else if (asi > 45 && asi < 75) asiLabel = t.transition;

    if (item.isMaximized) {
        const dataToUse = altHistory.length > 0 
            ? altHistory 
            : [
                { date: Date.now() - 30*24*3600*1000, value: altSeason?.lastMonth || 0, marketCap: 0 },
                { date: Date.now() - 7*24*3600*1000, value: altSeason?.lastWeek || 0, marketCap: 0 },
                { date: Date.now() - 24*3600*1000, value: altSeason?.yesterday || 0, marketCap: 0 },
                { date: Date.now(), value: asi, marketCap: 0 }
              ];

        return (
            <div className="h-full flex flex-col p-4 relative bg-white dark:bg-[#2f3032]">
                <Watermark />
                <div className="z-10 mb-2 flex flex-col gap-2">
                    <div className="w-full flex flex-col items-center justify-center">
                        <div className="text-5xl font-black text-[#dd9933] text-center">{asi}</div>
                        <div className="text-xl font-bold text-gray-900 dark:text-white uppercase text-center">{asiLabel}</div>
                    </div>
                    <div className="flex justify-end gap-4">
                        <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-white cursor-pointer select-none"><input type="checkbox" checked={showAsi} onChange={() => setShowAsi(!showAsi)} className="accent-[#dd9933]" />{tWs.index}</label>
                        <label className="flex items-center gap-2 text-sm text-blue-500 dark:text-blue-400 cursor-pointer select-none"><input type="checkbox" checked={showAltsMc} onChange={() => setShowAltsMc(!showAltsMc)} className="accent-blue-500" />{tWs.altsMcap}</label>
                    </div>
                </div>
                <div className="flex-1 min-h-0 w-full z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={dataToUse} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <defs><linearGradient id="colorAlt" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0.8}/></linearGradient></defs>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-slate-700" opacity={0.3} />
                            <XAxis dataKey="date" type="number" domain={['dataMin', 'dataMax']} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(tick) => { const d = new Date(tick); const range = dataToUse[dataToUse.length-1].date - dataToUse[0].date; if (range > 365 * 24 * 3600 * 1000) return d.toLocaleDateString(undefined, {month: 'short', year: '2-digit'}); return d.toLocaleDateString(undefined, {month: 'short', day: 'numeric'}); }} scale="time" />
                            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} ticks={[0,25,50,75,100]} tick={{ fontSize: 12, fill: '#dd9933' }} stroke="#dd9933" hide={!showAsi} />
                            <YAxis yAxisId="left" orientation="left" domain={['auto', 'auto']} tick={{ fontSize: 12, fill: '#60a5fa' }} tickFormatter={(val) => `$${formatCompactNumber(val)}`} stroke="#60a5fa" hide={!showAltsMc} />
                            <Tooltip content={<CustomChartTooltip labels={tWs} />} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }} />
                            {showAsi && (<Area yAxisId="right" type="monotone" dataKey="value" stroke="#dd9933" fill="url(#colorAlt)" strokeWidth={2} dot={false} name="value" />)}
                            {showAltsMc && (<Line yAxisId="left" type="monotone" dataKey="marketCap" stroke="#60a5fa" strokeWidth={2} dot={false} name="marketCap" />)}
                            <Brush dataKey="date" height={30} stroke="#dd9933" fill="transparent" tickFormatter={() => ''} opacity={0.5} />
                        </ComposedChart>
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
                    <defs><linearGradient id="grad-alt" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stopColor="#0ea5e9" /><stop offset="25%" stopColor="#a855f7" /><stop offset="75%" stopColor="#f97316" /><stop offset="100%" stopColor="#ef4444" /></linearGradient></defs>
                    <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" className="stroke-[#eeeeee] dark:stroke-[#333]" strokeWidth="18" strokeLinecap="round" />
                    <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="url(#grad-alt)" strokeWidth="18" strokeDasharray={`${(asi / 100) * 283} 283`} strokeLinecap="round" />
                    <g transform={`rotate(${(asi / 100) * 180 - 90} 100 100)`}>
                        <path d="M 100 100 L 100 20" className="stroke-gray-800 dark:stroke-white" strokeWidth="3" /><circle cx="100" cy="100" r="5" className="fill-gray-800 dark:fill-white" />
                    </g>
                </svg>
            </div>
            <div className="flex flex-col items-center mt-4 z-10">
                <div className="text-4xl font-black text-[#dd9933] leading-none">{asi}</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white uppercase mt-1">{asiLabel}</div>
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
