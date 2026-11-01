<script setup lang="ts">
import { useCatalogsStore } from "../stores/catalogs";
import { useDialogs } from "../composables/useDialogs";
import { useRouter } from "vue-router";
import DataPanel from "../components/DataPanel.vue";
import Icon from "../components/Icon.vue";
import { removeProfile } from "../api";
const catalogs = useCatalogsStore(),
  dialogs = useDialogs();
const router = useRouter();
const profileHasAssociations = (profile: { id: string; roleIds: string[] }) =>
  profile.roleIds.length > 0 || catalogs.profileAssignments.some(
    (assignment) => assignment.profileId === profile.id && (!assignment.validUntil || new Date(assignment.validUntil) > new Date()),
  );
</script>
<template>
  <DataPanel
    title="Perfiles definidos"
    :count="catalogs.profiles.length"
    empty="Define el primer perfil del catálogo."
    action-text="Definir perfil"
    @action="dialogs.open('profile')"
    ><div class="role-grid">
      <article
        v-for="profile in catalogs.profiles"
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
        <p class="profile-context">{{ profile.applicationId ? catalogs.appById[profile.applicationId]?.name || "Aplicación" : profile.tenantId ? "Disponible en el tenant" : "No administrable desde este catálogo" }}</p>
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
    </div></DataPanel
  >
</template>

<style scoped>
.profile-context { min-height:32px; margin-top:10px; color:var(--faint); font-size:11px; }
.danger { color: var(--red); }
</style>
