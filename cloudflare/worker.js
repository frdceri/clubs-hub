// Ponte para a API de Clubs da EA (roda como Cloudflare Worker "clubs-proxy").
// A EA bloqueia data centers como a Vercel; pela rede da Cloudflare ela responde.
// Só repassa leituras (GET) de /api/fc/...
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'GET' || !url.pathname.startsWith('/api/fc/')) {
      return new Response('Not found', { status: 404 });
    }
    const target = 'https://proclubs.ea.com' + url.pathname + url.search;
    const res = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Referer': 'https://www.ea.com/',
        'Origin': 'https://www.ea.com',
      },
      cf: { cacheTtl: 120, cacheEverything: true },
    });
    return new Response(res.body, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    });
  },
};
