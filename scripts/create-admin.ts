/**
 * One-time script to create the first admin user.
 * Usage: bun run scripts/create-admin.ts --email=you@example.com --password=yourpassword --name="Your Name"
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Bun automatically loads .env — no dotenv needed.

if (!getApps().length) {
  initializeApp({
    credential: cert({
      type: process.env.FIREBASE_SA_TYPE,
      projectId: process.env.FIREBASE_SA_PROJECT_ID,
      privateKeyId: process.env.FIREBASE_SA_PRIVATE_KEY_ID,
      privateKey: process.env.FIREBASE_SA_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      clientEmail: process.env.FIREBASE_SA_CLIENT_EMAIL,
      clientId: process.env.FIREBASE_SA_CLIENT_ID,
      authUri: process.env.FIREBASE_SA_AUTH_URI,
      tokenUri: process.env.FIREBASE_SA_TOKEN_URI,
      authProviderX509CertUrl: process.env.FIREBASE_SA_AUTH_PROVIDER_CERT_URL,
      clientX509CertUrl: process.env.FIREBASE_SA_CLIENT_CERT_URL,
      universeDomain: process.env.FIREBASE_SA_UNIVERSE_DOMAIN,
    } as any),
  });
}

const auth = getAuth();
const db = getFirestore();

// ─── Parse args ───────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=")];
  }),
);

const email = args.email;
const password = args.password;
const name = args.name ?? "Admin";

if (!email || !password) {
  console.error('Usage: bun run scripts/create-admin.ts --email=you@example.com --password=secret --name="Your Name"');
  process.exit(1);
}

// ─── Create user ──────────────────────────────────────────────────────────────
try {
  let uid: string;

  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    console.log(`Firebase Auth user already exists (uid: ${uid}). Updating Firestore role to admin...`);
  } catch (err: any) {
    if (err?.errorInfo?.code !== "auth/user-not-found") throw err;
    const record = await auth.createUser({ email, password, displayName: name });
    uid = record.uid;
    console.log(`Created Firebase Auth user (uid: ${uid})`);
  }

  await db.collection("users").doc(uid).set(
    {
      name,
      email,
      role: "admin",
      createdAt: new Date().toISOString(),
    },
    { merge: true },
  );

  console.log(`\n✓ Admin account ready!\n  Email:    ${email}\n  Name:     ${name}\n  Role:     admin\n`);
  process.exit(0);
} catch (err) {
  console.error("Failed to create admin:", err);
  process.exit(1);
}
