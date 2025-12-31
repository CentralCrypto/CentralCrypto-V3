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

const PLACEHOLDER_IMG =
  'https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png';

// ==============================================================
// Cache & Dedupe (front) — reduz brutalmente o tempo da Home
// ==============================================================

type HeaderLike = { get: (name: string) => string | null };

type MagazineFetchOpts = {
  cacheTtlMs?: number; // 0 = sem cache
  forceFresh?: boolean; // ignora cache + adiciona cache-buster
  dedupe?: boolean; // reusa promise quando mesma URL está em voo
  timeoutMs?: number;
};

type CacheEntry = {
  expiresAt: number;
  data: any;
  headers: Record<string, string>;
};

const DEFAULT_TIMEOUT_MS = 10000;
const POSTS_CACHE_TTL_MS = 30_000; // suficiente p/ DEV sem ficar “travado”
const CATS_CACHE_TTL_MS = 3_600_000; // 1h
const HEADERS_TO_KEEP = ['X-WP-Total', 'X-WP-TotalPages'];

const responseCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<{ data: any; headers: HeaderLike }>>();

function nowMs() {
  return Date.now();
}

function pickHeaders(headers: Headers, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = headers.get(k);
    if (v) out[k] = v;
  }
  return out;
}

function buildHeaderLike(obj: Record<string, string>): HeaderLike {
  // Mantém compatível com o uso atual (headers.get('X-WP-Total'))
  return {
    get: (name: string) => obj[name] ?? obj[name.toLowerCase()] ?? null
  };
}

function buildUrl(path: string, params: Record<string, any>, includeBuster: boolean) {
  const query = new URLSearchParams();

  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    query.append(k, String(v));
  });

  if (includeBuster) query.append('_m', Math.floor(Date.now() / 60000).toString());

  const baseUrl = getMagazineUrl(path);
  const qs = query.toString();
  if (!qs) return baseUrl;
  return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${qs}`;
}

async function magazineFetch(path: string, params: Record<string, any> = {}, opts: MagazineFetchOpts = {}) {
  const { cacheTtlMs = 0, forceFresh = false, dedupe = true, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;

  // Key SEM cache-buster (pra cache/dedupe funcionarem)
  const urlKey = buildUrl(path, params, false);
  const urlFetch = forceFresh ? buildUrl(path, params, true) : urlKey;

  if (!forceFresh && cacheTtlMs > 0) {
    const cached = responseCache.get(urlKey);
    if (cached && cached.expiresAt > nowMs()) {
      return { data: cached.data, headers: buildHeaderLike(cached.headers) };
    }
  }

  if (dedupe) {
    const existing = inflight.get(urlKey);
    if (existing && !forceFresh) return existing;
  }

  const req = (async () => {
    try {
      const { data, headers } = await httpGetJson(urlFetch, { timeoutMs });

      if (!forceFresh && cacheTtlMs > 0) {
        responseCache.set(urlKey, {
          expiresAt: nowMs() + cacheTtlMs,
          data,
          headers: pickHeaders(headers, HEADERS_TO_KEEP)
        });
      }

      return { data, headers: buildHeaderLike(pickHeaders(headers, HEADERS_TO_KEEP)) };
    } catch (e: any) {
      console.error(`[Magazine] Erro: ${e?.message || 'erro desconhecido'}`);
      throw e;
    } finally {
      inflight.delete(urlKey);
    }
  })();

  if (dedupe && !forceFresh) inflight.set(urlKey, req);
  return req;
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '').trim();
}

function normalizePost(post: any): MagazinePost {
  if (!post || typeof post !== 'object') return { id: 0 } as MagazinePost;

  let img =
    post.featured_media_url ||
    post._embedded?.['wp:featuredmedia']?.[0]?.source_url ||
    post.jetpack_featured_media_url;

  // Só tenta “pescar” imagem do content se ele existir (no modo lightweight, não vem)
  if (!img && post.content?.rendered) {
    const match = post.content.rendered.match(/<img[^>]+src="([^">]+)"/);
    if (match) img = match[1];
  }

  return {
    id: post.id || 0,
    slug: post.slug || '',
    titleHtml: post.title?.rendered || 'Sem título',
    excerptText: stripHtml(post.excerpt?.rendered || ''),
    contentHtml: post.content?.rendered || '',
    date: post.date || new Date().toISOString(),
    categories: post.categories || [],
    featuredImage: img || PLACEHOLDER_IMG,
    authorName: post._embedded?.['author']?.[0]?.name || 'Central Crypto'
  };
}

// Updated fetchMagazinePosts parameter type for categories to allow string (comma-separated list)
// This fix addresses Type 'string' is not assignable to type 'number' errors in NewsGrid.tsx and NewsFeed.tsx
export async function fetchMagazinePosts(params: {
  search?: string;
  page?: number;
  perPage?: number;
  categories?: number | string;
  lightweight?: boolean; // default: true (home/listas)
  cacheTtlMs?: number; // override
  forceFresh?: boolean; // ignora cache
}): Promise<{ posts: MagazinePost[]; total: number; totalPages: number }> {
  try {
    const lightweight = params.lightweight ?? true;
    const fieldsLight = [
      'id',
      'slug',
      'date',
      'title',
      'excerpt',
      'categories',
      'featured_media',
      'featured_media_url',
      'jetpack_featured_media_url',
      '_embedded'
    ].join(',');

    const query = {
      _embed: 1,
      search: params.search,
      page: params.page,
      per_page: params.perPage || 10,
      categories: params.categories,
      ...(lightweight ? { _fields: fieldsLight } : {})
    };

    const { data, headers } = await magazineFetch(ENDPOINTS.magazine.posts, query, {
      cacheTtlMs: params.cacheTtlMs ?? (lightweight ? POSTS_CACHE_TTL_MS : 0),
      forceFresh: !!params.forceFresh,
      dedupe: true,
      timeoutMs: DEFAULT_TIMEOUT_MS
    });

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
    const { data } = await magazineFetch(
      `${ENDPOINTS.magazine.posts}/${id}`,
      { _embed: 1 },
      { cacheTtlMs: 0, forceFresh: true, dedupe: true, timeoutMs: DEFAULT_TIMEOUT_MS }
    );
    return data ? normalizePost(data) : null;
  } catch (e) {
    return null;
  }
}

export async function fetchMagazineCategories(): Promise<MagazineCategory[]> {
  try {
    const { data } = await magazineFetch(
      ENDPOINTS.magazine.categories,
      { per_page: 100 },
      { cacheTtlMs: CATS_CACHE_TTL_MS, forceFresh: false, dedupe: true, timeoutMs: DEFAULT_TIMEOUT_MS }
    );
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
