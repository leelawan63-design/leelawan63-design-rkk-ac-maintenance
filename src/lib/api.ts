import type {
  ACUnit,
  BatchLogItemInput,
  CleaningLog,
  CompanySettings,
  UserAccount,
  UserPermissions,
  UserRole,
} from '../types';

const SESSION_KEY = 'rkk_ac_session_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(SESSION_KEY, token);
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `เกิดข้อผิดพลาด (${res.status})`);
  }
  return data as T;
}

export interface TechnicianOption {
  id: string;
  fullName: string;
  phone: string;
  username: string;
  role: UserRole;
  department: string;
  canLogin: boolean;
  active: boolean;
}

export const api = {
  getPublicCompany: () =>
    request<Pick<CompanySettings, 'name' | 'address' | 'taxId' | 'phone' | 'siteName' | 'logoDataUrl'>>(
      '/api/public/company'
    ),

  login: (username: string, password: string) =>
    request<{ token: string; user: UserAccount; company: CompanySettings }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  me: () => request<{ user: UserAccount; company: CompanySettings }>('/api/auth/me'),

  getTechnicians: () => request<{ technicians: TechnicianOption[] }>('/api/technicians'),

  getAllTechnicians: () =>
    request<{ technicians: TechnicianOption[] }>('/api/technicians?includeInactive=1'),

  createTechnician: (payload: {
    fullName: string;
    phone: string;
    username?: string;
    password?: string;
    canLogin?: boolean;
    active?: boolean;
  }) =>
    request<{ technician: TechnicianOption }>('/api/technicians', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTechnician: (
    id: string,
    payload: {
      fullName?: string;
      phone?: string;
      username?: string;
      password?: string;
      canLogin?: boolean;
      active?: boolean;
    }
  ) =>
    request<{ technician: TechnicianOption }>(`/api/technicians/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteTechnician: (id: string) =>
    request<{ ok: boolean }>(`/api/technicians/${id}`, { method: 'DELETE' }),

  updateCompany: (payload: Partial<CompanySettings>) =>
    request<{ company: CompanySettings }>('/api/company', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getUsers: () => request<{ users: UserAccount[] }>('/api/users'),

  createUser: (payload: {
    username: string;
    password: string;
    fullName: string;
    phone?: string;
    department?: string;
    role: UserRole;
    permissions?: Partial<UserPermissions>;
    canLogin?: boolean;
    active?: boolean;
  }) =>
    request<{ user: UserAccount }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateUser: (
    id: string,
    payload: {
      fullName?: string;
      phone?: string;
      department?: string;
      role?: UserRole;
      permissions?: Partial<UserPermissions>;
      canLogin?: boolean;
      active?: boolean;
      password?: string;
    }
  ) =>
    request<{ user: UserAccount }>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteUser: (id: string) =>
    request<{ ok: boolean }>(`/api/users/${id}`, { method: 'DELETE' }),

  getUnits: () => request<{ units: ACUnit[] }>('/api/units'),

  createUnit: (payload: Partial<ACUnit>) =>
    request<{ unit: ACUnit; units: ACUnit[] }>('/api/units', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  importUnits: (rows: Array<Record<string, string>>, replaceAll = false) =>
    request<{ addedCount: number; updatedCount: number; units: ACUnit[] }>('/api/units/import', {
      method: 'POST',
      body: JSON.stringify({ rows, replaceAll }),
    }),

  updateUnit: (id: string, payload: Partial<ACUnit>) =>
    request<{ unit: ACUnit; units: ACUnit[] }>(`/api/units/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteUnit: (id: string) =>
    request<{ ok: boolean; units: ACUnit[] }>(`/api/units/${id}`, { method: 'DELETE' }),

  getLogs: (params?: {
    startDate?: string;
    endDate?: string;
    building?: string;
    status?: string;
    technicianId?: string;
    search?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v && v !== 'all') qs.set(k, v);
      }
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ logs: CleaningLog[] }>(`/api/logs${suffix}`);
  },

  createBatchLogs: (payload: {
    date: string;
    technicianId?: string;
    items: BatchLogItemInput[];
  }) =>
    request<{ createdLogs: CleaningLog[]; createdUnits: ACUnit[]; units: ACUnit[] }>(
      '/api/logs/batch',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  updateLog: (
    id: string,
    payload: {
      date?: string;
      status?: CleaningLog['status'];
      notes?: string;
      technicianId?: string;
    }
  ) =>
    request<{ log: CleaningLog }>(`/api/logs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteLog: (id: string) =>
    request<{ ok: boolean }>(`/api/logs/${id}`, { method: 'DELETE' }),
};
