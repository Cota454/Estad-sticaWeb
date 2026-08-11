import { ZoneConfig, CableClassificationRules, IpCableExcelParseResult } from '../types/ipCablesTypes';

const ZONES_STORAGE_KEY = 'telecomstat_ip_zones_v1';
const CABLE_RULES_STORAGE_KEY = 'telecomstat_cable_rules_v1';
const PARSED_DATA_STORAGE_KEY = 'telecomstat_ip_parsed_data_v1';

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

export function loadParsedIpData(): IpCableExcelParseResult | null {
  try {
    const raw = localStorage.getItem(PARSED_DATA_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading parsed IP data from localStorage', e);
  }
  return null;
}

export function saveParsedIpData(data: IpCableExcelParseResult): void {
  try {
    localStorage.setItem(PARSED_DATA_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving parsed IP data to localStorage', e);
  }
}

export function clearParsedIpData(): void {
  try {
    localStorage.removeItem(PARSED_DATA_STORAGE_KEY);
  } catch (e) {
    console.error('Error clearing parsed IP data from localStorage', e);
  }
}
