// Client-side session helpers. The backend JWT lives in localStorage (sent as a Bearer token).

export type Role = "admin" | "owner" | "customer";

export const OPERATOR_ROLES: Role[] = ["admin", "owner"];
export const isOperatorRole = (role?: string | null): role is "admin" | "owner" =>
  role === "admin" || role === "owner";

type AuthUser = {
  token: string;
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  mobile?: string | null;
  role?: string;
  sessionTimeout?: number;
};

export const saveAuth = (u: AuthUser) => {
  localStorage.setItem("token", u.token);
  localStorage.setItem("userName", u.name || "");
  localStorage.setItem("userEmail", u.email || "");
  localStorage.setItem("userMobile", u.mobile || "");
  localStorage.setItem("userId", u._id || u.id || "");
  localStorage.setItem("userRole", u.role || "");
  localStorage.setItem("sessionTimeout", String(u.sessionTimeout || 30));
  window.dispatchEvent(new Event("auth-changed"));
};

export const clearAuth = () => {
  for (const k of ["token", "userName", "userEmail", "userMobile", "userId", "userRole", "sessionTimeout"]) {
    localStorage.removeItem(k);
  }
};

export const getRole = (): Role | null => {
  if (typeof window === "undefined") return null;
  const r = localStorage.getItem("userRole");
  return r === "admin" || r === "owner" || r === "customer" ? r : null;
};

export const isAdmin = () => getRole() === "admin";
