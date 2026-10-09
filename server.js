// Servidor local do MVP: serve o site e faz de ponte (proxy + cache) para a API da EA.
// Sem dependências: precisa só de Node 18 ou mais novo.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize as normPath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eaGet, useMock, cacheSize } from './lib/ea.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;
const MOCK = process.argv.includes('--mock') || process.env.MOCK === '1';

if (MOCK) {
  const { mockSource } = await import('./mock/mock-data.js');
  useMock(mockSource);
}

import { search, leaderboard, club } from './lib/routes.js';

// ---------- infraestrutura HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}

async function serveStatic(res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const file = normPath(join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) return send(res, 403, { error: 'Proibido' });
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    // rotas do front (#/...) caem no index
    const index = await readFile(join(PUBLIC, 'index.html'));
    res.writeHead(200, { 'Content-Type': MIME['.html'] });
    res.end(index);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname, searchParams } = url;
  const started = Date.now();
  try {
    if (pathname === '/api/health') return send(res, 200, { ok: true, mock: MOCK, platform: process.env.PLATFORM || 'common-gen5', cached: cacheSize() });
    if (pathname === '/api/search') return send(res, 200, await search(searchParams.get('q'), searchParams.get('region')));
    if (pathname === '/api/leaderboard') return send(res, 200, await leaderboard(searchParams.get('region')));
    const m = pathname.match(/^\/api\/club\/([^/]+)$/);
    if (m) return send(res, 200, await club(m[1]));
    if (pathname.startsWith('/api/')) return send(res, 404, { error: 'Rota não encontrada' });
    return serveStatic(res, pathname);
  } catch (err) {
    console.error(`[erro] ${pathname}: ${err.message}`);
    send(res, err.status || 502, { error: err.message });
  } finally {
    if (pathname.startsWith('/api/')) console.log(`${req.method} ${pathname}${url.search} ${res.statusCode} ${Date.now() - started}ms`);
  }
});

server.listen(PORT, () => {
  console.log(`\n  Clubs Hub rodando em http://localhost:${PORT}`);
  console.log(`  Plataforma: ${process.env.PLATFORM || 'common-gen5'}${MOCK ? '  |  MODO MOCK (dados de exemplo)' : ''}\n`);
});
