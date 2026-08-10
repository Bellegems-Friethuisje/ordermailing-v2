import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { adminAuth, db } from "../firebase-admin";

const inventory = new Hono();

// An item is either a supplier product or a standalone (non-orderable) product.
// Documents written before standalone products existed have no `source`; those
// are supplier products.
type ItemSource = "supplier" | "standalone";

interface InventoryItem {
  source: ItemSource;
  productId: string;
  supplierId: string | null;
  supplierCompanyName: string;
  internalName: string;
  supplierProductName: string;
  quantity: number;
  priceAtCount: number;
  priceUnit: string;
  totalValue: number;
}

// A thing that gets counted but is never ordered through the app: verpakking,
// schoonmaak, gas, drank from the cash-and-carry, equipment.
interface StandaloneProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  priceUnit: string;
  supplierLabel?: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  createdBy: string;
}

// Standalone products have no supplier document, so they all land in one
// pseudo-supplier group. Every consumer of items[] groups on
// supplierId/supplierCompanyName and keeps working unchanged.
const STANDALONE_COMPANY_NAME = "Overige";

function sourceOf(item: { source?: string }): ItemSource {
  return item.source === "standalone" ? "standalone" : "supplier";
}

function itemKey(item: { source?: string; productId: string }): string {
  return `${sourceOf(item)}:${item.productId}`;
}

function standaloneItem(id: string, p: FirebaseFirestore.DocumentData): InventoryItem {
  return {
    source: "standalone",
    productId: id,
    supplierId: null,
    supplierCompanyName: STANDALONE_COMPANY_NAME,
    internalName: p.name,
    supplierProductName: p.category ?? "",
    quantity: 0,
    priceAtCount: p.price ?? 0,
    priceUnit: p.priceUnit ?? "stuk",
    totalValue: 0,
  };
}

function supplierItem(
  productId: string,
  p: FirebaseFirestore.DocumentData,
  supplierId: string,
  supplierName: string,
): InventoryItem {
  return {
    source: "supplier",
    productId,
    supplierId,
    supplierCompanyName: supplierName,
    internalName: p.internalName,
    supplierProductName: p.supplierName,
    quantity: 0,
    priceAtCount: p.price ?? 0,
    priceUnit: p.priceUnit ?? "stuk",
    totalValue: 0,
  };
}

inventory.use("*", async (c, next) => {
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

// ─── Non-orderable products ───────────────────────────────────────────────────
// These routes must stay above /:id, otherwise "products" resolves as an id.

const PRODUCT_FIELDS = ["name", "category", "price", "priceUnit", "supplierLabel", "isActive", "displayOrder"] as const;

// GET /api/inventory/products
inventory.get("/products", async (c) => {
  const includeInactive = c.req.query("includeInactive") === "true";
  const snapshot = await db.collection("inventory_products").orderBy("displayOrder").get();
  const list = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as StandaloneProduct)
    .filter((p) => includeInactive || p.isActive !== false)
    .sort((a, b) => (a.category ?? "").localeCompare(b.category ?? "") || (a.name ?? "").localeCompare(b.name ?? ""));
  return c.json(list);
});

// POST /api/inventory/products
inventory.post("/products", async (c) => {
  const body = await c.req.json<{
    name: string;
    category?: string;
    price?: number;
    priceUnit?: string;
    supplierLabel?: string;
    isActive?: boolean;
    displayOrder?: number;
  }>();

  if (!body.name?.trim()) throw new HTTPException(400, { message: "name is required" });

  const doc = {
    name: body.name.trim(),
    category: body.category?.trim() || "Overige",
    price: Number(body.price) || 0,
    priceUnit: body.priceUnit || "stuk",
    supplierLabel: body.supplierLabel?.trim() ?? "",
    isActive: body.isActive ?? true,
    displayOrder: Number(body.displayOrder) || 0,
    createdAt: new Date().toISOString(),
    createdBy: c.get("uid"),
  };

  const ref = await db.collection("inventory_products").add(doc);
  return c.json({ id: ref.id, ...doc }, 201);
});

// PATCH /api/inventory/products/:productId
inventory.patch("/products/:productId", async (c) => {
  const productId = c.req.param("productId");
  const body = await c.req.json<Record<string, unknown>>();
  const update: Record<string, unknown> = {};
  for (const key of PRODUCT_FIELDS) {
    if (!(key in body)) continue;
    if (key === "price" || key === "displayOrder") update[key] = Number(body[key]) || 0;
    else if (key === "name" || key === "category") update[key] = String(body[key] ?? "").trim();
    else update[key] = body[key];
  }
  if (update.name === "") throw new HTTPException(400, { message: "name mag niet leeg zijn" });
  if (update.category === "") update.category = "Overige";
  if (Object.keys(update).length === 0) throw new HTTPException(400, { message: "Niets om aan te passen" });

  await db.collection("inventory_products").doc(productId).update(update);
  return c.json({ ok: true });
});

// DELETE /api/inventory/products/:productId
inventory.delete("/products/:productId", async (c) => {
  const productId = c.req.param("productId");

  const openCounts = await db.collection("inventory_counts").where("status", "==", "open").get();
  const blocking = openCounts.docs.find((doc) =>
    ((doc.data().items ?? []) as InventoryItem[]).some(
      (item) => sourceOf(item) === "standalone" && item.productId === productId,
    ),
  );
  if (blocking) {
    throw new HTTPException(409, {
      message: `Dit product staat nog in de open telling "${blocking.data().label}". Sluit die telling eerst af.`,
    });
  }

  await db.collection("inventory_products").doc(productId).delete();
  return c.json({ ok: true });
});

// ─── Counts ───────────────────────────────────────────────────────────────────

// GET /api/inventory
inventory.get("/", async (c) => {
  const snapshot = await db.collection("inventory_counts").orderBy("year", "desc").get();
  const list = snapshot.docs.map((doc) => {
    const data = doc.data();
    const items: InventoryItem[] = data.items ?? [];
    const totalValue = items.reduce((sum, item) => sum + (item.totalValue ?? 0), 0);
    const countedProducts = items.filter((i) => (i.quantity ?? 0) > 0).length;
    return {
      id: doc.id,
      year: data.year,
      label: data.label,
      status: data.status,
      startedAt: data.startedAt,
      closedAt: data.closedAt ?? null,
      createdBy: data.createdBy,
      totalItems: items.length,
      countedProducts,
      totalValue,
    };
  });
  return c.json(list);
});

// POST /api/inventory
inventory.post("/", async (c) => {
  const { year, label } = await c.req.json<{ year: number; label?: string }>();
  if (!year) throw new HTTPException(400, { message: "year is required" });

  const existing = await db.collection("inventory_counts").where("year", "==", year).get();
  if (!existing.empty) {
    throw new HTTPException(400, { message: `Een inventaris voor ${year} bestaat al` });
  }

  // Opening a count reads the whole catalogue. The suppliers, their products and
  // the standalone products are independent reads, so they go out together
  // instead of one supplier's products at a time.
  const [suppliersSnap, standaloneSnap] = await Promise.all([
    db.collection("suppliers").orderBy("name").get(),
    db.collection("inventory_products").orderBy("displayOrder").get(),
  ]);

  const activeSuppliers = suppliersSnap.docs.filter((doc) => doc.data().isActive);
  const productSnaps = await Promise.all(
    activeSuppliers.map((doc) => doc.ref.collection("products").orderBy("displayOrder").get()),
  );

  const items: InventoryItem[] = [];
  activeSuppliers.forEach((supplierDoc, i) => {
    const s = supplierDoc.data();
    for (const productDoc of productSnaps[i].docs) {
      const p = productDoc.data();
      if (!p.isActive) continue;
      items.push(supplierItem(productDoc.id, p, supplierDoc.id, s.name));
    }
  });

  for (const productDoc of standaloneSnap.docs) {
    const p = productDoc.data();
    if (p.isActive === false) continue;
    items.push(standaloneItem(productDoc.id, p));
  }

  const ref = await db.collection("inventory_counts").add({
    year,
    label: label ?? `Inventaris ${year}`,
    status: "open",
    startedAt: new Date().toISOString(),
    createdBy: c.get("uid"),
    items,
  });

  return c.json(
    { id: ref.id, year, label: label ?? `Inventaris ${year}`, status: "open", totalItems: items.length },
    201,
  );
});

// GET /api/inventory/:id
inventory.get("/:id", async (c) => {
  const id = c.req.param("id");
  const doc = await db.collection("inventory_counts").doc(id).get();
  if (!doc.exists) throw new HTTPException(404, { message: "Not found" });
  const data = doc.data()!;
  const items = ((data.items ?? []) as InventoryItem[]).map((item) => ({ ...item, source: sourceOf(item) }));
  return c.json({ id: doc.id, ...data, items });
});

// PATCH /api/inventory/:id
inventory.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ status?: "open" | "closed"; label?: string }>();
  const update: Record<string, unknown> = {};
  if (body.status !== undefined) {
    update.status = body.status;
    if (body.status === "closed") update.closedAt = new Date().toISOString();
  }
  if (body.label !== undefined) update.label = body.label;
  await db.collection("inventory_counts").doc(id).update(update);
  return c.json({ ok: true });
});

// PUT /api/inventory/:id/items
inventory.put("/:id/items", async (c) => {
  const id = c.req.param("id");
  const { items } = await c.req.json<{ items: InventoryItem[] }>();

  const ref = db.collection("inventory_counts").doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new HTTPException(404, { message: "Not found" });
  if (doc.data()?.status === "closed") {
    throw new HTTPException(409, { message: "Deze telling is afgesloten en kan niet meer aangepast worden" });
  }

  // Totals are always recomputed here; whatever the client sent is ignored.
  const enriched = items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const priceAtCount = Number(item.priceAtCount) || 0;
    return {
      ...item,
      source: sourceOf(item),
      quantity,
      priceAtCount,
      totalValue: quantity * priceAtCount,
    };
  });

  await ref.update({ items: enriched });
  return c.json({ ok: true });
});

// POST /api/inventory/:id/items/add
// Appends products to a count that is already under way, without touching the
// quantities already entered. Adding something that is already there is a no-op.
inventory.post("/:id/items/add", async (c) => {
  const id = c.req.param("id");
  const { items: requested } = await c.req.json<{
    items: { source?: ItemSource; productId: string; supplierId?: string }[];
  }>();
  if (!Array.isArray(requested)) throw new HTTPException(400, { message: "items is required" });

  const ref = db.collection("inventory_counts").doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new HTTPException(404, { message: "Not found" });
  if (doc.data()?.status === "closed") {
    throw new HTTPException(409, { message: "Deze telling is afgesloten en kan niet meer aangepast worden" });
  }

  const existing = ((doc.data()?.items ?? []) as InventoryItem[]).map((item) => ({ ...item, source: sourceOf(item) }));
  const present = new Set(existing.map(itemKey));

  // Everything below resolves the whole batch at once. Doing it per item meant a
  // round trip each, and — for items that arrive without a supplierId — a full
  // scan of every product in the database *per item*.
  const missing: typeof requested = [];
  for (const req of requested) {
    if (!req?.productId) continue;
    const key = itemKey(req);
    if (present.has(key)) continue;
    present.add(key);
    missing.push(req);
  }

  // Supplier products live in a subcollection, so without a supplierId the only
  // way to find one is the product collection group. That scan now runs at most
  // once, and only when something actually needs it.
  const needsScan = missing.some((req) => sourceOf(req) === "supplier" && !req.supplierId);
  const scanned = needsScan
    ? new Map((await db.collectionGroup("products").get()).docs.map((doc) => [doc.id, doc]))
    : new Map();

  const productDocs = await Promise.all(
    missing.map((req) => {
      if (sourceOf(req) === "standalone") return db.collection("inventory_products").doc(req.productId).get();
      if (req.supplierId) {
        return db.collection("suppliers").doc(req.supplierId).collection("products").doc(req.productId).get();
      }
      return scanned.get(req.productId);
    }),
  );

  // Distinct suppliers only — a batch of products from one supplier used to read
  // that supplier document once per product.
  const supplierIds = new Set<string>();
  missing.forEach((req, i) => {
    if (sourceOf(req) === "standalone") return;
    const parent = productDocs[i]?.ref.parent.parent;
    if (parent) supplierIds.add(parent.id);
  });
  const supplierNames = new Map<string, string>();
  if (supplierIds.size > 0) {
    const supplierDocs = await db.getAll(...[...supplierIds].map((id) => db.collection("suppliers").doc(id)));
    for (const doc of supplierDocs) supplierNames.set(doc.id, (doc.data()?.name as string) ?? "");
  }

  const added: InventoryItem[] = [];
  missing.forEach((req, i) => {
    const productDoc = productDocs[i];
    if (!productDoc?.exists) throw new HTTPException(404, { message: `Product ${req.productId} bestaat niet` });

    if (sourceOf(req) === "standalone") {
      added.push(standaloneItem(productDoc.id, productDoc.data()!));
    } else {
      const supplierRef = productDoc.ref.parent.parent!;
      const name = supplierNames.get(supplierRef.id) ?? "";
      added.push(supplierItem(productDoc.id, productDoc.data()!, supplierRef.id, name));
    }
  });

  const items = [...existing, ...added];
  if (added.length > 0) await ref.update({ items });

  return c.json({ ok: true, added: added.length, items });
});

// DELETE /api/inventory/:id
inventory.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await db.collection("inventory_counts").doc(id).delete();
  return c.json({ ok: true });
});

export { inventory as inventoryRouter };
