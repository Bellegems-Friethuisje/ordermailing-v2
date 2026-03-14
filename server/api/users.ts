import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { adminAuth, db } from "../firebase-admin";
import { randomUUID } from "crypto";

const users = new Hono();

// ─── Auth middleware ──────────────────────────────────────────────────────────
users.use("*", async (c, next) => {
  // Public routes: validate invite token + register
  const path = c.req.path;
  const method = c.req.method;
  if ((method === "GET" && path.includes("/invite/")) || (method === "POST" && path.endsWith("/register"))) {
    return next();
  }

  const authorization = c.req.header("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing or invalid Authorization header" });
  }

  try {
    const idToken = authorization.slice(7);
    const decoded = await adminAuth.verifyIdToken(idToken);
    c.set("uid", decoded.uid);
    c.set("email", decoded.email ?? "");

    // Fetch role from Firestore and attach to context
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    c.set("role", userDoc.exists ? (userDoc.data()?.role ?? "user") : "user");
  } catch {
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }

  return next();
});

// ─── GET /api/users ───────────────────────────────────────────────────────────
users.get("/", async (c) => {
  const snapshot = await db.collection("users").orderBy("createdAt", "desc").get();
  const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return c.json(list);
});

// ─── POST /api/users/invite ───────────────────────────────────────────────────
users.post("/invite", async (c) => {
  if (c.get("role") !== "admin") {
    throw new HTTPException(403, { message: "Only admins can invite new users" });
  }

  const token = randomUUID();
  await db.collection("inviteTokens").doc(token).set({
    createdAt: new Date().toISOString(),
    used: false,
  });

  return c.json({ token });
});

// ─── GET /api/users/invite/:token ─────────────────────────────────────────────
users.get("/invite/:token", async (c) => {
  const token = c.req.param("token");
  const doc = await db.collection("inviteTokens").doc(token).get();

  if (!doc.exists) {
    throw new HTTPException(404, { message: "Invalid registration token" });
  }

  const data = doc.data()!;
  if (data.used) {
    throw new HTTPException(410, { message: "This registration link has already been used" });
  }

  return c.json({ valid: true });
});

// ─── POST /api/users/register ─────────────────────────────────────────────────
users.post("/register", async (c) => {
  const { token, name, email, password } = await c.req.json<{
    token: string;
    name: string;
    email: string;
    password: string;
  }>();

  if (!token || !name || !email || !password) {
    throw new HTTPException(400, { message: "token, name, email and password are required" });
  }

  // Check if a Firebase Auth user already exists with this email
  try {
    await adminAuth.getUserByEmail(email);
    throw new HTTPException(409, { message: "A user with this email already exists" });
  } catch (err: any) {
    if (err?.errorInfo?.code !== "auth/user-not-found") throw err;
  }

  const tokenRef = db.collection("inviteTokens").doc(token);
  const tokenDoc = await tokenRef.get();

  if (!tokenDoc.exists) {
    throw new HTTPException(404, { message: "Invalid registration token" });
  }

  const tokenData = tokenDoc.data()!;
  if (tokenData.used) {
    throw new HTTPException(410, { message: "This registration link has already been used" });
  }

  // Create the Firebase Auth user
  const userRecord = await adminAuth.createUser({ email, password, displayName: name });

  // Store user profile in Firestore
  await db.collection("users").doc(userRecord.uid).set({
    name,
    email,
    role: "user",
    createdAt: new Date().toISOString(),
  });

  // Mark token as used
  await tokenRef.update({ used: true, usedBy: userRecord.uid, usedAt: new Date().toISOString() });

  // Return a custom token so the client can sign in immediately
  const customToken = await adminAuth.createCustomToken(userRecord.uid);
  return c.json({ customToken });
});

// ─── PATCH /api/users/:id/role ───────────────────────────────────────────────
users.patch("/:id/role", async (c) => {
  if (c.get("role") !== "admin") {
    throw new HTTPException(403, { message: "Only admins can change roles" });
  }

  const id = c.req.param("id");
  const { role } = await c.req.json<{ role: string }>();

  if (role !== "admin" && role !== "user") {
    throw new HTTPException(400, { message: "Role must be 'admin' or 'user'" });
  }

  await db.collection("users").doc(id).update({ role });

  return c.json({ ok: true });
});

// ─── DELETE /api/users/:id ────────────────────────────────────────────────────
users.delete("/:id", async (c) => {
  const id = c.req.param("id");

  // Prevent self-deletion
  const requestingUid = c.get("uid") as string;
  if (id === requestingUid) {
    throw new HTTPException(400, { message: "You cannot delete your own account" });
  }

  await Promise.all([adminAuth.deleteUser(id), db.collection("users").doc(id).delete()]);

  return c.json({ ok: true });
});

export { users as usersRouter };
