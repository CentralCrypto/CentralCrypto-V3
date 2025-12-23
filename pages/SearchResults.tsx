
import React, { useState, useEffect } from 'react';
import { Loader2, ArrowRight } from 'lucide-react';

interface WPPost {
  id: number;
  title: { rendered: string };
  excerpt: { rendered: string };
  date: string;
  _embedded?: {
    'wp:featuredmedia'?: Array<{ source_url: string }>;
    'author'?: Array<{ name: string }>;
  };
}

interface SearchResultsProps {
  query: string;
  onPostClick: (postId: number) => void;
}

const decodeHTML = (html: string) => {
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
};

const getImageUrl = (post: WPPost) => {
  return post._embedded?.['wp:featuredmedia']?.[0]?.source_url || 'https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png';
};

const getAuthor = (post: WPPost) => {
  return post._embedded?.['author']?.[0]?.name || 'Central Crypto';
};

const SearchResults: React.FC<SearchResultsProps> = ({ query, onPostClick }) => {
  const [posts, setPosts] = useState<WPPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!query) return;

    const searchPosts = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`https://centralcrypto.com.br/2/wp-json/wp/v2/posts?search=${encodeURIComponent(query)}&_embed&per_page=20`);
        if (!res.ok) throw new Error("Erro na busca");
        const data = await res.json();
        setPosts(data);
        if (data.length === 0) setError('Nenhum resultado encontrado.');
      } catch (e) {
        setError('Erro ao buscar resultados. Tente novamente.');
      } finally {
        setLoading(false);
      }
    };

    searchPosts();
  }, [query]);

  if (!query) {
    return (
        <div className="container mx-auto px-4 py-12 text-center text-gray-500">
            Digite algo para buscar...
        </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-screen">
      <div className="mb-8 border-b border-tech-700 pb-4">
        <h2 className="text-2xl font-bold text-gray-200">
            Resultados da busca: <span className="text-[#dd9933]">"{query}"</span>
        </h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-[#dd9933]" size={32} />
        </div>
      ) : error ? (
        <div className="text-center py-20 text-gray-400 text-lg">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <div 
              key={post.id} 
              onClick={() => onPostClick(post.id)}
              className="bg-tech-900 border border-tech-800 rounded-xl overflow-hidden hover:border-[#dd9933] transition-all cursor-pointer group shadow-lg flex flex-col h-full"
            >
              <div className="aspect-video w-full overflow-hidden bg-black relative">
                <img 
                  src={getImageUrl(post)} 
                  alt="" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-80 group-hover:opacity-100" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-tech-950 via-transparent to-transparent"></div>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h3 className="text-gray-200 dark:text-[#dd9933] font-bold text-lg leading-tight mb-3 group-hover:text-[#dd9933] dark:group-hover:text-white transition-colors line-clamp-2">
                  {decodeHTML(post.title.rendered)}
                </h3>
                <div className="text-xs text-gray-400 line-clamp-3 mb-4" dangerouslySetInnerHTML={{__html: post.excerpt.rendered}} />
                <div className="mt-auto flex items-center justify-between text-[10px] text-gray-500 font-mono uppercase border-t border-tech-800 pt-3">
                   <span className="flex items-center gap-1 font-bold text-[#dd9933]">{getAuthor(post)}</span>
                   <span>{new Date(post.date).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchResults;
