import { API_BASE_URL, request } from "./client";
import type {
  ApiResponse,
  Application,
  ApplicationInput,
  Assignment,
  AssignmentInput,
  AuthorizationInput,
  Decision,
  Page,
  PageParams,
  Profile,
  ProfileAssignment,
  ProfileAssignmentInput,
  ProfileInput,
  RegisteredApplication,
  Resource,
  ResourceInput,
  Role,
  RoleInput,
  Session,
  Tenant,
  TenantInput,
  User,
} from "./contracts";

function query(params: PageParams = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return query.size ? `?${query}` : "";
}
const id = encodeURIComponent;
const body = (method: string, data: unknown): RequestInit => ({
  method,
  body: JSON.stringify(data),
});
export const getApiBaseUrl = () => API_BASE_URL;
export const getSession = () =>
  request<ApiResponse<Session>>("/api/v1/session");
export const startKeycloakLogin = () =>
  window.location.assign(`${API_BASE_URL}/oauth2/authorization/keycloak`);
export const startKeycloakRegistration = () =>
  window.location.assign(
    `${API_BASE_URL}/oauth2/authorization/keycloak/register`,
  );
export const endSession = () =>
  window.location.assign(`${API_BASE_URL}/api/v1/session/logout`);
export const listApplications = (params?: PageParams) =>
  request<ApiResponse<Page<Application>>>(
    `/api/v1/applications${query(params)}`,
  );
// El registro (HU-012) devuelve el secreto en texto plano una sola vez.
export const createApplication = (data: ApplicationInput) =>
  request<ApiResponse<RegisteredApplication>>(
    "/api/v1/applications",
    body("POST", data),
  );
export const listResources = (applicationId: string) =>
  request<ApiResponse<Resource[]>>(
    `/api/v1/applications/${id(applicationId)}/resources`,
  );
export const createResource = (applicationId: string, data: ResourceInput) =>
  request<ApiResponse<Resource>>(
    `/api/v1/applications/${id(applicationId)}/resources`,
    body("POST", data),
  );
export const listTenants = () =>
  request<ApiResponse<Tenant[]>>("/api/v1/tenants");
export const createTenant = (data: TenantInput) =>
  request<ApiResponse<Tenant>>("/api/v1/tenants", body("POST", data));
export const listUsers = () => request<ApiResponse<User[]>>("/api/v1/users");
export const assignUserTenant = (userId: string, tenantCode: string) =>
  request<ApiResponse<User>>(
    `/api/v1/users/${id(userId)}/tenant`,
    body("PUT", { tenantCode }),
  );
export const listRoles = (params?: PageParams) =>
  request<ApiResponse<Page<Role>>>(`/api/v1/roles${query(params)}`);
export const createRole = (data: RoleInput) =>
  request<ApiResponse<Role>>("/api/v1/roles", body("POST", data));
export const grantResourceToRole = (roleId: string, resourceId: string) =>
  request<ApiResponse<Role>>(
    `/api/v1/roles/${id(roleId)}/resources`,
    body("POST", { resourceId }),
  );
export const listAssignments = (roleId: string, params?: PageParams) =>
  request<ApiResponse<Page<Assignment>>>(
    `/api/v1/roles/${id(roleId)}/assignments${query(params)}`,
  );
export const assignRole = (roleId: string, data: AssignmentInput) =>
  request<ApiResponse<Assignment>>(
    `/api/v1/roles/${id(roleId)}/assignments`,
    body("POST", data),
  );
export const revokeAssignment = (roleId: string, assignmentId: string) =>
  request<null>(`/api/v1/roles/${id(roleId)}/assignments/${id(assignmentId)}`, {
    method: "DELETE",
  });
export const authorize = (data: AuthorizationInput) =>
  request<ApiResponse<Decision>>("/api/v1/authorize", body("POST", data));
// Perfiles (HU-011).
export const listProfiles = (params?: PageParams) =>
  request<ApiResponse<Page<Profile>>>(`/api/v1/profiles${query(params)}`);
export const createProfile = (data: ProfileInput) =>
  request<ApiResponse<Profile>>("/api/v1/profiles", body("POST", data));
export const addRoleToProfile = (profileId: string, roleId: string) =>
  request<ApiResponse<Profile>>(
    `/api/v1/profiles/${id(profileId)}/roles`,
    body("POST", { roleId }),
  );
// Asignación de perfiles: materializa una asignación de rol por cada rol que el perfil agrupa. No
// hay endpoint de consulta todavía — solo alta y revocación (ver ProfileAssignment en contracts.ts).
export const assignProfile = (profileId: string, data: ProfileAssignmentInput) =>
  request<ApiResponse<ProfileAssignment>>(
    `/api/v1/profiles/${id(profileId)}/assignments`,
    body("POST", data),
  );
export const revokeProfileAssignment = (
  profileId: string,
  profileAssignmentId: string,
) =>
  request<null>(
    `/api/v1/profiles/${id(profileId)}/assignments/${id(profileAssignmentId)}`,
    { method: "DELETE" },
  );
