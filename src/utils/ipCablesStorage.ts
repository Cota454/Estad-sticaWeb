import { ZoneConfig, CableClassificationRules, IpCableExcelParseResult, CablePendingTask, CableAfectacion, IpCableRow } from '../types/ipCablesTypes';
import { getIdbItem, setIdbItem, deleteIdbItem } from './indexedDbStorage';
import { cleanCableName, isCableExactMatch } from './ipCablesExcelParser';

const ZONES_STORAGE_KEY = 'telecomstat_ip_zones_v1';
const CABLE_RULES_STORAGE_KEY = 'telecomstat_cable_rules_v1';
const PARSED_DATA_STORAGE_KEY = 'telecomstat_ip_parsed_data_v1';
const AFECTACIONES_STORAGE_KEY = 'telecomstat_ip_afectaciones_v1';

export const DEFAULT_ZONES: ZoneConfig[] = [
  {
    id: 'z1',
    name: 'Zona Norte',
    description: 'Centrales y sectores del Anillo Norte',
    centralNames: ['CTA SE', 'PLAZA NORTE', 'CENTRAL NORTE'],
    cableNames: ['CABLE-01', 'CABLE-02', 'CR-101', 'CR-102'],
    color: '#3B82F6'
  },
  {
    id: 'z2',
    name: 'Zona Sur',
    description: 'Centrales y sectores del Anillo Sur',
    centralNames: ['CENTRAL SUR', 'PLAZA SUR', 'CTA SUR'],
    cableNames: ['CABLE-05', 'CABLE-06', 'CF-201', 'CF-202'],
    color: '#10B981'
  },
  {
    id: 'z3',
    name: 'Zona Centro / Metro',
    description: 'Centrales metropolitanas del núcleo urbano',
    centralNames: ['CORE CENTRAL', 'NOC PRINCIPAL', 'CENTRO'],
    cableNames: ['CABLE-03', 'CABLE-04', 'OUT-301'],
    color: '#F59E0B'
  }
];

export const DEFAULT_CABLE_RULES: CableClassificationRules = {
  rigidaCables: ['CR-101', 'CR-102', 'CR-103', 'RIGIDA-01', 'RED RIGIDA', 'CABLE-01', 'CABLE-02'],
  priorityServices: [],
  flexibleRules: [
    { id: 'f1', pattern: 'CF-', assignedName: 'Red Flexible Coaxial/FO' },
    { id: 'f2', pattern: 'FLEX', assignedName: 'Red Flexible Multipar' },
    { id: 'f3', pattern: 'FLX', assignedName: 'Red Flexible Distribución' },
    { id: 'f4', pattern: 'CABLE-05', assignedName: 'Red Flexible Sector Sur' }
  ],
  outdoorRules: [
    { id: 'o1', centralPattern: 'OUTDOOR', assignedName: 'Gabinete Extemperie Outdoor' },
    { id: 'o2', centralPattern: 'EXTERIOR', assignedName: 'Nodo Exterior Remoto' },
    { id: 'o3', centralPattern: 'PLAZA', assignedName: 'Gabinete de Plaza' }
  ]
};

export function loadZones(): ZoneConfig[] {
  try {
    const raw = localStorage.getItem(ZONES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Error loading zones from localStorage', e);
  }
  return DEFAULT_ZONES;
}

export function saveZones(zones: ZoneConfig[]): void {
  try {
    localStorage.setItem(ZONES_STORAGE_KEY, JSON.stringify(zones));
  } catch (e) {
    console.error('Error saving zones to localStorage', e);
  }
}

export function loadCableRules(): CableClassificationRules {
  try {
    const raw = localStorage.getItem(CABLE_RULES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed) {
        if (!Array.isArray(parsed.priorityServices)) {
          parsed.priorityServices = [];
        } else {
          parsed.priorityServices = parsed.priorityServices
            .map((item: any) => {
              if (typeof item === 'string') {
                return { service: item.trim(), comment: '' };
              }
              return {
                service: String(item?.service || '').trim(),
                comment: String(item?.comment || '').trim()
              };
            })
            .filter((item: any) => Boolean(item.service));
        }
        if (!Array.isArray(parsed.rigidaCables)) {
          parsed.rigidaCables = DEFAULT_CABLE_RULES.rigidaCables;
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading cable rules from localStorage', e);
  }
  return DEFAULT_CABLE_RULES;
}

export function saveCableRules(rules: CableClassificationRules): void {
  try {
    localStorage.setItem(CABLE_RULES_STORAGE_KEY, JSON.stringify(rules));
  } catch (e) {
    console.error('Error saving cable rules to localStorage', e);
  }
}

let memoryCachedParsedIpData: IpCableExcelParseResult | null = null;

export function loadParsedIpData(): IpCableExcelParseResult | null {
  if (memoryCachedParsedIpData) {
    return memoryCachedParsedIpData;
  }
  try {
    const raw = localStorage.getItem(PARSED_DATA_STORAGE_KEY);
    if (raw) {
      memoryCachedParsedIpData = JSON.parse(raw);
      return memoryCachedParsedIpData;
    }
  } catch (e) {
    console.warn('Error loading parsed IP data from localStorage', e);
  }
  return null;
}

/**
 * Asynchronously loads parsed IP data from IndexedDB (ideal for large Excel files).
 * Falls back to localStorage if IndexedDB is empty or not supported.
 */
export async function loadParsedIpDataAsync(): Promise<IpCableExcelParseResult | null> {
  if (memoryCachedParsedIpData) {
    return memoryCachedParsedIpData;
  }

  // 1. Try IndexedDB (handles gigabytes of data with zero quota errors)
  try {
    const idbData = await getIdbItem<IpCableExcelParseResult>(PARSED_DATA_STORAGE_KEY);
    if (idbData && idbData.consolidatedRows && idbData.consolidatedRows.length > 0) {
      memoryCachedParsedIpData = idbData;
      return idbData;
    }
  } catch (e) {
    console.warn('Error reading parsed IP data from IndexedDB:', e);
  }

  // 2. Fallback to localStorage
  return loadParsedIpData();
}

/**
 * Saves parsed IP data into both in-memory cache, IndexedDB (for unlimited permanent storage)
 * and attempts localStorage (safely catching any 5MB QuotaExceededError).
 */
export async function saveParsedIpData(data: IpCableExcelParseResult): Promise<boolean> {
  memoryCachedParsedIpData = data;

  // Try saving to localStorage for instant synchronous reads if small
  try {
    localStorage.setItem(PARSED_DATA_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // QuotaExceededError is normal in browsers when Excel files exceed 5MB.
    // Safely continue since IndexedDB stores the complete dataset reliably.
    console.warn('localStorage quota exceeded for IP Excel data; IndexedDB will maintain permanent persistence:', e);
  }

  // Save to IndexedDB permanently
  return await setIdbItem(PARSED_DATA_STORAGE_KEY, data);
}

export async function clearParsedIpData(): Promise<boolean> {
  memoryCachedParsedIpData = null;
  try {
    localStorage.removeItem(PARSED_DATA_STORAGE_KEY);
  } catch (e) {
    console.warn('Error clearing parsed IP data from localStorage', e);
  }
  return await deleteIdbItem(PARSED_DATA_STORAGE_KEY);
}

const PRINTED_SERVICES_STORAGE_KEY = 'telecomstat_printed_services_v1';

export interface PrintedRecord {
  printedAt: string;
  count: number;
}

export function loadPrintedServices(): Record<string, PrintedRecord> {
  try {
    const raw = localStorage.getItem(PRINTED_SERVICES_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading printed services from localStorage', e);
  }
  return {};
}

export function savePrintedServices(records: Record<string, PrintedRecord>): void {
  try {
    localStorage.setItem(PRINTED_SERVICES_STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Error saving printed services to localStorage', e);
  }
}

export function markServicesAsPrinted(servicios: string[]): Record<string, PrintedRecord> {
  const current = loadPrintedServices();
  const nowStr = new Date().toLocaleString();

  servicios.forEach(s => {
    const key = (s || '').toString().trim().toUpperCase();
    if (key) {
      const prevCount = current[key]?.count || 0;
      current[key] = {
        printedAt: nowStr,
        count: prevCount + 1
      };
    }
  });

  savePrintedServices(current);
  return current;
}

export function markServiceAsUnprinted(servicio: string): Record<string, PrintedRecord> {
  const current = loadPrintedServices();
  const key = (servicio || '').toString().trim().toUpperCase();
  if (key && current[key]) {
    delete current[key];
    savePrintedServices(current);
  }
  return current;
}

// ==========================================
// TRABAJOS PENDIENTES POR CABLE
// ==========================================
const CABLE_TASKS_STORAGE_KEY = 'telecomstat_cable_pending_tasks_v1';

export const DEFAULT_CABLE_TASKS: CablePendingTask[] = [
  {
    id: 'task-demo-1',
    cable: 'CABLE-01',
    taskName: 'Reparación de empalme en cámara principal por filtración de agua',
    terminalDireccion: 'Terminal 04 · Av. Norte con Calle 3',
    serviceNumbers: ['0212000001', '0212000002', '0212000003'],
    status: 'pending',
    priority: 'high',
    createdAt: new Date().toISOString(),
    hasAfectacion: true,
    afectacionMotivo: 'Huracán',
    afectacionFechaInicio: '2024-08-01',
    afectacionFechaFin: '2026-12-31'
  },
  {
    id: 'task-demo-2',
    cable: 'CR-101',
    taskName: 'Sustitución de tramo aéreo 50m dañado por caída de rama',
    terminalDireccion: 'Terminal 12 · Calle Principal Sector Centro',
    serviceNumbers: ['0212000005', '0212000006'],
    status: 'in_progress',
    priority: 'urgent',
    createdAt: new Date().toISOString()
  }
];

export function loadCablePendingTasks(): CablePendingTask[] {
  try {
    const raw = localStorage.getItem(CABLE_TASKS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error loading cable pending tasks from localStorage', e);
  }
  return DEFAULT_CABLE_TASKS;
}

export function saveCablePendingTasks(tasks: CablePendingTask[]): void {
  try {
    localStorage.setItem(CABLE_TASKS_STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.error('Error saving cable pending tasks to localStorage', e);
  }
}

export const DEFAULT_CABLE_AFECTACIONES: CableAfectacion[] = [
  {
    id: 'afect-demo-1',
    motivo: 'Huracán',
    scope: 'cable',
    cable: 'CABLE-01',
    fechaInicio: '2024-08-01',
    fechaFin: '2026-12-31',
    descripcion: 'Afectación general por contingencia climática en sector troncal',
    createdAt: new Date().toISOString()
  }
];

export function loadCableAfectaciones(): CableAfectacion[] {
  try {
    const raw = localStorage.getItem(AFECTACIONES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error loading cable afectaciones from localStorage', e);
  }
  return DEFAULT_CABLE_AFECTACIONES;
}

export function saveCableAfectaciones(afectaciones: CableAfectacion[]): void {
  try {
    localStorage.setItem(AFECTACIONES_STORAGE_KEY, JSON.stringify(afectaciones));
    // Trigger custom window event to synchronize views reactively
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('telecomstat_afectaciones_updated', { detail: afectaciones }));
    }
  } catch (e) {
    console.error('Error saving cable afectaciones to localStorage', e);
  }
}

/**
 * Normaliza cualquier formato de fecha a string comparable YYYY-MM-DD.
 * Soporta Date, números de Excel, YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, fechas con hora, etc.
 */
export function parseDateToComparableYMD(rawDate: any): string {
  if (rawDate === undefined || rawDate === null || rawDate === '') return '';
  if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
    const y = rawDate.getFullYear();
    const m = String(rawDate.getMonth() + 1).padStart(2, '0');
    const d = String(rawDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof rawDate === 'number') {
    // Excel serial date number (ej: 45212)
    const dateObj = new Date((rawDate - (25567 + 2)) * 86400 * 1000);
    if (!isNaN(dateObj.getTime())) {
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(rawDate).trim();
  if (!str) return '';

  // 1. Extraer YYYY-MM-DD o YYYY/MM/DD (con hora opcional)
  const ymdMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. Extraer DD/MM/YYYY o DD-MM-YYYY (con hora opcional)
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // 3. Fallback con Date nativo
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '';
}

/**
 * Extrae y normaliza a YYYY-MM-DD la fecha de reporte de una fila/servicio IP Cable.
 */
export function extractItemReportDate(item: IpCableRow): string {
  // 1. Probar campo formal fechaReporte
  if (item.fechaReporte) {
    const d = parseDateToComparableYMD(item.fechaReporte);
    if (d) return d;
  }

  // 2. Probar en rawRowData del Excel
  const raw = item.rawRowData || {};
  for (const [key, val] of Object.entries(raw)) {
    const k = key.trim().toUpperCase();
    if (
      k.includes('FECHA') ||
      k.includes('DATE') ||
      k === 'F_REPORTE' ||
      k === 'F.REPORTE' ||
      k === 'REPORTE' ||
      k === 'FECHA REPORTE'
    ) {
      const d = parseDateToComparableYMD(val);
      if (d) return d;
    }
  }

  return '';
}

/**
 * Comprueba si la fecha del reporte cae dentro de la ventana de tiempo especificada.
 */
export function isReportDateWithinRange(itemDateYMD: string, startDate?: string, endDate?: string): boolean {
  const normStart = parseDateToComparableYMD(startDate);
  const normEnd = parseDateToComparableYMD(endDate);

  // Si no se definió ni inicio ni fin, la afectación es permanente
  if (!normStart && !normEnd) return true;

  // Si el servicio cuenta con fecha de reporte identificada
  if (itemDateYMD) {
    if (normStart && itemDateYMD < normStart) return false;
    if (normEnd && itemDateYMD > normEnd) return false;
    return true;
  }

  // Si la afectación exige rango de fecha pero el servicio no tiene fecha, no coincide
  return false;
}

/**
 * Resuelve la Afectación aplicable a un servicio/fila IP Cable.
 *
 * REGLA FUNDAMENTAL:
 * Las afectaciones que se encuentran dentro del rango de fecha se le asignan automáticamente
 * sin importar si tiene o no tarea asociada. La prioridad absoluta de las afectaciones es
 * que se encuentren dentro del rango de fecha.
 */
export function resolveItemAfectacion(
  item: IpCableRow,
  afectaciones: CableAfectacion[] = [],
  tasks?: CablePendingTask[]
): { afectacion: string; afectacionRecord?: CableAfectacion; matchDetail?: string } {
  const raw = item.rawRowData || {};
  let asociadoVal = item.asociado || '';
  if (!asociadoVal) {
    for (const k of Object.keys(raw)) {
      if (k.toLowerCase().includes('asoc')) {
        asociadoVal = String(raw[k] || '').trim();
        break;
      }
    }
  }

  const itemServicio = (item.telefono || item.servicio || '').toString().trim().toUpperCase();
  const itemAsociado = (asociadoVal || '').toString().trim().toUpperCase();
  const itemCable = (item.cable || '').toString().trim().toUpperCase();
  const itemCableP = (item.cableP || '').toString().trim().toUpperCase();
  const itemCableS = (item.cableS || '').toString().trim().toUpperCase();
  const itemCentral = (item.central || '').toString().trim().toUpperCase();

  const itemDateYMD = extractItemReportDate(item);

  // Helper para comprobar coincidencia por Cable
  const matchesCableTarget = (targetCable?: string): boolean => {
    if (!targetCable) return false;
    const cleanTarget = cleanCableName(targetCable).trim().toUpperCase();
    if (!cleanTarget) return false;

    const cableValues = [itemCableP, itemCableS, itemCable].filter(Boolean);
    for (const cv of cableValues) {
      if (isCableExactMatch(cv, cleanTarget)) return true;
      const cleanCv = cleanCableName(cv).trim().toUpperCase();
      if (cleanCv === cleanTarget) return true;
      const parts = cleanCv.split(/[\/,;|\-]+/).map(p => p.trim());
      if (parts.includes(cleanTarget)) return true;
    }
    return false;
  };

  // Helper para comprobar coincidencia por Central
  const matchesCentralTarget = (targetCentral?: string): boolean => {
    if (!targetCentral) return false;
    const cleanTarget = targetCentral.trim().toUpperCase();
    if (!cleanTarget || !itemCentral) return false;
    if (itemCentral === cleanTarget) return true;
    const centralParts = itemCentral.split(/[\/,;|\-]+/).map(p => p.trim());
    return centralParts.includes(cleanTarget);
  };

  // Helper para comprobar coincidencia por Servicio puntual
  const matchesServiceTarget = (serviceNumbers?: string[]): boolean => {
    if (!serviceNumbers || serviceNumbers.length === 0) return false;
    const srvDigits = itemServicio.replace(/\D/g, '');
    const asocDigits = itemAsociado.replace(/\D/g, '');

    return serviceNumbers.some(srv => {
      const cleanSrv = srv.trim().toUpperCase();
      if (!cleanSrv) return false;
      if (cleanSrv === itemServicio || cleanSrv === itemAsociado) return true;
      const targetDigits = cleanSrv.replace(/\D/g, '');
      if (targetDigits.length > 3) {
        if (srvDigits && (srvDigits === targetDigits || srvDigits.replace(/^0+/, '') === targetDigits.replace(/^0+/, ''))) return true;
        if (asocDigits && (asocDigits === targetDigits || asocDigits.replace(/^0+/, '') === targetDigits.replace(/^0+/, ''))) return true;
      }
      return false;
    });
  };

  // Lista de afectaciones activas
  const activeAfectaciones = (afectaciones || []).filter(a => a.activo !== false && Boolean(a.motivo?.trim()));

  // =========================================================================
  // FASE 1: PRIORIDAD MÁXIMA - AFECTACIONES DENTRO DEL RANGO DE FECHA
  // Se asignan AUTOMÁTICAMENTE a cualquier reporte dentro de su ventana de fecha,
  // SIN requerir que exista una tarea creada/asociada.
  // =========================================================================

  // 1.1 Servicios puntuales dentro del rango de fecha
  for (const af of activeAfectaciones) {
    if (af.scope === 'services' && (af.fechaInicio || af.fechaFin)) {
      if (isReportDateWithinRange(itemDateYMD, af.fechaInicio, af.fechaFin) && matchesServiceTarget(af.serviceNumbers)) {
        return {
          afectacion: af.motivo.trim(),
          afectacionRecord: af,
          matchDetail: `Servicio puntual (${af.fechaInicio || 'Inicio'} a ${af.fechaFin || 'Sin fin'})`
        };
      }
    }
  }

  // 1.2 Por Cable dentro del rango de fecha
  for (const af of activeAfectaciones) {
    if (af.scope === 'cable' && af.cable && (af.fechaInicio || af.fechaFin)) {
      if (isReportDateWithinRange(itemDateYMD, af.fechaInicio, af.fechaFin) && matchesCableTarget(af.cable)) {
        return {
          afectacion: af.motivo.trim(),
          afectacionRecord: af,
          matchDetail: `Cable ${af.cable} (${af.fechaInicio || 'Inicio'} a ${af.fechaFin || 'Sin fin'})`
        };
      }
    }
  }

  // 1.3 Por Central dentro del rango de fecha
  for (const af of activeAfectaciones) {
    if (af.scope === 'central' && af.central && (af.fechaInicio || af.fechaFin)) {
      if (isReportDateWithinRange(itemDateYMD, af.fechaInicio, af.fechaFin) && matchesCentralTarget(af.central)) {
        return {
          afectacion: af.motivo.trim(),
          afectacionRecord: af,
          matchDetail: `Central ${af.central} (${af.fechaInicio || 'Inicio'} a ${af.fechaFin || 'Sin fin'})`
        };
      }
    }
  }

  // 1.4 Global (Todo el sector/recuadro) dentro del rango de fecha
  for (const af of activeAfectaciones) {
    if (af.scope === 'global' && (af.fechaInicio || af.fechaFin)) {
      if (isReportDateWithinRange(itemDateYMD, af.fechaInicio, af.fechaFin)) {
        return {
          afectacion: af.motivo.trim(),
          afectacionRecord: af,
          matchDetail: `Afectación Global (${af.fechaInicio || 'Inicio'} a ${af.fechaFin || 'Sin fin'})`
        };
      }
    }
  }

  // =========================================================================
  // FASE 2: AFECTACIONES CONFIGURADAS EN TAREAS TÉCNICAS DENTRO DEL RANGO DE FECHA
  // =========================================================================
  if (tasks && tasks.length > 0) {
    for (const task of tasks) {
      if (!task.hasAfectacion || !task.afectacionMotivo) continue;
      if (task.afectacionFechaInicio || task.afectacionFechaFin) {
        if (!isReportDateWithinRange(itemDateYMD, task.afectacionFechaInicio, task.afectacionFechaFin)) continue;
        const sharesCable = matchesCableTarget(task.cable);
        const sharesService = matchesServiceTarget(task.serviceNumbers);
        if (sharesCable || sharesService) {
          return {
            afectacion: task.afectacionMotivo.trim(),
            matchDetail: `Tarea técnica en rango (${task.afectacionFechaInicio || 'Inicio'} a ${task.afectacionFechaFin || 'Sin fin'})`
          };
        }
      }
    }
  }

  // =========================================================================
  // FASE 3: AFECTACIONES INDEPENDIENTES PERMANENTES (SIN RESTRICCIÓN DE FECHAS)
  // =========================================================================
  for (const af of activeAfectaciones) {
    if (!af.fechaInicio && !af.fechaFin) {
      if (af.scope === 'services' && matchesServiceTarget(af.serviceNumbers)) {
        return { afectacion: af.motivo.trim(), afectacionRecord: af, matchDetail: 'Servicio puntual (Permanente)' };
      }
      if (af.scope === 'cable' && af.cable && matchesCableTarget(af.cable)) {
        return { afectacion: af.motivo.trim(), afectacionRecord: af, matchDetail: `Cable ${af.cable} (Permanente)` };
      }
      if (af.scope === 'central' && af.central && matchesCentralTarget(af.central)) {
        return { afectacion: af.motivo.trim(), afectacionRecord: af, matchDetail: `Central ${af.central} (Permanente)` };
      }
      if (af.scope === 'global') {
        return { afectacion: af.motivo.trim(), afectacionRecord: af, matchDetail: 'Global (Permanente)' };
      }
    }
  }

  // =========================================================================
  // FASE 4: AFECTACIONES DE TAREAS TÉCNICAS PERMANENTES (Retrocompatibilidad)
  // =========================================================================
  if (tasks && tasks.length > 0) {
    for (const task of tasks) {
      if (!task.hasAfectacion || !task.afectacionMotivo) continue;
      if (!task.afectacionFechaInicio && !task.afectacionFechaFin) {
        const sharesCable = matchesCableTarget(task.cable);
        const sharesService = matchesServiceTarget(task.serviceNumbers);
        if (sharesCable || sharesService) {
          return {
            afectacion: task.afectacionMotivo.trim(),
            matchDetail: 'Tarea técnica (Permanente)'
          };
        }
      }
    }
  }

  // =========================================================================
  // FASE 5: COLUMNA AFECTACIONES ORIGINAL DEL ARCHIVO EXCEL
  // =========================================================================
  if (item.rawRowData) {
    for (const [key, val] of Object.entries(item.rawRowData)) {
      const k = key.trim().toUpperCase();
      if (k.includes('AFECTACION') || k.includes('AFECTACIÓN') || k === 'MOTIVO') {
        const v = String(val || '').trim();
        if (v && v !== '-' && v.toUpperCase() !== 'NULL' && v.toUpperCase() !== 'UNDEFINED' && v.toLowerCase() !== 'sin afectacion') {
          return { afectacion: v, matchDetail: 'Columna Excel original' };
        }
      }
    }
  }

  return { afectacion: '-' };
}

