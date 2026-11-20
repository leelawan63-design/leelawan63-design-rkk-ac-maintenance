import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_PERMISSIONS_BY_ROLE } from '../src/types.ts';
import { getPdfSeedUnitsAndLogs } from '../server/pdfSeedData.ts';

function sqlEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "''";
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function hashPbkdf2(password: string, iterations = 100000): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  return `pbkdf2:${iterations}:${salt.toString('hex')}:${derived.toString('hex')}`;
}

function main(): void {
  const nowIso = new Date().toISOString();
  const { units, logs } = getPdfSeedUnitsAndLogs(nowIso);

  const lines: string[] = [
    '-- Auto-generated Cloudflare D1 Seed Data (2569 PDF Dataset)',
    '',
    `INSERT OR IGNORE INTO company_settings (id, name, address, tax_id, phone, site_name, logo_data_url, default_sender_label, default_inspector_label, google_sheet_id, google_sheet_name, auto_sync_sheets, last_synced_at) VALUES (${[
      sqlEscape('default'),
      sqlEscape('บริษัท รุ่งเรืองกิจการช่าง จำกัด'),
      sqlEscape('72/10 หมู่ที่ 6 ตำบลบึงคำพร้อย อำเภอลำลูกกา จังหวัดปทุมธานี 12150'),
      sqlEscape('0135548000364'),
      sqlEscape('081-839-5607'),
      sqlEscape('โครงการบำรุงรักษาเครื่องปรับอากาศ โรงพยาบาลรามคำแหง (พ.ศ. 2569)'),
      sqlEscape(''),
      sqlEscape('ผู้ส่งงาน (ช่างผู้ปฏิบัติงาน / ตัวแทนบริษัท)'),
      sqlEscape('ผู้ตรวจรับงาน (เจ้าหน้าที่ผู้ว่าจ้าง)'),
      sqlEscape(''),
      sqlEscape('รายงานล้างเครื่องปรับอากาศ - บจก. รุ่งเรืองกิจการช่าง'),
      0,
      sqlEscape(''),
    ].join(', ')});`,
    '',
  ];

  const users = [
    {
      id: 'usr-admin',
      username: 'admin',
      fullName: 'ผู้ดูแลระบบสูงสุด (Admin)',
      phone: '081-839-5607',
      department: 'ผู้บริหารระบบ',
      role: 'super_admin',
      canLogin: 1,
      active: 1,
      permissionsJson: JSON.stringify(DEFAULT_PERMISSIONS_BY_ROLE.super_admin),
      passwordHash: hashPbkdf2('admin1234'),
      createdAt: nowIso,
    },
    {
      id: 'usr-head',
      username: 'headtech',
      fullName: 'หัวหน้าช่างเทคนิค',
      phone: '081-839-5607',
      department: 'แผนกช่างซ่อมบำรุง (หัวหน้าช่างเทคนิค)',
      role: 'head_tech',
      canLogin: 1,
      active: 1,
      permissionsJson: JSON.stringify(DEFAULT_PERMISSIONS_BY_ROLE.head_tech),
      passwordHash: hashPbkdf2('head1234'),
      createdAt: nowIso,
    },
  ];

  for (const u of users) {
    lines.push(
      `INSERT OR IGNORE INTO users (id, username, full_name, phone, department, role, can_login, active, permissions_json, password_hash, created_at) VALUES (${[
        sqlEscape(u.id),
        sqlEscape(u.username),
        sqlEscape(u.fullName),
        sqlEscape(u.phone),
        sqlEscape(u.department),
        sqlEscape(u.role),
        u.canLogin,
        u.active,
        sqlEscape(u.permissionsJson),
        sqlEscape(u.passwordHash),
        sqlEscape(u.createdAt),
      ].join(', ')});`
    );
  }
  lines.push('');

  const CHUNK_SIZE = 40;
  for (let i = 0; i < units.length; i += CHUNK_SIZE) {
    const chunk = units.slice(i, i + CHUNK_SIZE);
    const valuesSql = chunk
      .map(
        (u) =>
          `(${[
            sqlEscape(u.id),
            sqlEscape(u.building),
            sqlEscape(u.floor),
            sqlEscape(u.room),
            sqlEscape(u.unitCode),
            sqlEscape(u.acType),
            sqlEscape(u.btu),
            sqlEscape(u.brand),
            sqlEscape(u.model || ''),
            sqlEscape(u.installType || ''),
            sqlEscape(u.status),
            sqlEscape(u.notes),
            u.sortOrder,
            sqlEscape(u.createdAt),
          ].join(', ')})`
      )
      .join(',\n  ');
    lines.push(
      `INSERT OR IGNORE INTO ac_units (id, building, floor, room, unit_code, ac_type, btu, brand, model, install_type, status, notes, sort_order, created_at) VALUES\n  ${valuesSql};`
    );
  }
  lines.push('');

  for (let i = 0; i < logs.length; i += CHUNK_SIZE) {
    const chunk = logs.slice(i, i + CHUNK_SIZE);
    const valuesSql = chunk
      .map(
        (l) =>
          `(${[
            sqlEscape(l.id),
            sqlEscape(l.date),
            sqlEscape(l.unitId),
            sqlEscape(l.building),
            sqlEscape(l.floor),
            sqlEscape(l.room),
            sqlEscape(l.unitCode),
            sqlEscape(l.acType),
            sqlEscape(l.status),
            sqlEscape(l.technicianId),
            sqlEscape(l.technicianName),
            sqlEscape(l.enteredByUserId),
            sqlEscape(l.enteredByName),
            sqlEscape(l.notes),
            sqlEscape(l.createdAt),
            sqlEscape(l.updatedAt),
          ].join(', ')})`
      )
      .join(',\n  ');
    lines.push(
      `INSERT OR IGNORE INTO cleaning_logs (id, date, unit_id, building, floor, room, unit_code, ac_type, status, technician_id, technician_name, entered_by_user_id, entered_by_name, notes, created_at, updated_at) VALUES\n  ${valuesSql};`
    );
  }

  const outPath = path.resolve(process.cwd(), 'migrations', '0002_seed_2569.sql');
  fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf-8');
  console.log(`Generated ${outPath}: ${units.length} units, ${logs.length} logs.`);
}

main();
