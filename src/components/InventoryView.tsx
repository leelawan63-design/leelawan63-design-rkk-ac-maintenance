import React, { useMemo, useRef, useState } from 'react';
import {
  Plus,
  Upload,
  Download,
  Pencil,
  Trash2,
  Search,
  X,
} from 'lucide-react';
import type { ACType, ACUnit, ACUnitStatus } from '../types';
import { computeBuildingFloorInventory, computeContractCounts } from '../lib/reportCalc';
import {
  downloadInventoryImportTemplate,
  parseInventoryExcelFile,
} from '../lib/excelExport';
import { useDeviceMode } from '../lib/deviceMode';

interface InventoryViewProps {
  units: ACUnit[];
  onCreateUnit: (payload: Partial<ACUnit>) => Promise<void>;
  onUpdateUnit: (id: string, payload: Partial<ACUnit>) => Promise<void>;
  onDeleteUnit: (id: string) => Promise<void>;
  onImportUnits: (
    rows: Array<Record<string, string>>,
    replaceAll: boolean
  ) => Promise<{ addedCount: number; updatedCount: number }>;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  units,
  onCreateUnit,
  onUpdateUnit,
  onDeleteUnit,
  onImportUnits,
}) => {
  const { deviceMode } = useDeviceMode();
  const [subTab, setSubTab] = useState<'list' | 'summary'>('list');
  const [buildingFilter, setBuildingFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'cancelled'>('all');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<ACUnit | null>(null);
  const [formBuilding, setFormBuilding] = useState('');
  const [formFloor, setFormFloor] = useState('1');
  const [formRoom, setFormRoom] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formType, setFormType] = useState<ACType>('normal');
  const [formBtu, setFormBtu] = useState('18,000');
  const [formBrand, setFormBrand] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formInstallType, setFormInstallType] = useState('');
  const [formStatus, setFormStatus] = useState<ACUnitStatus>('active');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [deletingUnit, setDeletingUnit] = useState<ACUnit | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const contract = useMemo(() => computeContractCounts(units), [units]);
  const floorInv = useMemo(() => computeBuildingFloorInventory(units), [units]);

  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      if (buildingFilter !== 'all' && u.building !== buildingFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          u.building.toLowerCase().includes(q) ||
          u.floor.toLowerCase().includes(q) ||
          u.room.toLowerCase().includes(q) ||
          u.unitCode.toLowerCase().includes(q) ||
          u.brand.toLowerCase().includes(q) ||
          (u.model || '').toLowerCase().includes(q) ||
          (u.installType || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [units, buildingFilter, statusFilter, search]);

  const openCreateModal = () => {
    setEditingUnit(null);
    setFormBuilding(contract.buildings[0] || '');
    setFormFloor('1');
    setFormRoom('');
    setFormCode('');
    setFormType('normal');
    setFormBtu('18,000');
    setFormBrand('');
    setFormModel('');
    setFormInstallType('');
    setFormStatus('active');
    setFormNotes('');
    setFeedback(null);
    setModalOpen(true);
  };

  const openEditModal = (u: ACUnit) => {
    setEditingUnit(u);
    setFormBuilding(u.building);
    setFormFloor(u.floor);
    setFormRoom(u.room);
    setFormCode(u.unitCode);
    setFormType(u.acType);
    setFormBtu(u.btu);
    setFormBrand(u.brand);
    setFormModel(u.model || '');
    setFormInstallType(u.installType || '');
    setFormStatus(u.status);
    setFormNotes(u.notes);
    setFeedback(null);
    setModalOpen(true);
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBuilding.trim() || !formFloor.trim() || !formRoom.trim() || !formCode.trim()) {
      setFeedback({
        type: 'error',
        text: 'กรุณากรอก อาคาร ชั้น ห้อง และหมายเลขเครื่อง ให้ครบถ้วน',
      });
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<ACUnit> = {
        building: formBuilding.trim(),
        floor: formFloor.trim(),
        room: formRoom.trim(),
        unitCode: formCode.trim(),
        acType: formType,
        btu: formBtu.trim(),
        brand: formBrand.trim(),
        model: formModel.trim(),
        installType: formInstallType.trim(),
        status: formStatus,
        notes: formNotes.trim(),
      };
      if (editingUnit) {
        await onUpdateUnit(editingUnit.id, payload);
        setFeedback({ type: 'success', text: 'อัปเดตข้อมูลเครื่องปรับอากาศเรียบร้อย' });
      } else {
        await onCreateUnit(payload);
        setFeedback({ type: 'success', text: 'เพิ่มเครื่องปรับอากาศเข้าทะเบียนเรียบร้อย' });
      }
      setModalOpen(false);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    try {
      const rows = await parseInventoryExcelFile(file);
      if (rows.length === 0) {
        setFeedback({
          type: 'error',
          text: 'ไม่พบแถวข้อมูลที่มี อาคาร ห้อง และหมายเลขเครื่อง ในไฟล์ Excel',
        });
        return;
      }
      const res = await onImportUnits(rows, false);
      setFeedback({
        type: 'success',
        text: `นำเข้าข้อมูล Excel สำเร็จ: เพิ่มใหม่ ${res.addedCount} เครื่อง · อัปเดต ${res.updatedCount} เครื่อง`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'ไม่สามารถอ่านไฟล์ Excel ได้',
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-[#DCE4EE] rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#1E293B]">
              ทะเบียนเครื่องปรับอากาศทั้งหมดทุกชั้นทุกอาคาร
            </h1>
            <p className="text-sm text-[#64748B] mt-0.5">
              ห้อง / หมายเลขเครื่องต้องระบุให้ครบตามจำนวน · เครื่องที่สถานะ &ldquo;ยกเลิก&rdquo; จะไม่ถูกนับรวมในยอดสัญญา
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleExcelImport}
              className="hidden"
            />
            <button
              type="button"
              onClick={downloadInventoryImportTemplate}
              className="h-9 px-3 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-medium text-[#475569] flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              โหลดแบบฟอร์ม Excel
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-9 px-3 rounded-lg bg-[#EAF5EF] hover:bg-[#DCEEE4] border border-[#C6E2D2] text-xs font-medium text-[#2F6A4E] flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              นำเข้าจากไฟล์ Excel
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="h-9 px-4 rounded-lg bg-[#4A7C9B] hover:bg-[#3C6884] text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              เพิ่มเครื่องปรับอากาศ
            </button>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#E8EEF4]">
          <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="text-xs text-[#64748B]">แอร์ทั้งหมดในสัญญา (ไม่รวมยกเลิก)</div>
            <div className="text-xl font-bold text-[#1E293B] tabular-nums mt-0.5">
              {contract.totalActive} เครื่อง
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#F4F8FB] border border-[#DCE7F0]">
            <div className="text-xs text-[#3B6684]">แอร์ปกติ</div>
            <div className="text-xl font-bold text-[#254B66] tabular-nums mt-0.5">
              {contract.normalActive} เครื่อง
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#F4FAF6] border border-[#D4E9DC]">
            <div className="text-xs text-[#3C7356]">VRF / VRV</div>
            <div className="text-xl font-bold text-[#25593E] tabular-nums mt-0.5">
              {contract.vrfActive} เครื่อง
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="text-xs text-[#64748B]">เครื่องที่ยกเลิก (ไม่นับรวม)</div>
            <div className="text-xl font-bold text-[#64748B] tabular-nums mt-0.5">
              {contract.cancelledCount} เครื่อง
            </div>
          </div>
        </div>

        {/* Sub-view Switch & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="inline-flex p-1 rounded-lg bg-[#F1F5F9] self-start">
            <button
              type="button"
              onClick={() => setSubTab('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                subTab === 'list' ? 'bg-white text-[#1E293B] shadow-sm' : 'text-[#64748B]'
              }`}
            >
              รายชื่อเครื่องทั้งหมด ({filteredUnits.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('summary')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                subTab === 'summary' ? 'bg-white text-[#1E293B] shadow-sm' : 'text-[#64748B]'
              }`}
            >
              สรุปจำนวนทุกชั้นทุกอาคาร
            </button>
          </div>

          {subTab === 'list' && (
            <div
              className={`flex gap-2 ${
                deviceMode === 'mobile' ? 'flex-col w-full' : 'flex-wrap items-center'
              }`}
            >
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหาห้อง / รหัสเครื่อง..."
                  className={`h-9 pl-8 pr-3 rounded-lg border border-[#CBD5E1] text-xs ${
                    deviceMode === 'mobile' ? 'w-full' : ''
                  }`}
                />
              </div>
              <div className={deviceMode === 'mobile' ? 'grid grid-cols-2 gap-2' : 'flex gap-2'}>
                <select
                  value={buildingFilter}
                  onChange={(e) => setBuildingFilter(e.target.value)}
                  className="h-9 px-2.5 rounded-lg border border-[#CBD5E1] bg-white text-xs w-full sm:w-auto"
                >
                  <option value="all">ทุกอาคาร</option>
                  {contract.buildings.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'cancelled')}
                  className="h-9 px-2.5 rounded-lg border border-[#CBD5E1] bg-white text-xs w-full sm:w-auto"
                >
                  <option value="all">ทุกสถานะ</option>
                  <option value="active">ใช้งานในสัญญา</option>
                  <option value="cancelled">ยกเลิก (ไม่นับรวม)</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`px-4 py-3 rounded-xl border text-sm ${
            feedback.type === 'success'
              ? 'bg-[#ECF6F1] border-[#C6E2D2] text-[#25593E]'
              : 'bg-[#FDF0F2] border-[#F3CCD3] text-[#9D3E4E]'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {subTab === 'list' ? (
        deviceMode === 'mobile' ? (
          <div className="space-y-2.5">
            {filteredUnits.length === 0 ? (
              <div className="bg-white border border-[#DCE4EE] rounded-xl py-10 text-center text-sm text-[#64748B]">
                ไม่พบเครื่องปรับอากาศตามเงื่อนไขที่ค้นหา
              </div>
            ) : (
              filteredUnits.map((u) => (
                <div
                  key={u.id}
                  className={`rounded-xl border border-[#DCE4EE] p-3.5 space-y-2 ${
                    u.status === 'cancelled' ? 'bg-[#F8FAFC] opacity-75' : 'bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono-tabular font-semibold text-sm text-[#3B6684]">
                          {u.unitCode}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569]">
                          {u.acType === 'vrf' ? 'VRF / VRV' : 'แอร์ปกติ'}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-[#1E293B] mt-0.5">{u.room}</div>
                      <div className="text-xs text-[#64748B]">
                        {u.building} · ชั้น {u.floor}
                      </div>
                    </div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium shrink-0 ${
                        u.status === 'cancelled'
                          ? 'bg-[#E2E8F0] text-[#64748B]'
                          : 'bg-[#ECF6F1] text-[#25593E]'
                      }`}
                    >
                      {u.status === 'cancelled' ? 'ยกเลิก' : 'ใช้งาน'}
                    </span>
                  </div>

                  <div className="text-xs text-[#64748B]">
                    {[u.model, u.btu ? `${u.btu} BTU` : '', u.brand, u.installType]
                      .filter(Boolean)
                      .join(' · ') || 'ไม่ระบุรายละเอียดรุ่น/ขนาด'}
                  </div>

                  <div className="flex justify-end gap-1.5 pt-2 border-t border-[#EEF2F6]">
                    <button
                      type="button"
                      onClick={() => openEditModal(u)}
                      className="h-8 px-2.5 rounded-lg border border-[#DCE4EE] text-[#4A7C9B] bg-[#F8FAFC] text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      แก้ไข
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingUnit(u)}
                      className="h-8 px-2.5 rounded-lg border border-[#F3CCD3] text-[#9D3E4E] bg-[#FDF0F2] text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      ลบ
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="bg-white border border-[#DCE4EE] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-[#F4F7FA] border-b border-[#DCE4EE] text-xs text-[#475569]">
                  <tr>
                    <th className="py-3 px-4 text-left font-semibold">ลำดับ</th>
                    <th className="py-3 px-4 text-left font-semibold">อาคาร</th>
                    <th className="py-3 px-4 text-left font-semibold">ชั้น</th>
                    <th className="py-3 px-4 text-left font-semibold">ห้อง</th>
                    <th className="py-3 px-4 text-left font-semibold">หมายเลขเครื่อง</th>
                    <th className="py-3 px-4 text-left font-semibold">ประเภทแอร์</th>
                    <th className="py-3 px-4 text-left font-semibold">รุ่น / BTU / ยี่ห้อ / ลักษณะ</th>
                    <th className="py-3 px-4 text-left font-semibold">สถานะ</th>
                    <th className="py-3 px-4 text-right font-semibold">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F6]">
                  {filteredUnits.map((u, idx) => (
                    <tr
                      key={u.id}
                      className={
                        u.status === 'cancelled'
                          ? 'bg-[#F8FAFC] text-[#94A3B8]'
                          : 'hover:bg-[#F8FAFC]'
                      }
                    >
                      <td className="py-2.5 px-4 tabular-nums text-xs text-[#64748B]">{idx + 1}</td>
                      <td className="py-2.5 px-4 font-medium">{u.building}</td>
                      <td className="py-2.5 px-4 whitespace-nowrap">{u.floor}</td>
                      <td className="py-2.5 px-4">{u.room}</td>
                      <td className="py-2.5 px-4 font-mono-tabular font-medium text-[#3B6684] whitespace-nowrap">
                        {u.unitCode}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap text-xs">
                        {u.acType === 'vrf' ? 'VRF / VRV' : 'แอร์ปกติ'}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-[#64748B]">
                        {[u.model, u.btu ? `${u.btu} BTU` : '', u.brand, u.installType]
                          .filter(Boolean)
                          .join(' · ') || '-'}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            u.status === 'cancelled'
                              ? 'bg-[#E2E8F0] text-[#64748B]'
                              : 'bg-[#ECF6F1] text-[#25593E]'
                          }`}
                        >
                          {u.status === 'cancelled' ? 'ยกเลิก' : 'ใช้งาน'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            className="p-1.5 rounded-md text-[#4A7C9B] hover:bg-[#EAF2F8] cursor-pointer"
                            aria-label="แก้ไข"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingUnit(u)}
                            className="p-1.5 rounded-md text-[#9D3E4E] hover:bg-[#FDF0F2] cursor-pointer"
                            aria-label="ลบ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="bg-white border border-[#DCE4EE] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-[#F4F7FA] border-b border-[#DCE4EE] text-xs text-[#475569]">
                <tr>
                  <th className="py-3 px-4 text-left font-semibold">อาคาร</th>
                  <th className="py-3 px-4 text-left font-semibold">ชั้น</th>
                  <th className="py-3 px-4 text-right font-semibold">แอร์ปกติ (เครื่อง)</th>
                  <th className="py-3 px-4 text-right font-semibold">VRF / VRV (เครื่อง)</th>
                  <th className="py-3 px-4 text-right font-semibold">รวมใช้งาน (เครื่อง)</th>
                  <th className="py-3 px-4 text-right font-semibold">ยกเลิก (ไม่นับรวม)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F6]">
                {floorInv.buildings.map((b) => (
                  <React.Fragment key={b.building}>
                    {b.floors.map((f) => (
                      <tr key={`${b.building}-${f.floor}`} className="hover:bg-[#F8FAFC]">
                        <td className="py-2.5 px-4 text-[#334155]">{f.building}</td>
                        <td className="py-2.5 px-4 text-[#334155]">{f.floor}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{f.normalActive}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{f.vrfActive}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-[#1E293B]">
                          {f.totalActive}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-[#64748B]">
                          {f.cancelledCount}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[#F2F6FA] font-semibold text-[#254B66]">
                      <td className="py-2.5 px-4">รวม {b.building}</td>
                      <td className="py-2.5 px-4">{b.floors.length} ชั้น</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{b.normalActive}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{b.vrfActive}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{b.totalActive}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-[#64748B]">
                        {b.cancelledCount}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
                <tr className="bg-[#E6EFF7] font-bold text-[#1E293B]">
                  <td className="py-3 px-4">รวมทั้งหมดทุกอาคาร</td>
                  <td className="py-3 px-4 tabular-nums">{floorInv.grandTotal.floorCount} ชั้น</td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    {floorInv.grandTotal.normalActive}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    {floorInv.grandTotal.vrfActive}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    {floorInv.grandTotal.totalActive}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-[#64748B]">
                    {floorInv.grandTotal.cancelledCount}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
          <form
            onSubmit={handleSaveUnit}
            className="w-full max-w-lg bg-white border border-[#DCE4EE] rounded-xl p-6 space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#1E293B]">
                {editingUnit ? `แก้ไขข้อมูลเครื่อง ${editingUnit.unitCode}` : 'เพิ่มเครื่องปรับอากาศใหม่'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-[#64748B] hover:text-[#1E293B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="block text-xs font-medium text-[#475569]">อาคาร *</label>
                <input
                  type="text"
                  list="building-datalist"
                  value={formBuilding}
                  onChange={(e) => setFormBuilding(e.target.value)}
                  placeholder="ระบุหรือเลือกชื่ออาคาร"
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                />
                <datalist id="building-datalist">
                  {contract.buildings.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">ชั้น *</label>
                <input
                  type="text"
                  value={formFloor}
                  onChange={(e) => setFormFloor(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">ห้อง *</label>
                <input
                  type="text"
                  value={formRoom}
                  onChange={(e) => setFormRoom(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">หมายเลขเครื่อง *</label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm font-mono-tabular"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">ประเภทแอร์</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as ACType)}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm"
                >
                  <option value="normal">แอร์ปกติ</option>
                  <option value="vrf">VRF / VRV</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">BTU</label>
                <input
                  type="text"
                  value={formBtu}
                  onChange={(e) => setFormBtu(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">ยี่ห้อ</label>
                <input
                  type="text"
                  value={formBrand}
                  onChange={(e) => setFormBrand(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">รุ่น (Model)</label>
                <input
                  type="text"
                  value={formModel}
                  onChange={(e) => setFormModel(e.target.value)}
                  placeholder="เช่น MU-GK13VA"
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">ลักษณะการติดตั้ง</label>
                <input
                  type="text"
                  value={formInstallType}
                  onChange={(e) => setFormInstallType(e.target.value)}
                  placeholder="เช่น ติดผนัง, 4 ทิศทาง"
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">สถานะ</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as ACUnitStatus)}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm"
                >
                  <option value="active">ใช้งานในสัญญา</option>
                  <option value="cancelled">ยกเลิก (ไม่นับรวม)</option>
                </select>
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="block text-xs font-medium text-[#475569]">หมายเหตุ</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="h-9 px-4 rounded-lg border border-[#CBD5E1] text-sm text-[#475569] cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-9 px-4 rounded-lg bg-[#4A7C9B] text-white text-sm font-medium cursor-pointer disabled:opacity-50"
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
          <div className="w-full max-w-md bg-white border border-[#DCE4EE] rounded-xl p-6 space-y-4 shadow-lg">
            <h3 className="text-base font-semibold text-[#1E293B]">ยืนยันลบเครื่องปรับอากาศ</h3>
            <p className="text-sm text-[#475569]">
              ต้องการลบ <span className="font-mono-tabular font-semibold">{deletingUnit.unitCode}</span>{' '}
              ({deletingUnit.building} · {deletingUnit.room}) ออกจากทะเบียนใช่หรือไม่?
              (หากต้องการเก็บประวัติไว้โดยไม่นับรวม แนะนำให้เปลี่ยนสถานะเป็น &ldquo;ยกเลิก&rdquo;)
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingUnit(null)}
                className="h-9 px-4 rounded-lg border border-[#CBD5E1] text-sm text-[#475569]"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onDeleteUnit(deletingUnit.id);
                  setDeletingUnit(null);
                }}
                className="h-9 px-4 rounded-lg bg-[#B05566] text-white text-sm font-medium"
              >
                ยืนยันลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
