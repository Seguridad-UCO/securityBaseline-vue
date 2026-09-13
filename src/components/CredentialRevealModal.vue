<script setup lang="ts">
import { ref } from "vue";
import Icon from "./Icon.vue";
const props = defineProps<{ reveal: { name: string; credential: string } }>();
defineEmits<{ close: [] }>();
const copied = ref(false);
async function copy() {
  try {
    await navigator.clipboard.writeText(props.reveal.credential);
    copied.value = true;
  } catch {
    /* el navegador puede negar el portapapeles sin HTTPS; el botón queda como reintento */
  }
}
</script>
<template>
  <Teleport to="body"
    ><div class="modal-backdrop" role="presentation" @mousedown.self="$emit('close')">
      <section
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Credencial generada"
      >
        <header>
          <div>
            <p class="eyebrow">SOLO SE MUESTRA UNA VEZ</p>
            <h2>Credencial de "{{ reveal.name }}"</h2>
            <p>
              Cópiala ahora: el PDP no vuelve a mostrarla — solo guarda su
              hash. Esta es la credencial que el PEP usará para autenticar
              esta aplicación.
            </p>
          </div>
          <button
            class="modal-close"
            aria-label="Cerrar"
            @click="$emit('close')"
          >
            <Icon name="close" />
          </button>
        </header>
        <div class="credential-reveal">
          <code>{{ reveal.credential }}</code>
          <button type="button" class="create-action" @click="copy">
            <Icon :name="copied ? 'check' : 'link'" :size="15" />{{
              copied ? "Copiada" : "Copiar"
            }}
          </button>
        </div>
        <footer class="credential-reveal-footer">
          <button class="create-action" @click="$emit('close')">
            Entendido<Icon name="arrow" :size="16" />
          </button>
        </footer>
      </section></div
  ></Teleport>
</template>
