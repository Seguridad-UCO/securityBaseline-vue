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
        const userById = (userId: string) =>
          nextUsers.data.find((user) => user.id === userId);
        const [nextResources, nextAssignments, nextProfileAssignments] =
          await Promise.all([
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
                ).map((assignment) => ({
                  ...assignment,
                  role,
                  user: userById(assignment.userId),
                })),
              ),
            ),
            Promise.all(
              nextProfiles.map(async (profile) =>
                (
                  await allPages((params) =>
                    api.listProfileAssignments(profile.id, params),
                  )
                ).map((profileAssignment) => ({
                  ...profileAssignment,
                  profile,
                  user: userById(profileAssignment.userId),
                })),
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
        profileAssignments.value = nextProfileAssignments.flat();
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
    clear,
  };
});
