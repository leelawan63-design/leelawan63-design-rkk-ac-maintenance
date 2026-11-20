import type { ACType, ACUnit, CleaningLog, CleaningStatus } from '../src/types.ts';
import { PDF_SECTIONS_PART1 } from './pdfPart1.ts';
import { PDF_SECTIONS_PART2 } from './pdfPart2.ts';

function parseEventToken(token: string): {
  date: string;
  status: CleaningStatus;
  notes: string;
} | null {
  const trimmed = token.trim();
  if (!trimmed) return null;

  // Non-cleaned status codes: P:MM (ห้องคนไข้), R:MM (ปิดปรับปรุง), N:MM (ไม่เจอการ์ด)
  const codeMatch = /^([PRN]):(\d{1,2})$/i.exec(trimmed);
  if (codeMatch) {
    const code = codeMatch[1].toUpperCase();
    const mm = codeMatch[2].padStart(2, '0');
    const date = `2026-${mm}-01`;
    if (code === 'P') {
      return { date, status: 'patient_occupied', notes: 'ห้องคนไข้ (ตามไฟล์ พ.ศ. 2569)' };
    }
    if (code === 'R') {
      return { date, status: 'renovation', notes: 'ปิดปรับปรุง (ตามไฟล์ พ.ศ. 2569)' };
    }
    return { date, status: 'no_card', notes: 'ไม่เจอการ์ด (ตามไฟล์ พ.ศ. 2569)' };
  }

  // Cleaned dates in format "DD MM 2569" or "D/M/2569"
  const dateMatch = /^(\d{1,2})[\s/](\d{1,2})[\s/](\d{4})$/.exec(trimmed);
  if (dateMatch) {
    const dd = dateMatch[1].padStart(2, '0');
    const mm = dateMatch[2].padStart(2, '0');
    const rawYear = Number(dateMatch[3]);
    const adYear = rawYear > 2400 ? rawYear - 543 : rawYear;
    const date = `${adYear}-${mm}-${dd}`;
    return { date, status: 'cleaned', notes: '' };
  }

  return null;
}

export function getPdfSeedUnitsAndLogs(nowIso: string): {
  units: ACUnit[];
  logs: CleaningLog[];
} {
  const allSections = [...PDF_SECTIONS_PART1, ...PDF_SECTIONS_PART2];
  const units: ACUnit[] = [];
  const logs: CleaningLog[] = [];

  let unitSeq = 0;
  let logSeq = 0;
  const seenLogKeys = new Set<string>();

  for (const section of allSections) {
    let buildingOrder = 0;
    for (const rawRow of section.rows) {
      const parts = rawRow.split('|');
      const floor = (parts[0] ?? '').trim();
      const room = (parts[1] ?? '').trim();
      const unitCode = (parts[2] ?? '').trim();
      const brand = (parts[3] ?? '').trim();
      const model = (parts[4] ?? '').trim();
      const btu = (parts[5] ?? '').trim();
      const installType = (parts[6] ?? '').trim();
      const remark = (parts[7] ?? '').trim();
      const eventsStr = (parts[8] ?? '').trim();

      unitSeq += 1;
      buildingOrder += 1;

      const isVrf = /vrf|vrv/i.test(model) || /vrf|vrv/i.test(remark) || /vrf|vrv/i.test(brand);
      const acType: ACType = isVrf ? 'vrf' : 'normal';

      const unit: ACUnit = {
        id: `unit-${String(unitSeq).padStart(4, '0')}`,
        building: section.building,
        floor,
        room,
        unitCode,
        acType,
        btu,
        brand,
        model,
        installType,
        status: 'active',
        notes: remark,
        sortOrder: buildingOrder * 10,
        createdAt: nowIso,
      };
      units.push(unit);

      if (!eventsStr) continue;
      const tokens = eventsStr.split(',');
      for (const token of tokens) {
        const parsed = parseEventToken(token);
        if (!parsed) continue;
        const dedupKey = `${unit.id}::${parsed.date}::${parsed.status}`;
        if (seenLogKeys.has(dedupKey)) continue;
        seenLogKeys.add(dedupKey);

        logSeq += 1;
        logs.push({
          id: `log-${String(logSeq).padStart(5, '0')}`,
          date: parsed.date,
          unitId: unit.id,
          building: unit.building,
          floor: unit.floor,
          room: unit.room,
          unitCode: unit.unitCode,
          acType: unit.acType,
          status: parsed.status,
          technicianId: 'import-2569',
          technicianName: 'ข้อมูลตามไฟล์ 2569 (ยังไม่ระบุช่าง)',
          enteredByUserId: 'usr-admin',
          enteredByName: 'นำเข้าข้อมูลจากไฟล์ 2569',
          notes: parsed.notes,
          createdAt: `${parsed.date}T09:00:00.000Z`,
          updatedAt: `${parsed.date}T09:00:00.000Z`,
        });
      }
    }
  }

  return { units, logs };
}
