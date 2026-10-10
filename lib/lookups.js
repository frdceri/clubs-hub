// Tabelas de tradução dos códigos que a API da EA devolve.

// regionId vem como número; em hexadecimal ele é texto ASCII (ex.: 1396788530 -> "SAM2").
// O sufixo numérico parece indicar sub-região/servidor; agrupamos pelo prefixo.
// Os nomes abaixo são inferidos a partir dos códigos — confirmar com clubes conhecidos.
const REGION_LABELS = {
  SAM: 'América do Sul',
  CAM: 'América Central / México',
  EUS: 'EUA Leste',
  WUS: 'EUA Oeste',
  CUS: 'EUA Central',
  SEU: 'Europa Sul',
  WEU: 'Europa Oeste',
  EEU: 'Europa Leste',
  NEU: 'Europa Norte',
  BIS: 'Ilhas Britânicas',
  MEA: 'Oriente Médio / África',
  SAF: 'África do Sul',
  AUS: 'Oceania',
  NAS: 'NAS (a confirmar)',
};

export const AMERICAS = new Set(['SAM', 'CAM', 'EUS', 'WUS', 'CUS']);

// Regiões do menu do site: cada uma junta um ou mais prefixos de região da EA.
// null = sem filtro. A ordem aqui é a ordem do menu.
export const REGION_GROUPS = {
  americas: { label: 'Américas', prefixes: [...AMERICAS] },
  sam: { label: 'América do Sul', prefixes: ['SAM'] },
  cam: { label: 'América Central / México', prefixes: ['CAM'] },
  usa: { label: 'EUA', prefixes: ['EUS', 'WUS', 'CUS'] },
  europe: { label: 'Europa', prefixes: ['SEU', 'WEU', 'EEU', 'NEU', 'BIS'] },
  other: { label: 'Outras regiões', prefixes: ['MEA', 'SAF', 'AUS', 'NAS'] },
  all: { label: 'Todas as regiões', prefixes: null },
};

export function inRegionGroup(region, group) {
  const g = REGION_GROUPS[group] || REGION_GROUPS.all;
  return !g.prefixes || g.prefixes.includes(region.prefix);
}

// Quantos itens caem em cada região do menu.
export function regionCounts(items) {
  return Object.fromEntries(Object.keys(REGION_GROUPS).map((k) => [k, items.filter((i) => inRegionGroup(i.region, k)).length]));
}

export function decodeRegion(regionId) {
  const n = Number(regionId);
  if (!Number.isFinite(n) || n <= 0) return { code: '?', prefix: '?', label: 'Desconhecida', americas: false };
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const code = hex.match(/../g).map((h) => String.fromCharCode(parseInt(h, 16))).join('');
  const prefix = code.replace(/\d+$/, '');
  return {
    code,
    prefix,
    label: REGION_LABELS[prefix] || code,
    americas: AMERICAS.has(prefix),
  };
}

// IDs de posição padrão da série FIFA/FC (proPos no endpoint de membros).
const POSITIONS = {
  0: 'GOL', 1: 'LIB', 2: 'ALD', 3: 'LD', 4: 'ZAG', 5: 'ZAG', 6: 'ZAG', 7: 'LE', 8: 'ALE',
  9: 'VOL', 10: 'VOL', 11: 'VOL', 12: 'MD', 13: 'MC', 14: 'MC', 15: 'MC', 16: 'ME',
  17: 'MEI', 18: 'MEI', 19: 'MEI', 20: 'SA', 21: 'SA', 22: 'SA', 23: 'PD', 24: 'ATA',
  25: 'ATA', 26: 'ATA', 27: 'PE',
};
export const positionLabel = (id) => POSITIONS[Number(id)] ?? '—';

export const ROLE_LABELS = {
  goalkeeper: 'Goleiro',
  defender: 'Defensor',
  midfielder: 'Meio-campo',
  forward: 'Atacante',
};

// archetypeid (1 a 13) aparece em cada jogador de cada partida. A EA não publica a tabela,
// mas a ordem oficial (goleiros, defensores, meias, atacantes) bate com os dados reais:
// o 1 só aparece em goleiros, o 13 em centroavantes altos, o 12 no artilheiro baixo,
// o 9 no meia com mais assistências. Se algum número se provar errado, corrija aqui.
// Nome em português (como aparece no jogo em PT-BR) e o equivalente em inglês dos guias.
// Fontes: guia GameOverdrive do FC 27 e Pitch Notes oficiais da EA em PT-BR (Compasso, Cérebro, Maestro).
export const ARCHETYPES = {
  1: { pt: 'Muralha', en: 'Shot Stopper' },
  2: { pt: 'Goleiro-líbero', en: 'Sweeper Keeper' },
  3: { pt: 'Comandante', en: 'Progressor' },
  4: { pt: 'Chefia', en: 'Boss' },
  5: { pt: 'Ambivalente', en: 'Marauder' },
  6: { pt: 'Mata-ataques', en: 'Disruptor' },
  7: { pt: 'Compasso', en: 'Recycler' },
  8: { pt: 'Maestro', en: 'Maestro' },
  9: { pt: 'Cérebro', en: 'Creator' },
  10: { pt: 'Gatilho', en: 'Spark' },
  11: { pt: 'Magia em campo', en: 'Magician' },
  12: { pt: 'Finalizador', en: 'Finisher' },
  13: { pt: 'Target', en: 'Target' },
};
export const archetypeLabel = (id) => ARCHETYPES[id]?.pt || (id ? `Arquétipo ${id}` : '—');
export const archetypeEn = (id) => ARCHETYPES[id]?.en || '';

// Cor do uniforme vem como inteiro RGB.
export const kitColor = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return null;
  return '#' + v.toString(16).padStart(6, '0').slice(-6);
};

// lastMatchN em overallStats: 1 = vitória, 3 = empate (bate com unbeatenstreak), 2 = derrota, -1 = sem jogo.
export const FORM = { 1: 'V', 2: 'D', 3: 'E' };
