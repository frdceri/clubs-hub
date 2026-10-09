// Lógica das rotas da API, compartilhada entre o servidor local (server.js)
// e as funções serverless da Vercel (pasta api/).
import { eaGet } from './ea.js';
import * as N from './normalize.js';

const PLATFORM = process.env.PLATFORM || 'common-gen5';
const P = { platform: PLATFORM };
const MATCH_TYPES = { league: 'leagueMatch', playoff: 'playoffMatch', friendly: 'friendlyMatch' };
const inAmericas = (c) => c.region.americas;

export const httpError = (status, message) => Object.assign(new Error(message), { status });

export async function search(q, region) {
  if (!q || q.trim().length < 2) return { clubs: [] };
  const raw = await eaGet('/allTimeLeaderboard/search', { ...P, clubName: q.trim() });
  let clubs = (Array.isArray(raw) ? raw : []).map(N.searchResult);
  if (region === 'americas') clubs = clubs.filter(inAmericas);
  return { clubs };
}

export async function leaderboard(region) {
  const raw = await eaGet('/allTimeLeaderboard', P);
  let rows = (Array.isArray(raw) ? raw : []).map(N.leaderboardRow);
  const total = rows.length;
  if (region === 'americas') rows = rows.filter(inAmericas);
  return { rows, total };
}

export async function club(id) {
  if (!/^\d+$/.test(String(id))) throw httpError(400, 'ID de clube inválido');

  const safe = (p) => p.catch((e) => (console.warn('[club]', e.message), null));
  const [info, overallRaw, season, career, ...matchLists] = await Promise.all([
    eaGet('/clubs/info', { ...P, clubIds: id }),
    safe(eaGet('/clubs/overallStats', { ...P, clubIds: id })),
    safe(eaGet('/members/stats', { ...P, clubId: id })),
    safe(eaGet('/members/career/stats', { ...P, clubId: id })),
    ...Object.values(MATCH_TYPES).map((t) => safe(eaGet('/clubs/matches', { ...P, clubIds: id, matchType: t, maxResultCount: 10 }))),
  ]);

  const infoRaw = info?.[id];
  if (!infoRaw) throw httpError(404, 'Clube não encontrado');

  const matches = Object.keys(MATCH_TYPES)
    .flatMap((type, i) => (Array.isArray(matchLists[i]) ? matchLists[i] : []).map((m) => N.match(m, id, type)))
    .sort((a, b) => b.timestamp - a.timestamp);

  return {
    club: N.clubBasic({ clubId: id, clubInfo: infoRaw }),
    overall: N.overall(Array.isArray(overallRaw) ? overallRaw[0] : null),
    members: N.members(season, career),
    matches,
    archetypes: N.archetypeUsage(matches),
  };
}

// Adaptador para funções da Vercel: resposta JSON + cache na CDN da Vercel.
// s-maxage=300: a CDN guarda 5 min; stale-while-revalidate: serve o antigo enquanto atualiza.
export function vercelHandler(fn, cacheSeconds = 300) {
  return async (req, res) => {
    try {
      const data = await fn(req.query || {});
      res.setHeader('Cache-Control', `public, s-maxage=${cacheSeconds}, stale-while-revalidate=86400`);
      res.status(200).json(data);
    } catch (err) {
      console.error(`[api] ${req.url}: ${err.message}`);
      res.setHeader('Cache-Control', 'no-store');
      res.status(err.status || 502).json({ error: err.message });
    }
  };
}
