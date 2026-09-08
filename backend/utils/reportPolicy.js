const MANILA_UTC_OFFSET_HOURS = 8;
const MANILA_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const MANILA_BOUNDS = Object.freeze({
  minLat: 14.55,
  maxLat: 14.64,
  minLng: 120.94,
  maxLng: 121.03,
});

export function isWithinManilaBounds(lat, lng) {
  return Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= MANILA_BOUNDS.minLat
    && lat <= MANILA_BOUNDS.maxLat
    && lng >= MANILA_BOUNDS.minLng
    && lng <= MANILA_BOUNDS.maxLng;
}

export function reportMaxBackdateDays() {
  const configured = Number(process.env.REPORT_MAX_BACKDATE_DAYS);
  return Number.isInteger(configured) && configured > 0 ? configured : 30;
}

export function validateReportedAt(value, now = new Date()) {
  const reportedAt = value ? new Date(value) : new Date(now);
  if (Number.isNaN(reportedAt.getTime())) {
    return { error: "reportedAt must be a valid date if provided." };
  }

  if (reportedAt.getTime() > now.getTime()) {
    return { error: "reportedAt cannot be in the future." };
  }

  const oldestAllowed = new Date(
    now.getTime() - reportMaxBackdateDays() * 24 * 60 * 60 * 1000,
  );
  if (reportedAt.getTime() < oldestAllowed.getTime()) {
    return {
      error: `reportedAt cannot be older than ${reportMaxBackdateDays()} days.`,
    };
  }

  return { reportedAt };
}

export function buildCitizenDuplicateQuery({
  reportedBy,
  countingDistrictKey,
  since,
}) {
  return {
    reportedBy,
    $or: [
      { exposureDistrict: countingDistrictKey },
      { exposureDistrict: null, "location.district": countingDistrictKey },
    ],
    createdAt: { $gte: since },
    source: "citizen_app",
  };
}

export function parseManilaReportDate(value, { exclusiveEnd = false } = {}) {
  const match = MANILA_DATE_PATTERN.exec(String(value || "").trim());
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const day = Number(dayText);
  const verification = new Date(Date.UTC(year, monthIndex, day));

  if (
    verification.getUTCFullYear() !== year
    || verification.getUTCMonth() !== monthIndex
    || verification.getUTCDate() !== day
  ) {
    return null;
  }

  const boundaryDay = exclusiveEnd ? day + 1 : day;
  return new Date(
    Date.UTC(year, monthIndex, boundaryDay) - MANILA_UTC_OFFSET_HOURS * 60 * 60 * 1000,
  );
}
