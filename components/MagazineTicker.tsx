
import React, { useState, useEffect } from 'react';
import { fetchMagazinePosts, fetchMagazineCategories, MagazinePost } from '../services/magazine';

interface MagazineTickerProps {
  onPostClick: (id: number) => void;
}

const MagazineTicker: React.FC<MagazineTickerProps> = ({ onPostClick }) => {
  const [posts, setPosts] = useState<MagazinePost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTickerPosts = async () => {
      try {
        setLoading(true);
        const cats = await fetchMagazineCategories();
        const analisesCat = cats.find((c: any) => c.slug.includes('analise'));
        const data = await fetchMagazinePosts({ 
            categories: analisesCat?.id || '', 
            perPage: 15 
        });
        
        if (data.posts.length > 0) {
          setPosts(data.posts);
        } else {
            const latest = await fetchMagazinePosts({ perPage: 15 });
            setPosts(latest.posts);
        }
      } catch (e) {
        console.error("Ticker fetch error:", e);
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

  if (loading) {
    return (
        <div className="w-full h-20 my-6 bg-gray-200/20 dark:bg-tech-900/20 rounded-xl animate-pulse flex items-center justify-center">
            <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Sincronizando Magazine...</span>
        </div>
    );
  }

  if (!posts || posts.length === 0) return null;

  // Duplicar posts para garantir o loop 360 fluido
  const tickerItems = [...posts, ...posts, ...posts];

  return (
    <div className="w-full my-6 overflow-hidden relative group py-5 bg-gray-200/40 dark:bg-white/5 shadow-inner rounded-xl transition-all duration-700">
      <div className="flex animate-magazine-scroll group-hover:[animation-play-state:paused] w-max">
        {tickerItems.map((post, idx) => (
          <div 
            key={`${post.id}-${idx}`} 
            onClick={() => onPostClick(post.id)} 
            className="flex items-center gap-4 shrink-0 w-80 cursor-pointer group/tickeritem p-2 hover:bg-tech-accent/10 rounded-xl transition-all mx-5"
          >
            <div className="relative shrink-0">
                <img 
                  src={post.featuredImage || 'https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png'} 
                  alt="" 
                  className="w-14 h-14 object-cover rounded-lg border-2 border-transparent group-hover/tickeritem:border-tech-accent transition-all shadow-md" 
                />
            </div>
            <span className="text-sm font-black text-gray-600 dark:text-gray-300 group-hover/tickeritem:text-tech-accent line-clamp-2 leading-tight uppercase tracking-tight transition-colors">
              {decodeHTML(post.titleHtml)}
            </span>
          </div>
        ))}
      </div>
       <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#eeeeee] dark:from-tech-950 to-transparent z-10 pointer-events-none"></div>
       <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#eeeeee] dark:from-tech-950 to-transparent z-10 pointer-events-none"></div>
    </div>
  );
};

export default MagazineTicker;
