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
    title="Tenants disponibles"
    :count="catalogs.tenants.length"
    empty="Crea el primer tenant adicional."
    action-text="Crear tenant"
    @action="dialogs.open('tenant')"
    ><div class="tenant-grid-new">
      <article v-for="tenant in catalogs.tenants" :key="tenant.code">
        <span class="tenant-symbol"><Icon name="tenants" /></span>
        <div>
          <code>{{ tenant.code }}</code>
          <h3>{{ tenant.name }}</h3>
          <p>
            <i /> {{ tenant.status === "ACTIVE" ? "Activo" : "Suspendido" }}
          </p>
        </div>
      </article>
    </div></DataPanel
  >
</template>
