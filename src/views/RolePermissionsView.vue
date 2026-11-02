<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { addRoleResourcesBatch, syncRoleResources } from "../api";
import type { HttpMethod, Role } from "../api/contracts";
import DataPanel from "../components/DataPanel.vue";
import Icon from "../components/Icon.vue";
import { useMutation } from "../composables/useMutation";
import { useCatalogsStore } from "../stores/catalogs";

const catalogs = useCatalogsStore();
const route = useRoute(), router = useRouter();
// Al abrir un rol se prioriza ver y revisar sus permisos actuales. El modo de adición sigue
// disponible, pero no deja al usuario ante una tabla vacía después de conceder un recurso.
const mode = ref<"add" | "edit">("edit");
const applicationId = ref(String(route.query.applicationId || ""));
const roleId = ref(String(route.query.roleId || ""));
const query = ref(""), method = ref<"" | HttpMethod>("");
const page = ref(1);
const pageSize = ref(10);
const PAGE_SIZES = [10, 20, 50];
const METHODS: Array<"" | HttpMethod> = ["", "GET", "POST", "PUT", "PATCH", "DELETE"];
const selected = ref(new Set<string>());
const justSaved = ref(false);
const { busy, error, run } = useMutation();
const applications = computed(() => catalogs.apps);
const availableRoles = computed(() => catalogs.roles.filter((role) =>
  role.scope !== "GLOBAL" && (!applicationId.value || role.scope === "TENANT" || role.applicationId === applicationId.value),
));
const role = computed<Role | undefined>(() => catalogs.roles.find((item) => item.id === roleId.value));
const protectedRole = computed(() => role.value?.name.trim().toUpperCase() === "ADMIN" && Boolean(role.value.applicationId));
const applicationResources = computed(() => catalogs.resources.filter((resource) => resource.applicationId === applicationId.value));
// Recursos de esta aplicación que el rol ya concede: es lo que guarda la sincronización.
const granted = computed(() => new Set(applicationResources.value.filter((resource) => role.value?.resourceIds.includes(resource.id)).map((resource) => resource.id)));
const resources = computed(() => applicationResources.value.filter((resource) => {
  const haystack = `${resource.path} ${resource.method}`.toLowerCase();
  return (!query.value || haystack.includes(query.value.toLowerCase())) && (!method.value || resource.method === method.value) &&
    (mode.value === "edit" || !granted.value.has(resource.id));
}));
const totalPages = computed(() => Math.max(1, Math.ceil(resources.value.length / pageSize.value)));
const visibleResources = computed(() => resources.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));
const allVisibleSelected = computed(() => visibleResources.value.length > 0 && visibleResources.value.every((resource) => selected.value.has(resource.id)));
// Guardar solo tiene sentido si algo cambió: evita reenviar lo mismo por descuido.
const dirty = computed(() => {
  if (mode.value === "add") return selected.value.size > 0;
  if (selected.value.size !== granted.value.size) return true;
  return [...selected.value].some((id) => !granted.value.has(id));
});
const added = computed(() => mode.value === "edit" ? [...selected.value].filter((id) => !granted.value.has(id)).length : selected.value.size);
const removed = computed(() => mode.value === "edit" ? [...granted.value].filter((id) => !selected.value.has(id)).length : 0);
const rangeFrom = computed(() => resources.value.length ? (page.value - 1) * pageSize.value + 1 : 0);
const rangeTo = computed(() => Math.min(page.value * pageSize.value, resources.value.length));
// Ventana de páginas: « ‹ 1 … 4 5 6 … 15 › » (como mucho 7 botones, sin importar cuántas páginas haya).
const pageButtons = computed<Array<number | "gap">>(() => {
  const last = totalPages.value, current = page.value;
  const near = current <= 3 ? [1, 2, 3, 4, 5] : current >= last - 2 ? [last - 4, last - 3, last - 2, last - 1, last] : [current - 1, current, current + 1];
  const pages = [...new Set([1, last, ...near].filter((value) => value >= 1 && value <= last))].sort((a, b) => a - b);
  const result: Array<number | "gap"> = [];
  pages.forEach((value, index) => { if (index && value - pages[index - 1]! > 1) result.push("gap"); result.push(value); });
  return result;
});

function resetSelection() {
  selected.value = new Set(mode.value === "edit" && role.value ? granted.value : []);
}
function selectRole() {
  const selectedRole = role.value;
  if (selectedRole?.scope === "APPLICATION") applicationId.value = selectedRole.applicationId || "";
  resetSelection();
}
function toggle(resourceId: string) {
  const next = new Set(selected.value);
  next.has(resourceId) ? next.delete(resourceId) : next.add(resourceId);
  selected.value = next;
  justSaved.value = false;
}
function togglePage() {
  const next = new Set(selected.value);
  if (allVisibleSelected.value) visibleResources.value.forEach((resource) => next.delete(resource.id));
  else visibleResources.value.forEach((resource) => next.add(resource.id));
  selected.value = next;
  justSaved.value = false;
}
function clearFilters() { query.value = ""; method.value = ""; }
async function save() {
  if (!role.value || !applicationId.value || protectedRole.value || !dirty.value) return;
  const data = { applicationId: applicationId.value, resourceIds: [...selected.value] };
  const message = mode.value === "add" ? "Los recursos seleccionados fueron agregados al rol." : "Los permisos de esta aplicación fueron actualizados.";
  if (await run(() => mode.value === "add" ? addRoleResourcesBatch(role.value!.id, data) : syncRoleResources(role.value!.id, data), message)) {
    mode.value = "edit";
    resetSelection();
    justSaved.value = true;
  }
}
watch([applicationId, mode], () => { page.value = 1; resetSelection(); justSaved.value = false; });
watch([query, method, pageSize], () => { page.value = 1; });
watch(totalPages, () => { if (page.value > totalPages.value) page.value = totalPages.value; });
watch(availableRoles, (roles) => { if (!roles.some((item) => item.id === roleId.value)) roleId.value = roles[0]?.id || ""; }, { immediate: true });
watch(roleId, selectRole, { immediate: true });
</script>

<template>
  <DataPanel title="Gestor de permisos" :count="applicationResources.length" empty="Esta aplicación aún no tiene recursos. Regístralos primero en Recursos." show-content-when-empty>
    <div class="perm-top">
      <button class="back" type="button" aria-label="Volver al catálogo de roles" @click="router.push({ name: 'roles' })"><span class="back-arrow" aria-hidden="true">←</span> Volver al catálogo de roles</button>
      <div class="perm-pickers">
        <label class="perm-field">Aplicación<select v-model="applicationId"><option value="" disabled>Selecciona una aplicación</option><option v-for="app in applications" :key="app.id" :value="app.id">{{ app.name }}</option></select></label>
        <label class="perm-field">Rol<select v-model="roleId" :disabled="!applicationId"><option v-for="item in availableRoles" :key="item.id" :value="item.id">{{ item.name }} · {{ item.scope === 'TENANT' ? 'Tenant' : 'Aplicación' }}</option></select></label>
        <div class="perm-field"><span>Qué quieres hacer</span><div class="perm-seg" role="tablist" aria-label="Modo"><button type="button" role="tab" :aria-selected="mode === 'edit'" :class="{ on: mode === 'edit' }" @click="mode = 'edit'">Editar permisos</button><button type="button" role="tab" :aria-selected="mode === 'add'" :class="{ on: mode === 'add' }" @click="mode = 'add'">Asignar recursos</button></div></div>
      </div>
    </div>

    <div class="perm-body">
      <p class="perm-help">{{ mode === 'add' ? 'Solo se muestran los recursos que el rol aún no tiene; guardar agrega la selección sin retirar permisos existentes.' : 'Se muestran todos los recursos de la aplicación. Marca los que el rol debe poder usar y guarda: se sincroniza solo esta aplicación.' }}</p>
      <p v-if="protectedRole" class="perm-alert bad"><Icon name="close" :size="14" />El rol ADMIN de la aplicación es de solo lectura: administra la aplicación y no se puede modificar.</p>
      <p v-if="error" class="perm-alert bad"><Icon name="close" :size="14" />{{ error }}</p>
      <p v-else-if="justSaved" class="perm-alert good" role="status"><Icon name="check" :size="14" />Guardado. Estás viendo los permisos vigentes del rol; el botón se activa cuando hagas un cambio.</p>

      <div class="perm-filters">
        <div class="perm-search"><span aria-hidden="true">⌕</span><input v-model.trim="query" placeholder="Buscar por ruta o método" aria-label="Buscar recursos" autocomplete="off"><button v-if="query" type="button" class="perm-clear" aria-label="Limpiar búsqueda" @click="query = ''">×</button></div>
        <div class="perm-chips" role="group" aria-label="Filtrar por método">
          <button v-for="item in METHODS" :key="item || 'all'" type="button" :class="{ on: method === item }" :aria-pressed="method === item" @click="method = item">{{ item || 'Todos' }}</button>
        </div>
      </div>

      <div class="perm-bar">
        <span class="perm-count"><b>{{ selected.size }}</b> seleccionados<template v-if="mode === 'edit' && (added || removed)"> · <span class="plus">+{{ added }}</span> <span class="minus">−{{ removed }}</span></template></span>
        <span class="perm-spacer" />
        <button v-if="query || method" type="button" class="perm-link" @click="clearFilters">Quitar filtros</button>
        <button class="create-action" type="button" :disabled="busy || !roleId || !applicationId || protectedRole || !dirty" @click="save">{{ busy ? 'Guardando…' : mode === 'add' ? 'Agregar seleccionados' : 'Guardar permisos' }}</button>
      </div>

      <div class="perm-table" role="table" aria-label="Recursos de la aplicación">
        <div class="perm-row head" role="row"><span role="columnheader"><input type="checkbox" :checked="allVisibleSelected" :disabled="!visibleResources.length || protectedRole" aria-label="Seleccionar los de esta página" @change="togglePage"></span><span role="columnheader">Método</span><span role="columnheader">Ruta</span><span role="columnheader" class="state-col">Estado</span></div>
        <label v-for="resource in visibleResources" :key="resource.id" class="perm-row" :class="{ on: selected.has(resource.id) }" role="row">
          <span role="cell"><input type="checkbox" :checked="selected.has(resource.id)" :disabled="protectedRole" @change="toggle(resource.id)"></span>
          <span role="cell"><span :class="['http-method', `method-${resource.method}`]">{{ resource.method }}</span></span>
          <span role="cell" class="path"><code>{{ resource.path }}</code></span>
          <span role="cell" class="state-col"><span v-if="granted.has(resource.id)" class="perm-tag">Concedido</span></span>
        </label>
        <div v-if="!visibleResources.length" class="perm-empty">
          <strong>{{ applicationResources.length ? 'Ningún recurso coincide' : 'Sin recursos' }}</strong>
          <span>{{ applicationResources.length ? (mode === 'add' ? 'Quita los filtros o cambia a «Editar permisos» para ver también los que el rol ya tiene.' : 'Prueba con otra ruta o quita los filtros.') : 'Registra primero los endpoints de la aplicación en Recursos.' }}</span>
        </div>
      </div>

      <footer class="perm-pager">
        <span class="perm-range">{{ rangeFrom }}–{{ rangeTo }} de {{ resources.length }}</span>
        <nav v-if="totalPages > 1" class="perm-pages" aria-label="Paginación de recursos">
          <button type="button" aria-label="Página anterior" :disabled="page === 1" @click="page--">‹</button>
          <template v-for="(item, index) in pageButtons" :key="index">
            <span v-if="item === 'gap'" class="gap">…</span>
            <button v-else type="button" :class="{ on: item === page }" :aria-current="item === page ? 'page' : undefined" @click="page = item">{{ item }}</button>
          </template>
          <button type="button" aria-label="Página siguiente" :disabled="page === totalPages" @click="page++">›</button>
        </nav>
        <label class="perm-size">Por página<select v-model.number="pageSize"><option v-for="size in PAGE_SIZES" :key="size" :value="size">{{ size }}</option></select></label>
      </footer>
    </div>
  </DataPanel>
</template>

<style scoped>
.perm-top { padding: 4px 26px 18px; border-bottom: 1px solid var(--soft-line); display: grid; gap: 16px; }
.back { justify-self: start; border: 0; background: none; color: var(--green-ink); display: inline-flex; gap: 8px; align-items: center; font-size: 13px; font-weight: 600; padding: 0; }
.back:hover { color: var(--green); } .back-arrow { font: 500 18px/1 system-ui, sans-serif; }
.perm-pickers { display: grid; grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr) auto; gap: 14px; align-items: end; }
.perm-field { display: grid; gap: 6px; font-size: 12px; font-weight: 600; color: var(--ink); }
.perm-field select, .perm-size select { height: 40px; border: 1px solid var(--line); border-radius: 6px; background: var(--field); padding: 0 10px; color: var(--ink); font-weight: 400; transition: .16s ease; min-width: 0; }
.perm-field select:focus, .perm-size select:focus, .perm-search:focus-within { background: var(--paper); border-color: var(--green); outline: none; box-shadow: 0 0 0 3px rgba(1, 139, 81, .14); }
.perm-seg { display: inline-flex; padding: 3px; gap: 3px; border-radius: 8px; background: var(--field); height: 40px; }
.perm-seg button { border: 0; border-radius: 6px; padding: 0 12px; background: transparent; color: var(--text); font-size: 12px; font-weight: 500; transition: .16s ease; white-space: nowrap; }
.perm-seg button.on { background: var(--paper); color: var(--green-ink); font-weight: 600; box-shadow: 0 0 0 1px rgba(1, 139, 81, .22); }
.perm-body { padding: 18px 26px 22px; display: grid; gap: 14px; }
.perm-help { margin: 0; color: var(--text); font-size: 13px; line-height: 1.5; }
.perm-alert { display: flex; gap: 9px; align-items: flex-start; margin: 0; padding: 10px 12px; border-radius: 7px; font-size: 12px; line-height: 1.45; }
.perm-alert.bad { border: 1px solid rgba(185, 61, 60, .24); background: rgba(185, 61, 60, .06); color: var(--red); }
.perm-alert.good { border: 1px solid rgba(1, 139, 81, .22); background: var(--green-tint); color: var(--green-ink); }
.perm-filters { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.perm-search { display: flex; align-items: center; gap: 8px; flex: 1 1 260px; max-width: 420px; height: 40px; padding: 0 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--field); transition: .16s ease; }
.perm-search > span { color: var(--green); font-size: 18px; line-height: 1; }
.perm-search input { flex: 1; min-width: 0; border: 0; background: transparent; outline: none; font-size: 13px; color: var(--ink); height: 38px; }
.perm-clear { border: 0; background: transparent; color: var(--faint); font-size: 18px; line-height: 1; padding: 0 4px; }
.perm-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.perm-chips button { height: 32px; padding: 0 11px; border: 1px solid var(--line); border-radius: 999px; background: var(--paper); color: var(--text); font: 600 10px 'IBM Plex Mono', monospace; transition: .16s ease; }
.perm-chips button:hover { border-color: rgba(1, 139, 81, .4); color: var(--ink); }
.perm-chips button.on { background: var(--ink); border-color: var(--ink); color: #fff; }
.perm-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.perm-count { color: var(--text); font-size: 12px; } .perm-count b { color: var(--ink); font: 500 15px 'IBM Plex Mono', monospace; }
.perm-count .plus { color: var(--green); font-family: 'IBM Plex Mono', monospace; } .perm-count .minus { color: var(--red); font-family: 'IBM Plex Mono', monospace; }
.perm-spacer { flex: 1; }
.perm-link { border: 0; background: transparent; color: var(--green-ink); font-size: 12px; font-weight: 600; text-decoration: underline; }
.perm-table { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--paper); }
.perm-row { display: grid; grid-template-columns: 44px 84px minmax(0, 1fr) 100px; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--soft-line); font-size: 12px; cursor: pointer; transition: background .16s ease; }
.perm-row:last-of-type { border-bottom: 0; }
.perm-row.head { background: var(--field); color: var(--faint); font: 500 10px 'IBM Plex Mono', monospace; letter-spacing: .1em; text-transform: uppercase; cursor: default; padding-top: 10px; padding-bottom: 10px; }
.perm-row:not(.head):hover { background: #fafbfa; } .perm-row.on { background: var(--green-tint); }
.perm-row input[type="checkbox"] { width: 17px; height: 17px; accent-color: var(--green); cursor: pointer; }
.perm-row .path code { font: 500 13px 'IBM Plex Mono', monospace; color: var(--ink); overflow-wrap: anywhere; }
.state-col { text-align: right; }
.perm-tag { font: 600 9px 'IBM Plex Mono', monospace; letter-spacing: .06em; text-transform: uppercase; color: var(--green-ink); background: var(--green-wash); border-radius: 999px; padding: 4px 8px; }
.perm-empty { display: grid; gap: 6px; padding: 38px 20px; text-align: center; color: var(--faint); font-size: 12px; }
.perm-empty strong { color: var(--ink); font-size: 13px; }
.perm-pager { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; justify-content: space-between; }
.perm-range { color: var(--text); font: 500 12px 'IBM Plex Mono', monospace; }
.perm-pages { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.perm-pages button { min-width: 34px; height: 34px; padding: 0 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--paper); color: var(--text); font: 500 12px 'IBM Plex Mono', monospace; transition: .16s ease; }
.perm-pages button:hover:not(:disabled) { border-color: rgba(1, 139, 81, .4); color: var(--ink); }
.perm-pages button.on { background: var(--ink); border-color: var(--ink); color: #fff; }
.perm-pages .gap { color: var(--faint); padding: 0 4px; }
.perm-size { display: inline-flex; align-items: center; gap: 8px; color: var(--text); font-size: 12px; }
.perm-size select { height: 34px; }
@media (max-width: 900px) {
  .perm-pickers { grid-template-columns: 1fr 1fr; } .perm-pickers .perm-field:last-child { grid-column: 1 / -1; }
}
@media (max-width: 640px) {
  .perm-top, .perm-body { padding-left: 16px; padding-right: 16px; }
  .perm-pickers { grid-template-columns: 1fr; } .perm-seg { width: 100%; } .perm-seg button { flex: 1; }
  .perm-search { max-width: none; }
  .perm-row { grid-template-columns: 34px 70px minmax(0, 1fr); padding: 12px; } .state-col { display: none; }
  .perm-bar .create-action { width: 100%; justify-content: center; }
  .perm-pager { justify-content: center; }
}
</style>
