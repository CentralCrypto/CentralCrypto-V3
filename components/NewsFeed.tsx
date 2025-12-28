
import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Clock, User, AlertCircle, RefreshCw, Crown, ArrowRight } from 'lucide-react';
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

const VipAdBlock = ({ index, lang }: { index: number, lang: Language }) => {
    const configs = [
        { title: "Central Academy VIP", desc: "Domine o mercado com mentorias e cursos exclusivos do básico ao avançado.", btn: "Explorar Academy", img: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800" },
        { title: "Indicadores Premium", desc: "Acesso total aos nossos scripts de alta performance no TradingView.", btn: "Ver Indicadores", img: "https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&q=80&w=800" },
        { title: "Analytics Workspaces", desc: "Crie seus próprios dashboards técnicos com dados em tempo real da Binance.", btn: "Acessar Workspace", img: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&q=80&w=800" }
    ];
    const conf = configs[index % configs.length];
    return (
        <div className="w-full h-48 rounded-xl overflow-hidden relative my-6 border border-[#dd9933]/30 shadow-2xl group cursor-pointer">
            <img src={conf.img} className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-r from-tech-950 via-tech-950/80 to-transparent"></div>
            <div className="absolute inset-0 p-8 flex flex-col justify-center max-w-xl">
                <div className="flex items-center gap-2 mb-2">
                    <Crown size={18} className="text-[#dd9933]" />
                    <span className="text-[10px] font-black text-[#dd9933] uppercase tracking-[0.3em]">Exclusivo para Membros VIP</span>
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">{conf.title}</h3>
                <p className="text-gray-300 text-sm font-medium mb-4 line-clamp-2">{conf.desc}</p>
                <button className="flex items-center gap-2 bg-[#dd9933] text-black font-black uppercase text-[10px] tracking-widest px-4 py-2 rounded shadow-lg self-start group-hover:bg-white transition-all">
                    {conf.btn} <ArrowRight size={12}/>
                </button>
            </div>
        </div>
    );
};

const NewsFeed: React.FC<NewsFeedProps> = ({ onPostClick, language }) => {
  const [dailyNews, setDailyNews] = useState<MagazinePost[]>([]);
  const [carouselFiltered, setCarouselFiltered] = useState<MagazinePost[]>([]);
  const [bulletins, setBulletins] = useState<MagazinePost[]>([]);
  const [mainFeed, setMainFeed] = useState<MagazinePost[]>([]);
  
  const [page, setPage] = useState(1);
  const [loadingMain, setLoadingMain] = useState(false);
  const [loadingSpecifics, setLoadingSpecifics] = useState(true);
  const [error, setError] = useState('');
  const [carouselIndex, setCarouselIndex] = useState(0);

  const t = getTranslations(language).dashboard.magazine;
  const tPag = getTranslations(language).dashboard.pagination;

  const fetchLists = useCallback(async () => {
        try {
            const cats = await fetchMagazineCategories();
            const dailyId = cats.find((c:any) => c.slug?.includes('noticia'))?.id;
            const editorId = cats.find((c:any) => c.slug?.includes('editor'))?.id;
            const estudosId = cats.find((c:any) => c.slug?.includes('estudo'))?.id;
            const bulletinsId = cats.find((c:any) => c.slug?.includes('boletim'))?.id;

            const [d, cf, b] = await Promise.all([
                fetchMagazinePosts({ categories: dailyId || 0, perPage: 5 }).catch(() => ({ posts: [] })),
                fetchMagazinePosts({ categories: [estudosId, editorId].filter(Boolean).join(','), perPage: 5 }).catch(() => ({ posts: [] })),
                fetchMagazinePosts({ categories: bulletinsId || 0, perPage: 5 }).catch(() => ({ posts: [] }))
            ]);
            setDailyNews(d.posts);
            setCarouselFiltered(cf.posts);
            setBulletins(b.posts);
        } catch(e) {} finally { setLoadingSpecifics(false); }
  }, []);

  const fetchFeed = useCallback(async () => {
        setLoadingMain(true);
        try {
            const data = await fetchMagazinePosts({ page, perPage: 10 });
            setMainFeed(data.posts);
        } catch(e: any) { setError('Falha no Feed.'); }
        setLoadingMain(false);
  }, [page]);

  useEffect(() => { fetchLists(); fetchFeed(); }, [fetchLists, fetchFeed]);

  useEffect(() => {
    if (carouselFiltered.length === 0) return;
    const interval = setInterval(() => { setCarouselIndex(prev => (prev + 1) % carouselFiltered.length); }, 6000);
    return () => clearInterval(interval);
  }, [carouselFiltered]);

  return (
    <div className="flex flex-col gap-10">
        <div className="w-full h-full bg-tech-950 border border-tech-800 p-6 rounded-xl shadow-2xl transition-colors">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* NOTÍCIAS DIÁRIAS (ESQUERDA) */}
                <div className="lg:col-span-3 flex flex-col gap-6">
                    <div className="border-b-2 border-[#dd9933] pb-2 mb-2"><h3 className="text-gray-200 font-bold uppercase tracking-widest text-sm">{t.dailyNews}</h3></div>
                    {dailyNews.slice(0, 3).map(post => (
                        <div onClick={() => onPostClick(post.id)} key={post.id} className="group cursor-pointer">
                            <div className="aspect-video w-full overflow-hidden rounded-md border border-tech-700 group-hover:border-[#dd9933] relative mb-3">
                                <img src={post.featuredImage} className="w-full h-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105" alt="" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                                <div className="absolute bottom-2 left-3 right-3 text-[9px] text-[#dd9933] font-black uppercase tracking-widest">{post.authorName}</div>
                            </div>
                            <h4 className="text-gray-200 font-bold text-base leading-tight group-hover:text-[#dd9933] transition-colors">{decodeHTML(post.titleHtml)}</h4>
                            <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-500 font-mono uppercase"><Clock size={12} /> {new Date(post.date).toLocaleDateString('pt-BR')}</div>
                        </div>
                    ))}
                </div>

                {/* FEED CENTRAL COM ADS */}
                <div className="lg:col-span-6 flex flex-col">
                    <div className="mb-10">
                        {loadingSpecifics ? <div className="w-full h-[350px] bg-tech-800 rounded-xl animate-pulse"></div> : carouselFiltered.length > 0 && (
                            <div className="relative w-full h-[380px] rounded-xl overflow-hidden group shadow-2xl border border-tech-700 cursor-pointer" onClick={() => onPostClick(carouselFiltered[carouselIndex].id)}>
                                <img src={carouselFiltered[carouselIndex].featuredImage} className="w-full h-full object-cover transition-all duration-1000 group-hover:scale-110 opacity-70" alt="" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                                <div className="absolute bottom-0 left-0 right-0 p-8">
                                    <div className="bg-[#dd9933] text-black text-[9px] font-black px-2 py-0.5 inline-block mb-4 rounded-sm uppercase tracking-widest">{t.editorsChoice}</div>
                                    <h2 className="text-4xl font-bold text-white leading-tight drop-shadow-md mb-4 group-hover:text-[#dd9933] transition-colors">{decodeHTML(carouselFiltered[carouselIndex].titleHtml)}</h2>
                                    <div className="flex items-center gap-4 text-[10px] text-gray-400 font-mono uppercase tracking-widest">
                                        <span className="flex items-center gap-1 font-bold text-[#dd9933]">{carouselFiltered[carouselIndex].authorName}</span>
                                        <span className="flex items-center gap-1"><Clock size={12}/> {new Date(carouselFiltered[carouselIndex].date).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-6">
                        {loadingMain ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-[#dd9933]" size={32}/></div> : (
                            mainFeed.map((post, idx) => (
                                <React.Fragment key={post.id}>
                                    <div onClick={() => onPostClick(post.id)} className="flex flex-col md:flex-row gap-5 border-b border-tech-800/50 pb-6 group cursor-pointer">
                                        <div className="w-full md:w-52 h-36 shrink-0 rounded-lg overflow-hidden border border-tech-800 group-hover:border-[#dd9933] transition-colors bg-black">
                                            <img src={post.featuredImage} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700" alt="" />
                                        </div>
                                        <div className="flex-1 flex flex-col justify-center min-w-0">
                                            <h3 className="text-xl font-bold text-gray-200 group-hover:text-[#dd9933] transition-colors leading-tight mb-2 uppercase tracking-tighter">{decodeHTML(post.titleHtml)}</h3>
                                            <div className="text-sm text-gray-400 line-clamp-2 mb-3 leading-relaxed font-medium">{post.excerptText}</div>
                                            <div className="flex items-center gap-3 text-[9px] text-gray-500 font-black uppercase tracking-widest">
                                                <span className="text-[#dd9933]">{post.authorName}</span><span>/</span><span>{new Date(post.date).toLocaleDateString('pt-BR')}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {(idx + 1) % 4 === 0 && <VipAdBlock index={idx} lang={language} />}
                                </React.Fragment>
                            ))
                        )}
                    </div>
                    {mainFeed.length > 0 && (
                        <div className="flex justify-between items-center mt-10 border-t border-tech-800 pt-6">
                            <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="text-xs font-black text-gray-500 hover:text-white disabled:opacity-30 uppercase tracking-[0.2em] flex items-center gap-2 px-4 py-2 border border-tech-800 rounded-lg transition-all">← PREV</button>
                            <span className="text-xs font-mono font-black text-[#dd9933]">PAGE {page}</span>
                            <button onClick={() => setPage(p => p + 1)} className="text-xs font-black text-gray-500 hover:text-white uppercase tracking-[0.2em] flex items-center gap-2 px-4 py-2 border border-tech-800 rounded-lg transition-all">NEXT →</button>
                        </div>
                    )}
                </div>

                {/* MINI BOLETIM (DIREITA) */}
                <div className="lg:col-span-3">
                    <div className="border-b-2 border-[#dd9933] pb-2 mb-4"><h3 className="text-gray-200 font-bold uppercase tracking-widest text-sm">{t.miniBulletins}</h3></div>
                    <div className="flex flex-col gap-4">
                        {bulletins.map(post => (
                        <div onClick={() => onPostClick(post.id)} key={post.id} className="group cursor-pointer bg-tech-900 border border-tech-800 hover:border-[#dd9933] p-3 rounded-lg shadow-lg transition-all hover:-translate-y-1">
                            <div className="h-24 w-full rounded overflow-hidden mb-3 border border-tech-950 bg-black">
                                <img src={post.featuredImage} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-500" alt="" />
                            </div>
                            <h4 className="text-gray-200 font-bold text-xs leading-snug group-hover:text-[#dd9933] transition-colors mb-2 uppercase tracking-tighter">{decodeHTML(post.titleHtml)}</h4>
                            <div className="flex items-center text-[8px] text-gray-500 font-black uppercase tracking-widest"><User size={10} className="mr-1" /> {post.authorName}</div>
                        </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default NewsFeed;
