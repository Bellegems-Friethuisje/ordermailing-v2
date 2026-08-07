import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { adminAuth } from "../firebase-admin";
import * as cheerio from "cheerio";
import { MACHINE_CODES, isMachineCode, type MachineItem } from "../../lib/automaten";
import { computeDepletion } from "../lib/depletion";
import {
  alertIfLow,
  getLatestSnapshot,
  getSnapshotsSince,
  isFresh,
  pruneOldSnapshots,
  saveSnapshot,
  type AutomaatSnapshot,
} from "../lib/automaatSnapshots";

export type { MachineItem };

const BASE_URL = "https://data.point24h.com";
const CREDENTIALS = {
  username: process.env.POINT24H_USER ?? "",
  password: process.env.POINT24H_PASS ?? "",
};

const HISTORY_MAX_DAYS = 180;
const HISTORY_DEFAULT_DAYS = 30;

const isDev = process.env.NODE_ENV === "development";
const devLog = (...args: unknown[]) => { if (isDev) console.log(...args); };

async function scrapeWithFetch(machine: string): Promise<MachineItem[]> {
  if (!CREDENTIALS.username || !CREDENTIALS.password) {
    throw new Error("POINT24H_USER / POINT24H_PASS are not configured");
  }

  const cookies: Record<string, string> = {};

  const getCookieHeader = () =>
    Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

  const saveCookies = (res: Response) => {
    // Use getSetCookie() (Node 18.14+) to get each Set-Cookie header separately.
    // Falling back to get('set-cookie') is unreliable as it merges multiple headers.
    const headers = res.headers as any;
    const list: string[] =
      typeof headers.getSetCookie === "function"
        ? headers.getSetCookie()
        : (res.headers.get("set-cookie") ?? "").split(/,(?=[^ ])/).filter(Boolean);
    for (const cookie of list) {
      const [nameValue] = cookie.split(";");
      const eq = nameValue.indexOf("=");
      if (eq > 0) {
        cookies[nameValue.slice(0, eq).trim()] = nameValue.slice(eq + 1).trim();
      }
    }
  };

  // Helper: fetch with redirect:manual so we capture Set-Cookie on 302 responses,
  // then follow the redirect chain ourselves.
  const BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "nl-BE,nl;q=0.9,en;q=0.8",
  };

  const fetchManual = async (url: string, init: RequestInit = {}): Promise<Response> => {
    let currentUrl = url;
    let currentInit = init;
    for (let i = 0; i < 10; i++) {
      const res = await fetch(currentUrl, {
        ...currentInit,
        headers: { ...BROWSER_HEADERS, Cookie: getCookieHeader(), ...(currentInit.headers as object ?? {}) },
        redirect: "manual",
      });
      saveCookies(res);
      devLog(`[automaten] ${currentInit.method ?? "GET"} ${currentUrl} → ${res.status}`);
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return res;
        currentUrl = new URL(location, currentUrl).toString();
        currentInit = {};
      } else {
        return res;
      }
    }
    throw new Error("Too many redirects");
  };

  // Step 1: Hit logout URL to get a fresh session and the login form
  const logoutRes = await fetchManual(`${BASE_URL}/index.php?azione=Logout`);
  const loginHtml = await logoutRes.text();
  devLog("[automaten] cookies after logout:", getCookieHeader());
  devLog("[automaten] login form HTML:", cheerio.load(loginHtml)("form").html()?.slice(0, 800));

  // Step 2: Extract form action and submit button value from the login page
  const $login = cheerio.load(loginHtml);
  const formAction = $login("form").attr("action") ?? "/index.php";
  const submitValue = ($login('input[name="posted_azione"]').val() as string | undefined) ?? "Login";
  devLog("[automaten] formAction:", formAction, "| submitValue:", submitValue);
  devLog("[automaten] login page title:", $login("title").text());

  // Step 3: POST login credentials (redirect:manual via fetchManual captures the session cookie)
  // The site's login form injects `js=presente` via JavaScript as a basic bot-check.
  await fetchManual(new URL(formAction, BASE_URL).toString(), {
    method: "POST",
    headers: {
      Cookie: getCookieHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
      "Referer": `${BASE_URL}/index.php?azione=Logout`,
      "Origin": BASE_URL,
    },
    body: new URLSearchParams({
      posted_username: CREDENTIALS.username,
      posted_password: CREDENTIALS.password,
      posted_azione: submitValue,
      js: "presente",
    }).toString(),
  });
  devLog("[automaten] cookies after login:", getCookieHeader());

  // Step 4: Fetch machine inventory page
  const machineRes = await fetchManual(`${BASE_URL}/dev/index.php?azione=Kaart%20kast&matricola_macchina=${machine}`);
  const html = await machineRes.text();
  const $html = cheerio.load(html);
  devLog("[automaten] machine page title:", $html("title").text());
  devLog("[automaten] #dati found:", $html("#dati").length > 0);
  // Step 5: Parse table with cheerio (same logic as before)
  const $ = cheerio.load(html);
  const tableList: string[][] = [];

  $("#dati tr").each((_index, row) => {
    const rowList: string[] = [];
    $(row)
      .find("td")
      .each((_, cell) => rowList.push($(cell).text().trim()));
    tableList.push(rowList);
  });

  const items: MachineItem[] = [];
  let fries = 0;

  for (const element of tableList) {
    if (element.length === 0 || element[4]?.includes("↑") || !element[4]) continue;
    let name = element[4];
    if (name.includes("Verse frietjes")) {
      fries++;
      if (fries > 3) name = "Verse frietjes Klein (voorgebakken)";
    }
    const number = Number(element[5]);
    const total = Number(element[6]);
    if (!isNaN(number) && !isNaN(total)) {
      items.push({ name, number, total });
    }
  }

  return items;
}

const automaten = new Hono();

function requireMachine(value: string | undefined): string {
  if (!value || !isMachineCode(value)) {
    throw new HTTPException(400, {
      message: `Invalid machine code. Must be one of: ${MACHINE_CODES.join(", ")}`,
    });
  }
  return value;
}

// ─── POST /api/automaten/snapshot (cron) ──────────────────────────────────────
// Registered *before* the Bearer middleware below so the GitHub Action can reach
// it without a Firebase user; it carries its own shared-secret guard instead.
// Hono runs matching handlers in registration order, so this one replies first.
automaten.post("/snapshot", async (c) => {
  const expected = process.env.CRON_SECRET;
  if (!expected || c.req.header("X-Cron-Secret") !== expected) {
    throw new HTTPException(401, { message: "Invalid cron secret" });
  }

  const body = await c.req.json<{ machine?: string }>().catch(() => ({}) as { machine?: string });
  const machine = requireMachine(body.machine);

  let items: MachineItem[];
  try {
    items = await scrapeWithFetch(machine);
  } catch (err) {
    console.error("[automaten] Cron scrape failed for machine", machine, err);
    throw new HTTPException(502, { message: "Failed to fetch machine data" });
  }

  if (items.length === 0) {
    // An empty parse is a scrape failure, not an empty machine — storing it would
    // fake a total depletion and fire a bogus alert.
    throw new HTTPException(502, { message: "Scrape returned no slots" });
  }

  const { snapshot, written, previous } = await saveSnapshot(machine, items);
  // Only a stored snapshot may alert, so the edge comparison stays anchored to
  // what is actually in the collection.
  const alerted = written ? await alertIfLow(previous, snapshot) : false;
  const pruned = await pruneOldSnapshots();

  return c.json({
    ok: true,
    machine,
    written,
    alerted,
    pruned,
    scrapedAt: snapshot.scrapedAt,
    emptyCount: snapshot.emptyCount,
    lowCount: snapshot.lowCount,
  });
});

// ─── Auth middleware ──────────────────────────────────────────────────────────
automaten.use("*", async (c, next) => {
  const authorization = c.req.header("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing or invalid Authorization header" });
  }
  try {
    await adminAuth.verifyIdToken(authorization.slice(7));
  } catch {
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }
  return next();
});

// ─── GET /api/automaten?machine=XXXX ─────────────────────────────────────────
automaten.get("/", async (c) => {
  const machine = requireMachine(c.req.query("machine"));

  // The latest snapshot is the cache: an in-memory Map died on every cold start.
  const latest = await getLatestSnapshot(machine);
  if (latest && isFresh(latest)) {
    return c.json({ ok: true, machine, items: latest.items, scrapedAt: latest.scrapedAt, cached: true });
  }

  try {
    const items = await scrapeWithFetch(machine);
    if (items.length === 0) {
      // Fall back to a stale snapshot rather than showing an empty machine.
      if (latest) {
        return c.json({ ok: true, machine, items: latest.items, scrapedAt: latest.scrapedAt, cached: true });
      }
      return c.json({ ok: true, machine, items, scrapedAt: new Date().toISOString(), cached: false });
    }

    const { snapshot } = await saveSnapshot(machine, items);
    return c.json({ ok: true, machine, items: snapshot.items, scrapedAt: snapshot.scrapedAt, cached: false });
  } catch (err) {
    console.error("[automaten] Error scraping machine", machine, err);
    throw new HTTPException(500, { message: "Failed to fetch machine data" });
  }
});

// ─── History ──────────────────────────────────────────────────────────────────

function requireDays(raw: string | undefined): number {
  const days = Number(raw ?? HISTORY_DEFAULT_DAYS);
  if (!Number.isFinite(days) || days < 1) return HISTORY_DEFAULT_DAYS;
  return Math.min(Math.floor(days), HISTORY_MAX_DAYS);
}

function since(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

async function loadHistory(machine: string, days: number): Promise<AutomaatSnapshot[]> {
  try {
    return await getSnapshotsSince(machine, since(days));
  } catch (err) {
    console.error("[automaten] Failed to read history for", machine, err);
    throw new HTTPException(500, { message: "Failed to read history" });
  }
}

/** Chronological stock series for one slot name across snapshots. */
function slotSeries(snapshots: AutomaatSnapshot[], name: string) {
  const points: Array<{ scrapedAt: string; number: number; total: number }> = [];
  for (const snapshot of snapshots) {
    const item = snapshot.items.find((i) => i.name === name);
    if (item) points.push({ scrapedAt: snapshot.scrapedAt, number: item.number, total: item.total });
  }
  return points;
}

// ─── GET /api/automaten/history?machine=XXXX&days=30 ─────────────────────────
// `slots` carries the per-slot forecast alongside the totals so the page can
// render a "leeg over ~N dagen" column without one request per slot.
automaten.get("/history", async (c) => {
  const machine = requireMachine(c.req.query("machine"));
  const days = requireDays(c.req.query("days"));
  const snapshots = await loadHistory(machine, days);

  const latest = snapshots[snapshots.length - 1];
  const slots = (latest?.items ?? []).map((item) => {
    const { depletionPerDay, emptyEta } = computeDepletion(slotSeries(snapshots, item.name));
    return { name: item.name, number: item.number, total: item.total, depletionPerDay, emptyEta };
  });

  return c.json({
    machine,
    days,
    snapshots: snapshots.map(({ scrapedAt, dayKey, totalFilled, totalCapacity, emptyCount, lowCount }) => ({
      scrapedAt,
      dayKey,
      totalFilled,
      totalCapacity,
      emptyCount,
      lowCount,
    })),
    slots,
  });
});

// ─── GET /api/automaten/history/slot?machine=XXXX&name=…&days=30 ─────────────
automaten.get("/history/slot", async (c) => {
  const machine = requireMachine(c.req.query("machine"));
  const name = c.req.query("name");
  if (!name) throw new HTTPException(400, { message: "Missing slot name" });

  const days = requireDays(c.req.query("days"));
  const snapshots = await loadHistory(machine, days);
  const points = slotSeries(snapshots, name);
  const { depletionPerDay, emptyEta } = computeDepletion(points);

  return c.json({ machine, name, days, points, depletionPerDay, emptyEta });
});

export { automaten as automatenRouter };
