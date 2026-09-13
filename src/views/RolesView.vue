<script setup lang="ts">
import { useCatalogsStore } from "../stores/catalogs";
import { useDialogs } from "../composables/useDialogs";
import DataPanel from "../components/DataPanel.vue";
import Icon from "../components/Icon.vue";
const catalogs = useCatalogsStore(),
  dialogs = useDialogs();
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
        <footer>
          <span>{{
            role.applicationId
              ? "Alcance de aplicación"
              : role.tenantId
                ? "Alcance de tenant"
                : "Alcance global"
          }}</span
          ><button class="grant-action" @click="dialogs.grant(role)">
            <Icon name="plus" :size="13" />Recurso
          </button>
        </footer>
      </article>
    </div></DataPanel
  >
</template>
