<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 18 });
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'shield'">
      <path
        d="M12 3 4.5 6v5.6c0 4.4 3.1 7.6 7.5 9.4 4.4-1.8 7.5-5 7.5-9.4V6L12 3Z"
      />
      <path d="m8.7 12.1 2.1 2.1 4.5-4.7" />
    </template>
    <template v-if="name === 'home'">
      <path d="m3 11 9-7 9 7v9H3z" />
      <path d="M9 20v-6h6v6" />
    </template>
    <template v-if="name === 'apps'">
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </template>
    <template v-if="name === 'route'">
      <path
        d="M5 6h10M15 6l-2.5-2.5M15 6l-2.5 2.5M19 18H9M9 18l2.5-2.5M9 18l2.5 2.5"
      />
    </template>
    <template v-if="name === 'tenants'">
      <circle cx="12" cy="12" r="8" />
      <path
        d="M4 12h16M12 4c2.2 2.2 3.4 5 3.4 8s-1.2 5.8-3.4 8c-2.2-2.2-3.4-5-3.4-8S9.8 6.2 12 4"
      />
    </template>
    <template v-if="name === 'users'">
      <circle cx="9" cy="8" r="3" />
      <path
        d="M3.8 20a5.2 5.2 0 0 1 10.4 0M16 4.5a3 3 0 0 1 0 5.8M17 14.9a5 5 0 0 1 3.2 5.1"
      />
    </template>
    <template v-if="name === 'plus'"><path d="M12 5v14M5 12h14" /></template>
    <template v-if="name === 'arrow'">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </template>
    <template v-if="name === 'refresh'">
      <path d="M20 11a8 8 0 0 0-14.9-3.8L3 10" />
      <path d="M3 4v6h6" />
      <path d="M4 13a8 8 0 0 0 14.9 3.8L21 14" />
      <path d="M21 20v-6h-6" />
    </template>
    <template v-if="name === 'check'">
      <path d="m5 12 4.2 4.2L19 6.5" />
    </template>
    <template v-if="name === 'close'">
      <path d="m6 6 12 12M18 6 6 18" />
    </template>
    <template v-if="name === 'layers'">
      <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" />
      <path d="m4 12 8 4.5 8-4.5" />
    </template>
    <template v-if="name === 'key'">
      <circle cx="7.5" cy="15.5" r="4.2" />
      <path d="m10.6 12.4 8-8M15.2 7.8l2.3 2.3M18.1 4.9l2.3 2.3" />
    </template>
    <template v-if="name === 'link'">
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M12 6.5h2.5a4.5 4.5 0 1 1 0 9H12" />
      <path d="M12 17.5H9.5a4.5 4.5 0 1 1 0-9H12" />
    </template>
    <template v-if="name === 'bolt'">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </template>
  </svg>
</template>
