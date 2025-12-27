import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Dashboard from './pages/Dashboard';
import Magazine from './pages/Magazine';
import PostView from './pages/PostView';
import Indicators from './pages/Indicators';
import SearchResults from './pages/SearchResults';
import UserProfile from './components/UserProfile';
import Academy from './pages/Academy';
import Workspace from './pages/Workspace';
import Cockpit from './pages/Cockpit';
import AuthModal from './components/AuthModal';
import TermsModal from './components/TermsModal';
import PrivacyModal from './components/PrivacyModal';
import AnalystModal from './components/AnalystModal';
import { AIChatbot } from './pages/Indicators/components/AIChatbot';
import GlobalStatsBar from './components/GlobalStatsBar';
import { ViewMode, Language } from './types';
import { UserData, authService } from './services/auth';

const App: React.FC = () => {
  const [currentView, setView] = useState<ViewMode>(ViewMode.DASHBOARD);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [language, setLanguage] = useState<Language>('pt');
  
  const [user, setUser] = useState<UserData | null>(null);
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [authValidationParams, setAuthValidationParams] = useState<{userId: number, key: string} | null>(null);
  
  const [isTermsOpen, setTermsOpen] = useState(false);
  const [isPrivacyOpen, setPrivacyOpen] = useState(false);
  const [isAnalystOpen, setAnalystOpen] = useState(false);

  useEffect(() => {
    const stored = authService.getCurrentUser();
    if (stored) {
       setUser(stored);
    }

    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const u = params.get('u');
    const k = params.get('k');

    if (mode === 'validate' && u && k) {
        setAuthValidationParams({ userId: parseInt(u), key: k });
        setAuthModalOpen(true);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleLoginSuccess = (u: UserData) => {
      setUser(u);
  };

  const handleLogout = () => {
     authService.logout();
     setUser(null);
     setView(ViewMode.DASHBOARD);
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const isFullScreenIframe = currentView === ViewMode.MAGAZINE;

  const handlePostClick = (postId: number) => {
    setSelectedPostId(postId);
    setView(ViewMode.POST);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setView(ViewMode.SEARCH);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderView = () => {
    switch (currentView) {
      case ViewMode.DASHBOARD:
        return <Dashboard onPostClick={handlePostClick} language={language} setView={setView} theme={theme} />;
      case ViewMode.COCKPIT:
        return <Cockpit language={language} theme={theme} />;
      case ViewMode.INDICATORS:
        return <Indicators user={user} language={language} />; 
      case ViewMode.WORKSPACE:
        return <Workspace language={language} />;
      case ViewMode.MAGAZINE:
        return <Magazine />;
      case ViewMode.ACADEMY:
        return <Academy user={user} language={language} />;
      case ViewMode.SEARCH:
        return <SearchResults query={searchQuery} onPostClick={handlePostClick} />;
      case ViewMode.PROFILE:
        return <UserProfile />;
      case ViewMode.POST:
        return selectedPostId ? (
          <PostView 
            postId={selectedPostId} 
            onBack={() => setView(ViewMode.DASHBOARD)} 
            onPostClick={handlePostClick}
          />
        ) : <Dashboard onPostClick={handlePostClick} language={language} setView={setView} theme={theme} />;
      default:
        return <Dashboard onPostClick={handlePostClick} language={language} setView={setView} theme={theme} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-tech-950 text-gray-200 selection:bg-tech-500 selection:text-white font-sans overflow-x-hidden transition-colors duration-300">
      <style>{`
        :root {
          --color-success: #548f3f; /* Verde solicitado */
          --color-danger: #CD534B;  /* Vermelho solicitado */
        }
        .text-tech-success, .text-green-500, .text-green-400 { color: var(--color-success) !important; }
        .text-tech-danger, .text-red-500, .text-red-400 { color: var(--color-danger) !important; }
        .bg-tech-success, .bg-green-500, .bg-green-600 { background-color: var(--color-success) !important; }
        .bg-tech-danger, .bg-red-500, .bg-red-600 { background-color: var(--color-danger) !important; }
        .border-tech-success, .border-green-500 { border-color: var(--color-success) !important; }
        .border-tech-danger, .border-red-500 { border-color: var(--color-danger) !important; }
      `}</style>
      
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => {
            setAuthModalOpen(false);
            setAuthValidationParams(null);
        }} 
        onLoginSuccess={handleLoginSuccess}
        validationParams={authValidationParams}
      />

      <TermsModal isOpen={isTermsOpen} onClose={() => setTermsOpen(false)} />
      <PrivacyModal isOpen={isPrivacyOpen} onClose={() => setPrivacyOpen(false)} />
      <AnalystModal isOpen={isAnalystOpen} onClose={() => setAnalystOpen(false)} />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Header currentView={currentView} setView={setView} theme={theme} toggleTheme={toggleTheme} user={user} language={language} onLanguageChange={setLanguage} onLoginClick={() => setAuthModalOpen(true)} onLogoutClick={handleLogout} onSearch={handleSearch} />
        <div className="h-[152px] w-full shrink-0"></div>
        {currentView === ViewMode.DASHBOARD && <div className="w-full z-40 -mt-[10px]"><GlobalStatsBar /></div>}
        <main className={`flex-1 flex flex-col w-full ${isFullScreenIframe ? 'p-0' : ''}`}>{renderView()}</main>
        {!isFullScreenIframe && <Footer onTermsClick={() => setTermsOpen(true)} onPrivacyClick={() => setPrivacyOpen(true)} onAnalystClick={() => setAnalystOpen(true)} language={language} />}
      </div>
      <AIChatbot currentLang={language} />
    </div>
  );
};

export default App;