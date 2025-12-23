
import React, { useState, useEffect } from 'react';
import { getTranslations } from '../locales';
import { Language } from '../types';

interface WPPost {
  id: number;
  title: { rendered: string };
  excerpt: { rendered: string };
  date: string;
  link: string;
  categories: number[];
  _embedded?: {
    'wp:featuredmedia'?: Array<{ source_url: string }>;
    'author'?: Array<{ name: string }>;
  };
}

interface NewsGridProps {
  onPostClick: (postId: number) => void;
  language: Language;
}

const NewsGrid: React.FC<NewsGridProps> = ({ onPostClick, language }) => {
  const [estudos, setEstudos] = useState<WPPost[]>([]);
  const [analises, setAnalises] = useState<WPPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [heroIndex, setHeroIndex] = useState(0);
  const [trendingIndex, setTrendingIndex] = useState(0);

  const t = getTranslations(language).dashboard.magazine;
  
  // Map language to locale string for date formatting
  const localeMap: Record<Language, string> = {
      pt: 'pt-BR',
      en: 'en-US',
      es: 'es-ES'
  };
  const currentLocale = localeMap[language];

  const decodeHTML = (html: string) => {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  };

  const getImageUrl = (post: WPPost) => {
    return post._embedded?.['wp:featuredmedia']?.[0]?.source_url || 'https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png';
  };

  const getAuthor = (post: WPPost) => {
    return post._embedded?.['author']?.[0]?.name || 'Central Crypto';
  };

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        setError('');
        const catRes = await fetch('https://centralcrypto.com.br/2/wp-json/wp/v2/categories?per_page=100');
        let estudosId: number | null = null;
        let analisesId: number | null = null;
        if (catRes.ok) {
          const cats = await catRes.json();
          cats.forEach((c: any) => {
             const s = c.slug.toLowerCase();
             if (s.includes('estudo')) estudosId = c.id;
             if (s.includes('analise') || s.includes('análise')) analisesId = c.id;
          });
        }
        const postsRes = await fetch('https://centralcrypto.com.br/2/wp-json/wp/v2/posts?_embed&per_page=30');
        if (!postsRes.ok) throw new Error("Erro de conexão com WP API");
        const allPosts: WPPost[] = await postsRes.json();
        if (!Array.isArray(allPosts) || allPosts.length === 0) {
           setError('Nenhum post encontrado na API.');
           setLoading(false);
           return;
        }
        let estudosList: WPPost[] = [];
        let analisesList: WPPost[] = [];
        if (estudosId) estudosList = allPosts.filter(p => p.categories.includes(estudosId as number));
        if (analisesId) analisesList = allPosts.filter(p => p.categories.includes(analisesId as number));
        const usedIds = new Set<number>();
        if (estudosList.length < 2) {
           const needed = 2 - estudosList.length;
           const available = allPosts.filter(p => !estudosList.includes(p) && !usedIds.has(p.id));
           estudosList = [...estudosList, ...available.slice(0, needed)];
        }
        estudosList.forEach(p => usedIds.add(p.id));
        if (analisesList.length === 0) analisesList = allPosts.filter(p => !usedIds.has(p.id));
        setEstudos(estudosList.slice(0, 2));
        setAnalises(analisesList);
        setLoading(false);
      } catch (e) {
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  useEffect(() => {
    if (analises.length === 0) return;
    const interval = setInterval(() => { setHeroIndex(prev => (prev + 1) % analises.length); }, 5000);
    return () => clearInterval(interval);
  }, [analises]);

  useEffect(() => {
    if (analises.length === 0) return;
    const interval = setInterval(() => { setTrendingIndex(prev => (prev + 1) % analises.length); }, 5000);
    return () => clearInterval(interval);
  }, [analises]);

  const getTrendingSlice = () => {
    if(analises.length === 0) return [];
    const res = [];
    for(let i=0; i<3; i++) {
      const idx = (trendingIndex + i + 1) % analises.length; 
      res.push({ ...analises[idx], rank: idx + 2 });
    }
    return res;
  };

  const currentHero = analises[heroIndex];
  const trendingList = getTrendingSlice();

  if (loading) return <div className="w-full h-full flex flex-col items-center justify-center bg-tech-900 rounded-xl border border-tech-700 min-h-[600px]"><div className="w-12 h-12 border-4 border-[#dd9933] border-t-transparent rounded-full animate-spin mb-4"></div><div className="text-[#dd9933] font-mono tracking-widest text-lg animate-pulse">LENDO MAGAZINE...</div></div>;
  if (error) return <div className="w-full h-full flex flex-col items-center justify-center bg-tech-900 rounded-xl border border-tech-700 p-8 text-center min-h-[600px]"><div className="text-red-500 font-bold text-xl mb-2">⚠ {error}</div></div>;

  return (
    <div className="w-full h-full bg-tech-950 border border-tech-800 p-6 rounded-xl flex flex-col gap-6 shadow-2xl relative overflow-hidden transition-colors">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#dd9933]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full relative z-10">
        
        {/* COL 1: ESTUDOS */}
        <div className="md:col-span-3 flex flex-col justify-between h-full">
          <div className="text-base font-bold uppercase tracking-widest text-gray-200 border-b-2 border-[#dd9933] pb-2 mb-2 shrink-0">{t.recentStudies}</div>
          <div className="flex-1 flex flex-col gap-4">
            {estudos.map((post) => (
               <div onClick={() => onPostClick(post.id)} key={post.id} className="relative group cursor-pointer overflow-hidden rounded-lg h-[48%] border border-tech-700 hover:border-[#dd9933] transition-colors shadow-lg bg-black">
                  <img src={getImageUrl(post)} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-70 group-hover:opacity-100" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                     <h4 className="text-white dark:text-[#dd9933] font-bold text-xl leading-tight drop-shadow-md mb-3 line-clamp-3 group-hover:text-[#dd9933] dark:group-hover:text-white transition-colors">{decodeHTML(post.title.rendered)}</h4>
                     <div className="flex items-center text-xs text-gray-300 gap-3 font-mono border-t border-gray-600 pt-3">
                        <span className="flex items-center gap-1 font-bold text-[#dd9933] uppercase">{getAuthor(post)}</span>
                        <span>{new Date(post.date).toLocaleDateString(currentLocale)}</span>
                     </div>
                  </div>
               </div>
            ))}
          </div>
        </div>

        {/* COL 2: ANÁLISES (HERO) */}
        <div className="md:col-span-6 flex flex-col h-full">
          <div className="text-base font-bold uppercase tracking-widest text-gray-200 border-b-2 border-[#dd9933] pb-2 mb-6 text-center shrink-0">{t.featuredAnalysis}</div>
          {currentHero ? (
            <div onClick={() => onPostClick(currentHero.id)} className="relative flex-1 overflow-hidden rounded-lg group cursor-pointer shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-tech-700 hover:border-[#dd9933] transition-all bg-tech-800">
               <img key={currentHero.id} src={getImageUrl(currentHero)} alt="" className="w-full h-full object-cover animate-in fade-in duration-700 absolute inset-0 opacity-80 group-hover:opacity-100 transition-opacity" />
               <div className="absolute inset-0 bg-gradient-to-t from-tech-950 via-tech-950/50 to-transparent opacity-100"></div>
               <div className="absolute bottom-0 left-0 right-0 p-8 md:p-10">
                  <div className="bg-[#dd9933] text-black text-xs font-black px-3 py-1 inline-block mb-4 rounded-sm uppercase tracking-wider shadow-lg transform -skew-x-12">{t.highlight}</div>
                  <h2 className="text-gray-200 dark:text-[#dd9933] font-black text-3xl md:text-5xl leading-none mb-6 drop-shadow-xl shadow-black group-hover:text-[#dd9933] dark:group-hover:text-white transition-colors">{decodeHTML(currentHero.title.rendered)}</h2>
                  <div className="flex items-center text-base text-gray-200 gap-6 font-mono border-t border-gray-500/50 pt-6">
                      <span className="flex items-center gap-2 font-bold text-[#dd9933]"><span className="w-2.5 h-2.5 rounded-full bg-[#dd9933] animate-pulse"></span>{getAuthor(currentHero)}</span>
                      <span>{new Date(currentHero.date).toLocaleDateString(currentLocale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
               </div>
               <div className="absolute top-0 left-0 h-1.5 bg-[#dd9933] z-20 animate-[progress_5s_linear_infinite]" style={{ width: '100%' }}></div>
            </div>
          ) : <div className="flex-1 flex items-center justify-center text-gray-500 bg-tech-900 border border-dashed border-tech-700">Aguardando conteúdo...</div>}
        </div>

        {/* COL 3: TRENDING */}
        <div className="md:col-span-3 flex flex-col h-full">
           <div className="text-base font-bold uppercase tracking-widest text-gray-200 border-b-2 border-[#dd9933] pb-2 mb-6 text-right shrink-0">{t.trendingTopics}</div>
           <div className="flex-1 flex flex-col gap-4 overflow-hidden relative">
             <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-tech-950 to-transparent z-10 pointer-events-none"></div>
             <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-tech-950 to-transparent z-10 pointer-events-none"></div>
             
             {trendingList.map((post, i) => (
               <div onClick={() => onPostClick(post.id)} key={`${post.id}-${i}`} className="flex gap-4 bg-tech-900 border border-tech-800 hover:border-[#dd9933] transition-all p-3 rounded-lg shadow-lg cursor-pointer flex-1 animate-in slide-in-from-bottom-4 duration-700 group items-center">
                  <div className="relative w-24 h-full shrink-0 overflow-hidden rounded-md bg-black">
                     <img src={getImageUrl(post)} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-80 group-hover:opacity-100" alt=""/>
                     <div className="absolute top-0 left-0 bg-[#dd9933] text-black text-xs font-black px-2 py-1 shadow-md z-10">{post.rank}</div>
                  </div>
                  <div className="flex flex-col justify-center">
                     <h5 className="text-sm font-bold text-gray-200 dark:text-[#dd9933] leading-tight line-clamp-3 group-hover:text-[#dd9933] dark:group-hover:text-white transition-colors mb-2">{decodeHTML(post.title.rendered)}</h5>
                     <div className="text-xs text-gray-500 font-mono flex items-center gap-2"><span>{new Date(post.date).toLocaleDateString(currentLocale)}</span></div>
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
