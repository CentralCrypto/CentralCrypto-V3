
import { httpGetJson, httpPostJson } from './http';
import { getWpBaseUrl, getWpStaticBase, WP_PATHS } from './wpConfig';

export type AcademyTopicNode = {
  id?: string | number;
  title: string;
  children?: AcademyTopicNode[];
  content_pt?: string;
  content_en?: string;
  content_es?: string;
  displayTitle?: Record<string, string>;
  content?: Record<string, string>;
  parentId?: string | null;
  tier?: number;
};

/**
 * Busca tópicos tentando primeiro o JSON estático por velocidade,
 * fazendo fallback para a API se necessário.
 */
export async function fetchAcademyTopics(): Promise<AcademyTopicNode[]> {
  const staticUrl = getWpStaticBase() + WP_PATHS.academyStatic;
  const apiUrl = getWpBaseUrl() + WP_PATHS.academyApi;

  try {
    // 1) Tentar STATIC (Ultra-rápido)
    const { data } = await httpGetJson(staticUrl, { timeoutMs: 3000 });
    return Array.isArray(data) ? data : (data?.topics || []);
  } catch (e) {
    console.warn("Academy Static Cache Miss/Fail, falling back to REST API...");
    try {
      // 2) Tentar API (Dinâmico)
      const { data } = await httpGetJson(apiUrl);
      return Array.isArray(data) ? data : (data?.topics || []);
    } catch (apiErr) {
      console.error("Academy API failed too", apiErr);
      return [];
    }
  }
}

export async function saveAcademyTopics(topics: AcademyTopicNode[], password: string): Promise<any> {
  const apiUrl = getWpBaseUrl() + WP_PATHS.academyApi;
  return httpPostJson(apiUrl, { password, topics });
}
