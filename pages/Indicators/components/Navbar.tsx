
import React, { useState, useRef } from 'react';
import { Menu, X, ExternalLink, ArrowLeft, Plus, ChevronDown, FileText, Shield, AlertTriangle } from 'lucide-react';
import { TVLogo } from './Hero';
import { Language } from '../../../types';
import { getTranslations } from '../../../locales';

interface NavbarProps {
  onNavigateHome?: () => void;
  isDetailsPage?: boolean;
  currentLang: Language;
  isAdmin?: boolean;
  onOpenAdmin?: () => void;
  onLogout?: () => void;
  onAdminLogin?: () => void;
  onOpenLegal?: (type: 'terms' | 'privacy' | 'disclaimer') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
    onNavigateHome, 
    isDetailsPage = false, 
    currentLang, 
    isAdmin = false,
    onOpenAdmin,
    onOpenLegal
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLegalMenuOpen, setIsLegalMenuOpen] = useState(false);
  const legalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const t = getTranslations(currentLang).indicators.nav;
  const tFooter = getTranslations(currentLang).footer;

  const handleLegalEnter = () => {
      if (legalTimeoutRef.current) clearTimeout(legalTimeoutRef.current);
      setIsLegalMenuOpen(true);
  };

  const handleLegalLeave = () => {
      legalTimeoutRef.current = setTimeout(() => {
          setIsLegalMenuOpen(false);
      }, 500); 
  };

  const navLinks = [
    { name: t.features, href: '#recursos', external: false },
    { name: t.testimonials, href: '#depoimentos', external: false },
  ];

  const handleLogoClick = (e: React.MouseEvent) => {
    if (isDetailsPage && onNavigateHome) {
        e.preventDefault();
        onNavigateHome();
    }
  };

  return (
    <nav className="fixed top-[147px] w-full z-40 bg-gray-50 dark:bg-[#1a1c1e] border-b border-transparent dark:border-tech-800 shadow-sm transition-colors duration-700 ease-in-out">
      <div className="max-w-[90%] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3 w-1/4">
            {isDetailsPage && onNavigateHome ? (
               <button 
                 onClick={onNavigateHome}
                 className="hidden md:block mr-2 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-tech-800 text-gray-800 dark:text-gray-300 transition-colors"
               >
                 <ArrowLeft className="w-5 h-5" />
               </button>
            ) : null}
            <a href="/" onClick={handleLogoClick} className="flex items-center gap-3 cursor-pointer group">
                <span className="font-bold text-lg sm:text-xl tracking-tight text-gray-900 dark:text-white transition-colors duration-700">Indicadores <span className="text-tech-accent">CCT</span></span>
            </a>
          </div>
          
          <div className="hidden md:flex flex-1 items-center justify-center">
            <div className="flex items-center space-x-6">
                {!isDetailsPage && (
                    <>
                        <a href={navLinks[0].href} className="text-gray-700 dark:text-gray-300 hover:text-tech-accent dark:hover:text-tech-accent hover:bg-black/5 dark:hover:bg-white/5 px-3 py-2 rounded-md text-sm font-medium transition-colors">{navLinks[0].name}</a>
                        <a href={navLinks[1].href} className="text-gray-700 dark:text-gray-300 hover:text-tech-accent dark:hover:text-tech-accent hover:bg-black/5 dark:hover:bg-white/5 px-3 py-2 rounded-md text-sm font-medium transition-colors">{navLinks[1].name}</a>
                    </>
                )}
                {isDetailsPage && onNavigateHome && (
                    <button onClick={onNavigateHome} className="text-gray-700 dark:text-gray-300 hover:text-tech-accent dark:hover:text-tech-accent hover:bg-black/5 dark:hover:bg-white/5 px-3 py-2 rounded-md text-sm font-medium transition-colors">{t.backList}</button>
                )}
                <div className="relative" onMouseEnter={handleLegalEnter} onMouseLeave={handleLegalLeave}>
                    <button className="text-gray-700 dark:text-gray-300 hover:text-tech-accent dark:hover:text-tech-accent hover:bg-black/5 dark:hover:bg-white/5 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1">
                        {t.legal} <ChevronDown className="w-3 h-3" />
                    </button>
                    <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-0 pt-2 w-48 transition-all duration-300 origin-top transform ${isLegalMenuOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}`}>
                            <div className="bg-white dark:bg-tech-900 border border-transparent dark:border-tech-800 rounded-xl shadow-xl overflow-hidden">
                                <div className="flex flex-col py-1">
                                    <button onClick={() => onOpenLegal && onOpenLegal('terms')} className="text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-tech-800 hover:text-tech-accent transition-colors flex items-center gap-2"><FileText className="w-3 h-3" /> {tFooter.terms}</button>
                                    <button onClick={() => onOpenLegal && onOpenLegal('privacy')} className="text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-tech-800 hover:text-tech-accent transition-colors flex items-center gap-2"><Shield className="w-3 h-3" /> {tFooter.privacy}</button>
                                    <button onClick={() => onOpenLegal && onOpenLegal('disclaimer')} className="text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold transition-colors flex items-center gap-2"><AlertTriangle className="w-3 h-3" /> {tFooter.risk}</button>
                                </div>
                            </div>
                    </div>
                </div>
            </div>
          </div>

          <div className="hidden md:flex w-1/4 items-center justify-end gap-3">
              {isAdmin && (
                  <button onClick={onOpenAdmin} className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-bold transition-colors shadow"><Plus className="w-4 h-4" /> Novo</button>
              )}
              <a href="https://www.tradingview.com/u/Central_CryptoTraders/#published-scripts" target="_blank" rel="noopener noreferrer" className="group bg-white dark:bg-tech-800 text-gray-900 dark:text-tech-accent hover:text-black dark:hover:text-white px-4 py-2 rounded-md text-sm font-bold transition-all shadow-md dark:border dark:border-tech-700 flex items-center gap-2">
                <span className="group-hover:text-black dark:group-hover:text-white transition-colors hidden lg:inline">Perfil TV</span>
                <TVLogo className="h-4 w-auto text-black dark:text-tech-accent group-hover:text-black dark:group-hover:text-white transition-colors" textClassName="text-black dark:text-tech-accent group-hover:text-black dark:group-hover:text-white transition-colors" />
                <ExternalLink className="w-4 h-4 lg:hidden" />
              </a>
          </div>

          <div className="-mr-2 flex md:hidden items-center gap-2">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 dark:text-gray-400 hover:text-tech-accent dark:hover:text-white hover:bg-black/5 dark:hover:bg-tech-700 focus:outline-none">
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-tech-900 border-b border-transparent dark:border-tech-800 shadow-xl transition-colors duration-700">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {isAdmin && (
                <div className="flex gap-2 px-3 py-2 bg-gray-100 dark:bg-tech-800 mb-2 rounded">
                    <button onClick={() => { if(onOpenAdmin) onOpenAdmin(); setIsMobileMenuOpen(false); }} className="flex-1 flex items-center justify-center gap-1 bg-green-600 text-white px-3 py-2 rounded font-bold text-sm"><Plus className="w-4 h-4" /> Novo Indicador</button>
                </div>
            )}
            {!isDetailsPage && (
                <>
                    <a href={navLinks[0].href} onClick={() => setIsMobileMenuOpen(false)} className="text-gray-700 dark:text-gray-300 hover:text-tech-accent dark:hover:text-white block px-3 py-2 rounded-md text-base font-medium">{navLinks[0].name}</a>
                    <a href={navLinks[1].href} onClick={() => setIsMobileMenuOpen(false)} className="text-gray-700 dark:text-gray-300 hover:text-tech-accent dark:hover:text-white block px-3 py-2 rounded-md text-base font-medium">{navLinks[1].name}</a>
                </>
            )}
            {isDetailsPage && onNavigateHome && (
                 <button onClick={() => { onNavigateHome(); setIsMobileMenuOpen(false); }} className="text-gray-700 dark:text-gray-300 hover:text-tech-accent dark:hover:text-white block w-full text-left px-3 py-2 rounded-md text-base font-medium">{t.backHome}</button>
            )}
            <div className="border-t border-gray-200 dark:border-tech-700 my-2 pt-2">
                <p className="px-3 text-xs text-gray-500 uppercase font-bold mb-1">Legal</p>
                <button onClick={() => { onOpenLegal && onOpenLegal('terms'); setIsMobileMenuOpen(false); }} className="text-gray-700 dark:text-gray-300 block w-full text-left px-3 py-2 text-sm">{tFooter.terms}</button>
                <button onClick={() => { onOpenLegal && onOpenLegal('privacy'); setIsMobileMenuOpen(false); }} className="text-gray-700 dark:text-gray-300 block w-full text-left px-3 py-2 text-sm">{tFooter.privacy}</button>
                <button onClick={() => { onOpenLegal && onOpenLegal('disclaimer'); setIsMobileMenuOpen(false); }} className="text-red-500 font-bold block w-full text-left px-3 py-2 text-sm">{tFooter.risk}</button>
            </div>
            <a href="https://www.tradingview.com/u/Central_CryptoTraders/#published-scripts" target="_blank" rel="noopener noreferrer" className="w-full text-center mt-4 bg-gray-900 dark:bg-tech-800 text-tech-accent px-4 py-3 rounded-md font-bold flex items-center justify-center gap-2">
               Perfil TV <TVLogo className="h-4 w-auto text-tech-accent" textClassName="text-tech-accent" /> <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
