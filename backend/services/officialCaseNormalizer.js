import { normalizeDistrict as normalizeDistrictKey } from "../utils/normalizeDistrict.js";
import { legislativeDistrictFromBarangayNo } from "../utils/legislativeDistrict.js";
import { getDohMorbidityWeek } from "../utils/dohMorbidityWeek.js";
import { normalizeSurveillanceDisease } from "../constants/surveillanceMethodology.js";

const ALLOWED_DISTRICTS = new Set([
  "District 1",
  "District 2",
  "District 3",
  "District 4",
  "District 5",
  "District 6",
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

  const text = String(v).trim();
  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    const day = Number(isoDate[3]);
    const exactDate = new Date(Date.UTC(year, month - 1, day));
    if (
      exactDate.getUTCFullYear() !== year
      || exactDate.getUTCMonth() !== month - 1
      || exactDate.getUTCDate() !== day
    ) return null;
    return exactDate;
  }

  const d = new Date(text);
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
  return normalizeSurveillanceDisease(normalized);
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
  const disease = normalizeDisease(sheetName);

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
  if (!disease)
    return {
      ok: false,
      field: "disease",
      message: `Unsupported disease sheet: ${String(sheetName || "(blank)")}.`,
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
      disease,
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
  const district = normalizeDistrict(row.district);
  const { barangay, barangayNo } = normalizeBarangay(
    row.barangay ?? row.Barangay,
  );
  const disease = normalizeDisease(row.disease);
  const dateOfOnset = parseExcelDate(row.date_of_onset ?? row.dateOfOnset);
  const dateReportedInput = row.date_reported ?? row.dateReported;
  const hasDateReported = dateReportedInput !== undefined
    && dateReportedInput !== null
    && String(dateReportedInput).trim() !== "";
  const dateReported = hasDateReported ? parseExcelDate(dateReportedInput) : null;
  const cls = normalizeCaseClassification(
    row.case_classification ?? row.caseClassification,
  );
  const cases = parseNumber(row.cases);

  if (!district)
    return { ok: false, field: "district", message: "District is required." };
  if (!ALLOWED_DISTRICTS.has(district))
    return {
      ok: false,
      field: "district",
      message: "District must be District 1 through District 6.",
    };
  if (!String(row.barangay ?? row.Barangay ?? "").trim())
    return { ok: false, field: "barangay", message: "Barangay is required." };
  if (!barangayNo)
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
    return { ok: false, field: "disease", message: "Disease is missing or unsupported." };
  if (!dateOfOnset)
    return { ok: false, field: "dateOfOnset", message: "Date of onset must be a valid Excel date or YYYY-MM-DD value." };
  const year = dateOfOnset.getUTCFullYear();
  if (year < MIN_YEAR || year > MAX_YEAR)
    return { ok: false, field: "dateOfOnset", message: `Date of onset year must be ${MIN_YEAR}–${MAX_YEAR}.` };
  if (hasDateReported && !dateReported)
    return { ok: false, field: "dateReported", message: "Date reported must be a valid Excel date or YYYY-MM-DD value." };
  if (
    dateReported
    && (dateReported.getUTCFullYear() < MIN_YEAR || dateReported.getUTCFullYear() > MAX_YEAR)
  ) {
    return { ok: false, field: "dateReported", message: `Date reported year must be ${MIN_YEAR}–${MAX_YEAR}.` };
  }
  if (!cls)
    return {
      ok: false,
      field: "caseClassification",
      message: "Invalid case classification.",
    };
  if (!Number.isInteger(cases) || cases < 1)
    return {
      ok: false,
      field: "cases",
      message: "Cases must be a positive whole number.",
    };

  const weekData = getDohMorbidityWeek(dateOfOnset);

  return {
    ok: true,
    value: {
      city: "Manila",
      district,
      barangay,
      barangayNo,
      disease,
      year,
      month: dateOfOnset.getUTCMonth() + 1,
      epidemiologicalYear: weekData.epidemiologicalYear,
      epidemiologicalWeek: weekData.epidemiologicalWeek,
      weekStartDate: weekData.weekStartDate,
      dateOfOnset,
      dateReported,
      surveillanceDate: dateOfOnset,
      surveillanceDateBasis: "onset_date",
      caseClassification: cls,
      cases,
      source: "official",
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
