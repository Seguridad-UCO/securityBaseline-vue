<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import {
  addServiceTechnicalRoleResource,
  createServiceTechnicalRole,
  listApplicationSecurityResources,
  listServiceTechnicalRoleResources,
  listServiceTechnicalRoles,
  removeServiceTechnicalRoleResource,
} from "../api";
import type {
  ApiResponse,
  HttpMethod,
  Page,
  PageParams,
  Resource,
  ServiceTechnicalRole,
} from "../api/contracts";
import Alert from "../components/Alert.vue";
import Icon from "../components/Icon.vue";
import { useCatalogsStore } from "../stores/catalogs";
import ServiceNavigation from "../components/ServiceNavigation.vue";

type DragPayload = {
  resourceId: string;
  source: "available" | "assigned";
  roleId: string;
};

const ROLE_PAGE_SIZE = 8;
const RESOURCE_PAGE_SIZE = 10;
const CREATE_PAGE_SIZE = 12;
const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const STORAGE_KEY = "security-baseline:technical-roles:application";

const catalogs = useCatalogsStore();
const route = useRoute();
const router = useRouter();

const applicationId = ref("");
const roles = ref<ServiceTechnicalRole[]>([]);
const resources = ref<Resource[]>([]);
const assignedByRole = reactive(new Map<string, Set<string>>());
const loadedRoles = reactive(new Set<string>());
const loadingAssigned = reactive(new Set<string>());
const saving = reactive(new Set<string>());
const loadingApp = ref(false);
const error = ref("");
const success = ref("");

const selectedRoleId = ref("");
const roleQuery = ref("");
const rolePage = ref(1);
const resourceQuery = ref("");
const methodFilter = ref<"" | HttpMethod>("");
const availablePage = ref(1);
const assignedPage = ref(1);
const availableSelected = ref(new Set<string>());
const assignedSelected = ref(new Set<string>());
const mobileColumn = ref<"assigned" | "available">("assigned");
const bulkBusy = ref(false);

const createOpen = ref(false);
const creating = ref(false);
const createForm = reactive({ code: "", name: "" });
const createSelected = ref(new Set<string>());
const createQuery = ref("");
const createMethod = ref<"" | HttpMethod>("");
const createPage = ref(1);
const createAttempted = ref(false);
const createCodeInput = ref<HTMLInputElement>();

const pendingAssigned = new Map<string, Promise<void>>();
const dragging = ref<DragPayload | null>(null);
const dragOverRoleId = ref("");
const dragOverZone = ref<"" | "assigned" | "available">("");
const copiedRoleId = ref("");
let copiedTimer: ReturnType<typeof setTimeout> | undefined;
let loadGeneration = 0;

const appsLoading = computed(() => catalogs.loading && !catalogs.apps.length);
const selectedRole = computed(
  () => roles.value.find((role) => role.id === selectedRoleId.value) ?? null,
);

const normalizedRoleQuery = computed(() => roleQuery.value.trim().toLowerCase());
const filteredRoles = computed(() => {
  const query = normalizedRoleQuery.value;
  if (!query) return roles.value;
  return roles.value.filter((role) =>
    `${role.name} ${role.code}`.toLowerCase().includes(query),
  );
});
const roleTotalPages = computed(() =>
  totalPages(filteredRoles.value.length, ROLE_PAGE_SIZE),
);
const visibleRoles = computed(() =>
  pageItems(filteredRoles.value, rolePage.value, ROLE_PAGE_SIZE),
);

const normalizedResourceQuery = computed(() =>
  resourceQuery.value.trim().toLowerCase(),
);
const hasFilters = computed(
  () => !!resourceQuery.value.trim() || !!methodFilter.value,
);
const selectedSet = computed(() => {
  const role = selectedRole.value;
  return role ? assignedByRole.get(role.id) ?? new Set<string>() : new Set<string>();
});
const coverage = computed(() => {
  const total = resources.value.length;
  if (!selectedRole.value || !total) return 0;
  return Math.round((selectedSet.value.size / total) * 100);
});
const sortedResources = computed(() =>
  [...resources.value].sort(
    (left, right) =>
      left.path.localeCompare(right.path) || left.method.localeCompare(right.method),
  ),
);
const allAssigned = computed(() =>
  sortedResources.value.filter((resource) => selectedSet.value.has(resource.id)),
);
const allAvailable = computed(() =>
  sortedResources.value.filter((resource) => !selectedSet.value.has(resource.id)),
);
const assignedResources = computed(() =>
  allAssigned.value.filter(matchesResourceFilters),
);
const availableResources = computed(() =>
  allAvailable.value.filter(matchesResourceFilters),
);
const assignedTotalPages = computed(() =>
  totalPages(assignedResources.value.length, RESOURCE_PAGE_SIZE),
);
const availableTotalPages = computed(() =>
  totalPages(availableResources.value.length, RESOURCE_PAGE_SIZE),
);
const visibleAssigned = computed(() =>
  pageItems(assignedResources.value, assignedPage.value, RESOURCE_PAGE_SIZE),
);
const visibleAvailable = computed(() =>
  pageItems(availableResources.value, availablePage.value, RESOURCE_PAGE_SIZE),
);
const allAssignedVisibleSelected = computed(
  () =>
    visibleAssigned.value.length > 0 &&
    visibleAssigned.value.every((resource) =>
      assignedSelected.value.has(resource.id),
    ),
);
const allAvailableVisibleSelected = computed(
  () =>
    visibleAvailable.value.length > 0 &&
    visibleAvailable.value.every((resource) =>
      availableSelected.value.has(resource.id),
    ),
);

const createResources = computed(() =>
  sortedResources.value.filter((resource) => {
    const query = createQuery.value.trim().toLowerCase();
    if (query && !`${resource.method} ${resource.path}`.toLowerCase().includes(query))
      return false;
    return !createMethod.value || resource.method === createMethod.value;
  }),
);
const createTotalPages = computed(() =>
  totalPages(createResources.value.length, CREATE_PAGE_SIZE),
);
const visibleCreateResources = computed(() =>
  pageItems(createResources.value, createPage.value, CREATE_PAGE_SIZE),
);
const allCreateVisibleSelected = computed(
  () =>
    visibleCreateResources.value.length > 0 &&
    visibleCreateResources.value.every((resource) =>
      createSelected.value.has(resource.id),
    ),
);
const codeTaken = computed(() => {
  const code = createForm.code.trim().toLowerCase();
  return !!code && roles.value.some((role) => role.code.trim().toLowerCase() === code);
});
const createHint = computed(() => {
  if (codeTaken.value) return "Ya existe un rol con ese código en esta aplicación.";
  if (!createForm.code.trim()) return "Escribe un código técnico.";
  if (!createForm.name.trim()) return "Escribe un nombre visible.";
  if (!createSelected.value.size) return "Selecciona al menos un recurso inicial.";
  return "";
});
const canCreate = computed(
  () =>
    !!applicationId.value &&
    !!createForm.code.trim() &&
    !!createForm.name.trim() &&
    createSelected.value.size > 0 &&
    !codeTaken.value &&
    !creating.value,
);

function pageItems<T>(items: T[], page: number, size: number) {
  const start = (page - 1) * size;
  return items.slice(start, start + size);
}
function totalPages(total: number, size: number) {
  return Math.max(1, Math.ceil(total / size));
}
function rangeLabel(page: number, size: number, total: number) {
  if (!total) return "0 resultados";
  return `${Math.min(total, (page - 1) * size + 1)}–${Math.min(total, page * size)} de ${total}`;
}
function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}
function message(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}
function matchesResourceFilters(resource: Resource) {
  const query = normalizedResourceQuery.value;
  if (query && !`${resource.method} ${resource.path}`.toLowerCase().includes(query))
    return false;
  return !methodFilter.value || resource.method === methodFilter.value;
}
function resourceCount(role: ServiceTechnicalRole) {
  return assignedByRole.get(role.id)?.size ?? role.resourceCount;
}
function isAssigned(roleId: string, resourceId: string) {
  return assignedByRole.get(roleId)?.has(resourceId) ?? false;
}
function savingKey(roleId: string, resourceId: string) {
  return `${roleId}:${resourceId}`;
}
function isSaving(roleId: string, resourceId: string) {
  return saving.has(savingKey(roleId, resourceId));
}
function isSavingSelected(resourceId: string) {
  return selectedRole.value
    ? isSaving(selectedRole.value.id, resourceId)
    : false;
}
function withoutSelection(current: Set<string>, id: string) {
  if (!current.has(id)) return current;
  const next = new Set(current);
  next.delete(id);
  return next;
}
function toggleSelection(current: Set<string>, id: string) {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

async function loadAll<T>(
  fetchPage: (params: PageParams) => Promise<ApiResponse<Page<T>>>,
): Promise<T[]> {
  const items: T[] = [];
  let offset = 0;
  for (;;) {
    const { data } = await fetchPage({ offset, limit: 100 });
    items.push(...data.content);
    offset = data.offset + data.content.length;
    if (!data.content.length || offset >= data.total) return items;
  }
}

function readStoredApplication() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}
function storeApplication(id: string) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* El navegador puede bloquear el almacenamiento local. */
  }
}
function syncUrl() {
  const next: Record<string, string> = {};
  if (applicationId.value) next.applicationId = applicationId.value;
  if (selectedRoleId.value) next.roleId = selectedRoleId.value;
  if (
    String(route.query.applicationId ?? "") === (next.applicationId ?? "") &&
    String(route.query.roleId ?? "") === (next.roleId ?? "")
  )
    return;
  void router.replace({ query: next });
}

async function loadApplication(
  id: string,
  preferredRoleId = "",
  preserveView = false,
) {
  const generation = ++loadGeneration;
  error.value = "";
  success.value = "";
  if (!preserveView) {
    roleQuery.value = "";
    resourceQuery.value = "";
    methodFilter.value = "";
    rolePage.value = 1;
  }
  roles.value = [];
  resources.value = [];
  assignedByRole.clear();
  loadedRoles.clear();
  loadingAssigned.clear();
  pendingAssigned.clear();
  selectedRoleId.value = "";
  availableSelected.value = new Set();
  assignedSelected.value = new Set();
  availablePage.value = 1;
  assignedPage.value = 1;
  closeCreate();
  loadingApp.value = false;
  if (!id) return;

  loadingApp.value = true;
  try {
    const [nextRoles, nextResources] = await Promise.all([
      loadAll((params) => listServiceTechnicalRoles(id, params)),
      loadAll((params) => listApplicationSecurityResources(id, params)),
    ]);
    if (applicationId.value !== id || generation !== loadGeneration) return;
    roles.value = nextRoles;
    resources.value = nextResources;
    const target =
      nextRoles.find((role) => role.id === preferredRoleId) ?? nextRoles[0];
    if (target) {
      const index = nextRoles.findIndex((role) => role.id === target.id);
      rolePage.value = Math.floor(index / ROLE_PAGE_SIZE) + 1;
      selectedRoleId.value = target.id;
    }
  } catch (cause) {
    if (applicationId.value === id && generation === loadGeneration)
      error.value = message(cause, "No fue posible cargar los roles técnicos.");
  } finally {
    if (applicationId.value === id && generation === loadGeneration)
      loadingApp.value = false;
  }
}

async function refreshData() {
  if (!applicationId.value || loadingApp.value) return;
  await loadApplication(applicationId.value, selectedRoleId.value, true);
}

function ensureAssigned(roleId: string): Promise<void> {
  const app = applicationId.value;
  const generation = loadGeneration;
  if (!app) return Promise.resolve();
  const existing = pendingAssigned.get(roleId);
  if (existing) return existing;
  if (loadedRoles.has(roleId)) return Promise.resolve();
  let task: Promise<void>;
  task = (async () => {
    loadingAssigned.add(roleId);
    try {
      const items = await loadAll((params) =>
        listServiceTechnicalRoleResources(app, roleId, params),
      );
      if (applicationId.value !== app || generation !== loadGeneration) return;
      const known = new Set(resources.value.map((resource) => resource.id));
      for (const item of items) {
        if (!known.has(item.id)) {
          resources.value.push(item);
          known.add(item.id);
        }
      }
      assignedByRole.set(roleId, new Set(items.map((item) => item.id)));
      loadedRoles.add(roleId);
      const role = roles.value.find((item) => item.id === roleId);
      if (role) role.resourceCount = items.length;
    } catch (cause) {
      if (applicationId.value === app && generation === loadGeneration)
        error.value = message(
          cause,
          "No fue posible consultar los recursos del rol.",
        );
    } finally {
      loadingAssigned.delete(roleId);
    }
  })().finally(() => {
    if (pendingAssigned.get(roleId) === task) pendingAssigned.delete(roleId);
  });
  pendingAssigned.set(roleId, task);
  return task;
}

async function assign(role: ServiceTechnicalRole, resource: Resource) {
  const key = savingKey(role.id, resource.id);
  const app = applicationId.value;
  if (!app || saving.has(key) || bulkBusy.value) return;
  if (!loadedRoles.has(role.id)) {
    await ensureAssigned(role.id);
    if (
      applicationId.value !== app ||
      !loadedRoles.has(role.id) ||
      isAssigned(role.id, resource.id)
    )
      return;
  }
  if (isAssigned(role.id, resource.id)) return;
  const cache = assignedByRole.get(role.id);
  const previousCount = role.resourceCount;
  saving.add(key);
  error.value = "";
  success.value = "";
  if (cache) {
    cache.add(resource.id);
    role.resourceCount = cache.size;
  } else {
    role.resourceCount = previousCount + 1;
  }
  availableSelected.value = withoutSelection(
    availableSelected.value,
    resource.id,
  );
  try {
    await addServiceTechnicalRoleResource(app, role.id, resource.id);
    if (applicationId.value !== app) return;
    success.value = `${resource.method} ${resource.path} se añadió a «${role.name}».`;
  } catch (cause) {
    if (cache) {
      cache.delete(resource.id);
      role.resourceCount = cache.size;
    } else {
      role.resourceCount = previousCount;
    }
    if (applicationId.value === app)
      error.value = message(cause, "No fue posible asociar el recurso.");
  } finally {
    saving.delete(key);
  }
}

async function unassign(role: ServiceTechnicalRole, resource: Resource) {
  const cache = assignedByRole.get(role.id);
  const app = applicationId.value;
  if (!app || !cache?.has(resource.id)) return;
  if (isSaving(role.id, resource.id) || bulkBusy.value) return;
  const key = savingKey(role.id, resource.id);
  saving.add(key);
  error.value = "";
  success.value = "";
  cache.delete(resource.id);
  role.resourceCount = cache.size;
  assignedSelected.value = withoutSelection(
    assignedSelected.value,
    resource.id,
  );
  try {
    await removeServiceTechnicalRoleResource(app, role.id, resource.id);
    if (applicationId.value !== app) return;
    success.value = `${resource.method} ${resource.path} se retiró de «${role.name}».`;
  } catch (cause) {
    cache.add(resource.id);
    role.resourceCount = cache.size;
    if (applicationId.value === app)
      error.value = message(cause, "No fue posible retirar el recurso.");
  } finally {
    saving.delete(key);
  }
}

function assignToSelected(resource: Resource) {
  if (selectedRole.value) void assign(selectedRole.value, resource);
}
function unassignFromSelected(resource: Resource) {
  if (selectedRole.value) void unassign(selectedRole.value, resource);
}

async function assignSelected() {
  const role = selectedRole.value;
  if (!role || bulkBusy.value || !loadedRoles.has(role.id)) return;
  const ids = [...availableSelected.value].filter(
    (id) => !isAssigned(role.id, id),
  );
  if (!ids.length) return;
  bulkBusy.value = true;
  error.value = "";
  success.value = "";
  const cache = assignedByRole.get(role.id);
  const app = applicationId.value;
  let done = 0;
  for (const id of ids) {
    if (applicationId.value !== app) {
      error.value = "La aplicación cambió durante la operación.";
      break;
    }
    try {
      await addServiceTechnicalRoleResource(app, role.id, id);
      done += 1;
      if (cache) {
        cache.add(id);
        role.resourceCount = cache.size;
      } else {
        role.resourceCount += 1;
      }
    } catch (cause) {
      error.value = `Se añadieron ${done} de ${ids.length} recursos. ${message(cause, "El API rechazó el siguiente recurso.")}`;
      break;
    }
  }
  availableSelected.value = new Set(
    [...availableSelected.value].filter((id) => !isAssigned(role.id, id)),
  );
  if (!error.value) {
    availableSelected.value = new Set();
    success.value = `${done} ${plural(done, "recurso añadido", "recursos añadidos")} a «${role.name}».`;
  }
  bulkBusy.value = false;
}

async function unassignSelected() {
  const role = selectedRole.value;
  if (!role || bulkBusy.value || !loadedRoles.has(role.id)) return;
  const ids = [...assignedSelected.value].filter((id) =>
    isAssigned(role.id, id),
  );
  if (!ids.length) return;
  bulkBusy.value = true;
  error.value = "";
  success.value = "";
  const cache = assignedByRole.get(role.id);
  const app = applicationId.value;
  let done = 0;
  for (const id of ids) {
    if (applicationId.value !== app) {
      error.value = "La aplicación cambió durante la operación.";
      break;
    }
    try {
      await removeServiceTechnicalRoleResource(app, role.id, id);
      done += 1;
      if (cache) {
        cache.delete(id);
        role.resourceCount = cache.size;
      } else {
        role.resourceCount = Math.max(0, role.resourceCount - 1);
      }
    } catch (cause) {
      error.value = `Se retiraron ${done} de ${ids.length} recursos. ${message(cause, "El API rechazó el siguiente recurso.")}`;
      break;
    }
  }
  assignedSelected.value = new Set(
    [...assignedSelected.value].filter((id) => isAssigned(role.id, id)),
  );
  if (!error.value) {
    assignedSelected.value = new Set();
    success.value = `${done} ${plural(done, "recurso retirado", "recursos retirados")} de «${role.name}».`;
  }
  bulkBusy.value = false;
}

function toggleAssignedPage() {
  const next = new Set(assignedSelected.value);
  if (allAssignedVisibleSelected.value) {
    visibleAssigned.value.forEach((resource) => next.delete(resource.id));
  } else {
    visibleAssigned.value.forEach((resource) => next.add(resource.id));
  }
  assignedSelected.value = next;
}
function toggleAvailablePage() {
  const next = new Set(availableSelected.value);
  if (allAvailableVisibleSelected.value) {
    visibleAvailable.value.forEach((resource) => next.delete(resource.id));
  } else {
    visibleAvailable.value.forEach((resource) => next.add(resource.id));
  }
  availableSelected.value = next;
}

function startDrag(
  event: DragEvent,
  resource: Resource,
  source: "available" | "assigned",
) {
  if (!selectedRole.value || isSavingSelected(resource.id) || bulkBusy.value)
    return;
  dragging.value = {
    resourceId: resource.id,
    source,
    roleId: selectedRole.value.id,
  };
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = source === "available" ? "copy" : "move";
    event.dataTransfer.setData("text/plain", resource.id);
  }
}
function endDrag() {
  dragging.value = null;
  dragOverRoleId.value = "";
  dragOverZone.value = "";
}
function canDropOnRole(role: ServiceTechnicalRole) {
  return (
    !!dragging.value &&
    dragging.value.source === "available" &&
    !isAssigned(role.id, dragging.value.resourceId)
  );
}
function onRoleDragOver(event: DragEvent, role: ServiceTechnicalRole) {
  if (!canDropOnRole(role)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  dragOverRoleId.value = role.id;
}
function onRoleDragLeave(event: DragEvent, role: ServiceTechnicalRole) {
  const next = event.relatedTarget as Node | null;
  if (next && (event.currentTarget as HTMLElement).contains(next)) return;
  if (dragOverRoleId.value === role.id) dragOverRoleId.value = "";
}
function onRoleDrop(event: DragEvent, role: ServiceTechnicalRole) {
  event.preventDefault();
  dragOverRoleId.value = "";
  const payload = dragging.value;
  const resource = payload
    ? resources.value.find((item) => item.id === payload.resourceId)
    : undefined;
  if (!payload || payload.source !== "available" || !resource) return;
  endDrag();
  void assign(role, resource);
}
function canDropOnZone(zone: "assigned" | "available") {
  const payload = dragging.value;
  const role = selectedRole.value;
  if (!payload || !role) return false;
  if (zone === "assigned")
    return (
      payload.source === "available" && !isAssigned(role.id, payload.resourceId)
    );
  return payload.source === "assigned" && payload.roleId === role.id;
}
function onZoneDragOver(event: DragEvent, zone: "assigned" | "available") {
  if (!canDropOnZone(zone)) return;
  event.preventDefault();
  if (event.dataTransfer)
    event.dataTransfer.dropEffect = zone === "assigned" ? "copy" : "move";
  dragOverZone.value = zone;
}
function onZoneDragLeave(event: DragEvent, zone: "assigned" | "available") {
  const next = event.relatedTarget as Node | null;
  if (next && (event.currentTarget as HTMLElement).contains(next)) return;
  if (dragOverZone.value === zone) dragOverZone.value = "";
}
function onZoneDrop(event: DragEvent, zone: "assigned" | "available") {
  event.preventDefault();
  dragOverZone.value = "";
  const payload = dragging.value;
  const role = selectedRole.value;
  const resource = payload
    ? resources.value.find((item) => item.id === payload.resourceId)
    : undefined;
  if (!payload || !role || !resource) return;
  endDrag();
  if (zone === "assigned" && payload.source === "available")
    void assign(role, resource);
  if (
    zone === "available" &&
    payload.source === "assigned" &&
    payload.roleId === role.id
  )
    void unassign(role, resource);
}

function openCreate() {
  if (!applicationId.value || loadingApp.value || bulkBusy.value) return;
  closeCreate();
  createOpen.value = true;
  error.value = "";
  success.value = "";
  void nextTick(() => createCodeInput.value?.focus());
}
function closeCreate() {
  createOpen.value = false;
  creating.value = false;
  createForm.code = "";
  createForm.name = "";
  createSelected.value = new Set();
  createQuery.value = "";
  createMethod.value = "";
  createPage.value = 1;
  createAttempted.value = false;
}
function focusCreate() {
  void nextTick(() => createCodeInput.value?.focus());
}
function toggleCreate(resourceId: string) {
  createSelected.value = toggleSelection(createSelected.value, resourceId);
}
function toggleCreatePage() {
  const next = new Set(createSelected.value);
  if (allCreateVisibleSelected.value) {
    visibleCreateResources.value.forEach((resource) => next.delete(resource.id));
  } else {
    visibleCreateResources.value.forEach((resource) => next.add(resource.id));
  }
  createSelected.value = next;
}
async function submitCreate() {
  createAttempted.value = true;
  if (!canCreate.value || !applicationId.value) return;
  const app = applicationId.value;
  const generation = loadGeneration;
  creating.value = true;
  error.value = "";
  success.value = "";
  try {
    const { data: created } = await createServiceTechnicalRole(app, {
      code: createForm.code.trim(),
      name: createForm.name.trim(),
      resourceIds: [...createSelected.value],
    });
    if (applicationId.value !== app || generation !== loadGeneration) return;
    created.resourceCount = createSelected.value.size;
    roles.value = [created, ...roles.value.filter((role) => role.id !== created.id)];
    assignedByRole.set(created.id, new Set(createSelected.value));
    loadedRoles.add(created.id);
    roleQuery.value = "";
    rolePage.value = 1;
    const count = created.resourceCount;
    closeCreate();
    selectedRoleId.value = created.id;
    success.value = `Rol «${created.code}» creado con ${count} ${plural(count, "recurso", "recursos")}.`;
  } catch (cause) {
    if (applicationId.value === app && generation === loadGeneration)
      error.value = message(cause, "No fue posible crear el rol técnico.");
  } finally {
    creating.value = false;
  }
}
function selectRole(role: ServiceTechnicalRole) {
  if (createOpen.value) return;
  selectedRoleId.value = role.id;
}
async function copyCode(role: ServiceTechnicalRole) {
  try {
    await navigator.clipboard.writeText(role.code);
    copiedRoleId.value = role.id;
    if (copiedTimer) clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      copiedRoleId.value = "";
    }, 1800);
  } catch {
    error.value =
      "No fue posible copiar el código. Selecciónalo en la cabecera del rol.";
  }
}
function copySelectedCode() {
  if (selectedRole.value) void copyCode(selectedRole.value);
}
function clearFilters() {
  resourceQuery.value = "";
  methodFilter.value = "";
}
function clearCreateFilters() {
  createQuery.value = "";
  createMethod.value = "";
}

watch(roleQuery, () => {
  rolePage.value = 1;
});
watch(roleTotalPages, (total) => {
  if (rolePage.value > total) rolePage.value = total;
});
watch([resourceQuery, methodFilter], () => {
  availablePage.value = 1;
  assignedPage.value = 1;
  availableSelected.value = new Set();
  assignedSelected.value = new Set();
});
watch(assignedTotalPages, (total) => {
  if (assignedPage.value > total) assignedPage.value = total;
});
watch(availableTotalPages, (total) => {
  if (availablePage.value > total) availablePage.value = total;
});
watch(createQuery, () => {
  createPage.value = 1;
});
watch(createMethod, () => {
  createPage.value = 1;
});
watch(createTotalPages, (total) => {
  if (createPage.value > total) createPage.value = total;
});
watch(selectedRoleId, (id) => {
  availablePage.value = 1;
  assignedPage.value = 1;
  availableSelected.value = new Set();
  assignedSelected.value = new Set();
  if (id) void ensureAssigned(id);
  syncUrl();
});

const storedApplication = readStoredApplication();
const initialRoleId =
  typeof route.query.roleId === "string" ? route.query.roleId : "";
let firstLoad = true;
let initialised = false;

watch(applicationId, (id) => {
  storeApplication(id);
  const preferred = firstLoad ? initialRoleId : "";
  firstLoad = false;
  void loadApplication(id, preferred);
  syncUrl();
});

watch(
  () => [catalogs.apps, catalogs.loading] as const,
  ([apps]) => {
    if (initialised || !apps.length) return;
    initialised = true;
    const queryApplication =
      typeof route.query.applicationId === "string"
        ? route.query.applicationId
        : "";
    const preferred =
      apps.find((app) => app.id === queryApplication) ??
      apps.find((app) => app.id === storedApplication) ??
      apps[0];
    if (preferred) applicationId.value = preferred.id;
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer);
});
</script>
<template>
  <div class="technical-roles">
    <Alert v-if="error" type="error" :message="error" @close="error = ''" />
    <Alert
      v-if="success"
      type="success"
      :message="success"
      @close="success = ''"
    />

    <ServiceNavigation />

    <section class="role-toolbar" aria-label="Contexto de la aplicación">
      <div class="role-toolbar-start">
        <label class="app-field">
          <span>Aplicación propietaria</span>
          <select
            v-model="applicationId"
            :disabled="!catalogs.apps.length || loadingApp || createOpen || bulkBusy"
          >
            <option value="" disabled>Selecciona una aplicación</option>
            <option v-for="app in catalogs.apps" :key="app.id" :value="app.id">
              {{ app.name }}
            </option>
          </select>
        </label>
        <div class="role-metrics">
          <span>
            <b>{{ loadingApp ? "—" : resources.length }}</b>
            {{ plural(resources.length, "recurso", "recursos") }}
          </span>
          <i aria-hidden="true" />
          <span>
            <b>{{ loadingApp ? "—" : roles.length }}</b>
            {{ plural(roles.length, "rol técnico", "roles técnicos") }}
          </span>
        </div>
      </div>
      <div class="role-toolbar-actions">
        <button
          class="refresh-action"
          :disabled="!applicationId || loadingApp || createOpen || bulkBusy"
          @click="refreshData"
        >
          <Icon name="refresh" :size="15" />{{
            loadingApp ? "Actualizando" : "Actualizar roles"
          }}
        </button>
        <button
          class="create-action"
          :disabled="!applicationId || loadingApp || createOpen || bulkBusy"
          @click="openCreate"
        >
          <Icon name="plus" :size="16" />Nuevo rol técnico
        </button>
      </div>
    </section>

    <p v-if="applicationId && !loadingApp" class="workbench-hint">
      <Icon name="grip" :size="14" aria-hidden="true" />
      Arrastra un recurso a un rol para asignarlo, o usa los botones de cada
      fila.
    </p>

    <section
      v-if="appsLoading && !catalogs.apps.length"
      class="workbench-skeleton"
      aria-busy="true"
    >
      <div class="skeleton-rail">
        <span class="skeleton-line short" />
        <span class="skeleton-line" />
        <span class="skeleton-line" />
        <span class="skeleton-line" />
      </div>
      <div class="skeleton-workspace">
        <span class="skeleton-line title" />
        <span class="skeleton-line" />
        <div class="skeleton-columns">
          <span class="skeleton-block" />
          <span class="skeleton-block" />
        </div>
      </div>
    </section>

    <section v-else-if="!catalogs.apps.length" class="app-empty">
      <span class="empty-icon"><Icon name="apps" :size="24" /></span>
      <strong>No hay aplicaciones registradas</strong>
      <p>
        Registra una aplicación para poder agrupar sus recursos en roles
        técnicos.
      </p>
      <RouterLink class="create-action" :to="{ name: 'applications' }"
        >Ir a Aplicaciones</RouterLink
      >
    </section>

    <section v-else-if="!applicationId" class="app-empty">
      <span class="empty-icon"><Icon name="key" :size="24" /></span>
      <strong>Elige una aplicación</strong>
      <p>
        Los roles técnicos pertenecen a la aplicación dueña de los recursos.
        Selecciona una arriba para empezar.
      </p>
    </section>

    <div v-else class="workbench">
      <aside class="role-rail" aria-label="Roles técnicos de la aplicación">
        <header class="rail-header">
          <div>
            <h2>Roles técnicos</h2>
            <span v-if="loadingApp">Consultando…</span>
            <span v-else
              >{{ filteredRoles.length }}
              {{ plural(filteredRoles.length, "rol", "roles") }}</span
            >
          </div>
        </header>
        <label class="search-field rail-search">
          <Icon name="search" :size="15" aria-hidden="true" />
          <input
            v-model="roleQuery"
            type="search"
            placeholder="Buscar rol o código"
            aria-label="Buscar rol técnico"
            :disabled="loadingApp"
          />
        </label>

        <div v-if="loadingApp" class="rail-skeleton" aria-busy="true">
          <span class="skeleton-line" />
          <span class="skeleton-line" />
          <span class="skeleton-line" />
          <span class="skeleton-line" />
          <span class="skeleton-line" />
        </div>

        <template v-else>
          <ul class="role-list" role="list">
            <li v-if="createOpen">
              <button
                class="role-tile create-card selected"
                type="button"
                aria-current="true"
                @click="focusCreate"
              >
                <span class="role-tile-top">
                  <span class="role-create-label">Nuevo rol</span>
                  <span class="role-count"
                    ><Icon name="plus" :size="12"
                  /></span>
                </span>
                <strong>Rol técnico sin guardar</strong>
                <span class="role-tile-meta">Completa los datos del formulario</span>
              </button>
            </li>
            <li v-for="role in visibleRoles" :key="role.id">
              <button
                :class="[
                  'role-tile',
                  {
                    selected: role.id === selectedRoleId && !createOpen,
                    'is-drag-over': dragOverRoleId === role.id,
                    'is-contained':
                      dragging?.source === 'available' &&
                      isAssigned(role.id, dragging.resourceId),
                    'is-drop-ready': canDropOnRole(role),
                  },
                ]"
                type="button"
                :aria-current="
                  role.id === selectedRoleId && !createOpen ? 'true' : undefined
                "
                :disabled="createOpen"
                @click="selectRole(role)"
                @dragover="onRoleDragOver($event, role)"
                @dragleave="onRoleDragLeave($event, role)"
                @drop="onRoleDrop($event, role)"
              >
                <span class="role-tile-top">
                  <code>{{ role.code }}</code>
                  <span class="role-count">
                    <Icon
                      v-if="role.id === selectedRoleId && !createOpen"
                      name="check"
                      :size="11"
                      aria-hidden="true"
                    />
                    {{ resourceCount(role) }}
                  </span>
                </span>
                <strong>{{ role.name }}</strong>
                <span
                  v-if="dragging && canDropOnRole(role)"
                  class="role-tile-meta drop-label"
                  >Suelta para asignar</span
                >
                <span
                  v-else-if="
                    dragging?.source === 'available' &&
                    isAssigned(role.id, dragging.resourceId)
                  "
                  class="role-tile-meta drop-label contained-label"
                  >Ya está en este rol</span
                >
                <span v-else class="role-tile-meta"
                  >{{ resourceCount(role) }}
                  {{ plural(resourceCount(role), "recurso", "recursos") }}</span
                >
              </button>
            </li>
          </ul>
          <div v-if="!visibleRoles.length && !createOpen" class="rail-empty">
            <strong>{{
              roles.length ? "Ningún rol coincide" : "Sin roles todavía"
            }}</strong>
            <span>{{
              roles.length
                ? "Prueba con otro nombre o código."
                : "Crea el primer rol técnico para esta aplicación."
            }}</span>
            <button
              v-if="!roles.length"
              class="text-action"
              type="button"
              @click="openCreate"
            >
              Crear el primero
            </button>
          </div>
          <footer
            v-if="filteredRoles.length > ROLE_PAGE_SIZE"
            class="rail-pager"
          >
            <button
              type="button"
              :disabled="rolePage === 1"
              aria-label="Página anterior de roles"
              @click="rolePage = rolePage - 1"
            >
              <Icon name="chevron-left" :size="14" />
            </button>
            <span>{{ rangeLabel(rolePage, ROLE_PAGE_SIZE, filteredRoles.length) }}</span>
            <button
              type="button"
              :disabled="rolePage === roleTotalPages"
              aria-label="Página siguiente de roles"
              @click="rolePage = rolePage + 1"
            >
              <Icon name="chevron-right" :size="14" />
            </button>
          </footer>
        </template>
      </aside>

      <section class="role-workspace" aria-live="polite">
        <div v-if="createOpen" class="create-panel">
          <header class="create-head">
            <div>
              <h2>Definir rol técnico</h2>
            </div>
            <button
              class="icon-action"
              type="button"
              aria-label="Cerrar formulario de creación"
              :disabled="creating"
              @click="closeCreate"
            >
              <Icon name="close" :size="16" />
            </button>
          </header>
          <form class="create-form" @submit.prevent="submitCreate">
            <div class="create-meta">
              <label class="field">
                <span>Código técnico</span>
                <input
                  ref="createCodeInput"
                  v-model="createForm.code"
                  placeholder="PROJECT_READ_CLIENT"
                  autocomplete="off"
                  spellcheck="false"
                  :aria-invalid="codeTaken"
                />
                <small v-if="codeTaken" class="field-error"
                  >Ya existe un rol con este código en la aplicación.</small
                >
                <small v-else>Identificador estable que usan los servicios.</small>
              </label>
              <label class="field">
                <span>Nombre visible</span>
                <input
                  v-model="createForm.name"
                  placeholder="Consulta de proyectos"
                  autocomplete="off"
                />
                <small>Etiqueta legible para el equipo.</small>
              </label>
            </div>
            <section class="create-resources">
              <header class="create-resources-head">
                <div>
                  <h3>Recursos iniciales</h3>
                  <p>
                    El rol se crea con al menos un recurso. Puedes ajustarlo
                    después.
                  </p>
                </div>
                <span class="selection-count">
                  {{ createSelected.size }}
                  {{ plural(createSelected.size, "seleccionado", "seleccionados") }}
                </span>
              </header>
              <div class="resource-filters">
                <label class="search-field">
                  <Icon name="search" :size="15" aria-hidden="true" />
                  <input
                    v-model="createQuery"
                    type="search"
                    placeholder="Filtrar por ruta o método"
                    aria-label="Filtrar recursos iniciales"
                  />
                </label>
                <div class="method-filter" role="group" aria-label="Método HTTP">
                  <button
                    type="button"
                    :class="{ active: createMethod === '' }"
                    @click="createMethod = ''"
                  >
                    Todos
                  </button>
                  <button
                    v-for="method in METHODS"
                    :key="method"
                    type="button"
                    :class="[
                      `method-${method.toLowerCase()}`,
                      { active: createMethod === method },
                    ]"
                    @click="createMethod = method"
                  >
                    {{ method }}
                  </button>
                </div>
              </div>
              <div v-if="visibleCreateResources.length" class="resource-list">
                <div class="resource-list-head">
                  <label class="check-cell">
                    <input
                      type="checkbox"
                      :checked="allCreateVisibleSelected"
                      aria-label="Seleccionar todos los recursos visibles"
                      @change="toggleCreatePage"
                    />
                  </label>
                  <span>Recurso</span>
                  <span class="align-end">Selección</span>
                </div>
                <label
                  v-for="resource in visibleCreateResources"
                  :key="resource.id"
                  :class="[
                    'resource-row',
                    { selected: createSelected.has(resource.id) },
                  ]"
                >
                  <span class="check-cell">
                    <input
                      type="checkbox"
                      :checked="createSelected.has(resource.id)"
                      @change="toggleCreate(resource.id)"
                    />
                  </span>
                  <span class="resource-main">
                    <code :class="`method-${resource.method.toLowerCase()}`">{{
                      resource.method
                    }}</code>
                    <span class="resource-path">{{ resource.path }}</span>
                  </span>
                  <span class="resource-action">
                    {{
                      createSelected.has(resource.id) ? "Incluido" : "Incluir"
                    }}
                  </span>
                </label>
              </div>
              <div v-else class="resource-empty">
                <strong>Sin recursos para este filtro</strong>
                <span>Prueba con otra ruta o método.</span>
                <button
                  class="text-action"
                  type="button"
                  @click="clearCreateFilters"
                >
                  Limpiar filtros
                </button>
              </div>
              <footer
                v-if="createResources.length > CREATE_PAGE_SIZE"
                class="column-pager"
              >
                <span
                  >{{
                    rangeLabel(
                      createPage,
                      CREATE_PAGE_SIZE,
                      createResources.length,
                    )
                  }}</span
                >
                <div>
                  <button
                    type="button"
                    :disabled="createPage === 1"
                    aria-label="Página anterior de recursos"
                    @click="createPage = createPage - 1"
                  >
                    <Icon name="chevron-left" :size="14" />
                  </button>
                  <button
                    type="button"
                    :disabled="createPage === createTotalPages"
                    aria-label="Página siguiente de recursos"
                    @click="createPage = createPage + 1"
                  >
                    <Icon name="chevron-right" :size="14" />
                  </button>
                </div>
              </footer>
            </section>
            <footer class="create-footer">
              <p
                :class="[
                  'create-hint',
                  {
                    'has-error':
                      createAttempted && !!createHint && !creating,
                  },
                ]"
              >
                <template v-if="creating">Creando el rol…</template>
                <template v-else-if="createHint">{{ createHint }}</template>
                <template v-else>Todo listo para crear el rol.</template>
              </p>
              <div class="create-actions">
                <button
                  class="ghost-action"
                  type="button"
                  :disabled="creating"
                  @click="closeCreate"
                >
                  Cancelar
                </button>
                <button
                  class="create-action"
                  type="submit"
                  :disabled="!canCreate"
                >
                  <Icon name="plus" :size="15" />
                  {{ creating ? "Creando…" : "Crear rol" }}
                </button>
              </div>
            </footer>
          </form>
        </div>

        <div
          v-else-if="loadingApp"
          class="workspace-loading"
          aria-busy="true"
        >
          <span class="skeleton-line title" />
          <span class="skeleton-line short" />
          <div class="skeleton-columns">
            <span class="skeleton-block" />
            <span class="skeleton-block" />
          </div>
        </div>

        <div v-else-if="!selectedRole" class="workspace-empty">
          <span class="empty-icon"><Icon name="key" :size="24" /></span>
          <strong>Esta aplicación no tiene roles técnicos</strong>
          <p>
            Agrupa recursos con permisos afines en un rol y reutilízalo al
            solicitar acceso como identidad de servicio.
          </p>
          <button class="create-action" type="button" @click="openCreate">
            <Icon name="plus" :size="15" />Crear el primer rol
          </button>
        </div>

        <div v-else class="role-detail">
          <header class="role-detail-head">
            <div class="role-title">
              <h2>{{ selectedRole.name }}</h2>
              <div class="role-code-line">
                <code>{{ selectedRole.code }}</code>
                <button
                  class="copy-action"
                  type="button"
                  :aria-label="`Copiar código ${selectedRole.code}`"
                  @click="copySelectedCode"
                >
                  <Icon
                    :name="copiedRoleId === selectedRole.id ? 'check' : 'copy'"
                    :size="14"
                  />
                  {{
                    copiedRoleId === selectedRole.id ? "Copiado" : "Copiar"
                  }}
                </button>
              </div>
            </div>
            <div class="role-summary">
              <div>
                <span>Recursos asociados</span>
                <strong>{{ selectedSet.size }}</strong>
              </div>
              <div>
                <span>Catálogo de la aplicación</span>
                <strong>{{ resources.length }}</strong>
              </div>
              <div>
                <span>Cobertura</span>
                <strong>{{ coverage }}%</strong>
              </div>
            </div>
          </header>

          <div class="coverage-bar" aria-hidden="true">
            <span :style="{ width: `${coverage}%` }" />
          </div>

          <div
            v-if="loadingAssigned.has(selectedRole.id)"
            class="workspace-loading assigned-loading"
            aria-busy="true"
          >
            <span class="skeleton-line title" />
            <span class="skeleton-line short" />
            <div class="skeleton-columns">
              <span class="skeleton-block" />
              <span class="skeleton-block" />
            </div>
          </div>

          <template v-else>
          <div class="resource-filters workspace-filters">
            <label class="search-field">
              <Icon name="search" :size="15" aria-hidden="true" />
              <input
                v-model="resourceQuery"
                type="search"
                placeholder="Filtrar por ruta o método"
                aria-label="Filtrar recursos del rol"
              />
            </label>
            <div class="method-filter" role="group" aria-label="Método HTTP">
              <button
                type="button"
                :class="{ active: methodFilter === '' }"
                @click="methodFilter = ''"
              >
                Todos
              </button>
              <button
                v-for="method in METHODS"
                :key="method"
                type="button"
                :class="[
                  `method-${method.toLowerCase()}`,
                  { active: methodFilter === method },
                ]"
                @click="methodFilter = method"
              >
                {{ method }}
              </button>
            </div>
          </div>

          <div class="mobile-tabs" role="tablist" aria-label="Recursos del rol">
            <button
              type="button"
              role="tab"
              :aria-selected="mobileColumn === 'assigned'"
              :class="{ active: mobileColumn === 'assigned' }"
              @click="mobileColumn = 'assigned'"
            >
              Asignados
              <span>{{ allAssigned.length }}</span>
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="mobileColumn === 'available'"
              :class="{ active: mobileColumn === 'available' }"
              @click="mobileColumn = 'available'"
            >
              Disponibles
              <span>{{ allAvailable.length }}</span>
            </button>
          </div>

          <div
            class="transfer"
            :class="{ 'is-dragging': !!dragging }"
            :aria-busy="bulkBusy"
          >
            <section
              class="transfer-column assigned-column"
              :class="{
                'mobile-hidden': mobileColumn !== 'assigned',
                'is-drag-over': dragOverZone === 'assigned',
                'is-drop-ready': canDropOnZone('assigned'),
              }"
              aria-label="Recursos asignados al rol"
              @dragover="onZoneDragOver($event, 'assigned')"
              @dragleave="onZoneDragLeave($event, 'assigned')"
              @drop="onZoneDrop($event, 'assigned')"
            >
              <header class="column-head">
                <div>
                  <h3>Asignados</h3>
                  <span
                    >{{ assignedResources.length }}
                    {{ plural(assignedResources.length, "recurso", "recursos") }}</span
                  >
                </div>
                <button
                  v-if="hasFilters"
                  class="text-action"
                  type="button"
                  @click="clearFilters"
                >
                  Limpiar filtros
                </button>
              </header>
              <div v-if="assignedResources.length" class="resource-list">
                <div class="resource-list-head">
                  <label class="check-cell">
                    <input
                      type="checkbox"
                      :checked="allAssignedVisibleSelected"
                      aria-label="Seleccionar todos los recursos asignados visibles"
                      @change="toggleAssignedPage"
                    />
                  </label>
                  <span>Recurso</span>
                  <span class="align-end">Acción</span>
                </div>
                <div
                  v-for="resource in visibleAssigned"
                  :key="resource.id"
                  :class="[
                    'resource-row',
                    { selected: assignedSelected.has(resource.id) },
                  ]"
                  :draggable="!isSavingSelected(resource.id) && !bulkBusy"
                  :title="
                    isSavingSelected(resource.id) || bulkBusy
                      ? undefined
                      : 'Arrastra para quitar del rol'
                  "
                  @dragstart="startDrag($event, resource, 'assigned')"
                  @dragend="endDrag"
                >
                  <label class="check-cell">
                    <input
                      type="checkbox"
                      :checked="assignedSelected.has(resource.id)"
                      @change="
                        assignedSelected = toggleSelection(
                          assignedSelected,
                          resource.id,
                        )
                      "
                    />
                  </label>
                  <span class="resource-main">
                    <code :class="`method-${resource.method.toLowerCase()}`">{{
                      resource.method
                    }}</code>
                    <span class="resource-path">{{ resource.path }}</span>
                  </span>
                  <span class="resource-action">
                    <span v-if="isSavingSelected(resource.id)" class="saving">
                      <span class="spinner" aria-hidden="true" />Quitando
                    </span>
                    <button
                      v-else
                      class="remove-action"
                      type="button"
                      :disabled="bulkBusy"
                      @click="unassignFromSelected(resource)"
                    >
                      Quitar
                    </button>
                  </span>
                </div>
              </div>
              <div v-else class="resource-empty">
                <strong>{{
                  hasFilters
                    ? "Ningún asignado coincide"
                    : "Este rol no tiene recursos"
                }}</strong>
                <span>{{
                  hasFilters
                    ? "Ajusta el filtro para ver otros recursos."
                    : "Arrastra recursos desde la columna Disponibles."
                }}</span>
                <button
                  v-if="hasFilters"
                  class="text-action"
                  type="button"
                  @click="clearFilters"
                >
                  Limpiar filtros
                </button>
              </div>
              <footer
                v-if="assignedResources.length > RESOURCE_PAGE_SIZE"
                class="column-pager"
              >
                <span
                  >{{
                    rangeLabel(
                      assignedPage,
                      RESOURCE_PAGE_SIZE,
                      assignedResources.length,
                    )
                  }}</span
                >
                <div>
                  <button
                    type="button"
                    :disabled="assignedPage === 1"
                    aria-label="Página anterior de asignados"
                    @click="assignedPage = assignedPage - 1"
                  >
                    <Icon name="chevron-left" :size="14" />
                  </button>
                  <button
                    type="button"
                    :disabled="assignedPage === assignedTotalPages"
                    aria-label="Página siguiente de asignados"
                    @click="assignedPage = assignedPage + 1"
                  >
                    <Icon name="chevron-right" :size="14" />
                  </button>
                </div>
              </footer>
              <div
                v-if="canDropOnZone('assigned')"
                class="drop-placeholder"
                aria-hidden="true"
              >
                <Icon name="grip" :size="16" />
                Suelta para asignar a este rol
              </div>
            </section>

            <section
              class="transfer-column available-column"
              :class="{
                'mobile-hidden': mobileColumn !== 'available',
                'is-drag-over': dragOverZone === 'available',
                'is-drop-ready': canDropOnZone('available'),
              }"
              aria-label="Recursos disponibles de la aplicación"
              @dragover="onZoneDragOver($event, 'available')"
              @dragleave="onZoneDragLeave($event, 'available')"
              @drop="onZoneDrop($event, 'available')"
            >
              <header class="column-head">
                <div>
                  <h3>Disponibles</h3>
                  <span
                    >{{ availableResources.length }}
                    {{ plural(availableResources.length, "recurso", "recursos") }}</span
                  >
                </div>
                <button
                  v-if="hasFilters"
                  class="text-action"
                  type="button"
                  @click="clearFilters"
                >
                  Limpiar filtros
                </button>
              </header>
              <div v-if="availableResources.length" class="resource-list">
                <div class="resource-list-head">
                  <label class="check-cell">
                    <input
                      type="checkbox"
                      :checked="allAvailableVisibleSelected"
                      aria-label="Seleccionar todos los recursos disponibles visibles"
                      @change="toggleAvailablePage"
                    />
                  </label>
                  <span>Recurso</span>
                  <span class="align-end">Acción</span>
                </div>
                <div
                  v-for="resource in visibleAvailable"
                  :key="resource.id"
                  :class="[
                    'resource-row',
                    { selected: availableSelected.has(resource.id) },
                  ]"
                  :draggable="!isSavingSelected(resource.id) && !bulkBusy"
                  :title="
                    isSavingSelected(resource.id) || bulkBusy
                      ? undefined
                      : 'Arrastra para asignar a este rol'
                  "
                  @dragstart="startDrag($event, resource, 'available')"
                  @dragend="endDrag"
                >
                  <label class="check-cell">
                    <input
                      type="checkbox"
                      :checked="availableSelected.has(resource.id)"
                      @change="
                        availableSelected = toggleSelection(
                          availableSelected,
                          resource.id,
                        )
                      "
                    />
                  </label>
                  <span class="resource-main">
                    <code :class="`method-${resource.method.toLowerCase()}`">{{
                      resource.method
                    }}</code>
                    <span class="resource-path">{{ resource.path }}</span>
                  </span>
                  <span class="resource-action">
                    <span v-if="isSavingSelected(resource.id)" class="saving">
                      <span class="spinner" aria-hidden="true" />Añadiendo
                    </span>
                    <button
                      v-else
                      class="add-action"
                      type="button"
                      :disabled="bulkBusy"
                      @click="assignToSelected(resource)"
                    >
                      Añadir
                    </button>
                  </span>
                </div>
              </div>
              <div v-else class="resource-empty">
                <strong>{{
                  hasFilters
                    ? "Ningún disponible coincide"
                    : "Todos los recursos ya están asignados"
                }}</strong>
                <span>{{
                  hasFilters
                    ? "Ajusta el filtro para ver otros recursos."
                    : "Quita recursos del rol para devolverlos al catálogo."
                }}</span>
                <button
                  v-if="hasFilters"
                  class="text-action"
                  type="button"
                  @click="clearFilters"
                >
                  Limpiar filtros
                </button>
              </div>
              <footer
                v-if="availableResources.length > RESOURCE_PAGE_SIZE"
                class="column-pager"
              >
                <span
                  >{{
                    rangeLabel(
                      availablePage,
                      RESOURCE_PAGE_SIZE,
                      availableResources.length,
                    )
                  }}</span
                >
                <div>
                  <button
                    type="button"
                    :disabled="availablePage === 1"
                    aria-label="Página anterior de disponibles"
                    @click="availablePage = availablePage - 1"
                  >
                    <Icon name="chevron-left" :size="14" />
                  </button>
                  <button
                    type="button"
                    :disabled="availablePage === availableTotalPages"
                    aria-label="Página siguiente de disponibles"
                    @click="availablePage = availablePage + 1"
                  >
                    <Icon name="chevron-right" :size="14" />
                  </button>
                </div>
              </footer>
              <div
                v-if="canDropOnZone('available')"
                class="drop-placeholder"
                aria-hidden="true"
              >
                <Icon name="grip" :size="16" />
                Suelta para retirar recursos del rol
              </div>
            </section>
          </div>

          <footer
            class="bulk-bar"
            :class="{ 'is-idle': !assignedSelected.size && !availableSelected.size }"
            aria-live="polite"
          >
            <span class="bulk-selection">
              <template v-if="assignedSelected.size || availableSelected.size">
                {{ assignedSelected.size + availableSelected.size }}
                {{
                  plural(
                    assignedSelected.size + availableSelected.size,
                    "recurso seleccionado",
                    "recursos seleccionados",
                  )
                }}
              </template>
              <template v-else>Selecciona recursos para actuar en lote</template>
            </span>
            <span class="bulk-actions">
              <button
                v-if="assignedSelected.size"
                class="remove-action"
                type="button"
                :disabled="bulkBusy"
                @click="unassignSelected"
              >
                Quitar {{ assignedSelected.size }}
                {{ plural(assignedSelected.size, "recurso", "recursos") }}
              </button>
              <button
                v-if="availableSelected.size"
                class="add-action"
                type="button"
                :disabled="bulkBusy"
                @click="assignSelected"
              >
                Añadir {{ availableSelected.size }}
                {{ plural(availableSelected.size, "recurso", "recursos") }}
              </button>
            </span>
          </footer>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>
<style scoped>
.technical-roles {
  display: grid;
  gap: 18px;
  min-width: 0;
}
.technical-roles ::selection {
  background: var(--green-wash);
  color: var(--ink);
}
.technical-roles :is(button, a, select, input[type="checkbox"]):focus-visible {
  outline: 2px solid var(--green);
  outline-offset: 2px;
}
.technical-roles input {
  caret-color: var(--green);
}
.technical-roles .role-list {
  scrollbar-width: thin;
  scrollbar-color: rgba(17, 19, 18, 0.18) transparent;
}
.technical-roles .role-metrics b,
.technical-roles .role-count,
.technical-roles .role-summary strong,
.technical-roles .selection-count,
.technical-roles .rail-pager,
.technical-roles .column-pager,
.technical-roles .coverage-bar {
  font-variant-numeric: tabular-nums;
}

.role-toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.role-toolbar-start {
  display: flex;
  align-items: flex-end;
  gap: 22px;
  flex-wrap: wrap;
}
.app-field {
  display: grid;
  gap: 6px;
}
.app-field > span {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text);
  font-weight: 600;
}
.app-field select {
  height: 38px;
  min-width: 250px;
  max-width: 340px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--paper);
  padding: 0 32px 0 10px;
  font: 13px "IBM Plex Sans", sans-serif;
  color: var(--ink);
}
.role-metrics {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 8px;
  font-size: 11px;
  color: var(--text);
  white-space: nowrap;
}
.role-metrics b {
  font: 600 14px "IBM Plex Mono", monospace;
  color: var(--ink);
  margin-right: 3px;
}
.role-metrics i {
  width: 1px;
  height: 14px;
  background: var(--line);
}
.role-toolbar-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.refresh-action,
.create-action,
.ghost-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  padding: 0 13px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 150ms ease,
    border-color 150ms ease,
    color 150ms ease,
    opacity 150ms ease;
}
.refresh-action {
  border: 1px solid var(--line);
  background: var(--paper);
  color: var(--text);
}
.refresh-action:hover:not(:disabled) {
  border-color: var(--ink);
  color: var(--ink);
}
.create-action {
  border: 1px solid #01884f;
  background: #01884f;
  color: #fff;
}
.create-action:hover:not(:disabled) {
  background: #017f47;
  border-color: #017f47;
}
.ghost-action {
  border: 1px solid var(--line);
  background: var(--paper);
  color: var(--text);
}
.ghost-action:hover:not(:disabled) {
  border-color: var(--ink);
  color: var(--ink);
}
.refresh-action:disabled,
.create-action:disabled,
.ghost-action:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.workbench-hint {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: -4px 0 0;
  font-size: 11px;
  color: var(--text);
}
.workbench-hint svg {
  color: var(--green);
  flex: none;
}

.workbench {
  display: grid;
  grid-template-columns: 318px minmax(0, 1fr);
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--paper);
  overflow: hidden;
  min-height: 640px;
}

.role-rail {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-right: 1px solid var(--line);
  background: var(--canvas);
}
.rail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 16px 16px 10px;
}
.rail-header h2 {
  margin: 0 0 3px;
  font-size: 13px;
  letter-spacing: -0.01em;
}
.rail-header span {
  font-size: 11px;
  color: var(--text);
}
.search-field.rail-search {
  flex: none;
  margin: 0 16px 10px;
}
.role-list {
  display: grid;
  align-content: start;
  gap: 4px;
  margin: 0;
  padding: 0 10px 10px;
  list-style: none;
  overflow-y: auto;
}
.role-tile {
  display: grid;
  gap: 5px;
  width: 100%;
  padding: 10px 10px 9px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition:
    background 120ms ease,
    border-color 120ms ease,
    box-shadow 120ms ease;
}
.role-tile:hover:not(:disabled) {
  background: var(--paper);
  border-color: var(--soft-line);
}
.role-tile:focus-visible {
  outline: 2px solid var(--green);
  outline-offset: 1px;
}
.role-tile.selected {
  background: var(--paper);
  border-color: rgba(1, 139, 81, 0.32);
  box-shadow: 0 1px 2px rgba(17, 19, 18, 0.05);
}
.role-tile:disabled {
  cursor: default;
  opacity: 0.5;
}
.role-tile.create-card {
  border-style: dashed;
  border-color: var(--green);
  background: var(--green-wash);
  opacity: 1;
}
.role-tile-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}
.role-tile-top code {
  font: 500 10px "IBM Plex Mono", monospace;
  color: var(--green-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.role-tile strong {
  font-size: 12.5px;
  line-height: 1.3;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.role-tile-meta {
  font-size: 10.5px;
  color: var(--text);
}
.role-create-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--green-ink);
  font-weight: 600;
}
.role-count {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex: none;
  font: 500 10px "IBM Plex Mono", monospace;
  color: var(--text);
  background: var(--field);
  border: 1px solid var(--soft-line);
  border-radius: 20px;
  padding: 1px 6px;
}
.role-tile.selected .role-count {
  color: var(--green-ink);
  background: var(--green-tint);
  border-color: rgba(1, 139, 81, 0.18);
}
.role-tile.is-drop-ready {
  border-style: dashed;
  border-color: var(--green);
  background: var(--paper);
}
.role-tile.is-drag-over {
  border-color: var(--green);
  background: var(--green-wash);
  box-shadow: inset 0 0 0 1px var(--green);
}
.role-tile.is-contained {
  cursor: not-allowed;
}
.drop-label {
  color: var(--green-ink);
  font-weight: 600;
}
.contained-label {
  color: var(--text);
  font-weight: 500;
}
.rail-empty {
  display: grid;
  gap: 4px;
  padding: 20px 16px;
  text-align: center;
  justify-items: center;
}
.rail-empty strong {
  font-size: 12px;
}
.rail-empty span {
  font-size: 11px;
  color: var(--text);
}
.rail-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  padding: 10px 16px;
  border-top: 1px solid var(--soft-line);
  font-size: 10.5px;
  color: var(--text);
}
.rail-pager button,
.column-pager button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--paper);
  color: var(--text);
  cursor: pointer;
}
.rail-pager button:hover:not(:disabled),
.column-pager button:hover:not(:disabled) {
  border-color: var(--ink);
  color: var(--ink);
}
.rail-pager button:disabled,
.column-pager button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.role-workspace {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 18px 20px 20px;
  background: var(--paper);
}

.role-detail {
  display: grid;
  gap: 14px;
  min-width: 0;
}
.role-detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}
.role-title {
  display: grid;
  gap: 5px;
  min-width: 0;
}
.role-title h2 {
  margin: 0;
  font-size: 19px;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.role-code-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.role-code-line code {
  font: 500 10.5px "IBM Plex Mono", monospace;
  color: var(--green-ink);
  background: var(--green-wash);
  border: 1px solid rgba(1, 139, 81, 0.14);
  border-radius: 4px;
  padding: 3px 6px;
}
.copy-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 10.5px;
  padding: 3px 4px;
  border-radius: 4px;
  cursor: pointer;
}
.copy-action:hover {
  color: var(--green-ink);
  background: var(--green-wash);
}
.role-summary {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}
.role-summary > div {
  display: grid;
  gap: 2px;
}
.role-summary span {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text);
  font-weight: 600;
}
.role-summary strong {
  font: 600 16px "IBM Plex Mono", monospace;
  color: var(--ink);
}
.coverage-bar {
  height: 4px;
  border-radius: 2px;
  background: var(--field);
  overflow: hidden;
}
.coverage-bar span {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: var(--green);
  transition: width 280ms ease;
}

.resource-filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.workspace-filters {
  padding-bottom: 2px;
}
.search-field {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  min-width: 190px;
  flex: 1 1 210px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--paper);
  padding: 0 9px;
  color: var(--text);
}
.search-field:focus-within {
  border-color: var(--green);
  box-shadow: 0 0 0 3px var(--green-wash);
}
.search-field svg {
  flex: none;
}
.search-field input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  font: 12px "IBM Plex Sans", sans-serif;
  color: var(--ink);
}
.search-field input::placeholder {
  color: var(--text);
}
.method-filter {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}
.method-filter button {
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--paper);
  color: var(--text);
  font: 600 10px "IBM Plex Mono", monospace;
  cursor: pointer;
}
.method-filter button:hover {
  border-color: var(--ink);
}
.method-filter button.active {
  border-color: var(--ink);
  background: var(--ink);
  color: #fff;
}

.mobile-tabs {
  display: none;
}

.transfer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}
.transfer-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--paper);
  overflow: hidden;
  transition:
    border-color 140ms ease,
    box-shadow 140ms ease,
    background 140ms ease;
}
.transfer-column.is-drop-ready {
  border-style: dashed;
  border-color: var(--green);
}
.transfer-column.is-drag-over {
  border-color: var(--green);
  box-shadow: 0 0 0 3px var(--green-wash);
  background: var(--green-wash);
}
.available-column {
  background: var(--canvas);
}
.column-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--soft-line);
  background: var(--paper);
}
.column-head h3 {
  margin: 0 0 1px;
  font-size: 12px;
  letter-spacing: -0.01em;
}
.column-head span {
  font-size: 10px;
  color: var(--text);
}
.resource-list {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.resource-list-head,
.resource-row {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) 82px;
  align-items: center;
  gap: 7px;
  padding: 8px 10px;
}
.resource-list-head {
  min-height: 32px;
  font-size: 10px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text);
  font-weight: 600;
  border-bottom: 1px solid var(--soft-line);
}
.resource-row {
  min-height: 42px;
  border-bottom: 1px solid var(--soft-line);
  transition: background 100ms ease;
}
.resource-row:last-of-type {
  border-bottom: 0;
}
.resource-row:hover {
  background: var(--green-wash);
}
.resource-row.selected {
  background: var(--green-wash);
}
.resource-row[draggable="true"] {
  cursor: grab;
}
.resource-row[draggable="true"]:active {
  cursor: grabbing;
}
.resource-main {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.resource-main code {
  flex: none;
  font: 600 10px "IBM Plex Mono", monospace;
  letter-spacing: 0.02em;
  padding: 3px 5px;
  border-radius: 3px;
  border: 1px solid transparent;
  min-width: 42px;
  text-align: center;
}
.resource-path {
  font: 11px "IBM Plex Mono", monospace;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.resource-action {
  display: flex;
  justify-content: flex-end;
  font-size: 10px;
  color: var(--text);
}
.align-end {
  text-align: right;
}
.check-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}
.check-cell input {
  width: 13px;
  height: 13px;
  margin: 0;
  accent-color: var(--green);
  cursor: pointer;
}
.add-action,
.remove-action {
  height: 24px;
  padding: 0 8px;
  border-radius: 4px;
  background: transparent;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.add-action {
  border: 1px solid rgba(1, 139, 81, 0.3);
  color: var(--green-ink);
}
.add-action:hover:not(:disabled) {
  background: var(--green-tint);
}
.remove-action {
  border: 1px solid var(--line);
  background: var(--paper);
  color: var(--text);
}
.remove-action:hover:not(:disabled) {
  border-color: rgba(185, 61, 60, 0.4);
  background: rgba(185, 61, 60, 0.06);
  color: var(--red);
}
.add-action:disabled,
.remove-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.saving {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text);
}
.spinner {
  width: 9px;
  height: 9px;
  border: 1.5px solid var(--line);
  border-top-color: var(--green);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
.drop-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px;
  border-top: 1px dashed var(--green);
  background: var(--green-wash);
  color: var(--green-ink);
  font-size: 10px;
  font-weight: 600;
}
.column-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-top: 1px solid var(--soft-line);
  font-size: 10px;
  color: var(--text);
  background: var(--paper);
}
.column-pager > div {
  display: flex;
  gap: 4px;
}
.resource-empty {
  display: grid;
  gap: 3px;
  justify-items: center;
  text-align: center;
  padding: 26px 14px;
}
.resource-empty strong {
  font-size: 11.5px;
}
.resource-empty span {
  font-size: 10.5px;
  color: var(--text);
}
.assigned-loading {
  margin-top: 4px;
}

.bulk-bar {
  position: sticky;
  bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: auto;
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--paper);
  box-shadow: 0 4px 14px rgba(17, 19, 18, 0.06);
  font-size: 11px;
  color: var(--text);
}
.bulk-bar.is-idle {
  box-shadow: none;
  background: var(--canvas);
}
.bulk-selection {
  font-weight: 500;
}
.bulk-actions {
  display: flex;
  gap: 6px;
}
.bulk-actions button {
  height: 27px;
}

.text-action {
  border: 0;
  background: transparent;
  color: var(--green-ink);
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 0;
  cursor: pointer;
}
.text-action:hover {
  text-decoration: underline;
}
.icon-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--paper);
  color: var(--text);
  cursor: pointer;
}
.icon-action:hover {
  border-color: var(--ink);
  color: var(--ink);
}

.create-panel {
  display: grid;
  gap: 16px;
}
.create-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.create-head h2 {
  margin: 3px 0 0;
  font-size: 19px;
  letter-spacing: -0.02em;
}
.create-form {
  display: grid;
  gap: 16px;
}
.create-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.field {
  display: grid;
  gap: 5px;
}
.field > span {
  font-size: 11px;
  font-weight: 600;
  color: var(--ink);
}
.field input {
  height: 36px;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 0 10px;
  font: 12px "IBM Plex Sans", sans-serif;
  color: var(--ink);
  background: var(--paper);
}
.field input:focus {
  outline: 0;
  border-color: var(--green);
  box-shadow: 0 0 0 3px var(--green-wash);
}
.field input[aria-invalid="true"] {
  border-color: var(--red);
}
.field small {
  font-size: 10px;
  color: var(--text);
}
.field-error {
  color: var(--red) !important;
}
.create-resources {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--canvas);
}
.create-resources-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.create-resources-head h3 {
  margin: 0 0 2px;
  font-size: 12px;
}
.create-resources-head p {
  margin: 0;
  font-size: 10.5px;
  color: var(--text);
}
.selection-count {
  flex: none;
  font: 600 10px "IBM Plex Mono", monospace;
  color: var(--green-ink);
  background: var(--paper);
  border: 1px solid rgba(1, 139, 81, 0.2);
  border-radius: 20px;
  padding: 3px 8px;
}
.create-resources .resource-list {
  border: 1px solid var(--soft-line);
  border-radius: 6px;
  background: var(--paper);
}
.create-resources .resource-row {
  cursor: pointer;
}
.create-resources .resource-action {
  font-size: 10px;
  font-weight: 600;
  color: var(--gold, var(--text));
}
.create-resources .resource-row.selected .resource-action {
  color: var(--green-ink);
}
.create-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 4px;
}
.create-hint {
  margin: 0;
  font-size: 10.5px;
  color: var(--text);
}
.create-hint.has-error {
  color: var(--red);
}
.create-actions {
  display: flex;
  gap: 7px;
}

.app-empty,
.workspace-empty {
  display: grid;
  gap: 6px;
  justify-items: center;
  text-align: center;
  padding: 46px 24px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--paper);
}
.workspace-empty {
  border: 0;
  margin: auto;
}
.empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--green-wash);
  color: var(--green-ink);
  margin-bottom: 4px;
}
.app-empty strong,
.workspace-empty strong {
  font-size: 14px;
}
.app-empty p,
.workspace-empty p {
  max-width: 390px;
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--text);
}

.workbench-skeleton {
  display: grid;
  grid-template-columns: 318px minmax(0, 1fr);
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
  min-height: 620px;
}
.skeleton-rail {
  display: grid;
  align-content: start;
  gap: 8px;
  padding: 20px 16px;
  border-right: 1px solid var(--line);
  background: var(--canvas);
}
.skeleton-workspace {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 22px 20px;
}
.workspace-loading {
  display: grid;
  gap: 12px;
  align-content: start;
}
.rail-skeleton {
  display: grid;
  gap: 8px;
  padding: 0 16px;
}
.skeleton-line {
  display: block;
  height: 12px;
  border-radius: 3px;
  background: var(--field);
  animation: shimmer 1.4s ease-in-out infinite;
}
.skeleton-line.short {
  width: 45%;
}
.skeleton-line.title {
  width: 38%;
  height: 20px;
}
.skeleton-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 4px;
}
.skeleton-block {
  display: block;
  height: 230px;
  border-radius: 8px;
  background: var(--field);
  animation: shimmer 1.4s ease-in-out infinite;
}
@keyframes shimmer {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.method-get {
  color: var(--green-ink);
  background: var(--green-tint);
  border-color: rgba(1, 139, 81, 0.2);
}
.method-post {
  color: #1f5f9e;
  background: rgba(31, 95, 158, 0.07);
  border-color: rgba(31, 95, 158, 0.18);
}
.method-put,
.method-patch {
  color: #8f5d12;
  background: rgba(155, 104, 24, 0.07);
  border-color: rgba(155, 104, 24, 0.17);
}
.method-delete {
  color: var(--red);
  background: rgba(185, 61, 60, 0.07);
  border-color: rgba(185, 61, 60, 0.17);
}
.method-filter button.method-get.active {
  background: var(--green-ink);
  border-color: var(--green-ink);
}
.method-filter button.method-post.active {
  background: #1f5f9e;
  border-color: #1f5f9e;
}
.method-filter button.method-put.active,
.method-filter button.method-patch.active {
  background: #8f5d12;
  border-color: #8f5d12;
}
.method-filter button.method-delete.active {
  background: var(--red);
  border-color: var(--red);
}

@media (max-width: 1020px) {
  .workbench {
    grid-template-columns: 280px minmax(0, 1fr);
  }
  .workbench-skeleton {
    grid-template-columns: 280px minmax(0, 1fr);
  }
  .role-summary {
    gap: 13px;
  }
}

@media (max-width: 860px) {
  .workbench,
  .workbench-skeleton {
    grid-template-columns: 1fr;
  }
  .role-rail {
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
  .role-list {
    display: flex;
    overflow-x: auto;
    padding-bottom: 12px;
    scroll-snap-type: x proximity;
  }
  .role-list li {
    flex: 0 0 218px;
    scroll-snap-align: start;
  }
  .rail-pager {
    margin-top: 0;
  }
  .role-workspace {
    padding: 16px 14px;
  }
  .mobile-tabs {
    display: flex;
    gap: 4px;
    padding: 3px;
    border-radius: 6px;
    background: var(--field);
  }
  .mobile-tabs button {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 30px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--text);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }
  .mobile-tabs button span {
    font: 500 10px "IBM Plex Mono", monospace;
    background: var(--paper);
    border-radius: 20px;
    padding: 1px 5px;
  }
  .mobile-tabs button.active {
    background: var(--paper);
    color: var(--ink);
    box-shadow: 0 1px 2px rgba(17, 19, 18, 0.07);
  }
  .transfer {
    grid-template-columns: 1fr;
  }
  .transfer-column.mobile-hidden {
    display: none;
  }
  .skeleton-columns {
    grid-template-columns: 1fr;
  }
  .skeleton-block:last-child {
    display: none;
  }
}

@media (max-width: 600px) {
  .role-toolbar {
    align-items: stretch;
  }
  .role-toolbar-start {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .role-metrics {
    padding-bottom: 0;
  }
  .app-field select {
    min-width: 0;
    width: 100%;
    max-width: none;
  }
  .role-toolbar-actions button {
    flex: 1;
  }
  .create-meta {
    grid-template-columns: 1fr;
  }
  .role-detail-head {
    gap: 12px;
  }
  .role-summary {
    width: 100%;
    justify-content: space-between;
  }
  .resource-list-head,
  .resource-row {
    grid-template-columns: 24px minmax(0, 1fr) 74px;
    padding: 8px;
  }
  .resource-path {
    font-size: 10px;
  }
  .create-resources {
    padding: 10px 8px;
  }
  .bulk-bar {
    position: static;
    bottom: auto;
  }
}
@media (prefers-reduced-motion: reduce) {
  .technical-roles *,
  .technical-roles *::before,
  .technical-roles *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
