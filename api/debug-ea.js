// Diagnóstico temporário: testa variações de cabeçalho contra a EA e mostra o status de cada uma.
const URL_EA = 'https://proclubs.ea.com/api/fc/allTimeLeaderboard?platform=common-gen5';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const variants = {
  atual: { 'User-Agent': CHROME, Accept: 'application/json', Referer: 'https://www.ea.com/', Origin: 'https://www.ea.com' },
  semCabecalho: {},
  navegadorCompleto: {
    'User-Agent': CHROME,
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    Referer: 'https://www.ea.com/',
    Origin: 'https://www.ea.com',
    'sec-ch-ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    Connection: 'keep-alive',
  },
  curl: { 'User-Agent': 'curl/8.5.0', Accept: '*/*' },
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const results = {};
  for (const [name, headers] of Object.entries(variants)) {
    try {
      const r = await fetch(URL_EA, { headers, signal: AbortSignal.timeout(8000) });
      const body = await r.text();
      results[name] = { status: r.status, server: r.headers.get('server'), sample: body.slice(0, 80) };
    } catch (e) {
      results[name] = { error: e.message };
    }
  }
  res.status(200).json({ region: process.env.VERCEL_REGION || '?', results });
}
