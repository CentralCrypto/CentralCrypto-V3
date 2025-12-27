
export type HttpError = {
  status: number;
  url: string;
  data: any;
  message: string;
};

const DEFAULT_TIMEOUT = 15000; 

/**
 * Detecta se precisamos de proxy para evitar CORS (quando em localhost ou preview)
 */
const shouldProxy = () => {
    if (typeof window === 'undefined') return false;
    return !window.location.hostname.includes('centralcrypto.com.br');
};

/**
 * Transforma uma URL em uma requisição via Proxy CORS se necessário
 */
const getFinalUrl = (url: string) => {
    if (!shouldProxy() || !url.startsWith('http')) return url;
    return `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
};

export async function safeJson(res: Response): Promise<any> {
  try {
    const text = await res.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch (e) {
    return {};
  }
}

/**
 * Wrapper de fetch robusto com política de proxy CORS e tempo esgotado
 */
async function httpRequest(url: string, init: RequestInit & { timeoutMs?: number; retries?: number } = {}): Promise<{ data: any; headers: Headers; url: string }> {
  const { timeoutMs = DEFAULT_TIMEOUT, retries = 1, ...fetchOpts } = init;
  
  const attempt = async (remaining: number): Promise<{ data: any; headers: Headers; url: string }> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    const isProxy = shouldProxy() && url.startsWith('http');
    const targetUrl = isProxy ? getFinalUrl(url) : url;

    try {
      const response = await fetch(targetUrl, {
        ...fetchOpts,
        signal: controller.signal,
        credentials: 'omit'
      });

      clearTimeout(id);
      
      if (!response.ok) {
        if (remaining > 0) return attempt(remaining - 1);
        const data = await safeJson(response);
        throw { status: response.status, url, data, message: `HTTP ${response.status}` } as HttpError;
      }

      const json = await response.json();
      
      // Se for proxy, os dados reais estão dentro de .contents
      if (isProxy && json.contents) {
          try {
              const realData = JSON.parse(json.contents);
              return { data: realData, headers: response.headers, url };
          } catch(e) {
              return { data: json.contents, headers: response.headers, url };
          }
      }

      return { data: json, headers: response.headers, url };
    } catch (error: any) {
      clearTimeout(id);
      if (remaining > 0 && error.name !== 'AbortError') {
          await new Promise(r => setTimeout(r, 1000));
          return attempt(remaining - 1);
      }
      
      const msg = error.name === 'AbortError' ? 'Timeout' : 'Network Error';
      throw { status: 0, url, data: null, message: msg } as HttpError;
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
