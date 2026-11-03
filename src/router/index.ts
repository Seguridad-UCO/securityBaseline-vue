import { createRouter, createWebHistory } from "vue-router";
import { useSessionStore } from "../stores/session";
import { modules } from "./modules";
import LoginView from "../views/LoginView.vue";

const views = {
  home: () => import("../views/HomeView.vue"),
  applications: () => import("../views/ApplicationsView.vue"),
  serviceIdentities: () => import("../views/ServiceIdentitiesView.vue"),
  serviceAccessRequests: () => import("../views/ServiceAccessRequestsView.vue"),
  serviceAccessApprovals: () => import("../views/ServiceAccessApprovalsView.vue"),
  serviceAccessAssignments: () => import("../views/ServiceAccessAssignmentsView.vue"),
  serviceTechnicalRoles: () => import("../views/ServiceTechnicalRolesView.vue"),
  resources: () => import("../views/ResourcesView.vue"),
  bulkLoad: () => import("../views/BulkLoadView.vue"),
  roles: () => import("../views/RolesView.vue"),
  rolePermissions: () => import("../views/RolePermissionsView.vue"),
  assignments: () => import("../views/AssignmentsView.vue"),
  profiles: () => import("../views/ProfilesView.vue"),
  profileRoles: () => import("../views/ProfileRolesView.vue"),
  profileAssignments: () => import("../views/ProfileAssignmentsView.vue"),
  authorize: () => import("../views/AuthorizeView.vue"),
  tenants: () => import("../views/TenantsView.vue"),
  users: () => import("../views/UsersView.vue"),
};

function trustedReturnTarget(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const target = new URL(value);
    return target.origin === "http://localhost:5174" ? target.toString() : undefined;
  } catch {
    return undefined;
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", name: "login", component: LoginView },
    ...modules.map((module) => ({
      path: module.path,
      name: module.id,
      component: views[module.id],
      meta: { protected: true },
    })),
    { path: "/perfiles/roles", name: "profileRoles", component: views.profileRoles, meta: { protected: true } },
    { path: "/identidades-de-servicio/solicitar-acceso", name: "serviceAccessRequests", component: views.serviceAccessRequests, meta: { protected: true, moduleId: "serviceIdentities", title: "Solicitar acceso", description: "Solicita permisos para una identidad de servicio" } },
    { path: "/identidades-de-servicio/aprobaciones", name: "serviceAccessApprovals", component: views.serviceAccessApprovals, meta: { protected: true, moduleId: "serviceIdentities", title: "Aprobar solicitudes", description: "Revisa y decide las solicitudes pendientes por aplicación" } },
    { path: "/identidades-de-servicio/asignaciones", name: "serviceAccessAssignments", component: views.serviceAccessAssignments, meta: { protected: true, moduleId: "serviceIdentities", title: "Asignaciones de servicio", description: "Consulta y decide los accesos M2M de una identidad o de una aplicación" } },
    { path: "/identidades-de-servicio/revocaciones", redirect: { name: "serviceAccessAssignments" } },
    { path: "/identidades-de-servicio/roles-tecnicos", name: "serviceTechnicalRoles", component: views.serviceTechnicalRoles, meta: { protected: true, moduleId: "serviceIdentities", title: "Roles técnicos", description: "Agrupa recursos que una identidad puede solicitar como un único acceso" } },
    { path: "/roles/permisos", name: "rolePermissions", component: views.rolePermissions, meta: { protected: true } },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
router.beforeEach(async (to) => {
  const session = useSessionStore();
  if (!session.initialized) await session.refresh();
  if (to.meta.protected && session.status !== "authenticated")
    return { name: "login", query: { redirect: to.fullPath } };
  if (to.name === "login" && session.status === "authenticated") {
    const returnTarget = trustedReturnTarget(to.query.returnTo);
    if (returnTarget) window.location.assign(returnTarget);
    else return { name: "home" };
    return false;
  }
});
