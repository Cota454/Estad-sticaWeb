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
  terminal?: string;        // Columna Terminal / Caja de Dispersión
  pair?: string;            // Columna Par (Primario / Secundario)
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
  terminalCol?: string;     // Excel column name for Terminal / Caja
  pairCol?: string;         // Excel column name for Par
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

import { ZoneConfig, CableClassificationRules, IpCableExcelParseResult, CablePendingTask } from './types/ipCablesTypes';
import { PrintedRecord } from './utils/ipCablesStorage';

export interface SystemConfigBackup {
  backupType: 'configuration';
  version: string;
  exportedAt: string;
  description: string;
  centrales: Central[];
  workGroups: WorkGroup[];
  repairColumnMapping?: RepairColumnMapping;
  reportSettings?: ReportSettings;
  ipZones?: ZoneConfig[];
  ipCableRules?: CableClassificationRules;
  cablePendingTasks?: CablePendingTask[];
  wordReportProfiles?: WordReportProfile[];
  customTableDefinitions?: Array<{
    id: string;
    tableName: string;
    description?: string;
    columnsToProcess: string[];
    startRow: number;
    endRow?: number;
    createdDate: string;
  }>;
}

export interface SystemHistoryBackup {
  backupType: 'history';
  version: string;
  exportedAt: string;
  description: string;
  reports: DailyReport[];
  repairRecords?: RepairRecord[];
  ipParsedData?: IpCableExcelParseResult;
  ipPrintedServices?: Record<string, PrintedRecord>;
  customTablesData?: CustomTableSchema[];
}

export interface SystemDataBackup {
  backupType?: 'full' | 'configuration' | 'history';
  version: string;
  exportedAt: string;
  description?: string;
  centrales?: Central[];
  workGroups?: WorkGroup[];
  reports?: DailyReport[];
  repairRecords?: RepairRecord[];
  customTables?: CustomTableSchema[];
  repairColumnMapping?: RepairColumnMapping;
  reportSettings?: ReportSettings;
  ipZones?: ZoneConfig[];
  ipCableRules?: CableClassificationRules;
  cablePendingTasks?: CablePendingTask[];
  wordReportProfiles?: WordReportProfile[];
  ipParsedData?: IpCableExcelParseResult;
  ipPrintedServices?: Record<string, PrintedRecord>;
}

export type PortalModuleId = 'report_analysis' | 'ip_analysis' | 'repairs_analysis' | 'word_reports';

export type WordReportSectionKey =
  | 'sec1_tech'
  | 'sec2_same_period'
  | 'sec3_daily_month'
  | 'sec4_daily_groups'
  | 'sec5_mttr'
  | 'sec6_claves'
  | 'sec7_repetidos';

export interface WordReportSectionConfig {
  id: string;
  key: WordReportSectionKey;
  title: string;
  enabled: boolean;
  includeTables: boolean;
  includeCharts: boolean;
  customNotes?: string;
}

export interface WordReportProfile {
  id: string;
  name: string; // e.g., "Informe General Completo", "Informe de Claves y Repetidos", "Informe de Grupos Operativos"
  description: string;
  fileNamePrefix: string;
  documentTitle: string;
  departmentName: string;
  sections: WordReportSectionConfig[];
  createdDate: string;
  updatedAt?: string;
}

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

export type IncoherenceDetectionMode = 'all_different' | 'effective_vs_non_effective' | 'custom_rules';

export interface IncoherentClaveRule {
  fromClave: string;
  toClave: string;
  description?: string;
}

export interface NonEffectiveMappingRule {
  id: string;
  nonEffectiveClave: string;       // Clave No Efectiva (1ª Visita)
  effectiveClaves: string[];        // Varias Claves Efectivas asignadas (2ª Visita)
  description?: string;
}

export interface IncoherentAuditConfig {
  windowDays: number; // default: 30 days
  detectionMode: IncoherenceDetectionMode;
  nonEffectiveClaves: string[]; // e.g. ['C-01', 'SIN FALLA', 'OK PRUEBAS']
  effectiveClaves: string[];    // e.g. ['C-02', 'C-03', 'C-04', 'PAR DAÑADO']
  customPairs: IncoherentClaveRule[];
  nonEffectiveMappings?: NonEffectiveMappingRule[]; // Asignación 1 Clave No Efectiva -> Múltiples Claves Efectivas
}

export interface IncoherentEvent {
  id: string;
  serviceNumber: string;
  folio?: string; // Folio compartido (mismo Servicio y mismo Folio)
  centralName: string;
  // 1st visit (First closure / Affected Technician)
  firstRepairId: string;
  firstTicket: string;
  firstDate: string;
  firstReportDate?: string;
  firstTech: string;
  firstClave: string;
  firstCable?: string;
  firstGrupo?: string;
  firstRawRowData?: Record<string, any>;
  // 2nd visit (Subsequent audit visit)
  secondRepairId: string;
  secondTicket: string;
  secondDate: string;
  secondReportDate?: string;
  secondTech: string;
  secondClave: string;
  secondCable?: string;
  secondGrupo?: string;
  secondRawRowData?: Record<string, any>;
  // Diff calculation
  diffDays: number;
  // Diagnostics
  incoherenceType: string;
  isSameTech: boolean;
  affectedTech: string; // The 1st tech whose closure was contradicted
  severity: 'high' | 'medium';
}

export interface IncoherentTechnicianSummary {
  technician: string;
  totalIncoherentClosures: number; // Number of times their 1st closure was refuted in <= 30 days
  totalFirstVisits: number;        // Total initial visits recorded
  refutationRate: number;          // % of initial visits that were refuted
  commonInitialClaves: { clave: string; count: number }[];
  commonRefutedByClaves: { clave: string; count: number }[];
  refutedByTechs: { technician: string; count: number }[];
}

export type PairMatchType = 'SAME_TERMINAL' | 'SIBLING_TERMINAL';
export type PairIntervalPreset = '24h' | '48h' | '7d' | '15d' | '30d' | 'custom';
export type PairSuspicionLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export interface PairCannibalizationEvent {
  id: string;
  centralName: string;
  cable: string;
  matchType: PairMatchType; // 'SAME_TERMINAL' (B2 = B2) | 'SIBLING_TERMINAL' (B2 vs B4, letra en común)
  blockLetter: string;      // Letra del bloque/caja en común (ej. "B")
  diffDays: number;         // Días entre la 1ª reparación y la 2ª reparación/avería
  diffHoursEstimate?: number;
  intervalCategory: string; // "24 Horas", "48 Horas", "Misma Semana (3-7d)", "Quincena (8-15d)", "Mes"
  suspicionLevel: PairSuspicionLevel; // 🔴 CRITICAL, 🟠 HIGH, 🟡 MEDIUM
  suspectedTechnician: string; // Operario de la 1ª intervención (sospechoso de haber intervenido la caja/par)
  isSameTech: boolean;
  description: string;

  // Intervención 1 (El Servicio Reparado / Donante sospechoso)
  firstRepairId: string;
  firstTicket: string;
  firstService: string;
  firstDate: string;
  firstTech: string;
  firstTerminal: string;
  firstPair?: string;
  firstClave: string;
  firstIssue?: string;
  firstStatus?: string;
  firstRawRowData?: Record<string, any>;

  // Intervención 2 (El Servicio Interrumpido / Vecino Afectado)
  secondRepairId: string;
  secondTicket: string;
  secondService: string;
  secondDate: string;
  secondTech: string;
  secondTerminal: string;
  secondPair?: string;
  secondClave: string;
  secondIssue?: string;
  secondStatus?: string;
  secondRawRowData?: Record<string, any>;
}

export interface TechnicianCollateralDamageSummary {
  technician: string;
  totalCollateralCases: number;     // Total de vecinos afectados tras su intervención
  criticalCases: number;            // Afectaciones en <= 48h
  highCases: number;                // Afectaciones en <= 7 días
  sameTerminalCases: number;        // Mismo terminal exacto
  siblingTerminalCases: number;     // Terminal hermano (misma letra)
  mostAffectedCables: { cable: string; count: number }[];
  mostAffectedTerminals: { terminal: string; count: number }[];
  affectedServicesCount: number;
}

