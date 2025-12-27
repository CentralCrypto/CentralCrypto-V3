
import React, { useState, useRef } from 'react';
import { X, Maximize2, Minimize2, Info } from 'lucide-react';
import { DashboardItem, WidgetType, Language } from '../../../types';
import { getTranslations } from '../../../locales';

interface Props {
  item: DashboardItem;
  onRemove: (id: string) => void;
  onToggleMaximize: (id: string) => void;
  language?: Language;
}

const GridHeader: React.FC<Props> = ({ item, onRemove, onToggleMaximize, language = 'pt' }) => {
  const t = getTranslations(language as Language).dashboard.widgets;
  const tWorkspace = getTranslations(language as Language).workspace.widgets;

  const getWidgetInfo = (type: WidgetType) => {
      switch(type) {
          case WidgetType.FEAR_GREED: return { title: tWorkspace.fng.title, desc: tWorkspace.fng.desc };
          case WidgetType.RSI_AVG: return { title: tWorkspace.rsi.title, desc: tWorkspace.rsi.desc };
          case WidgetType.MACD_AVG: return { title: tWorkspace.macd.title, desc: tWorkspace.macd.desc };
          case WidgetType.TRUMP_METER: return { title: tWorkspace.trump.title, desc: tWorkspace.trump.desc };
          case WidgetType.LONG_SHORT_RATIO: return { title: tWorkspace.lsr.title, desc: tWorkspace.lsr.desc };
          case WidgetType.ALTCOIN_SEASON: return { title: tWorkspace.altseason.title, desc: tWorkspace.altseason.desc };
          case WidgetType.ETF_NET_FLOW: return { title: tWorkspace.etf.title, desc: tWorkspace.etf.desc };
          case WidgetType.GAINERS_LOSERS: return { title: tWorkspace.gainers.title, desc: tWorkspace.gainers.desc };
          // Fix: Always return { title, desc } for all widget types
          case WidgetType.PRICE: return { title: tWorkspace.price.price, desc: tWorkspace.price.desc };
          case WidgetType.VOLUME: return { title: tWorkspace.volume.vol24h, desc: tWorkspace.volume.desc };
          case WidgetType.TREND: return { title: tWorkspace.trend.bullish, desc: tWorkspace.trend.desc };
          case WidgetType.SENTIMENT: return { title: tWorkspace.sentiment.greed, desc: tWorkspace.sentiment.desc };
          case WidgetType.ORDER_BOOK: return { title: tWorkspace.orderbook.price, desc: tWorkspace.orderbook.desc };
          case WidgetType.NEWS: return { title: tWorkspace.news.noNews, desc: tWorkspace.news.desc };
          default: return null;
      }
  };

  const info = getWidgetInfo(item.type);
  const [showInfo, setShowInfo] = useState(false);
  const [tooltipPositionClass, setTooltipPositionClass] = useState('left-0');
  const infoRef = useRef<HTMLDivElement>(null);

  const handleShowInfo = () => {
    if (infoRef.current) {
      const rect = infoRef.current.getBoundingClientRect();
      if (rect.right + 288 > window.innerWidth) {
        setTooltipPositionClass('right-0');
      } else {
        setTooltipPositionClass('left-0');
      }
    }
    setShowInfo(true);
  };

  return (
    <div className="grid-drag-handle flex items-center justify-between px-3 py-2 bg-[#dbdbdb] dark:bg-[#1a1c1e] border-0 dark:border-b dark:border-slate-700/50 cursor-move rounded-t-lg group relative z-50 transition-colors">
      <div className="flex items-center gap-2 pointer-events-none">
        <div className="p-1 rounded bg-white dark:bg-[#2f3032] text-gray-800 dark:text-slate-400 text-[10px] font-bold shadow-sm">
           {item.symbol}
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-slate-300 select-none">
          {item.title}
        </span>
        
        {info && (
             <div
                ref={infoRef}
                className="relative ml-1 pointer-events-auto"
                onMouseEnter={handleShowInfo}
                onMouseLeave={() => setShowInfo(false)}
             >
                 <Info size={14} className="text-gray-500 dark:text-slate-500 hover:text-[#dd9933] cursor-help" />
                 <div className={`absolute ${tooltipPositionClass} top-6 w-64 p-3 bg-white dark:bg-[#0f1011] border border-gray-100 dark:border-slate-600 rounded-lg shadow-2xl text-xs text-gray-600 dark:text-slate-300 transition-opacity duration-200 pointer-events-none z-[9999] ${showInfo ? 'opacity-100' : 'opacity-0'}`}>
                     <p className="font-bold text-[#dd9933] text-sm mb-2">{info.title}</p>
                     <p className="mb-2 leading-relaxed text-gray-600 dark:text-slate-300">
                        {info.desc}
                     </p>
                 </div>
             </div>
        )}
      </div>
      
      <div className="flex items-center gap-1 opacity-100" onMouseDown={(e) => e.stopPropagation()}>
        <button 
          onClick={() => onToggleMaximize(item.id)}
          className="p-1 text-gray-600 dark:text-slate-400 hover:bg-[#f3f4f6] dark:hover:bg-[#2f3032] hover:text-gray-900 dark:hover:text-white rounded transition-colors"
          title={item.isMaximized ? "Restore" : "Maximize"}
        >
          {item.isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <button 
          onClick={() => onRemove(item.id)}
          className="p-1 text-gray-600 dark:text-slate-400 hover:bg-red-100 dark:hover:bg-[#2f3032] hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
          title="Close Widget"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default GridHeader;
