
export type HttpError = {
  status: number;
  url: string;
  data: any;
  message: string;
};

const DEFAULT_TIMEOUT = 15000; 

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
 * Wrapper de fetch robusto utilizando caminhos relativos.
 * O Vite proxy no VPS encaminha /2 e /cachecko para o destino correto.
 */
async function httpRequest(url: string, init: RequestInit & { timeoutMs?: number; retries?: number } = {}): Promise<{ data: any; headers: Headers; url: string }> {
  const { timeoutMs = DEFAULT_TIMEOUT, retries = 1, ...fetchOpts } = init;
  
  const attempt = async (remaining: number): Promise<{ data: any; headers: Headers; url: string }> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOpts,
        signal: controller.signal,
        credentials: 'omit' // Evita conflitos de cookies em ambientes de dev
      });

      clearTimeout(id);
      
      if (!response.ok) {
        // Backoff simples para erro 429 ou erros de rede temporários
        if (response.status === 429 || response.status >= 500) {
            if (remaining > 0) {
                await new Promise(r => setTimeout(r, 2000));
                return attempt(remaining - 1);
            }
        }
        const data = await safeJson(response);
        throw { status: response.status, url, data, message: `HTTP ${response.status}` } as HttpError;
      }

      const json = await response.json();
      return { data: json, headers: response.headers, url };
      
    } catch (error: any) {
      clearTimeout(id);
      
      if (error.name === 'AbortError') {
          throw { status: 0, url, data: null, message: 'Timeout' } as HttpError;
      }

      if (remaining > 0) {
          await new Promise(r => setTimeout(r, 1000));
          return attempt(remaining - 1);
      }
      
      throw { status: 0, url, data: null, message: 'Network Error' } as HttpError;
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
