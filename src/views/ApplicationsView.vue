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
          <span>Aplicación protegida</span><Icon name="shield" :size="15" />
        </footer>
      </article></div
  ></DataPanel>
</template>
