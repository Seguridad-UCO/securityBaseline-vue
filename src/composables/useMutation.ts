import { ref } from "vue";
import { useCatalogsStore } from "../stores/catalogs";

export const catalogEvents = new EventTarget();
export function useMutation() {
  const catalogs = useCatalogsStore();
  const busy = ref(false),
    error = ref(""),
    saved = ref(false);
  async function run(
    action: () => Promise<unknown>,
    message: string,
  ): Promise<boolean> {
    if (busy.value) return false;
    busy.value = true;
    error.value = "";
    const retryingReload = saved.value;
    try {
      // A successful write is never repeated when only its subsequent reload failed.
      if (!saved.value) {
        await action();
        saved.value = true;
        catalogEvents.dispatchEvent(new Event("changed"));
      }
      await catalogs.refresh();
      if (retryingReload) catalogEvents.dispatchEvent(new Event("changed"));
      catalogs.notice = message;
      saved.value = false;
      return true;
    } catch (reason) {
      error.value =
        reason instanceof Error
          ? reason.message
          : "No fue posible completar la operación.";
      if (saved.value)
        error.value = `El cambio se guardó, pero no se pudieron actualizar los resultados. Reintenta la actualización. ${error.value}`;
      return false;
    } finally {
      busy.value = false;
    }
  }
  return { busy, error, saved, run };
}
