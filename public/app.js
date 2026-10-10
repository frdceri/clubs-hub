// Front-end do MVP: roteamento por hash, sem framework.
const app = document.getElementById('app');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');

// ---------- utilidades ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n, d = 0) => (n == null || Number.isNaN(n) ? '—' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const TYPE_LABEL = { league: 'Liga', playoff: 'Playoff', friendly: 'Amistoso' };

const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* sem storage */ } },
};
const REGIONS = {
  americas: 'Américas',
  sam: 'América do Sul',
  cam: 'América Central / México',
  usa: 'EUA',
  europe: 'Europa',
  other: 'Outras regiões',
  all: 'Todas as regiões',
};
let region = store.get('region', 'americas');
if (!REGIONS[region]) region = 'americas';
const inRegionText = () => (region === 'all' ? '' : ` em ${REGIONS[region]}`);

async function api(path) {
  const res = await fetch(path);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Erro ${res.status}`);
  return body;
}

function timeAgo(ms) {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 3600) return `há ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

const initials = (name) => name.replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const crest = (c, size = '') => `<span class="crest ${size}" style="--kit:${esc(c.color)};--kit2:${esc(c.color2)}">${esc(initials(c.name))}</span>`;
const regionTag = (r) => `<span class="tag ${r.americas ? 'tag-am' : ''}" title="Código EA: ${esc(r.code)}">${esc(r.label)}</span>`;
const divTag = (d) => (d ? `<span class="tag tag-div">Div. ${d}</span>` : '');
const formChips = (form) => form.map((r) => `<span class="chip chip-${r}" title="${{ V: 'Vitória', E: 'Empate', D: 'Derrota' }[r]}">${r}</span>`).join('');

function loading(msg = 'Carregando…') {
  app.innerHTML = `<div class="state"><span class="spinner" aria-hidden="true"></span>${esc(msg)}</div>`;
}
function errorBox(err, retry) {
  app.innerHTML = `<div class="state state-error"><strong>Não deu certo.</strong><span>${esc(err.message)}</span>${retry ? '<button class="btn" id="retry">Tentar de novo</button>' : ''}</div>`;
  if (retry) document.getElementById('retry').onclick = retry;
}

// Menu de região, com quantos clubes caem em cada uma (quando a API informa).
function regionMenu(counts = {}) {
  return `<label class="region-menu">
    <span class="region-menu-label">Região</span>
    <select id="region-select">
      ${Object.entries(REGIONS).map(([k, label]) => `<option value="${k}" ${region === k ? 'selected' : ''}>${label}${counts[k] != null ? ` (${counts[k]})` : ''}</option>`).join('')}
    </select>
  </label>`;
}
function bindRegionMenu(rerender) {
  const sel = document.getElementById('region-select');
  if (sel) sel.onchange = () => { region = sel.value; store.set('region', region); rerender(); };
}

// ---------- telas ----------
async function viewHome() {
  document.title = 'Clubs Hub · Estatísticas de Clubs FC 27';
  loading('Carregando ranking…');
  try {
    const { rows, total, counts } = await api(`/api/leaderboard?region=${region}`);
    app.innerHTML = `
      <section class="hero">
        <p class="eyebrow">EA FC 27 · Clubs</p>
        <h1>Estatísticas do seu clube,<br />sem planilha.</h1>
        <p class="lede">Busque um clube para ver elenco, forma, partidas recentes e qual arquétipo cada jogador usou.</p>
      </section>
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>Ranking geral</h2>
            <p class="muted">Top ${total} global da EA${region === 'all' ? '' : `, mostrando ${rows.length}${inRegionText()}`}.</p>
          </div>
          ${regionMenu(counts)}
        </div>
        ${rows.length ? `
        <div class="table-wrap"><table class="table">
          <thead><tr><th>#</th><th>Clube</th><th class="hide-sm">Região</th><th class="num">SR</th><th class="num">J</th><th class="num">V-E-D</th><th class="num hide-sm">Saldo</th></tr></thead>
          <tbody>${rows.map((r) => `
            <tr class="row-link" data-href="#/clube/${r.id}">
              <td class="rank">${r.rank}</td>
              <td><span class="club-cell">${crest(r, 'sm')}<a href="#/clube/${r.id}">${esc(r.name)}</a></span></td>
              <td class="hide-sm">${regionTag(r.region)}</td>
              <td class="num strong">${fmt(r.skillRating)}</td>
              <td class="num">${r.games}</td>
              <td class="num">${r.wins}-${r.draws}-${r.losses}</td>
              <td class="num hide-sm">${r.goalsFor - r.goalsAgainst > 0 ? '+' : ''}${r.goalsFor - r.goalsAgainst}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>` : `<p class="empty">Nenhum clube${inRegionText()} no top 100 global agora. Use a busca para achar o seu.</p>`}
      </section>`;
    bindRegionMenu(viewHome);
    bindRowLinks();
  } catch (err) {
    errorBox(err, viewHome);
  }
}

async function viewSearch(q) {
  document.title = `Busca: ${q} · Clubs Hub`;
  searchInput.value = q;
  loading(`Buscando “${q}”…`);
  try {
    const { clubs, counts } = await api(`/api/search?q=${encodeURIComponent(q)}&region=${region}`);
    app.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <div><h2>Resultados para “${esc(q)}”</h2><p class="muted">${clubs.length} clube(s)${inRegionText()}.</p></div>
          ${regionMenu(counts)}
        </div>
        ${clubs.length ? `<div class="cards">${clubs.map((c) => `
          <a class="club-card" href="#/clube/${c.id}">
            ${crest(c)}
            <span class="club-card-body">
              <strong>${esc(c.name)}</strong>
              <span class="tags">${regionTag(c.region)}${divTag(c.division)}</span>
              <span class="muted small">${c.games} jogos · ${c.wins}V ${c.draws}E ${c.losses}D · ${c.goalsFor}:${c.goalsAgainst}</span>
            </span>
          </a>`).join('')}</div>`
        : `<p class="empty">Nada encontrado${inRegionText()}. ${region === 'all' ? 'Tente ' : 'Mude a região no menu ou tente '}outro trecho do nome.</p>`}
      </section>`;
    bindRegionMenu(() => viewSearch(q));
  } catch (err) {
    errorBox(err, () => viewSearch(q));
  }
}

let clubState = null;
async function viewClub(id) {
  loading('Carregando clube…');
  try {
    clubState = { data: await api(`/api/club/${id}`), tab: 'all', open: null, rank: 'rating', scope: 'season' };
    renderClub();
  } catch (err) {
    errorBox(err, () => viewClub(id));
  }
}

function renderClub() {
  const { data, tab } = clubState;
  const { club, overall: o, members, matches, archetypes } = data;
  document.title = `${club.name} · Clubs Hub`;
  const counts = { all: matches.length, league: 0, playoff: 0, friendly: 0 };
  matches.forEach((m) => counts[m.type]++);
  const shown = tab === 'all' ? matches : matches.filter((m) => m.type === tab);

  app.innerHTML = `
    <section class="club-hero" style="--kit:${esc(club.color)}">
      ${crest(club, 'lg')}
      <div class="club-hero-text">
        <p class="eyebrow">Clube</p>
        <h1>${esc(club.name)}</h1>
        <div class="tags">${regionTag(club.region)}${o?.skillRating ? `<span class="tag">SR ${fmt(o.skillRating)}</span>` : ''}</div>
      </div>
      <button class="btn btn-ghost" id="share">Copiar link</button>
    </section>

    ${o ? `
    <section class="stats-row">
      <div class="stat"><span class="stat-v">${o.games}</span><span class="stat-l">Jogos de liga</span></div>
      <div class="stat"><span class="stat-v">${pct(o.wins, o.games)}%</span><span class="stat-l">Vitórias · ${o.wins}V ${o.draws}E ${o.losses}D</span></div>
      <div class="stat"><span class="stat-v">${o.goalsFor}:${o.goalsAgainst}</span><span class="stat-l">Gols pró : contra</span></div>
      <div class="stat"><span class="stat-v">${o.unbeatenStreak}</span><span class="stat-l">Invicto há (jogos)</span></div>
      <div class="stat stat-form"><span class="form">${formChips(o.form) || '—'}</span><span class="stat-l">Últimos jogos (recente à esquerda)</span></div>
    </section>` : ''}

    ${bestOfTeam(members)}

    <div class="grid-2">
      <section class="panel">
        <div class="panel-head"><h2>Elenco · temporada</h2><span class="muted small">${members.length} jogadores</span></div>
        ${members.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>Jogador</th><th>Pos</th><th class="num">OVR</th><th class="num">J</th><th class="num">G</th><th class="num">A</th><th class="num">Nota</th><th class="num hide-sm">MVP</th></tr></thead>
          <tbody>${members.sort((a, b) => b.games - a.games).map((m) => `
            <tr>
              <td><span class="player"><strong>${esc(m.gamertag)}</strong><span class="muted small">${esc(m.proName || '')}${m.height ? ` · ${m.height} cm` : ''}</span></span></td>
              <td><span class="pos">${esc(m.position)}</span></td>
              <td class="num strong">${m.overall ?? '—'}</td>
              <td class="num">${m.games}</td>
              <td class="num">${m.goals}</td>
              <td class="num">${m.assists}</td>
              <td class="num">${ratingBadge(m.rating)}</td>
              <td class="num hide-sm">${m.motm}</td>
            </tr>`).join('')}
          </tbody></table></div>` : '<p class="empty">Sem dados de elenco.</p>'}
      </section>

      <section class="panel">
        <div class="panel-head"><h2>Arquétipos usados</h2><span class="muted small">nas ${matches.length} partidas carregadas</span></div>
        ${archetypes.length ? `<ul class="arch-list">${archetypes.map((a) => `
          <li>
            <div class="arch-top"><span><strong title="${esc(a.archetypeEn)}">${esc(a.archetype)}</strong>${a.archetypeEn && a.archetypeEn !== a.archetype ? ` <span class="muted small">${esc(a.archetypeEn)}</span>` : ''}</span><span class="muted small">${a.appearances} aparições · nota ${fmt(a.avgRating, 2)}</span></div>
            <div class="bar"><span style="width:${Math.round((a.appearances / archetypes[0].appearances) * 100)}%"></span></div>
            <div class="muted small">${a.goals} G · ${a.assists} A · ${a.players.map(esc).join(', ')}</div>
          </li>`).join('')}</ul>
          <p class="note">A EA envia só o número do arquétipo; os nomes foram deduzidos da ordem oficial e conferidos com partidas reais (em cinza, o nome em inglês dos guias).</p>`
        : '<p class="empty">Sem partidas para analisar.</p>'}
      </section>
    </div>

    <section class="panel">
      <div class="panel-head">
        <h2>Partidas recentes</h2>
        <div class="seg" role="tablist">
          ${['all', 'league', 'playoff', 'friendly'].map((t) => `<button data-tab="${t}" class="${tab === t ? 'on' : ''}" ${counts[t] || t === 'all' ? '' : 'disabled'}>${t === 'all' ? 'Todas' : TYPE_LABEL[t]} <span class="count">${counts[t]}</span></button>`).join('')}
        </div>
      </div>
      ${shown.length ? `<ol class="matches">${shown.map(matchRow).join('')}</ol>` : '<p class="empty">Nenhuma partida desse tipo.</p>'}
    </section>`;

  app.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { clubState.tab = b.dataset.tab; renderClub(); }));
  app.querySelectorAll('[data-rank]').forEach((b) => (b.onclick = () => { clubState.rank = b.dataset.rank; renderClub(); }));
  app.querySelectorAll('[data-scope]').forEach((b) => (b.onclick = () => { clubState.scope = b.dataset.scope; renderClub(); }));
  app.querySelectorAll('[data-match]').forEach((b) => (b.onclick = () => {
    clubState.open = clubState.open === b.dataset.match ? null : b.dataset.match;
    renderClub();
  }));
  document.getElementById('share').onclick = async (e) => {
    try { await navigator.clipboard.writeText(location.href); e.target.textContent = 'Link copiado'; }
    catch { e.target.textContent = location.href; }
    setTimeout(() => (e.target.textContent = 'Copiar link'), 2000);
  };
}

// ---------- melhores do time ----------
const RANKS = {
  rating: { label: 'Nota', title: 'Melhor nota', get: (s) => s.rating, show: (v) => fmt(v, 1), minGames: true },
  goals: { label: 'Gols', title: 'Artilheiro', get: (s) => s.goals, show: (v) => fmt(v) },
  assists: { label: 'Assistências', title: 'Garçom', get: (s) => s.assists, show: (v) => fmt(v) },
  ga: { label: 'G+A', title: 'Mais participações', get: (s) => s.goals + s.assists, show: (v) => fmt(v) },
  motm: { label: 'MVPs', title: 'Mais MVPs', get: (s) => s.motm, show: (v) => fmt(v) },
};

// Números do jogador no recorte escolhido (temporada ou carreira no clube).
function statsFor(m, scope) {
  const s = scope === 'career' ? m.career : m;
  return { games: s.games || 0, goals: s.goals || 0, assists: s.assists || 0, motm: s.motm || 0, rating: s.rating };
}

function rankPlayers(members, scope, key) {
  const def = RANKS[key];
  const rows = members.map((m) => ({ m, s: statsFor(m, scope) })).filter((r) => r.s.games > 0);
  // Para nota, exige um mínimo de jogos para quem jogou 1 partida com 10 não liderar.
  const maxGames = Math.max(0, ...rows.map((r) => r.s.games));
  const minGames = def.minGames ? Math.max(3, Math.ceil(maxGames * 0.25)) : 0;
  const eligible = rows.filter((r) => r.s.games >= minGames && def.get(r.s) != null);
  eligible.sort((a, b) => def.get(b.s) - def.get(a.s) || b.s.games - a.s.games);
  return { list: eligible, minGames, left: rows.length - eligible.length };
}

function bestOfTeam(members) {
  if (!members.length) return '';
  const { rank, scope } = clubState;
  const leaders = ['goals', 'assists', 'rating', 'motm'].map((k) => ({ k, top: rankPlayers(members, scope, k).list[0] }));
  const { list, minGames, left } = rankPlayers(members, scope, rank);
  const def = RANKS[rank];
  const best = list.length ? def.get(list[0].s) : 0;
  const scopeLabel = scope === 'career' ? 'carreira no clube' : 'temporada';

  return `
    <section class="panel best">
      <div class="panel-head">
        <div><h2>Melhores do time</h2><p class="muted small">Números da ${scopeLabel}, direto da EA.</p></div>
        <div class="seg" role="group" aria-label="Período">
          <button data-scope="season" class="${scope === 'season' ? 'on' : ''}">Temporada</button>
          <button data-scope="career" class="${scope === 'career' ? 'on' : ''}">Carreira</button>
        </div>
      </div>

      <div class="leaders">${leaders.map(({ k, top }) => `
        <button class="leader ${rank === k ? 'on' : ''}" data-rank="${k}" aria-pressed="${rank === k}">
          <span class="leader-title">${RANKS[k].title}</span>
          ${top ? `
            <span class="leader-v">${RANKS[k].show(RANKS[k].get(top.s))}</span>
            <span class="leader-name">${esc(top.m.gamertag)}</span>
            <span class="muted small">${esc(top.m.position)} · ${top.s.games} jogos</span>`
          : '<span class="muted small">Sem dados</span>'}
        </button>`).join('')}
      </div>

      <div class="rank-head">
        <div class="seg" role="tablist" aria-label="Ordenar ranking por">
          ${Object.entries(RANKS).map(([k, d]) => `<button data-rank="${k}" class="${rank === k ? 'on' : ''}">${d.label}</button>`).join('')}
        </div>
        ${minGames ? `<span class="muted small">Mínimo de ${minGames} jogos para entrar no ranking de nota${left ? ` (${left} de fora)` : ''}.</span>` : ''}
      </div>

      ${list.length ? `<ol class="rank-list">${list.map((r, i) => {
        const v = def.get(r.s);
        const width = best > 0 ? Math.max(4, Math.round((v / best) * 100)) : 0;
        return `
          <li class="rank-row ${i < 3 ? `podium p${i + 1}` : ''}">
            <span class="rank-pos">${i + 1}</span>
            <span class="rank-who">
              <strong>${esc(r.m.gamertag)}</strong>
              <span class="muted small">${esc(r.m.position)} · ${r.s.games} J · ${r.s.goals} G · ${r.s.assists} A · ${r.s.motm} MVP</span>
            </span>
            <span class="rank-bar" aria-hidden="true"><span style="width:${width}%"></span></span>
            <span class="rank-v">${def.show(v)}</span>
          </li>`;
      }).join('')}</ol>` : '<p class="empty">Ninguém com jogos suficientes nesse recorte.</p>'}
    </section>`;
}

function ratingBadge(r) {
  if (r == null) return '—';
  const cls = r >= 8 ? 'r-hi' : r >= 7 ? 'r-mid' : r >= 6 ? 'r-lo' : 'r-bad';
  return `<span class="rating ${cls}">${fmt(r, 1)}</span>`;
}

function matchRow(m) {
  const open = clubState.open === m.id;
  return `<li class="match ${open ? 'open' : ''}">
    <button class="match-head" data-match="${esc(m.id)}" aria-expanded="${open}">
      <span class="res res-${m.result}">${m.result}</span>
      <span class="match-teams">
        <span class="team">${esc(m.us.name)}</span>
        <span class="score">${m.us.goals} <i>×</i> ${m.them.goals}</span>
        <span class="team team-opp">${crest(m.them, 'xs')} <a href="#/clube/${m.them.id}" onclick="event.stopPropagation()">${esc(m.them.name)}</a></span>
      </span>
      <span class="match-meta"><span class="tag">${TYPE_LABEL[m.type]}</span><span class="muted small">${timeAgo(m.timestamp)}</span></span>
    </button>
    ${open ? `<div class="match-body">${lineup(m.us)}${lineup(m.them)}</div>` : ''}
  </li>`;
}

function lineup(side) {
  return `<div class="lineup">
    <h3>${crest(side, 'xs')} ${esc(side.name)}</h3>
    <div class="table-wrap"><table class="table table-tight">
      <thead><tr><th>Jogador</th><th>Arquétipo</th><th class="num">Nota</th><th class="num">G</th><th class="num">A</th><th class="num hide-sm">Chutes</th><th class="num hide-sm">Passe</th><th class="num hide-sm">Desarmes</th></tr></thead>
      <tbody>${side.players.map((p) => `
        <tr>
          <td><span class="player"><strong>${esc(p.gamertag)}${p.motm ? ' <span class="mvp" title="Melhor em campo">MVP</span>' : ''}${p.redCard ? ' <span class="red" title="Cartão vermelho"></span>' : ''}</strong><span class="muted small">${esc(p.role)}${p.dnf ? ' · saiu antes' : ''}${p.saves ? ` · ${p.saves} defesas` : ''}</span></span></td>
          <td><span class="arch-pill" title="${esc(p.archetypeEn)}">${esc(p.archetype)}</span></td>
          <td class="num">${ratingBadge(p.rating)}</td>
          <td class="num">${p.goals || ''}</td>
          <td class="num">${p.assists || ''}</td>
          <td class="num hide-sm">${p.shots}</td>
          <td class="num hide-sm">${p.passAccuracy != null ? p.passAccuracy + '%' : '—'}</td>
          <td class="num hide-sm">${p.tackles}/${p.tackleAttempts}</td>
        </tr>`).join('')}
      </tbody></table></div>
  </div>`;
}

function bindRowLinks() {
  app.querySelectorAll('.row-link').forEach((tr) => (tr.onclick = (e) => { if (!e.target.closest('a')) location.hash = tr.dataset.href; }));
}

// ---------- roteador ----------
function route() {
  const h = decodeURIComponent(location.hash.slice(1) || '/');
  let m;
  if ((m = h.match(/^\/clube\/(\d+)/))) return viewClub(m[1]);
  if ((m = h.match(/^\/busca\/(.+)/))) return viewSearch(m[1]);
  searchInput.value = '';
  return viewHome();
}

searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (q.length < 2) return searchInput.focus();
  location.hash = `#/busca/${encodeURIComponent(q)}`;
});
window.addEventListener('hashchange', () => { window.scrollTo(0, 0); route(); });

api('/api/health').then((h) => {
  if (h.mock) document.getElementById('mode-flag').innerHTML = '<span class="tag tag-warn">Modo mock: dados de exemplo</span>';
}).catch(() => {});
route();
