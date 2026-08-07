// Persistence for automaat stock snapshots.
//
// Every successful scrape is stored as one document per machine, with the
// per-slot detail plus denormalised totals so charts never have to read items[].
// This collection also replaces the old in-memory cache: a Vercel function is
// almost never warm, so a Map with a TTL bought us nothing.

import { db } from "../firebase-admin";
import { sendPushNotification } from "./push";
import {
  dayKeyOf,
  machineName,
  mergeItems,
  summariseItems,
  type MachineItem,
  type MachineTotals,
} from "../../lib/automaten";

export const SNAPSHOTS_COLLECTION = "automaat_snapshots";

/** A scrape younger than this is served straight from the latest snapshot. */
export const SNAPSHOT_FRESH_MS = 5 * 60 * 1000;
/** Don't write a new snapshot if one this recent exists (refresh-button spam). */
export const SNAPSHOT_DEBOUNCE_MS = 10 * 60 * 1000;
/** Snapshots older than this are deleted by the cron. */
export const SNAPSHOT_RETENTION_DAYS = 180;
/** `lowCount` at or above this counts as "machine needs attention". */
export const LOW_COUNT_ALERT_THRESHOLD = 3;

/** How many expired documents one cron run is allowed to delete. */
const CLEANUP_BATCH_SIZE = 300;

export interface AutomaatSnapshot extends MachineTotals {
  machine: string;
  scrapedAt: string; // ISO 8601
  dayKey: string; // "2026-08-07" — for cheap day-range queries
  items: MachineItem[];
}

export function buildSnapshot(machine: string, rawItems: MachineItem[], scrapedAt = new Date()): AutomaatSnapshot {
  // Stored merged, matching what the page shows — see mergeItems().
  const items = mergeItems(rawItems);
  return {
    machine,
    scrapedAt: scrapedAt.toISOString(),
    dayKey: dayKeyOf(scrapedAt),
    items,
    ...summariseItems(items),
  };
}

export function snapshotAgeMs(snapshot: AutomaatSnapshot, now = Date.now()): number {
  return now - Date.parse(snapshot.scrapedAt);
}

export function isFresh(snapshot: AutomaatSnapshot, now = Date.now()): boolean {
  return snapshotAgeMs(snapshot, now) < SNAPSHOT_FRESH_MS;
}

/** Latest snapshot for a machine, or null when there is none / Firestore is down. */
export async function getLatestSnapshot(machine: string): Promise<AutomaatSnapshot | null> {
  try {
    const snap = await db
      .collection(SNAPSHOTS_COLLECTION)
      .where("machine", "==", machine)
      .orderBy("scrapedAt", "desc")
      .limit(1)
      .get();
    return snap.empty ? null : (snap.docs[0].data() as AutomaatSnapshot);
  } catch (err) {
    console.error("[automaten] Failed to read latest snapshot for", machine, err);
    return null;
  }
}

export async function getSnapshotsSince(machine: string, since: Date): Promise<AutomaatSnapshot[]> {
  const snap = await db
    .collection(SNAPSHOTS_COLLECTION)
    .where("machine", "==", machine)
    .where("scrapedAt", ">=", since.toISOString())
    .orderBy("scrapedAt", "asc")
    .get();
  return snap.docs.map((doc) => doc.data() as AutomaatSnapshot);
}

export interface SaveSnapshotResult {
  snapshot: AutomaatSnapshot;
  /** False when the debounce window swallowed the write. */
  written: boolean;
  /** The stored snapshot this one was compared against, if any. */
  previous: AutomaatSnapshot | null;
}

/**
 * Stores a scrape, unless a snapshot for this machine is younger than
 * SNAPSHOT_DEBOUNCE_MS. A write failure is logged, not thrown: the caller still
 * has fresh data to serve and a lost snapshot is not worth a 500.
 */
export async function saveSnapshot(machine: string, rawItems: MachineItem[]): Promise<SaveSnapshotResult> {
  const snapshot = buildSnapshot(machine, rawItems);
  const previous = await getLatestSnapshot(machine);

  if (previous && snapshotAgeMs(previous) < SNAPSHOT_DEBOUNCE_MS) {
    return { snapshot, written: false, previous };
  }

  try {
    await db.collection(SNAPSHOTS_COLLECTION).add(snapshot);
    return { snapshot, written: true, previous };
  } catch (err) {
    console.error("[automaten] Failed to write snapshot for", machine, err);
    return { snapshot, written: false, previous };
  }
}

// ─── Low-stock alerting ───────────────────────────────────────────────────────

function needsAttention(totals: MachineTotals): boolean {
  return totals.emptyCount > 0 || totals.lowCount >= LOW_COUNT_ALERT_THRESHOLD;
}

/**
 * Edge-triggered: only the transition from OK into a bad state alerts. Without
 * this, staff would get the same notification every three hours until someone
 * refills the machine.
 */
export function crossedIntoBadState(previous: AutomaatSnapshot | null, next: AutomaatSnapshot): boolean {
  if (!needsAttention(next)) return false;
  return previous ? !needsAttention(previous) : true;
}

function pluralVakken(count: number): string {
  return count === 1 ? "1 vak" : `${count} vakken`;
}

export function lowStockMessage(snapshot: AutomaatSnapshot): string {
  const parts: string[] = [];
  if (snapshot.emptyCount > 0) parts.push(`${pluralVakken(snapshot.emptyCount)} leeg`);
  if (snapshot.lowCount > 0) parts.push(`${pluralVakken(snapshot.lowCount)} bijna leeg`);
  return `${machineName(snapshot.machine)}: ${parts.join(", ")}`;
}

/** Returns true when a push was actually sent. */
export async function alertIfLow(previous: AutomaatSnapshot | null, next: AutomaatSnapshot): Promise<boolean> {
  if (!crossedIntoBadState(previous, next)) return false;
  await sendPushNotification("Automaat bijna leeg", lowStockMessage(next));
  return true;
}

// ─── Retention ────────────────────────────────────────────────────────────────

/** Deletes expired snapshots, capped per run. Returns how many were removed. */
export async function pruneOldSnapshots(retentionDays = SNAPSHOT_RETENTION_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
  try {
    const expired = await db
      .collection(SNAPSHOTS_COLLECTION)
      .where("scrapedAt", "<", cutoff)
      .limit(CLEANUP_BATCH_SIZE)
      .get();
    if (expired.empty) return 0;

    const batch = db.batch();
    for (const doc of expired.docs) batch.delete(doc.ref);
    await batch.commit();
    return expired.size;
  } catch (err) {
    console.error("[automaten] Failed to prune old snapshots", err);
    return 0;
  }
}
