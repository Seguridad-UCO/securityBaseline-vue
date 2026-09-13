<script setup lang="ts">
import { ref } from "vue";
import { revokeAssignment } from "../api";
import { useCatalogsStore } from "../stores/catalogs";
import { useDialogs } from "../composables/useDialogs";
import { useMutation } from "../composables/useMutation";
import { formatDate } from "../composables/formatDate";
import DataPanel from "../components/DataPanel.vue";
import Alert from "../components/Alert.vue";
import Icon from "../components/Icon.vue";
const catalogs = useCatalogsStore(),
  dialogs = useDialogs();
const { busy, error, saved, run } = useMutation();
const retry = ref<(() => Promise<unknown>) | null>(null);
async function revoke(roleId: string, assignmentId: string) {
  retry.value = () => revokeAssignment(roleId, assignmentId);
  await run(retry.value, "Asignación revocada correctamente.");
}
</script>
<template>
  <Alert
    v-if="error"
    type="error"
    :message="error"
    @close="error = ''"
  /><button
    v-if="saved && retry"
    class="refresh-action"
    :disabled="busy"
    @click="run(retry, 'Asignación revocada correctamente.')"
  >
    Reintentar actualización</button
  ><DataPanel
    title="Asignaciones vigentes"
    :count="catalogs.assignments.length"
    empty="Asigna el primer rol a un usuario."
    action-text="Asignar rol"
    @action="dialogs.open('assignment')"
    ><div class="assignment-table">
      <article
        v-for="assignment in catalogs.assignments"
        :key="assignment.id"
        class="assignment-row"
      >
        <span class="assignment-role"
          ><Icon name="key" :size="14" />{{
            assignment.role?.name || assignment.roleId
          }}</span
        ><code class="assignment-user">{{ assignment.userId }}</code
        ><span class="assignment-since"
          >desde {{ formatDate(assignment.validFrom) }}</span
        ><span
          :class="[
            'assignment-state',
            assignment.validUntil ? 'revoked' : 'active',
          ]"
          ><template v-if="assignment.validUntil">Revocada</template
          ><template v-else
            ><Icon name="check" :size="13" />Vigente</template
          ></span
        ><button
          v-if="!assignment.validUntil"
          class="revoke-action"
          :disabled="busy || saved"
          @click="revoke(assignment.roleId, assignment.id)"
        >
          <Icon name="close" :size="13" />Revocar
        </button>
      </article>
    </div></DataPanel
  >
</template>
