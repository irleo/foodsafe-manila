import OfficialCase from "../models/OfficialCase.js";
import { loadOfficialCaseSource } from "./officialCaseSourceReader.js";
import {
  resolveCumulativeDatasetContext,
  selectAuthoritativeOfficialRows,
  snapshotDistrictIntervals,
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

function mergeCoverageIntervals(intervals = []) {
  const dayMs = 86_400_000;
  const sorted = intervals
    .map((interval) => ({
      start: new Date(interval.start),
      end: new Date(interval.end),
    }))
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const merged = [];
  for (const interval of sorted) {
    const previous = merged.at(-1);
    if (!previous || interval.start.getTime() > previous.end.getTime() + dayMs) {
      merged.push(interval);
    } else if (interval.end > previous.end) {
      previous.end = interval.end;
    }
  }
  return merged;
}

function datasetPosition(dataset) {
  return [new Date(dataset.createdAt).getTime(), String(dataset._id)];
}

function compareDatasetsNewestFirst(left, right) {
  const [leftTime, leftId] = datasetPosition(left);
  const [rightTime, rightId] = datasetPosition(right);
  return rightTime - leftTime || rightId.localeCompare(leftId);
}

function monthlyPeriodClauses(start, end) {
  let firstMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  if (firstMonth < start) {
    firstMonth = new Date(Date.UTC(
      firstMonth.getUTCFullYear(),
      firstMonth.getUTCMonth() + 1,
      1,
    ));
  }
  const lastMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  if (firstMonth > lastMonth) return [];

  const startYear = firstMonth.getUTCFullYear();
  const startMonth = firstMonth.getUTCMonth() + 1;
  const endYear = lastMonth.getUTCFullYear();
  const endMonth = lastMonth.getUTCMonth() + 1;
  if (startYear === endYear) {
    return [{ year: startYear, month: { $gte: startMonth, $lte: endMonth } }];
  }

  const clauses = [
    { year: startYear, month: { $gte: startMonth } },
    { year: endYear, month: { $lte: endMonth } },
  ];
  if (endYear - startYear > 1) {
    clauses.push({ year: { $gt: startYear, $lt: endYear } });
  }
  return clauses;
}

function coveredRowClause(district, interval) {
  const { start, end } = interval;
  const monthClauses = monthlyPeriodClauses(start, end);
  return {
    district,
    $or: [
      { surveillanceDate: { $gte: start, $lte: end } },
      {
        surveillanceDate: null,
        weekStartDate: { $gte: start, $lte: end },
      },
      ...(monthClauses.length ? [{
        surveillanceDate: null,
        weekStartDate: null,
        $or: monthClauses,
      }] : []),
    ],
  };
}

/**
 * Builds database predicates that retain each row only when a newer upload has
 * not replaced the same district and covered period.
 */
export function buildAuthoritativeDatasetScopes(datasets = []) {
  const newerCoverageByDistrict = new Map();
  const scopes = [];
  const newestFirst = [...datasets].sort(compareDatasetsNewestFirst);

  for (const dataset of newestFirst) {
    const exclusions = [...newerCoverageByDistrict].flatMap(
      ([district, intervals]) => intervals.map(
        (interval) => coveredRowClause(district, interval),
      ),
    );
    scopes.push({
      datasetId: dataset._id,
      ...(exclusions.length ? { $nor: exclusions } : {}),
    });

    for (const [district, intervals] of snapshotDistrictIntervals(dataset)) {
      newerCoverageByDistrict.set(
        district,
        mergeCoverageIntervals([
          ...(newerCoverageByDistrict.get(district) || []),
          ...intervals,
        ]),
      );
    }
  }
  return scopes;
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
  const selectedStatuses = normalizeStatuses(statuses);
  const datasetContext = await resolveDatasetContext(datasetId);
  const scopes = buildAuthoritativeDatasetScopes(
    datasetContext?.relevantDatasets || [],
  );
  if (!scopes.length) return { total: 0, items: [] };

  const query = {
    caseClassification: { $in: selectedStatuses },
    $or: scopes,
  };
  if (Number.isInteger(Number(year))) query.year = Number(year);
  if (Number.isInteger(Number(month))) query.month = Number(month);
  if (district) query.district = String(district).trim();
  if (disease) query.disease = String(disease).trim();
  const selectedBarangay = Number(barangayNo);
  if (Number.isInteger(selectedBarangay)) query.barangayNo = selectedBarangay;

  const safeSkip = Math.max(0, Number(skip) || 0);
  const safeLimit = Math.max(1, Number(limit) || 50);
  const [result = {}] = await OfficialCase.aggregate([
    { $match: query },
    {
      $facet: {
        metadata: [{ $count: "total" }],
        items: [
          {
            $sort: {
              year: 1,
              month: 1,
              district: 1,
              disease: 1,
              _id: 1,
            },
          },
          { $skip: safeSkip },
          { $limit: safeLimit },
          {
            $project: {
              datasetId: 1,
              city: 1,
              district: 1,
              barangay: 1,
              barangayNo: 1,
              disease: 1,
              year: 1,
              month: 1,
              epidemiologicalYear: 1,
              epidemiologicalWeek: 1,
              weekStartDate: 1,
              surveillanceDate: 1,
              reportingFrequency: 1,
              providerType: 1,
              providerName: 1,
              caseClassification: 1,
              cases: 1,
              source: 1,
              sourceType: { $literal: "official_upload" },
              sourceRecordId: { $toString: "$_id" },
            },
          },
        ],
      },
    },
  ]).allowDiskUse(true);

  return {
    total: result.metadata?.[0]?.total || 0,
    items: result.items || [],
  };
}
