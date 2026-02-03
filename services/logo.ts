
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

  // Se nada foi passado, fallback direto
  if (!id && !sym && !coin.image) return [SITE_LOGO];

  // 1) Cache validado (memória)
  if (id && validatedLogoCache.has(id)) return [validatedLogoCache.get(id)!];

  // 2) Local exato (via manifest.json se houver)
  if (id && localUrlById[id]) urls.push(localUrlById[id]);

  // 3) Chute Local por ID: webp -> png -> jpg -> jpeg
  if (id) {
      // Plural folder
      urls.push(`${VPS_LOGO_BASE}/${id}.webp`);
      urls.push(`${VPS_LOGO_BASE}/${id}.png`);
      urls.push(`${VPS_LOGO_BASE}/${id}.jpg`);
      urls.push(`${VPS_LOGO_BASE}/${id}.jpeg`);
      // Singular folder
      urls.push(`${VPS_LOGO_BASE_ALT}/${id}.webp`);
      urls.push(`${VPS_LOGO_BASE_ALT}/${id}.png`);
      urls.push(`${VPS_LOGO_BASE_ALT}/${id}.jpg`);
      urls.push(`${VPS_LOGO_BASE_ALT}/${id}.jpeg`);
  }

  // 4) Chute Local por Símbolo: webp -> png -> jpg -> jpeg
  if (sym && sym !== id) {
      urls.push(`${VPS_LOGO_BASE}/${sym}.webp`);
      urls.push(`${VPS_LOGO_BASE}/${sym}.png`);
      urls.push(`${VPS_LOGO_BASE}/${sym}.jpg`);
      urls.push(`${VPS_LOGO_BASE}/${sym}.jpeg`);

      urls.push(`${VPS_LOGO_BASE_ALT}/${sym}.webp`);
      urls.push(`${VPS_LOGO_BASE_ALT}/${sym}.png`);
      urls.push(`${VPS_LOGO_BASE_ALT}/${sym}.jpg`);
      urls.push(`${VPS_LOGO_BASE_ALT}/${sym}.jpeg`);
  }

  // 5) Imagem explícita no objeto (vindo do JSON da API)
  if (coin.image && isHttp(coin.image)) urls.push(coin.image);

  // 6) Remoto (map carregado do coins_min.json)
  if (id && remoteUrlById[id]) urls.push(remoteUrlById[id]);

  // 7) Fallback Site
  urls.push(SITE_LOGO);

  // Remove duplicadas mantendo a ordem de prioridade
  return Array.from(new Set(urls.filter(Boolean)));
};

export const getBestLocalLogo = (coin: { id: string }): string => {
  const id = coin?.id;
  if (!id) return SITE_LOGO;
  return localUrlById[id] || SITE_LOGO;
};
