import { handler } from '../server/api/scraper.js';

export default async function(req, res) {
  return handler(req, res);
} 