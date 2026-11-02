# Plan de Implementación: HU-FE-001 (Inactividad, Refresco y Resiliencia WAF)

## 1. Alcance Técnico
- **Repositorio:** `securityBaseline-vue`
- **Tecnologías:** Vue 3, Pinia, TypeScript, BroadcastChannel API.

## 2. Componentes a Crear / Modificar

### 2.1 API Client (`src/api/client.ts` y `src/api/index.ts`)
- (Retirado por ADR-033) El keepalive usa `refreshSession()` sobre `GET /api/v1/session`; ya no existe `refreshSessionToken()` ni `POST /api/v1/session/token/refresh`.
- Enriquecer el manejo de respuestas `403` para identificar si provienen del WAF o denegación de permisos y brindar un texto descriptivo.

### 2.2 Composable de Inactividad (`src/composables/useInactivityTracker.ts`)
- Administrar el ciclo de vida de los eventos de usuario (`mousemove`, `keydown`, `click`, `scroll`, `touchstart`).
- Implementar debounce/throttle en la escucha de eventos para optimizar rendimiento de CPU.
- Controlar dos timers:
  1. `idleTimeout`: dispara el estado de advertencia (`showWarning = true`).
  2. `countdownInterval`: decrementa los segundos restantes cada segundo en pantalla.
- Exponer métodos: `stayConnected()`, `logoutNow()`, y estados reactivos `showWarning`, `secondsRemaining`.
- Sincronizar vía `BroadcastChannel` para evitar desincronización entre múltiples pestañas.

### 2.3 Componente Modal (`src/components/InactivityModal.vue`)
- Modal accesible (teleportado a body, trampa de foco) acorde a la línea gráfica de `securityBaseline-vue`.
- Mostrar iconografía de alerta o temporizador.
- Botones de acción:
  - "Continuar conectado" (primario)
  - "Cerrar sesión ahora" (secundario)
- Contador regresivo en tiempo real ("Tu sesión expirará en 45 segundos...").

### 2.4 Integración en `App.vue`
- Activar el tracker condicionalmente cuando `session.status === 'authenticated'`.
- Montar `InactivityModal` en `App.vue` (o `ConsoleLayout.vue`).
- Si expira el tiempo o se presiona salir, disparar `signOut()` y mostrar notificación informativa.

## 3. Plan de Verificación y Validación
1. Chequeo de tipos estáticos: `npm run typecheck` (`vue-tsc --noEmit`).
2. Compilación y empaquetado para producción: `npm run build` (`vite build`).
3. Validación manual del flujo reactivo y sincronización de eventos.
