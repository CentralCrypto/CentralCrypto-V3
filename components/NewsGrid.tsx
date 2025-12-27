
import React, { useState, useEffect, useCallback } from 'react';
import { getTranslations } from '../locales';
import { Language } from '../types';
import { fetchMagazinePosts, fetchMagazineCategories, MagazinePost } from '../services/magazine';
import { RefreshCw, Loader2, WifiOff } from 'lucide-react';

interface NewsGridProps {
  onPostClick: (postId: number) => void;
  language: Language;
}

const NewsGrid: React.FC<NewsGridProps> = ({ onPostClick, language }) => {
  const [estudos, setEstudos] = useState<MagazinePost[]>([]);
  const [analises, setAnalises] = useState<MagazinePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [heroIndex, setHeroIndex] = useState(0);

  const t = getTranslations(language).dashboard.magazine;
  
  const localeMap: Record<Language, string> = {
      pt: 'pt-BR',
      en: 'en-US',
      es: 'es-ES'
  };
  const currentLocale = localeMap[language];

  const decodeHTML = (html: string) => {
    if (!html) return '';
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  };

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const cats = await fetchMagazineCategories();
      const estudosCat = cats.find(c => c.slug?.includes('estudo'));
      const analisesCat = cats.find(c => c.slug?.includes('analise'));

      // Requisição local rápida: Exatamente o que cada coluna precisa
      const [resEstudos, resAnalises] = await Promise.all([
          fetchMagazinePosts({ categories: estudosCat?.id, perPage: 2 }).catch(() => ({ posts: [] })),
          fetchMagazinePosts({ categories: analisesCat?.id, perPage: 5 }).catch(() => ({ posts: [] }))
      ]);

      setEstudos(resEstudos.posts);
      setAnalises(resAnalises.posts);

      if (resEstudos.posts.length === 0 && resAnalises.posts.length === 0) {
          setError('O Banco de Dados está vazio ou inacessível.');
      }
    } catch (e: any) {
      setError('Falha na comunicação local com o WordPress.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  useEffect(() => {
    if (analises.length <= 1) return;
    const interval = setInterval(() => { 
        setHeroIndex(prev => (prev + 1) % analises.length); 
    }, 8000);
    return () => clearInterval(interval);
  }, [analises]);

  const trending = [...analises].reverse();
  const currentHero = analises[heroIndex];

  if (loading && estudos.length === 0 && analises.length === 0) return (
      <div className="w-full h-[600px] flex flex-col items-center justify-center bg-tech-900/50 rounded-xl border border-tech-800">
          <Loader2 className="w-10 h-10 text-[#dd9933] animate-spin mb-4 opacity-50" />
          <div className="text-gray-500 font-mono tracking-widest text-xs animate-pulse uppercase">Conexão direta estabelecida...</div>
      </div>
  );
  
  if (error && estudos.length === 0 && analises.length === 0) return (
    <div className="w-full h-[500px] flex flex-col items-center justify-center bg-tech-900 rounded-xl border border-red-500/20 p-12 text-center shadow-2xl">
        <WifiOff size={32} className="text-red-500 mb-6 opacity-80" />
        <h3 className="text-gray-200 font-bold text-xl mb-2">Central Inacessível</h3>
        <p className="text-gray-400 font-mono text-xs max-w-sm mb-8">
            Verifique as permissões da pasta /2 no seu servidor.
        </p>
        <button onClick={fetchNews} className="flex items-center justify-center gap-2 bg-[#dd9933] hover:bg-amber-600 text-black font-black uppercase text-xs px-6 py-3 rounded-lg transition-all">
            <RefreshCw size={14} /> Tentar Agora
        </button>
    </div>
  );

  return (
    <div className="w-full h-full bg-tech-950 border border-tech-800 p-6 rounded-xl flex flex-col gap-6 shadow-2xl relative overflow-hidden transition-colors">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#dd9933]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full relative z-10">
        <div className="md:col-span-3 flex flex-col h-full">
          <div className="text-base font-bold uppercase tracking-widest text-gray-200 border-b-2 border-[#dd9933] pb-2 mb-4 shrink-0">{t.recentStudies}</div>
          <div className="flex-1 flex flex-col gap-4">
            {estudos.map((post) => (
               <div onClick={() => onPostClick(post.id)} key={post.id} className="relative group cursor-pointer overflow-hidden rounded-lg flex-1 border border-tech-700 hover:border-[#dd9933] transition-colors shadow-lg bg-black">
                  <img src={post.featuredImage} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-70 group-hover:opacity-100" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                     <h4 className="text-white dark:text-[#dd9933] font-bold text-lg leading-tight drop-shadow-md mb-2 line-clamp-2 group-hover:text-[#dd9933] dark:group-hover:text-white transition-colors">{decodeHTML(post.titleHtml)}</h4>
                     <div className="flex items-center text-[10px] text-gray-300 gap-2 font-mono border-t border-gray-600/50 pt-2">
                        <span className="font-bold text-[#dd9933] uppercase truncate">{post.authorName}</span>
                        <span className="shrink-0">{new Date(post.date).toLocaleDateString(currentLocale)}</span>
                     </div>
                  </div>
               </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-6 flex flex-col h-full">
          <div className="text-base font-bold uppercase tracking-widest text-gray-200 border-b-2 border-[#dd9933] pb-2 mb-6 text-center shrink-0">{t.featuredAnalysis}</div>
          {currentHero ? (
            <div onClick={() => onPostClick(currentHero.id)} className="relative flex-1 overflow-hidden rounded-lg group cursor-pointer shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-tech-700 hover:border-[#dd9933] transition-all bg-tech-800">
               <img key={currentHero.id} src={currentHero.featuredImage} alt="" className="w-full h-full object-cover animate-in fade-in duration-700 absolute inset-0 opacity-80 group-hover:opacity-100 transition-opacity" />
               <div className="absolute inset-0 bg-gradient-to-t from-tech-950 via-tech-950/50 to-transparent opacity-100"></div>
               <div className="absolute bottom-0 left-0 right-0 p-8 md:p-10">
                  <div className="bg-[#dd9933] text-black text-xs font-black px-3 py-1 inline-block mb-4 rounded-sm uppercase tracking-wider shadow-lg transform -skew-x-12">{t.highlight}</div>
                  <h2 className="text-gray-200 dark:text-[#dd9933] font-black text-3xl md:text-5xl leading-none mb-6 drop-shadow-xl shadow-black group-hover:text-[#dd9933] dark:group-hover:text-white transition-colors">{decodeHTML(currentHero.titleHtml)}</h2>
                  <div className="flex items-center text-base text-gray-200 gap-6 font-mono border-t border-gray-500/50 pt-6">
                      <span className="flex items-center gap-2 font-bold text-[#dd9933]"><span className="w-2.5 h-2.5 rounded-full bg-[#dd9933] animate-pulse"></span>{currentHero.authorName}</span>
                      <span className="hidden sm:inline">{new Date(currentHero.date).toLocaleDateString(currentLocale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
               </div>
               <div className="absolute top-0 left-0 h-1.5 bg-[#dd9933] z-20 animate-[progress_8s_linear_infinite]" style={{ width: '100%' }}></div>
            </div>
          ) : null}
        </div>

        <div className="md:col-span-3 flex flex-col h-full">
           <div className="text-base font-bold uppercase tracking-widest text-gray-200 border-b-2 border-[#dd9933] pb-2 mb-6 text-right shrink-0">{t.trendingTopics}</div>
           <div className="flex-1 flex flex-col gap-3 overflow-hidden relative">
             {trending.map((post, i) => (
               <div onClick={() => onPostClick(post.id)} key={`${post.id}-${i}`} className="flex gap-3 bg-tech-900 border border-tech-800 hover:border-[#dd9933] transition-all p-2 rounded-lg shadow-lg cursor-pointer flex-1 animate-in slide-in-from-bottom-2 duration-500 group items-center">
                  <div className="relative w-20 h-full shrink-0 overflow-hidden rounded-md bg-black">
                     <img src={post.featuredImage} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-70 group-hover:opacity-100" alt=""/>
                     <div className="absolute top-0 left-0 bg-[#dd9933] text-black text-[10px] font-black px-1.5 py-0.5 shadow-md z-10">{i + 1}</div>
                  </div>
                  <div className="flex flex-col justify-center flex-1 min-w-0">
                     <h5 className="text-xs font-bold text-gray-200 dark:text-[#dd9933] leading-tight line-clamp-2 group-hover:text-[#dd9933] dark:group-hover:text-white transition-colors mb-1">{decodeHTML(post.titleHtml)}</h5>
                     <div className="text-[9px] text-gray-500 font-mono flex items-center gap-2"><span>{new Date(post.date).toLocaleDateString(currentLocale)}</span></div>
                  </div>
               </div>
             ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes progress { 0% { width: 0% } 100% { width: 100% } }`}</style>
    </div>
  );
};

export default NewsGrid;
