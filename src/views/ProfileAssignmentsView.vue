<script setup lang="ts">
import { ref } from "vue";
import { revokeProfileAssignment } from "../api";
import { useCatalogsStore } from "../stores/catalogs";
import { useDialogs } from "../composables/useDialogs";
import { useMutation } from "../composables/useMutation";
import DataPanel from "../components/DataPanel.vue";
import Alert from "../components/Alert.vue";
import Icon from "../components/Icon.vue";
const catalogs = useCatalogsStore(),
  dialogs = useDialogs();
const { busy, error, saved, run } = useMutation();
const retry = ref<(() => Promise<unknown>) | null>(null);
async function revoke(profileId: string, profileAssignmentId: string) {
  retry.value = () => revokeProfileAssignment(profileId, profileAssignmentId);
  await run(retry.value, "Asignación de perfil revocada correctamente.");
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
    @click="run(retry, 'Asignación de perfil revocada correctamente.')"
  >
    Reintentar actualización</button
  ><DataPanel
    title="Asignaciones de perfil"
    :count="catalogs.profileAssignments.length"
    empty="Asigna el primer perfil a un usuario."
    action-text="Asignar perfil"
    @action="dialogs.open('profileAssignment')"
    ><div class="assignment-table">
      <article
        v-for="assignment in catalogs.profileAssignments"
        :key="assignment.id"
        class="assignment-row"
      >
        <span class="assignment-role"
          ><Icon name="layers" :size="14" />{{
            assignment.profile?.name || assignment.profileId
          }}</span
        ><span class="assignment-user">{{
          assignment.user?.name || assignment.user?.email || assignment.userId
        }}</span
        ><span class="assignment-since"
          >{{ assignment.generatedAssignmentIds.length }} rol{{
            assignment.generatedAssignmentIds.length === 1 ? "" : "es"
          }}
          materializado{{
            assignment.generatedAssignmentIds.length === 1 ? "" : "s"
          }}</span
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
          @click="revoke(assignment.profileId, assignment.id)"
        >
          <Icon name="close" :size="13" />Revocar
        </button>
      </article>
    </div></DataPanel
  >
</template>
