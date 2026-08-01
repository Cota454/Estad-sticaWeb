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

export interface WeekOption {
  key: string;
  start: string;
  end: string;
  label: string;
  weekNum: number;
}

export interface MonthOption {
  key: string;
  year: number;
  monthIdx: number;
  start: string;
  end: string;
  label: string;
}

export function getWeekRangeForDate(dateStr: string): WeekOption {
  if (!dateStr) dateStr = getTodayStr();
  const parts = dateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const dateObj = new Date(y, m, d);

  const day = dateObj.getDay(); // 0 = Sun, 1 = Mon...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(y, m, d + diffToMonday);

  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);

  const fmt = (dt: Date) => {
    const yr = dt.getFullYear();
    const mo = String(dt.getMonth() + 1).padStart(2, '0');
    const da = String(dt.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  };

  const start = fmt(monday);
  const end = fmt(saturday);

  // Calculate ISO week number
  const target = new Date(monday.valueOf());
  const dayNr = (monday.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNum = 1 + Math.round((firstThursday - target.valueOf()) / 604800000);

  return {
    key: start,
    start,
    end,
    weekNum,
    label: `Semana ${weekNum} (${formatDateShort(start)} al ${formatDateShort(end)})`
  };
}

export function getAvailableWeeks(uniqueDates: string[]): WeekOption[] {
  const weeksMap = new Map<string, WeekOption>();

  // Helper to add a date's week
  const addDateWeek = (dStr: string) => {
    const wk = getWeekRangeForDate(dStr);
    if (!weeksMap.has(wk.start)) {
      weeksMap.set(wk.start, wk);
    }
  };

  // Add dates from reports
  uniqueDates.forEach(dStr => addDateWeek(dStr));

  // Also guarantee past 8 weeks from today are available
  const today = new Date();
  for (let i = 0; i < 8; i++) {
    const past = new Date(today);
    past.setDate(today.getDate() - (i * 7));
    const yr = past.getFullYear();
    const mo = String(past.getMonth() + 1).padStart(2, '0');
    const da = String(past.getDate()).padStart(2, '0');
    addDateWeek(`${yr}-${mo}-${da}`);
  }

  const list = Array.from(weeksMap.values());
  // Sort descending by start date
  list.sort((a, b) => b.start.localeCompare(a.start));
  return list;
}

export function getAvailableMonths(uniqueDates: string[]): MonthOption[] {
  const monthsMap = new Map<string, MonthOption>();

  const addMonth = (year: number, monthIdx: number) => {
    const mKey = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
    if (!monthsMap.has(mKey)) {
      const start = getStartOfMonthStr(year, monthIdx);
      const end = getEndOfMonthStr(year, monthIdx);
      monthsMap.set(mKey, {
        key: mKey,
        year,
        monthIdx,
        start,
        end,
        label: `${MONTH_NAMES_ES[monthIdx]} ${year}`
      });
    }
  };

  // Add months from reports dates
  uniqueDates.forEach(dStr => {
    const parts = dStr.split('-');
    if (parts.length === 3) {
      const yr = parseInt(parts[0], 10);
      const moIdx = parseInt(parts[1], 10) - 1;
      addMonth(yr, moIdx);
    }
  });

  // Guarantee past 12 months from today
  const today = new Date();
  const currYr = today.getFullYear();
  const currMo = today.getMonth();
  for (let i = 0; i < 12; i++) {
    let yr = currYr;
    let mo = currMo - i;
    while (mo < 0) {
      mo += 12;
      yr -= 1;
    }
    addMonth(yr, mo);
  }

  const list = Array.from(monthsMap.values());
  list.sort((a, b) => b.key.localeCompare(a.key));
  return list;
}

