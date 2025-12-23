import React, { useEffect, useState } from 'react';
import { ExternalLink, MessageCircle, Share2, Lock, Unlock, ArrowLeft, BarChart2, Crown, X, Send, CheckCircle, Loader2, Rocket, Instagram, Youtube, Plus, Edit, Trash2 } from 'lucide-react';
import { Indicator, Language } from '../../../types';
import { LOGO_URL } from '../constants';
import { TVLogo } from './Hero';
import { getTranslations } from '../../../locales';

interface IndicatorDetailsProps {
  indicator: Indicator;
  onBack: () => void;
  currentLang: Language;
  isAdmin?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

type FormStatus = 'idle' | 'sending' | 'success' | 'error';

export const IndicatorDetails: React.FC<IndicatorDetailsProps> = ({ 
    indicator, 
    onBack, 
    currentLang,
    isAdmin,
    onEdit,
    onDelete
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const t = getTranslations(currentLang).indicators.details;
  const tModal = getTranslations(currentLang).indicators.vipModal;
  
  const [likesCount, setLikesCount] = useState(indicator.likes);
  const [hasLiked, setHasLiked] = useState(false);
  const [isAnimatingLike, setIsAnimatingLike] = useState(false);

  const [formData, setFormData] = useState({ name: '', username: '' });
  const [formStatus, setFormStatus] = useState<FormStatus>('idle');

  useEffect(() => {
    window.scrollTo(0, 0);
    const storageKey = `cct_liked_${indicator.id}`;
    if (localStorage.getItem(storageKey)) setHasLiked(true);
    else setLikesCount(indicator.likes);
  }, [indicator.id, indicator.likes]);

  useEffect(() => {
    if (!isModalOpen) {
        const timer = setTimeout(() => {
            setFormStatus('idle');
            setFormData({ name: '', username: '' });
        }, 300);
        return () => clearTimeout(timer);
    }
  }, [isModalOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBoost = () => {
      if (hasLiked) return; 
      setIsAnimatingLike(true);
      setLikesCount(prev => prev + 1);
      setHasLiked(true);
      localStorage.setItem(`cct_liked_${indicator.id}`, 'true');
      setTimeout(() => setIsAnimatingLike(false), 1000);
  };

  const handleConfirmDelete = () => {
      if (window.confirm("Tem certeza que deseja excluir?")) {
          if (onDelete) onDelete();
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus('sending');
    try {
        const emailjs = (window as any).emailjs;
        if (emailjs) {
             await emailjs.send('service_pj2t7oj', 'template_n6g5rc9', {
                indicator_title: indicator.title,
                user_name: formData.name,
                user_tv_id: formData.username,
                message: `Solicitação VIP (${currentLang}): ${indicator.title} - User: ${formData.username}`,
                to_email: "centralcryptotraders@gmail.com" 
            }, 'He5qvYsFseQfVpPlX');
        } else {
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
        setFormStatus('success');
    } catch (error) {
        console.error(error);
        setFormStatus('error');
    }
  };

  const getLocalizedFullDescription = () => {
      const desc = currentLang === 'en' && indicator.fullDescription_en ? indicator.fullDescription_en :
                   currentLang === 'es' && indicator.fullDescription_es ? indicator.fullDescription_es :
                   indicator.fullDescription || indicator.description;
      return desc || '';
  };

  const processHTML = (text: string) => {
      if (!text) return { __html: '' };
      return { __html: text.replace(/\n/g, '<br/>') };
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-tech-950 pt-24 pb-20 animate-fade-in relative transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <button onClick={onBack} className="mb-6 flex items-center text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4 mr-1" /> {t.back}
        </button>

        <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">{indicator.title}</h1>
                {isAdmin && (
                    <div className="flex items-center gap-2 mb-1">
                        <button onClick={onEdit} className="p-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white rounded-full transition-colors"><Edit className="w-4 h-4" /></button>
                        <button onClick={handleConfirmDelete} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
               <div className="flex items-center gap-2">
                   <img src={LOGO_URL} className="w-6 h-6 rounded-full object-contain bg-white" alt="author"/>
                   <span className="font-medium text-gray-900 dark:text-white">Central_CryptoTraders</span>
               </div>
               <span>•</span>
               <span className="uppercase bg-gray-200 dark:bg-tech-800 px-2 py-0.5 rounded text-xs font-bold tracking-wider">{indicator.type === 'Strategy' ? t.strategy : t.indicator}</span>
               <span>•</span>
               <span>{t.updated}</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
             <a href={indicator.originalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center px-6 py-2 rounded-md bg-tech-accent hover:bg-amber-600 text-white font-bold transition-colors shadow-lg shadow-amber-900/20">
               {t.openTv} <TVLogo className="ml-2 h-4 w-auto text-white dark:text-white" />
             </a>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                <div className="w-full aspect-video bg-[#131722] rounded-xl overflow-hidden border-0 dark:border dark:border-tech-800 shadow-2xl relative group">
                    <img src={indicator.imageUrl} alt={indicator.title} className="w-full h-full object-cover" />
                </div>

                <div className="bg-white dark:bg-tech-900 rounded-xl border-0 dark:border dark:border-tech-800 p-8 shadow-sm dark:shadow-none">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 border-b border-gray-100 dark:border-tech-800 pb-4">{indicator.title}</h2>
                    
                    <div 
                        className="prose prose-invert max-w-none leading-relaxed text-gray-700 dark:text-gray-300 font-sans"
                        dangerouslySetInnerHTML={processHTML(getLocalizedFullDescription())}
                    />
                    
                    <div className="mt-8 pt-8 border-t border-gray-100 dark:border-tech-800">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4">{t.disclaimerTitle}</h3>
                        <p className="text-xs text-gray-500 italic">{t.disclaimerText}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-white dark:bg-tech-900 rounded-xl border-0 dark:border dark:border-tech-800 p-6 shadow-sm dark:shadow-none">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex flex-col">
                            <span className={`text-3xl font-bold transition-all duration-300 ${isAnimatingLike ? 'scale-125 text-tech-accent' : 'text-gray-900 dark:text-white'}`}>{likesCount}</span>
                            <span className="text-sm text-gray-500">{t.boosts}</span>
                        </div>
                        <button onClick={handleBoost} disabled={hasLiked} className={`p-3 rounded-full transition-all duration-300 transform ${hasLiked ? 'bg-tech-accent/20 text-tech-accent cursor-default' : 'bg-gray-200 dark:bg-tech-800 hover:bg-gray-300 dark:hover:bg-tech-700 text-gray-400 hover:text-black dark:hover:text-white hover:scale-110 active:scale-95 cursor-pointer'} ${isAnimatingLike ? 'animate-bounce' : ''}`}>
                             <Rocket className={`w-8 h-8 ${hasLiked ? 'fill-current' : ''}`} />
                        </button>
                    </div>
                    {hasLiked && (
                         <div className="mb-6 text-xs text-center text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-400/10 py-2 rounded animate-fade-in whitespace-pre-line">
                             {t.boostThanks}<br/><a href={indicator.originalUrl} target="_blank" rel="noreferrer" className="underline hover:text-black dark:hover:text-white">{t.boostLink}</a>
                         </div>
                    )}
                    <div className="h-px bg-gray-100 dark:bg-tech-700 w-full mb-6"></div>
                    <div className="space-y-4">
                         <div className="flex justify-between text-sm"><span className="text-gray-500">{t.type}</span><span className="text-gray-900 dark:text-white font-medium">{indicator.type}</span></div>
                         <div className="flex justify-between text-sm"><span className="text-gray-500">{t.version}</span><span className="text-gray-900 dark:text-white font-medium">v6</span></div>
                         <div className="flex justify-between text-sm"><span className="text-gray-500">{t.access}</span><span className={`font-medium flex items-center ${indicator.price.includes('Protegido') ? 'text-yellow-600 dark:text-yellow-500' : 'text-green-600 dark:text-green-500'}`}>{indicator.price.includes('Protegido') ? <Lock className="w-3 h-3 mr-1"/> : <Unlock className="w-3 h-3 mr-1"/>}{indicator.price}</span></div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-tech-800 dark:to-tech-900 rounded-xl border border-transparent dark:border-tech-700 p-6">
                    <BarChart2 className="w-8 h-8 text-tech-accent mb-4" />
                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">{t.getAccess}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t.addFavDesc} <TVLogo className="h-3 w-auto inline" />.</p>
                    <a href={indicator.originalUrl} target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-tech-accent text-white font-bold py-2 rounded hover:bg-amber-600 transition-colors shadow-sm">{t.btnAddFav}</a>
                </div>
            </div>
        </div>
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-tech-900 border border-gray-200 dark:border-tech-700 rounded-xl w-full max-w-md shadow-2xl">
                <div className="p-6 border-b border-gray-200 dark:border-tech-700 flex justify-between items-center bg-gray-100 dark:bg-tech-800/50 rounded-t-xl">
                    <div className="flex items-center gap-2"><Crown className="w-5 h-5 text-yellow-500" /><h3 className="text-xl font-bold text-gray-900 dark:text-white">{tModal.title}</h3></div>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-black dark:hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                {formStatus === 'success' ? (
                    <div className="p-8 text-center animate-fade-in">
                        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{tModal.successTitle}</h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-6">{tModal.successDesc}</p>
                        <a href={indicator.originalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center px-6 py-3 rounded-md bg-tech-accent hover:bg-amber-600 text-white font-bold transition-all w-full"><Rocket className="w-4 h-4 mr-2" />{tModal.btnGo}</a>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        <div className="space-y-2"><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{tModal.labelName}</label><input type="text" name="name" required value={formData.name} onChange={handleInputChange} className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-tech-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 outline-none" placeholder={tModal.placeholderName} /></div>
                        <div className="space-y-2"><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{tModal.labelUser}</label><input type="text" name="username" required value={formData.username} onChange={handleInputChange} className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-tech-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 outline-none" placeholder={tModal.placeholderUser} /></div>
                        <button type="submit" disabled={formStatus === 'sending'} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">{formStatus === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{formStatus === 'sending' ? tModal.btnSending : tModal.btnSubmit}</button>
                    </form>
                )}
            </div>
        </div>
      )}
    </div>
  );
};