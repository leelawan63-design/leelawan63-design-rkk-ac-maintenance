import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Monitor,
  Smartphone,
  Tablet,
  UserCheck,
} from 'lucide-react';
import type { CompanySettings, UserAccount } from '../types';
import { api, setStoredToken } from '../lib/api';
import { useDeviceMode, type DeviceMode } from '../lib/deviceMode';
import { CompanyLogo } from './CompanyLogo';

interface LoginPageProps {
  company: Pick<CompanySettings, 'name' | 'address' | 'taxId' | 'phone' | 'siteName' | 'logoDataUrl'>;
  onLoginSuccess: (user: UserAccount, fullCompany: CompanySettings) => void;
}

const DEVICE_CHOICES: Array<{ id: DeviceMode; label: string; icon: React.ReactNode }> = [
  { id: 'desktop', label: 'คอมพิวเตอร์', icon: <Monitor className="w-4 h-4" /> },
  { id: 'tablet', label: 'แท็บเล็ต', icon: <Tablet className="w-4 h-4" /> },
  { id: 'mobile', label: 'โทรศัพท์มือถือ', icon: <Smartphone className="w-4 h-4" /> },
];

export const LoginPage: React.FC<LoginPageProps> = ({ company, onLoginSuccess }) => {
  const { deviceMode, setDeviceMode } = useDeviceMode();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน');
      return;
    }

    setLoading(true);
    try {
      const res = await api.login(username.trim(), password);
      setStoredToken(res.token);
      onLoginSuccess(res.user, res.company);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const containerMaxWidth =
    deviceMode === 'mobile'
      ? 'max-w-md'
      : deviceMode === 'tablet'
        ? 'max-w-2xl'
        : 'max-w-4xl';

  const isCompactMode = deviceMode === 'mobile' || deviceMode === 'tablet';

  return (
    <div
      className={`min-h-screen bg-[#F4F7FA] flex flex-col justify-center items-center ${
        deviceMode === 'mobile' ? 'px-3 py-5' : 'px-4 py-10'
      }`}
    >
      <div
        className={`w-full ${containerMaxWidth} grid ${
          deviceMode === 'desktop' ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'
        } bg-white border border-[#DCE4EE] rounded-2xl overflow-hidden shadow-sm`}
      >
        {/* Company Identity Panel */}
        <div
          className={`${
            deviceMode === 'desktop'
              ? 'lg:col-span-5 lg:border-b-0 lg:border-r p-8 gap-8'
              : deviceMode === 'mobile'
                ? 'p-5 gap-4'
                : 'p-6 gap-5'
          } bg-[#EEF4F9] border-b border-[#DCE4EE] flex flex-col justify-between`}
        >
          <div className={deviceMode === 'mobile' ? 'flex items-center gap-3.5' : 'space-y-5'}>
            <CompanyLogo
              logoDataUrl={company.logoDataUrl}
              companyName={company.name}
              size={deviceMode === 'mobile' ? 'md' : 'lg'}
            />
            <div className="space-y-1.5 min-w-0">
              <p className="text-xs font-medium text-[#4A7C9B] tracking-wide">
                ระบบบริหารจัดการงานบำรุงรักษาเครื่องปรับอากาศ
              </p>
              <h1
                className={`${
                  deviceMode === 'mobile' ? 'text-base' : 'text-xl'
                } font-bold text-[#1E293B] leading-snug text-balance`}
              >
                {company.name}
              </h1>
              {deviceMode !== 'mobile' && (
                <p className="text-sm text-[#475569] leading-relaxed">{company.address}</p>
              )}
            </div>
          </div>

          {deviceMode !== 'mobile' && (
            <div className="pt-5 border-t border-[#D6E3EE] space-y-2 text-xs text-[#475569]">
              <div className="flex justify-between gap-2">
                <span className="text-[#64748B]">เลขประจำตัวผู้เสียภาษี</span>
                <span className="font-mono-tabular font-medium text-[#1E293B]">{company.taxId}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#64748B]">โทรศัพท์</span>
                <span className="font-mono-tabular font-medium text-[#1E293B]">{company.phone}</span>
              </div>
              <div className="pt-2 text-[#64748B] leading-relaxed">
                บันทึกงานล้างรายวัน · ติดตามผลงานช่างตามรายชื่อ · รายงานสรุปประจำเดือน/ปี · ส่งออก Excel &amp; Google Sheets
              </div>
            </div>
          )}
        </div>

        {/* Login Form */}
        <div
          className={`${
            deviceMode === 'desktop'
              ? 'lg:col-span-7 p-8 sm:p-10'
              : deviceMode === 'mobile'
                ? 'p-5'
                : 'p-7'
          } flex flex-col justify-center`}
        >
          <div className="max-w-md w-full mx-auto space-y-5">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-[#1E293B]">เข้าสู่ระบบปฏิบัติงาน</h2>
              <p className="text-sm text-[#64748B]">
                กรุณากรอก User และ Password และเลือกประเภทเครื่องที่ใช้งาน
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="px-4 py-3 rounded-lg bg-[#FDF0F2] border border-[#F3CCD3] text-sm text-[#9D3E4E]"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Device Mode Selector */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#334155]">
                  เลือกเครื่องที่ใช้งาน (ปรับรูปแบบเมนูและหน้าจออัตโนมัติ)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DEVICE_CHOICES.map((opt) => {
                    const active = deviceMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDeviceMode(opt.id)}
                        className={`flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#EAF2F8] border-[#4A7C9B] text-[#2F5A78] shadow-xs'
                            : 'bg-white border-[#CBD5E1] text-[#475569] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <span className={active ? 'text-[#4A7C9B]' : 'text-[#64748B]'}>
                          {opt.icon}
                        </span>
                        <span className="truncate max-w-full">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="login-username"
                  className="block text-sm font-medium text-[#334155]"
                >
                  ชื่อผู้ใช้งาน (Username)
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="กรอกชื่อผู้ใช้งาน"
                    className={`w-full ${
                      isCompactMode ? 'h-12 text-base' : 'h-11 text-sm'
                    } pl-10 pr-4 rounded-lg border border-[#CBD5E1] bg-white text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#4A7C9B] focus:ring-2 focus:ring-[#4A7C9B]/20`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-sm font-medium text-[#334155]"
                >
                  รหัสผ่าน (Password)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่าน"
                    className={`w-full ${
                      isCompactMode ? 'h-12 text-base' : 'h-11 text-sm'
                    } pl-10 pr-11 rounded-lg border border-[#CBD5E1] bg-white text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#4A7C9B] focus:ring-2 focus:ring-[#4A7C9B]/20`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#64748B] hover:text-[#1E293B] rounded-md"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full ${
                  isCompactMode ? 'h-12 text-base' : 'h-11 text-sm'
                } rounded-lg bg-[#4A7C9B] hover:bg-[#3C6884] text-white font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer`}
              >
                <KeyRound className="w-4 h-4" />
                {loading ? 'กำลังตรวจสอบสิทธิ์...' : 'เข้าสู่ระบบ'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
