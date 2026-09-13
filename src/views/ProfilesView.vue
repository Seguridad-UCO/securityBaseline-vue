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
    title="Perfiles definidos"
    :count="catalogs.profiles.length"
    empty="Define el primer perfil del catálogo."
    action-text="Definir perfil"
    @action="dialogs.open('profile')"
    ><div class="role-grid">
      <article
        v-for="profile in catalogs.profiles"
        :key="profile.id"
        class="role-card"
      >
        <span :class="['scope-pill', `scope-${profile.scope.toLowerCase()}`]"
          ><Icon name="layers" :size="13" />{{
            profile.scope === "APPLICATION"
              ? "Aplicación"
              : profile.scope === "TENANT"
                ? "Tenant"
                : "Global"
          }}</span
        >
        <h3>{{ profile.name }}</h3>
        <p>
          {{ profile.roleIds.length }} rol{{
            profile.roleIds.length === 1 ? "" : "es"
          }}
          agrupado{{ profile.roleIds.length === 1 ? "" : "s" }}
        </p>
        <footer>
          <span>{{
            profile.applicationId
              ? "Alcance de aplicación"
              : profile.tenantId
                ? "Alcance de tenant"
                : "Alcance global"
          }}</span
          ><button
            class="grant-action"
            @click="dialogs.grantProfile(profile)"
          >
            <Icon name="plus" :size="13" />Rol
          </button>
        </footer>
      </article>
    </div></DataPanel
  >
</template>
