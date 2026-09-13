<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import Icon from "./Icon.vue";
const props = defineProps<{
  title: string;
  description: string;
  submitLabel: string;
  error: string;
  busy: boolean;
  saved?: boolean;
}>();
const emit = defineEmits<{ close: []; submit: [] }>();
const dialog = ref<HTMLElement>();
let previousFocus: HTMLElement | null = null;
function close() {
  if (!props.busy) emit("close");
}
function keydown(event: KeyboardEvent) {
  if (event.key === "Escape") close();
  if (event.key !== "Tab") return;
  const elements = Array.from(
    dialog.value?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
    ) ?? [],
  );
  const first = elements[0],
    last = elements.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
onMounted(() => {
  previousFocus = document.activeElement as HTMLElement;
  dialog.value?.querySelector<HTMLElement>("input, select, button")?.focus();
  document.addEventListener("keydown", keydown);
});
onUnmounted(() => {
  document.removeEventListener("keydown", keydown);
  previousFocus?.focus();
});
</script>
<template>
  <Teleport to="body"
    ><div class="modal-backdrop" role="presentation" @mousedown.self="close">
      <section
        ref="dialog"
        class="modal"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <header>
          <div>
            <p class="eyebrow">NUEVO REGISTRO</p>
            <h2>{{ title }}</h2>
            <p>{{ description }}</p>
          </div>
          <button
            class="modal-close"
            aria-label="Cerrar"
            :disabled="busy"
            @click="close"
          >
            <Icon name="close" />
          </button>
        </header>
        <form @submit.prevent="$emit('submit')">
          <div v-if="error" class="modal-error" role="alert">
            <Icon name="close" :size="16" /><span>{{ error }}</span>
          </div>
          <fieldset
            :disabled="busy || saved"
            style="
              border: 0;
              padding: 0;
              margin: 0;
              min-width: 0;
              display: contents;
            "
          >
            <slot />
          </fieldset>
          <footer>
            <button
              type="button"
              class="cancel"
              :disabled="busy"
              @click="close"
            >
              Cancelar</button
            ><button class="create-action" type="submit" :disabled="busy">
              {{
                busy
                  ? "Actualizando…"
                  : saved
                    ? "Reintentar actualización"
                    : submitLabel
              }}<Icon name="arrow" :size="16" />
            </button>
          </footer>
        </form>
      </section></div
  ></Teleport>
</template>
