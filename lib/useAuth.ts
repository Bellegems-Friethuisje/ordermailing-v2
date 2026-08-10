import { ref, readonly } from "vue";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, type User } from "firebase/auth";
import { auth } from "./firebase";
import { apiFetch } from "./apiFetch";

const currentUser = ref<User | null>(null);
const userRole = ref<string>("user");

// Two separate gates, because they become answerable at different moments and
// almost nothing needs the second one.
//
// `loading` is "do we know who this is" — it clears the instant Firebase resolves
// the session, which is also the instant a token exists and pages can start
// fetching. `roleLoading` is "do we know what they may see", which needs a round
// trip to /api/users/me on top of that.
//
// These used to be one flag, so every page held its first request until the role
// came back, turning one wait into two sequential ones on every single page load.
const loading = ref(true);
const roleLoading = ref(true);

// Only subscribe in the browser — auth doesn't exist during SSR
if (typeof window !== "undefined") {
  onAuthStateChanged(auth, (user) => {
    currentUser.value = user;
    loading.value = false;

    if (!user) {
      userRole.value = "user";
      roleLoading.value = false;
      return;
    }

    // Deliberately not awaited: the role resolves alongside whatever the page is
    // already fetching, rather than in front of it.
    roleLoading.value = true;
    void (async () => {
      try {
        const response = await apiFetch("/api/users/me");
        if (!response.ok) {
          throw new Error(`Failed to fetch current user: ${response.status}`);
        }

        const userData = (await response.json()) as { role?: string };
        // A sign-out (or a switch to another account) mid-flight makes this
        // answer stale — drop it rather than apply it to the wrong user.
        if (currentUser.value?.uid !== user.uid) return;
        userRole.value = userData.role?.trim().toLowerCase() || "user";
      } catch (err) {
        console.error("Failed to fetch user role:", err);
        if (currentUser.value?.uid === user.uid) userRole.value = "user";
      } finally {
        if (currentUser.value?.uid === user.uid) roleLoading.value = false;
      }
    })();
  });
}

export function useAuth() {
  async function signIn(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function signOut() {
    return firebaseSignOut(auth);
  }

  return {
    currentUser: readonly(currentUser),
    userRole: readonly(userRole),
    loading: readonly(loading),
    roleLoading: readonly(roleLoading),
    signIn,
    signOut,
  };
}
