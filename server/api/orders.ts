import { GoogleGenAI } from "@google/genai";
import { Hono } from "hono";
import nodemailer from "nodemailer";
import * as XLSX from "xlsx";

const mailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 8000,
});

/** Money rounding — keeps line totals and order totals from drifting. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** €1.234,50 — Dutch formatting, used in the order email. */
function formatEuro(n: number): string {
  return `€ ${n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function sendOrderEmail(orderId: string, orderData: any) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !orderData.supplierEmail) {
    return;
  }

  const shopName = process.env.SHOP_NAME || "Our Shop";
  const shopEmail = process.env.SHOP_EMAIL || process.env.SMTP_USER;
  const shopPhone = process.env.SHOP_PHONE || "";
  const shopAddress = process.env.SHOP_ADDRESS || "";
  const shopVatNumber = process.env.SHOP_VAT_NUMBER || "";

  const emailLines = (orderData.lines || []).filter((l: any) => l.quantity > 0);

  // Prices only appear once at least one line actually has one — an order of
  // unpriced products keeps the original two-column layout.
  const withPrices = emailLines.some((l: any) => (l.unitPrice ?? 0) > 0);
  const emailTotal = round2(emailLines.reduce((sum: number, l: any) => sum + (l.lineTotal ?? 0), 0));
  const cell = "border: 1px solid #ddd; padding: 8px;";

  const tableRows = emailLines
    .map(
      (l: any) => `
      <tr>
        <td style="${cell}">${l.supplierName || l.internalName}</td>
        <td style="${cell}">${l.quantity}</td>
        ${
          withPrices
            ? `<td style="${cell} text-align: right;">${(l.unitPrice ?? 0) > 0 ? formatEuro(l.unitPrice) : "—"}</td>
        <td style="${cell} text-align: right;">${(l.unitPrice ?? 0) > 0 ? formatEuro(l.lineTotal ?? 0) : "—"}</td>`
            : ""
        }
      </tr>
    `,
    )
    .join("");

  const notesSection = orderData.notes
    ? `<br/><p><strong>Additional notes:</strong><br/>${orderData.notes.replace(/\n/g, "<br/>")}</p>`
    : "";

  const html = `
    <p>Please find our order details below:</p>
    <table style="border-collapse: collapse; width: 100%; max-width: 600px; text-align: left;">
      <thead>
        <tr>
          <th style="${cell}">Article</th>
          <th style="${cell}">Amount</th>
          ${
            withPrices
              ? `<th style="${cell} text-align: right;">Unit price</th>
          <th style="${cell} text-align: right;">Total</th>`
              : ""
          }
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
      ${
        withPrices
          ? `<tfoot>
        <tr>
          <td style="${cell}" colspan="3"><strong>Total</strong></td>
          <td style="${cell} text-align: right;"><strong>${formatEuro(emailTotal)}</strong></td>
        </tr>
      </tfoot>`
          : ""
      }
    </table>
    ${notesSection}
    <br/>
    <hr/>
    <p>
      <strong>${shopName}</strong><br/>
      ${shopAddress ? shopAddress + "<br/>" : ""}
      ${shopEmail ? "Email: " + shopEmail + "<br/>" : ""}
      ${shopPhone ? "Phone: " + shopPhone + "<br/>" : ""}
      ${shopVatNumber ? "BTW: " + shopVatNumber + "<br/>" : ""}
    </p>
  `;

  const excelData = emailLines.map((l: any) => ({
    Article: l.supplierName || l.internalName,
    Amount: l.quantity,
    ...(withPrices && {
      "Unit price": (l.unitPrice ?? 0) > 0 ? l.unitPrice : "",
      Total: (l.unitPrice ?? 0) > 0 ? (l.lineTotal ?? 0) : "",
    }),
  }));

  if (withPrices) {
    excelData.push({ Article: "Total", Amount: "", "Unit price": "", Total: emailTotal } as any);
  }

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Order");
  const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const mailOptions = {
    from: `"${shopName}" <${process.env.SMTP_USER}>`,
    to: orderData.supplierEmail,
    cc: process.env.SHOP_EMAIL || process.env.SMTP_USER,
    subject: `Bestelling ${shopName}`,
    html,
    attachments: [
      {
        filename: `Order_Bestelling_${orderId}.xlsx`,
        content: excelBuffer,
      },
    ],
  };

  try {
    await mailTransporter.sendMail(mailOptions);
  } catch (err) {
    console.error("Failed to send order email:", err);
  }
}
import { HTTPException } from "hono/http-exception";
import { adminAuth, db } from "../firebase-admin";
import type { Query } from "firebase-admin/firestore";
import { requireAdmin } from "../lib/roles";
import { getForecast, type WeatherDay } from "../lib/weather";
import { dutchDayNameShort, getCalendarContext, type CalendarDay } from "../lib/calendar";

type ProductInfo = { id: string; internalName: string; supplierName: string; idealStock: number; manualOrder: boolean };
type PastOrder = { date: string; lines: Array<{ productId: string; name: string; quantity: number }> };
type SuggestionContext = { weather: WeatherDay[] | null; holidays: CalendarDay[] };

/** dd/mm */
function shortDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

/**
 * The weather + calendar block that goes in front of the products list.
 * Weather is optional: when the lookup failed we still hand the model the weekdays,
 * public holidays and school holidays, which cost nothing to compute.
 */
function buildContextBlock(context: SuggestionContext): string {
  const today = context.holidays[0];
  const header = today ? `Vandaag is ${today.dayName} ${shortDate(today.date)}.\n` : "";

  const flags = (day: CalendarDay | undefined) => {
    if (!day) return "";
    const parts: string[] = [];
    if (day.isPublicHoliday) parts.push(day.holidayName ?? "feestdag");
    if (day.isSchoolHoliday) parts.push("schoolvakantie");
    return parts.length ? `  [${parts.join(", ")}]` : "";
  };

  const lines = context.weather
    ? context.weather.map((w) => {
        const day = context.holidays.find((h) => h.date === w.date);
        return (
          `  ${dutchDayNameShort(w.date)} ${shortDate(w.date)}  ` +
          `${Math.round(w.tempMax)}°C, ${w.precipitation.toFixed(1)}mm neerslag, ${w.label}, ` +
          `terrasscore ${w.terrasScore}/10${flags(day)}`
        );
      })
    : context.holidays.map((h) => `  ${dutchDayNameShort(h.date)} ${shortDate(h.date)}${flags(h)}`);

  const title = context.weather
    ? "Weersverwachting komende 7 dagen (Bellegem, BE):"
    : "Komende 7 dagen (weerbericht niet beschikbaar):";

  const guidance = context.weather
    ? "Richtlijn: warm en droog weer (terrasscore 7+), weekends, feestdagen en schoolvakanties verhogen de vraag. Koud, nat weer verlaagt ze. Weeg dit mee bovenop de historische trend."
    : "Richtlijn: weekends, feestdagen en schoolvakanties verhogen de vraag. Weeg dit mee bovenop de historische trend.";

  return `${header}
${title}
${lines.join("\n")}

${guidance}
`;
}

function buildGeminiPrompt(pastOrders: PastOrder[], products: ProductInfo[], context: SuggestionContext | null): string {
  const productLines = products
    .map((p) => `  "${p.id}" (${p.internalName}): max ${p.manualOrder ? "unlimited" : p.idealStock}`)
    .join("\n");

  const orderHistory =
    pastOrders.length === 0
      ? "  No previous orders."
      : pastOrders
          .map((o, i) => {
            const lines =
              o.lines.length === 0
                ? "    (empty)"
                : o.lines.map((l) => `    "${l.productId}": ${l.quantity}`).join("\n");
            return `  Order ${i + 1} (${o.date}):\n${lines}`;
          })
          .join("\n");

  const contextBlock = context ? `\n${buildContextBlock(context)}` : "";

  return `
  You are and expert inventory assistant for a shop. Based on the following product information and past order history, suggest order quantities for each product to restock up to the ideal stock level. Consider trends in the order history, but do not suggest more than the max quantity for each product. If a product is marked as manualOrder, you can suggest any quantity.
  It is better to order less than too much
${contextBlock}
Products (id → max qty):
${productLines}

Past orders (oldest → newest):
${orderHistory}

If the suggested quantity for a product is significantly different from its typical past order quantity (more than ~30% above or below the average), add a short "note" field explaining why. Write the note in Dutch (e.g. "Stijgende trend over de laatste 3 bestellingen" or "Ongewoon hoog — controleer voor verzending").
When the weather or the calendar (weekend, feestdag, schoolvakantie) materially changed a quantity, you MUST say so in that same Dutch "note" field (e.g. "Warm weekend op komst — hoger dan gemiddeld" or "Koud en nat — lager dan gemiddeld").
Also add an optional "driver" field naming the dominant reason for the quantity: "weer", "trend", "vakantie" or "normaal".

Return ONLY JSON:
{"suggestions": [{"productId": "<id>", "quantity": <positive integer>, "note": "<optional, only when notable>", "driver": "weer|trend|vakantie|normaal"}]}
Only include products where quantity > 0. Never exceed each product's max.
Keep the products in the same order as the input list.
`;
}

// ─── Line pricing ─────────────────────────────────────────────────────────────
type OrderLineIn = { productId: string; supplierName: string; internalName: string; quantity: number };
type PricedOrderLine = OrderLineIn & { unitPrice: number; priceUnit: string; lineTotal: number };

/**
 * Snapshot what each product costs *right now* onto the order lines.
 *
 * Prices are always read from Firestore — a client-sent `unitPrice` is ignored
 * and overwritten, so an order can never be recorded at a price the shop did
 * not actually have. Products without a price snapshot as 0.
 */
async function priceOrderLines(
  supplierId: string,
  lines: OrderLineIn[] | undefined,
): Promise<{ lines: PricedOrderLine[]; orderTotal: number }> {
  const input = lines ?? [];
  if (!supplierId || input.length === 0) return { lines: input as PricedOrderLine[], orderTotal: 0 };

  const snap = await db.collection("suppliers").doc(supplierId).collection("products").get();
  const priceMap = new Map(
    snap.docs.map((doc) => [
      doc.id,
      { price: (doc.data().price ?? 0) as number, priceUnit: (doc.data().priceUnit as string) || "stuk" },
    ]),
  );

  let orderTotal = 0;
  const priced = input.map((line) => {
    const product = priceMap.get(line.productId);
    const unitPrice = product?.price ?? 0;
    const lineTotal = round2(unitPrice * (line.quantity ?? 0));
    orderTotal += lineTotal;
    return { ...line, unitPrice, priceUnit: product?.priceUnit ?? "stuk", lineTotal };
  });

  return { lines: priced, orderTotal: round2(orderTotal) };
}

const orders = new Hono();

// ─── Auth middleware ──────────────────────────────────────────────────────────
orders.use("*", async (c, next) => {
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

// ─── POST /api/orders/generate-template ──────────────────────────────────────
orders.post("/generate-template", async (c) => {
  const body = await c.req.json<{ supplierId: string; products: ProductInfo[] }>();
  if (!body.supplierId || !Array.isArray(body.products)) {
    throw new HTTPException(400, { message: "supplierId and products are required" });
  }

  const snap = await db
    .collection("orders")
    .where("supplierId", "==", body.supplierId)
    .where("status", "==", "sent")
    .orderBy("createdAt", "asc")
    .limit(5)
    .get();

  const pastOrders: PastOrder[] = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      date: (data.createdAt as string).split("T")[0],
      lines: ((data.lines ?? []) as any[]).map((l) => ({
        productId: l.productId as string,
        name: (l.internalName || l.supplierName) as string,
        quantity: l.quantity as number,
      })),
    };
  });

  // Weather is best-effort: a failure degrades the prompt, it never fails the request.
  let context: SuggestionContext | null = null;
  try {
    const [weather, holidays] = await Promise.all([getForecast(), Promise.resolve(getCalendarContext(7))]);
    context = { weather, holidays };
  } catch (err) {
    console.error("Failed to build suggestion context:", err);
  }

  const prompt = buildGeminiPrompt(pastOrders, body.products, context);
  if (process.env.NODE_ENV !== "production") console.log("[generate-template] prompt:\n", prompt);

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new HTTPException(500, { message: "Gemini API key not configured" });

  const ai = new GoogleGenAI({ apiKey: geminiKey });
  let rawText = "{}";
  try {
    const result = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    rawText = result.text ?? "{}";
  } catch (err) {
    console.error("Gemini SDK error:", err);
    throw new HTTPException(502, { message: "AI service error" });
  }

  const DRIVERS = ["weer", "trend", "vakantie", "normaal"];
  let suggestions: Array<{ productId: string; quantity: number; note?: string; driver?: string }> = [];
  try {
    const parsed = JSON.parse(rawText);
    suggestions = ((parsed.suggestions ?? []) as any[])
      .filter((s) => typeof s.productId === "string" && typeof s.quantity === "number" && s.quantity > 0)
      .map((s) => ({
        productId: s.productId as string,
        quantity: s.quantity as number,
        ...(typeof s.note === "string" && s.note && { note: s.note }),
        ...(typeof s.driver === "string" && DRIVERS.includes(s.driver) && { driver: s.driver }),
      }));
  } catch {
    throw new HTTPException(502, { message: "Failed to parse AI response" });
  }

  return c.json({ suggestions, context });
});

// ─── POST /api/orders ─────────────────────────────────────────────────────────
orders.post("/", async (c) => {
  const body = await c.req.json<{
    supplierId: string;
    supplierName: string;
    supplierEmail: string;
    status?: string;
    notes?: string;
    fromAiTemplate?: boolean;
    lines: Array<{
      productId: string;
      supplierName: string;
      internalName: string;
      quantity: number;
    }>;
  }>();

  if (!body.supplierId || !Array.isArray(body.lines)) {
    throw new HTTPException(400, { message: "supplierId and lines are required" });
  }

  const uid = c.get("uid");
  const userDoc = await db.collection("users").doc(uid).get();
  const userName = userDoc.data()?.displayName ?? userDoc.data()?.email ?? uid;

  const { lines, orderTotal } = await priceOrderLines(body.supplierId, body.lines);

  const ref = await db.collection("orders").add({
    supplierId: body.supplierId,
    supplierName: body.supplierName,
    supplierEmail: body.supplierEmail,
    lines,
    orderTotal,
    notes: body.notes ?? "",
    createdBy: uid,
    createdByName: userName,
    createdAt: new Date().toISOString(),
    status: body.status ?? "sent",
    ...(body.fromAiTemplate && { fromAiTemplate: true }),
  });

  if ((body.status ?? "sent") === "sent") {
    await sendOrderEmail(ref.id, { supplierEmail: body.supplierEmail, lines, notes: body.notes ?? "" });
  }

  return c.json({ ok: true, id: ref.id }, 201);
});

// ─── PATCH /api/orders/:id ────────────────────────────────────────────────────
orders.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    lines?: Array<{ productId: string; supplierName: string; internalName: string; quantity: number }>;
    status?: string;
    notes?: string;
    fromAiTemplate?: boolean;
  }>();

  const docRef = db.collection("orders").doc(id);
  const snap = await docRef.get();
  if (!snap.exists) throw new HTTPException(404, { message: "Order not found" });

  const uid = c.get("uid");
  if (snap.data()?.createdBy !== uid) throw new HTTPException(403, { message: "Forbidden" });

  const existing = snap.data() ?? {};
  const becomingSent = body.status === "sent" && existing.status !== "sent";

  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.status !== undefined) update.status = body.status;
  if (body.notes !== undefined) update.notes = body.notes;
  if (body.fromAiTemplate) update.fromAiTemplate = true;

  // Re-price whenever lines change, and again at the moment the order is sent —
  // that is the price the shop is actually committing to.
  let pricedLines: PricedOrderLine[] | null = null;
  if (body.lines !== undefined || becomingSent) {
    const source = body.lines ?? ((existing.lines ?? []) as OrderLineIn[]);
    const priced = await priceOrderLines(existing.supplierId as string, source);
    pricedLines = priced.lines;
    update.lines = priced.lines;
    update.orderTotal = priced.orderTotal;
  }

  await docRef.update(update);

  if (becomingSent) {
    const orderData = {
      ...existing,
      ...(pricedLines !== null && { lines: pricedLines }),
      ...(body.notes !== undefined && { notes: body.notes }),
    };
    await sendOrderEmail(id, orderData);
  }

  return c.json({ ok: true });
});
// ─── DELETE /api/orders/:id ────────────────────────────────────────────────────
orders.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const docRef = db.collection("orders").doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return c.json({ ok: true }); // already gone

  const uid = c.get("uid");
  if (snap.data()?.createdBy !== uid) throw new HTTPException(403, { message: "Forbidden" });

  await docRef.delete();
  return c.json({ ok: true });
});
// ─── GET /api/orders/analytics ───────────────────────────────────────────────
// Spend analytics over sent orders in a date range. Admins only.
orders.get("/analytics", async (c) => {
  await requireAdmin(c.get("uid") as string, "Only admins can view spend analytics");

  const year = new Date().getFullYear();
  const startOfDay = (d: string) => (d.length === 10 ? `${d}T00:00:00.000Z` : d);
  const endOfDay = (d: string) => (d.length === 10 ? `${d}T23:59:59.999Z` : d);

  const fromIso = startOfDay(c.req.query("from") || `${year}-01-01`);
  const toIso = endOfDay(c.req.query("to") || new Date().toISOString().slice(0, 10));

  // Spend and price-change history come from three independent reads; issuing
  // them together turns three sequential Firestore round trips into one wait.
  const [snap, suppliersSnap, productsSnap] = await Promise.all([
    db
      .collection("orders")
      .where("status", "==", "sent")
      .where("createdAt", ">=", fromIso)
      .where("createdAt", "<=", toIso)
      .orderBy("createdAt", "desc")
      .get(),
    db.collection("suppliers").get(),
    db.collectionGroup("products").get(),
  ]);

  const bySupplier = new Map<string, { supplierId: string; supplierName: string; spend: number; orderCount: number }>();
  const byMonth = new Map<string, number>();
  const byProduct = new Map<string, { productId: string; internalName: string; totalQuantity: number; spend: number }>();
  let totalSpend = 0;

  for (const doc of snap.docs) {
    const order = doc.data();
    const lines = (order.lines ?? []) as Array<Record<string, any>>;

    // Historic orders predate `orderTotal`; fall back to the lines, which for
    // pre-pricing orders sum to 0 rather than blowing up.
    const orderSpend = round2(
      typeof order.orderTotal === "number"
        ? order.orderTotal
        : lines.reduce((sum, l) => sum + (l.lineTotal ?? 0), 0),
    );
    totalSpend += orderSpend;

    const supplierId = (order.supplierId as string) ?? "";
    const supplier = bySupplier.get(supplierId);
    if (supplier) {
      supplier.spend = round2(supplier.spend + orderSpend);
      supplier.orderCount++;
    } else {
      bySupplier.set(supplierId, {
        supplierId,
        supplierName: (order.supplierName as string) ?? "Onbekend",
        spend: orderSpend,
        orderCount: 1,
      });
    }

    const month = ((order.createdAt as string) ?? "").slice(0, 7);
    if (month) byMonth.set(month, round2((byMonth.get(month) ?? 0) + orderSpend));

    for (const line of lines) {
      if (!line.productId || !(line.quantity > 0)) continue;
      const spend = line.lineTotal ?? 0;
      const product = byProduct.get(line.productId);
      if (product) {
        product.totalQuantity += line.quantity;
        product.spend = round2(product.spend + spend);
      } else {
        byProduct.set(line.productId, {
          productId: line.productId,
          internalName: line.internalName || line.supplierName || line.productId,
          totalQuantity: line.quantity,
          spend: round2(spend),
        });
      }
    }
  }

  // Contiguous months across the range so the bar chart has no gaps.
  const months: Array<{ month: string; spend: number }> = [];
  const cursor = new Date(`${fromIso.slice(0, 7)}-01T00:00:00.000Z`);
  const last = toIso.slice(0, 7);
  for (let guard = 0; guard < 120; guard++) {
    const month = cursor.toISOString().slice(0, 7);
    months.push({ month, spend: byMonth.get(month) ?? 0 });
    if (month >= last) break;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  // ─── Price changes ─────────────────────────────────────────────────────────
  // Walk every product's append-only priceHistory and report the moves inside
  // the range. The very first entry is the opening price, not a change.
  const PRICE_CHANGE_THRESHOLD_PCT = 5;
  const priceChanges: Array<{
    productId: string;
    internalName: string;
    supplierName: string;
    oldPrice: number;
    newPrice: number;
    changedAt: string;
    pct: number;
  }> = [];

  // One collection-group read covers every supplier's products, instead of a
  // `products` query per supplier issued one after the other. The supplier names
  // come from the parallel `suppliers` read and are joined in memory.
  const supplierNames = new Map(suppliersSnap.docs.map((doc) => [doc.id, (doc.data().name as string) ?? "Onbekend"]));

  for (const productDoc of productsSnap.docs) {
    const product = productDoc.data();
    const supplierName = supplierNames.get(productDoc.ref.parent.parent?.id ?? "") ?? "Onbekend";
    const history = ((product.priceHistory ?? []) as Array<{ price: number; date: string }>)
      .filter((entry) => entry && typeof entry.price === "number" && typeof entry.date === "string")
      .sort((a, b) => a.date.localeCompare(b.date));

    for (let i = 1; i < history.length; i++) {
      const { price: newPrice, date: changedAt } = history[i];
      const oldPrice = history[i - 1].price;
      if (changedAt < fromIso || changedAt > toIso) continue;
      if (!(oldPrice > 0)) continue;

      const pct = round2(((newPrice - oldPrice) / oldPrice) * 100);
      if (Math.abs(pct) <= PRICE_CHANGE_THRESHOLD_PCT) continue;

      priceChanges.push({
        productId: productDoc.id,
        internalName: (product.internalName as string) || (product.supplierName as string) || productDoc.id,
        supplierName,
        oldPrice,
        newPrice,
        changedAt,
        pct,
      });
    }
  }

  priceChanges.sort((a, b) => b.changedAt.localeCompare(a.changedAt));

  return c.json({
    totalSpend: round2(totalSpend),
    orderCount: snap.size,
    bySupplier: [...bySupplier.values()].sort((a, b) => b.spend - a.spend),
    byMonth: months,
    topProducts: [...byProduct.values()].sort((a, b) => b.spend - a.spend).slice(0, 20),
    priceChanges,
  });
});

// ─── GET /api/orders ──────────────────────────────────────────────────────────
orders.get("/", async (c) => {
  const PAGE_SIZE = 10;
  const status = c.req.query("status") || null;
  const after = c.req.query("after") || null; // createdAt cursor value

  let q: Query = db.collection("orders");
  if (status) q = q.where("status", "==", status);
  q = q.orderBy("createdAt", "desc");
  if (after) q = q.startAfter(after);
  q = q.limit(PAGE_SIZE + 1);

  const snap = await q.get();
  const hasMore = snap.docs.length > PAGE_SIZE;
  const docs = snap.docs.slice(0, PAGE_SIZE);
  const items = docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const last = docs[docs.length - 1];

  return c.json({
    items,
    hasMore,
    nextCursor: hasMore && last ? (last.data().createdAt as string) : null,
  });
});

export { orders as ordersRouter };
