import { createRouter, createWebHistory } from "vue-router";
import { useSessionStore } from "../stores/session";
import { modules } from "./modules";
import LoginView from "../views/LoginView.vue";

const views = {
  home: () => import("../views/HomeView.vue"),
  applications: () => import("../views/ApplicationsView.vue"),
  resources: () => import("../views/ResourcesView.vue"),
  roles: () => import("../views/RolesView.vue"),
  assignments: () => import("../views/AssignmentsView.vue"),
  profiles: () => import("../views/ProfilesView.vue"),
  profileAssignments: () => import("../views/ProfileAssignmentsView.vue"),
  authorize: () => import("../views/AuthorizeView.vue"),
  tenants: () => import("../views/TenantsView.vue"),
  users: () => import("../views/UsersView.vue"),
};
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
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
router.beforeEach(async (to) => {
  const session = useSessionStore();
  if (!session.initialized) await session.refresh();
  if (to.meta.protected && session.status !== "authenticated")
    return { name: "login", query: { redirect: to.fullPath } };
  if (to.name === "login" && session.status === "authenticated")
    return { name: "home" };
});
