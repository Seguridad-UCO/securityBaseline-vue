<script setup lang="ts">
import { ref } from "vue";
import { assignUserTenant } from "../api";
import { useCatalogsStore } from "../stores/catalogs";
import { useMutation } from "../composables/useMutation";
import { formatDate } from "../composables/formatDate";
import DataPanel from "../components/DataPanel.vue";
import Alert from "../components/Alert.vue";
const catalogs = useCatalogsStore();
const { busy, error, saved, run } = useMutation();
const retry = ref<(() => Promise<unknown>) | null>(null);
async function assign(userId: string, tenantId: string, event: Event) {
  const select = event.target as HTMLSelectElement;
  const code = select.value;
  select.value = tenantId;
  retry.value = () => assignUserTenant(userId, code);
  await run(retry.value, "Tenant asignado correctamente.");
}
</script>
<template>
  <Alert
    v-if="error"
    type="error"
    :message="error"
    @close="error = ''"
  /><button
    v-if="saved && retry"
    class="refresh-action"
    :disabled="busy"
    @click="run(retry, 'Tenant asignado correctamente.')"
  >
    Reintentar actualización</button
  ><DataPanel
    title="Usuarios conocidos"
    :count="catalogs.users.length"
    empty="Las identidades aparecen después de su primer inicio de sesión."
    ><div class="users-table">
      <article v-for="user in catalogs.users" :key="user.id">
        <span class="user-initial">{{
          (user.name || user.email).slice(0, 2).toUpperCase()
        }}</span>
        <div class="user-detail">
          <strong>{{ user.name || "Sin nombre" }}</strong
          ><small>{{ user.email }}</small>
        </div>
        <span class="provider-pill">{{ user.provider || "Federado" }}</span
        ><span class="login-date">{{
          user.lastLoginAt ? formatDate(user.lastLoginAt) : "—"
        }}</span
        ><label class="tenant-picker"
          ><span class="sr-only">Tenant</span
          ><select
            aria-label="Tenant"
            :value="user.tenantId"
            :disabled="busy || saved"
            @change="assign(user.id, user.tenantId, $event)"
          >
            <option
              v-for="tenant in catalogs.tenants"
              :key="tenant.code"
              :value="tenant.code"
            >
              {{ tenant.name }}
            </option>
          </select></label
        >
      </article>
    </div></DataPanel
  >
</template>
