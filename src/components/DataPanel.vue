<script setup lang="ts">
import Icon from "./Icon.vue";
defineProps<{
  title: string;
  count: number;
  empty: string;
  actionText?: string;
}>();
defineEmits<{ action: [] }>();
</script>
<template>
  <section class="data-panel">
    <header>
      <div>
        <p class="eyebrow">CATÁLOGO</p>
        <h2>
          {{ title }} <b>{{ count }}</b>
        </h2>
      </div>
      <button v-if="actionText" class="panel-action" @click="$emit('action')">
        <Icon name="plus" :size="15" />{{ actionText }}
      </button>
    </header>
    <slot v-if="count" />
    <div v-else class="empty-state">
      <Icon name="layers" :size="28" /><strong>{{ empty }}</strong
      ><span>Usa la acción principal para comenzar.</span>
    </div>
  </section>
</template>
