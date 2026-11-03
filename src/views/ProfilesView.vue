<script setup lang="ts">
import { useCatalogsStore } from "../stores/catalogs";
import { useDialogs } from "../composables/useDialogs";
import { useRouter } from "vue-router";
import DataPanel from "../components/DataPanel.vue";
import Icon from "../components/Icon.vue";
import { listProfiles, removeProfile } from "../api";
import { ref, watch } from "vue";
const catalogs = useCatalogsStore(),
  dialogs = useDialogs();
const router = useRouter();
const query = ref(""), page = ref(0), total = ref(0), profiles = ref<import("../api/contracts").Profile[]>([]);
const limit = ref(20);
async function load() { const response = await listProfiles({ offset: page.value * limit.value, limit: limit.value, query: query.value }); profiles.value = response.data.content; total.value = response.data.total; }
watch(query, () => { page.value = 0; void load(); });
watch(page, () => void load(), { immediate: true });
watch(limit, () => { page.value = 0; void load(); });
const profileHasAssociations = (profile: { id: string; roleIds: string[] }) =>
  profile.roleIds.length > 0 || catalogs.profileAssignments.some(
    (assignment) => assignment.profileId === profile.id && (!assignment.validUntil || new Date(assignment.validUntil) > new Date()),
  );
</script>
<template>
  <DataPanel
    title="Perfiles definidos"
    :count="total"
    empty="Define el primer perfil del catálogo."
    action-text="Definir perfil"
    @action="dialogs.open('profile')"
    ><div class="catalog-toolbar"><label class="catalog-search"><Icon name="search" :size="16" /><input v-model.trim="query" type="search" placeholder="Buscar perfiles" aria-label="Buscar perfiles" /></label></div><div class="role-grid">
      <article
        v-for="profile in profiles"
        :key="profile.id"
        class="role-card"
      >
        <span :class="['scope-pill', `scope-${profile.scope.toLowerCase()}`]"
          ><Icon name="layers" :size="13" />{{
            profile.scope === "APPLICATION"
              ? "Aplicación"
              : profile.scope === "TENANT"
                ? "Tenant"
                : "Global"
          }}</span
        >
        <h3>{{ profile.name }}</h3>
        <p>
          {{ profile.roleIds.length }} rol{{
            profile.roleIds.length === 1 ? "" : "es"
          }}
          agrupado{{ profile.roleIds.length === 1 ? "" : "s" }}
        </p>
        <p class="role-context">{{ profile.applicationId ? catalogs.appById[profile.applicationId]?.name || "Aplicación" : profile.tenantId ? "Disponible en el tenant" : "No administrable desde este catálogo" }}</p>
        <footer>
          <span>{{
            profile.applicationId
              ? "Alcance de aplicación"
              : profile.tenantId
                ? "Alcance de tenant"
                : "Alcance global"
          }}</span
          ><button class="grant-action" :disabled="profile.scope === 'GLOBAL'" @click="router.push({ name: 'profileRoles', query: { profileId: profile.id } })"><Icon name="layers" :size="13" />Gestionar roles</button><button class="grant-action" @click="dialogs.editProfile(profile)">Editar</button><button class="grant-action danger" :disabled="profileHasAssociations(profile)" :title="profileHasAssociations(profile) ? 'Retira primero los roles y las asignaciones activas.' : 'Eliminar perfil'" @click="dialogs.confirm('Eliminar perfil', 'No se puede eliminar si conserva roles o asignaciones activas.', () => removeProfile(profile.id))">Eliminar</button>
        </footer>
      </article>
    </div><footer class="catalog-footer"><span>{{ total }} perfiles</span><nav class="catalog-pagination" aria-label="Paginación de perfiles"><label>Mostrar <select v-model.number="limit"><option :value="10">10</option><option :value="20">20</option><option :value="50">50</option><option :value="100">100</option></select></label><button type="button" :disabled="page === 0" @click="page--">Anterior</button><span>Página <b>{{ page + 1 }}</b> de {{ Math.max(1, Math.ceil(total / limit)) }}</span><button type="button" :disabled="(page + 1) * limit >= total" @click="page++">Siguiente</button></nav></footer></DataPanel
  >
</template>

<style scoped>
.role-context { min-height: 32px; color: var(--faint); font-size: 11px; margin-top: 10px; }
.danger { color: var(--red); }
.catalog-toolbar { display:flex; align-items:center; padding:0 26px 16px; }.catalog-search { display:flex; flex:1 1 280px; align-items:center; gap:8px; max-width:375px; height:40px; padding:0 11px; border:1px solid var(--line); border-radius:7px; background:var(--field); }.catalog-search:focus-within { border-color:var(--green); background:var(--paper); box-shadow:0 0 0 3px rgba(1,139,81,.14); }.catalog-search svg { color:var(--green); }.catalog-search input { flex:1; min-width:0; height:38px; border:0; outline:0; background:transparent; color:var(--ink); font-size:13px; }.catalog-footer { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:16px; padding:15px 26px; border-top:1px solid var(--soft-line); background:var(--field); color:var(--text); font-size:11px; }.catalog-pagination { grid-column:2; display:flex; align-items:center; gap:10px; color:var(--text); font-size:11px; white-space:nowrap; }.catalog-pagination label { display:flex; align-items:center; gap:5px; }.catalog-pagination select { height:28px; border:1px solid var(--line); border-radius:4px; background:var(--paper); color:var(--ink); font-size:11px; }.catalog-pagination span { text-align:center; }.catalog-pagination b { color:var(--ink); }.catalog-pagination button { padding:5px 8px; border:1px solid var(--line); border-radius:4px; background:var(--paper); color:var(--text); font-size:11px; cursor:pointer; }.catalog-pagination button:hover:not(:disabled) { border-color:var(--green); color:var(--green-ink); }.catalog-pagination button:disabled { cursor:not-allowed; opacity:.42; }
</style>
