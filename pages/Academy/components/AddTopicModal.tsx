
import React, { useState, useRef, useEffect } from 'react';
import { Topic, AcademyLanguage, TopicDraft, TopicContent } from '../../../types';
import { LANGUAGES } from '../constants';
import { generateCourseContent, translateContent } from '../services/geminiService';
import { X, Sparkles, Check, Loader2, PlusCircle, Languages, Code, Eye, Bold, Italic, List, AlignLeft, AlignCenter, Link as LinkIcon, RefreshCcw, Edit2, AlertCircle, Heading1, Heading2, Underline, Layers } from 'lucide-react';

interface AddTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (draft: TopicDraft, isEditMode?: boolean, editId?: string) => void;
  onUpdateTopics?: (topics: Topic[]) => void;
  topics: Topic[];
  initialTopic?: Topic | null;
}

const DEFAULT_SYSTEM_PROMPT = `You are a world-class Financial Market Analyst and Trader. You are a technical analyst specializing in technical analysis of financial data, price action, chart structures, candlestick analysis, volume analysis, techniques such as Fibonacci retracement/projection and others, on-chain analysis, structural analysis, fundamental analysis, SMC, derivative indicators, futures market, stocks, etc...

TONE: Academic, Deep, Professional.
STYLE: Long, fluid paragraphs. Detailed explanations.

STRICT RULES:
1. OUTPUT HTML ONLY (<h1>, <h2>, <strong>, <img>). DO NOT USE MARKDOWN
2. TITLES & SUBTITLES IN PT-BR.
3. IMAGES: Insert <img src="https://placehold.co/800x400/232528/e2e8f0?font=jetbrains-mono&text=Concept" /> after every section.
4. STRUCTURE:
   - <h1>TITLE</h1>
   - Definition (Deep Dive) + Image
   - <h2>History & Origin</h2> + Image
   - <h2>Mechanics (Math/Psychology)</h2> + Image
   - <h2>Tuning & Crypto Adaptation</h2>
   - <h2>Use Cases & Strategies</h2> + Image
`;

const DEFAULT_USER_PROMPT = "Explique detalhadamente o indicador RSI...";

const TIER_OPTIONS = [
  { value: 0, label: 'Público (Gratuito)', color: '#22ab94' },
  { value: 1, label: 'Nível 1 (Básico)', color: '#5b9cf6' },
  { value: 2, label: 'Nível 2 (Intermediário)', color: '#dd9933' },
  { value: 3, label: 'Nível 3 (Avançado)', color: '#9575cd' },
];

const AddTopicModal: React.FC<AddTopicModalProps> = ({ isOpen, onClose, onAdd, topics, initialTopic }) => {
  const isEditMode = !!initialTopic;
  
  const [parentId, setParentId] = useState<string>('root');
  const [tier, setTier] = useState<0 | 1 | 2 | 3>(1);
  const [titles, setTitles] = useState<TopicContent>({ [AcademyLanguage.PT]: '', [AcademyLanguage.EN]: '', [AcademyLanguage.ES]: '' });
  const [contents, setContents] = useState<TopicContent>({ [AcademyLanguage.PT]: '', [AcademyLanguage.EN]: '', [AcademyLanguage.ES]: '' });
  
  const [activeTab, setActiveTab] = useState<AcademyLanguage>(AcademyLanguage.PT);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [viewMode, setViewMode] = useState<'visual' | 'code'>('visual');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [outdatedTranslation, setOutdatedTranslation] = useState<{[key in AcademyLanguage]?: boolean}>({});

  const [showPromptModal, setShowPromptModal] = useState(false);
  const [customSystemPrompt, setCustomSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [customUserPrompt, setCustomUserPrompt] = useState(DEFAULT_USER_PROMPT);

  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && initialTopic) {
        setTitles(initialTopic.displayTitle);
        setContents(initialTopic.content);
        setParentId(initialTopic.parentId || 'root');
        setTier(initialTopic.tier !== undefined ? initialTopic.tier : 1);
    } else if (isOpen && !initialTopic) {
        setTitles({ [AcademyLanguage.PT]: '', [AcademyLanguage.EN]: '', [AcademyLanguage.ES]: '' });
        setContents({ [AcademyLanguage.PT]: '', [AcademyLanguage.EN]: '', [AcademyLanguage.ES]: '' });
        setParentId('root');
        setTier(1);
    }
    setOutdatedTranslation({});
    setIsSubmitting(false);
  }, [isOpen, initialTopic]);
  
  const getAllTopicsWithPath = (nodes: Topic[], pathPrefix = ""): { id: string, label: string }[] => {
    let result: { id: string, label: string }[] = [];
    nodes.forEach(node => {
      if (isEditMode && initialTopic && node.id === initialTopic.id) return;

      const currentTitle = node.displayTitle[AcademyLanguage.PT] || node.displayTitle[AcademyLanguage.EN] || node.title;
      const fullPath = pathPrefix ? `${pathPrefix} > ${currentTitle}` : currentTitle;
      
      result.push({ id: node.id, label: fullPath });
      
      if (node.children && node.children.length > 0) {
        result = [...result, ...getAllTopicsWithPath(node.children, fullPath)];
      }
    });
    return result;
  };

  const availableParents = getAllTopicsWithPath(topics);
  
  useEffect(() => {
    if (editorRef.current && viewMode === 'visual') {
      editorRef.current.innerHTML = contents[activeTab] || '';
    }
  }, [activeTab, viewMode, isOpen]);

  const updateContentState = (newContent: string) => {
    setContents(prev => ({ ...prev, [activeTab]: newContent }));
    if (activeTab === AcademyLanguage.PT) {
        setOutdatedTranslation({ [AcademyLanguage.EN]: true, [AcademyLanguage.ES]: true });
    }
  };

  const forceTranslation = async (targetLang: AcademyLanguage) => {
      if (!contents[AcademyLanguage.PT]) return;
      setIsTranslating(true);
      try {
        const translatedContent = await translateContent(contents[AcademyLanguage.PT]!, targetLang);
        let translatedTitle = titles[targetLang];
        if (titles[AcademyLanguage.PT]) {
            const rawTitleTrans = await translateContent(titles[AcademyLanguage.PT]!, targetLang);
            translatedTitle = rawTitleTrans.replace(/<[^>]*>?/gm, '').trim();
        }
        setContents(prev => ({ ...prev, [targetLang]: translatedContent }));
        if (translatedTitle) setTitles(prev => ({ ...prev, [targetLang]: translatedTitle }));
        if (activeTab === targetLang && editorRef.current && viewMode === 'visual') {
            editorRef.current.innerHTML = translatedContent;
        }
        setOutdatedTranslation(prev => ({...prev, [targetLang]: false}));
      } catch (e) { console.error("Translation failed", e); } 
      finally { setIsTranslating(false); }
  };

  const handleTabChange = async (newLang: AcademyLanguage) => {
    if (editorRef.current && viewMode === 'visual') {
      updateContentState(editorRef.current.innerHTML);
    }
    setActiveTab(newLang);
    if (!contents[newLang] && contents[AcademyLanguage.PT] && !isTranslating) {
       await forceTranslation(newLang);
    }
  };

  const handleGenerateAI = async () => {
    if (!customUserPrompt) return;
    setShowPromptModal(false);
    setIsGenerating(true);
    try {
      const generated = await generateCourseContent(customUserPrompt, customSystemPrompt);
      setContents(prev => ({ ...prev, [AcademyLanguage.PT]: generated }));
      if (viewMode === 'visual' && editorRef.current) editorRef.current.innerHTML = generated;
      if (!titles[AcademyLanguage.PT]) setTitles(prev => ({ ...prev, [AcademyLanguage.PT]: "Novo Tópico (IA)" }));
      setOutdatedTranslation({ [AcademyLanguage.EN]: true, [AcademyLanguage.ES]: true });
    } catch (e) { alert("Falha ao gerar conteúdo. Verifique a API Key."); } 
    finally { setIsGenerating(false); }
  };

  const execCmd = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) updateContentState(editorRef.current.innerHTML);
    if (editorRef.current) editorRef.current.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    let finalContentMap = { ...contents };
    if (viewMode === 'visual' && editorRef.current) {
        finalContentMap[activeTab] = editorRef.current.innerHTML;
    }
    if (!titles[AcademyLanguage.PT]) {
      alert("O título em Português é obrigatório.");
      setIsSubmitting(false);
      return;
    }
    onAdd({
      parentId: parentId === 'root' ? null : parentId,
      title: titles[AcademyLanguage.PT]!,
      displayTitles: titles,
      contents: finalContentMap,
      tier: tier
    }, isEditMode, initialTopic?.id);
    setIsSubmitting(false);
    onClose();
  };

  const ToolbarButton = ({ icon: Icon, cmd, arg, title }: any) => (
    <button
      type="button"
      onClick={() => execCmd(cmd, arg)}
      className="p-1.5 hover:bg-gray-200 dark:hover:bg-tech-700 rounded text-gray-600 dark:text-gray-300 transition-colors"
      title={title}
    >
      <Icon size={16} />
    </button>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-tech-900 rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col animate-in fade-in zoom-in duration-200">
        
        {/* HEADER - Fixed Dark Colors */}
        <div className="flex justify-between items-center p-5 bg-gray-50 dark:bg-[#1a1c1e] rounded-t-xl transition-colors shrink-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {isEditMode ? <Edit2 className="text-[#dd9933]"/> : <PlusCircle className="text-[#dd9933]" />}
            {isEditMode ? 'Editar Tópico' : 'Novo Tópico'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500 transition-colors"><X size={24} /></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar bg-white dark:bg-tech-900 transition-colors">
            <form id="add-topic-form" onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* PARENT SELECTION - No Borders */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Hierarquia (Pai)</label>
                <div className="relative">
                    <select 
                        value={parentId} 
                        onChange={(e) => setParentId(e.target.value)}
                        className="w-full bg-gray-100 dark:bg-[#2f3032] text-gray-900 dark:text-white rounded-lg p-2.5 outline-none shadow-sm appearance-none cursor-pointer text-sm font-medium border-none"
                        disabled={isEditMode}
                    >
                        <option value="root">📂 Raiz (Tópico Principal)</option>
                        {availableParents.map(t => (
                        <option key={t.id} value={t.id}>
                            ↳ {t.label}
                        </option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-3 pointer-events-none text-gray-500"><Layers size={14}/></div>
                </div>
              </div>

              {/* TIER SELECTION - No Borders */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Categorização (Nível)</label>
                <div className="relative">
                    <select
                        value={tier}
                        onChange={(e) => setTier(parseInt(e.target.value) as any)}
                        className="w-full bg-gray-100 dark:bg-[#2f3032] text-gray-900 dark:text-white rounded-lg p-2.5 outline-none shadow-sm appearance-none cursor-pointer text-sm font-medium border-none"
                    >
                        {TIER_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    {/* Visual Color Indicator inside select area */}
                    <div 
                        className="absolute right-8 top-3 w-3 h-3 rounded-full pointer-events-none"
                        style={{ backgroundColor: TIER_OPTIONS.find(t => t.value === tier)?.color }}
                    ></div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex space-x-1 border-b border-gray-100 dark:border-[#2f3032] relative mt-2">
                {LANGUAGES.map((lang) => (
                  <div key={lang.code} className="relative group">
                    <button
                        type="button"
                        onClick={() => handleTabChange(lang.code)}
                        className={`py-2 px-5 text-sm font-bold rounded-t-lg transition-all flex items-center gap-2 ${
                        activeTab === lang.code
                            ? 'bg-gray-100 dark:bg-[#2f3032] text-[#dd9933] relative top-px z-10 shadow-sm'
                            : 'text-gray-500 bg-white dark:bg-tech-900 hover:bg-gray-50 dark:hover:bg-[#1a1c1e]'
                        }`}
                    >
                        {lang.code === 'PT' ? '🇧🇷' : lang.code === 'EN' ? '🇺🇸' : '🇪🇸'} {lang.label}
                        {outdatedTranslation[lang.code] && lang.code !== AcademyLanguage.PT && (
                            <span title="Tradução desatualizada">
                                <AlertCircle size={14} className="text-yellow-500 ml-1" />
                            </span>
                        )}
                    </button>
                    {activeTab === lang.code && lang.code !== AcademyLanguage.PT && (
                         <button type="button" onClick={(e) => { e.stopPropagation(); forceTranslation(lang.code); }} className="absolute right-1 top-1.5 p-1 hover:bg-gray-200 dark:hover:bg-tech-800 rounded-full text-gray-400 hover:text-[#dd9933] z-20" title="Refazer tradução">
                            <RefreshCcw size={12} className={isTranslating ? 'animate-spin' : ''} />
                         </button>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="p-5 bg-gray-50/50 dark:bg-[#2f3032]/30 rounded-b-lg rounded-tr-lg mt-0">
                <div className="mb-4">
                  <label className="block text-xs uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1">Título ({activeTab})</label>
                  <input
                    type="text"
                    value={titles[activeTab] || ''}
                    onChange={(e) => setTitles(prev => ({ ...prev, [activeTab]: e.target.value }))}
                    className="w-full bg-white dark:bg-[#1a1c1e] rounded-lg p-3 outline-none text-gray-900 dark:text-white font-medium shadow-sm transition-colors border-none"
                    required={activeTab === AcademyLanguage.PT}
                  />
                </div>
                
                {/* WYSIWYG TOOLBAR */}
                <div className="flex flex-wrap items-center gap-1 mb-2 bg-gray-100 dark:bg-[#1a1c1e] p-2 rounded-lg shadow-sm sticky top-0 z-30">
                   {activeTab === AcademyLanguage.PT && (
                    <button type="button" onClick={() => setShowPromptModal(true)} disabled={isGenerating} className="flex items-center gap-2 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-1.5 rounded hover:opacity-90 transition-all shadow-md disabled:opacity-50 mr-2">
                      {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} IA
                    </button>
                   )}
                   <div className="w-px h-6 bg-gray-300 dark:bg-tech-700 mx-1"></div>
                   
                   <ToolbarButton icon={Bold} cmd="bold" title="Negrito" />
                   <ToolbarButton icon={Italic} cmd="italic" title="Itálico" />
                   <ToolbarButton icon={Underline} cmd="underline" title="Sublinhado" />
                   
                   <div className="w-px h-6 bg-gray-300 dark:bg-tech-700 mx-1"></div>
                   
                   <ToolbarButton icon={Heading1} cmd="formatBlock" arg="H2" title="Título H2" />
                   <ToolbarButton icon={Heading2} cmd="formatBlock" arg="H3" title="Título H3" />
                   
                   <div className="w-px h-6 bg-gray-300 dark:bg-tech-700 mx-1"></div>
                   
                   <ToolbarButton icon={AlignLeft} cmd="justifyLeft" title="Esquerda" />
                   <ToolbarButton icon={AlignCenter} cmd="justifyCenter" title="Centro" />
                   
                   <div className="w-px h-6 bg-gray-300 dark:bg-tech-700 mx-1"></div>
                   
                   <ToolbarButton icon={List} cmd="insertUnorderedList" title="Lista" />
                   <button type="button" onClick={() => { const url = prompt('URL do Link:'); if(url) execCmd('createLink', url); }} className="p-1.5 hover:bg-gray-200 dark:hover:bg-tech-700 rounded text-gray-600 dark:text-gray-300 transition-colors"><LinkIcon size={16}/></button>
                   
                   <div className="ml-auto flex items-center gap-2">
                       <button onClick={() => setViewMode(viewMode === 'visual' ? 'code' : 'visual')} className="text-[10px] font-bold uppercase text-gray-500 hover:text-[#dd9933] flex items-center gap-1">
                           {viewMode === 'visual' ? <Code size={12}/> : <Eye size={12}/>} {viewMode === 'visual' ? 'HTML' : 'Visual'}
                       </button>
                   </div>
                </div>

                <div className="relative group">
                  {viewMode === 'visual' ? (
                    <div 
                        ref={editorRef} 
                        contentEditable 
                        onInput={(e) => updateContentState(e.currentTarget.innerHTML)} 
                        className="w-full h-96 bg-white dark:bg-[#1a1c1e] rounded-lg p-6 overflow-y-auto outline-none text-gray-900 dark:text-gray-200 shadow-inner prose prose-sm dark:prose-invert max-w-none transition-colors border-none" 
                        style={{ minHeight: '24rem' }} 
                    />
                  ) : (
                    <textarea 
                        value={contents[activeTab] || ''} 
                        onChange={(e) => updateContentState(e.target.value)} 
                        className="w-full h-96 bg-[#1a1c1e] rounded-lg p-4 font-mono text-sm outline-none text-green-400 shadow-inner resize-none transition-colors border-none" 
                    />
                  )}
                </div>
              </div>
            </div>
            </form>
        </div>
        
        {/* FOOTER - Fixed Dark Colors */}
        <div className="p-5 bg-gray-50 dark:bg-[#1a1c1e] rounded-b-xl flex justify-end gap-3 transition-colors shrink-0">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="px-5 py-2.5 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-200 dark:hover:bg-tech-800 rounded-lg transition-colors disabled:opacity-50">Cancelar</button>
          <button type="submit" form="add-topic-form" disabled={isSubmitting} className="px-6 py-2.5 bg-[#dd9933] text-tech-950 font-bold rounded-lg hover:bg-tech-400 shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 transform active:scale-95 disabled:opacity-50 disabled:cursor-wait">
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            {isEditMode ? 'Atualizar Tópico' : 'Criar Tópico'}
          </button>
        </div>
      </div>
      {showPromptModal && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-tech-900 rounded-xl shadow-2xl w-full max-w-2xl border-none flex flex-col max-h-[90vh]">
             <div className="p-6 flex flex-col h-full overflow-y-auto">
               <div className="flex items-center gap-3 mb-5">
                 <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-600 dark:text-purple-400"><Code size={28} /></div>
                 <div>
                   <h3 className="font-bold text-xl text-gray-900 dark:text-white">Comando para Analista IA</h3>
                   <p className="text-sm text-gray-500 dark:text-gray-400">Configure a persona e o pedido.</p>
                 </div>
               </div>
               <div className="mb-4">
                  <label className="block text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide">Instruções do Sistema (Persona)</label>
                  <textarea value={customSystemPrompt} onChange={(e) => setCustomSystemPrompt(e.target.value)} className="w-full h-36 bg-gray-50 dark:bg-[#1a1c1e] rounded-lg p-3 text-sm text-gray-800 dark:text-gray-300 outline-none resize-none border-none" />
               </div>
               <div className="mb-6 flex-1">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Seu Pedido</label>
                  <textarea value={customUserPrompt} onChange={(e) => setCustomUserPrompt(e.target.value)} className="w-full h-32 bg-gray-50 dark:bg-[#1a1c1e] rounded-lg p-4 outline-none text-gray-900 dark:text-white resize-none text-base shadow-inner font-medium border-none" autoFocus />
               </div>
               <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-tech-700">
                 <button onClick={() => setShowPromptModal(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-tech-800 rounded-lg font-medium">Voltar</button>
                 <button onClick={handleGenerateAI} disabled={!customUserPrompt.trim()} className="px-6 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-purple-500/30">
                   <Sparkles size={16} /> Gerar Conteúdo
                 </button>
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddTopicModal;
