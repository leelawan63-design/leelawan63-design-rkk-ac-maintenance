import React, { useMemo, useState } from 'react';
import { Plus, Check, Trash2, Save, Search, ChevronDown, ChevronUp } from 'lucide-react';
import type {
  ACType,
  ACUnit,
  BatchLogItemInput,
  CleaningLog,
  CleaningStatus,
  UserAccount,
} from '../types';
import { CLEANING_STATUS_LABELS } from '../types';
import type { TechnicianOption } from '../lib/api';
import { useDeviceMode } from '../lib/deviceMode';
import { formatThaiDate, formatThaiMonthYear, getMonthDateRange, getTodayIso } from '../lib/thaiDate';

interface DailyEntryViewProps {
  user: UserAccount;
  units: ACUnit[];
  logs: CleaningLog[];
  technicians: TechnicianOption[];
  onSaveBatch: (payload: {
    date: string;
    technicianId?: string;
    items: BatchLogItemInput[];
  }) => Promise<void>;
}

interface StagedEntry extends BatchLogItemInput {
  tempKey: string;
}

const STATUS_OPTIONS: Array<{ value: CleaningStatus; label: string }> = [
  { value: 'cleaned', label: 'ล้างแล้ว' },
  { value: 'patient_occupied', label: 'ไม่ได้เข้าล้าง - ห้องมีคนไข้' },
  { value: 'renovation', label: 'ไม่ได้เข้าล้าง - ปิดปรับปรุง' },
  { value: 'no_card', label: 'ไม่ได้เข้าล้าง - ไม่มีการ์ด' },
];

export const DailyEntryView: React.FC<DailyEntryViewProps> = ({
  user,
  units,
  logs,
  technicians,
  onSaveBatch,
}) => {
  const { deviceMode } = useDeviceMode();
  const isTouchMode = deviceMode === 'mobile' || deviceMode === 'tablet';

  const today = getTodayIso();
  const currentMonthPrefix = today.slice(0, 7);
  const currentMonthRange = useMemo(
    () => getMonthDateRange(Number(today.slice(0, 4)), Number(today.slice(5, 7))),
    [today]
  );
  const isCurrentMonthOnly =
    user.role !== 'super_admin' && Boolean(user.permissions.canModifyCurrentMonthOnly);

  const buildings = useMemo(
    () =>
      Array.from(new Set(units.map((u) => u.building))).sort((a, b) =>
        a.localeCompare(b, 'th')
      ),
    [units]
  );

  const selectableTechnicians = useMemo(() => {
    if (user.role === 'super_admin') return technicians;
    return technicians.filter((t) => t.role !== 'super_admin');
  }, [technicians, user.role]);

  const [date, setDate] = useState(today);
  const [selectedBuilding, setSelectedBuilding] = useState(buildings[0] || '');
  const [customBuilding, setCustomBuilding] = useState('');
  const [useCustomBuilding, setUseCustomBuilding] = useState(false);

  const [technicianId, setTechnicianId] = useState(user.id);
  const [floorFilter, setFloorFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [defaultStatus, setDefaultStatus] = useState<CleaningStatus>('cleaned');
  const [showLoggedInMonth, setShowLoggedInMonth] = useState(false);
  const [showManualUnitForm, setShowManualUnitForm] = useState(false);

  const [staged, setStaged] = useState<StagedEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Manual new AC unit form
  const [manualFloor, setManualFloor] = useState('1');
  const [manualRoom, setManualRoom] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [manualType, setManualType] = useState<ACType>('normal');
  const [manualBtu, setManualBtu] = useState('18,000');
  const [manualBrand, setManualBrand] = useState('');
  const [manualModel, setManualModel] = useState('');
  const [manualInstallType, setManualInstallType] = useState('');
  const [manualStatus, setManualStatus] = useState<CleaningStatus>('cleaned');
  const [manualNotes, setManualNotes] = useState('');

  const effectiveTechnicianId = useMemo(() => {
    if (user.role === 'technician') return user.id;
    if (selectableTechnicians.some((t) => t.id === technicianId)) return technicianId;
    return selectableTechnicians[0]?.id || user.id;
  }, [user.role, user.id, selectableTechnicians, technicianId]);

  const activeBuilding = useCustomBuilding
    ? customBuilding.trim()
    : selectedBuilding || buildings[0] || '';

  const buildingUnits = useMemo(() => {
    return units.filter(
      (u) => u.building === activeBuilding && u.status !== 'cancelled'
    );
  }, [units, activeBuilding]);

  const selectedMonthPrefix = date.slice(0, 7);

  const loggedInMonthMap = useMemo(() => {
    const byId = new Map<string, CleaningLog>();
    const byKey = new Map<string, CleaningLog>();
    for (const l of logs) {
      if (l.date.startsWith(selectedMonthPrefix)) {
        byId.set(l.unitId, l);
        byKey.set(`${l.building.trim()}::${l.unitCode.trim().toLowerCase()}`, l);
      }
    }
    return { byId, byKey };
  }, [logs, selectedMonthPrefix]);

  const getMonthLogForUnit = (u: ACUnit): CleaningLog | undefined => {
    return (
      loggedInMonthMap.byId.get(u.id) ||
      loggedInMonthMap.byKey.get(`${u.building.trim()}::${u.unitCode.trim().toLowerCase()}`)
    );
  };

  const loggedInMonthCountInBuilding = useMemo(() => {
    let count = 0;
    for (const u of buildingUnits) {
      if (getMonthLogForUnit(u)) count++;
    }
    return count;
  }, [buildingUnits, loggedInMonthMap]);

  const floorsInBuilding = useMemo(
    () =>
      Array.from(new Set(buildingUnits.map((u) => u.floor))).sort((a, b) =>
        a.localeCompare(b, 'th', { numeric: true })
      ),
    [buildingUnits]
  );

  const filteredBuildingUnits = useMemo(() => {
    return buildingUnits.filter((u) => {
      if (!showLoggedInMonth && getMonthLogForUnit(u)) return false;
      if (floorFilter !== 'all' && u.floor !== floorFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          u.room.toLowerCase().includes(q) ||
          u.unitCode.toLowerCase().includes(q) ||
          u.floor.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [buildingUnits, showLoggedInMonth, loggedInMonthMap, floorFilter, searchQuery]);

  const loggedTodayMap = useMemo(() => {
    const map = new Map<string, CleaningLog>();
    for (const l of logs) {
      if (l.date === date) {
        map.set(l.unitId, l);
      }
    }
    return map;
  }, [logs, date]);

  const myTodayStats = useMemo(() => {
    const todayLogs = logs.filter((l) => l.date === date && l.technicianId === effectiveTechnicianId);
    const allMyCleaned = logs.filter(
      (l) => l.technicianId === effectiveTechnicianId && l.status === 'cleaned'
    );
    return {
      todayCleaned: todayLogs.filter((l) => l.status === 'cleaned').length,
      todayTotal: todayLogs.length,
      allTimeCleaned: allMyCleaned.length,
    };
  }, [logs, date, effectiveTechnicianId]);

  const addExistingUnitToStage = (unit: ACUnit, statusOverride?: CleaningStatus) => {
    setFeedback(null);
    const exists = staged.some(
      (s) => s.mode === 'existing' && s.unitId === unit.id
    );
    if (exists) {
      setStaged((prev) =>
        prev.map((s) =>
          s.mode === 'existing' && s.unitId === unit.id
            ? { ...s, status: statusOverride ?? s.status }
            : s
        )
      );
      return;
    }

    setStaged((prev) => [
      ...prev,
      {
        tempKey: `ex-${unit.id}-${Date.now()}`,
        mode: 'existing',
        unitId: unit.id,
        building: unit.building,
        floor: unit.floor,
        room: unit.room,
        unitCode: unit.unitCode,
        acType: unit.acType,
        btu: unit.btu,
        brand: unit.brand,
        model: unit.model,
        installType: unit.installType,
        status: statusOverride ?? defaultStatus,
        notes: '',
      },
    ]);
  };

  const addAllFilteredUnits = () => {
    setFeedback(null);
    setStaged((prev) => {
      const existingIds = new Set(prev.map((s) => s.unitId).filter(Boolean));
      const toAdd: StagedEntry[] = [];
      for (const u of filteredBuildingUnits) {
        if (!existingIds.has(u.id)) {
          toAdd.push({
            tempKey: `ex-${u.id}-${Date.now()}-${Math.random()}`,
            mode: 'existing',
            unitId: u.id,
            building: u.building,
            floor: u.floor,
            room: u.room,
            unitCode: u.unitCode,
            acType: u.acType,
            btu: u.btu,
            brand: u.brand,
            model: u.model,
            installType: u.installType,
            status: defaultStatus,
            notes: '',
          });
        }
      }
      return [...prev, ...toAdd];
    });
  };

  const handleAddManualUnit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!activeBuilding) {
      setFeedback({ type: 'error', text: 'กรุณาเลือกหรือระบุชื่ออาคารก่อน' });
      return;
    }
    if (!manualFloor.trim() || !manualRoom.trim() || !manualCode.trim()) {
      setFeedback({
        type: 'error',
        text: 'กรุณากรอก ชั้น ห้อง และหมายเลขเครื่อง ให้ครบถ้วน',
      });
      return;
    }

    setStaged((prev) => [
      ...prev,
      {
        tempKey: `new-${Date.now()}-${Math.random()}`,
        mode: 'new',
        building: activeBuilding,
        floor: manualFloor.trim(),
        room: manualRoom.trim(),
        unitCode: manualCode.trim(),
        acType: manualType,
        btu: manualBtu.trim(),
        brand: manualBrand.trim(),
        model: manualModel.trim(),
        installType: manualInstallType.trim(),
        status: manualStatus,
        notes: manualNotes.trim(),
      },
    ]);

    setManualRoom('');
    setManualCode('');
    setManualModel('');
    setManualNotes('');
    setFeedback({
      type: 'success',
      text: 'เพิ่มรายการเครื่องใหม่เข้าสู่คิวรอการบันทึกแล้ว (เมื่อกดบันทึก ระบบจะนำไปต่อท้ายในอาคารนี้ให้อัตโนมัติ)',
    });
  };

  const handleSaveAll = async () => {
    if (staged.length === 0) {
      setFeedback({ type: 'error', text: 'กรุณาเลือกรายการเครื่องปรับอากาศอย่างน้อย 1 รายการ' });
      return;
    }
    if (isCurrentMonthOnly && !date.startsWith(currentMonthPrefix)) {
      setFeedback({
        type: 'error',
        text: 'สิทธิ์ของคุณอนุญาตให้เพิ่มข้อมูลการล้างเฉพาะเดือนปัจจุบันเท่านั้น',
      });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await onSaveBatch({
        date,
        technicianId: effectiveTechnicianId,
        items: staged.map(({ tempKey: _k, ...rest }) => rest),
      });
      setStaged([]);
      if (useCustomBuilding && customBuilding.trim()) {
        setSelectedBuilding(customBuilding.trim());
        setUseCustomBuilding(false);
        setCustomBuilding('');
      }
      setFeedback({
        type: 'success',
        text: `บันทึกข้อมูลการล้างวันที่ ${formatThaiDate(date)} เรียบร้อยแล้ว`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'บันทึกข้อมูลไม่สำเร็จ',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white border border-[#DCE4EE] rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#1E293B]">กรอกงานล้างเครื่องปรับอากาศประจำวัน</h1>
            <p className="text-sm text-[#64748B] mt-0.5">
              เลือกวันที่และอาคาร ดึงเครื่องจากระบบหรือเพิ่มเครื่องใหม่ (ข้อมูลใหม่จะถูกจัดเรียงต่อท้ายแยกตามอาคารอัตโนมัติ)
            </p>
          </div>
          <div className="bg-[#F2F6FA] border border-[#D4E2EE] rounded-lg px-4 py-2.5 text-xs text-[#254B66] tabular-nums">
            <span className="font-semibold">
              ยอดงานของ{' '}
              {user.role === 'technician'
                ? user.fullName
                : selectableTechnicians.find((t) => t.id === effectiveTechnicianId)?.fullName ||
                  user.fullName}
              :
            </span>{' '}
            วันนี้ล้างแล้ว {myTodayStats.todayCleaned} เครื่อง (สะสมทั้งหมด {myTodayStats.allTimeCleaned}{' '}
            เครื่อง)
          </div>
        </div>

        <div
          className={`grid gap-4 pt-2 border-t border-[#E8EEF4] ${
            deviceMode === 'mobile' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'
          }`}
        >
          <div className="space-y-1.5">
            <label htmlFor="daily-date" className="block text-xs font-medium text-[#475569]">
              วันที่เข้าล้าง
            </label>
            <input
              id="daily-date"
              type="date"
              value={date}
              min={isCurrentMonthOnly ? currentMonthRange.startDate : undefined}
              max={isCurrentMonthOnly ? currentMonthRange.endDate : undefined}
              onChange={(e) => setDate(e.target.value)}
              className={`w-full ${
                isTouchMode ? 'h-11' : 'h-10'
              } px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm text-[#1E293B] focus:outline-none focus:border-[#4A7C9B]`}
            />
            {isCurrentMonthOnly && (
              <p className="text-[11px] text-[#8C5E26]">
                จำกัดสิทธิ์: บันทึกได้เฉพาะเดือน{' '}
                {formatThaiMonthYear(Number(today.slice(0, 4)), Number(today.slice(5, 7)))} เท่านั้น
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="daily-building" className="block text-xs font-medium text-[#475569]">
                อาคารที่เข้าล้าง
              </label>
              <button
                type="button"
                onClick={() => setUseCustomBuilding((v) => !v)}
                className="text-xs text-[#4A7C9B] hover:underline cursor-pointer"
              >
                {useCustomBuilding ? 'เลือกจากอาคารที่มีอยู่' : '+ พิมพ์ชื่ออาคารใหม่'}
              </button>
            </div>
            {useCustomBuilding ? (
              <input
                id="daily-building"
                type="text"
                value={customBuilding}
                onChange={(e) => setCustomBuilding(e.target.value)}
                placeholder="ระบุชื่ออาคารใหม่..."
                className={`w-full ${
                  isTouchMode ? 'h-11' : 'h-10'
                } px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm text-[#1E293B] focus:outline-none focus:border-[#4A7C9B]`}
              />
            ) : (
              <select
                id="daily-building"
                value={selectedBuilding}
                onChange={(e) => {
                  setSelectedBuilding(e.target.value);
                  setFloorFilter('all');
                }}
                className={`w-full ${
                  isTouchMode ? 'h-11' : 'h-10'
                } px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm text-[#1E293B] focus:outline-none focus:border-[#4A7C9B]`}
              >
                {buildings.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="daily-tech" className="block text-xs font-medium text-[#475569]">
              ช่างเทคนิคผู้ปฏิบัติงาน
            </label>
            {user.role === 'technician' ? (
              <input
                id="daily-tech"
                type="text"
                readOnly
                value={`${user.fullName} (ล็อกอินตามชื่อผู้ใช้งาน)`}
                className={`w-full ${
                  isTouchMode ? 'h-11' : 'h-10'
                } px-3 rounded-lg border border-[#DCE4EE] bg-[#F8FAFC] text-sm text-[#475569]`}
              />
            ) : (
              <select
                id="daily-tech"
                value={effectiveTechnicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
                className={`w-full ${
                  isTouchMode ? 'h-11' : 'h-10'
                } px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm text-[#1E293B] focus:outline-none focus:border-[#4A7C9B]`}
              >
                {selectableTechnicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                    {t.phone ? ` (${t.phone})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`px-4 py-3 rounded-xl border text-sm ${
            feedback.type === 'success'
              ? 'bg-[#ECF6F1] border-[#C6E2D2] text-[#25593E]'
              : 'bg-[#FDF0F2] border-[#F3CCD3] text-[#9D3E4E]'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Main Split Workspace */}
      <div
        className={`grid gap-6 items-start ${
          deviceMode === 'desktop' ? 'grid-cols-1 xl:grid-cols-12' : 'grid-cols-1'
        }`}
      >
        {/* Left: Pull Existing Units + Add Manual Unit */}
        <div className={`${deviceMode === 'desktop' ? 'xl:col-span-7' : ''} space-y-6`}>
          {/* Pull Existing Units */}
          <div className="bg-white border border-[#DCE4EE] rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#1E293B]">
                  1. ดึงข้อมูลเครื่องปรับอากาศจากทะเบียนในระบบ
                </h2>
                <p className="text-xs text-[#64748B]">
                  อาคาร: {activeBuilding || '-'} · เหลือที่ยังไม่บันทึกเดือนนี้{' '}
                  {filteredBuildingUnits.length} เครื่อง
                  {loggedInMonthCountInBuilding > 0 &&
                    ` (ซ่อนที่บันทึกเดือนนี้แล้ว ${loggedInMonthCountInBuilding} เครื่อง)`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="สถานะเริ่มต้นเมื่อเลือก"
                  value={defaultStatus}
                  onChange={(e) => setDefaultStatus(e.target.value as CleaningStatus)}
                  className="h-9 px-2.5 rounded-lg border border-[#CBD5E1] bg-white text-xs text-[#1E293B]"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      สถานะ: {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addAllFilteredUnits}
                  disabled={filteredBuildingUnits.length === 0}
                  className="h-9 px-3 rounded-lg bg-[#EAF2F8] hover:bg-[#DCE9F4] text-[#2F5A78] text-xs font-medium whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  เพิ่มทั้งหมดที่แสดง
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาห้อง หรือ หมายเลขเครื่อง..."
                  className={`w-full ${isTouchMode ? 'h-10' : 'h-9'} pl-9 pr-3 rounded-lg border border-[#CBD5E1] text-sm`}
                />
              </div>
              <select
                aria-label="กรองตามชั้น"
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value)}
                className={`${isTouchMode ? 'h-10' : 'h-9'} px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm`}
              >
                <option value="all">ทุกชั้น</option>
                {floorsInBuilding.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            {loggedInMonthCountInBuilding > 0 && (
              <label className="inline-flex items-center gap-2 text-xs text-[#475569] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showLoggedInMonth}
                  onChange={(e) => setShowLoggedInMonth(e.target.checked)}
                  className="rounded border-[#CBD5E1]"
                />
                <span>
                  แสดงเครื่องที่ถูกบันทึกในเดือนนี้แล้วด้วย ({loggedInMonthCountInBuilding} เครื่อง)
                </span>
              </label>
            )}

            {filteredBuildingUnits.length === 0 ? (
              <div className="py-8 text-center text-sm text-[#64748B] bg-[#F8FAFC] rounded-lg border border-dashed border-[#DCE4EE]">
                {buildingUnits.length > 0 && loggedInMonthCountInBuilding === buildingUnits.length && !showLoggedInMonth
                  ? 'เครื่องปรับอากาศทั้งหมดในอาคารนี้ถูกบันทึกข้อมูลในเดือนนี้ครบแล้ว'
                  : 'ไม่พบเครื่องปรับอากาศตามเงื่อนไข ท่านสามารถเปิดฟอร์มด้านล่างเพื่อเพิ่มเครื่องใหม่ได้'}
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto border border-[#E2E8F0] rounded-lg divide-y divide-[#F1F5F9]">
                {filteredBuildingUnits.map((u) => {
                  const isStaged = staged.some(
                    (s) => s.mode === 'existing' && s.unitId === u.id
                  );
                  const existingToday = loggedTodayMap.get(u.id);
                  const existingMonth = getMonthLogForUnit(u);
                  return (
                    <div
                      key={u.id}
                      className={`px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${
                        isStaged ? 'bg-[#F0F7FB]' : 'hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 text-sm font-medium text-[#1E293B]">
                          <span className="font-mono-tabular text-[#3B6684]">{u.unitCode}</span>
                          <span className="text-[#94A3B8]">·</span>
                          <span className="truncate">{u.room}</span>
                        </div>
                        <div className="text-xs text-[#64748B]">
                          {[
                            u.floor ? `ชั้น ${u.floor}` : '',
                            u.acType === 'vrf' ? 'VRF / VRV' : 'แอร์ปกติ',
                            u.model || '',
                            u.btu ? `${u.btu} BTU` : '',
                            u.installType || '',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                          {existingToday ? (
                            <span className="ml-2 text-[#3C7356] font-medium">
                              (บันทึกวันนี้แล้ว: {CLEANING_STATUS_LABELS[existingToday.status]})
                            </span>
                          ) : existingMonth ? (
                            <span className="ml-2 text-[#4A7C9B] font-medium">
                              (บันทึกเดือนนี้แล้ว: {formatThaiDate(existingMonth.date, true)})
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div
                        className={`${
                          deviceMode === 'mobile'
                            ? 'grid grid-cols-2 gap-1.5 w-full'
                            : 'flex items-center gap-1.5 shrink-0'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => addExistingUnitToStage(u, 'cleaned')}
                          className={`${
                            deviceMode === 'mobile' ? 'h-9' : 'h-8'
                          } px-2.5 rounded-md bg-[#ECF6F1] hover:bg-[#DCEEE4] text-[#25593E] text-xs font-medium cursor-pointer`}
                        >
                          ล้างแล้ว
                        </button>
                        <button
                          type="button"
                          onClick={() => addExistingUnitToStage(u, 'patient_occupied')}
                          className={`${
                            deviceMode === 'mobile' ? 'h-9' : 'h-8'
                          } px-2.5 rounded-md bg-[#FDF6EC] hover:bg-[#F9EBD6] text-[#8C5E26] text-xs font-medium cursor-pointer`}
                        >
                          คนไข้
                        </button>
                        <button
                          type="button"
                          onClick={() => addExistingUnitToStage(u, 'renovation')}
                          className={`${
                            deviceMode === 'mobile' ? 'h-9' : 'h-8'
                          } px-2.5 rounded-md bg-[#F3F0FA] hover:bg-[#E7E1F5] text-[#5B4B85] text-xs font-medium cursor-pointer`}
                        >
                          ปรับปรุง
                        </button>
                        <button
                          type="button"
                          onClick={() => addExistingUnitToStage(u, 'no_card')}
                          className={`${
                            deviceMode === 'mobile' ? 'h-9' : 'h-8'
                          } px-2.5 rounded-md bg-[#FDF0F2] hover:bg-[#F9E0E5] text-[#9D3E4E] text-xs font-medium cursor-pointer`}
                        >
                          ไม่มีการ์ด
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add New Manual AC Unit (Shown only when user chooses) */}
          {!showManualUnitForm ? (
            <div className="bg-white border border-[#DCE4EE] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[#1E293B]">
                  2. เพิ่มเครื่องปรับอากาศใหม่ด้วยตนเอง (ต่อท้ายตามอาคาร)
                </h2>
                <p className="text-xs text-[#64748B]">
                  กดเปิดฟอร์มเฉพาะกรณีพบเครื่องปรับอากาศใหม่ที่ยังไม่มีในทะเบียนของอาคาร{' '}
                  <span className="font-medium text-[#1E293B]">{activeBuilding || '-'}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowManualUnitForm(true)}
                className="h-9 px-3.5 rounded-lg bg-[#EAF2F8] hover:bg-[#DCE9F4] text-[#2F5A78] text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มเครื่องใหม่ด้วยตนเอง</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleAddManualUnit}
              className="bg-white border border-[#DCE4EE] rounded-xl p-5 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[#1E293B]">
                    2. เพิ่มเครื่องปรับอากาศใหม่ด้วยตนเอง (ต่อท้ายตามอาคาร)
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    หากหน้างานมีเครื่องปรับอากาศที่ยังไม่อยู่ในทะเบียน กรอกข้อมูลด้านล่าง ระบบจะบันทึกงานล้างและเพิ่มเข้าทะเบียนต่อท้ายของอาคาร{' '}
                    <span className="font-medium text-[#1E293B]">{activeBuilding || '-'}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowManualUnitForm(false)}
                  className="h-8 px-2.5 rounded-lg border border-[#CBD5E1] text-xs text-[#475569] hover:bg-[#F8FAFC] flex items-center gap-1 whitespace-nowrap cursor-pointer shrink-0"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>ซ่อนฟอร์ม</span>
                </button>
              </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">ชั้น *</label>
                <input
                  type="text"
                  value={manualFloor}
                  onChange={(e) => setManualFloor(e.target.value)}
                  placeholder="เช่น 1 หรือ B"
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">ห้อง *</label>
                <input
                  type="text"
                  value={manualRoom}
                  onChange={(e) => setManualRoom(e.target.value)}
                  placeholder="เช่น ห้องตรวจ 4"
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">หมายเลขเครื่อง *</label>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="เช่น 11/21"
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm font-mono-tabular"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">ประเภทแอร์</label>
                <select
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value as ACType)}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm"
                >
                  <option value="normal">แอร์ปกติ</option>
                  <option value="vrf">VRF / VRV</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">ขนาด (BTU)</label>
                <input
                  type="text"
                  value={manualBtu}
                  onChange={(e) => setManualBtu(e.target.value)}
                  placeholder="18,000"
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">สถานะการเข้าล้าง</label>
                <select
                  value={manualStatus}
                  onChange={(e) => setManualStatus(e.target.value as CleaningStatus)}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">ยี่ห้อ (ถ้ามี)</label>
                <input
                  type="text"
                  value={manualBrand}
                  onChange={(e) => setManualBrand(e.target.value)}
                  placeholder="เช่น MITSUBISHI, DAIKIN"
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">รุ่น (Model)</label>
                <input
                  type="text"
                  value={manualModel}
                  onChange={(e) => setManualModel(e.target.value)}
                  placeholder="เช่น MU-GK13VA"
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">ลักษณะการติดตั้ง</label>
                <input
                  type="text"
                  value={manualInstallType}
                  onChange={(e) => setManualInstallType(e.target.value)}
                  placeholder="เช่น ติดผนัง, 4 ทิศทาง, เปลือย"
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">หมายเหตุ</label>
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="รายละเอียดเพิ่มเติม..."
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="h-9 px-4 rounded-lg bg-[#EAF2F8] hover:bg-[#DCE9F4] text-[#2F5A78] text-sm font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                เพิ่มเข้ารายการรอการบันทึก
              </button>
            </div>
            </form>
          )}
        </div>

        {/* Right: Staged Queue Ready to Save */}
        <div
          className={`${
            deviceMode === 'desktop' ? 'xl:col-span-5 sticky top-4' : ''
          } bg-white border border-[#DCE4EE] rounded-xl p-5 space-y-4`}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[#1E293B]">
                รายการที่เลือกสำหรับบันทึก ({staged.length})
              </h2>
              <p className="text-xs text-[#64748B]">
                วันที่ {formatThaiDate(date)} · ตรวจสอบสถานะก่อนกดบันทึก
              </p>
            </div>
            {staged.length > 0 && (
              <button
                type="button"
                onClick={() => setStaged([])}
                className="text-xs text-[#9D3E4E] hover:underline cursor-pointer"
              >
                ล้างคิวทั้งหมด
              </button>
            )}
          </div>

          {staged.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#64748B] bg-[#F8FAFC] rounded-lg border border-dashed border-[#DCE4EE]">
              ยังไม่มีรายการในคิว กรุณาเลือกเครื่องจากฝั่งซ้าย หรือเพิ่มเครื่องใหม่
            </div>
          ) : (
            <div className="max-h-[460px] overflow-y-auto space-y-2.5 pr-1">
              {staged.map((item, idx) => (
                <div
                  key={item.tempKey}
                  className="p-3 rounded-lg border border-[#E2E8F0] bg-[#FAFBFD] space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#1E293B] flex items-center gap-2">
                        <span className="text-xs text-[#64748B] tabular-nums">{idx + 1}.</span>
                        <span className="font-mono-tabular text-[#3B6684]">{item.unitCode}</span>
                        {item.mode === 'new' && (
                          <span className="text-xs font-medium text-[#4A7C9B]">(เครื่องใหม่)</span>
                        )}
                      </div>
                      <div className="text-xs text-[#64748B]">
                        {item.building} · {item.floor} · {item.room} ·{' '}
                        {item.acType === 'vrf' ? 'VRF/VRV' : 'ปกติ'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setStaged((prev) => prev.filter((s) => s.tempKey !== item.tempKey))
                      }
                      aria-label="ลบออกจากคิว"
                      className="p-1 text-[#94A3B8] hover:text-[#9D3E4E] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      aria-label="สถานะการล้าง"
                      value={item.status}
                      onChange={(e) => {
                        const val = e.target.value as CleaningStatus;
                        setStaged((prev) =>
                          prev.map((s) =>
                            s.tempKey === item.tempKey ? { ...s, status: val } : s
                          )
                        );
                      }}
                      className="h-8 px-2.5 rounded-md border border-[#CBD5E1] bg-white text-xs text-[#1E293B]"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={item.notes || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStaged((prev) =>
                          prev.map((s) =>
                            s.tempKey === item.tempKey ? { ...s, notes: val } : s
                          )
                        );
                      }}
                      placeholder="หมายเหตุ..."
                      className="h-8 px-2.5 rounded-md border border-[#CBD5E1] bg-white text-xs text-[#1E293B]"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving || staged.length === 0}
            className="w-full h-11 rounded-lg bg-[#4A7C9B] hover:bg-[#3C6884] text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              'กำลังบันทึกข้อมูล...'
            ) : (
              <>
                <Save className="w-4 h-4" />
                บันทึกงานล้าง ({staged.length} รายการ)
              </>
            )}
          </button>

          {/* Summary of today's already saved logs */}
          {logs.filter((l) => l.date === date).length > 0 && (
            <div className="pt-3 border-t border-[#E8EEF4] space-y-2">
              <div className="text-xs font-semibold text-[#334155] flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#3C7356]" />
                รายการที่บันทึกแล้วในวันที่ {formatThaiDate(date, true)} (
                {logs.filter((l) => l.date === date).length} รายการ)
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 text-xs text-[#475569]">
                {logs
                  .filter((l) => l.date === date)
                  .slice(0, 20)
                  .map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between gap-2 py-1 border-b border-[#F1F5F9]"
                    >
                      <span className="truncate">
                        <span className="font-mono-tabular font-medium text-[#1E293B]">
                          {l.unitCode}
                        </span>{' '}
                        · {l.room} ({l.technicianName})
                      </span>
                      <span className="shrink-0 text-[#3C7356]">
                        {CLEANING_STATUS_LABELS[l.status]}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
