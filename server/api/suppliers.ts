import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, db } from "../firebase-admin";
import { requireAdmin } from "../lib/roles";

const suppliers = new Hono();

// ─── Price helpers ────────────────────────────────────────────────────────────
export type PriceSource = "manual" | "scrape";

/** A single append-only entry for a product's `priceHistory` array. */
function priceHistoryEntry(price: number, source: PriceSource) {
  return { price, date: new Date().toISOString(), source };
}

/** Prices are money — keep them at two decimals so totals don't drift. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Coerce anything the client sends into a non-negative price. */
function toPrice(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? round2(n) : 0;
}

// ─── Auth middleware ──────────────────────────────────────────────────────────
suppliers.use("*", async (c, next) => {
  const authorization = c.req.header("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing or invalid Authorization header" });
  }

  try {
    const idToken = authorization.slice(7);
    const decoded = await adminAuth.verifyIdToken(idToken);
    c.set("uid", decoded.uid);
  } catch {
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }

  return next();
});

// ─── GET /api/suppliers ───────────────────────────────────────────────────────
suppliers.get("/", async (c) => {
  const snapshot = await db.collection("suppliers").orderBy("name").get();
  // `productCount` only needs the number, so ask Firestore to count server-side.
  // Fetching the `products` subcollection instead pulled every product document
  // over the wire — the whole catalogue — to then throw all of it away.
  const counts = await Promise.all(
    snapshot.docs.map((doc) => db.collection("suppliers").doc(doc.id).collection("products").count().get()),
  );
  const list = snapshot.docs.map((doc, i) => ({
    id: doc.id,
    ...doc.data(),
    productCount: counts[i].data().count,
  }));
  return c.json(list);
});

// ─── POST /api/suppliers ──────────────────────────────────────────────────────
suppliers.post("/", async (c) => {
  const { name, email, isActive } = await c.req.json<{
    name: string;
    email: string;
    isActive?: boolean;
  }>();

  if (!name || !email) {
    throw new HTTPException(400, { message: "name and email are required" });
  }

  const ref = await db.collection("suppliers").add({
    name,
    email,
    isActive: isActive ?? true,
    createdAt: new Date().toISOString(),
  });

  const doc = await ref.get();
  return c.json({ id: ref.id, ...doc.data(), productCount: 0 }, 201);
});

// ─── PATCH /api/suppliers/:id ─────────────────────────────────────────────────
suppliers.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Partial<{ name: string; email: string; isActive: boolean }>>();
  const allowed: (keyof typeof body)[] = ["name", "email", "isActive"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }
  await db.collection("suppliers").doc(id).update(update);
  return c.json({ ok: true });
});

// ─── DELETE /api/suppliers/:id ────────────────────────────────────────────────
suppliers.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const productsSnap = await db.collection("suppliers").doc(id).collection("products").get();
  const batch = db.batch();
  productsSnap.docs.forEach((doc) => batch.delete(doc.ref));
  batch.delete(db.collection("suppliers").doc(id));
  await batch.commit();
  return c.json({ ok: true });
});

// ─── POST /api/suppliers/scrape-price ────────────────────────────────────────
// Fetches a product page and tries to pull a price out of it. Best-effort:
// never throws, always answers `{ price, raw, error? }` so the UI can show why.
suppliers.post("/scrape-price", async (c) => {
  const { url } = await c.req.json<{ url: string }>();
  if (!url) throw new HTTPException(400, { message: "url is required" });

  try {
    const { load } = await import("cheerio");
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return c.json({ price: null, raw: null, error: `HTTP ${res.status}` });

    const $ = load(await res.text());

    const selectors = [
      '[itemprop="price"]',
      'meta[itemprop="price"]',
      '[class*="price--current"]',
      '[class*="current-price"]',
      '[class*="sale-price"]',
      '[class*="product-price"]',
      ".price",
      "[data-price]",
      '[class*="price"]',
    ];

    let rawPrice: string | null = null;
    for (const sel of selectors) {
      const el = $(sel).first();
      if (!el.length) continue;
      rawPrice = el.attr("content") ?? el.attr("data-price") ?? el.attr("data-product-price") ?? el.text().trim();
      if (rawPrice) break;
    }

    if (!rawPrice) return c.json({ price: null, raw: null });

    const cleaned = rawPrice.replace(/[^\d,.]/g, "").replace(",", ".");
    const price = parseFloat(cleaned);
    return c.json({ price: isNaN(price) ? null : round2(price), raw: rawPrice });
  } catch (err) {
    return c.json({ price: null, raw: null, error: (err as Error).message });
  }
});

// ─── GET /api/suppliers/:id/products ─────────────────────────────────────────
suppliers.get("/:id/products", async (c) => {
  const id = c.req.param("id");
  const snapshot = await db.collection("suppliers").doc(id).collection("products").orderBy("displayOrder").get();
  const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return c.json(list);
});

// ─── POST /api/suppliers/:id/products ────────────────────────────────────────
suppliers.post("/:id/products", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    supplierName: string;
    internalName: string;
    manualOrder?: boolean;
    isActive?: boolean;
    idealStock?: number;
    displayOrder?: number;
    price?: number;
    priceUnit?: string;
    supplierUrl?: string;
    priceSource?: PriceSource;
  }>();
  const { supplierName, internalName, manualOrder, isActive, idealStock, displayOrder } = body;

  if (!supplierName || !internalName) {
    throw new HTTPException(400, { message: "supplierName and internalName are required" });
  }

  const price = toPrice(body.price);
  const ref = await db
    .collection("suppliers")
    .doc(id)
    .collection("products")
    .add({
      supplierName,
      internalName,
      manualOrder: manualOrder ?? false,
      isActive: isActive ?? true,
      idealStock: idealStock ?? 0,
      displayOrder: displayOrder ?? 0,
      price,
      priceUnit: body.priceUnit || "stuk",
      supplierUrl: body.supplierUrl ?? "",
      // Seed the history with the opening price so later changes have something
      // to be measured against. A product created without a price starts empty.
      priceHistory: price > 0 ? [priceHistoryEntry(price, body.priceSource === "scrape" ? "scrape" : "manual")] : [],
      createdAt: new Date().toISOString(),
    });

  const doc = await ref.get();
  return c.json({ id: ref.id, ...doc.data() }, 201);
});

// ─── PATCH /api/suppliers/:id/products/:productId ────────────────────────────
suppliers.patch("/:id/products/:productId", async (c) => {
  const id = c.req.param("id");
  const productId = c.req.param("productId");
  const body = await c.req.json<
    Partial<{
      supplierName: string;
      internalName: string;
      manualOrder: boolean;
      isActive: boolean;
      idealStock: number;
      displayOrder: number;
      price: number;
      priceUnit: string;
      supplierUrl: string;
      priceSource: PriceSource;
    }>
  >();
  const allowed = [
    "supplierName",
    "internalName",
    "manualOrder",
    "isActive",
    "idealStock",
    "displayOrder",
    "price",
    "priceUnit",
    "supplierUrl",
  ] as const;
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  const ref = db.collection("suppliers").doc(id).collection("products").doc(productId);

  // The history entry is decided here, not by the client: read what the price is
  // right now and only append when it actually moved.
  if ("price" in body) {
    const nextPrice = toPrice(body.price);
    update.price = nextPrice;
    const snap = await ref.get();
    const currentPrice = toPrice(snap.data()?.price);
    if (nextPrice !== currentPrice && nextPrice > 0) {
      update.priceHistory = FieldValue.arrayUnion(
        priceHistoryEntry(nextPrice, body.priceSource === "scrape" ? "scrape" : "manual"),
      );
    }
  }

  await ref.update(update);
  return c.json({ ok: true });
});

// ─── PUT /api/suppliers/:id/products/prices ──────────────────────────────────
// Bulk price entry: one batch, one history entry per *changed* price.
suppliers.put("/:id/products/prices", async (c) => {
  const id = c.req.param("id");
  const { prices } = await c.req.json<{
    prices: Array<{ productId: string; price: number; priceUnit?: string }>;
  }>();

  if (!Array.isArray(prices)) {
    throw new HTTPException(400, { message: "prices array is required" });
  }

  const collection = db.collection("suppliers").doc(id).collection("products");
  const batch = db.batch();
  let updated = 0;
  let historyAppended = 0;

  // One `getAll` for the whole page of prices, rather than a round trip per row
  // in sequence — bulk price entry submits the supplier's entire catalogue.
  const wanted = prices.filter((entry) => entry?.productId);
  const snaps = wanted.length > 0 ? await db.getAll(...wanted.map((entry) => collection.doc(entry.productId))) : [];

  for (const [i, entry] of wanted.entries()) {
    const snap = snaps[i];
    if (!snap.exists) continue;
    const ref = snap.ref;

    const nextPrice = toPrice(entry.price);
    const currentPrice = toPrice(snap.data()?.price);
    const currentUnit = (snap.data()?.priceUnit as string) || "stuk";
    const nextUnit = entry.priceUnit || currentUnit;

    if (nextPrice === currentPrice && nextUnit === currentUnit) continue;

    const update: Record<string, unknown> = { price: nextPrice, priceUnit: nextUnit };
    if (nextPrice !== currentPrice && nextPrice > 0) {
      update.priceHistory = FieldValue.arrayUnion(priceHistoryEntry(nextPrice, "manual"));
      historyAppended++;
    }
    batch.update(ref, update);
    updated++;
  }

  if (updated > 0) await batch.commit();
  return c.json({ ok: true, updated, historyAppended });
});

// ─── DELETE /api/suppliers/:id/products/:productId ───────────────────────────
suppliers.delete("/:id/products/:productId", async (c) => {
  const id = c.req.param("id");
  const productId = c.req.param("productId");
  await db.collection("suppliers").doc(id).collection("products").doc(productId).delete();
  return c.json({ ok: true });
});

// ─── POST /api/suppliers/import ───────────────────────────────────────────────
// Wipes all existing suppliers+products and replaces with imported data.
// Accepts: root array, { suppliers: [...] }, or { data: [...] }
// Product fields: orderName/supplierName → supplierName, displayName/internalName → internalName
suppliers.post("/import", async (c) => {
  await requireAdmin(c.get("uid") as string, "Only admins can import supplier data");

  const body = await c.req.json<unknown>();

  // Normalise to array regardless of wrapper key
  let incoming: unknown[];
  if (Array.isArray(body)) {
    incoming = body;
  } else if (Array.isArray((body as Record<string, unknown>)?.suppliers)) {
    incoming = (body as Record<string, unknown>).suppliers as unknown[];
  } else if (Array.isArray((body as Record<string, unknown>)?.data)) {
    incoming = (body as Record<string, unknown>).data as unknown[];
  } else {
    throw new HTTPException(400, { message: "Expected an array, { suppliers: [...] }, or { data: [...] }" });
  }

  if (incoming.length === 0) {
    throw new HTTPException(400, { message: "Supplier list is empty" });
  }

  // A full wipe-and-replace is thousands of writes. Each one used to be its own
  // awaited round trip; a BulkWriter pipelines them and is the difference
  // between an import that takes minutes and one that takes seconds. New docs
  // get fresh auto-ids, so deletes and creates cannot collide when interleaved.
  const writer = db.bulkWriter();

  // 1. Delete all existing suppliers and their products
  const [existingSnap, existingProductsSnap] = await Promise.all([
    db.collection("suppliers").get(),
    db.collectionGroup("products").get(),
  ]);
  for (const productDoc of existingProductsSnap.docs) writer.delete(productDoc.ref);
  for (const existingDoc of existingSnap.docs) writer.delete(existingDoc.ref);

  // 2. Insert new suppliers and their products
  let suppliersCreated = 0;
  let productsCreated = 0;

  for (const raw of incoming) {
    const s = raw as Record<string, unknown>;
    if (!s.name) continue;
    const supplierRef = db.collection("suppliers").doc();
    writer.create(supplierRef, {
      name: s.name,
      email: s.email ?? "",
      description: s.description ?? "",
      isActive: s.isActive ?? true,
      createdAt: new Date().toISOString(),
    });

    suppliersCreated++;

    for (const rawP of (s.products as unknown[] | undefined) ?? []) {
      const p = rawP as Record<string, unknown>;
      // Accept orderName/displayName (new format) or supplierName/internalName (old format)
      const supplierName = (p.orderName ?? p.supplierName ?? "") as string;
      const internalName = (p.displayName ?? p.internalName ?? supplierName) as string;
      if (!supplierName) continue;
      const price = toPrice(p.price);
      writer.create(supplierRef.collection("products").doc(), {
        supplierName,
        internalName,
        description: p.description ?? "",
        manualOrder: p.manualOrder ?? false,
        isActive: p.isActive ?? true,
        idealStock: (p.defaultStock ?? p.idealStock ?? 0) as number,
        displayOrder: (p.displayOrder ?? 0) as number,
        price,
        priceUnit: (p.priceUnit as string) || "stuk",
        supplierUrl: (p.supplierUrl as string) ?? "",
        priceHistory: price > 0 ? [priceHistoryEntry(price, "manual")] : [],
        createdAt: new Date().toISOString(),
      });
      productsCreated++;
    }
  }

  await writer.close();

  return c.json({ ok: true, suppliersCreated, productsCreated });
});

export { suppliers as suppliersRouter };
