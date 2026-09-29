<script setup lang="ts">
import Modal from "./Modal.vue";
import { useMutation } from "../composables/useMutation";

const props = defineProps<{ title: string; description: string; confirmLabel: string; action: () => Promise<unknown> }>();
const emit = defineEmits<{ close: [] }>();
const { busy, error, saved, run } = useMutation();
async function confirm() {
  if (await run(props.action, "La operación se completó correctamente.")) emit("close");
}
</script>
<template>
  <Modal :title="title" :description="description" :submit-label="confirmLabel" :error="error" :busy="busy" :saved="saved" danger @close="emit('close')" @submit="confirm" />
</template>

<style scoped>
:deep(.danger-action) { border: 0; border-radius: 6px; background: var(--red); color: #fff; padding: 0 15px; height: 40px; font-weight: 600; font-size: 12px; }
</style>
