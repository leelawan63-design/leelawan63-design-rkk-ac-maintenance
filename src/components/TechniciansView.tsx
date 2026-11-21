import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UserPlus, Search, Pencil, Trash2, X, Phone, KeyRound, CheckCircle2 } from 'lucide-react';
import type { CleaningLog, UserAccount } from '../types';
import { ROLE_LABELS } from '../types';
import { api, type TechnicianOption } from '../lib/api';
import { useDeviceMode } from '../lib/deviceMode';

interface TechniciansViewProps {
  currentUser: UserAccount;
  logs: CleaningLog[];
  onTechniciansChanged: () => void | Promise<void>;
}

export const TechniciansView: React.FC<TechniciansViewProps> = ({
  currentUser,
  logs,
  onTechniciansChanged,
}) => {
  const { deviceMode } = useDeviceMode();
  const [techs, setTechs] = useState<TechnicianOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTech, setEditingTech] = useState<TechnicianOption | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [canLogin, setCanLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Delete Confirmation Modal
  const [deletingTech, setDeletingTech] = useState<TechnicianOption | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadTechnicians = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAllTechnicians();
      setTechs(res.technicians);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'ไม่สามารถโหลดรายชื่อช่างเทคนิคได้',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTechnicians();
  }, [loadTechnicians]);

  const cleanedCountByTechId = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of logs) {
      if (l.status === 'cleaned' && l.technicianId) {
        map.set(l.technicianId, (map.get(l.technicianId) || 0) + 1);
      }
    }
    return map;
  }, [logs]);

  const totalTechCleaned = useMemo(() => {
    return logs.filter((l) => l.status === 'cleaned' && l.technicianId !== 'import-2569').length;
  }, [logs]);

  const visibleTechs = useMemo(() => {
    if (currentUser.role === 'super_admin') return techs;
    return techs.filter((t) => t.role !== 'super_admin');
  }, [techs, currentUser.role]);

  const filteredTechs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visibleTechs;
    return visibleTechs.filter(
      (t) =>
        t.fullName.toLowerCase().includes(q) ||
        t.phone.toLowerCase().includes(q) ||
        t.username.toLowerCase().includes(q)
    );
  }, [visibleTechs, search]);

  const openCreateModal = () => {
    setEditingTech(null);
    setFullName('');
    setPhone('');
    setCanLogin(false);
    setUsername('');
    setPassword('');
    setActive(true);
    setModalError('');
    setModalOpen(true);
  };

  const openEditModal = (t: TechnicianOption) => {
    setEditingTech(t);
    setFullName(t.fullName);
    setPhone(t.phone || '');
    setCanLogin(t.canLogin);
    setUsername(t.canLogin ? t.username : '');
    setPassword('');
    setActive(t.active);
    setModalError('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    if (!fullName.trim()) {
      setModalError('กรุณากรอกชื่อ-สกุลช่างเทคนิค');
      return;
    }
    if (!phone.trim()) {
      setModalError('กรุณากรอกเบอร์โทรศัพท์ช่างเทคนิค');
      return;
    }

    const needsCredentials = canLogin && (!editingTech || !editingTech.canLogin);
    if (canLogin && !username.trim()) {
      setModalError('กรุณากรอก Username สำหรับเข้าสู่ระบบ');
      return;
    }
    if (needsCredentials && !password) {
      setModalError('กรุณากรอกรหัสผ่านสำหรับเข้าสู่ระบบ');
      return;
    }

    setSaving(true);
    try {
      if (editingTech) {
        await api.updateTechnician(editingTech.id, {
          fullName: fullName.trim(),
          phone: phone.trim(),
          canLogin,
          ...(canLogin && username.trim() ? { username: username.trim() } : {}),
          ...(canLogin && password ? { password } : {}),
          active,
        });
        setFeedback({ type: 'success', text: `อัปเดตข้อมูลช่าง "${fullName.trim()}" เรียบร้อยแล้ว` });
      } else {
        await api.createTechnician({
          fullName: fullName.trim(),
          phone: phone.trim(),
          canLogin,
          ...(canLogin ? { username: username.trim(), password } : {}),
          active,
        });
        setFeedback({ type: 'success', text: `เพิ่มรายชื่อช่าง "${fullName.trim()}" เรียบร้อยแล้ว` });
      }
      setModalOpen(false);
      await loadTechnicians();
      await onTechniciansChanged();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'บันทึกข้อมูลช่างไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTech) return;
    setDeleting(true);
    setFeedback(null);
    try {
      await api.deleteTechnician(deletingTech.id);
      setFeedback({ type: 'success', text: `ลบรายชื่อ "${deletingTech.fullName}" เรียบร้อยแล้ว` });
      setDeletingTech(null);
      await loadTechnicians();
      await onTechniciansChanged();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'ไม่สามารถลบรายชื่อช่างได้',
      });
      setDeletingTech(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Summary */}
      <div className="bg-white border border-[#DCE4EE] rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#1E293B]">รายชื่อช่างเทคนิค (แผนกช่างซ่อมบำรุง)</h1>
            <p className="text-sm text-[#64748B] mt-0.5">
              เพิ่มและจัดการรายชื่อช่างเทคนิค (ชื่อ-สกุล และเบอร์โทรศัพท์) พร้อมเลือกเปิดสิทธิ์เข้าสู่ระบบให้ช่างล็อกอินด้วยตัวเองได้
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="h-10 px-4 rounded-lg bg-[#4A7C9B] hover:bg-[#3C6884] text-white text-sm font-medium flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            เพิ่มรายชื่อช่างเทคนิค
          </button>
        </div>

        <div
          className={`grid gap-3 pt-3 border-t border-[#E8EEF4] ${
            deviceMode === 'mobile' ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'
          }`}
        >
          <div className="p-3.5 rounded-xl bg-[#F4F8FB] border border-[#DCE7F0]">
            <div className="text-xs text-[#3B6684]">รายชื่อช่างทั้งหมด</div>
            <div className="text-xl font-bold text-[#254B66] tabular-nums mt-0.5">
              {visibleTechs.length} คน
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#ECF6F1] border border-[#C6E2D2]">
            <div className="text-xs text-[#2F6A4E]">กำลังปฏิบัติงาน (Active)</div>
            <div className="text-xl font-bold text-[#25593E] tabular-nums mt-0.5">
              {visibleTechs.filter((t) => t.active).length} คน
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#F3F0FA] border border-[#DFD8F2]">
            <div className="text-xs text-[#5B4B85]">เปิดสิทธิ์ล็อกอินได้</div>
            <div className="text-xl font-bold text-[#4A3B73] tabular-nums mt-0.5">
              {visibleTechs.filter((t) => t.canLogin && t.active).length} คน
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#FDF6EC] border border-[#F2DEC2]">
            <div className="text-xs text-[#8C5E26]">ยอดงานล้างโดยทีมช่าง</div>
            <div className="text-xl font-bold text-[#7A4E1A] tabular-nums mt-0.5">
              {totalTechCleaned.toLocaleString()} เครื่อง
            </div>
          </div>
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

      {/* Search & Table */}
      <div className="bg-white border border-[#DCE4EE] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#E8EEF4] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm font-semibold text-[#1E293B]">
            รายการช่างในทีม ({filteredTechs.length})
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อ-สกุล หรือ เบอร์โทร..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#CBD5E1] text-sm"
            />
          </div>
        </div>

        {deviceMode === 'mobile' ? (
          <div className="p-3 space-y-2.5">
            {loading ? (
              <div className="py-10 text-center text-sm text-[#64748B]">
                กำลังโหลดรายชื่อช่างเทคนิค...
              </div>
            ) : filteredTechs.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#64748B]">
                ไม่พบรายชื่อช่างเทคนิค — กด &ldquo;เพิ่มรายชื่อช่างเทคนิค&rdquo; เพื่อเริ่มต้นเพิ่มทีมช่าง
              </div>
            ) : (
              filteredTechs.map((t) => {
                const canDeleteRow = t.id !== currentUser.id && t.role !== 'super_admin';
                const cleanedCount = cleanedCountByTechId.get(t.id) || 0;
                return (
                  <div
                    key={t.id}
                    className={`rounded-xl border border-[#DCE4EE] p-3.5 space-y-2.5 ${
                      !t.active ? 'bg-[#F8FAFC] opacity-80' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-[#1E293B]">{t.fullName}</div>
                        <div className="text-xs text-[#64748B]">{ROLE_LABELS[t.role]}</div>
                      </div>
                      {t.active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[#ECF6F1] text-[#25593E] shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          ใช้งาน
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-[#E2E8F0] text-[#64748B] shrink-0">
                          ระงับ
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#334155]">
                      <span className="inline-flex items-center gap-1 font-mono-tabular">
                        <Phone className="w-3.5 h-3.5 text-[#64748B]" />
                        {t.phone || '-'}
                      </span>
                      {t.canLogin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#EAF2F8] text-[#2F5A78] font-mono-tabular font-medium">
                          <KeyRound className="w-3 h-3" />@{t.username}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-[#F1F5F9] text-[#64748B]">
                          บันทึกรายชื่ออย่างเดียว
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#EEF2F6]">
                      <span className="text-xs font-semibold text-[#25593E] tabular-nums">
                        ล้างแล้ว {cleanedCount.toLocaleString()} เครื่อง
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(t)}
                          className="h-8 px-2.5 rounded-lg border border-[#DCE4EE] text-[#4A7C9B] bg-[#F8FAFC] text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          แก้ไข
                        </button>
                        {canDeleteRow && (
                          <button
                            type="button"
                            onClick={() => setDeletingTech(t)}
                            className="h-8 px-2.5 rounded-lg border border-[#F3CCD3] text-[#9D3E4E] bg-[#FDF0F2] text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            ลบ
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-[#F4F7FA] border-b border-[#DCE4EE] text-xs text-[#475569]">
                <tr>
                  <th className="py-3 px-4 text-left font-semibold">ลำดับ</th>
                  <th className="py-3 px-4 text-left font-semibold">ชื่อ-สกุล</th>
                  <th className="py-3 px-4 text-left font-semibold">เบอร์โทรศัพท์</th>
                  <th className="py-3 px-4 text-left font-semibold">บัญชีเข้าสู่ระบบ</th>
                  <th className="py-3 px-4 text-right font-semibold">จำนวนเครื่องที่ล้างแล้ว</th>
                  <th className="py-3 px-4 text-left font-semibold">สถานะ</th>
                  <th className="py-3 px-4 text-right font-semibold">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F6]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-[#64748B]">
                      กำลังโหลดรายชื่อช่างเทคนิค...
                    </td>
                  </tr>
                ) : filteredTechs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-[#64748B]">
                      ไม่พบรายชื่อช่างเทคนิค — กด &ldquo;เพิ่มรายชื่อช่างเทคนิค&rdquo; เพื่อเริ่มต้นเพิ่มทีมช่าง
                    </td>
                  </tr>
                ) : (
                  filteredTechs.map((t, idx) => {
                    const canDeleteRow = t.id !== currentUser.id && t.role !== 'super_admin';
                    const cleanedCount = cleanedCountByTechId.get(t.id) || 0;
                    return (
                      <tr
                        key={t.id}
                        className={!t.active ? 'bg-[#F8FAFC] text-[#94A3B8]' : 'hover:bg-[#F8FAFC]'}
                      >
                        <td className="py-3 px-4 tabular-nums text-xs text-[#64748B]">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-[#1E293B]">{t.fullName}</div>
                          <div className="text-xs text-[#64748B]">{ROLE_LABELS[t.role]}</div>
                        </td>
                        <td className="py-3 px-4 font-mono-tabular whitespace-nowrap text-[#334155]">
                          {t.phone ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-[#64748B]" />
                              {t.phone}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-xs">
                          {t.canLogin ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#EAF2F8] text-[#2F5A78] font-mono-tabular font-medium">
                              <KeyRound className="w-3 h-3" />@{t.username}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F1F5F9] text-[#64748B]">
                              บันทึกรายชื่ออย่างเดียว
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-semibold text-[#25593E]">
                          {cleanedCount.toLocaleString()} เครื่อง
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {t.active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[#ECF6F1] text-[#25593E]">
                              <CheckCircle2 className="w-3 h-3" />
                              ใช้งาน
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-[#E2E8F0] text-[#64748B]">
                              ระงับ
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(t)}
                              className="p-1.5 rounded-md text-[#4A7C9B] hover:bg-[#EAF2F8] cursor-pointer"
                              aria-label="แก้ไขข้อมูลช่าง"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {canDeleteRow && (
                              <button
                                type="button"
                                onClick={() => setDeletingTech(t)}
                                className="p-1.5 rounded-md text-[#9D3E4E] hover:bg-[#FDF0F2] cursor-pointer"
                                aria-label="ลบรายชื่อช่าง"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Technician Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-md bg-white border border-[#DCE4EE] rounded-xl p-6 space-y-4 shadow-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#1E293B]">
                {editingTech ? `แก้ไขข้อมูลช่าง: ${editingTech.fullName}` : 'เพิ่มรายชื่อช่างเทคนิค'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-[#64748B] hover:text-[#1E293B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-lg bg-[#FDF0F2] border border-[#F3CCD3] text-xs text-[#9D3E4E]">
                {modalError}
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">ชื่อ-สกุล *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="เช่น นายวิโรจน์ ช่างซ่อม"
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">เบอร์โทรศัพท์ *</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="เช่น 081-234-5678"
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm font-mono-tabular"
                />
              </div>

              {(!editingTech || editingTech.role === 'technician') && (
                <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
                  <label className="flex items-start gap-2 text-xs text-[#334155] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={canLogin}
                      onChange={(e) => setCanLogin(e.target.checked)}
                      className="mt-0.5 rounded border-[#CBD5E1]"
                    />
                    <span>
                      <strong className="block text-[#1E293B]">
                        เปิดบัญชี Username / Password ให้ช่างเข้าสู่ระบบด้วยตนเอง
                      </strong>
                      <span className="text-[#64748B]">
                        หากไม่ติ๊ก ช่างจะมีชื่อในตัวเลือกผู้ปฏิบัติงาน แต่ยังไม่สามารถล็อกอินเข้าระบบได้
                      </span>
                    </span>
                  </label>

                  {canLogin && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[#E2E8F0]">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-[#475569]">
                          Username *
                        </label>
                        <input
                          type="text"
                          required={canLogin}
                          disabled={Boolean(editingTech && editingTech.canLogin)}
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="เช่น wiroj"
                          className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm disabled:bg-[#EEF2F6]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-[#475569]">
                          {editingTech && editingTech.canLogin
                            ? 'รหัสผ่านใหม่ (ไม่บังคับ)'
                            : 'รหัสผ่าน *'}
                        </label>
                        <input
                          type="password"
                          required={canLogin && (!editingTech || !editingTech.canLogin)}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="กำหนดรหัสผ่าน"
                          className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {editingTech && (
                <label className="flex items-center gap-2 text-xs text-[#334155] cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={active}
                    disabled={editingTech.id === currentUser.id}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                  <span>เปิดใช้งานในรายชื่อช่างปฏิบัติงาน</span>
                </label>
              )}
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
                className="h-9 px-4 rounded-lg bg-[#4A7C9B] hover:bg-[#3C6884] text-white text-sm font-medium cursor-pointer disabled:opacity-50"
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึกรายชื่อช่าง'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTech && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
          <div className="w-full max-w-md bg-white border border-[#DCE4EE] rounded-xl p-6 space-y-4 shadow-lg">
            <h3 className="text-base font-semibold text-[#1E293B]">ยืนยันลบรายชื่อช่างเทคนิค</h3>
            <p className="text-sm text-[#475569]">
              คุณต้องการลบรายชื่อ <strong className="text-[#1E293B]">{deletingTech.fullName}</strong>{' '}
              {deletingTech.phone ? `(${deletingTech.phone})` : ''} ออกจากทีมช่างใช่หรือไม่?
              (ประวัติการล้างเดิมที่เคยบันทึกไว้จะยังคงอยู่)
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingTech(null)}
                className="h-9 px-4 rounded-lg border border-[#CBD5E1] text-sm text-[#475569] cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="h-9 px-4 rounded-lg bg-[#B05566] hover:bg-[#974252] text-white text-sm font-medium cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
