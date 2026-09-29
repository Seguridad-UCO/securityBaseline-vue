<script setup lang="ts">
import { useCatalogsStore } from "../stores/catalogs";
import { useDialogs } from "../composables/useDialogs";
import DataPanel from "../components/DataPanel.vue";
import Icon from "../components/Icon.vue";
import { removeApplication } from "../api";
const catalogs = useCatalogsStore(),
  dialogs = useDialogs();

const applicationHasAssociations = (applicationId: string) =>
  catalogs.resources.some((resource) => resource.applicationId === applicationId) ||
  catalogs.roles.some((role) => role.applicationId === applicationId) ||
  catalogs.profiles.some((profile) => profile.applicationId === applicationId) ||
  catalogs.assignments.some((assignment) => assignment.applicationId === applicationId) ||
  catalogs.profileAssignments.some((assignment) => assignment.applicationId === applicationId);
</script>
<template>
  <DataPanel
    title="Aplicaciones registradas"
    :count="catalogs.apps.length"
    empty="No hay aplicaciones en este tenant todavía."
    action-text="Registrar aplicación"
    @action="dialogs.open('application')"
    ><div class="app-grid">
      <article v-for="app in catalogs.apps" :key="app.id" class="service-card">
        <span class="service-status"><i /> Activa</span>
        <h3>{{ app.name }}</h3>
        <p>{{ app.description }}</p>
        <code>{{ app.baseUrl }}</code>
        <footer>
          <span>Aplicación protegida</span><button class="grant-action" @click="dialogs.editApplication(app)">Editar</button><button class="grant-action danger" :disabled="applicationHasAssociations(app.id)" :title="applicationHasAssociations(app.id) ? 'Elimina primero los recursos, roles, perfiles y asignaciones asociados.' : 'Eliminar aplicación'" @click="dialogs.confirm('Eliminar aplicación', 'Se eliminará físicamente cuando no tenga recursos, roles, perfiles ni asignaciones dependientes.', () => removeApplication(app.id))">Eliminar</button><Icon name="shield" :size="15" />
        </footer>
      </article></div
  ></DataPanel>
</template>
<style scoped>.danger { color: var(--red); }</style>
