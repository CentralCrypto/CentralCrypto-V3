
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Topic, AcademyLanguage, TopicDraft, Language } from '../types';
import { UserData } from '../services/auth';
import { API_URL, API_PASSWORD, LANGUAGES } from './Academy/constants';
import Sidebar from './Academy/components/Sidebar';
import AddTopicModal from './Academy/components/AddTopicModal';
import { BookOpen, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';
import { fetchWithFallback } from './Workspace/services/api';

const Academy: React.FC<{ user: UserData | null; language: Language }> = ({ user, language }) => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const [apiStatus, setApiStatus] = useState<'connected' | 'offline' | 'loading'>('loading');
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  
  const currentAcademyLang = useMemo(() => {
      if (language === 'en') return AcademyLanguage.EN;
      if (language === 'es') return AcademyLanguage.ES;
      return AcademyLanguage.PT;
  }, [language]);
  
  const isAdmin = useMemo(() => user?.roles.includes('administrator') ?? false, [user]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null); 
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const fetchTopics = useCallback(async () => {
    setIsLoadingTopics(true);
    setApiStatus('loading');
    try {
      const data = await fetchWithFallback(API_URL);
      if (data && Array.isArray(data)) {
        setTopics(data);
        setApiStatus('connected');
      } else {
        throw new Error();
      }
    } catch (error) {
      setApiStatus('offline');
    } finally {
      setIsLoadingTopics(false);
    }
  }, []);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

  useEffect(() => {
     if (!selectedTopic && topics.length > 0 && !isLoadingTopics) {
        setSelectedTopic(topics[0].children?.[0] || topics[0]);
     }
  }, [topics, isLoadingTopics, selectedTopic]);

  const currentContent = selectedTopic?.content?.[currentAcademyLang] || (selectedTopic?.content ? Object.values(selectedTopic.content)[0] : '');
  
  return (
    <div className="flex h-full bg-tech-950 text-gray-200 font-sans transition-colors duration-300">
        <AddTopicModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingTopic(null); }} onAdd={() => fetchTopics()} topics={topics} initialTopic={editingTopic} />

        <div className={`absolute inset-y-0 left-0 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out z-40 h-full flex`}>
          <Sidebar topics={topics} selectedTopicId={selectedTopic?.id || null} currentLanguage={currentAcademyLang} isAdmin={isAdmin} apiStatus={apiStatus} isSaving={false} onSelectTopic={setSelectedTopic} onOpenAddModal={() => { setEditingTopic(null); setIsModalOpen(true); }} onEditTopic={(t) => { setEditingTopic(t); setIsModalOpen(true); }} onDeleteTopic={() => {}} onReload={fetchTopics} />
        </div>

        <main className="flex-1 overflow-y-auto py-6 md:py-10 w-full px-6">
          <div className="w-full min-h-[80vh] flex flex-col gap-4 relative">
            {isLoadingTopics ? (
                 <div className="flex-1 flex flex-col items-center justify-center text-gray-500"><Loader2 size={48} className="mb-4 opacity-50 animate-spin" /><p>Sincronizando Academy...</p></div>
            ) : (
                <div className="bg-tech-900 rounded-2xl shadow-sm border border-tech-800 p-8 md:p-12 relative flex-1">
                  {selectedTopic ? (
                  <article>
                      <div className="mb-8 border-b border-tech-800 pb-6"><h1 className="text-3xl md:text-5xl font-bold text-gray-200">{selectedTopic.displayTitle?.[currentAcademyLang] || selectedTopic.title}</h1></div>
                      <div id="wp-content" dangerouslySetInnerHTML={{ __html: currentContent || '' }} />
                  </article>
                  ) : <div className="h-full flex flex-col items-center justify-center text-gray-500 mt-20"><BookOpen size={64} className="mb-4 opacity-20" /><p>Selecione um tópico.</p></div>}
                </div>
            )}
          </div>
        </main>
    </div>
  );
};

export default Academy;
