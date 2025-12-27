
import React, { useMemo } from 'react';
import { AreaChart, Area, Tooltip, ResponsiveContainer, XAxis, YAxis, Brush, CartesianGrid, ReferenceLine } from 'recharts';
import { DashboardItem, Language } from '../../../types';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { getTranslations } from '../../../locales';

interface Props {
  item: DashboardItem;
  currentPrice?: number;
  priceChange?: number;
  sparkline?: number[];
  totalVolume?: number;
  marketCap?: number;
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

const CustomChartTooltip = ({ active, payload, item, marketCap, priceChange, labels }: any) => {
    if (active && payload && payload.length) {
        const p = payload[0].payload;
        const isMaximized = item.isMaximized; 
        const labelSize = isMaximized ? 'text-sm' : 'text-xs';
        const valueSize = isMaximized ? 'text-2xl' : 'text-sm';
        const containerPadding = isMaximized ? 'p-4' : 'p-3';
        const price = p.price || 0;

        return (
            <div className={`bg-white dark:bg-[#2f3032] border border-gray-100 dark:border-slate-700 rounded-lg ${containerPadding} shadow-xl z-50`}>
                <div className={`${labelSize} text-gray-500 dark:text-slate-400 mb-1`}>
                     {new Date(p.timestamp).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className={`${valueSize} font-bold text-gray-900 dark:text-white mb-2`}>
                    {labels.price}: ${price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4})}
                </div>
                <div className="space-y-1">
                    <div className={`${isMaximized ? 'text-lg' : 'text-sm'} text-gray-600 dark:text-slate-300`}>
                        {labels.volEst}: <span className="text-[#dd9933]">${formatCompactNumber(p.volume)}</span>
                    </div>
                    <div className={`${isMaximized ? 'text-lg' : 'text-sm'} text-gray-600 dark:text-slate-300`}>
                        {labels.mcap}: <span className="text-blue-400">${formatCompactNumber(marketCap || 0)}</span>
                    </div>
                    <div className={`${isMaximized ? 'text-lg' : 'text-sm'} text-gray-600 dark:text-slate-300`}>
                        {labels.change24h}: <span className={(priceChange || 0) >= 0 ? 'text-green-500' : 'text-red-500'}>
                            {(priceChange || 0).toFixed(2)}%
                        </span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

const PriceWidget: React.FC<Props> = ({ item, currentPrice = 0, priceChange = 0, sparkline = [], totalVolume = 0, marketCap = 0, language = 'pt' }) => {
    const t = getTranslations(language as Language).workspace.widgets.price;
    
    const isDark = document.documentElement.classList.contains('dark');
    const axisColor = isDark ? '#94a3b8' : '#334155';
    const gridColor = isDark ? '#334155' : '#cbd5e1';
    
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

    if(chartData.length === 0) {
        return <div className="flex items-center justify-center h-full text-slate-500 text-xs">{t.noData}</div>;
    }

    const isPositive = priceChange >= 0;
    const gradientColor = isPositive ? '#009E4F' : '#E03A3E';
    const displayPrice = currentPrice || 0;

    return (
        <div className="h-full flex flex-col p-2 relative">
            <div className="flex justify-between items-end mb-1 z-10 px-2">
                <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">${displayPrice.toLocaleString()}</div>
                    <div className={`text-sm font-semibold flex items-center gap-1 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {isPositive ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
                        {Math.abs(priceChange).toFixed(2)}%
                    </div>
                </div>
            </div>
            <div className="flex-1 min-h-0 w-full z-10">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id={`gradient-price-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={gradientColor} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={gradientColor} stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.3} vertical={false} />
                        <XAxis dataKey="timestamp" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(tick) => { const d = new Date(tick); return `${d.getDate()}/${d.getMonth()+1}`; }} tick={{ fontSize: 9, fill: axisColor }} tickLine={false} axisLine={false} minTickGap={30} />
                        {item.isMaximized && (
                            <YAxis 
                                orientation="right"
                                domain={['auto', 'auto']} 
                                tick={{fontSize: 13, fill: axisColor}} 
                                axisLine={false} 
                                tickLine={false} 
                                width={60} 
                                tickCount={8}
                                tickFormatter={(val) => `$${formatCompactNumber(val)}`} 
                            />
                        )}
                        <Tooltip content={<CustomChartTooltip item={item} marketCap={marketCap} priceChange={priceChange} labels={t} />} cursor={{ stroke: axisColor, strokeWidth: 1, strokeDasharray: '3 3' }} />
                        <Area type="monotone" dataKey="price" stroke={gradientColor} fill={`url(#gradient-price-${item.id})`} strokeWidth={2} activeDot={{r: 4, fill: '#fff'}} />
                        <ReferenceLine y={displayPrice} stroke="#dd9933" strokeDasharray="3 3" opacity={0.5} />
                        {item.isMaximized && <Brush dataKey="timestamp" height={20} stroke="#dd9933" fill="transparent" tickFormatter={() => ''} opacity={0.5} startIndex={Math.max(0, chartData.length - 24)} />}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default PriceWidget;
