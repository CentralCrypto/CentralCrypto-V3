
import React, { useState, useMemo, useEffect } from 'react';
import { Topic, AcademyLanguage } from '../../../types';
import { ChevronDown, PlusCircle, Edit2, Trash2, GraduationCap, Loader2, CloudLightning, Database, CloudOff, RefreshCw, GripVertical } from 'lucide-react';

interface SidebarProps {
  topics: Topic[];
  selectedTopicId: string | null;
  currentLanguage: AcademyLanguage;
  isAdmin: boolean;
  apiStatus: 'connected' | 'offline' | 'loading';
  isSaving: boolean;
  onSelectTopic: (topic: Topic) => void;
  onOpenAddModal: () => void;
  onEditTopic: (topic: Topic) => void;
  onDeleteTopic: (topicId: string) => void;
  onReload: () => void;
  onMoveTopic?: (draggedId: string, targetId: string) => void;
}

interface SidebarItemProps {
  topic: Topic;
  level: number;
  selectedTopicId: string | null;
  currentLanguage: AcademyLanguage;
  isAdmin: boolean;
  onSelectTopic: (topic: Topic) => void;
  onEditTopic: (topic: Topic) => void;
  onDeleteTopic: (topicId: string) => void;
  onMoveTopic?: (draggedId: string, targetId: string) => void;
}

const TIER_MAP: { [key in Topic['tier']]: { label: string; color: string; textColor: string; } } = {
  0: { label: 'Público', color: '#22ab94', textColor: 'text-white' },
  1: { label: 'Básico', color: '#5b9cf6', textColor: 'text-white' },
  2: { label: 'Intermediário', color: '#dd9933', textColor: 'text-black' },
  3: { label: 'Avançado', color: '#9575cd', textColor: 'text-white' },
};

const SidebarItem: React.FC<SidebarItemProps> = ({ 
  topic, 
  level, 
  selectedTopicId, 
  currentLanguage, 
  isAdmin,
  onSelectTopic,
  onEditTopic,
  onDeleteTopic,
  onMoveTopic
}) => {
  const hasActiveChild = useMemo(() => {
    if (!selectedTopicId) return false;
    const check = (t: Topic): boolean => {
       if (t.id === selectedTopicId) return true;
       return t.children ? t.children.some(check) : false;
    };
    return topic.children ? topic.children.some(check) : false;
  }, [topic, selectedTopicId]);

  const [isOpen, setIsOpen] = useState(hasActiveChild);
  
  useEffect(() => {
     if (hasActiveChild) setIsOpen(true);
  }, [hasActiveChild]);

  const hasChildren = topic.children && topic.children.length > 0;
  const isSelected = selectedTopicId === topic.id;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectTopic(topic);
    if (hasChildren && !isOpen) setIsOpen(true);
  };

  // Drag and Drop Handlers - Fixed for standard HTML5 D&D
  const handleDragStart = (e: React.DragEvent) => {
      e.stopPropagation();
      e.dataTransfer.setData('text/plain', topic.id); // Use standard text/plain
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); 
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const draggedId = e.dataTransfer.getData('text/plain');
      if (draggedId && draggedId !== topic.id && onMoveTopic) {
          onMoveTopic(draggedId, topic.id);
      }
  };

  const displayTitle = topic.displayTitle?.[currentLanguage] || topic.title;
  const tierInfo = TIER_MAP[topic.tier];
  
  const baseTextColor = "text-gray-700 dark:text-gray-300";
  const hoverTextColor = "hover:text-black dark:hover:text-white";
  const selectedTextColor = "text-tech-500 dark:text-tech-500";
  // Updated selected background for dark mode to be lighter (#2f3032) instead of black/40
  const selectedBgColor = "bg-gray-100 dark:bg-[#2f3032]";

  return (
    <div className="w-full font-sans">
      <div 
        className={`group/item flex items-center py-2.5 pr-3 mb-0.5 rounded-r-lg cursor-pointer transition-all select-none relative ${
            isSelected 
              ? `${selectedBgColor} font-bold shadow-sm` 
              : `${hoverTextColor} hover:bg-gray-50 dark:hover:bg-white/5`
          }`}
        style={{ paddingLeft: `${Math.max(0.5, level * 1.2)}rem` }}
        onClick={handleSelect}
        draggable={isAdmin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isAdmin && (
            <div className="opacity-0 group-hover/item:opacity-50 hover:!opacity-100 cursor-grab mr-1 text-gray-400">
                <GripVertical size={14} />
            </div>
        )}

        <div className={`w-6 h-6 flex items-center justify-center shrink-0 mr-1 rounded-md transition-colors ${hasChildren ? 'hover:bg-black/5 dark:hover:bg-white/10' : ''}`} onClick={hasChildren ? handleToggle : undefined}>
            {hasChildren ? (<span className={`transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}><ChevronDown size={14} className={isSelected ? 'text-tech-500' : 'text-gray-400'} /></span>) : (<span className="w-4"></span>)}
        </div>

        <div className="flex items-center flex-1 min-w-0 mr-2 relative">
            {level === 0 && <GraduationCap size={18} className={`mr-2 shrink-0 ${isSelected ? 'text-tech-500' : 'text-gray-400'} ${tierInfo ? '' : 'text-gray-300'}`} />}
            
            <div className="relative flex-1 min-w-0">
                <span 
                    className={`block w-full whitespace-normal break-words text-sm leading-snug ${level === 0 ? 'font-bold uppercase tracking-wide' : 'font-medium'} ${isSelected ? selectedTextColor : baseTextColor}`}
                >
                    {displayTitle}
                </span>
            </div>
        </div>

        {tierInfo && (
            <div className="relative group/tooltip ml-auto shrink-0 pl-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tierInfo.color }}></div>
                <div 
                  className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-[10px] font-bold rounded shadow-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 ${tierInfo.textColor}`}
                  style={{ backgroundColor: tierInfo.color }}
                >
                    {tierInfo.label}
                    <div 
                      className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 transform -translate-y-1"
                      style={{ backgroundColor: tierInfo.color }}
                    ></div>
                </div>
            </div>
        )}

        {/* Action Buttons - Fixed Dark Mode Background to be darker (#1a1c1e) */}
        {isAdmin && (
            <div className="hidden group-hover/item:flex items-center gap-1 ml-auto bg-gray-100 dark:bg-[#1a1c1e] rounded px-1 absolute right-2 z-30 shadow-md border border-gray-200 dark:border-tech-700">
                <button onClick={(e) => { e.stopPropagation(); onEditTopic(topic); }} className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-500 dark:text-blue-400 rounded" title="Editar Tópico"><Edit2 size={12} /></button>
                <button onClick={(e) => { e.stopPropagation(); if(confirm(`Tem certeza que deseja excluir "${displayTitle}"? Esta ação é irreversível.`)) onDeleteTopic(topic.id); }} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500 dark:text-red-400 rounded" title="Excluir Tópico"><Trash2 size={12} /></button>
            </div>
        )}
      </div>

      {isOpen && hasChildren && (
        <div className="mt-0.5 animate-in slide-in-from-top-1 duration-200">
          {topic.children.map((child) => <SidebarItem key={child.id} topic={child} level={level + 1} selectedTopicId={selectedTopicId} currentLanguage={currentLanguage} isAdmin={isAdmin} onSelectTopic={onSelectTopic} onEditTopic={onEditTopic} onDeleteTopic={onDeleteTopic} onMoveTopic={onMoveTopic} />)}
        </div>
      )}
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ 
  topics, selectedTopicId, currentLanguage, isAdmin, apiStatus, isSaving, onSelectTopic, onOpenAddModal, onEditTopic, onDeleteTopic, onReload, onMoveTopic
}) => {
  return (
    // Removed borders, added subtle shadow
    <aside className="w-[370px] md:w-[434px] bg-white dark:bg-[#1a1c1e] flex flex-col h-full shadow-lg z-10 transition-colors duration-300 shrink-0">
      
      {/* Header - Fixed colors */}
      <div className="p-5 text-center shrink-0 bg-gray-50 dark:bg-[#1a1c1e]">
        <div className="flex items-center justify-center gap-3 mb-4">
            <img 
                src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png"
                alt="Central Crypto Logo"
                className="h-8 w-auto"
            />
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">Central Academy</h3>
        </div>
        
        {/* Legend Box - Fixed Dark Mode Color */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-xs justify-items-start pl-10 bg-white dark:bg-[#2f3032] p-3 rounded-lg shadow-sm">
            {Object.values(TIER_MAP).map(tier => (
            <div key={tier.label} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tier.color }}></div>
                <span className="font-semibold text-gray-600 dark:text-gray-300">{tier.label}</span>
            </div>
            ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar py-4 px-2 min-h-0 relative bg-white dark:bg-[#1a1c1e]">
        {topics.map((topic) => <SidebarItem key={topic.id} topic={topic} level={0} selectedTopicId={selectedTopicId} currentLanguage={currentLanguage} isAdmin={isAdmin} onSelectTopic={onSelectTopic} onEditTopic={onEditTopic} onDeleteTopic={onDeleteTopic} onMoveTopic={onMoveTopic} />)}
        
        {topics.length === 0 && (
          <div className="p-6 text-center text-gray-500 text-sm flex flex-col items-center justify-center h-40">
            {apiStatus === 'loading' ? (<><Loader2 className="mb-2 opacity-50 animate-spin" size={24} /><p>Carregando curso...</p></>) : (<p>Nenhum conteúdo disponível.</p>)}
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="shrink-0 p-4 bg-gray-50 dark:bg-[#1a1c1e] relative z-20 flex flex-col gap-3">
            <div className="flex flex-col gap-2">
                <button onClick={onOpenAddModal} className="w-full flex items-center justify-center space-x-2 bg-[#dd9933] hover:bg-tech-400 text-tech-950 py-2.5 px-4 rounded-lg transition-all shadow-sm font-bold text-sm">
                    <PlusCircle size={16} />
                    <span>Novo Tópico</span>
                </button>
            </div>

            <div className="pt-2 border-t border-gray-200 dark:border-tech-700/50 space-y-2">
                <div className="flex items-center justify-between w-full">
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                        isSaving ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700/50' 
                        : apiStatus === 'connected' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-300 dark:border-green-700/50'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-300 dark:border-red-700/50'
                    }`}>
                        {isSaving ? <CloudLightning size={10} className="animate-pulse"/> : apiStatus === 'connected' ? <Database size={10} /> : <CloudOff size={10} />}
                        <span>{isSaving ? 'Sincronizando...' : apiStatus === 'connected' ? 'Auto-Save Ativo' : 'Modo Offline'}</span>
                    </div>
                </div>

                <button onClick={onReload} className="flex items-center justify-center gap-1.5 w-full py-1.5 px-2 text-[10px] uppercase font-bold text-gray-500 hover:text-[#dd9933] hover:bg-gray-100 dark:hover:bg-tech-800 rounded transition-colors" title="Forçar recarregamento do banco de dados">
                    <RefreshCw size={10} />
                    Recarregar do BD
                </button>
            </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
