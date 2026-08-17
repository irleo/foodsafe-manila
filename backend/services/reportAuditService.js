import ReportAuditLog from "../models/ReportAuditLog.js";

export async function recordReportAudit({
  reportId,
  actorId,
  actorModel = "WebUser",
  action,
  previousStatus,
  newStatus,
  details = {},
}) {
  if (!reportId || !actorId) throw new Error("Report audit requires reportId and actorId");
  return ReportAuditLog.create({
    reportId,
    actorId,
    actorModel,
    action,
    previousStatus,
    newStatus,
    details,
  });
}

export async function listReportAudit(reportId, limit = 100) {
  return ReportAuditLog.find({ reportId })
    .sort({ createdAt: 1 })
    .limit(Math.min(Math.max(Number(limit) || 100, 1), 100))
    .select("reportId actorId actorModel action previousStatus newStatus details createdAt")
    .populate("actorId", "username role")
    .lean();
}
