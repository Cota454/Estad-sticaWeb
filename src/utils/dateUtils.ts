export const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export const DAYS_OF_WEEK_ES = [
  { name: "Domingo", short: "Dom", index: 0 },
  { name: "Lunes", short: "Lun", index: 1 },
  { name: "Martes", short: "Mar", index: 2 },
  { name: "Miércoles", short: "Mié", index: 3 },
  { name: "Jueves", short: "Jue", index: 4 },
  { name: "Viernes", short: "Vie", index: 5 },
  { name: "Sábado", short: "Sáb", index: 6 }
];

export function getTodayStr(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isFutureDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const today = getTodayStr();
  return dateStr > today;
}

export function clampDateToToday(dateStr: string): string {
  if (isFutureDate(dateStr)) {
    return getTodayStr();
  }
  return dateStr;
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${day} ${MONTH_NAMES_ES[monthIdx]?.substring(0, 3)} ${year}`;
}

export function formatDateLong(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${day} de ${MONTH_NAMES_ES[monthIdx]} de ${year}`;
}

export function getDayOfWeekName(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  const dayIndex = date.getDay();
  return DAYS_OF_WEEK_ES[dayIndex].name;
}

export function getPastDateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getStartOfMonthStr(year: number, month: number): string {
  const m = String(month + 1).padStart(2, '0');
  return `${year}-${m}-01`;
}

export function getEndOfMonthStr(year: number, month: number): string {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const m = String(month + 1).padStart(2, '0');
  const d = String(lastDay).padStart(2, '0');
  const candidate = `${year}-${m}-${d}`;
  return isFutureDate(candidate) ? getTodayStr() : candidate;
}

export function getWeekDateRanges(): {
  currentWeekStart: string;
  currentWeekEnd: string;
  prevWeekStart: string;
  prevWeekEnd: string;
} {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon...
  
  // Calculate Monday of current week (assuming Monday start)
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const currMon = new Date(today);
  currMon.setDate(today.getDate() - diffToMonday);

  const prevMon = new Date(currMon);
  prevMon.setDate(currMon.getDate() - 7);

  const prevSun = new Date(currMon);
  prevSun.setDate(currMon.getDate() - 1);

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const currentWeekStart = formatDate(currMon);
  const currentWeekEnd = getTodayStr();
  const prevWeekStart = formatDate(prevMon);
  const prevWeekEnd = formatDate(prevSun);

  return {
    currentWeekStart,
    currentWeekEnd,
    prevWeekStart,
    prevWeekEnd
  };
}
