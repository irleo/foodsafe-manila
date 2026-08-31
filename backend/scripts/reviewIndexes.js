import "dotenv/config";
import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import OfficialCase from "../models/OfficialCase.js";
import PredictionRun from "../models/PredictionRun.js";
import Report from "../models/Report.js";

function winningPlanStages(plan, stages = []) {
  if (!plan || typeof plan !== "object") return stages;
  if (plan.stage) stages.push(plan.indexName ? `${plan.stage}:${plan.indexName}` : plan.stage);
  for (const value of Object.values(plan)) {
    if (value && typeof value === "object") winningPlanStages(value, stages);
  }
  return [...new Set(stages)];
}

function summarize(name, explanation) {
  const stats = explanation.executionStats || {};
  return {
    name,
    returned: stats.nReturned ?? null,
    examinedDocuments: stats.totalDocsExamined ?? null,
    examinedKeys: stats.totalKeysExamined ?? null,
    executionMs: stats.executionTimeMillis ?? null,
    stages: winningPlanStages(explanation.queryPlanner?.winningPlan),
  };
}

async function explain(name, query) {
  const explanation = await query.explain("executionStats");
  return summarize(name, explanation);
}

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) throw new Error("MONGO_URI or MONGODB_URI is required.");

await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10_000 });

try {
  const [officialSample, reportSample, predictionSample] = await Promise.all([
    OfficialCase.findOne({ barangayNo: { $ne: null } })
      .select("barangayNo district year month")
      .lean(),
    Report.findOne({ exposureBarangayNo: { $ne: null } })
      .select("exposureBarangayNo reportedAt")
      .lean(),
    PredictionRun.findOne({ status: "success" })
      .sort({ generatedAt: -1 })
      .select("model granularity datasetScope")
      .lean(),
  ]);

  const year = officialSample?.year || new Date().getFullYear();
  const month = officialSample?.month || 1;
  const barangayNo = officialSample?.barangayNo || 1;
  const district = officialSample?.district || "District 1";
  const exposureBarangayNo = reportSample?.exposureBarangayNo || 1;
  const dateFloor = new Date(year, Math.max(0, month - 1), 1);
  const results = [];

  results.push(
    await explain(
      "officialCases: barangayNo + year + month",
      OfficialCase.find({ barangayNo, year, month }).select(
        "district barangay barangayNo disease cases",
      ),
    ),
    await explain(
      "officialCases: district + year + month",
      OfficialCase.find({ district, year, month }).select("district disease cases"),
    ),
  );

  results.push(
    await explain(
      "reports: counted + reported date",
      Report.find({ isCounted: true, reportedAt: { $gte: dateFloor } })
        .sort({ reportedAt: -1 })
        .limit(20)
        .select("caseCount reportedAt"),
    ),
  );
  results.push(
    await explain(
      "reports: exposure barangay + reported date",
      Report.find({
        exposureBarangayNo,
        reportedAt: { $gte: dateFloor },
      })
        .sort({ reportedAt: -1 })
        .limit(20)
        .select("caseCount reportedAt"),
    ),
  );
  const predictionQuery = predictionSample || {
    model: "prophet",
    granularity: "monthly_disease_district_cases",
    datasetScope: "all",
  };
  results.push(
    await explain(
      "predictionRuns: newest successful run by dataset scope",
      PredictionRun.find({
        model: predictionQuery.model,
        granularity: predictionQuery.granularity,
        datasetScope: predictionQuery.datasetScope,
        status: "success",
      })
        .sort({ generatedAt: -1 })
        .limit(1)
        .select("generatedAt basisDatasetId status"),
    ),
  );

  results.push(
    await explain(
      "notifications: newest",
      Notification.find({})
        .sort({ createdAt: -1 })
        .limit(20)
        .select("createdAt unread type"),
    ),
    await explain(
      "notifications: unread newest",
      Notification.find({ unread: true })
        .sort({ createdAt: -1 })
        .limit(20)
        .select("createdAt unread type"),
    ),
  );

  const indexes = {
    officialCases: await OfficialCase.collection.indexes(),
    reports: await Report.collection.indexes(),
    predictionRuns: await PredictionRun.collection.indexes(),
    notifications: await Notification.collection.indexes(),
  };
  console.log(JSON.stringify({ results, indexes }, null, 2));
} finally {
  await mongoose.disconnect();
}
