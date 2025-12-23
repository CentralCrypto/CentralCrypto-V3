
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
            
            // Set range: Yesterday Start to Tomorrow End
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
                
                // Compare timestamps
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
        if (checkDate.getTime() === yesterday.getTime()) return 'ONTEM'; // Should translate this too if possible
        return d.toLocaleDateString();
    };

    return (
        <div className="h-full flex flex-col relative bg-white dark:bg-[#2f3032] p-4">
             <div className="flex justify-between items-center mb-3 relative z-20 h-6 shrink-0 border-b border-gray-100 dark:border-slate-700/50 pb-2">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wider">{t.title}</span>
                </div>
                
                <div className="flex items-center gap-1">
                    <button 
                        onClick={() => setFilter(prev => prev === 'BRL' ? 'ALL' : 'BRL')} 
                        className={`transition-opacity hover:scale-110 ${filter === 'BRL' ? 'opacity-100 scale-110' : filter === 'ALL' ? 'opacity-100' : 'opacity-30 grayscale'}`}
                        title="Filter BRL"
                    >
                        <img src="https://hatscripts.github.io/circle-flags/flags/br.svg" className="w-4 h-4 rounded-full shadow-sm" alt="BRL" />
                    </button>
                    <button 
                        onClick={() => setFilter(prev => prev === 'USD' ? 'ALL' : 'USD')} 
                        className={`transition-opacity hover:scale-110 ${filter === 'USD' ? 'opacity-100 scale-110' : filter === 'ALL' ? 'opacity-100' : 'opacity-30 grayscale'}`}
                        title="Filter USD"
                    >
                        <img src="https://hatscripts.github.io/circle-flags/flags/us.svg" className="w-4 h-4 rounded-full shadow-sm" alt="USD" />
                    </button>
                </div>
            </div>
            
            <div className="flex-1 w-full relative z-10 overflow-y-auto custom-scrollbar pr-1">
                 {loading ? (
                     <div className="flex items-center justify-center h-full text-gray-500 text-xs">
                         <Loader2 className="animate-spin w-4 h-4 mr-2" /> {common.loading}
                     </div>
                 ) : filteredEvents.length === 0 ? (
                     <div className="flex items-center justify-center h-full text-gray-500 text-xs text-center px-4">
                         No events found.
                     </div>
                 ) : (
                     <div className="flex flex-col gap-1">
                         {filteredEvents.map((e, i) => {
                             const date = new Date(e.date);
                             // FORCE 24H FORMAT FOR ALL LANGUAGES
                             const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute:'2-digit', hour12: false });
                             const dayLabel = getDayLabel(date);
                             
                             // Maximized Sizing
                             const textSize = item.isMaximized ? 'text-sm' : 'text-xs';
                             const timeSize = item.isMaximized ? 'text-xs' : 'text-[10px]';
                             const rowPadding = item.isMaximized ? 'p-3' : 'p-2';
                             
                             return (
                                 <div key={i} className={`flex items-center gap-2 ${rowPadding} rounded hover:bg-gray-100 dark:hover:bg-white/5 border border-transparent hover:border-gray-100 dark:hover:border-slate-700 transition-colors`}>
                                     <div className="flex flex-col items-center w-12 shrink-0">
                                         <span className={`${timeSize} font-bold text-gray-600 dark:text-gray-300`}>{timeStr}</span>
                                         <span className="text-[8px] uppercase text-gray-400 dark:text-slate-500 font-bold">{dayLabel}</span>
                                     </div>
                                     
                                     <div className={`w-1 ${item.isMaximized ? 'h-10' : 'h-8'} rounded-full shrink-0 ${getImpactColor(e.impact)}`}></div>
                                     <div className="flex-1 min-w-0 flex items-center gap-2">
                                         <img src={getFlag(e.country)} className={`${item.isMaximized ? 'w-5 h-5' : 'w-4 h-4'} rounded-full shadow-sm shrink-0`} alt={e.country} />
                                         <span className={`${textSize} font-bold text-gray-800 dark:text-gray-200 truncate leading-tight`}>{e.title}</span>
                                     </div>

                                     <div className={`grid grid-cols-3 gap-2 shrink-0 text-right ${item.isMaximized ? 'w-[30%] min-w-[220px]' : 'w-[140px]'}`}>
                                         <div className="flex flex-col hidden sm:flex">
                                             <span className="text-[8px] text-gray-500 dark:text-slate-500 font-bold uppercase">{t.previous}</span>
                                             <span className={`${item.isMaximized ? 'text-xs' : 'text-[9px]'} text-gray-700 dark:text-gray-300 font-mono font-bold`}>{e.previous}</span>
                                         </div>
                                         <div className="flex flex-col">
                                             <span className="text-[8px] text-gray-500 dark:text-slate-500 font-bold uppercase">{t.forecast}</span>
                                             <span className={`${item.isMaximized ? 'text-xs' : 'text-[9px]'} text-gray-700 dark:text-gray-300 font-mono font-bold`}>{e.forecast || '--'}</span>
                                         </div>
                                         <div className="flex flex-col">
                                             <span className="text-[8px] text-gray-500 dark:text-slate-500 font-bold uppercase">{t.actual}</span>
                                             <span className={`${item.isMaximized ? 'text-xs' : 'text-[9px]'} text-gray-700 dark:text-gray-300 font-mono font-bold`}>--</span>
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
