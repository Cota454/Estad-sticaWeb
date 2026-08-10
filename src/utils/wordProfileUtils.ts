import { WordReportProfile, WordReportSectionConfig, WordReportSectionKey } from '../types';

export interface CatalogTableOption {
  key: WordReportSectionKey;
  title: string;
  moduleName: string;
  description: string;
  defaultNotes: string;
  hasTable: boolean;
  hasChart: boolean;
}

export const WEB_CATALOG_TABLES: CatalogTableOption[] = [
  {
    key: 'sec1_tech',
    title: 'Reportes por Central y % respecto a la Técnica Instalada',
    moduleName: 'Módulo 1: Análisis de Reporte',
    description: 'Tabla de averías por central en relación con las líneas/puertos instalados.',
    defaultNotes: 'Esta sección analiza el número total de averías reportadas por central telefónica en relación con la capacidad técnica de líneas y puertos instalados.',
    hasTable: true,
    hasChart: true
  },
  {
    key: 'sec2_same_period',
    title: 'Reportes vs Reparadas en el Mismo Período',
    moduleName: 'Módulo 1: Análisis de Reporte',
    description: 'Tabla comparativa de averías ingresadas, resueltas y pendientes.',
    defaultNotes: 'Contiene la evaluación de averías atendidas en el mismo período de ingreso y el acumulado histórico de soluciones.',
    hasTable: true,
    hasChart: true
  },
  {
    key: 'sec3_daily_month',
    title: 'Evolución Diaria Gráfica por Mes',
    moduleName: 'Módulo 1: Análisis de Reporte',
    description: 'Comportamiento diario de averías reportadas vs reparadas.',
    defaultNotes: 'Muestra el comportamiento diario de averías e ingresos con su representación gráfica mensual.',
    hasTable: true,
    hasChart: true
  },
  {
    key: 'sec4_daily_groups',
    title: 'Evolución Diaria por Grupos de Trabajo (Brigadas)',
    moduleName: 'Módulo 1: Análisis de Reporte',
    description: 'Desglose de carga operativa y soluciones por grupo técnico.',
    defaultNotes: 'Desglose detallado de la carga operativa diaria atendida por cada brigada y grupo técnico de telecomunicaciones.',
    hasTable: true,
    hasChart: true
  },
  {
    key: 'sec5_mttr',
    title: 'Tiempo Promedio de Respuesta (MTTR en Horas) y Reparaciones',
    moduleName: 'Módulo 3: Análisis de Reparaciones',
    description: 'Matriz de MTTR (horas) y cantidad de soluciones por central y grupo.',
    defaultNotes: 'Detalle del MTTR expresado en horas junto con la cantidad de reparaciones ejecutadas por central y grupo.',
    hasTable: true,
    hasChart: true
  },
  {
    key: 'sec6_claves',
    title: 'Incidencia de Claves de Falla (por Central y por Grupo)',
    moduleName: 'Módulo 3: Análisis de Reparaciones',
    description: 'Ranking y frecuencia de las principales claves de falla de red.',
    defaultNotes: 'Cuadro de frecuencias y porcentajes de recurrencia de las principales claves de falla por central telefónica y grupo asignado.',
    hasTable: true,
    hasChart: true
  },
  {
    key: 'sec7_repetidos',
    title: 'Análisis de Servicios Repetidos (Reincidencias)',
    moduleName: 'Módulo 3: Análisis de Reparaciones',
    description: 'Detección de folios reincidentes (Numéricos y Alfanuméricos).',
    defaultNotes: 'Detección automática de folios reincidentes dentro del período, clasificados en Servicios Numéricos y Alfanuméricos.',
    hasTable: true,
    hasChart: false
  }
];

export const DEFAULT_WORD_SECTIONS: WordReportSectionConfig[] = [
  {
    id: 'sec1',
    key: 'sec1_tech',
    title: 'Sección 1. Reportes por Central y % respecto a la Técnica Instalada',
    enabled: true,
    includeTables: true,
    includeCharts: true,
    customNotes: 'Esta sección analiza el número total de averías reportadas por central telefónica en relación con la capacidad técnica de líneas y puertos instalados.'
  },
  {
    id: 'sec2',
    key: 'sec2_same_period',
    title: 'Sección 2. Reportes vs Reparadas en el Mismo Período',
    enabled: true,
    includeTables: true,
    includeCharts: true,
    customNotes: 'Contiene la evaluación de averías atendidas en el mismo período de ingreso (Tabla 2) y el acumulado histórico de soluciones (Tabla 3).'
  },
  {
    id: 'sec3',
    key: 'sec3_daily_month',
    title: 'Sección 3. Evolución Diaria Gráfica por Mes',
    enabled: true,
    includeTables: true,
    includeCharts: true,
    customNotes: 'Muestra la tabla de comportamiento diario de averías e ingresos con su representación gráfica mensual.'
  },
  {
    id: 'sec4',
    key: 'sec4_daily_groups',
    title: 'Sección 4. Evolución Diaria por Grupos de Trabajo',
    enabled: true,
    includeTables: true,
    includeCharts: true,
    customNotes: 'Desglose detallado de la carga operativa diaria atendida por cada brigada y grupo técnico de telecomunicaciones.'
  },
  {
    id: 'sec5',
    key: 'sec5_mttr',
    title: 'Sección 5. Tiempo Promedio de Respuesta (MTTR en Horas) y Volumen de Reparaciones',
    enabled: true,
    includeTables: true,
    includeCharts: true,
    customNotes: 'Detalle del MTTR expresado en horas junto con la cantidad de reparaciones ejecutadas por central y grupo. Incluye fila y columna de Promedio / Total.'
  },
  {
    id: 'sec6',
    key: 'sec6_claves',
    title: 'Sección 6. Incidencia de Claves de Falla (por Central y por Grupo)',
    enabled: true,
    includeTables: true,
    includeCharts: true,
    customNotes: 'Cuadro de frecuencias y porcentajes de recurrencia de las principales claves de falla por central telefónica y grupo asignado.'
  },
  {
    id: 'sec7',
    key: 'sec7_repetidos',
    title: 'Sección 7. Análisis de Servicios Repetidos (Reincidencias Numéricas y Alfanuméricas)',
    enabled: true,
    includeTables: true,
    includeCharts: true,
    customNotes: 'Detección automática de folios reincidentes dentro del período, clasificados en dos tablas independientes: Servicios Numéricos y Servicios Alfanuméricos/Especiales.'
  }
];

export const DEFAULT_WORD_PROFILES: WordReportProfile[] = [
  {
    id: 'prof_oficial_general',
    name: 'Informe General Completo (Oficial NOC)',
    description: 'Documento Word integral con las 7 secciones técnicas, tablas completas y gráficas estadísticas.',
    fileNamePrefix: 'ESTADISTICA_GENERAL_NOC_CTA',
    documentTitle: 'INFORME TÉCNICO OFICIAL DE ESTADÍSTICAS Y OPERACIONES NOC',
    departmentName: 'DEPARTAMENTO DE OPERACIONES Y MANTENIMIENTO DE RED',
    sections: JSON.parse(JSON.stringify(DEFAULT_WORD_SECTIONS)),
    createdDate: new Date().toISOString()
  },
  {
    id: 'prof_operativo_grupos',
    name: 'Informe Operativo de Grupos y MTTR',
    description: 'Enfocado en el desempeño de brigadas, MTTR en horas y capacidad instalada (Secciones 1, 4 y 5).',
    fileNamePrefix: 'INFORME_OPERATIVO_GRUPOS_MTTR',
    documentTitle: 'INFORME OPERATIVO DE BRIGADAS Y TIEMPO MEDIO DE SOLUCIÓN',
    departmentName: 'GESTIÓN OPERATIVA DE GRUPOS DE TRABAJO',
    sections: DEFAULT_WORD_SECTIONS.map(s => ({
      ...s,
      enabled: ['sec1_tech', 'sec4_daily_groups', 'sec5_mttr'].includes(s.key)
    })),
    createdDate: new Date().toISOString()
  },
  {
    id: 'prof_incidencias_claves',
    name: 'Informe de Claves de Falla y Reincidencias',
    description: 'Especializado en análisis de claves más repetidas y servicios con múltiples reportes (Secciones 6 y 7).',
    fileNamePrefix: 'INFORME_CLAVES_Y_REPETIDOS',
    documentTitle: 'ANÁLISIS DE REINCIDENCIAS Y CLAVES DE FALLA EN RED',
    departmentName: 'CONTROL DE CALIDAD Y AUDITORÍA TÉCNICA DE RED',
    sections: DEFAULT_WORD_SECTIONS.map(s => ({
      ...s,
      enabled: ['sec1_tech', 'sec6_claves', 'sec7_repetidos'].includes(s.key)
    })),
    createdDate: new Date().toISOString()
  }
];

const STORAGE_KEY = 'word_report_profiles_v1';

export function loadWordReportProfiles(): WordReportProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WORD_PROFILES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_WORD_PROFILES;
  } catch (err) {
    console.warn('Error loading word report profiles:', err);
    return DEFAULT_WORD_PROFILES;
  }
}

export function saveWordReportProfiles(profiles: WordReportProfile[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch (err) {
    console.error('Error saving word report profiles:', err);
  }
}

export function createNewWordProfile(
  name: string,
  description?: string,
  selectedKeys?: WordReportSectionKey[]
): WordReportProfile {
  let initialSections: WordReportSectionConfig[] = [];

  if (selectedKeys && selectedKeys.length > 0) {
    initialSections = selectedKeys.map((key, idx) => {
      const cat = WEB_CATALOG_TABLES.find(c => c.key === key) || WEB_CATALOG_TABLES[0];
      return {
        id: `sec_custom_${Date.now()}_${idx}`,
        key: cat.key,
        title: `Sección ${idx + 1}. ${cat.title}`,
        enabled: true,
        includeTables: cat.hasTable,
        includeCharts: cat.hasChart,
        customNotes: cat.defaultNotes
      };
    });
  } else {
    initialSections = JSON.parse(JSON.stringify(DEFAULT_WORD_SECTIONS));
  }

  const newProfile: WordReportProfile = {
    id: `prof_custom_${Date.now()}`,
    name: name || 'Nuevo Documento Word Personalizado',
    description: description || 'Plantilla de exportación Word a medida.',
    fileNamePrefix: 'NUEVO_INFORME_WORD_PERSONALIZADO',
    documentTitle: 'INFORME OPERATIVO A MEDIDA NOC',
    departmentName: 'GERENCIA TÉCNICA DE TELECOMUNICACIONES',
    sections: initialSections,
    createdDate: new Date().toISOString()
  };
  return newProfile;
}

