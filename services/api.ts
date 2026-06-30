// API URL resolution strategy:
// - Browser (client-side): use "" (empty string) so all fetch calls go to the same origin,
//   and Next.js rewrites (/api/* → backend) handle the proxying transparently.
// - Server-side (SSR / NextAuth callbacks): use NEXT_PUBLIC_API_URL or BACKEND_API_URL
//   so Next.js can reach the backend directly.
const getApiUrl = (): string => {
  // Client-side: communicate directly from browser to backend using NEXT_PUBLIC_API_URL,
  // which bypasses any frontend server proxy DNS resolution issues.
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL || "";
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
  return process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
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

const handleAuthError = async (res: Response) => {
  if (res.status === 401) {
    clearToken();
    throw new Error("Authentication failed. Please log in again.");
  }
  throw new Error(await res.text());
};

// AUTH
export const registerUser = async (data: any) => {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const loginUser = async (data: any) => {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
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
  if (!res.ok) throw new Error(await res.text());
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

// CREATE station
export const createStation = async (data: any) => {
  const token = getToken();
  if (!token) throw new Error("Authentication required. Please log in again.");

  const headers: any = { Authorization: `Bearer ${token}` };

  const formData = new FormData();
  formData.append("name", data.name);
  formData.append("location", data.location);
  if (data.latitude) formData.append("latitude", String(data.latitude));
  if (data.longitude) formData.append("longitude", String(data.longitude));
  if (data.district) formData.append("district", data.district);
  formData.append("powerOutput", String(data.powerOutput));
  formData.append("ports", String(data.ports));
  formData.append("basePricePerKwh", String(data.basePricePerKwh || 0));
  formData.append("convenienceFee", String(data.convenienceFee || 0));
  formData.append("tax", String(data.tax || 0));
  formData.append("districtPin", String(data.districtPin || "000"));

  if (data.dynamicPricing) {
    formData.append("dynamicPricing", JSON.stringify(data.dynamicPricing));
  }

  if (data.imageFile) {
    formData.append("image", data.imageFile);
  }

  const res = await fetch(`${BASE_URL}/stations`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) await handleAuthError(res);
  return res.json();
};

export const updateStation = async (id: string, data: any) => {
  const token = getToken();
  if (!token) throw new Error("Authentication required. Please log in again.");

  const headers: any = { Authorization: `Bearer ${token}` };

  const formData = new FormData();
  if (data.name) formData.append("name", data.name);
  if (data.location) formData.append("location", data.location);
  if (data.latitude) formData.append("latitude", String(data.latitude));
  if (data.longitude) formData.append("longitude", String(data.longitude));
  if (data.district) formData.append("district", data.district);
  if (data.powerOutput) formData.append("powerOutput", String(data.powerOutput));
  if (data.ports) formData.append("ports", String(data.ports));
  if (data.status) formData.append("status", data.status);
  if (data.basePricePerKwh) formData.append("basePricePerKwh", String(data.basePricePerKwh));
  if (data.convenienceFee) formData.append("convenienceFee", String(data.convenienceFee));
  if (data.tax) formData.append("tax", String(data.tax));

  if (data.dynamicPricing) {
    formData.append("dynamicPricing", JSON.stringify(data.dynamicPricing));
  }

  if (data.imageFile) {
    formData.append("image", data.imageFile);
  }

  const res = await fetch(`${BASE_URL}/stations/${id}`, {
    method: "PUT",
    headers,
    body: formData,
  });
  if (!res.ok) await handleAuthError(res);
  return res.json();
};

export const deleteStation = async (id: string) => {
  const res = await fetch(`${BASE_URL}/stations/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
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

export const startSession = async (stationId: string) => {
  const res = await fetch(`${BASE_URL}/sessions/start`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ stationId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const stopSession = async (sessionId: string) => {
  const res = await fetch(`${BASE_URL}/sessions/stop/${sessionId}`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
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

export const getUsers = async () => {
  if (!getToken()) return [];
  const res = await fetch(`${BASE_URL}/users`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch users");
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
