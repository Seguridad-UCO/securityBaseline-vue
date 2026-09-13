<script setup lang="ts">
import Icon from "./Icon.vue";
defineProps<{ type: "success" | "error"; message: string }>();
defineEmits<{ close: [] }>();
</script>
<template>
  <div :class="['notice', type]" :role="type === 'error' ? 'alert' : 'status'">
    <Icon :name="type === 'success' ? 'check' : 'close'" :size="16" /><span>{{
      message
    }}</span
    ><button aria-label="Cerrar aviso" @click="$emit('close')">
      <Icon name="close" :size="15" />
    </button>
  </div>
</template>
