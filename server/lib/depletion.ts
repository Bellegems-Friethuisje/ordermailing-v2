// Depletion forecasting for a single automaat slot.
//
// The input is a stock series with gaps and refills in it. A refill (quantity
// going *up*) is not consumption, so the series is cut at every rise into
// descending "runs", each run is turned into a units/hour rate, and the runs are
// averaged weighted by how long they lasted. Short runs are dropped because a
// 20-minute gap between two scrapes turns a single sale into an absurd rate.

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Runs shorter than this are too noisy to derive a rate from. */
const MIN_RUN_HOURS = 6;
/** Below this many usable runs there is not enough signal to forecast. */
const MIN_USABLE_RUNS = 2;

export interface DepletionPoint {
  scrapedAt: string; // ISO 8601
  number: number;
}

export interface DepletionResult {
  /** Units consumed per day, or null when there is not enough signal. */
  depletionPerDay: number | null;
  /** ISO timestamp at which the slot is projected to hit 0, or null. */
  emptyEta: string | null;
  /** How many descending runs contributed to the rate — handy when debugging. */
  usableRuns: number;
}

const EMPTY_RESULT: DepletionResult = { depletionPerDay: null, emptyEta: null, usableRuns: 0 };

function timeOf(point: DepletionPoint): number {
  return Date.parse(point.scrapedAt);
}

/** Splits a chronological series into descending runs, cutting at every refill. */
function splitOnRefills(points: DepletionPoint[]): DepletionPoint[][] {
  const runs: DepletionPoint[][] = [];
  let current: DepletionPoint[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    if (points[i].number > points[i - 1].number) {
      runs.push(current);
      current = [points[i]];
    } else {
      current.push(points[i]);
    }
  }
  runs.push(current);

  return runs;
}

export function computeDepletion(points: DepletionPoint[], now: Date = new Date()): DepletionResult {
  const sorted = points
    .filter((p) => Number.isFinite(p.number) && Number.isFinite(timeOf(p)))
    .sort((a, b) => timeOf(a) - timeOf(b));

  if (sorted.length < 2) return EMPTY_RESULT;

  let weightedHours = 0; // Σ rate × hours
  let totalHours = 0;
  let usableRuns = 0;

  for (const run of splitOnRefills(sorted)) {
    if (run.length < 2) continue;
    const first = run[0];
    const last = run[run.length - 1];
    const hours = (timeOf(last) - timeOf(first)) / HOUR_MS;
    if (hours < MIN_RUN_HOURS) continue;

    // A flat run is real information (nothing sold), so a rate of 0 is kept.
    const perHour = (first.number - last.number) / hours;
    weightedHours += perHour * hours;
    totalHours += hours;
    usableRuns++;
  }

  if (usableRuns < MIN_USABLE_RUNS || totalHours <= 0) return { ...EMPTY_RESULT, usableRuns };

  const perDay = (weightedHours / totalHours) * 24;
  const depletionPerDay = Math.round(perDay * 100) / 100;

  if (perDay <= 0) return { depletionPerDay, emptyEta: null, usableRuns };

  const current = sorted[sorted.length - 1].number;
  const emptyEta = new Date(now.getTime() + (current / perDay) * DAY_MS).toISOString();

  return { depletionPerDay, emptyEta, usableRuns };
}
