// /v3/services/user.ts
import { authService } from './auth';

export interface ProfileData {
  id: number;
  username?: string;
  name?: string;
  first_name: string;
  last_name: string;
  email: string;
  description: string;
  roles: string[];
  avatar_url?: string | null;
}

/**
 * Resolve a base do WP REST com fallback esperto:
 * - Em produção (centralcrypto.com.br/v3) -> usa o mesmo origin + /2/wp-json
 * - Em DEV (localhost ou IP:3000) -> força https://centralcrypto.com.br/2/wp-json
 * - Se existir VITE_WP_API_BASE, respeita.
 */
function getApiBase(): string {
  const fromEnv = (import.meta as any).env?.VITE_WP_API_BASE;
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).trim().replace(/\/+$/, '');
  }

  if (typeof window === 'undefined') {
    return 'https://centralcrypto.com.br/2/wp-json';
  }

  const host = window.location.hostname || '';
  const isDevHost =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host);

  if (isDevHost) {
    return 'https://centralcrypto.com.br/2/wp-json';
  }

  return `${window.location.origin}/2/wp-json`;
}

async function safeReadJson(res: Response): Promise<{ data: any; rawText: string }> {
  const rawText = await res.text();
  if (!rawText || !rawText.trim()) return { data: null, rawText: '' };

  try {
    return { data: JSON.parse(rawText), rawText };
  } catch {
    return { data: null, rawText };
  }
}

function buildHttpError(res: Response, data: any, rawText: string): Error {
  const ct = res.headers.get('content-type') || '';
  const snippet = (rawText || '').slice(0, 500);

  let msg = `Erro HTTP ${res.status} (${res.statusText}).`;
  if (data?.message) msg += ` ${data.message}`;
  if (data?.code) msg += ` [${data.code}]`;

  if (!data) {
    msg += ` Resposta não-JSON ou vazia. content-type="${ct}".`;
    msg += snippet ? ` Body (início): ${snippet}` : ` Body vazio.`;
  }

  // Mensagens mais úteis pros teus casos
  if (res.status === 401) msg += ' Token inválido ou expirado.';
  if (res.status === 404) msg += ' Endpoint não encontrado (confira /2/wp-json).';

  return new Error(msg);
}

function getAuthHeadersJson(): HeadersInit {
  const user = authService.getCurrentUser();
  const h: HeadersInit = { 'Content-Type': 'application/json' };

  if (user?.token) {
    // backend custom usa Bearer token (não cookie / não wp nonce)
    h['Authorization'] = `Bearer ${user.token}`;
  }

  return h;
}

function getAuthHeadersFormData(): HeadersInit {
  const user = authService.getCurrentUser();
  const h: HeadersInit = {};

  if (user?.token) {
    h['Authorization'] = `Bearer ${user.token}`;
  }

  // NÃO setar Content-Type em FormData (browser coloca boundary)
  return h;
}

export const userService = {
  /**
   * Pega o perfil SEM depender de /wp/v2/users/me (cookie/nonce).
   * Usa /custom/v1/me (Bearer token).
   */
  getProfile: async (): Promise<ProfileData> => {
    const API_BASE = getApiBase();
    const logged = authService.getCurrentUser();

    const res = await fetch(`${API_BASE}/custom/v1/me`, {
      method: 'GET',
      headers: getAuthHeadersJson(),
      credentials: 'omit',
    });

    const { data, rawText } = await safeReadJson(res);
    if (!res.ok) throw buildHttpError(res, data, rawText);
    if (!data?.success) throw new Error('Falha ao carregar perfil.');

    return {
      id: data.user_id || logged?.id || 0,
      username: data.user_nicename || logged?.user_nicename,
      name: data.user_display_name || logged?.user_display_name,
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      email: data.user_email || logged?.user_email || '',
      description: data.description || '',
      roles: Array.isArray(data.roles) ? data.roles : (logged?.roles ?? []),
      avatar_url: data.avatar_url || logged?.avatar_url || null,
    };
  },

  /**
   * Atualiza nome/sobrenome/bio (email imexível).
   * Backend: POST /custom/v1/me (Bearer token)
   */
  updateProfile: async (payload: { first_name?: string; last_name?: string; description?: string }): Promise<any> => {
    const API_BASE = getApiBase();

    const res = await fetch(`${API_BASE}/custom/v1/me`, {
      method: 'POST',
      headers: getAuthHeadersJson(),
      credentials: 'omit',
      body: JSON.stringify(payload),
    });

    const { data, rawText } = await safeReadJson(res);
    if (!res.ok) throw buildHttpError(res, data, rawText);
    return data;
  },

  /**
   * Upload avatar (um endpoint só, sem WP media direto).
   * Backend: POST /custom/v1/avatar (multipart/form-data, Bearer token)
   */
  uploadAvatar: async (file: File): Promise<{ success: boolean; avatar_url?: string; attachment_id?: number }> => {
    const API_BASE = getApiBase();

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/custom/v1/avatar`, {
      method: 'POST',
      headers: getAuthHeadersFormData(),
      credentials: 'omit',
      body: formData,
    });

    const { data, rawText } = await safeReadJson(res);
    if (!res.ok) throw buildHttpError(res, data, rawText);
    if (!data?.success) throw new Error('Upload falhou.');
    return data;
  },
};
