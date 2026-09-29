<script setup lang="ts">
import { useCatalogsStore } from "../stores/catalogs";
import { useDialogs } from "../composables/useDialogs";
import DataPanel from "../components/DataPanel.vue";
import Icon from "../components/Icon.vue";
import { removeRole, revokeResourceFromRole } from "../api";
import type { Role } from "../api/contracts";
const catalogs = useCatalogsStore(),
  dialogs = useDialogs();
const isProtectedRole = (role: Role) =>
  role.name.trim().toUpperCase() === "ADMIN" && Boolean(role.applicationId);
</script>
<template>
  <DataPanel
    title="Roles definidos"
    :count="catalogs.roles.length"
    empty="Define el primer rol del catálogo."
    action-text="Definir rol"
    @action="dialogs.open('role')"
    ><div class="role-grid">
      <article v-for="role in catalogs.roles" :key="role.id" class="role-card">
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
        <div v-if="role.resourceIds.length" class="association-list">
          <button v-for="resourceId in role.resourceIds" :key="resourceId" class="association-chip" :disabled="isProtectedRole(role)" :title="isProtectedRole(role) ? 'El ADMIN creado para la aplicación es un rol protegido.' : 'Retirar recurso'"
            @click="dialogs.confirm('Retirar recurso', 'El recurso dejará de estar asociado a este rol.', () => revokeResourceFromRole(role.id, resourceId))">
            {{ catalogs.resources.find((resource) => resource.id === resourceId)?.path || resourceId }} <Icon name="close" :size="12" />
          </button>
        </div>
        <footer>
          <span>{{
            role.applicationId
              ? "Alcance de aplicación"
              : role.tenantId
                ? "Alcance de tenant"
                : "Alcance global"
          }}</span
          ><button class="grant-action" :disabled="isProtectedRole(role)" :title="isProtectedRole(role) ? 'El ADMIN creado para la aplicación es un rol protegido.' : 'Asignar recurso'" @click="dialogs.grant(role)">
            <Icon name="plus" :size="13" />Recurso
          </button><button class="grant-action" :disabled="isProtectedRole(role)" :title="isProtectedRole(role) ? 'El ADMIN creado para la aplicación es un rol protegido.' : 'Editar rol'" @click="dialogs.editRole(role)">Editar</button><button class="grant-action danger" :disabled="isProtectedRole(role)" :title="isProtectedRole(role) ? 'El ADMIN creado para la aplicación es un rol protegido.' : 'Eliminar rol'" @click="dialogs.confirm('Eliminar rol', 'No se puede eliminar si conserva recursos, perfiles o asignaciones activas.', () => removeRole(role.id))">Eliminar</button>
        </footer>
      </article>
    </div></DataPanel
  >
</template>

<style scoped>
.association-list { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 12px; }
.association-chip { border: 1px solid rgba(185,61,60,.2); background: rgba(185,61,60,.04); color: #6c302f; border-radius: 999px; padding: 4px 7px; font: 10px 'IBM Plex Mono', monospace; display: inline-flex; align-items: center; gap: 4px; max-width: 100%; overflow: hidden; }
.association-chip:hover { background: rgba(185,61,60,.1); color: var(--red); }
.danger { color: var(--red); }
</style>
