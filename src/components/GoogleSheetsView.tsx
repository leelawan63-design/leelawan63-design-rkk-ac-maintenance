import React, { useState } from 'react';
import {
  RefreshCw,
  FilePlus2,
  Link2,
  ExternalLink,
  LogOut,
  Check,
  Copy,
  Code2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ACUnit, CleaningLog, CompanySettings } from '../types';
import { THAI_MONTHS, formatThaiMonthYear, getTodayIso } from '../lib/thaiDate';
import { getAppsScriptTemplate, type SheetsSyncSummary } from '../lib/googleSheetsSync';

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
  onSyncSpreadsheet: (year: number, month: number) => Promise<SheetsSyncSummary>;
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
  const [appsScriptInput, setAppsScriptInput] = useState(company.appsScriptUrl || '');
  const [newSheetTitle, setNewSheetTitle] = useState(
    company.googleSheetName || `รายงานล้างแอร์_${company.name}`
  );

  const [confirmAction, setConfirmAction] = useState<null | {
    type: 'create' | 'sync' | 'enable_auto';
    title: string;
    description: string;
  }>(null);

  const [signingIn, setSigningIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showScriptGuide, setShowScriptGuide] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const hasAppsScript = Boolean(company.appsScriptUrl?.trim());
  const canSyncNow = Boolean((googleToken && company.googleSheetId) || hasAppsScript);
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';

  const handleSignInClick = async () => {
    setSigningIn(true);
    setFeedback(null);
    try {
      await onGoogleSignIn();
      setFeedback({
        type: 'success',
        text: 'เชื่อมต่อบัญชี Google เรียบร้อยแล้ว พร้อมสร้างหรือซิงค์ Google Sheets',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'ไม่สามารถลงชื่อเข้าใช้ Google ได้ กรุณาลองใหม่อีกครั้ง',
      });
    } finally {
      setSigningIn(false);
    }
  };

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

  const handleSaveAppsScriptUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const cleaned = appsScriptInput.trim();
    if (cleaned && !cleaned.startsWith('https://script.google.com/')) {
      setFeedback({
        type: 'error',
        text: 'URL ต้องขึ้นต้นด้วย https://script.google.com/macros/s/.../exec',
      });
      return;
    }
    await onUpdateCompany({ appsScriptUrl: cleaned });
    setFeedback({
      type: 'success',
      text: cleaned
        ? 'บันทึก Google Apps Script Web App URL เรียบร้อยแล้ว สามารถกด "ซิงค์ข้อมูลตอนนี้" หรือเปิด Auto-Sync ได้ทันที'
        : 'ล้างการเชื่อมต่อ Google Apps Script URL แล้ว',
    });
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(getAppsScriptTemplate());
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2500);
    } catch {
      setFeedback({
        type: 'error',
        text: 'ไม่สามารถคัดลอกอัตโนมัติได้ กรุณาคัดลอกโค้ดจากกล่องด้านล่างด้วยตนเอง',
      });
    }
  };

  const formatSyncResultText = (summary: SheetsSyncSummary, prefix: string): string => {
    const parts: string[] = [];
    if (summary.updatedRows > 0) parts.push(`อัปเดตส่วนที่แก้ไข ${summary.updatedRows} แถว`);
    if (summary.appendedRows > 0) {
      parts.push(`เพิ่มรายการใหม่ต่อท้าย ${summary.appendedRows} แถว (เรียงตามอาคาร)`);
    }
    if (summary.updatedTabs.length > 0 && summary.updatedRows === 0 && summary.appendedRows === 0) {
      parts.push(`อัปเดตแท็บ ${summary.updatedTabs.join(', ')}`);
    }
    if (parts.length === 0) {
      return `${prefix} — ข้อมูลใน Google Sheets ตรงกับระบบล่าสุดแล้ว (ไม่มีส่วนที่เปลี่ยนแปลง)`;
    }
    return `${prefix}: ${parts.join(' · ')}`;
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
        const summary = await onSyncSpreadsheet(year, month);
        setFeedback({
          type: 'success',
          text: formatSyncResultText(
            summary,
            `ซิงค์ข้อมูลเดือน ${formatThaiMonthYear(year, month)} สำเร็จ`
          ),
        });
      } else if (confirmAction.type === 'enable_auto') {
        await onUpdateCompany({ autoSyncSheets: true });
        const summary = await onSyncSpreadsheet(year, month);
        setFeedback({
          type: 'success',
          text: formatSyncResultText(summary, 'เปิดใช้งานซิงค์ Google Sheets อัตโนมัติและอัปเดตล่าสุดแล้ว'),
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
            ซิงค์เฉพาะส่วนที่ถูกแก้ไข และหากมีข้อมูลเพิ่มใหม่จะเพิ่มต่อท้ายจากข้อมูลเดิมโดยเรียงลำดับตามอาคารให้ถูกต้อง
          </p>
        </div>

        {/* Step 1: Google Sign-In */}
        <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-[#1E293B]">
              1. บัญชี Google สำหรับเชื่อมต่อ Google Sheets (OAuth)
            </div>
            <div className="text-xs text-[#64748B]">
              {googleToken
                ? `เชื่อมต่อแล้วในนาม ${googleEmail || 'บัญชี Google'} (พร้อมซิงค์ข้อมูล)`
                : 'ยังไม่ได้ลงชื่อเข้าใช้ Google กดปุ่ม Sign in with Google เพื่อเชื่อมต่อ (หรือใช้ Google Apps Script ด้านล่างสำหรับโดเมนภายนอก)'}
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
              disabled={signingIn}
              onClick={handleSignInClick}
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
                <span className="gsi-material-button-contents">
                  {signingIn ? 'กำลังเชื่อมต่อ...' : 'Sign in with Google'}
                </span>
              </div>
            </button>
          )}
        </div>

        {feedback && (
          <div
            className={`px-4 py-3 rounded-xl border text-sm space-y-1.5 ${
              feedback.type === 'success'
                ? 'bg-[#ECF6F1] border-[#C6E2D2] text-[#25593E]'
                : 'bg-[#FDF0F2] border-[#F3CCD3] text-[#9D3E4E]'
            }`}
          >
            <div>{feedback.text}</div>
            {feedback.type === 'error' && feedback.text.includes('unauthorized-domain') && (
              <div className="text-xs text-[#7F1D1D] pt-1">
                วิธีแก้ 1: เพิ่มโดเมน <code className="bg-white/70 px-1.5 py-0.5 rounded">{currentHost}</code> ใน{' '}
                <a
                  href="https://console.firebase.google.com/project/gen-lang-client-0886823361/authentication/settings"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  Firebase Console Authorized Domains
                </a>{' '}
                หรือ วิธีแก้ 2: ใช้การเชื่อมต่อผ่าน <strong>Google Apps Script Web App</strong> ด้านล่าง (ไม่ต้องตั้งค่า Firebase)
              </div>
            )}
          </div>
        )}

        {/* Step 2: Create New or Link Existing Sheet */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-[#DCE4EE] space-y-3">
            <div className="text-sm font-semibold text-[#1E293B] flex items-center gap-2">
              <FilePlus2 className="w-4 h-4 text-[#4A7C9B]" />
              สร้างไฟล์ Google Sheet ใหม่
            </div>
            <p className="text-xs text-[#64748B]">
              ระบบจะสร้างไฟล์สเปรดชีตใหม่ใน Google Drive ของคุณพร้อม 6 แท็บรายงานครบชุด (ใช้เมื่อลงชื่อเข้าใช้ Google)
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

        {/* Alternative Direct Bridge: Google Apps Script Web App */}
        <form
          onSubmit={handleSaveAppsScriptUrl}
          className="p-4 rounded-xl border border-[#D4E2EE] bg-[#F8FBFD] space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-[#1E293B] flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#4A7C9B]" />
                เชื่อมต่อตรงผ่าน Google Apps Script (ใช้ได้บน Cloudflare Pages ทุกเครื่อง ไม่ต้องล็อกอิน Pop-up)
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                เหมาะสำหรับใช้งานบนโดเมน <span className="font-mono-tabular">{currentHost || 'pages.dev'}</span> และให้ Auto-Sync ทำงานทุกครั้งที่มีการบันทึก/แก้ไขข้อมูลจากทุกเครื่อง
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowScriptGuide((v) => !v)}
              className="h-8 px-3 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-xs font-medium text-[#334155] inline-flex items-center gap-1.5 self-start sm:self-center cursor-pointer"
            >
              {showScriptGuide ? (
                <>
                  ซ่อนวิธีติดตั้ง <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  ดูวิธีติดตั้ง &amp; คัดลอกโค้ด <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={appsScriptInput}
              onChange={(e) => setAppsScriptInput(e.target.value)}
              placeholder="วาง Web App URL เช่น https://script.google.com/macros/s/.../exec"
              className="flex-1 h-9 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm font-mono-tabular"
            />
            <button
              type="submit"
              className="h-9 px-4 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-white text-xs font-medium whitespace-nowrap cursor-pointer"
            >
              บันทึก Web App URL
            </button>
          </div>

          {showScriptGuide && (
            <div className="p-3.5 rounded-lg bg-white border border-[#DCE4EE] space-y-2.5 text-xs text-[#334155]">
              <div className="font-semibold text-[#1E293B]">
                วิธีตั้งค่า Google Apps Script (ทำครั้งเดียว ~1 นาที):
              </div>
              <ol className="list-decimal pl-4 space-y-1 text-[#475569]">
                <li>เปิดไฟล์ Google Sheets ที่ต้องการ แล้วเลือกเมนู <strong>ส่วนขยาย (Extensions) → Apps Script</strong></li>
                <li>ลบโค้ดเดิมออกทั้งหมด แล้ววางโค้ดด้านล่างลงไป (กดปุ่ม <strong>คัดลอกโค้ด</strong> ได้เลย)</li>
                <li>กด <strong>การทำให้ใช้งานได้ (Deploy) → การทำให้ใช้งานได้รายการใหม่ (New deployment)</strong></li>
                <li>เลือกประเภทเป็น <strong>เว็บแอป (Web app)</strong> · ตั้ง <strong>Execute as: Me</strong> · <strong>Who has access: Anyone</strong> แล้วกด Deploy</li>
                <li>คัดลอก <strong>Web app URL</strong> (ลงท้ายด้วย <code className="bg-[#F1F5F9] px-1 rounded">/exec</code>) มาวางในช่องด้านบนแล้วกดบันทึก</li>
              </ol>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="h-8 px-3 rounded-lg bg-[#EAF2F8] hover:bg-[#DCE9F4] text-[#2F5A78] font-medium inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedScript ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#25593E]" />
                      คัดลอกโค้ดเรียบร้อยแล้ว
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      คัดลอกโค้ด Apps Script
                    </>
                  )}
                </button>
              </div>
              <pre className="max-h-52 overflow-auto p-3 rounded-lg bg-[#0F172A] text-[#E2E8F0] text-[11px] leading-relaxed font-mono">
                {getAppsScriptTemplate()}
              </pre>
            </div>
          )}
        </form>

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
                disabled={!canSyncNow || busy}
                onClick={() =>
                  setConfirmAction({
                    type: 'sync',
                    title: 'ยืนยันการซิงค์ข้อมูลไปยัง Google Sheets',
                    description: `ระบบจะตรวจสอบความเปลี่ยนแปลงของเดือน ${formatThaiMonthYear(
                      year,
                      month
                    )} อัปเดตเฉพาะแถว/ส่วนที่ถูกแก้ไข และเพิ่มข้อมูลใหม่ต่อท้ายจากข้อมูลเดิมโดยเรียงลำดับตามอาคารให้ถูกต้อง`,
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
                เมื่อบันทึกงานล้างประจำวัน แก้ไข หรือเพิ่มทะเบียนเครื่อง ระบบจะซิงค์เฉพาะส่วนที่เปลี่ยนแปลงและเพิ่มรายการใหม่ต่อท้ายตามลำดับอาคารให้อัตโนมัติ
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (!company.autoSyncSheets) {
                  if (!canSyncNow) {
                    setFeedback({
                      type: 'error',
                      text: 'กรุณาเชื่อมต่อบัญชี Google พร้อมระบุ Spreadsheet ID หรือบันทึก Google Apps Script Web App URL ก่อนเปิดซิงค์อัตโนมัติ',
                    });
                    return;
                  }
                  setConfirmAction({
                    type: 'enable_auto',
                    title: 'ยืนยันเปิดใช้งานซิงค์ Google Sheets อัตโนมัติ',
                    description:
                      'เมื่อเปิดใช้งาน ระบบจะซิงค์เฉพาะส่วนที่ถูกแก้ไข และเพิ่มข้อมูลใหม่ต่อท้ายจากข้อมูลเดิมโดยเรียงตามอาคารทุกครั้งที่มีการบันทึกหรือแก้ไขข้อมูล',
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
      </div>

      {/* Explicit Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
          <div className="w-full max-w-md bg-white border border-[#DCE4EE] rounded-xl p-6 space-y-4 shadow-lg">
            <h3 className="text-base font-semibold text-[#1E293B]">{confirmAction.title}</h3>
            <p className="text-sm text-[#475569] leading-relaxed">{confirmAction.description}</p>
            <div className="text-xs text-[#64748B] bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
              รูปแบบการซิงค์: อัปเดตเฉพาะส่วนที่แก้ไข · เพิ่มข้อมูลใหม่ต่อท้ายจากข้อมูลเดิมโดยเรียงตามอาคาร · ไม่ล้างข้อมูลที่ไม่ได้เปลี่ยนแปลง
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
