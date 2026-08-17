import { normalizeDistrict as normalizeDistrictKey } from "../utils/normalizeDistrict.js";

export function parseNumber(v) {
  if (v === undefined || v === null || v === "") return NaN;
  const n = Number(String(v).replace(/,/g, "").trim());
  return n;
}

// Excel serial date to JS Date (UTC-ish). Works for modern Excel (1900 date system).
export function parseExcelDate(v) {
  if (v === undefined || v === null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;

  // numeric Excel serial
  if (typeof v === "number" && Number.isFinite(v)) {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getIsoWeekData(input) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const epidemiologicalYear = utcDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(epidemiologicalYear, 0, 1));
  const epidemiologicalWeek = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
  const weekStartDate = new Date(utcDate);
  weekStartDate.setUTCDate(utcDate.getUTCDate() - ((utcDate.getUTCDay() || 7) - 1));
  return { epidemiologicalYear, epidemiologicalWeek, weekStartDate };
}

function isoWeekStartDate(year, week) {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const day = januaryFourth.getUTCDay() || 7;
  const firstMonday = new Date(januaryFourth);
  firstMonday.setUTCDate(januaryFourth.getUTCDate() - day + 1);
  firstMonday.setUTCDate(firstMonday.getUTCDate() + (week - 1) * 7);
  return firstMonday;
}

export function normalizeCaseClassification(input = "") {
  const v = String(input || "")
    .trim()
    .toLowerCase();
  if (!v) return null;
  if (v === "confirmed") return "confirmed";
  if (v === "suspect" || v === "suspected") return "suspected";
  if (v === "probable") return "probable";
  return null;
}

export function normalizeDisease(input = "") {
  return String(input || "").trim();
}

export function normalizeDistrict(input = "") {
  const raw = String(input || "").trim();
  if (!raw) return "";

  // Common roman numeral district codes from raw files
  const roman = raw.toUpperCase();
  const romanMap = {
    I: "District 1",
    II: "District 2",
    III: "District 3",
    IV: "District 4",
    V: "District 5",
    VI: "District 6",
  };
  if (romanMap[roman]) return romanMap[roman];

  // If already "District 1" etc keep as-is
  if (/^district\s+\d+/i.test(raw)) return raw.replace(/\s+/g, " ").trim();

  // Fallback: normalize spacing/casing but preserve human-readable label
  const normKey = normalizeDistrictKey(raw);
  return normKey
    .split("_")
    .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s))
    .join(" ");
}

export function isBlankRow(obj = {}) {
  const vals = Object.values(obj || {});
  return vals.every(
    (v) => v === null || v === undefined || String(v).trim() === "",
  );
}

export function normalizeRawHealthOfficeRow({ sheetName, row }) {
  const { barangay, barangayNo } = normalizeBarangay(row["Barangay"]);
  const reportedAt = parseExcelDate(
    row["Report date"] ?? row["report_date"] ?? row["Report Date"],
  );
  const district = normalizeDistrict(row["District"] ?? row["district"]);
  const cls = normalizeCaseClassification(
    row["Case Classification"] ??
      row["case_classification"] ??
      row["Case classification"],
  );

  if (!reportedAt)
    return {
      ok: false,
      field: "reportDate",
      message: "Report date is required.",
    };
  if (!district)
    return { ok: false, field: "district", message: "District is required." };
  if (!cls)
    return {
      ok: false,
      field: "caseClassification",
      message: "Invalid case classification.",
    };

  const year = reportedAt.getUTCFullYear();
  const month = reportedAt.getUTCMonth() + 1;
  const weekData = getIsoWeekData(reportedAt);

  return {
    ok: true,
    value: {
      city: "Manila",
      district,
      barangay,
      barangayNo,
      disease: normalizeDisease(sheetName),
      year,
      month,
      epidemiologicalYear: weekData.epidemiologicalYear,
      epidemiologicalWeek: weekData.epidemiologicalWeek,
      weekStartDate: weekData.weekStartDate,
      caseClassification: cls,
      cases: 1,
      source: "official",
    },
  };
}

export function normalizeTemplateRow(row = {}) {
  const city = String(row.city ?? "").trim() || "Manila";
  const district = normalizeDistrict(row.district);
  const { barangay, barangayNo } = normalizeBarangay(
    row.barangay ?? row.Barangay,
  );
  const disease = normalizeDisease(row.disease);
  const year = parseNumber(row.year);
  const month = parseNumber(row.month);
  const epidemiologicalWeek = parseNumber(
    row.epidemiological_week ?? row.epidemiologicalWeek,
  );
  const epidemiologicalYear = parseNumber(
    row.epidemiological_year ?? row.epidemiologicalYear ?? row.year,
  );
  const suppliedWeekStartDate = parseExcelDate(
    row.week_start_date ?? row.weekStartDate,
  );
  const cls = normalizeCaseClassification(
    row.case_classification ?? row.caseClassification,
  );
  const cases = parseNumber(row.cases);
  const source = String(row.source ?? "official").trim() || "official";

  if (!city) return { ok: false, field: "city", message: "City is required." };
  if (!district)
    return { ok: false, field: "district", message: "District is required." };
  if (!disease)
    return { ok: false, field: "disease", message: "Disease is required." };
  if (!Number.isFinite(year))
    return { ok: false, field: "year", message: "Year must be numeric." };
  if (!Number.isFinite(month) || month < 1 || month > 12)
    return { ok: false, field: "month", message: "Month must be 1–12." };
  if (
    row.epidemiological_week !== undefined
    && row.epidemiological_week !== ""
    && (!Number.isFinite(epidemiologicalWeek) || epidemiologicalWeek < 1 || epidemiologicalWeek > 53)
  ) {
    return { ok: false, field: "epidemiologicalWeek", message: "Epidemiological week must be 1–53." };
  }
  if (!cls)
    return {
      ok: false,
      field: "caseClassification",
      message: "Invalid case classification.",
    };
  if (!Number.isFinite(cases) || cases < 0)
    return {
      ok: false,
      field: "cases",
      message: "Cases must be a non-negative number.",
    };

  return {
    ok: true,
    value: {
      city,
      district,
      barangay,
      barangayNo,
      disease,
      year: Math.trunc(year),
      month: Math.trunc(month),
      epidemiologicalYear: Number.isFinite(epidemiologicalWeek)
        ? Math.trunc(epidemiologicalYear)
        : null,
      epidemiologicalWeek: Number.isFinite(epidemiologicalWeek)
        ? Math.trunc(epidemiologicalWeek)
        : null,
      weekStartDate: suppliedWeekStartDate
        || (Number.isFinite(epidemiologicalWeek)
          ? isoWeekStartDate(Math.trunc(epidemiologicalYear), Math.trunc(epidemiologicalWeek))
          : null),
      caseClassification: cls,
      cases: Math.trunc(cases),
      source,
    },
  };
}

function normalizeBarangay(value) {
  if (!value) return { barangay: null, barangayNo: null };

  const match = String(value).match(/\d+/);
  const barangayNo = match ? Number(match[0]) : null;

  return {
    barangay: barangayNo ? `Barangay ${barangayNo}` : String(value).trim(),
    barangayNo,
  };
}
