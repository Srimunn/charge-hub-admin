// API URL resolution strategy:
// - Browser (client-side): use NEXT_PUBLIC_API_URL (baked in at build time, e.g.
//   https://operator-api.magnertia.in). If it is missing on a deployed host, fall back to ""
//   (same origin) so middleware.ts proxies /api/* to BACKEND_API_URL.
// - Server-side (SSR / NextAuth callbacks): use BACKEND_API_URL or NEXT_PUBLIC_API_URL
//   so Next.js can reach the backend directly.
const getApiUrl = (): string => {
  if (typeof window !== "undefined") {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl && envUrl !== "undefined" && envUrl !== "null" && envUrl.trim() !== "") {
      return envUrl.replace(/\/$/, "");
    }
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      return "";
    }
    return "http://127.0.0.1:5000";
  }
  // Server-side: prefer explicit env vars
  const candidates = [
    process.env.BACKEND_API_URL,
    process.env.NEXT_PUBLIC_API_URL,
  ];
  for (const url of candidates) {
    if (url && url !== "undefined" && url !== "null" && url.trim() !== "") {
      return url.replace(/\/$/, "");
    }
  }
  return "http://127.0.0.1:5000";
};

export const API_URL = getApiUrl();
export const BASE_URL = `${API_URL}/api`;

export const getImageUrl = (imagePath: string | null | undefined) => {
  if (!imagePath) return "";
  if (imagePath.startsWith('http') || imagePath.startsWith('data:')) return imagePath;
  
  // High-reliability base URL resolution
  let base = API_URL;
  if (!base || base === "undefined" || base === "null") {
    base = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  }
  
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${cleanBase}${cleanPath}`;
};

export const getToken = () => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (!token || token === "null" || token === "undefined") return null;
    return token.trim();
  }
  return null;
};

const clearToken = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userMobile");
    localStorage.removeItem("userId");
    localStorage.removeItem("userRole");
    window.dispatchEvent(new Event("auth-expired"));
  }
};

const originalFetch = typeof window !== 'undefined' ? window.fetch : globalThis.fetch;

const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const res = await originalFetch(input, init);
  if (res.status === 401) {
    clearToken();
    throw new Error("Session expired. Please log in again.");
  }
  return res;
};

const fetch = customFetch;

const authHeaders = () => {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const parseErrorText = async (res: Response): Promise<string> => {
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return json.error || json.message || text;
    } catch {
      return text || `Request failed with status ${res.status}`;
    }
  } catch {
    return `Request failed with status ${res.status}`;
  }
};

const handleAuthError = async (res: Response) => {
  if (res.status === 401) {
    clearToken();
    throw new Error("Authentication failed. Please log in again.");
  }
  throw new Error(await parseErrorText(res));
};

// AUTH
export const registerUser = async (data: any) => {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseErrorText(res));
  return res.json();
};

export const loginUser = async (data: any) => {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseErrorText(res));
  const json = await res.json();
  if (!json?.token) throw new Error('Authentication token not received');
  return json;
};

export const verifyOTP = async (data: any) => {
  const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseErrorText(res));
  const json = await res.json();
  if (!json?.token) throw new Error('Authentication token not received');
  return json;
};

export const requestPasswordOTP = async () => {
  const res = await fetch(`${BASE_URL}/auth/request-password-otp`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const changePassword = async (data: any) => {
  const res = await fetch(`${BASE_URL}/auth/change-password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const getMe = async () => {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    method: "GET",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const verifyPasswordOTP = async (otp: string) => {
  const res = await fetch(`${BASE_URL}/auth/verify-password-otp`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ otp }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const updateSessionTimeout = async (timeout: number) => {
  const res = await fetch(`${BASE_URL}/auth/session-timeout`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ timeout }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const setPin = async (pin: string, mobile?: string, explicitToken?: string) => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = explicitToken || getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/auth/set-pin`, {
    method: "POST",
    headers,
    body: JSON.stringify({ pin, mobile }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

// GET dashboard KPIs
export const getDashboardKPIs = async () => {
  const res = await fetch(`${BASE_URL}/dashboard/kpis`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch KPIs");
  return res.json();
};

// GET stations by User Token
export const getStations = async () => {
  if (!getToken()) return [];
  const res = await fetch(`${BASE_URL}/stations`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch stations");
  return res.json();
};

// GET station by ID
export const getStationById = async (id: string) => {
  const res = await fetch(`${BASE_URL}/stations/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch station details");
  return res.json();
};

const STATION_FIELDS = [
  "name", "location", "district", "districtPin", "latitude", "longitude", "powerOutput", "ports",
  "connectorType", "status", "basePricePerKwh", "convenienceFee", "tax", "ownerId", "simulated", "ocppPassword",
] as const;

/** Multipart body for station create/update. Sends every field that is set, including 0/false. */
const stationFormData = (data: any) => {
  const formData = new FormData();
  for (const key of STATION_FIELDS) {
    const v = data[key];
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "" && key !== "ocppPassword")) continue;
    formData.append(key, String(v));
  }
  if (data.dynamicPricing) formData.append("dynamicPricing", JSON.stringify(data.dynamicPricing));
  if (data.imageFile) formData.append("image", data.imageFile);
  return formData;
};

const multipartAuth = () => {
  const token = getToken();
  if (!token) throw new Error("Authentication required. Please log in again.");
  return { Authorization: `Bearer ${token}` };
};

// CREATE station
export const createStation = async (data: any) => {
  const res = await fetch(`${BASE_URL}/stations`, {
    method: "POST",
    headers: multipartAuth(),
    body: stationFormData({ districtPin: "000", ...data }),
  });
  if (!res.ok) await handleAuthError(res);
  return res.json();
};

export const updateStation = async (id: string, data: any) => {
  const res = await fetch(`${BASE_URL}/stations/${id}`, {
    method: "PUT",
    headers: multipartAuth(),
    body: stationFormData(data),
  });
  if (!res.ok) await handleAuthError(res);
  return res.json();
};

export const deleteStation = async (id: string) => {
  const res = await fetch(`${BASE_URL}/stations/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseErrorText(res));
  return res.json();
};

// SESSIONS
export const getSessions = async () => {
  if (!getToken()) return [];
  const res = await fetch(`${BASE_URL}/sessions`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const getLiveSessions = async () => {
  if (!getToken()) return [];
  const res = await fetch(`${BASE_URL}/sessions/live`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

/** Operator test start (admin/owner). Customers start from the mobile app after paying. */
export const startSession = async (stationId: string, connectorId = 1) => {
  const res = await fetch(`${BASE_URL}/sessions/start`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ stationId, connectorId }),
  });
  if (!res.ok) throw new Error(await parseErrorText(res));
  return res.json();
};

export const stopSession = async (sessionId: string) => {
  const res = await fetch(`${BASE_URL}/sessions/stop/${sessionId}`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseErrorText(res));
  return res.json();
};

// FAULTS
export const getFaults = async () => {
  if (!getToken()) return [];
  const res = await fetch(`${BASE_URL}/faults`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const getFaultById = async (id: string) => {
  const res = await fetch(`${BASE_URL}/faults/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch fault details");
  return res.json();
};

export const createFault = async (data: any) => {
  const res = await fetch(`${BASE_URL}/faults`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const resolveFault = async (faultId: string) => {
  const res = await fetch(`${BASE_URL}/faults/${faultId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ status: "resolved" }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

// PAYMENTS
export const getPayments = async () => {
  if (!getToken()) return [];
  const res = await fetch(`${BASE_URL}/payments`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch payments");
  return res.json();
};

// USERS (admin manages owners/admins; owners see customers who charged at their stations)
export const getUsers = async (role?: string) => {
  if (!getToken()) return [];
  const qs = role ? `?role=${encodeURIComponent(role)}` : "";
  const res = await fetch(`${BASE_URL}/users${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await parseErrorText(res));
  return res.json();
};

export const createUser = async (data: { name: string; email: string; mobile?: string; password?: string; role: "owner" | "admin" }) => {
  const res = await fetch(`${BASE_URL}/users`, { method: "POST", headers: authHeaders(), body: JSON.stringify(data) });
  if (!res.ok) throw new Error(await parseErrorText(res));
  return res.json();
};

export const updateUser = async (id: string, data: { role?: string; status?: "active" | "blocked"; name?: string; mobile?: string; password?: string }) => {
  const res = await fetch(`${BASE_URL}/users/${id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(data) });
  if (!res.ok) throw new Error(await parseErrorText(res));
  return res.json();
};

export const getAuditLogs = async () => {
  const res = await fetch(`${BASE_URL}/users/audit-logs`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await parseErrorText(res));
  return res.json();
};

export const retryRefund = async (paymentId: string) => {
  const res = await fetch(`${BASE_URL}/payments/${paymentId}/retry-refund`, { method: "POST", headers: authHeaders() });
  if (!res.ok) throw new Error(await parseErrorText(res));
  return res.json();
};

export const simulateFault = async (stationId: string, faultCode: string) => {
  const res = await fetch(`${BASE_URL}/faults/simulate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ stationId, faultCode }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const getReports = async (filters?: any) => {
  if (!getToken()) return null;
  let url = `${BASE_URL}/dashboard/reports`;
  if (filters) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.append(key, String(val));
      }
    });
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch reports");
  return res.json();
};

export const getRevenueAnalytics = async (filters?: any) => {
  if (!getToken()) return null;
  let url = `${BASE_URL}/dashboard/analytics/revenue`;
  if (filters) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.append(key, String(val));
      }
    });
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch revenue analytics");
  return res.json();
};

export const getSessionAnalytics = async (filters?: any) => {
  if (!getToken()) return null;
  let url = `${BASE_URL}/dashboard/analytics/sessions`;
  if (filters) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.append(key, String(val));
      }
    });
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch session analytics");
  return res.json();
};

export const getFaultAnalytics = async (filters?: any) => {
  if (!getToken()) return null;
  let url = `${BASE_URL}/dashboard/analytics/faults`;
  if (filters) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.append(key, String(val));
      }
    });
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch fault analytics");
  return res.json();
};

export const getUtilizationAnalytics = async (filters?: any) => {
  if (!getToken()) return null;
  let url = `${BASE_URL}/dashboard/analytics/utilization`;
  if (filters) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.append(key, String(val));
      }
    });
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch utilization analytics");
  return res.json();
};

// NOTIFICATIONS APIs
export const getNotifications = async () => {
  if (!getToken()) return [];
  const res = await fetch(`${BASE_URL}/notifications`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch notifications");
  return res.json();
};

export const getNotificationStats = async () => {
  if (!getToken()) return null;
  const res = await fetch(`${BASE_URL}/notifications/stats`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch notification stats");
  return res.json();
};

export const sendTestNotification = async (data: { title: string; message: string; type?: string; metadata?: any }) => {
  if (!getToken()) return null;
  const res = await fetch(`${BASE_URL}/notifications/send`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const markNotificationsRead = async (notificationIds?: string[]) => {
  if (!getToken()) return null;
  const res = await fetch(`${BASE_URL}/notifications/read`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ notificationIds }),
  });
  if (!res.ok) throw new Error("Failed to mark notifications as read");
  return res.json();
};

export const updateNotificationPreferences = async (preferences: {
  emailAlerts?: boolean;
  smsAlerts?: boolean;
  pushAlerts?: boolean;
  faultAlerts?: boolean;
  paymentAlerts?: boolean;
}) => {
  if (!getToken()) return null;
  const res = await fetch(`${BASE_URL}/notifications/preferences`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(preferences),
  });
  if (!res.ok) throw new Error("Failed to update notification preferences");
  return res.json();
};
