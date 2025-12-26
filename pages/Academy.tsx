
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Topic, AcademyLanguage, Language } from '../types';
import { UserData } from '../services/auth';
import Sidebar from './Academy/components/Sidebar';
import AddTopicModal from './Academy/components/AddTopicModal';
import { BookOpen, Loader2, AlertTriangle } from 'lucide-react';
import { fetchAcademyTopics, saveAcademyTopics } from '../services/academyTopics';

const Academy: React.FC<{ user: UserData | null; language: Language }> = ({ user, language }) => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const [apiStatus, setApiStatus] = useState<'connected' | 'offline' | 'loading'>('loading');
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [error, setError] = useState('');
  
  const currentAcademyLang = useMemo(() => {
      if (language === 'en') return AcademyLanguage.EN;
      if (language === 'es') return AcademyLanguage.ES;
      return AcademyLanguage.PT;
  }, [language]);
  
  const isAdmin = useMemo(() => user?.roles.includes('administrator') ?? false, [user]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null); 
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const loadTopics = useCallback(async () => {
    setIsLoadingTopics(true);
    setApiStatus('loading');
    setError('');
    try {
      const data = await fetchAcademyTopics();
      const rawList = Array.isArray(data) ? data : [];
      
      const normalized = rawList.map(t => ({
          ...t,
          displayTitle: t.displayTitle || { [AcademyLanguage.PT]: t.title || "Tópico" },
          content: t.content || { 
             [AcademyLanguage.PT]: t.content_pt || "",
             [AcademyLanguage.EN]: t.content_en || "",
             [AcademyLanguage.ES]: t.content_es || ""
          }
      }));
      
      setTopics(normalized as unknown as Topic[]);
      setApiStatus('connected');
    } catch (apiError: any) {
      console.error("Academy Load Error:", apiError);
      setApiStatus('offline');
      setError(apiError.message || 'Falha ao carregar currículo.');
    } finally {
      setIsLoadingTopics(false);
    }
  }, []);

  useEffect(() => { loadTopics(); }, [loadTopics]);

  useEffect(() => {
     if (!selectedTopic && topics.length > 0 && !isLoadingTopics) {
        const first = topics[0];
        setSelectedTopic(first.children?.length ? first.children[0] : first);
     }
  }, [topics, isLoadingTopics, selectedTopic]);

  const handleAddTopic = async (draft: any, isEdit: boolean = false, id?: string) => {
      if (!isAdmin) return;
      const password = prompt("Senha de gravação:");
      if (!password) return;
      try {
          await saveAcademyTopics(topics as any, password);
          loadTopics();
      } catch (e) {
          alert("Erro ao salvar.");
      }
  };

  const currentContent = selectedTopic?.content?.[currentAcademyLang] || 
                         selectedTopic?.content?.[AcademyLanguage.PT] || 
                         (selectedTopic?.content ? Object.values(selectedTopic.content)[0] : '');
  
  return (
    <div className="flex h-full bg-tech-950 text-gray-200 font-sans transition-colors duration-300">
        <AddTopicModal 
          isOpen={isModalOpen} 
          onClose={() => { setIsModalOpen(false); setEditingTopic(null); }} 
          onAdd={handleAddTopic} 
          topics={topics} 
          initialTopic={editingTopic} 
        />

        <div className={`absolute inset-y-0 left-0 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out z-40 h-full flex`}>
          <Sidebar 
            topics={topics} 
            selectedTopicId={selectedTopic?.id || null} 
            currentLanguage={currentAcademyLang} 
            isAdmin={isAdmin} 
            apiStatus={apiStatus} 
            isSaving={false} 
            onSelectTopic={setSelectedTopic} 
            onOpenAddModal={() => { setEditingTopic(null); setIsModalOpen(true); }} 
            onEditTopic={(t) => { setEditingTopic(t); setIsModalOpen(true); }} 
            onDeleteTopic={() => {}} 
            onReload={loadTopics} 
          />
        </div>

        <main className="flex-1 overflow-y-auto py-6 md:py-10 w-full px-6">
          <div className="w-full min-h-[80vh] flex flex-col gap-4 relative">
            {isLoadingTopics ? (
                 <div className="flex-1 flex flex-col items-center justify-center text-gray-500"><Loader2 size={48} className="mb-4 opacity-50 animate-spin" /><p>Sincronizando Academy...</p></div>
            ) : error ? (
                <div className="flex-1 flex flex-col items-center justify-center text-red-500 p-8 text-center bg-tech-900 rounded-2xl border border-red-500/20">
                    <AlertTriangle size={48} className="mb-4 opacity-50" />
                    <h3 className="text-xl font-bold mb-2">Erro de Conexão</h3>
                    <p className="text-sm opacity-70 mb-6">{error}</p>
                    <button onClick={loadTopics} className="px-6 py-2 bg-tech-800 rounded-lg hover:bg-tech-700 text-white font-bold transition-all border border-tech-700">Tentar Novamente</button>
                </div>
            ) : (
                <div className="bg-tech-900 rounded-2xl shadow-sm border border-tech-800 p-8 md:p-12 relative flex-1">
                  {selectedTopic ? (
                  <article>
                      <div className="mb-8 border-b border-tech-800 pb-6"><h1 className="text-3xl md:text-5xl font-bold text-gray-200">{selectedTopic.displayTitle?.[currentAcademyLang] || selectedTopic.title}</h1></div>
                      <div id="wp-content" className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: currentContent || '' }} />
                  </article>
                  ) : <div className="h-full flex flex-col items-center justify-center text-gray-500 mt-20"><BookOpen size={64} className="mb-4 opacity-20" /><p>Selecione um tópico na barra lateral.</p></div>}
                </div>
            )}
          </div>
        </main>
    </div>
  );
};

export default Academy;
