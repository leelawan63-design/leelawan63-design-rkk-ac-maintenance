import React, { useState } from 'react';
import { RefreshCw, FilePlus2, Link2, ExternalLink, LogOut } from 'lucide-react';
import type { ACUnit, CleaningLog, CompanySettings } from '../types';
import { THAI_MONTHS, formatThaiMonthYear, getTodayIso } from '../lib/thaiDate';

interface GoogleSheetsViewProps {
  company: CompanySettings;
  units: ACUnit[];
  logs: CleaningLog[];
  googleToken: string | null;
  googleEmail: string | null;
  onGoogleSignIn: () => Promise<void>;
  onGoogleSignOut: () => Promise<void>;
  onUpdateCompany: (payload: Partial<CompanySettings>) => Promise<void>;
  onCreateSpreadsheet: (title: string, year: number, month: number) => Promise<void>;
  onSyncSpreadsheet: (year: number, month: number) => Promise<void>;
}

export const GoogleSheetsView: React.FC<GoogleSheetsViewProps> = ({
  company,
  units,
  logs,
  googleToken,
  googleEmail,
  onGoogleSignIn,
  onGoogleSignOut,
  onUpdateCompany,
  onCreateSpreadsheet,
  onSyncSpreadsheet,
}) => {
  const today = getTodayIso();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));

  const [sheetIdInput, setSheetIdInput] = useState(company.googleSheetId || '');
  const [newSheetTitle, setNewSheetTitle] = useState(
    company.googleSheetName || `รายงานล้างแอร์_${company.name}`
  );

  const [confirmAction, setConfirmAction] = useState<null | {
    type: 'create' | 'sync' | 'enable_auto';
    title: string;
    description: string;
  }>(null);

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const handleSaveSheetId = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    let cleaned = sheetIdInput.trim();
    const urlMatch = cleaned.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (urlMatch) {
      cleaned = urlMatch[1];
      setSheetIdInput(cleaned);
    }
    await onUpdateCompany({ googleSheetId: cleaned });
    setFeedback({
      type: 'success',
      text: cleaned
        ? 'บันทึกรหัส Google Spreadsheet ID เรียบร้อยแล้ว'
        : 'ล้างการเชื่อมต่อ Spreadsheet ID แล้ว',
    });
  };

  const handleProceedConfirmed = async () => {
    if (!confirmAction) return;
    setBusy(true);
    setFeedback(null);
    try {
      if (confirmAction.type === 'create') {
        await onCreateSpreadsheet(newSheetTitle.trim() || 'รายงานล้างแอร์', year, month);
        setFeedback({
          type: 'success',
          text: 'สร้างสเปรดชีตใหม่บน Google Sheets และซิงค์ข้อมูลทั้งหมดสำเร็จแล้ว',
        });
      } else if (confirmAction.type === 'sync') {
        await onSyncSpreadsheet(year, month);
        setFeedback({
          type: 'success',
          text: `ซิงค์ข้อมูลเดือน ${formatThaiMonthYear(year, month)} ไปยัง Google Sheets สำเร็จแล้ว`,
        });
      } else if (confirmAction.type === 'enable_auto') {
        await onUpdateCompany({ autoSyncSheets: true });
        await onSyncSpreadsheet(year, month);
        setFeedback({
          type: 'success',
          text: 'เปิดใช้งานซิงค์ Google Sheets อัตโนมัติและอัปเดตข้อมูลล่าสุดเรียบร้อยแล้ว',
        });
      }
      setConfirmAction(null);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการซิงค์ Google Sheets',
      });
      setConfirmAction(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white border border-[#DCE4EE] rounded-xl p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-[#1E293B]">
            เชื่อมต่อและซิงค์ข้อมูล Google Sheets อัตโนมัติ
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            ส่งข้อมูลสรุปรายเดือน รายการไม่ได้ล้าง ประวัติการล้างทั้งหมด ทะเบียนแอร์ทุกชั้นทุกอาคาร และผลงานช่างไปยัง Google Sheets ของคุณ
          </p>
        </div>

        {/* Step 1: Google Sign-In */}
        <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-[#1E293B]">
              1. บัญชี Google สำหรับเชื่อมต่อ Google Sheets
            </div>
            <div className="text-xs text-[#64748B]">
              {googleToken
                ? `เชื่อมต่อแล้วในนาม ${googleEmail || 'บัญชี Google'} (พร้อมซิงค์ข้อมูล)`
                : 'ยังไม่ได้ลงชื่อเข้าใช้ Google กรุณาเชื่อมต่อบัญชี Google ก่อนซิงค์'}
            </div>
          </div>

          {googleToken ? (
            <button
              type="button"
              onClick={onGoogleSignOut}
              className="h-10 px-4 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#FDF0F2] text-xs font-medium text-[#475569] flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              ออกจากบัญชี Google
            </button>
          ) : (
            <button
              type="button"
              onClick={onGoogleSignIn}
              className="gsi-material-button shrink-0"
            >
              <div className="gsi-material-button-state" />
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    style={{ display: 'block' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">Sign in with Google</span>
              </div>
            </button>
          )}
        </div>

        {/* Step 2: Create New or Link Existing Sheet */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-[#DCE4EE] space-y-3">
            <div className="text-sm font-semibold text-[#1E293B] flex items-center gap-2">
              <FilePlus2 className="w-4 h-4 text-[#4A7C9B]" />
              สร้างไฟล์ Google Sheet ใหม่
            </div>
            <p className="text-xs text-[#64748B]">
              ระบบจะสร้างไฟล์สเปรดชีตใหม่ใน Google Drive ของคุณพร้อม 6 แท็บรายงานครบชุด
            </p>
            <input
              type="text"
              value={newSheetTitle}
              onChange={(e) => setNewSheetTitle(e.target.value)}
              placeholder="ตั้งชื่อไฟล์ Google Sheet..."
              className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
            />
            <button
              type="button"
              disabled={!googleToken || busy}
              onClick={() =>
                setConfirmAction({
                  type: 'create',
                  title: 'ยืนยันการสร้างและบันทึกข้อมูลลง Google Sheets ใหม่',
                  description: `ระบบจะสร้างไฟล์ Google Sheets ชื่อ "${newSheetTitle}" และเขียนข้อมูลทั้งหมด (${units.length} เครื่อง, ${logs.length} รายการบันทึก) ลงในบัญชี Google ของคุณ`,
                })
              }
              className="w-full h-9 rounded-lg bg-[#4A7C9B] hover:bg-[#3C6884] text-white text-xs font-medium disabled:opacity-50 cursor-pointer"
            >
              สร้างและซิงค์ข้อมูลทันที
            </button>
          </div>

          <form
            onSubmit={handleSaveSheetId}
            className="p-4 rounded-xl border border-[#DCE4EE] space-y-3"
          >
            <div className="text-sm font-semibold text-[#1E293B] flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#4A7C9B]" />
              หรือระบุรหัส Google Sheet ที่มีอยู่แล้ว
            </div>
            <p className="text-xs text-[#64748B]">
              วาง URL หรือ Spreadsheet ID ของไฟล์ Google Sheets ที่ต้องการอัปเดต
            </p>
            <input
              type="text"
              value={sheetIdInput}
              onChange={(e) => setSheetIdInput(e.target.value)}
              placeholder="วาง URL หรือ Spreadsheet ID..."
              className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm font-mono-tabular"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 h-9 rounded-lg border border-[#CBD5E1] hover:bg-[#F8FAFC] text-xs font-medium text-[#334155] cursor-pointer"
              >
                บันทึก Spreadsheet ID
              </button>
              {company.googleSheetId && (
                <a
                  href={`https://docs.google.com/spreadsheets/d/${company.googleSheetId}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 px-3 rounded-lg bg-[#EAF2F8] text-[#2F5A78] text-xs font-medium inline-flex items-center gap-1"
                >
                  เปิดชีต <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </form>
        </div>

        {/* Step 3: Manual Sync & Auto-Sync Control */}
        <div className="p-4 rounded-xl bg-[#F4F8FB] border border-[#D4E2EE] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[#1E293B]">
                การซิงค์ข้อมูลรายเดือนและซิงค์อัตโนมัติ
              </div>
              <div className="text-xs text-[#64748B]">
                {company.lastSyncedAt
                  ? `ซิงค์ล่าสุด: ${new Date(company.lastSyncedAt).toLocaleString('th-TH')}`
                  : 'ยังไม่เคยซิงค์ข้อมูล'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="h-9 px-2.5 rounded-lg border border-[#CBD5E1] bg-white text-xs"
              >
                {THAI_MONTHS.map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="h-9 px-2.5 rounded-lg border border-[#CBD5E1] bg-white text-xs"
              >
                {[year - 1, year, year + 1].map((y) => (
                  <option key={y} value={y}>
                    พ.ศ. {y + 543}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!googleToken || !company.googleSheetId || busy}
                onClick={() =>
                  setConfirmAction({
                    type: 'sync',
                    title: 'ยืนยันการอัปเดตข้อมูลไปยัง Google Sheets',
                    description: `ระบบจะอัปเดต 6 แท็บรายงาน (สรุปประจำเดือน ${formatThaiMonthYear(
                      year,
                      month
                    )}, รายการไม่ได้ล้าง, ประวัติการล้างแอร์, สรุปแอร์ทุกชั้นทุกอาคาร, ทะเบียนแอร์, สรุปผลงานช่าง) ลงในไฟล์ Spreadsheet ID: ${
                      company.googleSheetId
                    }`,
                  })
                }
                className="h-9 px-4 rounded-lg bg-[#4A7C9B] hover:bg-[#3C6884] text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
                ซิงค์ข้อมูลตอนนี้
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-[#D4E2EE] flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-[#1E293B]">
                เปิดซิงค์ Google Sheets อัตโนมัติ (Auto-Sync)
              </div>
              <div className="text-xs text-[#64748B]">
                เมื่อบันทึกงานล้างประจำวัน แก้ไข หรือเพิ่มทะเบียนเครื่อง ระบบจะอัปเดต Google Sheets ให้อัตโนมัติ (ขณะลงชื่อเข้าใช้ Google)
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (!company.autoSyncSheets) {
                  if (!googleToken || !company.googleSheetId) {
                    setFeedback({
                      type: 'error',
                      text: 'กรุณาเชื่อมต่อบัญชี Google และระบุ Spreadsheet ID ก่อนเปิดซิงค์อัตโนมัติ',
                    });
                    return;
                  }
                  setConfirmAction({
                    type: 'enable_auto',
                    title: 'ยืนยันเปิดใช้งานซิงค์ Google Sheets อัตโนมัติ',
                    description: `เมื่อเปิดใช้งาน ระบบจะอัปเดตข้อมูลลงใน Spreadsheet ID: ${company.googleSheetId} ทุกครั้งที่มีการบันทึกหรือแก้ไขข้อมูล`,
                  });
                } else {
                  await onUpdateCompany({ autoSyncSheets: false });
                  setFeedback({ type: 'success', text: 'ปิดการซิงค์อัตโนมัติแล้ว' });
                }
              }}
              className={`h-9 px-4 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${
                company.autoSyncSheets
                  ? 'bg-[#ECF6F1] border border-[#B5DEC8] text-[#25593E]'
                  : 'bg-white border border-[#CBD5E1] text-[#475569]'
              }`}
            >
              {company.autoSyncSheets ? 'เปิดใช้งานอยู่ (คลิกเพื่อปิด)' : 'ปิดอยู่ (คลิกเพื่อเปิด)'}
            </button>
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
      </div>

      {/* Explicit Confirmation Dialog (Mandatory for Workspace API writes) */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
          <div className="w-full max-w-md bg-white border border-[#DCE4EE] rounded-xl p-6 space-y-4 shadow-lg">
            <h3 className="text-base font-semibold text-[#1E293B]">{confirmAction.title}</h3>
            <p className="text-sm text-[#475569] leading-relaxed">{confirmAction.description}</p>
            <div className="text-xs text-[#64748B] bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
              แท็บที่จะอัปเดต: สรุปประจำเดือน · รายการไม่ได้ล้าง · ประวัติการล้างแอร์ · สรุปแอร์ทุกชั้นทุกอาคาร · ทะเบียนแอร์ทุกอาคาร · สรุปผลงานช่างเทคนิค
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmAction(null)}
                className="h-9 px-4 rounded-lg border border-[#CBD5E1] text-sm text-[#475569] cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleProceedConfirmed}
                className="h-9 px-4 rounded-lg bg-[#4A7C9B] hover:bg-[#3C6884] text-white text-sm font-medium cursor-pointer disabled:opacity-50"
              >
                {busy ? 'กำลังดำเนินการ...' : 'ยืนยันอัปเดต Google Sheets'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
