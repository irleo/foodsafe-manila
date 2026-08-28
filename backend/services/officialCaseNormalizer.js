import { normalizeDistrict as normalizeDistrictKey } from "../utils/normalizeDistrict.js";
import { legislativeDistrictFromBarangayNo } from "../utils/legislativeDistrict.js";
import {
  getDohMorbidityWeek,
  morbidityWeekStartDate,
} from "../utils/dohMorbidityWeek.js";
import { normalizeSurveillanceDisease } from "../constants/surveillanceMethodology.js";

const ALLOWED_DISTRICTS = new Set([
  "District 1",
  "District 2",
  "District 3",
  "District 4",
  "District 5",
  "District 6",
]);
const ALLOWED_SOURCES = new Set([
  "official",
  "excel",
  "system",
  "file",
  "cesu",
]);
const MIN_YEAR = 2015;
const MAX_YEAR = 2100;

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

export const getIsoWeekData = getDohMorbidityWeek;

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
  const normalized = String(input || "").trim().replace(/\s+/g, " ");
  return normalizeSurveillanceDisease(normalized) || normalized;
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

  const numbered = raw.match(/^district\s*([1-6])$/i);
  if (numbered) return `District ${numbered[1]}`;

  // Unknown district labels are handled as row-level validation errors.
  const normKey = normalizeDistrictKey(raw);
  return normKey || "";
}

export function isBlankRow(obj = {}) {
  const vals = Object.values(obj || {});
  return vals.every(
    (v) => v === null || v === undefined || String(v).trim() === "",
  );
}

export function normalizeRawHealthOfficeRow({ sheetName, row }) {
  let { barangay, barangayNo } = normalizeBarangay(row["Barangay"]);
  const reportedAt = parseExcelDate(
    row["Report date"] ?? row["report_date"] ?? row["Report Date"],
  );
  const rawDistrict = row["District"] ?? row["district"];
  let district = normalizeDistrict(rawDistrict);

  // Some source workbooks place the barangay number in District when Barangay
  // is blank. Only treat values outside the valid 1–6 district range this way.
  if (!district && !barangayNo) {
    const misplacedBarangay = normalizeBarangay(rawDistrict);
    if (misplacedBarangay.barangayNo > 6) {
      barangay = misplacedBarangay.barangay;
      barangayNo = misplacedBarangay.barangayNo;
    }
  }

  // Manila legislative districts are deterministic from the barangay number.
  // Derive a missing district without modifying the uploaded source workbook.
  if (!district && barangayNo) {
    district = legislativeDistrictFromBarangayNo(barangayNo) || "";
  }
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
  if (!ALLOWED_DISTRICTS.has(district))
    return {
      ok: false,
      field: "district",
      message: "District must be District 1 through District 6.",
    };
  if (!cls)
    return {
      ok: false,
      field: "caseClassification",
      message: "Invalid case classification.",
    };

  const year = reportedAt.getUTCFullYear();
  if (year < MIN_YEAR || year > MAX_YEAR)
    return {
      ok: false,
      field: "reportDate",
      message: `Report date year must be ${MIN_YEAR}–${MAX_YEAR}.`,
    };
  if (row["Barangay"] && !barangayNo)
    return {
      ok: false,
      field: "barangay",
      message: "Barangay must contain a number from 1 to 905.",
    };
  if (barangayNo && legislativeDistrictFromBarangayNo(barangayNo) !== district)
    return {
      ok: false,
      field: "barangay",
      message: `Barangay ${barangayNo} does not belong to ${district}.`,
    };
  const month = reportedAt.getUTCMonth() + 1;
  const weekData = getDohMorbidityWeek(reportedAt);

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
      surveillanceDate: reportedAt,
      surveillanceDateBasis: "report_date",
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
  const hasWeekStartDate =
    (row.week_start_date !== undefined && row.week_start_date !== "") ||
    (row.weekStartDate !== undefined && row.weekStartDate !== "");
  const cls = normalizeCaseClassification(
    row.case_classification ?? row.caseClassification,
  );
  const cases = parseNumber(row.cases);
  const source = String(row.source ?? "official").trim().toLowerCase() || "official";
  const hasEpidemiologicalWeek =
    (row.epidemiological_week !== undefined && row.epidemiological_week !== "") ||
    (row.epidemiologicalWeek !== undefined && row.epidemiologicalWeek !== "");

  if (!city) return { ok: false, field: "city", message: "City is required." };
  if (city.toLowerCase() !== "manila")
    return { ok: false, field: "city", message: "City must be Manila." };
  if (!district)
    return { ok: false, field: "district", message: "District is required." };
  if (!ALLOWED_DISTRICTS.has(district))
    return {
      ok: false,
      field: "district",
      message: "District must be District 1 through District 6.",
    };
  if (row.barangay && !barangayNo)
    return {
      ok: false,
      field: "barangay",
      message: "Barangay must contain a number from 1 to 905.",
    };
  if (barangayNo && (barangayNo < 1 || barangayNo > 905))
    return {
      ok: false,
      field: "barangay",
      message: "Barangay number must be 1–905.",
    };
  if (barangayNo && legislativeDistrictFromBarangayNo(barangayNo) !== district)
    return {
      ok: false,
      field: "barangay",
      message: `Barangay ${barangayNo} does not belong to ${district}.`,
    };
  if (!disease)
    return { ok: false, field: "disease", message: "Disease is required." };
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR)
    return { ok: false, field: "year", message: `Year must be an integer from ${MIN_YEAR}–${MAX_YEAR}.` };
  if (!Number.isInteger(month) || month < 1 || month > 12)
    return { ok: false, field: "month", message: "Month must be an integer from 1–12." };
  if (
    hasEpidemiologicalWeek &&
    (!Number.isInteger(epidemiologicalWeek) || epidemiologicalWeek < 1 || epidemiologicalWeek > 53)
  ) {
    return { ok: false, field: "epidemiologicalWeek", message: "Epidemiological week must be an integer from 1–53." };
  }
  if (
    hasEpidemiologicalWeek &&
    (!Number.isInteger(epidemiologicalYear) ||
      epidemiologicalYear < MIN_YEAR ||
      epidemiologicalYear > MAX_YEAR)
  ) {
    return {
      ok: false,
      field: "epidemiologicalYear",
      message: `Epidemiological year must be an integer from ${MIN_YEAR}–${MAX_YEAR}.`,
    };
  }
  if (hasWeekStartDate && !suppliedWeekStartDate)
    return {
      ok: false,
      field: "weekStartDate",
      message: "Week start date must be a valid Excel date or YYYY-MM-DD value.",
    };
  if (hasWeekStartDate && suppliedWeekStartDate && hasEpidemiologicalWeek) {
    const suppliedWeek = getDohMorbidityWeek(suppliedWeekStartDate);
    if (
      suppliedWeek?.epidemiologicalYear !== epidemiologicalYear ||
      suppliedWeek?.epidemiologicalWeek !== epidemiologicalWeek
    ) {
      return {
        ok: false,
        field: "weekStartDate",
        message: "Week start date does not match the epidemiological year and week.",
      };
    }
  }
  if (!cls)
    return {
      ok: false,
      field: "caseClassification",
      message: "Invalid case classification.",
    };
  if (!Number.isInteger(cases) || cases < 0)
    return {
      ok: false,
      field: "cases",
      message: "Cases must be a non-negative integer.",
    };
  if (!ALLOWED_SOURCES.has(source))
    return {
      ok: false,
      field: "source",
      message: "Source must be official, excel, system, file, or CESU.",
    };

  return {
    ok: true,
    value: {
      city: "Manila",
      district,
      barangay,
      barangayNo,
      disease,
      year,
      month,
      epidemiologicalYear: Number.isFinite(epidemiologicalWeek)
        ? Math.trunc(epidemiologicalYear)
        : null,
      epidemiologicalWeek: Number.isFinite(epidemiologicalWeek)
        ? Math.trunc(epidemiologicalWeek)
        : null,
      weekStartDate: suppliedWeekStartDate
        || (Number.isFinite(epidemiologicalWeek)
          ? morbidityWeekStartDate(Math.trunc(epidemiologicalYear), Math.trunc(epidemiologicalWeek))
          : null),
      surveillanceDate: suppliedWeekStartDate || null,
      surveillanceDateBasis: suppliedWeekStartDate ? "provided_week_start" : "provided_period",
      caseClassification: cls,
      cases,
      source,
    },
  };
}

function normalizeBarangay(value) {
  if (!value) return { barangay: null, barangayNo: null };

  const normalized = String(value).trim();
  const match = normalized.match(/^(?:(?:barangay|brgy\.?)\s*)?(\d+)$/i);
  const barangayNo = match ? Number(match[1]) : null;

  return {
    barangay: barangayNo ? `Barangay ${barangayNo}` : normalized,
    barangayNo,
  };
}
