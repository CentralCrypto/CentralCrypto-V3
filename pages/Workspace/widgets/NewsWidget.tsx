
import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchCryptoNews, NewsItem } from '../../../services/api';
import { DashboardItem, Language } from '../../../types';
import { getTranslations } from '../../../locales';

interface Props {
  item: DashboardItem;
  coinName?: string;
  language?: Language;
}

const NewsWidget: React.FC<Props> = ({ item, coinName, language = 'pt' }) => {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const t = getTranslations(language as Language).workspace.widgets.news;

    useEffect(() => {
        setIsLoading(true);
        fetchCryptoNews(item.symbol, coinName || '').then(data => {
            setNews(data);
            setIsLoading(false);
        });
    }, [item.symbol, coinName]);
    
    const Watermark = () => <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-[0.05] z-0"><img src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" alt="watermark" className="w-3/4 h-auto grayscale filter" /></div>;

    if (isLoading) {
        return <div className="flex items-center justify-center h-full text-slate-500"><Loader2 className="animate-spin" /></div>;
    }

    if (news.length === 0) {
        return (
            <div className="text-center text-slate-500 text-xs py-4 flex flex-col items-center justify-center h-full">
                <span className="font-bold">{t.noNews}</span>
                <span className="opacity-70 mt-1">{t.tryAnother}</span>
            </div>
        );
    }

    if (item.isMaximized) {
        return (
             <div className="h-full flex flex-col relative bg-white dark:bg-[#1a1c1e] p-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
                     {news.map((n, idx) => (
                         <a key={idx} href={n.link} target="_blank" rel="noopener noreferrer" className="bg-white dark:bg-[#1a1c1e] rounded-lg border-0 dark:border dark:border-slate-700 hover:border-0 hover:shadow-md dark:hover:border-[#dd9933] transition-colors group overflow-hidden flex flex-col h-[200px] shadow-sm">
                             {n.thumbnail ? <div className="h-24 bg-cover bg-center" style={{backgroundImage: `url(${n.thumbnail})`}}></div> : <div className="h-24 bg-gray-200 dark:bg-slate-800 flex items-center justify-center text-gray-500 dark:text-slate-600 text-xs uppercase">No Image</div>}
                             <div className="p-3 flex flex-col flex-1">
                                 <div className="text-[10px] text-[#dd9933] font-bold uppercase mb-1">{n.source}</div>
                                 <h4 className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2 leading-tight group-hover:underline">{n.title}</h4>
                                 {n.description && <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-2 line-clamp-2" dangerouslySetInnerHTML={{__html: n.description.replace(/<[^>]*>?/gm, '')}}></p>}
                             </div>
                         </a>
                     ))}
                 </div>
             </div>
        );
    }
    
    // Minimized View
    return (
        <div className="h-full flex flex-col relative bg-white dark:bg-[#2f3032]">
            <div className="flex-1 overflow-y-auto p-2 relative z-10 custom-scrollbar">
                 <div className="space-y-2">
                    {news.map((n, idx) => (
                        // Fixed hover:bg-gray-100 for light mode
                        <a key={idx} href={n.link} target="_blank" rel="noopener noreferrer" className="block bg-white dark:bg-[#1a1c1e] p-2 rounded border-0 dark:border dark:border-slate-700/50 hover:bg-gray-100 dark:hover:border-[#dd9933]/50 transition-colors group shadow-sm">
                            <div className="flex gap-3">
                                {n.thumbnail && <img src={n.thumbnail} alt="" className="w-12 h-12 object-cover rounded bg-gray-200 dark:bg-slate-800 shrink-0"/>}
                                <div className="flex-1 min-w-0">
                                    <div className="text-[10px] font-bold text-[#dd9933] uppercase mb-0.5 flex justify-between">
                                        <span>{n.source}</span>
                                        <span>{new Date(n.pubDate).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    <h4 className="text-xs font-bold text-gray-700 dark:text-slate-200 leading-snug line-clamp-2 group-hover:text-black dark:group-hover:text-white">{n.title}</h4>
                                </div>
                            </div>
                        </a>
                    ))}
                 </div>
            </div>
        </div>
    );
};

export default NewsWidget;
