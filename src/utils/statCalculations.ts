import { Central, WorkGroup, DailyReport, DayOfWeekStat, DifferenceRow, TechInstalledRow, ExcelImportRow } from '../types';
import { DAYS_OF_WEEK_ES } from './dateUtils';

export function isSunday(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDay() === 0;
}

export function getCentralTotalCapacity(central: Central): number {
  if (!central || !central.installedTech) return 0;
  if (typeof central.installedTech.total === 'number') {
    return central.installedTech.total;
  }
  const vals = Object.values(central.installedTech) as number[];
  return vals.reduce((a, b) => a + b, 0);
}

export function filterReportsByMonthYear(reports: DailyReport[], month: number, year: number, excludeSundays: boolean = true): DailyReport[] {
  return reports.filter(r => {
    if (!r.date) return false;
    if (excludeSundays && isSunday(r.date)) return false;
    const parts = r.date.split('-');
    if (parts.length !== 3) return false;
    const rYear = parseInt(parts[0], 10);
    const rMonth = parseInt(parts[1], 10) - 1; // 0-indexed
    if (year !== -1 && rYear !== year) return false;
    if (month !== -1 && rMonth !== month) return false;
    return true;
  });
}

export function filterReportsByDateRange(reports: DailyReport[], startDate: string, endDate: string, excludeSundays: boolean = true): DailyReport[] {
  return reports.filter(r => {
    if (!r.date) return false;
    if (excludeSundays && isSunday(r.date)) return false;
    if (startDate && r.date < startDate) return false;
    if (endDate && r.date > endDate) return false;
    return true;
  });
}

export function calculateMonthMinMaxDays(reports: DailyReport[], month: number, year: number) {
  const filtered = filterReportsByMonthYear(reports, month, year, true);
  
  // Aggregate report totals per date
  const dateTotals: Record<string, number> = {};
  filtered.forEach(r => {
    dateTotals[r.date] = (dateTotals[r.date] || 0) + (r.reportCount || 0);
  });

  const dates = Object.keys(dateTotals);
  if (dates.length === 0) {
    return {
      minDay: null,
      maxDay: null,
      totalMonthReports: 0,
      activeDaysCount: 0
    };
  }

  let minDate = dates[0];
  let maxDate = dates[0];
  let minVal = dateTotals[minDate];
  let maxVal = dateTotals[maxDate];
  let totalMonthReports = 0;

  dates.forEach(d => {
    const val = dateTotals[d];
    totalMonthReports += val;
    if (val < minVal) {
      minVal = val;
      minDate = d;
    }
    if (val > maxVal) {
      maxVal = val;
      maxDate = d;
    }
  });

  return {
    minDay: { date: minDate, count: minVal },
    maxDay: { date: maxDate, count: maxVal },
    totalMonthReports,
    activeDaysCount: dates.length
  };
}

export function calculateDayOfWeekStats(reports: DailyReport[], startDate?: string, endDate?: string): DayOfWeekStat[] {
  const filtered = startDate && endDate ? filterReportsByDateRange(reports, startDate, endDate, true) : reports.filter(r => !isSunday(r.date));
  
  // Track distinct dates per day-of-week index (0 = Sun, 1 = Mon...)
  const dayDatesMap: Record<number, Set<string>> = { 0: new Set(), 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set(), 5: new Set(), 6: new Set() };
  const dayReportTotals: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

  filtered.forEach(r => {
    if (!r.date) return;
    const dateObj = new Date(r.date + 'T00:00:00');
    const dayIdx = dateObj.getDay();
    dayDatesMap[dayIdx].add(r.date);
    dayReportTotals[dayIdx] += (r.reportCount || 0);
  });

  // Working days only: Lunes (1) to Sábado (6)
  const orderedIndices = [1, 2, 3, 4, 5, 6];

  return orderedIndices.map(dayIdx => {
    const dayInfo = DAYS_OF_WEEK_ES[dayIdx];
    const totalReports = dayReportTotals[dayIdx];
    const dayCount = dayDatesMap[dayIdx].size;
    const averageReports = dayCount > 0 ? parseFloat((totalReports / dayCount).toFixed(2)) : 0;

    return {
      dayName: dayInfo.name,
      dayIndex: dayIdx,
      totalReports,
      dayCount,
      averageReports
    };
  });
}

export function calculateDifferenceMatrix(
  reports: DailyReport[],
  startDate: string,
  endDate: string,
  centrales: Central[],
  workGroups: WorkGroup[]
): DifferenceRow[] {
  // Extract reports for Date 1 (Initial) and Date 2 (Final)
  const startReportsMap: Record<string, Record<string, number>> = {};
  const endReportsMap: Record<string, Record<string, number>> = {};

  reports.forEach(r => {
    if (isSunday(r.date)) return; // exclude Sundays
    if (r.date === startDate) {
      if (!startReportsMap[r.centralId]) startReportsMap[r.centralId] = {};
      startReportsMap[r.centralId][r.workGroupId] = (startReportsMap[r.centralId][r.workGroupId] || 0) + r.reportCount;
    }
    if (r.date === endDate) {
      if (!endReportsMap[r.centralId]) endReportsMap[r.centralId] = {};
      endReportsMap[r.centralId][r.workGroupId] = (endReportsMap[r.centralId][r.workGroupId] || 0) + r.reportCount;
    }
  });

  return centrales.map(central => {
    const groupDiffs: DifferenceRow['groupDiffs'] = {};
    let totalInitial = 0;
    let totalFinal = 0;

    workGroups.forEach(grp => {
      const valInitial = startReportsMap[central.id]?.[grp.id] || 0;
      const valFinal = endReportsMap[central.id]?.[grp.id] || 0;
      const diff = valFinal - valInitial;

      let status: 'improved' | 'worsened' | 'unchanged' = 'unchanged';
      if (diff < 0) status = 'improved'; // Soft Green - reduced averías
      else if (diff > 0) status = 'worsened'; // Soft Red - increased averías

      groupDiffs[grp.id] = {
        valInitial,
        valFinal,
        diff,
        status
      };

      totalInitial += valInitial;
      totalFinal += valFinal;
    });

    const totalDiff = totalFinal - totalInitial;
    let totalStatus: 'improved' | 'worsened' | 'unchanged' = 'unchanged';
    if (totalDiff < 0) totalStatus = 'improved';
    else if (totalDiff > 0) totalStatus = 'worsened';

    return {
      centralId: central.id,
      centralName: central.name,
      groupDiffs,
      totalInitial,
      totalFinal,
      totalDiff,
      totalStatus
    };
  });
}

export function calculateTechInstalledMatrix(
  reports: DailyReport[],
  startDate: string,
  endDate: string,
  centrales: Central[],
  workGroups: WorkGroup[]
): TechInstalledRow[] {
  const filtered = filterReportsByDateRange(reports, startDate, endDate, true);

  // Group report count by centralId -> workGroupId
  const countsMap: Record<string, Record<string, number>> = {};
  filtered.forEach(r => {
    if (!countsMap[r.centralId]) countsMap[r.centralId] = {};
    countsMap[r.centralId][r.workGroupId] = (countsMap[r.centralId][r.workGroupId] || 0) + r.reportCount;
  });

  return centrales.map(central => {
    const groupStats: TechInstalledRow['groupStats'] = {};
    let totalReports = 0;

    // Total installed capacity belongs to the central as a single figure
    const totalCapacity = getCentralTotalCapacity(central);

    workGroups.forEach(grp => {
      const reportCount = countsMap[central.id]?.[grp.id] || 0;

      // Percentage that this work group represents with respect to the TOTAL installed tech of the Central
      const percentage = totalCapacity > 0
        ? parseFloat(((reportCount / totalCapacity) * 100).toFixed(2))
        : 0;

      groupStats[grp.id] = {
        reports: reportCount,
        capacity: totalCapacity,
        percentage
      };

      totalReports += reportCount;
    });

    const totalPercentage = totalCapacity > 0 ? parseFloat(((totalReports / totalCapacity) * 100).toFixed(2)) : 0;

    return {
      centralId: central.id,
      centralName: central.name,
      groupStats,
      totalReports,
      totalCapacity,
      totalPercentage
    };
  });
}

export function parseExcelClipboardData(
  rawText: string,
  workGroups: WorkGroup[],
  centrales: Central[]
): {
  success: boolean;
  rows: ExcelImportRow[];
  headers: string[];
  matchedGroups: WorkGroup[];
  matchedCentrales: Central[];
  message: string;
} {
  const lines = rawText.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    return {
      success: false,
      rows: [],
      headers: [],
      matchedGroups: [],
      matchedCentrales: [],
      message: 'El texto debe contener al menos 2 filas: la 1ra fila con los códigos o nombres de los grupos (ej. PLEXT, CONM, TRANS) y las siguientes con la central y los valores.'
    };
  }

  // Row 1 parsing: Group headers (codes or names)
  const headerLine = lines[0];
  const delimiter = headerLine.includes('\t') ? '\t' : (headerLine.includes(';') ? ';' : ',');
  const rawHeaders = headerLine.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, '')).filter(Boolean);

  // The first column header might be "Central", "Código", "Unidad", etc.
  let groupHeaders = rawHeaders;
  if (rawHeaders.length > 0 && /central|unidad|exchange|nombre|código|codigo/i.test(rawHeaders[0])) {
    groupHeaders = rawHeaders.slice(1);
  }

  // Helper function to clean text for matching
  const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Match each pasted header column to system WorkGroups by code priority
  const columnToGroupMap: (WorkGroup | null)[] = [];
  const matchedGroupsSet = new Set<WorkGroup>();

  groupHeaders.forEach((gh, _colIdx) => {
    const cleanGh = normalize(gh);

    // 1. Priority: Exact match on Group Code
    let found = workGroups.find(g => normalize(g.code) === cleanGh);

    // 2. Priority: Code contains or is contained in header
    if (!found) {
      found = workGroups.find(g => cleanGh.includes(normalize(g.code)) || normalize(g.code).includes(cleanGh));
    }

    // 3. Priority: Exact match on Group Name
    if (!found) {
      found = workGroups.find(g => normalize(g.name) === cleanGh);
    }

    // 4. Priority: Substring match on Group Name
    if (!found) {
      found = workGroups.find(g => cleanGh.includes(normalize(g.name)) || normalize(g.name).includes(cleanGh));
    }

    columnToGroupMap.push(found || null);
    if (found) {
      matchedGroupsSet.add(found);
    }
  });

  // Ensure matchedGroups includes groups ordered according to workGroups
  const matchedGroupsList = workGroups.filter(g => matchedGroupsSet.has(g));
  // If no specific group was matched by code/name, default to all workGroups
  const activeMatchedGroups = matchedGroupsList.length > 0 ? matchedGroupsList : workGroups;

  const parsedRows: ExcelImportRow[] = [];
  const matchedCentralesSet = new Set<Central>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cells = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cells.length < 2) continue;

    const centralName = cells[0];
    if (!centralName) continue;

    const groupValues: Record<string, number> = {};
    // Initialize all matched work groups to 0
    activeMatchedGroups.forEach(g => {
      groupValues[g.id] = 0;
    });

    // Populate values based on matched column map
    columnToGroupMap.forEach((grp, colIdx) => {
      const cellValStr = cells[colIdx + 1] || '0';
      const numVal = parseInt(cellValStr.replace(/[^0-9]/g, ''), 10) || 0;

      if (grp) {
        groupValues[grp.id] = (groupValues[grp.id] || 0) + numVal;
      } else {
        // Fallback to colIdx group if unassigned
        const fallbackGrp = activeMatchedGroups[colIdx % activeMatchedGroups.length];
        if (fallbackGrp) {
          groupValues[fallbackGrp.id] = (groupValues[fallbackGrp.id] || 0) + numVal;
        }
      }
    });

    // Check if central exists in system
    const existingCentral = centrales.find(
      c => normalize(c.name) === normalize(centralName) ||
           normalize(c.code) === normalize(centralName) ||
           normalize(c.name).includes(normalize(centralName)) ||
           normalize(centralName).includes(normalize(c.name))
    );

    if (existingCentral) {
      matchedCentralesSet.add(existingCentral);
    }

    parsedRows.push({
      centralName,
      groupValues
    });
  }

  return {
    success: true,
    rows: parsedRows,
    headers: activeMatchedGroups.map(g => `${g.code} - ${g.name}`),
    matchedGroups: activeMatchedGroups,
    matchedCentrales: Array.from(matchedCentralesSet),
    message: `Se identificaron y organizaron ${parsedRows.length} centrales telefónicas clasificadas por Código de Grupo (${activeMatchedGroups.map(g => g.code).join(', ')}).`
  };
}
