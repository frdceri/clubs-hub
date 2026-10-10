# Clubs Hub · MVP local

Site de estatísticas de **EA FC 27 Clubs** com foco nas Américas. Roda só na sua máquina: sem banco de dados, sem deploy, sem dependências.

## Como rodar

Precisa do **Node.js 18 ou mais novo** (`node --version` para conferir).

```bash
cd clubs-hub
npm start          # dados reais da EA  -> http://localhost:3000
npm run mock       # dados de exemplo (para mexer no visual sem depender da EA)
```

Opções por variável de ambiente: `PORT=4000`, `PLATFORM=common-gen5`.

## O que já faz

- **Ranking**: top 100 global da EA, com filtro "Américas".
- **Busca de clubes** pelo nome, com região e divisão.
- **Página do clube**: resumo da liga, forma recente, elenco da temporada (gols, assistências, nota, MVP, OVR, altura) e partidas recentes de liga, playoff e amistoso.
- **Escalação de cada partida** com nota, gols, chutes, passe, desarmes e o **archetype que cada jogador usou**.
- **Archetypes usados pelo clube**: aparições, nota média e gols por archetype.
- Botão de copiar link de qualquer clube.

## Como funciona

```
navegador ──> Vercel (public/ + funções api/) ──> Cloudflare Worker ──> proclubs.ea.com/api/fc/...
               cache na CDN de 5 min,             (cloudflare/worker.js)
               limpa e traduz os dados
```

- A API da EA não aceita chamadas direto de outro site (sem CORS), por isso existe o servidor no meio.
- A EA **bloqueia data centers** (a Vercel recebe 403 da Akamai). Pela rede da Cloudflare ela responde, então as funções chamam a EA através do Worker `clubs-proxy`.
- Para trocar a ponte, defina `EA_BASE` nas variáveis de ambiente da Vercel. Localmente dá para ir direto: `EA_BASE=https://proclubs.ea.com/api/fc npm start`.

Arquivos:

| Arquivo | Para quê |
|---|---|
| `server.js` | servidor local (opcional), rotas `/api/*` e arquivos do site |
| `api/` | funções serverless da Vercel |
| `cloudflare/worker.js` | código da ponte na Cloudflare |
| `lib/ea.js` | chamadas à EA + cache |
| `lib/normalize.js` | transforma a resposta crua da EA em dados limpos |
| `lib/lookups.js` | tabelas de região, posição e archetype — **edite aqui** |
| `mock/mock-data.js` | dados de exemplo no mesmo formato da EA |
| `public/` | o site (HTML, CSS e JS puros) |

## O que descobrimos testando a API (out/2026)

Endpoints que respondem no FC 27, todos com `platform=common-gen5`:

| Endpoint | Retorna |
|---|---|
| `/allTimeLeaderboard/search?clubName=` | busca de clubes |
| `/allTimeLeaderboard` | top 100 global |
| `/clubs/info?clubIds=` | nome, região, cores do uniforme |
| `/clubs/overallStats?clubIds=` | V/E/D, gols, skill rating, últimos 10 resultados |
| `/members/stats?clubId=` | elenco da temporada |
| `/members/career/stats?clubId=` | carreira de cada membro |
| `/clubs/matches?clubIds=&matchType=` | `leagueMatch`, `playoffMatch`, `friendlyMatch` |

Achados importantes:

- **Região**: `regionId` em hexadecimal é texto ASCII (`1396788530` → `SAM2`). Assim dá para separar América do Sul (`SAM`), Central (`CAM`), EUA (`EUS`, `WUS`), Europa etc. Os nomes em `lib/lookups.js` são inferidos dos códigos.
- **Archetype por partida**: cada jogador vem com `archetypeid` (1 a 13). A EA não diz qual número é qual archetype — preencha a tabela `ARCHETYPES` em `lib/lookups.js` à medida que confirmar no jogo (jogue uma partida com um archetype conhecido e veja o número que aparece).
- **Atributos do build** (`vproattr`) vêm vazios (`"NH"`), então a API não entrega o build em si.
- `common-pc` devolveu erro 400; parece que no FC 27 tudo está em `common-gen5`. Vale confirmar.

## Limitações

- API **não oficial**: pode mudar ou cair sem aviso.
- O ranking regional só filtra o top 100 global. Um ranking próprio das Américas exige ir guardando clubes ao longo do tempo (próxima fase, com banco).
- Amistosos só aparecem se o clube jogou amistosos recentes.

## Próximos passos sugeridos

1. Confirmar a tabela de archetypes e os nomes de região com clubes conhecidos.
2. **Ligas comunitárias**: cadastrar uma lista de clubes e montar tabela/artilharia a partir dos amistosos entre eles.
3. Cards de jogador/resultado em imagem para compartilhar no WhatsApp e Discord.
4. Só então: banco (ex.: Supabase) para histórico e deploy.
