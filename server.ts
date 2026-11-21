import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import {
  DEFAULT_PERMISSIONS_BY_ROLE,
  type ACType,
  type ACUnit,
  type ACUnitStatus,
  type BatchLogItemInput,
  type CleaningLog,
  type CleaningStatus,
  type UserPermissions,
  type UserRole,
} from './src/types.ts';
import {
  hashPassword,
  normalizePermissions,
  readDb,
  readSessions,
  sanitizeUser,
  sortUnitsByBuildingAndOrder,
  verifyPassword,
  writeDb,
  writeSessions,
  type StoredUser,
} from './server/db.ts';

interface AuthenticatedRequest extends Request {
  currentUser?: StoredUser;
  sessionToken?: string;
}

const PORT = 3000;

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const sessions = readSessions();
  const session = sessions.find((s) => s.token === token);
  if (!session) {
    res.status(401).json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
    return;
  }
  const db = readDb();
  const user = db.users.find((u) => u.id === session.userId && u.active);
  if (!user) {
    res.status(401).json({ error: 'ไม่พบบัญชีผู้ใช้งานหรือบัญชีถูกระงับ' });
    return;
  }
  req.currentUser = user;
  req.sessionToken = token;
  next();
}

function hasPerm(user: StoredUser, perm: keyof UserPermissions): boolean {
  if (user.role === 'super_admin') return true;
  return Boolean(user.permissions[perm]);
}

function getBangkokYearMonth(): string {
  const nowBangkok = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return nowBangkok.toISOString().slice(0, 7);
}

function isCurrentMonthRestricted(user: StoredUser): boolean {
  return user.role !== 'super_admin' && Boolean(user.permissions.canModifyCurrentMonthOnly);
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    const db = readDb();
    res.json({
      ok: true,
      database: 'local-json',
      units: db.units.length,
      logs: db.logs.length,
    });
  });

  // Public company info for Login screen
  app.get('/api/public/company', (_req, res) => {
    const db = readDb();
    res.json({
      name: db.company.name,
      address: db.company.address,
      taxId: db.company.taxId,
      phone: db.company.phone,
      siteName: db.company.siteName,
      logoDataUrl: db.company.logoDataUrl,
    });
  });

  // Auth: Login
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน' });
      return;
    }

    const db = readDb();
    const user = db.users.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase()
    );

    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
      return;
    }

    if (!user.active) {
      res.status(403).json({ error: 'บัญชีนี้ถูกปิดการใช้งาน กรุณาติดต่อ Admin สูงสุด' });
      return;
    }

    if (user.canLogin === false) {
      res.status(403).json({ error: 'บัญชีช่างรายนี้ยังไม่เปิดสิทธิ์เข้าสู่ระบบ กรุณาติดต่อ Admin หรือหัวหน้าช่าง' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sessions = readSessions();
    sessions.push({
      token,
      userId: user.id,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
    });
    writeSessions(sessions);

    res.json({
      token,
      user: sanitizeUser(user),
      company: db.company,
    });
  });

  // Auth: Logout
  app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
    const sessions = readSessions().filter((s) => s.token !== req.sessionToken);
    writeSessions(sessions);
    res.json({ ok: true });
  });

  // Auth: Current session
  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = readDb();
    res.json({
      user: sanitizeUser(req.currentUser!),
      company: db.company,
    });
  });

  // Technicians list (for dropdown in daily entry / filters / roster)
  app.get('/api/technicians', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = readDb();
    const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';
    const techs = db.users
      .filter((u) => includeInactive || u.active)
      .map((u) => ({
        id: u.id,
        fullName: u.fullName,
        phone: u.phone ?? '',
        username: u.username,
        role: u.role,
        department: u.department,
        canLogin: typeof u.canLogin === 'boolean' ? u.canLogin : true,
        active: u.active,
      }));
    res.json({ technicians: techs });
  });

  // Technician Roster CRUD (requires canManageTechnicians: super_admin / head_tech)
  app.post('/api/technicians', requireAuth, (req: AuthenticatedRequest, res) => {
    const current = req.currentUser!;
    if (!hasPerm(current, 'canManageTechnicians')) {
      res.status(403).json({ error: 'คุณไม่มีสิทธิ์เพิ่มรายชื่อช่างเทคนิค' });
      return;
    }

    const { fullName, phone, username, password, canLogin, active } = req.body as {
      fullName?: string;
      phone?: string;
      username?: string;
      password?: string;
      canLogin?: boolean;
      active?: boolean;
    };

    if (!fullName?.trim()) {
      res.status(400).json({ error: 'กรุณากรอกชื่อ-สกุลช่างเทคนิค' });
      return;
    }
    if (!phone?.trim()) {
      res.status(400).json({ error: 'กรุณากรอกเบอร์โทรศัพท์ช่างเทคนิค' });
      return;
    }

    const db = readDb();
    const wantsLogin = Boolean(canLogin && username?.trim());
    let finalUsername = '';
    let finalPassword = '';

    if (wantsLogin) {
      finalUsername = username!.trim();
      if (!password || password.length < 4) {
        res.status(400).json({ error: 'กรุณากำหนดรหัสผ่านอย่างน้อย 4 ตัวอักษรสำหรับการเข้าสู่ระบบ' });
        return;
      }
      const duplicate = db.users.some(
        (u) => u.username.toLowerCase() === finalUsername.toLowerCase()
      );
      if (duplicate) {
        res.status(409).json({ error: 'ชื่อผู้ใช้งาน (Username) นี้มีอยู่ในระบบแล้ว' });
        return;
      }
      finalPassword = password;
    } else {
      const shortId = crypto.randomUUID().slice(0, 8);
      finalUsername = `tech-${shortId}`;
      finalPassword = crypto.randomBytes(16).toString('hex');
    }

    const newTech: StoredUser = {
      id: `usr-${crypto.randomUUID().slice(0, 8)}`,
      username: finalUsername,
      fullName: fullName.trim(),
      phone: phone.trim(),
      department: 'แผนกช่างซ่อมบำรุง (ช่างเทคนิค)',
      role: 'technician',
      canLogin: wantsLogin,
      active: active ?? true,
      permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE.technician },
      passwordHash: hashPassword(finalPassword),
      createdAt: new Date().toISOString(),
    };

    db.users.push(newTech);
    writeDb(db);

    res.status(201).json({
      technician: {
        id: newTech.id,
        fullName: newTech.fullName,
        phone: newTech.phone,
        username: newTech.username,
        role: newTech.role,
        department: newTech.department,
        canLogin: newTech.canLogin,
        active: newTech.active,
      },
    });
  });

  app.patch('/api/technicians/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const current = req.currentUser!;
    if (!hasPerm(current, 'canManageTechnicians')) {
      res.status(403).json({ error: 'คุณไม่มีสิทธิ์แก้ไขรายชื่อช่างเทคนิค' });
      return;
    }

    const { id } = req.params;
    const db = readDb();
    const target = db.users.find((u) => u.id === id);
    if (!target) {
      res.status(404).json({ error: 'ไม่พบรายชื่อช่างเทคนิค' });
      return;
    }

    const { fullName, phone, username, password, canLogin, active } = req.body as {
      fullName?: string;
      phone?: string;
      username?: string;
      password?: string;
      canLogin?: boolean;
      active?: boolean;
    };

    if (typeof fullName === 'string') {
      if (!fullName.trim()) {
        res.status(400).json({ error: 'ชื่อ-สกุลต้องไม่เป็นค่าว่าง' });
        return;
      }
      target.fullName = fullName.trim();
    }
    if (typeof phone === 'string') {
      target.phone = phone.trim();
    }
    if (typeof username === 'string' && username.trim()) {
      const nextUsername = username.trim();
      const dup = db.users.some(
        (u) => u.id !== target.id && u.username.toLowerCase() === nextUsername.toLowerCase()
      );
      if (dup) {
        res.status(409).json({ error: 'ชื่อผู้ใช้งาน (Username) นี้มีอยู่ในระบบแล้ว' });
        return;
      }
      target.username = nextUsername;
    }
    if (typeof password === 'string' && password.length > 0) {
      target.passwordHash = hashPassword(password);
    }
    if (typeof canLogin === 'boolean') {
      if (target.id === current.id && !canLogin) {
        res.status(400).json({ error: 'ไม่สามารถปิดสิทธิ์เข้าสู่ระบบของบัญชีที่กำลังใช้งานอยู่ได้' });
        return;
      }
      target.canLogin = canLogin;
    }
    if (typeof active === 'boolean') {
      if (target.id === current.id && !active) {
        res.status(400).json({ error: 'ไม่สามารถระงับบัญชีของตนเองที่กำลังใช้งานอยู่ได้' });
        return;
      }
      target.active = active;
    }

    writeDb(db);
    res.json({
      technician: {
        id: target.id,
        fullName: target.fullName,
        phone: target.phone ?? '',
        username: target.username,
        role: target.role,
        department: target.department,
        canLogin: typeof target.canLogin === 'boolean' ? target.canLogin : true,
        active: target.active,
      },
    });
  });

  app.delete('/api/technicians/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const current = req.currentUser!;
    if (!hasPerm(current, 'canManageTechnicians')) {
      res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบรายชื่อช่างเทคนิค' });
      return;
    }

    const { id } = req.params;
    if (id === current.id) {
      res.status(400).json({ error: 'ไม่สามารถลบบัญชีของตนเองได้' });
      return;
    }

    const db = readDb();
    const target = db.users.find((u) => u.id === id);
    if (!target) {
      res.status(404).json({ error: 'ไม่พบรายชื่อช่างเทคนิค' });
      return;
    }
    if (target.role === 'super_admin') {
      res.status(403).json({ error: 'ไม่สามารถลบบัญชี Admin สูงสุดออกจากหน้านี้ได้' });
      return;
    }

    db.users = db.users.filter((u) => u.id !== id);
    writeDb(db);
    const sessions = readSessions().filter((s) => s.userId !== id);
    writeSessions(sessions);
    res.json({ ok: true });
  });

  // Company Settings Update
  app.patch('/api/company', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.currentUser!;
    if (!hasPerm(user, 'canEditCompany') && !hasPerm(user, 'canSyncSheets')) {
      res.status(403).json({ error: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลบริษัทหรือการตั้งค่า' });
      return;
    }

    const db = readDb();
    const body = req.body as Partial<typeof db.company>;

    // If only updating Google Sheets settings, check canSyncSheets
    const companyFieldsTouched =
      body.name !== undefined ||
      body.address !== undefined ||
      body.taxId !== undefined ||
      body.phone !== undefined ||
      body.siteName !== undefined ||
      body.logoDataUrl !== undefined ||
      body.defaultSenderLabel !== undefined ||
      body.defaultInspectorLabel !== undefined;

    if (companyFieldsTouched && !hasPerm(user, 'canEditCompany')) {
      res.status(403).json({ error: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลบริษัทและโลโก้' });
      return;
    }

    if (typeof body.logoDataUrl === 'string' && body.logoDataUrl.length > 0) {
      if (!body.logoDataUrl.startsWith('data:image/')) {
        res.status(400).json({ error: 'ไฟล์โลโก้ต้องเป็นรูปภาพที่ถูกต้อง (PNG/JPG/SVG/WebP)' });
        return;
      }
      if (body.logoDataUrl.length > 4 * 1024 * 1024) {
        res.status(400).json({ error: 'ขนาดไฟล์โลโก้ใหญ่เกินไป (สูงสุด 3MB)' });
        return;
      }
    }

    db.company = {
      ...db.company,
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

    writeDb(db);
    res.json({ company: db.company });
  });

  // Users Management (Super Admin only / canManageUsers)
  app.get('/api/users', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.currentUser!;
    if (!hasPerm(user, 'canManageUsers')) {
      res.status(403).json({ error: 'เฉพาะ Admin สูงสุดเท่านั้นที่จัดการผู้ใช้งานได้' });
      return;
    }
    const db = readDb();
    res.json({ users: db.users.map(sanitizeUser) });
  });

  app.post('/api/users', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.currentUser!;
    if (!hasPerm(user, 'canManageUsers')) {
      res.status(403).json({ error: 'คุณไม่มีสิทธิ์เพิ่มผู้ใช้งาน' });
      return;
    }

    const { username, password, fullName, phone, department, role, permissions, active, canLogin } = req.body as {
      username?: string;
      password?: string;
      fullName?: string;
      phone?: string;
      department?: string;
      role?: UserRole;
      permissions?: Partial<UserPermissions>;
      active?: boolean;
      canLogin?: boolean;
    };

    if (!username?.trim() || !password || !fullName?.trim() || !role) {
      res.status(400).json({ error: 'กรุณากรอกข้อมูลผู้ใช้ ชื่อ-นามสกุล รหัสผ่าน และสิทธิ์ให้ครบถ้วน' });
      return;
    }

    const db = readDb();
    const exists = db.users.some(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase()
    );
    if (exists) {
      res.status(409).json({ error: 'ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว' });
      return;
    }

    const deptDefault =
      role === 'super_admin'
        ? 'ผู้บริหารระบบ'
        : role === 'head_tech'
          ? 'แผนกช่างซ่อมบำรุง (หัวหน้าช่างเทคนิค)'
          : 'แผนกช่างซ่อมบำรุง (ช่างเทคนิค)';

    const newUser: StoredUser = {
      id: `usr-${crypto.randomUUID().slice(0, 8)}`,
      username: username.trim(),
      fullName: fullName.trim(),
      phone: phone?.trim() || '',
      department: department?.trim() || deptDefault,
      role,
      canLogin: typeof canLogin === 'boolean' ? canLogin : true,
      active: active ?? true,
      permissions: normalizePermissions(role, permissions),
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    writeDb(db);
    res.status(201).json({ user: sanitizeUser(newUser) });
  });

  app.patch('/api/users/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const current = req.currentUser!;
    if (!hasPerm(current, 'canManageUsers')) {
      res.status(403).json({ error: 'คุณไม่มีสิทธิ์แก้ไขผู้ใช้งาน' });
      return;
    }

    const { id } = req.params;
    const db = readDb();
    const target = db.users.find((u) => u.id === id);
    if (!target) {
      res.status(404).json({ error: 'ไม่พบผู้ใช้งาน' });
      return;
    }

    const { fullName, phone, department, role, permissions, active, canLogin, password } = req.body as {
      fullName?: string;
      phone?: string;
      department?: string;
      role?: UserRole;
      permissions?: Partial<UserPermissions>;
      active?: boolean;
      canLogin?: boolean;
      password?: string;
    };

    if (typeof fullName === 'string' && fullName.trim()) {
      target.fullName = fullName.trim();
    }
    if (typeof phone === 'string') {
      target.phone = phone.trim();
    }
    if (typeof department === 'string') {
      target.department = department.trim();
    }
    if (role) {
      target.role = role;
      target.permissions = normalizePermissions(role, permissions ?? target.permissions);
    } else if (permissions) {
      target.permissions = normalizePermissions(target.role, {
        ...target.permissions,
        ...permissions,
      });
    }
    if (typeof canLogin === 'boolean') {
      target.canLogin = canLogin;
    }
    if (typeof active === 'boolean') {
      if (target.id === current.id && !active) {
        res.status(400).json({ error: 'ไม่สามารถระงับบัญชีของตนเองที่กำลังใช้งานอยู่ได้' });
        return;
      }
      target.active = active;
    }
    if (typeof password === 'string' && password.length > 0) {
      target.passwordHash = hashPassword(password);
    }

    writeDb(db);
    res.json({ user: sanitizeUser(target) });
  });

  app.delete('/api/users/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const current = req.currentUser!;
    if (!hasPerm(current, 'canManageUsers')) {
      res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบผู้ใช้งาน' });
      return;
    }
    const { id } = req.params;
    if (id === current.id) {
      res.status(400).json({ error: 'ไม่สามารถลบบัญชีของตนเองได้' });
      return;
    }
    const db = readDb();
    const prevLen = db.users.length;
    db.users = db.users.filter((u) => u.id !== id);
    if (db.users.length === prevLen) {
      res.status(404).json({ error: 'ไม่พบผู้ใช้งาน' });
      return;
    }
    writeDb(db);
    const sessions = readSessions().filter((s) => s.userId !== id);
    writeSessions(sessions);
    res.json({ ok: true });
  });

  // AC Inventory Units
  app.get('/api/units', requireAuth, (_req, res) => {
    const db = readDb();
    res.json({ units: sortUnitsByBuildingAndOrder(db.units) });
  });

  app.post('/api/units', requireAuth, (req: AuthenticatedRequest, res) => {
    const current = req.currentUser!;
    if (!hasPerm(current, 'canManageInventory') && !hasPerm(current, 'canEnterDaily')) {
      res.status(403).json({ error: 'คุณไม่มีสิทธิ์เพิ่มเครื่องปรับอากาศ' });
      return;
    }

    const { building, floor, room, unitCode, acType, btu, brand, model, installType, status, notes } = req.body as {
      building?: string;
      floor?: string;
      room?: string;
      unitCode?: string;
      acType?: ACType;
      btu?: string;
      brand?: string;
      model?: string;
      installType?: string;
      status?: ACUnitStatus;
      notes?: string;
    };

    const unitStatus: ACUnitStatus = status === 'cancelled' ? 'cancelled' : 'active';
    if (!building?.trim() || !floor?.trim() || !room?.trim() || !unitCode?.trim()) {
      res.status(400).json({ error: 'กรุณาระบุ อาคาร ชั้น ห้อง และหมายเลขเครื่อง ให้ครบถ้วน' });
      return;
    }

    const db = readDb();
    const duplicate = db.units.some(
      (u) =>
        u.building.trim() === building.trim() &&
        u.unitCode.trim().toLowerCase() === unitCode.trim().toLowerCase()
    );
    if (duplicate) {
      res.status(409).json({ error: `หมายเลขเครื่อง ${unitCode.trim()} มีอยู่ใน ${building.trim()} แล้ว` });
      return;
    }

    const sameBuilding = db.units.filter((u) => u.building.trim() === building.trim());
    const maxOrder = sameBuilding.reduce((max, u) => Math.max(max, u.sortOrder), 0);

    const newUnit: ACUnit = {
      id: `unit-${crypto.randomUUID().slice(0, 8)}`,
      building: building.trim(),
      floor: floor.trim(),
      room: room.trim(),
      unitCode: unitCode.trim(),
      acType: acType === 'vrf' ? 'vrf' : 'normal',
      btu: btu?.trim() || '',
      brand: brand?.trim() || '',
      model: model?.trim() || '',
      installType: installType?.trim() || '',
      status: unitStatus,
      notes: notes?.trim() || '',
      sortOrder: maxOrder + 10,
      createdAt: new Date().toISOString(),
    };

    db.units.push(newUnit);
    db.units = sortUnitsByBuildingAndOrder(db.units);
    writeDb(db);
    res.status(201).json({ unit: newUnit, units: db.units });
  });

  app.post('/api/units/import', requireAuth, (req: AuthenticatedRequest, res) => {
    const current = req.currentUser!;
    if (!hasPerm(current, 'canManageInventory')) {
      res.status(403).json({ error: 'คุณไม่มีสิทธิ์นำเข้าทะเบียนเครื่องปรับอากาศ' });
      return;
    }

    const { rows, replaceAll } = req.body as {
      rows?: Array<{
        building: string;
        floor: string;
        room: string;
        unitCode: string;
        acType?: string;
        btu?: string;
        brand?: string;
        model?: string;
        installType?: string;
        status?: string;
        notes?: string;
      }>;
      replaceAll?: boolean;
    };

    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'ไม่พบข้อมูลสำหรับนำเข้า' });
      return;
    }

    const db = readDb();
    let baseUnits: ACUnit[] = replaceAll ? [] : [...db.units];
    let addedCount = 0;
    let updatedCount = 0;

    for (const row of rows) {
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
        rawStatus.includes('ยกเลิก') || rawStatus.includes('cancel')
          ? 'cancelled'
          : 'active';

      const existingIdx = baseUnits.findIndex(
        (u) =>
          u.building.trim() === building &&
          u.unitCode.trim().toLowerCase() === unitCode.toLowerCase()
      );

      if (existingIdx >= 0) {
        baseUnits[existingIdx] = {
          ...baseUnits[existingIdx],
          floor,
          room,
          acType,
          btu: String(row.btu || baseUnits[existingIdx].btu || '').trim(),
          brand: String(row.brand || baseUnits[existingIdx].brand || '').trim(),
          model: String(row.model || baseUnits[existingIdx].model || '').trim(),
          installType: String(row.installType || baseUnits[existingIdx].installType || '').trim(),
          status,
          notes: String(row.notes || baseUnits[existingIdx].notes || '').trim(),
        };
        updatedCount++;
      } else {
        const maxOrder = baseUnits
          .filter((u) => u.building === building)
          .reduce((m, u) => Math.max(m, u.sortOrder), 0);
        baseUnits.push({
          id: `unit-${crypto.randomUUID().slice(0, 8)}`,
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
          sortOrder: maxOrder + 10,
          createdAt: new Date().toISOString(),
        });
        addedCount++;
      }
    }

    db.units = sortUnitsByBuildingAndOrder(baseUnits);
    writeDb(db);
    res.json({
      addedCount,
      updatedCount,
      units: db.units,
    });
  });

  app.patch('/api/units/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const current = req.currentUser!;
    if (!hasPerm(current, 'canManageInventory')) {
      res.status(403).json({ error: 'คุณไม่มีสิทธิ์แก้ไขทะเบียนเครื่องปรับอากาศ' });
      return;
    }

    const { id } = req.params;
    const db = readDb();
    const unit = db.units.find((u) => u.id === id);
    if (!unit) {
      res.status(404).json({ error: 'ไม่พบข้อมูลเครื่องปรับอากาศ' });
      return;
    }

    const body = req.body as Partial<ACUnit>;
    const nextBuilding = typeof body.building === 'string' ? body.building.trim() : unit.building;
    const nextFloor = typeof body.floor === 'string' ? body.floor.trim() : unit.floor;
    const nextRoom = typeof body.room === 'string' ? body.room.trim() : unit.room;
    const nextCode = typeof body.unitCode === 'string' ? body.unitCode.trim() : unit.unitCode;
    const nextStatus = body.status === 'cancelled' || body.status === 'active' ? body.status : unit.status;

    if (!nextBuilding || !nextFloor || !nextRoom || !nextCode) {
      res.status(400).json({ error: 'กรุณาระบุ อาคาร ชั้น ห้อง และหมายเลขเครื่อง ให้ครบถ้วน' });
      return;
    }

    unit.building = nextBuilding;
    unit.floor = nextFloor;
    unit.room = nextRoom;
    unit.unitCode = nextCode;
    if (body.acType === 'normal' || body.acType === 'vrf') unit.acType = body.acType;
    if (typeof body.btu === 'string') unit.btu = body.btu.trim();
    if (typeof body.brand === 'string') unit.brand = body.brand.trim();
    if (typeof body.model === 'string') unit.model = body.model.trim();
    if (typeof body.installType === 'string') unit.installType = body.installType.trim();
    unit.status = nextStatus;
    if (typeof body.notes === 'string') unit.notes = body.notes.trim();

    db.units = sortUnitsByBuildingAndOrder(db.units);
    writeDb(db);
    res.json({ unit, units: db.units });
  });

  app.delete('/api/units/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const current = req.currentUser!;
    if (!hasPerm(current, 'canManageInventory')) {
      res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบเครื่องปรับอากาศ' });
      return;
    }
    const { id } = req.params;
    const db = readDb();
    const prevLen = db.units.length;
    db.units = db.units.filter((u) => u.id !== id);
    if (db.units.length === prevLen) {
      res.status(404).json({ error: 'ไม่พบเครื่องปรับอากาศ' });
      return;
    }
    writeDb(db);
    res.json({ ok: true, units: db.units });
  });

  // Cleaning Logs: Read with filters
  app.get('/api/logs', requireAuth, (req: AuthenticatedRequest, res) => {
    const current = req.currentUser!;
    if (!hasPerm(current, 'canViewReports') && !hasPerm(current, 'canViewDashboard') && !hasPerm(current, 'canEnterDaily')) {
      res.status(403).json({ error: 'คุณไม่มีสิทธิ์เรียกดูประวัติการล้าง' });
      return;
    }

    const { startDate, endDate, building, status, technicianId, search } = req.query as Record<
      string,
      string | undefined
    >;

    const db = readDb();
    let logs = [...db.logs];

    if (startDate) {
      logs = logs.filter((l) => l.date >= startDate);
    }
    if (endDate) {
      logs = logs.filter((l) => l.date <= endDate);
    }
    if (building && building !== 'all') {
      logs = logs.filter((l) => l.building === building);
    }
    if (status && status !== 'all') {
      logs = logs.filter((l) => l.status === status);
    }
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

    res.json({ logs });
  });

  // Cleaning Logs: Batch Daily Entry (supports pulling existing units + appending new units sorted per building)
  app.post('/api/logs/batch', requireAuth, (req: AuthenticatedRequest, res) => {
    const current = req.currentUser!;
    if (!hasPerm(current, 'canEnterDaily')) {
      res.status(403).json({ error: 'คุณไม่มีสิทธิ์บันทึกงานล้างประจำวัน' });
      return;
    }

    const { date, technicianId, items } = req.body as {
      date?: string;
      technicianId?: string;
      items?: BatchLogItemInput[];
    };

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'กรุณาระบุวันที่เข้าล้างให้ถูกต้อง (YYYY-MM-DD)' });
      return;
    }

    if (isCurrentMonthRestricted(current) && !date.startsWith(getBangkokYearMonth())) {
      res.status(403).json({ error: 'สิทธิ์ของคุณอนุญาตให้เพิ่มข้อมูลการล้างเฉพาะเดือนปัจจุบันเท่านั้น' });
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'กรุณาเพิ่มรายการเครื่องปรับอากาศอย่างน้อย 1 รายการ' });
      return;
    }

    const db = readDb();

    // Technician role always logs under their own name so performance tracking is accurate
    let assignedTech = current;
    if (current.role !== 'technician' && technicianId) {
      const found = db.users.find((u) => u.id === technicianId && u.active);
      if (found) assignedTech = found;
    }

    const nowIso = new Date().toISOString();
    const createdLogs: CleaningLog[] = [];
    const createdUnits: ACUnit[] = [];

    for (const item of items) {
      const building = String(item.building || '').trim();
      const floor = String(item.floor || '').trim();
      const room = String(item.room || '').trim();
      const unitCode = String(item.unitCode || '').trim();

      if (!building || !floor || !room || !unitCode) {
        res.status(400).json({
          error: 'ข้อมูล อาคาร ชั้น ห้อง และหมายเลขเครื่อง ต้องกรอกให้ครบถ้วนทุกรายการ',
        });
        return;
      }

      let unit: ACUnit | undefined;

      if (item.mode === 'existing' && item.unitId) {
        unit = db.units.find((u) => u.id === item.unitId);
      }

      if (!unit) {
        unit = db.units.find(
          (u) =>
            u.building.trim() === building &&
            u.unitCode.trim().toLowerCase() === unitCode.toLowerCase()
        );
      }

      // If new manual unit, append after existing units of that building
      if (!unit) {
        const sameBuilding = db.units.filter((u) => u.building.trim() === building);
        const maxOrder = sameBuilding.reduce((m, u) => Math.max(m, u.sortOrder), 0);
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
          sortOrder: maxOrder + 10,
          createdAt: nowIso,
        };
        db.units.push(unit);
        createdUnits.push(unit);
      }

      if (unit.status === 'cancelled') {
        continue; // Do not log cancelled units
      }

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
        date,
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

      db.logs.push(newLog);
      createdLogs.push(newLog);
    }

    db.units = sortUnitsByBuildingAndOrder(db.units);
    writeDb(db);

    res.status(201).json({
      createdLogs,
      createdUnits,
      units: db.units,
    });
  });

  // Cleaning Logs: Edit existing log
  app.patch('/api/logs/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const current = req.currentUser!;
    if (!hasPerm(current, 'canEditHistory')) {
      res.status(403).json({ error: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลการล้างย้อนหลัง' });
      return;
    }

    const { id } = req.params;
    const db = readDb();
    const log = db.logs.find((l) => l.id === id);
    if (!log) {
      res.status(404).json({ error: 'ไม่พบรายการบันทึกการล้าง' });
      return;
    }

    const currentMonth = getBangkokYearMonth();
    if (isCurrentMonthRestricted(current) && !log.date.startsWith(currentMonth)) {
      res.status(403).json({ error: 'สิทธิ์ของคุณอนุญาตให้แก้ไขข้อมูลการล้างเฉพาะเดือนปัจจุบันเท่านั้น' });
      return;
    }

    const { date, status, notes, technicianId } = req.body as {
      date?: string;
      status?: CleaningStatus;
      notes?: string;
      technicianId?: string;
    };

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      if (isCurrentMonthRestricted(current) && !date.startsWith(currentMonth)) {
        res.status(403).json({ error: 'สิทธิ์ของคุณอนุญาตให้ระบุวันที่เฉพาะเดือนปัจจุบันเท่านั้น' });
        return;
      }
      log.date = date;
    }
    if (
      status &&
      ['cleaned', 'patient_occupied', 'renovation', 'no_card'].includes(status)
    ) {
      log.status = status;
    }
    if (typeof notes === 'string') {
      log.notes = notes.trim();
    }
    if (technicianId) {
      const tech = db.users.find((u) => u.id === technicianId);
      if (tech) {
        log.technicianId = tech.id;
        log.technicianName = tech.fullName;
      }
    }
    log.updatedAt = new Date().toISOString();

    writeDb(db);
    res.json({ log });
  });

  // Cleaning Logs: Delete existing log (Strictly blocked for technicians without permission)
  app.delete('/api/logs/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const current = req.currentUser!;
    if (!hasPerm(current, 'canDeleteHistory')) {
      res.status(403).json({
        error: 'แผนกช่างซ่อมบำรุง (ช่างเทคนิค) ไม่มีสิทธิ์ลบข้อมูลเก่า กรุณาติดต่อหัวหน้าช่างหรือ Admin',
      });
      return;
    }

    const { id } = req.params;
    const db = readDb();
    const targetLog = db.logs.find((l) => l.id === id);
    if (!targetLog) {
      res.status(404).json({ error: 'ไม่พบรายการที่ต้องการลบ' });
      return;
    }
    if (isCurrentMonthRestricted(current) && !targetLog.date.startsWith(getBangkokYearMonth())) {
      res.status(403).json({ error: 'สิทธิ์ของคุณอนุญาตให้ลบข้อมูลการล้างเฉพาะเดือนปัจจุบันเท่านั้น' });
      return;
    }
    db.logs = db.logs.filter((l) => l.id !== id);

    writeDb(db);
    res.json({ ok: true });
  });

  // Vite or static dist serving
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
