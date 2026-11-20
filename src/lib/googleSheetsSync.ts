import type { ACUnit, CleaningLog, CompanySettings } from '../types';
import { CLEANING_STATUS_LABELS } from '../types';
import {
  computeBuildingFloorInventory,
  computeContractCounts,
  computeMonthlyCleaningMatrix,
  computeTechnicianStats,
  computeUncleanedSummary,
  formatReportBuildingName,
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

type SheetTabName = (typeof SHEET_TABS)[number];

export type SyncScope = 'all' | 'logs' | 'units' | 'company';

export interface SheetsSyncPayload {
  company: CompanySettings;
  units: ACUnit[];
  logs: CleaningLog[];
  year: number;
  month: number;
  changedScope?: SyncScope;
}

export interface SheetsSyncSummary {
  updatedTabs: string[];
  skippedTabs: string[];
  updatedRows: number;
  appendedRows: number;
  spreadsheetUrl?: string;
}

function sortUnitsByBuilding(units: ACUnit[]): ACUnit[] {
  return [...units].sort((a, b) => {
    const bA = formatReportBuildingName(a.building);
    const bB = formatReportBuildingName(b.building);
    const bCmp = bA.localeCompare(bB, 'th');
    if (bCmp !== 0) return bCmp;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const fCmp = a.floor.localeCompare(b.floor, 'th', { numeric: true });
    if (fCmp !== 0) return fCmp;
    const rCmp = a.room.localeCompare(b.room, 'th', { numeric: true });
    if (rCmp !== 0) return rCmp;
    return a.unitCode.localeCompare(b.unitCode, 'th', { numeric: true });
  });
}

function sortLogsByBuilding(logs: CleaningLog[]): CleaningLog[] {
  return [...logs].sort((a, b) => {
    const bA = formatReportBuildingName(a.building);
    const bB = formatReportBuildingName(b.building);
    const bCmp = bA.localeCompare(bB, 'th');
    if (bCmp !== 0) return bCmp;
    const fCmp = a.floor.localeCompare(b.floor, 'th', { numeric: true });
    if (fCmp !== 0) return fCmp;
    const dCmp = a.date.localeCompare(b.date);
    if (dCmp !== 0) return dCmp;
    return a.unitCode.localeCompare(b.unitCode, 'th', { numeric: true });
  });
}

function unitToRow(indexNumber: number, u: ACUnit): (string | number)[] {
  return [
    indexNumber,
    u.building,
    u.floor,
    u.room,
    u.unitCode,
    u.acType === 'vrf' ? 'VRF / VRV' : 'แอร์ปกติ',
    u.btu || '-',
    u.brand || '-',
    u.status === 'cancelled' ? 'ยกเลิก' : 'ใช้งาน',
    u.notes || '',
  ];
}

function logToRow(l: CleaningLog): (string | number)[] {
  return [
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
    l.id,
  ];
}

const LOG_HEADER: (string | number)[] = [
  'วันที่',
  'อาคาร',
  'ชั้น',
  'ห้อง',
  'หมายเลขเครื่อง',
  'ประเภทแอร์',
  'สถานะ',
  'ช่างผู้ปฏิบัติงาน',
  'หมายเหตุ',
  'บันทึกเมื่อ',
  'รหัสอ้างอิง',
];

const UNIT_HEADER: (string | number)[] = [
  'ลำดับ',
  'อาคาร',
  'ชั้น',
  'ห้อง',
  'หมายเลขเครื่อง',
  'ประเภทแอร์',
  'ขนาด BTU',
  'ยี่ห้อ',
  'สถานะ',
  'หมายเหตุ',
];

function buildSheetValues(payload: SheetsSyncPayload): Record<SheetTabName, (string | number)[][]> {
  const { company, units, logs, year, month } = payload;
  const sortedUnits = sortUnitsByBuilding(units);
  const sortedLogs = sortLogsByBuilding(logs);
  const contract = computeContractCounts(sortedUnits);
  const matrix = computeMonthlyCleaningMatrix(sortedLogs, sortedUnits, year, month);
  const uncleaned = computeUncleanedSummary(sortedLogs, sortedUnits, year, month);
  const floorInv = computeBuildingFloorInventory(sortedUnits);
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const monthLogs = sortedLogs.filter((l) => l.date.startsWith(monthPrefix));
  const techStats = computeTechnicianStats(monthLogs, sortedUnits);

  // Tab 1: สรุปประจำเดือน
  const monthlyRows: (string | number)[][] = [
    [`รายงานสรุปผลการปรนนิบัติบำรุงรักษาเครื่องปรับอากาศ ประจำเดือน ${formatThaiMonthYear(year, month)}`],
    [`${company.name} | ${company.address} | เลขผู้เสียภาษี ${company.taxId} | โทร ${company.phone}`],
    [
      `เครื่องปรับอากาศในสัญญา (ไม่รวมยกเลิก): รวม ${contract.totalActive} เครื่อง`,
      `แอร์ปกติ: ${contract.normalActive} เครื่อง`,
      `VRF / VRV: ${contract.vrfActive} เครื่อง`,
      `ยกเลิก(ไม่นับรวม): ${contract.cancelledCount} เครื่อง`,
    ],
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

  // Tab 3: ประวัติการล้างแอร์ (sorted by building)
  const logRows: (string | number)[][] = [LOG_HEADER, ...sortedLogs.map(logToRow)];

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

  // Tab 5: ทะเบียนแอร์ทุกอาคาร (sorted by building)
  const unitRows: (string | number)[][] = [
    UNIT_HEADER,
    ...sortedUnits.map((u, idx) => unitToRow(idx + 1, u)),
  ];

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

function getCandidateTabs(scope: SyncScope = 'all'): SheetTabName[] {
  if (scope === 'logs') {
    return ['สรุปประจำเดือน', 'รายการไม่ได้ล้าง', 'ประวัติการล้างแอร์', 'สรุปผลงานช่างเทคนิค'];
  }
  if (scope === 'units') {
    return ['สรุปประจำเดือน', 'รายการไม่ได้ล้าง', 'สรุปแอร์ทุกชั้นทุกอาคาร', 'ทะเบียนแอร์ทุกอาคาร'];
  }
  if (scope === 'company') {
    return ['สรุปประจำเดือน'];
  }
  return [...SHEET_TABS];
}

function normCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function rowsEqual(a: unknown[], b: unknown[], colCount?: number): boolean {
  const len = colCount ?? Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (normCell(a[i]) !== normCell(b[i])) return false;
  }
  return true;
}

function gridsEqual(existing: unknown[][], next: (string | number)[][]): boolean {
  if (existing.length !== next.length) return false;
  for (let r = 0; r < next.length; r++) {
    if (!rowsEqual(existing[r] || [], next[r])) return false;
  }
  return true;
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
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; summary: SheetsSyncSummary }> {
  const created = await sheetsFetch('https://sheets.googleapis.com/v4/spreadsheets', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title },
      sheets: SHEET_TABS.map((t) => ({ properties: { title: t } })),
    }),
  });

  const spreadsheetId = created.spreadsheetId as string;
  const valuesMap = buildSheetValues(payload);

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

  return {
    spreadsheetId,
    spreadsheetUrl: created.spreadsheetUrl as string,
    summary: {
      updatedTabs: [...SHEET_TABS],
      skippedTabs: [],
      updatedRows: 0,
      appendedRows: payload.units.length + payload.logs.length,
      spreadsheetUrl: created.spreadsheetUrl as string,
    },
  };
}

export async function syncToGoogleSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  payload: SheetsSyncPayload
): Promise<SheetsSyncSummary> {
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

  const candidateTabs = getCandidateTabs(payload.changedScope);
  const rangesQuery = candidateTabs
    .map((t) => `ranges=${encodeURIComponent(`'${t}'!A:K`)}`)
    .join('&');

  const existingBatch = await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet?${rangesQuery}`,
    accessToken
  );

  const existingByTab = new Map<SheetTabName, string[][]>();
  candidateTabs.forEach((tab, idx) => {
    const vr = existingBatch.valueRanges?.[idx];
    existingByTab.set(tab, (vr?.values as string[][] | undefined) || []);
  });

  const valuesMap = buildSheetValues(payload);
  const clearRanges: string[] = [];
  const updateData: Array<{ range: string; values: (string | number)[][] }> = [];
  const updatedTabsSet = new Set<string>();
  const skippedTabs: string[] = [];
  let updatedRows = 0;
  let appendedRows = 0;

  for (const tab of candidateTabs) {
    const existingRows = existingByTab.get(tab) || [];

    // 1. Incremental sync for ทะเบียนแอร์ทุกอาคาร: update edited rows in place, append new units sorted by building
    if (tab === 'ทะเบียนแอร์ทุกอาคาร') {
      const sortedUnits = sortUnitsByBuilding(payload.units);
      if (existingRows.length <= 1) {
        clearRanges.push(`'${tab}'!A:K`);
        updateData.push({ range: `'${tab}'!A1`, values: valuesMap[tab] });
        updatedTabsSet.add(tab);
        appendedRows += sortedUnits.length;
        continue;
      }

      const unitMap = new Map<string, ACUnit>();
      for (const u of sortedUnits) {
        unitMap.set(`${normCell(u.building)}::${normCell(u.unitCode).toLowerCase()}`, u);
        unitMap.set(`${formatReportBuildingName(u.building)}::${normCell(u.unitCode).toLowerCase()}`, u);
      }

      const seenUnitIds = new Set<string>();
      let maxIndex = 0;
      let tabChanged = false;

      for (let i = 1; i < existingRows.length; i++) {
        const row = existingRows[i] || [];
        const rowNum = i + 1;
        const rowSeq = Number(row[0]) || i;
        if (rowSeq > maxIndex) maxIndex = rowSeq;
        const key = `${normCell(row[1])}::${normCell(row[4]).toLowerCase()}`;
        const matched = unitMap.get(key);
        if (matched) {
          seenUnitIds.add(matched.id);
          const desired = unitToRow(rowSeq, matched);
          if (!rowsEqual(row, desired, desired.length)) {
            updateData.push({ range: `'${tab}'!A${rowNum}:J${rowNum}`, values: [desired] });
            updatedRows++;
            tabChanged = true;
          }
        }
      }

      const newUnits = sortedUnits.filter((u) => !seenUnitIds.has(u.id));
      if (newUnits.length > 0) {
        const startRow = existingRows.length + 1;
        const appendValues = newUnits.map((u, idx) => unitToRow(maxIndex + idx + 1, u));
        updateData.push({ range: `'${tab}'!A${startRow}`, values: appendValues });
        appendedRows += newUnits.length;
        tabChanged = true;
      }

      if (tabChanged) updatedTabsSet.add(tab);
      else skippedTabs.push(tab);
      continue;
    }

    // 2. Incremental sync for ประวัติการล้างแอร์: update edited rows in place, append new logs sorted by building
    if (tab === 'ประวัติการล้างแอร์') {
      const sortedLogs = sortLogsByBuilding(payload.logs);
      if (existingRows.length <= 1) {
        clearRanges.push(`'${tab}'!A:K`);
        updateData.push({ range: `'${tab}'!A1`, values: valuesMap[tab] });
        updatedTabsSet.add(tab);
        appendedRows += sortedLogs.length;
        continue;
      }

      const logById = new Map<string, CleaningLog>();
      const logByComposite = new Map<string, CleaningLog>();
      for (const l of sortedLogs) {
        logById.set(l.id, l);
        const compKey = `${normCell(l.date)}::${normCell(l.building)}::${normCell(l.unitCode).toLowerCase()}::${normCell(l.createdAt)}`;
        logByComposite.set(compKey, l);
        const shortKey = `${normCell(l.date)}::${normCell(l.building)}::${normCell(l.unitCode).toLowerCase()}`;
        if (!logByComposite.has(shortKey)) {
          logByComposite.set(shortKey, l);
        }
      }

      const seenLogIds = new Set<string>();
      let tabChanged = false;

      if (!rowsEqual(existingRows[0] || [], LOG_HEADER, LOG_HEADER.length)) {
        updateData.push({ range: `'${tab}'!A1:K1`, values: [LOG_HEADER] });
        tabChanged = true;
      }

      for (let i = 1; i < existingRows.length; i++) {
        const row = existingRows[i] || [];
        const rowNum = i + 1;
        const refId = normCell(row[10]);
        let matched = refId ? logById.get(refId) : undefined;
        if (!matched) {
          const compKey = `${normCell(row[0])}::${normCell(row[1])}::${normCell(row[4]).toLowerCase()}::${normCell(row[9])}`;
          matched = logByComposite.get(compKey);
        }
        if (!matched) {
          const shortKey = `${normCell(row[0])}::${normCell(row[1])}::${normCell(row[4]).toLowerCase()}`;
          const candidate = logByComposite.get(shortKey);
          if (candidate && !seenLogIds.has(candidate.id)) {
            matched = candidate;
          }
        }

        if (matched) {
          seenLogIds.add(matched.id);
          const desired = logToRow(matched);
          if (!rowsEqual(row, desired, desired.length)) {
            updateData.push({ range: `'${tab}'!A${rowNum}:K${rowNum}`, values: [desired] });
            updatedRows++;
            tabChanged = true;
          }
        }
      }

      const newLogs = sortedLogs.filter((l) => !seenLogIds.has(l.id));
      if (newLogs.length > 0) {
        const startRow = existingRows.length + 1;
        updateData.push({
          range: `'${tab}'!A${startRow}`,
          values: newLogs.map(logToRow),
        });
        appendedRows += newLogs.length;
        tabChanged = true;
      }

      if (tabChanged) updatedTabsSet.add(tab);
      else skippedTabs.push(tab);
      continue;
    }

    // 3. Summary tabs: only clear & rewrite if cell grid actually changed
    const nextGrid = valuesMap[tab];
    if (gridsEqual(existingRows, nextGrid)) {
      skippedTabs.push(tab);
      continue;
    }

    clearRanges.push(`'${tab}'!A:Z`);
    updateData.push({ range: `'${tab}'!A1`, values: nextGrid });
    updatedTabsSet.add(tab);
  }

  if (clearRanges.length > 0) {
    await sheetsFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchClear`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ ranges: clearRanges }),
      }
    );
  }

  if (updateData.length > 0) {
    await sheetsFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: updateData,
        }),
      }
    );
  }

  return {
    updatedTabs: Array.from(updatedTabsSet),
    skippedTabs,
    updatedRows,
    appendedRows,
    spreadsheetUrl:
      (meta.spreadsheetUrl as string) ||
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

export async function syncViaAppsScript(
  appsScriptUrl: string,
  payload: SheetsSyncPayload
): Promise<SheetsSyncSummary> {
  const url = appsScriptUrl.trim();
  if (!url.startsWith('https://script.google.com/')) {
    throw new Error('URL ของ Google Apps Script ต้องขึ้นต้นด้วย https://script.google.com/');
  }

  const valuesMap = buildSheetValues(payload);
  const candidateTabs = getCandidateTabs(payload.changedScope);
  const sortedUnits = sortUnitsByBuilding(payload.units);
  const sortedLogs = sortLogsByBuilding(payload.logs);

  const bodyPayload = {
    action: 'sync',
    spreadsheetId: payload.company.googleSheetId || '',
    changedScope: payload.changedScope || 'all',
    candidateTabs,
    summaryTabs: {
      สรุปประจำเดือน: valuesMap['สรุปประจำเดือน'],
      รายการไม่ได้ล้าง: valuesMap['รายการไม่ได้ล้าง'],
      สรุปแอร์ทุกชั้นทุกอาคาร: valuesMap['สรุปแอร์ทุกชั้นทุกอาคาร'],
      สรุปผลงานช่างเทคนิค: valuesMap['สรุปผลงานช่างเทคนิค'],
    },
    unitsHeader: UNIT_HEADER,
    units: sortedUnits.map((u, idx) => ({
      id: u.id,
      building: u.building,
      unitCode: u.unitCode,
      row: unitToRow(idx + 1, u),
    })),
    logsHeader: LOG_HEADER,
    logs: sortedLogs.map((l) => ({
      id: l.id,
      date: l.date,
      building: l.building,
      unitCode: l.unitCode,
      createdAt: l.createdAt,
      row: logToRow(l),
    })),
  };

  // Use text/plain to avoid CORS preflight rejection by Google Apps Script Web App
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    redirect: 'follow',
    body: JSON.stringify(bodyPayload),
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Google Apps Script ตอบกลับไม่ถูกต้อง (HTTP ${res.status}) — กรุณาตรวจสอบว่า Deploy Web App เป็น "Who has access: Anyone" แล้ว`
    );
  }

  if (!res.ok || data.error) {
    throw new Error(String(data.error || `Google Apps Script Error (${res.status})`));
  }

  return {
    updatedTabs: Array.isArray(data.updatedTabs) ? (data.updatedTabs as string[]) : [],
    skippedTabs: Array.isArray(data.skippedTabs) ? (data.skippedTabs as string[]) : [],
    updatedRows: Number(data.updatedRows || 0),
    appendedRows: Number(data.appendedRows || 0),
    spreadsheetUrl: typeof data.spreadsheetUrl === 'string' ? data.spreadsheetUrl : undefined,
  };
}

export function getAppsScriptTemplate(): string {
  return `function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = payload.spreadsheetId
      ? SpreadsheetApp.openById(payload.spreadsheetId)
      : SpreadsheetApp.getActiveSpreadsheet();

    var updatedTabs = [];
    var skippedTabs = [];
    var updatedRows = 0;
    var appendedRows = 0;
    var candidateSet = {};
    (payload.candidateTabs || []).forEach(function (t) { candidateSet[t] = true; });

    function norm(v) {
      return v === null || v === undefined ? '' : String(v).trim();
    }
    function rowsEqual(a, b, len) {
      for (var i = 0; i < len; i++) {
        if (norm(a[i]) !== norm(b[i])) return false;
      }
      return true;
    }
    function getOrCreateSheet(name) {
      var sh = ss.getSheetByName(name);
      if (!sh) sh = ss.insertSheet(name);
      return sh;
    }

    // 1. Summary tabs: update only if changed
    var summaryTabs = payload.summaryTabs || {};
    Object.keys(summaryTabs).forEach(function (tabName) {
      if (!candidateSet[tabName]) return;
      var nextRows = summaryTabs[tabName] || [];
      var sh = getOrCreateSheet(tabName);
      var lastRow = sh.getLastRow();
      var lastCol = sh.getLastColumn();
      var existing = lastRow > 0 && lastCol > 0 ? sh.getRange(1, 1, lastRow, lastCol).getValues() : [];

      var same = existing.length === nextRows.length;
      if (same) {
        for (var r = 0; r < nextRows.length; r++) {
          if (!rowsEqual(existing[r] || [], nextRows[r], nextRows[r].length)) {
            same = false;
            break;
          }
        }
      }
      if (same) {
        skippedTabs.push(tabName);
        return;
      }
      sh.clearContents();
      if (nextRows.length > 0) {
        var cols = Math.max.apply(null, nextRows.map(function (r) { return r.length; }));
        var padded = nextRows.map(function (r) {
          var copy = r.slice();
          while (copy.length < cols) copy.push('');
          return copy;
        });
        sh.getRange(1, 1, padded.length, cols).setValues(padded);
      }
      updatedTabs.push(tabName);
    });

    // 2. ทะเบียนแอร์ทุกอาคาร: update edited rows in place, append new sorted by building
    if (candidateSet['ทะเบียนแอร์ทุกอาคาร']) {
      var unitSheet = getOrCreateSheet('ทะเบียนแอร์ทุกอาคาร');
      var uLastRow = unitSheet.getLastRow();
      var units = payload.units || [];
      if (uLastRow <= 1) {
        unitSheet.clearContents();
        var allUnitRows = [payload.unitsHeader].concat(units.map(function (u) { return u.row; }));
        unitSheet.getRange(1, 1, allUnitRows.length, payload.unitsHeader.length).setValues(allUnitRows);
        updatedTabs.push('ทะเบียนแอร์ทุกอาคาร');
        appendedRows += units.length;
      } else {
        var existingUnits = unitSheet.getRange(1, 1, uLastRow, payload.unitsHeader.length).getValues();
        var uMap = {};
        units.forEach(function (u) {
          uMap[norm(u.building) + '::' + norm(u.unitCode).toLowerCase()] = u;
        });
        var seenU = {};
        var maxIdx = 0;
        var uChanged = false;
        for (var i = 1; i < existingUnits.length; i++) {
          var row = existingUnits[i];
          var seq = Number(row[0]) || i;
          if (seq > maxIdx) maxIdx = seq;
          var key = norm(row[1]) + '::' + norm(row[4]).toLowerCase();
          var matched = uMap[key];
          if (matched) {
            seenU[matched.id] = true;
            var desired = matched.row.slice();
            desired[0] = seq;
            if (!rowsEqual(row, desired, desired.length)) {
              unitSheet.getRange(i + 1, 1, 1, desired.length).setValues([desired]);
              updatedRows++;
              uChanged = true;
            }
          }
        }
        var newUnits = units.filter(function (u) { return !seenU[u.id]; });
        if (newUnits.length > 0) {
          var appendU = newUnits.map(function (u, idx) {
            var r = u.row.slice();
            r[0] = maxIdx + idx + 1;
            return r;
          });
          unitSheet.getRange(uLastRow + 1, 1, appendU.length, payload.unitsHeader.length).setValues(appendU);
          appendedRows += appendU.length;
          uChanged = true;
        }
        if (uChanged) updatedTabs.push('ทะเบียนแอร์ทุกอาคาร');
        else skippedTabs.push('ทะเบียนแอร์ทุกอาคาร');
      }
    }

    // 3. ประวัติการล้างแอร์: update edited rows in place, append new sorted by building
    if (candidateSet['ประวัติการล้างแอร์']) {
      var logSheet = getOrCreateSheet('ประวัติการล้างแอร์');
      var lLastRow = logSheet.getLastRow();
      var logs = payload.logs || [];
      if (lLastRow <= 1) {
        logSheet.clearContents();
        var allLogRows = [payload.logsHeader].concat(logs.map(function (l) { return l.row; }));
        logSheet.getRange(1, 1, allLogRows.length, payload.logsHeader.length).setValues(allLogRows);
        updatedTabs.push('ประวัติการล้างแอร์');
        appendedRows += logs.length;
      } else {
        var lCols = payload.logsHeader.length;
        var existingLogs = logSheet.getRange(1, 1, lLastRow, lCols).getValues();
        var byId = {};
        var byComp = {};
        logs.forEach(function (l) {
          byId[l.id] = l;
          byComp[norm(l.date) + '::' + norm(l.building) + '::' + norm(l.unitCode).toLowerCase() + '::' + norm(l.createdAt)] = l;
        });
        var seenL = {};
        var lChanged = false;
        if (!rowsEqual(existingLogs[0], payload.logsHeader, lCols)) {
          logSheet.getRange(1, 1, 1, lCols).setValues([payload.logsHeader]);
          lChanged = true;
        }
        for (var j = 1; j < existingLogs.length; j++) {
          var lRow = existingLogs[j];
          var refId = norm(lRow[10]);
          var matchedLog = refId ? byId[refId] : null;
          if (!matchedLog) {
            matchedLog = byComp[norm(lRow[0]) + '::' + norm(lRow[1]) + '::' + norm(lRow[4]).toLowerCase() + '::' + norm(lRow[9])];
          }
          if (matchedLog) {
            seenL[matchedLog.id] = true;
            if (!rowsEqual(lRow, matchedLog.row, lCols)) {
              logSheet.getRange(j + 1, 1, 1, lCols).setValues([matchedLog.row]);
              updatedRows++;
              lChanged = true;
            }
          }
        }
        var newLogs = logs.filter(function (l) { return !seenL[l.id]; });
        if (newLogs.length > 0) {
          var appendL = newLogs.map(function (l) { return l.row; });
          logSheet.getRange(lLastRow + 1, 1, appendL.length, lCols).setValues(appendL);
          appendedRows += appendL.length;
          lChanged = true;
        }
        if (lChanged) updatedTabs.push('ประวัติการล้างแอร์');
        else skippedTabs.push('ประวัติการล้างแอร์');
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      updatedTabs: updatedTabs,
      skippedTabs: skippedTabs,
      updatedRows: updatedRows,
      appendedRows: appendedRows,
      spreadsheetUrl: ss.getUrl()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: err.message || String(err)
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;
}
