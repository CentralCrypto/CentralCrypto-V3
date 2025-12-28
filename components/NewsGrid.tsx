
import React, { useState, useEffect, useCallback } from 'react';
import { getTranslations } from '../locales';
import { Language } from '../types';
import { fetchMagazinePosts, fetchMagazineCategories, MagazinePost } from '../services/magazine';
import { RefreshCw, Loader2 } from 'lucide-react';

interface NewsGridProps {
  onPostClick: (postId: number) => void;
  language: Language;
}

const NewsGrid: React.FC<NewsGridProps> = ({ onPostClick, language }) => {
  const [estudos, setEstudos] = useState<MagazinePost[]>([]);
  const [analises, setAnalises] = useState<MagazinePost[]>([]);
  const [maisLidasPool, setMaisLidasPool] = useState<MagazinePost[]>([]);
  const [trendingIndex, setTrendingIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);

  const t = getTranslations(language).dashboard.magazine;
  
  const decodeHTML = (html: string) => {
    if (!html) return '';
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  };

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const cats = await fetchMagazineCategories();
      const estudosCat = cats.find(c => c.slug?.includes('estudo'));
      const analisesCat = cats.find(c => c.slug?.includes('analise'));
      const trendingCat = cats.find(c => c.slug?.includes('trending') || c.slug?.includes('editor'));

      const [resEstudos, resAnalises, resTrending] = await Promise.all([
          fetchMagazinePosts({ categories: estudosCat?.id, perPage: 2 }).catch(() => ({ posts: [] })),
          fetchMagazinePosts({ categories: analisesCat?.id, perPage: 5 }).catch(() => ({ posts: [] })),
          fetchMagazinePosts({ categories: trendingCat?.id, perPage: 8 }).catch(() => ({ posts: [] }))
      ]);

      setEstudos(resEstudos.posts);
      setAnalises(resAnalises.posts);
      setMaisLidasPool(resTrending.posts);
    } catch (e: any) { console.error("WP fetch error"); } 
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  // Rotação do Hero
  useEffect(() => {
    if (analises.length <= 1) return;
    const interval = setInterval(() => { setHeroIndex(prev => (prev + 1) % analises.length); }, 8000);
    return () => clearInterval(interval);
  }, [analises]);

  // Rotação Vertical das Mais Lidas (5 de 8)
  useEffect(() => {
    if (maisLidasPool.length <= 5) return;
    const interval = setInterval(() => {
      setTrendingIndex(prev => (prev + 1) % (maisLidasPool.length - 4));
    }, 5000);
    return () => clearInterval(interval);
  }, [maisLidasPool]);

  const visibleTrending = maisLidasPool.slice(trendingIndex, trendingIndex + 5);
  const currentHero = analises[heroIndex];

  if (loading && estudos.length === 0) return (
      <div className="w-full h-[600px] flex flex-col items-center justify-center bg-tech-900/50 rounded-xl border border-tech-800">
          <Loader2 className="w-10 h-10 text-[#dd9933] animate-spin mb-4 opacity-50" />
      </div>
  );

  return (
    <div className="w-full h-full bg-tech-950 border border-tech-800 p-6 rounded-xl flex flex-col gap-6 shadow-2xl relative overflow-hidden transition-colors">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#dd9933]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full relative z-10">
        <div className="md:col-span-3 flex flex-col h-full">
          <div className="text-sm font-bold uppercase tracking-widest text-gray-200 border-b-2 border-[#dd9933] pb-2 mb-4 shrink-0">{t.recentStudies}</div>
          <div className="flex-1 flex flex-col gap-4">
            {estudos.map((post) => (
               <div onClick={() => onPostClick(post.id)} key={post.id} className="relative group cursor-pointer overflow-hidden rounded-lg flex-1 border border-tech-700 hover:border-[#dd9933] transition-colors shadow-lg bg-black">
                  <img src={post.featuredImage} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-60 group-hover:opacity-100" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                     <h4 className="text-gray-200 font-bold text-base leading-tight drop-shadow-md mb-2 line-clamp-2 group-hover:text-[#dd9933] transition-colors">{decodeHTML(post.titleHtml)}</h4>
                     <div className="flex items-center text-[9px] text-gray-400 gap-2 font-mono uppercase">
                        <span className="text-[#dd9933] font-bold">{post.authorName}</span>
                        <span>•</span>
                        <span>{new Date(post.date).toLocaleDateString('pt-BR')}</span>
                     </div>
                  </div>
               </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-6 flex flex-col h-full">
          <div className="text-sm font-bold uppercase tracking-widest text-gray-200 border-b-2 border-[#dd9933] pb-2 mb-6 text-center shrink-0">Últimas Análises</div>
          {currentHero ? (
            <div onClick={() => onPostClick(currentHero.id)} className="relative flex-1 overflow-hidden rounded-lg group cursor-pointer shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-tech-700 hover:border-[#dd9933] transition-all bg-tech-800">
               <img key={currentHero.id} src={currentHero.featuredImage} alt="" className="w-full h-full object-cover animate-in fade-in duration-1000 absolute inset-0 opacity-70 group-hover:opacity-100 transition-opacity" />
               <div className="absolute inset-0 bg-gradient-to-t from-tech-950 via-tech-950/30 to-transparent"></div>
               <div className="absolute bottom-0 left-0 right-0 p-8 md:p-10">
                  <div className="bg-[#dd9933] text-black text-[10px] font-black px-2 py-0.5 inline-block mb-3 rounded-sm uppercase tracking-widest shadow-lg transform -skew-x-12">ANÁLISE</div>
                  <h2 className="text-white font-bold text-3xl md:text-5xl leading-tight mb-4 drop-shadow-xl group-hover:text-[#dd9933] transition-colors">{decodeHTML(currentHero.titleHtml)}</h2>
                  <div className="flex items-center text-xs text-gray-300 gap-4 font-mono uppercase">
                      <span className="font-bold text-[#dd9933]">{currentHero.authorName}</span>
                      <span className="opacity-50">/</span>
                      <span className="hidden sm:inline">{new Date(currentHero.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</span>
                  </div>
               </div>
            </div>
          ) : null}
        </div>

        <div className="md:col-span-3 flex flex-col h-full">
           <div className="text-sm font-bold uppercase tracking-widest text-gray-200 border-b-2 border-[#dd9933] pb-2 mb-6 text-right shrink-0">{t.trendingTopics}</div>
           <div className="flex-1 flex flex-col gap-2 overflow-hidden relative">
             {visibleTrending.map((post, i) => (
               <div onClick={() => onPostClick(post.id)} key={`${post.id}-${trendingIndex}-${i}`} className="flex gap-3 bg-tech-900 border border-tech-800 hover:border-[#dd9933] p-2 rounded-lg shadow-lg cursor-pointer flex-1 group items-center transition-all animate-in slide-in-from-bottom-2 duration-500">
                  <div className="relative w-16 h-16 shrink-0 overflow-hidden rounded-md bg-black">
                     <img src={post.featuredImage} className="w-full h-full object-cover opacity-70 group-hover:opacity-100" alt=""/>
                     <div className="absolute top-0 left-0 bg-[#dd9933] text-black text-[9px] font-black px-1.5 py-0.5 shadow-md z-10">{trendingIndex + i + 1}</div>
                  </div>
                  <div className="flex flex-col justify-center flex-1 min-w-0">
                     <h5 className="text-[11px] font-bold text-gray-200 leading-tight line-clamp-2 group-hover:text-[#dd9933] transition-colors">{decodeHTML(post.titleHtml)}</h5>
                     <div className="text-[9px] text-gray-500 font-mono uppercase mt-1">{post.authorName}</div>
                  </div>
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default NewsGrid;
