
/**
 * WP TURBO SERVICE
 * Cliente turbo: tenta arquivo estático (ultra rápido) e cai pro WP REST se falhar.
 */

const WP_BASE = "https://centralcrypto.com.br";

function joinUrl(base: string, path: string) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "").replace(/^\/+/, "");
  return `${b}/${p}`;
}

async function safeJson(res: Response) {
  const txt = await res.text();
  try {
    return JSON.parse(txt);
  } catch {
    return { _raw: txt };
  }
}

async function tryFetchJson(url: string, fetchOpts: RequestInit = {}) {
  try {
    const r = await fetch(url, fetchOpts);
    if (!r.ok) return { ok: false, status: r.status, data: null };
    const data = await safeJson(r);
    return { ok: true, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: null };
  }
}

/**
 * MAGAZINE POSTS (lista)
 * - static first: /2/wp-content/uploads/cct-cache/magazine-posts-v1.json
 * - fallback: /2/wp-json/wp/v2/posts?_embed=1&per_page=...&page=...&search=...
 */
export async function fetchMagazinePosts({
  wpBaseUrl = WP_BASE,
  perPage = 12,
  page = 1,
  search = "",
  categories = 0
}: any = {}) {
  const staticPath = "/2/wp-content/uploads/cct-cache/magazine-posts-v1.json";
  const apiPathBase = "/2/wp-json/wp/v2/posts";

  // 1) tenta estático (se for a primeira página e sem filtros específicos de busca)
  if (page === 1 && !search && !categories) {
    const staticUrl = joinUrl(wpBaseUrl, staticPath);
    const r1 = await tryFetchJson(staticUrl, { cache: "no-store" });
    if (r1.ok && Array.isArray(r1.data)) {
      return { source: "static", items: r1.data };
    }
  }

  // 2) fallback WP REST
  const qs = new URLSearchParams();
  qs.set("_embed", "1");
  qs.set("per_page", String(perPage));
  qs.set("page", String(page));
  qs.set("orderby", "date");
  qs.set("order", "desc");
  if (categories) qs.set("categories", String(categories));
  if (String(search).trim()) qs.set("search", String(search).trim());

  const apiUrl = joinUrl(wpBaseUrl, `${apiPathBase}?${qs.toString()}`);
  const r2 = await fetch(apiUrl, { cache: "no-store" });

  if (!r2.ok) {
    throw new Error(`fetchMagazinePosts failed: ${r2.status}`);
  }

  const data = await safeJson(r2);
  return { source: "wp", items: Array.isArray(data) ? data : [] };
}

/**
 * MAGAZINE CATEGORIES
 * - static first: /2/wp-content/uploads/cct-cache/magazine-categories-v1.json
 * - fallback: /2/wp-json/wp/v2/categories?per_page=100&hide_empty=...
 */
export async function fetchMagazineCategories({
  wpBaseUrl = WP_BASE,
  perPage = 100,
  hideEmpty = true,
}: any = {}) {
  const staticPath = "/2/wp-content/uploads/cct-cache/magazine-categories-v1.json";
  const apiPathBase = "/2/wp-json/wp/v2/categories";

  const staticUrl = joinUrl(wpBaseUrl, staticPath);
  const r1 = await tryFetchJson(staticUrl, { cache: "no-store" });
  if (r1.ok && Array.isArray(r1.data)) {
    return { source: "static", items: r1.data };
  }

  const qs = new URLSearchParams();
  qs.set("per_page", String(perPage));
  qs.set("hide_empty", hideEmpty ? "1" : "0");
  const apiUrl = joinUrl(wpBaseUrl, `${apiPathBase}?${qs.toString()}`);

  const r2 = await fetch(apiUrl, { cache: "no-store" });
  if (!r2.ok) throw new Error(`fetchMagazineCategories failed: ${r2.status}`);

  const data = await safeJson(r2);
  return { source: "wp", items: Array.isArray(data) ? data : [] };
}

/**
 * POST BY SLUG
 */
export async function fetchPostBySlug({ wpBaseUrl = WP_BASE, slug }: any = {}) {
  if (!slug) throw new Error("slug required");
  const qs = new URLSearchParams();
  qs.set("_embed", "1");
  qs.set("slug", slug);

  const apiUrl = joinUrl(wpBaseUrl, `/2/wp-json/wp/v2/posts?${qs.toString()}`);
  const r = await fetch(apiUrl, { cache: "no-store" });
  if (!r.ok) throw new Error(`fetchPostBySlug failed: ${r.status}`);
  const data = await safeJson(r);
  return Array.isArray(data) ? data[0] : null;
}

/**
 * ACADEMY TOPICS (o que você turbinou HOJE)
 * - static first: /2/wp-content/uploads/cct-cache/academy-topics-v1.json
 * - fallback: /2/wp-json/central-academy/v1/topics
 */
export async function fetchAcademyTopics({ wpBaseUrl = WP_BASE }: any = {}) {
  const staticPath = "/2/wp-content/uploads/cct-cache/academy-topics-v1.json";
  const apiPath = "/2/wp-json/central-academy/v1/topics";

  const staticUrl = joinUrl(wpBaseUrl, staticPath);
  const r1 = await tryFetchJson(staticUrl, { cache: "no-store" });
  if (r1.ok) return { source: "static", items: r1.data };

  const apiUrl = joinUrl(wpBaseUrl, apiPath);
  const r2 = await fetch(apiUrl, { cache: "no-store" });
  if (!r2.ok) throw new Error(`fetchAcademyTopics failed: ${r2.status}`);
  const data = await safeJson(r2);
  return { source: "wp", items: data };
}

/**
 * SAVE ACADEMY TOPICS (POST) — usa a senha que você definiu no MU-plugin
 */
export async function saveAcademyTopics({ wpBaseUrl = WP_BASE, password, topics }: any = {}) {
  if (!password) throw new Error("password required");
  if (!Array.isArray(topics)) throw new Error("topics must be array");

  const apiUrl = joinUrl(wpBaseUrl, "/2/wp-json/central-academy/v1/topics");
  const payload = { password, topics };

  const r = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!r.ok) {
    const data = await safeJson(r);
    throw new Error(`saveAcademyTopics failed: ${r.status} ${JSON.stringify(data)}`);
  }

  return await safeJson(r);
}
