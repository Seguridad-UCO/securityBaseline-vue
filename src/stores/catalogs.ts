import { computed, ref } from "vue";
import { defineStore } from "pinia";
import * as api from "../api";
import type {
  ApiResponse,
  Page,
  PageParams,
  Application,
  Profile,
  ProfileAssignment,
  Resource,
  Tenant,
  User,
  Role,
  Assignment,
} from "../api/contracts";

async function allPages<T>(
  fetchPage: (params: PageParams) => Promise<ApiResponse<Page<T>>>,
): Promise<T[]> {
  const items: T[] = [];
  let offset = 0;
  for (;;) {
    const { data } = await fetchPage({ offset, limit: 100 });
    items.push(...data.content);
    offset = data.offset + data.content.length;
    if (offset >= data.total || data.content.length === 0) return items;
  }
}

export const useCatalogsStore = defineStore("catalogs", () => {
  const apps = ref<Application[]>([]),
    resources = ref<Resource[]>([]),
    tenants = ref<Tenant[]>([]);
  const users = ref<User[]>([]),
    roles = ref<Role[]>([]),
    assignments = ref<Assignment[]>([]);
  const profiles = ref<Profile[]>([]);
  // El PDP todavía no expone una consulta de asignaciones de perfil (HU-011): esta lista no la
  // toca `refresh()` — solo crece con lo que se asigna en esta sesión del navegador, y se pierde
  // al recargar la página. Ver ProfileAssignment en api/contracts.ts.
  const profileAssignments = ref<ProfileAssignment[]>([]);
  const loading = ref(false),
    error = ref(""),
    notice = ref("");
  const appById = computed(() =>
    Object.fromEntries(apps.value.map((app) => [app.id, app])),
  );
  let pending: Promise<void> | undefined;
  let dirty = false;
  let generation = 0;
  // Coalesce concurrent invalidations, but always reload if a mutation arrives during a read.
  function refresh(): Promise<void> {
    dirty = true;
    if (pending) return pending;
    const current = generation;
    loading.value = true;
    pending = (async () => {
      while (dirty && current === generation) {
        dirty = false;
        const [nextApps, nextTenants, nextUsers, nextRoles, nextProfiles] =
          await Promise.all([
            allPages(api.listApplications),
            api.listTenants(),
            api.listUsers(),
            allPages(api.listRoles),
            allPages(api.listProfiles),
          ]);
        const [nextResources, nextAssignments] = await Promise.all([
          Promise.all(
            nextApps.map(async (application) =>
              (await api.listResources(application.id)).data.map(
                (resource) => ({ ...resource, application }),
              ),
            ),
          ),
          Promise.all(
            nextRoles.map(async (role) =>
              (
                await allPages((params) => api.listAssignments(role.id, params))
              ).map((assignment) => ({ ...assignment, role })),
            ),
          ),
        ]);
        if (current !== generation) return;
        // Publish a complete snapshot only after all reads succeed.
        apps.value = nextApps;
        tenants.value = nextTenants.data;
        users.value = nextUsers.data;
        roles.value = nextRoles;
        profiles.value = nextProfiles;
        resources.value = nextResources.flat();
        assignments.value = nextAssignments.flat();
        error.value = "";
      }
    })()
      .catch((reason) => {
        if (current === generation)
          error.value =
            reason instanceof Error
              ? reason.message
              : "No fue posible cargar los catálogos.";
        throw reason;
      })
      .finally(() => {
        if (current === generation) {
          loading.value = false;
          pending = undefined;
        }
      });
    return pending;
  }
  function reload() {
    void refresh().catch(() => {
      /* error is rendered by the layout */
    });
  }
  // La asignación de perfil (HU-011) no tiene endpoint de consulta: se recuerda a mano, con el
  // nombre del perfil resuelto una vez porque el propio recurso no lo trae.
  function recordProfileAssignment(assignment: ProfileAssignment) {
    const profile = profiles.value.find((item) => item.id === assignment.profileId);
    profileAssignments.value = [
      ...profileAssignments.value,
      { ...assignment, profileName: profile?.name ?? assignment.profileId },
    ];
  }
  function markProfileAssignmentRevoked(profileAssignmentId: string) {
    profileAssignments.value = profileAssignments.value.map((item) =>
      item.id === profileAssignmentId
        ? { ...item, validUntil: new Date().toISOString() }
        : item,
    );
  }
  function clear() {
    generation++;
    pending = undefined;
    dirty = false;
    loading.value = false;
    apps.value = [];
    resources.value = [];
    tenants.value = [];
    users.value = [];
    roles.value = [];
    assignments.value = [];
    profiles.value = [];
    profileAssignments.value = [];
    error.value = "";
    notice.value = "";
  }
  return {
    apps,
    resources,
    tenants,
    users,
    roles,
    assignments,
    profiles,
    profileAssignments,
    loading,
    error,
    notice,
    appById,
    refresh,
    reload,
    recordProfileAssignment,
    markProfileAssignmentRevoked,
    clear,
  };
});
