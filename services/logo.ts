
import { httpGetJson } from './http';
import { LOGO_URL as SITE_LOGO } from '../pages/Workspace/constants';

// Caminho base no VPS
const VPS_LOGO_BASE = '/cachecko/logos';

// Cache em memória: ID -> URL que funcionou
export const validatedLogoCache = new Map<string, string>();

// Cache do mapa de IDs do CoinGecko (carregado de coins_min.json)
let coinGeckoMap: Record<string, string> | null = null;
let isInitializing = false;

/**
 * Inicializa o mapa de logos externos (CoinGecko) buscando do VPS.
 * Isso evita requisições diretas à API do CG.
 */
export const initLogoService = async () => {
  if (coinGeckoMap || isInitializing) return;
  isInitializing = true;

  try {
    // Busca paralela dos mapas
    const [minRes, manifestRes] = await Promise.all([
      httpGetJson(`${VPS_LOGO_BASE}/coins_min.json`, { timeoutMs: 3000 }).catch(() => ({ data: {} })),
      httpGetJson(`${VPS_LOGO_BASE}/manifest.json`, { timeoutMs: 3000 }).catch(() => ({ data: [] }))
    ]);

    coinGeckoMap = {};

    // 1. Popula com coins_min (Mapa ID -> URL)
    if (minRes.data) {
      Object.assign(coinGeckoMap, minRes.data);
    }

    // 2. Complementa com manifest (Array de Objetos)
    const manifestData = Array.isArray(manifestRes.data) ? manifestRes.data : [];
    manifestData.forEach((item: any) => {
      if (item.id && item.imageUrl && coinGeckoMap) {
        // Manifest tem prioridade se existir, pois presume-se mais recente
        coinGeckoMap[item.id] = item.imageUrl;
      }
    });

  } catch (e) {
    console.warn("[LogoService] Falha ao carregar mapas de logo locais.", e);
    coinGeckoMap = {}; // Fallback vazio para não travar
  } finally {
    isInitializing = false;
  }
};

/**
 * Gera a lista de URLs candidatas na ordem de prioridade solicitada.
 */
export const getCandidateLogoUrls = (coin: { id: string; symbol?: string; image?: string }): string[] => {
  const id = coin.id;
  const urls: string[] = [];

  // 1. Tenta Cache validado primeiro (se já tivermos)
  if (validatedLogoCache.has(id)) {
    return [validatedLogoCache.get(id)!];
  }

  // 2. Prioridade: Arquivos locais no VPS (WebP -> PNG -> JPG)
  urls.push(`${VPS_LOGO_BASE}/${id}.webp`);
  urls.push(`${VPS_LOGO_BASE}/${id}.png`);
  urls.push(`${VPS_LOGO_BASE}/${id}.jpg`);

  // 3. Fallback: URL do CoinGecko (via mapa local json ou propriedade do objeto)
  if (coinGeckoMap && coinGeckoMap[id]) {
    urls.push(coinGeckoMap[id]);
  } else if (coin.image) {
    // Se o mapa não carregou ainda, usa a do objeto se existir
    urls.push(coin.image);
  }

  // 4. Fallback Final: Logo do Site
  urls.push(SITE_LOGO);

  return urls;
};
