import React from 'react';
import { BarChart2, Database, Zap, ShieldCheck, Terminal, Cpu, Layers, Activity, ExternalLink } from 'lucide-react';
import { Language } from '../../../types';
import { LOGO_URL } from '../constants';
import { getTranslations } from '../../../locales';

export const TVLogo = ({ className = "h-5 w-auto", textClassName, showText = true }: { className?: string, textClassName?: string, showText?: boolean }) => (
  <div className="inline-flex items-center gap-1 align-middle select-none">
    <svg viewBox="0 0 36 32" className={`${className} fill-current text-black dark:text-white transition-colors duration-700`}>
       <path d="M14 25H7V14H0V7h14v18ZM35.5 7 28 25h-8l7.5-18h8ZM20 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
    </svg>
    {showText && (
      <>
        <span className={`font-bold text-lg tracking-tight ${textClassName ? textClassName : "text-black dark:text-white"} transition-colors duration-700`}>TradingView</span>
        <span className="text-[10px] align-top text-gray-500">©</span>
      </>
    )}
  </div>
);

interface HeroProps {
    currentLang: Language;
}

export const Hero: React.FC<HeroProps> = ({ currentLang }) => {
  const t = getTranslations(currentLang).indicators.hero;
  const common = getTranslations(currentLang).common;
  
  const marqueeItems = [
      { icon: null, text: "TradingView Compatible", isLogo: true },
      { icon: <CodeIcon />, text: "Pine Script v6" },
      { icon: <ShieldCheck className="w-5 h-5" />, text: "100% Auditado" },
      { icon: <Cpu className="w-5 h-5" />, text: "Algoritmos de Última Geração" },
      { icon: <Terminal className="w-5 h-5" />, text: "Código Limpo & Otimizado" },
      { icon: <BarChart2 className="w-5 h-5" />, text: "Funções Nativas TV" },
      { icon: <Zap className="w-5 h-5" />, text: "Execução Ultra-Rápida" },
      { icon: <Layers className="w-5 h-5" />, text: "Multi-Timeframe" },
      { icon: <Activity className="w-5 h-5" />, text: "Alertas via Webhook" },
  ];

  const displayItems = [...marqueeItems, ...marqueeItems];

  return (
    <div className="relative overflow-hidden bg-gray-50 dark:bg-tech-950 pt-32 lg:pt-48 transition-all duration-1000 ease-in-out flex flex-col">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none opacity-30 dark:opacity-20 transition-opacity duration-1000">
         <div className="absolute top-10 right-0 w-96 h-96 bg-tech-accent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-all duration-1000 ease-in-out"></div>
         <div className="absolute bottom-0 left-0 w-72 h-72 bg-yellow-500 dark:bg-green-500 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 transition-all duration-1000 ease-in-out"></div>
      </div>

      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-[0.08]"
        style={{
            backgroundImage: `url(${LOGO_URL})`,
            backgroundAttachment: 'fixed',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '500px'
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-20">
        <div className="inline-flex items-center px-4 py-2 rounded-full bg-white dark:bg-tech-900 border border-transparent dark:border-tech-800 text-sm text-tech-accent dark:text-green-400 font-medium mb-8 animate-fade-in-up shadow-sm transition-colors duration-700">
          <Database className="w-4 h-4 mr-2" />
          {t.badge}
        </div>
        
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-4 transition-colors duration-700">
          {t.title1} <br />
          <div className="flex items-center justify-center gap-2 flex-wrap pb-8 leading-relaxed">
             <img src={LOGO_URL} alt="Logo" className="w-12 h-12 md:w-16 md:h-16 object-contain inline-block" />
             <span className="text-transparent bg-clip-text bg-gradient-to-r from-tech-accent to-yellow-600 inline-block py-2">
                Central Crypto
             </span>
          </div>
        </h1>
        
        <p className="text-lg md:text-xl font-medium text-tech-accent dark:text-tech-accent mb-6 italic opacity-100 max-w-3xl mx-auto animate-fade-in">
            "{common.tagline}"
        </p>
        
        <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-600 dark:text-gray-400 mb-10 transition-colors duration-700">
          {t.subtitle}
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a 
            href="https://www.tradingview.com/u/Central_CryptoTraders/#published-scripts"
            target="_blank"
            rel="noopener noreferrer" 
            className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-bold rounded-lg text-white bg-tech-accent hover:bg-amber-600 transition-all transform hover:scale-105 shadow-lg shadow-amber-900/20 w-full sm:w-auto"
          >
            {t.btnView} <span className="ml-2"><TVLogo className="h-4 w-auto text-white dark:text-white" textClassName="text-white dark:text-white"/></span>
          </a>

          <a 
            href="https://www.tradingview.com/pricing/?source=main_menu&feature=pricing"
            target="_blank"
            rel="noopener noreferrer" 
            className="inline-flex items-center justify-center px-8 py-4 border border-gray-200 dark:border-tech-700 text-base font-bold rounded-lg text-gray-700 dark:text-white bg-white dark:bg-tech-900 hover:bg-gray-50 dark:hover:bg-tech-800 transition-all duration-500 w-full sm:w-auto"
          >
            {t.btnSub} <span className="mx-2"><TVLogo className="h-4 w-auto text-black dark:text-white" /></span> <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
        
      <div id="recursos" className="relative w-full bg-white dark:bg-tech-900 border-y border-transparent dark:border-tech-800 overflow-hidden py-8 z-20 transition-colors duration-700 group">
         <div className="flex w-max animate-scroll group-hover:[animation-play-state:paused]">
             {displayItems.map((item, idx) => (
                 <div key={idx} className="flex items-center justify-center mx-12 text-gray-500 dark:text-gray-400 flex-shrink-0 whitespace-nowrap transition-colors duration-700">
                    {item.icon && <div className="mr-3 text-tech-accent">{item.icon}</div>}
                    <span className="font-bold uppercase tracking-wider text-sm md:text-base flex items-center gap-2">
                        {item.isLogo ? <TVLogo className="h-6 w-auto text-black dark:text-white" /> : item.text}
                        {item.isLogo && " Compatible"}
                    </span>
                 </div>
             ))}
         </div>
         <div className="absolute top-0 left-0 h-full w-24 bg-gradient-to-r from-gray-50 dark:from-tech-950 to-transparent z-30 pointer-events-none transition-colors duration-1000"></div>
         <div className="absolute top-0 right-0 h-full w-24 bg-gradient-to-l from-gray-50 dark:from-tech-950 to-transparent z-30 pointer-events-none transition-colors duration-1000"></div>
      </div>
    </div>
  );
};

const CodeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
);