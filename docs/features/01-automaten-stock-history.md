# 01 — Automaten stock history, trends & low-stock alerts

**Repo:** this worktree (`Gezellligheid/feature-ideas`)
**Depends on:** nothing
**Language of all user-facing strings:** Dutch

---

## Problem

`/automaten` scrapes live vending-machine stock and throws it away. The only persistence is
an in-memory `Map` with a 5-minute TTL (`server/api/automaten.ts:18`), which dies on every
serverless cold start. Consequences:

- No history → no trend, no "hoe snel loopt dit leeg", no forecasting.
- Staff must open the page and look, manually, to notice an empty slot.
- The cache barely helps in production because Vercel functions rarely stay warm.

## Goal

Persist every scrape as a snapshot, then build three things on top: a per-slot history
chart, a depletion forecast, and a push alert when a machine runs low.

---

## Current state — read these first

| File | What it gives you |
|------|-------------------|
| `server/api/automaten.ts` | `scrapeWithFetch(machine)` → `MachineItem[] = {name, number, total}[]`. `VALID_MACHINES = ["4820","5122","5317"]`. Auth middleware at `:151`. In-memory `cache` at `:18`. |
| `pages/automaten/+Page.vue` | The existing machine picker + filter tabs (Alles/Leeg/Laag/OK) + table. ~488 lines. |
| `server/api/reservations.ts:29` | `sendPushNotification(title, body)` — sends FCM to every token in `push_tokens` where `role == "kassa"`, and prunes dead tokens. **Reuse this**; do not write a second implementation. |
| `.github/workflows/supabase-keepalive.yml` | The existing scheduled-job pattern. Copy it for the scrape cron. |
| `pages/index/+Page.vue` | The CSS bar-chart pattern to mirror (`flex items-end gap-1`, height-styled divs). |

> ⚠️ `server/api/automaten.ts:15` has the point24h username and password hardcoded in
> committed source. While you are in this file, move them to `POINT24H_USER` /
> `POINT24H_PASS` env vars. Note in your PR description that the old credentials are in git
> history and should be rotated — do not attempt the rotation yourself.

---

## Scope

### 1. Persist snapshots

New Firestore collection `automaat_snapshots`, one document per machine per scrape:

```ts
{
  machine: string;            // "4820" | "5122" | "5317"
  scrapedAt: string;          // ISO 8601
  dayKey: string;             // "2026-08-07" — for cheap day-range queries
  items: Array<{
    name: string;
    number: number;           // current qty in the slot
    total: number;            // slot capacity
  }>;
  totalFilled: number;        // Σ number   — denormalised, saves reading items[] for charts
  totalCapacity: number;      // Σ total
  emptyCount: number;         // slots with number === 0
  lowCount: number;           // slots at or under the low threshold
}
```

Use the same low/empty thresholds the UI already applies in `pages/automaten/+Page.vue` —
find them there and extract into a shared helper rather than duplicating the numbers.

Write a snapshot on every successful scrape, **but debounce**: skip the write if the most
recent snapshot for that machine is under 10 minutes old, so a staff member hammering the
refresh button does not spam the collection. Replace the in-memory `cache` with a read of
the latest snapshot (still honouring the 5-minute freshness rule) so warm/cold starts
behave identically.

Add a `retentionDays` cleanup: the cron deletes snapshots older than 180 days.

### 2. Scheduled scrape

A GitHub Action on a cron (every 3 hours between 07:00 and 23:00 Europe/Brussels is a
sensible default) that calls a new endpoint for each machine in `VALID_MACHINES`.

The endpoint must be callable without a Firebase user token — gate it on a shared secret
instead:

```
POST /api/automaten/snapshot
Header: X-Cron-Secret: <process.env.CRON_SECRET>
Body:   { machine: string }
```

Return 401 on a missing/wrong secret. Keep it out of the router-wide Bearer middleware
(register it before `automaten.use("*", ...)` or mount it on a sub-path with its own guard —
mirror how `server/api/reservations.ts` keeps its public POST outside `authMiddleware`).

### 3. History API

```
GET /api/automaten/history?machine=4820&days=30
→ { machine, snapshots: [{ scrapedAt, totalFilled, totalCapacity, emptyCount, lowCount }] }

GET /api/automaten/history/slot?machine=4820&name=<slot name>&days=30
→ { name, points: [{ scrapedAt, number, total }], depletionPerDay: number|null, emptyEta: string|null }
```

Both behind the normal Bearer auth.

**Depletion maths.** Walk the points oldest → newest. A refill is any point where `number`
went *up*; that breaks the series into descending runs. For each run compute
`(firstNumber - lastNumber) / hoursElapsed`, then average the runs weighted by their
duration, and convert to units/day. Ignore runs shorter than 6 hours (too noisy) and return
`null` if fewer than 2 usable runs exist. `emptyEta = now + currentNumber / depletionPerDay`,
clamped to null when the rate is ≤ 0.

Do **not** reach for a stats library — this is ~30 lines and belongs in a
`server/lib/depletion.ts` helper so it can be unit-reasoned about in isolation.

### 4. Low-stock push

At the end of a successful cron snapshot, compare against the previous snapshot for that
machine. Fire `sendPushNotification` when the machine **crosses** from OK into a bad state —
edge-triggered, not level-triggered, or staff get the same alert every 3 hours.

Trigger condition: `emptyCount` rose above 0, or `lowCount` crossed a threshold of 3.
Message in Dutch, e.g. `"De Mol: 2 vakken leeg, 4 bijna leeg"`.

Machine code → display name (`4820` → `De Mol`, etc.) is currently hardcoded in
`pages/automaten/+Page.vue`. Lift that map into a shared module both server and client
import, so the push text and the UI agree.

### 5. UI

On `pages/automaten/+Page.vue`, extend rather than replace:

- A **trend strip** above the table: fill-percentage over the last 14 days as the same
  CSS bar chart used on the dashboard. One bar per day (use the last snapshot of each day).
- Each table row gets a **"Leeg over ~N dagen"** column, greyed out when the forecast is
  null. Red when under 2 days.
- Clicking a row opens a detail drawer (there is a `vaul-vue` drawer already in
  `components/ui`) with that slot's 30-day history chart.
- Show `"Laatst gemeten: <relative time>"` from `scrapedAt` so users know whether they are
  looking at a cron snapshot or a fresh scrape.

---

## Acceptance criteria

- [ ] Hitting `/automaten` twice within 10 minutes creates at most one snapshot document.
- [ ] The cron endpoint returns 401 without the correct `X-Cron-Secret`.
- [ ] With ≥2 days of snapshots, a slot that is being consumed shows a plausible
      "leeg over ~N dagen"; a slot that was refilled mid-window is not thrown off by it.
- [ ] A machine going from 0 empty slots to 2 sends exactly one push; the next cron run
      with the same state sends none.
- [ ] Credentials come from env; no secret literals remain in `server/api/automaten.ts`.
- [ ] `bun run build` passes.

## Out of scope

- Auto-generating an order from the stock deficit (separate feature).
- Any change to the scraping/parsing logic itself.
- Backfilling history — it starts accumulating from deploy.
