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
        ><button class="grant-action" @click="dialogs.editResource(resource)">Editar</button><button class="grant-action danger" @click="dialogs.confirm('Eliminar recurso', 'No se puede eliminar mientras esté asociado a un rol.', () => removeResource(resource.applicationId, resource.id))">Eliminar</button>
      </article>
    </div></DataPanel
  >
</template>
<style scoped>.danger { color: var(--red); }</style>
