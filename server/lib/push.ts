import { db } from "../firebase-admin";
import { getMessaging } from "firebase-admin/messaging";

/**
 * Sends an FCM notification to every device registered with the "kassa" role and
 * prunes tokens FCM rejects. Never throws — a failed push must not fail the
 * request that triggered it.
 */
export async function sendPushNotification(title: string, body: string) {
  try {
    const tokensSnapshot = await db.collection("push_tokens").where("role", "==", "kassa").get();

    const tokens = tokensSnapshot.docs.map((doc) => doc.data().token);

    if (tokens.length === 0) return;

    const message = {
      notification: { title, body },
      tokens,
    };

    const response = await getMessaging().sendEachForMulticast(message);
    console.log(`Successfully sent ${response.successCount} push notifications to kassa devices`);

    // Cleanup invalid tokens
    if (response.failureCount > 0) {
      const batch = db.batch();
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          batch.delete(db.collection("push_tokens").doc(tokens[idx]));
        }
      });
      await batch.commit();
    }
  } catch (err) {
    console.error("Failed to send push notifications:", err);
  }
}
