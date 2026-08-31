const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ));
}

/**
 * DOH morbidity weeks follow the Sunday-Saturday epidemiological calendar.
 * Week 1 is the week containing January 4, so a morbidity year contains
 * either 52 or 53 complete weeks.
 */
export function morbidityYearStart(year) {
  const normalizedYear = Number(year);
  if (!Number.isInteger(normalizedYear)) return null;
  const januaryFourth = new Date(Date.UTC(normalizedYear, 0, 4));
  return new Date(januaryFourth.getTime() - (januaryFourth.getUTCDay() * DAY_MS));
}

export function morbidityWeeksInYear(year) {
  const start = morbidityYearStart(year);
  const next = morbidityYearStart(Number(year) + 1);
  if (!start || !next) return null;
  return Math.round((next.getTime() - start.getTime()) / (7 * DAY_MS));
}

export function morbidityWeekStartDate(year, week) {
  const start = morbidityYearStart(year);
  const normalizedWeek = Number(week);
  const weeksInYear = morbidityWeeksInYear(year);
  if (
    !start
    || !Number.isInteger(normalizedWeek)
    || normalizedWeek < 1
    || normalizedWeek > weeksInYear
  ) {
    return null;
  }
  return new Date(start.getTime() + ((normalizedWeek - 1) * 7 * DAY_MS));
}

export function getDohMorbidityWeek(value) {
  const date = utcDay(value);
  if (!date) return null;

  const calendarYear = date.getUTCFullYear();
  let epidemiologicalYear = calendarYear;
  if (date < morbidityYearStart(calendarYear)) epidemiologicalYear -= 1;
  else if (date >= morbidityYearStart(calendarYear + 1)) epidemiologicalYear += 1;

  const weekOneStart = morbidityYearStart(epidemiologicalYear);
  const epidemiologicalWeek = Math.floor(
    (date.getTime() - weekOneStart.getTime()) / (7 * DAY_MS),
  ) + 1;
  const weekStartDate = morbidityWeekStartDate(
    epidemiologicalYear,
    epidemiologicalWeek,
  );

  return {
    epidemiologicalYear,
    epidemiologicalWeek,
    weekStartDate,
    weekEndDate: new Date(weekStartDate.getTime() + (6 * DAY_MS)),
  };
}

export function addMorbidityWeeks(year, week, amount = 1) {
  const start = morbidityWeekStartDate(year, week);
  if (!start || !Number.isInteger(Number(amount))) return null;
  return getDohMorbidityWeek(start.getTime() + (Number(amount) * 7 * DAY_MS));
}

export function morbidityPeriodKey(year, week) {
  return `${Number(year)}-MW${String(Number(week)).padStart(2, "0")}`;
}

export function isDateWithinMorbidityWeek(value, year, week) {
  const date = utcDay(value);
  const start = morbidityWeekStartDate(year, week);
  if (!date || !start) return false;
  return date >= start && date.getTime() <= start.getTime() + (6 * DAY_MS);
}

