import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx-js-style';
import {
  Wrench,
  PlusCircle,
  Filter,
  Search,
  Calendar,
  Building2,
  Users,
  Cable,
  Download,
  Copy,
  Check,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  X,
  Layers,
  MapPin,
  Sparkles,
  Info,
  LayoutList,
  Table as TableIcon,
  Clipboard,
  Hash,
  RefreshCw,
  ListTodo,
  CheckCheck,
  Upload
} from 'lucide-react';

import {
  IpCableExcelParseResult,
  IpCableRow,
  CablePendingTask,
  CableTaskServiceDetailRow
} from '../types/ipCablesTypes';
import { Central, WorkGroup } from '../types';
import {
  loadCablePendingTasks,
  saveCablePendingTasks
} from '../utils/ipCablesStorage';
import { getDemoraDays } from './AnalisisIpView';
import { CableBatchTasksImportModal } from './CableBatchTasksImportModal';
import { CableAfectacionesModal } from './CableAfectacionesModal';
import { saveXlsxWorkbook } from '../utils/fileDownloadHelper';

// Palabras clave típicas de encabezados de columnas de Excel que se descartan automáticamente
const EXCEL_HEADER_WORDS = new Set([
  'SERVICIO', 'SERVICIOS', 'TELEFONO', 'TELEFONOS', 'TELÉFONO', 'TELÉFONOS',
  'NUMERO', 'NUMEROS', 'NÚMERO', 'NÚMEROS', 'NRO', 'N°', 'LINEA', 'LINEAS',
  'LÍNEA', 'LÍNEAS', 'ABONADO', 'ABONADOS', 'CLIENTE', 'CLIENTES', 'CABLE', 'PAR',
  'TELEF', 'TLF', 'SERIAL', 'ID', 'CODIGO', 'CÓDIGO'
]);

/**
 * Función robusta para extraer y limpiar números de servicio copiados desde columnas de Excel
 */
export function parseExcelServiceNumbers(input: string): string[] {
  if (!input || typeof input !== 'string') return [];

  const rawLines = input.split(/[\r\n;,]+/);
  const result: string[] = [];
  const seen = new Set<string>();

  for (const rawLine of rawLines) {
    // Si se copió una tabla de Excel con varias columnas separadas por tabulador
    const tokens = rawLine.split(/\t+/);
    for (let token of tokens) {
      token = token.trim();
      if (!token) continue;

      // Quitar fórmulas y comillas de Excel: ="0212000001", "0212000001", '0212000001
      token = token.replace(/^=["']|["']$/g, '').replace(/^['"]+|['"]+$/g, '').trim();
      if (!token) continue;

      // Descartar encabezados
      const upper = token.toUpperCase();
      if (EXCEL_HEADER_WORDS.has(upper)) {
        continue;
      }

      // Si vienen varios números en una misma línea separados por espacios (de 6 a 15 dígitos)
      const subTokens = token.split(/\s+/).filter(Boolean);
      if (subTokens.length > 1 && subTokens.every(st => /^\d{6,15}$/.test(st))) {
        for (const st of subTokens) {
          const cleanSub = st.trim();
          if (cleanSub && !seen.has(cleanSub)) {
            seen.add(cleanSub);
            result.push(cleanSub);
          }
        }
        continue;
      }

      // Si es un número telefónico formateado con guiones o espacios (ej. 0212-345-6789 o 0212 3456789)
      const digitsOnly = token.replace(/[\s\-\.\(\)]/g, '');
      const cleaned = (digitsOnly.length >= 6 && /^\d+$/.test(digitsOnly)) ? digitsOnly : token.toUpperCase();

      if (cleaned && !seen.has(cleaned)) {
        seen.add(cleaned);
        result.push(cleaned);
      }
    }
  }

  return result;
}

/**
 * Extrae de forma insensible a mayúsculas y espacios el valor de una columna del Excel
 */
export function getExcelRawValue(raw: Record<string, any> | undefined, candidates: string[]): string {
  if (!raw) return '';
  const keys = Object.keys(raw);
  for (const cand of candidates) {
    const norm = cand.trim().toUpperCase();
    const foundKey = keys.find(k => k.trim().toUpperCase() === norm);
    if (foundKey && raw[foundKey] !== undefined && raw[foundKey] !== null) {
      const val = String(raw[foundKey]).trim();
      if (val !== '') return val;
    }
  }
  return '';
}

interface CablePendingTasksViewProps {
  excelData: IpCableExcelParseResult | null;
  centrales?: Central[];
  workGroups?: WorkGroup[];
  onFileUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isParsing?: boolean;
}

export const CablePendingTasksView: React.FC<CablePendingTasksViewProps> = ({
  excelData,
  centrales = [],
  workGroups = [],
  onFileUpload,
  isParsing = false
}) => {
  // Tasks state from localStorage
  const [tasks, setTasks] = useState<CablePendingTask[]>(loadCablePendingTasks);

  // View Mode State (Mejora D: Vista Detallada Plana vs Vista Agrupada por Tarea)
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('flat');
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});

  // Filter States
  const [filterCentral, setFilterCentral] = useState<string>('all');
  const [filterGrupo, setFilterGrupo] = useState<string>('all');
  const [filterMes, setFilterMes] = useState<string>('all');
  const [filterAnio, setFilterAnio] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [searchServiceTerm, setSearchServiceTerm] = useState<string>('');

  // Modal State for Add / Edit Task
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<CablePendingTask | null>(null);

  // Form Fields
  const [formCable, setFormCable] = useState<string>('');
  const [formTaskName, setFormTaskName] = useState<string>('');
  const [formTerminalDir, setFormTerminalDir] = useState<string>('');
  const [formStatus, setFormStatus] = useState<'pending' | 'in_progress' | 'completed'>('pending');
  const [formPriority, setFormPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [formServiceInput, setFormServiceInput] = useState<string>('');
  const [selectedServicesSet, setSelectedServicesSet] = useState<Set<string>>(new Set());

  // Form Fields: Afectación Opcional con Rango de Fechas
  const [formHasAfectacion, setFormHasAfectacion] = useState<boolean>(false);
  const [formAfectacionMotivo, setFormAfectacionMotivo] = useState<string>('');
  const [formAfectacionFechaInicio, setFormAfectacionFechaInicio] = useState<string>('');
  const [formAfectacionFechaFin, setFormAfectacionFechaFin] = useState<string>('');

  // Filter Afectaciones
  const [filterAfectacion, setFilterAfectacion] = useState<string>('all');

  // UI Feedback & Cartel de Confirmación para Eliminar Todos los Trabajos
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [pasteFeedbackMessage, setPasteFeedbackMessage] = useState<string>('');
  const [showDeleteAllModal, setShowDeleteAllModal] = useState<boolean>(false);
  const [isDeletingAll, setIsDeletingAll] = useState<boolean>(false);
  const [deleteAllSuccessMsg, setDeleteAllSuccessMsg] = useState<string>('');

  // Modal State para "Ver Todas las Tareas" (Ventana de Resumen y Gestión)
  const [showAllTasksModal, setShowAllTasksModal] = useState<boolean>(false);
  const [modalSearchTerm, setModalSearchTerm] = useState<string>('');
  const [modalFilterAfectacion, setModalFilterAfectacion] = useState<'all' | 'with_afectacion' | 'without_afectacion'>('all');
  const [taskFulfilledSuccessMsg, setTaskFulfilledSuccessMsg] = useState<string>('');

  // Modal State para Carga Masiva desde Excel
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const [batchSuccessMsg, setBatchSuccessMsg] = useState<string>('');

  // Modal State para Gestión Independiente de Afectaciones
  const [showAfectacionesModal, setShowAfectacionesModal] = useState<boolean>(false);

  // Handler al confirmar la carga masiva desde Excel
  const handleBatchImportSuccess = (
    updatedTasks: CablePendingTask[],
    stats: {
      createdCount: number;
      mergedCount: number;
      totalServices: number;
      skippedDuplicatesCount?: number;
      mergedServicesCount?: number;
    }
  ) => {
    handleUpdateTasks(updatedTasks);
    const parts = [
      `¡Carga masiva completada! Se procesaron ${stats.totalServices} registros`
    ];
    if (stats.createdCount > 0) {
      parts.push(`${stats.createdCount} tarea${stats.createdCount === 1 ? '' : 's'} nueva${stats.createdCount === 1 ? '' : 's'}`);
    }
    if (stats.mergedCount > 0) {
      parts.push(`${stats.mergedCount} tarea${stats.mergedCount === 1 ? '' : 's'} consolidada${stats.mergedCount === 1 ? '' : 's'}`);
    }
    if (stats.skippedDuplicatesCount && stats.skippedDuplicatesCount > 0) {
      parts.push(`${stats.skippedDuplicatesCount} filas repetidas filtradas`);
    }

    const msg = parts.join(' • ');
    setBatchSuccessMsg(msg);
    setTimeout(() => setBatchSuccessMsg(''), 7000);
  };

  // Save tasks and update state
  const handleUpdateTasks = (updated: CablePendingTask[]) => {
    setTasks(updated);
    saveCablePendingTasks(updated);
  };

  // Handler para confirmar eliminación de todos los trabajos desde el modal de seguridad
  const handleConfirmDeleteAll = () => {
    setIsDeletingAll(true);
    setTimeout(() => {
      handleUpdateTasks([]);
      setIsDeletingAll(false);
      setShowDeleteAllModal(false);
      setDeleteAllSuccessMsg('Se han eliminado todos los trabajos registrados con éxito.');
      setTimeout(() => setDeleteAllSuccessMsg(''), 4000);
    }, 150);
  };

  // Handler para actualizar tarea desde la ventana de todas las tareas
  const handleEditFromSummaryModal = (task: CablePendingTask) => {
    setShowAllTasksModal(false);
    handleOpenEditModal(task);
  };

  // Handler para eliminar tarea porque ya se cumplió el trabajo
  const handleDeleteFulfilledTask = (task: CablePendingTask) => {
    const isConfirmed = window.confirm(
      `¿Desea eliminar el trabajo "${task.taskName}" del cable "${task.cable}" porque ya se cumplió?\n\nEsta acción quitará la tarea de la lista de pendientes.`
    );
    if (isConfirmed) {
      const updated = tasks.filter(t => t.id !== task.id);
      handleUpdateTasks(updated);
      setTaskFulfilledSuccessMsg(`Se eliminó la tarea cumplida "${task.taskName}" (${task.cable}) con éxito.`);
      setTimeout(() => setTaskFulfilledSuccessMsg(''), 4000);
    }
  };

  // Handler para marcar tarea como cumplida / pendiente alternativamente
  const handleToggleCompleteTask = (task: CablePendingTask) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const updated = tasks.map(t => t.id === task.id ? { ...t, status: newStatus as any, updatedAt: new Date().toISOString() } : t);
    handleUpdateTasks(updated);
    setTaskFulfilledSuccessMsg(
      newStatus === 'completed'
        ? `Tarea "${task.taskName}" marcada como cumplida.`
        : `Tarea "${task.taskName}" reactivada como pendiente.`
    );
    setTimeout(() => setTaskFulfilledSuccessMsg(''), 4000);
  };

  // Métricas para la ventana de Todas las Tareas
  const allTasksMetrics = useMemo(() => {
    const total = tasks.length;
    const withAfectacion = tasks.filter(t => t.hasAfectacion).length;
    const withoutAfectacion = total - withAfectacion;
    const totalServices = tasks.reduce((acc, t) => acc + (t.serviceNumbers?.length || 0), 0);
    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const pending = tasks.filter(t => !t.status || t.status === 'pending').length;

    // Cables involucrados
    const cablesSet = new Set<string>();
    tasks.forEach(t => t.cable && cablesSet.add(t.cable));

    return {
      total,
      withAfectacion,
      withoutAfectacion,
      totalServices,
      completed,
      inProgress,
      pending,
      uniqueCablesCount: cablesSet.size
    };
  }, [tasks]);

  // Lista filtrada de tareas para la ventana modal
  const modalFilteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Filtro por búsqueda
      if (modalSearchTerm.trim()) {
        const q = modalSearchTerm.toLowerCase();
        const matchesCable = t.cable.toLowerCase().includes(q);
        const matchesName = t.taskName.toLowerCase().includes(q);
        const matchesMotivo = (t.afectacionMotivo || '').toLowerCase().includes(q);
        const matchesTerminal = (t.terminalDireccion || '').toLowerCase().includes(q);
        const matchesServices = (t.serviceNumbers || []).some(s => s.toLowerCase().includes(q));
        if (!matchesCable && !matchesName && !matchesMotivo && !matchesTerminal && !matchesServices) {
          return false;
        }
      }
      // Filtro por afectación
      if (modalFilterAfectacion === 'with_afectacion' && !t.hasAfectacion) return false;
      if (modalFilterAfectacion === 'without_afectacion' && t.hasAfectacion) return false;
      return true;
    });
  }, [tasks, modalSearchTerm, modalFilterAfectacion]);

  // -------------------------------------------------------------
  // Quick Date Range Handlers (validation: start <= end)
  // -------------------------------------------------------------
  const handleStartDateChange = (val: string) => {
    setFilterStartDate(val);
    if (val && filterEndDate && val > filterEndDate) {
      setFilterEndDate(val);
    }
  };

  const handleEndDateChange = (val: string) => {
    setFilterEndDate(val);
    if (val && filterStartDate && val < filterStartDate) {
      setFilterStartDate(val);
    }
  };

  const handleClearDateRange = () => {
    setFilterStartDate('');
    setFilterEndDate('');
  };

  const handleQuickDatePreset = (preset: 'today' | '7days' | 'thisMonth') => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    if (preset === 'today') {
      setFilterStartDate(todayStr);
      setFilterEndDate(todayStr);
    } else if (preset === '7days') {
      const d7 = new Date();
      d7.setDate(d7.getDate() - 6);
      setFilterStartDate(d7.toISOString().split('T')[0]);
      setFilterEndDate(todayStr);
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setFilterStartDate(firstDay.toISOString().split('T')[0]);
      setFilterEndDate(todayStr);
    }
  };

  // Handlers for Form Afectación Date Range
  const handleAfectacionStartDateChange = (val: string) => {
    setFormAfectacionFechaInicio(val);
    if (val && formAfectacionFechaFin && val > formAfectacionFechaFin) {
      setFormAfectacionFechaFin(val);
    }
  };

  const handleAfectacionEndDateChange = (val: string) => {
    setFormAfectacionFechaFin(val);
    if (val && formAfectacionFechaInicio && val < formAfectacionFechaInicio) {
      setFormAfectacionFechaInicio(val);
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setFilterCentral('all');
    setFilterGrupo('all');
    setFilterMes('all');
    setFilterAnio('all');
    setFilterAfectacion('all');
    setFilterStartDate('');
    setFilterEndDate('');
    setSearchServiceTerm('');
  };

  const hasActiveFilters =
    filterCentral !== 'all' ||
    filterGrupo !== 'all' ||
    filterMes !== 'all' ||
    filterAnio !== 'all' ||
    filterAfectacion !== 'all' ||
    filterStartDate !== '' ||
    filterEndDate !== '' ||
    searchServiceTerm.trim() !== '';

  // -------------------------------------------------------------
  // Map of Consolidated Rows for Quick Lookup
  // -------------------------------------------------------------
  const excelServicesMap = useMemo(() => {
    const map = new Map<string, IpCableRow>();
    if (!excelData) return map;
    excelData.consolidatedRows.forEach(row => {
      const key = (row.servicio || '').toString().trim().toUpperCase();
      if (key) {
        map.set(key, row);
        const digits = key.replace(/\D/g, '');
        if (digits && !map.has(digits)) {
          map.set(digits, row);
        }
        const noLeadingZero = digits.replace(/^0+/, '');
        if (noLeadingZero && !map.has(noLeadingZero)) {
          map.set(noLeadingZero, row);
        }
      }

      // También mapear por columna ASOCIADO / TELEFONO si viene en el Excel
      const raw = row.rawRowData || {};
      const asoc = (getExcelRawValue(raw, ['ASOCIADO', 'TELEFONO ASOCIADO', 'TELÉFONO ASOCIADO', 'TELEFONO', 'TELÉFONO', 'ABONADO']) || '').toString().trim().toUpperCase();
      if (asoc && asoc !== '-') {
        if (!map.has(asoc)) map.set(asoc, row);
        const asocDigits = asoc.replace(/\D/g, '');
        if (asocDigits && !map.has(asocDigits)) map.set(asocDigits, row);
      }
    });
    return map;
  }, [excelData]);

  // Unique lists for filter dropdowns
  const availableCentrales = useMemo(() => {
    const set = new Set<string>();
    if (excelData?.uniqueCentrales) {
      excelData.uniqueCentrales.forEach(c => c && set.add(c));
    }
    centrales.forEach(c => c.name && set.add(c.name));
    return Array.from(set).sort();
  }, [excelData, centrales]);

  const availableGrupos = useMemo(() => {
    const set = new Set<string>();
    if (excelData?.uniqueGroups) {
      excelData.uniqueGroups.forEach(g => g && set.add(g));
    }
    workGroups.forEach(g => g.name && set.add(g.name));
    return Array.from(set).sort();
  }, [excelData, workGroups]);

  const availableYears = useMemo(() => {
    const set = new Set<number>();
    const currentYear = new Date().getFullYear();
    set.add(currentYear);
    if (excelData?.consolidatedRows) {
      excelData.consolidatedRows.forEach(row => {
        if (row.fechaReporte && row.fechaReporte.length >= 4) {
          const y = parseInt(row.fechaReporte.slice(0, 4), 10);
          if (!isNaN(y)) set.add(y);
        }
      });
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [excelData]);

  // Lista de motivos de afectación para el filtro
  const availableAfectaciones = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => {
      if (t.hasAfectacion && t.afectacionMotivo) {
        set.add(t.afectacionMotivo.trim());
      }
    });
    return Array.from(set).sort();
  }, [tasks]);

  // -------------------------------------------------------------
  // Denormalize Tasks into Full Detail Service Rows
  // CRÍTICO: En la tabla solo se muestran los que están reportados en el Excel.
  // El resto se omite por completo (no mostrarlo).
  // Cada vez que se suba un nuevo Excel, esta tabla se actualiza automáticamente.
  // -------------------------------------------------------------
  const allDetailRows = useMemo<CableTaskServiceDetailRow[]>(() => {
    const rows: CableTaskServiceDetailRow[] = [];
    if (!excelData || !excelData.consolidatedRows || excelData.consolidatedRows.length === 0) {
      return rows;
    }

    tasks.forEach(task => {
      const hasSpecificServices = Array.isArray(task.serviceNumbers) && task.serviceNumbers.length > 0;

      if (hasSpecificServices) {
        task.serviceNumbers.forEach((srvNum, idx) => {
          const sKey = (srvNum || '').toString().trim().toUpperCase();
          if (!sKey || sKey === 'SIN_SERVICIO') return;

          let matchedRow = excelServicesMap.get(sKey);
          if (!matchedRow) {
            const digits = sKey.replace(/\D/g, '');
            if (digits) {
              matchedRow = excelServicesMap.get(digits) || excelServicesMap.get(digits.replace(/^0+/, ''));
            }
          }

          // REGLA SOLICITADA POR EL USUARIO:
          // "En la tabla solo me vas a mostrar los que están reportados el resto debes de omitirlo, no mostrarlo."
          if (!matchedRow) {
            return;
          }

          const rowId = `${task.id}-${sKey}-${idx}`;
          const raw = matchedRow.rawRowData || {};

          // 1. Asociado: del Excel subido
          const associated = getExcelRawValue(raw, ['ASOCIADO', 'TELEFONO ASOCIADO', 'TELÉFONO ASOCIADO', 'TELEFONO', 'TELÉFONO', 'ABONADO']) || '-';

          // 2. Cable P: del Excel subido
          const cableP = matchedRow.cableP || getExcelRawValue(raw, ['CABLE P', 'CABLE_P', 'CABLE PRIMARIO', 'CABLE_PRIMARIO']) || task.cable || '-';

          // 3. Par P: del Excel subido
          const parP = matchedRow.parP || getExcelRawValue(raw, ['PAR P', 'PAR_P', 'PAR PRIMARIO', 'PAR_PRIMARIO']) || '-';

          // 4. Cable S: del Excel subido
          const cableS = matchedRow.cableS || getExcelRawValue(raw, ['CABLE S', 'CABLE_S', 'CABLE SECUNDARIO', 'CABLE_SECUNDARIO']) || '-';

          // 5. Par S: del Excel subido
          const parS = matchedRow.parS || getExcelRawValue(raw, ['PAR S', 'PAR_S', 'PAR SECUNDARIO', 'PAR_SECUNDARIO']) || '-';

          // 6. Fecha Reporte: del Excel subido
          const fechaReporte = matchedRow.fechaReporte || getExcelRawValue(raw, ['FECHA REPORTE', 'FECHA DE REPORTE', 'FECHA']) || '-';

          // 7. Grupo: del Excel subido
          const grupo = matchedRow.grupo || getExcelRawValue(raw, ['GRUPO', 'GRUPO DE TRABAJO', 'GRUPO_TRABAJO']) || '-';

          // 8. Demora en Días: calculado con la fecha del Excel
          const demoraEnDias = getDemoraDays(matchedRow);

          // 9. Central Telefónica: del Excel subido
          const central = matchedRow.central || getExcelRawValue(raw, ['CENTRAL TELEFONICA', 'CENTRAL TELEFÓNICA', 'CENTRAL']) || '-';

          // 10. Terminal: los datos están en el Excel en la columna llamada TERMINAL
          let terminalVal = getExcelRawValue(raw, ['TERMINAL', 'TERM', 'CAJA TERMINAL', 'CAJA']);
          if (!terminalVal && task.terminalDireccion) {
            terminalVal = task.terminalDireccion;
          }
          if (!terminalVal) {
            terminalVal = '-';
          }

          // Afectaciones logic
          let afectacion = '-';
          if (task.hasAfectacion && task.afectacionMotivo) {
            const rowDateStr = (matchedRow.fechaReporte || fechaReporte || '').trim().slice(0, 10);
            const start = task.afectacionFechaInicio || '';
            const end = task.afectacionFechaFin || '';

            let matchesRange = true;
            if (start && end) {
              matchesRange = Boolean(rowDateStr && rowDateStr !== '-' && rowDateStr >= start && rowDateStr <= end);
            } else if (start) {
              matchesRange = Boolean(rowDateStr && rowDateStr !== '-' && rowDateStr >= start);
            } else if (end) {
              matchesRange = Boolean(rowDateStr && rowDateStr !== '-' && rowDateStr <= end);
            }

            if (matchesRange) {
              afectacion = task.afectacionMotivo;
            }
          }

          rows.push({
            id: rowId,
            taskId: task.id,
            taskName: task.taskName,
            servicio: matchedRow.servicio || srvNum,
            asociado: String(associated),
            cableP: String(cableP),
            parP: String(parP),
            cableS: String(cableS),
            parS: String(parS),
            fechaReporte: String(fechaReporte),
            grupo: String(grupo),
            demoraEnDias: typeof demoraEnDias === 'number' ? demoraEnDias : 0,
            central: String(central),
            terminal: terminalVal,
            terminalDireccion: terminalVal,
            afectacion: afectacion,
            status: task.status || 'pending'
          });
        });
      } else if (task.cable && task.cable.trim()) {
        // Si no se asignaron números individuales, buscar los servicios reportados en el Excel para este cable
        const cLower = task.cable.toLowerCase().trim();
        excelData.consolidatedRows.forEach((matchedRow, idx) => {
          const matchP = matchedRow.cableP && matchedRow.cableP.toLowerCase().includes(cLower);
          const matchS = matchedRow.cableS && matchedRow.cableS.toLowerCase().includes(cLower);
          const matchC = matchedRow.cable && matchedRow.cable.toLowerCase().includes(cLower);
          if (matchP || matchS || matchC) {
            const rowId = `${task.id}-${matchedRow.servicio}-${idx}`;
            const raw = matchedRow.rawRowData || {};

            const associated = getExcelRawValue(raw, ['ASOCIADO', 'TELEFONO ASOCIADO', 'TELÉFONO ASOCIADO', 'TELEFONO', 'TELÉFONO', 'ABONADO']) || '-';
            const cableP = matchedRow.cableP || getExcelRawValue(raw, ['CABLE P', 'CABLE_P', 'CABLE PRIMARIO', 'CABLE_PRIMARIO']) || task.cable;
            const parP = matchedRow.parP || getExcelRawValue(raw, ['PAR P', 'PAR_P', 'PAR PRIMARIO', 'PAR_PRIMARIO']) || '-';
            const cableS = matchedRow.cableS || getExcelRawValue(raw, ['CABLE S', 'CABLE_S', 'CABLE SECUNDARIO', 'CABLE_SECUNDARIO']) || '-';
            const parS = matchedRow.parS || getExcelRawValue(raw, ['PAR S', 'PAR_S', 'PAR SECUNDARIO', 'PAR_SECUNDARIO']) || '-';
            const fechaReporte = matchedRow.fechaReporte || getExcelRawValue(raw, ['FECHA REPORTE', 'FECHA DE REPORTE', 'FECHA']) || '-';
            const grupo = matchedRow.grupo || getExcelRawValue(raw, ['GRUPO', 'GRUPO DE TRABAJO', 'GRUPO_TRABAJO']) || '-';
            const demoraEnDias = getDemoraDays(matchedRow);
            const central = matchedRow.central || getExcelRawValue(raw, ['CENTRAL TELEFONICA', 'CENTRAL TELEFÓNICA', 'CENTRAL']) || '-';

            let terminalVal = getExcelRawValue(raw, ['TERMINAL', 'TERM', 'CAJA TERMINAL', 'CAJA']);
            if (!terminalVal && task.terminalDireccion) {
              terminalVal = task.terminalDireccion;
            }
            if (!terminalVal) {
              terminalVal = '-';
            }

            let afectacion = '-';
            if (task.hasAfectacion && task.afectacionMotivo) {
              const rowDateStr = (matchedRow.fechaReporte || fechaReporte || '').trim().slice(0, 10);
              const start = task.afectacionFechaInicio || '';
              const end = task.afectacionFechaFin || '';

              let matchesRange = true;
              if (start && end) {
                matchesRange = Boolean(rowDateStr && rowDateStr !== '-' && rowDateStr >= start && rowDateStr <= end);
              } else if (start) {
                matchesRange = Boolean(rowDateStr && rowDateStr !== '-' && rowDateStr >= start);
              } else if (end) {
                matchesRange = Boolean(rowDateStr && rowDateStr !== '-' && rowDateStr <= end);
              }

              if (matchesRange) {
                afectacion = task.afectacionMotivo;
              }
            }

            rows.push({
              id: rowId,
              taskId: task.id,
              taskName: task.taskName,
              servicio: matchedRow.servicio,
              asociado: String(associated),
              cableP: String(cableP),
              parP: String(parP),
              cableS: String(cableS),
              parS: String(parS),
              fechaReporte: String(fechaReporte),
              grupo: String(grupo),
              demoraEnDias: typeof demoraEnDias === 'number' ? demoraEnDias : 0,
              central: String(central),
              terminal: terminalVal,
              terminalDireccion: terminalVal,
              afectacion: afectacion,
              status: task.status || 'pending'
            });
          }
        });
      }
    });

    return rows;
  }, [tasks, excelServicesMap, excelData]);

  // -------------------------------------------------------------
  // Mejora C: Búsqueda Contextual por Servicio (Task Context Search)
  // "este debe buscar el servicio y además mostrar todos los servicios que están en ese misma Tarea o Trabajo"
  // -------------------------------------------------------------
  const contextSearchInfo = useMemo(() => {
    const term = searchServiceTerm.trim().toLowerCase();
    if (!term) return { matchedTaskIds: new Set<string>(), exactMatchServiceNumbers: new Set<string>() };

    const matchedTaskIds = new Set<string>();
    const exactMatchServiceNumbers = new Set<string>();

    tasks.forEach(task => {
      const hasMatch = (task.serviceNumbers || []).some(s => {
        const sLower = s.toLowerCase();
        if (sLower.includes(term)) {
          exactMatchServiceNumbers.add(s.toUpperCase());
          return true;
        }
        return false;
      });
      if (hasMatch) {
        matchedTaskIds.add(task.id);
      }
    });

    return { matchedTaskIds, exactMatchServiceNumbers };
  }, [tasks, searchServiceTerm]);

  // -------------------------------------------------------------
  // Filtered Rows
  // -------------------------------------------------------------
  const filteredRows = useMemo(() => {
    const term = searchServiceTerm.trim().toLowerCase();

    return allDetailRows.filter(row => {
      // 1. Task-Context Service Search (Mejora C)
      if (term) {
        if (!contextSearchInfo.matchedTaskIds.has(row.taskId)) {
          return false;
        }
      }

      // 2. Central Filter
      if (filterCentral !== 'all' && row.central !== '-' && row.central !== filterCentral) {
        return false;
      }

      // 3. Grupo Filter
      if (filterGrupo !== 'all' && row.grupo !== '-' && row.grupo !== filterGrupo) {
        return false;
      }

      // 4. Date Range Filter (Fecha Reporte)
      if (filterStartDate || filterEndDate) {
        const rowDate = (row.fechaReporte || '').trim().slice(0, 10);
        if (rowDate && rowDate !== '-') {
          if (filterStartDate && rowDate < filterStartDate) return false;
          if (filterEndDate && rowDate > filterEndDate) return false;
        }
      }

      // 5. Month and Year Filter
      if (row.fechaReporte && row.fechaReporte.length >= 7 && row.fechaReporte !== '-') {
        const parts = row.fechaReporte.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);

        if (filterAnio !== 'all' && !isNaN(y) && y !== parseInt(filterAnio, 10)) {
          return false;
        }
        if (filterMes !== 'all' && !isNaN(m) && m !== parseInt(filterMes, 10)) {
          return false;
        }
      }

      // 6. Afectación Filter
      if (filterAfectacion !== 'all') {
        if (filterAfectacion === 'con_afectacion') {
          if (row.afectacion === '-') return false;
        } else if (filterAfectacion === 'sin_afectacion') {
          if (row.afectacion !== '-') return false;
        } else {
          if (row.afectacion.trim().toLowerCase() !== filterAfectacion.trim().toLowerCase()) {
            return false;
          }
        }
      }

      return true;
    });
  }, [allDetailRows, searchServiceTerm, contextSearchInfo, filterCentral, filterGrupo, filterStartDate, filterEndDate, filterAnio, filterMes, filterAfectacion]);

  // -------------------------------------------------------------
  // Mejora B: KPIs Rápidos
  // -------------------------------------------------------------
  const kpis = useMemo(() => {
    const totalTasks = tasks.length;
    const pendingTasks = tasks.filter(t => t.status === 'pending' || !t.status).length;
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;

    // Servicios reportados activos (exclusivamente los que aparecen en la tabla desde el Excel)
    const reportedServicesSet = new Set<string>();
    const allServicesSet = new Set<string>();
    const cableImpactMap: Record<string, number> = {};

    allDetailRows.forEach(r => {
      reportedServicesSet.add(r.servicio);
      const c = r.cableP || 'SIN CABLE';
      cableImpactMap[c] = (cableImpactMap[c] || 0) + 1;
    });

    tasks.forEach(t => {
      (t.serviceNumbers || []).forEach(s => allServicesSet.add(s));
    });

    let topImpactCable = '-';
    let topImpactCount = 0;
    Object.entries(cableImpactMap).forEach(([cable, count]) => {
      if (count > topImpactCount) {
        topImpactCount = count;
        topImpactCable = cable;
      }
    });

    let maxDemora = 0;
    let oldestService = '-';
    filteredRows.forEach(r => {
      if (r.demoraEnDias > maxDemora) {
        maxDemora = r.demoraEnDias;
        oldestService = r.servicio;
      }
    });

    return {
      totalTasks,
      pendingTasks,
      inProgressTasks,
      completedTasks,
      totalServicesAffected: reportedServicesSet.size,
      totalServicesReported: reportedServicesSet.size,
      totalServicesAssigned: allServicesSet.size,
      topImpactCable,
      topImpactCount,
      maxDemora,
      oldestService
    };
  }, [tasks, allDetailRows, filteredRows]);

  // -------------------------------------------------------------
  // Grouped Tasks Map for Acordeón View (Mejora D)
  // -------------------------------------------------------------
  const groupedTasks = useMemo(() => {
    const taskMap = new Map<string, { task: CablePendingTask; rows: CableTaskServiceDetailRow[] }>();

    filteredRows.forEach(r => {
      if (!taskMap.has(r.taskId)) {
        const foundTask = tasks.find(t => t.id === r.taskId);
        if (foundTask) {
          taskMap.set(r.taskId, { task: foundTask, rows: [] });
        }
      }
      const entry = taskMap.get(r.taskId);
      if (entry) {
        entry.rows.push(r);
      }
    });

    return Array.from(taskMap.values());
  }, [filteredRows, tasks]);

  // -------------------------------------------------------------
  // Excel Export with Styled Headers and Auto Columns
  // -------------------------------------------------------------
  const handleExportToExcel = async () => {
    if (filteredRows.length === 0) {
      alert('No hay registros disponibles para exportar con los filtros actuales.');
      return;
    }

    const dataForExport = filteredRows.map(r => ({
      'Servicio': r.servicio,
      'Asociado': r.asociado,
      'Cable P': r.cableP,
      'Par P': r.parP,
      'Cable S': r.cableS,
      'Par S': r.parS,
      'Fecha Reporte': r.fechaReporte,
      'Grupo': r.grupo,
      'Demora en Días': r.demoraEnDias,
      'Central Telefónica': r.central,
      'Terminal': r.terminal || r.terminalDireccion || '-',
      'AFECTACIONES': r.afectacion,
      'Tarea o Trabajo': r.taskName
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);

    // Styling column widths
    const colWidths = [
      { wch: 14 }, // Servicio
      { wch: 14 }, // Asociado
      { wch: 12 }, // Cable P
      { wch: 10 }, // Par P
      { wch: 12 }, // Cable S
      { wch: 10 }, // Par S
      { wch: 14 }, // Fecha Reporte
      { wch: 16 }, // Grupo
      { wch: 15 }, // Demora en Días
      { wch: 20 }, // Central Telefónica
      { wch: 18 }, // Terminal
      { wch: 18 }, // AFECTACIONES
      { wch: 35 }  // Tarea o Trabajo
    ];
    worksheet['!cols'] = colWidths;

    // Header styling
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:M1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].s = {
          fill: { fgColor: { rgb: '1E3A8A' } }, // Deep Indigo / Blue
          font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
      }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Trabajos Pendientes');

    await saveXlsxWorkbook(workbook, 'trabajos_pendientes_cables');
  };

  // Copy TSV to Clipboard
  const handleCopyTable = () => {
    if (filteredRows.length === 0) return;

    const headers = [
      'Servicio',
      'Asociado',
      'Cable P',
      'Par P',
      'Cable S',
      'Par S',
      'Fecha Reporte',
      'Grupo',
      'Demora en Días',
      'Central Telefónica',
      'Terminal',
      'AFECTACIONES',
      'Tarea o Trabajo'
    ];

    const lines = filteredRows.map(r => [
      r.servicio,
      r.asociado,
      r.cableP,
      r.parP,
      r.cableS,
      r.parS,
      r.fechaReporte,
      r.grupo,
      r.demoraEnDias,
      r.central,
      r.terminal || r.terminalDireccion || '-',
      r.afectacion,
      r.taskName
    ].join('\t'));

    const tsvContent = [headers.join('\t'), ...lines].join('\n');
    navigator.clipboard.writeText(tsvContent).then(() => {
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2500);
    });
  };

  // -------------------------------------------------------------
  // Add / Edit Modal Handlers
  // -------------------------------------------------------------
  const handleOpenAddModal = () => {
    setEditingTask(null);
    setFormCable(excelData?.uniqueCables[0] || '');
    setFormTaskName('');
    setFormTerminalDir('');
    setFormStatus('pending');
    setFormPriority('normal');
    setFormServiceInput('');
    setSelectedServicesSet(new Set());
    setFormHasAfectacion(false);
    setFormAfectacionMotivo('');
    setFormAfectacionFechaInicio('');
    setFormAfectacionFechaFin('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (task: CablePendingTask) => {
    setEditingTask(task);
    setFormCable(task.cable);
    setFormTaskName(task.taskName);
    setFormTerminalDir(task.terminalDireccion || '');
    setFormStatus(task.status || 'pending');
    setFormPriority(task.priority || 'normal');
    setFormServiceInput(task.serviceNumbers.join('\n'));
    setSelectedServicesSet(new Set(task.serviceNumbers.map(s => s.toUpperCase())));
    setFormHasAfectacion(task.hasAfectacion || false);
    setFormAfectacionMotivo(task.afectacionMotivo || '');
    setFormAfectacionFechaInicio(task.afectacionFechaInicio || '');
    setFormAfectacionFechaFin(task.afectacionFechaFin || '');
    setPasteFeedbackMessage('');
    setIsModalOpen(true);
  };

  const handleDeleteTask = (taskId: string) => {
    if (!confirm('¿Está seguro de eliminar este trabajo pendiente? Esta acción no se puede deshacer.')) return;
    const updated = tasks.filter(t => t.id !== taskId);
    handleUpdateTasks(updated);
  };

  // Services available in the loaded Excel for the selected cable
  const cableAvailableServices = useMemo(() => {
    if (!excelData || !formCable) return [];
    return excelData.consolidatedRows.filter(r => {
      const cLower = formCable.toLowerCase();
      const matchP = r.cableP && r.cableP.toLowerCase().includes(cLower);
      const matchS = r.cableS && r.cableS.toLowerCase().includes(cLower);
      const matchC = r.cable && r.cable.toLowerCase().includes(cLower);
      return matchP || matchS || matchC;
    });
  }, [excelData, formCable]);

  // Números parseados en tiempo real desde la caja de texto (pegados desde Excel)
  const parsedPastedServices = useMemo(() => {
    return parseExcelServiceNumbers(formServiceInput);
  }, [formServiceInput]);

  // Conteo total combinado único (seleccionados por checkbox + pegados de Excel)
  const totalCombinedServicesCount = useMemo(() => {
    const set = new Set<string>();
    selectedServicesSet.forEach(s => set.add(s.toUpperCase()));
    parsedPastedServices.forEach(s => set.add(s.toUpperCase()));
    return set.size;
  }, [selectedServicesSet, parsedPastedServices]);

  // Conteo de servicios pegados que coinciden exactamente en el reporte Excel cargado
  const matchedServicesInExcelCount = useMemo(() => {
    if (parsedPastedServices.length === 0 || !excelServicesMap) return 0;
    let count = 0;
    parsedPastedServices.forEach(s => {
      if (excelServicesMap.has(s.toUpperCase())) count++;
    });
    return count;
  }, [parsedPastedServices, excelServicesMap]);

  // Detección automática del cable predominante en los números pegados si coincide en el Excel
  const suggestedCableFromPasted = useMemo(() => {
    if (!excelData || parsedPastedServices.length === 0) return null;
    const cableCount = new Map<string, number>();
    parsedPastedServices.forEach(s => {
      const row = excelServicesMap.get(s.toUpperCase());
      if (row) {
        const c = (row.cableP || row.cableS || row.cable || '').trim();
        if (c && c !== '-') {
          cableCount.set(c, (cableCount.get(c) || 0) + 1);
        }
      }
    });
    if (cableCount.size === 0) return null;
    let max = 0;
    let best = '';
    cableCount.forEach((cnt, cable) => {
      if (cnt > max) {
        max = cnt;
        best = cable;
      }
    });
    return { cable: best, count: max };
  }, [excelData, parsedPastedServices, excelServicesMap]);

  // Evento al pegar directamente con Ctrl + V dentro del textarea
  const handlePasteInTextarea = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted) return;

    const parsed = parseExcelServiceNumbers(pasted);
    if (parsed.length > 0) {
      e.preventDefault();
      const existing = parseExcelServiceNumbers(formServiceInput);
      const merged = Array.from(new Set([...existing, ...parsed]));
      setFormServiceInput(merged.join('\n'));

      // Si el campo de cable está vacío, sugerir o auto-asignar
      if (!formCable.trim()) {
        const cableCount = new Map<string, number>();
        merged.forEach(s => {
          const row = excelServicesMap.get(s.toUpperCase());
          if (row) {
            const c = (row.cableP || row.cableS || row.cable || '').trim();
            if (c && c !== '-') {
              cableCount.set(c, (cableCount.get(c) || 0) + 1);
            }
          }
        });
        let max = 0;
        let best = '';
        cableCount.forEach((cnt, cable) => {
          if (cnt > max) {
            max = cnt;
            best = cable;
          }
        });
        if (best) {
          setFormCable(best);
        }
      }

      setPasteFeedbackMessage(`¡Se pegaron ${parsed.length} números desde Excel con éxito!`);
      setTimeout(() => setPasteFeedbackMessage(''), 4000);
    }
  };

  // Botón para pegar directamente del portapapeles
  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        alert('Haga clic en el recuadro de texto y presione Ctrl + V para pegar la columna copiada de Excel.');
        return;
      }
      const text = await navigator.clipboard.readText();
      const parsed = parseExcelServiceNumbers(text);
      if (parsed.length === 0) {
        alert('No se detectaron números válidos en el portapapeles. Copie una columna de números en Excel y vuelva a intentar.');
        return;
      }
      const existing = parseExcelServiceNumbers(formServiceInput);
      const merged = Array.from(new Set([...existing, ...parsed]));
      setFormServiceInput(merged.join('\n'));

      if (!formCable.trim()) {
        const cableCount = new Map<string, number>();
        merged.forEach(s => {
          const row = excelServicesMap.get(s.toUpperCase());
          if (row) {
            const c = (row.cableP || row.cableS || row.cable || '').trim();
            if (c && c !== '-') {
              cableCount.set(c, (cableCount.get(c) || 0) + 1);
            }
          }
        });
        let max = 0;
        let best = '';
        cableCount.forEach((cnt, cable) => {
          if (cnt > max) {
            max = cnt;
            best = cable;
          }
        });
        if (best) {
          setFormCable(best);
        }
      }

      setPasteFeedbackMessage(`¡Añadidos ${parsed.length} números desde el portapapeles!`);
      setTimeout(() => setPasteFeedbackMessage(''), 4000);
    } catch {
      alert('Haga clic en el recuadro de texto y presione Ctrl + V para pegar la columna de Excel.');
    }
  };

  const handleCleanAndFormatPasted = () => {
    const parsed = parseExcelServiceNumbers(formServiceInput);
    setFormServiceInput(parsed.join('\n'));
    setPasteFeedbackMessage(`Formato limpiado (${parsed.length} números ordenados)`);
    setTimeout(() => setPasteFeedbackMessage(''), 3000);
  };

  const handleClearPasted = () => {
    setFormServiceInput('');
    setPasteFeedbackMessage('');
  };

  const handleRemoveOnePastedNumber = (numToRemove: string) => {
    const parsed = parseExcelServiceNumbers(formServiceInput);
    const filtered = parsed.filter(n => n !== numToRemove);
    setFormServiceInput(filtered.join('\n'));
  };

  const handleToggleSelectAllCableServices = () => {
    const nextSet = new Set(selectedServicesSet);
    const allSelected = cableAvailableServices.length > 0 && cableAvailableServices.every(s => nextSet.has(s.servicio.toUpperCase()));

    if (allSelected) {
      cableAvailableServices.forEach(s => nextSet.delete(s.servicio.toUpperCase()));
    } else {
      cableAvailableServices.forEach(s => nextSet.add(s.servicio.toUpperCase()));
    }
    setSelectedServicesSet(nextSet);
  };

  const handleToggleServiceCheckbox = (srv: string) => {
    const key = srv.toUpperCase();
    const nextSet = new Set(selectedServicesSet);
    if (nextSet.has(key)) {
      nextSet.delete(key);
    } else {
      nextSet.add(key);
    }
    setSelectedServicesSet(nextSet);
  };

  // Helper to auto-select services reported within afectacion range
  const handleSelectServicesInAfectacionRange = () => {
    if (!formAfectacionFechaInicio && !formAfectacionFechaFin) return;
    const start = formAfectacionFechaInicio || '';
    const end = formAfectacionFechaFin || '';

    const nextSet = new Set(selectedServicesSet);
    cableAvailableServices.forEach(srv => {
      const date = (srv.fechaReporte || '').trim().slice(0, 10);
      let matches = false;
      if (date && date !== '-') {
        if (start && end) matches = date >= start && date <= end;
        else if (start) matches = date >= start;
        else if (end) matches = date <= end;
      }
      if (matches) {
        nextSet.add(srv.servicio.toUpperCase());
      }
    });
    setSelectedServicesSet(nextSet);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formCable.trim()) {
      alert('Por favor especifique el Cable asociado a este trabajo.');
      return;
    }
    if (!formTaskName.trim()) {
      alert('Por favor escriba la Tarea o Trabajo a realizar.');
      return;
    }

    if (formHasAfectacion) {
      if (!formAfectacionMotivo.trim()) {
        alert('Por favor especifique el Motivo de la Afectación (ej. Huracán).');
        return;
      }
      if (formAfectacionFechaInicio && formAfectacionFechaFin && formAfectacionFechaInicio > formAfectacionFechaFin) {
        alert('La fecha inicial de la afectación no puede ser mayor que la fecha final.');
        return;
      }
    }

    // Merge manually typed / pasted Excel services with checkbox selected services
    const typedServices = parseExcelServiceNumbers(formServiceInput);

    const mergedServicesSet = new Set([...selectedServicesSet, ...typedServices]);
    const finalServices = Array.from(mergedServicesSet);

    if (editingTask) {
      // Edit existing
      const updated = tasks.map(t => {
        if (t.id === editingTask.id) {
          return {
            ...t,
            cable: formCable.trim(),
            taskName: formTaskName.trim(),
            terminalDireccion: formTerminalDir.trim() || undefined,
            status: formStatus,
            priority: formPriority,
            serviceNumbers: finalServices,
            hasAfectacion: formHasAfectacion,
            afectacionMotivo: formHasAfectacion ? formAfectacionMotivo.trim() : undefined,
            afectacionFechaInicio: formHasAfectacion ? formAfectacionFechaInicio || undefined : undefined,
            afectacionFechaFin: formHasAfectacion ? formAfectacionFechaFin || undefined : undefined,
            updatedAt: new Date().toISOString()
          };
        }
        return t;
      });
      handleUpdateTasks(updated);
    } else {
      // Create new: check if an identical task (same taskName and cable) already exists to offer seamless consolidation
      const existingIdenticalTask = tasks.find(
        t => t.taskName.trim().toUpperCase() === formTaskName.trim().toUpperCase() &&
             t.cable.trim().toUpperCase() === formCable.trim().toUpperCase()
      );

      if (existingIdenticalTask) {
        // Merge into existing task with deduplicated services
        const existingServices = existingIdenticalTask.serviceNumbers || [];
        const unionSet = new Set([...existingServices, ...finalServices]);
        const updated = tasks.map(t => {
          if (t.id === existingIdenticalTask.id) {
            return {
              ...t,
              serviceNumbers: Array.from(unionSet),
              hasAfectacion: formHasAfectacion ? true : t.hasAfectacion,
              afectacionMotivo: formHasAfectacion ? formAfectacionMotivo.trim() : t.afectacionMotivo,
              afectacionFechaInicio: formHasAfectacion ? (formAfectacionFechaInicio || t.afectacionFechaInicio) : t.afectacionFechaInicio,
              afectacionFechaFin: formHasAfectacion ? (formAfectacionFechaFin || t.afectacionFechaFin) : t.afectacionFechaFin,
              updatedAt: new Date().toISOString()
            };
          }
          return t;
        });
        handleUpdateTasks(updated);
      } else {
        const newTask: CablePendingTask = {
          id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          cable: formCable.trim(),
          taskName: formTaskName.trim(),
          terminalDireccion: formTerminalDir.trim() || undefined,
          status: formStatus,
          priority: formPriority,
          serviceNumbers: finalServices,
          hasAfectacion: formHasAfectacion,
          afectacionMotivo: formHasAfectacion ? formAfectacionMotivo.trim() : undefined,
          afectacionFechaInicio: formHasAfectacion ? formAfectacionFechaInicio || undefined : undefined,
          afectacionFechaFin: formHasAfectacion ? formAfectacionFechaFin || undefined : undefined,
          createdAt: new Date().toISOString()
        };
        handleUpdateTasks([newTask, ...tasks]);
      }
    }

    setIsModalOpen(false);
  };

  const toggleTaskAccordion = (taskId: string) => {
    setExpandedTaskIds(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* TOP BANNER & ACTION BAR */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-3.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl shrink-0">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider font-mono">
                  Pestaña 6
                </span>
                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md font-mono">
                  Gestión Operativa de Cables
                </span>
              </div>
              <h2 className="text-xl font-black text-white tracking-tight mt-1">
                Trabajos y Tareas Pendientes por Cable
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                Vincule las tareas técnicas que retienen cables y servicios. Busque por servicio para ver automáticamente el contexto de toda la tarea asociada.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* View Mode Toggle (Mejora D) */}
            <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setViewMode('flat')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  viewMode === 'flat'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vista Plana: Todas las columnas en una sola tabla"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Vista Detallada</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  viewMode === 'grouped'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vista Agrupada: Bloques por Tarea con servicios desplegables"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>Agrupado por Tarea</span>
              </button>
            </div>

            {/* Copy Table */}
            <button
              type="button"
              onClick={handleCopyTable}
              disabled={filteredRows.length === 0}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 hover:text-white text-xs font-bold rounded-xl border border-slate-700 transition-all flex items-center space-x-1.5 cursor-pointer"
              title="Copiar datos filtrados al portapapeles"
            >
              {copiedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
              <span>{copiedSuccess ? 'Copiado' : 'Copiar'}</span>
            </button>

            {/* Eliminar Todos los Trabajos */}
            {tasks.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(true)}
                className="px-3 py-2 bg-rose-950/50 hover:bg-rose-900/70 text-rose-300 hover:text-rose-100 text-xs font-bold rounded-xl border border-rose-500/40 transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm"
                title="Eliminar todos los trabajos registrados"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Eliminar Todos</span>
              </button>
            )}

            {/* Botón al lado de Agregar Trabajo para Ver Todas las Tareas */}
            <button
              type="button"
              onClick={() => setShowAllTasksModal(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center space-x-2 cursor-pointer border border-indigo-400/40"
              title="Ver ventana con todas las tareas registradas, totales, afectaciones y gestión"
            >
              <ListTodo className="w-4 h-4 text-indigo-200" />
              <span>Ver Todas las Tareas ({tasks.length})</span>
            </button>

            {/* Botón para Gestión de Afectaciones Independientes con Período de Fecha */}
            <button
              type="button"
              onClick={() => setShowAfectacionesModal(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-purple-950/40 flex items-center space-x-2 cursor-pointer border border-purple-400/40"
              title="Crear, actualizar o eliminar afectaciones con seguimiento por período de fecha"
            >
              <AlertTriangle className="w-4 h-4 text-amber-300" />
              <span>Gestión de Afectaciones</span>
            </button>

            {/* Botones de Agregar Trabajo y Carga Masiva (debajo) */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-lg shadow-amber-600/30 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Agregar Trabajo</span>
              </button>

              <button
                type="button"
                onClick={() => setShowBatchModal(true)}
                className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-emerald-600/25 flex items-center justify-center space-x-2 cursor-pointer border border-emerald-400/40"
                title="Copie y pegue en masa desde Excel todos los números con su trabajo y afectación"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />
                <span>Carga Masiva (Excel)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mensaje de confirmación al eliminar todos los trabajos */}
        {deleteAllSuccessMsg && (
          <div className="p-3 bg-emerald-950/70 border border-emerald-500/50 rounded-2xl flex items-center justify-between text-xs text-emerald-300 animate-in fade-in">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{deleteAllSuccessMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setDeleteAllSuccessMsg('')}
              className="text-emerald-400 hover:text-emerald-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Mensaje de confirmación al importar trabajos en masa desde Excel */}
        {batchSuccessMsg && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-500/60 rounded-2xl flex items-center justify-between text-xs text-emerald-300 animate-in fade-in shadow-md">
            <div className="flex items-center space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-medium">{batchSuccessMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setBatchSuccessMsg('')}
              className="text-emerald-400 hover:text-emerald-200 cursor-pointer p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* RESUMEN VISUAL SUPERIOR (KPIS RÁPIDOS - MEJORA B) */}
        {/* ------------------------------------------------------------- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
          <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Trabajos Registrados
            </span>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-white">{kpis.totalTasks}</span>
              <span className="text-[11px] text-amber-400 font-medium">({kpis.pendingTasks} pendientes)</span>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Servicios Reportados Activos
            </span>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-emerald-400">{kpis.totalServicesReported}</span>
              <span className="text-[11px] text-slate-400">en Excel activo</span>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Cable con Mayor Impacto
            </span>
            <div className="flex items-baseline space-x-1.5 truncate">
              <span className="text-lg font-black font-mono text-emerald-400 truncate">{kpis.topImpactCable}</span>
              {kpis.topImpactCount > 0 && (
                <span className="text-[10px] text-slate-400 font-mono">({kpis.topImpactCount} srvs)</span>
              )}
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Mayor Demora Acumulada
            </span>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-rose-400">{kpis.maxDemora} días</span>
              <span className="text-[10px] text-slate-400 font-mono truncate">{kpis.oldestService !== '-' ? kpis.oldestService : ''}</span>
            </div>
          </div>
        </div>

        {/* Banner de Sincronización Reactiva con Excel */}
        <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl border shrink-0 ${
              excelData ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}>
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-white">Sincronización con Reporte de Averías:</span>
                {excelData ? (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] px-2 py-0.5 rounded-md font-mono font-bold">
                    {excelData.fileName}
                  </span>
                ) : (
                  <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] px-2 py-0.5 rounded-md font-bold">
                    Sin archivo Excel cargado
                  </span>
                )}
                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] px-2 py-0.5 rounded-md font-bold">
                  Solo servicios reportados
                </span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {excelData
                  ? `Mostrando exclusivamente los servicios que están reportados en el archivo Excel (${allDetailRows.length} en total). Los no reportados se omiten automáticamente. Al subir un nuevo Excel, la tabla se actualiza de inmediato.`
                  : 'Cargue el archivo Excel para sincronizar y ver únicamente los servicios reportados en la tabla.'}
              </p>
            </div>
          </div>

          {onFileUpload && (
            <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl transition-all flex items-center space-x-2 shrink-0 self-start md:self-auto shadow-sm">
              {isParsing ? <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" /> : <Upload className="w-4 h-4 text-emerald-400" />}
              <span>{isParsing ? 'Procesando Excel...' : 'Cargar / Actualizar Excel'}</span>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={onFileUpload}
                disabled={isParsing}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* BARRA DE FILTROS REQUERIDOS */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-extrabold text-white">Filtros de Búsqueda y Segmentación</h3>
            {hasActiveFilters && (
              <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md">
                {filteredRows.length} coincidencias
              </span>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center space-x-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar Todos los Filtros</span>
            </button>
          )}
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Central */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 flex items-center space-x-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Central</span>
            </label>
            <select
              value={filterCentral}
              onChange={(e) => setFilterCentral(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">Todas las Centrales</option>
              {availableCentrales.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 2. Grupo */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 flex items-center space-x-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Grupo</span>
            </label>
            <select
              value={filterGrupo}
              onChange={(e) => setFilterGrupo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">Todos los Grupos</option>
              {availableGrupos.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* 3. Mes */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>Mes</span>
            </label>
            <select
              value={filterMes}
              onChange={(e) => setFilterMes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">Todos los Meses</option>
              <option value="1">Enero</option>
              <option value="2">Febrero</option>
              <option value="3">Marzo</option>
              <option value="4">Abril</option>
              <option value="5">Mayo</option>
              <option value="6">Junio</option>
              <option value="7">Julio</option>
              <option value="8">Agosto</option>
              <option value="9">Septiembre</option>
              <option value="10">Octubre</option>
              <option value="11">Noviembre</option>
              <option value="12">Diciembre</option>
            </select>
          </div>

          {/* 4. Año */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              <span>Año</span>
            </label>
            <select
              value={filterAnio}
              onChange={(e) => setFilterAnio(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="all">Todos los Años</option>
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* 5. Afectaciones */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 flex items-center space-x-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-purple-400" />
              <span>Afectaciones</span>
            </label>
            <select
              value={filterAfectacion}
              onChange={(e) => setFilterAfectacion(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="all">Todas las Afectaciones</option>
              <option value="con_afectacion">Con Afectación Registrada</option>
              <option value="sin_afectacion">Sin Afectación (-)</option>
              {availableAfectaciones.map(a => (
                <option key={a} value={a}>Motivo: {a}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 5. Rango de Fecha (Validado: Fecha inicial <= Fecha final) */}
        <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white">Filtro por Rango de Fecha</span>
              <span className="text-[10px] text-slate-400">(La fecha inicial no puede ser mayor que la final)</span>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => handleQuickDatePreset('today')}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-md"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => handleQuickDatePreset('7days')}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-md"
              >
                7 días
              </button>
              <button
                type="button"
                onClick={() => handleQuickDatePreset('thisMonth')}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-md"
              >
                Este Mes
              </button>
              {(filterStartDate || filterEndDate) && (
                <button
                  type="button"
                  onClick={handleClearDateRange}
                  className="px-2 py-0.5 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-[10px] font-bold rounded-md border border-rose-500/30"
                >
                  Limpiar Rango
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-400 font-bold block mb-1">Fecha Inicial (Desde):</label>
              <input
                type="date"
                value={filterStartDate}
                max={filterEndDate || undefined}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-bold block mb-1">Fecha Final (Hasta):</label>
              <input
                type="date"
                value={filterEndDate}
                min={filterStartDate || undefined}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* 6. Buscar Servicio con Contexto de Tarea (Mejora C) */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-white flex items-center justify-between">
            <span className="flex items-center space-x-1.5">
              <Search className="w-3.5 h-3.5 text-amber-400" />
              <span>Buscar Servicio (Muestra todos los servicios de la misma Tarea o Trabajo)</span>
            </span>
            {searchServiceTerm && (
              <span className="text-[11px] text-amber-300 font-mono">
                Búsqueda activa: "{searchServiceTerm}"
              </span>
            )}
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Escriba el número de servicio a buscar (ej: 0212000001)..."
              value={searchServiceTerm}
              onChange={(e) => setSearchServiceTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-10 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            {searchServiceTerm && (
              <button
                type="button"
                onClick={() => setSearchServiceTerm('')}
                className="absolute right-3.5 top-2.5 p-1 text-slate-400 hover:text-white"
                title="Borrar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Feedback de Búsqueda Contextual (Mejora C) */}
          {searchServiceTerm.trim() && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center space-x-2.5 text-xs text-amber-200">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Búsqueda Contextual Activa:</strong> Se encontraron {contextSearchInfo.matchedTaskIds.size} tarea(s) que contienen servicios con "{searchServiceTerm}". Se muestran en la tabla todos los {filteredRows.length} servicios que comparten esas mismas tareas. Los servicios exactos buscados aparecen resaltados con borde verde.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TABLA PRINCIPAL DE TRABAJOS Y TAREAS */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4 shadow-xl">
        {/* Table Toolbar with Small Excel Download Icon and Delete All Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-black text-white">
              {viewMode === 'flat' ? 'Detalle de Servicios Reportados por Trabajo' : 'Tareas Pendientes Agrupadas'}
            </h3>
            <span className="bg-emerald-950 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold">
              {filteredRows.length} reportados
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Botón para eliminar todos los trabajos con cartel de confirmación */}
            {tasks.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(true)}
                className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-100 rounded-xl text-xs font-bold transition-all border border-rose-500/30 flex items-center space-x-1.5 cursor-pointer shadow-sm"
                title="Eliminar todos los trabajos pendientes de la tabla"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Eliminar Todos los Trabajos</span>
              </button>
            )}

            {/* Pequeño icono de descarga en Excel solicitado por el usuario */}
            <button
              type="button"
              onClick={handleExportToExcel}
              disabled={filteredRows.length === 0}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1.5 cursor-pointer border border-emerald-400/40"
              title="Descargar tabla en Excel con todos los filtros aplicados"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Descargar Excel</span>
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* VISTA 1: DETALLADA (TABLA PLANA) */}
        {/* Columnas: Servicio, Asociado, cable p, par p, cable s, par s, fecha reporte, grupo, demora en días, central telefónica, terminal, afectaciones, tarea o trabajo */}
        {/* ------------------------------------------------------------- */}
        {viewMode === 'flat' && (
          <div className="overflow-x-auto bg-slate-950 rounded-2xl border border-slate-800">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3.5 text-white">Servicio</th>
                  <th className="py-3 px-3.5 text-slate-300">Asociado</th>
                  <th className="py-3 px-3 text-center text-emerald-400">Cable P</th>
                  <th className="py-3 px-3 text-center text-emerald-300">Par P</th>
                  <th className="py-3 px-3 text-center text-cyan-400">Cable S</th>
                  <th className="py-3 px-3 text-center text-cyan-300">Par S</th>
                  <th className="py-3 px-3 text-center text-slate-300">Fecha Reporte</th>
                  <th className="py-3 px-3.5 text-slate-300">Grupo</th>
                  <th className="py-3 px-3 text-center text-amber-400">Demora (Días)</th>
                  <th className="py-3 px-3.5 text-slate-300">Central Telefónica</th>
                  <th className="py-3 px-3.5 text-slate-300">Terminal</th>
                  <th className="py-3 px-3 text-center text-purple-400 font-bold">AFECTACIONES</th>
                  <th className="py-3 px-4 text-white font-black">Tarea o Trabajo</th>
                  <th className="py-3 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-medium">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-12 text-center text-slate-500 italic space-y-2">
                      <p className="text-sm font-semibold text-slate-300">
                        {!excelData
                          ? 'No hay archivo Excel cargado. Suba el archivo Excel para ver los servicios reportados.'
                          : 'No se encontraron servicios reportados en el archivo Excel actual para los trabajos o filtros seleccionados.'}
                      </p>
                      <p className="text-xs text-slate-400">
                        (La tabla solo muestra los servicios que se encuentran reportados en el Excel activo; el resto se omite automáticamente).
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenAddModal}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold rounded-xl border border-slate-700 transition-colors cursor-pointer"
                      >
                        Crear Nuevo Trabajo Pendiente
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map(row => {
                    const isDirectMatch = searchServiceTerm.trim() && contextSearchInfo.exactMatchServiceNumbers.has(row.servicio.toUpperCase());

                    return (
                      <tr
                        key={row.id}
                        className={`transition-colors ${
                          isDirectMatch
                            ? 'bg-emerald-950/30 hover:bg-emerald-950/50 border-l-4 border-l-emerald-500'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        {/* 1. Servicio */}
                        <td className="py-2.5 px-3.5 font-mono font-bold text-white whitespace-nowrap">
                          <div className="flex items-center space-x-1.5">
                            <span>{row.servicio}</span>
                            {isDirectMatch && (
                              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] px-1.5 py-0.2 rounded font-sans">
                                Coincidencia
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2. Asociado */}
                        <td className="py-2.5 px-3.5 font-mono text-slate-400 whitespace-nowrap">
                          {row.asociado}
                        </td>

                        {/* 3. Cable P */}
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-400 whitespace-nowrap">
                          {row.cableP}
                        </td>

                        {/* 4. Par P */}
                        <td className="py-2.5 px-3 text-center font-mono text-emerald-300 whitespace-nowrap">
                          {row.parP}
                        </td>

                        {/* 5. Cable S */}
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-cyan-400 whitespace-nowrap">
                          {row.cableS}
                        </td>

                        {/* 6. Par S */}
                        <td className="py-2.5 px-3 text-center font-mono text-cyan-300 whitespace-nowrap">
                          {row.parS}
                        </td>

                        {/* 7. Fecha Reporte */}
                        <td className="py-2.5 px-3 text-center font-mono text-slate-300 whitespace-nowrap">
                          {row.fechaReporte}
                        </td>

                        {/* 8. Grupo */}
                        <td className="py-2.5 px-3.5 text-slate-300 whitespace-nowrap">
                          {row.grupo}
                        </td>

                        {/* 9. Demora en Días */}
                        <td className="py-2.5 px-3 text-center font-mono font-bold whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded ${
                            row.demoraEnDias > 60
                              ? 'bg-rose-950/80 text-rose-300 border border-rose-800/50'
                              : row.demoraEnDias > 30
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-800/50'
                              : 'text-slate-300'
                          }`}>
                            {row.demoraEnDias}
                          </span>
                        </td>

                        {/* 10. Central Telefónica */}
                        <td className="py-2.5 px-3.5 text-slate-300 whitespace-nowrap">
                          {row.central}
                        </td>

                        {/* 11. Terminal (obtenido de la columna TERMINAL del Excel) */}
                        <td className="py-2.5 px-3.5 font-mono text-slate-300 max-w-xs truncate" title={row.terminal || row.terminalDireccion}>
                          <div className="flex items-center space-x-1.5 truncate">
                            <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                            <span className="truncate">{row.terminal || row.terminalDireccion || '-'}</span>
                          </div>
                        </td>

                        {/* 12. AFECTACIONES */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {row.afectacion && row.afectacion !== '-' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              <AlertTriangle className="w-2.5 h-2.5 mr-1 text-purple-400 shrink-0" />
                              <span>{row.afectacion}</span>
                            </span>
                          ) : (
                            <span className="text-slate-600 font-mono">-</span>
                          )}
                        </td>

                        {/* 13. Tarea o Trabajo */}
                        <td className="py-2.5 px-4 font-medium text-white max-w-sm truncate" title={row.taskName}>
                          <div className="flex items-center space-x-1.5 truncate">
                            <Wrench className="w-3 h-3 text-blue-400 shrink-0" />
                            <span className="truncate font-semibold">{row.taskName}</span>
                          </div>
                        </td>

                        {/* Acciones */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                const t = tasks.find(item => item.id === row.taskId);
                                if (t) handleOpenEditModal(t);
                              }}
                              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
                              title="Editar Trabajo"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(row.taskId)}
                              className="p-1 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                              title="Eliminar Trabajo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VISTA 2: AGRUPADA POR TAREA (ACORDEÓN - MEJORA D) */}
        {/* ------------------------------------------------------------- */}
        {viewMode === 'grouped' && (
          <div className="space-y-3">
            {groupedTasks.length === 0 ? (
              <div className="py-12 text-center text-slate-500 italic bg-slate-950 rounded-2xl border border-slate-800">
                No hay tareas que coincidan con los filtros activos.
              </div>
            ) : (
              groupedTasks.map(({ task, rows }) => {
                const isExpanded = expandedTaskIds[task.id] !== false; // expanded by default
                const maxDemora = Math.max(...rows.map(r => r.demoraEnDias), 0);

                return (
                  <div
                    key={task.id}
                    className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden transition-all shadow-md"
                  >
                    {/* Accordion Header */}
                    <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-start space-x-3">
                        <button
                          type="button"
                          onClick={() => toggleTaskAccordion(task.id)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors mt-0.5"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-emerald-400 text-sm bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                              Cable: {task.cable}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                              task.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : task.status === 'in_progress'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}>
                              {task.status === 'completed' ? 'Completado' : task.status === 'in_progress' ? 'En Ejecución' : 'Pendiente'}
                            </span>
                            {task.hasAfectacion && task.afectacionMotivo && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center space-x-1">
                                <AlertTriangle className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                                <span>Afectación: {task.afectacionMotivo}</span>
                                {task.afectacionFechaInicio && task.afectacionFechaFin && (
                                  <span className="text-[9px] text-purple-300/80 font-mono ml-1">
                                    ({task.afectacionFechaInicio} al {task.afectacionFechaFin})
                                  </span>
                                )}
                              </span>
                            )}
                            {task.terminalDireccion && (
                              <span className="text-xs text-slate-400 flex items-center space-x-1">
                                <MapPin className="w-3 h-3 text-amber-400" />
                                <span>{task.terminalDireccion}</span>
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-white mt-1">
                            {task.taskName}
                          </h4>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 shrink-0">
                        <div className="text-right">
                          <div className="text-xs font-mono font-bold text-slate-300">
                            {rows.length} {rows.length === 1 ? 'Servicio' : 'Servicios'}
                          </div>
                          <div className="text-[10px] text-amber-400 font-mono">
                            Demora Máx: {maxDemora} días
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(task)}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-colors"
                          title="Editar Tarea"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 rounded-xl text-xs font-bold transition-colors"
                          title="Eliminar Tarea"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Accordion Content Table */}
                    {isExpanded && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left text-slate-300">
                          <thead className="bg-slate-950 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-800/80">
                            <tr>
                              <th className="py-2.5 px-4 text-white">Servicio</th>
                              <th className="py-2.5 px-3">Asociado</th>
                              <th className="py-2.5 px-3 text-center text-emerald-400">Cable P</th>
                              <th className="py-2.5 px-3 text-center text-emerald-300">Par P</th>
                              <th className="py-2.5 px-3 text-center text-cyan-400">Cable S</th>
                              <th className="py-2.5 px-3 text-center text-cyan-300">Par S</th>
                              <th className="py-2.5 px-3 text-center">Fecha Reporte</th>
                              <th className="py-2.5 px-3">Grupo</th>
                              <th className="py-2.5 px-3 text-center text-amber-400">Demora</th>
                              <th className="py-2.5 px-4">Central</th>
                              <th className="py-2.5 px-3 text-slate-300">Terminal</th>
                              <th className="py-2.5 px-3 text-center text-purple-400 font-bold">AFECTACIÓN</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50 font-medium">
                            {rows.map(r => (
                              <tr key={r.id} className="hover:bg-slate-900/40 transition-colors">
                                <td className="py-2 px-4 font-mono font-bold text-white">{r.servicio}</td>
                                <td className="py-2 px-3 font-mono text-slate-400">{r.asociado}</td>
                                <td className="py-2 px-3 text-center font-mono text-emerald-400">{r.cableP}</td>
                                <td className="py-2 px-3 text-center font-mono text-emerald-300">{r.parP}</td>
                                <td className="py-2 px-3 text-center font-mono text-cyan-400">{r.cableS}</td>
                                <td className="py-2 px-3 text-center font-mono text-cyan-300">{r.parS}</td>
                                <td className="py-2 px-3 text-center font-mono text-slate-300">{r.fechaReporte}</td>
                                <td className="py-2 px-3 text-slate-300">{r.grupo}</td>
                                <td className="py-2 px-3 text-center font-mono font-bold text-amber-400">{r.demoraEnDias}d</td>
                                <td className="py-2 px-4 text-slate-300">{r.central}</td>
                                <td className="py-2 px-3 font-mono text-slate-300 max-w-xs truncate" title={r.terminal || r.terminalDireccion}>{r.terminal || r.terminalDireccion || '-'}</td>
                                <td className="py-2 px-3 text-center whitespace-nowrap">
                                  {r.afectacion && r.afectacion !== '-' ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                      <AlertTriangle className="w-2.5 h-2.5 mr-1 text-purple-400 shrink-0" />
                                      <span>{r.afectacion}</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-600 font-mono">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* VENTANA MODAL: TODAS LAS TAREAS (RESUMEN, AFECTACIONES Y GESTIÓN) */}
      {/* ------------------------------------------------------------- */}
      {showAllTasksModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-5xl text-white shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-2xl">
                  <ListTodo className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight flex items-center space-x-2">
                    <span>Todas las Tareas Registradas</span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {tasks.length} {tasks.length === 1 ? 'tarea' : 'tareas'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Resumen general de tareas, pertenencia a afectaciones, cables y opciones de actualización o eliminación por cumplimiento.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAllTasksModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                title="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification alert within modal */}
            {taskFulfilledSuccessMsg && (
              <div className="mx-5 mt-4 p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl flex items-center justify-between text-xs text-emerald-300 animate-in fade-in shrink-0">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold">{taskFulfilledSuccessMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTaskFulfilledSuccessMsg('')}
                  className="text-emerald-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Modal Metrics Summary (Cantidad total, cuántas pertenecen a Afectaciones, cables) */}
            <div className="p-5 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                  Total de Tareas
                </span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-black text-white font-mono">{allTasksMetrics.total}</span>
                  <span className="text-[11px] text-slate-500">registradas</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  <span className="text-emerald-400 font-bold">{allTasksMetrics.completed}</span> cumplidas · <span className="text-amber-400 font-bold">{allTasksMetrics.pending}</span> pendientes
                </div>
              </div>

              <div className="bg-purple-950/30 border border-purple-500/30 rounded-2xl p-3.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-purple-300 flex items-center space-x-1 mb-1">
                  <AlertTriangle className="w-3 h-3 text-purple-400" />
                  <span>En Afectaciones</span>
                </span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-black text-purple-300 font-mono">{allTasksMetrics.withAfectacion}</span>
                  <span className="text-[11px] text-purple-400">
                    {allTasksMetrics.total > 0 ? `(${Math.round((allTasksMetrics.withAfectacion / allTasksMetrics.total) * 100)}%)` : '0%'}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-purple-300/80">
                  Tareas con motivo de afectación
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                  Sin Afectación
                </span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-black text-slate-300 font-mono">{allTasksMetrics.withoutAfectacion}</span>
                  <span className="text-[11px] text-slate-500">ordinarias</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Mantenimiento y trabajos regulares
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                  Cables & Servicios
                </span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-black text-amber-400 font-mono">{allTasksMetrics.uniqueCablesCount}</span>
                  <span className="text-[11px] text-slate-500">cables</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  <span className="text-cyan-400 font-bold">{allTasksMetrics.totalServices}</span> servicios asignados
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="px-5 py-2 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por cable, tarea, motivo..."
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                {modalSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setModalSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setModalFilterAfectacion('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    modalFilterAfectacion === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Todas ({allTasksMetrics.total})
                </button>
                <button
                  type="button"
                  onClick={() => setModalFilterAfectacion('with_afectacion')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center space-x-1 ${
                    modalFilterAfectacion === 'with_afectacion'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-800 text-purple-300 hover:text-white'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>En Afectaciones ({allTasksMetrics.withAfectacion})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModalFilterAfectacion('without_afectacion')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    modalFilterAfectacion === 'without_afectacion'
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Sin Afectación ({allTasksMetrics.withoutAfectacion})
                </button>
              </div>
            </div>

            {/* Scrollable Tasks Table */}
            <div className="flex-1 overflow-y-auto px-5 py-2">
              {tasks.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-500 mx-auto flex items-center justify-center">
                    <ListTodo className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-white">No hay tareas registradas</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Aún no ha creado ningún trabajo pendiente. Puede registrar uno nuevo utilizando el botón "Agregar Trabajo".
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAllTasksModal(false);
                      handleOpenAddModal();
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all shadow-md inline-flex items-center space-x-1.5 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Agregar Trabajo Ahora</span>
                  </button>
                </div>
              ) : modalFilteredTasks.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  No se encontraron tareas que coincidan con la búsqueda o filtro aplicado.
                </div>
              ) : (
                <div className="border border-slate-800 rounded-2xl overflow-hidden shadow-inner">
                  <table className="w-full text-xs text-left text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800 sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 text-center">N°</th>
                        <th className="py-2.5 px-3">Cable</th>
                        <th className="py-2.5 px-4">Tarea / Trabajo</th>
                        <th className="py-2.5 px-3 text-center">Servicios</th>
                        <th className="py-2.5 px-3 text-center">Afectación</th>
                        <th className="py-2.5 px-3 text-center">Estado</th>
                        <th className="py-2.5 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                      {modalFilteredTasks.map((t, index) => {
                        const isCompleted = t.status === 'completed';
                        const isInProgress = t.status === 'in_progress';
                        return (
                          <tr
                            key={t.id}
                            className={`hover:bg-slate-800/40 transition-colors ${
                              isCompleted ? 'bg-emerald-950/10 opacity-80' : ''
                            }`}
                          >
                            {/* N° */}
                            <td className="py-3 px-3 text-center font-mono text-slate-500 text-[11px]">
                              {index + 1}
                            </td>

                            {/* Cable */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="inline-flex items-center space-x-1 font-mono font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg text-xs">
                                <Cable className="w-3 h-3" />
                                <span>{t.cable}</span>
                              </span>
                            </td>

                            {/* Tarea o Trabajo */}
                            <td className="py-3 px-4">
                              <div className="space-y-0.5 max-w-sm">
                                <div className={`font-bold text-white text-xs ${isCompleted ? 'line-through text-slate-400' : ''}`}>
                                  {t.taskName}
                                </div>
                                {t.terminalDireccion && (
                                  <div className="text-[11px] text-slate-400 flex items-center space-x-1 truncate" title={t.terminalDireccion}>
                                    <MapPin className="w-2.5 h-2.5 text-rose-400 shrink-0" />
                                    <span className="truncate">Terminal: {t.terminalDireccion}</span>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Cantidad de Servicios (Reportados vs Asignados) */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              {(() => {
                                const reportedCount = (t.serviceNumbers || []).filter(s => {
                                  const sKey = (s || '').toString().trim().toUpperCase();
                                  if (!sKey) return false;
                                  if (excelServicesMap.has(sKey)) return true;
                                  const digits = sKey.replace(/\D/g, '');
                                  if (digits && (excelServicesMap.has(digits) || excelServicesMap.has(digits.replace(/^0+/, '')))) return true;
                                  return false;
                                }).length;
                                const totalCount = t.serviceNumbers?.length || 0;

                                return (
                                  <div className="inline-flex flex-col items-center">
                                    <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full border font-mono font-bold text-[11px] ${
                                      reportedCount > 0
                                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                                        : 'bg-slate-800/80 border-slate-700 text-slate-400'
                                    }`}>
                                      <Users className={`w-3 h-3 ${reportedCount > 0 ? 'text-emerald-400' : 'text-slate-400'}`} />
                                      <span>{reportedCount} reportados</span>
                                    </span>
                                    {totalCount > reportedCount && (
                                      <span className="text-[10px] text-slate-500 font-mono mt-0.5" title={`${totalCount - reportedCount} servicios no aparecen reportados en el Excel actual y han sido omitidos de la tabla`}>
                                        de {totalCount} ({totalCount - reportedCount} omitidos)
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>

                            {/* Afectación */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              {t.hasAfectacion ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  <AlertTriangle className="w-2.5 h-2.5 mr-1 text-purple-400 shrink-0" />
                                  <span>{t.afectacionMotivo || 'Afectación'}</span>
                                  {t.afectacionFechaInicio && (
                                    <span className="ml-1 opacity-75">({t.afectacionFechaInicio})</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[11px] font-mono">No</span>
                              )}
                            </td>

                            {/* Estado */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              {isCompleted ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  <CheckCircle2 className="w-2.5 h-2.5 mr-1 text-emerald-400" />
                                  <span>Cumplida</span>
                                </span>
                              ) : isInProgress ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                  <Clock className="w-2.5 h-2.5 mr-1 text-cyan-400" />
                                  <span>En Progreso</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  <span>Pendiente</span>
                                </span>
                              )}
                            </td>

                            {/* Acciones: Actualizar o Eliminar porque ya se cumplió */}
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end space-x-1.5">
                                {/* Botón para Actualizar */}
                                <button
                                  type="button"
                                  onClick={() => handleEditFromSummaryModal(t)}
                                  className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-amber-500/30 flex items-center space-x-1 cursor-pointer"
                                  title="Actualizar datos de esta tarea o trabajo"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Actualizar</span>
                                </button>

                                {/* Botón alternar Cumplida */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleCompleteTask(t)}
                                  className={`p-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                                    isCompleted
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                                      : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
                                  }`}
                                  title={isCompleted ? "Marcar como pendiente" : "Marcar como cumplida"}
                                >
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                </button>

                                {/* Botón para Eliminar porque ya se cumplió */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteFulfilledTask(t)}
                                  className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-100 rounded-xl text-xs font-bold transition-all border border-rose-500/30 flex items-center space-x-1 cursor-pointer"
                                  title="Eliminar esta tarea porque ya se cumplió el trabajo"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                  <span>Eliminar (Cumplida)</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
              <span className="text-xs text-slate-400">
                Mostrando {modalFilteredTasks.length} de {tasks.length} trabajos pendientes
              </span>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAllTasksModal(false);
                    handleOpenAddModal();
                  }}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Nuevo Trabajo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAllTasksModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CARTEL DE CONFIRMACIÓN DE SEGURIDAD: ELIMINAR TODOS LOS TRABAJOS */}
      {/* ------------------------------------------------------------- */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border-2 border-rose-500/50 rounded-3xl p-6 w-full max-w-lg text-white shadow-2xl space-y-5">
            <div className="flex items-start space-x-4">
              <div className="p-3.5 bg-rose-500/20 text-rose-400 border border-rose-500/40 rounded-2xl shrink-0">
                <AlertTriangle className="w-7 h-7 text-rose-400" />
              </div>
              <div className="space-y-1">
                <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider font-mono">
                  Confirmación de Seguridad
                </span>
                <h3 className="text-lg font-black text-white tracking-tight">
                  ¿Eliminar todos los trabajos registrados?
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Está a punto de eliminar permanentemente <strong className="text-rose-300">{tasks.length} {tasks.length === 1 ? 'trabajo registrado' : 'trabajos registrados'}</strong> de la tabla. Esta acción no se puede deshacer.
                </p>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs text-slate-300">
              <div className="flex items-center space-x-2 text-amber-300 font-bold">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Información importante:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1 text-[11px]">
                <li>Se eliminarán todas las tareas creadas y sus números de servicio asociados.</li>
                <li>Los datos de su archivo Excel cargado en la aplicación permanecerán intactos.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                disabled={isDeletingAll}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAll}
                disabled={isDeletingAll}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-rose-600/30 flex items-center space-x-2 cursor-pointer"
              >
                {isDeletingAll ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Sí, eliminar todos los trabajos</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL PARA AGREGAR / EDITAR TRABAJO PENDIENTE */}
      {/* ------------------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-2xl text-white shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    {editingTask ? 'Editar Trabajo Pendiente' : 'Nuevo Trabajo Pendiente por Cable'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Defina el cable, los servicios afectados y la descripción del trabajo a ejecutar.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-4">
              {/* Cable & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                    <Cable className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Cable Específico *</span>
                  </label>
                  <input
                    type="text"
                    list="cables-list"
                    placeholder="Ej. CABLE-01, CR-101..."
                    value={formCable}
                    onChange={(e) => setFormCable(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <datalist id="cables-list">
                    {(excelData?.uniqueCables || []).map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>

                  {/* Sugerencia de Cable si los números pegados coinciden con uno en el reporte */}
                  {suggestedCableFromPasted && formCable !== suggestedCableFromPasted.cable && (
                    <div className="flex items-center justify-between p-2 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-300 mt-1.5">
                      <div className="flex items-center space-x-1.5 truncate">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">
                          Cable detectado en reporte: <strong>{suggestedCableFromPasted.cable}</strong> ({suggestedCableFromPasted.count} servicios)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormCable(suggestedCableFromPasted.cable)}
                        className="ml-2 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[10px] transition-colors cursor-pointer shrink-0"
                      >
                        Asignar
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Estado del Trabajo</span>
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="pending">Pendiente</option>
                    <option value="in_progress">En Ejecución</option>
                    <option value="completed">Completado</option>
                  </select>
                </div>
              </div>

              {/* Tarea o Trabajo a Realizar */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                  <Wrench className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tarea o Trabajo a Realizar *</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Reparación de empalme en cámara 4, cambio de acometida, despeje..."
                  value={formTaskName}
                  onChange={(e) => setFormTaskName(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Terminal */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  <span>Terminal (Opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: T-04, 12, Terminal 04 (o se busca automáticamente en la columna TERMINAL del Excel)"
                  value={formTerminalDir}
                  onChange={(e) => setFormTerminalDir(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Casilla Opcional: Afectación Especial (Motivo y Rango de Fechas) */}
              <div className="bg-slate-950/80 border border-purple-500/40 rounded-2xl p-3.5 space-y-3">
                <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formHasAfectacion}
                    onChange={(e) => setFormHasAfectacion(e.target.checked)}
                    className="w-4 h-4 rounded border-purple-500 text-purple-600 focus:ring-0 cursor-pointer"
                  />
                  <div className="flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-purple-200">
                      ¿Asociar a una Afectación con rango de fechas? (Opcional)
                    </span>
                  </div>
                </label>

                {formHasAfectacion && (
                  <div className="pt-2.5 border-t border-purple-900/40 space-y-3">
                    {/* Motivo de la afectación */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-purple-200 flex items-center space-x-1">
                        <span>Motivo de la Afectación *</span>
                        <span className="text-[10px] text-purple-400 font-normal">(Ej. Huracán, Inundación, Incendio, Avería Masiva)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Huracán"
                        value={formAfectacionMotivo}
                        onChange={(e) => setFormAfectacionMotivo(e.target.value)}
                        required={formHasAfectacion}
                        className="w-full bg-slate-900 border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
                      />
                    </div>

                    {/* Rango de Fechas */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-purple-200 flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-purple-400" />
                          <span>Fecha Inicio Afectación</span>
                        </label>
                        <input
                          type="date"
                          value={formAfectacionFechaInicio}
                          onChange={(e) => handleAfectacionStartDateChange(e.target.value)}
                          className="w-full bg-slate-900 border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 [color-scheme:dark]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-purple-200 flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-purple-400" />
                          <span>Fecha Fin Afectación</span>
                        </label>
                        <input
                          type="date"
                          value={formAfectacionFechaFin}
                          onChange={(e) => handleAfectacionEndDateChange(e.target.value)}
                          className="w-full bg-slate-900 border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 [color-scheme:dark]"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-purple-950/40 border border-purple-800/40 p-2.5 rounded-xl text-[11px] text-purple-300">
                      <span>
                        Los servicios reportados en este período mostrarán <strong>"{formAfectacionMotivo || 'el motivo'}"</strong> en la columna <strong>AFECTACIONES</strong>.
                      </span>
                      {cableAvailableServices.length > 0 && (formAfectacionFechaInicio || formAfectacionFechaFin) && (
                        <button
                          type="button"
                          onClick={handleSelectServicesInAfectacionRange}
                          className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] rounded-lg transition-colors shrink-0 cursor-pointer"
                        >
                          Auto-seleccionar servicios del cable en este rango
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Servicios Específicos de este Cable */}
              <div className="space-y-3 border-t border-slate-800 pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>
                      Servicios Afectados ({totalCombinedServicesCount} en total)
                    </span>
                  </label>
                  {cableAvailableServices.length > 0 && (
                    <button
                      type="button"
                      onClick={handleToggleSelectAllCableServices}
                      className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                    >
                      {cableAvailableServices.every(s => selectedServicesSet.has(s.servicio.toUpperCase()))
                        ? 'Deseleccionar todos'
                        : `Seleccionar todos de este cable (${cableAvailableServices.length})`}
                    </button>
                  )}
                </div>

                {/* Cable Services Checkbox List from Excel */}
                {cableAvailableServices.length > 0 && (
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 max-h-36 overflow-y-auto space-y-1.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-slate-400 uppercase font-mono block">
                        Servicios detectados en Excel para cable "{formCable}":
                      </span>
                      <span className="text-[10px] text-cyan-400 font-mono">
                        {selectedServicesSet.size} de {cableAvailableServices.length} seleccionados
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {cableAvailableServices.map(srv => {
                        const isChecked = selectedServicesSet.has(srv.servicio.toUpperCase());
                        return (
                          <label
                            key={srv.id}
                            className={`flex items-center space-x-2 p-1.5 rounded-lg border text-xs font-mono cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-200'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleServiceCheckbox(srv.servicio)}
                              className="rounded border-slate-700 text-cyan-600 focus:ring-0"
                            />
                            <span className="truncate">{srv.servicio}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pegado Inteligente de Columna de Excel */}
                <div className="space-y-2 bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-slate-200">
                        Pegar columna de números desde Excel
                      </span>
                      {parsedPastedServices.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                          {parsedPastedServices.length} detectados
                        </span>
                      )}
                    </div>

                    {/* Botones de acción rápida */}
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={handlePasteFromClipboard}
                        className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                        title="Pegar lo copiado de la columna de Excel"
                      >
                        <Clipboard className="w-3 h-3" />
                        <span>Pegar Portapapeles</span>
                      </button>
                      {parsedPastedServices.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={handleCleanAndFormatPasted}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-medium transition-colors cursor-pointer"
                            title="Limpiar y ordenar números en una sola columna"
                          >
                            Formatear
                          </button>
                          <button
                            type="button"
                            onClick={handleClearPasted}
                            className="px-2 py-1 bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-300 rounded-lg text-[10px] font-medium transition-colors cursor-pointer"
                            title="Vaciar recuadro"
                          >
                            Vaciar
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Copie una columna de números en su Excel y péguela aquí (Ctrl + V). El sistema ignora encabezados ("Servicio", "Teléfono"), comillas y saltos de fila automáticamente.
                  </p>

                  <textarea
                    rows={3}
                    placeholder="0212000001&#10;0212000002&#10;0212000003..."
                    value={formServiceInput}
                    onChange={(e) => setFormServiceInput(e.target.value)}
                    onPaste={handlePasteInTextarea}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 min-h-[75px] max-h-44 resize-y"
                  />

                  {pasteFeedbackMessage && (
                    <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{pasteFeedbackMessage}</span>
                    </div>
                  )}

                  {/* Vista previa con chips de números pegados */}
                  {parsedPastedServices.length > 0 && (
                    <div className="space-y-1.5 pt-1.5 border-t border-slate-800/80">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Vista previa de números pegados ({parsedPastedServices.length}):</span>
                        {matchedServicesInExcelCount > 0 && (
                          <span className="text-emerald-400 font-medium">
                            ✓ {matchedServicesInExcelCount} coinciden en el reporte consolidado
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-900/60 rounded-xl border border-slate-800">
                        {parsedPastedServices.map((srv, idx) => {
                          const inReport = excelServicesMap.has(srv.toUpperCase());
                          return (
                            <span
                              key={`${srv}-${idx}`}
                              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono border ${
                                inReport
                                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                                  : 'bg-slate-800/80 border-slate-700 text-slate-300'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${inReport ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                              <span>{srv}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveOnePastedNumber(srv)}
                                className="hover:text-red-400 ml-0.5 text-slate-500 hover:text-slate-200 transition-colors cursor-pointer"
                                title="Quitar este número"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl transition-all shadow-lg shadow-amber-600/30 cursor-pointer"
                >
                  {editingTask ? 'Guardar Cambios' : 'Registrar Trabajo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL DE CARGA MASIVA DE TRABAJOS DESDE EXCEL */}
      {/* ------------------------------------------------------------- */}
      <CableBatchTasksImportModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        onImport={handleBatchImportSuccess}
        existingTasks={tasks}
        excelServicesMap={excelServicesMap}
        availableCables={excelData?.uniqueCables || []}
      />

      {/* ------------------------------------------------------------- */}
      {/* MODAL PARA GESTIÓN DE AFECTACIONES INDEPENDIENTES */}
      {/* ------------------------------------------------------------- */}
      {showAfectacionesModal && (
        <CableAfectacionesModal
          isOpen={showAfectacionesModal}
          onClose={() => setShowAfectacionesModal(false)}
          excelData={excelData}
        />
      )}
    </div>
  );
};
