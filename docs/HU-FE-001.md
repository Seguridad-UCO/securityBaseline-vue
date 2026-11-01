# HU-FE-001: Gestión de Inactividad de Usuario, Renovación de Sesión y Manejo Resiliente WAF

## 1. Contexto y Motivación
Con la implementación de las capacidades de seguridad en el backend (**HU-027 WAF**, **HU-028 Revocación de sesión con Redis** y **HU-029 Endpoint de refresco e inactividad**), la consola administrativa `securityBaseline-vue` requiere adoptar estos mecanismos para garantizar que las sesiones no queden abiertas indefinidamente en estaciones de trabajo desatendidas y para ofrecer una experiencia fluida al usuario legítimo.

## 2. Criterios de Aceptación

### CA-1: Detección Activa de Inactividad
- **GIVEN** un usuario autenticado en la consola administrativa
- **WHEN** transcurren 14 minutos sin eventos físicos de interacción (`mousemove`, `keydown`, `click`, `scroll`, `touchstart`)
- **THEN** el sistema entra en estado de advertencia (`idleWarning`) y despliega el modal interactivo de inactividad con cuenta regresiva.

### CA-2: Advertencia Visual y Cuenta Regresiva
- **GIVEN** el modal de advertencia desplegado
- **WHEN** el usuario observa el modal
- **THEN** se muestra un temporizador visible con cuenta regresiva de 60 segundos antes del cierre forzoso, con dos opciones claras: "Continuar conectado" y "Cerrar sesión ahora".

### CA-3: Extensión y Renovación Silenciosa de Sesión
- **GIVEN** el modal de advertencia visible
- **WHEN** el usuario hace clic en "Continuar conectado"
- **THEN** el sistema envía una petición de refresco/keepalive al backend (`GET /api/v1/session`; el proxy de refresh fue retirado, ver ADR-033), reinicia el temporizador de inactividad, cierra el modal y permite continuar trabajando sin interrupción.

### CA-4: Cierre Forzoso por Inactividad y Revocación en Redis
- **GIVEN** el modal de advertencia visible
- **WHEN** la cuenta regresiva llega a 0 o el usuario presiona "Cerrar sesión ahora"
- **THEN** el sistema ejecuta el cierre seguro de sesión (`signOut`), que invalida la sesión e invoca la revocación en Redis en el backend PDP, redirigiendo a la vista de login con un mensaje explicativo de cierre por inactividad.

### CA-5: Sincronización entre Pestañas (Multi-Tab)
- **GIVEN** múltiples pestañas abiertas con la consola en el mismo navegador
- **WHEN** el usuario interactúa o renueva la sesión en una pestaña
- **THEN** las demás pestañas sincronizan su estado y resetean sus temporizadores mediante `BroadcastChannel`.

### CA-6: Manejo Resiliente de Respuestas WAF (403)
- **GIVEN** una petición que es bloqueada por el WAF (Coraza / OWASP CRS v4) con código HTTP 403
- **WHEN** el cliente HTTP procesa la respuesta
- **THEN** se captura y expone un mensaje claro ("Operación bloqueada por políticas de seguridad de la red") evitando fallos no controlados en la interfaz.

---
**Estado:** ✅ Planificada para implementación ágil con arnés de agentes.
