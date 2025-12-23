import { authService } from './auth';

const API_URL = 'https://centralcrypto.com.br/2/wp-json';

export const userService = {
  getProfile: async (): Promise<any> => {
    const logged = authService.getCurrentUser();

    try {
      const res = await fetch(`${API_URL}/wp/v2/users/me?context=edit`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Erro na API de Perfil:', res.status, errorText);
        throw new Error('Falha ao carregar perfil. Verifique sua conexão ou se a sessão expirou.');
      }

      const data = await res.json();
      console.log('FRESH PROFILE FROM WP:', data);

      const avatarUrl =
        (data.simple_local_avatar && data.simple_local_avatar.full) ||
        (data.avatar_urls ? data.avatar_urls['96'] : null) ||
        (logged?.avatar_url ?? null);

      return {
        id: data.id || (logged?.id ?? 0),
        username: data.username,
        name: data.name || data.username,
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email,
        description: data.description || '',
        roles: data.roles || (logged?.roles ?? []),
        avatar_url: avatarUrl,
      };
    } catch (error) {
      console.error('Erro no serviço getProfile:', error);
      throw error;
    }
  },

  updateProfile: async (userId: number, data: any): Promise<any> => {
    const user = authService.getCurrentUser();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (user?.token) {
      headers['X-WP-Nonce'] = user.token;
    }

    const res = await fetch(`${API_URL}/wp/v2/users/${userId}`, {
      method: 'POST',
      credentials: 'include',
      headers: headers,
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errorBody = await res.json();
      throw new Error(errorBody.message || 'Falha ao atualizar perfil');
    }
    return await res.json();
  },

  uploadMedia: async (file: File): Promise<any> => {
    const user = authService.getCurrentUser();
    if (!user?.token) throw new Error('Não autenticado para upload');

    const formData = new FormData();
    formData.append('file', file);

    const headers: HeadersInit = {
      'X-WP-Nonce': user.token,
      'Content-Disposition': `attachment; filename="${file.name}"`,
    };

    const res = await fetch(`${API_URL}/wp/v2/media`, {
      method: 'POST',
      credentials: 'include',
      headers: headers,
      body: formData,
    });

    if (!res.ok) {
      const errorBody = await res.json();
      throw new Error(errorBody.message || 'Erro no upload da imagem');
    }
    return await res.json();
  },
};
