export type UserRole = 'super_admin' | 'head_tech' | 'technician';

export interface UserPermissions {
  canViewDashboard: boolean;
  canEnterDaily: boolean;
  canViewReports: boolean;
  canEditHistory: boolean;
  canDeleteHistory: boolean;
  canManageInventory: boolean;
  canManageTechnicians: boolean;
  canSyncSheets: boolean;
  canManageUsers: boolean;
  canEditCompany: boolean;
}

export interface UserAccount {
  id: string;
  username: string;
  fullName: string;
  phone: string;
  department: string;
  role: UserRole;
  active: boolean;
  canLogin: boolean;
  permissions: UserPermissions;
  createdAt: string;
}

export interface CompanySettings {
  name: string;
  address: string;
  taxId: string;
  phone: string;
  siteName: string;
  logoDataUrl: string;
  defaultSenderLabel: string;
  defaultInspectorLabel: string;
  googleSheetId: string;
  googleSheetName: string;
  appsScriptUrl?: string;
  autoSyncSheets: boolean;
  lastSyncedAt: string;
}

export type ACType = 'normal' | 'vrf';
export type ACUnitStatus = 'active' | 'cancelled';

export interface ACUnit {
  id: string;
  building: string;
  floor: string;
  room: string;
  unitCode: string;
  acType: ACType;
  btu: string;
  brand: string;
  model?: string;
  installType?: string;
  status: ACUnitStatus;
  notes: string;
  sortOrder: number;
  createdAt: string;
}

export type CleaningStatus =
  | 'cleaned'
  | 'patient_occupied'
  | 'renovation'
  | 'no_card';

export interface CleaningLog {
  id: string;
  date: string; // YYYY-MM-DD
  unitId: string;
  building: string;
  floor: string;
  room: string;
  unitCode: string;
  acType: ACType;
  status: CleaningStatus;
  technicianId: string;
  technicianName: string;
  enteredByUserId: string;
  enteredByName: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface BatchLogItemInput {
  mode: 'existing' | 'new';
  unitId?: string;
  building: string;
  floor: string;
  room: string;
  unitCode: string;
  acType: ACType;
  btu?: string;
  brand?: string;
  model?: string;
  installType?: string;
  status: CleaningStatus;
  notes?: string;
}

export interface TechnicianStat {
  technicianId: string;
  technicianName: string;
  cleanedCount: number;
  normalCount: number;
  vrfCount: number;
  uncleanedCount: number;
  buildings: string[];
}

export const CLEANING_STATUS_LABELS: Record<CleaningStatus, string> = {
  cleaned: 'ล้างแล้ว',
  patient_occupied: 'ไม่ได้เข้าล้าง - ห้องมีคนไข้',
  renovation: 'ไม่ได้เข้าล้าง - ปิดปรับปรุง',
  no_card: 'ไม่ได้เข้าล้าง - ไม่มีการ์ด',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Admin สูงสุด',
  head_tech: 'หัวหน้าช่างเทคนิค',
  technician: 'ช่างเทคนิค',
};

export const DEFAULT_PERMISSIONS_BY_ROLE: Record<UserRole, UserPermissions> = {
  super_admin: {
    canViewDashboard: true,
    canEnterDaily: true,
    canViewReports: true,
    canEditHistory: true,
    canDeleteHistory: true,
    canManageInventory: true,
    canManageTechnicians: true,
    canSyncSheets: true,
    canManageUsers: true,
    canEditCompany: true,
  },
  head_tech: {
    canViewDashboard: true,
    canEnterDaily: true,
    canViewReports: true,
    canEditHistory: true,
    canDeleteHistory: true,
    canManageInventory: true,
    canManageTechnicians: true,
    canSyncSheets: true,
    canManageUsers: false,
    canEditCompany: true,
  },
  technician: {
    canViewDashboard: false,
    canEnterDaily: true,
    canViewReports: true,
    canEditHistory: false,
    canDeleteHistory: false,
    canManageInventory: false,
    canManageTechnicians: false,
    canSyncSheets: false,
    canManageUsers: false,
    canEditCompany: false,
  },
};
