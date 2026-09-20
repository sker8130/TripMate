import { secureGet, secureSet, secureDel } from './storage';

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (!BASE_URL) {
  throw new Error("EXPO_PUBLIC_API_URL is not defined in .env");
}
const TOKEN_KEY = 'tripmate_token';

// ─── Token management ─────────────────────────────────────────────────────────

export async function getToken(): Promise<string | null> {
  try {
    return await secureGet(TOKEN_KEY);
  } catch (e) {
    console.error('[API] getToken error:', e);
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  try {
    await secureSet(TOKEN_KEY, token);
  } catch (e) {
    console.error('[API] setToken error:', e);
  }
}

export async function clearToken(): Promise<void> {
  try {
    await secureDel(TOKEN_KEY);
  } catch (e) {
    console.error('[API] clearToken error:', e);
  }
}

// ─── HTTP client ──────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  requiresAuth = true
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (requiresAuth) {
    const token = await getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.warn(`[API] No token for authenticated request: ${path}`);
      throw new Error('AUTH_REQUIRED');
    }
  }

  const url = `${BASE_URL}${path}`;
  const method = options.method || 'GET';

  console.log(`[API] ${method} ${path}`);

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let data: any;
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const msg = data?.error || data?.message || `HTTP ${response.status}`;
    console.error(`[API] Error ${response.status} ${method} ${path}: ${msg}`);
    const err: any = new Error(msg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data as T;
}

function post<T>(path: string, body: unknown, auth = true) {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) }, auth);
}

function patch<T>(path: string, body: unknown, auth = true) {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, auth);
}

function del<T>(path: string, auth = true) {
  return request<T>(path, { method: 'DELETE' }, auth);
}

function get<T>(path: string, auth = true) {
  return request<T>(path, {}, auth);
}

// ─── API Modules ──────────────────────────────────────────────────────────────

const auth = {
  login: (emailOrPhone: string, password: string) =>
    post<{ token: string; user: any }>('/auth/login', { emailOrPhone, password }, false),

  register: (email: string, username: string, phone: string, password: string) =>
    post<{ token: string; user: any }>('/auth/register', { email, username, phone, password }, false),

  me: () => get<any>('/auth/me'),

  updateProfile: (data: Partial<any>) => patch<any>('/auth/profile', data),

  changePassword: (currentPassword: string, newPassword: string) =>
    post<{ message: string }>('/auth/change-password', { currentPassword, newPassword }),

  forgotPassword: (email: string) =>
    post<{ message: string }>('/auth/forgot-password', { email }, false),

  deleteAccount: () =>
    del<{ message: string }>('/auth/account'),
};

const trips = {
  list: () => get<any[]>('/trips'),
  get: (id: string) => get<any>(`/trips/${id}`),
  create: (data: {
    name: string; startDate: string; endDate: string;
    description: string; destinations: string[]; memberPhones: string[]; image?: string;
  }) => post<any>('/trips', data),
  update: (id: string, data: Partial<any>) => patch<any>(`/trips/${id}`, data),
  delete: (id: string) => del<{ message: string }>(`/trips/${id}`),
  join: (inviteCode: string) => post<any>('/trips/join', { inviteCode }),
  expenseReport: (id: string) => get<any>(`/trips/${id}/expense-report`),
};

const activities = {
  list: (tripId: string) => get<any[]>(`/trips/${tripId}/activities`),
  add: (tripId: string, data: Omit<any, 'id' | 'tripId'>) =>
    post<any>(`/trips/${tripId}/activities`, data),
  update: (tripId: string, actId: string, data: Partial<any>) =>
    patch<any>(`/trips/${tripId}/activities/${actId}`, data),
  delete: (tripId: string, actId: string) =>
    del<{ message: string }>(`/trips/${tripId}/activities/${actId}`),
};

const checklist = {
  list: (tripId: string) => get<any[]>(`/trips/${tripId}/checklist`),
  add: (tripId: string, data: Omit<any, 'id' | 'tripId'>) =>
    post<any>(`/trips/${tripId}/checklist`, data),
  update: (tripId: string, itemId: string, data: Partial<any>) =>
    patch<any>(`/trips/${tripId}/checklist/${itemId}`, data),
  delete: (tripId: string, itemId: string) =>
    del<{ message: string }>(`/trips/${tripId}/checklist/${itemId}`),
};

const expenses = {
  list: (tripId: string) => get<any[]>(`/trips/${tripId}/expenses`),
  add: (tripId: string, data: Omit<any, 'id' | 'tripId'>) =>
    post<any>(`/trips/${tripId}/expenses`, data),
  update: (tripId: string, expId: string, data: Partial<any>) =>
    patch<any>(`/trips/${tripId}/expenses/${expId}`, data),
  delete: (tripId: string, expId: string) =>
    del<{ message: string }>(`/trips/${tripId}/expenses/${expId}`),
};

const members = {
  add: (tripId: string, phone: string) =>
    post<any>(`/trips/${tripId}/members`, { phone }),
  remove: (tripId: string, memberId: string) =>
    del<{ message: string }>(`/trips/${tripId}/members/${memberId}`),
  promote: (tripId: string, memberId: string) =>
    patch<any>(`/trips/${tripId}/members/${memberId}/promote`, {}),
};

const users = {
  findByPhone: (phone: string) =>
    get<any>(
      `/users/search?phone=${encodeURIComponent(
        phone
      )}`
    ),

  findByEmail: (email: string) =>
    get<any>(
      `/users/search?email=${encodeURIComponent(
        email
      )}`
    ),

  search: (query: string) =>
    get<any[]>(
      `/users/search?q=${encodeURIComponent(
        query
      )}`
    ),

  delete: (id: string) =>
    del<{ message: string }>(
      `/users/${id}`
    ),
};
// ─── Default export ───────────────────────────────────────────────────────────

const api = { auth, trips, activities, checklist, expenses, members, users };
export default api;