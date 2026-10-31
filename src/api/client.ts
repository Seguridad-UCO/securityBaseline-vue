export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:18080"
).replace(/\/$/, "");
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export const sessionEvents = new EventTarget();
function csrfHeader(): Record<string, string> {
  const token = document.cookie
    .split("; ")
    .find((value) => value.startsWith("XSRF-TOKEN="))
    ?.slice("XSRF-TOKEN=".length);
  return token ? { "X-XSRF-TOKEN": decodeURIComponent(token) } : {};
}
/**
 * Mensaje por defecto cuando el sobre de error del API no trae `detail`. Un 503 (Keycloak o el PDP no
 * disponibles, HU-030/031) no es una sesión expirada: se pide reintentar, no volver a iniciar sesión.
 */
function defaultMessageFor(status: number): string {
  if (status === 403)
    return "Operación bloqueada por políticas de seguridad de la red (WAF) o permisos insuficientes.";
  if (status === 429)
    return "Demasiadas solicitudes. Espera unos segundos e inténtalo de nuevo.";
  if (status === 503)
    return "El servicio no está disponible temporalmente. Inténtalo de nuevo en unos segundos.";
  return `El API respondió con estado ${status}.`;
}
/**
 * Mensajes de los 403 con `code` propio (ADR-033/036): el panel debe decir qué hacer, no "permisos
 * insuficientes". Un código desconocido conserva el `detail` del API.
 */
const FORBIDDEN_MESSAGES: Record<string, string> = {
  MFA_REQUIRED:
    "Esta operación exige verificación en dos pasos (MFA). Inicia sesión con tu segundo factor e inténtalo de nuevo.",
  NOT_AUTHORIZED_TO_ADMINISTER_TENANT_CATALOG:
    "Para definir roles o perfiles de alcance inquilino debes administrar al menos una aplicación del inquilino.",
};
// El `detail` de este conflicto cita el rol por id; se explica sin identificadores.
const MESSAGES_WITHOUT_IDS: Record<string, string> = {
  PROTECTED_ROLE: "El rol ADMIN administra la aplicación y no se puede modificar ni eliminar.",
};

// Directorio id -> nombre. Cada respuesta del PDP que trae entidades con `id` y nombre lo alimenta, de modo que un
// mensaje del servidor que cita un id ("el usuario <id> ya tiene el rol <id>") se muestra con el nombre de lo que
// la persona ya vio en pantalla. Un id que nunca se vio se omite: jamás se muestra crudo.
const NAMES = new Map<string, string>();
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
function harvestNames(value: unknown, depth = 0): void {
  if (!value || typeof value !== "object" || depth > 6) return;
  if (Array.isArray(value)) {
    for (const item of value) harvestNames(item, depth + 1);
    return;
  }
  const entity = value as Record<string, unknown>;
  if (typeof entity.id === "string") {
    const label =
      typeof entity.name === "string" && entity.name
        ? entity.name
        : typeof entity.email === "string" && entity.email
          ? entity.email
          : typeof entity.path === "string" && typeof entity.method === "string"
            ? `${entity.method} ${entity.path}`
            : undefined;
    if (label) {
      if (NAMES.size > 5000) NAMES.clear();
      NAMES.set(entity.id.toLowerCase(), label);
    }
  }
  for (const nested of Object.values(entity)) if (nested && typeof nested === "object") harvestNames(nested, depth + 1);
}
export function withNames(message?: string): string | undefined {
  if (!message) return undefined;
  const text = message.replace(UUID, (id) => NAMES.get(id.toLowerCase()) ?? "").replace(/\s{2,}/g, " ").trim();
  return text || undefined;
}
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  let response: Response;
  try {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(method) &&
      !Object.keys(csrfHeader()).length
    ) {
      await fetch(`${API_BASE_URL}/api/v1/session`, { credentials: "include" });
    }
    const headers = new Headers(csrfHeader());
    if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
    new Headers(options.headers).forEach((value, key) =>
      headers.set(key, value),
    );
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new Error(
      "No fue posible contactar el API. Verifica que securityBaseline esté ejecutándose en el puerto 8080.",
    );
  }
  if (!response.ok) {
    if (response.status === 401)
      sessionEvents.dispatchEvent(new Event("expired"));
    const payload = await response.json().catch(() => null);
    const defaultMessage = defaultMessageFor(response.status);
    const code = typeof payload?.code === "string" ? payload.code : undefined;
    throw new ApiError(
      (response.status === 403 && code ? FORBIDDEN_MESSAGES[code] : undefined) ??
        (code ? MESSAGES_WITHOUT_IDS[code] : undefined) ??
        withNames(payload?.detail ?? payload?.message) ??
        defaultMessage,
      response.status,
      code,
    );
  }
  if (response.status === 204) return null as T;
  const data = (await response.json()) as T;
  harvestNames(data);
  return data;
}
export async function requestBlob(path: string, options: RequestInit = {}): Promise<Blob> {
  const method = (options.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && !Object.keys(csrfHeader()).length)
    await fetch(`${API_BASE_URL}/api/v1/session`, { credentials: "include" });
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options, credentials: "include", headers: { ...csrfHeader(), ...options.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const defaultMessage = defaultMessageFor(response.status);
    throw new ApiError(payload?.detail ?? payload?.message ?? defaultMessage, response.status);
  }
  return response.blob();
}
