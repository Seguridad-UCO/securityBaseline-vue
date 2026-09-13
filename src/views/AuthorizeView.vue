<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import { authorize } from "../api";
import type { AuthorizationInput, Decision } from "../api/contracts";
import { useCatalogsStore } from "../stores/catalogs";
import { formatDate } from "../composables/formatDate";
import Icon from "../components/Icon.vue";
import MethodChoice from "../components/MethodChoice.vue";
const catalogs = useCatalogsStore();
const form = reactive<AuthorizationInput>({
  applicationId: catalogs.apps[0]?.id ?? "",
  resourcePath: "",
  action: "GET",
});
const decision = ref<Decision | null>(null),
  error = ref(""),
  busy = ref(false);
watch(
  () => catalogs.apps,
  (apps) => {
    if (!form.applicationId && apps[0]) form.applicationId = apps[0].id;
  },
);
async function run() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  decision.value = null;
  try {
    decision.value = (await authorize({ ...form })).data;
  } catch (reason) {
    error.value =
      reason instanceof Error
        ? reason.message
        : "No fue posible evaluar el acceso.";
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="data-panel authorize-panel">
    <header>
      <div>
        <p class="eyebrow">MOTOR DE DECISIÓN</p>
        <h2>Probar una decisión de acceso</h2>
      </div>
    </header>
    <div class="authorize-body">
      <form class="authorize-form" @submit.prevent="run">
        <label
          >Aplicación<select v-model="form.applicationId" required>
            <option v-if="!catalogs.apps.length" value="">
              Registra una aplicación primero
            </option>
            <option v-for="app in catalogs.apps" :key="app.id" :value="app.id">
              {{ app.name }}
            </option>
          </select></label
        ><label
          >Ruta del recurso<input
            v-model="form.resourcePath"
            required
            placeholder="/estudiantes" /></label
        ><MethodChoice v-model="form.action" /><button
          class="create-action"
          type="submit"
          :disabled="busy || !catalogs.apps.length"
        >
          <Icon name="bolt" :size="16" />{{
            busy ? "Evaluando…" : "Evaluar acceso"
          }}
        </button>
        <div v-if="error" class="modal-error" role="alert">
          <Icon name="close" :size="16" /><span>{{ error }}</span>
        </div>
      </form>
      <div class="decision-card">
        <div v-if="!decision && !busy" class="empty-state">
          <Icon name="bolt" :size="28" /><strong
            >Sin evaluaciones todavía</strong
          ><span>El resultado real de PolicyDecisionPort aparece aquí.</span>
        </div>
        <template v-if="decision"
          ><span
            :class="['decision-state', `state-${decision.state.toLowerCase()}`]"
            >{{ decision.state }}</span
          >
          <p class="decision-reason">{{ decision.reasonCode }}</p>
          <dl>
            <dt>Decisión</dt>
            <dd>
              <code>{{ decision.decisionId }}</code>
            </dd>
            <dt>Política</dt>
            <dd>
              <template v-if="decision.policyReferences.length"
                ><code
                  v-for="reference in decision.policyReferences"
                  :key="`${reference.policyId}@${reference.version}`"
                  >{{ reference.policyId }}@{{ reference.version }}</code
                ></template
              ><template v-else>Ninguna aplicó</template>
            </dd>
            <dt>Correlación</dt>
            <dd>
              <code>{{ decision.correlationId }}</code>
            </dd>
            <dt>Decidido</dt>
            <dd>{{ formatDate(decision.decidedAt, true) }}</dd>
          </dl></template
        >
      </div>
    </div>
  </section>
</template>
