// Shared vocabulary for the vending machines (automaten). Imported by both the
// server (snapshots, push alerts, history API) and pages/automaten/+Page.vue, so
// the alert text and the UI can never disagree about a machine's name or about
// what counts as "leeg" / "laag".

export interface MachineItem {
  name: string;
  number: number; // current qty in the slot
  total: number; // slot capacity
}

export const MACHINE_CODES = ["4820", "5122", "5317"] as const;
export type MachineCode = (typeof MACHINE_CODES)[number];

export const MACHINE_NAMES: Record<MachineCode, string> = {
  "4820": "Plats - schotels",
  "5122": "Automaat binnen",
  "5317": "Drankjesautomaat",
};

export function isMachineCode(value: unknown): value is MachineCode {
  return typeof value === "string" && (MACHINE_CODES as readonly string[]).includes(value);
}

export function machineName(code: string): string {
  return isMachineCode(code) ? MACHINE_NAMES[code] : code;
}

// ─── Slot status ──────────────────────────────────────────────────────────────
// These are the thresholds the automaten page has always applied; they live here
// now so snapshot counts match what a user sees on screen.
export type SlotStatus = "empty" | "low" | "ok";

export function slotStatus(item: MachineItem): SlotStatus {
  if (item.number === 0) return "empty";
  if (item.number < item.total) return "low";
  return "ok";
}

/**
 * A machine can list the same product in several slots (e.g. "Verse frietjes").
 * The page has always summed those into one row, so snapshots store the merged
 * view too — otherwise slot history would be keyed on a name that appears twice.
 */
export function mergeItems(items: MachineItem[]): MachineItem[] {
  const map = new Map<string, MachineItem>();
  for (const item of items) {
    const existing = map.get(item.name);
    if (existing) {
      existing.number += item.number;
      existing.total += item.total;
    } else {
      map.set(item.name, { ...item });
    }
  }
  return Array.from(map.values());
}

export interface MachineTotals {
  totalFilled: number;
  totalCapacity: number;
  emptyCount: number;
  lowCount: number;
}

/** Expects already-merged items — see {@link mergeItems}. */
export function summariseItems(items: MachineItem[]): MachineTotals {
  let totalFilled = 0;
  let totalCapacity = 0;
  let emptyCount = 0;
  let lowCount = 0;

  for (const item of items) {
    totalFilled += item.number;
    totalCapacity += item.total;
    const status = slotStatus(item);
    if (status === "empty") emptyCount++;
    else if (status === "low") lowCount++;
  }

  return { totalFilled, totalCapacity, emptyCount, lowCount };
}

export function fillPercent(totals: Pick<MachineTotals, "totalFilled" | "totalCapacity">): number {
  if (totals.totalCapacity === 0) return 0;
  return Math.round((totals.totalFilled / totals.totalCapacity) * 100);
}

/** Local (Europe/Brussels) calendar day of an instant, as "YYYY-MM-DD". */
export const AUTOMATEN_TIME_ZONE = "Europe/Brussels";

export function dayKeyOf(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  // en-CA formats as YYYY-MM-DD, which is what we want for lexicographic ranges.
  return new Intl.DateTimeFormat("en-CA", { timeZone: AUTOMATEN_TIME_ZONE }).format(d);
}
