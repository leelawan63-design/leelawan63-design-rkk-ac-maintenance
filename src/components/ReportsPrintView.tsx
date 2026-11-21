import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Printer, FileSpreadsheet, ExternalLink, Download, X } from 'lucide-react';
import type { ACUnit, CleaningLog, CleaningStatus, CompanySettings } from '../types';
import { CLEANING_STATUS_LABELS } from '../types';
import {
  computeBuildingFloorInventory,
  computeContractCounts,
  computeMajorCycleSummary,
  computeMonthlyCleaningMatrix,
  computeTechnicianStats,
  computeUncleanedSummary,
  formatReportBuildingName,
  formatReportNotes,
  formatReportTechnicianFirstName,
  formatReportTechnicianName,
  getCleaningCycleTypeLabel,
  getMajorCleaningCycle,
  groupUncleanedItemsByBuildingFloor,
} from '../lib/reportCalc';
import {
  THAI_MONTHS,
  formatThaiDate,
  formatThaiMonthYear,
  getTodayIso,
} from '../lib/thaiDate';
import { exportAllReportsToSingleExcel } from '../lib/excelExport';
import { CompanyLogo } from './CompanyLogo';

interface ReportsPrintViewProps {
  company: CompanySettings;
  units: ACUnit[];
  logs: CleaningLog[];
}

type ReportTab =
  | 'monthly'
  | 'monthly_cleaned'
  | 'uncleaned_filtered'
  | 'daily_signoff'
  | 'building_floors'
  | 'technicians';

type UncleanedFilter = 'all' | 'patient_occupied' | 'renovation' | 'no_card';
type DailyStatusFilter =
  | 'all'
  | 'cleaned'
  | 'uncleaned_all'
  | 'patient_occupied'
  | 'renovation'
  | 'no_card';

const REPORT_TAB_TITLES: Record<ReportTab, string> = {
  monthly: '1. รายงานสรุปประจำเดือน / ประจำปี',
  monthly_cleaned: '2. บัญชีรายการเข้าล้างแล้วรายเดือน',
  uncleaned_filtered: '3. รายงานไม่ได้เข้าล้าง (แยกประเภท)',
  daily_signoff: '4. บัญชีรายการเข้าล้างรายวัน (เซ็นตรวจรับ)',
  building_floors: '5. สรุปจำนวนแอร์ทุกชั้นทุกอาคาร',
  technicians: '6. รายงานผลงานช่างเทคนิค',
};

const UNCLEANED_FILTER_LABELS: Record<UncleanedFilter, string> = {
  all: 'ทุกสาเหตุที่ไม่ได้เข้าล้าง',
  patient_occupied: 'เฉพาะห้องมีคนไข้',
  renovation: 'เฉพาะห้องปิดปรับปรุง',
  no_card: 'เฉพาะไม่มีการ์ด',
};

const DAILY_STATUS_FILTER_LABELS: Record<DailyStatusFilter, string> = {
  all: 'ทุกสถานะ',
  cleaned: 'เฉพาะล้างแล้ว',
  uncleaned_all: 'เฉพาะไม่ได้เข้าล้างทั้งหมด',
  patient_occupied: 'เฉพาะห้องมีคนไข้',
  renovation: 'เฉพาะห้องปิดปรับปรุง',
  no_card: 'เฉพาะไม่มีการ์ด',
};

export const ReportsPrintView: React.FC<ReportsPrintViewProps> = ({
  company,
  units,
  logs,
}) => {
  const today = getTodayIso();
  const initialYear = Number(today.slice(0, 4));
  const initialMonth = Number(today.slice(5, 7));

  const [activeReport, setActiveReport] = useState<ReportTab>('monthly');
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedBuilding, setSelectedBuilding] = useState('all');
  const [selectedAcType, setSelectedAcType] = useState<'all' | 'normal' | 'vrf'>('all');
  const [uncleanedCategory, setUncleanedCategory] = useState<UncleanedFilter>('all');

  const [dailyDateMode, setDailyDateMode] = useState<'single' | 'range'>('single');
  const [dailyDate, setDailyDate] = useState(today);
  const [dailyRangeStart, setDailyRangeStart] = useState(today);
  const [dailyRangeEnd, setDailyRangeEnd] = useState(today);
  const [dailyBuilding, setDailyBuilding] = useState('all');
  const [dailyStatusFilter, setDailyStatusFilter] = useState<DailyStatusFilter>('all');

  const [rangeStart, setRangeStart] = useState(`${today.slice(0, 7)}-01`);
  const [rangeEnd, setRangeEnd] = useState(today);

  const [senderName, setSenderName] = useState('');
  const [inspectorName, setInspectorName] = useState('');
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [showBuildingBreakdown, setShowBuildingBreakdown] = useState(true);
  const [combineMajorCycle, setCombineMajorCycle] = useState(false);
  const [showMajorSummaryTable, setShowMajorSummaryTable] = useState(true);
  const [showMonthlySection1, setShowMonthlySection1] = useState(true);
  const [showMonthlySection2, setShowMonthlySection2] = useState(true);
  const [showMonthlySection3, setShowMonthlySection3] = useState(true);
  const [showMonthlyTechSummary, setShowMonthlyTechSummary] = useState(true);
  const [showDailyTechnicianCol, setShowDailyTechnicianCol] = useState(true);

  const [printFallbackUrl, setPrintFallbackUrl] = useState<string | null>(null);
  const printContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (printFallbackUrl) {
        URL.revokeObjectURL(printFallbackUrl);
      }
    };
  }, [printFallbackUrl]);

  // Clear stale fallback print link whenever the selected report or any filter changes
  useEffect(() => {
    setPrintFallbackUrl(null);
  }, [
    activeReport,
    selectedYear,
    selectedMonth,
    selectedBuilding,
    selectedAcType,
    uncleanedCategory,
    dailyDateMode,
    dailyDate,
    dailyRangeStart,
    dailyRangeEnd,
    dailyBuilding,
    dailyStatusFilter,
    rangeStart,
    rangeEnd,
    printOrientation,
    showBuildingBreakdown,
    combineMajorCycle,
    showMajorSummaryTable,
    showMonthlySection1,
    showMonthlySection2,
    showMonthlySection3,
    showMonthlyTechSummary,
    showDailyTechnicianCol,
    senderName,
    inspectorName,
  ]);

  const isMonthBasedReport =
    activeReport === 'monthly' ||
    activeReport === 'monthly_cleaned' ||
    activeReport === 'uncleaned_filtered';

  const majorCycle = useMemo(() => getMajorCleaningCycle(selectedMonth), [selectedMonth]);
  const cleaningTypeLabel = useMemo(
    () => getCleaningCycleTypeLabel(selectedMonth),
    [selectedMonth]
  );
  const isCombinedMajor = Boolean(majorCycle && combineMajorCycle && isMonthBasedReport);

  const contract = useMemo(() => computeContractCounts(units), [units]);
  const floorInv = useMemo(() => computeBuildingFloorInventory(units), [units]);
  const cancelledIds = useMemo(
    () => new Set(units.filter((u) => u.status === 'cancelled').map((u) => u.id)),
    [units]
  );

  const matrix = useMemo(
    () => computeMonthlyCleaningMatrix(logs, units, selectedYear, selectedMonth),
    [logs, units, selectedYear, selectedMonth]
  );
  const uncleaned = useMemo(
    () => computeUncleanedSummary(logs, units, selectedYear, selectedMonth),
    [logs, units, selectedYear, selectedMonth]
  );

  const majorSummary = useMemo(
    () =>
      isCombinedMajor && majorCycle
        ? computeMajorCycleSummary(logs, units, selectedYear, majorCycle.months)
        : null,
    [isCombinedMajor, majorCycle, logs, units, selectedYear]
  );

  const activeUncleaned = useMemo(
    () => (majorSummary ? majorSummary.uncleanedSummary : uncleaned),
    [majorSummary, uncleaned]
  );

  const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const activeMonthPrefixes = useMemo(() => {
    if (isCombinedMajor && majorCycle) {
      return majorCycle.months.map((m) => `${selectedYear}-${String(m).padStart(2, '0')}`);
    }
    return [monthPrefix];
  }, [isCombinedMajor, majorCycle, selectedYear, monthPrefix]);

  const monthLogs = useMemo(
    () => logs.filter((l) => activeMonthPrefixes.includes(l.date.slice(0, 7))),
    [logs, activeMonthPrefixes]
  );
  const monthTechStats = useMemo(
    () => computeTechnicianStats(monthLogs, units),
    [monthLogs, units]
  );

  const monthlyUncleanedItems = useMemo(() => {
    return activeUncleaned.allItems.filter((item) => {
      if (uncleanedCategory !== 'all' && item.status !== uncleanedCategory) return false;
      if (activeReport === 'uncleaned_filtered' && selectedBuilding !== 'all' && item.building !== selectedBuilding) {
        return false;
      }
      return true;
    });
  }, [activeUncleaned.allItems, uncleanedCategory, activeReport, selectedBuilding]);

  const groupedMonthlyUncleaned = useMemo(
    () => groupUncleanedItemsByBuildingFloor(monthlyUncleanedItems),
    [monthlyUncleanedItems]
  );

  const monthlyCleanedLogs = useMemo(() => {
    return logs
      .filter((l) => {
        if (!activeMonthPrefixes.includes(l.date.slice(0, 7))) return false;
        if (l.status !== 'cleaned') return false;
        if (cancelledIds.has(l.unitId)) return false;
        if (selectedBuilding !== 'all' && l.building !== selectedBuilding) return false;
        if (selectedAcType !== 'all' && l.acType !== selectedAcType) return false;
        return true;
      })
      .sort((a, b) => {
        const bCmp = formatReportBuildingName(a.building).localeCompare(
          formatReportBuildingName(b.building),
          'th',
          { numeric: true }
        );
        if (bCmp !== 0) return bCmp;
        const fCmp = a.floor.localeCompare(b.floor, 'th', { numeric: true });
        if (fCmp !== 0) return fCmp;
        const dCmp = a.date.localeCompare(b.date);
        if (dCmp !== 0) return dCmp;
        return a.unitCode.localeCompare(b.unitCode, 'th', { numeric: true });
      });
  }, [logs, activeMonthPrefixes, cancelledIds, selectedBuilding, selectedAcType]);

  const activeUnitCountsByBuilding = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of units) {
      if (u.status === 'cancelled') continue;
      if (selectedAcType !== 'all' && u.acType !== selectedAcType) continue;
      const key = formatReportBuildingName(u.building);
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [units, selectedAcType]);

  const monthlyCleanedGroups = useMemo(() => {
    const groups: Array<{
      buildingName: string;
      totalInBuilding: number;
      normalCount: number;
      vrfCount: number;
      items: Array<{ log: CleaningLog; rowNumber: number }>;
    }> = [];
    let current: (typeof groups)[number] | null = null;

    monthlyCleanedLogs.forEach((log, idx) => {
      const buildingName = formatReportBuildingName(log.building);
      if (!current || current.buildingName !== buildingName) {
        current = {
          buildingName,
          totalInBuilding: activeUnitCountsByBuilding[buildingName] || 0,
          normalCount: 0,
          vrfCount: 0,
          items: [],
        };
        groups.push(current);
      }
      if (log.acType === 'vrf') current.vrfCount++;
      else current.normalCount++;
      current.items.push({ log, rowNumber: idx + 1 });
    });

    return groups;
  }, [monthlyCleanedLogs, activeUnitCountsByBuilding]);

  const effectiveDailyStart =
    dailyDateMode === 'single'
      ? dailyDate
      : dailyRangeStart <= dailyRangeEnd
        ? dailyRangeStart
        : dailyRangeEnd;

  const effectiveDailyEnd =
    dailyDateMode === 'single'
      ? dailyDate
      : dailyRangeStart <= dailyRangeEnd
        ? dailyRangeEnd
        : dailyRangeStart;

  const isDailyMultiDay =
    dailyDateMode === 'range' && effectiveDailyStart !== effectiveDailyEnd;

  const dailyLogs = useMemo(() => {
    return logs
      .filter((l) => {
        if (effectiveDailyStart && l.date < effectiveDailyStart) return false;
        if (effectiveDailyEnd && l.date > effectiveDailyEnd) return false;
        if (dailyBuilding !== 'all' && l.building !== dailyBuilding) return false;
        if (dailyStatusFilter === 'cleaned' && l.status !== 'cleaned') return false;
        if (dailyStatusFilter === 'uncleaned_all' && l.status === 'cleaned') return false;
        if (
          (dailyStatusFilter === 'patient_occupied' ||
            dailyStatusFilter === 'renovation' ||
            dailyStatusFilter === 'no_card') &&
          l.status !== (dailyStatusFilter as CleaningStatus)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dCmp = a.date.localeCompare(b.date);
        if (dCmp !== 0) return dCmp;
        const bCmp = a.building.localeCompare(b.building, 'th');
        if (bCmp !== 0) return bCmp;
        const fCmp = a.floor.localeCompare(b.floor, 'th', { numeric: true });
        if (fCmp !== 0) return fCmp;
        return a.unitCode.localeCompare(b.unitCode, 'th', { numeric: true });
      });
  }, [logs, effectiveDailyStart, effectiveDailyEnd, dailyBuilding, dailyStatusFilter]);

  const rangeLogs = useMemo(() => {
    return logs.filter((l) => {
      if (rangeStart && l.date < rangeStart) return false;
      if (rangeEnd && l.date > rangeEnd) return false;
      return true;
    });
  }, [logs, rangeStart, rangeEnd]);

  const rangeTechStats = useMemo(
    () => computeTechnicianStats(rangeLogs, units),
    [rangeLogs, units]
  );

  const availableYears = useMemo(() => {
    const years = new Set<number>([initialYear, initialYear - 1, initialYear + 1]);
    for (const l of logs) {
      const y = Number(l.date.slice(0, 4));
      if (!Number.isNaN(y)) years.add(y);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [logs, initialYear]);

  const buildPrintableHtmlBlobUrl = (): string | null => {
    const container = printContainerRef.current;
    if (!container) return null;

    const headStyles = Array.from(
      document.querySelectorAll('link[rel="stylesheet"], style')
    )
      .map((el) => el.outerHTML)
      .join('\n');

    const sheetWidthCss = printOrientation === 'landscape' ? '297mm' : '210mm';

    const htmlDoc = `<!doctype html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <base href="${window.location.origin}/" />
  <title>${REPORT_TAB_TITLES[activeReport]} - ${company.name}</title>
  ${headStyles}
  <style>
    @page { size: A4 ${printOrientation}; margin: 0mm; }
    * { box-sizing: border-box; }
    html, body {
      background: #EEF2F6 !important;
      color: #0F172A !important;
      margin: 0;
      padding: 20px 16px;
      font-family: 'Noto Sans Thai', 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      font-size: 10px;
      line-height: 1.3;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .overflow-x-auto { overflow: visible !important; }
    .print-container {
      width: 100% !important;
      max-width: ${sheetWidthCss} !important;
      background: #FFFFFF !important;
      border: 1px solid #DCE4EE !important;
      border-radius: 6px !important;
      padding: 10mm !important;
      margin: 0 auto !important;
      box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08) !important;
      overflow: visible !important;
    }
    .print-page-shell,
    .print-page-shell > .print-shell-body,
    .print-page-shell > .print-shell-body > tr,
    .print-page-shell > .print-shell-body > tr > td.print-shell-cell {
      display: block;
      width: 100%;
      padding: 0;
      border: none;
    }
    .print-shell-head,
    .print-shell-foot {
      display: none;
    }
    h1, h2, h3 { break-after: avoid; page-break-after: avoid; }
    table:not(.print-page-shell) {
      border-collapse: collapse !important;
      width: 100% !important;
      max-width: 100% !important;
      table-layout: fixed !important;
      page-break-inside: auto !important;
      break-inside: auto !important;
    }
    table:not(.print-page-shell) > thead { display: table-header-group !important; }
    table:not(.print-page-shell) > tfoot { display: table-row-group !important; }
    table:not(.print-page-shell) > tbody { page-break-inside: auto !important; }
    table:not(.print-page-shell) tr { break-inside: avoid !important; page-break-inside: avoid !important; }
    table:not(.print-page-shell) th,
    table:not(.print-page-shell) td {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .print-toolbar-standalone {
      max-width: ${sheetWidthCss};
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #FFFFFF;
      border: 1px solid #DCE4EE;
      border-radius: 10px;
    }
    @media print {
      html, body {
        background: #FFFFFF !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        height: auto !important;
      }
      .print-container {
        max-width: 100% !important;
        width: 100% !important;
        padding: 0 !important;
        margin: 0 auto !important;
        border: none !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }
      .print-page-shell {
        display: table !important;
        width: 100% !important;
        max-width: 100% !important;
        border-collapse: separate !important;
        border-spacing: 0 !important;
        border: none !important;
        table-layout: fixed !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .print-shell-head { display: table-header-group !important; }
      .print-shell-foot { display: table-footer-group !important; }
      .print-shell-body {
        display: table-row-group !important;
        break-inside: auto !important;
        page-break-inside: auto !important;
      }
      .print-shell-body > tr {
        display: table-row !important;
        break-inside: auto !important;
        page-break-inside: auto !important;
      }
      .print-shell-break-row {
        break-before: page !important;
        page-break-before: always !important;
      }
      .print-shell-spacer {
        display: table-cell !important;
        height: 10mm !important;
        padding: 0 !important;
        margin: 0 !important;
        border: none !important;
        background: transparent !important;
        line-height: 0 !important;
        font-size: 0 !important;
      }
      .print-shell-cell {
        display: table-cell !important;
        padding: 0 10mm !important;
        border: none !important;
        vertical-align: top !important;
        break-inside: auto !important;
        page-break-inside: auto !important;
      }
      .print-toolbar-standalone { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="print-toolbar-standalone">
    <div>
      <div style="font-size:13px;font-weight:600;color:#1E293B;">${REPORT_TAB_TITLES[activeReport]}</div>
      <div style="font-size:11px;color:#64748B;margin-top:2px;">เอกสารจัดขอบกระดาษ A4 เว้นระยะ 1 ซม. ทั้ง 4 ด้านทุกหน้าโดยอัตโนมัติ (เลือก Margins: Default หรือ None ได้ทันที)</div>
    </div>
    <button onclick="window.print()" style="padding:8px 16px;background:#4A7C9B;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;white-space:nowrap;">
      พิมพ์รายงานนี้ออกเครื่องพิมพ์
    </button>
  </div>
  <div class="print-container">${container.innerHTML}</div>
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        try { window.print(); } catch (e) {}
      }, 300);
    });
  </script>
</body>
</html>`;

    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
    return URL.createObjectURL(blob);
  };

  const handlePrint = () => {
    if (printFallbackUrl) {
      URL.revokeObjectURL(printFallbackUrl);
      setPrintFallbackUrl(null);
    }

    let beforePrintFired = false;
    const onBeforePrint = () => {
      beforePrintFired = true;
    };
    window.addEventListener('beforeprint', onBeforePrint);

    try {
      window.print();
    } catch {
      // Blocked by iframe sandbox
    }

    setTimeout(() => {
      window.removeEventListener('beforeprint', onBeforePrint);
      if (!beforePrintFired) {
        const url = buildPrintableHtmlBlobUrl();
        if (url) {
          setPrintFallbackUrl(url);
        }
      }
    }, 350);
  };

  const handleExportAllExcel = () => {
    exportAllReportsToSingleExcel({
      company,
      units,
      logs,
      year: selectedYear,
      month: selectedMonth,
      dailyDate,
      startDate: rangeStart,
      endDate: rangeEnd,
      combineMajorCycle: isCombinedMajor,
    });
  };

  const renderLetterhead = (title: string, subtitle: string) => (
    <div className="border-b-2 border-[#334155] pb-2.5 mb-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <CompanyLogo
          logoDataUrl={company.logoDataUrl}
          companyName={company.name}
          size="print"
        />
        <div className="space-y-0.5 min-w-0">
          <div className="text-sm sm:text-base font-bold text-[#0F172A] leading-snug">
            {company.name}
          </div>
          <div className="text-[11px] text-[#334155] leading-snug">{company.address}</div>
          <div className="text-[11px] text-[#475569] tabular-nums leading-snug">
            เลขประจำตัวผู้เสียภาษี {company.taxId} · โทร {company.phone}
          </div>
        </div>
      </div>

      <div className="sm:text-right space-y-0.5 shrink-0 sm:max-w-[44%]">
        <div className="text-xs sm:text-sm font-bold text-[#1E293B] leading-snug">{title}</div>
        <div className="text-[11px] text-[#475569] leading-snug">{subtitle}</div>
        {company.siteName && (
          <div className="text-[11px] text-[#64748B] leading-snug">{company.siteName}</div>
        )}
      </div>
    </div>
  );

  const renderSignatures = () => (
    <div className="mt-4 pt-3 border-t border-[#CBD5E1] grid grid-cols-2 gap-6 print-break-inside-avoid">
      <div className="text-center space-y-2.5">
        <div className="text-[11px] font-semibold text-[#1E293B]">
          {company.defaultSenderLabel || 'ผู้ส่งงาน (ช่างผู้ปฏิบัติงาน / ตัวแทนบริษัท)'}
        </div>
        <div className="pt-2 space-y-1">
          <div className="text-[11px] text-[#475569]">
            ลงชื่อ .......................................................
          </div>
          <div className="text-[11px] text-[#475569]">
            ( {senderName.trim() || '.....................................................'} )
          </div>
          <div className="text-[11px] text-[#64748B]">
            วันที่ .......... / .................... / ................
          </div>
        </div>
      </div>

      <div className="text-center space-y-2.5">
        <div className="text-[11px] font-semibold text-[#1E293B]">
          {company.defaultInspectorLabel || 'ผู้ตรวจรับงาน (เจ้าหน้าที่ผู้ว่าจ้าง)'}
        </div>
        <div className="pt-2 space-y-1">
          <div className="text-[11px] text-[#475569]">
            ลงชื่อ .......................................................
          </div>
          <div className="text-[11px] text-[#475569]">
            ( {inspectorName.trim() || '.....................................................'} )
          </div>
          <div className="text-[11px] text-[#64748B]">
            วันที่ .......... / .................... / ................
          </div>
        </div>
      </div>
    </div>
  );

  const sheetPreviewMaxWidth =
    printOrientation === 'landscape' ? 'max-w-[297mm]' : 'max-w-[210mm]';

  return (
    <div className="space-y-6">
      <style>{`@page { size: A4 ${printOrientation}; margin: 0mm; }`}</style>

      {/* Control Toolbar (hidden on print) */}
      <div className="bg-white border border-[#DCE4EE] rounded-xl p-5 space-y-4 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#1E293B]">ศูนย์รายงานและพิมพ์เอกสาร (A4)</h1>
            <p className="text-sm text-[#64748B] mt-0.5">
              เลือกรายงานและกรองประเภทที่ต้องการ ตรวจสอบข้อมูล พร้อมพิมพ์ออกทางเครื่องพิมพ์เฉพาะรายงานที่เลือก
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="การวางหน้ากระดาษพิมพ์"
              value={printOrientation}
              onChange={(e) => setPrintOrientation(e.target.value as 'portrait' | 'landscape')}
              className="h-10 px-3 rounded-lg border border-[#CBD5E1] bg-white text-xs text-[#334155]"
            >
              <option value="portrait">กระดาษ A4 แนวตั้ง</option>
              <option value="landscape">กระดาษ A4 แนวนอน</option>
            </select>

            <button
              type="button"
              onClick={handleExportAllExcel}
              className="h-10 px-4 rounded-lg bg-[#EAF5EF] hover:bg-[#DCEEE4] border border-[#C6E2D2] text-[#2F6A4E] text-sm font-medium flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              ดาวน์โหลด Excel ทุกรายงานในไฟล์เดียว
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="h-10 px-4 rounded-lg bg-[#4A7C9B] hover:bg-[#3C6884] text-white text-sm font-medium flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              พิมพ์รายงานนี้
            </button>
          </div>
        </div>

        {/* Fallback Print Banner if Browser Iframe Blocked window.print() */}
        {printFallbackUrl && (
          <div className="p-3.5 rounded-xl bg-[#EEF4F9] border border-[#C6D8E8] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-[#254B66] space-y-0.5">
              <div className="font-semibold">
                พร้อมพิมพ์เฉพาะรายงาน: {REPORT_TAB_TITLES[activeReport]}
              </div>
              <div>
                หน้าต่างแสดงตัวอย่างจำกัดการเปิดคำสั่งพิมพ์โดยตรง กรุณากดปุ่มด้านขวาเพื่อเปิดหน้าสั่งพิมพ์ (ตั้งค่า Margins เป็น Default หรือ None เอกสารจะเว้นขอบกระดาษ 1 ซม. ครบทั้ง 4 ด้านทุกหน้าโดยอัตโนมัติ)
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <a
                href={printFallbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-3.5 rounded-lg bg-[#4A7C9B] hover:bg-[#3C6884] text-white text-xs font-medium inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                เปิดหน้าสั่งพิมพ์
              </a>
              <a
                href={printFallbackUrl}
                download={`รายงาน_${activeReport}_${monthPrefix}.html`}
                className="h-9 px-3.5 rounded-lg bg-white border border-[#CBD5E1] hover:bg-[#F8FAFC] text-[#334155] text-xs font-medium inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                ดาวน์โหลดไฟล์พร้อมพิมพ์
              </a>
              <button
                type="button"
                onClick={() => setPrintFallbackUrl(null)}
                aria-label="ปิดแถบแจ้งเตือน"
                className="p-1.5 text-[#64748B] hover:text-[#1E293B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Report Type Selector */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-[#F1F5F9] rounded-lg">
          {(Object.keys(REPORT_TAB_TITLES) as ReportTab[]).map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setActiveReport(tabKey)}
              className={`px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeReport === tabKey
                  ? 'bg-white text-[#1E293B] shadow-sm'
                  : 'text-[#64748B] hover:text-[#1E293B]'
              }`}
            >
              {REPORT_TAB_TITLES[tabKey]}
            </button>
          ))}
        </div>

        {/* Contextual Parameters + Signature Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-[#E8EEF4]">
          {isMonthBasedReport && (
            <>
              <div className="space-y-1">
                <label className="block text-xs text-[#64748B]">เดือน</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm"
                >
                  {THAI_MONTHS.map((m, idx) => (
                    <option key={m} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-[#64748B]">ปี (พ.ศ. / ค.ศ.)</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      พ.ศ. {y + 543} ({y})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-[#64748B]">
                  รอบการล้าง (ล้างใหญ่ / ล้างย่อย)
                </label>
                {majorCycle ? (
                  <select
                    aria-label="รูปแบบรอบการล้างใหญ่"
                    value={combineMajorCycle ? 'combined' : 'single'}
                    onChange={(e) => {
                      const nextCombined = e.target.value === 'combined';
                      setCombineMajorCycle(nextCombined);
                      if (nextCombined) {
                        setShowMajorSummaryTable(true);
                      }
                    }}
                    className="w-full h-9 px-3 rounded-lg border border-[#4A7C9B]/60 bg-[#F4F8FB] text-sm font-medium text-[#1E3A5F]"
                  >
                    <option value="single">
                      การล้างใหญ่ — แยกเดือน{THAI_MONTHS[selectedMonth - 1]}
                    </option>
                    <option value="combined">
                      การล้างใหญ่ — รวม 2 เดือน ({majorCycle.label})
                    </option>
                  </select>
                ) : (
                  <div className="w-full h-9 px-3 rounded-lg border border-[#DCE4EE] bg-[#F8FAFC] text-sm text-[#475569] flex items-center">
                    การล้างย่อย (เดือน{THAI_MONTHS[selectedMonth - 1]})
                  </div>
                )}
              </div>
            </>
          )}

          {(activeReport === 'monthly' || activeReport === 'uncleaned_filtered') && (
            <div className="space-y-1">
              <label className="block text-xs text-[#64748B]">
                ประเภทรายการไม่ได้เข้าล้าง
              </label>
              <select
                value={uncleanedCategory}
                onChange={(e) => setUncleanedCategory(e.target.value as UncleanedFilter)}
                className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm"
              >
                {Object.entries(UNCLEANED_FILTER_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeReport === 'monthly' && (
            <div className="space-y-1">
              <label className="block text-xs text-[#64748B]">
                ตารางที่ 1 (สรุปการล้างรายวัน)
              </label>
              <select
                value={showBuildingBreakdown ? 'by_building' : 'summary_only'}
                onChange={(e) => setShowBuildingBreakdown(e.target.value === 'by_building')}
                className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm"
              >
                <option value="by_building">แจกแจงตามอาคาร</option>
                <option value="summary_only">ไม่แจกแจงอาคาร (แสดงยอดรวมรายวัน)</option>
              </select>
            </div>
          )}

          {(activeReport === 'monthly_cleaned' || activeReport === 'uncleaned_filtered') && (
            <div className="space-y-1">
              <label className="block text-xs text-[#64748B]">อาคาร</label>
              <select
                value={selectedBuilding}
                onChange={(e) => setSelectedBuilding(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm"
              >
                <option value="all">ทุกอาคาร</option>
                {contract.buildings.map((b) => (
                  <option key={b} value={b}>
                    {formatReportBuildingName(b)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeReport === 'monthly_cleaned' && (
            <div className="space-y-1">
              <label className="block text-xs text-[#64748B]">ประเภทแอร์</label>
              <select
                value={selectedAcType}
                onChange={(e) => setSelectedAcType(e.target.value as 'all' | 'normal' | 'vrf')}
                className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm"
              >
                <option value="all">ทุกประเภท (ปกติ + VRF/VRV)</option>
                <option value="normal">เฉพาะแอร์ปกติ</option>
                <option value="vrf">เฉพาะ VRF / VRV</option>
              </select>
            </div>
          )}

          {activeReport === 'daily_signoff' && (
            <>
              <div className="space-y-1">
                <label className="block text-xs text-[#64748B]">รูปแบบช่วงวันที่</label>
                <select
                  value={dailyDateMode}
                  onChange={(e) => {
                    const mode = e.target.value as 'single' | 'range';
                    if (mode === 'range' && dailyDateMode === 'single') {
                      setDailyRangeStart(dailyDate);
                      if (dailyRangeEnd < dailyDate) {
                        setDailyRangeEnd(dailyDate);
                      }
                    }
                    setDailyDateMode(mode);
                  }}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm"
                >
                  <option value="single">วันเดียว (รายวัน)</option>
                  <option value="range">ช่วงระหว่างวันที่ (รายสัปดาห์ / กำหนดเอง)</option>
                </select>
              </div>
              {dailyDateMode === 'single' ? (
                <div className="space-y-1">
                  <label className="block text-xs text-[#64748B]">วันที่เข้าล้าง</label>
                  <input
                    type="date"
                    value={dailyDate}
                    onChange={(e) => setDailyDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="block text-xs text-[#64748B]">ตั้งแต่วันที่</label>
                    <input
                      type="date"
                      value={dailyRangeStart}
                      onChange={(e) => setDailyRangeStart(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-[#64748B]">ถึงวันที่</label>
                    <input
                      type="date"
                      value={dailyRangeEnd}
                      onChange={(e) => setDailyRangeEnd(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                    />
                  </div>
                </>
              )}
              <div className="space-y-1">
                <label className="block text-xs text-[#64748B]">อาคาร</label>
                <select
                  value={dailyBuilding}
                  onChange={(e) => setDailyBuilding(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm"
                >
                  <option value="all">ทุกอาคาร</option>
                  {contract.buildings.map((b) => (
                    <option key={b} value={b}>
                      {formatReportBuildingName(b)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-[#64748B]">กรองตามสถานะ</label>
                <select
                  value={dailyStatusFilter}
                  onChange={(e) => setDailyStatusFilter(e.target.value as DailyStatusFilter)}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm"
                >
                  {Object.entries(DAILY_STATUS_FILTER_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeReport === 'technicians' && (
            <>
              <div className="space-y-1">
                <label className="block text-xs text-[#64748B]">ตั้งแต่วันที่</label>
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-[#64748B]">ถึงวันที่</label>
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="block text-xs text-[#64748B]">ชื่อผู้ส่งงาน (สำหรับพิมพ์ท้ายเอกสาร)</label>
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="เว้นว่างเพื่อเขียนด้วยลายมือ"
              className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-[#64748B]">ชื่อผู้ตรวจรับงาน (สำหรับพิมพ์ท้ายเอกสาร)</label>
            <input
              type="text"
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              placeholder="เว้นว่างเพื่อเขียนด้วยลายมือ"
              className="w-full h-9 px-3 rounded-lg border border-[#CBD5E1] text-sm"
            />
          </div>
        </div>

        {activeReport === 'daily_signoff' && (
          <div className="pt-3 border-t border-[#E8EEF4] flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-[#334155] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showDailyTechnicianCol}
                onChange={(e) => setShowDailyTechnicianCol(e.target.checked)}
                className="w-4 h-4 rounded border-[#CBD5E1] text-[#4A7C9B] focus:ring-[#4A7C9B]"
              />
              <span>แสดงคอลัมน์ &quot;ช่างผู้ล้าง&quot; (แสดงเฉพาะชื่อจริง ไม่แสดงนามสกุลและเบอร์โทร)</span>
            </label>
          </div>
        )}

        {activeReport === 'monthly' && (
          <div className="pt-3 border-t border-[#E8EEF4] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#334155]">
                เลือกหัวข้อที่ต้องการแสดงและพิมพ์ (เฉพาะรายงานที่ 1)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {isCombinedMajor && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMajorSummaryTable(true);
                      setShowMonthlySection1(false);
                      setShowMonthlySection2(false);
                      setShowMonthlySection3(false);
                      setShowMonthlyTechSummary(false);
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs border transition-colors cursor-pointer ${
                      showMajorSummaryTable &&
                      !showMonthlySection1 &&
                      !showMonthlySection2 &&
                      !showMonthlySection3 &&
                      !showMonthlyTechSummary
                        ? 'bg-[#2F6A4E] text-white border-[#2F6A4E]'
                        : 'bg-[#ECF6F1] text-[#25593E] border-[#C6E2D2] hover:bg-[#DCEEE4]'
                    }`}
                  >
                    เฉพาะตารางสรุปล้างใหญ่ (รวม 2 เดือน)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowMajorSummaryTable(true);
                    setShowMonthlySection1(true);
                    setShowMonthlySection2(true);
                    setShowMonthlySection3(true);
                    setShowMonthlyTechSummary(true);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs border transition-colors cursor-pointer ${
                    (!isCombinedMajor || showMajorSummaryTable) &&
                    showMonthlySection1 &&
                    showMonthlySection2 &&
                    showMonthlySection3 &&
                    showMonthlyTechSummary
                      ? 'bg-[#4A7C9B] text-white border-[#4A7C9B]'
                      : 'bg-white text-[#475569] border-[#CBD5E1] hover:bg-[#F8FAFC]'
                  }`}
                >
                  แสดงทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMajorSummaryTable(false);
                    setShowMonthlySection1(true);
                    setShowMonthlySection2(false);
                    setShowMonthlySection3(false);
                    setShowMonthlyTechSummary(false);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs border transition-colors cursor-pointer ${
                    (!isCombinedMajor || !showMajorSummaryTable) &&
                    showMonthlySection1 &&
                    !showMonthlySection2 &&
                    !showMonthlySection3 &&
                    !showMonthlyTechSummary
                      ? 'bg-[#4A7C9B] text-white border-[#4A7C9B]'
                      : 'bg-white text-[#475569] border-[#CBD5E1] hover:bg-[#F8FAFC]'
                  }`}
                >
                  เฉพาะข้อ 1 (ล้างรายวัน)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMajorSummaryTable(false);
                    setShowMonthlySection1(true);
                    setShowMonthlySection2(true);
                    setShowMonthlySection3(false);
                    setShowMonthlyTechSummary(false);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs border transition-colors cursor-pointer ${
                    (!isCombinedMajor || !showMajorSummaryTable) &&
                    showMonthlySection1 &&
                    showMonthlySection2 &&
                    !showMonthlySection3 &&
                    !showMonthlyTechSummary
                      ? 'bg-[#4A7C9B] text-white border-[#4A7C9B]'
                      : 'bg-white text-[#475569] border-[#CBD5E1] hover:bg-[#F8FAFC]'
                  }`}
                >
                  เฉพาะข้อ 1 และ 2
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#334155]">
              {isCombinedMajor && (
                <label className="inline-flex items-center gap-2 cursor-pointer select-none font-medium text-[#25593E]">
                  <input
                    type="checkbox"
                    checked={showMajorSummaryTable}
                    onChange={(e) => setShowMajorSummaryTable(e.target.checked)}
                    className="rounded border-[#CBD5E1] text-[#2F6A4E] focus:ring-[#2F6A4E]"
                  />
                  <span>ตารางสรุปล้างใหญ่ (รวม 2 เดือน)</span>
                </label>
              )}
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showMonthlySection1}
                  onChange={(e) => setShowMonthlySection1(e.target.checked)}
                  className="rounded border-[#CBD5E1] text-[#4A7C9B] focus:ring-[#4A7C9B]"
                />
                <span>1. ตารางสรุปจำนวนแอร์ที่ล้างรายวัน</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showMonthlySection2}
                  onChange={(e) => setShowMonthlySection2(e.target.checked)}
                  className="rounded border-[#CBD5E1] text-[#4A7C9B] focus:ring-[#4A7C9B]"
                />
                <span>2. ตารางสรุปภาพรวมไม่ได้เข้าล้าง</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showMonthlySection3}
                  onChange={(e) => setShowMonthlySection3(e.target.checked)}
                  className="rounded border-[#CBD5E1] text-[#4A7C9B] focus:ring-[#4A7C9B]"
                />
                <span>3. บัญชีรายการไม่ได้เข้าล้าง</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showMonthlyTechSummary}
                  onChange={(e) => setShowMonthlyTechSummary(e.target.checked)}
                  className="rounded border-[#CBD5E1] text-[#4A7C9B] focus:ring-[#4A7C9B]"
                />
                <span>สรุปผลงานช่างเทคนิคประจำเดือน</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Printable A4 Sheet Container */}
      <div
        ref={printContainerRef}
        key={activeReport}
        data-report-tab={activeReport}
        className={`bg-white border border-[#DCE4EE] rounded-xl p-5 sm:p-[10mm] mx-auto w-full ${sheetPreviewMaxWidth} shadow-xs print-container`}
      >
        <table className="print-page-shell w-full">
          <thead className="print-shell-head">
            <tr>
              <td className="print-shell-spacer" />
            </tr>
          </thead>
          <tfoot className="print-shell-foot">
            <tr>
              <td className="print-shell-spacer" />
            </tr>
          </tfoot>
          <tbody className="print-shell-body">
            {/* REPORT 1: MONTHLY / ANNUAL SUMMARY */}
            {activeReport === 'monthly' && (() => {
              const periodHeaderText =
                isCombinedMajor && majorCycle
                  ? `ประจำรอบการล้างใหญ่ ${majorCycle.label} ${selectedYear + 543} (การล้างใหญ่ · รวม 2 เดือน)`
                  : `ประจำเดือน ${formatThaiMonthYear(selectedYear, selectedMonth)} (${cleaningTypeLabel})`;

              const section3Element = showMonthlySection3 ? (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xs sm:text-sm font-bold text-[#0F172A]">
                      3. บัญชีรายการเครื่องปรับอากาศที่ไม่ได้เข้าล้าง{' '}
                      {isCombinedMajor && majorCycle
                        ? `ประจำรอบ ${majorCycle.label} ${selectedYear + 543} (การล้างใหญ่)`
                        : `ประจำเดือน ${formatThaiMonthYear(selectedYear, selectedMonth)} (${cleaningTypeLabel})`}
                      {uncleanedCategory !== 'all' && ` (${UNCLEANED_FILTER_LABELS[uncleanedCategory]})`}
                    </h2>
                    <span className="text-[11px] text-[#64748B] tabular-nums">
                      จำนวน {monthlyUncleanedItems.length} เครื่อง
                    </span>
                  </div>
                  <table className="w-full table-fixed text-[9.5px] leading-[1.3] border border-[#CBD5E1] border-collapse">
                    <thead>
                      <tr className="bg-[#F4F7FA] text-[#1E293B]">
                        <th className="border border-[#CBD5E1] py-1 px-1 text-center w-[6%]">ลำดับ</th>
                        <th className="border border-[#CBD5E1] py-1 px-1.5 text-left w-[15%]">อาคาร / ชั้น</th>
                        <th className="border border-[#CBD5E1] py-1 px-1.5 text-left w-[33%]">ห้อง</th>
                        <th className="border border-[#CBD5E1] py-1 px-1.5 text-left w-[19%]">หมายเลขเครื่อง</th>
                        <th className="border border-[#CBD5E1] py-1 px-1.5 text-left w-[15%]">สาเหตุ</th>
                        <th className="border border-[#CBD5E1] py-1 px-1.5 text-left w-[12%]">หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedMonthlyUncleaned.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="border border-[#CBD5E1] py-4 text-center text-[#64748B]">
                            ไม่มีรายการเครื่องที่ไม่ได้เข้าล้างตามเงื่อนไขที่เลือกในเดือนนี้
                          </td>
                        </tr>
                      ) : (
                        groupedMonthlyUncleaned.map((group, idx) => (
                          <tr key={group.key}>
                            <td className="border border-[#CBD5E1] py-1 px-1 text-center tabular-nums align-top">
                              {idx + 1}
                            </td>
                            <td className="border border-[#CBD5E1] py-1 px-1.5 break-words align-top font-medium">
                              {formatReportBuildingName(group.building)} ({group.floor})
                            </td>
                            <td className="border border-[#CBD5E1] py-1 px-1.5 break-words align-top">
                              <div className="font-semibold text-[#0F172A]">
                                มี {group.rooms.length} ห้องที่ไม่ได้ล้าง
                                {group.itemCount !== group.rooms.length ? ` (${group.itemCount} เครื่อง)` : ''} คือ
                              </div>
                              <div className="text-[#1E293B]">
                                {group.rooms.join(', ')}
                              </div>
                            </td>
                            <td className="border border-[#CBD5E1] py-1 px-1.5 font-mono-tabular break-words align-top">
                              {group.unitCodes.join(', ')}
                            </td>
                            <td className="border border-[#CBD5E1] py-1 px-1.5 break-words align-top">
                              {CLEANING_STATUS_LABELS[group.status]}
                            </td>
                            <td className="border border-[#CBD5E1] py-1 px-1.5 text-[#475569] break-words align-top">
                              {group.notes.length > 0 ? group.notes.join(', ') : '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {groupedMonthlyUncleaned.length > 0 && (
                      <tfoot>
                        <tr className="bg-[#F8FAFC] font-semibold text-[#0F172A]">
                          <td colSpan={2} className="border border-[#CBD5E1] py-1 px-1.5 text-center">
                            รวมทั้งหมด
                          </td>
                          <td className="border border-[#CBD5E1] py-1 px-1.5 tabular-nums">
                            {groupedMonthlyUncleaned.reduce((sum, g) => sum + g.rooms.length, 0)} ห้อง
                          </td>
                          <td colSpan={3} className="border border-[#CBD5E1] py-1 px-1.5 tabular-nums">
                            รวม {monthlyUncleanedItems.length} เครื่อง
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              ) : null;

              const techSummaryElement =
                showMonthlyTechSummary && monthTechStats.length > 0 ? (
                  <div className="space-y-1.5 print-break-inside-avoid">
                    <h2 className="text-xs sm:text-sm font-bold text-[#0F172A]">
                      สรุปจำนวนเครื่องที่ช่างเทคนิคเข้าปฏิบัติงานประจำเดือน
                    </h2>
                    <table className="w-full table-fixed text-[10px] border border-[#CBD5E1] border-collapse">
                      <thead>
                        <tr className="bg-[#F4F7FA]">
                          <th className="border border-[#CBD5E1] py-1 px-2 text-left w-[40%]">ชื่อช่างเทคนิค</th>
                          <th className="border border-[#CBD5E1] py-1 px-2 text-right w-[15%]">ล้างแล้ว (เครื่อง)</th>
                          <th className="border border-[#CBD5E1] py-1 px-2 text-right w-[15%]">แอร์ปกติ</th>
                          <th className="border border-[#CBD5E1] py-1 px-2 text-right w-[15%]">VRF / VRV</th>
                          <th className="border border-[#CBD5E1] py-1 px-2 text-right w-[15%]">ไม่ได้เข้าล้าง</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthTechStats.map((t) => (
                          <tr key={t.technicianId}>
                            <td className="border border-[#CBD5E1] py-1 px-2 font-medium break-words">
                              {t.technicianName}
                            </td>
                            <td className="border border-[#CBD5E1] py-1 px-2 text-right tabular-nums font-semibold">
                              {t.cleanedCount}
                            </td>
                            <td className="border border-[#CBD5E1] py-1 px-2 text-right tabular-nums">
                              {t.normalCount}
                            </td>
                            <td className="border border-[#CBD5E1] py-1 px-2 text-right tabular-nums">
                              {t.vrfCount}
                            </td>
                            <td className="border border-[#CBD5E1] py-1 px-2 text-right tabular-nums">
                              {t.uncleanedCount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null;

              const shouldBreakBeforeSecondBlock =
                showMonthlySection1 && showMonthlySection3 && groupedMonthlyUncleaned.length > 0;

              const renderDailyMatrixTable = (
                targetMatrix: typeof matrix,
                monthCaption?: string
              ) => (
                <div className="space-y-1">
                  {monthCaption && (
                    <div className="text-[11px] font-semibold text-[#1E3A5F] bg-[#F4F8FB] border border-[#DCE7F0] rounded px-2.5 py-1 flex items-center justify-between">
                      <span>{monthCaption}</span>
                      <span className="tabular-nums text-[#25593E]">
                        ล้างแล้ว {targetMatrix.grandTotal.toLocaleString()} เครื่อง (ปกติ{' '}
                        {targetMatrix.grandNormalTotal.toLocaleString()} · VRF{' '}
                        {targetMatrix.grandVrfTotal.toLocaleString()})
                      </span>
                    </div>
                  )}
                  {showBuildingBreakdown ? (
                    <table className="w-full table-fixed text-[8px] sm:text-[9px] print:text-[8px] leading-tight border border-[#CBD5E1] border-collapse">
                      <thead>
                        <tr className="bg-[#EEF4F9] text-[#1E293B]">
                          <th className="border border-[#CBD5E1] py-1 px-[2px] text-center w-[24px]">
                            วันที่
                          </th>
                          {targetMatrix.buildings.map((b) => (
                            <th
                              key={b}
                              className="border border-[#CBD5E1] py-1 px-[2px] text-center align-bottom break-words leading-[1.1]"
                            >
                              {formatReportBuildingName(b)}
                            </th>
                          ))}
                          <th className="border border-[#CBD5E1] py-1 px-[2px] text-center font-bold bg-[#E2ECF5] w-[32px]">
                            รวม/วัน
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {targetMatrix.rows.map((r) => (
                          <tr
                            key={r.day}
                            className={r.dayTotal > 0 ? 'bg-white' : 'bg-[#FAFBFD] text-[#94A3B8]'}
                          >
                            <td className="border border-[#CBD5E1] py-[3px] px-0.5 text-center tabular-nums font-medium">
                              {r.day}
                            </td>
                            {targetMatrix.buildings.map((b) => {
                              const val = r.countsByBuilding[b] || 0;
                              return (
                                <td
                                  key={b}
                                  className={`border border-[#CBD5E1] py-[3px] px-0.5 text-center tabular-nums ${
                                    val > 0 ? 'font-semibold text-[#0F172A]' : ''
                                  }`}
                                >
                                  {val > 0 ? val : '-'}
                                </td>
                              );
                            })}
                            <td className="border border-[#CBD5E1] py-[3px] px-0.5 text-center tabular-nums font-semibold bg-[#F4F8FB] text-[#1E293B]">
                              {r.dayTotal > 0 ? r.dayTotal : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#E6EFF7] font-bold text-[#0F172A]">
                          <td className="border border-[#CBD5E1] py-1 px-0.5 text-center">รวม</td>
                          {targetMatrix.buildings.map((b) => (
                            <td
                              key={b}
                              className="border border-[#CBD5E1] py-1 px-0.5 text-center tabular-nums"
                            >
                              {targetMatrix.totalsByBuilding[b] || 0}
                            </td>
                          ))}
                          <td className="border border-[#CBD5E1] py-1 px-0.5 text-center tabular-nums text-[#25593E]">
                            {targetMatrix.grandTotal}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  ) : (
                    <table className="w-full table-fixed text-[10px] leading-tight border border-[#CBD5E1] border-collapse">
                      <thead>
                        <tr className="bg-[#EEF4F9] text-[#1E293B]">
                          <th className="border border-[#CBD5E1] py-1 px-2 text-center w-[12%]">
                            วันที่
                          </th>
                          <th className="border border-[#CBD5E1] py-1 px-2 text-left w-[28%]">
                            วัน / เดือน / ปี
                          </th>
                          <th className="border border-[#CBD5E1] py-1 px-2 text-right w-[20%]">
                            แอร์ปกติ (เครื่อง)
                          </th>
                          <th className="border border-[#CBD5E1] py-1 px-2 text-right w-[20%]">
                            VRF / VRV (เครื่อง)
                          </th>
                          <th className="border border-[#CBD5E1] py-1 px-2 text-right font-bold bg-[#E2ECF5] w-[20%]">
                            รวมล้างแล้ว (เครื่อง)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {targetMatrix.rows.map((r) => (
                          <tr
                            key={r.day}
                            className={r.dayTotal > 0 ? 'bg-white' : 'bg-[#FAFBFD] text-[#94A3B8]'}
                          >
                            <td className="border border-[#CBD5E1] py-[3px] px-2 text-center tabular-nums font-medium">
                              {r.day}
                            </td>
                            <td className="border border-[#CBD5E1] py-[3px] px-2 tabular-nums">
                              {formatThaiDate(r.dateStr, true)}
                            </td>
                            <td className="border border-[#CBD5E1] py-[3px] px-2 text-right tabular-nums">
                              {r.normalTotal > 0 ? r.normalTotal : '-'}
                            </td>
                            <td className="border border-[#CBD5E1] py-[3px] px-2 text-right tabular-nums">
                              {r.vrfTotal > 0 ? r.vrfTotal : '-'}
                            </td>
                            <td
                              className={`border border-[#CBD5E1] py-[3px] px-2 text-right tabular-nums bg-[#F4F8FB] ${
                                r.dayTotal > 0 ? 'font-semibold text-[#0F172A]' : ''
                              }`}
                            >
                              {r.dayTotal > 0 ? r.dayTotal : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#E6EFF7] font-bold text-[#0F172A]">
                          <td colSpan={2} className="border border-[#CBD5E1] py-1 px-2 text-center">
                            รวมทั้งเดือน
                          </td>
                          <td className="border border-[#CBD5E1] py-1 px-2 text-right tabular-nums">
                            {targetMatrix.grandNormalTotal}
                          </td>
                          <td className="border border-[#CBD5E1] py-1 px-2 text-right tabular-nums">
                            {targetMatrix.grandVrfTotal}
                          </td>
                          <td className="border border-[#CBD5E1] py-1 px-2 text-right tabular-nums text-[#25593E]">
                            {targetMatrix.grandTotal}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              );

              return (
                <>
                  <tr>
                    <td className="print-shell-cell">
                      <div className="space-y-3.5">
                        {renderLetterhead(
                          `รายงานสรุปผลการปรนนิบัติบำรุงรักษาเครื่องปรับอากาศ (${cleaningTypeLabel})`,
                          periodHeaderText
                        )}

                        {/* Contract AC Count Box */}
                        {isCombinedMajor && majorSummary && majorCycle ? (
                          <div className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-2.5 p-2.5 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1]">
                            <div>
                              <div className="text-[11px] text-[#64748B]">จำนวนแอร์ทั้งหมดในสัญญา</div>
                              <div className="text-base font-bold text-[#0F172A] tabular-nums">
                                {contract.totalActive} เครื่อง
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] text-[#64748B]">
                                ล้างได้รวม ({majorCycle.shortLabel})
                              </div>
                              <div className="text-base font-bold text-[#25593E] tabular-nums">
                                {majorSummary.totalCleaned} เครื่อง
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] text-[#64748B]">ไม่ได้เข้าล้าง (ตามบันทึก)</div>
                              <div className="text-base font-bold text-[#8C5E26] tabular-nums">
                                {majorSummary.uncleanedSummary.totalUncleaned} เครื่อง
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] text-[#64748B]">
                                คงเหลือไม่ได้ล้าง (จากสัญญา)
                              </div>
                              <div className="text-base font-bold text-[#7A4E1A] tabular-nums">
                                {majorSummary.contractRemainingUncleaned} เครื่อง
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-2.5 p-2.5 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1]">
                            <div>
                              <div className="text-[11px] text-[#64748B]">จำนวนแอร์ทั้งหมดในสัญญา</div>
                              <div className="text-base font-bold text-[#0F172A] tabular-nums">
                                {contract.totalActive} เครื่อง
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] text-[#64748B]">แอร์ปกติ</div>
                              <div className="text-base font-bold text-[#1E3A5F] tabular-nums">
                                {contract.normalActive} เครื่อง
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] text-[#64748B]">ระบบ VRF / VRV</div>
                              <div className="text-base font-bold text-[#25593E] tabular-nums">
                                {contract.vrfActive} เครื่อง
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] text-[#64748B]">เครื่องที่ไม่ได้เข้าล้าง</div>
                              <div className="text-base font-bold text-[#8C5E26] tabular-nums">
                                {activeUncleaned.totalUncleaned} เครื่อง
                              </div>
                            </div>
                          </div>
                        )}

                        {(!isCombinedMajor || !showMajorSummaryTable) &&
                          !showMonthlySection1 &&
                          !showMonthlySection2 &&
                          !showMonthlySection3 &&
                          !showMonthlyTechSummary && (
                            <div className="p-4 rounded-lg border border-dashed border-[#CBD5E1] text-center text-xs text-[#64748B] no-print">
                              กรุณาเลือกอย่างน้อย 1 หัวข้อจากแถบด้านบนเพื่อแสดงตารางในรายงาน
                            </div>
                          )}

                        {/* Major Cleaning Combined 2-Month Executive Summary Table */}
                        {isCombinedMajor && majorSummary && majorCycle && showMajorSummaryTable && (
                          <div className="space-y-1.5 print-break-inside-avoid">
                            <h2 className="text-xs sm:text-sm font-bold text-[#0F172A]">
                              สรุปผลการล้างใหญ่ประจำรอบ ({majorCycle.label} พ.ศ. {selectedYear + 543})
                            </h2>
                            <table className="w-full table-fixed text-[10.5px] leading-snug border border-[#CBD5E1] border-collapse">
                              <thead>
                                <tr className="bg-[#EEF4F9] text-[#1E293B]">
                                  <th className="border border-[#CBD5E1] py-1.5 px-2 text-center w-[8%]">
                                    ลำดับ
                                  </th>
                                  <th className="border border-[#CBD5E1] py-1.5 px-2.5 text-left w-[40%]">
                                    รายการสรุปล้างใหญ่
                                  </th>
                                  <th className="border border-[#CBD5E1] py-1.5 px-2.5 text-left w-[34%]">
                                    รายละเอียด
                                  </th>
                                  <th className="border border-[#CBD5E1] py-1.5 px-2.5 text-right w-[18%]">
                                    จำนวน (เครื่อง)
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="border border-[#CBD5E1] py-1.5 px-2 text-center tabular-nums">
                                    1
                                  </td>
                                  <td className="border border-[#CBD5E1] py-1.5 px-2.5 font-medium">
                                    เดือน{majorSummary.month1.monthName} {selectedYear + 543} (จำนวนที่ล้างได้)
                                  </td>
                                  <td className="border border-[#CBD5E1] py-1.5 px-2.5 text-[#475569] tabular-nums">
                                    แอร์ปกติ {majorSummary.month1.normalCount} เครื่อง · VRF / VRV{' '}
                                    {majorSummary.month1.vrfCount} เครื่อง
                                  </td>
                                  <td className="border border-[#CBD5E1] py-1.5 px-2.5 text-right tabular-nums font-semibold text-[#1E293B]">
                                    {majorSummary.month1.cleanedCount} เครื่อง
                                  </td>
                                </tr>
                                <tr>
                                  <td className="border border-[#CBD5E1] py-1.5 px-2 text-center tabular-nums">
                                    2
                                  </td>
                                  <td className="border border-[#CBD5E1] py-1.5 px-2.5 font-medium">
                                    เดือน{majorSummary.month2.monthName} {selectedYear + 543} (จำนวนที่ล้างได้)
                                  </td>
                                  <td className="border border-[#CBD5E1] py-1.5 px-2.5 text-[#475569] tabular-nums">
                                    แอร์ปกติ {majorSummary.month2.normalCount} เครื่อง · VRF / VRV{' '}
                                    {majorSummary.month2.vrfCount} เครื่อง
                                  </td>
                                  <td className="border border-[#CBD5E1] py-1.5 px-2.5 text-right tabular-nums font-semibold text-[#1E293B]">
                                    {majorSummary.month2.cleanedCount} เครื่อง
                                  </td>
                                </tr>
                                <tr className="bg-[#ECF6F1] font-bold text-[#25593E]">
                                  <td className="border border-[#CBD5E1] py-1.5 px-2 text-center">-</td>
                                  <td className="border border-[#CBD5E1] py-1.5 px-2.5">
                                    รวมจำนวนเครื่องที่ล้างได้ทั้งหมด (รวม 2 เดือน)
                                  </td>
                                  <td className="border border-[#CBD5E1] py-1.5 px-2.5 font-normal text-[#25593E] tabular-nums">
                                    แอร์ปกติ {majorSummary.totalNormalCleaned} เครื่อง · VRF / VRV{' '}
                                    {majorSummary.totalVrfCleaned} เครื่อง
                                  </td>
                                  <td className="border border-[#CBD5E1] py-1.5 px-2.5 text-right tabular-nums">
                                    {majorSummary.totalCleaned} เครื่อง
                                  </td>
                                </tr>
                                <tr className="bg-[#FDF8F1] font-semibold text-[#7A4E1A]">
                                  <td className="border border-[#CBD5E1] py-1.5 px-2 text-center">-</td>
                                  <td className="border border-[#CBD5E1] py-1.5 px-2.5">
                                    จำนวนเครื่องที่ไม่ได้เข้าล้าง (สรุปรวม)
                                  </td>
                                  <td className="border border-[#CBD5E1] py-1.5 px-2.5 font-normal text-[#8C5E26] tabular-nums">
                                    คนไข้ {majorSummary.uncleanedSummary.patientOccupied.count} ·
                                    ปิดปรับปรุง {majorSummary.uncleanedSummary.renovation.count} ·
                                    ไม่มีการ์ด {majorSummary.uncleanedSummary.noCard.count}
                                    {majorSummary.contractRemainingUncleaned !==
                                      majorSummary.uncleanedSummary.totalUncleaned &&
                                      ` (เทียบยอดคงเหลือจากสัญญา ${majorSummary.contractRemainingUncleaned} เครื่อง)`}
                                  </td>
                                  <td className="border border-[#CBD5E1] py-1.5 px-2.5 text-right tabular-nums">
                                    {majorSummary.uncleanedSummary.totalUncleaned} เครื่อง
                                  </td>
                                </tr>
                                <tr className="bg-[#F1F5F9] font-bold text-[#0F172A]">
                                  <td className="border border-[#CBD5E1] py-1.5 px-2 text-center">-</td>
                                  <td className="border border-[#CBD5E1] py-1.5 px-2.5">
                                    ยอดเครื่องปรับอากาศทั้งหมดในสัญญา
                                  </td>
                                  <td className="border border-[#CBD5E1] py-1.5 px-2.5 font-normal text-[#475569] tabular-nums">
                                    คิดเป็นผลงานการล้าง{' '}
                                    {majorSummary.totalActiveUnits > 0
                                      ? Math.round(
                                          (majorSummary.totalCleaned /
                                            majorSummary.totalActiveUnits) *
                                            100
                                        )
                                      : 0}
                                    % ของสัญญาทั้งหมด
                                  </td>
                                  <td className="border border-[#CBD5E1] py-1.5 px-2.5 text-right tabular-nums">
                                    {majorSummary.totalActiveUnits} เครื่อง
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* 1. Daily x Building Table */}
                        {showMonthlySection1 && (
                          <div className="space-y-2">
                            <h2 className="text-xs sm:text-sm font-bold text-[#0F172A]">
                              1. ตารางสรุปจำนวนเครื่องปรับอากาศที่ล้างรายวันและยอดรวม
                              {isCombinedMajor && majorCycle
                                ? `รอบ ${majorCycle.label}`
                                : 'ทั้งเดือน'}{' '}
                              ({showBuildingBreakdown ? 'แยกตามอาคาร' : 'รวมทุกอาคาร'})
                            </h2>
                            <div className="w-full space-y-3">
                              {isCombinedMajor && majorSummary ? (
                                <>
                                  {renderDailyMatrixTable(
                                    majorSummary.month1.matrix,
                                    `เดือนที่ 1: ${majorSummary.month1.monthName} ${selectedYear + 543}`
                                  )}
                                  {renderDailyMatrixTable(
                                    majorSummary.month2.matrix,
                                    `เดือนที่ 2: ${majorSummary.month2.monthName} ${selectedYear + 543}`
                                  )}
                                  <div className="p-2 rounded bg-[#E6EFF7] border border-[#CBD5E1] text-[10.5px] font-bold text-[#0F172A] flex flex-wrap items-center justify-between gap-2 tabular-nums">
                                    <span>
                                      รวมยอดล้างได้ทั้ง 2 เดือน ({majorSummary.month1.monthName} +{' '}
                                      {majorSummary.month2.monthName})
                                    </span>
                                    <span className="text-[#25593E]">
                                      รวมทั้งสิ้น {majorSummary.totalCleaned} เครื่อง (แอร์ปกติ{' '}
                                      {majorSummary.totalNormalCleaned} · VRF/VRV{' '}
                                      {majorSummary.totalVrfCleaned})
                                    </span>
                                  </div>
                                </>
                              ) : (
                                renderDailyMatrixTable(matrix)
                              )}
                            </div>
                          </div>
                        )}

                        {/* 2. Uncleaned Overview (2 columns only) */}
                        {showMonthlySection2 && (
                          <div className="space-y-1.5 print-break-inside-avoid">
                            <h2 className="text-xs sm:text-sm font-bold text-[#0F172A]">
                              2. ตารางสรุปภาพรวมจำนวนเครื่องที่ไม่ได้เข้าล้าง (ไม่รวมเครื่องที่ยกเลิก)
                            </h2>
                            <table className="w-full max-w-lg table-fixed text-[10.5px] border border-[#CBD5E1] border-collapse">
                              <thead>
                                <tr className="bg-[#FDF6EC] text-[#5C3D18]">
                                  <th className="border border-[#CBD5E1] py-1 px-2.5 text-left w-[72%]">
                                    สาเหตุที่ไม่ได้เข้าล้าง
                                  </th>
                                  <th className="border border-[#CBD5E1] py-1 px-2.5 text-right w-[28%]">
                                    จำนวน (เครื่อง)
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="border border-[#CBD5E1] py-1 px-2.5 font-medium">2.1 ห้องมีคนไข้</td>
                                  <td className="border border-[#CBD5E1] py-1 px-2.5 text-right tabular-nums font-semibold">
                                    {activeUncleaned.patientOccupied.count}
                                  </td>
                                </tr>
                                <tr>
                                  <td className="border border-[#CBD5E1] py-1 px-2.5 font-medium">2.2 ปิดปรับปรุง</td>
                                  <td className="border border-[#CBD5E1] py-1 px-2.5 text-right tabular-nums font-semibold">
                                    {activeUncleaned.renovation.count}
                                  </td>
                                </tr>
                                <tr>
                                  <td className="border border-[#CBD5E1] py-1 px-2.5 font-medium">2.3 ไม่มีการ์ด</td>
                                  <td className="border border-[#CBD5E1] py-1 px-2.5 text-right tabular-nums font-semibold">
                                    {activeUncleaned.noCard.count}
                                  </td>
                                </tr>
                                <tr className="bg-[#F8FAFC] font-bold">
                                  <td className="border border-[#CBD5E1] py-1 px-2.5">
                                    รวมจำนวนทั้งหมดที่ไม่ได้เข้าล้าง (ไม่รวมเครื่องที่ยกเลิก {contract.cancelledCount} เครื่อง)
                                  </td>
                                  <td className="border border-[#CBD5E1] py-1 px-2.5 text-right tabular-nums text-[#7A4E1A]">
                                    {activeUncleaned.totalUncleaned}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* If no page break needed before Section 3, keep remaining sections in Row 1 */}
                        {!shouldBreakBeforeSecondBlock && (
                          <>
                            {section3Element}
                            {techSummaryElement}
                            {renderSignatures()}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {shouldBreakBeforeSecondBlock && (
                    <tr className="print-shell-break-row">
                      <td className="print-shell-cell pt-4 print:pt-0">
                        <div className="space-y-3">
                          {section3Element}
                          {techSummaryElement}
                          {renderSignatures()}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })()}

            {/* REPORT 2: MONTHLY CLEANED LIST */}
            {activeReport === 'monthly_cleaned' && (
              <tr>
                <td className="print-shell-cell">
                  <div className="space-y-3.5">
            {renderLetterhead(
              `บัญชีรายการเครื่องปรับอากาศที่เข้าล้างแล้ว (${cleaningTypeLabel})`,
              `${
                isCombinedMajor && majorCycle
                  ? `ประจำรอบ ${majorCycle.label} ${selectedYear + 543} (รวม 2 เดือน)`
                  : `ประจำเดือน ${formatThaiMonthYear(selectedYear, selectedMonth)} (${cleaningTypeLabel})`
              } · ${
                selectedBuilding === 'all' ? 'ทุกอาคาร' : formatReportBuildingName(selectedBuilding)
              }`
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-[#F4FAF6] border border-[#CFE6D8] rounded-lg px-4 py-2">
              <span>
                {isCombinedMajor && majorCycle
                  ? `เข้าล้างแล้วทั้งหมดในรอบ ${majorCycle.label}: `
                  : `เข้าล้างแล้วทั้งหมดในเดือน${THAI_MONTHS[selectedMonth - 1]}: `}
                <strong className="tabular-nums text-[#25593E]">
                  {monthlyCleanedLogs.length} เครื่อง
                </strong>
              </span>
              <span className="tabular-nums text-[#334155]">
                แอร์ปกติ:{' '}
                <strong>
                  {monthlyCleanedLogs.filter((l) => l.acType === 'normal').length} เครื่อง
                </strong>{' '}
                · VRF / VRV:{' '}
                <strong>
                  {monthlyCleanedLogs.filter((l) => l.acType === 'vrf').length} เครื่อง
                </strong>
              </span>
            </div>

            <table className="w-full table-fixed text-[9.5px] leading-[1.25] border border-[#CBD5E1] border-collapse">
              <thead>
                <tr className="bg-[#EEF4F9] text-[#1E293B]">
                  <th className="border border-[#CBD5E1] py-1 px-1 text-center w-[6%]">ลำดับ</th>
                  <th className="border border-[#CBD5E1] py-1 px-1 text-left w-[21%]">อาคาร / ชั้น</th>
                  <th className="border border-[#CBD5E1] py-1 px-1 text-left w-[22%]">ห้อง</th>
                  <th className="border border-[#CBD5E1] py-1 px-1 text-left w-[12%]">หมายเลขเครื่อง</th>
                  <th className="border border-[#CBD5E1] py-1 px-1 text-left w-[11%]">ประเภท</th>
                  <th className="border border-[#CBD5E1] py-1 px-1 text-left w-[13%]">วันที่ล้าง</th>
                  <th className="border border-[#CBD5E1] py-1 px-1 text-left w-[15%]">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {monthlyCleanedGroups.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border border-[#CBD5E1] py-8 text-center text-[#64748B]">
                      ยังไม่มีรายการที่เข้าล้างแล้วในเดือน {formatThaiMonthYear(selectedYear, selectedMonth)} ตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  monthlyCleanedGroups.map((group) => (
                    <React.Fragment key={group.buildingName}>
                      <tr className="bg-[#EEF4F9] text-[#0F172A] break-after-avoid page-break-after-avoid">
                        <td
                          colSpan={7}
                          className="border border-[#CBD5E1] py-1 px-2 font-semibold"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span>
                              {group.buildingName} ยอดล้างแล้ว {group.items.length} เครื่อง
                              {group.totalInBuilding > 0
                                ? ` (จากยอดรวมทั้งหมด ${group.totalInBuilding} เครื่อง)`
                                : ''}{' '}
                              รายการดังนี้
                            </span>
                            <span className="text-[9px] font-normal text-[#475569] tabular-nums">
                              แอร์ปกติ {group.normalCount} เครื่อง · VRF / VRV {group.vrfCount} เครื่อง
                            </span>
                          </div>
                        </td>
                      </tr>
                      {group.items.map(({ log: l, rowNumber }) => {
                        const cleanNote = formatReportNotes(l.notes);
                        return (
                          <tr key={l.id}>
                            <td className="border border-[#CBD5E1] py-[2.5px] px-1 text-center tabular-nums">
                              {rowNumber}
                            </td>
                            <td className="border border-[#CBD5E1] py-[2.5px] px-1 break-words">
                              {formatReportBuildingName(l.building)} ({l.floor})
                            </td>
                            <td className="border border-[#CBD5E1] py-[2.5px] px-1 break-words">{l.room}</td>
                            <td className="border border-[#CBD5E1] py-[2.5px] px-1 font-mono-tabular break-words">
                              {l.unitCode}
                            </td>
                            <td className="border border-[#CBD5E1] py-[2.5px] px-1">
                              {l.acType === 'vrf' ? 'VRF / VRV' : 'แอร์ปกติ'}
                            </td>
                            <td className="border border-[#CBD5E1] py-[2.5px] px-1 tabular-nums">
                              {formatThaiDate(l.date, true)}
                            </td>
                            <td className="border border-[#CBD5E1] py-[2.5px] px-1 text-[#475569] break-words">
                              {cleanNote || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>

                  {renderSignatures()}
                </div>
              </td>
            </tr>
            )}

            {/* REPORT 3: UNCLEANED FILTERED REPORT BY CATEGORY */}
            {activeReport === 'uncleaned_filtered' && (
              <tr>
                <td className="print-shell-cell">
                  <div className="space-y-3.5">
            {renderLetterhead(
              `บัญชีรายการเครื่องปรับอากาศที่ไม่ได้เข้าล้าง (${UNCLEANED_FILTER_LABELS[uncleanedCategory]} · ${cleaningTypeLabel})`,
              `${
                isCombinedMajor && majorCycle
                  ? `ประจำรอบ ${majorCycle.label} ${selectedYear + 543} (รวม 2 เดือน)`
                  : `ประจำเดือน ${formatThaiMonthYear(selectedYear, selectedMonth)} (${cleaningTypeLabel})`
              } · ${
                selectedBuilding === 'all' ? 'ทุกอาคาร' : formatReportBuildingName(selectedBuilding)
              }`
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-[#FDF6EC] border border-[#F0DEC4] rounded-lg px-4 py-2 text-[#5C3D18]">
              <span>
                จำนวนทั้งหมดตามเงื่อนไขที่เลือก:{' '}
                <strong className="tabular-nums">{monthlyUncleanedItems.length} เครื่อง</strong>
              </span>
              <span className="tabular-nums">
                แอร์ปกติ:{' '}
                <strong>
                  {monthlyUncleanedItems.filter((i) => i.acType === 'normal').length} เครื่อง
                </strong>{' '}
                · VRF / VRV:{' '}
                <strong>
                  {monthlyUncleanedItems.filter((i) => i.acType === 'vrf').length} เครื่อง
                </strong>
              </span>
            </div>

            <table className="w-full table-fixed text-[9.5px] leading-[1.25] border border-[#CBD5E1] border-collapse">
              <thead>
                <tr className="bg-[#EEF4F9] text-[#1E293B]">
                  <th className="border border-[#CBD5E1] py-1 px-1 text-center w-[5%]">ลำดับ</th>
                  <th className="border border-[#CBD5E1] py-1 px-1 text-left w-[10%]">วันที่</th>
                  <th className="border border-[#CBD5E1] py-1 px-1 text-left w-[16%]">อาคาร / ชั้น</th>
                  <th className="border border-[#CBD5E1] py-1 px-1 text-left w-[16%]">ห้อง</th>
                  <th className="border border-[#CBD5E1] py-1 px-1 text-left w-[10%]">หมายเลขเครื่อง</th>
                  <th className="border border-[#CBD5E1] py-1 px-1 text-left w-[9%]">ประเภท</th>
                  <th className="border border-[#CBD5E1] py-1 px-1 text-left w-[14%]">สาเหตุ</th>
                  <th className="border border-[#CBD5E1] py-1 px-1 text-left w-[10%]">ผู้บันทึก</th>
                  <th className="border border-[#CBD5E1] py-1 px-1 text-left w-[10%]">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {monthlyUncleanedItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="border border-[#CBD5E1] py-8 text-center text-[#64748B]">
                      ไม่พบรายการเครื่องที่ไม่ได้เข้าล้างตามประเภทที่เลือกในเดือนนี้
                    </td>
                  </tr>
                ) : (
                  monthlyUncleanedItems.map((item, idx) => {
                    const techName = formatReportTechnicianName(
                      item.technicianId,
                      item.technicianName
                    );
                    const cleanNote = formatReportNotes(item.notes);
                    return (
                      <tr key={item.id}>
                        <td className="border border-[#CBD5E1] py-[2.5px] px-1 text-center tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="border border-[#CBD5E1] py-[2.5px] px-1 tabular-nums">
                          {formatThaiDate(item.date, true)}
                        </td>
                        <td className="border border-[#CBD5E1] py-[2.5px] px-1 break-words">
                          {formatReportBuildingName(item.building)} ({item.floor})
                        </td>
                        <td className="border border-[#CBD5E1] py-[2.5px] px-1 break-words">{item.room}</td>
                        <td className="border border-[#CBD5E1] py-[2.5px] px-1 font-mono-tabular break-words">
                          {item.unitCode}
                        </td>
                        <td className="border border-[#CBD5E1] py-[2.5px] px-1">
                          {item.acType === 'vrf' ? 'VRF / VRV' : 'แอร์ปกติ'}
                        </td>
                        <td className="border border-[#CBD5E1] py-[2.5px] px-1 break-words">
                          {CLEANING_STATUS_LABELS[item.status]}
                        </td>
                        <td className="border border-[#CBD5E1] py-[2.5px] px-1 break-words">{techName}</td>
                        <td className="border border-[#CBD5E1] py-[2.5px] px-1 text-[#475569] break-words">
                          {cleanNote || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

                  {renderSignatures()}
                </div>
              </td>
            </tr>
            )}

            {/* REPORT 4: DAILY SIGN-OFF LIST */}
            {activeReport === 'daily_signoff' && (
              <tr>
                <td className="print-shell-cell">
                  <div className="space-y-3.5">
            {renderLetterhead(
              isDailyMultiDay
                ? 'บัญชีรายการเครื่องปรับอากาศที่เข้าล้าง (ตามช่วงวันที่)'
                : 'บัญชีรายการเครื่องปรับอากาศที่เข้าล้าง (รายวัน)',
              `${
                isDailyMultiDay
                  ? `ระหว่างวันที่ ${formatThaiDate(effectiveDailyStart)} – ${formatThaiDate(effectiveDailyEnd)}`
                  : `ประจำวันที่ ${formatThaiDate(effectiveDailyStart)}`
              } · ${
                dailyBuilding === 'all' ? 'ทุกอาคาร' : formatReportBuildingName(dailyBuilding)
              }${dailyStatusFilter !== 'all' ? ` · ${DAILY_STATUS_FILTER_LABELS[dailyStatusFilter]}` : ''}`
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-4 py-2">
              <span>
                จำนวนทั้งหมดตามเงื่อนไข:{' '}
                <strong className="tabular-nums">{dailyLogs.length} รายการ</strong>
              </span>
              <span>
                ล้างแล้ว:{' '}
                <strong className="tabular-nums text-[#25593E]">
                  {dailyLogs.filter((l) => l.status === 'cleaned').length} เครื่อง
                </strong>{' '}
                · ไม่ได้เข้าล้าง:{' '}
                <strong className="tabular-nums text-[#8C5E26]">
                  {dailyLogs.filter((l) => l.status !== 'cleaned').length} เครื่อง
                </strong>
              </span>
            </div>

            <table className="w-full table-fixed text-[9.5px] leading-[1.25] border border-[#CBD5E1] border-collapse">
              <thead>
                <tr className="bg-[#EEF4F9] text-[#1E293B]">
                  <th className="border border-[#CBD5E1] py-1 px-1 text-center w-[5%]">ลำดับ</th>
                  {isDailyMultiDay && (
                    <th
                      className={`border border-[#CBD5E1] py-1 px-1 text-center ${
                        showDailyTechnicianCol ? 'w-[9%]' : 'w-[10%]'
                      }`}
                    >
                      วันที่
                    </th>
                  )}
                  <th
                    className={`border border-[#CBD5E1] py-1 px-1 text-left ${
                      isDailyMultiDay
                        ? showDailyTechnicianCol
                          ? 'w-[13%]'
                          : 'w-[15%]'
                        : showDailyTechnicianCol
                          ? 'w-[15%]'
                          : 'w-[17%]'
                    }`}
                  >
                    อาคาร
                  </th>
                  <th
                    className={`border border-[#CBD5E1] py-1 px-1 text-center ${
                      isDailyMultiDay ? 'w-[5%]' : 'w-[6%]'
                    }`}
                  >
                    ชั้น
                  </th>
                  <th
                    className={`border border-[#CBD5E1] py-1 px-1 text-left ${
                      isDailyMultiDay
                        ? showDailyTechnicianCol
                          ? 'w-[15%]'
                          : 'w-[18%]'
                        : showDailyTechnicianCol
                          ? 'w-[16%]'
                          : 'w-[20%]'
                    }`}
                  >
                    ห้อง
                  </th>
                  <th
                    className={`border border-[#CBD5E1] py-1 px-1 text-left ${
                      isDailyMultiDay
                        ? showDailyTechnicianCol
                          ? 'w-[11%]'
                          : 'w-[12%]'
                        : showDailyTechnicianCol
                          ? 'w-[11%]'
                          : 'w-[12%]'
                    }`}
                  >
                    หมายเลขเครื่อง
                  </th>
                  <th
                    className={`border border-[#CBD5E1] py-1 px-1 text-left ${
                      isDailyMultiDay && showDailyTechnicianCol ? 'w-[8%]' : 'w-[9%]'
                    }`}
                  >
                    ประเภท
                  </th>
                  <th
                    className={`border border-[#CBD5E1] py-1 px-1 text-left ${
                      isDailyMultiDay
                        ? showDailyTechnicianCol
                          ? 'w-[12%]'
                          : 'w-[13%]'
                        : showDailyTechnicianCol
                          ? 'w-[14%]'
                          : 'w-[15%]'
                    }`}
                  >
                    สถานะ
                  </th>
                  {showDailyTechnicianCol && (
                    <th
                      className={`border border-[#CBD5E1] py-1 px-1 text-left ${
                        isDailyMultiDay ? 'w-[11%]' : 'w-[12%]'
                      }`}
                    >
                      ช่างผู้ล้าง
                    </th>
                  )}
                  <th
                    className={`border border-[#CBD5E1] py-1 px-1 text-left ${
                      isDailyMultiDay
                        ? showDailyTechnicianCol
                          ? 'w-[11%]'
                          : 'w-[13%]'
                        : showDailyTechnicianCol
                          ? 'w-[12%]'
                          : 'w-[16%]'
                    }`}
                  >
                    หมายเหตุ
                  </th>
                </tr>
              </thead>
              <tbody>
                {dailyLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8 + (isDailyMultiDay ? 1 : 0) + (showDailyTechnicianCol ? 1 : 0)}
                      className="border border-[#CBD5E1] py-8 text-center text-[#64748B]"
                    >
                      {isDailyMultiDay
                        ? `ยังไม่มีบันทึกการเข้าล้างในช่วงวันที่ ${formatThaiDate(effectiveDailyStart)} – ${formatThaiDate(effectiveDailyEnd)}`
                        : `ยังไม่มีบันทึกการเข้าล้างในวันที่ ${formatThaiDate(effectiveDailyStart)}`}
                    </td>
                  </tr>
                ) : (
                  dailyLogs.map((l, idx) => {
                    const techFirstName = formatReportTechnicianFirstName(
                      l.technicianId,
                      l.technicianName
                    );
                    const cleanNote = formatReportNotes(l.notes);
                    return (
                      <tr key={l.id}>
                        <td className="border border-[#CBD5E1] py-[2.5px] px-1 text-center tabular-nums">
                          {idx + 1}
                        </td>
                        {isDailyMultiDay && (
                          <td className="border border-[#CBD5E1] py-[2.5px] px-1 text-center whitespace-nowrap tabular-nums">
                            {formatThaiDate(l.date, true)}
                          </td>
                        )}
                        <td className="border border-[#CBD5E1] py-[2.5px] px-1 break-words">
                          {formatReportBuildingName(l.building)}
                        </td>
                        <td className="border border-[#CBD5E1] py-[2.5px] px-1 text-center">{l.floor}</td>
                        <td className="border border-[#CBD5E1] py-[2.5px] px-1 break-words">{l.room}</td>
                        <td className="border border-[#CBD5E1] py-[2.5px] px-1 font-mono-tabular break-words">
                          {l.unitCode}
                        </td>
                        <td className="border border-[#CBD5E1] py-[2.5px] px-1">
                          {l.acType === 'vrf' ? 'VRF / VRV' : 'แอร์ปกติ'}
                        </td>
                        <td className="border border-[#CBD5E1] py-[2.5px] px-1 break-words">
                          {CLEANING_STATUS_LABELS[l.status]}
                        </td>
                        {showDailyTechnicianCol && (
                          <td className="border border-[#CBD5E1] py-[2.5px] px-1 break-words">
                            {techFirstName}
                          </td>
                        )}
                        <td className="border border-[#CBD5E1] py-[2.5px] px-1 break-words">{cleanNote || '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

                  {renderSignatures()}
                </div>
              </td>
            </tr>
            )}

            {/* REPORT 5: ALL BUILDINGS & ALL FLOORS INVENTORY SUMMARY */}
            {activeReport === 'building_floors' && (
              <tr>
                <td className="print-shell-cell">
                  <div className="space-y-3.5">
                    {renderLetterhead(
                      'รายงานสรุปจำนวนเครื่องปรับอากาศทุกชั้นทุกอาคาร',
                      `ข้อมูล ณ วันที่ ${formatThaiDate(today)} (ไม่นับรวมเครื่องที่ยกเลิก)`
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1]">
              <div>
                <div className="text-[11px] text-[#64748B]">จำนวนอาคารทั้งหมด</div>
                <div className="text-base font-bold tabular-nums">{floorInv.buildings.length} อาคาร</div>
              </div>
              <div>
                <div className="text-[11px] text-[#64748B]">แอร์ปกติ (ใช้งาน)</div>
                <div className="text-base font-bold text-[#1E3A5F] tabular-nums">
                  {floorInv.grandTotal.normalActive} เครื่อง
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#64748B]">VRF / VRV (ใช้งาน)</div>
                <div className="text-base font-bold text-[#25593E] tabular-nums">
                  {floorInv.grandTotal.vrfActive} เครื่อง
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#64748B]">รวมแอร์ทั้งหมดในสัญญา</div>
                <div className="text-base font-bold text-[#0F172A] tabular-nums">
                  {floorInv.grandTotal.totalActive} เครื่อง
                </div>
              </div>
            </div>

            <table className="w-full table-fixed text-[10px] leading-[1.25] border border-[#CBD5E1] border-collapse">
              <thead>
                <tr className="bg-[#EEF4F9] text-[#1E293B]">
                  <th className="border border-[#CBD5E1] py-1 px-2 text-left w-[32%]">อาคาร</th>
                  <th className="border border-[#CBD5E1] py-1 px-2 text-left w-[16%]">ชั้น</th>
                  <th className="border border-[#CBD5E1] py-1 px-2 text-right w-[13%]">แอร์ปกติ</th>
                  <th className="border border-[#CBD5E1] py-1 px-2 text-right w-[13%]">VRF / VRV</th>
                  <th className="border border-[#CBD5E1] py-1 px-2 text-right w-[13%]">รวมใช้งาน</th>
                  <th className="border border-[#CBD5E1] py-1 px-2 text-right w-[13%]">ยกเลิก (ไม่นับ)</th>
                </tr>
              </thead>
              <tbody>
                {floorInv.buildings.map((b) => {
                  const displayBuilding = formatReportBuildingName(b.building);
                  return (
                    <React.Fragment key={b.building}>
                      {b.floors.map((f) => (
                        <tr key={`${b.building}-${f.floor}`}>
                          <td className="border border-[#CBD5E1] py-[2.5px] px-2 break-words">
                            {formatReportBuildingName(f.building)}
                          </td>
                          <td className="border border-[#CBD5E1] py-[2.5px] px-2 break-words">{f.floor}</td>
                          <td className="border border-[#CBD5E1] py-[2.5px] px-2 text-right tabular-nums">
                            {f.normalActive}
                          </td>
                          <td className="border border-[#CBD5E1] py-[2.5px] px-2 text-right tabular-nums">
                            {f.vrfActive}
                          </td>
                          <td className="border border-[#CBD5E1] py-[2.5px] px-2 text-right tabular-nums font-semibold">
                            {f.totalActive}
                          </td>
                          <td className="border border-[#CBD5E1] py-[2.5px] px-2 text-right tabular-nums text-[#64748B]">
                            {f.cancelledCount}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-[#F2F6FA] font-semibold">
                        <td className="border border-[#CBD5E1] py-1 px-2 break-words">
                          รวม {displayBuilding}
                        </td>
                        <td className="border border-[#CBD5E1] py-1 px-2">{b.floors.length} ชั้น</td>
                        <td className="border border-[#CBD5E1] py-1 px-2 text-right tabular-nums">
                          {b.normalActive}
                        </td>
                        <td className="border border-[#CBD5E1] py-1 px-2 text-right tabular-nums">
                          {b.vrfActive}
                        </td>
                        <td className="border border-[#CBD5E1] py-1 px-2 text-right tabular-nums">
                          {b.totalActive}
                        </td>
                        <td className="border border-[#CBD5E1] py-1 px-2 text-right tabular-nums text-[#64748B]">
                          {b.cancelledCount}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#E6EFF7] font-bold text-[#0F172A]">
                  <td className="border border-[#CBD5E1] py-1.5 px-2">รวมสุทธิทุกชั้นทุกอาคาร</td>
                  <td className="border border-[#CBD5E1] py-1.5 px-2 tabular-nums">
                    {floorInv.grandTotal.floorCount} ชั้น
                  </td>
                  <td className="border border-[#CBD5E1] py-1.5 px-2 text-right tabular-nums">
                    {floorInv.grandTotal.normalActive}
                  </td>
                  <td className="border border-[#CBD5E1] py-1.5 px-2 text-right tabular-nums">
                    {floorInv.grandTotal.vrfActive}
                  </td>
                  <td className="border border-[#CBD5E1] py-1.5 px-2 text-right tabular-nums">
                    {floorInv.grandTotal.totalActive}
                  </td>
                  <td className="border border-[#CBD5E1] py-1.5 px-2 text-right tabular-nums text-[#64748B]">
                    {floorInv.grandTotal.cancelledCount}
                  </td>
                </tr>
              </tfoot>
            </table>

                  {renderSignatures()}
                </div>
              </td>
            </tr>
            )}

            {/* REPORT 6: TECHNICIAN PERFORMANCE REPORT */}
            {activeReport === 'technicians' && (
              <tr>
                <td className="print-shell-cell">
                  <div className="space-y-3.5">
            {renderLetterhead(
              'รายงานสรุปผลงานการล้างเครื่องปรับอากาศรายบุคคล (แผนกช่างเทคนิค)',
              `ช่วงวันที่ ${formatThaiDate(rangeStart, true)} ถึง ${formatThaiDate(rangeEnd, true)}`
            )}

            <table className="w-full table-fixed text-[11px] leading-snug border border-[#CBD5E1] border-collapse">
              <thead>
                <tr className="bg-[#EEF4F9] text-[#1E293B]">
                  <th className="border border-[#CBD5E1] py-1.5 px-1.5 text-center w-[6%]">ลำดับ</th>
                  <th className="border border-[#CBD5E1] py-1.5 px-2 text-left w-[22%]">ชื่อช่างเทคนิค</th>
                  <th className="border border-[#CBD5E1] py-1.5 px-2 text-right w-[11%]">ล้างแล้ว (เครื่อง)</th>
                  <th className="border border-[#CBD5E1] py-1.5 px-2 text-right w-[10%]">แอร์ปกติ</th>
                  <th className="border border-[#CBD5E1] py-1.5 px-2 text-right w-[10%]">VRF / VRV</th>
                  <th className="border border-[#CBD5E1] py-1.5 px-2 text-right w-[11%]">ไม่ได้เข้าล้าง</th>
                  <th className="border border-[#CBD5E1] py-1.5 px-2 text-left w-[30%]">อาคารที่ปฏิบัติงาน</th>
                </tr>
              </thead>
              <tbody>
                {rangeTechStats.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border border-[#CBD5E1] py-8 text-center text-[#64748B]">
                      ไม่พบข้อมูลการปฏิบัติงานในช่วงวันที่ที่เลือก
                    </td>
                  </tr>
                ) : (
                  rangeTechStats.map((t, idx) => (
                    <tr key={t.technicianId}>
                      <td className="border border-[#CBD5E1] py-1.5 px-1.5 text-center tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="border border-[#CBD5E1] py-1.5 px-2 font-medium break-words">
                        {t.technicianName}
                      </td>
                      <td className="border border-[#CBD5E1] py-1.5 px-2 text-right tabular-nums font-bold text-[#25593E]">
                        {t.cleanedCount}
                      </td>
                      <td className="border border-[#CBD5E1] py-1.5 px-2 text-right tabular-nums">
                        {t.normalCount}
                      </td>
                      <td className="border border-[#CBD5E1] py-1.5 px-2 text-right tabular-nums">
                        {t.vrfCount}
                      </td>
                      <td className="border border-[#CBD5E1] py-1.5 px-2 text-right tabular-nums">
                        {t.uncleanedCount}
                      </td>
                      <td className="border border-[#CBD5E1] py-1.5 px-2 break-words">
                        {t.buildings.map(formatReportBuildingName).join(', ')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

                  {renderSignatures()}
                </div>
              </td>
            </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
