import type { ApplicationEnvironment } from "./contracts";

export const APPLICATION_ENVIRONMENTS: { value: ApplicationEnvironment; label: string }[] = [
  { value: "dev", label: "Desarrollo" },
  { value: "lab", label: "Laboratorio" },
  { value: "prod", label: "Producción" },
];

export const environmentLabel = (environment: ApplicationEnvironment) =>
  APPLICATION_ENVIRONMENTS.find(({ value }) => value === environment)?.label ?? environment;
