export interface ZoneConfig {
  id: string;
  name: string;
  description?: string;
  centralNames: string[]; // Centrales allocated to this zone
  cableNames: string[];   // Cable names or patterns allocated to this zone
  color?: string;
}

export interface CableClassificationRules {
  rigidaCables: string[]; // List of exact names or prefixes for Red Rígida
  flexibleRules: { id: string; pattern: string; assignedName: string }[]; // Match in CABLE column
  outdoorRules: { id: string; centralPattern: string; assignedName: string }[]; // Match in CENTRAL TELEFONICA column
}

export type NetworkTypeCategory = 'all' | 'rigida' | 'flexible' | 'outdoor';

export interface IpCableRow {
  id: string;
  servicio: string;           // Key for consolidation
  central: string;            // Central Telefónica
  grupo: string;              // Grupo de Trabajo
  cable: string;              // Cable
  fechaReporte: string;       // Fecha Reporte (YYYY-MM-DD or formatted)
  rawRowData: Record<string, any>;
  networkType: 'rigida' | 'flexible' | 'outdoor' | 'other';
  networkTypeLabel: string;
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
