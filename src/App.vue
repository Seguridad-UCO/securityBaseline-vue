<script setup lang="ts">
import { onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { sessionEvents } from "./api/client";
import { useSessionStore } from "./stores/session";
import { useCatalogSync } from "./composables/useCatalogSync";
import ConsoleLayout from "./components/ConsoleLayout.vue";
import LoginView from "./views/LoginView.vue";
const session = useSessionStore(),
  router = useRouter();
const { signOut } = useCatalogSync();
const expire = () => session.expire();
sessionEvents.addEventListener("expired", expire);
onUnmounted(() => sessionEvents.removeEventListener("expired", expire));
watch(
  () => session.status,
  (status) => {
    if (status === "anonymous" && session.initialized)
      void router.replace({ name: "login" });
  },
);
</script>
<template>
  <ConsoleLayout
    v-if="session.status === 'authenticated'"
    @sign-out="signOut"
  /><LoginView v-else />
</template>
