
import { httpGetJson } from './http';
import { getWpBaseUrl, getWpStaticBase, WP_PATHS } from './wpConfig';

export async function fetchIndicators(): Promise<any[]> {
  const staticUrl = getWpStaticBase() + WP_PATHS.indicatorsStatic;
  const apiUrl = getWpBaseUrl() + WP_PATHS.indicatorsApi;

  try {
    const { data } = await httpGetJson(staticUrl, { timeoutMs: 3000 });
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn("Indicators Static Cache Miss, falling back to API...");
    try {
      const { data } = await httpGetJson(apiUrl);
      return Array.isArray(data) ? data : [];
    } catch (apiErr) {
      return [];
    }
  }
}
