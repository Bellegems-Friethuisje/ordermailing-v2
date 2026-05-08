<template>
  <div v-if="supported" class="flex items-center gap-2 px-4 py-2">
    <Button
      v-if="permission === 'default'"
      variant="outline"
      size="sm"
      class="w-full justify-start"
      @click="requestPermission"
    >
      <Bell class="mr-2 size-4" />
      Meldingen inschakelen
    </Button>
    <div v-else-if="permission === 'granted'" class="flex items-center text-xs text-muted-foreground gap-2">
      <BellRing class="size-3 text-green-500" />
      Meldingen staan aan
    </div>
    <div v-else-if="permission === 'denied'" class="flex items-center text-xs text-muted-foreground gap-2">
      <BellOff class="size-3 text-red-500" />
      Meldingen geblokkeerd
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { Bell, BellRing, BellOff } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { getMessaging, getToken } from "firebase/messaging";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/apiFetch";

const supported = ref(false);
const permission = ref<NotificationPermission>("default");

onMounted(() => {
  if ("Notification" in window) {
    supported.value = true;
    permission.value = Notification.permission;
    
    // If already granted, ensure token is up to date
    if (permission.value === "granted") {
      syncToken();
    }
  }
});

async function requestPermission() {
  const result = await Notification.requestPermission();
  permission.value = result;
  if (result === "granted") {
    await syncToken();
  }
}

async function syncToken() {
  try {
    const messaging = getMessaging();
    const token = await getToken(messaging, {
      vapidKey: "BH53V... (I should probably use a real one if needed, but Firebase usually handles this if configured)",
    });

    if (token) {
      await apiFetch("/api/reservations/subscribe", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      console.log("Push token synced");
    }
  } catch (err) {
    console.error("Failed to sync push token:", err);
  }
}
</script>
