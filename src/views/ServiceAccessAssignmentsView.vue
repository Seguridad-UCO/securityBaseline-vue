<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import {
  decideServiceAccess,
  listReceivedServiceAccessGrants,
  listServiceAccessGrants,
  listServiceIdentities,
  revokeServiceAccess,
} from "../api";
import { ApiError } from "../api/client";
import type { ServiceAccessGrant, ServiceIdentity } from "../api/contracts";
import Alert from "../components/Alert.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import DataPanel from "../components/DataPanel.vue";
import ServiceNavigation from "../components/ServiceNavigation.vue";
import { useCatalogsStore } from "../stores/catalogs";

type Mode = "identity" | "target";
type StatusFilter = "ALL" | ServiceAccessGrant["status"];

const catalogs = useCatalogsStore();
const route = useRoute();
const mode = ref<Mode>(route.query.mode === "target" ? "target" : "identity");
const applicationId = ref(typeof route.query.applicationId === "string" ? route.query.applicationId : "");
const identityId = ref(typeof route.query.identityId === "string" ? route.query.identityId : "");
const identities = ref<ServiceIdentity[]>([]);
const grants = ref<ServiceAccessGrant[]>([]);
const statusFilter = ref<StatusFilter>("ALL");
const search = ref("");
const loading = ref(false);
const busyId = ref<string | null>(null);
const error = ref("");
const revokeTarget = ref<ServiceAccessGrant | null>(null);
let loadToken = 0;

const statusLabels: Record<ServiceAccessGrant["status"], string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  REVOKED: "Revocada",
};
const resourceById = computed(() => Object.fromEntries(catalogs.resources.map((resource) => [resource.id, resource])));
const currentAppLabel = computed(() => catalogs.appById[applicationId.value]?.name ?? "Aplicación seleccionada");
const selectedIdentity = computed(() => identities.value.find((identity) => identity.id === identityId.value));
const filteredGrants = computed(() => {
  const query = search.value.trim().toLowerCase();
  return grants.value.filter((grant) => {
    if (statusFilter.value !== "ALL" && grant.status !== statusFilter.value) return false;
    if (!query) return true;
    return `${assignmentLabel(grant)} ${grant.technicalRole} ${ownerLabel(grant)} ${grant.serviceIdentityId}`
      .toLowerCase()
      .includes(query);
  });
});
const counts = computed(() => ({
  total: grants.value.length,
  pending: grants.value.filter((grant) => grant.status === "PENDING").length,
  approved: grants.value.filter((grant) => grant.status === "APPROVED").length,
}));

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("es-CO", { dateStyle: "medium" }) : "—";
}
function errorMessage(cause: unknown, fallback: string, action = false) {
  if (cause instanceof ApiError && cause.status === 403) {
    return action
      ? "No administras la aplicación dueña de este acceso."
      : "No administras la aplicación seleccionada.";
  }
  return cause instanceof Error && cause.message ? cause.message : fallback;
}
function isRole(grant: ServiceAccessGrant) {
  return grant.technicalRoleId !== null;
}
function assignmentLabel(grant: ServiceAccessGrant) {
  if (isRole(grant)) return `Rol técnico · ${grant.technicalRole || "sin código"}`;
  const resource = grant.resourceId ? resourceById.value[grant.resourceId] : undefined;
  return resource ? `Recurso · ${resource.method} ${resource.path}` : "Recurso no disponible";
}
function kindLabel(grant: ServiceAccessGrant) {
  return isRole(grant) ? "Rol técnico personalizado" : "Recurso independiente";
}
function ownerLabel(grant: ServiceAccessGrant) {
  return catalogs.appById[grant.targetApplicationId]?.name ?? "Aplicación no disponible";
}
function shortIdentity(id: string) {
  return `Identidad ${id.slice(0, 8)}`;
}
function resetAll() {
  applicationId.value = "";
  identityId.value = "";
  identities.value = [];
  grants.value = [];
  statusFilter.value = "ALL";
  search.value = "";
  error.value = "";
  ++loadToken;
}
async function loadForApplication() {
  const token = ++loadToken;
  identities.value = [];
  identityId.value = "";
  grants.value = [];
  error.value = "";
  if (!applicationId.value) return;
  loading.value = true;
  try {
    if (mode.value === "identity") {
      identities.value = (await listServiceIdentities(applicationId.value)).data;
    } else {
      grants.value = (await listReceivedServiceAccessGrants(applicationId.value)).data;
    }
  } catch (cause) {
    if (token === loadToken) error.value = errorMessage(cause, "No fue posible cargar las asignaciones.");
  } finally {
    if (token === loadToken) loading.value = false;
  }
}
async function loadIdentityGrants() {
  const token = ++loadToken;
  grants.value = [];
  error.value = "";
  if (mode.value !== "identity" || !applicationId.value || !identityId.value) return;
  loading.value = true;
  try {
    grants.value = (await listServiceAccessGrants(applicationId.value, identityId.value)).data;
  } catch (cause) {
    if (token === loadToken) {
      error.value = errorMessage(cause, "No fue posible cargar las asignaciones.");
      identityId.value = "";
    }
  } finally {
    if (token === loadToken) loading.value = false;
  }
}
async function reloadCurrent() {
  if (mode.value === "identity") await loadIdentityGrants();
  else await loadForApplication();
}
async function decide(grant: ServiceAccessGrant, approve: boolean) {
  if (busyId.value) return;
  busyId.value = grant.id;
  error.value = "";
  try {
    await decideServiceAccess(grant.targetApplicationId, grant.id, approve);
    await reloadCurrent();
  } catch (cause) {
    error.value = errorMessage(cause, "No fue posible registrar la decisión.", true);
  } finally {
    busyId.value = null;
  }
}
function openRevoke(grant: ServiceAccessGrant) {
  revokeTarget.value = grant;
}
async function performRevoke() {
  const grant = revokeTarget.value;
  if (!grant) return;
  busyId.value = grant.id;
  error.value = "";
  try {
    await revokeServiceAccess(grant.targetApplicationId, grant.id);
    await reloadCurrent();
  } catch (cause) {
    error.value = errorMessage(cause, "No fue posible revocar el acceso.", true);
    throw cause;
  } finally {
    busyId.value = null;
  }
}

watch(mode, resetAll);
watch(applicationId, loadForApplication);
watch(identityId, loadIdentityGrants);
</script>

<template>
  <div class="assignment-page">
    <Alert v-if="error" type="error" :message="error" @close="error = ''" />
    <ServiceNavigation />

    <section class="mode-switch" aria-label="Modo de consulta">
      <div><p class="eyebrow">ACCESOS M2M</p><h1>Asignaciones de servicio</h1><p>Consulta y decide accesos desde la identidad consumidora o desde la aplicación dueña.</p></div>
      <div class="mode-options" role="radiogroup" aria-label="Modo de consulta">
        <label :class="{ selected: mode === 'identity' }"><input v-model="mode" type="radio" value="identity" />Por identidad</label>
        <label :class="{ selected: mode === 'target' }"><input v-model="mode" type="radio" value="target" />Por aplicación dueña</label>
      </div>
    </section>

    <DataPanel title="Asignaciones" :count="filteredGrants.length" empty="" :show-content-when-empty="true" :eyebrow="null">
      <div class="assignment-toolbar">
        <label>{{ mode === 'identity' ? 'Aplicación consumidora' : 'Aplicación dueña' }}<select v-model="applicationId"><option value="">Selecciona una aplicación</option><option v-for="app in catalogs.apps" :key="app.id" :value="app.id">{{ app.name }}</option></select></label>
        <label v-if="mode === 'identity'">Identidad de servicio<select v-model="identityId" :disabled="!applicationId || loading"><option value="">Selecciona una identidad</option><option v-for="identity in identities" :key="identity.id" :value="identity.id">{{ identity.name }}</option></select></label>
        <p class="admin-note">Aprobar o revocar requiere administrar la aplicación dueña del acceso.</p>
      </div>
      <div class="assignment-filters">
        <label>Estado<select v-model="statusFilter"><option value="ALL">Todas</option><option value="PENDING">Pendientes</option><option value="APPROVED">Aprobadas</option><option value="REJECTED">Rechazadas</option><option value="REVOKED">Revocadas</option></select></label>
        <label class="search-field">Buscar<input v-model="search" type="search" placeholder="Asignación, rol, aplicación o identidad" /></label>
        <div class="summary"><span><b>{{ counts.total }}</b>Total</span><span><b>{{ counts.pending }}</b>Pendientes</span><span><b>{{ counts.approved }}</b>Aprobadas</span><span>Mostrando <b>{{ filteredGrants.length }}</b> de {{ counts.total }}</span></div>
      </div>

      <div v-if="loading" class="assignment-loading"><span /><span /><span /></div>
      <div v-else-if="!applicationId" class="assignment-empty"><strong>Elige una aplicación para comenzar</strong><span>Selecciona el alcance de consulta que quieres revisar.</span></div>
      <div v-else-if="mode === 'identity' && !identityId && !identities.length" class="assignment-empty"><strong>Esta aplicación no tiene identidades de servicio</strong><span>Registra una identidad para consultar sus asignaciones.</span></div>
      <div v-else-if="mode === 'identity' && !identityId" class="assignment-empty"><strong>Elige una identidad para ver sus asignaciones</strong><span>Las asignaciones se muestran en todos sus estados.</span></div>
      <div v-else-if="!grants.length" class="assignment-empty"><strong>No hay asignaciones para esta {{ mode === 'identity' ? 'identidad' : 'aplicación' }}</strong><span>Cuando exista un acceso, aparecerá aquí con su estado y sus acciones.</span></div>
      <div v-else-if="!filteredGrants.length" class="assignment-empty"><strong>Ninguna asignación coincide con el filtro</strong><span>Prueba con otro estado o término de búsqueda.</span></div>
      <div v-else class="assignment-table">
        <div class="assignment-head"><span v-if="mode === 'target'">Identidad</span><span>Asignación</span><span>Tipo</span><span v-if="mode === 'identity'">Aplicación dueña</span><span>Estado</span><span>Solicitada</span><span>Decidida</span><span>Acciones</span></div>
        <article v-for="grant in filteredGrants" :key="grant.id" class="assignment-row">
          <div v-if="mode === 'target'" class="identity-cell" :title="grant.serviceIdentityId">{{ shortIdentity(grant.serviceIdentityId) }}</div>
          <div class="assignment-cell"><strong>{{ assignmentLabel(grant) }}</strong><span v-if="mode === 'target'">{{ ownerLabel(grant) }}</span></div>
          <div class="type-cell">{{ kindLabel(grant) }}</div>
          <div v-if="mode === 'identity'" class="owner-cell">{{ ownerLabel(grant) }}</div>
          <div><span :class="['status-chip', grant.status.toLowerCase()]">{{ statusLabels[grant.status] }}</span></div>
          <time :datetime="grant.requestedAt">{{ formatDate(grant.requestedAt) }}</time>
          <time :datetime="grant.decidedAt ?? undefined">{{ formatDate(grant.decidedAt) }}</time>
          <div class="row-actions">
            <template v-if="grant.status === 'PENDING'"><button class="approve" :disabled="busyId === grant.id" @click="decide(grant, true)">Aprobar</button><button class="reject" :disabled="busyId === grant.id" @click="decide(grant, false)">Rechazar</button></template>
            <button v-if="grant.status === 'APPROVED'" class="revoke" :disabled="busyId === grant.id" @click="openRevoke(grant)">Revocar</button>
          </div>
        </article>
      </div>
    </DataPanel>

    <ConfirmModal v-if="revokeTarget" title="Revocar asignación" description="Se retirará el acceso aprobado de inmediato. Esta acción no elimina la identidad y la solicitud podrá hacerse de nuevo." confirm-label="Revocar acceso" :action="performRevoke" @close="revokeTarget = null" />
  </div>
</template>

<style scoped>
.assignment-page { display: grid; gap: 20px; }
.mode-switch { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin: 4px 4px 0; }
.mode-switch h1 { margin: 8px 0 6px; font-size: 30px; letter-spacing: -.045em; font-weight: 600; }
.mode-switch p:not(.eyebrow) { margin: 0; color: var(--text); font-size: 13px; }
.mode-options { display: flex; gap: 4px; padding: 4px; border: 1px solid var(--line); border-radius: 8px; background: var(--field); }
.mode-options label { display: inline-flex; align-items: center; gap: 7px; padding: 8px 11px; border-radius: 5px; color: var(--text); font-size: 12px; cursor: pointer; white-space: nowrap; }
.mode-options label.selected { background: var(--paper); color: var(--ink); box-shadow: 0 1px 3px rgba(17, 19, 18, .08); font-weight: 600; }
.mode-options input { accent-color: var(--green); }
.assignment-toolbar, .assignment-filters { display: flex; align-items: end; gap: 16px; padding: 0 26px 18px; }
.assignment-toolbar label, .assignment-filters label { display: grid; gap: 7px; min-width: 260px; color: var(--text); font-size: 12px; font-weight: 600; }
.assignment-toolbar select, .assignment-filters select, .assignment-filters input { height: 36px; border: 1px solid var(--line); border-radius: 6px; background: var(--paper); padding: 0 10px; color: var(--ink); }
.admin-note { max-width: 42ch; margin: 0; color: var(--text); font-size: 12px; line-height: 1.45; }
.assignment-filters { align-items: end; padding-top: 0; border-top: 1px solid var(--soft-line); padding-top: 16px; }
.assignment-filters label { min-width: 160px; }
.assignment-filters .search-field { min-width: 260px; }
.summary { display: flex; align-items: center; gap: 16px; margin-left: auto; color: var(--text); font-size: 11px; white-space: nowrap; }
.summary span { display: grid; gap: 2px; }
.summary span:last-child { display: block; padding-left: 12px; border-left: 1px solid var(--line); }
.summary b { color: var(--ink); font: 500 13px 'IBM Plex Mono', monospace; }
.assignment-table { border-top: 1px solid var(--soft-line); overflow-x: auto; }
.assignment-head, .assignment-row { display: grid; grid-template-columns: minmax(170px, 1.45fr) minmax(120px, 1fr) minmax(130px, 1fr) 130px 120px 120px 170px; gap: 14px; align-items: center; min-width: 980px; padding: 13px 26px; }
.assignment-head { color: var(--faint); font: 10px 'IBM Plex Mono', monospace; letter-spacing: .04em; }
.assignment-row { border-top: 1px solid var(--soft-line); font-size: 12px; }
.assignment-row > div, .assignment-row time { min-width: 0; }
.assignment-cell { display: grid; gap: 4px; }
.assignment-cell strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.assignment-cell span, .type-cell, .owner-cell, .identity-cell, .assignment-row time { color: var(--text); }
.assignment-row time { font: 11px 'IBM Plex Mono', monospace; }
.identity-cell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: 'IBM Plex Mono', monospace; }
.status-chip { display: inline-flex; padding: 4px 7px; border-radius: 4px; font: 11px 'IBM Plex Mono', monospace; }
.status-chip.pending { background: #fff4d9; color: var(--amber); }.status-chip.approved { background: var(--green-wash); color: var(--green-ink); }.status-chip.rejected, .status-chip.revoked { background: #fdecec; color: var(--red); }
.row-actions { display: flex; gap: 6px; }
.row-actions button { height: 31px; border-radius: 5px; padding: 0 9px; font-size: 11px; font-weight: 600; }
.approve { border: 0; background: var(--ink); color: #fff; }.reject, .revoke { border: 1px solid rgba(185, 61, 60, .35); background: var(--paper); color: var(--red); }
.assignment-empty { display: grid; gap: 6px; padding: 34px 26px; color: var(--text); font-size: 13px; }.assignment-empty strong { color: var(--ink); }
.assignment-loading { display: grid; gap: 1px; border-top: 1px solid var(--soft-line); }.assignment-loading span { height: 56px; background: var(--field); }
@media (max-width: 900px) { .mode-switch { align-items: stretch; flex-direction: column; }.mode-options { align-self: start; }.assignment-toolbar, .assignment-filters { align-items: stretch; flex-direction: column; }.assignment-toolbar label, .assignment-filters label, .assignment-filters .search-field { min-width: 0; }.summary { align-items: start; flex-wrap: wrap; margin-left: 0; white-space: normal; }.summary span:last-child { padding-left: 0; border-left: 0; } }
@media (max-width: 600px) { .mode-switch h1 { font-size: 26px; }.mode-options { width: 100%; }.mode-options label { flex: 1; justify-content: center; }.assignment-head { display: none; }.assignment-table { overflow: visible; }.assignment-row { display: grid; grid-template-columns: 1fr auto; min-width: 0; gap: 8px 12px; padding: 16px 20px; }.assignment-row > div, .assignment-row time { grid-column: 1 / -1; }.assignment-row .status-chip { grid-column: 2; grid-row: 1; justify-self: end; }.assignment-row .assignment-cell { grid-column: 1; grid-row: 1; }.row-actions { grid-column: 1 / -1; flex-wrap: wrap; }.assignment-row time { font-size: 10px; }.assignment-row time::before { content: 'Solicitada '; color: var(--faint); }.assignment-row time + time::before { content: 'Decidida '; } }
</style>
