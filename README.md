# Security Baseline · Vue

Migración de `../securityBaseline-fr` a Vue 3, TypeScript, Composition API, Vue Router y Pinia. El frontend React y el backend quedan sin modificaciones.

## Ejecutar

```bash
npm ci
npm run dev
```

Abrir `http://localhost:5173`. El puerto es estricto porque el BFF tiene configurados CORS y las redirecciones de Keycloak para ese origen. No ejecutar simultáneamente ambos frontends en ese puerto.

`VITE_API_BASE_URL` conserva las configuraciones del frontend original:

- Desarrollo: `http://localhost:18080`, por defecto; se puede sobrescribir en `.env.local` siguiendo `.env.example`.
- Build de producción: `https://app-pdp-dev.azurewebsites.net`, mediante `.env.production`.

El backend debe ser el PDP de `../securityBaseline/pdp`, con su sesión BFF, Keycloak y SurrealDB configurados. Cambiar la URL del frontend por sí solo no configura CORS ni los orígenes de retorno del BFF. `npm run preview` sirve el build de producción; no usa automáticamente la configuración de desarrollo.

## Estructura

- `src/api/`: contratos, HTTP con cookies y CSRF, errores y endpoints existentes.
- `src/stores/`: sesión y catálogos. Aplicaciones, roles y asignaciones recorren todas las páginas del contrato existente.
- `src/composables/`: mutaciones, sincronización, diálogos y formato de fechas.
- `src/router/`: rutas protegidas `/`, `/aplicaciones`, `/recursos`, `/roles`, `/asignaciones`, `/autorizacion`, `/tenants`, `/usuarios`; acceso anónimo en `/login`.
- `src/views/`: una vista por módulo.
- `src/components/`: layout, iconos, alertas, paneles y formularios modales.

En un servidor estático, configurar fallback de las rutas de la SPA a `index.html` para permitir navegación directa por URL. Vite ya lo hace en desarrollo.

## Actualización sin temporizadores

Pinia comparte un único estado dentro de cada pestaña. Las escrituras exitosas invalidan los catálogos y notifican a otras pestañas o ventanas mediante `BroadcastChannel`. Cada receptor consulta el BFF con su propia sesión; no se transmiten catálogos, datos de usuarios ni tokens por el canal. El snapshot se publica después de completar las lecturas. Las invalidaciones recibidas durante una carga provocan una nueva lectura para evitar perder cambios concurrentes.

El canal funciona entre instancias de **este frontend Vue, en el mismo origen y perfil de navegador**. No detecta escrituras desde el frontend React, herramientas externas, otro navegador ni otro equipo. El backend actual no expone eventos de catálogo SSE/WebSocket: WebFlux no notifica al navegador automáticamente. Para cubrir esos casos haría falta ampliar el backend, fuera del plan que exige conservarlo intacto. No se añadió polling, `setInterval` ni `setTimeout`.

Al volver a una pestaña o recuperar conectividad se valida la sesión y se recargan los catálogos mediante eventos del navegador. El logout se comunica entre pestañas y una respuesta HTTP 401 descarta el estado autenticado.

Los modales cierran después de escritura y recarga exitosas. Si la escritura se guarda pero falla la lectura, el formulario conserva un estado de recuperación: el botón reintenta únicamente la recarga, evitando duplicar registros.

La funcionalidad de revocación conservada es la revocación de **asignaciones**. El frontend original y sus contratos no incluyen un endpoint para retirar un recurso de un rol; no se inventó uno.

## Validación

```bash
npm run typecheck
npm run build
```

Dependencias fijadas en `package.json` y `package-lock.json`. TypeScript 5.9.3 se usa por compatibilidad con el ejecutable de `vue-tsc` seleccionado; TypeScript 7 falló al resolver `typescript/lib/tsc`.

Verificación realizada el 12 de septiembre de 2026:

- TypeScript y build de producción correctos.
- Recorrido en navegador aislado, con respuestas HTTP controladas: ocho módulos, rutas directas, paginación, creación de entidades, asignación de tenant y rol, concesión de recursos, revocación de asignaciones y prueba de autorización con referencias de políticas y fechas.
- Dos pestañas: la aplicación creada en una aparece en la otra sin recarga manual; logout propagado.
- CSRF enviado en escrituras; HTTP 401 vuelve al login; destinos de login y registro conservados.
- Fallo después de guardar: modal abierto y reintento de lectura sin repetir el POST.
- Revisión visual en escritorio y móvil; sin desbordamiento horizontal de la página a 390 px; sin errores JavaScript.
- `src/styles.css` idéntico al original; ajuste del contenedor del menú móvil localizado en `ConsoleLayout.vue`.

No se añadió una suite de pruebas ni dependencias de testing al proyecto. El recorrido temporal de navegador usa respuestas controladas y **no acredita integración real con Keycloak**.

### Integración real validada · 13 de septiembre de 2026

El bloqueo del entorno quedó resuelto. Se recorrió Vue en un navegador aislado contra el PDP WebFlux en `8080`, Keycloak en `9090`, SurrealDB en `8000` y OPA en `8181`, sin interceptar ni simular las respuestas HTTP.

Validado: registro público y retorno anónimo, login BFF/Keycloak, carga de catálogos, creación de aplicaciones/recursos/roles/tenants, concesión de recurso a rol, asignación y revocación de rol, cambio y restauración del tenant del usuario de prueba, navegación directa por URL y logout real propagado a una segunda pestaña. La aplicación creada en una pestaña apareció en la otra sin recarga manual. No hubo errores JavaScript. TypeScript y build volvieron a pasar.

`POST /api/v1/authorize` respondió HTTP 200 y el frontend mostró `DENY`, `NO_APPLICABLE_POLICY`, `core.composition@1.0`, identificador de decisión, correlación y fecha. Esa respuesta valida la integración con el motor; no afirma que exista una política que permita el acceso a la aplicación de prueba.

No fue necesario cambiar código del frontend ni del backend. Se conservaron los datos locales creados durante la validación: dos cuentas `vue-check-*`, dos aplicaciones `Validación Vue *`, un recurso `/validacion-vue`, un rol `Rol Vue *`, su concesión, una asignación revocada y un tenant `Tenant Vue *`. El usuario empleado en el recorrido completo terminó nuevamente en `universidad-uco` y su sesión se cerró.

Para arrancar nuevamente las dependencias y el PDP, desde `../securityBaseline`:

```bash
docker compose -f pdp/docker-compose.yml up -d surrealdb keycloak
docker compose -f security-policy-engine/docker-compose.yml up -d --build opa
JAVA_HOME=$(/usr/libexec/java_home -v 25) \
PDP_KEYCLOAK_ISSUER=http://localhost:9090/realms/security-baseline \
PDP_KEYCLOAK_CLIENT_ID=security-baseline-bff \
SPRING_PROFILES_ACTIVE=keycloak \
./mvnw -f pdp/pom.xml spring-boot:run
```

Las variables de issuer y client ID se declaran explícitamente porque el perfil actual también las referencia en la configuración JWT. El realm y el cliente Keycloak existentes deben conservarse. Con el PDP activo, ejecutar `npm run dev` aquí y abrir `http://localhost:5173`.
