import mongoose from "mongoose";
import Dataset from "../models/Dataset.js";
import OfficialCase from "../models/OfficialCase.js";
import Report from "../models/Report.js";
import { legislativeDistrictFromBarangayNo } from "../utils/legislativeDistrict.js";

const ANALYTICAL_STATUSES = new Set([
  "reported",
  "suspected",
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
  return String(report?.validation?.condition || "Foodborne illness").trim();
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

function isoWeekData(input) {
  const date = new Date(input);
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const epidemiologicalYear = utcDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(epidemiologicalYear, 0, 1));
  const epidemiologicalWeek = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
  return { epidemiologicalYear, epidemiologicalWeek };
}

function monthRange(start, end) {
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) return null;
  if (!(end instanceof Date) || Number.isNaN(end.getTime())) return null;
  return {
    start: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)),
    endExclusive: new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 1),
    ),
  };
}

async function resolveDatasetContext(datasetId) {
  if (!datasetId || !mongoose.isValidObjectId(datasetId)) return null;
  const dataset = await Dataset.findById(datasetId)
    .select("_id coverageStart coverageEnd")
    .lean();
  if (!dataset) {
    const error = new Error("Dataset not found");
    error.status = 404;
    throw error;
  }
  return {
    datasetObjectId: new mongoose.Types.ObjectId(dataset._id),
    coverage: monthRange(dataset.coverageStart, dataset.coverageEnd),
  };
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
      { datasetId: datasetContext.datasetObjectId },
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
  includeReports = true,
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
    if (datasetContext) query.datasetId = datasetContext.datasetObjectId;
    if (Number.isInteger(Number(year))) query.year = Number(year);
    if (Number.isInteger(Number(month))) query.month = Number(month);
    if (district) query.district = String(district).trim();
    if (disease) query.disease = String(disease).trim();

    const officialRows = await OfficialCase.find(query)
      .select(
        "datasetId city district barangay barangayNo disease year month epidemiologicalYear epidemiologicalWeek weekStartDate reportingFrequency providerType providerName caseClassification cases source",
      )
      .limit(MAX_OFFICIAL_ROWS + 1)
      .lean();
    assertWithinLimit(officialRows, MAX_OFFICIAL_ROWS, "Official case selection");
    for (const row of officialRows) {
      rows.push({
        ...row,
        sourceType: "official_upload",
        sourceRecordId: String(row._id),
      });
    }
  }

  if (includeReports) {
    const reportStatuses = selectedStatuses.filter((status) =>
      ["reported", "suspected", "confirmed", "not_validated"].includes(status),
    );
    if (reportStatuses.length) {
      const query = buildReportQuery({
        selectedStatuses: reportStatuses,
        datasetContext,
        year,
      });

      const reportRows = await Report.find(query)
        .select(
          "datasetId reportedAt location exposureDistrict exposureBarangay exposureBarangayNo caseCount caseClassification currentStatus source validation",
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
        const reportedAt = new Date(report.reportedAt);
        const weekData = isoWeekData(reportedAt);
        const reportMonth = reportedAt.getUTCMonth() + 1;
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
          year: reportedAt.getUTCFullYear(),
          month: reportMonth,
          epidemiologicalYear: weekData.epidemiologicalYear,
          epidemiologicalWeek: weekData.epidemiologicalWeek,
          weekStartDate: null,
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

function reportDistrictExpression() {
  const barangayNo = {
    $ifNull: ["$exposureBarangayNo", "$location.barangayNo"],
  };
  return {
    $switch: {
      branches: [
        { case: { $and: [{ $gte: [barangayNo, 1] }, { $lte: [barangayNo, 146] }] }, then: "District 1" },
        { case: { $and: [{ $gte: [barangayNo, 147] }, { $lte: [barangayNo, 267] }] }, then: "District 2" },
        { case: { $and: [{ $gte: [barangayNo, 268] }, { $lte: [barangayNo, 394] }] }, then: "District 3" },
        { case: { $and: [{ $gte: [barangayNo, 395] }, { $lte: [barangayNo, 586] }] }, then: "District 4" },
        { case: { $and: [{ $gte: [barangayNo, 587] }, { $lte: [barangayNo, 648] }] }, then: "District 6" },
        { case: { $and: [{ $gte: [barangayNo, 649] }, { $lte: [barangayNo, 828] }] }, then: "District 5" },
        { case: { $and: [{ $gte: [barangayNo, 829] }, { $lte: [barangayNo, 905] }] }, then: "District 6" },
      ],
      default: { $ifNull: ["$exposureDistrict", "$location.district"] },
    },
  };
}

/**
 * Returns a bounded, database-paginated union of official and surveillance rows.
 * This avoids materializing the entire analytical dataset for every API page.
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
  const officialMatch = {
    caseClassification: { $in: selectedStatuses },
  };
  if (datasetContext) officialMatch.datasetId = datasetContext.datasetObjectId;
  if (Number.isInteger(Number(year))) officialMatch.year = Number(year);
  if (Number.isInteger(Number(month))) officialMatch.month = Number(month);

  const reportMatch = buildReportQuery({
    selectedStatuses,
    datasetContext,
    year,
  });
  if (selectedStatuses.includes("reported")) {
    reportMatch.$and = [
      {
        $or: [
          { caseClassification: { $ne: "reported" } },
          { currentStatus: "reported" },
        ],
      },
    ];
  }

  const unifiedMatch = {};
  if (Number.isInteger(Number(month))) unifiedMatch.month = Number(month);
  if (Number.isInteger(Number(barangayNo))) unifiedMatch.barangayNo = Number(barangayNo);
  if (district) unifiedMatch.district = String(district).trim();
  if (disease) unifiedMatch.disease = String(disease).trim();

  const reportCondition = {
    $trim: { input: { $ifNull: ["$validation.condition", ""] } },
  };
  const [result] = await OfficialCase.aggregate([
    { $match: officialMatch },
    {
      $project: {
        _id: 1,
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
    {
      $unionWith: {
        coll: Report.collection.name,
        pipeline: [
          { $match: reportMatch },
          {
            $project: {
              _id: 1,
              datasetId: 1,
              city: { $literal: "Manila" },
              district: reportDistrictExpression(),
              barangay: { $ifNull: ["$exposureBarangay", "$location.barangay"] },
              barangayNo: { $ifNull: ["$exposureBarangayNo", "$location.barangayNo"] },
              disease: {
                $cond: [
                  { $gt: [{ $strLenCP: reportCondition }, 0] },
                  reportCondition,
                  "Foodborne illness",
                ],
              },
              year: { $year: { date: "$reportedAt", timezone: "UTC" } },
              month: { $month: { date: "$reportedAt", timezone: "UTC" } },
              epidemiologicalYear: { $isoWeekYear: "$reportedAt" },
              epidemiologicalWeek: { $isoWeek: "$reportedAt" },
              weekStartDate: null,
              reportingFrequency: { $literal: "weekly" },
              providerType: { $literal: "citizen_patient_report" },
              providerName: { $literal: "Citizen/Patient Report" },
              caseClassification: 1,
              cases: { $ifNull: ["$caseCount", 1] },
              source: { $ifNull: ["$source", "citizen_app"] },
              sourceType: {
                $cond: [
                  { $eq: ["$caseClassification", "confirmed"] },
                  "confirmed_surveillance_report",
                  "surveillance_report",
                ],
              },
              sourceRecordId: { $toString: "$_id" },
            },
          },
        ],
      },
    },
    ...(Object.keys(unifiedMatch).length ? [{ $match: unifiedMatch }] : []),
    {
      $sort: {
        year: 1,
        month: 1,
        district: 1,
        disease: 1,
        sourceType: 1,
        sourceRecordId: 1,
      },
    },
    {
      $facet: {
        metadata: [{ $count: "total" }],
        items: [{ $skip: Math.max(0, Number(skip) || 0) }, { $limit: Math.max(1, Number(limit) || 50) }],
      },
    },
  ]).allowDiskUse(true);

  return {
    total: Number(result?.metadata?.[0]?.total || 0),
    items: Array.isArray(result?.items) ? result.items : [],
  };
}

export function groupCaseRowsByStatus(rows = []) {
  const counts = {
    reported: 0,
    suspected: 0,
    confirmed: 0,
    notValidated: 0,
  };
  for (const row of rows) {
    const cases = Math.max(0, Number(row?.cases || 0));
    if (row?.caseClassification === "reported") counts.reported += cases;
    if (row?.caseClassification === "suspected") counts.suspected += cases;
    if (row?.caseClassification === "confirmed") counts.confirmed += cases;
    if (row?.caseClassification === "not_validated") counts.notValidated += cases;
  }
  return counts;
}
