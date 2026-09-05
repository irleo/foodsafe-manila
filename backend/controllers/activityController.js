import ActivityLog from "../models/ActivityLog.js";
import ReportAuditLog from "../models/ReportAuditLog.js";
import WebUser from "../models/WebUser.js";
import { logRequestError } from "../utils/serverLogger.js";
import { paginationMeta, parsePagination } from "../utils/pagination.js";

const REPORT_WORKFLOW_ROLES = ["admin", "cesu", "surveillance_team"];
const REPORT_ACTIVITY_TITLES = {
  report_submitted: "Citizen report received",
  investigation_recorded: "Report investigation recorded",
  marked_suspected: "Citizen report marked suspected",
  report_ruled_out: "Citizen report ruled out",
  case_confirmed: "Citizen report classified as confirmed",
  case_marked_probable: "Citizen report classified as probable",
  case_not_validated: "Citizen report not validated",
};

function humanize(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function reportSubtitle(item) {
  const report = item.report || {};
  const details = item.metadata || {};
  const district = report.exposureDistrict || report.location?.district;
  const disease = details.suspectedDisease || report.disease;
  const parts = [];

  if (district) parts.push(humanize(district));
  if (disease) parts.push(disease);
  if (item.type === "report_submitted") {
    const caseCount = Number(report.caseCount || 1);
    parts.push(`${caseCount} reported ${caseCount === 1 ? "person" : "people"}`);
    parts.push(report.isCounted === false ? "Retained for audit; not counted" : "Counted report");
  } else if (item.previousStatus !== item.newStatus) {
    parts.push(`${humanize(item.previousStatus)} → ${humanize(item.newStatus)}`);
  }
  if (item.type === "report_ruled_out" && details.reason) {
    parts.push(`Reason: ${humanize(details.reason)}`);
  }
  return parts.filter(Boolean).join(" · ");
}

function actorFor(item, actorMaps) {
  if (!item.actorId) return null;
  if (item.actorModel === "MobileUser") {
    return { id: null, username: "Citizen reporter", role: "citizen" };
  }
  const actor = actorMaps[item.actorModel]?.get(String(item.actorId));
  if (!actor) return null;
  return {
    id: String(actor._id),
    username: actor.username,
    role: actor.role || "citizen",
  };
}

function toActivity(item, actorMaps) {
  const isReportWorkflow = item.source === "report_workflow";
  return {
    id: String(item._id),
    source: item.source,
    type: item.type,
    title: isReportWorkflow
      ? REPORT_ACTIVITY_TITLES[item.type] || humanize(item.type)
      : item.title,
    subtitle: isReportWorkflow ? reportSubtitle(item) : item.subtitle,
    createdAt: item.createdAt,
    actor: actorFor(item, actorMaps),
    metadata: {
      ...(item.metadata || {}),
      ...(isReportWorkflow && item.reportId
        ? { reportId: String(item.reportId) }
        : {}),
    },
  };
}

function activityPipeline({ canViewReportWorkflow, skip, limit }) {
  const pipeline = [
    {
      $project: {
        source: { $literal: "system" },
        type: "$actionType",
        title: 1,
        subtitle: 1,
        createdAt: 1,
        actorId: "$actor",
        actorModel: { $literal: "WebUser" },
        metadata: 1,
      },
    },
  ];

  if (canViewReportWorkflow) {
    pipeline.push({
      $unionWith: {
        coll: "reportAuditLogs",
        pipeline: [
          {
            $lookup: {
              from: "reports",
              localField: "reportId",
              foreignField: "_id",
              as: "report",
            },
          },
          { $unwind: { path: "$report", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              source: { $literal: "report_workflow" },
              type: "$action",
              createdAt: 1,
              actorId: 1,
              actorModel: 1,
              metadata: "$details",
              reportId: 1,
              previousStatus: 1,
              newStatus: 1,
              report: {
                exposureDistrict: "$report.exposureDistrict",
                location: "$report.location",
                disease: "$report.disease",
                caseCount: "$report.caseCount",
                isCounted: "$report.isCounted",
              },
            },
          },
        ],
      },
    });
  }

  pipeline.push(
    { $sort: { createdAt: -1, _id: -1 } },
    { $skip: skip },
    { $limit: limit },
  );
  return pipeline;
}

export const getRecentActivity = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 5,
    });

    const canViewReportWorkflow = REPORT_WORKFLOW_ROLES.includes(req.user?.role);
    const [activities, systemTotal, reportTotal] = await Promise.all([
      ActivityLog.aggregate(activityPipeline({ canViewReportWorkflow, skip, limit })),
      ActivityLog.countDocuments({}),
      canViewReportWorkflow ? ReportAuditLog.countDocuments({}) : Promise.resolve(0),
    ]);

    const webActorIds = activities
      .filter((item) => item.actorModel === "WebUser" && item.actorId)
      .map((item) => item.actorId);
    const webActors = webActorIds.length
      ? await WebUser.find({ _id: { $in: webActorIds } }).select("username role").lean()
      : [];
    const actorMaps = {
      WebUser: new Map(webActors.map((actor) => [String(actor._id), actor])),
    };
    const total = systemTotal + reportTotal;

    return res.json({
      items: activities.map((activity) => toActivity(activity, actorMaps)),
      pagination: paginationMeta({ page, limit, total }),
    });
  } catch (error) {
    logRequestError(error, req, "DASHBOARD_DATA_ERROR");
    return res.status(500).json({ message: "Failed to fetch recent activity." });
  }
};
