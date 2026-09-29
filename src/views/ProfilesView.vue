<script setup lang="ts">
import { useCatalogsStore } from "../stores/catalogs";
import { useDialogs } from "../composables/useDialogs";
import DataPanel from "../components/DataPanel.vue";
import Icon from "../components/Icon.vue";
import { removeProfile, removeRoleFromProfile } from "../api";
const catalogs = useCatalogsStore(),
  dialogs = useDialogs();
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
        <div v-if="profile.roleIds.length" class="association-list">
          <button v-for="roleId in profile.roleIds" :key="roleId" class="association-chip"
            @click="dialogs.confirm('Retirar rol', 'El rol dejará de pertenecer a este perfil.', () => removeRoleFromProfile(profile.id, roleId))">
            {{ catalogs.roles.find((role) => role.id === roleId)?.name || roleId }} <Icon name="close" :size="12" />
          </button>
        </div>
        <footer>
          <span>{{
            profile.applicationId
              ? "Alcance de aplicación"
              : profile.tenantId
                ? "Alcance de tenant"
                : "Alcance global"
          }}</span
          ><button
            class="grant-action"
            @click="dialogs.grantProfile(profile)"
          >
            <Icon name="plus" :size="13" />Rol
          </button><button class="grant-action" @click="dialogs.editProfile(profile)">Editar</button><button class="grant-action danger" :disabled="profileHasAssociations(profile)" :title="profileHasAssociations(profile) ? 'Retira primero los roles y las asignaciones activas.' : 'Eliminar perfil'" @click="dialogs.confirm('Eliminar perfil', 'No se puede eliminar si conserva roles o asignaciones activas.', () => removeProfile(profile.id))">Eliminar</button>
        </footer>
      </article>
    </div></DataPanel
  >
</template>

<style scoped>
.association-list { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 12px; }
.association-chip { border: 1px solid rgba(185,61,60,.2); background: rgba(185,61,60,.04); color: #784140; border-radius: 999px; padding: 4px 7px; font: 10px 'IBM Plex Mono'; display: inline-flex; align-items: center; gap: 4px; max-width: 100%; overflow: hidden; }
.association-chip:hover { background: rgba(185,61,60,.1); color: var(--red); }
.danger { color: var(--red); }
</style>
