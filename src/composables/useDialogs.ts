import { inject } from "vue";
import type { InjectionKey } from "vue";
import type { Role } from "../api/contracts";
export type DialogKind =
  "application" | "resource" | "role" | "assignment" | "tenant";
export interface Dialogs {
  open: (kind: DialogKind) => void;
  grant: (role: Role) => void;
}
export const dialogsKey: InjectionKey<Dialogs> = Symbol("dialogs");
export function useDialogs(): Dialogs {
  const dialogs = inject(dialogsKey);
  if (!dialogs)
    throw new Error("Los diálogos requieren el layout autenticado.");
  return dialogs;
}
