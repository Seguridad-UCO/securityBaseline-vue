export function formatDate(value: string, withTime = false) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "medium" as const } : {}),
  }).format(new Date(value));
}
