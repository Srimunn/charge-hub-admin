const rawUrl = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : undefined;
export const API_URL = (rawUrl && rawUrl !== "undefined" && rawUrl !== "null") ? rawUrl : "http://localhost:5000";
export const BASE_URL = `${API_URL}/api`;

export const getImageUrl = (imagePath: string | null | undefined) => {
  if (!imagePath) return "";
  if (imagePath.startsWith('http') || imagePath.startsWith('data:')) return imagePath;
  
  // High-reliability base URL resolution
  let base = API_URL;
  if (!base || base === "undefined" || base === "null") {
    base = "http://localhost:5000";
  }
  
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${cleanBase}${cleanPath}`;
};

const getToken = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("token");
  }
  return null;
};

const authHeaders = () => {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
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
  return res.json();
};

export const verifyOTP = async (data: any) => {
  const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
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
  const headers: any = token ? { Authorization: `Bearer ${token}` } : {};

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
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const updateStation = async (id: string, data: any) => {
  const token = getToken();
  const headers: any = token ? { Authorization: `Bearer ${token}` } : {};

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
  if (!res.ok) throw new Error(await res.text());
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
