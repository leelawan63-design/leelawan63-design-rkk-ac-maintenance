import type { ACUnit, CleaningLog, TechnicianStat } from '../types';
import { THAI_MONTHS, getDaysInMonth } from './thaiDate';

export interface MajorCleaningCycle {
  id: 'feb_mar' | 'aug_sep';
  months: [number, number];
  label: string;
  shortLabel: string;
}

export function getMajorCleaningCycle(month1To12: number): MajorCleaningCycle | null {
  if (month1To12 === 2 || month1To12 === 3) {
    return {
      id: 'feb_mar',
      months: [2, 3],
      label: 'กุมภาพันธ์ – มีนาคม',
      shortLabel: 'ก.พ. – มี.ค.',
    };
  }
  if (month1To12 === 8 || month1To12 === 9) {
    return {
      id: 'aug_sep',
      months: [8, 9],
      label: 'สิงหาคม – กันยายน',
      shortLabel: 'ส.ค. – ก.ย.',
    };
  }
  return null;
}

export function isMajorCleaningMonth(month1To12: number): boolean {
  return getMajorCleaningCycle(month1To12) !== null;
}

export function getCleaningCycleTypeLabel(month1To12: number): 'การล้างใหญ่' | 'การล้างย่อย' {
  return isMajorCleaningMonth(month1To12) ? 'การล้างใหญ่' : 'การล้างย่อย';
}

export function formatReportTechnicianName(
  technicianId?: string,
  technicianName?: string
): string {
  if (!technicianId || technicianId === 'import-2569') return '';
  if (!technicianName || technicianName.includes('ข้อมูลตามไฟล์ 2569')) return '';
  return technicianName.trim();
}

export function formatReportTechnicianFirstName(
  technicianId?: string,
  technicianName?: string
): string {
  const base = formatReportTechnicianName(technicianId, technicianName);
  if (!base) return '';
  let cleaned = base.replace(/\([^)]*\)/g, ' ');
  cleaned = cleaned.replace(/(?:โทร\.?|tel\.?|เบอร์)?[\s:/-]*0\d[\d\s-]{6,}/gi, ' ').trim();
  if (!cleaned) return '';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const standalonePrefixes = new Set(['นาย', 'นาง', 'นางสาว', 'น.ส.', 'คุณ', 'ช่าง']);
  if (standalonePrefixes.has(parts[0]) && parts.length > 1) {
    return parts[1];
  }
  return parts[0];
}

export function formatReportNotes(notes?: string): string {
  if (!notes) return '';
  return notes
    .replace(/\s*\(ตามไฟล์\s*พ\.ศ\.\s*2569\)/g, '')
    .replace(/ตามไฟล์\s*พ\.ศ\.\s*2569/g, '')
    .trim();
}

export function formatReportBuildingName(building?: string): string {
  if (!building) return '';
  return building
    .replace(/\s*โรงพยาบาลรามคำแหง\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ContractCounts {
  totalActive: number;
  normalActive: number;
  vrfActive: number;
  cancelledCount: number;
  buildings: string[];
}

export interface BuildingFloorRow {
  building: string;
  floor: string;
  normalActive: number;
  vrfActive: number;
  totalActive: number;
  cancelledCount: number;
  rooms: string[];
}

export interface BuildingInventorySummary {
  building: string;
  floors: BuildingFloorRow[];
  normalActive: number;
  vrfActive: number;
  totalActive: number;
  cancelledCount: number;
}

export interface MonthlyMatrixRow {
  day: number;
  dateStr: string;
  countsByBuilding: Record<string, number>;
  normalTotal: number;
  vrfTotal: number;
  dayTotal: number;
}

export interface GroupedUncleanedRow {
  key: string;
  building: string;
  floor: string;
  status: CleaningLog['status'];
  rooms: string[];
  unitCodes: string[];
  notes: string[];
  itemCount: number;
}

export interface UncleanedCategorySummary {
  patientOccupied: {
    count: number;
    locations: string[];
    items: CleaningLog[];
  };
  renovation: {
    count: number;
    locations: string[];
    items: CleaningLog[];
  };
  noCard: {
    count: number;
    locations: string[];
    items: CleaningLog[];
  };
  totalUncleaned: number;
  allItems: CleaningLog[];
}

export function computeContractCounts(units: ACUnit[]): ContractCounts {
  const active = units.filter((u) => u.status !== 'cancelled');
  const cancelled = units.filter((u) => u.status === 'cancelled');
  const buildings = Array.from(new Set(units.map((u) => u.building))).sort((a, b) =>
    a.localeCompare(b, 'th')
  );

  return {
    totalActive: active.length,
    normalActive: active.filter((u) => u.acType === 'normal').length,
    vrfActive: active.filter((u) => u.acType === 'vrf').length,
    cancelledCount: cancelled.length,
    buildings,
  };
}

export function computeBuildingFloorInventory(units: ACUnit[]): {
  buildings: BuildingInventorySummary[];
  grandTotal: {
    normalActive: number;
    vrfActive: number;
    totalActive: number;
    cancelledCount: number;
    floorCount: number;
  };
} {
  const bMap = new Map<string, Map<string, ACUnit[]>>();

  for (const unit of units) {
    if (!bMap.has(unit.building)) {
      bMap.set(unit.building, new Map());
    }
    const fMap = bMap.get(unit.building)!;
    if (!fMap.has(unit.floor)) {
      fMap.set(unit.floor, []);
    }
    fMap.get(unit.floor)!.push(unit);
  }

  const buildings: BuildingInventorySummary[] = [];
  let grandNormal = 0;
  let grandVrf = 0;
  let grandActive = 0;
  let grandCancelled = 0;
  let grandFloors = 0;

  const sortedBuildings = Array.from(bMap.keys()).sort((a, b) => a.localeCompare(b, 'th'));

  for (const building of sortedBuildings) {
    const fMap = bMap.get(building)!;
    const sortedFloors = Array.from(fMap.keys()).sort((a, b) =>
      a.localeCompare(b, 'th', { numeric: true })
    );

    const floors: BuildingFloorRow[] = [];
    let bNormal = 0;
    let bVrf = 0;
    let bActive = 0;
    let bCancelled = 0;

    for (const floor of sortedFloors) {
      const floorUnits = fMap.get(floor)!;
      const active = floorUnits.filter((u) => u.status !== 'cancelled');
      const cancelled = floorUnits.filter((u) => u.status === 'cancelled');
      const normalActive = active.filter((u) => u.acType === 'normal').length;
      const vrfActive = active.filter((u) => u.acType === 'vrf').length;
      const rooms = Array.from(new Set(active.map((u) => u.room)));

      floors.push({
        building,
        floor,
        normalActive,
        vrfActive,
        totalActive: active.length,
        cancelledCount: cancelled.length,
        rooms,
      });

      bNormal += normalActive;
      bVrf += vrfActive;
      bActive += active.length;
      bCancelled += cancelled.length;
      grandFloors++;
    }

    buildings.push({
      building,
      floors,
      normalActive: bNormal,
      vrfActive: bVrf,
      totalActive: bActive,
      cancelledCount: bCancelled,
    });

    grandNormal += bNormal;
    grandVrf += bVrf;
    grandActive += bActive;
    grandCancelled += bCancelled;
  }

  return {
    buildings,
    grandTotal: {
      normalActive: grandNormal,
      vrfActive: grandVrf,
      totalActive: grandActive,
      cancelledCount: grandCancelled,
      floorCount: grandFloors,
    },
  };
}

export function getActiveUnitIds(units: ACUnit[]): Set<string> {
  return new Set(units.filter((u) => u.status !== 'cancelled').map((u) => u.id));
}

export function computeMonthlyCleaningMatrix(
  logs: CleaningLog[],
  units: ACUnit[],
  year: number,
  month1To12: number
): {
  buildings: string[];
  rows: MonthlyMatrixRow[];
  totalsByBuilding: Record<string, number>;
  grandNormalTotal: number;
  grandVrfTotal: number;
  grandTotal: number;
} {
  const activeIds = getActiveUnitIds(units);
  const cancelledIds = new Set(units.filter((u) => u.status === 'cancelled').map((u) => u.id));
  const prefix = `${year}-${String(month1To12).padStart(2, '0')}`;
  const days = getDaysInMonth(year, month1To12);

  const buildings = Array.from(
    new Set([
      ...units.map((u) => u.building),
      ...logs.filter((l) => l.date.startsWith(prefix)).map((l) => l.building),
    ])
  ).sort((a, b) => a.localeCompare(b, 'th'));

  const monthCleanedLogs = logs.filter(
    (l) =>
      l.date.startsWith(prefix) &&
      l.status === 'cleaned' &&
      !cancelledIds.has(l.unitId) &&
      (activeIds.size === 0 || activeIds.has(l.unitId) || !units.some((u) => u.id === l.unitId))
  );

  const rows: MonthlyMatrixRow[] = [];
  const totalsByBuilding: Record<string, number> = {};
  for (const b of buildings) totalsByBuilding[b] = 0;

  let grandNormalTotal = 0;
  let grandVrfTotal = 0;
  let grandTotal = 0;

  for (let day = 1; day <= days; day++) {
    const dateStr = `${prefix}-${String(day).padStart(2, '0')}`;
    const dayLogs = monthCleanedLogs.filter((l) => l.date === dateStr);
    const countsByBuilding: Record<string, number> = {};
    let dayTotal = 0;

    for (const b of buildings) {
      const count = dayLogs.filter((l) => l.building === b).length;
      countsByBuilding[b] = count;
      totalsByBuilding[b] = (totalsByBuilding[b] || 0) + count;
      dayTotal += count;
    }

    const normalTotal = dayLogs.filter((l) => l.acType !== 'vrf').length;
    const vrfTotal = dayLogs.filter((l) => l.acType === 'vrf').length;

    grandNormalTotal += normalTotal;
    grandVrfTotal += vrfTotal;
    grandTotal += dayTotal;
    rows.push({
      day,
      dateStr,
      countsByBuilding,
      normalTotal,
      vrfTotal,
      dayTotal,
    });
  }

  return {
    buildings,
    rows,
    totalsByBuilding,
    grandNormalTotal,
    grandVrfTotal,
    grandTotal,
  };
}

export function groupUncleanedItemsByBuildingFloor(
  items: CleaningLog[]
): GroupedUncleanedRow[] {
  const map = new Map<
    string,
    {
      building: string;
      floor: string;
      status: CleaningLog['status'];
      roomsSet: Set<string>;
      unitCodesSet: Set<string>;
      notesSet: Set<string>;
      itemCount: number;
    }
  >();

  for (const item of items) {
    const key = `${item.building}|||${item.floor}|||${item.status}`;
    if (!map.has(key)) {
      map.set(key, {
        building: item.building,
        floor: item.floor,
        status: item.status,
        roomsSet: new Set<string>(),
        unitCodesSet: new Set<string>(),
        notesSet: new Set<string>(),
        itemCount: 0,
      });
    }
    const entry = map.get(key)!;
    if (item.room) entry.roomsSet.add(item.room.trim());
    if (item.unitCode) entry.unitCodesSet.add(item.unitCode.trim());
    const cleanNote = formatReportNotes(item.notes);
    if (cleanNote) entry.notesSet.add(cleanNote);
    entry.itemCount++;
  }

  return Array.from(map.entries())
    .map(([key, entry]) => ({
      key,
      building: entry.building,
      floor: entry.floor,
      status: entry.status,
      rooms: Array.from(entry.roomsSet).sort((a, b) =>
        a.localeCompare(b, 'th', { numeric: true })
      ),
      unitCodes: Array.from(entry.unitCodesSet).sort((a, b) =>
        a.localeCompare(b, 'th', { numeric: true })
      ),
      notes: Array.from(entry.notesSet),
      itemCount: entry.itemCount,
    }))
    .sort((a, b) => {
      const bCmp = a.building.localeCompare(b.building, 'th');
      if (bCmp !== 0) return bCmp;
      const fCmp = a.floor.localeCompare(b.floor, 'th', { numeric: true });
      if (fCmp !== 0) return fCmp;
      return a.status.localeCompare(b.status);
    });
}

export function computeUncleanedSummaryForMonths(
  logs: CleaningLog[],
  units: ACUnit[],
  year: number,
  months: number[]
): UncleanedCategorySummary {
  const cancelledIds = new Set(units.filter((u) => u.status === 'cancelled').map((u) => u.id));
  const prefixes = new Set(
    months.map((m) => `${year}-${String(m).padStart(2, '0')}`)
  );

  const uncleanedLogs = logs
    .filter(
      (l) =>
        prefixes.has(l.date.slice(0, 7)) &&
        l.status !== 'cleaned' &&
        !cancelledIds.has(l.unitId)
    )
    .sort((a, b) => {
      const bCmp = a.building.localeCompare(b.building, 'th');
      if (bCmp !== 0) return bCmp;
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.room.localeCompare(b.room, 'th', { numeric: true });
    });

  const patientItems = uncleanedLogs.filter((l) => l.status === 'patient_occupied');
  const renovationItems = uncleanedLogs.filter((l) => l.status === 'renovation');
  const noCardItems = uncleanedLogs.filter((l) => l.status === 'no_card');

  const formatLocations = (items: CleaningLog[]) =>
    Array.from(new Set(items.map((i) => `${i.building} (${i.room} / ${i.unitCode})`)));

  return {
    patientOccupied: {
      count: patientItems.length,
      locations: formatLocations(patientItems),
      items: patientItems,
    },
    renovation: {
      count: renovationItems.length,
      locations: formatLocations(renovationItems),
      items: renovationItems,
    },
    noCard: {
      count: noCardItems.length,
      locations: formatLocations(noCardItems),
      items: noCardItems,
    },
    totalUncleaned: uncleanedLogs.length,
    allItems: uncleanedLogs,
  };
}

export function computeUncleanedSummary(
  logs: CleaningLog[],
  units: ACUnit[],
  year: number,
  month1To12: number
): UncleanedCategorySummary {
  return computeUncleanedSummaryForMonths(logs, units, year, [month1To12]);
}

export interface MajorCycleMonthBreakdown {
  month: number;
  monthName: string;
  cleanedCount: number;
  normalCount: number;
  vrfCount: number;
  uncleanedCount: number;
  matrix: ReturnType<typeof computeMonthlyCleaningMatrix>;
}

export interface MajorCycleSummary {
  month1: MajorCycleMonthBreakdown;
  month2: MajorCycleMonthBreakdown;
  totalCleaned: number;
  totalNormalCleaned: number;
  totalVrfCleaned: number;
  totalActiveUnits: number;
  uncleanedSummary: UncleanedCategorySummary;
  contractRemainingUncleaned: number;
  buildings: string[];
  buildingTotals: Record<string, number>;
}

export function computeMajorCycleSummary(
  logs: CleaningLog[],
  units: ACUnit[],
  year: number,
  months: [number, number]
): MajorCycleSummary {
  const [m1, m2] = months;
  const matrix1 = computeMonthlyCleaningMatrix(logs, units, year, m1);
  const matrix2 = computeMonthlyCleaningMatrix(logs, units, year, m2);
  const uncleaned1 = computeUncleanedSummary(logs, units, year, m1);
  const uncleaned2 = computeUncleanedSummary(logs, units, year, m2);
  const uncleanedSummary = computeUncleanedSummaryForMonths(logs, units, year, [m1, m2]);
  const contract = computeContractCounts(units);

  const totalCleaned = matrix1.grandTotal + matrix2.grandTotal;
  const buildings = Array.from(
    new Set([...matrix1.buildings, ...matrix2.buildings])
  ).sort((a, b) => a.localeCompare(b, 'th'));

  const buildingTotals: Record<string, number> = {};
  for (const b of buildings) {
    buildingTotals[b] = (matrix1.totalsByBuilding[b] || 0) + (matrix2.totalsByBuilding[b] || 0);
  }

  return {
    month1: {
      month: m1,
      monthName: THAI_MONTHS[m1 - 1] || String(m1),
      cleanedCount: matrix1.grandTotal,
      normalCount: matrix1.grandNormalTotal,
      vrfCount: matrix1.grandVrfTotal,
      uncleanedCount: uncleaned1.totalUncleaned,
      matrix: matrix1,
    },
    month2: {
      month: m2,
      monthName: THAI_MONTHS[m2 - 1] || String(m2),
      cleanedCount: matrix2.grandTotal,
      normalCount: matrix2.grandNormalTotal,
      vrfCount: matrix2.grandVrfTotal,
      uncleanedCount: uncleaned2.totalUncleaned,
      matrix: matrix2,
    },
    totalCleaned,
    totalNormalCleaned: matrix1.grandNormalTotal + matrix2.grandNormalTotal,
    totalVrfCleaned: matrix1.grandVrfTotal + matrix2.grandVrfTotal,
    totalActiveUnits: contract.totalActive,
    uncleanedSummary,
    contractRemainingUncleaned: Math.max(0, contract.totalActive - totalCleaned),
    buildings,
    buildingTotals,
  };
}

export function computeTechnicianStats(
  logs: CleaningLog[],
  units: ACUnit[]
): TechnicianStat[] {
  const cancelledIds = new Set(units.filter((u) => u.status === 'cancelled').map((u) => u.id));
  const map = new Map<
    string,
    {
      technicianId: string;
      technicianName: string;
      cleanedCount: number;
      normalCount: number;
      vrfCount: number;
      uncleanedCount: number;
      buildings: Set<string>;
    }
  >();

  for (const log of logs) {
    if (cancelledIds.has(log.unitId)) continue;
    const cleanTechName = formatReportTechnicianName(log.technicianId, log.technicianName);
    const key = cleanTechName ? log.technicianId : '__unassigned__';
    if (!map.has(key)) {
      map.set(key, {
        technicianId: key,
        technicianName: cleanTechName,
        cleanedCount: 0,
        normalCount: 0,
        vrfCount: 0,
        uncleanedCount: 0,
        buildings: new Set<string>(),
      });
    }
    const entry = map.get(key)!;
    entry.buildings.add(log.building);
    if (log.status === 'cleaned') {
      entry.cleanedCount++;
      if (log.acType === 'vrf') entry.vrfCount++;
      else entry.normalCount++;
    } else {
      entry.uncleanedCount++;
    }
  }

  return Array.from(map.values())
    .map((e) => ({
      technicianId: e.technicianId,
      technicianName: e.technicianName,
      cleanedCount: e.cleanedCount,
      normalCount: e.normalCount,
      vrfCount: e.vrfCount,
      uncleanedCount: e.uncleanedCount,
      buildings: Array.from(e.buildings).sort((a, b) => a.localeCompare(b, 'th')),
    }))
    .sort((a, b) => b.cleanedCount - a.cleanedCount);
}
