import { ref, readonly } from "vue";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, type User } from "firebase/auth";
import { auth } from "./firebase";

const currentUser = ref<User | null>(null);
const loading = ref(true);

// Only subscribe in the browser — auth doesn't exist during SSR
if (typeof window !== "undefined") {
  onAuthStateChanged(auth, (user) => {
    currentUser.value = user;
    loading.value = false;
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
    loading: readonly(loading),
    signIn,
    signOut,
  };
}
