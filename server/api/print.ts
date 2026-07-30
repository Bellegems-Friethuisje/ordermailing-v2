import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { adminAuth, db } from "../firebase-admin";

// Printer IP storage only. The printer itself sits on the shop's LAN, which this
// server cannot reach, so the receipt is built and sent from the browser - see
// the print handlers in pages/settings and pages/automaten.

// Firestore location of the shared thermal-printer config (single shop printer).
const CONFIG_DOC = db.collection("config").doc("printer");

// Basic validation for an IPv4[:port] or hostname[:port] target.
const IP_REGEX = /^[a-zA-Z0-9.-]+(:\d{1,5})?$/;

const print = new Hono();

// ─── Auth middleware ──────────────────────────────────────────────────────────
print.use("*", async (c, next) => {
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

// ─── GET /api/print/config ────────────────────────────────────────────────────
// Returns the shared printer IP configured for the shop.
print.get("/config", async (c) => {
  const snap = await CONFIG_DOC.get();
  const ip = snap.exists ? (snap.data()?.ip ?? "") : "";
  return c.json({ ip: typeof ip === "string" ? ip : "" });
});

// ─── PUT /api/print/config ────────────────────────────────────────────────────
// Saves the shared printer IP. An empty string clears it.
print.put("/config", async (c) => {
  let body: { ip?: unknown };
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  }

  const ip = typeof body.ip === "string" ? body.ip.trim() : "";
  if (ip && !IP_REGEX.test(ip)) {
    throw new HTTPException(400, { message: "Ongeldig printer IP-adres." });
  }

  await CONFIG_DOC.set({ ip, updatedAt: new Date().toISOString() }, { merge: true });
  return c.json({ ok: true, ip });
});

export { print as printRouter };
