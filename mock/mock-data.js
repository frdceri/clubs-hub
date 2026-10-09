// Dados de exemplo no MESMO formato cru da API da EA (capturado em out/2026).
// Nomes de clubes e jogadores são inventados. Usado com `npm run mock`.

let seed = 27;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const int = (a, b) => Math.floor(a + rnd() * (b - a + 1));
const pick = (arr) => arr[int(0, arr.length - 1)];

// códigos de região em ASCII -> número, como a EA envia
const region = (code) => parseInt([...code].map((c) => c.charCodeAt(0).toString(16)).join(''), 16);

const CLUBS = [
  ['1001', 'Várzea Real FC', 'SAM2', 3, 16765440],
  ['1002', 'Tropa do Pampa', 'SAM2', 2, 1255441],
  ['1003', 'Los Cóndores', 'SAM4', 4, 12706617],
  ['1004', 'Azteca United', 'CAM', 2, 33627],
  ['1005', 'Brooklyn Kings', 'EUS', 1, 592653],
  ['1006', 'Pacific Coast SC', 'WUS2', 3, 396864],
  ['1007', 'Lisboa Stars', 'SEU', 1, 15921906],
  ['1008', 'Northern Lads', 'BIS', 1, 11786],
  ['1009', 'Real Várzea B', 'SAM2', 6, 5775459],
  ['1010', 'Fúria Paulista', 'SAM2', 1, 10066329],
];
const clubInfo = ([id, name, reg, , color]) => ({
  name, clubId: Number(id), regionId: region(reg), teamId: 1370,
  customKit: { kitColor1: String(color), kitColor2: '15921906', crestAssetId: '99160519' },
});

const SQUADS = {};
const TAGS = ['Zeca10', 'xNandoBR', 'ElPibe_9', 'Mudinho', 'LobaoGK', 'Thiaguinho77', 'KingDavi', 'Rato_Atomico', 'Juanma_ARG', 'Tchutchuca', 'Bigode', 'ManoJota', 'Pedrinho_GS', 'FerrugemFC', 'Cobra_CR'];
const ROLES = ['goalkeeper', 'defender', 'defender', 'midfielder', 'midfielder', 'forward', 'forward'];
const POS_BY_ROLE = { goalkeeper: 0, defender: 5, midfielder: 14, forward: 25 };
const ARCH_BY_ROLE = { goalkeeper: [1, 2], defender: [3, 4, 5], midfielder: [6, 7, 8, 9], forward: [10, 11, 12, 13] };
for (const c of CLUBS) {
  const tags = [...TAGS].sort(() => rnd() - 0.5).slice(0, 7);
  SQUADS[c[0]] = tags.map((t, i) => ({ tag: `${t}${c[0].slice(-1)}`, role: ROLES[i], arch: pick(ARCH_BY_ROLE[ROLES[i]]) }));
}

function leaderboardRaw(c, rank) {
  const gp = int(20, 140), w = int(Math.floor(gp * 0.3), Math.floor(gp * 0.8)), t = int(0, gp - w), l = gp - w - t;
  const gf = w * 3 + int(0, 30), ga = l * 2 + int(0, 20);
  return {
    rank, skillRating: String(2400 - rank * 37), clubId: c[0], clubName: c[1], currentDivision: String(c[3]), bestDivision: String(Math.max(1, c[3] - 1)),
    wins: String(w), ties: String(t), losses: String(l), gamesPlayed: String(gp), goals: String(gf), goalsAgainst: String(ga),
    points: String(w * 3 + t), clubInfo: clubInfo(c), platform: 'common-gen5',
  };
}
const LB = CLUBS.map((c, i) => leaderboardRaw(c, i + 1));

function playerRaw(p, won, goals) {
  const role = p.role;
  const g = role === 'forward' ? int(0, Math.min(3, goals)) : role === 'midfielder' ? int(0, 1) : 0;
  return {
    archetypeid: String(p.arch), playername: p.tag, pos: role,
    goals: String(g), assists: String(role === 'goalkeeper' ? 0 : int(0, 2)), shots: String(role === 'forward' ? int(1, 7) : int(0, 2)),
    ...(() => { const att = int(8, 55); return { passattempts: String(att), passesmade: String(Math.round(att * (0.6 + rnd() * 0.35))) }; })(),
    ...(() => { const att = int(0, 15); return { tackleattempts: String(att), tacklesmade: String(int(0, Math.min(att, 5))) }; })(),
    saves: String(role === 'goalkeeper' ? int(1, 9) : 0), rating: (won ? 6.8 + rnd() * 3.2 : 5 + rnd() * 2.8).toFixed(2),
    mom: '0', redcards: rnd() < 0.03 ? '1' : '0', secondsPlayed: '5580', userResult: rnd() < 0.05 ? '6' : '0', vproattr: 'NH',
  };
}

function matchRaw(clubId, i, type) {
  const me = CLUBS.find((c) => c[0] === clubId);
  const opp = pick(CLUBS.filter((c) => c[0] !== clubId));
  const gf = int(0, 5), ga = int(0, 4);
  const ts = 1791000000 - i * 3600 * int(5, 30) - (type === 'friendlyMatch' ? 7200 : 0);
  const side = (c, goals, against) => ({ goals: String(goals), goalsAgainst: String(against), result: goals > against ? '1' : goals < against ? '2' : '4', details: clubInfo(c) });
  const players = (c, won, goals) => {
    const list = (SQUADS[c[0]] || []).map((p) => playerRaw(p, won, goals));
    if (list.length) list.sort((a, b) => b.rating - a.rating)[0].mom = won ? '1' : '0';
    return Object.fromEntries(list.map((p, k) => [String(900000 + k), p]));
  };
  return {
    matchId: `${clubId}${type.length}${i}`, timestamp: ts,
    clubs: { [me[0]]: side(me, gf, ga), [opp[0]]: side(opp, ga, gf) },
    players: { [me[0]]: players(me, gf > ga, gf), [opp[0]]: players(opp, ga > gf, ga) },
  };
}

export async function mockSource(path, params) {
  await new Promise((r) => setTimeout(r, 120)); // simula latência
  const id = params.clubIds || params.clubId;
  const c = CLUBS.find((x) => x[0] === String(id));
  switch (path) {
    case '/allTimeLeaderboard/search': {
      const q = String(params.clubName || '').toLowerCase();
      return LB.filter((r) => r.clubName.toLowerCase().includes(q));
    }
    case '/allTimeLeaderboard':
      return LB;
    case '/clubs/info':
      return c ? { [c[0]]: clubInfo(c) } : {};
    case '/clubs/overallStats': {
      if (!c) return [];
      const r = LB.find((x) => x.clubId === c[0]);
      const form = Object.fromEntries(Array.from({ length: 10 }, (_, k) => [`lastMatch${k}`, String(pick([1, 1, 2, 3]))]));
      return [{ clubId: c[0], gamesPlayed: r.gamesPlayed, wins: r.wins, ties: r.ties, losses: r.losses, goals: r.goals, goalsAgainst: r.goalsAgainst, skillRating: r.skillRating, promotions: '2', relegations: '0', wstreak: '2', unbeatenstreak: '4', ...form }];
    }
    case '/members/stats':
    case '/members/career/stats': {
      if (!c) return { members: [] };
      return {
        members: SQUADS[c[0]].map((p) => ({
          name: p.tag, proName: p.tag.replace(/\d+$/, ''), proPos: String(POS_BY_ROLE[p.role]), favoritePosition: p.role,
          proOverall: String(int(72, 88)), proHeight: String(int(168, 196)), gamesPlayed: String(int(5, 90)), winRate: String(int(35, 80)),
          goals: String(p.role === 'forward' ? int(10, 70) : p.role === 'goalkeeper' ? 0 : int(0, 15)), assists: String(int(0, 50)), ratingAve: (6.5 + rnd() * 2.2).toFixed(1),
          manOfTheMatch: String(int(0, 15)), passSuccessRate: String(int(65, 90)), shotSuccessRate: String(int(15, 55)),
          tacklesMade: String(int(0, 80)), tackleSuccessRate: String(int(10, 45)), cleanSheetsGK: String(p.role === 'goalkeeper' ? int(2, 20) : 0), redCards: String(int(0, 2)),
        })),
      };
    }
    case '/clubs/matches': {
      if (!c) return [];
      const n = params.matchType === 'leagueMatch' ? 8 : params.matchType === 'friendlyMatch' ? 4 : 0;
      return Array.from({ length: n }, (_, i) => matchRaw(c[0], i, params.matchType));
    }
    default:
      return null;
  }
}
