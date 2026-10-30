export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:18080"
).replace(/\/$/, "");
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
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
    throw new ApiError(
      payload?.detail ??
        payload?.message ??
        defaultMessage,
      response.status,
    );
  }
  return response.status === 204
    ? (null as T)
    : (response.json() as Promise<T>);
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
