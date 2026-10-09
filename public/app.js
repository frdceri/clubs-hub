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
let region = store.get('region', 'americas');

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

function regionToggle() {
  return `<div class="seg" role="group" aria-label="Filtrar região">
    <button data-region="americas" class="${region === 'americas' ? 'on' : ''}">Américas</button>
    <button data-region="all" class="${region === 'all' ? 'on' : ''}">Todas as regiões</button>
  </div>`;
}
function bindRegionToggle(rerender) {
  app.querySelectorAll('[data-region]').forEach((b) => (b.onclick = () => { region = b.dataset.region; store.set('region', region); rerender(); }));
}

// ---------- telas ----------
async function viewHome() {
  document.title = 'Clubs Hub · Estatísticas de Clubs FC 27';
  loading('Carregando ranking…');
  try {
    const { rows, total } = await api(`/api/leaderboard?region=${region}`);
    app.innerHTML = `
      <section class="hero">
        <p class="eyebrow">EA FC 27 · Clubs</p>
        <h1>Estatísticas do seu clube,<br />sem planilha.</h1>
        <p class="lede">Busque um clube para ver elenco, forma, partidas recentes e quais archetypes cada jogador usou.</p>
      </section>
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>Ranking geral</h2>
            <p class="muted">Top ${total} global da EA${region === 'americas' ? `, mostrando só clubes das Américas (${rows.length})` : ''}.</p>
          </div>
          ${regionToggle()}
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
        </table></div>` : '<p class="empty">Nenhum clube das Américas no top global agora. Use a busca para achar o seu.</p>'}
      </section>`;
    bindRegionToggle(viewHome);
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
    const { clubs } = await api(`/api/search?q=${encodeURIComponent(q)}&region=${region}`);
    app.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <div><h2>Resultados para “${esc(q)}”</h2><p class="muted">${clubs.length} clube(s)${region === 'americas' ? ' nas Américas' : ''}.</p></div>
          ${regionToggle()}
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
        : `<p class="empty">Nada encontrado. ${region === 'americas' ? 'Tente “Todas as regiões” ou ' : 'Tente '}outro trecho do nome.</p>`}
      </section>`;
    bindRegionToggle(() => viewSearch(q));
  } catch (err) {
    errorBox(err, () => viewSearch(q));
  }
}

let clubState = null;
async function viewClub(id) {
  loading('Carregando clube…');
  try {
    clubState = { data: await api(`/api/club/${id}`), tab: 'all', open: null };
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
        <div class="panel-head"><h2>Archetypes usados</h2><span class="muted small">nas ${matches.length} partidas carregadas</span></div>
        ${archetypes.length ? `<ul class="arch-list">${archetypes.map((a) => `
          <li>
            <div class="arch-top"><strong>${esc(a.archetype)}</strong><span class="muted small">${a.appearances} aparições · nota ${fmt(a.avgRating, 2)}</span></div>
            <div class="bar"><span style="width:${Math.round((a.appearances / archetypes[0].appearances) * 100)}%"></span></div>
            <div class="muted small">${a.goals} G · ${a.assists} A · ${a.players.map(esc).join(', ')}</div>
          </li>`).join('')}</ul>
          <p class="note">A EA só envia o número do archetype. O nome real de cada número ainda precisa ser confirmado no jogo.</p>`
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
      <thead><tr><th>Jogador</th><th>Archetype</th><th class="num">Nota</th><th class="num">G</th><th class="num">A</th><th class="num hide-sm">Chutes</th><th class="num hide-sm">Passe</th><th class="num hide-sm">Desarmes</th></tr></thead>
      <tbody>${side.players.map((p) => `
        <tr>
          <td><span class="player"><strong>${esc(p.gamertag)}${p.motm ? ' <span class="mvp" title="Melhor em campo">MVP</span>' : ''}${p.redCard ? ' <span class="red" title="Cartão vermelho"></span>' : ''}</strong><span class="muted small">${esc(p.role)}${p.dnf ? ' · saiu antes' : ''}${p.saves ? ` · ${p.saves} defesas` : ''}</span></span></td>
          <td><span class="arch-pill">${esc(p.archetype)}</span></td>
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
