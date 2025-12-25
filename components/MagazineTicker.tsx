
import React, { useState, useEffect } from 'react';
import { WPPost } from '../types';
import { fetchWithFallback } from '../pages/Workspace/services/api';

interface MagazineTickerProps {
  onPostClick: (id: number) => void;
}

const MagazineTicker: React.FC<MagazineTickerProps> = ({ onPostClick }) => {
  const [posts, setPosts] = useState<WPPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTickerPosts = async () => {
      setLoading(true);
      try {
        const cats = await fetchWithFallback('https://centralcrypto.com.br/2/wp-json/wp/v2/categories?per_page=100');
        if (!cats || !Array.isArray(cats)) {
            setLoading(false);
            return;
        }

        const analisesCat = cats.find((c: any) => c.slug.includes('analise') || c.slug.includes('análise'));

        if (analisesCat) {
          const analisesId = analisesCat.id;
          const postsData = await fetchWithFallback(`https://centralcrypto.com.br/2/wp-json/wp/v2/posts?_embed&categories=${analisesId}&per_page=10`);
          if (postsData && Array.isArray(postsData)) {
            setPosts(postsData);
          }
        }
      } catch (e) {
        console.error("Failed to fetch ticker posts", e);
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

  const getImageUrl = (post: WPPost) => {
    return post._embedded?.['wp:featuredmedia']?.[0]?.source_url || 'https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png';
  };

  if (loading) {
    return <div className="h-16 bg-tech-900/50 rounded animate-pulse my-2"></div>;
  }

  if (!posts || posts.length === 0) {
    return null;
  }

  const TickerContent = () => (
    <>
      {posts.map(post => (
        <div 
          key={post.id} 
          onClick={() => onPostClick(post.id)} 
          className="flex items-center gap-3 shrink-0 w-80 cursor-pointer group/tickeritem p-1 hover:bg-tech-accent/10 light-mode:hover:bg-tech-accent/10 rounded-lg transition-colors"
        >
          <img 
            src={getImageUrl(post)} 
            alt={decodeHTML(post.title?.rendered)} 
            className="w-12 h-12 object-cover rounded-md border border-tech-800 group-hover/tickeritem:border-tech-accent transition-colors" 
          />
          <span className="text-base font-bold text-gray-300 light-mode:text-tech-950 group-hover/tickeritem:text-tech-accent light-mode:group-hover/tickeritem:text-tech-accent line-clamp-2 leading-tight">
            {decodeHTML(post.title?.rendered)}
          </span>
        </div>
      ))}
    </>
  );

  return (
    <div className="w-full my-2 overflow-hidden relative group">
      <div className="flex animate-magazine-scroll group-hover:[animation-play-state:paused] w-max">
        <div className="flex items-center gap-4 pr-4"><TickerContent /></div>
        <div className="flex items-center gap-4 pr-4"><TickerContent /></div>
      </div>
       <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-tech-950 to-transparent z-10 pointer-events-none"></div>
       <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-tech-950 to-transparent z-10 pointer-events-none"></div>
    </div>
  );
};

export default MagazineTicker;
