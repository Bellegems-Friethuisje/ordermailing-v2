import { Hono } from "hono";
import nodemailer from "nodemailer";
import * as XLSX from "xlsx";

const mailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendOrderEmail(orderId: string, orderData: any) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !orderData.supplierEmail) {
    return;
  }

  const shopName = process.env.SHOP_NAME || "Our Shop";
  const shopEmail = process.env.SHOP_EMAIL || process.env.SMTP_USER;
  const shopPhone = process.env.SHOP_PHONE || "";
  const shopAddress = process.env.SHOP_ADDRESS || "";
  const shopVatNumber = process.env.SHOP_VAT_NUMBER || "";

  const tableRows = (orderData.lines || [])
    .filter((l: any) => l.quantity > 0)
    .map(
      (l: any) => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${l.supplierName || l.internalName}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${l.quantity}</td>
      </tr>
    `,
    )
    .join("");

  const html = `
    <p>Please find our order details below:</p>
    <table style="border-collapse: collapse; width: 100%; max-width: 600px; text-align: left;">
      <thead>
        <tr>
          <th style="border: 1px solid #ddd; padding: 8px;">Article</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
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

  const excelData = (orderData.lines || [])
    .filter((l: any) => l.quantity > 0)
    .map((l: any) => ({
      Article: l.supplierName || l.internalName,
      Amount: l.quantity,
    }));

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
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    c.set("role", userDoc.exists ? (userDoc.data()?.role ?? "user") : "user");
  } catch {
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }
  return next();
});

// ─── POST /api/orders ─────────────────────────────────────────────────────────
orders.post("/", async (c) => {
  const body = await c.req.json<{
    supplierId: string;
    supplierName: string;
    supplierEmail: string;
    status?: string;
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

  const ref = await db.collection("orders").add({
    supplierId: body.supplierId,
    supplierName: body.supplierName,
    supplierEmail: body.supplierEmail,
    lines: body.lines,
    createdBy: uid,
    createdByName: userName,
    createdAt: new Date().toISOString(),
    status: body.status ?? "pending",
  });

  if ((body.status ?? "pending") === "pending") {
    sendOrderEmail(ref.id, { supplierEmail: body.supplierEmail, lines: body.lines });
  }

  return c.json({ ok: true, id: ref.id }, 201);
});

// ─── PATCH /api/orders/:id ────────────────────────────────────────────────────
orders.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    lines?: Array<{ productId: string; supplierName: string; internalName: string; quantity: number }>;
    status?: string;
  }>();

  const docRef = db.collection("orders").doc(id);
  const snap = await docRef.get();
  if (!snap.exists) throw new HTTPException(404, { message: "Order not found" });

  const uid = c.get("uid");
  if (snap.data()?.createdBy !== uid) throw new HTTPException(403, { message: "Forbidden" });

  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.lines !== undefined) update.lines = body.lines;
  if (body.status !== undefined) update.status = body.status;

  await docRef.update(update);

  if (body.status === "pending" && snap.data()?.status !== "pending") {
    const updatedSnap = await docRef.get();
    sendOrderEmail(id, updatedSnap.data());
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
