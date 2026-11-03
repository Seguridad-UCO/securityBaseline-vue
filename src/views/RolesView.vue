<script setup lang="ts">
import { useCatalogsStore } from "../stores/catalogs";
import { useDialogs } from "../composables/useDialogs";
import { useRouter } from "vue-router";
import DataPanel from "../components/DataPanel.vue";
import Icon from "../components/Icon.vue";
import { listRoles, removeRole } from "../api";
import { ref, watch } from "vue";
import type { Role } from "../api/contracts";
const catalogs = useCatalogsStore(),
  dialogs = useDialogs();
const router = useRouter();
const query = ref(""), page = ref(0), total = ref(0), roles = ref<Role[]>([]);
const limit = ref(20);
async function load() { const response = await listRoles({ offset: page.value * limit.value, limit: limit.value, query: query.value }); roles.value = response.data.content; total.value = response.data.total; }
watch(query, () => { page.value = 0; void load(); });
watch(page, () => void load(), { immediate: true });
watch(limit, () => { page.value = 0; void load(); });
const isProtectedRole = (role: Role) =>
  role.name.trim().toUpperCase() === "ADMIN" && Boolean(role.applicationId);
</script>
<template>
  <DataPanel
    title="Roles definidos"
    :count="total"
    empty="Define el primer rol del catálogo."
    action-text="Definir rol"
    @action="dialogs.open('role')"
    ><div class="catalog-toolbar"><label class="catalog-search"><Icon name="search" :size="16" /><input v-model.trim="query" type="search" placeholder="Buscar roles" aria-label="Buscar roles" /></label></div><div class="role-grid">
      <article v-for="role in roles" :key="role.id" class="role-card">
        <span :class="['scope-pill', `scope-${role.scope.toLowerCase()}`]"
          ><Icon name="key" :size="13" />{{
            role.scope === "APPLICATION"
              ? "Aplicación"
              : role.scope === "TENANT"
                ? "Tenant"
                : "Global"
          }}</span
        >
        <h3>{{ role.name }}</h3>
        <p>
          {{ role.resourceIds.length }} recurso{{
            role.resourceIds.length === 1 ? "" : "s"
          }}
          autorizado{{ role.resourceIds.length === 1 ? "" : "s" }}
        </p>
        <p class="role-context">{{ role.applicationId ? catalogs.appById[role.applicationId]?.name || "Aplicación" : role.tenantId ? "Disponible en las aplicaciones del tenant" : "No administrable desde este catálogo" }}</p>
        <footer>
          <span>{{
            role.applicationId
              ? "Alcance de aplicación"
              : role.tenantId
                ? "Alcance de tenant"
                : "Alcance global"
          }}</span
          ><button class="grant-action" :disabled="isProtectedRole(role) || role.scope === 'GLOBAL'" :title="isProtectedRole(role) ? 'El ADMIN creado para la aplicación es un rol protegido.' : role.scope === 'GLOBAL' ? 'Los roles globales no se administran aquí.' : 'Gestionar permisos'" @click="router.push({ name: 'rolePermissions', query: { roleId: role.id, applicationId: role.applicationId || undefined } })"><Icon name="key" :size="13" />Gestionar permisos</button><button class="grant-action" :disabled="isProtectedRole(role)" :title="isProtectedRole(role) ? 'El ADMIN creado para la aplicación es un rol protegido.' : 'Editar rol'" @click="dialogs.editRole(role)">Editar</button><button class="grant-action danger" :disabled="isProtectedRole(role)" :title="isProtectedRole(role) ? 'El ADMIN creado para la aplicación es un rol protegido.' : 'Eliminar rol'" @click="dialogs.confirm('Eliminar rol', 'No se puede eliminar si conserva recursos, perfiles o asignaciones activas.', () => removeRole(role.id))">Eliminar</button>
        </footer>
      </article>
    </div><footer class="catalog-footer"><span>{{ total }} roles</span><nav class="catalog-pagination" aria-label="Paginación de roles"><label>Mostrar <select v-model.number="limit"><option :value="10">10</option><option :value="20">20</option><option :value="50">50</option><option :value="100">100</option></select></label><button type="button" :disabled="page === 0" @click="page--">Anterior</button><span>Página <b>{{ page + 1 }}</b> de {{ Math.max(1, Math.ceil(total / limit)) }}</span><button type="button" :disabled="(page + 1) * limit >= total" @click="page++">Siguiente</button></nav></footer></DataPanel
  >
</template>

<style scoped>
.role-context { min-height: 32px; color: var(--faint); font-size: 11px; margin-top: 10px; }
.danger { color: var(--red); }
.catalog-toolbar { display:flex; align-items:center; padding:0 26px 16px; }.catalog-search { display:flex; flex:1 1 280px; align-items:center; gap:8px; max-width:375px; height:40px; padding:0 11px; border:1px solid var(--line); border-radius:7px; background:var(--field); }.catalog-search:focus-within { border-color:var(--green); background:var(--paper); box-shadow:0 0 0 3px rgba(1,139,81,.14); }.catalog-search svg { color:var(--green); }.catalog-search input { flex:1; min-width:0; height:38px; border:0; outline:0; background:transparent; color:var(--ink); font-size:13px; }.catalog-footer { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:16px; padding:15px 26px; border-top:1px solid var(--soft-line); background:var(--field); color:var(--text); font-size:11px; }.catalog-pagination { grid-column:2; display:flex; align-items:center; gap:10px; color:var(--text); font-size:11px; white-space:nowrap; }.catalog-pagination label { display:flex; align-items:center; gap:5px; }.catalog-pagination select { height:28px; border:1px solid var(--line); border-radius:4px; background:var(--paper); color:var(--ink); font-size:11px; }.catalog-pagination span { text-align:center; }.catalog-pagination b { color:var(--ink); }.catalog-pagination button { padding:5px 8px; border:1px solid var(--line); border-radius:4px; background:var(--paper); color:var(--text); font-size:11px; cursor:pointer; }.catalog-pagination button:hover:not(:disabled) { border-color:var(--green); color:var(--green-ink); }.catalog-pagination button:disabled { cursor:not-allowed; opacity:.42; }
</style>
