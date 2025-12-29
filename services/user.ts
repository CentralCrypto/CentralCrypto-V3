import { authService } from './auth';

const WP_API_BASE = 'https://centralcrypto.com.br/2/wp-json';

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
  let msg = `Erro HTTP ${res.status} (${res.statusText}).`;
  if (data?.message) msg += ` ${data.message}`;
  if (data?.code) msg += ` [${data.code}]`;
  if (!data) msg += ` Body: ${(rawText || '').slice(0, 200)}`;
  return new Error(msg);
}

function getTokenOrThrow(): string {
  const u = authService.getCurrentUser();
  const t = String(u?.token || '').trim();
  if (!t) throw new Error('Sessão expirada. Faça login novamente.');
  return t;
}

export const userService = {
  getProfile: async (): Promise<any> => {
    const logged = authService.getCurrentUser();
    const token = getTokenOrThrow();

    const res = await fetch(`${WP_API_BASE}/custom/v1/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'omit',
    });

    const { data, rawText } = await safeReadJson(res);

    if (!res.ok) {
      if (res.status === 401) authService.logout();
      throw buildHttpError(res, data, rawText);
    }
    if (!data?.success) throw new Error('Resposta inválida do /custom/v1/me.');

    const avatarUrl = data.avatar_url || (logged?.avatar_url ?? null);

    return {
      id: data.user_id || (logged?.id ?? 0),
      username: data.user_nicename || logged?.user_nicename || '',
      name: data.user_display_name || logged?.user_display_name || '',
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      email: data.user_email || logged?.user_email || '',
      description: data.description || '',
      roles: Array.isArray(data.roles) ? data.roles : (logged?.roles ?? []),
      avatar_url: avatarUrl,
    };
  },

  // ⚠️ Esses dois aqui SÓ vão funcionar no V3 se existirem endpoints custom no WP.
  // (sem cookie, sem wp-admin, sem wp/v2)
  updateProfile: async (data: { first_name?: string; last_name?: string; description?: string; display_name?: string }): Promise<any> => {
    const token = getTokenOrThrow();

    const res = await fetch(`${WP_API_BASE}/custom/v1/profile`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'omit',
      body: JSON.stringify(data),
    });

    const parsed = await safeReadJson(res);

    if (!res.ok) {
      if (res.status === 401) authService.logout();
      throw buildHttpError(res, parsed.data, parsed.rawText);
    }
    return parsed.data;
  },

  uploadMedia: async (file: File): Promise<any> => {
    const token = getTokenOrThrow();

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${WP_API_BASE}/custom/v1/avatar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'omit',
      body: formData,
    });

    const parsed = await safeReadJson(res);

    if (!res.ok) {
      if (res.status === 401) authService.logout();
      throw buildHttpError(res, parsed.data, parsed.rawText);
    }
    return parsed.data;
  },
};
