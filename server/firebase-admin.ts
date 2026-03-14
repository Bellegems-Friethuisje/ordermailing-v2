import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

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

export const adminAuth = getAuth();
export const db = getFirestore();
