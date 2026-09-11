export interface ZoneCableRule {
  cableName: string;
  matchTerminal?: boolean;
  terminals?: string[]; // list of terminal strings/numbers
}

export interface ZoneConfig {
  id: string;
  name: string;
  description?: string;
  centralNames: string[]; // Centrales allocated to this zone
  cableNames: string[];   // Cable names or patterns allocated to this zone (legacy or simple string)
  cableRules?: ZoneCableRule[]; // Detailed cable rules with optional Terminal filtering
  color?: string;
}

export interface CableClassificationRules {
  rigidaCables: string[]; // List of exact names or prefixes for Red Rígida
  flexibleRules: { id: string; pattern: string; assignedName: string }[]; // Match in CABLE column
  outdoorRules: { id: string; centralPattern: string; assignedName: string }[]; // Match in CENTRAL TELEFONICA column
}

export type NetworkTypeCategory = 'all' | 'rigida' | 'flexible' | 'outdoor' | 'other';

export interface IpCableRow {
  id: string;
  servicio: string;           // Key for consolidation
  central: string;            // Central Telefónica
  grupo: string;              // Grupo de Trabajo
  cable: string;              // Combined Cable
  cableP?: string;            // Cable Primario (Cable P)
  parP?: string;              // Par Primario (Par P)
  cableS?: string;            // Cable Secundario (Cable S)
  parS?: string;              // Par Secundario (Par S)
  fechaReporte: string;       // Fecha Reporte (YYYY-MM-DD or formatted)
  rawRowData: Record<string, any>;
  networkType: 'rigida' | 'flexible' | 'outdoor' | 'other';
  networkTypeLabel: string;
  flexibleRuleId?: string;
  flexibleAssignedName?: string;
  count: number;              // Consolidated record count (e.g. 1 or merged count)
  combinedDetails?: string[]; // Log of merged rows
}

export interface IpCableExcelParseResult {
  totalRowsRead: number;
  totalHeaderCols: number;
  headers: string[];
  consolidatedRows: IpCableRow[];
  uniqueServicesCount: number;
  uniqueCentrales: string[];
  uniqueGroups: string[];
  uniqueCables: string[];
  uniqueMonthsYears: { year: number; month: number; label: string }[];
  parseDate: string;
  fileName: string;
}

export interface CablePendingTask {
  id: string;
  cable: string;                  // Cable específico (ej. CABLE-01, CR-101, etc.)
  taskName: string;               // Tarea o Trabajo por el cual está pendiente
  terminalDireccion?: string;     // Terminal / Dirección (opcional)
  serviceNumbers: string[];       // Lista de números de servicio específicos asignados
  createdAt: string;              // ISO date string
  updatedAt?: string;             // ISO date string
  status?: 'pending' | 'in_progress' | 'completed';
  notes?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';

  // Casilla opcional de Afectación con rango de fechas
  hasAfectacion?: boolean;
  afectacionMotivo?: string;      // ej: "Huracán", "Vandalismo", "Inundación"
  afectacionFechaInicio?: string; // YYYY-MM-DD
  afectacionFechaFin?: string;    // YYYY-MM-DD
}

export interface CableTaskServiceDetailRow {
  id: string;
  taskId: string;
  taskName: string;
  servicio: string;
  asociado: string;
  cableP: string;
  parP: string;
  cableS: string;
  parS: string;
  fechaReporte: string;
  grupo: string;
  demoraEnDias: number;
  central: string;
  terminalDireccion: string;
  afectacion: string;             // Columna AFECTACIONES
  status: 'pending' | 'in_progress' | 'completed';
}
