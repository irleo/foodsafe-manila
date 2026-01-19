import { buildDailyTimelineData } from "./analyticsBuilders";

function toISODateOnly(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/**
 * Convert "YYYY-MM-DD" to a Date (local-safe-ish)
 */
function toDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Add days to ISO date string, return ISO date string.
 */
function addDaysISO(iso, days) {
  const d = toDate(iso);
  if (!d) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Get Monday-based start-of-week ISO date for a given ISO date.
 * (Mon = start of week)
 */
function startOfWeekISO(iso) {
  const d = toDate(iso);
  if (!d) return "";

  // JS getDay(): 0 Sun, 1 Mon, ... 6 Sat
  const day = d.getDay();
  const diffToMonday = (day === 0 ? -6 : 1 - day); // Sunday -> back 6, others back to Monday
  d.setDate(d.getDate() + diffToMonday);

  return d.toISOString().slice(0, 10);
}

/**
 * Basic stats helpers
 */
function mean(nums = []) {
  const safe = nums.filter((n) => Number.isFinite(n));
  if (safe.length === 0) return 0;
  return safe.reduce((a, b) => a + b, 0) / safe.length;
}

function stdev(nums = []) {
  const safe = nums.filter((n) => Number.isFinite(n));
  if (safe.length < 2) return 0;
  const m = mean(safe);
  const variance =
    safe.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / (safe.length - 1);
  return Math.sqrt(variance);
}

/**
 * OPTIONAL filters for later (keeps API ready)
 * - district: "Tondo"
 * - illness: "Norovirus"
 */
function matchesFilters(report, filters = {}) {
  const { district, illness } = filters;

  if (district) {
    const rDistrict = String(report?.location?.district || "").trim();
    if (rDistrict !== district) return false;
  }

  if (illness) {
    const rIllness = String(report?.illness || "").trim();
    if (rIllness !== illness) return false;
  }

  return true;
}

/**
 * Build weekly history: [{ weekStart: "YYYY-MM-DD", cases: number }]
 * Rules:
 * - Groups reports by weekStart (Monday)
 * - 1 report = 1 case (until you add caseCount later)
 */
export function buildWeeklyCaseHistory(reports = [], filters = {}) {
  const safe = Array.isArray(reports) ? reports : [];
  const map = {};

  for (const r of safe) {
    if (!matchesFilters(r, filters)) continue;

    const day = toISODateOnly(r?.reportedAt || r?.date);
    if (!day) continue;

    const weekStart = startOfWeekISO(day);
    if (!weekStart) continue;

    // later you can support: Number(r.caseCount ?? 1)
    map[weekStart] = (map[weekStart] || 0) + 1;
  }

  return Object.entries(map)
    .map(([weekStart, cases]) => ({ weekStart, cases }))
    .sort((a, b) => (a.weekStart > b.weekStart ? 1 : -1));
}

/**
 * Utility: take the last N weeks from history (useful for forecasting window)
 */
export function takeLastWeeks(weeklyHistory = [], n = 8) {
  const safe = Array.isArray(weeklyHistory) ? weeklyHistory : [];
  if (safe.length <= n) return safe;
  return safe.slice(-n);
}

/**
 * Baseline forecast (no ML yet):
 * - predicted = moving average of last `window` weeks
 * - band = +/- (z * stdev(last `window` weeks))
 *
 * Output format for your chart:
 * [{ date: "YYYY-MM-DD", predicted: number, lower: number, upper: number }]
 *
 * Note:
 * - date is the WEEK START (Mon). Your chart can format it as "1/19".
 */
export function buildWeeklyForecast(
  weeklyHistory = [],
  options = {}
) {
  const {
    horizonWeeks = 6,   // how many future weeks to predict
    window = 6,         // how many past weeks to base prediction on
    z = 1.0,            // 1.0 ~ ~68% band, 1.96 ~ ~95% band
    clampAtZero = true, // never show negative cases
  } = options;

  const safe = Array.isArray(weeklyHistory) ? weeklyHistory : [];
  if (safe.length === 0) return [];

  // Ensure sorted
  const history = [...safe].sort((a, b) => (a.weekStart > b.weekStart ? 1 : -1));

  // Use the last `window` weeks to compute baseline
  const recent = history.slice(-window);
  const recentCases = recent.map((x) => Number(x.cases || 0));

  const base = mean(recentCases);
  const sigma = stdev(recentCases);

  const band = z * sigma;

  // start forecasting from NEXT week start
  const lastWeekStart = history[history.length - 1].weekStart;
  const firstForecastWeek = addDaysISO(lastWeekStart, 7);

  const forecast = [];
  for (let i = 0; i < horizonWeeks; i++) {
    const date = addDaysISO(firstForecastWeek, i * 7);

    let predicted = Math.round(base);
    let lower = Math.round(base - band);
    let upper = Math.round(base + band);

    if (clampAtZero) {
      predicted = Math.max(0, predicted);
      lower = Math.max(0, lower);
      upper = Math.max(0, upper);
    }

    forecast.push({ date, predicted, lower, upper });
  }

  return forecast;
}



/**
 * Groups daily actual cases into weekly totals
 * Week is anchored to the forecast date
 */
export function buildWeeklyActualCases(reports = []) {
  const daily = buildDailyTimelineData(reports);

  const map = {};

  for (const d of daily) {
    const date = new Date(d.date);
    if (Number.isNaN(date.getTime())) continue;

    // Use ISO week start (Monday)
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const key = weekStart.toISOString().slice(0, 10);

    map[key] = (map[key] || 0) + d.cases;
  }

  return Object.entries(map)
    .map(([date, cases]) => ({ date, actual: cases }))
    .sort((a, b) => (a.date > b.date ? 1 : -1));
}

/**
 * Merges weekly actuals with forecast
 */
export function buildActualVsPredicted({
  reports = [],
  forecast = [],
}) {
  const actuals = buildWeeklyActualCases(reports);

  const actualMap = {};
  actuals.forEach((a) => {
    actualMap[a.date] = a.actual;
  });

  return forecast.map((f) => ({
    date: f.date,
    predicted: f.predicted,
    actual: actualMap[f.date] ?? 0, // 0 if future week
  }));
}

export function getRiskBand(cases) {
  if (cases >= 31) return "Critical";
  if (cases >= 16) return "High";
  if (cases >= 6) return "Medium";
  return "Low";
}

// Simple % scoring per band (tweak anytime)
export function getRiskScoreForBand(band) {
  switch (band) {
    case "Critical":
      return 90;
    case "High":
      return 70;
    case "Medium":
      return 35;
    default:
      return 10;
  }
}

/**
 * Builds district case points from reports
 * Output: [{ district, cases, riskBand }]
 */
export function buildDistrictRiskPoints(reports = []) {
  const map = {};

  for (const r of Array.isArray(reports) ? reports : []) {
    const district = String(r?.location?.district || "").trim();
    if (!district) continue;

    // 1 report = 1 case for now (later: r.caseCount ?? 1)
    map[district] = (map[district] || 0) + 1;
  }

  return Object.entries(map)
    .map(([district, cases]) => ({
      district,
      cases,
      riskBand: getRiskBand(cases),
    }))
    .sort((a, b) => b.cases - a.cases);
}

/**
 * Average Risk Score across all districts (based on band scoring)
 * Returns number like 36.7 (percent)
 */
export function buildAverageRiskScore(districtRiskPoints = []) {
  const pts = Array.isArray(districtRiskPoints) ? districtRiskPoints : [];
  if (pts.length === 0) return 0;

  const total = pts.reduce((sum, p) => sum + getRiskScoreForBand(p.riskBand), 0);
  return Number((total / pts.length).toFixed(1));
}

/**
 * Count districts considered "high risk" = High + Critical
 */
export function countHighRiskDistricts(districtRiskPoints = []) {
  const pts = Array.isArray(districtRiskPoints) ? districtRiskPoints : [];
  return pts.filter((p) => p.riskBand === "High" || p.riskBand === "Critical")
    .length;
}

/**
 * Next prediction label based on forecast dates
 * - If there is a forecast date after "now", show that date (e.g., 1/19)
 * - Otherwise "N/A"
 */
export function buildNextPredictionLabel(forecastData = [], now = new Date()) {
  const safe = Array.isArray(forecastData) ? forecastData : [];
  if (safe.length === 0) return "N/A";

  const todayISO = toISODateOnly(now);
  const next = [...safe]
    .map((x) => toISODateOnly(x?.date))
    .filter(Boolean)
    .sort()
    .find((d) => d > todayISO);

  if (!next) return "N/A";

  const dt = new Date(next);
  if (Number.isNaN(dt.getTime())) return next;
  return `${dt.getMonth() + 1}/${dt.getDate()}`; // "1/19"
}

