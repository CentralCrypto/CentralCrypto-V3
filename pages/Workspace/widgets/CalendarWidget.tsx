
import React, { useState, useEffect } from 'react';
import { Loader2, Calendar } from 'lucide-react';
import { EconEvent, fetchEconomicCalendar } from '../services/api';
import { DashboardItem, Language } from '../../../types';
import { getTranslations } from '../../../locales';

const CalendarWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
    const [events, setEvents] = useState<EconEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'USD' | 'BRL'>('ALL');
    const t = getTranslations(language as Language).workspace.widgets.calendar;
    const common = getTranslations(language as Language).common;

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const allEvents = await fetchEconomicCalendar();
            
            const now = new Date();
            const startRange = new Date(now);
            startRange.setDate(now.getDate() - 1);
            startRange.setHours(0, 0, 0, 0);

            const endRange = new Date(now);
            endRange.setDate(now.getDate() + 1);
            endRange.setHours(23, 59, 59, 999);

            const filtered = allEvents.filter(e => {
                const eventDate = new Date(e.date);
                const isRelevantCountry = e.country === 'USD' || e.country === 'BRL'; 
                const inDateRange = eventDate.getTime() >= startRange.getTime() && eventDate.getTime() <= endRange.getTime();
                return isRelevantCountry && inDateRange;
            });
            
            filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setEvents(filtered);
            setLoading(false);
        };
        load();
        const interval = setInterval(load, 300000); 
        return () => clearInterval(interval);
    }, []);

    const getImpactColor = (impact: string) => {
        if (impact === 'High') return 'bg-red-500';
        if (impact === 'Medium') return 'bg-orange-500';
        return 'bg-yellow-500';
    };

    const getFlag = (country: string) => {
        if (country === 'BRL') return "https://hatscripts.github.io/circle-flags/flags/br.svg";
        return "https://hatscripts.github.io/circle-flags/flags/us.svg";
    }

    const filteredEvents = events.filter(e => filter === 'ALL' || e.country === filter);

    const getDayLabel = (d: Date) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        
        const checkDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

        if (checkDate.getTime() === today.getTime()) return t.today;
        if (checkDate.getTime() === tomorrow.getTime()) return t.tomorrow;
        if (checkDate.getTime() === yesterday.getTime()) return 'ONTEM'; 
        return d.toLocaleDateString();
    };

    return (
        <div className="h-full flex flex-col relative bg-white dark:bg-[#2f3032] p-4">
             <div className="flex justify-between items-center mb-4 relative z-20 shrink-0 border-b border-gray-100 dark:border-slate-700/50 pb-3">
                <div className="flex items-center gap-2">
                    <span className="font-black text-gray-500 dark:text-slate-400 text-sm uppercase tracking-[0.1em]">{t.title}</span>
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setFilter(prev => prev === 'BRL' ? 'ALL' : 'BRL')} 
                        className={`transition-all hover:scale-110 ${filter === 'BRL' ? 'opacity-100 ring-2 ring-[#dd9933] ring-offset-2 dark:ring-offset-[#2f3032] rounded-full' : filter === 'ALL' ? 'opacity-100' : 'opacity-30 grayscale'}`}
                        title="Filter BRL"
                    >
                        <img src="https://hatscripts.github.io/circle-flags/flags/br.svg" className="w-5 h-5 rounded-full shadow-md" alt="BRL" />
                    </button>
                    <button 
                        onClick={() => setFilter(prev => prev === 'USD' ? 'ALL' : 'USD')} 
                        className={`transition-all hover:scale-110 ${filter === 'USD' ? 'opacity-100 ring-2 ring-[#dd9933] ring-offset-2 dark:ring-offset-[#2f3032] rounded-full' : filter === 'ALL' ? 'opacity-100' : 'opacity-30 grayscale'}`}
                        title="Filter USD"
                    >
                        <img src="https://hatscripts.github.io/circle-flags/flags/us.svg" className="w-5 h-5 rounded-full shadow-md" alt="USD" />
                    </button>
                </div>
            </div>
            
            <div className="flex-1 w-full relative z-10 overflow-y-auto custom-scrollbar pr-1">
                 {loading ? (
                     <div className="flex items-center justify-center h-full text-gray-500 text-sm font-bold">
                         <Loader2 className="animate-spin w-5 h-5 mr-3" /> {common.loading}
                     </div>
                 ) : filteredEvents.length === 0 ? (
                     <div className="flex items-center justify-center h-full text-gray-500 text-sm font-bold text-center px-4">
                         No events found.
                     </div>
                 ) : (
                     <div className="flex flex-col gap-2">
                         {filteredEvents.map((e, i) => {
                             const date = new Date(e.date);
                             const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute:'2-digit', hour12: false });
                             const dayLabel = getDayLabel(date);
                             
                             const textSize = item.isMaximized ? 'text-lg' : 'text-base';
                             const timeSize = item.isMaximized ? 'text-base' : 'text-sm';
                             const rowPadding = item.isMaximized ? 'p-4' : 'p-3';
                             
                             return (
                                 <div key={i} className={`flex items-center gap-3 ${rowPadding} rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 border border-transparent hover:border-gray-100 dark:hover:border-slate-700 transition-all shadow-sm`}>
                                     <div className="flex flex-col items-center w-16 shrink-0">
                                         <span className={`${timeSize} font-black text-gray-800 dark:text-gray-100 font-mono tracking-tighter`}>{timeStr}</span>
                                         <span className="text-[10px] uppercase text-gray-500 dark:text-slate-400 font-black tracking-widest">{dayLabel}</span>
                                     </div>
                                     
                                     <div className={`w-1.5 ${item.isMaximized ? 'h-12' : 'h-10'} rounded-full shrink-0 ${getImpactColor(e.impact)} shadow-sm`}></div>
                                     <div className="flex-1 min-w-0 flex items-center gap-3">
                                         <img src={getFlag(e.country)} className={`${item.isMaximized ? 'w-6 h-6' : 'w-5 h-5'} rounded-full shadow-md shrink-0 border border-white/10`} alt={e.country} />
                                         <span className={`${textSize} font-black text-gray-900 dark:text-gray-200 truncate leading-none group-hover:text-[#dd9933] transition-colors tracking-tight`}>{e.title}</span>
                                     </div>

                                     <div className={`grid grid-cols-3 gap-3 shrink-0 text-right ${item.isMaximized ? 'w-[30%] min-w-[260px]' : 'w-[160px]'}`}>
                                         <div className="flex flex-col hidden sm:flex">
                                             <span className="text-[10px] text-gray-500 dark:text-slate-500 font-black uppercase tracking-tighter">{t.previous}</span>
                                             <span className={`${item.isMaximized ? 'text-sm' : 'text-xs'} text-gray-700 dark:text-gray-300 font-mono font-black`}>{e.previous}</span>
                                         </div>
                                         <div className="flex flex-col">
                                             <span className="text-[10px] text-gray-500 dark:text-slate-500 font-black uppercase tracking-tighter">{t.forecast}</span>
                                             <span className={`${item.isMaximized ? 'text-sm' : 'text-xs'} text-gray-700 dark:text-gray-300 font-mono font-black`}>{e.forecast || '--'}</span>
                                         </div>
                                         <div className="flex flex-col">
                                             <span className="text-[10px] text-gray-500 dark:text-slate-500 font-black uppercase tracking-tighter">{t.actual}</span>
                                             <span className={`${item.isMaximized ? 'text-sm' : 'text-xs'} text-gray-700 dark:text-gray-300 font-mono font-black`}>--</span>
                                         </div>
                                     </div>
                                 </div>
                             );
                         })}
                     </div>
                 )}
            </div>
        </div>
    );
};

export default CalendarWidget;
