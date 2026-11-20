import React, { useMemo, useState } from 'react';
import { Search, Pencil, Trash2, X, FileSpreadsheet } from 'lucide-react';
import type {
  ACUnit,
  CleaningLog,
  CleaningStatus,
  CompanySettings,
  UserAccount,
} from '../types';
import { CLEANING_STATUS_LABELS } from '../types';
import type { TechnicianOption } from '../lib/api';
import { computeTechnicianStats } from '../lib/reportCalc';
import { exportAllReportsToSingleExcel } from '../lib/excelExport';
import { formatThaiDate, getTodayIso } from '../lib/thaiDate';

interface HistoryViewProps {
  user: UserAccount;
  company: CompanySettings;
  units: ACUnit[];
  logs: CleaningLog[];
  technicians: TechnicianOption[];
  onUpdateLog: (
    id: string,
    payload: {
      date?: string;
      status?: CleaningStatus;
      notes?: string;
      technicianId?: string;
    }
  ) => Promise<void>;
  onDeleteLog: (id: string) => Promise<void>;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  user,
  company,
  units,
  logs,
  technicians,
  onUpdateLog,
  onDeleteLog,
}) => {
  const today = getTodayIso();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [buildingFilter, setBuildingFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [techFilter, setTechFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [editingLog, setEditingLog] = useState<CleaningLog | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editStatus, setEditStatus] = useState<CleaningStatus>('cleaned');
  const [editTechId, setEditTechId] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [deletingLog, setDeletingLog] = useState<CleaningLog | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const canEdit = user.role === 'super_admin' || user.permissions.canEditHistory;
  const canDelete = user.role === 'super_admin' || user.permissions.canDeleteHistory;

  const buildings = useMemo(
    () =>
      Array.from(new Set(logs.map((l) => l.building))).sort((a, b) =>
        a.localeCompare(b, 'th')
      ),
    [logs]
  );

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (startDate && l.date < startDate) return false;
      if (endDate && l.date > endDate) return false;
      if (buildingFilter !== 'all' && l.building !== buildingFilter) return false;
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (techFilter !== 'all' && l.technicianId !== techFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          l.building.toLowerCase().includes(q) ||
          l.room.toLowerCase().includes(q) ||
          l.unitCode.toLowerCase().includes(q) ||
          l.technicianName.toLowerCase().includes(q) ||
          l.notes.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, startDate, endDate, buildingFilter, statusFilter, techFilter, search]);

  const techStats = useMemo(
    () => computeTechnicianStats(filteredLogs, units),
    [filteredLogs, units]
  );

  const cleanedCount = filteredLogs.filter((l) => l.status === 'cleaned').length;
  const uncleanedCount = filteredLogs.filter((l) => l.status !== 'cleaned').length;

  const openEdit = (log: CleaningLog) => {
    setEditingLog(log);
    setEditDate(log.date);
    setEditStatus(log.status);
    setEditTechId(log.technicianId);
    setEditNotes(log.notes);
    setErrorMsg('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;
    setBusy(true);
    setErrorMsg('');
    try {
      await onUpdateLog(editingLog.id, {
        date: editDate,
        status: editStatus,
        technicianId: editTechId,
        notes: editNotes,
      });
      setEditingLog(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'แก้ไขไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingLog) return;
    setBusy(true);
    setErrorMsg('');
    try {
      await onDeleteLog(deletingLog.id);
      setDeletingLog(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'ลบข้อมูลไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const statusTone = (status: CleaningStatus) => {
    switch (status) {
      case 'cleaned':
        return 'text-[#25593E] bg-[#ECF6F1]';
      case 'patient_occupied':
        return 'text-[#8C5E26] bg-[#FDF6EC]';
      case 'renovation':
        return 'text-[#5B4B85] bg-[#F3F0FA]';
      case 'no_card':
        return 'text-[#9D3E4E] bg-[#FDF0F2]';
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <div className="bg-white border border-[#DCE4EE] rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#1E293B]">
              ประวัติการล้างย้อนหลังและตรวจสอบตามช่วงวันที่
            </h1>
            <p className="text-sm text-[#64748B] mt-0.5">
              เรียกดูประวัติการล้างตามขอบเขตวันที่ อาคาร สถานะ และรายชื่อช่างเทคนิค
              {!canDelete && ' · สิทธิ์ช่างเทคนิค: ดูย้อนหลังได้เท่านั้น (ไม่สามารถลบข้อมูลเก่าได้)'}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              exportAllReportsToSingleExcel({
                company,
                units,
                logs,
                year: Number((endDate || today).slice(0, 4)),
                month: Number((endDate || today).slice(5, 7)),
                dailyDate: endDate || today,
                startDate,
                endDate,
              })
            }
            className="h-10 px-4 rounded-lg bg-[#EAF5EF] hover:bg-[#DCEEE4] border border-[#C6E2D2] text-[#2F6A4E] text-sm font-medium flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            ดาวน์โหลด Excel
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-2 border-t border-[#E8EEF4]">
          <div className="space-y-1">
            <label className="block text-xs text-[#64748B]">ตั้งแต่วันที่</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-[#CBD5E1] text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-[#64748B]">ถึงวันที่</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-[#CBD5E1] text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-[#64748B]">อาคาร</label>
            <select
              value={buildingFilter}
              onChange={(e) => setBuildingFilter(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-[#CBD5E1] bg-white text-sm"
            >
              <option value="all">ทุกอาคาร</option>
              {buildings.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-[#64748B]">สถานะ</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-[#CBD5E1] bg-white text-sm"
            >
              <option value="all">ทุกสถานะ</option>
              <option value="cleaned">ล้างแล้ว</option>
              <option value="patient_occupied">ห้องมีคนไข้</option>
              <option value="renovation">ปิดปรับปรุง</option>
              <option value="no_card">ไม่มีการ์ด</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-[#64748B]">ช่างเทคนิค</label>
            <select
              value={techFilter}
              onChange={(e) => setTechFilter(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-[#CBD5E1] bg-white text-sm"
            >
              <option value="all">ช่างทุกคน</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                  {t.phone ? ` (${t.phone})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-[#64748B]">ค้นหา</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ห้อง / รหัสเครื่อง..."
                className="w-full h-9 pl-8 pr-2.5 rounded-lg border border-[#CBD5E1] text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary & Technician Counts for Selected Range */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 bg-white border border-[#DCE4EE] rounded-xl p-4 flex items-center justify-around gap-4 text-center">
          <div>
            <div className="text-xs text-[#64748B]">รายการที่พบ</div>
            <div className="text-2xl font-bold text-[#1E293B] tabular-nums">
              {filteredLogs.length}
            </div>
          </div>
          <div className="h-10 w-px bg-[#E2E8F0]" />
          <div>
            <div className="text-xs text-[#3C7356]">ล้างแล้ว</div>
            <div className="text-2xl font-bold text-[#25593E] tabular-nums">{cleanedCount}</div>
          </div>
          <div className="h-10 w-px bg-[#E2E8F0]" />
          <div>
            <div className="text-xs text-[#8C5E26]">ไม่ได้เข้าล้าง</div>
            <div className="text-2xl font-bold text-[#7A4E1A] tabular-nums">{uncleanedCount}</div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-[#DCE4EE] rounded-xl p-4">
          <div className="text-xs font-medium text-[#64748B] mb-2">
            สรุปจำนวนเครื่องที่ช่างแต่ละคนเข้าล้างได้ (ในช่วงวันที่ที่เลือก)
          </div>
          {techStats.length === 0 ? (
            <div className="text-xs text-[#94A3B8]">ไม่มีข้อมูลช่างในช่วงวันที่นี้</div>
          ) : (
            <div className="flex flex-wrap gap-4 text-sm">
              {techStats.map((t) => (
                <div key={t.technicianId} className="text-[#1E293B] tabular-nums">
                  <span className="font-medium">{t.technicianName}:</span>{' '}
                  <span className="font-bold text-[#2F6A4E]">{t.cleanedCount} เครื่อง</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* History Data Table */}
      <div className="bg-white border border-[#DCE4EE] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-[#F4F7FA] border-b border-[#DCE4EE] text-xs text-[#475569]">
              <tr>
                <th className="py-3 px-4 text-left font-semibold">วันที่</th>
                <th className="py-3 px-4 text-left font-semibold">อาคาร / ชั้น</th>
                <th className="py-3 px-4 text-left font-semibold">ห้อง</th>
                <th className="py-3 px-4 text-left font-semibold">หมายเลขเครื่อง</th>
                <th className="py-3 px-4 text-left font-semibold">ประเภท</th>
                <th className="py-3 px-4 text-left font-semibold">สถานะ</th>
                <th className="py-3 px-4 text-left font-semibold">ช่างผู้ปฏิบัติงาน</th>
                <th className="py-3 px-4 text-left font-semibold">หมายเหตุ</th>
                {(canEdit || canDelete) && (
                  <th className="py-3 px-4 text-right font-semibold">จัดการ</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={canEdit || canDelete ? 9 : 8}
                    className="py-12 text-center text-sm text-[#64748B]"
                  >
                    ไม่พบประวัติการล้างในช่วงวันที่และเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F8FAFC]">
                    <td className="py-3 px-4 whitespace-nowrap tabular-nums text-[#334155]">
                      {formatThaiDate(log.date, true)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-[#1E293B]">{log.building}</div>
                      <div className="text-xs text-[#64748B]">{log.floor}</div>
                    </td>
                    <td className="py-3 px-4 text-[#334155]">{log.room}</td>
                    <td className="py-3 px-4 font-mono-tabular font-medium text-[#3B6684] whitespace-nowrap">
                      {log.unitCode}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-[#475569]">
                      {log.acType === 'vrf' ? 'VRF / VRV' : 'แอร์ปกติ'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusTone(
                          log.status
                        )}`}
                      >
                        {CLEANING_STATUS_LABELS[log.status]}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-[#1E293B]">
                      {log.technicianName}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#64748B] max-w-[220px] truncate">
                      {log.notes || '-'}
                    </td>
                    {(canEdit || canDelete) && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEdit(log)}
                              aria-label="แก้ไข"
                              className="p-1.5 rounded-md text-[#4A7C9B] hover:bg-[#EAF2F8] cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingLog(log);
                                setErrorMsg('');
                              }}
                              aria-label="ลบ"
                              className="p-1.5 rounded-md text-[#9D3E4E] hover:bg-[#FDF0F2] cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md bg-white border border-[#DCE4EE] rounded-xl p-6 space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#1E293B]">
                แก้ไขข้อมูลการล้าง ({editingLog.unitCode})
              </h3>
              <button
                type="button"
                onClick={() => setEditingLog(null)}
                className="p-1 text-[#64748B] hover:text-[#1E293B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-[#FDF0F2] text-xs text-[#9D3E4E]">{errorMsg}</div>
            )}

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">วันที่</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">สถานะ</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as CleaningStatus)}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm"
                >
                  {Object.entries(CLEANING_STATUS_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">ช่างผู้ปฏิบัติงาน</label>
                <select
                  value={editTechId}
                  onChange={(e) => setEditTechId(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm"
                >
                  {editingLog.technicianId === 'import-2569' && (
                    <option value="import-2569">ข้อมูลตามไฟล์ 2569 (ยังไม่ระบุช่าง)</option>
                  )}
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName}
                      {t.phone ? ` (${t.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">หมายเหตุ</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingLog(null)}
                className="h-9 px-4 rounded-lg border border-[#CBD5E1] text-sm text-[#475569] cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={busy}
                className="h-9 px-4 rounded-lg bg-[#4A7C9B] text-white text-sm font-medium cursor-pointer disabled:opacity-50"
              >
                {busy ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
          <div className="w-full max-w-md bg-white border border-[#DCE4EE] rounded-xl p-6 space-y-4 shadow-lg">
            <h3 className="text-base font-semibold text-[#1E293B]">ยืนยันการลบข้อมูลการล้าง</h3>
            <p className="text-sm text-[#475569]">
              คุณต้องการลบประวัติของเครื่อง{' '}
              <span className="font-mono-tabular font-semibold">{deletingLog.unitCode}</span> (
              {deletingLog.building} · {deletingLog.room}) วันที่{' '}
              {formatThaiDate(deletingLog.date, true)} ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </p>
            {errorMsg && (
              <div className="p-3 rounded-lg bg-[#FDF0F2] text-xs text-[#9D3E4E]">{errorMsg}</div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingLog(null)}
                className="h-9 px-4 rounded-lg border border-[#CBD5E1] text-sm text-[#475569] cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleConfirmDelete}
                className="h-9 px-4 rounded-lg bg-[#B05566] hover:bg-[#974252] text-white text-sm font-medium cursor-pointer disabled:opacity-50"
              >
                {busy ? 'กำลังลบ...' : 'ยืนยันลบข้อมูล'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
