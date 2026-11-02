<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import Icon from "./Icon.vue";

const props = defineProps<{
  countdown: number;
  busy: boolean;
}>();

const emit = defineEmits<{
  stayConnected: [];
  signOut: [];
}>();

const dialog = ref<HTMLElement>();
let previousFocus: HTMLElement | null = null;

const formattedCountdown = computed(() => {
  const mins = Math.floor(props.countdown / 60);
  const secs = props.countdown % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
});

function keydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    // Escape renueva o no hace nada para forzar una decisión de seguridad
    event.preventDefault();
  }
}

onMounted(() => {
  previousFocus = document.activeElement as HTMLElement;
  const stayBtn = dialog.value?.querySelector<HTMLElement>(".continue-btn");
  stayBtn?.focus();
  document.addEventListener("keydown", keydown);
});

onUnmounted(() => {
  document.removeEventListener("keydown", keydown);
  previousFocus?.focus();
});
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" role="presentation">
      <section
        ref="dialog"
        class="modal inactivity-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Aviso de inactividad"
      >
        <header>
          <div>
            <p class="eyebrow">POLÍTICA DE SEGURIDAD</p>
            <h2>Inactividad detectada</h2>
            <p>Tu sesión administrativa se cerrará automáticamente por inactividad.</p>
          </div>
        </header>

        <div class="inactivity-body">
          <div class="countdown-badge" :class="{ critical: countdown <= 15 }">
            <Icon name="clock" :size="24" />
            <div class="countdown-digits">{{ formattedCountdown }}</div>
            <span class="countdown-label">segundos restantes</span>
          </div>

          <p class="inactivity-message">
            Para proteger la confidencialidad de los datos y evitar accesos desatendidos,
            todos los tokens serán revocados de forma segura si no confirmas tu actividad.
          </p>
        </div>

        <footer>
          <button
            type="button"
            class="cancel"
            :disabled="busy"
            @click="emit('signOut')"
          >
            Cerrar sesión ahora
          </button>
          <button
            type="button"
            class="create-action continue-btn"
            :disabled="busy"
            @click="emit('stayConnected')"
          >
            <Icon v-if="busy" name="refresh" :size="16" />
            <Icon v-else name="check" :size="16" />
            {{ busy ? "Renovando..." : "Continuar conectado" }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.inactivity-modal {
  width: min(100%, 460px);
}

.inactivity-body {
  padding: 16px 28px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
}

.countdown-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px 24px;
  border-radius: 12px;
  background: var(--field);
  border: 1px solid var(--soft-line);
  color: var(--ink);
  transition: all 0.3s ease;
  width: 100%;
}

.countdown-badge.critical {
  background: rgba(185, 61, 60, 0.08);
  border-color: rgba(185, 61, 60, 0.3);
  color: var(--red);
  animation: pulse-border 1s infinite alternate;
}

.countdown-digits {
  font-size: 32px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  margin: 4px 0 2px;
}

.countdown-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.8;
}

.inactivity-message {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text);
  margin: 0;
}

.inactivity-modal footer {
  border-top: 1px solid var(--soft-line);
  padding: 16px 28px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.continue-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

@keyframes pulse-border {
  from {
    box-shadow: 0 0 0 0 rgba(185, 61, 60, 0.2);
  }
  to {
    box-shadow: 0 0 0 6px rgba(185, 61, 60, 0);
  }
}
</style>
