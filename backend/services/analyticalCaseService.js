import OfficialCase from "../models/OfficialCase.js";
import { loadOfficialCaseSource } from "./officialCaseSourceReader.js";
import {
  resolveCumulativeDatasetContext,
  selectAuthoritativeOfficialRows,
} from "./cumulativeOfficialCaseService.js";

const ANALYTICAL_STATUSES = new Set([
  "suspected",
  "probable",
  "confirmed",
]);
const MAX_OFFICIAL_ROWS = 250_000;

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

async function resolveDatasetContext(datasetId) {
  const context = await resolveCumulativeDatasetContext(datasetId);
  return context
    ? { ...context, dataset: context.anchor }
    : null;
}

/**
 * Returns cumulative authoritative CESU rows only. Citizen reports are a
 * separate domain and must never be accepted or normalized by this service.
 */
export async function getAnalyticalCaseRows({
  datasetId,
  statuses = ["confirmed"],
  year,
  month,
  district,
  disease,
} = {}) {
  const selectedStatuses = normalizeStatuses(statuses);
  const datasetContext = await resolveDatasetContext(datasetId);
  const rows = [];
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

  return rows;
}

export function assertOfficialCaseRows(rows = []) {
  const invalidRow = rows.find((row) => row?.sourceType !== "official_upload");
  if (invalidRow) {
    const error = new Error("Official analytics received a non-official record");
    error.code = "NON_OFFICIAL_ANALYTICS_ROW";
    throw error;
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
