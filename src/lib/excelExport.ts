import * as XLSX from 'xlsx';
import type { ACUnit, CleaningLog, CompanySettings } from '../types';
import { CLEANING_STATUS_LABELS } from '../types';
import {
  computeBuildingFloorInventory,
  computeContractCounts,
  computeMajorCycleSummary,
  computeMonthlyCleaningMatrix,
  computeTechnicianStats,
  computeUncleanedSummary,
  formatReportBuildingName,
  formatReportNotes,
  formatReportTechnicianName,
  getCleaningCycleTypeLabel,
  getMajorCleaningCycle,
} from './reportCalc';
import { formatThaiDate, formatThaiMonthYear } from './thaiDate';

export interface ExportAllReportsParams {
  company: CompanySettings;
  units: ACUnit[];
  logs: CleaningLog[];
  year: number;
  month: number;
  dailyDate: string;
  startDate: string;
  endDate: string;
  combineMajorCycle?: boolean;
}

export function exportAllReportsToSingleExcel(params: ExportAllReportsParams): void {
  const {
    company,
    units,
    logs,
    year,
    month,
    dailyDate,
    startDate,
    endDate,
    combineMajorCycle = false,
  } = params;
  const wb = XLSX.utils.book_new();

  const contract = computeContractCounts(units);
  const matrix = computeMonthlyCleaningMatrix(logs, units, year, month);
  const uncleaned = computeUncleanedSummary(logs, units, year, month);
  const floorInv = computeBuildingFloorInventory(units);
  const cycleTypeLabel = getCleaningCycleTypeLabel(month);
  const majorCycle = getMajorCleaningCycle(month);
  const majorSummary =
    combineMajorCycle && majorCycle
      ? computeMajorCycleSummary(logs, units, year, majorCycle.months)
      : null;

  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const rangeLogs = logs.filter((l) => {
    if (startDate && l.date < startDate) return false;
    if (endDate && l.date > endDate) return false;
    return true;
  });
  const dailyLogs = logs.filter((l) => l.date === dailyDate);
  const techStats = computeTechnicianStats(
    rangeLogs.length > 0 ? rangeLogs : logs.filter((l) => l.date.startsWith(monthPrefix)),
    units
  );

  const applyExcelPageSetup = (ws: XLSX.WorkSheet, colWidths: number[]) => {
    ws['!margins'] = {
      left: 0.4,
      right: 0.4,
      top: 0.4,
      bottom: 0.4,
      header: 0.3,
      footer: 0.3,
    };
    ws['!cols'] = colWidths.map((wch) => ({ wch }));
  };

  if (majorSummary && majorCycle) {
    const sMajorData: (string | number)[][] = [
      [`สรุปรอบการล้างใหญ่ ประจำรอบ ${majorCycle.label} พ.ศ. ${year + 543} (การล้างใหญ่)`],
      [`${company.name} | ${company.address}`],
      [],
      ['ลำดับ', 'รายการสรุป', 'แอร์ปกติ (เครื่อง)', 'VRF / VRV (เครื่อง)', 'จำนวนรวม (เครื่อง)'],
      [
        1,
        `เดือน${majorSummary.month1.monthName} ${year + 543} (จำนวนที่ล้างได้)`,
        majorSummary.month1.normalCount,
        majorSummary.month1.vrfCount,
        majorSummary.month1.cleanedCount,
      ],
      [
        2,
        `เดือน${majorSummary.month2.monthName} ${year + 543} (จำนวนที่ล้างได้)`,
        majorSummary.month2.normalCount,
        majorSummary.month2.vrfCount,
        majorSummary.month2.cleanedCount,
      ],
      [
        '',
        'รวมจำนวนเครื่องที่เข้าล้างได้ทั้งหมด (รวม 2 เดือน)',
        majorSummary.totalNormalCleaned,
        majorSummary.totalVrfCleaned,
        majorSummary.totalCleaned,
      ],
      [
        '',
        `จำนวนเครื่องที่ไม่ได้เข้าล้าง (ตามรายการบันทึก: คนไข้ ${majorSummary.uncleanedSummary.patientOccupied.count}, ปิดปรับปรุง ${majorSummary.uncleanedSummary.renovation.count}, ไม่มีการ์ด ${majorSummary.uncleanedSummary.noCard.count})`,
        '',
        '',
        majorSummary.uncleanedSummary.totalUncleaned,
      ],
      [
        '',
        `คงเหลือไม่ได้ล้างเทียบยอดในสัญญาทั้งหมด (${majorSummary.totalActiveUnits} เครื่อง)`,
        '',
        '',
        majorSummary.contractRemainingUncleaned,
      ],
    ];
    const wsMajor = XLSX.utils.aoa_to_sheet(sMajorData);
    applyExcelPageSetup(wsMajor, [8, 48, 18, 18, 20]);
    XLSX.utils.book_append_sheet(wb, wsMajor, 'สรุปล้างใหญ่_รวม2เดือน');
  }

  // Sheet 1: สรุปรายเดือน_รายอาคาร
  const s1Data: (string | number)[][] = [
    [
      `รายงานสรุปผลการปรนนิบัติบำรุงรักษาเครื่องปรับอากาศ ประจำเดือน ${formatThaiMonthYear(
        year,
        month
      )} (${cycleTypeLabel})`,
    ],
    [`${company.name} | ${company.address}`],
    [`เลขผู้เสียภาษี: ${company.taxId} | โทร: ${company.phone}`],
    [
      `แอร์ทั้งหมดในสัญญา (ไม่รวมยกเลิก): ${contract.totalActive} เครื่อง`,
      `แอร์ปกติ: ${contract.normalActive} เครื่อง`,
      `VRF / VRV: ${contract.vrfActive} เครื่อง`,
      `เครื่องที่ไม่ได้เข้าล้าง: ${uncleaned.totalUncleaned} เครื่อง`,
    ],
    [],
    ['วันที่', 'วัน/เดือน/ปี', ...matrix.buildings.map(formatReportBuildingName), 'รวมรายวัน (เครื่อง)'],
  ];

  for (const row of matrix.rows) {
    s1Data.push([
      row.day,
      formatThaiDate(row.dateStr, true),
      ...matrix.buildings.map((b) => row.countsByBuilding[b] || 0),
      row.dayTotal,
    ]);
  }
  s1Data.push([
    'รวมทั้งเดือน',
    '',
    ...matrix.buildings.map((b) => matrix.totalsByBuilding[b] || 0),
    matrix.grandTotal,
  ]);
  const ws1 = XLSX.utils.aoa_to_sheet(s1Data);
  applyExcelPageSetup(ws1, [8, 14, ...matrix.buildings.map(() => 14), 16]);
  XLSX.utils.book_append_sheet(wb, ws1, 'สรุปรายเดือน_รายอาคาร');

  // Sheet 2: ภาพรวมและรายการไม่ได้ล้าง
  const s2Data: (string | number)[][] = [
    [
      `สรุปภาพรวมจำนวนเครื่องที่ไม่ได้เข้าล้าง ประจำเดือน ${formatThaiMonthYear(
        year,
        month
      )} (${cycleTypeLabel}) (ไม่รวมเครื่องที่ยกเลิก)`,
    ],
    ['สาเหตุที่ไม่ได้เข้าล้าง', 'จำนวน (เครื่อง)'],
    ['2.1 ห้องมีคนไข้', uncleaned.patientOccupied.count],
    ['2.2 ปิดปรับปรุง', uncleaned.renovation.count],
    ['2.3 ไม่มีการ์ด', uncleaned.noCard.count],
    [`รวมจำนวนทั้งหมดที่ไม่ได้เข้าล้าง (ไม่รวมเครื่องที่ยกเลิก ${contract.cancelledCount} เครื่อง)`, uncleaned.totalUncleaned],
    [],
    ['บัญชีรายการเครื่องปรับอากาศที่ไม่ได้เข้าล้าง (เดือนที่เลือก)'],
    ['ลำดับ', 'วันที่', 'อาคาร', 'ชั้น', 'ห้อง', 'หมายเลขเครื่อง', 'ประเภทแอร์', 'สาเหตุ', 'หมายเหตุ', 'ผู้บันทึก'],
  ];
  uncleaned.allItems.forEach((item, idx) => {
    s2Data.push([
      idx + 1,
      formatThaiDate(item.date, true),
      formatReportBuildingName(item.building),
      item.floor,
      item.room,
      item.unitCode,
      item.acType === 'vrf' ? 'VRF / VRV' : 'แอร์ปกติ',
      CLEANING_STATUS_LABELS[item.status],
      formatReportNotes(item.notes) || '-',
      formatReportTechnicianName(item.technicianId, item.technicianName),
    ]);
  });
  const ws2 = XLSX.utils.aoa_to_sheet(s2Data);
  applyExcelPageSetup(ws2, [8, 14, 22, 8, 24, 15, 13, 22, 20, 18]);
  XLSX.utils.book_append_sheet(wb, ws2, 'ภาพรวมและไม่ได้ล้าง');

  // Sheet 3: บัญชีรายการเข้าล้างแล้วรายเดือน
  const cancelledIds = new Set(units.filter((u) => u.status === 'cancelled').map((u) => u.id));
  const monthlyCleanedLogs = logs
    .filter((l) => l.date.startsWith(monthPrefix) && l.status === 'cleaned' && !cancelledIds.has(l.unitId))
    .sort((a, b) => {
      const dCmp = a.date.localeCompare(b.date);
      if (dCmp !== 0) return dCmp;
      const bCmp = a.building.localeCompare(b.building, 'th');
      if (bCmp !== 0) return bCmp;
      return a.unitCode.localeCompare(b.unitCode, 'th', { numeric: true });
    });
  const sMonthlyCleaned: (string | number)[][] = [
    [
      `บัญชีรายการเครื่องปรับอากาศที่เข้าล้างแล้ว ประจำเดือน ${formatThaiMonthYear(
        year,
        month
      )} (${cycleTypeLabel})`,
    ],
    [`${company.name} | โทร ${company.phone}`],
    [],
    ['ลำดับ', 'วันที่', 'อาคาร', 'ชั้น', 'ห้อง', 'หมายเลขเครื่อง', 'ประเภทแอร์', 'ช่างผู้ล้าง', 'หมายเหตุ'],
  ];
  monthlyCleanedLogs.forEach((item, idx) => {
    sMonthlyCleaned.push([
      idx + 1,
      formatThaiDate(item.date, true),
      formatReportBuildingName(item.building),
      item.floor,
      item.room,
      item.unitCode,
      item.acType === 'vrf' ? 'VRF / VRV' : 'แอร์ปกติ',
      formatReportTechnicianName(item.technicianId, item.technicianName),
      formatReportNotes(item.notes) || '-',
    ]);
  });
  const wsMonthlyCleaned = XLSX.utils.aoa_to_sheet(sMonthlyCleaned);
  applyExcelPageSetup(wsMonthlyCleaned, [8, 14, 22, 8, 24, 15, 13, 20, 20]);
  XLSX.utils.book_append_sheet(wb, wsMonthlyCleaned, 'รายการเข้าล้างแล้วรายเดือน');

  // Sheet 4: รายการเข้าล้างรายวัน
  const s3Data: (string | number)[][] = [
    [`บัญชีรายการเครื่องปรับอากาศที่เข้าล้าง (รายวัน) วันที่ ${formatThaiDate(dailyDate)}`],
    [`${company.name} | โทร ${company.phone}`],
    [],
    ['ลำดับ', 'วันที่', 'อาคาร', 'ชั้น', 'ห้อง', 'หมายเลขเครื่อง', 'ประเภทแอร์', 'สถานะ', 'ช่างผู้ปฏิบัติงาน', 'หมายเหตุ'],
  ];
  dailyLogs.forEach((item, idx) => {
    s3Data.push([
      idx + 1,
      formatThaiDate(item.date, true),
      formatReportBuildingName(item.building),
      item.floor,
      item.room,
      item.unitCode,
      item.acType === 'vrf' ? 'VRF / VRV' : 'แอร์ปกติ',
      CLEANING_STATUS_LABELS[item.status],
      formatReportTechnicianName(item.technicianId, item.technicianName),
      formatReportNotes(item.notes) || '-',
    ]);
  });
  const ws3 = XLSX.utils.aoa_to_sheet(s3Data);
  applyExcelPageSetup(ws3, [8, 14, 22, 8, 24, 15, 13, 20, 18, 20]);
  XLSX.utils.book_append_sheet(wb, ws3, 'รายการเข้าล้างรายวัน');

  // Sheet 5: ประวัติการล้างทั้งหมด (ตามช่วงวันที่)
  const s4Data: (string | number)[][] = [
    [`ประวัติการล้างเครื่องปรับอากาศ (${startDate ? formatThaiDate(startDate, true) : 'ทั้งหมด'} - ${endDate ? formatThaiDate(endDate, true) : 'ปัจจุบัน'})`],
    [],
    ['ลำดับ', 'วันที่', 'อาคาร', 'ชั้น', 'ห้อง', 'หมายเลขเครื่อง', 'ประเภทแอร์', 'สถานะ', 'ช่างผู้ปฏิบัติงาน', 'หมายเหตุ'],
  ];
  rangeLogs.forEach((item, idx) => {
    s4Data.push([
      idx + 1,
      item.date,
      formatReportBuildingName(item.building),
      item.floor,
      item.room,
      item.unitCode,
      item.acType === 'vrf' ? 'VRF / VRV' : 'แอร์ปกติ',
      CLEANING_STATUS_LABELS[item.status],
      formatReportTechnicianName(item.technicianId, item.technicianName),
      formatReportNotes(item.notes) || '',
    ]);
  });
  const ws4 = XLSX.utils.aoa_to_sheet(s4Data);
  applyExcelPageSetup(ws4, [8, 14, 22, 8, 24, 15, 13, 20, 18, 20]);
  XLSX.utils.book_append_sheet(wb, ws4, 'ประวัติการล้างทั้งหมด');

  // Sheet 5: สรุปแอร์ทุกชั้นทุกอาคาร
  const s5Data: (string | number)[][] = [
    ['รายงานสรุปจำนวนเครื่องปรับอากาศทุกชั้นทุกอาคาร (ไม่นับรวมเครื่องที่ยกเลิก)'],
    [],
    ['อาคาร', 'ชั้น', 'แอร์ปกติ (เครื่อง)', 'VRF / VRV (เครื่อง)', 'รวมใช้งาน (เครื่อง)', 'ยกเลิก (ไม่นับรวม)'],
  ];
  for (const b of floorInv.buildings) {
    for (const f of b.floors) {
      s5Data.push([
        formatReportBuildingName(f.building),
        f.floor,
        f.normalActive,
        f.vrfActive,
        f.totalActive,
        f.cancelledCount,
      ]);
    }
    s5Data.push([
      `รวม ${formatReportBuildingName(b.building)}`,
      'ทุกชั้น',
      b.normalActive,
      b.vrfActive,
      b.totalActive,
      b.cancelledCount,
    ]);
  }
  s5Data.push([
    'รวมทั้งหมดทุกอาคาร',
    `${floorInv.grandTotal.floorCount} ชั้น`,
    floorInv.grandTotal.normalActive,
    floorInv.grandTotal.vrfActive,
    floorInv.grandTotal.totalActive,
    floorInv.grandTotal.cancelledCount,
  ]);
  const ws5 = XLSX.utils.aoa_to_sheet(s5Data);
  applyExcelPageSetup(ws5, [28, 12, 16, 16, 16, 16]);
  XLSX.utils.book_append_sheet(wb, ws5, 'สรุปแอร์ทุกชั้นทุกอาคาร');

  // Sheet 6: ทะเบียนเครื่องปรับอากาศ
  const s6Data: (string | number)[][] = [
    [
      'ลำดับ',
      'อาคาร',
      'ชั้น',
      'ห้อง',
      'หมายเลขเครื่อง',
      'ประเภทแอร์',
      'รุ่น (Model)',
      'BTU',
      'ยี่ห้อ',
      'ลักษณะการติดตั้ง',
      'สถานะ',
      'หมายเหตุ',
    ],
  ];
  units.forEach((u, idx) => {
    s6Data.push([
      idx + 1,
      u.building,
      u.floor,
      u.room,
      u.unitCode,
      u.acType === 'vrf' ? 'VRF / VRV' : 'ปกติ',
      u.model || '',
      u.btu || '',
      u.brand || '',
      u.installType || '',
      u.status === 'cancelled' ? 'ยกเลิก' : 'ใช้งาน',
      u.notes || '',
    ]);
  });
  const ws6 = XLSX.utils.aoa_to_sheet(s6Data);
  applyExcelPageSetup(ws6, [8, 28, 8, 24, 15, 13, 18, 10, 14, 14, 10, 20]);
  XLSX.utils.book_append_sheet(wb, ws6, 'ทะเบียนเครื่องปรับอากาศ');

  // Sheet 7: สรุปผลงานช่างเทคนิค
  const s7Data: (string | number)[][] = [
    ['สรุปผลงานช่างซ่อมบำรุง (ช่างเทคนิค)'],
    ['ชื่อช่างเทคนิค', 'ล้างแล้ว (เครื่อง)', 'แอร์ปกติ', 'VRF / VRV', 'ไม่ได้เข้าล้าง', 'อาคารที่เข้าปฏิบัติงาน'],
  ];
  for (const t of techStats) {
    s7Data.push([
      t.technicianName,
      t.cleanedCount,
      t.normalCount,
      t.vrfCount,
      t.uncleanedCount,
      t.buildings.map(formatReportBuildingName).join(', '),
    ]);
  }
  const ws7 = XLSX.utils.aoa_to_sheet(s7Data);
  applyExcelPageSetup(ws7, [24, 16, 12, 12, 14, 36]);
  XLSX.utils.book_append_sheet(wb, ws7, 'สรุปผลงานช่างเทคนิค');

  const filename = `รายงานล้างแอร์_รุ่งเรืองกิจการช่าง_${year}-${String(month).padStart(2, '0')}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function downloadInventoryImportTemplate(): void {
  const wb = XLSX.utils.book_new();
  const rows = [
    ['อาคาร', 'ชั้น', 'ห้อง', 'หมายเลขเครื่อง', 'ประเภทแอร์', 'รุ่น', 'BTU', 'ยี่ห้อ', 'ลักษณะการติดตั้ง', 'สถานะ', 'หมายเหตุ'],
    ['อาคาร A โรงพยาบาลรามคำแหง', '1', 'CR.X-RAY', '11/1', 'ปกติ', 'MU-GK13VA', '13,000', 'MITSUBISHI', 'ติดผนัง', 'ใช้งาน', ''],
    ['อาคาร B โรงพยาบาลรามคำแหง', '1', 'แผนกต้อนรับ', '21/1', 'VRF / VRV', 'FXAQ40PVE', '14,000', 'DAIKIN', 'ติดผนัง', 'ใช้งาน', 'VRV'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'ทะเบียนแอร์');
  XLSX.writeFile(wb, 'แบบฟอร์มนำเข้าทะเบียนเครื่องปรับอากาศ.xlsx');
}

export async function parseInventoryExcelFile(file: File): Promise<Array<Record<string, string>>> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  const ws = wb.Sheets[firstSheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

  return json
    .map((raw) => {
      const getCol = (keys: string[]) => {
        for (const k of Object.keys(raw)) {
          const normalized = k.trim().toLowerCase();
          if (keys.some((target) => normalized.includes(target))) {
            return String(raw[k] ?? '').trim();
          }
        }
        return '';
      };

      return {
        building: getCol(['อาคาร', 'building']),
        floor: getCol(['ชั้น', 'floor']) || '1',
        room: getCol(['ห้อง', 'room']),
        unitCode: getCol(['หมายเลขเครื่อง', 'รหัสเครื่อง', 'unit', 'code', 'serial']),
        acType: getCol(['ประเภท', 'type']),
        model: getCol(['รุ่น', 'model']),
        btu: getCol(['btu', 'ขนาด']),
        brand: getCol(['ยี่ห้อ', 'brand']),
        installType: getCol(['ลักษณะ', 'install']),
        status: getCol(['สถานะ', 'status']) || 'ใช้งาน',
        notes: getCol(['หมายเหตุ', 'note']),
      };
    })
    .filter((r) => r.building && r.room && r.unitCode);
}
