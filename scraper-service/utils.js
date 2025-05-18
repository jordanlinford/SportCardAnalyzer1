export const isRealImage = (url) => {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return !(
    lower.includes('placeholder') ||
    lower.includes('no-image') ||
    lower.includes('spacer') ||
    lower.endsWith('.gif') ||
    lower.trim() === ''
  );
};

export const parsePrice = (txt) => parseFloat((txt||'').replace(/[^0-9.]/g, '')) || 0;

export const parseDate = (txt) => {
  if (!txt) return new Date().toISOString().split('T')[0];
  const m = txt.match(/(\w{3} \d{1,2}, \d{4})/);
  if (m) {
    const d = new Date(m[1]);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}; 