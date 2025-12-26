
import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, ExternalLink, ShoppingCart, Calendar, User } from 'lucide-react';
import MagazineTicker from '../components/MagazineTicker';
import { fetchSinglePost, fetchMagazinePosts, fetchMagazineCategories, MagazinePost } from '../services/magazine';

interface PostViewProps {
  postId: number;
  onBack: () => void;
  onPostClick?: (id: number) => void;
}

const decodeHTML = (html: string): string => {
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
};

const AdSpace = ({ className = "" }: { className?: string }) => (
  <div className={`w-full bg-tech-950/50 border border-tech-800 border-dashed rounded flex flex-col items-center justify-center p-4 overflow-hidden ${className}`}>
      <span className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-2">Publicidade Google</span>
  </div>
);

const PostView: React.FC<PostViewProps> = ({ postId, onBack, onPostClick }) => {
  const [post, setPost] = useState<MagazinePost | null>(null);
  const [processedContent, setProcessedContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [readingTime, setReadingTime] = useState(0);
  
  const [carouselPosts, setCarouselPosts] = useState<MagazinePost[]>([]); 
  const [listPosts, setListPosts] = useState<MagazinePost[]>([]); 
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    if(post) {
        document.title = `${decodeHTML(post.titleHtml)} | Central Crypto`;
    }
    return () => { document.title = "Central Crypto | Terminal"; }
  }, [post]);

  useEffect(() => {
    const loadPost = async () => {
      try {
        setLoading(true);
        const data = await fetchSinglePost(postId);
        if (data) {
          setPost(data);
          
          let html = data.contentHtml || "";
          const ytIdFromUrl = (url: string) => {
            const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/);
            return match && match[1] ? match[1] : null;
          };

          html = html.replace(
            /<figure[^>]*wp-block-embed[^>]*>[\s\S]*?<div[^>]*wp-block-embed__wrapper[^>]*>(.*?)<\/div>[\s\S]*?<\/figure>/gi,
            (match, urlRaw) => {
              const videoId = ytIdFromUrl(urlRaw || '');
              if (!videoId) return match;
              return `<div class="yt-container"><iframe class="yt-embed" src="https://www.youtube-nocookie.com/embed/${videoId}?rel=0" frameborder="0" allowfullscreen></iframe></div>`;
            }
          );

          setProcessedContent(html);
          const words = stripHtmlTags(html).split(/\s+/).length;
          setReadingTime(Math.ceil(words / 200));
        }
      } catch (e) {
        console.error("Post load error", e);
      } finally {
        setLoading(false);
      }
    };
    loadPost();
  }, [postId]);

  function stripHtmlTags(str: string) { return str.replace(/<[^>]*>?/gm, ''); }

  useEffect(() => {
    const fetchSidebarData = async () => {
        try {
            const cats = await fetchMagazineCategories();
            const analisesId = cats.find(c => c.slug.includes('analise'))?.id;
            const noticiasId = cats.find(c => c.slug.includes('noticia'))?.id;

            const [resAnalises, resNoticias] = await Promise.all([
                fetchMagazinePosts({ perPage: 5, categories: analisesId }),
                fetchMagazinePosts({ perPage: 10, categories: noticiasId })
            ]);

            setCarouselPosts(resAnalises.posts.filter(p => p.id !== postId));
            setListPosts(resNoticias.posts.filter(p => p.id !== postId));
        } catch(e) {}
    };
    fetchSidebarData();
  }, [postId]);

  useEffect(() => {
    if (carouselPosts.length === 0) return;
    const interval = setInterval(() => { setCarouselIndex(prev => (prev + 1) % carouselPosts.length); }, 5000);
    return () => clearInterval(interval);
  }, [carouselPosts]);

  if (loading) return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-tech-950">
      <div className="w-16 h-16 border-4 border-[#dd9933] border-t-transparent rounded-full animate-spin mb-6"></div>
      <div className="text-xl font-mono text-[#dd9933] animate-pulse">CARREGANDO DADOS DA CENTRAL...</div>
    </div>
  );

  if (!post) return <div className="container mx-auto px-4 py-20 text-center min-h-screen"><h2 className="text-2xl text-tech-danger font-bold mb-4">Post não encontrado</h2><button onClick={onBack} className="text-white bg-tech-800 px-6 py-2 rounded">Voltar</button></div>;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 bg-tech-950 w-full transition-colors">
      <style>{`
        #wp-content { font-family: 'Inter', sans-serif; line-height: 1.75; }
        #wp-content .yt-container { width: 100%; position: relative; padding-bottom: 56.25%; height: 0; margin: 2rem 0; border-radius: 12px; overflow: hidden; background: #000; }
        #wp-content .yt-embed { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; }
        #wp-content h1, #wp-content h2, #wp-content h3 { color: #dd9933 !important; margin-top: 2rem; margin-bottom: 1rem; font-weight: 800; }
        .dark #wp-content p, .dark #wp-content li { color: #eee !important; }
        #wp-content img { border-radius: 12px; max-width: 100%; height: auto; margin: 2rem auto; display: block; }
      `}</style>

      <div className="relative w-full h-[50vh] min-h-[400px] border-b border-tech-800">
         <div className="absolute inset-0">
            <img src={post.featuredImage || 'https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png'} className="w-full h-full object-cover" alt="" />
            <div className="absolute inset-0 bg-gradient-to-t from-tech-950 via-tech-950/80 to-transparent"></div>
         </div>
         <div className="absolute top-0 left-0 p-8 z-50">
             <button onClick={onBack} className="flex items-center gap-2 text-gray-200 bg-black/50 hover:bg-tech-accent hover:text-black px-4 py-2 rounded-full backdrop-blur-md transition-all font-bold uppercase text-xs tracking-wider border border-white/10 shadow-lg">← Voltar</button>
         </div>
         <div className="absolute bottom-0 left-0 right-0 w-full px-8 pb-12 text-center">
               <div className="bg-tech-accent text-black font-black text-xs px-3 py-1 rounded-sm uppercase tracking-widest inline-block mb-6 transform -skew-x-12 shadow-lg">Postagem Oficial</div>
               <h1 className="text-3xl md:text-5xl lg:text-7xl font-black text-gray-200 leading-tight drop-shadow-2xl mb-8 max-w-5xl mx-auto">{decodeHTML(post.titleHtml)}</h1>
               <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-gray-300 font-mono bg-tech-900/60 backdrop-blur-sm p-4 rounded-lg border border-tech-700 w-fit mx-auto">
                  <div className="flex items-center gap-2"><User size={16} className="text-tech-accent"/><span className="font-bold text-gray-200 uppercase">{post.authorName}</span></div>
                  <div className="flex items-center gap-2"><Calendar size={16} className="text-tech-accent" /><span>{new Date(post.date).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
                  <div className="flex items-center gap-2"><BookOpen size={16} className="text-tech-accent" /><span>{readingTime} min</span></div>
               </div>
         </div>
      </div>

      <div className="container mx-auto px-4"><MagazineTicker onPostClick={(id) => onPostClick && onPostClick(id)} /></div>

      <div className="w-full px-4 md:px-8 mt-12 mb-20">
        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr_380px] gap-8 max-w-[2400px] mx-auto">
            <div className="hidden xl:flex flex-col gap-6 sticky top-40 h-fit">
                <div className="bg-tech-900 border border-tech-700 rounded-xl overflow-hidden shadow-2xl p-5 text-center">
                    <img src="https://centralcrypto.com.br/2/wp-content/uploads/2024/06/card-1-300x300.png" className="w-full rounded-lg mb-5" alt="Book"/>
                    <h4 className="text-tech-accent font-bold text-xl mb-3">O fim do SMC?</h4>
                    <a href="https://www.amazon.com/dp/B0FBK13SKH" target="_blank" rel="noreferrer" className="w-full bg-gray-200 text-black font-bold py-3 rounded block uppercase text-sm">Comprar Agora</a>
                </div>
                <AdSpace className="min-h-[250px]"/>
            </div>

            <div className="bg-tech-900 border border-tech-800 rounded-xl p-6 md:p-12 shadow-2xl relative overflow-hidden">
                <div id="wp-content" dangerouslySetInnerHTML={{__html: processedContent}} />
                <div className="my-8"><AdSpace className="min-h-[120px]" /></div>
            </div>

            <div className="flex flex-col gap-8 sticky top-40 h-fit">
                <div className="bg-tech-900 border border-tech-800 rounded-xl overflow-hidden shadow-xl">
                    <div className="bg-tech-950 p-3 border-b border-tech-800 font-bold text-tech-accent uppercase text-xs">Análises</div>
                    <div className="relative h-72 group cursor-pointer" onClick={() => carouselPosts[carouselIndex] && onPostClick && onPostClick(carouselPosts[carouselIndex].id)}>
                         {carouselPosts.length > 0 ? (
                            <>
                                <img src={carouselPosts[carouselIndex].featuredImage} className="w-full h-full object-cover" alt=""/>
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                                <div className="absolute bottom-0 p-5"><h5 className="text-white font-bold text-base line-clamp-3">{decodeHTML(carouselPosts[carouselIndex].titleHtml)}</h5></div>
                                <button onClick={(e) => { e.stopPropagation(); setCarouselIndex((i) => (i - 1 + carouselPosts.length) % carouselPosts.length)}} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"><ChevronLeft size={16}/></button>
                                <button onClick={(e) => { e.stopPropagation(); setCarouselIndex((i) => (i + 1) % carouselPosts.length)}} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"><ChevronRight size={16}/></button>
                            </>
                         ) : <div className="p-10 text-center text-xs text-gray-500">Buscando conteúdo...</div>}
                    </div>
                </div>
                <AdSpace className="min-h-[250px]"/>
                <div className="bg-tech-900 border border-tech-800 rounded-xl overflow-hidden shadow-xl">
                     <div className="bg-tech-950 p-3 border-b border-tech-800 font-bold text-gray-200 uppercase text-xs">Leia Também</div>
                     <div className="flex flex-col">
                         {listPosts.slice(0, 5).map(p => (
                             <div key={p.id} onClick={() => onPostClick && onPostClick(p.id)} className="flex gap-4 p-4 border-b border-tech-800 hover:bg-tech-800/50 cursor-pointer group">
                                 <img src={p.featuredImage} className="w-16 h-16 object-cover rounded border border-tech-700" alt=""/>
                                 <h5 className="text-gray-300 font-bold text-sm line-clamp-2 group-hover:text-tech-accent">{decodeHTML(p.titleHtml)}</h5>
                             </div>
                         ))}
                     </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PostView;
