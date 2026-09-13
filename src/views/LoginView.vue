<script setup lang="ts">
import Icon from "../components/Icon.vue";
import { useSessionStore } from "../stores/session";
const session = useSessionStore();
</script>
<template>
  <main class="login-page">
    <section class="login-intro">
      <div class="login-brand">
        <span><Icon name="shield" /></span> SECURITY<br /><b>BASELINE</b>
      </div>
      <div class="login-copy">
        <p class="eyebrow">PLATAFORMA DE SEGURIDAD</p>
        <h1>Una identidad.<br /><em>Un perímetro claro.</em></h1>
        <p>
          Accede con tu cuenta institucional o crea un usuario local
          administrado en Keycloak. La SPA solo consume la sesión segura del
          BFF.
        </p>
      </div>
      <div class="login-footer">
        SEGURIDAD UCO · LOGIN Y REGISTRO CENTRALIZADOS
      </div>
    </section>
    <section class="login-panel">
      <div class="login-card">
        <p class="eyebrow">ACCESO</p>
        <h2>Bienvenido</h2>
        <p class="login-description">
          Inicia sesión con tu cuenta institucional o registra un usuario local.
          Google sigue disponible dentro de Keycloak como proveedor federado.
        </p>
        <div class="login-actions">
          <button
            class="keycloak-login"
            :disabled="session.status === 'loading'"
            @click="session.beginSignIn"
          >
            Iniciar sesión</button
          ><button
            class="signup-action"
            :disabled="session.status === 'loading'"
            @click="session.beginSignUp"
          >
            Crear cuenta
          </button>
        </div>
        <p class="login-tagline">
          El registro público usa el formulario nativo de Keycloak y la
          provisión local ocurre en el primer inicio de sesión exitoso.
        </p>
        <p v-if="session.status === 'loading'" class="login-progress">
          <span class="loader" /> Verificando identidad…
        </p>
        <p v-if="session.error" class="login-error">{{ session.error }}</p>
        <div class="login-security">
          <Icon name="shield" /><span
            >Tu identidad se valida en el BFF por sesión segura. No se guardan
            tokens en el navegador.</span
          >
        </div>
      </div>
    </section>
  </main>
</template>
