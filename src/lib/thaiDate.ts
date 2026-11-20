export const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

export const THAI_MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

export function formatThaiDate(isoDate: string, shortMonth = false): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return isoDate || '-';
  const [yStr, mStr, dStr] = isoDate.slice(0, 10).split('-');
  const year = Number(yStr) + 543;
  const monthIdx = Number(mStr) - 1;
  const day = Number(dStr);
  const monthName = shortMonth ? THAI_MONTHS_SHORT[monthIdx] : THAI_MONTHS[monthIdx];
  return `${day} ${monthName || mStr} ${year}`;
}

export function formatThaiMonthYear(year: number, monthIndex1To12: number): string {
  const monthName = THAI_MONTHS[monthIndex1To12 - 1] || '';
  return `${monthName} ${year + 543}`;
}

export function getDaysInMonth(year: number, month1To12: number): number {
  return new Date(year, month1To12, 0).getDate();
}

export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getMonthDateRange(year: number, month1To12: number): {
  startDate: string;
  endDate: string;
} {
  const mStr = String(month1To12).padStart(2, '0');
  const lastDay = String(getDaysInMonth(year, month1To12)).padStart(2, '0');
  return {
    startDate: `${year}-${mStr}-01`,
    endDate: `${year}-${mStr}-${lastDay}`,
  };
}
