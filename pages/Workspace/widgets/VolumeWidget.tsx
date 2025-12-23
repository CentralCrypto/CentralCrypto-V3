
import React, { useMemo } from 'react';
import { BarChart, Bar, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, Brush, XAxis, YAxis, CartesianGrid } from 'recharts';
import { DashboardItem, Language } from '../../../types';
import { getTranslations } from '../../../locales';

interface Props {
  item: DashboardItem;
  sparkline?: number[];
  totalVolume?: number;
  language?: Language;
}

const formatCompactNumber = (number: number) => {
  if (!number || number === 0) return "---";
  if (number < 1000) return number.toString();
  const suffixes = ["", "K", "M", "B", "T"];
  const suffixNum = Math.floor(("" + Math.floor(number)).length / 3);
  let shortValue = parseFloat((number / Math.pow(1000, suffixNum)).toPrecision(3));
  if (shortValue % 1 !== 0) shortValue = parseFloat(shortValue.toFixed(2));
  return shortValue + suffixes[suffixNum];
};

const CustomChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className={`bg-[#2f3032] border border-slate-700 rounded-lg p-3 shadow-xl z-50`}>
                <div className={`text-lg text-slate-300`}>
                    Vol: <span className="text-[#dd9933]">${formatCompactNumber(payload[0].payload.volume)}</span>
                </div>
            </div>
        );
    }
    return null;
};

const VolumeWidget: React.FC<Props> = ({ item, sparkline = [], totalVolume = 0, language = 'pt' }) => {
    const t = getTranslations(language as Language).workspace.widgets.volume;
    
    const chartData = useMemo(() => {
        if (!sparkline || sparkline.length === 0) return [];
        const points = [];
        const now = Date.now();
        const totalPoints = sparkline.length;
        for (let i = 0; i < totalPoints; i++) {
            const timeOffset = (totalPoints - 1 - i) * 60 * 60 * 1000;
            const timestamp = now - timeOffset;
            const dateObj = new Date(timestamp);
            const volNoise = 0.8 + Math.random() * 0.4; 
            const estVolume = totalVolume ? (totalVolume / 24) * volNoise : 10000 * volNoise;
            points.push({ 
                price: sparkline[i], 
                volume: estVolume, 
                label: `${dateObj.getDate()}/${dateObj.getMonth()+1} ${dateObj.getHours()}h`, 
                timestamp: timestamp 
            });
        }
        return points;
    }, [sparkline, totalVolume]);

    // Maximized View: Area chart with Brush (from your backup)
    if (item.isMaximized) {
        return (
            <div className="h-full flex flex-col p-2 relative">
                 <div className="mb-1 z-10 px-2 flex justify-between items-end">
                     <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">{t.vol24h}</div>
                        <div className="text-xl font-bold text-white">${formatCompactNumber(totalVolume)}</div>
                     </div>
                 </div>
                 <div className="flex-1 min-h-0 w-full z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} minTickGap={20} />
                            <YAxis 
                                orientation="right"
                                tick={{fontSize: 13, fill: '#cbd5e1'}} 
                                axisLine={false} 
                                tickLine={false} 
                                width={60} 
                                tickCount={8}
                                tickFormatter={(val) => `$${formatCompactNumber(val)}`} 
                            />
                            <Tooltip content={<CustomChartTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }} />
                            <Area type="monotone" dataKey="volume" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                            <Brush dataKey="timestamp" height={20} stroke="#dd9933" fill="#1a1c1e" tickFormatter={() => ''} opacity={0.5} startIndex={Math.max(0, chartData.length - 24)} />
                        </AreaChart>
                    </ResponsiveContainer>
                 </div>
            </div>
        );
    }

    // Minimized View: Bar chart with colored bars (from your backup)
    return (
        <div className="h-full flex flex-col p-2 relative">
             <div className="mb-1 z-10 px-2 flex justify-between items-end">
                 <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{t.vol24h}</div>
                    <div className="text-xl font-bold text-white">${formatCompactNumber(totalVolume)}</div>
                 </div>
             </div>
             <div className="flex-1 min-h-0 w-full z-10">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                        <Tooltip content={<CustomChartTooltip />} cursor={{ fill: 'rgba(221, 153, 51, 0.1)' }} />
                        <Bar dataKey="volume" radius={[2, 2, 0, 0]}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.price > (chartData[index-1]?.price ?? 0) ? '#009E4F' : '#E03A3E'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
             </div>
        </div>
    );
};

export default VolumeWidget;
