import { apiRequest } from "./api";
import type { AdminOverview, AdminUserDetail, AdminUsersPage } from "../../../shared/admin";
async function adminGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const result = await apiRequest("/admin" + path, signal);
  if (!result || typeof result !== "object" || !("data" in result)) throw new Error("La información administrativa no está disponible.");
  return result.data as T;
}
export const adminService = {
  overview: (signal?: AbortSignal) => adminGet<AdminOverview>("/summary", signal),
  users: (offset = 0, signal?: AbortSignal) => adminGet<AdminUsersPage>("/users?" + new URLSearchParams({ offset: String(offset) }), signal),
  user: (uid: string, signal?: AbortSignal) => adminGet<AdminUserDetail>("/users/" + encodeURIComponent(uid), signal),
};
