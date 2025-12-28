
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
        const data = await fetchMagazinePosts({ categories: analisesCat?.id || '', perPage: 15 });
        if (data.posts && data.posts.length > 0) setPosts(data.posts);
        else {
            const latest = await fetchMagazinePosts({ perPage: 15 });
            setPosts(latest.posts || []);
        }
      } catch (e) { setPosts([]); } 
      finally { setLoading(false); }
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
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (loading) return <div className="w-full h-16 my-4 bg-gray-200/20 dark:bg-tech-900/20 rounded-xl animate-pulse flex items-center justify-center"></div>;
  if (!posts || posts.length === 0) return null;

  const tickerItems = [...posts, ...posts, ...posts, ...posts];

  return (
    <div className="w-full my-4 overflow-hidden relative group py-2 bg-gray-200/40 dark:bg-white/5 shadow-inner rounded-xl transition-all duration-700">
      <div className="flex animate-magazine-scroll group-hover:[animation-play-state:paused] w-max">
        {tickerItems.map((post, idx) => (
          <div 
            key={`${post.id}-${idx}`} 
            onClick={() => onPostClick(post.id)} 
            className="flex items-center gap-4 shrink-0 w-[400px] cursor-pointer group/tickeritem p-2 hover:bg-[#dd9933]/5 rounded-xl transition-all mx-4"
          >
            <div className="relative shrink-0">
                <img 
                  src={post.featuredImage} 
                  alt="" 
                  className="w-16 h-16 object-cover rounded-lg border-2 border-transparent group-hover/tickeritem:border-[#dd9933] transition-all shadow-md bg-tech-800" 
                />
            </div>
            <div className="flex flex-col min-w-0">
                <span className="text-base font-bold text-[#dd9933] group-hover/tickeritem:text-white line-clamp-2 leading-tight uppercase tracking-tight transition-colors">
                  {decodeHTML(post.titleHtml)}
                </span>
                <div className="flex items-center gap-2 mt-1 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest opacity-80">
                    <span className="group-hover/tickeritem:text-tech-accent transition-colors">{post.authorName}</span>
                    <span className="opacity-40">•</span>
                    <span className="font-mono text-gray-400 dark:text-gray-500">{formatDate(post.date)}</span>
                </div>
            </div>
          </div>
        ))}
      </div>
       <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#eeeeee] dark:from-tech-950 to-transparent z-10 pointer-events-none"></div>
       <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#eeeeee] dark:from-tech-950 to-transparent z-10 pointer-events-none"></div>
    </div>
  );
};

export default MagazineTicker;
