
import React from 'react';
import { 
  Twitter, 
  Instagram, 
  Youtube, 
  Mail, 
  Send, 
  TikTok 
} from './Icons';
import { getTranslations } from '../locales';
import { Language } from '../types';

interface FooterProps {
  onTermsClick?: () => void;
  onPrivacyClick?: () => void;
  onAnalystClick?: () => void;
  language?: Language;
}

const Footer: React.FC<FooterProps> = ({ onTermsClick, onPrivacyClick, onAnalystClick, language = 'pt' as Language }) => {
  const t = getTranslations(language).footer;

  return (
    <footer className="bg-tech-950 border-t border-tech-800 pt-12 pb-8 text-gray-300 font-sans relative z-20 transition-colors duration-700">
      <div className="max-w-[90%] mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 md:gap-4 relative">
          
          <div className="flex flex-col gap-4 text-center md:text-left w-full md:w-1/3">
            <div className="flex items-center justify-center md:justify-start gap-3">
               <img 
                 src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" 
                 alt="Central Crypto" 
                 className="h-10 w-auto opacity-100"
               />
               <div className="flex flex-col leading-none">
                 <span className="text-gray-200 font-bold text-xl uppercase tracking-wider transition-colors duration-700">Central</span>
                 <span className="text-[#dd9933] font-bold text-xl uppercase tracking-widest">CryptoTraders</span>
               </div>
            </div>
            <p className="text-xs leading-relaxed text-gray-400 max-w-xs mx-auto md:mx-0 transition-colors duration-700">
              {t.tagline}
            </p>
          </div>

          <div className="w-full md:w-1/3 flex justify-center order-3 md:order-2 mt-4 md:mt-0">
            <div className="flex flex-col gap-3 text-sm font-bold text-center">
               <button onClick={onTermsClick} className="text-gray-400 hover:text-[#dd9933] transition-colors duration-700 hover:scale-105 transform">{t.terms}</button>
               <button onClick={onPrivacyClick} className="text-gray-400 hover:text-[#dd9933] transition-colors duration-700 hover:scale-105 transform">{t.privacy}</button>
               <button onClick={onAnalystClick} className="text-gray-400 hover:text-[#dd9933] transition-colors duration-700 hover:scale-105 transform">{t.risk}</button>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-end gap-4 w-full md:w-1/3 order-2 md:order-3">
            
            <div className="flex items-center gap-2 group cursor-pointer">
                <div className="w-8 h-8 rounded-full bg-tech-800 flex items-center justify-center text-[#dd9933] group-hover:bg-[#dd9933] group-hover:text-black transition-all duration-300">
                    <Mail size={16} />
                </div>
                <span className="text-sm font-bold text-gray-300 group-hover:text-[#dd9933] transition-colors duration-700">contato@centralcrypto.com.br</span>
            </div>

            <div className="flex gap-3">
              <a href="https://t.me/+80XjLzFScH0yMWQx" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-tech-800 flex items-center justify-center text-[#dd9933] hover:bg-[#dd9933] hover:text-white transition-all duration-300 shadow-lg hover:scale-110">
                <Send size={18} />
              </a>
              <a href="https://www.tiktok.com/@centralcrypto323" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-tech-800 flex items-center justify-center text-[#dd9933] hover:bg-[#dd9933] hover:text-white transition-all duration-300 shadow-lg hover:scale-110">
                <TikTok size={18} />
              </a>
              <a href="https://www.instagram.com/centralcrypto72/" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-tech-800 flex items-center justify-center text-[#dd9933] hover:bg-[#dd9933] hover:text-white transition-all duration-300 shadow-lg hover:scale-110">
                <Instagram size={18} />
              </a>
              <a href="https://www.youtube.com/@centralcryptotraders" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-tech-800 flex items-center justify-center text-[#dd9933] hover:bg-[#dd9933] hover:text-white transition-all duration-300 shadow-lg hover:scale-110">
                <Youtube size={18} />
              </a>
              <a href="https://x.com/TradersCentral" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-tech-800 flex items-center justify-center text-[#dd9933] hover:bg-[#dd9933] hover:text-white transition-all duration-300 shadow-lg hover:scale-110">
                <Twitter size={18} />
              </a>
            </div>

            <p className="text-xs text-gray-500 font-mono mt-2 text-center md:text-right transition-colors duration-700">
              &copy; {new Date().getFullYear()} Central Crypto Traders. {t.rights}
            </p>
          </div>

        </div>
      </div>
    </footer>
  );
};

export default Footer;
