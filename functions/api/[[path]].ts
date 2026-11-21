import {
  DEFAULT_PERMISSIONS_BY_ROLE,
  type ACType,
  type ACUnit,
  type ACUnitStatus,
  type BatchLogItemInput,
  type CleaningLog,
  type CleaningStatus,
  type CompanySettings,
  type UserAccount,
  type UserPermissions,
  type UserRole,
} from '../../src/types';
import type { D1Database, PagesFunction } from '../types';

interface DbUserRow {
  id: string;
  username: string;
  full_name: string;
  phone: string;
  department: string;
  role: UserRole;
  can_login: number;
  active: number;
  permissions_json: string;
  password_hash: string;
  created_at: string;
}

interface DbCompanyRow {
  id: string;
  name: string;
  address: string;
  tax_id: string;
  phone: string;
  site_name: string;
  logo_data_url: string;
  default_sender_label: string;
  default_inspector_label: string;
  google_sheet_id: string;
  google_sheet_name: string;
  apps_script_url?: string;
  auto_sync_sheets: number;
  last_synced_at: string;
}

interface DbUnitRow {
  id: string;
  building: string;
  floor: string;
  room: string;
  unit_code: string;
  ac_type: ACType;
  btu: string;
  brand: string;
  model: string;
  install_type: string;
  status: ACUnitStatus;
  notes: string;
  sort_order: number;
  created_at: string;
}

interface DbLogRow {
  id: string;
  date: string;
  unit_id: string;
  building: string;
  floor: string;
  room: string;
  unit_code: string;
  ac_type: ACType;
  status: CleaningStatus;
  technician_id: string;
  technician_name: string;
  entered_by_user_id: string;
  entered_by_name: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

async function hashPassword(password: string): Promise<string> {
  const iterations = 100000;
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return `pbkdf2:${iterations}:${toHex(salt)}:${toHex(new Uint8Array(bits))}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  const salt = fromHex(parts[2]);
  const expected = fromHex(parts[3]);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual[i] ^ expected[i];
  }
  return diff === 0;
}

function normalizePermissions(
  role: UserRole,
  input?: Partial<UserPermissions>
): UserPermissions {
  const base = { ...DEFAULT_PERMISSIONS_BY_ROLE[role] };
  if (!input) return base;
  return {
    canViewDashboard:
      typeof input.canViewDashboard === 'boolean' ? input.canViewDashboard : base.canViewDashboard,
    canEnterDaily:
      typeof input.canEnterDaily === 'boolean' ? input.canEnterDaily : base.canEnterDaily,
    canViewReports:
      typeof input.canViewReports === 'boolean' ? input.canViewReports : base.canViewReports,
    canEditHistory:
      typeof input.canEditHistory === 'boolean' ? input.canEditHistory : base.canEditHistory,
    canDeleteHistory:
      typeof input.canDeleteHistory === 'boolean' ? input.canDeleteHistory : base.canDeleteHistory,
    canManageInventory:
      typeof input.canManageInventory === 'boolean'
        ? input.canManageInventory
        : base.canManageInventory,
    canManageTechnicians:
      typeof input.canManageTechnicians === 'boolean'
        ? input.canManageTechnicians
        : base.canManageTechnicians,
    canSyncSheets:
      typeof input.canSyncSheets === 'boolean' ? input.canSyncSheets : base.canSyncSheets,
    canManageUsers:
      typeof input.canManageUsers === 'boolean' ? input.canManageUsers : base.canManageUsers,
    canEditCompany:
      typeof input.canEditCompany === 'boolean' ? input.canEditCompany : base.canEditCompany,
    canModifyCurrentMonthOnly:
      role === 'super_admin'
        ? false
        : typeof input.canModifyCurrentMonthOnly === 'boolean'
        ? input.canModifyCurrentMonthOnly
        : base.canModifyCurrentMonthOnly,
  };
}

function mapUser(row: DbUserRow): UserAccount {
  let parsedPerms: Partial<UserPermissions> = {};
  try {
    parsedPerms = JSON.parse(row.permissions_json) as Partial<UserPermissions>;
  } catch {
    parsedPerms = {};
  }
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    phone: row.phone || '',
    department: row.department || '',
    role: row.role,
    canLogin: row.can_login !== 0,
    active: row.active !== 0,
    permissions: normalizePermissions(row.role, parsedPerms),
    createdAt: row.created_at,
  };
}

function mapCompany(row: DbCompanyRow): CompanySettings {
  return {
    name: row.name,
    address: row.address,
    taxId: row.tax_id,
    phone: row.phone,
    siteName: row.site_name,
    logoDataUrl: row.logo_data_url || '',
    defaultSenderLabel: row.default_sender_label || '',
    defaultInspectorLabel: row.default_inspector_label || '',
    googleSheetId: row.google_sheet_id || '',
    googleSheetName: row.google_sheet_name || '',
    appsScriptUrl: row.apps_script_url || '',
    autoSyncSheets: row.auto_sync_sheets === 1,
    lastSyncedAt: row.last_synced_at || '',
  };
}

function mapUnit(row: DbUnitRow): ACUnit {
  return {
    id: row.id,
    building: row.building,
    floor: row.floor,
    room: row.room,
    unitCode: row.unit_code,
    acType: row.ac_type === 'vrf' ? 'vrf' : 'normal',
    btu: row.btu || '',
    brand: row.brand || '',
    model: row.model || '',
    installType: row.install_type || '',
    status: row.status === 'cancelled' ? 'cancelled' : 'active',
    notes: row.notes || '',
    sortOrder: Number(row.sort_order) || 0,
    createdAt: row.created_at,
  };
}

function mapLog(row: DbLogRow): CleaningLog {
  return {
    id: row.id,
    date: row.date,
    unitId: row.unit_id,
    building: row.building,
    floor: row.floor,
    room: row.room,
    unitCode: row.unit_code,
    acType: row.ac_type === 'vrf' ? 'vrf' : 'normal',
    status: row.status,
    technicianId: row.technician_id,
    technicianName: row.technician_name,
    enteredByUserId: row.entered_by_user_id,
    enteredByName: row.entered_by_name,
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sortUnitsByBuildingAndOrder(units: ACUnit[]): ACUnit[] {
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

async function getAllSortedUnits(db: D1Database): Promise<ACUnit[]> {
  const res = await db.prepare('SELECT * FROM ac_units').all<DbUnitRow>();
  return sortUnitsByBuildingAndOrder(res.results.map(mapUnit));
}

async function getCompany(db: D1Database): Promise<CompanySettings> {
  const row = await db
    .prepare('SELECT * FROM company_settings WHERE id = ?')
    .bind('default')
    .first<DbCompanyRow>();
  if (row) return mapCompany(row);
  return {
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
  };
}

let companySchemaEnsured = false;

async function ensureBootstrapIfEmpty(db: D1Database): Promise<void> {
  if (!companySchemaEnsured) {
    try {
      const cols = await db.prepare('PRAGMA table_info(company_settings)').all<{ name: string }>();
      if (cols.results.length > 0 && !cols.results.some((c) => c.name === 'apps_script_url')) {
        await db
          .prepare("ALTER TABLE company_settings ADD COLUMN apps_script_url TEXT NOT NULL DEFAULT ''")
          .run();
      }
      companySchemaEnsured = true;
    } catch {
      // ignore and retry next request if transient
    }
  }
  const existingUser = await db.prepare('SELECT id FROM users LIMIT 1').first<{ id: string }>();
  if (!existingUser) {
    const nowIso = new Date().toISOString();
    const adminHash = await hashPassword('admin1234');
    const headHash = await hashPassword('head1234');
    await db.batch([
      db
        .prepare(
          'INSERT OR IGNORE INTO company_settings (id, name, address, tax_id, phone, site_name, logo_data_url, default_sender_label, default_inspector_label, google_sheet_id, google_sheet_name, auto_sync_sheets, last_synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          'default',
          'บริษัท รุ่งเรืองกิจการช่าง จำกัด',
          '72/10 หมู่ที่ 6 ตำบลบึงคำพร้อย อำเภอลำลูกกา จังหวัดปทุมธานี 12150',
          '0135548000364',
          '081-839-5607',
          'โครงการบำรุงรักษาเครื่องปรับอากาศ โรงพยาบาลรามคำแหง (พ.ศ. 2569)',
          '',
          'ผู้ส่งงาน (ช่างผู้ปฏิบัติงาน / ตัวแทนบริษัท)',
          'ผู้ตรวจรับงาน (เจ้าหน้าที่ผู้ว่าจ้าง)',
          '',
          'รายงานล้างเครื่องปรับอากาศ - บจก. รุ่งเรืองกิจการช่าง',
          0,
          ''
        ),
      db
        .prepare(
          'INSERT OR IGNORE INTO users (id, username, full_name, phone, department, role, can_login, active, permissions_json, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          'usr-admin',
          'admin',
          'ผู้ดูแลระบบสูงสุด (Admin)',
          '081-839-5607',
          'ผู้บริหารระบบ',
          'super_admin',
          1,
          1,
          JSON.stringify(DEFAULT_PERMISSIONS_BY_ROLE.super_admin),
          adminHash,
          nowIso
        ),
      db
        .prepare(
          'INSERT OR IGNORE INTO users (id, username, full_name, phone, department, role, can_login, active, permissions_json, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          'usr-head',
          'headtech',
          'หัวหน้าช่างเทคนิค',
          '081-839-5607',
          'แผนกช่างซ่อมบำรุง (หัวหน้าช่างเทคนิค)',
          'head_tech',
          1,
          1,
          JSON.stringify(DEFAULT_PERMISSIONS_BY_ROLE.head_tech),
          headHash,
          nowIso
        ),
    ]);
  }
}

function hasPerm(user: UserAccount, perm: keyof UserPermissions): boolean {
  if (user.role === 'super_admin') return true;
  return Boolean(user.permissions[perm]);
}

async function requireAuth(
  request: Request,
  db: D1Database
): Promise<{ user: UserAccount; token: string } | Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, 401);
  }
  const token = authHeader.slice(7).trim();
  const session = await db
    .prepare('SELECT token, user_id, expires_at FROM sessions WHERE token = ?')
    .bind(token)
    .first<{ token: string; user_id: string; expires_at: string }>();
  if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
    return jsonResponse({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' }, 401);
  }
  const userRow = await db
    .prepare('SELECT * FROM users WHERE id = ? AND active = 1')
    .bind(session.user_id)
    .first<DbUserRow>();
  if (!userRow) {
    return jsonResponse({ error: 'ไม่พบบัญชีผู้ใช้งานหรือบัญชีถูกระงับ' }, 401);
  }
  return { user: mapUser(userRow), token };
}

async function parseJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export const onRequest: PagesFunction = async (context) => {
  try {
    const { request, env } = context;
    const db = env.DB;
    if (!db) {
      return jsonResponse({ error: 'ไม่พบการเชื่อมต่อฐานข้อมูล Cloudflare D1 (binding: DB)' }, 500);
    }

    await ensureBootstrapIfEmpty(db);

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, '') || '/';
    const method = request.method.toUpperCase();

    // Health check for Cloudflare Pages + D1 verification
    if (path === '/health' && method === 'GET') {
      const unitCountRow = await db
        .prepare('SELECT COUNT(*) as count FROM ac_units')
        .first<{ count: number }>();
      const logCountRow = await db
        .prepare('SELECT COUNT(*) as count FROM cleaning_logs')
        .first<{ count: number }>();
      return jsonResponse({
        ok: true,
        database: 'cloudflare-d1',
        units: Number(unitCountRow?.count ?? 0),
        logs: Number(logCountRow?.count ?? 0),
      });
    }

    // Public company info
    if (path === '/public/company' && method === 'GET') {
      const company = await getCompany(db);
      return jsonResponse({
        name: company.name,
        address: company.address,
        taxId: company.taxId,
        phone: company.phone,
        siteName: company.siteName,
        logoDataUrl: company.logoDataUrl,
      });
    }

  // Auth: Login
  if (path === '/auth/login' && method === 'POST') {
    const body = await parseJson<{ username?: string; password?: string }>(request);
    if (!body.username || !body.password) {
      return jsonResponse({ error: 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน' }, 400);
    }

    const userRow = await db
      .prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)')
      .bind(body.username.trim())
      .first<DbUserRow>();

    if (!userRow || !(await verifyPassword(body.password, userRow.password_hash))) {
      return jsonResponse({ error: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' }, 401);
    }
    if (userRow.active === 0) {
      return jsonResponse({ error: 'บัญชีนี้ถูกปิดการใช้งาน กรุณาติดต่อ Admin สูงสุด' }, 403);
    }
    if (userRow.can_login === 0) {
      return jsonResponse(
        { error: 'บัญชีช่างรายนี้ยังไม่เปิดสิทธิ์เข้าสู่ระบบ กรุณาติดต่อ Admin หรือหัวหน้าช่าง' },
        403
      );
    }

    const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await db
      .prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .bind(token, userRow.id, now.toISOString(), expires.toISOString())
      .run();

    const company = await getCompany(db);
    return jsonResponse({ token, user: mapUser(userRow), company });
  }

  // Authenticated routes
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;
  const { user: current, token } = auth;

  if (path === '/auth/logout' && method === 'POST') {
    await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return jsonResponse({ ok: true });
  }

  if (path === '/auth/me' && method === 'GET') {
    const company = await getCompany(db);
    return jsonResponse({ user: current, company });
  }

  // Technicians
  if (path === '/technicians' && method === 'GET') {
    const includeInactive =
      url.searchParams.get('includeInactive') === '1' ||
      url.searchParams.get('includeInactive') === 'true';
    const res = await db
      .prepare(includeInactive ? 'SELECT * FROM users' : 'SELECT * FROM users WHERE active = 1')
      .all<DbUserRow>();
    const technicians = res.results.map((r) => {
      const u = mapUser(r);
      return {
        id: u.id,
        fullName: u.fullName,
        phone: u.phone,
        username: u.username,
        role: u.role,
        department: u.department,
        canLogin: u.canLogin,
        active: u.active,
      };
    });
    return jsonResponse({ technicians });
  }

  if (path === '/technicians' && method === 'POST') {
    if (!hasPerm(current, 'canManageTechnicians')) {
      return jsonResponse({ error: 'คุณไม่มีสิทธิ์เพิ่มรายชื่อช่างเทคนิค' }, 403);
    }
    const body = await parseJson<{
      fullName?: string;
      phone?: string;
      username?: string;
      password?: string;
      canLogin?: boolean;
      active?: boolean;
    }>(request);

    if (!body.fullName?.trim()) {
      return jsonResponse({ error: 'กรุณากรอกชื่อ-สกุลช่างเทคนิค' }, 400);
    }
    if (!body.phone?.trim()) {
      return jsonResponse({ error: 'กรุณากรอกเบอร์โทรศัพท์ช่างเทคนิค' }, 400);
    }

    const wantsLogin = Boolean(body.canLogin && body.username?.trim());
    let finalUsername = '';
    let finalPassword = '';

    if (wantsLogin) {
      finalUsername = body.username!.trim();
      if (!body.password || body.password.length < 4) {
        return jsonResponse(
          { error: 'กรุณากำหนดรหัสผ่านอย่างน้อย 4 ตัวอักษรสำหรับการเข้าสู่ระบบ' },
          400
        );
      }
      const dup = await db
        .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)')
        .bind(finalUsername)
        .first();
      if (dup) {
        return jsonResponse({ error: 'ชื่อผู้ใช้งาน (Username) นี้มีอยู่ในระบบแล้ว' }, 409);
      }
      finalPassword = body.password;
    } else {
      finalUsername = `tech-${crypto.randomUUID().slice(0, 8)}`;
      finalPassword = toHex(crypto.getRandomValues(new Uint8Array(16)));
    }

    const newId = `usr-${crypto.randomUUID().slice(0, 8)}`;
    const nowIso = new Date().toISOString();
    const passHash = await hashPassword(finalPassword);
    const activeVal = body.active ?? true ? 1 : 0;

    await db
      .prepare(
        'INSERT INTO users (id, username, full_name, phone, department, role, can_login, active, permissions_json, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        newId,
        finalUsername,
        body.fullName.trim(),
        body.phone.trim(),
        'แผนกช่างซ่อมบำรุง (ช่างเทคนิค)',
        'technician',
        wantsLogin ? 1 : 0,
        activeVal,
        JSON.stringify(DEFAULT_PERMISSIONS_BY_ROLE.technician),
        passHash,
        nowIso
      )
      .run();

    return jsonResponse(
      {
        technician: {
          id: newId,
          fullName: body.fullName.trim(),
          phone: body.phone.trim(),
          username: finalUsername,
          role: 'technician' as UserRole,
          department: 'แผนกช่างซ่อมบำรุง (ช่างเทคนิค)',
          canLogin: wantsLogin,
          active: activeVal === 1,
        },
      },
      201
    );
  }

  const techMatch = path.match(/^\/technicians\/([^/]+)$/);
  if (techMatch && method === 'PATCH') {
    if (!hasPerm(current, 'canManageTechnicians')) {
      return jsonResponse({ error: 'คุณไม่มีสิทธิ์แก้ไขรายชื่อช่างเทคนิค' }, 403);
    }
    const id = decodeURIComponent(techMatch[1]);
    const target = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<DbUserRow>();
    if (!target) {
      return jsonResponse({ error: 'ไม่พบรายชื่อช่างเทคนิค' }, 404);
    }

    const body = await parseJson<{
      fullName?: string;
      phone?: string;
      username?: string;
      password?: string;
      canLogin?: boolean;
      active?: boolean;
    }>(request);

    let nextFullName = target.full_name;
    let nextPhone = target.phone;
    let nextUsername = target.username;
    let nextPasswordHash = target.password_hash;
    let nextCanLogin = target.can_login;
    let nextActive = target.active;

    if (typeof body.fullName === 'string') {
      if (!body.fullName.trim()) {
        return jsonResponse({ error: 'ชื่อ-สกุลต้องไม่เป็นค่าว่าง' }, 400);
      }
      nextFullName = body.fullName.trim();
    }
    if (typeof body.phone === 'string') nextPhone = body.phone.trim();
    if (typeof body.username === 'string' && body.username.trim()) {
      const candidate = body.username.trim();
      const dup = await db
        .prepare('SELECT id FROM users WHERE id != ? AND LOWER(username) = LOWER(?)')
        .bind(id, candidate)
        .first();
      if (dup) {
        return jsonResponse({ error: 'ชื่อผู้ใช้งาน (Username) นี้มีอยู่ในระบบแล้ว' }, 409);
      }
      nextUsername = candidate;
    }
    if (typeof body.password === 'string' && body.password.length > 0) {
      nextPasswordHash = await hashPassword(body.password);
    }
    if (typeof body.canLogin === 'boolean') {
      if (id === current.id && !body.canLogin) {
        return jsonResponse({ error: 'ไม่สามารถปิดสิทธิ์เข้าสู่ระบบของบัญชีที่กำลังใช้งานอยู่ได้' }, 400);
      }
      nextCanLogin = body.canLogin ? 1 : 0;
    }
    if (typeof body.active === 'boolean') {
      if (id === current.id && !body.active) {
        return jsonResponse({ error: 'ไม่สามารถระงับบัญชีของตนเองที่กำลังใช้งานอยู่ได้' }, 400);
      }
      nextActive = body.active ? 1 : 0;
    }

    await db
      .prepare(
        'UPDATE users SET full_name = ?, phone = ?, username = ?, password_hash = ?, can_login = ?, active = ? WHERE id = ?'
      )
      .bind(nextFullName, nextPhone, nextUsername, nextPasswordHash, nextCanLogin, nextActive, id)
      .run();

    return jsonResponse({
      technician: {
        id,
        fullName: nextFullName,
        phone: nextPhone,
        username: nextUsername,
        role: target.role,
        department: target.department,
        canLogin: nextCanLogin === 1,
        active: nextActive === 1,
      },
    });
  }

  if (techMatch && method === 'DELETE') {
    if (!hasPerm(current, 'canManageTechnicians')) {
      return jsonResponse({ error: 'คุณไม่มีสิทธิ์ลบรายชื่อช่างเทคนิค' }, 403);
    }
    const id = decodeURIComponent(techMatch[1]);
    if (id === current.id) {
      return jsonResponse({ error: 'ไม่สามารถลบบัญชีของตนเองได้' }, 400);
    }
    const target = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<DbUserRow>();
    if (!target) {
      return jsonResponse({ error: 'ไม่พบรายชื่อช่างเทคนิค' }, 404);
    }
    if (target.role === 'super_admin') {
      return jsonResponse({ error: 'ไม่สามารถลบบัญชี Admin สูงสุดออกจากหน้านี้ได้' }, 403);
    }
    await db.batch([
      db.prepare('DELETE FROM users WHERE id = ?').bind(id),
      db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
    ]);
    return jsonResponse({ ok: true });
  }

  // Company Update
  if (path === '/company' && method === 'PATCH') {
    if (!hasPerm(current, 'canEditCompany') && !hasPerm(current, 'canSyncSheets')) {
      return jsonResponse({ error: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลบริษัทหรือการตั้งค่า' }, 403);
    }
    const body = await parseJson<Partial<CompanySettings>>(request);
    const companyFieldsTouched =
      body.name !== undefined ||
      body.address !== undefined ||
      body.taxId !== undefined ||
      body.phone !== undefined ||
      body.siteName !== undefined ||
      body.logoDataUrl !== undefined ||
      body.defaultSenderLabel !== undefined ||
      body.defaultInspectorLabel !== undefined;

    if (companyFieldsTouched && !hasPerm(current, 'canEditCompany')) {
      return jsonResponse({ error: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลบริษัทและโลโก้' }, 403);
    }
    if (typeof body.logoDataUrl === 'string' && body.logoDataUrl.length > 0) {
      if (!body.logoDataUrl.startsWith('data:image/')) {
        return jsonResponse({ error: 'ไฟล์โลโก้ต้องเป็นรูปภาพที่ถูกต้อง (PNG/JPG/SVG/WebP)' }, 400);
      }
      if (body.logoDataUrl.length > 4 * 1024 * 1024) {
        return jsonResponse({ error: 'ขนาดไฟล์โลโก้ใหญ่เกินไป (สูงสุด 3MB)' }, 400);
      }
    }

    const prev = await getCompany(db);
    const next: CompanySettings = {
      ...prev,
      ...(typeof body.name === 'string' ? { name: body.name.trim() } : {}),
      ...(typeof body.address === 'string' ? { address: body.address.trim() } : {}),
      ...(typeof body.taxId === 'string' ? { taxId: body.taxId.trim() } : {}),
      ...(typeof body.phone === 'string' ? { phone: body.phone.trim() } : {}),
      ...(typeof body.siteName === 'string' ? { siteName: body.siteName.trim() } : {}),
      ...(typeof body.logoDataUrl === 'string' ? { logoDataUrl: body.logoDataUrl } : {}),
      ...(typeof body.defaultSenderLabel === 'string'
        ? { defaultSenderLabel: body.defaultSenderLabel.trim() }
        : {}),
      ...(typeof body.defaultInspectorLabel === 'string'
        ? { defaultInspectorLabel: body.defaultInspectorLabel.trim() }
        : {}),
      ...(typeof body.googleSheetId === 'string' ? { googleSheetId: body.googleSheetId.trim() } : {}),
      ...(typeof body.googleSheetName === 'string'
        ? { googleSheetName: body.googleSheetName.trim() }
        : {}),
      ...(typeof body.appsScriptUrl === 'string'
        ? { appsScriptUrl: body.appsScriptUrl.trim() }
        : {}),
      ...(typeof body.autoSyncSheets === 'boolean' ? { autoSyncSheets: body.autoSyncSheets } : {}),
      ...(typeof body.lastSyncedAt === 'string' ? { lastSyncedAt: body.lastSyncedAt } : {}),
    };

    await db
      .prepare(
        'UPDATE company_settings SET name = ?, address = ?, tax_id = ?, phone = ?, site_name = ?, logo_data_url = ?, default_sender_label = ?, default_inspector_label = ?, google_sheet_id = ?, google_sheet_name = ?, apps_script_url = ?, auto_sync_sheets = ?, last_synced_at = ? WHERE id = ?'
      )
      .bind(
        next.name,
        next.address,
        next.taxId,
        next.phone,
        next.siteName,
        next.logoDataUrl,
        next.defaultSenderLabel,
        next.defaultInspectorLabel,
        next.googleSheetId,
        next.googleSheetName,
        next.appsScriptUrl || '',
        next.autoSyncSheets ? 1 : 0,
        next.lastSyncedAt,
        'default'
      )
      .run();

    return jsonResponse({ company: next });
  }

  // Users CRUD
  if (path === '/users' && method === 'GET') {
    if (!hasPerm(current, 'canManageUsers')) {
      return jsonResponse({ error: 'เฉพาะ Admin สูงสุดเท่านั้นที่จัดการผู้ใช้งานได้' }, 403);
    }
    const res = await db.prepare('SELECT * FROM users').all<DbUserRow>();
    return jsonResponse({ users: res.results.map(mapUser) });
  }

  if (path === '/users' && method === 'POST') {
    if (!hasPerm(current, 'canManageUsers')) {
      return jsonResponse({ error: 'คุณไม่มีสิทธิ์เพิ่มผู้ใช้งาน' }, 403);
    }
    const body = await parseJson<{
      username?: string;
      password?: string;
      fullName?: string;
      phone?: string;
      department?: string;
      role?: UserRole;
      permissions?: Partial<UserPermissions>;
      active?: boolean;
      canLogin?: boolean;
    }>(request);

    if (!body.username?.trim() || !body.password || !body.fullName?.trim() || !body.role) {
      return jsonResponse(
        { error: 'กรุณากรอกข้อมูลผู้ใช้ ชื่อ-นามสกุล รหัสผ่าน และสิทธิ์ให้ครบถ้วน' },
        400
      );
    }

    const dup = await db
      .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)')
      .bind(body.username.trim())
      .first();
    if (dup) {
      return jsonResponse({ error: 'ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว' }, 409);
    }

    const deptDefault =
      body.role === 'super_admin'
        ? 'ผู้บริหารระบบ'
        : body.role === 'head_tech'
          ? 'แผนกช่างซ่อมบำรุง (หัวหน้าช่างเทคนิค)'
          : 'แผนกช่างซ่อมบำรุง (ช่างเทคนิค)';
    const id = `usr-${crypto.randomUUID().slice(0, 8)}`;
    const nowIso = new Date().toISOString();
    const perms = normalizePermissions(body.role, body.permissions);
    const passHash = await hashPassword(body.password);
    const canLoginVal = typeof body.canLogin === 'boolean' ? (body.canLogin ? 1 : 0) : 1;
    const activeVal = body.active ?? true ? 1 : 0;

    await db
      .prepare(
        'INSERT INTO users (id, username, full_name, phone, department, role, can_login, active, permissions_json, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        id,
        body.username.trim(),
        body.fullName.trim(),
        body.phone?.trim() || '',
        body.department?.trim() || deptDefault,
        body.role,
        canLoginVal,
        activeVal,
        JSON.stringify(perms),
        passHash,
        nowIso
      )
      .run();

    return jsonResponse(
      {
        user: {
          id,
          username: body.username.trim(),
          fullName: body.fullName.trim(),
          phone: body.phone?.trim() || '',
          department: body.department?.trim() || deptDefault,
          role: body.role,
          canLogin: canLoginVal === 1,
          active: activeVal === 1,
          permissions: perms,
          createdAt: nowIso,
        },
      },
      201
    );
  }

  const userMatch = path.match(/^\/users\/([^/]+)$/);
  if (userMatch && method === 'PATCH') {
    if (!hasPerm(current, 'canManageUsers')) {
      return jsonResponse({ error: 'คุณไม่มีสิทธิ์แก้ไขผู้ใช้งาน' }, 403);
    }
    const id = decodeURIComponent(userMatch[1]);
    const targetRow = await db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(id)
      .first<DbUserRow>();
    if (!targetRow) {
      return jsonResponse({ error: 'ไม่พบผู้ใช้งาน' }, 404);
    }

    const targetUser = mapUser(targetRow);
    const body = await parseJson<{
      fullName?: string;
      phone?: string;
      department?: string;
      role?: UserRole;
      permissions?: Partial<UserPermissions>;
      active?: boolean;
      canLogin?: boolean;
      password?: string;
    }>(request);

    const nextFullName =
      typeof body.fullName === 'string' && body.fullName.trim()
        ? body.fullName.trim()
        : targetUser.fullName;
    const nextPhone = typeof body.phone === 'string' ? body.phone.trim() : targetUser.phone;
    const nextDepartment =
      typeof body.department === 'string' ? body.department.trim() : targetUser.department;
    const nextRole = body.role || targetUser.role;
    const nextPerms = body.role
      ? normalizePermissions(body.role, body.permissions ?? targetUser.permissions)
      : body.permissions
        ? normalizePermissions(targetUser.role, { ...targetUser.permissions, ...body.permissions })
        : targetUser.permissions;
    const nextCanLogin =
      typeof body.canLogin === 'boolean' ? body.canLogin : targetUser.canLogin;
    let nextActive = targetUser.active;
    if (typeof body.active === 'boolean') {
      if (id === current.id && !body.active) {
        return jsonResponse({ error: 'ไม่สามารถระงับบัญชีของตนเองที่กำลังใช้งานอยู่ได้' }, 400);
      }
      nextActive = body.active;
    }
    const nextPasswordHash =
      typeof body.password === 'string' && body.password.length > 0
        ? await hashPassword(body.password)
        : targetRow.password_hash;

    await db
      .prepare(
        'UPDATE users SET full_name = ?, phone = ?, department = ?, role = ?, can_login = ?, active = ?, permissions_json = ?, password_hash = ? WHERE id = ?'
      )
      .bind(
        nextFullName,
        nextPhone,
        nextDepartment,
        nextRole,
        nextCanLogin ? 1 : 0,
        nextActive ? 1 : 0,
        JSON.stringify(nextPerms),
        nextPasswordHash,
        id
      )
      .run();

    return jsonResponse({
      user: {
        ...targetUser,
        fullName: nextFullName,
        phone: nextPhone,
        department: nextDepartment,
        role: nextRole,
        canLogin: nextCanLogin,
        active: nextActive,
        permissions: nextPerms,
      },
    });
  }

  if (userMatch && method === 'DELETE') {
    if (!hasPerm(current, 'canManageUsers')) {
      return jsonResponse({ error: 'คุณไม่มีสิทธิ์ลบผู้ใช้งาน' }, 403);
    }
    const id = decodeURIComponent(userMatch[1]);
    if (id === current.id) {
      return jsonResponse({ error: 'ไม่สามารถลบบัญชีของตนเองได้' }, 400);
    }
    const target = await db.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
    if (!target) {
      return jsonResponse({ error: 'ไม่พบผู้ใช้งาน' }, 404);
    }
    await db.batch([
      db.prepare('DELETE FROM users WHERE id = ?').bind(id),
      db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
    ]);
    return jsonResponse({ ok: true });
  }

  // AC Units
  if (path === '/units' && method === 'GET') {
    const units = await getAllSortedUnits(db);
    return jsonResponse({ units });
  }

  if (path === '/units' && method === 'POST') {
    if (!hasPerm(current, 'canManageInventory') && !hasPerm(current, 'canEnterDaily')) {
      return jsonResponse({ error: 'คุณไม่มีสิทธิ์เพิ่มเครื่องปรับอากาศ' }, 403);
    }
    const body = await parseJson<Partial<ACUnit>>(request);
    const building = String(body.building || '').trim();
    const floor = String(body.floor || '').trim();
    const room = String(body.room || '').trim();
    const unitCode = String(body.unitCode || '').trim();
    if (!building || !floor || !room || !unitCode) {
      return jsonResponse(
        { error: 'กรุณาระบุ อาคาร ชั้น ห้อง และหมายเลขเครื่อง ให้ครบถ้วน' },
        400
      );
    }

    const dup = await db
      .prepare('SELECT id FROM ac_units WHERE building = ? AND LOWER(unit_code) = LOWER(?)')
      .bind(building, unitCode)
      .first();
    if (dup) {
      return jsonResponse({ error: `หมายเลขเครื่อง ${unitCode} มีอยู่ใน ${building} แล้ว` }, 409);
    }

    const maxRow = await db
      .prepare('SELECT MAX(sort_order) as max_order FROM ac_units WHERE building = ?')
      .bind(building)
      .first<{ max_order: number | null }>();
    const sortOrder = (maxRow?.max_order || 0) + 10;
    const nowIso = new Date().toISOString();
    const newUnit: ACUnit = {
      id: `unit-${crypto.randomUUID().slice(0, 8)}`,
      building,
      floor,
      room,
      unitCode,
      acType: body.acType === 'vrf' ? 'vrf' : 'normal',
      btu: String(body.btu || '').trim(),
      brand: String(body.brand || '').trim(),
      model: String(body.model || '').trim(),
      installType: String(body.installType || '').trim(),
      status: body.status === 'cancelled' ? 'cancelled' : 'active',
      notes: String(body.notes || '').trim(),
      sortOrder,
      createdAt: nowIso,
    };

    await db
      .prepare(
        'INSERT INTO ac_units (id, building, floor, room, unit_code, ac_type, btu, brand, model, install_type, status, notes, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        newUnit.id,
        newUnit.building,
        newUnit.floor,
        newUnit.room,
        newUnit.unitCode,
        newUnit.acType,
        newUnit.btu,
        newUnit.brand,
        newUnit.model,
        newUnit.installType,
        newUnit.status,
        newUnit.notes,
        newUnit.sortOrder,
        newUnit.createdAt
      )
      .run();

    const units = await getAllSortedUnits(db);
    return jsonResponse({ unit: newUnit, units }, 201);
  }

  if (path === '/units/import' && method === 'POST') {
    if (!hasPerm(current, 'canManageInventory')) {
      return jsonResponse({ error: 'คุณไม่มีสิทธิ์นำเข้าทะเบียนเครื่องปรับอากาศ' }, 403);
    }
    const body = await parseJson<{
      rows?: Array<Record<string, string>>;
      replaceAll?: boolean;
    }>(request);

    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return jsonResponse({ error: 'ไม่พบข้อมูลสำหรับนำเข้า' }, 400);
    }

    if (body.replaceAll) {
      await db.prepare('DELETE FROM ac_units').run();
    }

    const existingUnits = await getAllSortedUnits(db);
    const byKey = new Map<string, ACUnit>();
    const maxOrderByBld = new Map<string, number>();
    for (const u of existingUnits) {
      byKey.set(`${u.building}::${u.unitCode.toLowerCase()}`, u);
      maxOrderByBld.set(u.building, Math.max(maxOrderByBld.get(u.building) || 0, u.sortOrder));
    }

    let addedCount = 0;
    let updatedCount = 0;
    const statements = [];
    const nowIso = new Date().toISOString();

    for (const row of body.rows) {
      const building = String(row.building || '').trim();
      const floor = String(row.floor || '1').trim();
      const room = String(row.room || '').trim();
      const unitCode = String(row.unitCode || '').trim();
      if (!building || !room || !unitCode) continue;

      const rawType = String(row.acType || '').toLowerCase();
      const acType: ACType =
        rawType.includes('vrf') || rawType.includes('vrv') ? 'vrf' : 'normal';
      const rawStatus = String(row.status || '').toLowerCase();
      const status: ACUnitStatus =
        rawStatus.includes('ยกเลิก') || rawStatus.includes('cancel') ? 'cancelled' : 'active';

      const key = `${building}::${unitCode.toLowerCase()}`;
      const existing = byKey.get(key);
      if (existing) {
        statements.push(
          db
            .prepare(
              'UPDATE ac_units SET floor = ?, room = ?, ac_type = ?, btu = ?, brand = ?, model = ?, install_type = ?, status = ?, notes = ? WHERE id = ?'
            )
            .bind(
              floor,
              room,
              acType,
              String(row.btu || existing.btu || '').trim(),
              String(row.brand || existing.brand || '').trim(),
              String(row.model || existing.model || '').trim(),
              String(row.installType || existing.installType || '').trim(),
              status,
              String(row.notes || existing.notes || '').trim(),
              existing.id
            )
        );
        updatedCount++;
      } else {
        const nextOrder = (maxOrderByBld.get(building) || 0) + 10;
        maxOrderByBld.set(building, nextOrder);
        const newId = `unit-${crypto.randomUUID().slice(0, 8)}`;
        const createdUnit: ACUnit = {
          id: newId,
          building,
          floor,
          room,
          unitCode,
          acType,
          btu: String(row.btu || '').trim(),
          brand: String(row.brand || '').trim(),
          model: String(row.model || '').trim(),
          installType: String(row.installType || '').trim(),
          status,
          notes: String(row.notes || '').trim(),
          sortOrder: nextOrder,
          createdAt: nowIso,
        };
        byKey.set(key, createdUnit);
        statements.push(
          db
            .prepare(
              'INSERT INTO ac_units (id, building, floor, room, unit_code, ac_type, btu, brand, model, install_type, status, notes, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )
            .bind(
              createdUnit.id,
              createdUnit.building,
              createdUnit.floor,
              createdUnit.room,
              createdUnit.unitCode,
              createdUnit.acType,
              createdUnit.btu,
              createdUnit.brand,
              createdUnit.model,
              createdUnit.installType,
              createdUnit.status,
              createdUnit.notes,
              createdUnit.sortOrder,
              createdUnit.createdAt
            )
        );
        addedCount++;
      }
    }

    for (let i = 0; i < statements.length; i += 50) {
      await db.batch(statements.slice(i, i + 50));
    }

    const units = await getAllSortedUnits(db);
    return jsonResponse({ addedCount, updatedCount, units });
  }

  const unitMatch = path.match(/^\/units\/([^/]+)$/);
  if (unitMatch && method === 'PATCH') {
    if (!hasPerm(current, 'canManageInventory')) {
      return jsonResponse({ error: 'คุณไม่มีสิทธิ์แก้ไขทะเบียนเครื่องปรับอากาศ' }, 403);
    }
    const id = decodeURIComponent(unitMatch[1]);
    const row = await db.prepare('SELECT * FROM ac_units WHERE id = ?').bind(id).first<DbUnitRow>();
    if (!row) {
      return jsonResponse({ error: 'ไม่พบข้อมูลเครื่องปรับอากาศ' }, 404);
    }
    const existing = mapUnit(row);
    const body = await parseJson<Partial<ACUnit>>(request);

    const nextBuilding = typeof body.building === 'string' ? body.building.trim() : existing.building;
    const nextFloor = typeof body.floor === 'string' ? body.floor.trim() : existing.floor;
    const nextRoom = typeof body.room === 'string' ? body.room.trim() : existing.room;
    const nextCode = typeof body.unitCode === 'string' ? body.unitCode.trim() : existing.unitCode;
    if (!nextBuilding || !nextFloor || !nextRoom || !nextCode) {
      return jsonResponse(
        { error: 'กรุณาระบุ อาคาร ชั้น ห้อง และหมายเลขเครื่อง ให้ครบถ้วน' },
        400
      );
    }

    const dupUnit = await db
      .prepare('SELECT id FROM ac_units WHERE id != ? AND building = ? AND LOWER(unit_code) = LOWER(?)')
      .bind(id, nextBuilding, nextCode)
      .first();
    if (dupUnit) {
      return jsonResponse({ error: `หมายเลขเครื่อง ${nextCode} มีอยู่ใน ${nextBuilding} แล้ว` }, 409);
    }

    const updated: ACUnit = {
      ...existing,
      building: nextBuilding,
      floor: nextFloor,
      room: nextRoom,
      unitCode: nextCode,
      acType: body.acType === 'normal' || body.acType === 'vrf' ? body.acType : existing.acType,
      btu: typeof body.btu === 'string' ? body.btu.trim() : existing.btu,
      brand: typeof body.brand === 'string' ? body.brand.trim() : existing.brand,
      model: typeof body.model === 'string' ? body.model.trim() : existing.model || '',
      installType:
        typeof body.installType === 'string'
          ? body.installType.trim()
          : existing.installType || '',
      status:
        body.status === 'cancelled' || body.status === 'active' ? body.status : existing.status,
      notes: typeof body.notes === 'string' ? body.notes.trim() : existing.notes,
    };

    await db
      .prepare(
        'UPDATE ac_units SET building = ?, floor = ?, room = ?, unit_code = ?, ac_type = ?, btu = ?, brand = ?, model = ?, install_type = ?, status = ?, notes = ? WHERE id = ?'
      )
      .bind(
        updated.building,
        updated.floor,
        updated.room,
        updated.unitCode,
        updated.acType,
        updated.btu,
        updated.brand,
        updated.model || '',
        updated.installType || '',
        updated.status,
        updated.notes,
        id
      )
      .run();

    const units = await getAllSortedUnits(db);
    return jsonResponse({ unit: updated, units });
  }

  if (unitMatch && method === 'DELETE') {
    if (!hasPerm(current, 'canManageInventory')) {
      return jsonResponse({ error: 'คุณไม่มีสิทธิ์ลบเครื่องปรับอากาศ' }, 403);
    }
    const id = decodeURIComponent(unitMatch[1]);
    const res = await db.prepare('DELETE FROM ac_units WHERE id = ?').bind(id).run();
    if (!res.meta?.changes) {
      return jsonResponse({ error: 'ไม่พบเครื่องปรับอากาศ' }, 404);
    }
    const units = await getAllSortedUnits(db);
    return jsonResponse({ ok: true, units });
  }

  // Cleaning Logs
  if (path === '/logs' && method === 'GET') {
    if (
      !hasPerm(current, 'canViewReports') &&
      !hasPerm(current, 'canViewDashboard') &&
      !hasPerm(current, 'canEnterDaily')
    ) {
      return jsonResponse({ error: 'คุณไม่มีสิทธิ์เรียกดูประวัติการล้าง' }, 403);
    }

    const res = await db.prepare('SELECT * FROM cleaning_logs').all<DbLogRow>();
    let logs = res.results.map(mapLog);

    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const building = url.searchParams.get('building');
    const status = url.searchParams.get('status');
    const technicianId = url.searchParams.get('technicianId');
    const search = url.searchParams.get('search');

    if (startDate) logs = logs.filter((l) => l.date >= startDate);
    if (endDate) logs = logs.filter((l) => l.date <= endDate);
    if (building && building !== 'all') logs = logs.filter((l) => l.building === building);
    if (status && status !== 'all') logs = logs.filter((l) => l.status === status);
    if (technicianId && technicianId !== 'all') {
      logs = logs.filter((l) => l.technicianId === technicianId);
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      logs = logs.filter(
        (l) =>
          l.building.toLowerCase().includes(q) ||
          l.room.toLowerCase().includes(q) ||
          l.unitCode.toLowerCase().includes(q) ||
          l.technicianName.toLowerCase().includes(q) ||
          l.notes.toLowerCase().includes(q)
      );
    }

    logs.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      const bCmp = a.building.localeCompare(b.building, 'th');
      if (bCmp !== 0) return bCmp;
      return a.unitCode.localeCompare(b.unitCode, 'th', { numeric: true });
    });

    return jsonResponse({ logs });
  }

  if (path === '/logs/batch' && method === 'POST') {
    if (!hasPerm(current, 'canEnterDaily')) {
      return jsonResponse({ error: 'คุณไม่มีสิทธิ์บันทึกงานล้างประจำวัน' }, 403);
    }
    const body = await parseJson<{
      date?: string;
      technicianId?: string;
      items?: BatchLogItemInput[];
    }>(request);

    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return jsonResponse({ error: 'กรุณาระบุวันที่เข้าล้างให้ถูกต้อง (YYYY-MM-DD)' }, 400);
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return jsonResponse({ error: 'กรุณาเพิ่มรายการเครื่องปรับอากาศอย่างน้อย 1 รายการ' }, 400);
    }

    let assignedTech = current;
    if (current.role !== 'technician' && body.technicianId) {
      const techRow = await db
        .prepare('SELECT * FROM users WHERE id = ? AND active = 1')
        .bind(body.technicianId)
        .first<DbUserRow>();
      if (techRow) assignedTech = mapUser(techRow);
    }

    const existingUnits = await getAllSortedUnits(db);
    const unitsById = new Map(existingUnits.map((u) => [u.id, u]));
    const unitsByKey = new Map(
      existingUnits.map((u) => [`${u.building.trim()}::${u.unitCode.trim().toLowerCase()}`, u])
    );
    const maxOrderByBld = new Map<string, number>();
    for (const u of existingUnits) {
      maxOrderByBld.set(u.building, Math.max(maxOrderByBld.get(u.building) || 0, u.sortOrder));
    }

    const nowIso = new Date().toISOString();
    const createdLogs: CleaningLog[] = [];
    const createdUnits: ACUnit[] = [];
    const statements = [];

    for (const item of body.items) {
      const building = String(item.building || '').trim();
      const floor = String(item.floor || '').trim();
      const room = String(item.room || '').trim();
      const unitCode = String(item.unitCode || '').trim();
      if (!building || !floor || !room || !unitCode) {
        return jsonResponse(
          { error: 'ข้อมูล อาคาร ชั้น ห้อง และหมายเลขเครื่อง ต้องกรอกให้ครบถ้วนทุกรายการ' },
          400
        );
      }

      let unit: ACUnit | undefined;
      if (item.mode === 'existing' && item.unitId) {
        unit = unitsById.get(item.unitId);
      }
      if (!unit) {
        unit = unitsByKey.get(`${building}::${unitCode.toLowerCase()}`);
      }

      if (!unit) {
        const nextOrder = (maxOrderByBld.get(building) || 0) + 10;
        maxOrderByBld.set(building, nextOrder);
        unit = {
          id: `unit-${crypto.randomUUID().slice(0, 8)}`,
          building,
          floor,
          room,
          unitCode,
          acType: item.acType === 'vrf' ? 'vrf' : 'normal',
          btu: String(item.btu || '').trim(),
          brand: String(item.brand || '').trim(),
          model: String(item.model || '').trim(),
          installType: String(item.installType || '').trim(),
          status: 'active',
          notes: '',
          sortOrder: nextOrder,
          createdAt: nowIso,
        };
        unitsById.set(unit.id, unit);
        unitsByKey.set(`${building}::${unitCode.toLowerCase()}`, unit);
        createdUnits.push(unit);

        statements.push(
          db
            .prepare(
              'INSERT INTO ac_units (id, building, floor, room, unit_code, ac_type, btu, brand, model, install_type, status, notes, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )
            .bind(
              unit.id,
              unit.building,
              unit.floor,
              unit.room,
              unit.unitCode,
              unit.acType,
              unit.btu,
              unit.brand,
              unit.model || '',
              unit.installType || '',
              unit.status,
              unit.notes,
              unit.sortOrder,
              unit.createdAt
            )
        );
      }

      if (unit.status === 'cancelled') continue;

      const validStatuses: CleaningStatus[] = [
        'cleaned',
        'patient_occupied',
        'renovation',
        'no_card',
      ];
      const status: CleaningStatus = validStatuses.includes(item.status)
        ? item.status
        : 'cleaned';

      const newLog: CleaningLog = {
        id: `log-${crypto.randomUUID().slice(0, 8)}`,
        date: body.date,
        unitId: unit.id,
        building: unit.building,
        floor: unit.floor,
        room: unit.room,
        unitCode: unit.unitCode,
        acType: unit.acType,
        status,
        technicianId: assignedTech.id,
        technicianName: assignedTech.fullName,
        enteredByUserId: current.id,
        enteredByName: current.fullName,
        notes: String(item.notes || '').trim(),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      createdLogs.push(newLog);

      statements.push(
        db
          .prepare(
            'INSERT INTO cleaning_logs (id, date, unit_id, building, floor, room, unit_code, ac_type, status, technician_id, technician_name, entered_by_user_id, entered_by_name, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          )
          .bind(
            newLog.id,
            newLog.date,
            newLog.unitId,
            newLog.building,
            newLog.floor,
            newLog.room,
            newLog.unitCode,
            newLog.acType,
            newLog.status,
            newLog.technicianId,
            newLog.technicianName,
            newLog.enteredByUserId,
            newLog.enteredByName,
            newLog.notes,
            newLog.createdAt,
            newLog.updatedAt
          )
      );
    }

    for (let i = 0; i < statements.length; i += 50) {
      await db.batch(statements.slice(i, i + 50));
    }

    const units = await getAllSortedUnits(db);
    return jsonResponse({ createdLogs, createdUnits, units }, 201);
  }

  const logMatch = path.match(/^\/logs\/([^/]+)$/);
  if (logMatch && method === 'PATCH') {
    if (!hasPerm(current, 'canEditHistory')) {
      return jsonResponse({ error: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลการล้างย้อนหลัง' }, 403);
    }
    const id = decodeURIComponent(logMatch[1]);
    const row = await db
      .prepare('SELECT * FROM cleaning_logs WHERE id = ?')
      .bind(id)
      .first<DbLogRow>();
    if (!row) {
      return jsonResponse({ error: 'ไม่พบรายการบันทึกการล้าง' }, 404);
    }

    const existing = mapLog(row);
    const body = await parseJson<{
      date?: string;
      status?: CleaningStatus;
      notes?: string;
      technicianId?: string;
    }>(request);

    const nextDate =
      body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : existing.date;
    const nextStatus =
      body.status &&
      ['cleaned', 'patient_occupied', 'renovation', 'no_card'].includes(body.status)
        ? body.status
        : existing.status;
    const nextNotes = typeof body.notes === 'string' ? body.notes.trim() : existing.notes;
    let nextTechId = existing.technicianId;
    let nextTechName = existing.technicianName;

    if (body.technicianId && body.technicianId !== existing.technicianId) {
      const techRow = await db
        .prepare('SELECT * FROM users WHERE id = ?')
        .bind(body.technicianId)
        .first<DbUserRow>();
      if (techRow) {
        nextTechId = techRow.id;
        nextTechName = techRow.full_name;
      }
    }

    const updatedAt = new Date().toISOString();
    await db
      .prepare(
        'UPDATE cleaning_logs SET date = ?, status = ?, notes = ?, technician_id = ?, technician_name = ?, updated_at = ? WHERE id = ?'
      )
      .bind(nextDate, nextStatus, nextNotes, nextTechId, nextTechName, updatedAt, id)
      .run();

    return jsonResponse({
      log: {
        ...existing,
        date: nextDate,
        status: nextStatus,
        notes: nextNotes,
        technicianId: nextTechId,
        technicianName: nextTechName,
        updatedAt,
      },
    });
  }

  if (logMatch && method === 'DELETE') {
    if (!hasPerm(current, 'canDeleteHistory')) {
      return jsonResponse(
        {
          error:
            'แผนกช่างซ่อมบำรุง (ช่างเทคนิค) ไม่มีสิทธิ์ลบข้อมูลเก่า กรุณาติดต่อหัวหน้าช่างหรือ Admin',
        },
        403
      );
    }
    const id = decodeURIComponent(logMatch[1]);
    const res = await db.prepare('DELETE FROM cleaning_logs WHERE id = ?').bind(id).run();
    if (!res.meta?.changes) {
      return jsonResponse({ error: 'ไม่พบรายการที่ต้องการลบ' }, 404);
    }
    return jsonResponse({ ok: true });
  }

    return jsonResponse({ error: 'Not Found' }, 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดภายในระบบฐานข้อมูล D1';
    return jsonResponse({ error: message }, 500);
  }
};
