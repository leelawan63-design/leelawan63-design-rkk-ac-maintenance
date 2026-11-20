import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  ACUnit,
  CleaningLog,
  CompanySettings,
  UserAccount,
  UserPermissions,
  UserRole,
} from '../src/types.ts';
import { DEFAULT_PERMISSIONS_BY_ROLE } from '../src/types.ts';
import { getPdfSeedUnitsAndLogs } from './pdfSeedData.ts';

export interface StoredUser extends UserAccount {
  passwordHash: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface AppDatabase {
  company: CompanySettings;
  users: StoredUser[];
  units: ACUnit[];
  logs: CleaningLog[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'app-db.json');
const SESSION_FILE = path.join(DATA_DIR, 'sessions.json');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function sortUnitsByBuildingAndOrder(units: ACUnit[]): ACUnit[] {
  return [...units].sort((a, b) => {
    const bCmp = a.building.localeCompare(b.building, 'th');
    if (bCmp !== 0) return bCmp;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const fCmp = a.floor.localeCompare(b.floor, 'th', { numeric: true });
    if (fCmp !== 0) return fCmp;
    const rCmp = a.room.localeCompare(b.room, 'th', { numeric: true });
    if (rCmp !== 0) return rCmp;
    return a.unitCode.localeCompare(b.unitCode, 'th', { numeric: true });
  });
}

function createSeedDatabase(): AppDatabase {
  const nowIso = new Date().toISOString();

  const users: StoredUser[] = [
    {
      id: 'usr-admin',
      username: 'admin',
      fullName: 'ผู้ดูแลระบบสูงสุด (Admin)',
      phone: '081-839-5607',
      department: 'ผู้บริหารระบบ',
      role: 'super_admin',
      canLogin: true,
      active: true,
      permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE.super_admin },
      passwordHash: hashPassword('admin1234'),
      createdAt: nowIso,
    },
    {
      id: 'usr-head',
      username: 'headtech',
      fullName: 'หัวหน้าช่างเทคนิค',
      phone: '081-839-5607',
      department: 'แผนกช่างซ่อมบำรุง (หัวหน้าช่างเทคนิค)',
      role: 'head_tech',
      canLogin: true,
      active: true,
      permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE.head_tech },
      passwordHash: hashPassword('head1234'),
      createdAt: nowIso,
    },
  ];

  const { units, logs } = getPdfSeedUnitsAndLogs(nowIso);

  return {
    company: {
      name: 'บริษัท รุ่งเรืองกิจการช่าง จำกัด',
      address: '72/10 หมู่ที่ 6 ตำบลบึงคำพร้อย อำเภอลำลูกกา จังหวัดปทุมธานี 12150',
      taxId: '0135548000364',
      phone: '081-839-5607',
      siteName: 'โครงการบำรุงรักษาเครื่องปรับอากาศ โรงพยาบาลรามคำแหง (พ.ศ. 2569)',
      logoDataUrl: '',
      defaultSenderLabel: 'ผู้ส่งงาน (ช่างผู้ปฏิบัติงาน / ตัวแทนบริษัท)',
      defaultInspectorLabel: 'ผู้ตรวจรับงาน (เจ้าหน้าที่ผู้ว่าจ้าง)',
      googleSheetId: '',
      googleSheetName: 'รายงานล้างเครื่องปรับอากาศ - บจก. รุ่งเรืองกิจการช่าง',
      appsScriptUrl: '',
      autoSyncSheets: false,
      lastSyncedAt: '',
    },
    users,
    units: sortUnitsByBuildingAndOrder(units),
    logs,
  };
}

export function readDb(): AppDatabase {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const seed = createSeedDatabase();
    writeDb(seed);
    return seed;
  }
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  const parsed = JSON.parse(raw) as AppDatabase;
  parsed.users = (parsed.users || []).map((u) => ({
    ...u,
    phone: u.phone ?? '',
    canLogin: typeof u.canLogin === 'boolean' ? u.canLogin : true,
    permissions: normalizePermissions(u.role, u.permissions),
  }));
  return parsed;
}

export function writeDb(db: AppDatabase): void {
  ensureDataDir();
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

export function readSessions(): SessionRecord[] {
  ensureDataDir();
  if (!fs.existsSync(SESSION_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
    const sessions = JSON.parse(raw) as SessionRecord[];
    const now = Date.now();
    return sessions.filter((s) => new Date(s.expiresAt).getTime() > now);
  } catch {
    return [];
  }
}

export function writeSessions(sessions: SessionRecord[]): void {
  ensureDataDir();
  const tmpFile = `${SESSION_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(sessions, null, 2), 'utf-8');
  fs.renameSync(tmpFile, SESSION_FILE);
}

export function sanitizeUser(user: StoredUser): UserAccount {
  const { passwordHash: _removed, ...safe } = user;
  return safe;
}

export function normalizePermissions(role: UserRole, input?: Partial<UserPermissions>): UserPermissions {
  const base = { ...DEFAULT_PERMISSIONS_BY_ROLE[role] };
  if (!input) return base;
  return {
    canViewDashboard: typeof input.canViewDashboard === 'boolean' ? input.canViewDashboard : base.canViewDashboard,
    canEnterDaily: typeof input.canEnterDaily === 'boolean' ? input.canEnterDaily : base.canEnterDaily,
    canViewReports: typeof input.canViewReports === 'boolean' ? input.canViewReports : base.canViewReports,
    canEditHistory: typeof input.canEditHistory === 'boolean' ? input.canEditHistory : base.canEditHistory,
    canDeleteHistory: typeof input.canDeleteHistory === 'boolean' ? input.canDeleteHistory : base.canDeleteHistory,
    canManageInventory: typeof input.canManageInventory === 'boolean' ? input.canManageInventory : base.canManageInventory,
    canManageTechnicians: typeof input.canManageTechnicians === 'boolean' ? input.canManageTechnicians : base.canManageTechnicians,
    canSyncSheets: typeof input.canSyncSheets === 'boolean' ? input.canSyncSheets : base.canSyncSheets,
    canManageUsers: typeof input.canManageUsers === 'boolean' ? input.canManageUsers : base.canManageUsers,
    canEditCompany: typeof input.canEditCompany === 'boolean' ? input.canEditCompany : base.canEditCompany,
  };
}
