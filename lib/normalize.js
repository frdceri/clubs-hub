// Converte as respostas cruas da EA (tudo string, nomes inconsistentes) em objetos limpos.
import { decodeRegion, positionLabel, ROLE_LABELS, archetypeLabel, archetypeEn, kitColor, FORM } from './lookups.js';

const num = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

export function clubBasic(raw) {
  const info = raw.clubInfo || raw.details || raw;
  const kit = info.customKit || {};
  return {
    id: String(raw.clubId ?? info.clubId),
    name: (raw.clubName || info.name || '').trim(),
    region: decodeRegion(info.regionId),
    color: kitColor(kit.kitColor1) || '#3a3f4b',
    color2: kitColor(kit.kitColor2) || '#8a8f9b',
  };
}

export function searchResult(raw) {
  return {
    ...clubBasic(raw),
    division: num(raw.currentDivision, null),
    bestDivision: num(raw.bestDivision, null),
    games: num(raw.gamesPlayed),
    wins: num(raw.wins),
    draws: num(raw.ties),
    losses: num(raw.losses),
    goalsFor: num(raw.goals),
    goalsAgainst: num(raw.goalsAgainst),
    points: num(raw.points),
  };
}

export function leaderboardRow(raw) {
  return {
    ...clubBasic(raw),
    rank: num(raw.rank),
    skillRating: num(raw.skillRating),
    division: num(raw.currentDivision, null),
    games: num(raw.gamesPlayed),
    wins: num(raw.wins),
    draws: num(raw.ties),
    losses: num(raw.losses),
    goalsFor: num(raw.goals),
    goalsAgainst: num(raw.goalsAgainst),
  };
}

export function overall(raw) {
  if (!raw) return null;
  const form = [];
  for (let i = 0; i < 10; i++) {
    const r = FORM[raw[`lastMatch${i}`]];
    if (r) form.push(r);
  }
  return {
    games: num(raw.gamesPlayed),
    wins: num(raw.wins),
    draws: num(raw.ties),
    losses: num(raw.losses),
    goalsFor: num(raw.goals),
    goalsAgainst: num(raw.goalsAgainst),
    skillRating: num(raw.skillRating, null),
    promotions: num(raw.promotions),
    relegations: num(raw.relegations),
    winStreak: num(raw.wstreak),
    unbeatenStreak: num(raw.unbeatenstreak),
    form, // mais recente primeiro
  };
}

export function members(seasonRaw, careerRaw) {
  const career = new Map((careerRaw?.members || []).map((m) => [m.name, m]));
  return (seasonRaw?.members || []).map((m) => {
    const c = career.get(m.name) || {};
    return {
      gamertag: m.name,
      proName: m.proName,
      position: positionLabel(m.proPos),
      role: ROLE_LABELS[m.favoritePosition] || m.favoritePosition,
      overall: num(m.proOverall, null),
      height: num(m.proHeight, null),
      games: num(m.gamesPlayed),
      winRate: num(m.winRate),
      goals: num(m.goals),
      assists: num(m.assists),
      rating: num(m.ratingAve, null),
      motm: num(m.manOfTheMatch),
      passAccuracy: num(m.passSuccessRate),
      shotAccuracy: num(m.shotSuccessRate),
      tackles: num(m.tacklesMade),
      tackleSuccess: num(m.tackleSuccessRate),
      cleanSheetsGK: num(m.cleanSheetsGK),
      redCards: num(m.redCards),
      career: {
        games: num(c.gamesPlayed),
        goals: num(c.goals),
        assists: num(c.assists),
        motm: num(c.manOfTheMatch),
        rating: num(c.ratingAve, null),
      },
    };
  });
}

function player(raw) {
  const passAtt = num(raw.passattempts);
  return {
    gamertag: raw.playername,
    role: ROLE_LABELS[raw.pos] || raw.pos,
    archetypeId: num(raw.archetypeid, null),
    archetype: archetypeLabel(num(raw.archetypeid, null)),
    archetypeEn: archetypeEn(num(raw.archetypeid, null)),
    rating: num(raw.rating, null),
    goals: num(raw.goals),
    assists: num(raw.assists),
    shots: num(raw.shots),
    passes: num(raw.passesmade),
    passAttempts: passAtt,
    passAccuracy: passAtt ? Math.min(100, Math.round((num(raw.passesmade) / passAtt) * 100)) : null,
    tackles: num(raw.tacklesmade),
    tackleAttempts: num(raw.tackleattempts),
    saves: num(raw.saves),
    motm: raw.mom === '1',
    redCard: num(raw.redcards) > 0,
    minutes: Math.round(num(raw.secondsPlayed) / 60),
    dnf: num(raw.userResult) !== 0, // saiu antes do fim (observado como 6)
  };
}

const ROLE_ORDER = { Goleiro: 0, Defensor: 1, 'Meio-campo': 2, Atacante: 3 };
const byRole = (a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) || (b.rating ?? 0) - (a.rating ?? 0);

export function match(raw, clubId, type) {
  const ids = Object.keys(raw.clubs || {});
  const oppId = ids.find((id) => id !== String(clubId)) || ids[1];
  const side = (id) => {
    const c = raw.clubs[id] || {};
    return {
      ...clubBasic({ clubId: id, details: c.details }),
      goals: num(c.goals),
      players: Object.values(raw.players?.[id] || {}).map(player).sort(byRole),
    };
  };
  const us = side(String(clubId));
  const them = side(oppId);
  const result = us.goals > them.goals ? 'V' : us.goals < them.goals ? 'D' : 'E';
  return {
    id: raw.matchId,
    type,
    timestamp: num(raw.timestamp) * 1000,
    result,
    us,
    them,
  };
}

// Resumo de archetypes usados pelo clube nas partidas carregadas.
export function archetypeUsage(matches) {
  const agg = new Map();
  for (const m of matches) {
    for (const p of m.us.players) {
      if (!p.archetypeId) continue;
      const a = agg.get(p.archetypeId) || { archetypeId: p.archetypeId, archetype: p.archetype, archetypeEn: p.archetypeEn, appearances: 0, ratingSum: 0, goals: 0, assists: 0, players: new Set() };
      a.appearances++;
      a.ratingSum += p.rating || 0;
      a.goals += p.goals;
      a.assists += p.assists;
      a.players.add(p.gamertag);
      agg.set(p.archetypeId, a);
    }
  }
  return [...agg.values()]
    .map(({ ratingSum, players, ...a }) => ({ ...a, avgRating: +(ratingSum / a.appearances).toFixed(2), players: [...players] }))
    .sort((a, b) => b.appearances - a.appearances);
}
