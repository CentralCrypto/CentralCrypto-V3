
import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Clock, User, AlertCircle, RefreshCw } from 'lucide-react';
import { getTranslations } from '../locales';
import { Language } from '../types';
import { fetchMagazinePosts, fetchMagazineCategories, MagazinePost } from '../services/magazine';

interface NewsFeedProps {
    onPostClick: (postId: number) => void;
    language: Language;
}

const decodeHTML = (html: string) => {
  if (!html) return '';
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
};

const NewsFeed: React.FC<NewsFeedProps> = ({ onPostClick, language }) => {
  const [dailyNews, setDailyNews] = useState<MagazinePost[]>([]);
  const [editorChoice, setEditorChoice] = useState<MagazinePost[]>([]);
  const [bulletins, setBulletins] = useState<MagazinePost[]>([]);
  const [mainFeed, setMainFeed] = useState<MagazinePost[]>([]);
  
  const [page, setPage] = useState(1);
  const [loadingMain, setLoadingMain] = useState(false);
  const [loadingSpecifics, setLoadingSpecifics] = useState(true);
  const [error, setError] = useState('');
  
  const [carouselIndex, setCarouselIndex] = useState(0);

  const t = getTranslations(language).dashboard.magazine;
  const tPag = getTranslations(language).dashboard.pagination;

  const localeMap: Record<Language, string> = {
      pt: 'pt-BR',
      en: 'en-US',
      es: 'es-ES'
  };
  const currentLocale = localeMap[language];

  const fetchLists = useCallback(async () => {
        try {
            setError('');
            setLoadingSpecifics(true);
            const cats = await fetchMagazineCategories();
            
            const dailyId = cats.find((c:any) => c.slug?.includes('noticia'))?.id;
            const editorId = cats.find((c:any) => c.slug?.includes('editor'))?.id;
            const bulletinsId = cats.find((c:any) => c.slug?.includes('boletim'))?.id;

            const [d, e, b] = await Promise.all([
                fetchMagazinePosts({ categories: dailyId || 0, perPage: 5 }).catch(() => ({ posts: [] })),
                fetchMagazinePosts({ categories: editorId || 0, perPage: 5 }).catch(() => ({ posts: [] })),
                fetchMagazinePosts({ categories: bulletinsId || 0, perPage: 5 }).catch(() => ({ posts: [] }))
            ]);

            setDailyNews(d.posts);
            setEditorChoice(e.posts);
            setBulletins(b.posts);
        } catch(e) { 
        } finally { 
            setLoadingSpecifics(false); 
        }
  }, []);

  const fetchFeed = useCallback(async () => {
        setLoadingMain(true);
        try {
            const data = await fetchMagazinePosts({ page, perPage: 10 });
            setMainFeed(data.posts);
            if (page > 1) {
                const el = document.getElementById('main-feed-anchor');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
            }
        } catch(e: any) {
            setError('Servidor momentaneamente indisponível.');
        }
        setLoadingMain(false);
  }, [page]);

  useEffect(() => {
    fetchLists();
    fetchFeed();
  }, [fetchLists, fetchFeed]);

  useEffect(() => {
    if (editorChoice.length === 0) return;
    const interval = setInterval(() => {
        setCarouselIndex(prev => (prev + 1) % editorChoice.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [editorChoice]);

  if (error && mainFeed.length === 0 && dailyNews.length === 0) return (
    <div className="w-full bg-tech-950 border border-tech-800 p-12 rounded-xl text-center shadow-2xl">
        <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
        <h4 className="text-gray-200 font-bold text-xl mb-2">Central Offline</h4>
        <p className="text-gray-400 text-sm mb-6">{error}</p>
        <button onClick={() => { fetchLists(); fetchFeed(); }} className="bg-tech-800 hover:bg-tech-700 text-[#dd9933] font-bold px-6 py-2 rounded-lg border border-[#dd9933]/30 flex items-center gap-2 mx-auto transition-all">
            <RefreshCw size={16} /> Reconectar
        </button>
    </div>
  );

  return (
    <div className="w-full h-full bg-tech-950 border border-tech-800 p-6 rounded-xl shadow-2xl transition-colors">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-3 flex flex-col gap-6">
                <div className="border-b-2 border-[#dd9933] pb-2 mb-2">
                    <h3 className="text-gray-200 font-bold uppercase tracking-widest text-sm">{t.dailyNews}</h3>
                </div>
                {loadingSpecifics ? <div className="animate-pulse space-y-4"><div className="h-40 bg-tech-800 rounded"></div></div> : (
                  dailyNews.slice(0, 2).map(post => (
                      <div onClick={() => onPostClick(post.id)} key={post.id} className="group cursor-pointer">
                          <div className="aspect-video w-full overflow-hidden rounded-md border border-tech-700 group-hover:border-[#dd9933] relative mb-3">
                              <img src={post.featuredImage} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt="" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                              <div className="absolute bottom-2 left-3 right-3 text-[10px] text-[#dd9933] font-bold uppercase">{post.authorName}</div>
                          </div>
                          <h4 className="text-gray-200 dark:text-[#dd9933] font-bold text-base leading-tight group-hover:text-[#dd9933] dark:group-hover:text-white transition-colors">{decodeHTML(post.titleHtml)}</h4>
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 font-mono"><Clock size={12} /> {new Date(post.date).toLocaleDateString(currentLocale)}</div>
                      </div>
                  ))
                )}
            </div>

            <div className="lg:col-span-6 flex flex-col">
                <div className="mb-10">
                    <div className="flex justify-between items-center border-b-2 border-[#dd9933] pb-2 mb-4">
                        <h3 className="text-gray-200 font-bold uppercase tracking-widest text-sm flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div> {t.dontMiss}</h3>
                    </div>
                    {loadingSpecifics ? <div className="w-full h-[350px] bg-tech-800 rounded-xl animate-pulse"></div> : editorChoice.length > 0 && (
                        <div className="relative w-full h-[350px] rounded-xl overflow-hidden group shadow-2xl border border-tech-700" onClick={() => onPostClick(editorChoice[carouselIndex].id)}>
                            <img src={editorChoice[carouselIndex].featuredImage} className="w-full h-full object-cover transition-opacity duration-700 cursor-pointer" alt="" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                            <div className="absolute bottom-0 left-0 right-0 p-8 cursor-pointer">
                                <div className="bg-[#dd9933] text-black text-[10px] font-black px-2 py-0.5 inline-block mb-3 rounded-sm uppercase tracking-wider">{t.editorsChoice}</div>
                                <h2 className="text-3xl font-black text-white dark:text-[#dd9933] leading-tight drop-shadow-md mb-4 hover:text-[#dd9933] dark:hover:text-white transition-colors">
                                    {decodeHTML(editorChoice[carouselIndex].titleHtml)}
                                </h2>
                                <div className="flex items-center gap-4 text-xs text-gray-300 font-mono">
                                    <span className="flex items-center gap-1 font-bold text-[#dd9933]"><User size={12}/> {editorChoice[carouselIndex].authorName}</span>
                                    <span className="flex items-center gap-1"><Clock size={12}/> {new Date(editorChoice[carouselIndex].date).toLocaleDateString(currentLocale)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div id="main-feed-anchor" className="flex flex-col gap-6">
                    {loadingMain ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-[#dd9933]" size={32}/></div> : (
                        mainFeed.map(post => (
                            <div onClick={() => onPostClick(post.id)} key={post.id} className="flex flex-col md:flex-row gap-4 border-b border-tech-800/50 pb-6 group cursor-pointer">
                                <div className="w-full md:w-48 h-32 shrink-0 rounded-lg overflow-hidden border border-tech-800 group-hover:border-[#dd9933] transition-colors relative bg-black">
                                    <img src={post.featuredImage} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="" />
                                </div>
                                <div className="flex-1 flex flex-col justify-center">
                                    <h3 className="text-lg font-bold text-gray-200 dark:text-[#dd9933] group-hover:text-[#dd9933] dark:group-hover:text-white transition-colors leading-tight mb-2">{decodeHTML(post.titleHtml)}</h3>
                                    <div className="text-xs text-gray-400 line-clamp-2 mb-3 leading-relaxed">{post.excerptText}</div>
                                    <div className="flex items-center gap-3 text-[10px] text-gray-500 font-mono uppercase">
                                        <span className="text-[#dd9933] font-bold">{post.authorName}</span><span>•</span><span>{new Date(post.date).toLocaleDateString(currentLocale)}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                {mainFeed.length > 0 && (
                    <div className="flex justify-between items-center mt-10 border-t border-tech-800 pt-6">
                        <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="text-xs font-bold text-gray-400 hover:text-white disabled:opacity-30 uppercase tracking-wider flex items-center gap-2 transition-colors px-4 py-2 border border-tech-800 rounded hover:bg-tech-800">← {tPag.prev}</button>
                        <span className="text-xs font-mono text-[#dd9933]">{tPag.page} {page}</span>
                        <button onClick={() => setPage(p => p + 1)} className="text-xs font-bold text-gray-400 hover:text-white uppercase tracking-wider flex items-center gap-2 transition-colors px-4 py-2 border border-tech-800 rounded hover:bg-tech-800">{tPag.next} →</button>
                    </div>
                )}
            </div>

            <div className="lg:col-span-3">
                 <div className="border-b-2 border-[#dd9933] pb-2 mb-4">
                    <h3 className="text-gray-200 font-bold uppercase tracking-widest text-sm">{t.miniBulletins}</h3>
                </div>
                <div className="flex flex-col gap-4">
                    {bulletins.map(post => (
                      <div onClick={() => onPostClick(post.id)} key={post.id} className="group cursor-pointer bg-tech-900 border border-tech-800 hover:border-[#dd9933] p-3 rounded-lg shadow-lg transition-all hover:-translate-y-1">
                          <div className="h-24 w-full rounded overflow-hidden mb-3 border border-tech-950">
                              <img src={post.featuredImage} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="" />
                          </div>
                          <h4 className="text-gray-200 dark:text-[#dd9933] font-bold text-xs leading-snug group-hover:text-[#dd9933] dark:group-hover:text-white transition-colors mb-2">{decodeHTML(post.titleHtml)}</h4>
                          <div className="flex items-center text-[10px] text-gray-500 gap-1"><User size={10} /> {post.authorName}</div>
                      </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );
};

export default NewsFeed;
