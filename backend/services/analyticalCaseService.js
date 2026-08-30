import OfficialCase from "../models/OfficialCase.js";
import Report from "../models/Report.js";
import { legislativeDistrictFromBarangayNo } from "../utils/legislativeDistrict.js";
import { getDohMorbidityWeek } from "../utils/dohMorbidityWeek.js";
import { normalizeSurveillanceDisease } from "../constants/surveillanceMethodology.js";
import { loadOfficialCaseSource } from "./officialCaseSourceReader.js";
import {
  resolveCumulativeDatasetContext,
  selectAuthoritativeOfficialRows,
} from "./cumulativeOfficialCaseService.js";

const ANALYTICAL_STATUSES = new Set([
  "reported",
  "suspected",
  "probable",
  "confirmed",
  "not_validated",
]);
const MAX_OFFICIAL_ROWS = 250_000;
const MAX_REPORT_ROWS = 100_000;

function assertWithinLimit(rows, limit, label) {
  if (rows.length > limit) {
    const error = new Error(`${label} exceeds the analytical query limit of ${limit} rows; narrow the dataset or time range`);
    error.status = 413;
    throw error;
  }
}

function normalizeStatuses(statuses) {
  const requested = Array.isArray(statuses) ? statuses : [statuses];
  const normalized = requested
    .map((status) => String(status || "").trim().toLowerCase())
    .filter((status) => ANALYTICAL_STATUSES.has(status));
  return normalized.length ? [...new Set(normalized)] : ["confirmed"];
}

function reportDisease(report) {
  return normalizeSurveillanceDisease(
    report?.disease
      || report?.investigation?.suspectedDisease
      || report?.validation?.condition,
  ) || "Unclassified foodborne illness";
}

function reportDistrict(report) {
  const barangayNo =
    report?.exposureBarangayNo ?? report?.location?.barangayNo ?? null;
  return (
    legislativeDistrictFromBarangayNo(barangayNo) ||
    String(report?.exposureDistrict || report?.location?.district || "").trim() ||
    null
  );
}

async function resolveDatasetContext(datasetId) {
  const context = await resolveCumulativeDatasetContext(datasetId);
  return context
    ? { ...context, dataset: context.anchor }
    : null;
}

function intersectDateRanges(...ranges) {
  const valid = ranges.filter(Boolean);
  if (!valid.length) return null;
  const start = new Date(Math.max(...valid.map((range) => range.start.getTime())));
  const endExclusive = new Date(
    Math.min(...valid.map((range) => range.endExclusive.getTime())),
  );
  return start < endExclusive ? { start, endExclusive } : null;
}

function buildReportQuery({ selectedStatuses, datasetContext, year }) {
  const query = {
    isCounted: true,
    caseClassification: { $in: selectedStatuses },
  };

  if (datasetContext) {
    query.$or = [
      { datasetId: { $in: datasetContext.datasetIds } },
      { datasetId: null },
      { datasetId: { $exists: false } },
    ];
  }

  const yearRange = Number.isInteger(Number(year))
    ? {
        start: new Date(Date.UTC(Number(year), 0, 1)),
        endExclusive: new Date(Date.UTC(Number(year) + 1, 0, 1)),
      }
    : null;
  const dateRange = intersectDateRanges(datasetContext?.coverage, yearRange);
  if (dateRange) {
    query.reportedAt = {
      $gte: dateRange.start,
      $lt: dateRange.endExclusive,
    };
  } else if (datasetContext?.coverage || yearRange) {
    // The requested year and dataset coverage do not overlap.
    query.reportedAt = { $gte: new Date(1), $lt: new Date(1) };
  }
  return query;
}

export async function getAnalyticalCaseRows({
  datasetId,
  statuses = ["confirmed"],
  includeOfficial = true,
  includeReports = false,
  year,
  month,
  district,
  disease,
} = {}) {
  const selectedStatuses = normalizeStatuses(statuses);
  const datasetContext = await resolveDatasetContext(datasetId);
  const rows = [];

  if (includeOfficial) {
    const query = { caseClassification: { $in: selectedStatuses } };
    if (datasetContext) query.datasetId = { $in: datasetContext.officialDatasetIds };
    if (Number.isInteger(Number(year))) query.year = Number(year);
    if (Number.isInteger(Number(month))) query.month = Number(month);
    if (district) query.district = String(district).trim();
    if (disease) query.disease = String(disease).trim();

    let officialRows = await OfficialCase.find(query)
      .select(
        "datasetId city district barangay barangayNo disease year month epidemiologicalYear epidemiologicalWeek weekStartDate surveillanceDate reportingFrequency providerType providerName caseClassification cases source",
      )
      .limit(MAX_OFFICIAL_ROWS + 1)
      .lean();
    assertWithinLimit(officialRows, MAX_OFFICIAL_ROWS, "Official case selection");
    const lacksWeeklyFields = officialRows.length > 0 && officialRows.every((row) => (
      !Number.isInteger(Number(row.epidemiologicalYear))
        || !Number.isInteger(Number(row.epidemiologicalWeek))
    ));
    if (lacksWeeklyFields && datasetContext?.datasets?.length === 1) {
      const source = loadOfficialCaseSource(datasetContext.dataset);
      if (source?.rows?.length) {
        officialRows = source.rows.filter((row) => (
          selectedStatuses.includes(row.caseClassification)
            && (!Number.isInteger(Number(year)) || Number(row.year) === Number(year))
            && (!Number.isInteger(Number(month)) || Number(row.month) === Number(month))
            && (!district || row.district === String(district).trim())
            && (!disease || row.disease === String(disease).trim())
        )).map((row) => ({ ...row, datasetId: datasetContext.dataset._id }));
        assertWithinLimit(officialRows, MAX_OFFICIAL_ROWS, "Source-file official case selection");
      }
    }
    if (datasetContext?.relevantDatasets?.length) {
      officialRows = selectAuthoritativeOfficialRows(
        officialRows,
        datasetContext.relevantDatasets,
      );
    }
    for (const row of officialRows) {
      rows.push({
        ...row,
        sourceType: "official_upload",
        sourceRecordId: row._id ? String(row._id) : null,
      });
    }
  }

  if (includeReports) {
    const reportStatuses = selectedStatuses.filter((status) =>
      ["reported", "suspected", "probable", "confirmed", "not_validated"].includes(status),
    );
    if (reportStatuses.length) {
      const query = buildReportQuery({
        selectedStatuses: reportStatuses,
        datasetContext,
        year,
      });

      const reportRows = await Report.find(query)
        .select(
          "datasetId reportedAt surveillanceDate surveillanceDateBasis epidemiologicalYear epidemiologicalWeek weekStartDate disease location exposureDistrict exposureBarangay exposureBarangayNo caseCount caseClassification currentStatus source investigation.suspectedDisease validation",
        )
        .limit(MAX_REPORT_ROWS + 1)
        .lean();
      assertWithinLimit(reportRows, MAX_REPORT_ROWS, "Surveillance report selection");

      for (const report of reportRows) {
        if (
          report.caseClassification === "reported" &&
          report.currentStatus !== "reported"
        ) {
          continue;
        }
        const surveillanceDate = new Date(report.surveillanceDate || report.reportedAt);
        const weekData = Number.isInteger(Number(report.epidemiologicalYear))
          && Number.isInteger(Number(report.epidemiologicalWeek))
          ? {
              epidemiologicalYear: Number(report.epidemiologicalYear),
              epidemiologicalWeek: Number(report.epidemiologicalWeek),
              weekStartDate: report.weekStartDate || null,
            }
          : getDohMorbidityWeek(surveillanceDate);
        const reportMonth = surveillanceDate.getUTCMonth() + 1;
        const mappedDistrict = reportDistrict(report);
        const mappedDisease = reportDisease(report);
        if (Number.isInteger(Number(month)) && reportMonth !== Number(month)) continue;
        if (district && mappedDistrict !== String(district).trim()) continue;
        if (disease && mappedDisease !== String(disease).trim()) continue;

        rows.push({
          _id: report._id,
          datasetId: report.datasetId || null,
          city: "Manila",
          district: mappedDistrict,
          barangay: report.exposureBarangay || report.location?.barangay || null,
          barangayNo:
            report.exposureBarangayNo ?? report.location?.barangayNo ?? null,
          disease: mappedDisease,
          year: surveillanceDate.getUTCFullYear(),
          month: reportMonth,
          epidemiologicalYear: weekData.epidemiologicalYear,
          epidemiologicalWeek: weekData.epidemiologicalWeek,
          weekStartDate: weekData.weekStartDate || report.weekStartDate || null,
          reportingFrequency: "weekly",
          providerType: "citizen_patient_report",
          providerName: "Citizen/Patient Report",
          caseClassification: report.caseClassification,
          cases: Number(report.caseCount || 1),
          source: report.source || "citizen_app",
          sourceType:
            report.caseClassification === "confirmed"
              ? "confirmed_surveillance_report"
              : "surveillance_report",
          sourceRecordId: String(report._id),
        });
      }
    }
  }

  return rows;
}

/**
 * Returns a bounded, database-paginated page of authoritative official rows.
 */
export async function getAnalyticalCasePage({
  datasetId,
  statuses = ["confirmed"],
  year,
  month,
  barangayNo,
  district,
  disease,
  skip = 0,
  limit = 50,
} = {}) {
  const rows = await getAnalyticalCaseRows({
    datasetId,
    statuses,
    year,
    month,
    district,
    disease,
  });
  const selectedBarangay = Number(barangayNo);
  const filtered = Number.isInteger(selectedBarangay)
    ? rows.filter((row) => Number(row.barangayNo) === selectedBarangay)
    : rows;
  filtered.sort((a, b) =>
    Number(a.year) - Number(b.year)
      || Number(a.month) - Number(b.month)
      || String(a.district || "").localeCompare(String(b.district || ""))
      || String(a.disease || "").localeCompare(String(b.disease || ""))
      || String(a.sourceType || "").localeCompare(String(b.sourceType || ""))
      || String(a.sourceRecordId || "").localeCompare(String(b.sourceRecordId || "")));
  const safeSkip = Math.max(0, Number(skip) || 0);
  const safeLimit = Math.max(1, Number(limit) || 50);
  return { total: filtered.length, items: filtered.slice(safeSkip, safeSkip + safeLimit) };
}

export function groupCaseRowsByStatus(rows = []) {
  const counts = {
    reported: 0,
    suspected: 0,
    probable: 0,
    confirmed: 0,
    notValidated: 0,
  };
  for (const row of rows) {
    const cases = Math.max(0, Number(row?.cases || 0));
    if (row?.caseClassification === "reported") counts.reported += cases;
    if (row?.caseClassification === "suspected") counts.suspected += cases;
    if (row?.caseClassification === "probable") counts.probable += cases;
    if (row?.caseClassification === "confirmed") counts.confirmed += cases;
    if (row?.caseClassification === "not_validated") counts.notValidated += cases;
  }
  return counts;
}
