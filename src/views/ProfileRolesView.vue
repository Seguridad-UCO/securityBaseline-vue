<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { addProfileRolesBatch, syncProfileRoles } from "../api";
import type { Profile, Role } from "../api/contracts";
import DataPanel from "../components/DataPanel.vue";
import { useMutation } from "../composables/useMutation";
import { useCatalogsStore } from "../stores/catalogs";

const catalogs = useCatalogsStore(), route = useRoute(), router = useRouter();
const profileId = ref(String(route.query.profileId || ""));
const mode = ref<"add" | "edit">("edit"), query = ref(""), scope = ref("");
const page = ref(1), selected = ref(new Set<string>());
const { busy, error, run } = useMutation();
const pageSize = 20;
const profile = computed<Profile | undefined>(() => catalogs.profiles.find(item => item.id === profileId.value));
const compatibleRoles = computed(() => catalogs.roles.filter(role => role.scope !== "GLOBAL" &&
  (profile.value?.scope === "TENANT"
    ? role.scope === "TENANT"
    : role.scope === "TENANT" || role.applicationId === profile.value?.applicationId)));
const availableRoles = computed(() => compatibleRoles.value.filter(role =>
  (!query.value || role.name.toLowerCase().includes(query.value.toLowerCase())) && (!scope.value || role.scope === scope.value) &&
  (mode.value === "edit" || !profile.value?.roleIds.includes(role.id))));
const totalPages = computed(() => Math.max(1, Math.ceil(availableRoles.value.length / pageSize)));
const visibleRoles = computed(() => availableRoles.value.slice((page.value - 1) * pageSize, page.value * pageSize));
const allVisibleSelected = computed(() => visibleRoles.value.length > 0 && visibleRoles.value.every(role => selected.value.has(role.id)));
function reset() { selected.value = new Set(mode.value === "edit" ? profile.value?.roleIds || [] : []); }
function toggle(id: string) { const next = new Set(selected.value); next.has(id) ? next.delete(id) : next.add(id); selected.value = next; }
function togglePage() { const next = new Set(selected.value); (allVisibleSelected.value ? visibleRoles.value.forEach(role => next.delete(role.id)) : visibleRoles.value.forEach(role => next.add(role.id))); selected.value = next; }
async function save() {
  if (!profile.value) return;
  const data = { roleIds: [...selected.value] };
  if (mode.value === "add" && !data.roleIds.length) return;
  const message = mode.value === "add" ? "Los roles seleccionados fueron agregados al perfil." : "Los roles del perfil fueron actualizados.";
  if (await run(() => mode.value === "add" ? addProfileRolesBatch(profile.value!.id, data) : syncProfileRoles(profile.value!.id, data), message)) { mode.value = "edit"; reset(); }
}
watch([profileId, mode], () => { page.value = 1; reset(); });
watch([query, scope], () => page.value = 1);
watch(totalPages, () => { if (page.value > totalPages.value) page.value = totalPages.value; });
watch(() => catalogs.profiles, profiles => { if (!profiles.some(item => item.id === profileId.value)) profileId.value = profiles[0]?.id || ""; }, { immediate: true });
</script>
<template>
  <DataPanel title="Gestor de roles" :count="availableRoles.length" empty="No hay roles que coincidan con los filtros." show-content-when-empty>
    <div class="toolbar"><button class="back" type="button" @click="router.push({ name: 'profiles' })"><span>←</span> Volver al catálogo de perfiles</button><label>Perfil<select v-model="profileId"><option v-for="item in catalogs.profiles.filter(item => item.scope !== 'GLOBAL')" :key="item.id" :value="item.id">{{ item.name }} · {{ item.scope === 'TENANT' ? 'Tenant' : 'Aplicación' }}</option></select></label><div class="mode"><button :class="{active:mode==='add'}" @click="mode='add'">Asignar roles</button><button :class="{active:mode==='edit'}" @click="mode='edit'">Editar roles</button></div></div>
    <p class="help">{{ mode === 'add' ? 'Solo se muestran roles compatibles aún no agrupados; guardar agrega la selección sin retirar asociaciones.' : 'Los roles actuales aparecen seleccionados; guardar actualiza el conjunto del perfil.' }}</p>
    <p v-if="error" class="modal-error">{{ error }}</p>
    <div class="filters"><input v-model="query" placeholder="Buscar por nombre" /><select v-model="scope"><option value="">Todos los alcances</option><option value="TENANT">Tenant</option><option value="APPLICATION">Aplicación</option></select><button class="create-action" :disabled="busy || !profileId || (mode === 'add' && !selected.size)" @click="save">{{ busy ? 'Guardando…' : mode === 'add' ? 'Agregar seleccionados' : 'Guardar roles' }}</button></div>
    <div class="table-wrap"><table><thead><tr><th><input type="checkbox" :checked="allVisibleSelected" :disabled="!visibleRoles.length" @change="togglePage" /></th><th>Rol</th><th>Alcance</th><th>Contexto</th></tr></thead><tbody><tr v-for="role in visibleRoles" :key="role.id"><td><input type="checkbox" :checked="selected.has(role.id)" @change="toggle(role.id)" /></td><td>{{ role.name }}</td><td>{{ role.scope === 'TENANT' ? 'Tenant' : 'Aplicación' }}</td><td>{{ role.applicationId ? catalogs.appById[role.applicationId]?.name || role.applicationId : 'Tenant' }}</td></tr></tbody></table></div>
    <footer><span>{{ availableRoles.length }} roles · {{ selected.size }} seleccionados</span><div><button :disabled="page===1" @click="page--">Anterior</button><span>Página {{ page }} de {{ totalPages }}</span><button :disabled="page===totalPages" @click="page++">Siguiente</button></div></footer>
  </DataPanel>
</template>
<style scoped>
.toolbar,.filters{display:flex;flex-wrap:wrap;gap:12px;align-items:end;padding:18px;border-bottom:1px solid var(--soft-line)}label{display:grid;gap:6px;color:var(--ink);font-size:12px;font-weight:700}select,input{min-height:34px;border:1px solid var(--line);border-radius:5px;background:#fff;padding:0 9px;color:var(--ink)}.back{align-self:center;border:0;background:none;color:var(--green-ink);display:inline-flex;gap:8px;align-items:center;font-weight:600}.back span{font-size:20px}.mode{display:flex;border:1px solid var(--line);border-radius:6px;overflow:hidden}.mode button{border:0;padding:8px 10px;background:#fff;color:var(--text);font-size:11px}.mode .active{background:var(--green);color:#fff}.help{margin:14px 18px 0;color:var(--text);font-size:12px}.filters input{min-width:220px}.filters .create-action{margin-left:auto}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;padding:12px 18px;border-top:1px solid var(--soft-line)}th{color:var(--faint);font:10px 'IBM Plex Mono',monospace}footer{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px 18px;border-top:1px solid var(--soft-line);color:var(--text);font-size:11px}footer div{display:flex;align-items:center;gap:10px}footer button{border:1px solid var(--line);background:#fff;border-radius:4px;padding:5px 8px;font-size:11px}
</style>
