import { Central, WorkGroup, DailyReport } from '../types';
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

export function loadCentrales(): Central[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CENTRALES);
    if (!raw) {
      saveCentrales(INITIAL_CENTRALES);
      return INITIAL_CENTRALES;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load centrales from localStorage', e);
    return INITIAL_CENTRALES;
  }
}

export function saveCentrales(centrales: Central[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CENTRALES, JSON.stringify(centrales));
  } catch (e) {
    console.error('Failed to save centrales', e);
  }
}

export function loadWorkGroups(): WorkGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WORK_GROUPS);
    if (!raw) {
      saveWorkGroups(INITIAL_WORK_GROUPS);
      return INITIAL_WORK_GROUPS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load workgroups from localStorage', e);
    return INITIAL_WORK_GROUPS;
  }
}

export function saveWorkGroups(groups: WorkGroup[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.WORK_GROUPS, JSON.stringify(groups));
  } catch (e) {
    console.error('Failed to save workgroups', e);
  }
}

export function loadReports(): DailyReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.REPORTS);
    if (!raw) {
      const seed = generateSeedDailyReports();
      saveReports(seed);
      return seed;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load reports from localStorage', e);
    const seed = generateSeedDailyReports();
    return seed;
  }
}

export function saveReports(reports: DailyReport[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reports));
  } catch (e) {
    console.error('Failed to save reports', e);
  }
}

export function resetToDefaultData(): { centrales: Central[]; workGroups: WorkGroup[]; reports: DailyReport[] } {
  const seedReports = generateSeedDailyReports();
  saveCentrales(INITIAL_CENTRALES);
  saveWorkGroups(INITIAL_WORK_GROUPS);
  saveReports(seedReports);
  return {
    centrales: INITIAL_CENTRALES,
    workGroups: INITIAL_WORK_GROUPS,
    reports: seedReports
  };
}
