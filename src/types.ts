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

export interface RepairRecord {
  id: string;
  ticketCode: string;       // e.g. "REP-2026-0881" or "FOL-8819"
  date: string;             // ISO YYYY-MM-DD (Fecha de Atención / Reparación)
  reportDate?: string;      // ISO YYYY-MM-DD (Fecha de Reporte / Ingreso)
  centralId?: string;       // Matched central ID
  centralName: string;      // Central name or code
  serviceNumber: string;    // Service / Phone line / Subscriber ID / Abonado (for repeated service analysis)
  technician: string;       // Brigada / Técnico
  issueType: string;        // Tipo de falla / descripción
  cable?: string;           // Columna Cable
  grupo?: string;           // Columna Grupo
  claveCode?: string;       // Columna Clave
  status: 'resolved' | 'in_progress' | 'pending';
  mttrHours: number;        // Tiempo de solución en horas
  workGroupId?: string;     // Work group if matched
  rawRowData?: Record<string, any>; // Extra dynamic columns from Excel
  tableName?: string;       // Custom table tag if uploaded into a named table
}

export interface RepairColumnMapping {
  dateCol: string;          // Excel column name for Date de Reparación
  reportDateCol?: string;   // Excel column name for Date de Reporte
  centralCol: string;       // Excel column name for Central
  serviceCol: string;       // Excel column name for Servicio / Abonado / Línea
  ticketCol?: string;       // Excel column name for Ticket / Folio
  technicianCol?: string;   // Excel column name for Técnico / Brigada
  cableCol?: string;        // Excel column name for Cable
  issueCol?: string;        // Fallback for Cable
  grupoCol?: string;        // Excel column name for Grupo
  statusCol?: string;       // Fallback for Grupo
  claveCol?: string;        // Excel column name for Clave
  mttrCol?: string;         // Excel column name for MTTR / Horas
  startRow: number;         // Starting row index for processing (1-indexed)
  endRow?: number;          // Optional ending row index
}

export interface CustomTableSchema {
  id: string;
  tableName: string;
  description?: string;
  columnsToProcess: string[]; // List of selected Excel column names
  startRow: number;
  endRow?: number;
  createdDate: string;
  rowCount: number;
  data: Record<string, any>[]; // Processed rows
}

export interface SystemDataBackup {
  version: string;
  exportedAt: string;
  centrales: Central[];
  workGroups: WorkGroup[];
  reports: DailyReport[];
  repairRecords?: RepairRecord[];
  customTables?: CustomTableSchema[];
  repairColumnMapping?: RepairColumnMapping;
}

export type PortalModuleId = 'report_analysis' | 'ip_analysis' | 'repairs_analysis';

export interface PortalUser {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: 'admin' | 'operator';
  permissions: PortalModuleId[];
  active: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface UserProfile {
  email: string;
  name: string;
  picture?: string;
  role: 'admin' | 'user';
  isAuthenticated: boolean;
  accessToken?: string;
  tokenExpiry?: number;
  portalUsername?: string;
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

