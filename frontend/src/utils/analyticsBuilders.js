function toISODateOnly(value) {
  if (!value) return "";
  // If it's already "YYYY-MM-DD..."
  if (typeof value === "string") return value.slice(0, 10);

  // If it's a Date object
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  // Fallback: try Date parsing
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function buildIllnessData(reports = []) {
  const map = {};
  for (const r of reports) {
    const illness = String(r?.illness || "").trim();
    if (!illness) continue;
    map[illness] = (map[illness] || 0) + 1;
  }

  return Object.entries(map)
    .map(([illness, count]) => ({ illness, count }))
    .sort((a, b) => b.count - a.count);
}

export function buildSeverityData(reports = []) {
  const total = reports.length || 1;
  const map = { High: 0, Moderate: 0, Low: 0 };

  for (const r of reports) {
    const sev = r?.severity;
    if (!sev) continue;
    if (map[sev] === undefined) map[sev] = 0;
    map[sev] += 1;
  }

  return ["High", "Moderate", "Low"].map((severity) => {
    const count = map[severity] || 0;
    return {
      severity,
      percentage: Number(((count / total) * 100).toFixed(1)),
    };
  });
}



function toYearMonth(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 7);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 7);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 7);
}

export function buildDailyTimelineData(reports = []) {
  const map = {};
  for (const r of reports) {
    const day = toISODateOnly(r?.reportedAt || r?.date);
    if (!day) continue;
    map[day] = (map[day] || 0) + 1;
  }
  return Object.entries(map)
    .map(([date, cases]) => ({ date, cases }))
    .sort((a, b) => (a.date > b.date ? 1 : -1));
}

export function buildLast7DaysTimeline(reports = []) {
  const safe = Array.isArray(reports) ? reports : [];

  // Convert to daily counts
  const dailyMap = {};
  for (const r of safe) {
    const day = toISODateOnly(r?.reportedAt || r?.date);
    if (!day) continue;
    dailyMap[day] = (dailyMap[day] || 0) + 1;
  }

  const days = Object.keys(dailyMap).sort(); // YYYY-MM-DD sorts correctly
  if (days.length === 0) return [];

  // Pick last 7 unique dates available
  const last7 = days.slice(-7);

  return last7.map((date) => ({
    date,
    cases: dailyMap[date],
  }));
}

export function buildMonthlyTrendData(reports = []) {
  const map = {};
  for (const r of reports) {
    const month = toYearMonth(r?.reportedAt || r?.date);
    if (!month) continue;
    map[month] = (map[month] || 0) + 1;
  }
  return Object.entries(map)
    .map(([month, cases]) => ({ month, cases }))
    .sort((a, b) => (a.month > b.month ? 1 : -1));
}



export function buildDistrictData(reports = []) {
  const map = {};
  for (const r of reports) {
    const district = String(r?.location?.district || r?.location || "").trim();
    if (!district) continue;
    map[district] = (map[district] || 0) + 1;
  }

  return Object.entries(map)
    .map(([district, cases]) => ({ district, cases }))
    .sort((a, b) => b.cases - a.cases);
}
