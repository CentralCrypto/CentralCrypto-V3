
import { httpGetJson } from './http';
import { LOGO_URL as SITE_LOGO } from '../pages/Workspace/constants';

// Caminho base no VPS para acesso web
const WEB_LOGO_BASE = '/cachecko/logos';

// Cache validado em tempo de execução (ID -> URL que carregou com sucesso)
export const validatedLogoCache = new Map<string, string>();

// Interfaces do coins_min.json
interface CoinMinEntry {
  id: string;
  symbol: string;
  name: string;
  image?: string;       // URL remota (CoinGecko)
  localFsPath?: string; // Path físico no servidor (ex: /opt/n8n/...)
  imageUrl?: string;    // Alias para imagem remota
}

// Mapas de lookup
let idMap: Record<string, CoinMinEntry> = {};    // ID -> Dados
let symbolMap: Record<string, string> = {};      // Symbol (UpperCase) -> ID
let isInitializing = false;
let isReady = false;

/**
 * Normaliza o ID ou Symbol para busca
 */
const norm = (str?: string) => (str || '').trim().toLowerCase();
const normSym = (str?: string) => (str || '').trim().toUpperCase();

/**
 * Inicializa o serviço carregando o mapa de moedas.
 * Deve ser chamado no mount da aplicação ou widgets.
 */
export const initLogoService = async () => {
  if (isReady || isInitializing) return;
  isInitializing = true;

  try {
    // Busca coins_min.json que contém metadados e caminhos locais
    const { data } = await httpGetJson(`${WEB_LOGO_BASE}/coins_min.json`, { timeoutMs: 5000 });

    if (data) {
      // Suporta formato Array ou Objeto (Map)
      const entries: CoinMinEntry[] = Array.isArray(data) 
        ? data 
        : (typeof data === 'object' ? Object.values(data) : []);

      entries.forEach(entry => {
        if (entry.id) {
            idMap[norm(entry.id)] = entry;
            if (entry.symbol) {
                symbolMap[normSym(entry.symbol)] = norm(entry.id);
            }
        }
      });
    }
    isReady = true;
  } catch (e) {
    console.warn("[LogoService] Falha ao carregar mapa de logos.", e);
  } finally {
    isInitializing = false;
  }
};

/**
 * Tenta descobrir o ID CoinGecko correto a partir do objeto da moeda.
 */
export const resolveCoinId = (coin: { id?: string; symbol?: string }): string => {
  let id = norm(coin.id);
  
  // Se não temos ID, ou o ID parece ser um símbolo (curto, sem hifens comuns em ids compostos)
  // tentamos resolver via mapa de símbolos se disponível.
  if (!id && coin.symbol) {
      const sym = normSym(coin.symbol);
      if (symbolMap[sym]) return symbolMap[sym];
      return sym.toLowerCase(); // Fallback: symbol as id
  }
  
  // Se o ID fornecido não está no mapa, mas temos um symbol, tenta achar pelo symbol
  if (id && !idMap[id] && coin.symbol) {
       const sym = normSym(coin.symbol);
       if (symbolMap[sym]) return symbolMap[sym];
  }

  return id || 'unknown';
};

/**
 * Retorna o melhor caminho LOCAL (string) para uso em Highcharts/Canvas.
 * Prioriza: Arquivo mapeado > ID.webp
 */
export const getBestLocalLogo = (coin: { id?: string; symbol?: string }): string => {
    const id = resolveCoinId(coin);
    const entry = idMap[id];

    // 1. Se tem mapeamento explícito de arquivo local no JSON
    if (entry && entry.localFsPath) {
        // Extrai apenas o nome do arquivo (ex: bitcoin.png) de um path completo
        const filename = entry.localFsPath.split(/[/\\]/).pop();
        if (filename) return `${WEB_LOGO_BASE}/${filename}`;
    }

    // 2. Padrão: ID.webp
    return `${WEB_LOGO_BASE}/${id}.webp`;
};

/**
 * Gera a lista de URLs candidatas para o componente de imagem (fallback em cascata).
 */
export const resolveLogoUrls = (coin: { id?: string; symbol?: string; image?: string }): string[] => {
  const id = resolveCoinId(coin);
  
  // 1. Se já validamos uma URL antes, retorna ela direto (cache de sucesso)
  // Usamos uma chave composta para evitar colisões se o ID mudar
  const cacheKey = `${id}`;
  if (validatedLogoCache.has(cacheKey)) {
    return [validatedLogoCache.get(cacheKey)!];
  }

  const candidates: string[] = [];
  const entry = idMap[id];

  // 2. Prioridade Máxima: Arquivo Local Mapeado (se existir no JSON)
  if (entry && entry.localFsPath) {
     const filename = entry.localFsPath.split(/[/\\]/).pop();
     if (filename) candidates.push(`${WEB_LOGO_BASE}/${filename}`);
  }

  // 3. Tentativa Local Padrão por ID (Ordem: WebP -> PNG -> JPG)
  // Adiciona apenas se não foi adicionado acima
  const standardWebp = `${WEB_LOGO_BASE}/${id}.webp`;
  if (!candidates.includes(standardWebp)) candidates.push(standardWebp);
  
  candidates.push(`${WEB_LOGO_BASE}/${id}.png`);
  candidates.push(`${WEB_LOGO_BASE}/${id}.jpg`);
  candidates.push(`${WEB_LOGO_BASE}/${id}.jpeg`);

  // 4. Fallback Remoto (CoinGecko / API)
  if (entry && (entry.image || entry.imageUrl)) {
      candidates.push(entry.image || entry.imageUrl || '');
  } else if (coin.image) {
      candidates.push(coin.image);
  }

  // 5. Fallback Final: Placeholder do Site
  candidates.push(SITE_LOGO);

  return candidates.filter(Boolean); // Remove vazios
};
