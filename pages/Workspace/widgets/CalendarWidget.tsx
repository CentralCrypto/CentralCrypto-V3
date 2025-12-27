import React, { useState, useEffect } from 'react';
import { Loader2, Calendar } from 'lucide-react';
import { EconEvent, fetchEconomicCalendar } from '../services/api';
import { DashboardItem, Language } from '../../../types';
import { getTranslations } from '../../../locales';

const CalendarWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
    const [events, setEvents] = useState<EconEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'USD' | 'BRL'>('ALL');
    const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'TOMORROW'>('ALL');
    
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
            endRange.setDate(now.getDate() + 2); // Show 48h range
            endRange.setHours(23, 59, 59, 999);

            const filtered = allEvents.filter(e => {
                const eventDate = new Date(e.date);
                return eventDate.getTime() >= startRange.getTime() && eventDate.getTime() <= endRange.getTime();
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

    const getDayLabel = (d: Date) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const checkDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

        if (checkDate.getTime() === today.getTime()) return t.today;
        if (checkDate.getTime() === tomorrow.getTime()) return t.tomorrow;
        if (checkDate.getTime() === yesterday.getTime()) return 'ONTEM'; 
        return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
    };

    const filteredEvents = events.filter(e => {
        const countryMatch = filter === 'ALL' || e.country === filter;
        if (!countryMatch) return false;

        const d = new Date(e.date);
        const now = new Date();
        const todayStr = now.toDateString();
        const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
        const tomorrowStr = tomorrow.toDateString();

        if (dateFilter === 'TODAY') return d.toDateString() === todayStr;
        if (dateFilter === 'TOMORROW') return d.toDateString() === tomorrowStr;
        return true;
    });

    return (
        <div className="h-full flex flex-col relative bg-white dark:bg-[#2f3032] p-4 transition-colors">
             <div className="flex justify-between items-center mb-6 shrink-0 border-b border-gray-100 dark:border-slate-700/50 pb-4">
                <div className="flex items-center gap-4">
                    <span className="font-black text-gray-500 dark:text-slate-400 text-lg uppercase tracking-[0.1em]">{t.title}</span>
                    <div className="flex bg-gray-100 dark:bg-black/20 p-1 rounded-lg">
                        <button onClick={() => setDateFilter('ALL')} className={`px-3 py-1 text-[10px] font-black uppercase rounded ${dateFilter==='ALL'?'bg-[#dd9933] text-black':'text-gray-500'}`}>Todos</button>
                        <button onClick={() => setDateFilter('TODAY')} className={`px-3 py-1 text-[10px] font-black uppercase rounded ${dateFilter==='TODAY'?'bg-[#dd9933] text-black':'text-gray-500'}`}>{t.today}</button>
                        <button onClick={() => setDateFilter('TOMORROW')} className={`px-3 py-1 text-[10px] font-black uppercase rounded ${dateFilter==='TOMORROW'?'bg-[#dd9933] text-black':'text-gray-500'}`}>{t.tomorrow}</button>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <button onClick={() => setFilter(prev => prev === 'BRL' ? 'ALL' : 'BRL')} className={`transition-all hover:scale-110 ${filter === 'BRL' ? 'opacity-100 ring-4 ring-[#dd9933] ring-offset-4 dark:ring-offset-[#2f3032] rounded-full shadow-xl' : 'opacity-30 grayscale'}`} title="Filter BRL"><img src={getFlag('BRL')} className="w-8 h-8 rounded-full" /></button>
                    <button onClick={() => setFilter(prev => prev === 'USD' ? 'ALL' : 'USD')} className={`transition-all hover:scale-110 ${filter === 'USD' ? 'opacity-100 ring-4 ring-[#dd9933] ring-offset-4 dark:ring-offset-[#2f3032] rounded-full shadow-xl' : 'opacity-30 grayscale'}`} title="Filter USD"><img src={getFlag('USD')} className="w-8 h-8 rounded-full" /></button>
                </div>
            </div>

            <div className="grid grid-cols-[100px_10px_1fr_240px] gap-5 px-6 py-2 mb-2 bg-gray-50 dark:bg-black/10 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest rounded-lg border border-transparent dark:border-white/5">
                <span>Horário</span><span></span><span>Evento Econômico</span>
                <div className="grid grid-cols-3 gap-5 text-right">
                    <span>{t.previous}</span><span>{t.forecast}</span><span>{t.actual}</span>
                </div>
            </div>
            
            <div className="flex-1 w-full relative z-10 overflow-y-auto custom-scrollbar pr-2">
                 {loading ? (
                     <div className="flex items-center justify-center h-full text-gray-500 text-xl font-black uppercase tracking-widest">
                         <Loader2 className="animate-spin w-8 h-8 mr-4 text-[#dd9933]" /> {common.loading}
                     </div>
                 ) : filteredEvents.length === 0 ? (
                     <div className="flex items-center justify-center h-full text-gray-500 text-lg font-black text-center px-4 uppercase tracking-widest opacity-50">
                         No macro events found.
                     </div>
                 ) : (
                     <div className="flex flex-col gap-3">
                         {filteredEvents.map((e, i) => {
                             const date = new Date(e.date);
                             const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute:'2-digit', hour12: false });
                             const dayLabel = getDayLabel(date);
                             
                             const textSize = item.isMaximized ? 'text-2xl' : 'text-lg';
                             const timeSize = item.isMaximized ? 'text-xl' : 'text-lg';
                             const rowPadding = item.isMaximized ? 'p-8' : 'p-4';
                             
                             return (
                                 <div key={i} className={`flex items-center gap-5 ${rowPadding} rounded-2xl hover:bg-gray-100 dark:hover:bg-white/5 border border-transparent hover:border-gray-100 dark:hover:border-slate-700 transition-all shadow-md bg-white dark:bg-[#1a1c1e]/30 group`}>
                                     <div className="flex flex-col items-center w-24 shrink-0 border-r border-gray-100 dark:border-slate-700 pr-3">
                                         <span className={`${timeSize} font-black text-gray-900 dark:text-gray-100 font-mono tracking-tighter`}>{timeStr}</span>
                                         <span className="text-[11px] uppercase text-gray-500 dark:text-slate-400 font-black tracking-widest mt-1">{dayLabel}</span>
                                     </div>
                                     
                                     <div className={`w-2.5 ${item.isMaximized ? 'h-20' : 'h-12'} rounded-full shrink-0 ${getImpactColor(e.impact)} shadow-lg`}></div>
                                     <div className="flex-1 min-w-0 flex items-center gap-5">
                                         <img src={getFlag(e.country)} className={`${item.isMaximized ? 'w-10 h-10' : 'w-8 h-8'} rounded-full shadow-xl shrink-0 border-2 border-white/20`} alt={e.country} />
                                         <span className={`${textSize} font-black text-gray-900 dark:text-gray-100 truncate leading-tight group-hover:text-[#dd9933] transition-colors tracking-tight uppercase`}>{e.title}</span>
                                     </div>

                                     <div className={`grid grid-cols-3 gap-5 shrink-0 text-right ${item.isMaximized ? 'w-[30%] min-w-[300px]' : 'w-[240px]'}`}>
                                         <div className="flex flex-col">
                                             <span className="text-[11px] text-gray-500 dark:text-slate-500 font-black uppercase tracking-tighter hidden sm:block">{t.previous}</span>
                                             <span className={`${item.isMaximized ? 'text-lg' : 'text-base'} text-gray-700 dark:text-gray-300 font-mono font-black`}>{e.previous || '--'}</span>
                                         </div>
                                         <div className="flex flex-col">
                                             <span className="text-[11px] text-gray-500 dark:text-slate-500 font-black uppercase tracking-tighter hidden sm:block">{t.forecast}</span>
                                             <span className={`${item.isMaximized ? 'text-lg' : 'text-base'} text-[#dd9933] font-mono font-black`}>{e.forecast || '--'}</span>
                                         </div>
                                         <div className="flex flex-col">
                                             <span className="text-[11px] text-gray-500 dark:text-slate-500 font-black uppercase tracking-tighter hidden sm:block">{t.actual}</span>
                                             <span className={`${item.isMaximized ? 'text-lg' : 'text-base'} text-gray-700 dark:text-gray-300 font-mono font-black`}>--</span>
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