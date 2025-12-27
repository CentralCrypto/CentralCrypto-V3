
/**
 * Centralização definitiva das URLs do WordPress em formato relativo.
 */
const WP_BASE = "/2";

export function getWpBaseUrl(): string {
  return WP_BASE;
}

export function getWpStaticBase(): string {
  return WP_BASE;
}

export const WP_PATHS = {
  academyStatic: "/wp-content/uploads/cct-cache/academy-topics-v1.json",
  academyApi: "/wp-json/central-academy/v1/topics",
  indicatorsStatic: "/wp-content/uploads/cct-cache/cct-indicators-v1.json",
  indicatorsApi: "/wp-json/cct/v1/indicators",
  posts: "/wp-json/wp/v2/posts",
  categories: "/wp-json/wp/v2/categories"
};
