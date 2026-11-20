import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, RefreshCw, ArrowRight } from 'lucide-react';
import type { ACUnit, CleaningLog, CompanySettings, UserAccount } from '../types';
import {
  computeBuildingFloorInventory,
  computeContractCounts,
  computeMonthlyCleaningMatrix,
  computeTechnicianStats,
  computeUncleanedSummary,
} from '../lib/reportCalc';
import { THAI_MONTHS, formatThaiMonthYear, getTodayIso } from '../lib/thaiDate';
import { exportAllReportsToSingleExcel } from '../lib/excelExport';
import type { NavTab } from './Sidebar';

interface DashboardViewProps {
  user: UserAccount;
  company: CompanySettings;
  units: ACUnit[];
  logs: CleaningLog[];
  googleToken: string | null;
  onSyncSheetsNow: (year: number, month: number) => Promise<void>;
  onNavigate: (tab: NavTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  company,
  units,
  logs,
  googleToken,
  onSyncSheetsNow,
  onNavigate,
}) => {
  const today = getTodayIso();
  const initialYear = Number(today.slice(0, 4));
  const initialMonth = Number(today.slice(5, 7));

  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [syncing, setSyncing] = useState(false);

  const contract = useMemo(() => computeContractCounts(units), [units]);
  const floorInv = useMemo(() => computeBuildingFloorInventory(units), [units]);
  const matrix = useMemo(
    () => computeMonthlyCleaningMatrix(logs, units, selectedYear, selectedMonth),
    [logs, units, selectedYear, selectedMonth]
  );
  const uncleaned = useMemo(
    () => computeUncleanedSummary(logs, units, selectedYear, selectedMonth),
    [logs, units, selectedYear, selectedMonth]
  );

  const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const monthLogs = useMemo(
    () => logs.filter((l) => l.date.startsWith(monthPrefix)),
    [logs, monthPrefix]
  );
  const techStats = useMemo(() => computeTechnicianStats(monthLogs, units), [monthLogs, units]);

  const progressPct =
    contract.totalActive > 0
      ? Math.min(100, Math.round((matrix.grandTotal / contract.totalActive) * 100))
      : 0;

  const availableYears = useMemo(() => {
    const years = new Set<number>([initialYear, initialYear - 1, initialYear + 1]);
    for (const l of logs) {
      const y = Number(l.date.slice(0, 4));
      if (!Number.isNaN(y)) years.add(y);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [logs, initialYear]);

  const handleExportExcel = () => {
    exportAllReportsToSingleExcel({
      company,
      units,
      logs,
      year: selectedYear,
      month: selectedMonth,
      dailyDate: today,
      startDate: `${monthPrefix}-01`,
      endDate: `${monthPrefix}-31`,
    });
  };

  const handleQuickSync = async () => {
    if (!googleToken || !company.googleSheetId) {
      onNavigate('sheets');
      return;
    }
    setSyncing(true);
    try {
      await onSyncSheetsNow(selectedYear, selectedMonth);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white border border-[#DCE4EE] rounded-xl p-5">
        <div>
          <h1 className="text-xl font-bold text-[#1E293B]">
            ภาพรวมงานบำรุงรักษาเครื่องปรับอากาศ
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            ประจำเดือน {formatThaiMonthYear(selectedYear, selectedMonth)} · {company.name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="เลือกเดือน"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="h-10 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm text-[#1E293B] focus:outline-none focus:border-[#4A7C9B]"
          >
            {THAI_MONTHS.map((m, idx) => (
              <option key={m} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>

          <select
            aria-label="เลือกปี"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="h-10 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm text-[#1E293B] focus:outline-none focus:border-[#4A7C9B]"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                พ.ศ. {y + 543} ({y})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExportExcel}
            className="h-10 px-4 rounded-lg bg-[#EAF5EF] hover:bg-[#DCEEE4] border border-[#C6E2D2] text-[#2F6A4E] text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            ดาวน์โหลด Excel ทุกรายงาน
          </button>

          {(user.role === 'super_admin' || user.permissions.canSyncSheets) && (
            <button
              type="button"
              onClick={handleQuickSync}
              disabled={syncing}
              className="h-10 px-4 rounded-lg bg-[#4A7C9B] hover:bg-[#3C6884] text-white text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {googleToken && company.googleSheetId
                ? syncing
                  ? 'กำลังซิงค์...'
                  : 'ซิงค์ Google Sheets'
                : 'เชื่อมต่อ Google Sheets'}
            </button>
          )}
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-[#DCE4EE] rounded-xl p-5 space-y-2">
          <div className="text-xs font-medium text-[#64748B]">
            แอร์ทั้งหมดในสัญญา (ไม่รวมยกเลิก)
          </div>
          <div className="text-3xl font-bold text-[#1E293B] tabular-nums">
            {contract.totalActive} <span className="text-sm font-normal text-[#64748B]">เครื่อง</span>
          </div>
          <div className="text-xs text-[#475569] tabular-nums">
            แอร์ปกติ {contract.normalActive} · VRF/VRV {contract.vrfActive} · ยกเลิก{' '}
            {contract.cancelledCount}
          </div>
        </div>

        <div className="bg-[#F4FAF6] border border-[#CFE6D8] rounded-xl p-5 space-y-2">
          <div className="text-xs font-medium text-[#3C7356]">
            เข้าล้างแล้วในเดือนนี้
          </div>
          <div className="text-3xl font-bold text-[#25593E] tabular-nums">
            {matrix.grandTotal}{' '}
            <span className="text-sm font-normal text-[#3C7356]">เครื่อง ({progressPct}%)</span>
          </div>
          <div className="w-full h-2 bg-[#DCEEE3] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#5B9B79] rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="bg-[#FDF8F1] border border-[#EFE0C9] rounded-xl p-5 space-y-2">
          <div className="text-xs font-medium text-[#8C5E26]">
            ไม่ได้เข้าล้าง (ไม่รวมยกเลิก)
          </div>
          <div className="text-3xl font-bold text-[#7A4E1A] tabular-nums">
            {uncleaned.totalUncleaned}{' '}
            <span className="text-sm font-normal text-[#8C5E26]">เครื่อง</span>
          </div>
          <div className="text-xs text-[#8C5E26] tabular-nums">
            คนไข้ {uncleaned.patientOccupied.count} · ปรับปรุง {uncleaned.renovation.count} · ไม่มีการ์ด{' '}
            {uncleaned.noCard.count}
          </div>
        </div>

        <div className="bg-[#F2F6FA] border border-[#D4E2EE] rounded-xl p-5 space-y-2">
          <div className="text-xs font-medium text-[#3B6684]">
            จำนวนอาคารและชั้นทั้งหมด
          </div>
          <div className="text-3xl font-bold text-[#254B66] tabular-nums">
            {floorInv.buildings.length}{' '}
            <span className="text-sm font-normal text-[#3B6684]">
              อาคาร / {floorInv.grandTotal.floorCount} ชั้น
            </span>
          </div>
          <div className="text-xs text-[#475569]">
            ซิงค์ Google Sheets:{' '}
            {company.googleSheetId
              ? company.autoSyncSheets
                ? 'เปิดซิงค์อัตโนมัติ'
                : 'เชื่อมต่อแล้ว'
              : 'ยังไม่เชื่อมต่อ'}
          </div>
        </div>
      </div>

      {/* Building Progress + Technician Productivity */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Building Breakdown */}
        <div className="xl:col-span-7 bg-white border border-[#DCE4EE] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#1E293B]">
                ความคืบหน้าแยกตามอาคาร ({formatThaiMonthYear(selectedYear, selectedMonth)})
              </h2>
              <p className="text-xs text-[#64748B]">
                เปรียบเทียบจำนวนเครื่องที่ล้างแล้วกับจำนวนเครื่องใช้งานจริงในแต่ละอาคาร
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-xs font-medium text-[#4A7C9B] hover:text-[#2F5A78] flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              ดูรายงานฉบับเต็ม <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-xs text-[#64748B]">
                  <th className="py-2.5 text-left font-medium">อาคาร</th>
                  <th className="py-2.5 text-right font-medium">ในสัญญา</th>
                  <th className="py-2.5 text-right font-medium">ล้างแล้ว</th>
                  <th className="py-2.5 text-right font-medium">คงเหลือ</th>
                  <th className="py-2.5 pl-4 text-left font-medium w-40">สัดส่วน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {floorInv.buildings.map((b) => {
                  const cleaned = matrix.totalsByBuilding[b.building] || 0;
                  const pct =
                    b.totalActive > 0
                      ? Math.min(100, Math.round((cleaned / b.totalActive) * 100))
                      : 0;
                  const remaining = Math.max(0, b.totalActive - cleaned);
                  return (
                    <tr key={b.building} className="hover:bg-[#F8FAFC]">
                      <td className="py-3 pr-3 font-medium text-[#1E293B]">
                        {b.building}
                        <span className="block text-xs font-normal text-[#64748B] tabular-nums">
                          ปกติ {b.normalActive} · VRF/VRV {b.vrfActive}
                        </span>
                      </td>
                      <td className="py-3 text-right tabular-nums text-[#334155]">
                        {b.totalActive}
                      </td>
                      <td className="py-3 text-right tabular-nums font-semibold text-[#2F6A4E]">
                        {cleaned}
                      </td>
                      <td className="py-3 text-right tabular-nums text-[#64748B]">
                        {remaining}
                      </td>
                      <td className="py-3 pl-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-[#EDF2F7] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#689CB8] rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-[#475569] w-9 text-right">
                            {pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Technician Performance Breakdown */}
        <div className="xl:col-span-5 bg-white border border-[#DCE4EE] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#1E293B]">
                ผลงานช่างเทคนิคประจำเดือน
              </h2>
              <p className="text-xs text-[#64748B]">
                สรุปจำนวนเครื่องที่ช่างแต่ละคนเข้าล้างได้ (แยกตามผู้ล็อกอิน/ผู้ปฏิบัติงาน)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('daily')}
              className="text-xs font-medium text-[#4A7C9B] hover:text-[#2F5A78] flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              บันทึกงานวันใหม่ <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {techStats.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#64748B] bg-[#F8FAFC] rounded-lg border border-dashed border-[#DCE4EE]">
              ยังไม่มีข้อมูลการเข้าล้างในเดือนที่เลือก
            </div>
          ) : (
            <div className="space-y-3">
              {techStats.map((t) => {
                const maxCleaned = Math.max(...techStats.map((x) => x.cleanedCount), 1);
                const barPct = Math.round((t.cleanedCount / maxCleaned) * 100);
                return (
                  <div
                    key={t.technicianId}
                    className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E6EDF4] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#1E293B] truncate">
                        {t.technicianName || 'ยังไม่ระบุช่างผู้ปฏิบัติงาน'}
                      </span>
                      <span className="text-sm font-bold text-[#2F6A4E] tabular-nums whitespace-nowrap">
                        ล้างแล้ว {t.cleanedCount} เครื่อง
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#689CB8] rounded-full"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B] tabular-nums">
                      <span>
                        ปกติ {t.normalCount} · VRF/VRV {t.vrfCount} · ไม่ได้ล้าง {t.uncleanedCount}
                      </span>
                      <span className="truncate max-w-[200px]" title={t.buildings.join(', ')}>
                        {t.buildings.join(', ')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
