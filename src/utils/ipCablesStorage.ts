import { ZoneConfig, CableClassificationRules, IpCableExcelParseResult, CablePendingTask, CableAfectacion, IpCableRow } from '../types/ipCablesTypes';
import { getIdbItem, setIdbItem, deleteIdbItem } from './indexedDbStorage';

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
      if (parsed && parsed.rigidaCables) return parsed;
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
 * Resuelve la Afectación aplicable a un servicio/fila IP Cable.
 * Evalúa en orden de prioridad:
 * 1. Afectaciones independientes (por servicio específico, por cable, por central o global).
 * 2. Tarea técnica asignada que tenga afectación activada (retrocompatibilidad).
 * 3. Columna AFECTACIONES original del archivo Excel (si existe en rawRowData).
 */
export function resolveItemAfectacion(
  item: IpCableRow,
  afectaciones: CableAfectacion[] = [],
  tasks?: CablePendingTask[]
): { afectacion: string; afectacionRecord?: CableAfectacion } {
  const itemDate = (item.fechaReporte || '').trim().slice(0, 10);
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
  const itemServicio = (item.telefono || item.servicio || '').trim().toUpperCase();
  const itemAsociado = (asociadoVal || '').trim().toUpperCase();
  const itemCable = (item.cable || '').trim().toUpperCase();
  const itemCableP = (item.cableP || '').trim().toUpperCase();
  const itemCableS = (item.cableS || '').trim().toUpperCase();
  const itemCentral = (item.central || '').trim().toUpperCase();

  const normalizeDate = (d?: string): string => {
    if (!d) return '';
    const clean = d.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
      const [dd, mm, yyyy] = clean.split('/');
      return `${yyyy}-${mm}-${dd}`;
    }
    return clean;
  };

  const normItemDate = normalizeDate(itemDate);

  const isDateInRange = (startDate?: string, endDate?: string): boolean => {
    if (!startDate && !endDate) return true;
    if (!normItemDate) return true; // Si no hay fecha de reporte, aplica por defecto
    const normStart = normalizeDate(startDate);
    const normEnd = normalizeDate(endDate);
    if (normStart && normItemDate < normStart) return false;
    if (normEnd && normItemDate > normEnd) return false;
    return true;
  };

  // 1. Verificar Afectaciones independientes activas
  for (const af of afectaciones) {
    if (af.activo === false) {
      continue;
    }
    if (!isDateInRange(af.fechaInicio, af.fechaFin)) {
      continue;
    }

    // A) Scope 'services': número de servicio específico
    if (af.scope === 'services' && af.serviceNumbers && af.serviceNumbers.length > 0) {
      const match = af.serviceNumbers.some(srv => {
        const cleanSrv = srv.trim().toUpperCase();
        if (!cleanSrv) return false;
        if (cleanSrv === itemServicio || cleanSrv === itemAsociado) return true;
        const srvDigits = cleanSrv.replace(/\D/g, '');
        const itemDigits = itemServicio.replace(/\D/g, '');
        return srvDigits.length > 3 && itemDigits.length > 3 && (itemDigits === srvDigits || itemDigits.endsWith(srvDigits));
      });
      if (match) {
        return { afectacion: af.motivo, afectacionRecord: af };
      }
    }

    // B) Scope 'cable': cable completo
    if (af.scope === 'cable' && af.cable) {
      const targetCable = af.cable.trim().toUpperCase();
      if (
        (itemCable && itemCable === targetCable) ||
        (itemCableP && itemCableP === targetCable) ||
        (itemCableS && itemCableS === targetCable)
      ) {
        return { afectacion: af.motivo, afectacionRecord: af };
      }
    }

    // C) Scope 'central': central telefónica completa
    if (af.scope === 'central' && af.central) {
      const targetCentral = af.central.trim().toUpperCase();
      if (itemCentral && itemCentral === targetCentral) {
        return { afectacion: af.motivo, afectacionRecord: af };
      }
    }

    // D) Scope 'global': se aplica a TODO en general en dicho recuadro
    if (af.scope === 'global') {
      return { afectacion: af.motivo, afectacionRecord: af };
    }
  }

  // 2. Retrocompatibilidad: buscar en tareas técnicas
  if (tasks && tasks.length > 0) {
    for (const task of tasks) {
      if (!task.hasAfectacion || !task.afectacionMotivo) continue;
      if (!isDateInRange(task.afectacionFechaInicio, task.afectacionFechaFin)) continue;

      const taskCable = (task.cable || '').trim().toUpperCase();
      const sharesCable =
        (itemCable && itemCable === taskCable) ||
        (itemCableP && itemCableP === taskCable) ||
        (itemCableS && itemCableS === taskCable);

      const sharesService = task.serviceNumbers?.some(sn => {
        const cleanSn = sn.trim().toUpperCase();
        return cleanSn === itemServicio || cleanSn === itemAsociado;
      });

      if (sharesCable || sharesService) {
        return { afectacion: task.afectacionMotivo.trim() };
      }
    }
  }

  // 3. Revisar si en rawRowData del Excel original existe una columna AFECTACIONES
  if (item.rawRowData) {
    for (const [key, val] of Object.entries(item.rawRowData)) {
      const k = key.trim().toUpperCase();
      if (k.includes('AFECTACION') || k.includes('AFECTACIÓN') || k === 'MOTIVO') {
        const v = String(val || '').trim();
        if (v && v !== '-' && v.toUpperCase() !== 'NULL' && v.toUpperCase() !== 'UNDEFINED' && v.toLowerCase() !== 'sin afectacion') {
          return { afectacion: v };
        }
      }
    }
  }

  return { afectacion: '-' };
}

