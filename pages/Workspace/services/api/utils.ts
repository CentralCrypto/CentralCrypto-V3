
// --- MOTOR DE BUSCA COM FALLBACK ---
export const fetchWithFallback = async (url: string, timeoutMs: number = 20000): Promise<any | null> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    
    // Correção: Verifica se já existe '?' na URL para usar o separador correto
    const separator = url.includes('?') ? '&' : '?';
    const targetUrl = `${url}${separator}t=${Date.now()}`;

    try {
        const response = await fetch(targetUrl, { 
            cache: 'no-store',
            signal: controller.signal
        });
        clearTimeout(id);
        if (response.ok) return await response.json();
    } catch (e) {
        clearTimeout(id);
    }

    // Tenta proxies apenas se a chamada direta falhar (CORS ou Timeout)
    try {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
        const response = await fetch(proxyUrl);
        if (response.ok) return await response.json();
    } catch (e) {}

    try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
        const response = await fetch(proxyUrl);
        if (response.ok) return await response.json();
    } catch (e) {}
    
    return null;
};

const STABLECOINS = ['USDT', 'USDC', 'DAI', 'FDUSD', 'TUSD', 'USDD', 'PYUSD', 'USDE', 'GUSD', 'USDP', 'BUSD'];
export const isStablecoin = (symbol: string) => STABLECOINS.includes(symbol.toUpperCase());
