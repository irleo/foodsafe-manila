function reportDistrict(report) {
  const value = report?.exposureDistrict || report?.location?.district || "Unassigned";
  return String(value)
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function reportDisease(report) {
  return String(
    report?.disease
      || report?.investigation?.suspectedDisease
      || report?.validation?.condition
      || "Unclassified",
  ).trim();
}

/**
 * Converts citizen reports into report-volume chart rows without promoting
 * their workflow classification to an official case classification.
 * Every citizen report remains "reported" after review or validation.
 */
export function buildReportVolumeRows(reports = []) {
  return (Array.isArray(reports) ? reports : []).flatMap((report) => {
    const reportedAt = new Date(report?.reportedAt || report?.createdAt || "");
    if (Number.isNaN(reportedAt.getTime())) return [];
    return [{
      city: "Manila",
      district: reportDistrict(report),
      disease: reportDisease(report),
      year: reportedAt.getUTCFullYear(),
      month: reportedAt.getUTCMonth() + 1,
      caseClassification: "reported",
      cases: 1,
      sourceType: "citizen_report",
    }];
  });
}
