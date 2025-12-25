
import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowLeft, ArrowRight, Loader2, Clock, User, ChevronRight } from 'lucide-react';
import { getTranslations } from '../locales';
import { Language, WPPost } from '../types';
import { fetchWithFallback } from '../pages/Workspace/services/api';

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

const getImageUrl = (post: WPPost) => {
  return post?._embedded?.['wp:featuredmedia']?.[0]?.source_url || 'https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png';
};

const getAuthor = (post: WPPost) => {
  return post?._embedded?.['author']?.[0]?.name || 'Central Crypto';
};

const NewsFeed: React.FC<NewsFeedProps> = ({ onPostClick, language }) => {
  const [dailyNews, setDailyNews] = useState<WPPost[]>([]);
  const [editorChoice, setEditorChoice] = useState<WPPost[]>([]);
  const [bulletins, setBulletins] = useState<WPPost[]>([]);
  const [mainFeed, setMainFeed] = useState<WPPost[]>([]);
  
  const [page, setPage] = useState(1);
  const [loadingMain, setLoadingMain] = useState(false);
  const [loadingSpecifics, setLoadingSpecifics] = useState(true);
  
  const [carouselIndex, setCarouselIndex] = useState(0);

  const t = getTranslations(language).dashboard.magazine;
  const tPag = getTranslations(language).dashboard.pagination;

  const localeMap: Record<Language, string> = {
      pt: 'pt-BR',
      en: 'en-US',
      es: 'es-ES'
  };
  const currentLocale = localeMap[language];

  useEffect(() => {
    const fetchLists = async () => {
        try {
            setLoadingSpecifics(true);
            const cats = await fetchWithFallback('https://centralcrypto.com.br/2/wp-json/wp/v2/categories?per_page=100');
            
            let dailyId, editorId, bulletinsId;
            if (Array.isArray(cats)) {
                dailyId = cats.find((c:any) => c.name?.toLowerCase().includes('notícias do dia') || c.slug?.includes('noticia') || c.slug?.includes('daily'))?.id;
                editorId = cats.find((c:any) => c.name?.toLowerCase().includes('escolha') || c.slug?.includes('editor') || c.slug?.includes('featured'))?.id;
                bulletinsId = cats.find((c:any) => c.name?.toLowerCase().includes('boletim') || c.slug?.includes('mini'))?.id;
            }

            const getPosts = async (catId: number | undefined, count: number) => {
                let url = `https://centralcrypto.com.br/2/wp-json/wp/v2/posts?per_page=${count}&_embed`;
                if (catId) url += `&categories=${catId}`;
                const data = await fetchWithFallback(url);
                return Array.isArray(data) ? data : [];
            }

            // MUDANÇA CRÍTICA: Execução sequencial para não estourar o servidor
            const d = await getPosts(dailyId, 5);
            const e = await getPosts(editorId, 5);
            const b = await getPosts(bulletinsId, 5);

            let fallbacks: WPPost[] = [];
            if (d.length === 0 || e.length === 0 || b.length === 0) {
                 const fbData = await fetchWithFallback('https://centralcrypto.com.br/2/wp-json/wp/v2/posts?per_page=20&_embed');
                 if(Array.isArray(fbData)) fallbacks = fbData;
            }

            setDailyNews(d.length > 0 ? d : fallbacks.slice(0, 5));
            setEditorChoice(e.length > 0 ? e : fallbacks.slice(5, 10));
            setBulletins(b.length > 0 ? b : fallbacks.slice(10, 15));

        } catch(e) { 
            console.error("NewsFeed init error", e);
        } finally { 
            setLoadingSpecifics(false); 
        }
    };
    fetchLists();
  }, []);

  useEffect(() => {
    const fetchFeed = async () => {
        setLoadingMain(true);
        try {
            const data = await fetchWithFallback(`https://centralcrypto.com.br/2/wp-json/wp/v2/posts?per_page=10&page=${page}&_embed`);
            if(Array.isArray(data)) {
                setMainFeed(data);
                if (page > 1) {
                    const el = document.getElementById('main-feed-anchor');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                }
            }
        } catch(e) {
            console.error("NewsFeed main feed error", e);
        }
        setLoadingMain(false);
    };
    fetchFeed();
  }, [page]);

  useEffect(() => {
    if (editorChoice.length === 0) return;
    const interval = setInterval(() => {
        setCarouselIndex(prev => (prev + 1) % editorChoice.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [editorChoice]);

  const nextSlide = (e?: React.MouseEvent) => {
      if(e) e.stopPropagation();
      setCarouselIndex((prev) => (prev + 1) % editorChoice.length);
  }
  const prevSlide = (e?: React.MouseEvent) => {
      if(e) e.stopPropagation();
      setCarouselIndex((prev) => (prev - 1 + editorChoice.length) % editorChoice.length);
  }

  return (
    <div className="w-full h-full bg-tech-950 border border-tech-800 p-6 rounded-xl shadow-2xl transition-colors">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            <div className="lg:col-span-3 flex flex-col gap-6">
                <div className="border-b-2 border-[#dd9933] pb-2 mb-2">
                    <h3 className="text-gray-200 font-bold uppercase tracking-widest text-sm">{t.dailyNews}</h3>
                </div>
                {loadingSpecifics ? <div className="animate-pulse h-40 bg-tech-800 rounded"></div> : (
                  <>
                    {dailyNews.slice(0, 2).map(post => (
                        <div onClick={() => onPostClick(post.id)} key={post.id} className="group cursor-pointer">
                            <div className="aspect-video w-full overflow-hidden rounded-md border border-tech-700 group-hover:border-[#dd9933] relative mb-3">
                                <img src={getImageUrl(post)} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt="" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                                <div className="absolute bottom-2 left-3 right-3 text-[10px] text-[#dd9933] font-bold uppercase">{getAuthor(post)}</div>
                            </div>
                            <h4 className="text-gray-200 dark:text-[#dd9933] font-bold text-base leading-tight group-hover:text-[#dd9933] dark:group-hover:text-white transition-colors">{decodeHTML(post.title?.rendered)}</h4>
                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 font-mono"><Clock size={12} /> {new Date(post.date).toLocaleDateString(currentLocale)}</div>
                        </div>
                    ))}
                    <div className="flex flex-col gap-4 mt-2 pt-4 border-t border-tech-800">
                        {dailyNews.slice(2, 5).map(post => (
                            <div onClick={() => onPostClick(post.id)} key={post.id} className="group cursor-pointer flex gap-3 items-start">
                                <div className="w-16 h-16 shrink-0 rounded bg-tech-900 border border-tech-800 overflow-hidden">
                                    <img src={getImageUrl(post)} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt="" />
                                </div>
                                <div>
                                    <h5 className="text-gray-300 dark:text-[#dd9933] font-medium text-xs leading-snug group-hover:text-[#dd9933] dark:group-hover:text-white line-clamp-2 transition-colors">{decodeHTML(post.title?.rendered)}</h5>
                                    <div className="text-[10px] text-gray-600 mt-1">{new Date(post.date).toLocaleDateString(currentLocale)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                  </>
                )}
            </div>

            <div className="lg:col-span-6 flex flex-col">
                <div className="mb-10">
                    <div className="flex justify-between items-center border-b-2 border-[#dd9933] pb-2 mb-4">
                        <h3 className="text-gray-200 font-bold uppercase tracking-widest text-sm flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div> {t.dontMiss}</h3>
                    </div>
                    {loadingSpecifics ? <div className="w-full h-[350px] bg-tech-800 rounded-xl animate-pulse"></div> : editorChoice.length > 0 && (
                        <div className="relative w-full h-[350px] rounded-xl overflow-hidden group shadow-2xl border border-tech-700" onClick={() => onPostClick(editorChoice[carouselIndex].id)}>
                            <div className="absolute inset-0 transition-opacity duration-700 cursor-pointer">
                                <img src={getImageUrl(editorChoice[carouselIndex])} className="w-full h-full object-cover" alt="" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                            </div>
                            
                            <button onClick={(e) => prevSlide(e)} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-[#dd9933] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20 hover:scale-110"><ArrowLeft size={20}/></button>
                            <button onClick={(e) => nextSlide(e)} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-[#dd9933] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20 hover:scale-110"><ArrowRight size={20}/></button>

                            <div className="absolute bottom-0 left-0 right-0 p-8 cursor-pointer">
                                <div className="bg-[#dd9933] text-black text-[10px] font-black px-2 py-0.5 inline-block mb-3 rounded-sm uppercase tracking-wider">{t.editorsChoice}</div>
                                <h2 className="text-3xl font-black text-white dark:text-[#dd9933] leading-tight drop-shadow-md mb-4 hover:text-[#dd9933] dark:hover:text-white transition-colors">
                                    {decodeHTML(editorChoice[carouselIndex].title?.rendered)}
                                </h2>
                                <div className="flex items-center gap-4 text-xs text-gray-300 font-mono">
                                    <span className="flex items-center gap-1 font-bold text-[#dd9933]"><User size={12}/> {getAuthor(editorChoice[carouselIndex])}</span>
                                    <span className="flex items-center gap-1"><Clock size={12}/> {new Date(editorChoice[carouselIndex].date).toLocaleDateString(currentLocale, { day: 'numeric', month: 'long', year: 'numeric'})}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div id="main-feed-anchor">
                    <div className="border-b border-tech-800 pb-4 mb-6">
                        <h3 className="text-gray-400 font-mono text-xs uppercase tracking-widest">{t.newsFeed}</h3>
                    </div>
                    <div className="flex flex-col gap-6">
                        {loadingMain ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-[#dd9933]" size={32}/></div> : (
                            mainFeed.map(post => (
                                <div onClick={() => onPostClick(post.id)} key={post.id} className="flex flex-col md:flex-row gap-4 border-b border-tech-800/50 pb-6 group cursor-pointer">
                                    <div className="w-full md:w-48 h-32 shrink-0 rounded-lg overflow-hidden border border-tech-800 group-hover:border-[#dd9933] transition-colors relative bg-black">
                                        <img src={getImageUrl(post)} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="" />
                                    </div>
                                    <div className="flex-1 flex flex-col justify-center">
                                        <h3 className="text-lg font-bold text-gray-200 dark:text-[#dd9933] group-hover:text-[#dd9933] dark:group-hover:text-white transition-colors leading-tight mb-2">{decodeHTML(post.title?.rendered)}</h3>
                                        <div className="text-xs text-gray-400 line-clamp-2 mb-3 leading-relaxed" dangerouslySetInnerHTML={{__html: post.excerpt?.rendered || ''}} />
                                        <div className="flex items-center gap-3 text-[10px] text-gray-500 font-mono uppercase">
                                            <span className="text-[#dd9933] font-bold">{getAuthor(post)}</span><span>•</span><span>{new Date(post.date).toLocaleDateString(currentLocale, {day: '2-digit', month: 'short', year: 'numeric'})}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="flex justify-between items-center mt-10 border-t border-tech-800 pt-6">
                        <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="text-xs font-bold text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 uppercase tracking-wider flex items-center gap-2 transition-colors px-4 py-2 border border-tech-800 rounded hover:bg-tech-800"><ArrowLeft size={14} /> {tPag.prev}</button>
                        <span className="text-xs font-mono text-[#dd9933]">{tPag.page} {page}</span>
                        <button onClick={() => setPage(p => p + 1)} className="text-xs font-bold text-gray-400 hover:text-white uppercase tracking-wider flex items-center gap-2 transition-colors px-4 py-2 border border-tech-800 rounded hover:bg-tech-800">{tPag.next} <ArrowRight size={14} /></button>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-3">
                 <div className="border-b-2 border-[#dd9933] pb-2 mb-4">
                    <h3 className="text-gray-200 font-bold uppercase tracking-widest text-sm">{t.miniBulletins}</h3>
                </div>
                <div className="flex flex-col gap-4">
                    {loadingSpecifics ? <div className="space-y-4 animate-pulse"><div className="h-20 bg-tech-800 rounded"></div></div> : (
                      bulletins.map(post => (
                        <div onClick={() => onPostClick(post.id)} key={post.id} className="group cursor-pointer bg-tech-900 border border-tech-800 hover:border-[#dd9933] p-3 rounded-lg shadow-lg transition-all hover:-translate-y-1">
                            <div className="h-24 w-full rounded overflow-hidden mb-3 border border-tech-950">
                                <img src={getImageUrl(post)} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="" />
                            </div>
                            <h4 className="text-gray-200 dark:text-[#dd9933] font-bold text-xs leading-snug group-hover:text-[#dd9933] dark:group-hover:text-white transition-colors mb-2">{decodeHTML(post.title?.rendered)}</h4>
                            <div className="flex items-center text-[10px] text-gray-500 gap-1"><User size={10} /> {getAuthor(post)} <span className="mx-1">•</span> <Clock size={10} /> {new Date(post.date).toLocaleDateString(currentLocale)}</div>
                        </div>
                      ))
                    )}
                </div>
            </div>

        </div>
    </div>
  );
};

export default NewsFeed;
