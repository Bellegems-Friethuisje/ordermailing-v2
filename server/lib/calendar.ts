/**
 * Belgian calendar context (public holidays + Flemish school holidays) for the AI
 * order-template prompt. No external API — public holidays are computed, school
 * holidays come from a static table that needs a yearly refresh (see below).
 */

export type CalendarDay = {
  /** YYYY-MM-DD */
  date: string;
  /** Dutch weekday, e.g. "maandag" */
  dayName: string;
  isPublicHoliday: boolean;
  holidayName?: string;
  isSchoolHoliday: boolean;
};

const DAY_NAMES = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
const DAY_NAMES_SHORT = ["zo", "ma", "di", "wo", "do", "vr", "za"];

/**
 * Flemish (Vlaamse Gemeenschap) school holidays.
 *
 * ⚠️ STATIC TABLE — NEEDS A YEARLY REFRESH.
 * Covers school years 2025-2026 and 2026-2027. Add the next school year (and verify the
 * one after the current one) each summer against onderwijs.vlaanderen.be. Days outside
 * every listed range are simply treated as school days, so a stale table degrades to
 * "no vacation" rather than to wrong dates.
 * Ranges are inclusive on both ends.
 */
const SCHOOL_HOLIDAYS: Array<{ from: string; to: string; name: string }> = [
  // ── School year 2025-2026 ──
  { from: "2025-07-01", to: "2025-08-31", name: "zomervakantie" },
  { from: "2025-10-27", to: "2025-11-02", name: "herfstvakantie" },
  { from: "2025-12-22", to: "2026-01-04", name: "kerstvakantie" },
  { from: "2026-02-16", to: "2026-02-22", name: "krokusvakantie" },
  { from: "2026-04-06", to: "2026-04-19", name: "paasvakantie" },
  // ── School year 2026-2027 ──
  { from: "2026-07-01", to: "2026-08-31", name: "zomervakantie" },
  { from: "2026-11-02", to: "2026-11-08", name: "herfstvakantie" },
  { from: "2026-12-21", to: "2027-01-03", name: "kerstvakantie" },
  { from: "2027-02-08", to: "2027-02-14", name: "krokusvakantie" },
  { from: "2027-03-29", to: "2027-04-11", name: "paasvakantie" },
  { from: "2027-07-01", to: "2027-08-31", name: "zomervakantie" },
];

/** Anonymous Gregorian computus — returns Easter Sunday for the given year (UTC). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

/** Belgian public holidays for a year, keyed by YYYY-MM-DD. */
function publicHolidays(year: number): Record<string, string> {
  const easter = easterSunday(year);
  return {
    [`${year}-01-01`]: "Nieuwjaar",
    [iso(addDays(easter, 1))]: "Paasmaandag",
    [`${year}-05-01`]: "Dag van de Arbeid",
    [iso(addDays(easter, 39))]: "O.H. Hemelvaart",
    [iso(addDays(easter, 50))]: "Pinkstermaandag",
    [`${year}-07-21`]: "Nationale feestdag",
    [`${year}-08-15`]: "O.L.V. Hemelvaart",
    [`${year}-11-01`]: "Allerheiligen",
    [`${year}-11-11`]: "Wapenstilstand",
    [`${year}-12-25`]: "Kerstmis",
  };
}

/** The name of the school holiday covering `date`, or null. */
export function schoolHolidayName(date: string): string | null {
  const match = SCHOOL_HOLIDAYS.find((h) => date >= h.from && date <= h.to);
  return match ? match.name : null;
}

/** Today in Europe/Brussels as YYYY-MM-DD, regardless of the server's own timezone. */
export function todayInBrussels(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function dutchDayName(date: string): string {
  return DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export function dutchDayNameShort(date: string): string {
  return DAY_NAMES_SHORT[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

/** Calendar context for `count` days starting today (Europe/Brussels). */
export function getCalendarContext(count = 7, now: Date = new Date()): CalendarDay[] {
  const start = new Date(`${todayInBrussels(now)}T00:00:00Z`);
  const holidaysByYear = new Map<number, Record<string, string>>();

  return Array.from({ length: count }, (_, i) => {
    const d = addDays(start, i);
    const date = iso(d);
    const year = d.getUTCFullYear();

    if (!holidaysByYear.has(year)) holidaysByYear.set(year, publicHolidays(year));
    const holidayName = holidaysByYear.get(year)![date];

    return {
      date,
      dayName: DAY_NAMES[d.getUTCDay()],
      isPublicHoliday: !!holidayName,
      ...(holidayName && { holidayName }),
      isSchoolHoliday: schoolHolidayName(date) !== null,
    };
  });
}
