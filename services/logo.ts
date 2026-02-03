
import { httpGetJson } from './http';
import { LOGO_URL as SITE_LOGO } from '../pages/Workspace/constants';

const VPS_LOGO_BASE = '/cachecko/logos';
const VPS_LOGO_BASE_ALT = '/cachecko/logo'; // Fallback para pasta no singular

// Cache em memória: ID -> URL que funcionou (para <img/>)
export const validatedLogoCache = new Map<string, string>();

// Mapa remoto (CoinGecko etc): id -> url remota
let remoteUrlById: Record<string, string> = {};

// Mapa local garantido (vindo do manifest): id -> url pública local (/cachecko/logos/xxx.webp)
let localUrlById: Record<string, string> = {};

let isInitializing = false;
let initPromise: Promise<void> | null = null;

const isHttp = (s: any) => typeof s === 'string' && /^https?:\/\//i.test(s);

function toPublicLogoUrl(p: string): string {
  if (!p) return '';
  // Já está em URL pública
  if (p.startsWith(`${VPS_LOGO_BASE}/`)) return p;
  if (p.startsWith(`${VPS_LOGO_BASE_ALT}/`)) return p;

  // Se vier com caminho absoluto do FS, tenta limpar
  if (p.includes('/logos/')) {
      const idx = p.indexOf('/logos/');
      return `/cachecko${p.slice(idx)}`;
  }

  // Se vier só "dogecoin.webp"
  if (!p.includes('/')) return `${VPS_LOGO_BASE}/${p}`;

  return p;
}

function normalizeCoinsContainer(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.coins)) return data.coins;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

/**
 * Inicializa (uma vez) os mapas local/remoto.
 */
export const initLogoService = async (): Promise<void> => {
  if (isInitializing) return initPromise ?? Promise.resolve();
  if (Object.keys(remoteUrlById).length || Object.keys(localUrlById).length) return;

  isInitializing = true;

  initPromise = (async () => {
    try {
      const [minRes, manifestRes] = await Promise.all([
        httpGetJson(`${VPS_LOGO_BASE}/coins_min.json`, { timeoutMs: 4000 }).catch(() => ({ data: null })),
        httpGetJson(`${VPS_LOGO_BASE}/manifest.json`, { timeoutMs: 4000 }).catch(() => ({ data: null })),
      ]);

      const minData = minRes?.data;
      const manifestData = manifestRes?.data;

      const minCoins = normalizeCoinsContainer(minData);

      if (minData && typeof minData === 'object' && !Array.isArray(minData) && !Array.isArray(minData.coins)) {
        for (const [k, v] of Object.entries(minData)) {
          if (typeof k === 'string' && isHttp(v)) {
            remoteUrlById[k] = String(v);
          }
        }
      } else if (minCoins.length) {
        for (const c of minCoins) {
          const id = c?.id;
          const url = c?.imageUrl ?? c?.image;
          if (id && isHttp(url)) {
            remoteUrlById[id] = String(url);
          }
        }
      }

      const manifestCoins = normalizeCoinsContainer(manifestData);

      for (const c of manifestCoins) {
        const id = c?.id;
        if (!id) continue;

        const fileName = c?.fileName || c?.localFsPath;
        const publicLocal = typeof fileName === 'string' ? toPublicLogoUrl(fileName) : '';
        if (publicLocal) {
          localUrlById[id] = publicLocal;
        }

        const imgUrl = c?.imageUrl;
        if (isHttp(imgUrl)) {
          remoteUrlById[id] = String(imgUrl);
        }
      }
    } catch (e) {
      console.warn('[LogoService] Falha ao carregar maps.', e);
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
};

/**
 * Retorna candidatos para <img/> com fallback em cadeia.
 * Prioriza arquivos locais (.webp) e tenta variações de ID e Símbolo.
 */
export const getCandidateLogoUrls = (coin: { id: string; symbol?: string; image?: string }): string[] => {
  const id = coin?.id ? String(coin.id).toLowerCase() : '';
  const sym = coin?.symbol ? String(coin.symbol).toLowerCase() : '';
  const urls: string[] = [];

  if (!id && !sym) return [SITE_LOGO];

  // 1) cache validado
  if (id && validatedLogoCache.has(id)) return [validatedLogoCache.get(id)!];

  // 2) local exato (manifest)
  if (id && localUrlById[id]) urls.push(localUrlById[id]);

  // 3) Chute Local por ID (Plural & Singular)
  if (id) {
      urls.push(`${VPS_LOGO_BASE}/${id}.webp`);
      urls.push(`${VPS_LOGO_BASE_ALT}/${id}.webp`);
      urls.push(`${VPS_LOGO_BASE}/${id}.png`);
      urls.push(`${VPS_LOGO_BASE_ALT}/${id}.png`);
  }

  // 4) Chute Local por Símbolo (Plural & Singular) - Importante para casos onde ID != Filename
  if (sym && sym !== id) {
      urls.push(`${VPS_LOGO_BASE}/${sym}.webp`);
      urls.push(`${VPS_LOGO_BASE_ALT}/${sym}.webp`);
      urls.push(`${VPS_LOGO_BASE}/${sym}.png`);
      urls.push(`${VPS_LOGO_BASE_ALT}/${sym}.png`);
  }

  // 5) Remoto (map ou campo do objeto)
  if (id && remoteUrlById[id]) urls.push(remoteUrlById[id]);
  if (coin.image && isHttp(coin.image)) urls.push(coin.image);

  // 6) Fallback Site
  urls.push(SITE_LOGO);

  // Remove duplicadas mantendo a ordem de prioridade
  return Array.from(new Set(urls.filter(Boolean)));
};

export const getBestLocalLogo = (coin: { id: string }): string => {
  const id = coin?.id;
  if (!id) return SITE_LOGO;
  return localUrlById[id] || SITE_LOGO;
};
