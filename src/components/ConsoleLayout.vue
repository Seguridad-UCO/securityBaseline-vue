<script setup lang="ts">
import { computed, provide, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { getApiBaseUrl } from "../api";
import type { Role } from "../api/contracts";
import { useCatalogsStore } from "../stores/catalogs";
import { useSessionStore } from "../stores/session";
import { modules } from "../router/modules";
import { dialogsKey } from "../composables/useDialogs";
import type { DialogKind } from "../composables/useDialogs";
import Icon from "./Icon.vue";
import Alert from "./Alert.vue";
import EntityModal from "./EntityModal.vue";
const catalogs = useCatalogsStore(),
  session = useSessionStore(),
  route = useRoute();
defineEmits<{ signOut: [] }>();
const modal = ref<DialogKind | null>(null),
  grantFor = ref<Role | null>(null);
const current = computed(
  () => modules.find((module) => module.id === route.name) ?? modules[0],
);
function open(kind: DialogKind) {
  if (kind === "resource" && !catalogs.apps.length) {
    catalogs.error =
      "Primero registra una aplicación para poder asociar un recurso.";
    return;
  }
  if (kind === "assignment" && !catalogs.roles.length) {
    catalogs.error =
      "Primero registra un rol para poder asignarlo a un usuario.";
    return;
  }
  modal.value = kind;
}
function close() {
  modal.value = null;
  grantFor.value = null;
}
provide(dialogsKey, {
  open,
  grant: (role) => {
    grantFor.value = role;
  },
});
const kinds: Record<string, DialogKind> = {
  applications: "application",
  resources: "resource",
  roles: "role",
  assignments: "assignment",
  tenants: "tenant",
};
function openCurrent() {
  const kind = kinds[current.value.id];
  if (kind) open(kind);
}
watch(() => route.path, close);
</script>
<template>
  <main class="console-shell">
    <aside class="console-sidebar">
      <div class="brand">
        <span class="brand-mark"><Icon name="shield" :size="21" /></span
        ><span>SECURITY<br /><b>BASELINE</b></span>
      </div>
      <div class="nav-caption">CENTRO DE CONTROL</div>
      <nav aria-label="Módulos de Security Baseline">
        <RouterLink
          v-for="module in modules"
          :key="module.id"
          :to="module.path"
          :aria-label="module.label"
          :class="['side-link', { selected: current.id === module.id }]"
          style="text-decoration: none"
          ><Icon :name="module.icon" /><span>{{ module.label }}</span
          ><b v-if="module.id === 'resources' && catalogs.resources.length">{{
            catalogs.resources.length
          }}</b
          ><b
            v-if="module.id === 'assignments' && catalogs.assignments.length"
            >{{ catalogs.assignments.length }}</b
          ></RouterLink
        >
      </nav>
      <div class="side-session">
        <span class="live-dot" /> Sesión activa<code>{{
          getApiBaseUrl()
        }}</code>
      </div>
    </aside>
    <section class="console-workspace">
      <header class="console-header">
        <div class="breadcrumb">
          SECURITY BASELINE <span>/</span> {{ current.label.toUpperCase() }}
        </div>
        <div class="user-context">
          <span class="session-label"><i /> Sesión protegida</span
          ><span class="user-name">{{ session.userName }}</span
          ><button @click="$emit('signOut')">Salir</button
          ><span class="avatar">{{ session.initials }}</span>
        </div>
      </header>
      <div class="console-content">
        <Alert
          v-if="catalogs.error"
          type="error"
          :message="catalogs.error"
          @close="catalogs.error = ''"
        /><Alert
          v-if="catalogs.notice"
          type="success"
          :message="catalogs.notice"
          @close="catalogs.notice = ''"
        />
        <section v-if="current.id !== 'authorize'" class="module-heading">
          <div>
            <p class="eyebrow">{{ current.title }}</p>
            <h1>{{ current.title }}</h1>
            <p>{{ current.description }}</p>
          </div>
          <div class="heading-actions">
            <button
              class="refresh-action"
              :disabled="catalogs.loading"
              @click="catalogs.reload"
            >
              <Icon name="refresh" :size="16" />{{
                catalogs.loading ? "Actualizando" : "Actualizar"
              }}</button
            ><button
              v-if="'action' in current"
              class="create-action"
              @click="openCurrent"
            >
              <Icon name="plus" :size="17" />{{ current.action }}
            </button>
          </div>
        </section>
        <RouterView />
      </div>
    </section>
    <EntityModal
      v-if="modal || grantFor"
      :kind="modal ?? 'grant'"
      :role="grantFor"
      @close="close"
    />
  </main>
</template>

<style scoped>
@media (max-width: 900px) {
  .console-sidebar,
  .console-sidebar nav {
    min-width: 0;
  }
  .console-sidebar nav {
    overflow-x: auto;
  }
  .brand,
  .side-link {
    flex-shrink: 0;
  }
}
</style>
