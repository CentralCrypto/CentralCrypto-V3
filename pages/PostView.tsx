import React, { useEffect, useState } from 'react';
import { ArrowLeft, Clock, User, Calendar, BookOpen, ChevronLeft, ChevronRight, ExternalLink, ShoppingCart } from 'lucide-react';
import MagazineTicker from '../components/MagazineTicker';

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

const getImageUrl = (post: any) => {
  return post._embedded?.['wp:featuredmedia']?.[0]?.source_url || 'https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png';
};

// --- ADSPACE COMPONENT ---
const AdSpace = ({ className = "" }: { className?: string }) => (
  <div className={`w-full bg-tech-950/50 border border-tech-800 border-dashed rounded flex flex-col items-center justify-center p-4 overflow-hidden ${className}`}>
      <span className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-2">Publicidade Google</span>
      {/* 
         COLE SEU CÓDIGO DO ADSENSE AQUI EMBAIXO:
         Substitua este comentário pelo bloco <ins> do Google.
      */}
  </div>
);

const PostView: React.FC<PostViewProps> = ({ postId, onBack, onPostClick }) => {
  const [post, setPost] = useState<any>(null);
  const [processedContent, setProcessedContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [readingTime, setReadingTime] = useState(0);
  
  // Sidebar Data
  const [carouselPosts, setCarouselPosts] = useState<any[]>([]); 
  const [listPosts, setListPosts] = useState<any[]>([]); 
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Update SEO Meta tags when post loads
  useEffect(() => {
    if(post && post.title) {
        document.title = `${decodeHTML(post.title.rendered)} | Central Crypto`;
        const metaDesc = document.querySelector('meta[name="description"]');
        if(metaDesc) {
            metaDesc.setAttribute('content', post.excerpt.rendered.replace(/<[^>]+>/g, '').slice(0, 160));
        }
    }
    return () => {
        document.title = "Central Crypto | Terminal";
    }
  }, [post]);

  // Execute Adsense Push on Load
  useEffect(() => {
     try {
       // @ts-ignore
       if (window.adsbygoogle) {
         // @ts-ignore
         (window.adsbygoogle = window.adsbygoogle || []).push({});
       }
     } catch (e) {}
  }, [post]);

  // Fetch Current Post
  useEffect(() => {
    const fetchPost = async () => {
      try {
        setLoading(true);
        const res = await fetch(`https://centralcrypto.com.br/2/wp-json/wp/v2/posts/${postId}?_embed`);
        if (res.ok) {
          const data = await res.json();
          setPost(data);
          
                    // ========================================
          // PROCESSA CONTEÚDO DO WP -> EMBED YOUTUBE
          // ========================================
          const rawHtml = data.content.rendered;

          // Regex pra pegar ID do vídeo a partir de URL do YouTube
          const ytIdFromUrl = (url: string) => {
            const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/);
            return match && match[1] ? match[1] : null;
          };

          let html = rawHtml;

          // 1) Figura padrão do WP: <figure ...><div class="wp-block-embed__wrapper">URL</div>...</figure>
          html = html.replace(
            /<figure[^>]*wp-block-embed[^>]*>[\s\S]*?<div[^>]*wp-block-embed__wrapper[^>]*>(.*?)<\/div>[\s\S]*?<\/figure>/gi,
            (match, urlRaw) => {
              const url = (urlRaw || '').trim();
              const videoId = ytIdFromUrl(url);
              if (!videoId) return match; // se não achar ID, deixa como estava

              return `
                <div class="yt-container">
                  <iframe
                    class="yt-embed"
                    src="https://www.youtube-nocookie.com/embed/${videoId}?rel=0"
                    title="YouTube video player"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen
                    referrerpolicy="strict-origin-when-cross-origin"
                  ></iframe>
                </div>
              `;
            }
          );

          // 2) Iframes de YouTube já existentes no HTML
          html = html.replace(
            /<iframe([^>]*)src="([^"]*youtube[^"]+)"([^>]*)><\/iframe>/gi,
            (_match, before, src, after) => {
              const videoId = ytIdFromUrl(src) || '';
              const finalSrc = videoId
                ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`
                : src;

              return `
                <div class="yt-container">
                  <iframe
                    class="yt-embed"
                    src="${finalSrc}"
                    title="YouTube video player"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen
                    referrerpolicy="strict-origin-when-cross-origin"
                  ></iframe>
                </div>
              `;
            }
          );

          setProcessedContent(html);
          // ========================================
          // FIM DO PROCESSAMENTO DO CONTEÚDO
          // ========================================

          const text = data.content.rendered.replace(/<[^>]+>/g, '');
          const words = text.split(/\s+/).length;
          const time = Math.ceil(words / 200); 
          setReadingTime(time);
        }
      } catch (e) {
        console.error("Failed to load post", e);
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [postId]);

  // Fetch Sidebar Data
  useEffect(() => {
    const fetchSidebarData = async () => {
        try {
            const catRes = await fetch('https://centralcrypto.com.br/2/wp-json/wp/v2/categories?per_page=100');
            const cats = await catRes.json();
            
            let analisesId, noticiasId;
            if (Array.isArray(cats)) {
                analisesId = cats.find((c:any) => c.name.toLowerCase().includes('análises') || c.slug.includes('analise'))?.id;
                noticiasId = cats.find((c:any) => c.name.toLowerCase().includes('notícias do dia') || c.slug.includes('noticias-do-dia'))?.id;
            }

            let urlAnalises = `https://centralcrypto.com.br/2/wp-json/wp/v2/posts?per_page=5&_embed&exclude=${postId}`;
            if (analisesId) urlAnalises += `&categories=${analisesId}`;
            
            let urlNoticias = `https://centralcrypto.com.br/2/wp-json/wp/v2/posts?per_page=10&_embed&exclude=${postId}`;
            if (noticiasId) urlNoticias += `&categories=${noticiasId}`;

            const [resAnalises, resNoticias] = await Promise.all([
                fetch(urlAnalises),
                fetch(urlNoticias)
            ]);

            if (resAnalises.ok) setCarouselPosts(await resAnalises.json());
            if (resNoticias.ok) setListPosts(await resNoticias.json());

        } catch(e) { console.error("Sidebar fetch error", e); }
    };
    fetchSidebarData();
  }, [postId]);

  // Carousel Auto-play
  useEffect(() => {
    if (carouselPosts.length === 0) return;
    const interval = setInterval(() => {
        setCarouselIndex(prev => (prev + 1) % carouselPosts.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [carouselPosts]);

  if (loading) return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-tech-950 transition-colors">
      <div className="w-16 h-16 border-4 border-[#dd9933] border-t-transparent rounded-full animate-spin mb-6"></div>
      <div className="text-xl font-mono text-[#dd9933] animate-pulse">CARREGANDO DADOS DA CENTRAL...</div>
    </div>
  );

  if (!post) return (
     <div className="container mx-auto px-4 py-20 text-center bg-tech-950 min-h-screen">
        <h2 className="text-2xl text-tech-danger font-bold mb-4">Erro ao carregar postagem</h2>
        <button onClick={onBack} className="text-white bg-tech-800 px-6 py-2 rounded">Voltar</button>
     </div>
  );

  const img = getImageUrl(post);
  const author = post._embedded?.['author']?.[0]?.name || 'Central Crypto';
  
  const handleSidebarClick = (id: number) => {
     if(onPostClick) onPostClick(id);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 bg-tech-950 w-full transition-colors">
      
      {/* AGGRESSIVE CSS RESET FOR WP CONTENT */}
      <style>{`
        /* Container Base */
        #wp-content {
          font-family: 'Inter', sans-serif;
          line-height: 1.75;
          word-wrap: break-word;
        }
        
        #wp-content figure, 
        #wp-content .wp-block-embed,
        #wp-content .wp-block-embed-youtube {
           width: 100% !important;
           max-width: 100% !important;
           margin: 2.5rem 0 !important;
        }

        #wp-content .yt-container {
          width: 100% !important;
          max-width: 100% !important;
          margin: 2.5rem 0 !important;
          position: relative !important;
          padding-bottom: 56.25% !important;
          height: 0 !important;
          border-radius: 0.75rem !important;
          overflow: hidden !important;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6) !important;
          background-color: #000 !important;
          border: 1px solid #334155 !important;
        }

        #wp-content .yt-container .yt-embed {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          border: 0 !important;
          display: block !important;
        }


        /* LIGHT MODE (DEFAULT) */
        #wp-content p, #wp-content span, #wp-content div, #wp-content li, #wp-content td, #wp-content th {
          font-size: 16px !important;
          color: #1a1c1e !important;
          background-color: transparent !important;
        }
        #wp-content h1, #wp-content h2, #wp-content h3, #wp-content h4, #wp-content h5, #wp-content h6 {
          color: #2f3032 !important;
          font-weight: 700 !important;
          margin-top: 2rem !important;
          margin-bottom: 1rem !important;
          line-height: 1.3 !important;
          background-color: transparent !important;
        }

        /* DARK MODE OVERRIDES */
        .dark #wp-content p, .dark #wp-content span, .dark #wp-content div, .dark #wp-content li, .dark #wp-content td, .dark #wp-content th {
          color: #FFFFFF !important;
        }
        .dark #wp-content h1, .dark #wp-content h2, .dark #wp-content h3, .dark #wp-content h4, .dark #wp-content h5, .dark #wp-content h6 {
          color: #dd9933 !important;
        }
        
        #wp-content h1 { font-size: 2.2rem !important; }
        #wp-content h2 { font-size: 1.8rem !important; }
        #wp-content h3 { font-size: 1.5rem !important; }
        #wp-content h4 { font-size: 1.25rem !important; }
        #wp-content h5 { font-size: 1.1rem !important; }
        #wp-content h6 { font-size: 1rem !important; text-transform: uppercase !important; }

        #wp-content a:not(.group) {
          color: #dd9933 !important;
          text-decoration: none !important;
          font-weight: 600 !important;
          border-bottom: 1px dotted #dd9933;
        }
        .dark #wp-content a:not(.group):hover { color: #fff !important; border-bottom-style: solid; }
        #wp-content a:not(.group):hover { color: #000 !important; border-bottom-style: solid; }

        #wp-content strong, #wp-content b { color: #dd9933 !important; font-weight: 800 !important; }

        #wp-content table {
          width: 100% !important; border-collapse: collapse !important; margin: 2rem 0 !important; background-color: transparent !important; border: none !important; box-shadow: none !important;
        }
        #wp-content thead, #wp-content tbody, #wp-content tfoot, #wp-content tr, #wp-content th, #wp-content td {
          background-color: transparent !important; border: none !important;
        }
        #wp-content th {
          color: #dd9933 !important; font-weight: 700 !important; text-transform: uppercase !important; font-size: 0.85rem !important; letter-spacing: 0.05em !important; padding: 0.5rem 1rem !important; text-align: left !important; border-bottom: 1px solid #334155 !important;
        }
        #wp-content td { padding: 0.75rem 1rem !important; vertical-align: top !important; }

        #wp-content ul, #wp-content ol { margin: 1.5rem 0 !important; padding-left: 1.5rem !important; }
        #wp-content li { margin-bottom: 0.5rem !important; }
        #wp-content ul { list-style-type: disc !important; }
        #wp-content ol { list-style-type: decimal !important; }
        
        #wp-content li::marker { color: #dd9933 !important; }

        #wp-content img { border-radius: 0.5rem !important; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3) !important; max-width: 100% !important; height: auto !important; margin: 2rem auto !important; display: block !important; }
        
        #wp-content figcaption { text-align: center !important; font-size: 0.8rem !important; color: #64748b !important; margin-top: 0.5rem !important; }
      `}</style>

      {/* HERO HEADER */}
      <div className="relative w-full h-[50vh] min-h-[400px] border-b border-tech-800">
         <div className="absolute inset-0">
            {img && <img src={img} className="w-full h-full object-cover" alt="" />}
            <div className="absolute inset-0 bg-gradient-to-t from-tech-950 via-tech-950/80 to-transparent"></div>
         </div>
         
         <div className="absolute top-0 left-0 p-8 z-50">
             <button onClick={onBack} className="flex items-center gap-2 text-gray-200 bg-black/50 hover:bg-tech-accent hover:text-black px-4 py-2 rounded-full backdrop-blur-md transition-all font-bold uppercase text-xs tracking-wider border border-white/10 shadow-lg">
                <ArrowLeft size={16} /> Voltar para Dashboard
             </button>
         </div>

         <div className="absolute bottom-0 left-0 right-0 w-full px-8 pb-12">
            <div className="max-w-[1920px] mx-auto text-center">
               <div className="flex flex-wrap justify-center gap-2 mb-6">
                 <div className="bg-tech-accent text-black font-black text-xs px-3 py-1 rounded-sm uppercase tracking-widest shadow-lg transform -skew-x-12">
                    Postagem Oficial
                 </div>
                 <div className="bg-tech-800 text-gray-300 font-bold text-xs px-3 py-1 rounded-sm uppercase tracking-widest border border-tech-600 flex items-center gap-2">
                    <BookOpen size={12} className="text-tech-accent"/> {readingTime} min de leitura
                 </div>
               </div>

               <h1 className="text-3xl md:text-5xl lg:text-7xl font-black text-gray-200 leading-tight drop-shadow-2xl mb-8 max-w-5xl mx-auto transition-colors">
                  <span dangerouslySetInnerHTML={{__html: post.title.rendered}} />
               </h1>
               
               <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-gray-300 font-mono bg-tech-900/60 backdrop-blur-sm p-4 rounded-lg border border-tech-700 w-fit mx-auto transition-colors">
                  <div className="flex items-center gap-2">
                     <div className="w-8 h-8 rounded-full bg-tech-800 flex items-center justify-center border border-tech-accent text-tech-accent overflow-hidden">
                        <User size={16} />
                     </div>
                     <span className="font-bold text-gray-200 uppercase">{author}</span>
                  </div>
                  <div className="w-px h-4 bg-tech-600"></div>
                  <div className="flex items-center gap-2">
                     <Calendar size={16} className="text-tech-accent" />
                     <span className="text-gray-300">{new Date(post.date).toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
               </div>
            </div>
         </div>
      </div>
      
      {/* MAGAZINE TICKER */}
      <div className="container mx-auto px-4">
        <MagazineTicker onPostClick={handleSidebarClick} />
      </div>


      {/* MAIN LAYOUT GRID */}
      <div className="w-full px-4 md:px-8 mt-12 mb-20">
        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr_380px] gap-8 max-w-[2400px] mx-auto">
            
            {/* LEFT SIDEBAR: ADS & BOOK */}
            <div className="hidden xl:flex flex-col gap-6 order-2 xl:order-1">
                <div className="sticky top-40 w-full flex flex-col gap-6">
                    {/* BOOK AD */}
                    <div className="bg-tech-900 border border-tech-700 rounded-xl overflow-hidden shadow-2xl group hover:border-tech-accent transition-colors w-full">
                        <div className="bg-tech-accent text-black text-center font-black text-xs py-1 uppercase tracking-widest">Recomendado</div>
                        <div className="p-5 flex flex-col items-center text-center">
                            <img 
                                src="https://centralcrypto.com.br/2/wp-content/uploads/2024/06/card-1-300x300.png" 
                                alt="Book Ad" 
                                className="w-full h-auto rounded-lg shadow-lg mb-5 transform group-hover:scale-105 transition-transform duration-500"
                            />
                            <h4 className="text-tech-accent font-bold text-xl leading-tight mb-3">O fim do SMC?</h4>
                            <p className="text-gray-400 text-sm mb-5 leading-relaxed">Descubra a nova metodologia que está mudando o jogo.</p>
                            <a 
                                href="https://www.amazon.com/dp/B0FBK13SKH" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="w-full bg-gray-200 hover:bg-white text-black font-bold py-3 rounded flex items-center justify-center gap-2 transition-colors text-sm uppercase"
                            >
                                <ShoppingCart size={16}/> Comprar Agora
                            </a>
                        </div>
                    </div>
                    
                    {/* ADS SLOT 1 */}
                    <AdSpace className="min-h-[250px]"/>
                </div>
            </div>

            {/* CENTER CONTENT */}
            <div className="order-1 xl:order-2">
                <div className="bg-tech-900 border border-tech-800 rounded-xl p-6 md:p-12 shadow-2xl relative w-full overflow-hidden transition-colors">
                    <div 
                        id="wp-content"
                        className="w-full"
                        dangerouslySetInnerHTML={{__html: processedContent}} 
                    />
                    
                    {/* ADS IN CONTENT */}
                    <div className="my-8">
                       <AdSpace className="min-h-[120px]" />
                    </div>

                    <div className="mt-12 pt-8 border-t border-tech-700 flex flex-wrap gap-2">
                        <span className="text-xs font-bold text-gray-500 uppercase mr-2 mt-1">Tags:</span>
                        {post._embedded?.['wp:term']?.[1]?.map((tag: any) => (
                             <span key={tag.id} className="text-xs bg-tech-950 text-gray-400 px-2 py-1 rounded border border-tech-700 hover:border-tech-accent hover:text-tech-accent cursor-pointer transition-colors">#{tag.name}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* RIGHT SIDEBAR: WIDGETS */}
            <div className="flex flex-col gap-8 order-3 xl:order-3 w-full">
                <div className="sticky top-40 flex flex-col gap-8 w-full">
                    
                    {/* WIDGET 1: CAROUSEL NOVIDADES */}
                    <div className="bg-tech-900 border border-tech-800 rounded-xl overflow-hidden shadow-xl w-full transition-colors">
                        <div className="bg-tech-950 p-3 border-b border-tech-800 flex justify-between items-center transition-colors">
                            <h4 className="font-bold text-tech-accent uppercase text-xs tracking-wider">Análises</h4>
                            <div className="flex gap-1">
                                {carouselPosts.slice(0,3).map((_: any, i: number) => (
                                    <div key={i} className="w-2 h-2 rounded-full bg-tech-700 data-[active=true]:bg-tech-accent" data-active={carouselIndex===i}></div>
                                ))}
                            </div>
                        </div>
                        <div className="relative h-72 group cursor-pointer" onClick={() => carouselPosts[carouselIndex] && handleSidebarClick(carouselPosts[carouselIndex].id)}>
                             {carouselPosts.length > 0 ? (
                                <>
                                    <img 
                                        src={getImageUrl(carouselPosts[carouselIndex])} 
                                        className="w-full h-full object-cover transition-all duration-500" 
                                        alt=""
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                                    <div className="absolute bottom-0 left-0 right-0 p-5">
                                        <div className="text-[10px] text-tech-accent font-bold uppercase mb-2 bg-black/50 backdrop-blur w-fit px-2 py-1 rounded">Novidade</div>
                                        <h5 className="text-white font-bold text-base leading-tight line-clamp-3 drop-shadow-md">
                                            {decodeHTML(carouselPosts[carouselIndex].title.rendered)}
                                        </h5>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setCarouselIndex((i) => (i - 1 + carouselPosts.length) % carouselPosts.length)}}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-tech-accent opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <ChevronLeft size={16}/>
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setCarouselIndex((i) => (i + 1) % carouselPosts.length)}}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-tech-accent opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <ChevronRight size={16}/>
                                    </button>
                                </>
                             ) : <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">Carregando Análises...</div>}
                        </div>
                    </div>

                    {/* ADS SLOT 2 */}
                    <AdSpace className="min-h-[250px]"/>

                    {/* WIDGET 2: LISTA LEIA TAMBÉM */}
                    <div className="bg-tech-900 border border-tech-800 rounded-xl overflow-hidden shadow-xl w-full transition-colors">
                         <div className="bg-tech-950 p-3 border-b border-tech-800 transition-colors">
                            <h4 className="font-bold text-gray-200 uppercase text-xs tracking-wider">Leia Também</h4>
                         </div>
                         <div className="flex flex-col">
                             {listPosts.length > 0 ? listPosts.map((p: any) => (
                                 <div 
                                    key={p.id} 
                                    onClick={() => handleSidebarClick(p.id)}
                                    className="flex gap-4 p-4 border-b border-tech-800 hover:bg-tech-800/50 cursor-pointer transition-colors group"
                                >
                                     <div className="w-20 h-20 shrink-0 rounded bg-tech-950 overflow-hidden border border-tech-700 group-hover:border-tech-accent">
                                        <img src={getImageUrl(p)} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt=""/>
                                     </div>
                                     <div className="flex flex-col justify-center">
                                         <h5 className="text-gray-300 font-bold text-sm leading-snug group-hover:text-tech-accent transition-colors line-clamp-2 mb-2">
                                             {decodeHTML(p.title.rendered)}
                                         </h5>
                                         <span className="text-[10px] text-gray-600 font-mono">{new Date(p.date).toLocaleDateString('pt-BR')}</span>
                                     </div>
                                 </div>
                             )) : (
                                <div className="p-4 text-center text-xs text-gray-500">Carregando notícias...</div>
                             )}
                         </div>
                         <div className="p-3 bg-tech-950 border-t border-tech-800 text-center transition-colors">
                             <button className="text-[10px] font-bold text-tech-accent hover:text-white uppercase flex items-center justify-center gap-1 w-full">
                                Ver mais notícias <ExternalLink size={10}/>
                             </button>
                         </div>
                    </div>

                </div>
            </div>

        </div>
      </div>

    </div>
  );
};

export default PostView;