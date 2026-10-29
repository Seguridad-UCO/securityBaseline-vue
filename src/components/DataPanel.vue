<script setup lang="ts">
import Icon from "./Icon.vue";
defineProps<{
  title: string;
  count: number;
  empty: string;
  actionText?: string;
  secondaryActionText?: string;
  showContentWhenEmpty?: boolean;
}>();
defineEmits<{ action: []; secondaryAction: [] }>();
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
      <div class="panel-actions"><button v-if="secondaryActionText" class="panel-secondary-action" @click="$emit('secondaryAction')"><span>↥</span>{{ secondaryActionText }}</button><button v-if="actionText" class="panel-action" @click="$emit('action')">
        <Icon name="plus" :size="15" />{{ actionText }}
      </button></div>
    </header>
    <slot v-if="count || showContentWhenEmpty" />
    <div v-else class="empty-state">
      <Icon name="layers" :size="28" /><strong>{{ empty }}</strong
      ><span>Usa la acción principal para comenzar.</span>
    </div>
  </section>
</template>
<style scoped>
.panel-actions { display:flex; gap:8px; align-items:center; }.panel-secondary-action { height:39px; border:1px solid var(--line); background:var(--paper); color:var(--text); border-radius:6px; padding:0 12px; display:inline-flex; align-items:center; gap:7px; font-size:12px; transition:.16s ease; }.panel-secondary-action span { color:var(--green); font:600 16px 'IBM Plex Mono',monospace; }.panel-secondary-action:hover { border-color:rgba(1,139,81,.42); color:var(--green-ink); background:var(--green-tint); }
</style>
