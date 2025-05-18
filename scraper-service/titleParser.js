export function parseTitle(title) {
  const yearMatch = title.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : '';

  const gradeMatch = title.match(/\b(PSA|BGS|SGC) ?([0-9\.]+)/i);
  const grade = gradeMatch ? `${gradeMatch[1].toUpperCase()} ${gradeMatch[2]}` : '';

  // very naive variation keywords
  const variations = ['silver', 'gold', 'blue', 'red', 'green', 'purple', 'orange', 'black', 'pink', 'wave', 'prizm', 'mosaic', 'auto', 'refractor'];
  let variation = '';
  for (const v of variations) {
    if (title.toLowerCase().includes(v)) { variation = v.charAt(0).toUpperCase()+v.slice(1); break; }
  }

  return { year, grade, variation };
} 