import { isRealImage } from './utils.js';
import { parseTitle } from './titleParser.js';

export function groupVariations(listings) {
  const buckets = {};
  for (const l of listings) {
    if (!isRealImage(l.imageUrl)) continue;
    const meta = parseTitle(l.title);
    const key = [meta.year, meta.variation || 'Base', meta.grade || 'Raw'].join('|');
    buckets[key] ??= { id: key, title: key.replace(/\|/g,' · '), listings: [], imageUrl: l.imageUrl };
    buckets[key].listings.push(l);
  }
  return Object.values(buckets).map(g => {
    const avg = g.listings.reduce((s,x)=>s+x.totalPrice,0)/g.listings.length;
    return { ...g, count: g.listings.length, averagePrice: avg };
  }).sort((a,b)=>b.count-a.count);
} 