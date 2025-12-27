
/**
 * MOTOR MAGAZINE V5.0 - PROXY-READY
 * Otimizado para Same-Origin Fetch com Fallback automático de Proxy
 */
import { getMagazineUrl, ENDPOINTS } from './endpoints';
import { httpGetJson } from './http';

export type MagazinePost = {
  id: number;
  slug: string;
  titleHtml: string;
  excerptText: string;
  date: string;
  featuredImage?: string;
  categories?: number[];
  authorName?: string;
  contentHtml?: string;
};

export type MagazineCategory = {
  id: number;
  name: string;
  slug: string;
  count?: number;
};

const PLACEHOLDER_IMG = 'https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png';

async function magazineFetch(path: string, params: Record<string, any> = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '' && v !== 0) query.append(k, v.toString());
    });
    
    query.append('_m', Math.floor(Date.now() / 60000).toString());
    const baseUrl = getMagazineUrl(path);
    const finalUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${query.toString()}`;

    try {
        const { data, headers } = await httpGetJson(finalUrl, { timeoutMs: 10000 });
        return { data, headers };
    } catch (e: any) {
        console.error(`[Magazine] Erro: ${e.message}`);
        throw e;
    }
}

function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]*>?/gm, '').trim();
}

function normalizePost(post: any): MagazinePost {
    if (!post || typeof post !== 'object') return { id: 0 } as MagazinePost;
    
    let img = post.featured_media_url || 
              post._embedded?.['wp:featuredmedia']?.[0]?.source_url || 
              post.jetpack_featured_media_url;
              
    if (!img && post.content?.rendered) {
        const match = post.content.rendered.match(/<img[^>]+src="([^">]+)"/);
        if (match) img = match[1];
    }

    return {
        id: post.id || 0,
        slug: post.slug || "",
        titleHtml: post.title?.rendered || "Sem título",
        excerptText: stripHtml(post.excerpt?.rendered || ""),
        contentHtml: post.content?.rendered || "",
        date: post.date || new Date().toISOString(),
        categories: post.categories || [],
        featuredImage: img || PLACEHOLDER_IMG,
        authorName: post._embedded?.['author']?.[0]?.name || "Central Crypto"
    };
}

export async function fetchMagazinePosts(params: { search?: string; page?: number; perPage?: number; categories?: number }): Promise<{ posts: MagazinePost[]; total: number; totalPages: number }> {
    try {
        const query = { 
            _embed: 1, 
            search: params.search, 
            page: params.page, 
            per_page: params.perPage || 10, 
            categories: params.categories 
        };
        
        const { data, headers } = await magazineFetch(ENDPOINTS.magazine.posts, query);
        const rawPosts = Array.isArray(data) ? data : [];
        const posts = rawPosts.map(normalizePost).filter((p: any) => p.id > 0);
        
        let total = posts.length;
        let totalPages = 1;
        
        if (headers) {
            const wpTotal = headers.get('X-WP-Total');
            const wpPages = headers.get('X-WP-TotalPages');
            if (wpTotal) total = parseInt(wpTotal);
            if (wpPages) totalPages = parseInt(wpPages);
        }

        return { posts, total, totalPages };
    } catch (e) {
        throw e;
    }
}

export async function fetchSinglePost(id: number): Promise<MagazinePost | null> {
    try {
        const { data } = await magazineFetch(`${ENDPOINTS.magazine.posts}/${id}`, { _embed: 1 });
        return data ? normalizePost(data) : null;
    } catch (e) { 
        return null; 
    }
}

export async function fetchMagazineCategories(): Promise<MagazineCategory[]> {
    try {
        const { data } = await magazineFetch(ENDPOINTS.magazine.categories, { per_page: 100 });
        const raw = Array.isArray(data) ? data : [];
        return raw.map((c: any) => ({ 
            id: c.id, 
            name: c.name, 
            slug: c.slug, 
            count: c.count 
        }));
    } catch (e) { 
        return []; 
    }
}
