import type { ACUnit, CleaningLog, CompanySettings } from '../types';
import { CLEANING_STATUS_LABELS } from '../types';
import {
  computeBuildingFloorInventory,
  computeContractCounts,
  computeMonthlyCleaningMatrix,
  computeTechnicianStats,
  computeUncleanedSummary,
  formatReportNotes,
  formatReportTechnicianName,
} from './reportCalc';
import { formatThaiDate, formatThaiMonthYear } from './thaiDate';

const SHEET_TABS = [
  'สรุปประจำเดือน',
  'รายการไม่ได้ล้าง',
  'ประวัติการล้างแอร์',
  'สรุปแอร์ทุกชั้นทุกอาคาร',
  'ทะเบียนแอร์ทุกอาคาร',
  'สรุปผลงานช่างเทคนิค',
] as const;

export interface SheetsSyncPayload {
  company: CompanySettings;
  units: ACUnit[];
  logs: CleaningLog[];
  year: number;
  month: number;
}

function buildSheetValues(payload: SheetsSyncPayload): Record<string, (string | number)[][]> {
  const { company, units, logs, year, month } = payload;
  const contract = computeContractCounts(units);
  const matrix = computeMonthlyCleaningMatrix(logs, units, year, month);
  const uncleaned = computeUncleanedSummary(logs, units, year, month);
  const floorInv = computeBuildingFloorInventory(units);
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const monthLogs = logs.filter((l) => l.date.startsWith(monthPrefix));
  const techStats = computeTechnicianStats(monthLogs, units);

  // Tab 1: สรุปประจำเดือน
  const monthlyRows: (string | number)[][] = [
    [`รายงานสรุปผลการปรนนิบัติบำรุงรักษาเครื่องปรับอากาศ ประจำเดือน ${formatThaiMonthYear(year, month)}`],
    [`${company.name} | ${company.address} | เลขผู้เสียภาษี ${company.taxId} | โทร ${company.phone}`],
    [`เครื่องปรับอากาศในสัญญา (ไม่รวมยกเลิก): รวม ${contract.totalActive} เครื่อง`, `แอร์ปกติ: ${contract.normalActive} เครื่อง`, `VRF / VRV: ${contract.vrfActive} เครื่อง`, `ยกเลิก(ไม่นับรวม): ${contract.cancelledCount} เครื่อง`],
    [],
    ['วันที่', ...matrix.buildings, 'รวมรายวัน (เครื่อง)'],
  ];

  for (const row of matrix.rows) {
    monthlyRows.push([
      `${row.day} (${formatThaiDate(row.dateStr, true)})`,
      ...matrix.buildings.map((b) => row.countsByBuilding[b] || 0),
      row.dayTotal,
    ]);
  }
  monthlyRows.push([
    'รวมทั้งเดือน',
    ...matrix.buildings.map((b) => matrix.totalsByBuilding[b] || 0),
    matrix.grandTotal,
  ]);

  // Tab 2: รายการไม่ได้ล้าง
  const uncleanedRows: (string | number)[][] = [
    [`สรุปภาพรวมเครื่องที่ไม่ได้เข้าล้าง (ไม่รวมเครื่องที่ยกเลิก) ประจำเดือน ${formatThaiMonthYear(year, month)}`],
    ['สาเหตุที่ไม่ได้เข้าล้าง', 'จำนวน (เครื่อง)'],
    ['2.1 ห้องมีคนไข้', uncleaned.patientOccupied.count],
    ['2.2 ปิดปรับปรุง', uncleaned.renovation.count],
    ['2.3 ไม่มีการ์ด', uncleaned.noCard.count],
    ['รวมทั้งหมดที่ไม่ได้เข้าล้าง (ไม่รวมเครื่องที่ยกเลิก)', uncleaned.totalUncleaned],
    [],
    ['ลำดับ', 'วันที่', 'อาคาร', 'ชั้น', 'ห้อง', 'หมายเลขเครื่อง', 'ประเภทแอร์', 'สาเหตุ', 'หมายเหตุ', 'ผู้บันทึก'],
  ];
  uncleaned.allItems.forEach((item, idx) => {
    uncleanedRows.push([
      idx + 1,
      item.date,
      item.building,
      item.floor,
      item.room,
      item.unitCode,
      item.acType === 'vrf' ? 'VRF / VRV' : 'แอร์ปกติ',
      CLEANING_STATUS_LABELS[item.status],
      formatReportNotes(item.notes) || '-',
      formatReportTechnicianName(item.technicianId, item.technicianName),
    ]);
  });

  // Tab 3: ประวัติการล้างแอร์
  const logRows: (string | number)[][] = [
    ['วันที่', 'อาคาร', 'ชั้น', 'ห้อง', 'หมายเลขเครื่อง', 'ประเภทแอร์', 'สถานะ', 'ช่างผู้ปฏิบัติงาน', 'หมายเหตุ', 'บันทึกเมื่อ'],
  ];
  for (const l of logs) {
    logRows.push([
      l.date,
      l.building,
      l.floor,
      l.room,
      l.unitCode,
      l.acType === 'vrf' ? 'VRF / VRV' : 'แอร์ปกติ',
      CLEANING_STATUS_LABELS[l.status],
      formatReportTechnicianName(l.technicianId, l.technicianName),
      formatReportNotes(l.notes) || '',
      l.createdAt,
    ]);
  }

  // Tab 4: สรุปแอร์ทุกชั้นทุกอาคาร
  const floorSummaryRows: (string | number)[][] = [
    ['อาคาร', 'ชั้น', 'แอร์ปกติ (เครื่อง)', 'VRF / VRV (เครื่อง)', 'รวมใช้งาน (เครื่อง)', 'ยกเลิก (ไม่นับรวม)'],
  ];
  for (const b of floorInv.buildings) {
    for (const f of b.floors) {
      floorSummaryRows.push([
        f.building,
        f.floor,
        f.normalActive,
        f.vrfActive,
        f.totalActive,
        f.cancelledCount,
      ]);
    }
    floorSummaryRows.push([
      `รวม ${b.building}`,
      'ทุกชั้น',
      b.normalActive,
      b.vrfActive,
      b.totalActive,
      b.cancelledCount,
    ]);
  }
  floorSummaryRows.push([
    'รวมทั้งหมดทุกอาคาร',
    `${floorInv.grandTotal.floorCount} ชั้น`,
    floorInv.grandTotal.normalActive,
    floorInv.grandTotal.vrfActive,
    floorInv.grandTotal.totalActive,
    floorInv.grandTotal.cancelledCount,
  ]);

  // Tab 5: ทะเบียนแอร์ทุกอาคาร
  const unitRows: (string | number)[][] = [
    ['ลำดับ', 'อาคาร', 'ชั้น', 'ห้อง', 'หมายเลขเครื่อง', 'ประเภทแอร์', 'ขนาด BTU', 'ยี่ห้อ', 'สถานะ', 'หมายเหตุ'],
  ];
  units.forEach((u, idx) => {
    unitRows.push([
      idx + 1,
      u.building,
      u.floor,
      u.room,
      u.unitCode,
      u.acType === 'vrf' ? 'VRF / VRV' : 'แอร์ปกติ',
      u.btu || '-',
      u.brand || '-',
      u.status === 'cancelled' ? 'ยกเลิก' : 'ใช้งาน',
      u.notes || '',
    ]);
  });

  // Tab 6: สรุปผลงานช่างเทคนิค
  const techRows: (string | number)[][] = [
    [`สรุปผลงานช่างเทคนิค ประจำเดือน ${formatThaiMonthYear(year, month)}`],
    ['ชื่อช่างเทคนิค', 'ล้างแล้ว (เครื่อง)', 'แอร์ปกติ', 'VRF / VRV', 'ไม่ได้เข้าล้าง', 'อาคารที่ปฏิบัติงาน'],
  ];
  for (const t of techStats) {
    techRows.push([
      t.technicianName,
      t.cleanedCount,
      t.normalCount,
      t.vrfCount,
      t.uncleanedCount,
      t.buildings.join(', '),
    ]);
  }

  return {
    สรุปประจำเดือน: monthlyRows,
    รายการไม่ได้ล้าง: uncleanedRows,
    ประวัติการล้างแอร์: logRows,
    สรุปแอร์ทุกชั้นทุกอาคาร: floorSummaryRows,
    ทะเบียนแอร์ทุกอาคาร: unitRows,
    สรุปผลงานช่างเทคนิค: techRows,
  };
}

async function sheetsFetch(url: string, accessToken: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Google Sheets API Error (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export async function createNewGoogleSpreadsheet(
  accessToken: string,
  title: string,
  payload: SheetsSyncPayload
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const created = await sheetsFetch('https://sheets.googleapis.com/v4/spreadsheets', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title },
      sheets: SHEET_TABS.map((t) => ({ properties: { title: t } })),
    }),
  });

  const spreadsheetId = created.spreadsheetId as string;
  await updateSpreadsheetTabs(accessToken, spreadsheetId, payload);
  return {
    spreadsheetId,
    spreadsheetUrl: created.spreadsheetUrl as string,
  };
}

export async function syncToGoogleSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  payload: SheetsSyncPayload
): Promise<{ spreadsheetUrl: string }> {
  const meta = await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetUrl,sheets.properties.title`,
    accessToken
  );

  const existingTitles = new Set<string>(
    (meta.sheets || []).map((s: { properties?: { title?: string } }) => s.properties?.title || '')
  );

  const missingTabs = SHEET_TABS.filter((tab) => !existingTitles.has(tab));
  if (missingTabs.length > 0) {
    await sheetsFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: missingTabs.map((title) => ({
            addSheet: { properties: { title } },
          })),
        }),
      }
    );
  }

  await updateSpreadsheetTabs(accessToken, spreadsheetId, payload);
  return {
    spreadsheetUrl:
      (meta.spreadsheetUrl as string) ||
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

async function updateSpreadsheetTabs(
  accessToken: string,
  spreadsheetId: string,
  payload: SheetsSyncPayload
): Promise<void> {
  const valuesMap = buildSheetValues(payload);
  const ranges = SHEET_TABS.map((t) => `'${t}'!A:Z`);

  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchClear`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ ranges }),
    }
  );

  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: SHEET_TABS.map((tab) => ({
          range: `'${tab}'!A1`,
          values: valuesMap[tab],
        })),
      }),
    }
  );
}
