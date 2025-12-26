
import * as wpTurbo from './wpTurbo';

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

function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]*>?/gm, '').trim();
}

function normalizePost(post: any): MagazinePost {
    if (!post || typeof post !== 'object') return { id: 0 } as MagazinePost;
    
    // Suporte a diversos formatos de imagem vindo do WordPress ou do Cache Estático
    let img = 
        post._embedded?.['wp:featuredmedia']?.[0]?.source_url || 
        post.featured_media_url || 
        post.featured_image_url ||
        post.jetpack_featured_media_url ||
        post.thumbnail;

    if (!img && post.content?.rendered) {
        const match = post.content.rendered.match(/<img[^>]+src="([^">]+)"/);
        if (match) img = match[1];
    }

    const title = post.title?.rendered || post.title || "Sem título";
    const author = post._embedded?.['author']?.[0]?.name || post.author_name || "Central Crypto";

    return {
        id: post.id || Math.floor(Math.random() * 1000000),
        slug: post.slug || "",
        titleHtml: title,
        excerptText: stripHtml(post.excerpt?.rendered || post.excerpt || ""),
        contentHtml: post.content?.rendered || post.content || "",
        date: post.date || new Date().toISOString(),
        categories: post.categories || [],
        featuredImage: img || PLACEHOLDER_IMG,
        authorName: author
    };
}

export async function fetchMagazinePosts(params: { search?: string; page?: number; perPage?: number; categories?: number } = {}): Promise<{ posts: MagazinePost[]; source: string }> {
  try {
    const res = await wpTurbo.fetchMagazinePosts({
      perPage: params.perPage || 12,
      page: params.page || 1,
      search: params.search || '',
      categories: params.categories || 0
    });
    
    const posts = (res.items || []).map(normalizePost).filter((p: any) => p.id > 0);
    return {
      posts,
      source: res.source
    };
  } catch (e) {
    console.error("fetchMagazinePosts Error", e);
    return { posts: [], source: 'error' };
  }
}

export async function fetchSinglePost(id: number): Promise<MagazinePost | null> {
    try {
        const res = await fetch(`https://centralcrypto.com.br/2/wp-json/wp/v2/posts/${id}?_embed=1`);
        if (!res.ok) return null;
        const data = await res.json();
        return normalizePost(data);
    } catch (e) {
        console.error("fetchSinglePost Error", e);
        return null;
    }
}

export async function fetchPostBySlug(slug: string): Promise<MagazinePost | null> {
    try {
        const data = await wpTurbo.fetchPostBySlug({ slug });
        return data ? normalizePost(data) : null;
    } catch (e) {
        console.error("fetchPostBySlug Error", e);
        return null;
    }
}

export async function fetchMagazineCategories(): Promise<MagazineCategory[]> {
  try {
    const res = await wpTurbo.fetchMagazineCategories();
    const raw = res.items || [];
    return raw.map((c: any) => ({ 
        id: c.id, 
        name: c.name, 
        slug: c.slug || '', 
        count: c.count || 0 
    }));
  } catch (e) {
    console.error("fetchMagazineCategories Error", e);
    return [];
  }
}
