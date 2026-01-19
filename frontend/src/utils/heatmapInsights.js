export function buildTopDistrictsFromPoints(districtPoints, limit = 5) {
  return [...(districtPoints || [])]
    .sort((a, b) => (b.cases ?? 0) - (a.cases ?? 0))
    .slice(0, limit)
    .map((p) => ({ name: p.district, cases: p.cases ?? 0 }));
}

export function buildTopIllnessesFromReports(reports, limit = 5) {
  const counts = new Map();
  for (const r of reports || []) {
    const key = r.illness || "Unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}
