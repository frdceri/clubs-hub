import { eaGet } from '../lib/ea.js';

// Diz se a Vercel consegue falar com a EA (útil logo depois do deploy).
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const started = Date.now();
  try {
    const data = await eaGet('/allTimeLeaderboard', { platform: process.env.PLATFORM || 'common-gen5' });
    res.status(200).json({ ok: true, ea: 'ok', clubs: Array.isArray(data) ? data.length : 0, ms: Date.now() - started });
  } catch (err) {
    res.status(200).json({ ok: false, ea: err.message, ms: Date.now() - started });
  }
}
