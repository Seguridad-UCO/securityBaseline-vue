<script setup lang="ts">
import { computed, provide, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { getApiBaseUrl } from "../api";
import type { Application, Profile, Resource, Role } from "../api/contracts";
import { useCatalogsStore } from "../stores/catalogs";
import { useSessionStore } from "../stores/session";
import { modules } from "../router/modules";
import { dialogsKey } from "../composables/useDialogs";
import type { DialogKind } from "../composables/useDialogs";
import Icon from "./Icon.vue";
import Alert from "./Alert.vue";
import EntityModal from "./EntityModal.vue";
import CredentialRevealModal from "./CredentialRevealModal.vue";
import ConfirmModal from "./ConfirmModal.vue";
const catalogs = useCatalogsStore(),
  session = useSessionStore(),
  route = useRoute();
defineEmits<{ signOut: [] }>();
const modal = ref<DialogKind | null>(null),
  grantFor = ref<Role | null>(null),
  profileGrantFor = ref<Profile | null>(null);
const applicationEditFor = ref<Application | null>(null),
  resourceEditFor = ref<Resource | null>(null),
  roleEditFor = ref<Role | null>(null),
  profileEditFor = ref<Profile | null>(null);
const credentialReveal = ref<{ name: string; credential: string } | null>(
  null,
);
const confirmation = ref<{ title: string; description: string; action: () => Promise<unknown> } | null>(null);
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
  if (kind === "profileAssignment" && !catalogs.profiles.length) {
    catalogs.error =
      "Primero define un perfil para poder asignarlo a un usuario.";
    return;
  }
  modal.value = kind;
}
function close() {
  modal.value = null;
  grantFor.value = null;
  profileGrantFor.value = null;
  applicationEditFor.value = null;
  resourceEditFor.value = null;
  roleEditFor.value = null;
  profileEditFor.value = null;
}
provide(dialogsKey, {
  open,
  grant: (role) => {
    grantFor.value = role;
  },
  grantProfile: (profile) => {
    profileGrantFor.value = profile;
  },
  editApplication: (application) => { applicationEditFor.value = application; },
  editResource: (resource) => { resourceEditFor.value = resource; },
  editRole: (role) => { roleEditFor.value = role; },
  editProfile: (profile) => { profileEditFor.value = profile; },
  confirm: (title, description, action) => {
    confirmation.value = { title, description, action };
  },
});
const kinds: Record<string, DialogKind> = {
  applications: "application",
  resources: "resource",
  roles: "role",
  assignments: "assignment",
  tenants: "tenant",
  profiles: "profile",
  profileAssignments: "profileAssignment",
};
function openCurrent() {
  const kind = kinds[current.value.id];
  if (kind) open(kind);
}
function currentModalKind(): DialogKind | "grant" | "profileGrant" | null {
  if (modal.value) return modal.value;
  if (grantFor.value) return "grant";
  if (profileGrantFor.value) return "profileGrant";
  if (applicationEditFor.value) return "application";
  if (resourceEditFor.value) return "resource";
  if (roleEditFor.value) return "role";
  if (profileEditFor.value) return "profile";
  return null;
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
      v-if="modal || grantFor || profileGrantFor || applicationEditFor || resourceEditFor || roleEditFor || profileEditFor"
      :kind="currentModalKind()!"
      :role="grantFor"
      :profile="profileGrantFor"
      :application="applicationEditFor"
      :resource="resourceEditFor"
      :editing-role="roleEditFor"
      :editing-profile="profileEditFor"
      @close="close"
      @credential="credentialReveal = $event"
    />
    <CredentialRevealModal
      v-if="credentialReveal"
      :reveal="credentialReveal"
      @close="credentialReveal = null"
    />
    <ConfirmModal
      v-if="confirmation"
      :title="confirmation.title"
      :description="confirmation.description"
      confirm-label="Retirar asociación"
      :action="confirmation.action"
      @close="confirmation = null"
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
