import React from 'react';
import {
  BarChart3,
  ClipboardPlus,
  History,
  Building2,
  Users,
  FileText,
  Sheet,
  Settings,
  LogOut,
  X,
} from 'lucide-react';
import type { CompanySettings, UserAccount } from '../types';
import { ROLE_LABELS } from '../types';
import { CompanyLogo } from './CompanyLogo';

export type NavTab =
  | 'dashboard'
  | 'daily'
  | 'history'
  | 'inventory'
  | 'technicians'
  | 'reports'
  | 'sheets'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  user: UserAccount;
  company: CompanySettings;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  user,
  company,
  onLogout,
  mobileOpen,
  onCloseMobile,
}) => {
  const perms = user.permissions;
  const isSuperAdmin = user.role === 'super_admin';

  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ReactNode;
    visible: boolean;
  }> = [
    {
      id: 'dashboard',
      label: 'แดชบอร์ดภาพรวม',
      icon: <BarChart3 className="w-4 h-4" />,
      visible: isSuperAdmin || perms.canViewDashboard,
    },
    {
      id: 'daily',
      label: 'กรอกงานล้างรายวัน',
      icon: <ClipboardPlus className="w-4 h-4" />,
      visible: isSuperAdmin || perms.canEnterDaily,
    },
    {
      id: 'history',
      label: 'ประวัติการล้างย้อนหลัง',
      icon: <History className="w-4 h-4" />,
      visible: isSuperAdmin || perms.canViewReports || perms.canEnterDaily,
    },
    {
      id: 'inventory',
      label: 'ทะเบียนแอร์ทุกอาคาร',
      icon: <Building2 className="w-4 h-4" />,
      visible: isSuperAdmin || perms.canManageInventory,
    },
    {
      id: 'technicians',
      label: 'รายชื่อช่างเทคนิค',
      icon: <Users className="w-4 h-4" />,
      visible: isSuperAdmin || perms.canManageTechnicians,
    },
    {
      id: 'reports',
      label: 'รายงานและพิมพ์เอกสาร',
      icon: <FileText className="w-4 h-4" />,
      visible: isSuperAdmin || perms.canViewReports,
    },
    {
      id: 'sheets',
      label: 'ซิงค์ Google Sheets',
      icon: <Sheet className="w-4 h-4" />,
      visible: isSuperAdmin || perms.canSyncSheets,
    },
    {
      id: 'settings',
      label: 'ตั้งค่าบริษัทและสิทธิ์ผู้ใช้',
      icon: <Settings className="w-4 h-4" />,
      visible: isSuperAdmin || perms.canManageUsers || perms.canEditCompany,
    },
  ];

  const visibleItems = navItems.filter((item) => item.visible);

  const sidebarContent = (
    <div className="h-full flex flex-col bg-white border-r border-[#DCE4EE] w-64">
      {/* Brand Header */}
      <div className="px-4 py-5 border-b border-[#E8EEF4] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <CompanyLogo
            logoDataUrl={company.logoDataUrl}
            companyName={company.name}
            size="sm"
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[#1E293B] truncate">
              {company.name}
            </div>
            <div className="text-xs text-[#64748B] truncate">ระบบงานล้างเครื่องปรับอากาศ</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 text-[#64748B] hover:text-[#1E293B] rounded-md"
          aria-label="ปิดเมนู"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#EAF2F8] text-[#2F5A78]'
                  : 'text-[#475569] hover:bg-[#F4F7FA] hover:text-[#1E293B]'
              }`}
            >
              <span className={isActive ? 'text-[#4A7C9B]' : 'text-[#64748B]'}>
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Current User Footer */}
      <div className="p-4 border-t border-[#E8EEF4] bg-[#F9FBFD] space-y-3">
        <div className="space-y-0.5 min-w-0">
          <div className="text-sm font-semibold text-[#1E293B] truncate">{user.fullName}</div>
          <div className="text-xs text-[#4A7C9B] truncate">
            {ROLE_LABELS[user.role]} · @{user.username}
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="w-full h-9 px-3 rounded-lg border border-[#DCE4EE] bg-white hover:bg-[#FDF0F2] hover:border-[#F0C8D0] hover:text-[#9D3E4E] text-xs font-medium text-[#475569] transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          ออกจากระบบ
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block shrink-0 no-print">{sidebarContent}</aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-[1px]"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
