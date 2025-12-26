
export type HttpError = {
  status: number;
  url: string;
  data: any;
  message: string;
};

const DEFAULT_TIMEOUT = 12000;

export async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
}

/**
 * Wrapper ultra-leve para evitar bloqueios de CORS em endpoints nativos
 */
async function httpRequest(url: string, init: RequestInit & { timeoutMs?: number; retries?: number } = {}): Promise<{ data: any; headers: Headers; url: string }> {
  const { timeoutMs = DEFAULT_TIMEOUT, retries = 0, ...fetchOpts } = init;
  
  const attempt = async (remaining: number): Promise<{ data: any; headers: Headers; url: string }> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Para GET, não enviamos NENHUM header customizado para manter a requisição como "Simple Request"
      const response = await fetch(url, {
        ...fetchOpts,
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit' // Evita problemas com cookies de terceiros/CORS
      });

      clearTimeout(id);
      const data = await safeJson(response);

      if (!response.ok) {
        if (remaining > 0) return attempt(remaining - 1);
        const errorMessage = (typeof data === 'object' && data?.message) ? data.message : `HTTP ${response.status}`;
        throw { status: response.status, url, data, message: errorMessage } as HttpError;
      }

      return { data, headers: response.headers, url };
    } catch (error: any) {
      clearTimeout(id);
      if (remaining > 0 && error.name !== 'AbortError') return attempt(remaining - 1);
      
      throw { 
        status: 0, 
        url, 
        data: null, 
        message: error.name === 'AbortError' ? 'Tempo esgotado' : 'Bloqueio de conexão (CORS/Rede)' 
      } as HttpError;
    }
  };

  return attempt(retries);
}

export async function httpGetJson(url: string, opts: { timeoutMs?: number; signal?: AbortSignal; retries?: number } = {}) {
  return httpRequest(url, { method: 'GET', ...opts });
}

export async function httpPostJson(url: string, body: any, opts: { timeoutMs?: number; headers?: Record<string, string> } = {}) {
  return httpRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
}
