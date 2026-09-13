export interface ApiResponse<T> {
  code: string;
  message: string;
  data: T;
  timestamp: string;
  requestId: string;
  correlationId: string;
}
export interface Page<T> {
  content: T[];
  total: number;
  page: number;
  offset: number;
  limit: number;
}
export interface PageParams {
  page?: number;
  size?: number;
  offset?: number;
  limit?: number;
  name?: string;
}
export interface Session {
  subject: string;
  name: string;
  email: string;
  tenantId: string;
}
export interface ApplicationInput {
  name: string;
  description: string;
  baseUrl: string;
}
export interface Application extends ApplicationInput {
  id: string;
  tenantId: string;
  registeredAt: string;
}
// El secreto solo viaja en la respuesta de registro y de rotación de credencial (HU-012/HU-014):
// el PDP nunca vuelve a mostrarlo, así que no forma parte de `Application` (la lista no lo trae).
export interface RegisteredApplication extends Application {
  credential: string;
}
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export interface ResourceInput {
  path: string;
  method: HttpMethod;
}
export interface Resource extends ResourceInput {
  id: string;
  applicationId: string;
  tenantId: string;
  application?: Application;
}
export interface TenantInput {
  code: string;
  name: string;
}
export interface Tenant extends TenantInput {
  status: string;
}
export interface User {
  id: string;
  name: string;
  email: string;
  provider: string;
  tenantId: string;
  lastLoginAt: string | null;
}
export interface RoleInput {
  name: string;
  scope: "APPLICATION" | "TENANT";
  applicationId: string;
}
export interface Role {
  id: string;
  name: string;
  scope: "APPLICATION" | "TENANT" | "GLOBAL";
  applicationId: string | null;
  tenantId: string | null;
  resourceIds: string[];
}
export interface AssignmentInput {
  userId: string;
  applicationId: string;
}
export interface Assignment extends AssignmentInput {
  id: string;
  tenantId: string;
  roleId: string;
  validFrom: string;
  validUntil: string | null;
  role?: Role;
}
export interface AuthorizationInput {
  applicationId: string;
  resourcePath: string;
  action: HttpMethod;
}
export interface Decision {
  decisionId: string;
  state: string;
  reasonCode: string;
  correlationId: string;
  decidedAt: string;
  policyReferences: { policyId: string; version: string }[];
}
// Perfiles (HU-011): agrupan varios roles para asignarlos de una sola vez. scope es 'TENANT' o
// 'APPLICATION', igual que Role — GLOBAL no se administra por HTTP todavía.
export interface ProfileInput {
  name: string;
  scope: "APPLICATION" | "TENANT";
  applicationId: string;
}
export interface Profile {
  id: string;
  name: string;
  scope: "APPLICATION" | "TENANT" | "GLOBAL";
  applicationId: string | null;
  tenantId: string | null;
  roleIds: string[];
}
export interface ProfileAssignmentInput {
  userId: string;
  applicationId: string;
}
// El PDP no expone todavía una consulta de asignaciones de perfil: esta lista solo existe en la
// sesión del navegador, con lo que se creó desde que se abrió la página — no sobrevive a un refresh.
export interface ProfileAssignment extends ProfileAssignmentInput {
  id: string;
  tenantId: string;
  profileId: string;
  generatedAssignmentIds: string[];
  validFrom: string;
  validUntil: string | null;
  profileName?: string;
}
