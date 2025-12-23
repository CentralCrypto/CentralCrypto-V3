
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Topic, AcademyLanguage, TopicDraft, Language } from '../types';
import { UserData } from '../services/auth';
import { API_URL, API_PASSWORD, LANGUAGES } from './Academy/constants';
import Sidebar from './Academy/components/Sidebar';
import AddTopicModal from './Academy/components/AddTopicModal';
import { BookOpen, AlertTriangle, Gem, Loader2, CheckCircle } from 'lucide-react';

const FLAG_URLS: Record<AcademyLanguage, string> = {
  [AcademyLanguage.PT]: 'https://hatscripts.github.io/circle-flags/flags/br.svg',
  [AcademyLanguage.EN]: 'https://hatscripts.github.io/circle-flags/flags/gb.svg',
  [AcademyLanguage.ES]: 'https://hatscripts.github.io/circle-flags/flags/es.svg'
};

const LOGO_URL = "https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png";

interface AcademyProps {
  user: UserData | null;
  language: Language; // Receive global language ('pt', 'en', 'es')
}

const Academy: React.FC<AcademyProps> = ({ user, language }) => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const [apiStatus, setApiStatus] = useState<'connected' | 'offline' | 'loading'>('loading');
  const [isSaving, setIsSaving] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  
  // Convert global Language type ('pt') to AcademyLanguage enum (PT)
  const currentAcademyLang = useMemo(() => {
      switch(language) {
          case 'en': return AcademyLanguage.EN;
          case 'es': return AcademyLanguage.ES;
          default: return AcademyLanguage.PT;
      }
  }, [language]);
  
  const isAdmin = useMemo(() => user?.roles.includes('administrator') ?? false, [user]);
  const userTier = 3; // Placeholder for subscription level
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null); 
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isAuthenticated = !!user;

  // Show Toast Helper
  const showToast = (msg: string) => {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchTopics = useCallback(async () => {
    setIsLoadingTopics(true);
    setApiStatus('loading');
    setLastError(null);
    try {
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error(`Erro na API: ${response.statusText}`);
      }
      const data = await response.json();
      setTopics(Array.isArray(data) ? data : []);
      setApiStatus('connected');
    } catch (error: any) {
      console.error("Failed to fetch topics:", error);
      setApiStatus('offline');
      setLastError(error.message || "Não foi possível conectar ao banco de dados.");
    } finally {
      setIsLoadingTopics(false);
    }
  }, []);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  const visibleTopics = useMemo(() => {
    if (isAdmin) return topics;

    const filterNodes = (nodes: Topic[]): Topic[] => {
      return nodes
        .filter(node => (node.tier !== undefined ? node.tier : 1) <= userTier)
        .map(node => ({
          ...node,
          children: filterNodes(node.children)
        }));
    };
    return filterNodes(topics);
  }, [topics, isAdmin, userTier]);

  useEffect(() => {
     if (!selectedTopic && visibleTopics.length > 0 && !isLoadingTopics) {
        if (!isAuthenticated) return;
        if (visibleTopics[0].children && visibleTopics[0].children.length > 0) {
            setSelectedTopic(visibleTopics[0].children[0]);
        } else {
            setSelectedTopic(visibleTopics[0]);
        }
     }
  }, [visibleTopics, isLoadingTopics, selectedTopic, isAuthenticated]);

  // AUTO SAVE FUNCTION
  const saveDataToDb = async (newTopics: Topic[]) => {
    if (!isAdmin) return;
    setIsSaving(true);
    setLastError(null);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: API_PASSWORD,
          topics: newTopics,
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao salvar os dados.');
      }
      await response.json();
      setApiStatus('connected');
      showToast("Dados salvos no banco de dados!");
    } catch (error: any) {
      console.error("Failed to save topics:", error);
      setApiStatus('offline');
      setLastError(error.message || "Erro ao salvar. Verifique a conexão.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTopicSelect = useCallback((topic: Topic) => {
    setSelectedTopic(topic);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, []);

  const generateDefaultCover = (title: string): string => {
     return `
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 4rem 2rem;">
            <img src="${LOGO_URL}" alt="Central Academy" style="max-width: 200px; margin-bottom: 2.5rem; display: block;" />
            <p style="font-size: 1.2rem; text-transform: uppercase; letter-spacing: 0.2em; color: #9ca3af; margin-bottom: 1rem; font-weight: 600;">Central Academy</p>
            <h1 style="font-size: 3.5rem; font-weight: 800; color: #dd9933; line-height: 1.1; margin: 0;">${title}</h1>
        </div>
     `;
  };

  const handleAddOrUpdateTopic = useCallback((draft: TopicDraft, isEditMode?: boolean, editId?: string) => {
    const processedContents = { ...draft.contents };
    const hasContent = (Object.values(processedContents) as string[]).some(c => c && c.trim().length > 0 && c !== '<p><br></p>');
    
    if (!hasContent) {
        processedContents[AcademyLanguage.PT] = generateDefaultCover(draft.title);
    }

    let updatedTopics: Topic[] = [];

    if (isEditMode && editId) {
        const updateNode = (nodes: Topic[]): Topic[] => {
            return nodes.map(node => {
                if (node.id === editId) {
                    return { ...node, title: draft.title, displayTitle: draft.displayTitles, content: processedContents, tier: draft.tier };
                }
                if (node.children.length > 0) {
                    return { ...node, children: updateNode(node.children) };
                }
                return node;
            });
        };
        updatedTopics = updateNode(topics);

        if (selectedTopic && selectedTopic.id === editId) {
            setSelectedTopic(prev => ({ ...prev!, title: draft.title, displayTitle: draft.displayTitles, content: processedContents, tier: draft.tier }));
        }
    } else {
        const newTopic: Topic = { id: Date.now().toString(), title: draft.title, displayTitle: draft.displayTitles, content: processedContents, parentId: draft.parentId, children: [], tier: draft.tier };

        const addNode = (nodes: Topic[], parentId: string): Topic[] => {
            return nodes.map(node => {
                if (node.id === parentId) { return { ...node, children: [...node.children, newTopic] }; }
                if (node.children.length > 0) { return { ...node, children: addNode(node.children, parentId) }; }
                return node;
            });
        };

        if (draft.parentId === null || draft.parentId === 'root') {
            updatedTopics = [...topics, newTopic];
        } else {
            updatedTopics = addNode(topics, draft.parentId!);
        }
    }
    
    setTopics(updatedTopics);
    saveDataToDb(updatedTopics); // Auto-save
    setEditingTopic(null); 
  }, [selectedTopic, topics]);

  const handleEditTopic = useCallback((topic: Topic) => {
      setEditingTopic(topic);
      setIsModalOpen(true);
  }, []);

  const handleDeleteTopic = useCallback((topicId: string) => {
      const deleteNode = (nodes: Topic[]): Topic[] => {
          return nodes.filter(node => node.id !== topicId).map(node => ({ ...node, children: deleteNode(node.children) }));
      };
      const updatedTopics = deleteNode(topics);
      setTopics(updatedTopics);
      saveDataToDb(updatedTopics); // Auto-save
      if (selectedTopic && selectedTopic.id === topicId) setSelectedTopic(null);
  }, [selectedTopic, topics]);

  const handleMoveTopic = useCallback((draggedId: string, targetId: string) => {
      if (draggedId === targetId) return;

      // 1. Deep clone current state to avoid mutation issues
      const topicsClone = JSON.parse(JSON.stringify(topics)) as Topic[];
      
      let draggedItem: Topic | null = null;

      // 2. Remove dragged item from tree and capture it
      const removeNode = (nodes: Topic[]): Topic[] => {
          const result: Topic[] = [];
          for (const node of nodes) {
              if (node.id === draggedId) {
                  draggedItem = node;
                  continue; 
              }
              if (node.children && node.children.length > 0) {
                  node.children = removeNode(node.children);
              }
              result.push(node);
          }
          return result;
      };

      const treeWithoutDragged = removeNode(topicsClone);

      if (!draggedItem) {
          console.warn("Could not find dragged item ID:", draggedId);
          return;
      }

      // 3. Prompt for action
      const moveType = window.prompt(
          `Mover "${(draggedItem as Topic).title}":\n\n1: Tornar FILHO de "${targetId === 'root' ? 'Raiz' : 'Item Alvo'}"\n2: Tornar IRMÃO (abaixo) de "${targetId === 'root' ? 'Raiz' : 'Item Alvo'}"`, 
          "1"
      );

      if (!moveType) return;

      let newTree: Topic[] = [];

      // 4. Insert Logic
      if (moveType === '1') {
          // AS CHILD
          if (targetId === 'root') {
             // Moving to root level
             (draggedItem as Topic).parentId = null;
             newTree = [...treeWithoutDragged, draggedItem as Topic];
          } else {
             const insertAsChild = (nodes: Topic[]): Topic[] => {
                return nodes.map(node => {
                    if (node.id === targetId) {
                        const updatedChildren = node.children ? [...node.children] : [];
                        (draggedItem as Topic).parentId = node.id;
                        updatedChildren.push(draggedItem as Topic);
                        return { ...node, children: updatedChildren };
                    }
                    if (node.children && node.children.length > 0) {
                        return { ...node, children: insertAsChild(node.children) };
                    }
                    return node;
                });
             };
             newTree = insertAsChild(treeWithoutDragged);
          }

      } else if (moveType === '2') {
          // AS SIBLING
          if (targetId === 'root') {
              // Cannot be sibling of root (conceptually same as being child of root, append to end)
              (draggedItem as Topic).parentId = null;
              newTree = [...treeWithoutDragged, draggedItem as Topic];
          } else {
              const insertAsSibling = (nodes: Topic[]): Topic[] => {
                  const result: Topic[] = [];
                  for (const node of nodes) {
                      result.push(node);
                      if (node.id === targetId) {
                          (draggedItem as Topic).parentId = node.parentId;
                          result.push(draggedItem as Topic);
                      }
                      if (node.children && node.children.length > 0) {
                          // Recurse down, but update the current node with new children
                          const newChildren = insertAsSibling(node.children);
                          // We need to mutate the node we just pushed
                          result[result.length - 1] = { ...node, children: newChildren };
                      }
                  }
                  return result;
              };
              newTree = insertAsSibling(treeWithoutDragged);
          }
      } else {
          return;
      }

      setTopics(newTree);
      saveDataToDb(newTree); // Auto-save

  }, [topics]);

  const currentContent = selectedTopic?.content[currentAcademyLang] || (selectedTopic?.content ? Object.values(selectedTopic.content)[0] : '<p>Conteúdo não disponível neste idioma.</p>');
  
  return (
    <div className="flex h-full bg-tech-950 text-gray-200 font-sans transition-colors duration-300">
        
        {toastMessage && (
            <div className="fixed top-24 right-6 z-[100] animate-in slide-in-from-right fade-in bg-green-600 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-2 border border-green-500">
                <CheckCircle size={20} />
                <span className="font-bold">{toastMessage}</span>
            </div>
        )}

        <AddTopicModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingTopic(null); }} onAdd={handleAddOrUpdateTopic} topics={topics} initialTopic={editingTopic} />

        <div className={`absolute inset-y-0 left-0 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out z-40 h-full flex`}>
          <Sidebar 
            topics={visibleTopics} 
            selectedTopicId={selectedTopic?.id || null} 
            currentLanguage={currentAcademyLang} 
            isAdmin={isAdmin} 
            apiStatus={apiStatus} 
            isSaving={isSaving} 
            onSelectTopic={handleTopicSelect} 
            onOpenAddModal={() => { setEditingTopic(null); setIsModalOpen(true); }} 
            onEditTopic={handleEditTopic} 
            onDeleteTopic={handleDeleteTopic} 
            onReload={fetchTopics} 
            onMoveTopic={handleMoveTopic} 
          />
        </div>

        <main className="flex-1 overflow-y-auto py-6 md:py-10 w-full transition-colors duration-300 px-6">
          <div className="w-full min-h-[80vh] flex flex-col gap-4 relative">
            
            {apiStatus === 'offline' && (
                <div className="w-full bg-red-900/20 border border-red-800 rounded-lg p-4 flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-bold text-red-400">Modo Offline - Sincronização Pausada</h4>
                        <p className="text-sm text-red-300 mt-1">{lastError || "O banco de dados não respondeu. Suas alterações estão salvas apenas neste navegador."}</p>
                    </div>
                </div>
            )}

            {isLoadingTopics ? (
                 <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                    <Loader2 size={48} className="mb-4 opacity-50 animate-spin" />
                    <p className="text-lg">Carregando curso do banco de dados...</p>
                 </div>
            ) : (!isAuthenticated && (!selectedTopic || selectedTopic.tier !== 0)) ? (
                <div className="flex flex-col items-center justify-center text-center h-[70vh] animate-in fade-in duration-500">
                    <img src={LOGO_URL} alt="Central Academy" className="max-w-[180px] mb-8 drop-shadow-lg" />
                    <h1 className="text-5xl md:text-6xl font-bold text-[#dd9933] mb-6">Central Academy</h1>
                    <p className="max-w-2xl text-lg md:text-xl text-gray-300 mb-8 leading-relaxed">Domine o mercado financeiro com a plataforma mais completa de análise técnica e fundamentalista.</p>
                    <button onClick={() => alert("Link para página de vendas/checkout")} className="bg-[#dd9933] hover:bg-tech-400 text-tech-950 font-bold text-lg px-8 py-4 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center gap-2"><Gem size={24} /> ASSINE JÁ</button>
                </div>
            ) : (
                <div className="bg-tech-900 rounded-2xl shadow-sm border border-tech-800 p-8 md:p-12 transition-colors duration-300 relative flex-1">
                  {selectedTopic ? (
                  <article>
                      {!currentContent?.includes('Central Academy') && (
                      <div className="mb-8 border-b border-tech-800 pb-6">
                          <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                            <span className="w-5 h-5 rounded-full overflow-hidden inline-block align-middle border border-tech-700"><img src={FLAG_URLS[currentAcademyLang]} className="w-full h-full object-cover" /></span>
                            <span className="font-medium tracking-wide uppercase text-xs">{LANGUAGES.find(l => l.code === currentAcademyLang)?.label}</span>
                          </div>
                          <h1 className="text-3xl md:text-5xl font-bold text-gray-200 dark:text-gray-200">{selectedTopic.displayTitle?.[currentAcademyLang] || selectedTopic.title}</h1>
                      </div>
                      )}
                      <div id="wp-content" dangerouslySetInnerHTML={{ __html: currentContent || '' }} />
                  </article>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 mt-20">
                        <BookOpen size={64} className="mb-4 opacity-20" />
                        <p className="text-lg">Selecione um tópico para começar.</p>
                    </div>
                  )}
                </div>
            )}
          </div>
        </main>
    </div>
  );
};

export default Academy;
