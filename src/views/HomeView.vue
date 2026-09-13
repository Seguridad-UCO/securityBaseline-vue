<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useCatalogsStore } from "../stores/catalogs";
import { useSessionStore } from "../stores/session";
import Icon from "../components/Icon.vue";
const catalogs = useCatalogsStore(),
  session = useSessionStore(),
  router = useRouter();
const cards = computed(() => [
  {
    id: "applications",
    label: "Aplicaciones",
    count: catalogs.apps.length,
    icon: "apps",
    description: "Registra servicios y su URL base.",
  },
  {
    id: "resources",
    label: "Recursos",
    count: catalogs.resources.length,
    icon: "route",
    description: "Consulta las rutas y métodos protegidos.",
  },
  {
    id: "roles",
    label: "Roles",
    count: catalogs.roles.length,
    icon: "key",
    description: "Define qué puede autorizar cada rol.",
  },
  {
    id: "assignments",
    label: "Asignaciones",
    count: catalogs.assignments.length,
    icon: "link",
    description: "Quién tiene qué rol, y desde cuándo.",
  },
  {
    id: "profiles",
    label: "Perfiles",
    count: catalogs.profiles.length,
    icon: "layers",
    description: "Agrupa varios roles para asignarlos juntos.",
  },
  {
    id: "tenants",
    label: "Tenants",
    count: catalogs.tenants.length,
    icon: "tenants",
    description: "Administra los espacios organizacionales.",
  },
  {
    id: "users",
    label: "Usuarios",
    count: catalogs.users.length,
    icon: "users",
    description: "Asigna un tenant a cada identidad.",
  },
]);
</script>
<template>
  <section class="welcome-panel">
    <div>
      <p class="eyebrow">
        TENANT ACTIVO · {{ session.profile?.tenantId || "universidad-uco" }}
      </p>
      <h2>
        Hola, {{ session.userName.split(" ")[0] }}.<br /><em
          >Tu perímetro está listo.</em
        >
      </h2>
      <p>
        Gestiona las superficies de acceso de forma centralizada, desde la
        aplicación hasta cada ruta HTTP — y qué rol puede usarla.
      </p>
    </div>
    <div class="signal-map">
      <span /><span /><span />
      <div>
        <Icon name="shield" :size="26" /><strong>{{
          catalogs.resources.length
        }}</strong
        ><small>rutas<br />protegidas</small>
      </div>
    </div>
  </section>
  <section class="quick-title">
    <p class="eyebrow">ACCESOS RÁPIDOS</p>
    <h2>Explora la plataforma</h2>
  </section>
  <div class="quick-grid">
    <button
      v-for="card in cards"
      :key="card.id"
      class="quick-card"
      @click="router.push({ name: card.id })"
    >
      <span class="quick-icon"><Icon :name="card.icon" /></span
      ><strong>{{ card.label }}</strong
      ><b>{{ card.count }}</b>
      <p>{{ card.description }}</p>
      <span class="card-arrow"><Icon name="arrow" :size="16" /></span>
    </button>
  </div>
</template>
