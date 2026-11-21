import React, { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, UserPlus, Pencil, X, Save } from 'lucide-react';
import type {
  CompanySettings,
  UserAccount,
  UserPermissions,
  UserRole,
} from '../types';
import { DEFAULT_PERMISSIONS_BY_ROLE, ROLE_LABELS } from '../types';
import { api } from '../lib/api';
import { CompanyLogo } from './CompanyLogo';

interface AdminSettingsViewProps {
  currentUser: UserAccount;
  company: CompanySettings;
  onUpdateCompany: (payload: Partial<CompanySettings>) => Promise<void>;
}

const PERMISSION_LABELS: Array<{ key: keyof UserPermissions; label: string }> = [
  { key: 'canViewDashboard', label: 'เข้าดูหน้าแดชบอร์ดภาพรวม' },
  { key: 'canEnterDaily', label: 'กรอกงานล้างประจำวัน' },
  { key: 'canViewReports', label: 'ดูประวัติย้อนหลังและรายงาน' },
  { key: 'canEditHistory', label: 'แก้ไขข้อมูลการล้างย้อนหลัง' },
  { key: 'canDeleteHistory', label: 'ลบข้อมูลการล้างเก่า' },
  {
    key: 'canModifyCurrentMonthOnly',
    label: 'สามารถเพิ่ม ลบ แก้ไขข้อมูลการล้างเดือนปัจจุบันเท่านั้น',
  },
  { key: 'canManageInventory', label: 'จัดการทะเบียนเครื่องปรับอากาศ' },
  { key: 'canManageTechnicians', label: 'จัดการรายชื่อช่างเทคนิค (ชื่อ-เบอร์โทร)' },
  { key: 'canSyncSheets', label: 'เชื่อมต่อและซิงค์ Google Sheets' },
  { key: 'canEditCompany', label: 'แก้ไขข้อมูลบริษัทและโลโก้' },
  { key: 'canManageUsers', label: 'จัดการบัญชีผู้ใช้และสิทธิ์ (Admin)' },
];

export const AdminSettingsView: React.FC<AdminSettingsViewProps> = ({
  currentUser,
  company,
  onUpdateCompany,
}) => {
  const canManageUsers =
    currentUser.role === 'super_admin' || currentUser.permissions.canManageUsers;
  const canEditCompany =
    currentUser.role === 'super_admin' || currentUser.permissions.canEditCompany;

  // Company form
  const [compName, setCompName] = useState(company.name);
  const [compAddress, setCompAddress] = useState(company.address);
  const [compTaxId, setCompTaxId] = useState(company.taxId);
  const [compPhone, setCompPhone] = useState(company.phone);
  const [compSite, setCompSite] = useState(company.siteName);
  const [compSender, setCompSender] = useState(company.defaultSenderLabel);
  const [compInspector, setCompInspector] = useState(company.defaultInspectorLabel);
  const [logoDataUrl, setLogoDataUrl] = useState(company.logoDataUrl);
  const [savingCompany, setSavingCompany] = useState(false);

  // Users management
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);

  const [uUsername, setUUsername] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uFullName, setUFullName] = useState('');
  const [uPhone, setUPhone] = useState('');
  const [uDepartment, setUDepartment] = useState('');
  const [uRole, setURole] = useState<UserRole>('technician');
  const [uActive, setUActive] = useState(true);
  const [uPerms, setUPerms] = useState<UserPermissions>({
    ...DEFAULT_PERMISSIONS_BY_ROLE.technician,
  });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!canManageUsers) return;
    setLoadingUsers(true);
    api
      .getUsers()
      .then((res) => setUsers(res.users))
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, [canManageUsers]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2.5 * 1024 * 1024) {
      setFeedback({ type: 'error', text: 'ขนาดไฟล์โลโก้ต้องไม่เกิน 2.5 MB' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCompany(true);
    setFeedback(null);
    try {
      await onUpdateCompany({
        name: compName.trim(),
        address: compAddress.trim(),
        taxId: compTaxId.trim(),
        phone: compPhone.trim(),
        siteName: compSite.trim(),
        defaultSenderLabel: compSender.trim(),
        defaultInspectorLabel: compInspector.trim(),
        logoDataUrl,
      });
      setFeedback({ type: 'success', text: 'บันทึกข้อมูลบริษัทและโลโก้เรียบร้อยแล้ว' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ',
      });
    } finally {
      setSavingCompany(false);
    }
  };

  const openCreateUser = () => {
    setEditingUser(null);
    setUUsername('');
    setUPassword('');
    setUFullName('');
    setUPhone('');
    setUDepartment('แผนกช่างซ่อมบำรุง (ช่างเทคนิค)');
    setURole('technician');
    setUActive(true);
    setUPerms({ ...DEFAULT_PERMISSIONS_BY_ROLE.technician });
    setUserModalOpen(true);
  };

  const openEditUser = (u: UserAccount) => {
    setEditingUser(u);
    setUUsername(u.username);
    setUPassword('');
    setUFullName(u.fullName);
    setUPhone(u.phone || '');
    setUDepartment(u.department);
    setURole(u.role);
    setUActive(u.active);
    setUPerms({ ...u.permissions });
    setUserModalOpen(true);
  };

  const handleRoleChange = (role: UserRole) => {
    setURole(role);
    setUPerms({ ...DEFAULT_PERMISSIONS_BY_ROLE[role] });
    if (role === 'super_admin') setUDepartment('ผู้บริหารระบบ');
    else if (role === 'head_tech') setUDepartment('แผนกช่างซ่อมบำรุง (หัวหน้าช่างเทคนิค)');
    else setUDepartment('แผนกช่างซ่อมบำรุง (ช่างเทคนิค)');
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      if (editingUser) {
        const res = await api.updateUser(editingUser.id, {
          fullName: uFullName.trim(),
          phone: uPhone.trim(),
          department: uDepartment.trim(),
          role: uRole,
          active: uActive,
          permissions: uPerms,
          ...(uPassword ? { password: uPassword } : {}),
        });
        setUsers((prev) => prev.map((u) => (u.id === res.user.id ? res.user : u)));
        setFeedback({ type: 'success', text: `อัปเดตสิทธิ์ผู้ใช้ ${res.user.fullName} เรียบร้อยแล้ว` });
      } else {
        const res = await api.createUser({
          username: uUsername.trim(),
          password: uPassword,
          fullName: uFullName.trim(),
          phone: uPhone.trim(),
          department: uDepartment.trim(),
          role: uRole,
          active: uActive,
          permissions: uPerms,
        });
        setUsers((prev) => [...prev, res.user]);
        setFeedback({ type: 'success', text: `เพิ่มผู้ใช้ ${res.user.fullName} เรียบร้อยแล้ว` });
      }
      setUserModalOpen(false);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'บันทึกผู้ใช้งานไม่สำเร็จ',
      });
    }
  };

  const handleDeleteUser = async (u: UserAccount) => {
    try {
      await api.deleteUser(u.id);
      setUsers((prev) => prev.filter((item) => item.id !== u.id));
      setFeedback({ type: 'success', text: `ลบบัญชี ${u.fullName} แล้ว` });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'ลบผู้ใช้งานไม่สำเร็จ',
      });
    }
  };

  return (
    <div className="space-y-6">
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

      {/* Company Info & Logo Upload */}
      {canEditCompany && (
        <form
          onSubmit={handleSaveCompany}
          className="bg-white border border-[#DCE4EE] rounded-xl p-6 space-y-5"
        >
          <div>
            <h1 className="text-xl font-bold text-[#1E293B]">ข้อมูลบริษัทและโลโก้หัวรายงาน</h1>
            <p className="text-sm text-[#64748B] mt-0.5">
              อัปโหลดไฟล์โลโก้บริษัทเพื่อแสดงบนหน้าเข้าสู่ระบบ เมนูหลัก และหัวเอกสารรายงานพิมพ์ทุกฉบับ
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-5 p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <CompanyLogo
              logoDataUrl={logoDataUrl}
              companyName={compName}
              size="lg"
            />
            <div className="space-y-2">
              <div className="text-sm font-medium text-[#1E293B]">ไฟล์โลโก้บริษัท (PNG, JPG, SVG, WebP)</div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="h-9 px-3.5 rounded-lg bg-[#EAF2F8] hover:bg-[#DCE9F4] text-[#2F5A78] text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  เลือกไฟล์โลโก้
                </button>
                {logoDataUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoDataUrl('')}
                    className="h-9 px-3 rounded-lg border border-[#F3CCD3] text-[#9D3E4E] hover:bg-[#FDF0F2] text-xs font-medium cursor-pointer"
                  >
                    ลบโลโก้ออก
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-[#475569]">ชื่อบริษัท</label>
              <input
                type="text"
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-[#475569]">ชื่อโครงการ / หน้างาน</label>
              <input
                type="text"
                value={compSite}
                onChange={(e) => setCompSite(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
              />
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="block text-xs font-medium text-[#475569]">ที่อยู่</label>
              <input
                type="text"
                value={compAddress}
                onChange={(e) => setCompAddress(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-[#475569]">เลขประจำตัวผู้เสียภาษี</label>
              <input
                type="text"
                value={compTaxId}
                onChange={(e) => setCompTaxId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm font-mono-tabular"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-[#475569]">เบอร์โทรศัพท์</label>
              <input
                type="text"
                value={compPhone}
                onChange={(e) => setCompPhone(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm font-mono-tabular"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-[#475569]">คำกำกับช่องลายเซ็นผู้ส่งงาน</label>
              <input
                type="text"
                value={compSender}
                onChange={(e) => setCompSender(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-[#475569]">คำกำกับช่องลายเซ็นผู้ตรวจรับงาน</label>
              <input
                type="text"
                value={compInspector}
                onChange={(e) => setCompInspector(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingCompany}
              className="h-10 px-5 rounded-lg bg-[#4A7C9B] hover:bg-[#3C6884] text-white text-sm font-medium flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {savingCompany ? 'กำลังบันทึก...' : 'บันทึกข้อมูลบริษัทและโลโก้'}
            </button>
          </div>
        </form>
      )}

      {/* User & Permissions Management (Super Admin only) */}
      {canManageUsers && (
        <div className="bg-white border border-[#DCE4EE] rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#1E293B]">
                จัดการผู้ใช้งานและกำหนดสิทธิ์การเข้าถึง (Admin สูงสุด)
              </h2>
              <p className="text-xs text-[#64748B]">
                สร้างบัญชีให้ช่างเทคนิคล็อกอินด้วยชื่อของตนเอง เพื่อบันทึกและนับจำนวนเครื่องที่เข้าล้างรายบุคคลได้อย่างแม่นยำ
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateUser}
              className="h-9 px-4 rounded-lg bg-[#4A7C9B] hover:bg-[#3C6884] text-white text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              เพิ่มผู้ใช้งานใหม่
            </button>
          </div>

          {loadingUsers ? (
            <div className="py-6 text-center text-sm text-[#64748B]">กำลังโหลดรายชื่อผู้ใช้...</div>
          ) : (
            <div className="overflow-x-auto border border-[#E2E8F0] rounded-lg">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-[#F4F7FA] border-b border-[#DCE4EE] text-xs text-[#475569]">
                  <tr>
                    <th className="py-2.5 px-4 text-left font-semibold">ชื่อ-นามสกุล</th>
                    <th className="py-2.5 px-4 text-left font-semibold">Username</th>
                    <th className="py-2.5 px-4 text-left font-semibold">ตำแหน่ง / บทบาท</th>
                    <th className="py-2.5 px-4 text-left font-semibold">สิทธิ์ลบข้อมูลเก่า</th>
                    <th className="py-2.5 px-4 text-left font-semibold">สถานะ</th>
                    <th className="py-2.5 px-4 text-right font-semibold">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F6]">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-[#F8FAFC]">
                      <td className="py-2.5 px-4 font-medium text-[#1E293B]">
                        {u.fullName}
                        <span className="block text-xs font-normal text-[#64748B]">
                          {u.department}
                          {u.phone ? ` · โทร ${u.phone}` : ''}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono-tabular text-[#3B6684]">{u.username}</td>
                      <td className="py-2.5 px-4 text-xs text-[#334155]">
                        {ROLE_LABELS[u.role]}
                      </td>
                      <td className="py-2.5 px-4 text-xs">
                        {u.role === 'super_admin' || u.permissions.canDeleteHistory ? (
                          <span className="text-[#25593E]">อนุญาต</span>
                        ) : (
                          <span className="text-[#9D3E4E]">ไม่อนุญาต</span>
                        )}
                        {u.role !== 'super_admin' && u.permissions.canModifyCurrentMonthOnly && (
                          <span className="block text-[11px] text-[#8C5E26]">
                            (เฉพาะเดือนปัจจุบันเท่านั้น)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-xs">
                        {u.active ? (
                          <span className="text-[#25593E]">ใช้งาน</span>
                        ) : (
                          <span className="text-[#64748B]">ระงับ</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditUser(u)}
                            className="p-1.5 rounded-md text-[#4A7C9B] hover:bg-[#EAF2F8] cursor-pointer"
                            aria-label="แก้ไขสิทธิ์"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {u.id !== currentUser.id && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 rounded-md text-[#9D3E4E] hover:bg-[#FDF0F2] cursor-pointer"
                              aria-label="ลบผู้ใช้"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* User Modal */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
          <form
            onSubmit={handleSaveUser}
            className="w-full max-w-xl bg-white border border-[#DCE4EE] rounded-xl p-6 space-y-4 shadow-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#1E293B]">
                {editingUser ? `แก้ไขผู้ใช้: ${editingUser.fullName}` : 'เพิ่มผู้ใช้งานใหม่'}
              </h3>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="p-1 text-[#64748B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">Username *</label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingUser)}
                  value={uUsername}
                  onChange={(e) => setUUsername(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm disabled:bg-[#F8FAFC]"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">
                  {editingUser ? 'รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)' : 'รหัสผ่าน *'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={uPassword}
                  onChange={(e) => setUPassword(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">ชื่อ-นามสกุลช่าง / พนักงาน *</label>
                <input
                  type="text"
                  required
                  value={uFullName}
                  onChange={(e) => setUFullName(e.target.value)}
                  placeholder="เช่น นายวิโรจน์ ช่างซ่อม"
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">เบอร์โทรศัพท์</label>
                <input
                  type="text"
                  value={uPhone}
                  onChange={(e) => setUPhone(e.target.value)}
                  placeholder="เช่น 081-234-5678"
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm font-mono-tabular"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">บทบาทหลัก</label>
                <select
                  value={uRole}
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm"
                >
                  <option value="technician">แผนกช่างซ่อมบำรุง (ช่างเทคนิค)</option>
                  <option value="head_tech">แผนกช่างซ่อมบำรุง (หัวหน้าช่างเทคนิค)</option>
                  <option value="super_admin">Admin สูงสุด</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#475569]">แผนก / ตำแหน่ง</label>
                <input
                  type="text"
                  value={uDepartment}
                  onChange={(e) => setUDepartment(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#E8EEF4]">
              <div className="text-xs font-semibold text-[#334155]">กำหนดสิทธิ์การใช้งานรายเมนู</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PERMISSION_LABELS.map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center gap-2 text-xs text-[#334155] p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={
                        uRole === 'super_admin'
                          ? item.key !== 'canModifyCurrentMonthOnly'
                          : Boolean(uPerms[item.key])
                      }
                      disabled={uRole === 'super_admin'}
                      onChange={(e) =>
                        setUPerms((prev) => ({ ...prev, [item.key]: e.target.checked }))
                      }
                      className="rounded border-[#CBD5E1]"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-[#334155] cursor-pointer">
              <input
                type="checkbox"
                checked={uActive}
                onChange={(e) => setUActive(e.target.checked)}
              />
              <span>เปิดใช้งานบัญชีนี้</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="h-9 px-4 rounded-lg border border-[#CBD5E1] text-sm text-[#475569] cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="h-9 px-4 rounded-lg bg-[#4A7C9B] text-white text-sm font-medium cursor-pointer"
              >
                บันทึกผู้ใช้งาน
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
