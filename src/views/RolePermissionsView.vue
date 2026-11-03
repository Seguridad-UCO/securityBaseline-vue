<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { listApplicationSecurityResources, syncRoleResources } from "../api";
import type { HttpMethod, Resource, Role } from "../api/contracts";
import DataPanel from "../components/DataPanel.vue";
import Icon from "../components/Icon.vue";
import { useMutation } from "../composables/useMutation";
import { useCatalogsStore } from "../stores/catalogs";

const catalogs = useCatalogsStore();
const route = useRoute(), router = useRouter();

const applicationId = ref(String(route.query.applicationId || ""));
const roleId = ref(String(route.query.roleId || ""));
const query = ref(""), method = ref<"" | HttpMethod>("");
const resourcesPage = ref(0), resourcesTotal = ref(0), pagedResources = ref<Resource[]>([]);
const pageSize = ref(20);
const selected = ref(new Set<string>());
const touched = ref(false);
const justSaved = ref(false);
const draggingId = ref<string | null>(null);
const dragOver = ref<"available" | "assigned" | null>(null);
const announcement = ref("");
const { busy, error, run } = useMutation();

const METHODS: Array<"" | HttpMethod> = ["", "GET", "POST", "PUT", "PATCH", "DELETE"];
const applications = computed(() => catalogs.apps);
// Un rol de tenant puede administrarse desde cualquier aplicación; uno de aplicación
// solo aparece en su propia aplicación.
const availableRoles = computed(() => catalogs.roles.filter((role) =>
  role.scope !== "GLOBAL" && (!applicationId.value || role.scope === "TENANT" || role.applicationId === applicationId.value),
));
const role = computed<Role | undefined>(() => catalogs.roles.find((item) => item.id === roleId.value));
const protectedRole = computed(() => role.value?.name.trim().toUpperCase() === "ADMIN" && Boolean(role.value.applicationId));
const applicationResources = computed(() => pagedResources.value);
// Lo que ya está guardado en el rol para esta aplicación. `selected` es el borrador.
const granted = computed(() => new Set(role.value?.resourceIds || []));
const sortedResources = computed(() => applicationResources.value
  .slice()
  .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method)));
const matchesFilters = (resource: Resource) => {
  const haystack = `${resource.path} ${resource.method}`.toLowerCase();
  return (!query.value || haystack.includes(query.value.toLowerCase())) && (!method.value || resource.method === method.value);
};
const availableResources = computed(() => sortedResources.value.filter((resource) => !selected.value.has(resource.id) && matchesFilters(resource)));
const assignedResources = computed(() => sortedResources.value.filter((resource) => selected.value.has(resource.id) && matchesFilters(resource)));
const hasFilters = computed(() => Boolean(query.value || method.value));
const scopeLabel = computed(() => role.value?.scope === "TENANT" ? "Tenant" : "Aplicación");
const assignedCount = computed(() => selected.value.size);
const coverage = computed(() => resourcesTotal.value ? Math.round((assignedCount.value / resourcesTotal.value) * 100) : 0);
// Guardar solo tiene sentido si el borrador difiere de lo que ya está concedido.
const dirty = computed(() => {
  if (selected.value.size !== granted.value.size) return true;
  return [...selected.value].some((id) => !granted.value.has(id));
});
const added = computed(() => [...selected.value].filter((id) => !granted.value.has(id)).length);
const removed = computed(() => [...granted.value].filter((id) => !selected.value.has(id)).length);

// `seedSelection` refleja el estado guardado sin tocar el aviso de guardado. Sirve para
// sembrar el borrador cuando los catálogos terminan de cargar.
function seedSelection() {
  selected.value = new Set(granted.value);
  draggingId.value = null;
  dragOver.value = null;
  touched.value = false;
}
function resetSelection() {
  seedSelection();
  justSaved.value = false;
}
function resourceLabel(resourceId: string) {
  const resource = applicationResources.value.find((item) => item.id === resourceId);
  return resource ? `${resource.method} ${resource.path}` : "el recurso";
}
function assign(resourceId: string) {
  if (protectedRole.value || selected.value.has(resourceId)) return;
  const next = new Set(selected.value);
  next.add(resourceId);
  selected.value = next;
  touched.value = true;
  justSaved.value = false;
  announcement.value = `${resourceLabel(resourceId)} asignado al rol.`;
}
function unassign(resourceId: string) {
  if (protectedRole.value || !selected.value.has(resourceId)) return;
  const next = new Set(selected.value);
  next.delete(resourceId);
  selected.value = next;
  touched.value = true;
  justSaved.value = false;
  announcement.value = `${resourceLabel(resourceId)} retirado del rol.`;
}
function assignVisible() {
  if (protectedRole.value || !availableResources.value.length) return;
  const count = availableResources.value.length;
  const next = new Set(selected.value);
  availableResources.value.forEach((resource) => next.add(resource.id));
  selected.value = next;
  touched.value = true;
  justSaved.value = false;
  announcement.value = `${count} recursos asignados al rol.`;
}
function unassignVisible() {
  if (protectedRole.value || !assignedResources.value.length) return;
  const count = assignedResources.value.length;
  const next = new Set(selected.value);
  assignedResources.value.forEach((resource) => next.delete(resource.id));
  selected.value = next;
  touched.value = true;
  justSaved.value = false;
  announcement.value = `${count} recursos retirados del rol.`;
}
function startDrag(event: DragEvent, resourceId: string) {
  if (protectedRole.value) {
    event.preventDefault();
    return;
  }
  draggingId.value = resourceId;
  dragOver.value = null;
  event.dataTransfer?.setData("text/plain", resourceId);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
}
function endDrag() {
  draggingId.value = null;
  dragOver.value = null;
}
function enterColumn(column: "available" | "assigned", event: DragEvent) {
  if (!draggingId.value) return;
  event.preventDefault();
  dragOver.value = column;
}
function leaveColumn(column: "available" | "assigned", event: DragEvent) {
  const current = event.currentTarget as HTMLElement | null;
  const next = event.relatedTarget as Node | null;
  // dragleave también salta al pasar sobre los hijos de la columna.
  if (current && next && current.contains(next)) return;
  if (dragOver.value === column) dragOver.value = null;
}
function dropOn(column: "available" | "assigned", event: DragEvent) {
  event.preventDefault();
  const resourceId = draggingId.value || event.dataTransfer?.getData("text/plain") || "";
  if (!resourceId || protectedRole.value) return endDrag();
  if (column === "assigned") assign(resourceId);
  else unassign(resourceId);
  endDrag();
}
function clearFilters() {
  query.value = "";
  method.value = "";
}
async function loadResources() {
  if (!applicationId.value) { pagedResources.value = []; resourcesTotal.value = 0; return; }
  const response = await listApplicationSecurityResources(applicationId.value, { offset: resourcesPage.value * pageSize.value, limit: pageSize.value, query: query.value, method: method.value });
  pagedResources.value = response.data.content;
  resourcesTotal.value = response.data.total;
}
async function save() {
  if (!role.value || !applicationId.value || protectedRole.value || !dirty.value) return;
  const data = { applicationId: applicationId.value, resourceIds: [...selected.value] };
  if (await run(() => syncRoleResources(role.value!.id, data), "Los permisos del rol fueron actualizados.")) {
    seedSelection();
    justSaved.value = true;
  }
}

watch(applications, (apps) => {
  if (!apps.length) {
    // Mientras el catálogo carga se conserva la aplicación pedida en la URL.
    if (!catalogs.loading) applicationId.value = "";
    return;
  }
  if (apps.some((app) => app.id === applicationId.value)) return;
  // Si llega un rol de aplicación sin aplicación en la URL, se abre su contexto real.
  const preferred = role.value?.applicationId;
  applicationId.value = preferred && apps.some((app) => app.id === preferred) ? preferred : apps[0]!.id;
}, { immediate: true });
watch(availableRoles, (roles) => {
  if (!roles.length) {
    if (!catalogs.loading) roleId.value = "";
    return;
  }
  if (!roles.some((item) => item.id === roleId.value)) roleId.value = roles[0]!.id;
}, { immediate: true });
watch([applicationId, roleId], resetSelection, { immediate: true });
watch([applicationId, query, method], () => { resourcesPage.value = 0; void loadResources(); }, { immediate: true });
watch(resourcesPage, () => void loadResources());
watch(pageSize, () => { resourcesPage.value = 0; void loadResources(); });
// Si los catálogos terminan de cargar (o cambian fuera de esta vista) sin ediciones
// pendientes, el borrador sigue el estado guardado en lugar de quedarse vacío.
watch(granted, () => {
  if (!touched.value) seedSelection();
});
</script>

<template>
  <DataPanel
    title="Permisos del rol"
    :count="resourcesTotal"
    empty="Esta aplicación aún no tiene recursos. Regístralos primero en Recursos."
    show-content-when-empty
  >
    <div class="perm-context">
      <button class="back" type="button" aria-label="Volver al catálogo de roles" @click="router.push({ name: 'roles' })">
        <span class="back-arrow" aria-hidden="true">←</span> Volver al catálogo de roles
      </button>
      <div class="perm-context-grid">
        <label class="perm-field">
          <span>Aplicación</span>
          <select v-model="applicationId" aria-label="Aplicación">
            <option value="" disabled>Selecciona una aplicación</option>
            <option v-for="app in applications" :key="app.id" :value="app.id">{{ app.name }}</option>
          </select>
        </label>
        <label class="perm-field">
          <span>Rol</span>
          <select v-model="roleId" :disabled="!applicationId || !availableRoles.length" aria-label="Rol">
            <option v-if="!availableRoles.length" value="" disabled>No hay roles compatibles</option>
            <option v-for="item in availableRoles" :key="item.id" :value="item.id">{{ item.name }} · {{ item.scope === 'TENANT' ? 'Tenant' : 'Aplicación' }}</option>
          </select>
        </label>
        <div v-if="role" class="perm-role-card">
          <div class="perm-role-top">
            <span :class="['scope-pill', `scope-${role.scope.toLowerCase()}`]"><Icon name="key" :size="12" />{{ scopeLabel }}</span>
            <span class="perm-coverage">{{ assignedCount }}/{{ resourcesTotal }}</span>
          </div>
          <strong class="perm-role-name" :title="role.name">{{ role.name }}</strong>
          <div class="perm-meter" role="progressbar" :aria-valuenow="coverage" aria-valuemin="0" aria-valuemax="100" :aria-label="`Cobertura de recursos del rol ${role.name}`">
            <i :style="{ width: `${coverage}%` }" />
          </div>
          <small>{{ assignedCount }} de {{ resourcesTotal }} recursos con acceso</small>
        </div>
      </div>
    </div>

    <div class="perm-body">
      <p v-if="!applications.length" class="perm-alert info"><Icon name="apps" :size="14" />No hay aplicaciones registradas. Crea una aplicación y sus recursos para administrar permisos.</p>
      <p v-else-if="applicationId && !catalogs.loading && !availableRoles.length" class="perm-alert info"><Icon name="key" :size="14" />No hay roles compatibles con esta aplicación. Define uno en el catálogo de roles.</p>
      <p v-if="protectedRole" class="perm-alert bad"><Icon name="close" :size="14" />El rol ADMIN de la aplicación es de solo lectura: administra la aplicación y no se puede modificar.</p>
      <p v-if="error" class="perm-alert bad" role="alert"><Icon name="close" :size="14" />{{ error }}</p>

      <p class="perm-help"><Icon name="grip" :size="15" />Arrastra los recursos entre paneles para asignarlos o retirarlos. También puedes usar las flechas de cada recurso. Los cambios se aplican al guardar.</p>

      <div class="perm-toolbar">
        <div class="perm-search">
          <Icon name="search" :size="16" />
          <input v-model.trim="query" placeholder="Buscar por ruta o método" aria-label="Buscar recursos" autocomplete="off" />
          <button v-if="query" type="button" class="perm-clear" aria-label="Limpiar búsqueda" @click="query = ''">×</button>
        </div>
        <div class="perm-chips" role="group" aria-label="Filtrar por método">
          <button v-for="item in METHODS" :key="item || 'all'" type="button" :class="{ on: method === item }" :aria-pressed="method === item" @click="method = item">{{ item || 'Todos' }}</button>
        </div>
        <button v-if="hasFilters" type="button" class="perm-clear-filters" @click="clearFilters">Limpiar filtros</button>
      </div>

      <div class="perm-board" :aria-busy="busy">
        <section
          class="perm-column"
          :class="{ 'drop-active': draggingId && dragOver === 'available' }"
          @dragenter.prevent="enterColumn('available', $event)"
          @dragover.prevent
          @dragleave="leaveColumn('available', $event)"
          @drop.prevent="dropOn('available', $event)"
        >
          <header class="perm-column-head">
            <div class="perm-column-title">
              <span class="perm-column-icon"><Icon name="route" :size="15" /></span>
              <div class="perm-column-copy">
                <div class="perm-column-line">
                  <h3>Disponibles</h3>
                  <span class="perm-column-count">{{ availableResources.length }}</span>
                </div>
                <p class="perm-column-hint" :class="{ active: draggingId && dragOver === 'available' }">
                  {{ draggingId && dragOver === 'available' ? 'Suelta aquí para retirar el acceso' : hasFilters ? 'Recursos que coinciden y no están asignados' : 'Arrastra al panel derecho para asignar' }}
                </p>
              </div>
            </div>
            <button v-if="availableResources.length" class="perm-bulk" type="button" :disabled="protectedRole || busy" title="Asigna todos los recursos visibles" @click="assignVisible">Asignar visibles</button>
          </header>
          <div class="perm-list" role="list" aria-label="Recursos disponibles">
            <article
              v-for="resource in availableResources"
              :key="resource.id"
              class="perm-card"
              :class="{ 'is-dragging': draggingId === resource.id, 'pending-removal': granted.has(resource.id) }"
              role="listitem"
              :draggable="!protectedRole"
              @dragstart="startDrag($event, resource.id)"
              @dragend="endDrag"
            >
              <span class="perm-grip" aria-hidden="true"><Icon name="grip" :size="14" /></span>
              <span :class="['http-method', `method-${resource.method}`]">{{ resource.method }}</span>
              <code class="perm-path" :title="resource.path">{{ resource.path }}</code>
              <span v-if="granted.has(resource.id)" class="perm-tag removed">Se retira</span>
              <span v-else class="perm-tag" aria-hidden="true" />
              <button class="perm-move" type="button" :disabled="protectedRole || busy" :aria-label="`Asignar ${resource.method} ${resource.path} al rol`" :title="`Asignar ${resource.method} ${resource.path}`" @click="assign(resource.id)"><Icon name="arrow" :size="14" /></button>
            </article>
            <p v-if="!availableResources.length" class="perm-list-empty">
              <Icon name="check" :size="20" />
              <strong>{{ hasFilters ? 'Ningún recurso coincide' : 'Todo asignado' }}</strong>
              <span>{{ hasFilters ? 'Ajusta la búsqueda o el método para ver más recursos.' : applicationResources.length ? 'El rol ya tiene acceso a todos los recursos de la aplicación.' : 'No hay recursos registrados para esta aplicación.' }}</span>
            </p>
          </div>
        </section>

        <section
          class="perm-column assigned"
          :class="{ 'drop-active': draggingId && dragOver === 'assigned' }"
          @dragenter.prevent="enterColumn('assigned', $event)"
          @dragover.prevent
          @dragleave="leaveColumn('assigned', $event)"
          @drop.prevent="dropOn('assigned', $event)"
        >
          <header class="perm-column-head">
            <div class="perm-column-title">
              <span class="perm-column-icon"><Icon name="shield" :size="15" /></span>
              <div class="perm-column-copy">
                <div class="perm-column-line">
                  <h3>Asignados al rol</h3>
                  <span class="perm-column-count">{{ assignedResources.length }}</span>
                </div>
                <p class="perm-column-hint" :class="{ active: draggingId && dragOver === 'assigned' }">
                  {{ draggingId && dragOver === 'assigned' ? 'Suelta aquí para asignar el recurso' : hasFilters ? 'Permisos que coinciden con los filtros' : 'Arrastra al panel izquierdo o usa ← para retirar' }}
                </p>
              </div>
            </div>
            <button v-if="assignedResources.length" class="perm-bulk" type="button" :disabled="protectedRole || busy" title="Retira todos los recursos visibles" @click="unassignVisible">Retirar visibles</button>
          </header>
          <div class="perm-list" role="list" aria-label="Recursos asignados al rol">
            <article
              v-for="resource in assignedResources"
              :key="resource.id"
              class="perm-card assigned-card"
              :class="{ 'is-dragging': draggingId === resource.id, 'pending-add': !granted.has(resource.id) }"
              role="listitem"
              :draggable="!protectedRole"
              @dragstart="startDrag($event, resource.id)"
              @dragend="endDrag"
            >
              <span class="perm-grip" aria-hidden="true"><Icon name="grip" :size="14" /></span>
              <span :class="['http-method', `method-${resource.method}`]">{{ resource.method }}</span>
              <code class="perm-path" :title="resource.path">{{ resource.path }}</code>
              <span v-if="granted.has(resource.id)" class="perm-tag active">Asignado</span>
              <span v-else class="perm-tag new">Nuevo</span>
              <button class="perm-move back" type="button" :disabled="protectedRole || busy" :aria-label="`Retirar ${resource.method} ${resource.path} del rol`" :title="`Retirar ${resource.method} ${resource.path}`" @click="unassign(resource.id)"><Icon name="arrow" :size="14" /></button>
            </article>
            <p v-if="!assignedResources.length" class="perm-list-empty">
              <Icon name="key" :size="20" />
              <strong>{{ hasFilters ? 'Sin coincidencias' : applicationResources.length ? 'Aún no tiene permisos' : 'Sin recursos' }}</strong>
              <span>{{ hasFilters ? 'Ninguno de los permisos actuales coincide con los filtros.' : applicationResources.length ? 'Arrastra recursos aquí o usa la flecha → para conceder acceso.' : 'Registra los endpoints de la aplicación en Recursos.' }}</span>
            </p>
          </div>
        </section>
      </div>
    </div>

    <footer class="perm-footer" :class="{ dirty }">
      <div class="perm-status">
        <span class="perm-status-icon"><Icon :name="dirty ? 'edit' : 'check'" :size="15" /></span>
        <div class="perm-status-copy">
          <strong>{{ dirty ? 'Cambios sin guardar' : justSaved ? 'Cambios guardados' : 'Permisos al día' }}</strong>
          <small v-if="dirty">
            <span v-if="added" class="perm-delta add">+{{ added }} por asignar</span>
            <span v-if="added && removed"> · </span>
            <span v-if="removed" class="perm-delta remove">−{{ removed }} por retirar</span>
          </small>
          <small v-else-if="justSaved">Los permisos vigentes ya reflejan tu selección.</small>
          <small v-else>{{ assignedCount }} de {{ resourcesTotal }} recursos con acceso en esta aplicación.</small>
        </div>
      </div>
      <nav class="perm-pagination" aria-label="Paginación de recursos"><label>Mostrar <select v-model.number="pageSize"><option :value="10">10</option><option :value="20">20</option><option :value="50">50</option><option :value="100">100</option></select></label><button type="button" :disabled="resourcesPage === 0" @click="resourcesPage--">Anterior</button><span>Página <b>{{ resourcesPage + 1 }}</b> de {{ Math.max(1, Math.ceil(resourcesTotal / pageSize)) }}</span><button type="button" :disabled="(resourcesPage + 1) * pageSize >= resourcesTotal" @click="resourcesPage++">Siguiente</button></nav><div class="perm-footer-actions">
        <button class="cancel perm-discard" type="button" :disabled="!dirty || busy" @click="resetSelection"><Icon name="undo" :size="14" />Descartar</button>
        <button class="create-action perm-save" type="button" :disabled="busy || !roleId || !applicationId || protectedRole || !dirty" @click="save"><Icon name="check" :size="15" />{{ busy ? 'Guardando…' : 'Guardar cambios' }}</button>
      </div>
    </footer>

    <p class="sr-only" aria-live="polite">{{ announcement }}</p>
  </DataPanel>
</template>

<style scoped>
.perm-context { display: grid; gap: 15px; padding: 18px 26px 20px; border-bottom: 1px solid var(--soft-line); background: linear-gradient(180deg, #fbfcfb, var(--paper)); }
.back { justify-self: start; display: inline-flex; align-items: center; gap: 7px; padding: 3px 0; border: 0; background: none; color: var(--green-ink); font-size: 12px; font-weight: 600; }
.back:hover { color: var(--green); }
.back-arrow { font: 500 17px/1 system-ui, sans-serif; }
.perm-context-grid { display: grid; grid-template-columns: minmax(170px, 1fr) minmax(170px, 1fr) minmax(210px, .95fr); gap: 14px; align-items: end; }
.perm-field { display: grid; gap: 6px; min-width: 0; }
.perm-field > span { font: 500 10px 'IBM Plex Mono', monospace; letter-spacing: .1em; text-transform: uppercase; color: var(--faint); }
.perm-field select { width: 100%; height: 42px; min-width: 0; padding: 0 11px; border: 1px solid var(--line); border-radius: 7px; background: var(--field); color: var(--ink); font-size: 13px; transition: .16s ease; }
.perm-field select:focus { border-color: var(--green); background: var(--paper); outline: none; box-shadow: 0 0 0 3px rgba(1, 139, 81, .14); }
.perm-role-card { display: grid; gap: 6px; min-width: 0; padding: 10px 12px; border: 1px solid rgba(1, 139, 81, .18); border-radius: 9px; background: var(--green-tint); }
.perm-role-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.perm-role-top .scope-pill { font-size: 9px; padding: 3px 7px; }
.perm-coverage { color: var(--green-ink); font: 500 11px 'IBM Plex Mono', monospace; }
.perm-role-name { overflow: hidden; color: var(--ink); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.perm-meter { height: 4px; border-radius: 999px; background: rgba(1, 139, 81, .16); overflow: hidden; }
.perm-meter i { display: block; height: 100%; border-radius: inherit; background: var(--green); transition: width .3s ease; }
.perm-role-card small { color: var(--green-ink); font-size: 10px; line-height: 1.3; }
.perm-body { display: grid; gap: 14px; padding: 18px 26px 20px; }
.perm-alert { display: flex; gap: 9px; align-items: flex-start; margin: 0; padding: 10px 12px; border-radius: 7px; font-size: 12px; line-height: 1.45; }
.perm-alert.bad { border: 1px solid rgba(185, 61, 60, .24); background: rgba(185, 61, 60, .06); color: var(--red); }
.perm-alert.info { border: 1px solid rgba(155, 104, 24, .24); background: rgba(155, 104, 24, .06); color: var(--amber); }
.perm-alert svg { flex: none; margin-top: 1px; }
.perm-help { display: flex; gap: 7px; align-items: flex-start; margin: 0; color: var(--text); font-size: 12px; line-height: 1.5; }
.perm-help svg { flex: none; margin-top: 1px; color: var(--green); }
.perm-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.perm-search { display: flex; flex: 1 1 260px; align-items: center; gap: 8px; max-width: 420px; height: 40px; padding: 0 10px; border: 1px solid var(--line); border-radius: 7px; background: var(--field); transition: .16s ease; }
.perm-search > svg { flex: none; color: var(--green); }
.perm-search:focus-within { border-color: var(--green); background: var(--paper); box-shadow: 0 0 0 3px rgba(1, 139, 81, .14); }
.perm-search input { flex: 1; min-width: 0; height: 38px; border: 0; background: transparent; outline: none; color: var(--ink); font-size: 13px; }
.perm-search input::placeholder { color: var(--faint); }
.perm-clear { padding: 0 2px; border: 0; background: transparent; color: var(--faint); font-size: 18px; line-height: 1; }
.perm-clear:hover { color: var(--ink); }
.perm-chips { display: flex; gap: 5px; flex-wrap: wrap; }
.perm-chips button { height: 30px; padding: 0 11px; border: 1px solid var(--line); border-radius: 999px; background: var(--paper); color: var(--text); font: 600 10px 'IBM Plex Mono', monospace; letter-spacing: .04em; transition: .16s ease; }
.perm-chips button:hover { border-color: rgba(1, 139, 81, .4); color: var(--ink); }
.perm-chips button.on { background: var(--ink); border-color: var(--ink); color: #fff; }
.perm-clear-filters { margin-left: auto; padding: 0; border: 0; background: transparent; color: var(--green-ink); font-size: 11px; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
.perm-clear-filters:hover { color: var(--green); }
.perm-pagination { display: flex; align-items: center; gap: 10px; color: var(--text); font-size: 11px; white-space: nowrap; }
.perm-pagination label { display:flex; align-items:center; gap:5px; }.perm-pagination select { height:28px; border:1px solid var(--line); border-radius:4px; background:var(--paper); color:var(--ink); font-size:11px; }.perm-pagination span { text-align: center; color: var(--text); }.perm-pagination b { color: var(--ink); }.perm-pagination button { padding:5px 8px; border:1px solid var(--line); border-radius:4px; background:var(--paper); color:var(--text); font-size:11px; cursor:pointer; }.perm-pagination button:hover:not(:disabled) { border-color:var(--green); color:var(--green-ink); }.perm-pagination button:disabled { cursor: not-allowed; opacity: .42; }
.perm-board { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; align-items: stretch; }
.perm-column { display: flex; flex-direction: column; min-width: 0; border: 1px solid var(--line); border-radius: 12px; background: var(--paper); overflow: hidden; transition: border-color .16s ease, box-shadow .16s ease; }
.perm-column.drop-active { border-color: var(--green); box-shadow: 0 0 0 3px rgba(1, 139, 81, .1); }
.perm-column-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding: 13px 14px; border-bottom: 1px solid var(--soft-line); background: var(--field); }
.perm-column.assigned .perm-column-head { background: var(--green-wash); }
.perm-column-title { display: flex; gap: 9px; min-width: 0; }
.perm-column-icon { display: grid; flex: none; width: 29px; height: 29px; place-items: center; border: 1px solid rgba(1, 139, 81, .2); border-radius: 8px; background: var(--paper); color: var(--green); }
.perm-column-copy { display: grid; gap: 2px; min-width: 0; }
.perm-column-line { display: flex; align-items: center; gap: 7px; }
.perm-column-line h3 { margin: 0; color: var(--ink); font-size: 12px; font-weight: 600; letter-spacing: -.01em; }
.perm-column-count { padding: 1px 7px; border: 1px solid var(--line); border-radius: 999px; background: var(--paper); color: var(--text); font: 500 10px 'IBM Plex Mono', monospace; }
.perm-column.assigned .perm-column-count { border-color: rgba(1, 139, 81, .22); color: var(--green-ink); }
.perm-column-hint { margin: 0; color: var(--faint); font-size: 11px; line-height: 1.35; }
.perm-column-hint.active { color: var(--green-ink); font-weight: 600; }
.perm-bulk { flex: none; align-self: center; padding: 2px 0; border: 0; background: none; color: var(--green-ink); font-size: 10px; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; white-space: nowrap; }
.perm-bulk:hover:not(:disabled) { color: var(--green); }
.perm-list { display: flex; flex: 1; flex-direction: column; gap: 7px; height: clamp(300px, 44vh, 520px); padding: 10px; overflow-y: auto; scrollbar-color: rgba(17, 19, 18, .2) transparent; scrollbar-width: thin; }
.perm-list::-webkit-scrollbar { width: 8px; }
.perm-list::-webkit-scrollbar-thumb { border: 2px solid var(--paper); border-radius: 999px; background: rgba(17, 19, 18, .18); }
.perm-card { display: grid; grid-template-columns: 16px 62px minmax(0, 1fr) 68px 30px; align-items: center; gap: 8px; padding: 8px 9px; border: 1px solid var(--soft-line); border-radius: 8px; background: var(--paper); cursor: grab; transition: border-color .16s ease, box-shadow .16s ease, background .16s ease, opacity .16s ease; }
.perm-card:hover { border-color: rgba(1, 139, 81, .32); box-shadow: 0 2px 8px rgba(17, 19, 18, .045); }
.perm-card:active { cursor: grabbing; }
.perm-card.is-dragging { border-style: dashed; opacity: .42; }
.perm-card.pending-removal { border-color: rgba(185, 61, 60, .28); background: rgba(185, 61, 60, .025); }
.perm-card.pending-add { border-color: rgba(1, 139, 81, .34); background: var(--green-tint); }
.perm-grip { display: grid; place-items: center; color: #c0c7c2; }
.perm-card:hover .perm-grip { color: var(--faint); }
.perm-card .http-method { padding: 4px 6px; border-radius: 5px; font-size: 10px; }
.perm-path { min-width: 0; overflow: hidden; color: var(--ink); font: 500 12px 'IBM Plex Mono', monospace; text-overflow: ellipsis; white-space: nowrap; }
.perm-tag { justify-self: end; padding: 3px 6px; border-radius: 999px; font: 600 9px 'IBM Plex Mono', monospace; letter-spacing: .06em; text-align: right; text-transform: uppercase; white-space: nowrap; }
.perm-tag:empty { padding: 0; }
.perm-tag.active { background: var(--green-wash); color: var(--green-ink); }
.perm-tag.new { background: rgba(1, 139, 81, .15); color: var(--green-ink); }
.perm-tag.removed { background: rgba(185, 61, 60, .09); color: var(--red); }
.perm-move { display: grid; flex: none; width: 29px; height: 29px; place-items: center; border: 1px solid var(--line); border-radius: 6px; background: var(--paper); color: var(--text); transition: .16s ease; }
.perm-move:hover:not(:disabled) { border-color: var(--green); background: var(--green); color: #fff; }
.perm-move.back:hover:not(:disabled) { border-color: rgba(185, 61, 60, .5); background: rgba(185, 61, 60, .08); color: var(--red); }
.perm-move.back svg { transform: rotate(180deg); }
.perm-list-empty { display: grid; justify-items: center; gap: 5px; width: 100%; margin: auto; padding: 24px 14px; border: 1px dashed var(--line); border-radius: 9px; color: var(--faint); font-size: 11px; line-height: 1.45; text-align: center; }
.perm-list-empty svg { color: var(--green); }
.perm-list-empty strong { color: var(--ink); font-size: 12px; }
.perm-footer { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 15px 26px; border-top: 1px solid var(--soft-line); background: var(--field); }
.perm-footer.dirty { background: linear-gradient(90deg, var(--green-tint), var(--field) 72%); }
.perm-status { display: flex; gap: 10px; align-items: center; min-width: 0; }
.perm-status-icon { display: grid; flex: none; width: 30px; height: 30px; place-items: center; border: 1px solid rgba(1, 139, 81, .2); border-radius: 50%; background: var(--paper); color: var(--green); }
.perm-status-copy { display: grid; gap: 1px; min-width: 0; }
.perm-status-copy strong { color: var(--ink); font-size: 12px; }
.perm-status-copy small { color: var(--text); font-size: 11px; line-height: 1.4; }
.perm-delta { font: 500 11px 'IBM Plex Mono', monospace; }
.perm-delta.add { color: var(--green); }
.perm-delta.remove { color: var(--red); }
.perm-footer-actions { display: flex; gap: 8px; align-items: center; }
.perm-discard { font-size: 12px; }
.perm-save { min-width: 156px; justify-content: center; }
@media (max-width: 980px) {
  .perm-context-grid { grid-template-columns: 1fr 1fr; }
  .perm-role-card { grid-column: 1 / -1; }
}
@media (max-width: 760px) {
  .perm-board { grid-template-columns: 1fr; }
  .perm-list { height: 300px; }
}
@media (max-width: 640px) {
  .perm-context, .perm-body, .perm-footer { padding-left: 16px; padding-right: 16px; }
  .perm-context-grid { grid-template-columns: 1fr; }
  .perm-role-card { grid-column: auto; }
  .perm-search { max-width: none; }
  .perm-clear-filters { margin-left: 0; }
  .perm-pagination { margin-left: 0; }
  .perm-card { grid-template-columns: 58px minmax(0, 1fr) 30px; }
  .perm-grip, .perm-tag { display: none; }
  .perm-footer { align-items: flex-start; }
  .perm-footer-actions { width: 100%; }
  .perm-footer-actions > button { flex: 1; justify-content: center; }
}
</style>
