<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import * as api from "../api";
import type { HttpMethod, Profile, Role } from "../api/contracts";
import type { DialogKind } from "../composables/useDialogs";
import { useMutation } from "../composables/useMutation";
import { useCatalogsStore } from "../stores/catalogs";
import Modal from "./Modal.vue";
import MethodChoice from "./MethodChoice.vue";
const props = defineProps<{
  kind: DialogKind | "grant" | "profileGrant";
  role: Role | null;
  profile: Profile | null;
}>();
const emit = defineEmits<{
  close: [];
  credential: [payload: { name: string; credential: string }];
}>();
const catalogs = useCatalogsStore();
const { busy, error, saved, run } = useMutation();
const form = reactive({
  name: "",
  description: "",
  baseUrl: "",
  path: "",
  method: "GET" as HttpMethod,
  code: "",
  scope: "APPLICATION" as "APPLICATION" | "TENANT",
  applicationId: catalogs.apps[0]?.id ?? "",
  roleId: catalogs.roles[0]?.id ?? "",
  profileId: catalogs.profiles[0]?.id ?? "",
  userId: catalogs.users[0]?.id ?? "",
  resourceId: "",
});
const availableResources = computed(() =>
  catalogs.resources.filter(
    (resource) =>
      !props.role?.applicationId ||
      resource.applicationId === props.role.applicationId,
  ),
);
watch(
  availableResources,
  (resources) => {
    if (!resources.some((resource) => resource.id === form.resourceId))
      form.resourceId = resources[0]?.id ?? "";
  },
  { immediate: true },
);
// Registrar la aplicación (HU-012) y asignar un perfil devuelven algo que el flujo genérico de
// `run()` no expone: el secreto en texto plano, y la asignación materializada respectivamente. Se
// capturan aquí, fuera de `run()`, y solo se usan tras un éxito confirmado — si `run()` reintenta
// solo la recarga (el registro ya se guardó), el valor capturado en el primer intento sigue vigente.
let registeredCredential: { name: string; credential: string } | null = null;
let newProfileAssignment: Awaited<
  ReturnType<typeof api.assignProfile>
>["data"] | null = null;
const copy = computed(
  () =>
    ({
      application: [
        "Registrar aplicación",
        "Identifica el servicio que delegará la seguridad en esta plataforma.",
        "Aplicación registrada correctamente.",
      ],
      resource: [
        "Registrar recurso",
        "Define una ruta HTTP real dentro de una aplicación registrada.",
        "Recurso protegido registrado correctamente.",
      ],
      tenant: [
        "Crear tenant",
        "Crea una nueva partición organizacional disponible para asignar usuarios.",
        "Tenant creado correctamente.",
      ],
      role: [
        "Definir rol",
        "El alcance global todavía no se administra por este canal — solo tenant o aplicación.",
        "Rol definido correctamente.",
      ],
      assignment: [
        "Asignar rol",
        "El usuario tendrá este rol vigente en la aplicación elegida, desde ahora.",
        "Rol asignado correctamente.",
      ],
      profile: [
        "Definir perfil",
        "El alcance global todavía no se administra por este canal — solo tenant o aplicación.",
        "Perfil definido correctamente.",
      ],
      profileAssignment: [
        "Asignar perfil",
        "El usuario recibirá una asignación por cada rol que agrupa el perfil, en la aplicación elegida.",
        "Perfil asignado correctamente.",
      ],
      grant: [
        `Conceder recurso a "${props.role?.name}"`,
        "El rol podrá autorizar peticiones contra este recurso protegido.",
        "Recurso concedido al rol correctamente.",
      ],
      profileGrant: [
        `Agregar rol a "${props.profile?.name}"`,
        "El perfil agrupará este rol: al asignar el perfil, este rol se asigna también.",
        "Rol agregado al perfil correctamente.",
      ],
    })[props.kind],
);
async function submit() {
  const actions: Record<DialogKind | "grant" | "profileGrant", () => Promise<unknown>> = {
    application: async () => {
      const result = await api.createApplication({
        name: form.name,
        description: form.description,
        baseUrl: form.baseUrl,
      });
      registeredCredential = { name: form.name, credential: result.data.credential };
    },
    resource: () =>
      api.createResource(form.applicationId, {
        path: form.path,
        method: form.method,
      }),
    tenant: () => api.createTenant({ code: form.code, name: form.name }),
    role: () =>
      api.createRole({
        name: form.name,
        scope: form.scope,
        applicationId: form.scope === "APPLICATION" ? form.applicationId : "",
      }),
    assignment: () =>
      api.assignRole(form.roleId, {
        userId: form.userId,
        applicationId: form.applicationId,
      }),
    profile: () =>
      api.createProfile({
        name: form.name,
        scope: form.scope,
        applicationId: form.scope === "APPLICATION" ? form.applicationId : "",
      }),
    profileAssignment: async () => {
      const result = await api.assignProfile(form.profileId, {
        userId: form.userId,
        applicationId: form.applicationId,
      });
      newProfileAssignment = result.data;
    },
    grant: () => api.grantResourceToRole(props.role!.id, form.resourceId),
    profileGrant: () => api.addRoleToProfile(props.profile!.id, form.roleId),
  };
  if (await run(actions[props.kind], copy.value[2]!)) {
    if (registeredCredential) emit("credential", registeredCredential);
    if (newProfileAssignment)
      catalogs.recordProfileAssignment(newProfileAssignment);
    emit("close");
  }
}
</script>
<template>
  <Modal
    :title="copy[0]!"
    :description="copy[1]!"
    :submit-label="
      kind === 'grant'
        ? 'Conceder recurso'
        : kind === 'profileGrant'
          ? 'Agregar rol'
          : copy[0]!
    "
    :error="error"
    :busy="busy"
    :saved="saved"
    @close="emit('close')"
    @submit="submit"
  >
    <template v-if="kind === 'application'"
      ><label
        >Nombre de la aplicación<input
          v-model="form.name"
          required
          placeholder="Gestión académica" /></label
      ><label
        >Descripción<input
          v-model="form.description"
          required
          placeholder="Administración de información estudiantil" /></label
      ><label
        >URL base<input
          v-model="form.baseUrl"
          required
          type="url"
          placeholder="https://academica.uco.edu.co" /></label
    ></template>
    <template v-if="kind === 'tenant'"
      ><label
        >Código técnico<input
          v-model="form.code"
          required
          pattern="[a-z][a-z0-9-]{1,62}"
          placeholder="facultad-ingenieria" /></label
      ><label
        >Nombre visible<input
          v-model="form.name"
          required
          placeholder="Facultad de Ingeniería" /></label
    ></template>
    <template v-if="kind === 'role' || kind === 'profile'"
      ><label
        >Nombre {{ kind === "role" ? "del rol" : "del perfil" }}<input
          v-model="form.name"
          required
          :placeholder="
            kind === 'role' ? 'Administrador académico' : 'Coordinador académico'
          "
      /></label>
      <div class="method-choice">
        <span>Alcance</span>
        <div>
          <button
            type="button"
            :class="{ chosen: form.scope === 'APPLICATION' }"
            @click="form.scope = 'APPLICATION'"
          >
            Aplicación</button
          ><button
            type="button"
            :class="{ chosen: form.scope === 'TENANT' }"
            @click="form.scope = 'TENANT'"
          >
            Tenant
          </button>
        </div>
      </div></template
    >
    <template v-if="kind === 'assignment'"
      ><label
        >Rol<select v-model="form.roleId" required>
          <option
            v-for="role in catalogs.roles"
            :key="role.id"
            :value="role.id"
          >
            {{ role.name }}
          </option>
        </select></label
      ></template
    >
    <template v-if="kind === 'profileAssignment'"
      ><label
        >Perfil<select v-model="form.profileId" required>
          <option
            v-for="profile in catalogs.profiles"
            :key="profile.id"
            :value="profile.id"
          >
            {{ profile.name }}
          </option>
        </select></label
      ></template
    >
    <label v-if="kind === 'assignment' || kind === 'profileAssignment'"
      >Usuario<select v-model="form.userId" required>
        <option v-if="!catalogs.users.length" value="">
          Sin usuarios todavía
        </option>
        <option v-for="user in catalogs.users" :key="user.id" :value="user.id">
          {{ user.name || user.email }}
        </option>
      </select></label
    >
    <label
      v-if="
        kind === 'resource' ||
        kind === 'assignment' ||
        kind === 'profileAssignment' ||
        ((kind === 'role' || kind === 'profile') && form.scope === 'APPLICATION')
      "
      >Aplicación<select v-model="form.applicationId" required>
        <option v-if="!catalogs.apps.length" value="">
          Registra una aplicación primero
        </option>
        <option v-for="app in catalogs.apps" :key="app.id" :value="app.id">
          {{ app.name }}
        </option>
      </select></label
    >
    <template v-if="kind === 'resource'"
      ><MethodChoice v-model="form.method" /><label
        >Path<input
          v-model="form.path"
          required
          placeholder="/empleados o /empleados/{id}" /></label
    ></template>
    <label v-if="kind === 'grant'"
      >Recurso<select v-model="form.resourceId" required>
        <option v-if="!availableResources.length" value="">
          Este rol no tiene recursos disponibles en su alcance
        </option>
        <option
          v-for="resource in availableResources"
          :key="resource.id"
          :value="resource.id"
        >
          {{ resource.method }} {{ resource.path }}
        </option>
      </select></label
    >
    <label v-if="kind === 'profileGrant'"
      >Rol<select v-model="form.roleId" required>
        <option v-if="!catalogs.roles.length" value="">
          Define un rol primero
        </option>
        <option v-for="role in catalogs.roles" :key="role.id" :value="role.id">
          {{ role.name }}
        </option>
      </select></label
    >
  </Modal>
</template>
