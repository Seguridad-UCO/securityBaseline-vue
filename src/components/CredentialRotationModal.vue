<script setup lang="ts">
import { ref } from "vue";
import * as api from "../api";
import type { Application } from "../api/contracts";
import { useMutation } from "../composables/useMutation";
import Modal from "./Modal.vue";

const props = defineProps<{ application: Application }>();
const emit = defineEmits<{
  close: [];
  credential: [payload: { name: string; credential: string }];
}>();
const { busy, error, saved, run } = useMutation();
const rotated = ref<{ name: string; credential: string } | null>(null);

async function rotate() {
  const completed = await run(async () => {
    const response = await api.rotateApplicationCredential(props.application.id);
    rotated.value = {
      name: props.application.name,
      credential: response.data.credential,
    };
  }, "Credencial rotada correctamente.");
  if (completed && rotated.value) {
    emit("credential", rotated.value);
    emit("close");
  }
}
</script>

<template>
  <Modal
    eyebrow="CREDENCIAL TÉCNICA"
    :title="`Rotar credencial de ${application.name}`"
    description="Genera una nueva credencial para el backend protegido de esta aplicación."
    submit-label="Rotar y mostrar credencial"
    :error="error"
    :busy="busy"
    :saved="saved"
    danger
    @close="emit('close')"
    @submit="rotate"
  >
    <p class="rotation-warning">
      La credencial anterior dejará de funcionar inmediatamente. Actualiza
      <code>PEP_REGISTRATION_TOKEN</code> en el backend antes de reiniciarlo.
    </p>
  </Modal>
</template>

<style scoped>
.rotation-warning {
  margin: 0;
  padding: 12px 14px;
  border: 1px solid rgba(185, 61, 60, .22);
  border-radius: 8px;
  background: rgba(185, 61, 60, .055);
  color: #793433;
  font-size: 13px;
  line-height: 1.55;
}
.rotation-warning code { font: 500 12px 'IBM Plex Mono', monospace; }
</style>
