import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, Lock, UserCheck } from 'lucide-react';
import type { CompanySettings, UserAccount } from '../types';
import { api, setStoredToken } from '../lib/api';
import { CompanyLogo } from './CompanyLogo';

interface LoginPageProps {
  company: Pick<CompanySettings, 'name' | 'address' | 'taxId' | 'phone' | 'siteName' | 'logoDataUrl'>;
  onLoginSuccess: (user: UserAccount, fullCompany: CompanySettings) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ company, onLoginSuccess }) => {
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

  return (
    <div className="min-h-screen bg-[#F4F7FA] flex flex-col justify-center items-center px-4 py-10">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 bg-white border border-[#DCE4EE] rounded-2xl overflow-hidden shadow-sm">
        {/* Left: Company Identity Panel (Polite Pastel Mist) */}
        <div className="lg:col-span-5 bg-[#EEF4F9] border-b lg:border-b-0 lg:border-r border-[#DCE4EE] p-8 flex flex-col justify-between gap-8">
          <div className="space-y-5">
            <CompanyLogo
              logoDataUrl={company.logoDataUrl}
              companyName={company.name}
              size="lg"
            />
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#4A7C9B] tracking-wide">
                ระบบบริหารจัดการงานบำรุงรักษาเครื่องปรับอากาศ
              </p>
              <h1 className="text-xl font-bold text-[#1E293B] leading-snug text-balance">
                {company.name}
              </h1>
              <p className="text-sm text-[#475569] leading-relaxed">
                {company.address}
              </p>
            </div>
          </div>

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
              บันทึกงานล้างรายวัน · ติดตามผลงานช่างตามรายชื่อ · รายงานสรุปประจำเดือน/ปี · ส่งออก Excel & Google Sheets
            </div>
          </div>
        </div>

        {/* Right: Login Form */}
        <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto space-y-6">
            <div className="space-y-1.5">
              <h2 className="text-xl font-semibold text-[#1E293B]">เข้าสู่ระบบปฏิบัติงาน</h2>
              <p className="text-sm text-[#64748B]">
                กรุณากรอก User และ Password ประจำตัวของคุณก่อนเข้าใช้งานระบบ
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
                    className="w-full h-11 pl-10 pr-4 rounded-lg border border-[#CBD5E1] bg-white text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#4A7C9B] focus:ring-2 focus:ring-[#4A7C9B]/20"
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
                    className="w-full h-11 pl-10 pr-11 rounded-lg border border-[#CBD5E1] bg-white text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#4A7C9B] focus:ring-2 focus:ring-[#4A7C9B]/20"
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
                className="w-full h-11 rounded-lg bg-[#4A7C9B] hover:bg-[#3C6884] text-white font-medium text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
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
