
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
import { fetchWithFallback } from './Workspace/services/api';

const DB_CACHE_KEY = 'cct_indicators_db_cache_v4';

interface IndicatorsPageProps {
    user: UserData | null;
    language: Language;
}

function App({ user, language }: IndicatorsPageProps) {
  const currentLang = language;
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string | null>(null);
  const [hoveredFaq, setHoveredFaq] = useState<number | null>(null);
  const [activeLegalModal, setActiveLegalModal] = useState<'terms' | 'privacy' | 'disclaimer' | null>(null);

  const isAdmin = useMemo(() => user?.roles.includes('administrator') || false, [user]);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<Indicator | undefined>(undefined);
  
  // CARREGAMENTO ULTRA-RÁPIDO: Pega do cache imediatamente se existir
  const [allIndicators, setAllIndicators] = useState<Indicator[]>(() => {
    const cached = localStorage.getItem(DB_CACHE_KEY);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch(e) {}
    }
    const { indicators: defaultIndicators } = getConstants(language);
    return defaultIndicators;
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    fetchIndicators();
  }, []);

  const fetchIndicators = async () => {
      setIsSyncing(true);
      try {
          const data = await fetchWithFallback(WP_API_URL);
          if (data && Array.isArray(data) && data.length > 0) {
              const serverDataStr = JSON.stringify(data);
              const localDataStr = JSON.stringify(allIndicators);
              
              // Só atualiza a tela se os dados realmente mudaram no banco
              if (serverDataStr !== localDataStr) {
                  setAllIndicators(data);
                  localStorage.setItem(DB_CACHE_KEY, serverDataStr);
              }
              setUsingFallback(false);
          } else if (allIndicators.length === 0) {
              setUsingFallback(true);
          }
      } catch (error: any) {
          console.warn("WP Sync delay - using cache.");
          setUsingFallback(true);
      } finally {
          setIsSyncing(false);
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
        if (!response.ok) throw new Error('Erro ao salvar no BD');
        fetchIndicators(); 
        return Promise.resolve();
    } catch (error) {
        return Promise.reject(error);
    }
  };

  const handleReorderLocal = (newOrder: Indicator[]) => {
     setAllIndicators(newOrder);
     localStorage.setItem(DB_CACHE_KEY, JSON.stringify(newOrder));
  };

  const handlePersistOrder = async () => {
     const orderedIds = allIndicators.map(item => item.id);
     try {
         await fetch(WP_REORDER_URL, {
             method: 'POST',
             headers: {
                 'Content-Type': 'application/json',
                 'X-Api-Secret': API_SECRET
             },
             body: JSON.stringify({ ids: orderedIds })
         });
     } catch (error) {}
  };

  const handleDeleteIndicator = async (id: string) => {
      const updatedList = allIndicators.filter(i => i.id !== id);
      setAllIndicators(updatedList);
      localStorage.setItem(DB_CACHE_KEY, JSON.stringify(updatedList));
      setSelectedIndicatorId(null); 
      try {
        await fetch(`${WP_API_URL}/${id}`, {
            method: 'DELETE',
            headers: { 'X-Api-Secret': API_SECRET }
        });
      } catch (error) {}
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
    <div className="theme-transition min-h-screen bg-gray-50 dark:bg-tech-950 text-gray-900 dark:text-gray-200 font-sans selection:bg-tech-accent selection:text-white transition-colors duration-700 ease-in-out">
      
      {isAdmin && (
        <div className="fixed bottom-4 left-4 z-40 hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur text-xs font-bold border border-gray-200 dark:border-tech-800 shadow-sm transition-all">
            {isSyncing ? (
                <span className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Sincronizando...</span>
            ) : (
                <span className="text-green-600 dark:text-green-400 flex items-center gap-1"><Database className="w-3 h-3" /> Banco de Dados OK</span>
            )}
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
            <section id="faq" className="relative py-20 bg-gray-50 dark:bg-tech-900 border-t border-transparent dark:border-tech-800 overflow-hidden">
               <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.1]" style={{backgroundImage: 'url(https://centralcrypto.com.br/2/wp-content/uploads/2025/09/2025-09-14_15-43-11.png)', backgroundAttachment: 'fixed', backgroundPosition: 'center', backgroundSize: 'cover', backgroundRepeat: 'no-repeat'}} />
               <div className="relative z-10 max-w-4xl mx-auto px-4">
                  <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">{t.faq.title}</h2>
                  <div className="space-y-4">
                     {faqs.map((faq, index) => (
                         <div key={index} className="bg-white/95 dark:bg-tech-950/95 backdrop-blur-sm rounded-xl overflow-hidden transition-all duration-500 shadow-lg hover:shadow-xl group" onMouseEnter={() => setHoveredFaq(index)} onMouseLeave={() => setHoveredFaq(null)}>
                            <div className="p-6 flex justify-between items-center cursor-pointer">
                                <h3 className={`font-bold text-gray-900 dark:text-white transition-colors ${hoveredFaq === index ? 'text-tech-accent' : ''}`}>{faq.question}</h3>
                                <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${hoveredFaq === index ? 'rotate-180 text-tech-accent' : ''}`} />
                            </div>
                            <div className={`px-6 overflow-hidden transition-all duration-500 ease-in-out ${hoveredFaq === index ? 'max-h-40 pb-6 opacity-100' : 'max-h-0 opacity-0'}`}><p className="text-gray-600 dark:text-gray-400 text-sm">{faq.answer}</p></div>
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
            <div className="bg-white dark:bg-tech-900 border border-gray-200 dark:border-tech-800 rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-gray-200 dark:border-tech-800 flex justify-between items-center bg-gray-100 dark:bg-tech-950/50">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase flex items-center gap-2">
                        {activeLegalModal === 'terms' && tFooter.terms}
                        {activeLegalModal === 'privacy' && tFooter.privacy}
                        {activeLegalModal === 'disclaimer' && tFooter.risk}
                    </h3>
                    <button onClick={() => setActiveLegalModal(null)} className="p-1 hover:bg-gray-300 dark:hover:bg-tech-800 rounded text-gray-500 dark:text-gray-400 transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-8 overflow-y-auto text-gray-700 dark:text-gray-300 prose dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap">{legalTexts[activeLegalModal]}</div>
                <div className="p-4 border-t border-gray-200 dark:border-tech-800 bg-gray-50 dark:bg-tech-950 flex justify-end">
                    <button onClick={() => setActiveLegalModal(null)} className="px-6 py-2 bg-tech-accent text-white rounded-lg font-bold hover:bg-amber-600 transition-colors shadow-lg shadow-amber-900/20">{tFooter.modalAgree}</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

export default App;
