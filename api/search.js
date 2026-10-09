import { search, vercelHandler } from '../lib/routes.js';

export default vercelHandler((q) => search(q.q, q.region));
