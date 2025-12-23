import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Navbar } from './Indicators/components/Navbar';
import { Hero } from './Indicators/components/Hero';
import { Indicators } from './Indicators/components/Indicators';
import { IndicatorDetails } from './Indicators/components/IndicatorDetails';
import { Testimonials } from './Indicators/components/Testimonials';
import { Features } from './Indicators/components/Features';
import { AdminPanel } from './Indicators/components/AdminPanel';
import { getConstants, WP_API_URL, WP_REORDER_URL, API_SECRET } from './Indicators/constants';
import { getTranslations } from '../locales';
import { ChevronDown, X, Loader2, RefreshCw, Database, AlertTriangle, WifiOff } from 'lucide-react';
import { Language, Indicator } from '../types';
import { UserData } from '../services/auth';

interface IndicatorsPageProps {
    user: UserData | null;
    language: Language;
}

function App({ user, language }: IndicatorsPageProps) {
  const currentLang = language;
  
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string | null>(null);
  const [hoveredFaq, setHoveredFaq] = useState<number | null>(null);
  
  const [activeLegalModal, setActiveLegalModal] = useState<'terms' | 'privacy' | 'disclaimer' | null>(null);

  const isAdmin = useMemo(() => {
      return user?.roles.includes('administrator') || false;
  }, [user]);

  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<Indicator | undefined>(undefined);
  
  const [allIndicators, setAllIndicators] = useState<Indicator[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  const appRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchIndicators(controller.signal);
    return () => controller.abort();
  }, [isAdmin]);

  const fetchIndicators = async (signal?: AbortSignal) => {
      setApiError(null);
      if (allIndicators.length === 0) setIsDataLoaded(false);

      try {
          const response = await fetch(WP_API_URL, { signal });

          if (!response.ok) {
              if (response.status === 404) throw new Error(`Erro 404: Endpoint não encontrado`);
              if (response.status === 403 || response.status === 401) throw new Error(`Erro ${response.status}: Acesso negado`);
              throw new Error(`Erro HTTP: ${response.status}`);
          }
          
          const data = await response.json();
          
          if (Array.isArray(data)) {
              if (data.length > 0) {
                  setAllIndicators(data);
                  setApiError(null);
                  setUsingFallback(false);
              } else {
                  setAllIndicators([]);
                  if (isAdmin) setApiError('Banco conectado, mas tabela vazia.');
                  else {
                       const { indicators: defaultIndicators } = getConstants(currentLang);
                       setAllIndicators(defaultIndicators);
                       setUsingFallback(true);
                       setApiError('Tabela vazia no DB.');
                  }
              }
          } else {
              throw new Error("Formato inválido recebido do servidor");
          }

      } catch (error: any) {
          if (error.name === 'AbortError') return;
          console.error("ERRO DE CONEXÃO DETALHADO:", error);
          const { indicators: defaultIndicators } = getConstants(currentLang);
          setAllIndicators(defaultIndicators);
          setUsingFallback(true);
          let msg = error.message;
          if (msg.includes('Failed to fetch')) msg = 'Falha de Conexão: Verifique CORS ou Internet.';
          setApiError(msg);
      } finally {
          setIsDataLoaded(true);
      }
  };

  const t = getTranslations(currentLang).indicators;
  const tFooter = getTranslations(currentLang).footer;
  const legalTexts = getTranslations(currentLang).indicators.legal;

  const handleSelectIndicator = (id: string) => {
    setSelectedIndicatorId(id);
    window.scrollTo(0, 0);
  };

  const handleNavigateHome = () => {
    setSelectedIndicatorId(null);
    setShowAdminPanel(false);
    setEditingIndicator(undefined);
  };

  const handleSaveIndicator = async (indicator: Indicator) => {
    try {
        const response = await fetch(WP_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Secret': API_SECRET
            },
            body: JSON.stringify(indicator)
        });

        if (!response.ok) throw new Error('Erro ao salvar no Servidor');
        
        const existingIndex = allIndicators.findIndex(i => i.id === indicator.id);
        let updatedList;
        if (existingIndex >= 0) {
            updatedList = [...allIndicators];
            updatedList[existingIndex] = indicator;
        } else {
            updatedList = [indicator, ...allIndicators];
        }
        setAllIndicators(updatedList);
        fetchIndicators(); 
        
        return Promise.resolve();

    } catch (error) {
        console.error(error);
        return Promise.reject(error);
    }
  };

  const handleReorderLocal = (newOrder: Indicator[]) => {
     setAllIndicators(newOrder);
  };

  const handlePersistOrder = async () => {
     const orderedIds = allIndicators.map(item => item.id);
     try {
         const response = await fetch(WP_REORDER_URL, {
             method: 'POST',
             headers: {
                 'Content-Type': 'application/json',
                 'X-Api-Secret': API_SECRET
             },
             body: JSON.stringify({ ids: orderedIds })
         });
         if (!response.ok) throw new Error("Falha ao salvar ordem");
     } catch (error) {
         console.error("Erro ao reordenar:", error);
         alert("Erro ao salvar ordem no servidor.");
     }
  };

  const handleDeleteIndicator = async (id: string) => {
      const updatedList = allIndicators.filter(i => i.id !== id);
      setAllIndicators(updatedList);
      setSelectedIndicatorId(null); 
      
      try {
        const response = await fetch(`${WP_API_URL}/${id}`, {
            method: 'DELETE',
            headers: { 'X-Api-Secret': API_SECRET }
        });
        if (!response.ok) throw new Error('Erro ao deletar');
        alert("Removido com sucesso.");
      } catch (error) {
          console.error(error);
          alert("Erro ao deletar do servidor. Removido apenas localmente.");
      }
  };

  const handleEditTrigger = (indicator: Indicator) => {
      setEditingIndicator(indicator);
      setShowAdminPanel(true);
  };

  const selectedIndicator = selectedIndicatorId 
    ? allIndicators.find(i => i.id === selectedIndicatorId) 
    : null;

  const faqs = [
      { question: t.faq.q1, answer: t.faq.a1 },
      { question: t.faq.q2, answer: t.faq.a2 },
      { question: t.faq.q3, answer: t.faq.a3 }
  ];

  return (
    <div ref={appRef} className="theme-transition min-h-screen bg-gray-50 dark:bg-tech-950 text-gray-900 dark:text-gray-200 font-sans selection:bg-tech-accent selection:text-white transition-colors duration-700 ease-in-out">
      
      {isAdmin && (
        <div className="fixed bottom-4 left-4 z-40 hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur text-xs font-bold border border-gray-200 dark:border-tech-800 shadow-sm group cursor-help transition-all hover:bg-white dark:hover:bg-black">
            {!isDataLoaded ? (
                <>
                   <span className="relative flex h-2 w-2"><span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span></span>
                  <span className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Conectando...</span>
                </>
            ) : usingFallback ? (
                <>
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>
                  <span className="text-red-500 flex items-center gap-1"><WifiOff className="w-3 h-3" /> Offline</span>
                </>
            ) : (
                <>
                   <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>
                  <span className="text-green-600 dark:text-green-400 flex items-center gap-1"><Database className="w-3 h-3" /> Online</span>
                </>
            )}
            
            {usingFallback && apiError && (
                <div className="absolute left-0 bottom-full mb-2 w-48 bg-red-900 text-white text-[10px] p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {apiError}
                </div>
            )}
        </div>
      )}

      {usingFallback && isDataLoaded && isAdmin && (
          <div className="bg-red-600 text-white text-xs font-bold text-center py-3 px-4 flex flex-col items-center justify-center gap-2 animate-fade-in z-50 relative border-b border-white/20">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="w-5 h-5" />
                <span>CONEXÃO FALHOU (Modo Offline)</span>
              </div>
              <button onClick={() => fetchIndicators()} className="bg-white text-red-600 hover:bg-gray-100 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-colors mt-1 shadow-sm">
                  <RefreshCw className="w-3 h-3" /> Tentar Reconectar
              </button>
          </div>
      )}

      <Navbar 
        onNavigateHome={handleNavigateHome} 
        isDetailsPage={!!selectedIndicatorId} 
        currentLang={currentLang}
        isAdmin={isAdmin}
        onOpenAdmin={() => {
            setEditingIndicator(undefined);
            setShowAdminPanel(true);
        }}
        onOpenLegal={setActiveLegalModal}
      />
      
      <main>
        {showAdminPanel ? (
           <AdminPanel 
             initialData={editingIndicator}
             onSave={handleSaveIndicator} 
             onCancel={() => {
                 setShowAdminPanel(false);
                 setEditingIndicator(undefined);
             }} 
           />
        ) : selectedIndicatorId && selectedIndicator ? (
          <IndicatorDetails 
            indicator={selectedIndicator} 
            onBack={handleNavigateHome}
            currentLang={currentLang}
            isAdmin={isAdmin}
            onDelete={() => handleDeleteIndicator(selectedIndicator.id)}
            onEdit={() => handleEditTrigger(selectedIndicator)}
          />
        ) : (
          <>
            <Hero currentLang={currentLang} />
            
            <Indicators 
                onSelectIndicator={handleSelectIndicator} 
                currentLang={currentLang}
                customList={allIndicators}
                isAdmin={isAdmin}
                onReorder={handleReorderLocal}
                onSaveOrder={handlePersistOrder}
            />
            
            <Features currentLang={currentLang} /> 
            <Testimonials currentLang={currentLang} />
            
            <section id="faq" className="relative py-20 bg-gray-50 dark:bg-tech-900 border-t border-transparent dark:border-tech-800 transition-colors duration-700 ease-in-out overflow-hidden">
               <div 
                  className="absolute inset-0 z-0 pointer-events-none opacity-[0.1]"
                  style={{
                      backgroundImage: 'url(https://centralcrypto.com.br/2/wp-content/uploads/2025/09/2025-09-14_15-43-11.png)',
                      backgroundAttachment: 'fixed',
                      backgroundPosition: 'center',
                      backgroundSize: 'cover',
                      backgroundRepeat: 'no-repeat'
                  }}
               />

               <div className="relative z-10 max-w-4xl mx-auto px-4">
                  <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">{t.faq.title}</h2>
                  <div className="space-y-4">
                     {faqs.map((faq, index) => (
                         <div 
                            key={index}
                            className="bg-white/95 dark:bg-tech-950/95 backdrop-blur-sm rounded-xl overflow-hidden transition-all duration-500 shadow-lg hover:shadow-xl group"
                            onMouseEnter={() => setHoveredFaq(index)}
                            onMouseLeave={() => setHoveredFaq(null)}
                         >
                            <div className="p-6 flex justify-between items-center cursor-pointer">
                                <h3 className={`font-bold text-gray-900 dark:text-white transition-colors ${hoveredFaq === index ? 'text-tech-accent' : ''}`}>
                                    {faq.question}
                                </h3>
                                <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${hoveredFaq === index ? 'rotate-180 text-tech-accent' : ''}`} />
                            </div>
                            
                            <div className={`px-6 overflow-hidden transition-all duration-500 ease-in-out ${hoveredFaq === index ? 'max-h-40 pb-6 opacity-100' : 'max-h-0 opacity-0'}`}>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                    {faq.answer}
                                </p>
                            </div>
                         </div>
                     ))}
                  </div>
               </div>
            </section>
          </>
        )}
      </main>
      
      {activeLegalModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in transition-opacity duration-500">
            <div className="bg-white dark:bg-tech-900 border border-gray-200 dark:border-tech-800 rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors duration-500">
                <div className="p-4 border-b border-gray-200 dark:border-tech-800 flex justify-between items-center bg-gray-100 dark:bg-tech-950/50 transition-colors duration-500">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase flex items-center gap-2">
                        {activeLegalModal === 'disclaimer' && <span className="text-red-500">⚠️</span>}
                        {activeLegalModal === 'terms' && tFooter.terms}
                        {activeLegalModal === 'privacy' && tFooter.privacy}
                        {activeLegalModal === 'disclaimer' && tFooter.risk}
                    </h3>
                    <button onClick={() => setActiveLegalModal(null)} className="p-1 hover:bg-gray-300 dark:hover:bg-tech-800 rounded text-gray-500 dark:text-gray-400 transition-colors duration-300">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-8 overflow-y-auto text-gray-700 dark:text-gray-300 prose dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap transition-colors duration-500">
                    {legalTexts[activeLegalModal]}
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-tech-800 bg-gray-50 dark:bg-tech-950 flex justify-end transition-colors duration-500">
                    <button onClick={() => setActiveLegalModal(null)} className="px-6 py-2 bg-tech-accent text-white rounded-lg font-bold hover:bg-amber-600 transition-colors shadow-lg shadow-amber-900/20">
                        {tFooter.modalAgree}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

export default App;