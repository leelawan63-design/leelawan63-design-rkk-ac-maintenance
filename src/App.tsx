import { useCallback, useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import type {
  ACUnit,
  BatchLogItemInput,
  CleaningLog,
  CleaningStatus,
  CompanySettings,
  UserAccount,
} from './types';
import { api, getStoredToken, setStoredToken, type TechnicianOption } from './lib/api';
import {
  getGoogleAccessToken,
  initGoogleSheetsAuth,
  signInWithGoogleSheets,
  signOutGoogleSheets,
} from './lib/firebaseAuth';
import {
  createNewGoogleSpreadsheet,
  syncToGoogleSpreadsheet,
  syncViaAppsScript,
  type SheetsSyncSummary,
  type SyncScope,
} from './lib/googleSheetsSync';
import { getTodayIso } from './lib/thaiDate';
import { LoginPage } from './components/LoginPage';
import { Sidebar, type NavTab } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { DailyEntryView } from './components/DailyEntryView';
import { HistoryView } from './components/HistoryView';
import { InventoryView } from './components/InventoryView';
import { ReportsPrintView } from './components/ReportsPrintView';
import { GoogleSheetsView } from './components/GoogleSheetsView';
import { AdminSettingsView } from './components/AdminSettingsView';
import { TechniciansView } from './components/TechniciansView';

const DEFAULT_PUBLIC_COMPANY: Pick<
  CompanySettings,
  'name' | 'address' | 'taxId' | 'phone' | 'siteName' | 'logoDataUrl'
> = {
  name: 'บริษัท รุ่งเรืองกิจการช่าง จำกัด',
  address: '72/10 หมู่ที่ 6 ตำบลบึงคำพร้อย อำเภอลำลูกกา จังหวัดปทุมธานี 12150',
  taxId: '0135548000364',
  phone: '081-839-5607',
  siteName: 'โครงการบำรุงรักษาเครื่องปรับอากาศ โรงพยาบาลรามคำแหง (พ.ศ. 2569)',
  logoDataUrl: '',
};

function getInitialTab(user: UserAccount): NavTab {
  if (user.role === 'super_admin' || user.permissions.canViewDashboard) return 'dashboard';
  if (user.permissions.canEnterDaily) return 'daily';
  if (user.permissions.canViewReports) return 'reports';
  return 'daily';
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [publicCompany, setPublicCompany] = useState(DEFAULT_PUBLIC_COMPANY);
  const [user, setUser] = useState<UserAccount | null>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [units, setUnits] = useState<ACUnit[]>([]);
  const [logs, setLogs] = useState<CleaningLog[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);

  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const loadWorkspaceData = useCallback(async () => {
    const [unitsRes, logsRes, techRes] = await Promise.all([
      api.getUnits(),
      api.getLogs(),
      api.getTechnicians(),
    ]);
    setUnits(unitsRes.units);
    setLogs(logsRes.logs);
    setTechnicians(techRes.technicians);
  }, []);

  const refreshTechnicians = useCallback(async () => {
    const techRes = await api.getTechnicians();
    setTechnicians(techRes.technicians);
  }, []);

  useEffect(() => {
    const unsub = initGoogleSheetsAuth(
      (gUser, token) => {
        setGoogleToken(token);
        setGoogleEmail(gUser.email || gUser.displayName || null);
      },
      () => {
        setGoogleToken(null);
        setGoogleEmail(null);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const pub = await api.getPublicCompany();
        if (!cancelled) setPublicCompany(pub);
      } catch {
        // Use fallback public company info
      }

      const token = getStoredToken();
      if (token) {
        try {
          const meRes = await api.me();
          if (!cancelled) {
            setUser(meRes.user);
            setCompany(meRes.company);
            setActiveTab(getInitialTab(meRes.user));
            await loadWorkspaceData();
          }
        } catch {
          setStoredToken(null);
        }
      }
      if (!cancelled) setBooting(false);
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [loadWorkspaceData]);

  const handleLoginSuccess = async (
    loggedInUser: UserAccount,
    fullCompany: CompanySettings
  ) => {
    setUser(loggedInUser);
    setCompany(fullCompany);
    setActiveTab(getInitialTab(loggedInUser));
    await loadWorkspaceData();
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network error on logout
    }
    setStoredToken(null);
    setUser(null);
    setUnits([]);
    setLogs([]);
    try {
      const pub = await api.getPublicCompany();
      setPublicCompany(pub);
    } catch {
      // ignore
    }
  };

  const triggerAutoSyncIfEnabled = useCallback(
    async (
      nextUnits: ACUnit[],
      nextLogs: CleaningLog[],
      currentCompany: CompanySettings | null,
      changedScope: SyncScope = 'all'
    ) => {
      if (!currentCompany?.autoSyncSheets) return;
      const appsScriptUrl = currentCompany.appsScriptUrl?.trim() || '';
      const token = getGoogleAccessToken();
      const canUseOAuth = Boolean(token && currentCompany.googleSheetId);
      if (!appsScriptUrl && !canUseOAuth) return;

      const today = getTodayIso();
      const year = Number(today.slice(0, 4));
      const month = Number(today.slice(5, 7));

      try {
        const summary = appsScriptUrl
          ? await syncViaAppsScript(appsScriptUrl, {
              company: currentCompany,
              units: nextUnits,
              logs: nextLogs,
              year,
              month,
              changedScope,
            })
          : await syncToGoogleSpreadsheet(token!, currentCompany.googleSheetId, {
              company: currentCompany,
              units: nextUnits,
              logs: nextLogs,
              year,
              month,
              changedScope,
            });
        const nowIso = new Date().toISOString();
        const updated = await api.updateCompany({ lastSyncedAt: nowIso });
        setCompany(updated.company);
        const detail =
          summary.updatedRows > 0 || summary.appendedRows > 0
            ? ` (แก้ไข ${summary.updatedRows} แถว, เพิ่มใหม่ ${summary.appendedRows} แถว)`
            : '';
        setSyncNotice(`ซิงค์ส่วนที่เปลี่ยนแปลงไปยัง Google Sheets อัตโนมัติแล้ว${detail}`);
        setTimeout(() => setSyncNotice(null), 4500);
      } catch (err) {
        setSyncNotice(
          `ไม่สามารถซิงค์ Google Sheets อัตโนมัติได้: ${
            err instanceof Error ? err.message : 'กรุณาเชื่อมต่อ Google ใหม่'
          }`
        );
      }
    },
    []
  );

  const handleSaveBatch = async (payload: {
    date: string;
    technicianId?: string;
    items: BatchLogItemInput[];
  }) => {
    const res = await api.createBatchLogs(payload);
    const logsRes = await api.getLogs();
    setUnits(res.units);
    setLogs(logsRes.logs);
    const scope: SyncScope = res.createdUnits.length > 0 ? 'all' : 'logs';
    await triggerAutoSyncIfEnabled(res.units, logsRes.logs, company, scope);
  };

  const handleUpdateLog = async (
    id: string,
    payload: {
      date?: string;
      status?: CleaningStatus;
      notes?: string;
      technicianId?: string;
    }
  ) => {
    await api.updateLog(id, payload);
    const logsRes = await api.getLogs();
    setLogs(logsRes.logs);
    await triggerAutoSyncIfEnabled(units, logsRes.logs, company, 'logs');
  };

  const handleDeleteLog = async (id: string) => {
    await api.deleteLog(id);
    const nextLogs = logs.filter((l) => l.id !== id);
    setLogs(nextLogs);
    await triggerAutoSyncIfEnabled(units, nextLogs, company, 'logs');
  };

  const handleCreateUnit = async (payload: Partial<ACUnit>) => {
    const res = await api.createUnit(payload);
    setUnits(res.units);
    await triggerAutoSyncIfEnabled(res.units, logs, company, 'units');
  };

  const handleUpdateUnit = async (id: string, payload: Partial<ACUnit>) => {
    const res = await api.updateUnit(id, payload);
    setUnits(res.units);
    await triggerAutoSyncIfEnabled(res.units, logs, company, 'units');
  };

  const handleDeleteUnit = async (id: string) => {
    const res = await api.deleteUnit(id);
    setUnits(res.units);
    await triggerAutoSyncIfEnabled(res.units, logs, company, 'units');
  };

  const handleImportUnits = async (
    rows: Array<Record<string, string>>,
    replaceAll: boolean
  ) => {
    const res = await api.importUnits(rows, replaceAll);
    setUnits(res.units);
    await triggerAutoSyncIfEnabled(res.units, logs, company, 'units');
    return { addedCount: res.addedCount, updatedCount: res.updatedCount };
  };

  const handleUpdateCompany = async (payload: Partial<CompanySettings>) => {
    const res = await api.updateCompany(payload);
    setCompany(res.company);
    setPublicCompany({
      name: res.company.name,
      address: res.company.address,
      taxId: res.company.taxId,
      phone: res.company.phone,
      siteName: res.company.siteName,
      logoDataUrl: res.company.logoDataUrl,
    });
  };

  const handleGoogleSignIn = async () => {
    const res = await signInWithGoogleSheets();
    setGoogleToken(res.accessToken);
    setGoogleEmail(res.user.email || res.user.displayName || null);
  };

  const handleGoogleSignOut = async () => {
    await signOutGoogleSheets();
    setGoogleToken(null);
    setGoogleEmail(null);
  };

  const handleCreateSpreadsheet = async (title: string, year: number, month: number) => {
    const token = getGoogleAccessToken();
    if (!token || !company) throw new Error('กรุณาลงชื่อเข้าใช้ Google ก่อน');
    const created = await createNewGoogleSpreadsheet(token, title, {
      company,
      units,
      logs,
      year,
      month,
    });
    const res = await api.updateCompany({
      googleSheetId: created.spreadsheetId,
      googleSheetName: title,
      lastSyncedAt: new Date().toISOString(),
    });
    setCompany(res.company);
  };

  const handleSyncSpreadsheet = async (
    year: number,
    month: number
  ): Promise<SheetsSyncSummary> => {
    if (!company) throw new Error('ไม่พบข้อมูลบริษัท');
    const appsScriptUrl = company.appsScriptUrl?.trim() || '';
    const token = getGoogleAccessToken();

    let summary: SheetsSyncSummary;
    if (appsScriptUrl) {
      summary = await syncViaAppsScript(appsScriptUrl, {
        company,
        units,
        logs,
        year,
        month,
        changedScope: 'all',
      });
    } else {
      if (!token || !company.googleSheetId) {
        throw new Error('กรุณาเชื่อมต่อ Google หรือตั้งค่า Apps Script Web App URL ก่อนซิงค์');
      }
      summary = await syncToGoogleSpreadsheet(token, company.googleSheetId, {
        company,
        units,
        logs,
        year,
        month,
        changedScope: 'all',
      });
    }

    const res = await api.updateCompany({
      lastSyncedAt: new Date().toISOString(),
    });
    setCompany(res.company);
    return summary;
  };

  const handleSyncDashboard = async (year: number, month: number): Promise<void> => {
    await handleSyncSpreadsheet(year, month);
  };

  if (booting) {
    return (
      <div className="min-h-screen bg-[#F6F8FA] flex items-center justify-center text-sm text-[#64748B]">
        กำลังโหลดระบบ...
      </div>
    );
  }

  if (!user || !company) {
    return <LoginPage company={publicCompany} onLoginSuccess={handleLoginSuccess} />;
  }

  const tabTitles: Record<NavTab, string> = {
    dashboard: 'แดชบอร์ดภาพรวม',
    daily: 'กรอกงานล้างรายวัน',
    history: 'ประวัติการล้างย้อนหลัง',
    inventory: 'ทะเบียนแอร์ทุกอาคาร',
    technicians: 'รายชื่อช่างเทคนิค',
    reports: 'รายงานและพิมพ์เอกสาร',
    sheets: 'ซิงค์ Google Sheets',
    settings: 'ตั้งค่าบริษัทและสิทธิ์ผู้ใช้',
  };

  return (
    <div className="min-h-screen bg-[#F6F8FA] flex print-root">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        user={user}
        company={company}
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col print-main-col">
        {/* Top Bar (hidden when printing) */}
        <header className="h-14 bg-white border-b border-[#DCE4EE] px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-[#475569] hover:bg-[#F1F5F9]"
              aria-label="เปิดเมนู"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm font-semibold text-[#1E293B] truncate">
              {tabTitles[activeTab]}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-[#64748B] shrink-0">
            {syncNotice && (
              <span className="hidden md:inline text-[#2F6A4E] bg-[#ECF6F1] px-2.5 py-1 rounded-md">
                {syncNotice}
              </span>
            )}
            <span className="hidden sm:inline truncate max-w-[240px]">
              ผู้ใช้งาน: <strong className="text-[#1E293B]">{user.fullName}</strong>
            </span>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              user={user}
              company={company}
              units={units}
              logs={logs}
              googleToken={googleToken}
              onSyncSheetsNow={handleSyncDashboard}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'daily' && (
            <DailyEntryView
              user={user}
              units={units}
              logs={logs}
              technicians={technicians}
              onSaveBatch={handleSaveBatch}
            />
          )}

          {activeTab === 'history' && (
            <HistoryView
              user={user}
              company={company}
              units={units}
              logs={logs}
              technicians={technicians}
              onUpdateLog={handleUpdateLog}
              onDeleteLog={handleDeleteLog}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryView
              units={units}
              onCreateUnit={handleCreateUnit}
              onUpdateUnit={handleUpdateUnit}
              onDeleteUnit={handleDeleteUnit}
              onImportUnits={handleImportUnits}
            />
          )}

          {activeTab === 'technicians' && (
            <TechniciansView
              currentUser={user}
              logs={logs}
              onTechniciansChanged={refreshTechnicians}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsPrintView company={company} units={units} logs={logs} />
          )}

          {activeTab === 'sheets' && (
            <GoogleSheetsView
              company={company}
              units={units}
              logs={logs}
              googleToken={googleToken}
              googleEmail={googleEmail}
              onGoogleSignIn={handleGoogleSignIn}
              onGoogleSignOut={handleGoogleSignOut}
              onUpdateCompany={handleUpdateCompany}
              onCreateSpreadsheet={handleCreateSpreadsheet}
              onSyncSpreadsheet={handleSyncSpreadsheet}
            />
          )}

          {activeTab === 'settings' && (
            <AdminSettingsView
              currentUser={user}
              company={company}
              onUpdateCompany={handleUpdateCompany}
            />
          )}
        </main>
      </div>
    </div>
  );
}
