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
    const headers = new Headers({
      "Content-Type": "application/json",
      ...csrfHeader(),
    });
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
    throw new ApiError(
      payload?.detail ??
        payload?.message ??
        `El API respondió con estado ${response.status}.`,
      response.status,
    );
  }
  return response.status === 204
    ? (null as T)
    : (response.json() as Promise<T>);
}
