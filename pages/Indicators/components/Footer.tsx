import React from 'react';
import { Instagram, Youtube } from 'lucide-react';
import { Language } from '../../../types';
import { getTranslations } from '../../../locales';

interface FooterProps {
    currentLang: Language;
}

export const Footer: React.FC<FooterProps> = ({ currentLang }) => {
  const t = getTranslations(currentLang).footer;
  const common = getTranslations(currentLang).common;

  return (
    <footer className="bg-white dark:bg-tv-card border-t border-gray-200 dark:border-gray-800 py-10 transition-colors duration-700 ease-in-out">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
         <div className="flex flex-col items-center text-center gap-4">
             
             <p className="text-base md:text-lg font-medium text-gray-700 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
                "{common.tagline}"
             </p>

             <div className="flex space-x-6 mt-2">
                <a href="https://t.me/+80XjLzFScH0yMWQx" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-[#24A1DE] transition-colors" title="Telegram">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 11.944 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                </a>
                <a href="https://www.instagram.com/centralcrypto72/" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-[#E4405F] transition-colors" title="Instagram">
                    <Instagram className="w-5 h-5" />
                </a>
                <a href="https://www.youtube.com/@centralcryptotraders" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-[#FF0000] transition-colors" title="YouTube">
                    <Youtube className="w-5 h-5" />
                </a>
                <a href="https://x.com/TradersCentral" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-black dark:hover:text-white transition-colors" title="X">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                </a>
             </div>

             <div className="w-full h-px bg-gray-100 dark:bg-gray-800 my-2"></div>

             <p className="text-gray-400 text-xs">
                &copy; {new Date().getFullYear()} Central Crypto. {t.rights}
             </p>
         </div>
      </div>
    </footer>
  );
};
