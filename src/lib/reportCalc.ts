import type { ACUnit, CleaningLog, TechnicianStat } from '../types';
import { getDaysInMonth } from './thaiDate';

export function formatReportTechnicianName(
  technicianId?: string,
  technicianName?: string
): string {
  if (!technicianId || technicianId === 'import-2569') return '';
  if (!technicianName || technicianName.includes('ข้อมูลตามไฟล์ 2569')) return '';
  return technicianName.trim();
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

export function computeUncleanedSummary(
  logs: CleaningLog[],
  units: ACUnit[],
  year: number,
  month1To12: number
): UncleanedCategorySummary {
  const cancelledIds = new Set(units.filter((u) => u.status === 'cancelled').map((u) => u.id));
  const prefix = `${year}-${String(month1To12).padStart(2, '0')}`;

  const uncleanedLogs = logs
    .filter(
      (l) =>
        l.date.startsWith(prefix) &&
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
