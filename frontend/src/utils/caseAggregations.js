export function sumByKey(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const k = r[key] ?? "Unknown";
    m.set(k, (m.get(k) || 0) + (r.cases || 0));
  }
  return [...m.entries()].map(([name, value]) => ({ name, value }));
}

// CASES BY YEAR
export function casesByYear(rows) {
  const m = new Map();
  for (const r of rows) {
    m.set(r.year, (m.get(r.year) || 0) + (r.cases || 0));
  }
  return [...m.entries()]
    .map(([year, cases]) => ({ year, cases }))
    .sort((a, b) => a.year - b.year);
}

// CASES BY DISTRICT
export function casesByDistrict(rows) {
  const m = new Map();
  for (const r of rows) {
    m.set(r.district, (m.get(r.district) || 0) + (r.cases || 0));
  }
  return [...m.entries()].map(([district, cases]) => ({ district, cases }));
}

// CASES BY DISEASE
export function casesByDisease(rows) {
  const m = new Map();
  for (const r of rows) {
    m.set(r.disease, (m.get(r.disease) || 0) + (r.cases || 0));
  }
  return [...m.entries()].map(([disease, cases]) => ({ disease, cases }));
}
