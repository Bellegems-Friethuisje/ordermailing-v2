import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { adminAuth, db } from "../firebase-admin";
import { ThermalPrinter, PrinterTypes, CharacterSet } from "node-thermal-printer";

// Firestore location of the shared thermal-printer config (single shop printer).
const CONFIG_DOC = db.collection("config").doc("printer");

interface PickItem {
  name: string;
  number: number;
  total: number;
}

interface PrintBody {
  ip?: string;
  machineName?: string;
  items?: PickItem[];
}

// 80mm paper at Font A ≈ 48 characters per line.
const PAPER_WIDTH_CHARS = 48;

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

// ─── POST /api/print ──────────────────────────────────────────────────────────
// Prints a "pluklijst" (pick list) of items to refill on an 80mm thermal printer.
print.post("/", async (c) => {
  let body: PrintBody;
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  }

  const ip = body.ip?.trim();
  if (!ip || !IP_REGEX.test(ip)) {
    throw new HTTPException(400, { message: "Ongeldig printer IP-adres." });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    throw new HTTPException(400, { message: "Niets om te printen." });
  }

  const machineName = (body.machineName ?? "Automaat").toString();

  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: `tcp://${ip}`,
    width: PAPER_WIDTH_CHARS,
    characterSet: CharacterSet.PC858_EURO,
    removeSpecialCharacters: false,
    options: { timeout: 5000 },
  });

  let isConnected = false;
  try {
    isConnected = await printer.isPrinterConnected();
  } catch {
    isConnected = false;
  }
  if (!isConnected) {
    throw new HTTPException(502, {
      message: `Kan geen verbinding maken met de printer op ${ip}.`,
    });
  }

  try {
    printer.alignCenter();
    printer.bold(true);
    printer.setTextSize(1, 1);
    printer.println("PLUKLIJST");
    printer.setTextNormal();
    printer.bold(false);
    printer.println(machineName);
    printer.println(
      new Date().toLocaleString("nl-BE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
    printer.drawLine();

    printer.alignLeft();
    printer.tableCustom([
      { text: "Artikel", align: "LEFT", width: 0.72, bold: true },
      { text: "Pluk", align: "RIGHT", width: 0.28, bold: true },
    ]);
    printer.drawLine();

    let totalToPick = 0;
    for (const item of items) {
      const toPick = Math.max(0, (item.total ?? 0) - (item.number ?? 0));
      totalToPick += toPick;
      printer.tableCustom([
        { text: String(item.name ?? ""), align: "LEFT", width: 0.72 },
        { text: `${toPick}x`, align: "RIGHT", width: 0.28 },
      ]);
    }

    printer.drawLine();
    printer.bold(true);
    printer.tableCustom([
      { text: `Totaal (${items.length} artikelen)`, align: "LEFT", width: 0.72 },
      { text: `${totalToPick}x`, align: "RIGHT", width: 0.28 },
    ]);
    printer.bold(false);

    printer.newLine();
    printer.cut();

    await printer.execute();
  } catch (err) {
    console.error("[print] Failed to print", err);
    throw new HTTPException(500, { message: "Printen mislukt." });
  }

  return c.json({ ok: true });
});

export { print as printRouter };
