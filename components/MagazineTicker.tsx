
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
            categories: analisesCat?.id, 
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
    return <div className="h-16 bg-tech-900/50 rounded animate-pulse my-2"></div>;
  }

  if (!posts || posts.length === 0) return null;

  // Renderiza três vezes para garantir que o loop cubra toda a largura da tela sem lacunas
  const TickerSet = () => (
    <>
      {posts.map(post => (
        <div 
          key={`${post.id}-${Math.random()}`} 
          onClick={() => onPostClick(post.id)} 
          className="flex items-center gap-3 shrink-0 w-80 cursor-pointer group/tickeritem p-1 hover:bg-tech-accent/10 rounded-lg transition-colors mx-4"
        >
          <img 
            src={post.featuredImage || 'https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png'} 
            alt="" 
            className="w-12 h-12 object-cover rounded-md border border-tech-800 group-hover/tickeritem:border-tech-accent transition-colors shadow-sm" 
          />
          <span className="text-sm font-black text-gray-400 group-hover/tickeritem:text-tech-accent line-clamp-2 leading-tight uppercase tracking-tight">
            {decodeHTML(post.titleHtml)}
          </span>
        </div>
      ))}
    </>
  );

  return (
    <div className="w-full my-4 overflow-hidden relative group py-2 border-y border-tech-800/30">
      <div className="flex animate-magazine-scroll group-hover:[animation-play-state:paused] w-max">
        <TickerSet />
        <TickerSet />
        <TickerSet />
      </div>
       <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-tech-950 to-transparent z-10 pointer-events-none"></div>
       <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-tech-950 to-transparent z-10 pointer-events-none"></div>
    </div>
  );
};

export default MagazineTicker;
