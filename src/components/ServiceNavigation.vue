<script setup lang="ts">
import { useRoute } from "vue-router";

const route = useRoute();
const links = [
  { name: "serviceIdentities", label: "Identidades" },
  { name: "serviceTechnicalRoles", label: "Roles técnicos" },
  { name: "serviceAccessAssignments", label: "Asignaciones" },
  { name: "serviceAccessRequests", label: "Solicitar acceso" },
  { name: "serviceAccessApprovals", label: "Aprobaciones" },
] as const;
</script>

<template>
  <nav class="service-nav" aria-label="Flujo de identidades de servicio">
    <RouterLink
      v-for="link in links"
      :key="link.name"
      :to="{ name: link.name }"
      :class="{ active: route.name === link.name }"
    >
      {{ link.label }}
    </RouterLink>
  </nav>
</template>

<style scoped>
.service-nav { display: flex; gap: 2px; border-bottom: 1px solid var(--line); }
.service-nav a { color: var(--text); padding: 0 14px 12px; text-decoration: none; font-size: 13px; white-space: nowrap; }
.service-nav a.active { color: var(--ink); border-bottom: 2px solid var(--green); font-weight: 600; }
@media (max-width: 720px) { .service-nav { overflow-x: auto; } }
</style>
