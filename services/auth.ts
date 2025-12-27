
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

const API_URL = '/2/wp-json';

export const authService = {
  login: async (username: string, password: string): Promise<UserData> => {
    try {
      const res = await fetch(`${API_URL}/custom/v1/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Erro no login.');
      }

      const user: UserData = {
        id: data.user_id || 0,
        token: data.token || data.nonce || 'session_token',
        user_email: data.user_email,
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
    } catch (error: any) {
      throw new Error(error.message || 'Erro de conexão com o servidor.');
    }
  },

  register: async (email: string, password: string): Promise<any> => {
    try {
      const res = await fetch(`${API_URL}/custom/v1/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro no registro.');
      return data;
    } catch (error: any) {
      throw new Error(error.message || 'Falha no registro.');
    }
  },

  resetPassword: async (email: string): Promise<any> => {
    try {
      const res = await fetch(`${API_URL}/custom/v1/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          redirect_url: window.location.origin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro ao solicitar reset.');
      return data;
    } catch (error: any) { throw error; }
  },

  validateEmail: async (userId: number, key: string): Promise<any> => {
    try {
      const res = await fetch(`${API_URL}/custom/v1/validate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ u: userId, k: key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro ao validar conta.');
      return data;
    } catch (error: any) {
      throw new Error(error.message || 'Falha na validação.');
    }
  },

  logout: () => {
    localStorage.removeItem('central_user');
  },

  getCurrentUser: (): UserData | null => {
    const stored = localStorage.getItem('central_user');
    return stored ? JSON.parse(stored) : null;
  },
};
