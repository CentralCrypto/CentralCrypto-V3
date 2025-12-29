import { authService } from './auth';

// Base absoluta do WP (não usa path relativo, porque DEV roda em outra origem)
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
  const ct = res.headers.get('content-type') || '';
  const snippet = (rawText || '').slice(0, 400);

  let msg = `Erro HTTP ${res.status} (${res.statusText}).`;
  if (data?.message) msg += ` ${data.message}`;
  if (data?.code) msg += ` [${data.code}]`;

  if (!data) {
    msg += ` Resposta não-JSON ou vazia. content-type="${ct}".`;
    msg += snippet ? ` Body (início): ${snippet}` : ` Body vazio.`;
  }
  return new Error(msg);
}

export const userService = {
  // ✅ PERFIL (usar /custom/v1/me com Bearer token)
  getProfile: async (): Promise<any> => {
    const logged = authService.getCurrentUser();
    if (!logged?.token) throw new Error('Sessão inválida. Faça login novamente.');

    const res = await fetch(`${WP_API_BASE}/custom/v1/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${logged.token}`,
        'Content-Type': 'application/json',
      },
      // Não usar cookie (evita SameSite/CORS)
      credentials: 'omit',
    });

    const { data, rawText } = await safeReadJson(res);

    if (!res.ok) throw buildHttpError(res, data, rawText);
    if (!data?.success) throw new Error('Resposta inválida ao carregar perfil.');

    // avatar já vem pronto do /me, mas mantém fallback
    const avatarUrl =
      data.avatar_url ||
      (logged?.avatar_url ?? null);

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

  // ⚠️ updateProfile ainda depende do WP /wp/v2/users/{id}
  // Isso normalmente exige cookie + nonce válido do WP na mesma origem.
  // Mantive como estava, mas com base absoluta.
  updateProfile: async (userId: number, data: any): Promise<any> => {
    const user = authService.getCurrentUser();
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (user?.token) headers['X-WP-Nonce'] = user.token;

    const res = await fetch(`${WP_API_BASE}/wp/v2/users/${userId}`, {
      method: 'POST',
      credentials: 'include',
      headers: headers,
      body: JSON.stringify(data),
    });

    const parsed = await safeReadJson(res);
    if (!res.ok) {
      const msg = parsed.data?.message || 'Falha ao atualizar perfil';
      throw new Error(msg);
    }
    return parsed.data;
  },

  // ⚠️ uploadMedia idem (cookie + nonce + permissões)
  uploadMedia: async (file: File): Promise<any> => {
    const user = authService.getCurrentUser();
    if (!user?.token) throw new Error('Não autenticado para upload');

    const formData = new FormData();
    formData.append('file', file);

    const headers: HeadersInit = {
      'X-WP-Nonce': user.token,
      'Content-Disposition': `attachment; filename="${file.name}"`,
    };

    const res = await fetch(`${WP_API_BASE}/wp/v2/media`, {
      method: 'POST',
      credentials: 'include',
      headers: headers,
      body: formData,
    });

    const parsed = await safeReadJson(res);
    if (!res.ok) throw new Error(parsed.data?.message || 'Erro no upload da imagem');
    return parsed.data;
  },
};
