import { Central, WorkGroup, DailyReport, RepairRecord, CustomTableSchema, RepairColumnMapping } from '../types';
import { getTodayStr } from '../utils/dateUtils';

export const INITIAL_WORK_GROUPS: WorkGroup[] = [
  {
    id: 'grp_ing_ext',
    code: 'PLEXT',
    name: 'Planta Exterior',
    description: 'Cables coaxiales, pares de cobre, armarios de distribución y postes',
    color: '#3b82f6' // Blue
  },
  {
    id: 'grp_conm',
    code: 'CONM',
    name: 'Conmutación',
    description: 'Centrales de conmutación digital, conmutadores IP, enlaces TDM/SIP',
    color: '#10b981' // Emerald
  },
  {
    id: 'grp_trans',
    code: 'TRANS',
    name: 'Transmisión y Fibra',
    description: 'Anillos de fibra óptica, equipos SDH/DWDM, microondas',
    color: '#8b5cf6' // Purple/Violet
  },
  {
    id: 'grp_ener',
    code: 'ENER',
    name: 'Energía y Clima',
    description: 'Grupos electrógenos, rectificadores, bancos de baterías, aires acondicionados',
    color: '#f59e0b' // Amber
  },
  {
    id: 'grp_broad',
    code: 'BROAD',
    name: 'Banda Ancha y FTTH',
    description: 'Equipos OLT, DSLAM, divisores ópticos y módems de abonado',
    color: '#6366f1' // Indigo
  },
  {
    id: 'grp_sop',
    code: 'SOP',
    name: 'Soporte e Ingeniero',
    description: 'Ingeniería de datos, soporte técnico especializado y enlaces corporativos',
    color: '#ec4899' // Pink/Rose
  }
];

export const INITIAL_CENTRALES: Central[] = [
  {
    id: 'cnt_metro',
    code: 'C-MET-01',
    name: 'Central Metropolitana',
    location: 'Av. Principal 102, Distrito Central',
    active: true,
    installedTech: {
      grp_ing_ext: 5200,
      grp_conm: 4800,
      grp_trans: 2500,
      grp_ener: 800,
      grp_broad: 4200,
      grp_sop: 1000
    }
  },
  {
    id: 'cnt_norte',
    code: 'C-NOR-02',
    name: 'Central Norte (Tele)',
    location: 'Calle Industrial 45, Sector Norte',
    active: true,
    installedTech: {
      grp_ing_ext: 3800,
      grp_conm: 3200,
      grp_trans: 1800,
      grp_ener: 600,
      grp_broad: 3100,
      grp_sop: 500
    }
  },
  {
    id: 'cnt_este',
    code: 'C-EST-03',
    name: 'Central Este',
    location: 'Av. Las Palmas 88, Sector Este',
    active: true,
    installedTech: {
      grp_ing_ext: 2900,
      grp_conm: 2400,
      grp_trans: 1500,
      grp_ener: 450,
      grp_broad: 2600,
      grp_sop: 400
    }
  },
  {
    id: 'cnt_sur',
    code: 'C-SUR-04',
    name: 'Central Sur',
    location: 'Carretera del Sur Km 12',
    active: true,
    installedTech: {
      grp_ing_ext: 4100,
      grp_conm: 3600,
      grp_trans: 2100,
      grp_ener: 700,
      grp_broad: 3500,
      grp_sop: 600
    }
  },
  {
    id: 'cnt_oeste',
    code: 'C-OES-05',
    name: 'Central Digital Oeste',
    location: 'Zona Franca Edificio B, Sector Oeste',
    active: true,
    installedTech: {
      grp_ing_ext: 2500,
      grp_conm: 2800,
      grp_trans: 1600,
      grp_ener: 500,
      grp_broad: 2400,
      grp_sop: 450
    }
  },
  {
    id: 'cnt_centro',
    code: 'C-FIB-06',
    name: 'Central Fibra Centro',
    location: 'Paseo de la Telecomunicación 500',
    active: true,
    installedTech: {
      grp_ing_ext: 4500,
      grp_conm: 4000,
      grp_trans: 3200,
      grp_ener: 900,
      grp_broad: 4800,
      grp_sop: 850
    }
  }
];

export function generateSeedDailyReports(): DailyReport[] {
  const reports: DailyReport[] = [];
  const today = new Date();

  // Generate 60 days of historical reports up to today
  for (let i = 59; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon...
    
    // Seed pseudo-random generator based on date string
    let seed = i * 13 + dayOfWeek * 7;
    const pseudoRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    INITIAL_CENTRALES.forEach(central => {
      INITIAL_WORK_GROUPS.forEach(group => {
        // Base factor depending on day of week (Mondays have higher reported faults)
        let dayMultiplier = 1.0;
        if (dayOfWeek === 1) dayMultiplier = 1.45; // Monday spike
        else if (dayOfWeek === 2) dayMultiplier = 1.2;
        else if (dayOfWeek === 0 || dayOfWeek === 6) dayMultiplier = 0.55; // Weekend lower

        // Central size factor
        let centralFactor = 1.0;
        if (central.id === 'cnt_metro') centralFactor = 1.8;
        if (central.id === 'cnt_norte') centralFactor = 1.2;
        if (central.id === 'cnt_este') centralFactor = 0.8;

        // Group type factor
        let groupFactor = 1.0;
        if (group.id === 'grp_ing_ext') groupFactor = 1.6; // Exterior plant has highest faults
        if (group.id === 'grp_broad') groupFactor = 1.3;
        if (group.id === 'grp_ener') groupFactor = 0.6;

        // Today specific override for demonstration of clear decrease on Central Norte (Tele)
        let baseValue = Math.floor(pseudoRandom() * 4 * dayMultiplier * centralFactor * groupFactor);
        
        // Custom scenario for "Central Norte (Tele)" and group "Soporte e Ingeniero" on recent dates:
        if (i === 0 && central.id === 'cnt_norte' && group.id === 'grp_sop') {
          baseValue = 1; // Today: 1 report
        } else if (i === 1 && central.id === 'cnt_norte' && group.id === 'grp_sop') {
          baseValue = 5; // Yesterday: 5 reports -> Difference -4 (matches prompt example!)
        }

        if (baseValue >= 0) {
          reports.push({
            id: `rep_${dateStr}_${central.id}_${group.id}`,
            date: dateStr,
            centralId: central.id,
            workGroupId: group.id,
            reportCount: Math.max(0, baseValue),
            notes: baseValue > 8 ? 'Mantenimiento preventivo por clima severo' : undefined,
            updatedAt: new Date().toISOString()
          });
        }
      });
    });
  }

  return reports;
}

// Storage Keys
const STORAGE_KEYS = {
  CENTRALES: 'telecom_stat_centrales_v1',
  WORK_GROUPS: 'telecom_stat_workgroups_v1',
  REPORTS: 'telecom_stat_reports_v1'
};

function getStorageKey(baseKey: string, email?: string): string {
  if (!email) return baseKey;
  return `${baseKey}_${email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

export function loadCentrales(userEmail?: string): Central[] {
  try {
    const key = getStorageKey(STORAGE_KEYS.CENTRALES, userEmail);
    const raw = localStorage.getItem(key);
    if (!raw) {
      saveCentrales(INITIAL_CENTRALES, userEmail);
      return INITIAL_CENTRALES;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load centrales from localStorage', e);
    return INITIAL_CENTRALES;
  }
}

export function saveCentrales(centrales: Central[], userEmail?: string): void {
  try {
    const key = getStorageKey(STORAGE_KEYS.CENTRALES, userEmail);
    localStorage.setItem(key, JSON.stringify(centrales));
  } catch (e) {
    console.error('Failed to save centrales', e);
  }
}

export function loadWorkGroups(userEmail?: string): WorkGroup[] {
  try {
    const key = getStorageKey(STORAGE_KEYS.WORK_GROUPS, userEmail);
    const raw = localStorage.getItem(key);
    if (!raw) {
      saveWorkGroups(INITIAL_WORK_GROUPS, userEmail);
      return INITIAL_WORK_GROUPS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load workgroups from localStorage', e);
    return INITIAL_WORK_GROUPS;
  }
}

export function saveWorkGroups(groups: WorkGroup[], userEmail?: string): void {
  try {
    const key = getStorageKey(STORAGE_KEYS.WORK_GROUPS, userEmail);
    localStorage.setItem(key, JSON.stringify(groups));
  } catch (e) {
    console.error('Failed to save workgroups', e);
  }
}

export function loadReports(userEmail?: string): DailyReport[] {
  try {
    const key = getStorageKey(STORAGE_KEYS.REPORTS, userEmail);
    const raw = localStorage.getItem(key);
    if (!raw) {
      const seed = generateSeedDailyReports();
      saveReports(seed, userEmail);
      return seed;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load reports from localStorage', e);
    const seed = generateSeedDailyReports();
    return seed;
  }
}

export function saveReports(reports: DailyReport[], userEmail?: string): void {
  try {
    const key = getStorageKey(STORAGE_KEYS.REPORTS, userEmail);
    localStorage.setItem(key, JSON.stringify(reports));
  } catch (e) {
    console.error('Failed to save reports', e);
  }
}

// Initial Seed Repair Records for Demo & Initial Load
export const INITIAL_REPAIR_RECORDS: RepairRecord[] = [
  // August 2026
  { id: 'rep_001', ticketCode: 'REP-2026-0801', date: '2026-08-01', reportDate: '2026-08-01', centralId: 'cnt_metro', centralName: 'Central Metropolitana', serviceNumber: '212-555-0101', technician: 'Ing. Carlos Mendoza', issueType: 'Falla en Cable Alimentador FO-01', cable: 'FO-01 Alimentador Metro', grupo: 'Ingeniería Exterior', claveCode: 'C-01', status: 'resolved', mttrHours: 1.5, workGroupId: 'grp_ing_ext' },
  { id: 'rep_002', ticketCode: 'REP-2026-0802', date: '2026-08-01', reportDate: '2026-07-25', centralId: 'cnt_metro', centralName: 'Central Metropolitana', serviceNumber: '212-555-0102', technician: 'Téc. Roberto Gómez', issueType: 'Caída de Enlace GPON OLT-1', cable: 'CABLE-GPON-04', grupo: 'Banda Ancha', claveCode: 'C-02', status: 'resolved', mttrHours: 2.1, workGroupId: 'grp_broad' },
  { id: 'rep_003', ticketCode: 'REP-2026-0802b', date: '2026-08-01', reportDate: '2026-07-28', centralId: 'cnt_norte', centralName: 'Central Norte (Tele)', serviceNumber: '212-555-0199', technician: 'Téc. María Elena', issueType: 'Par Sulfatado en Multipair', cable: 'CU-200 Norte', grupo: 'Ingeniería Exterior', claveCode: 'C-01', status: 'resolved', mttrHours: 1.1, workGroupId: 'grp_ing_ext' },
  { id: 'rep_004', ticketCode: 'REP-2026-0803', date: '2026-08-02', reportDate: '2026-08-02', centralId: 'cnt_norte', centralName: 'Central Norte (Tele)', serviceNumber: '212-555-0199', technician: 'Téc. María Elena', issueType: 'Reincidencia: Ruido en la línea', cable: 'CU-200 Norte', grupo: 'Ingeniería Exterior', claveCode: 'C-03', status: 'resolved', mttrHours: 1.8, workGroupId: 'grp_ing_ext' },
  { id: 'rep_005', ticketCode: 'REP-2026-0804', date: '2026-08-02', reportDate: '2026-07-30', centralId: 'cnt_este', centralName: 'Central Este', serviceNumber: '212-555-0340', technician: 'Ing. Luis Fernández', issueType: 'Módulo SFP Quemado en Switch', cable: 'FOS-08 Este', grupo: 'Conmutación', claveCode: 'C-04', status: 'resolved', mttrHours: 3.0, workGroupId: 'grp_conm' },
  { id: 'rep_006', ticketCode: 'REP-2026-0805', date: '2026-08-03', reportDate: '2026-08-03', centralId: 'cnt_metro', centralName: 'Central Metropolitana', serviceNumber: '212-555-0101', technician: 'Ing. Carlos Mendoza', issueType: 'Reincidencia: Atenuación en FOS', cable: 'FO-01 Alimentador Metro', grupo: 'Transmisión', claveCode: 'C-01', status: 'resolved', mttrHours: 2.5, workGroupId: 'grp_trans' },
  { id: 'rep_007', ticketCode: 'REP-2026-0806', date: '2026-08-03', reportDate: '2026-08-01', centralId: 'cnt_sur', centralName: 'Central Sur', serviceNumber: '212-555-0550', technician: 'Téc. Javier Ortiz', issueType: 'Fallo de Rectificador Baterías', cable: 'PW-RECT-02', grupo: 'Energía', claveCode: 'C-05', status: 'resolved', mttrHours: 4.2, workGroupId: 'grp_ener' },
  { id: 'rep_008', ticketCode: 'REP-2026-0807', date: '2026-08-03', reportDate: '2026-08-03', centralId: 'cnt_norte', centralName: 'Central Norte (Tele)', serviceNumber: '212-555-0199', technician: 'Téc. María Elena', issueType: 'Cambio total de acometida', cable: 'CU-200 Norte', grupo: 'Ingeniería Exterior', claveCode: 'C-01', status: 'resolved', mttrHours: 2.2, workGroupId: 'grp_ing_ext' },
  { id: 'rep_009', ticketCode: 'REP-2026-0808', date: '2026-08-04', reportDate: '2026-08-04', centralId: 'cnt_este', centralName: 'Central Este', serviceNumber: '212-555-0340', technician: 'Ing. Luis Fernández', issueType: 'Puerto Flapping en DSLAM', cable: 'DSLAM-CAB-02', grupo: 'Conmutación', claveCode: 'C-02', status: 'in_progress', mttrHours: 1.0, workGroupId: 'grp_conm' },
  { id: 'rep_010', ticketCode: 'REP-2026-0809', date: '2026-08-04', reportDate: '2026-08-02', centralId: 'cnt_centro', centralName: 'Central Fibra Centro', serviceNumber: '212-555-0811', technician: 'Téc. Andrés Silva', issueType: 'Divisor Splitter FTTH dañado', cable: 'FTTH-SPLIT-16', grupo: 'Banda Ancha', claveCode: 'C-03', status: 'resolved', mttrHours: 1.4, workGroupId: 'grp_broad' },
  { id: 'rep_014', ticketCode: 'REP-2026-0810', date: '2026-08-04', reportDate: '2026-08-04', centralId: 'cnt_oeste', centralName: 'Central Digital Oeste', serviceNumber: '212-555-0712', technician: 'Ing. Carlos Mendoza', issueType: 'Restablecimiento Par Secundario', cable: 'CU-100 Oeste', grupo: 'Ingeniería Exterior', claveCode: 'C-01', status: 'resolved', mttrHours: 1.8, workGroupId: 'grp_ing_ext' },

  // July 2026
  { id: 'rep_011', ticketCode: 'REP-2026-0710', date: '2026-07-05', reportDate: '2026-07-05', centralId: 'cnt_metro', centralName: 'Central Metropolitana', serviceNumber: '212-555-0101', technician: 'Ing. Carlos Mendoza', issueType: 'Reemplazo de latiguillo óptico', cable: 'FO-01 Alimentador Metro', grupo: 'Transmisión', claveCode: 'C-01', status: 'resolved', mttrHours: 1.2, workGroupId: 'grp_trans' },
  { id: 'rep_012', ticketCode: 'REP-2026-0711', date: '2026-07-12', reportDate: '2026-06-28', centralId: 'cnt_sur', centralName: 'Central Sur', serviceNumber: '212-555-0550', technician: 'Téc. Javier Ortiz', issueType: 'Revisión de fusible Batería', cable: 'PW-RECT-02', grupo: 'Energía', claveCode: 'C-05', status: 'resolved', mttrHours: 2.0, workGroupId: 'grp_ener' },
  { id: 'rep_013', ticketCode: 'REP-2026-0720', date: '2026-07-20', reportDate: '2026-07-20', centralId: 'cnt_norte', centralName: 'Central Norte (Tele)', serviceNumber: '212-555-0909', technician: 'Téc. Roberto Gómez', issueType: 'Mantenimiento preventivo OLT', cable: 'CABLE-GPON-04', grupo: 'Banda Ancha', claveCode: 'C-02', status: 'resolved', mttrHours: 1.5, workGroupId: 'grp_broad' }
];

const REPAIR_RECORDS_KEY = 'telecom_repair_records_v1';
const REPAIR_MAPPING_KEY = 'telecom_repair_mapping_v1';
const CUSTOM_TABLES_KEY = 'telecom_custom_tables_v1';

export function loadRepairRecords(userEmail?: string): RepairRecord[] {
  try {
    const key = getStorageKey(REPAIR_RECORDS_KEY, userEmail);
    const raw = localStorage.getItem(key);
    if (!raw) {
      saveRepairRecords(INITIAL_REPAIR_RECORDS, userEmail);
      return INITIAL_REPAIR_RECORDS;
    }
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_REPAIR_RECORDS;
  }
}

export function saveRepairRecords(records: RepairRecord[], userEmail?: string): void {
  try {
    const key = getStorageKey(REPAIR_RECORDS_KEY, userEmail);
    localStorage.setItem(key, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save repair records', e);
  }
}

export function loadCustomTables(userEmail?: string): CustomTableSchema[] {
  try {
    const key = getStorageKey(CUSTOM_TABLES_KEY, userEmail);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveCustomTables(tables: CustomTableSchema[], userEmail?: string): void {
  try {
    const key = getStorageKey(CUSTOM_TABLES_KEY, userEmail);
    localStorage.setItem(key, JSON.stringify(tables));
  } catch (e) {
    console.error('Failed to save custom tables', e);
  }
}

export function loadRepairColumnMapping(userEmail?: string): RepairColumnMapping {
  const defaultMapping: RepairColumnMapping = {
    dateCol: 'Fecha',
    reportDateCol: 'Fecha Reporte',
    centralCol: 'Central',
    serviceCol: 'Servicio',
    ticketCol: 'Ticket',
    technicianCol: 'Técnico',
    cableCol: 'Cable',
    grupoCol: 'Grupo',
    claveCol: 'Clave',
    issueCol: 'Cable',
    statusCol: 'Grupo',
    mttrCol: 'MTTR',
    startRow: 2
  };
  try {
    const key = getStorageKey(REPAIR_MAPPING_KEY, userEmail);
    const raw = localStorage.getItem(key);
    if (!raw) {
      return defaultMapping;
    }
    return { ...defaultMapping, ...JSON.parse(raw) };
  } catch (e) {
    return defaultMapping;
  }
}

export function saveRepairColumnMapping(mapping: RepairColumnMapping, userEmail?: string): void {
  try {
    const key = getStorageKey(REPAIR_MAPPING_KEY, userEmail);
    localStorage.setItem(key, JSON.stringify(mapping));
  } catch (e) {
    console.error('Failed to save repair mapping', e);
  }
}

export function resetToDefaultData(userEmail?: string): {
  centrales: Central[];
  workGroups: WorkGroup[];
  reports: DailyReport[];
  repairRecords: RepairRecord[];
  customTables: CustomTableSchema[];
} {
  const seedReports = generateSeedDailyReports();
  saveCentrales(INITIAL_CENTRALES, userEmail);
  saveWorkGroups(INITIAL_WORK_GROUPS, userEmail);
  saveReports(seedReports, userEmail);
  saveRepairRecords(INITIAL_REPAIR_RECORDS, userEmail);
  saveCustomTables([], userEmail);
  return {
    centrales: INITIAL_CENTRALES,
    workGroups: INITIAL_WORK_GROUPS,
    reports: seedReports,
    repairRecords: INITIAL_REPAIR_RECORDS,
    customTables: []
  };
}
