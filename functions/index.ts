import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

interface RawSale {
  itemId: string;
  title: string;
  price: number;
  shipping?: number;
  totalPrice: number;
  dateSold: string;
  imageUrl: string;
  query: string;
  status?: string; // sold | active
}

function detectGrade(title = ''): string {
  const m = title.match(/\b(PSA|BGS|SGC|CGC|CSG|HGA)\s*(?:GEM\s*(?:MINT|MT|-?MT)?\s*)?(10|9(?:\.5)?|8(?:\.5)?)\b/i);
  if (m) return `${m[1].toUpperCase()} ${m[2]}`;
  return 'Raw';
}
function extractCardNumber(title = ''): string {
  const n = title.match(/#?(\d{2,4})(?:[^\d]|$)/);
  return n ? n[1] : '';
}

export const processSale = functions.firestore
  .document('sales_raw/{id}')
  .onCreate(async (snap) => {
    const data = snap.data() as RawSale;

    // --- Normalise ---
    const grade = detectGrade(data.title);
    const cardNumber = extractCardNumber(data.title);

    // Very naive player/year/set parsing – improve later
    const words = data.title.toUpperCase().split(' ');
    const year = words.find(w => /^(19|20)\d{2}$/.test(w)) || '';

    const key = `${year}|${cardNumber}|${grade}`; // minimal key for demo
    const cardRef = db.collection('cards').doc(key);

    await db.runTransaction(async tx => {
      const doc = await tx.get(cardRef);
      const prev = doc.exists ? doc.data() : {};
      const sales = prev?.sales || [];
      sales.push({ price: data.totalPrice || data.price, date: data.dateSold || new Date().toISOString() });

      // Recompute simple metrics
      const prices = sales.map((s: any) => s.price);
      const avg = prices.reduce((s: number, p: number) => s + p, 0) / prices.length;
      const min = Math.min(...prices);
      const max = Math.max(...prices);

      tx.set(cardRef, {
        year,
        cardNumber,
        grade,
        player: data.query.split(' ')[0], // very naive
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        metrics: { averagePrice: avg, minPrice: min, maxPrice: max, count: prices.length },
        sales: sales.slice(-500) // keep last 500
      }, { merge: true });
    });
  }); 