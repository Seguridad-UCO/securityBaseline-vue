<script setup lang="ts">
import { useCatalogsStore } from "../stores/catalogs";
import { useDialogs } from "../composables/useDialogs";
import DataPanel from "../components/DataPanel.vue";
import Icon from "../components/Icon.vue";
import { removeResource } from "../api";
const catalogs = useCatalogsStore(),
  dialogs = useDialogs();
</script>
<template>
  <DataPanel
    title="Recursos protegidos"
    :count="catalogs.resources.length"
    empty="Registra el primer endpoint HTTP del perímetro."
    action-text="Registrar recurso"
    @action="dialogs.open('resource')"
    ><div class="route-table">
      <article
        v-for="resource in catalogs.resources"
        :key="resource.id"
        class="route-row"
      >
        <span :class="['http-method', `method-${resource.method}`]">{{
          resource.method
        }}</span>
        <div>
          <code>{{ resource.path }}</code
          ><small>{{
            catalogs.appById[resource.applicationId]?.name ||
            resource.application?.name ||
            "Aplicación"
          }}</small>
        </div>
        <span class="route-origin">{{
          catalogs.appById[resource.applicationId]?.baseUrl ||
          resource.application?.baseUrl ||
          ""
        }}</span
        ><span class="route-state"
          ><Icon name="check" :size="14" /> Protegido</span
        ><div class="resource-actions">
          <button class="icon-action" type="button" title="Editar recurso" aria-label="Editar recurso" @click="dialogs.editResource(resource)"><Icon name="edit" :size="16" /></button>
          <button class="icon-action danger" type="button" title="Eliminar recurso" aria-label="Eliminar recurso" @click="dialogs.confirm('Eliminar recurso', 'No se puede eliminar mientras esté asociado a un rol.', () => removeResource(resource.applicationId, resource.id))"><Icon name="trash" :size="16" /></button>
        </div>
      </article>
    </div></DataPanel
  >
</template>
<style scoped>
.resource-actions { display: flex; justify-content: flex-end; gap: 6px; }
.danger { color: var(--red); }
</style>
