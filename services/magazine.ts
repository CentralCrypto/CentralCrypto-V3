
import { httpGetJson } from './http';
import { getWpBaseUrl, WP_PATHS } from './wpConfig';

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
    let img = post._embedded?.['wp:featuredmedia']?.[0]?.source_url || post.featured_media_url || post.jetpack_featured_media_url;
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

/**
 * Constrói URL com Cache Buster e suporte a diferentes formatos de rota
 */
function buildWpUrl(path: string, params: Record<string, any>, useRestRoute = false): string {
    const base = getWpBaseUrl().replace(/\/$/, '');
    let urlStr = '';
    
    if (useRestRoute) {
        // Formato Plan B: ?rest_route=/wp/v2/posts
        urlStr = `${base}/index.php?rest_route=${path}`;
    } else {
        // Formato Plan A: /wp-json/wp/v2/posts
        urlStr = `${base}${path}`;
    }

    const url = new URL(urlStr.includes('?') ? urlStr : `${urlStr}?`);
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== 0 && v !== '') url.searchParams.set(k, v.toString()); });
    url.searchParams.set('_v', Date.now().toString());
    return url.toString();
}

export async function fetchMagazinePosts(params: { search?: string; page?: number; perPage?: number; categories?: number }): Promise<{ posts: MagazinePost[]; total: number; totalPages: number }> {
  const queryParams = { _embed: 1, search: params.search, page: params.page, per_page: params.perPage, categories: params.categories };

  // ESTRATÉGIA DE FALLBACK RECURSIVA
  const tryFetch = async (attempt: number): Promise<any> => {
    let url = '';
    if (attempt === 0) url = buildWpUrl(WP_PATHS.posts, queryParams, false);
    else if (attempt === 1) url = buildWpUrl(WP_PATHS.posts, queryParams, true);
    else url = `https://api.allorigins.win/raw?url=${encodeURIComponent(buildWpUrl(WP_PATHS.posts, queryParams, false))}`;

    try {
      const { data, headers } = await httpGetJson(url);
      const rawPosts = Array.isArray(data) ? data : (data?.posts || []);
      const posts = rawPosts.map(normalizePost).filter((p: any) => p.id > 0);

      return {
          posts,
          total: parseInt(headers?.get('X-WP-Total') || posts.length.toString()),
          totalPages: parseInt(headers?.get('X-WP-TotalPages') || "1")
      };
    } catch (e) {
      if (attempt < 2) return tryFetch(attempt + 1);
      throw e;
    }
  };

  return tryFetch(0);
}

export async function fetchSinglePost(id: number): Promise<MagazinePost | null> {
    try {
        const { data } = await httpGetJson(buildWpUrl(`${WP_PATHS.posts}/${id}`, { _embed: 1 }));
        return normalizePost(data);
    } catch (e) {
        try {
            const { data } = await httpGetJson(buildWpUrl(`${WP_PATHS.posts}/${id}`, { _embed: 1 }, true));
            return normalizePost(data);
        } catch { return null; }
    }
}

export async function fetchMagazineCategories(): Promise<MagazineCategory[]> {
  const tryCats = async (attempt: number): Promise<any> => {
    const url = attempt === 0 ? buildWpUrl(WP_PATHS.categories, { per_page: 100 }) : buildWpUrl(WP_PATHS.categories, { per_page: 100 }, true);
    try {
        const { data } = await httpGetJson(url);
        const raw = Array.isArray(data) ? data : (data?.categories || []);
        return raw.map((c: any) => ({ id: c.id, name: c.name, slug: c.slug, count: c.count }));
    } catch (e) {
        if (attempt === 0) return tryCats(1);
        return [];
    }
  };
  return tryCats(0);
}
