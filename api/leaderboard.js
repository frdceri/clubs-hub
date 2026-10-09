import { leaderboard, vercelHandler } from '../lib/routes.js';

export default vercelHandler((q) => leaderboard(q.region), 900);
