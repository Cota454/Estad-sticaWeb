import {
  CentroTelefonicoConfig,
  DEFAULT_CENTROS_TELEFONICOS,
  IndicadorPlanConfig,
  DEFAULT_PLANES_CALIDAD,
  QualityDailyRecord,
  QualityCustomization,
  DEFAULT_QUALITY_COLUMN_NAMES,
  DEFAULT_QUALITY_FORMULAS
} from '../types/qualityIndicators';
import { getIdbItem, setIdbItem } from './indexedDbStorage';

const STORAGE_KEYS = {
  CENTROS: 'quality_centros_telefonicos_v1',
  PLANES: 'quality_planes_calidad_v1',
  RECORDS: 'quality_daily_records_v1',
  CUSTOMIZATION: 'quality_customization_v1',
  TEMP_FILES: 'quality_temp_files_cache_v1'
};

export function loadQualityCustomization(): QualityCustomization {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOMIZATION);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          columnNames: { ...DEFAULT_QUALITY_COLUMN_NAMES, ...(parsed.columnNames || {}) },
          formulas: { ...DEFAULT_QUALITY_FORMULAS, ...(parsed.formulas || {}) }
        };
      }
    }
  } catch (err) {
    console.warn('Error reading quality customization from localStorage:', err);
  }
  return {
    columnNames: DEFAULT_QUALITY_COLUMN_NAMES,
    formulas: DEFAULT_QUALITY_FORMULAS
  };
}

export function saveQualityCustomization(customization: QualityCustomization): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOMIZATION, JSON.stringify(customization));
    setIdbItem(STORAGE_KEYS.CUSTOMIZATION, customization).catch(() => {});
  } catch (err) {
    console.error('Error saving quality customization:', err);
  }
}

export function loadCentrosTelefonicos(): CentroTelefonicoConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CENTROS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading centros telefonicos from localStorage:', err);
  }
  return DEFAULT_CENTROS_TELEFONICOS;
}

export function saveCentrosTelefonicos(centros: CentroTelefonicoConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CENTROS, JSON.stringify(centros));
    setIdbItem(STORAGE_KEYS.CENTROS, centros).catch(() => {});
  } catch (err) {
    console.error('Error saving centros telefonicos:', err);
  }
}

export function loadPlanesCalidad(): Record<string, IndicadorPlanConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PLANES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return { ...DEFAULT_PLANES_CALIDAD, ...parsed };
      }
    }
  } catch (err) {
    console.warn('Error reading planes calidad from localStorage:', err);
  }
  return DEFAULT_PLANES_CALIDAD;
}

export function savePlanesCalidad(planes: Record<string, IndicadorPlanConfig>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PLANES, JSON.stringify(planes));
    setIdbItem(STORAGE_KEYS.PLANES, planes).catch(() => {});
  } catch (err) {
    console.error('Error saving planes calidad:', err);
  }
}

export function loadQualityDailyRecords(): QualityDailyRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECORDS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading quality daily records from localStorage:', err);
  }
  return [];
}

export async function loadQualityDailyRecordsAsync(): Promise<QualityDailyRecord[]> {
  try {
    const fromIdb = await getIdbItem<QualityDailyRecord[]>(STORAGE_KEYS.RECORDS);
    if (fromIdb && Array.isArray(fromIdb) && fromIdb.length > 0) {
      return fromIdb;
    }
  } catch (err) {
    console.warn('Error reading quality daily records from IndexedDB:', err);
  }
  return loadQualityDailyRecords();
}

export function saveQualityDailyRecord(record: QualityDailyRecord): QualityDailyRecord[] {
  const current = loadQualityDailyRecords();
  // If record for same date already exists, update it, else append
  const existingIdx = current.findIndex(r => r.date === record.date);
  let updated: QualityDailyRecord[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = record;
  } else {
    updated = [record, ...current];
  }

  // Sort by date descending
  updated.sort((a, b) => b.date.localeCompare(a.date));

  try {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(updated.slice(0, 50)));
  } catch {
    // If quota exceeded in localStorage, save to IndexedDB
  }
  setIdbItem(STORAGE_KEYS.RECORDS, updated).catch(err => {
    console.warn('Error saving quality daily records to IndexedDB:', err);
  });

  return updated;
}

export function deleteQualityDailyRecord(recordId: string): QualityDailyRecord[] {
  const current = loadQualityDailyRecords();
  const updated = current.filter(r => r.id !== recordId);
  try {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(updated));
  } catch {
    // Ignore
  }
  setIdbItem(STORAGE_KEYS.RECORDS, updated).catch(() => {});
  return updated;
}
