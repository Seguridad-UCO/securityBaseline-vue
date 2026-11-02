<script setup lang="ts">
import { ref } from "vue";
import Modal from "./Modal.vue";
const props = defineProps<{ applicationName: string; busy: boolean }>();
const emit = defineEmits<{ close: []; create: [name: string] }>();
const name = ref("");
</script>
<template><Modal title="Crear identidad de servicio" :description="`Se asociará a ${props.applicationName}. El secreto solo se mostrará una vez.`" submit-label="Crear identidad" :error="''" :busy="busy" :submit-disabled="!name.trim()" eyebrow="NUEVA CREDENCIAL M2M" @close="emit('close')" @submit="emit('create', name.trim())"><label class="identity-modal-field" for="service-identity-name">Nombre de la identidad<input id="service-identity-name" v-model="name" autocomplete="off" placeholder="facturacion-a-inventario" /><small>Usa un nombre que describa el consumo técnico.</small></label></Modal></template>
<style scoped>.identity-modal-field{display:grid;gap:8px;color:var(--ink);font-size:13px;font-weight:600}.identity-modal-field input{height:40px;border:1px solid var(--line);border-radius:6px;padding:0 11px;color:var(--ink);font:400 14px inherit}.identity-modal-field small{color:var(--text);font-size:12px;font-weight:400}</style>
