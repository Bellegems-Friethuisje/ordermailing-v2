import { HTTPException } from "hono/http-exception";
import { db } from "../firebase-admin";

/**
 * The caller's role, read on demand.
 *
 * Every authenticated request used to pay for a `users/{uid}` read inside its
 * auth middleware, but only the four admin-only handlers ever look at the
 * answer. Reading it here instead keeps that Firestore round trip off the
 * critical path of every other route.
 */
export async function fetchRole(uid: string): Promise<string> {
  if (!uid) return "user";
  const snap = await db.collection("users").doc(uid).get();
  return snap.exists ? (snap.data()?.role ?? "user") : "user";
}

/** Throws 403 unless the caller is an admin. */
export async function requireAdmin(uid: string, message: string): Promise<void> {
  if ((await fetchRole(uid)) !== "admin") {
    throw new HTTPException(403, { message });
  }
}
