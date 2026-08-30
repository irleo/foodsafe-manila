import mongoose from "mongoose";

import Dataset from "../models/Dataset.js";

const DAY_MS = 86_400_000;

function validDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function providerStreamKey(dataset) {
  if (String(dataset?.providerType || "").trim().toLowerCase() === "cesu") {
    return "cesu";
  }
  return [
    String(dataset?.providerType || "").trim().toLowerCase(),
    String(dataset?.providerName || "").trim().toLowerCase(),
    String(dataset?.reportingFrequency || "").trim().toLowerCase(),
  ].join("|");
}

export function snapshotDistrictIntervals(dataset, { verifiedOnly = false } = {}) {
  const intervals = new Map();
  const datasetStart = validDate(dataset?.coverageStart);
  const datasetEnd = validDate(dataset?.coverageEnd);
  for (const entry of Array.isArray(dataset?.districtCoverage)
    ? dataset.districtCoverage
    : []) {
    if (verifiedOnly && entry?.verifiedComplete !== true) continue;
    const shouldUseFileRange = entry?.verifiedComplete === true
      && entry?.verificationSource === "uploader_confirmation_derived_range"
      && datasetStart
      && datasetEnd;
    const start = shouldUseFileRange
      ? datasetStart
      : validDate(entry?.coverageStart);
    const end = shouldUseFileRange
      ? datasetEnd
      : validDate(entry?.coverageEnd);
    const district = String(entry?.district || "").trim();
    if (!district || !start || !end || start > end) continue;
    if (!intervals.has(district)) intervals.set(district, []);
    intervals.get(district).push({ start, end });
  }
  if (!verifiedOnly) {
    const fallbackStart = validDate(dataset?.coverageStart);
    const fallbackEnd = validDate(dataset?.coverageEnd);
    if (fallbackStart && fallbackEnd && fallbackStart <= fallbackEnd) {
      for (const district of Array.isArray(dataset?.districts)
        ? dataset.districts
        : []) {
        const normalized = String(district || "").trim();
        if (normalized && !intervals.has(normalized)) {
          intervals.set(normalized, [{ start: fallbackStart, end: fallbackEnd }]);
        }
      }
    }
  }
  return intervals;
}

function mergeIntervals(intervals = []) {
  const sorted = intervals
    .filter((entry) => validDate(entry?.start) && validDate(entry?.end))
    .map((entry) => ({ start: new Date(entry.start), end: new Date(entry.end) }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const interval of sorted) {
    const previous = merged.at(-1);
    if (!previous || interval.start.getTime() > previous.end.getTime() + DAY_MS) {
      merged.push(interval);
      continue;
    }
    if (interval.end > previous.end) previous.end = interval.end;
  }
  return merged;
}

function mergeCoverageByDistrict(datasets, options) {
  const byDistrict = new Map();
  for (const dataset of datasets) {
    for (const [district, intervals] of snapshotDistrictIntervals(dataset, options)) {
      if (!byDistrict.has(district)) byDistrict.set(district, []);
      byDistrict.get(district).push(...intervals);
    }
  }
  return new Map(
    [...byDistrict].map(([district, intervals]) => [
      district,
      mergeIntervals(intervals),
    ]),
  );
}

function intervalCovered(interval, coverage = []) {
  return coverage.some((existing) => (
    interval.start >= existing.start && interval.end <= existing.end
  ));
}

function authoritativeDatasets(datasets) {
  const streams = new Map();
  for (const dataset of datasets) {
    const key = providerStreamKey(dataset);
    if (!streams.has(key)) streams.set(key, []);
    streams.get(key).push(dataset);
  }
  const relevant = [];
  for (const stream of streams.values()) {
    const newerCoverageByDistrict = new Map();
    for (const dataset of [...stream].reverse()) {
      const snapshotCoverage = snapshotDistrictIntervals(dataset);
      const contributes = [...snapshotCoverage].some(([district, intervals]) => (
        intervals.some((interval) => !intervalCovered(
          interval,
          newerCoverageByDistrict.get(district) || [],
        ))
      ));
      if (contributes || snapshotCoverage.size === 0) relevant.push(dataset);
      for (const [district, intervals] of snapshotCoverage) {
        newerCoverageByDistrict.set(
          district,
          mergeIntervals([
            ...(newerCoverageByDistrict.get(district) || []),
            ...intervals,
          ]),
        );
      }
    }
  }
  return relevant;
}

function coverageBounds(coverageByDistrict) {
  const intervals = [...coverageByDistrict.values()].flat();
  if (!intervals.length) return { start: null, end: null };
  return {
    start: new Date(Math.min(...intervals.map((entry) => entry.start.getTime()))),
    end: new Date(Math.max(...intervals.map((entry) => entry.end.getTime()))),
  };
}

function rowDate(row) {
  const exact = validDate(row?.surveillanceDate || row?.weekStartDate);
  if (exact) return exact;
  const year = Number(row?.year);
  const month = Number(row?.month);
  return Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12
    ? new Date(Date.UTC(year, month - 1, 1))
    : null;
}

function dateWithinIntervals(date, intervals = []) {
  return Boolean(date) && intervals.some(
    (interval) => date >= interval.start && date <= interval.end,
  );
}

/**
 * Resolves all CESU upload snapshots available when the selected upload was
 * created. New periods accumulate; newer overlapping coverage takes precedence.
 */
export async function resolveCumulativeDatasetContext(datasetId) {
  let resolvedDatasetId = datasetId;
  if (!resolvedDatasetId) {
    const latest = await Dataset.findOne({
      status: "validated",
      providerType: "cesu",
      dataMode: { $ne: "development" },
    })
      .sort({ createdAt: -1, _id: -1 })
      .select("_id")
      .lean();
    resolvedDatasetId = latest?._id || null;
  }
  if (!resolvedDatasetId || !mongoose.isValidObjectId(resolvedDatasetId)) return null;
  const anchor = await Dataset.findById(resolvedDatasetId)
    .select(
      "_id status dataMode providerType providerName reportingFrequency coverageStart coverageEnd districtCoverage districts createdAt filePath formatType",
    )
    .lean();
  if (!anchor) {
    const error = new Error("Dataset not found");
    error.status = 404;
    throw error;
  }
  if (anchor.status !== "validated") {
    const error = new Error("A validated dataset is required");
    error.status = 400;
    throw error;
  }
  if (String(anchor.providerType || "").trim().toLowerCase() !== "cesu") {
    const error = new Error("Official analytics require a validated CESU dataset");
    error.status = 400;
    throw error;
  }

  const datasets = await Dataset.find({
    status: "validated",
    providerType: "cesu",
    dataMode: anchor.dataMode === "development"
      ? "development"
      : { $ne: "development" },
    $or: [
      { createdAt: { $lt: anchor.createdAt } },
      { createdAt: anchor.createdAt, _id: { $lte: anchor._id } },
    ],
  })
    .sort({ createdAt: 1, _id: 1 })
    .select(
      "_id providerType providerName reportingFrequency coverageStart coverageEnd districtCoverage districts createdAt filePath formatType",
    )
    .lean();

  const observedCoverageByDistrict = mergeCoverageByDistrict(datasets);
  const verifiedCoverageByDistrict = mergeCoverageByDistrict(datasets, {
    verifiedOnly: true,
  });
  const observedBounds = coverageBounds(observedCoverageByDistrict);
  const relevantDatasets = authoritativeDatasets(datasets);

  return {
    anchor,
    datasetObjectId: new mongoose.Types.ObjectId(anchor._id),
    datasetIds: datasets.map((dataset) => new mongoose.Types.ObjectId(dataset._id)),
    officialDatasetIds: relevantDatasets.map(
      (dataset) => new mongoose.Types.ObjectId(dataset._id),
    ),
    datasets,
    relevantDatasets,
    observedCoverageByDistrict,
    verifiedCoverageByDistrict,
    coverage: observedBounds.start && observedBounds.end
      ? {
          start: new Date(Date.UTC(
            observedBounds.start.getUTCFullYear(),
            observedBounds.start.getUTCMonth(),
            1,
          )),
          endExclusive: new Date(Date.UTC(
            observedBounds.end.getUTCFullYear(),
            observedBounds.end.getUTCMonth() + 1,
            1,
          )),
        }
      : null,
    coverageStart: observedBounds.start,
    coverageEnd: observedBounds.end,
    uploadCount: datasets.length,
  };
}

/**
 * Keeps the newest authoritative CESU value within each covered period.
 */
export function selectAuthoritativeOfficialRows(rows, datasets) {
  const rowsByDataset = new Map();
  for (const row of rows) {
    const key = String(row?.datasetId || "");
    if (!rowsByDataset.has(key)) rowsByDataset.set(key, []);
    rowsByDataset.get(key).push(row);
  }

  const streams = new Map();
  for (const dataset of datasets) {
    const key = providerStreamKey(dataset);
    if (!streams.has(key)) streams.set(key, []);
    streams.get(key).push(dataset);
  }

  const selected = [];
  for (const streamDatasets of streams.values()) {
    const newerCoverageByDistrict = new Map();
    for (const dataset of [...streamDatasets].reverse()) {
      const datasetRows = rowsByDataset.get(String(dataset._id)) || [];
      for (const row of datasetRows) {
        const intervals = newerCoverageByDistrict.get(row.district) || [];
        if (!dateWithinIntervals(rowDate(row), intervals)) selected.push(row);
      }

      for (const [district, intervals] of snapshotDistrictIntervals(dataset)) {
        const existing = newerCoverageByDistrict.get(district) || [];
        newerCoverageByDistrict.set(
          district,
          mergeIntervals([...existing, ...intervals]),
        );
      }
    }
  }
  return selected;
}

export function monthWithinCoverageIntervals(year, month, intervals = []) {
  const start = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  const end = new Date(Date.UTC(Number(year), Number(month), 0, 23, 59, 59, 999));
  return intervals.some((interval) => start >= interval.start && end <= interval.end);
}
