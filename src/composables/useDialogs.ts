import { inject } from "vue";
import type { InjectionKey } from "vue";
import type { Application, Profile, Resource, Role } from "../api/contracts";
export type DialogKind =
  | "application"
  | "resource"
  | "role"
  | "assignment"
  | "tenant"
  | "profile"
  | "profileAssignment";
export interface Dialogs {
  open: (kind: DialogKind) => void;
  grant: (role: Role) => void;
  grantProfile: (profile: Profile) => void;
  editApplication: (application: Application) => void;
  rotateCredential: (application: Application) => void;
  editResource: (resource: Resource) => void;
  editRole: (role: Role) => void;
  editProfile: (profile: Profile) => void;
  confirm: (title: string, description: string, action: () => Promise<unknown>) => void;
}
export const dialogsKey: InjectionKey<Dialogs> = Symbol("dialogs");
export function useDialogs(): Dialogs {
  const dialogs = inject(dialogsKey);
  if (!dialogs)
    throw new Error("Los diálogos requieren el layout autenticado.");
  return dialogs;
}
