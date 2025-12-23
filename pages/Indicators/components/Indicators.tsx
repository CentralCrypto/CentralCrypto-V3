import React, { useState, useRef } from 'react';
import { ExternalLink, Lock, Unlock, ThumbsUp, MessageCircle, Star, Crown, Search, GripVertical, Save, Loader2 } from 'lucide-react';
import { getConstants } from '../constants';
import { Language, Indicator } from '../../../types';
import { TVLogo } from './Hero';
import { getTranslations } from '../../../locales';

interface IndicatorsProps {
  onSelectIndicator: (id: string) => void;
  currentLang: Language;
  customList?: Indicator[];
  isAdmin?: boolean;
  onReorder?: (newOrder: Indicator[]) => void;
  onSaveOrder?: () => Promise<void>;
}

export const Indicators: React.FC<IndicatorsProps> = ({ 
  onSelectIndicator, 
  currentLang, 
  customList,
  isAdmin = false,
  onReorder,
  onSaveOrder
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasReordered, setHasReordered] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const { indicators: defaultIndicators } = getConstants(currentLang);
  const indicators = customList || defaultIndicators;
  const t = getTranslations(currentLang).indicators.list;

  const filteredIndicators = indicators.filter(indicator => {
    if (!searchTerm.trim()) return true;
    const searchTerms = searchTerm.toLowerCase().split(' ').filter(t => t.trim() !== '');
    return searchTerms.every(term => {
        const cleanTerm = term.replace('#', '');
        return indicator.tags.some(tag => tag.toLowerCase().includes(cleanTerm));
    });
  });

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    dragItem.current = position;
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    dragOverItem.current = position;
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const handleSort = () => {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) return;
    const _indicators = [...indicators];
    const draggedItemContent = _indicators.splice(dragItem.current, 1)[0];
    _indicators.splice(dragOverItem.current, 0, draggedItemContent);
    dragItem.current = dragOverItem.current;
    dragOverItem.current = null;
    if (onReorder) {
        onReorder(_indicators);
        setHasReordered(true);
    }
  };

  const handleSaveOrderClick = async () => {
      if (onSaveOrder) {
          setIsSavingOrder(true);
          await onSaveOrder();
          setIsSavingOrder(false);
          setHasReordered(false);
      }
  };

  const getLocalizedDescription = (ind: Indicator) => {
      if (currentLang === 'en' && ind.description_en) return ind.description_en;
      if (currentLang === 'es' && ind.description_es) return ind.description_es;
      return ind.description;
  };

  return (
    <section id="indicadores" className="py-20 bg-gray-50 dark:bg-tech-950 relative transition-colors duration-300">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-left mb-8 border-b border-transparent dark:border-tech-800 pb-4 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t.title}</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
              {isAdmin && hasReordered && (
                  <button onClick={handleSaveOrderClick} disabled={isSavingOrder} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-bold animate-pulse shadow-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed">
                      {isSavingOrder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {isSavingOrder ? 'Salvando...' : 'Salvar Ordem'}
                  </button>
              )}
              <div className="relative flex-grow md:flex-grow-0 md:min-w-[300px]">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-4 w-4 text-gray-400" /></div>
                  <input type="text" className="block w-full pl-10 pr-3 py-2 border-none rounded-lg leading-5 bg-white dark:bg-tech-900 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-tech-accent sm:text-sm transition-colors shadow-sm dark:shadow-none" placeholder={t.searchPlaceholder} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mb-6">
             {isAdmin && (
                <div className={`mr-auto text-xs font-bold px-2 py-1 rounded border flex items-center gap-1 transition-colors ${searchTerm ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-tech-accent/10 text-tech-accent border-tech-accent/20'}`}>
                    <GripVertical className="w-3 h-3" /> {searchTerm ? "ADMIN: Limpe a busca para reordenar" : "ADMIN: Arraste os cards para organizar"}
                </div>
             )}
             <div className="text-xs text-gray-500 flex items-center gap-1"><Crown className="w-3 h-3 text-yellow-500" /> VIP</div>
             <div className="text-xs text-gray-500 flex items-center gap-1"><Star className="w-3 h-3 text-tech-accent" /> Editor's Pick</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredIndicators.length > 0 ? (
             filteredIndicators.map((indicator, index) => (
            <div key={indicator.id} className={`flex flex-col h-full bg-white dark:bg-tech-900 border-0 dark:border dark:border-tech-800 rounded-xl overflow-hidden transition-all duration-300 group shadow-sm hover:shadow-xl ${indicator.badge === 'VIP' ? 'shadow-[0_0_15px_rgba(234,179,8,0.1)]' : ''} ${isAdmin && !searchTerm ? 'cursor-move' : ''}`} draggable={isAdmin && !searchTerm} onDragStart={(e) => isAdmin && handleDragStart(e, index)} onDragEnter={(e) => isAdmin && handleDragEnter(e, index)} onDragEnd={isAdmin ? handleDragEnd : undefined} onDragOver={(e) => e.preventDefault()} onDrop={(e) => isAdmin && handleSort()}>
              
              <div className="w-full aspect-video relative overflow-hidden bg-gray-100 dark:bg-gray-900 cursor-pointer" onClick={() => !isDragging && onSelectIndicator(indicator.id)}>
                <img src={indicator.imageUrl} alt={indicator.title} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transform transition-transform duration-500 group-hover:scale-105" />
                {isAdmin && !searchTerm && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"><GripVertical className="w-12 h-12 text-white drop-shadow-lg" /></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="absolute top-3 left-3"><span className={`text-[10px] font-bold uppercase px-2 py-1 rounded text-white shadow-sm ${indicator.type === 'Strategy' ? 'bg-purple-600' : 'bg-tech-accent'}`}>{indicator.type === 'Strategy' ? t.strategy : t.indicator}</span></div>
                {indicator.badge && (
                    <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
                        {indicator.badge === 'VIP' && <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded bg-yellow-500 text-black shadow-sm"><Crown className="w-3 h-3" /> VIP</span>}
                        {indicator.badge === "Editor's Pick" && <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded bg-tech-accent text-white shadow-sm"><Star className="w-3 h-3 fill-current" /> Pick</span>}
                        {indicator.badge === "New" && <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded bg-green-500 text-white shadow-sm">NEW</span>}
                    </div>
                )}
              </div>
              
              <div className="p-5 flex flex-col flex-grow">
                <div className="flex justify-between items-start gap-2 mb-3">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-tech-accent transition-colors leading-tight cursor-pointer" onClick={() => onSelectIndicator(indicator.id)}>{indicator.title}</h3>
                    <div className="flex-shrink-0 mt-1">{indicator.price.includes('Protegido') || indicator.price.includes('Protected') || indicator.price.includes('Protegido') ? <div className="text-tech-accent" title="Script Protegido"><Lock className="w-4 h-4" /></div> : <div className="text-gray-400 dark:text-gray-500" title="Código Aberto"><Unlock className="w-4 h-4" /></div>}</div>
                </div>
                <div className="flex-grow mb-4 cursor-pointer" onClick={() => onSelectIndicator(indicator.id)}>
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed line-clamp-3">{getLocalizedDescription(indicator)}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-5">
                    {indicator.tags.slice(0, 4).map(tag => (
                        <span key={tag} className={`text-[10px] font-medium px-2 py-1 rounded bg-gray-100 dark:bg-[#2a2e39] text-gray-600 dark:text-gray-400 border border-transparent dark:border-tech-700 cursor-pointer hover:bg-tech-accent hover:text-white transition-colors ${searchTerm.toLowerCase().includes(tag.toLowerCase()) ? 'bg-tech-accent text-white border-tech-accent' : ''}`} onClick={(e) => { e.stopPropagation(); setSearchTerm(`#${tag}`); }}>#{tag}</span>
                    ))}
                </div>
                <div className="pt-4 border-t border-gray-100 dark:border-tech-800 flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-3 text-gray-500 text-xs font-medium">
                        <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {indicator.likes}</span>
                        <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {indicator.comments}</span>
                  </div>
                  <a href={indicator.originalUrl} target="_blank" rel="noopener noreferrer" className="text-tech-accent hover:text-amber-600 text-xs font-bold uppercase tracking-wide flex items-center transition-colors group/link">
                    Abrir no <TVLogo className="ml-1 h-3 w-auto text-tech-accent group-hover/link:text-amber-600" showText={false} />
                  </a>
                </div>
              </div>
            </div>
          ))
          ) : (
              <div className="col-span-full text-center py-12">
                  <div className="inline-block p-4 rounded-full bg-gray-100 dark:bg-gray-800 mb-4"><Search className="w-8 h-8 text-gray-400" /></div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t.emptyTitle}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">{t.emptyDesc}</p>
                  <button onClick={() => setSearchTerm('')} className="mt-4 text-tech-accent hover:underline text-sm font-bold">{t.clearFilter}</button>
              </div>
          )}
        </div>
        
        <div className="mt-16 flex justify-center">
             <a href="https://www.tradingview.com/u/Central_CryptoTraders/#published-scripts" target="_blank" rel="noopener noreferrer" className="px-8 py-3 rounded-full border border-gray-300 dark:border-tech-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-tech-800 hover:text-black dark:hover:text-white transition-all text-sm font-bold flex items-center gap-2 shadow-sm">
                 {t.loadMore} <ExternalLink className="w-4 h-4"/>
             </a>
        </div>
      </div>
    </section>
  );
};