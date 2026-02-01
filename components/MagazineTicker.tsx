
import React, { useState, useEffect } from 'react';
import { fetchMagazinePosts, fetchMagazineCategories, MagazinePost } from '../services/magazine';

interface MagazineTickerProps {
  onPostClick: (id: number) => void;
}

const MagazineTicker: React.FC<MagazineTickerProps> = ({ onPostClick }) => {
  const [posts, setPosts] = useState<MagazinePost[]>([]);
  const [loading, setLoading] = useState(true);
  
  // EXCLUDE IDs 7 (Infografico) and 17 (Podcast)
  const EXCLUDED_CATS = '7,17';

  useEffect(() => {
    const fetchTickerPosts = async () => {
      try {
        setLoading(true);
        const cats = await fetchMagazineCategories();
        const analisesCat = cats.find((c: any) => c.slug.includes('analise'));
        
        // Tenta buscar analises primeiro, with exclusion
        const data = await fetchMagazinePosts({ 
            categories: analisesCat?.id || '', 
            perPage: 15,
            categoriesExclude: EXCLUDED_CATS
        });
        
        if (data.posts && data.posts.length > 0) {
          setPosts(data.posts);
        } else {
            // Fallback para os últimos posts gerais caso não haja análises específicas, with exclusion
            const latest = await fetchMagazinePosts({ perPage: 15, categoriesExclude: EXCLUDED_CATS });
            setPosts(latest.posts || []);
        }
      } catch (e) {
        console.error("Ticker fetch error:", e);
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTickerPosts();
  }, []);

  const decodeHTML = (html: string) => {
    if (!html) return '';
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (loading) {
    return (
        <div className="w-full h-16 my-4 bg-gray-200/20 dark:bg-tech-900/20 rounded-xl animate-pulse flex items-center justify-center">
            <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Sincronizando Magazine...</span>
        </div>
    );
  }

  if (!posts || posts.length === 0) return null;

  // Quadruplicar posts para garantir o loop infinito 360 fluido sem espaços
  const tickerItems = [...posts, ...posts, ...posts, ...posts];

  return (
    <div className="w-full my-4 overflow-hidden relative group py-2 bg-gray-200/40 dark:bg-white/5 shadow-inner rounded-xl transition-all duration-700">
      <div className="flex animate-magazine-scroll group-hover:[animation-play-state:paused] w-max">
        {tickerItems.map((post, idx) => (
          <div 
            key={`${post.id}-${idx}`} 
            onClick={() => onPostClick(post.id)} 
            className="flex items-center gap-4 shrink-0 w-[350px] cursor-pointer group/tickeritem p-2 hover:bg-tech-accent/10 rounded-xl transition-all mx-3"
          >
            <div className="relative shrink-0">
                <img 
                  src={post.featuredImage || 'https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png'} 
                  alt="" 
                  className="w-14 h-14 object-cover rounded-lg border-2 border-transparent group-hover/tickeritem:border-tech-accent transition-all shadow-md bg-tech-800" 
                />
            </div>
            <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-tech-accent group-hover/tickeritem:text-white line-clamp-2 leading-tight uppercase tracking-tight transition-colors">
                  {decodeHTML(post.titleHtml)}
                </span>
                <div className="flex items-center gap-2 mt-1 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    <span>{post.authorName || "Central Crypto"}</span>
                    <span className="opacity-50">•</span>
                    <span className="text-gray-500">{formatDate(post.date)}</span>
                </div>
            </div>
          </div>
        ))}
      </div>
       {/* Máscaras laterais para fade suave */}
       <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#eeeeee] dark:from-tech-950 to-transparent z-10 pointer-events-none"></div>
       <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#eeeeee] dark:from-tech-950 to-transparent z-10 pointer-events-none"></div>
    </div>
  );
};

export default MagazineTicker;
