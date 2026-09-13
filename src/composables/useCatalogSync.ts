import { onScopeDispose, watch } from "vue";
import { getApiBaseUrl } from "../api";
import { useSessionStore } from "../stores/session";
import { useCatalogsStore } from "../stores/catalogs";
import { catalogEvents } from "./useMutation";

// Notifications carry no user data. Every receiving tab reads its own authorized BFF snapshot.
export function useCatalogSync() {
  const session = useSessionStore(),
    catalogs = useCatalogsStore();
  const channel =
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(`security-baseline:${getApiBaseUrl()}`);
  const changed = () => channel?.postMessage({ type: "catalogs-changed" });
  const received = async (event: MessageEvent) => {
    if (event.data?.type === "signed-out") {
      session.expire();
      return;
    }
    if (
      event.data?.type !== "catalogs-changed" ||
      session.status !== "authenticated"
    )
      return;
    await session.refresh();
    if (session.status === "authenticated") catalogs.reload();
  };
  const restore = () => {
    if (
      document.visibilityState === "visible" &&
      session.status === "authenticated"
    ) {
      void session.refresh().then(() => {
        if (session.status === "authenticated") catalogs.reload();
      });
    }
  };
  channel?.addEventListener("message", received);
  catalogEvents.addEventListener("changed", changed);
  document.addEventListener("visibilitychange", restore);
  window.addEventListener("online", restore);
  window.addEventListener("pageshow", restore);
  watch(
    () => session.status,
    (status) => {
      if (status === "authenticated") catalogs.reload();
      else catalogs.clear();
    },
    { immediate: true },
  );
  watch(
    () => session.profile?.tenantId,
    (next, previous) => {
      if (previous && next !== previous) {
        catalogs.clear();
        if (session.status === "authenticated") catalogs.reload();
      }
    },
  );
  onScopeDispose(() => {
    channel?.close();
    catalogEvents.removeEventListener("changed", changed);
    document.removeEventListener("visibilitychange", restore);
    window.removeEventListener("online", restore);
    window.removeEventListener("pageshow", restore);
  });
  function signOut() {
    channel?.postMessage({ type: "signed-out" });
    session.signOut();
  }
  return { signOut };
}
