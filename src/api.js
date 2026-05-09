const BASE_URL = "http://localhost:5000/api";

const getToken = () => localStorage.getItem("token");

const authHeaders = () => {
    const token = getToken();
    return token ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` } : { "Content-Type": "application/json" };
};

// AUTH
export const registerUser = async (data) => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

export const loginUser = async (data) => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

export const verifyOTP = async (data) => {
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

// CREATE station tied to Token — sends multipart/form-data with optional image file
export const createStation = async (data) => {
    const token = getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    // Build FormData — data.imageFile is the raw File object, all other fields are strings
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('location', data.location);
    formData.append('powerOutput', String(data.powerOutput));
    formData.append('ports', String(data.ports));
    formData.append('basePricePerKwh', String(data.basePricePerKwh || 0));
    formData.append('convenienceFee', String(data.convenienceFee || 0));
    formData.append('tax', String(data.tax || 0));
    formData.append('districtPin', String(data.districtPin || '000'));
    
    if (data.dynamicPricing) {
        formData.append('dynamicPricing', JSON.stringify(data.dynamicPricing));
    }
    
    if (data.imageFile) {
        formData.append('image', data.imageFile);
    }

    const res = await fetch(`${BASE_URL}/stations`, {
        method: 'POST',
        headers, // No Content-Type — let browser set multipart boundary
        body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

export const updateStation = async (id, data) => {
    const token = getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const formData = new FormData();
    if (data.name) formData.append('name', data.name);
    if (data.location) formData.append('location', data.location);
    if (data.powerOutput) formData.append('powerOutput', String(data.powerOutput));
    if (data.ports) formData.append('ports', String(data.ports));
    if (data.status) formData.append('status', data.status);
    if (data.basePricePerKwh) formData.append('basePricePerKwh', String(data.basePricePerKwh));
    if (data.convenienceFee) formData.append('convenienceFee', String(data.convenienceFee));
    if (data.tax) formData.append('tax', String(data.tax));
    
    if (data.dynamicPricing) {
        formData.append('dynamicPricing', JSON.stringify(data.dynamicPricing));
    }
    
    if (data.imageFile) {
        formData.append('image', data.imageFile);
    }

    const res = await fetch(`${BASE_URL}/stations/${id}`, {
        method: 'PUT',
        headers,
        body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

export const deleteStation = async (id) => {
    const res = await fetch(`${BASE_URL}/stations/${id}`, {
        method: 'DELETE',
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

export const startSession = async (stationId) => {
    const res = await fetch(`${BASE_URL}/sessions/start`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ stationId })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

export const stopSession = async (sessionId) => {
    const res = await fetch(`${BASE_URL}/sessions/stop/${sessionId}`, {
        method: "POST",
        headers: authHeaders()
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

export const createFault = async (data) => {
    const res = await fetch(`${BASE_URL}/faults`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

export const resolveFault = async (faultId) => {
    const res = await fetch(`${BASE_URL}/faults/${faultId}`, {
        method: "PUT",
        headers: authHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
};