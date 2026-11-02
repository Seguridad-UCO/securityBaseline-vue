<script setup lang="ts">
import { useCatalogsStore } from "../stores/catalogs";
import { useDialogs } from "../composables/useDialogs";
import { useRouter } from "vue-router";
import DataPanel from "../components/DataPanel.vue";
import Icon from "../components/Icon.vue";
import { removeRole } from "../api";
import type { Role } from "../api/contracts";
const catalogs = useCatalogsStore(),
  dialogs = useDialogs();
const router = useRouter();
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
    </div></DataPanel
  >
</template>

<style scoped>
.role-context { min-height: 32px; color: var(--faint); font-size: 11px; margin-top: 10px; }
.danger { color: var(--red); }
</style>
