import { computed, ref } from "vue";
import { defineStore } from "pinia";
import {
  endSession,
  getSession,
  startKeycloakLogin,
  startKeycloakRegistration,
} from "../api";
import type { Session } from "../api/contracts";

export const useSessionStore = defineStore("session", () => {
  const status = ref<"loading" | "authenticated" | "anonymous">("loading");
  const profile = ref<Session | null>(null);
  const error = ref("");
  const initialized = ref(false);
  let pending: Promise<void> | undefined;
  const userName = computed(
    () => profile.value?.name || profile.value?.email || "Administrador",
  );
  const initials = computed(() =>
    userName.value
      .split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase(),
  );
  function expire() {
    profile.value = null;
    status.value = "anonymous";
  }
  function refresh() {
    if (pending) return pending;
    pending = (async () => {
      const url = new URL(window.location.href);
      const message =
        url.searchParams.get("error") === "authentication"
          ? "No fue posible completar la autenticación. Intenta iniciar sesión de nuevo."
          : url.searchParams.get("registered") === "success"
            ? "La cuenta fue creada. Ahora inicia sesión manualmente con tus credenciales."
            : "";
      try {
        profile.value = (await getSession()).data;
        status.value = "authenticated";
        error.value = "";
      } catch {
        expire();
        error.value = message;
      } finally {
        url.searchParams.delete("error");
        url.searchParams.delete("registered");
        window.history.replaceState(
          window.history.state,
          "",
          `${url.pathname}${url.search}${url.hash}`,
        );
        initialized.value = true;
      }
    })().finally(() => {
      pending = undefined;
    });
    return pending;
  }
  function beginSignIn() {
    status.value = "loading";
    error.value = "";
    const returnTo = new URL(window.location.href).searchParams.get("returnTo");
    startKeycloakLogin(returnTo ?? undefined);
  }
  function beginSignUp() {
    status.value = "loading";
    error.value = "";
    startKeycloakRegistration();
  }
  function signOut() {
    expire();
    endSession();
  }
  return {
    status,
    profile,
    error,
    initialized,
    userName,
    initials,
    refresh,
    expire,
    beginSignIn,
    beginSignUp,
    signOut,
  };
});
