export interface UserData {
  id: number;
  token: string;
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

export const authService = {
  login: async (username: string, password: string): Promise<UserData> => {
    const API_URL = getApiBase();

    const res = await fetch(`${API_URL}/custom/v1/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },

      // Em DEV (porta diferente), "include" pode disparar bloqueio de CORS.
      // Como o endpoint já devolve token/nonce, não precisamos de cookie aqui.
      credentials: 'omit',

      body: JSON.stringify({ username, password }),
    });

    const { data, rawText } = await safeReadJson(res);

    console.log('LOGIN URL:', `${API_URL}/custom/v1/login`);
    console.log('LOGIN HTTP:', res.status, res.statusText);
    console.log('LOGIN RAW (head):', (rawText || '').slice(0, 400));
    console.log('LOGIN JSON:', data);

    if (!res.ok) throw buildHttpError(res, data, rawText);
    if (!data) throw new Error('Login retornou HTTP 200, mas corpo veio vazio.');
    if (data.code === 'invalid_auth') throw new Error('Credenciais inválidas.');

    const user: UserData = {
      id: data.user_id || 0,
      token: data.token || data.nonce || 'session_token',
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
    return stored ? JSON.parse(stored) : null;
  },
};
