// Cliente da API não oficial de Clubs da EA, com cache em memória.
// Se a EA cair, devolve a última resposta boa que tiver (mesmo vencida).

// A EA bloqueia servidores de data center (Vercel incluída). Na produção as chamadas passam
// pela ponte na Cloudflare; localmente dá para ir direto: EA_BASE=https://proclubs.ea.com/api/fc
const BASE = (process.env.EA_BASE || 'https://clubs-proxy.freddie-ceribelli.workers.dev/api/fc').replace(/\/$/, '');
const TTL_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 12000;

const cache = new Map(); // url -> { at, data }

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  Accept: 'application/json',
  Referer: 'https://www.ea.com/',
  Origin: 'https://www.ea.com',
};

let mockSource = null;
export function useMock(source) {
  mockSource = source;
}

export async function eaGet(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE}${path}${qs ? '?' + qs : ''}`;

  if (mockSource) return mockSource(path, params);

  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`EA respondeu ${res.status}`);
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    cache.set(url, { at: Date.now(), data });
    return data;
  } catch (err) {
    if (hit) {
      console.warn(`[ea] falhou (${err.message}), usando cache antigo: ${url}`);
      return hit.data;
    }
    err.message = `Falha ao consultar a EA: ${err.message}`;
    throw err;
  }
}

export const cacheSize = () => cache.size;
