<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { addRoleResourcesBatch, syncRoleResources } from "../api";
import type { HttpMethod, Role } from "../api/contracts";
import DataPanel from "../components/DataPanel.vue";
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
const selected = ref(new Set<string>());
const { busy, error, run } = useMutation();
const pageSize = 20;
const applications = computed(() => catalogs.apps);
const availableRoles = computed(() => catalogs.roles.filter((role) =>
  role.scope !== "GLOBAL" && (!applicationId.value || role.scope === "TENANT" || role.applicationId === applicationId.value),
));
const role = computed<Role | undefined>(() => catalogs.roles.find((item) => item.id === roleId.value));
const protectedRole = computed(() => role.value?.name.trim().toUpperCase() === "ADMIN" && Boolean(role.value.applicationId));
const applicationResources = computed(() => catalogs.resources.filter((resource) => resource.applicationId === applicationId.value));
const resources = computed(() => applicationResources.value.filter((resource) => {
  const haystack = `${resource.path} ${resource.method}`.toLowerCase();
  return (!query.value || haystack.includes(query.value.toLowerCase())) && (!method.value || resource.method === method.value) &&
    (mode.value === "edit" || !role.value?.resourceIds.includes(resource.id));
}));
const totalPages = computed(() => Math.max(1, Math.ceil(resources.value.length / pageSize)));
const visibleResources = computed(() => resources.value.slice((page.value - 1) * pageSize, page.value * pageSize));
const allVisibleSelected = computed(() => visibleResources.value.length > 0 && visibleResources.value.every((resource) => selected.value.has(resource.id)));

function resetSelection() {
  selected.value = new Set(mode.value === "edit" && role.value
    ? applicationResources.value.filter((resource) => role.value!.resourceIds.includes(resource.id)).map((resource) => resource.id)
    : []);
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
}
function togglePage() {
  const next = new Set(selected.value);
  if (allVisibleSelected.value) visibleResources.value.forEach((resource) => next.delete(resource.id));
  else visibleResources.value.forEach((resource) => next.add(resource.id));
  selected.value = next;
}
async function save() {
  if (!role.value || !applicationId.value || protectedRole.value) return;
  const data = { applicationId: applicationId.value, resourceIds: [...selected.value] };
  const message = mode.value === "add" ? "Los recursos seleccionados fueron agregados al rol." : "Los permisos de esta aplicación fueron actualizados.";
  if (await run(() => mode.value === "add" ? addRoleResourcesBatch(role.value!.id, data) : syncRoleResources(role.value!.id, data), message)) {
    mode.value = "edit";
    resetSelection();
  }
}
watch([applicationId, mode], () => { page.value = 1; resetSelection(); });
watch([query, method], () => { page.value = 1; });
watch(totalPages, () => { if (page.value > totalPages.value) page.value = totalPages.value; });
watch(availableRoles, (roles) => { if (!roles.some((item) => item.id === roleId.value)) roleId.value = roles[0]?.id || ""; }, { immediate: true });
watch(roleId, selectRole, { immediate: true });
</script>

<template>
  <DataPanel title="Gestor de permisos" :count="resources.length" empty="No hay recursos que coincidan con los filtros." show-content-when-empty>
    <div class="permissions-toolbar">
      <button class="back" type="button" aria-label="Volver al catálogo de roles" @click="router.push({ name: 'roles' })"><span class="back-arrow" aria-hidden="true">←</span> Volver al catálogo de roles</button>
      <label>Aplicación<select v-model="applicationId"><option value="" disabled>Selecciona una aplicación</option><option v-for="app in applications" :key="app.id" :value="app.id">{{ app.name }}</option></select></label>
      <label>Rol<select v-model="roleId" :disabled="!applicationId"><option v-for="item in availableRoles" :key="item.id" :value="item.id">{{ item.name }} · {{ item.scope === 'TENANT' ? 'Tenant' : 'Aplicación' }}</option></select></label>
      <div class="mode-switch"><button :class="{ active: mode === 'add' }" @click="mode = 'add'">Asignar recursos</button><button :class="{ active: mode === 'edit' }" @click="mode = 'edit'">Editar permisos</button></div>
    </div>
    <p v-if="mode === 'add'" class="mode-help">Solo se muestran recursos aún no concedidos; guardar agrega la selección sin retirar permisos existentes.</p>
    <p v-else class="mode-help">Se muestran todos los recursos de la aplicación. Guardar sincroniza solo este contexto de aplicación.</p>
    <p v-if="protectedRole" class="modal-error">El rol ADMIN de aplicación es de solo lectura.</p>
    <p v-if="error" class="modal-error">{{ error }}</p>
    <div class="permission-filters"><input v-model="query" placeholder="Buscar por ruta" /><select v-model="method"><option value="">Todos los métodos</option><option v-for="item in ['GET','POST','PUT','PATCH','DELETE']" :key="item" :value="item">{{ item }}</option></select><button class="create-action" :disabled="busy || !roleId || !applicationId || protectedRole" @click="save">{{ busy ? 'Guardando…' : mode === 'add' ? 'Agregar seleccionados' : 'Guardar permisos' }}</button></div>
    <div class="permissions-table-wrap"><table class="permissions-table"><thead><tr><th><input type="checkbox" :checked="allVisibleSelected" :disabled="!visibleResources.length" @change="togglePage" /></th><th>Método</th><th>Ruta</th><th>Aplicación</th></tr></thead><tbody><tr v-for="resource in visibleResources" :key="resource.id"><td><input type="checkbox" :checked="selected.has(resource.id)" @change="toggle(resource.id)" /></td><td><span :class="['http-method', `method-${resource.method}`]">{{ resource.method }}</span></td><td><code>{{ resource.path }}</code></td><td>{{ catalogs.appById[resource.applicationId]?.name || resource.applicationId }}</td></tr></tbody></table></div>
    <footer class="permission-pagination"><span>{{ resources.length }} recursos · {{ selected.size }} seleccionados</span><div><button :disabled="page === 1" @click="page--">Anterior</button><span>Página {{ page }} de {{ totalPages }}</span><button :disabled="page === totalPages" @click="page++">Siguiente</button></div></footer>
  </DataPanel>
</template>

<style scoped>
.permissions-toolbar,.permission-filters { display:flex; gap:12px; align-items:end; flex-wrap:wrap; padding:18px; border-bottom:1px solid var(--soft-line); }
label { display:grid; gap:6px; color:var(--ink); font-size:12px; font-weight:700; } select,input { min-height:34px; border:1px solid var(--line); border-radius:5px; background:#fff; padding:0 9px; color:var(--ink); font-weight:500; } .back { align-self:center; border:0; background:none; color:var(--green-ink); display:inline-flex; gap:8px; align-items:center; font-weight:600; } .back:hover { color:var(--green); } .back-arrow { font:500 20px/1 system-ui,sans-serif; } .mode-switch { display:flex; border:1px solid var(--line); border-radius:6px; overflow:hidden; } .mode-switch button { border:0; padding:8px 10px; background:#fff; color:var(--text); font-size:11px; } .mode-switch .active { background:var(--green); color:#fff; } .mode-help { margin:14px 18px 0; color:var(--text); font-size:12px; } .permission-filters input { min-width:220px; } .permission-filters .create-action { margin-left:auto; }
.permissions-table-wrap { overflow:auto; } .permissions-table { width:100%; border-collapse:collapse; font-size:12px; } .permissions-table th,.permissions-table td { text-align:left; padding:12px 18px; border-top:1px solid var(--soft-line); } .permissions-table th { color:var(--faint); font:10px 'IBM Plex Mono',monospace; letter-spacing:.04em; } .permissions-table code { font:11px 'IBM Plex Mono',monospace; } .permission-pagination { display:flex; justify-content:space-between; gap:12px; align-items:center; padding:14px 18px; border-top:1px solid var(--soft-line); color:var(--text); font-size:11px; } .permission-pagination div { display:flex; align-items:center; gap:10px; } .permission-pagination button { border:1px solid var(--line); background:#fff; border-radius:4px; padding:5px 8px; font-size:11px; }
</style>
