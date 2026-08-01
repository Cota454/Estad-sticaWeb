export interface WorkGroup {
  id: string;
  name: string;
  code: string;
  description: string;
  color: string;
}

export interface Central {
  id: string;
  code: string;
  name: string;
  location: string;
  // Installed capacity per workgroup ID (e.g., lines, ports, circuits)
  installedTech: Record<string, number>;
  active: boolean;
}

export interface DailyReport {
  id: string;
  date: string; // ISO YYYY-MM-DD
  centralId: string;
  workGroupId: string;
  reportCount: number;
  notes?: string;
  updatedAt?: string;
}

export type ChartType = 'bar' | 'stackedBar' | 'line' | 'area' | 'pie' | 'radar';

export interface DateRangeFilter {
  startDate: string;
  endDate: string;
}

export interface MonthYearFilter {
  month: number; // 0-indexed (0 = Enero, 11 = Diciembre) or -1 for All
  year: number; // e.g. 2026
}

export interface DayOfWeekStat {
  dayName: string;
  dayIndex: number; // 0 = Domingo, 1 = Lunes...
  totalReports: number;
  dayCount: number;
  averageReports: number;
}

export interface DifferenceCell {
  valInitial: number;
  valFinal: number;
  diff: number; // valFinal - valInitial
  status: 'improved' | 'worsened' | 'unchanged';
}

export interface DifferenceRow {
  centralId: string;
  centralName: string;
  groupDiffs: Record<string, DifferenceCell>;
  totalInitial: number;
  totalFinal: number;
  totalDiff: number;
  totalStatus: 'improved' | 'worsened' | 'unchanged';
}

export interface TechInstalledGroupStat {
  reports: number;
  capacity: number;
  percentage: number;
}

export interface TechInstalledRow {
  centralId: string;
  centralName: string;
  groupStats: Record<string, TechInstalledGroupStat>;
  totalReports: number;
  totalCapacity: number;
  totalPercentage: number;
}

export interface ExcelImportRow {
  centralName: string;
  groupValues: Record<string, number>;
}

export interface SystemDataBackup {
  version: string;
  exportedAt: string;
  centrales: Central[];
  workGroups: WorkGroup[];
  reports: DailyReport[];
}

export interface UserProfile {
  email: string;
  name: string;
  picture?: string;
  role: 'admin' | 'user';
  isAuthenticated: boolean;
  accessToken?: string;
  tokenExpiry?: number;
}

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
  mimeType: string;
  webViewLink?: string;
}

export interface ReportSettings {
  documentTitle: string;
  documentSubtitle: string;
  departmentName: string;
  fileNamePrefix: string;

  includeExecutiveSummary: boolean;
  includeMatrixTable: boolean;
  includeTechInstalledTable: boolean;
  includeDayOfWeekStats: boolean;
  includeHistoricalEvolution: boolean;
  includeConclusions: boolean;

  customExecutiveSummary: string;
  matrixExplanation: string;
  techInstalledExplanation: string;
  dayOfWeekExplanation: string;
  historicalExplanation: string;
  customConclusions: string;
}

