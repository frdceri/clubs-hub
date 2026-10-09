import { club, vercelHandler } from '../../lib/routes.js';

export default vercelHandler((q) => club(q.id));
