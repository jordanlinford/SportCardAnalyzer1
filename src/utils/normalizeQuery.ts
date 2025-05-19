export function normalizeQuery(raw: string): string {
  if (!raw) return "";
  return raw
    .toUpperCase()
    // remove grading references (PSA 10 etc.)
    .replace(/\b(?:PSA|BGS|SGC|CGC)\s*\d{1,2}\b/g, "")
    // remove common noise words
    .replace(/\b(?:GEM\s*MINT|RC|ROOKIE)\b/g, "")
    // remove # symbols and parentheses
    .replace(/[()#]/g, " ")
    // collapse multiple spaces
    .replace(/\s+/g, " ")
    .trim();
} 