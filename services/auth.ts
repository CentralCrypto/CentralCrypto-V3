export interface UserData {
  id: number;
  token: string; // ✅ auth token (Bearer)
  wp_nonce?: string; // opcional: nonce wp_rest, se um dia precisar
  user_email: string;
  user_nicename: string;
  user_display_name: string;
  avatar_url?: string;
  roles: string[];
  first_name?: string;
  last_name?: string;
  description?: string;
}

function getApiBase(): string {
  const fromEnv = (import.meta as any).env?.VITE_WP_API_BASE;
  return (fromEnv && String(fromEnv).trim())
    ? String(fromEnv).trim().replace(/\/+$/, '')
    : 'https://centralcrypto.com.br/2/wp-json';
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

function isValidAuthToken(t: string): boolean {
  const s = String(t || '').trim();
  // teu token válido é hex grande (ex: b10848...); nonce é curtinho (~10)
  return s.length >= 20;
}

export const authService = {
  login: async (username: string, password: string): Promise<UserData> => {
    const API_URL = getApiBase();

    const res = await fetch(`${API_URL}/custom/v1/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify({ username, password }),
    });

    const { data, rawText } = await safeReadJson(res);

    if (!res.ok) throw buildHttpError(res, data, rawText);
    if (!data) throw new Error('Login retornou HTTP 200, mas corpo veio vazio.');
    if (data.code === 'invalid_auth') throw new Error('Credenciais inválidas.');

    const token = String(data.token || '').trim();
    if (!isValidAuthToken(token)) {
      throw new Error('Login retornou token inválido. Limpe o storage e tente novamente.');
    }

    const user: UserData = {
      id: data.user_id || 0,
      token: token, // ✅ SEM FALLBACK PRA NONCE
      wp_nonce: data.nonce ? String(data.nonce).trim() : undefined,
      user_email: data.user_email || '',
      user_nicename: data.user_nicename || username,
      user_display_name: data.user_display_name || username,
      avatar_url: data.avatar_url,
      roles: Array.isArray(data.roles) ? data.roles : [],
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      description: data.description || '',
    };

    localStorage.setItem('central_user', JSON.stringify(user));
    return user;
  },

  logout: () => {
    localStorage.removeItem('central_user');
  },

  getCurrentUser: (): UserData | null => {
    const stored = localStorage.getItem('central_user');
    if (!stored) return null;

    try {
      const u = JSON.parse(stored) as UserData;
      if (!u?.token || !isValidAuthToken(u.token)) {
        localStorage.removeItem('central_user');
        return null;
      }
      return u;
    } catch {
      localStorage.removeItem('central_user');
      return null;
    }
  },

  // Fix: Add missing 'register', 'resetPassword', and 'validateEmail' methods
  register: async (email: string, password: string): Promise<any> => {
    const API_URL = getApiBase();
    const res = await fetch(`${API_URL}/custom/v1/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const { data, rawText } = await safeReadJson(res);
    if (!res.ok) throw buildHttpError(res, data, rawText);
    if (data?.code && data.code !== 'success' && data.code !== 'user_registered') {
        throw new Error(data.message || 'Erro desconhecido no registro.');
    }
    return data;
  },

  resetPassword: async (email: string): Promise<any> => {
    const API_URL = getApiBase();
    const res = await fetch(`${API_URL}/custom/v1/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const { data, rawText } = await safeReadJson(res);
    if (!res.ok) throw buildHttpError(res, data, rawText);
    return data;
  },

  validateEmail: async (userId: number, key: string): Promise<any> => {
    const API_URL = getApiBase();
    const res = await fetch(`${API_URL}/custom/v1/validate-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, key }),
    });
    const { data, rawText } = await safeReadJson(res);
    if (!res.ok) throw buildHttpError(res, data, rawText);
    if (!data?.success) throw new Error(data?.message || 'Chave de validação inválida.');
    return data;
  },
};
