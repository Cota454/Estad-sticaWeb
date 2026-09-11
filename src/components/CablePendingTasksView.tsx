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
  Table as TableIcon
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

interface CablePendingTasksViewProps {
  excelData: IpCableExcelParseResult | null;
  centrales?: Central[];
  workGroups?: WorkGroup[];
}

export const CablePendingTasksView: React.FC<CablePendingTasksViewProps> = ({
  excelData,
  centrales = [],
  workGroups = []
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

  // UI Feedback
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);

  // Save tasks and update state
  const handleUpdateTasks = (updated: CablePendingTask[]) => {
    setTasks(updated);
    saveCablePendingTasks(updated);
  };

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
  // -------------------------------------------------------------
  const allDetailRows = useMemo<CableTaskServiceDetailRow[]>(() => {
    const rows: CableTaskServiceDetailRow[] = [];

    tasks.forEach(task => {
      const services = task.serviceNumbers && task.serviceNumbers.length > 0
        ? task.serviceNumbers
        : ['SIN_SERVICIO'];

      services.forEach((srvNum, idx) => {
        const sKey = (srvNum || '').trim().toUpperCase();
        const matchedRow = excelServicesMap.get(sKey);

        const rowId = `${task.id}-${sKey}-${idx}`;
        const associated = matchedRow
          ? (matchedRow.rawRowData['ASOCIADO'] || matchedRow.rawRowData['Asociado'] || matchedRow.rawRowData['TELEFONO ASOCIADO'] || matchedRow.rawRowData['TELEFONO'] || '-')
          : '-';
        const cableP = matchedRow ? (matchedRow.cableP || matchedRow.rawRowData['Cable P'] || '-') : task.cable || '-';
        const parP = matchedRow ? (matchedRow.parP || matchedRow.rawRowData['Par P'] || '-') : '-';
        const cableS = matchedRow ? (matchedRow.cableS || matchedRow.rawRowData['Cable S'] || '-') : '-';
        const parS = matchedRow ? (matchedRow.parS || matchedRow.rawRowData['Par S'] || '-') : '-';
        const fechaReporte = matchedRow ? (matchedRow.fechaReporte || '-') : task.createdAt.slice(0, 10);
        const grupo = matchedRow ? (matchedRow.grupo || '-') : '-';
        const demoraEnDias = matchedRow ? getDemoraDays(matchedRow) : 0;
        const central = matchedRow ? (matchedRow.central || '-') : '-';

        // Terminal / Dirección: priority to task's terminalDireccion, fallback to rawRowData
        let terminalDir = task.terminalDireccion || '';
        if (!terminalDir && matchedRow) {
          const term = matchedRow.rawRowData['TERMINAL'] || matchedRow.rawRowData['Terminal'] || '';
          const dir = matchedRow.rawRowData['DIRECCION'] || matchedRow.rawRowData['Direccion'] || '';
          terminalDir = [term, dir].filter(Boolean).join(' · ') || '-';
        }
        if (!terminalDir) terminalDir = '-';

        // Afectaciones logic
        let afectacion = '-';
        if (task.hasAfectacion && task.afectacionMotivo) {
          const rowDateStr = (matchedRow?.fechaReporte || fechaReporte || '').trim().slice(0, 10);
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
          servicio: srvNum === 'SIN_SERVICIO' ? '(Sin servicios asignados)' : srvNum,
          asociado: String(associated),
          cableP: String(cableP),
          parP: String(parP),
          cableS: String(cableS),
          parS: String(parS),
          fechaReporte: String(fechaReporte),
          grupo: String(grupo),
          demoraEnDias: typeof demoraEnDias === 'number' ? demoraEnDias : 0,
          central: String(central),
          terminalDireccion: terminalDir,
          afectacion: afectacion,
          status: task.status || 'pending'
        });
      });
    });

    return rows;
  }, [tasks, excelServicesMap]);

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

    // Count unique services in tasks
    const allServicesSet = new Set<string>();
    const cableImpactMap: Record<string, number> = {};

    tasks.forEach(t => {
      const srvs = t.serviceNumbers || [];
      srvs.forEach(s => allServicesSet.add(s));
      const c = t.cable || 'SIN CABLE';
      cableImpactMap[c] = (cableImpactMap[c] || 0) + (srvs.length || 1);
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
      totalServicesAffected: allServicesSet.size,
      topImpactCable,
      topImpactCount,
      maxDemora,
      oldestService
    };
  }, [tasks, filteredRows]);

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
  const handleExportToExcel = () => {
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
      'Terminal Dirección': r.terminalDireccion,
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
      { wch: 28 }, // Terminal Dirección
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

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `trabajos_pendientes_cables_${dateStr}.xlsx`);
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
      'Terminal Dirección',
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
      r.terminalDireccion,
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
    setFormServiceInput(task.serviceNumbers.join(', '));
    setSelectedServicesSet(new Set(task.serviceNumbers.map(s => s.toUpperCase())));
    setFormHasAfectacion(task.hasAfectacion || false);
    setFormAfectacionMotivo(task.afectacionMotivo || '');
    setFormAfectacionFechaInicio(task.afectacionFechaInicio || '');
    setFormAfectacionFechaFin(task.afectacionFechaFin || '');
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

    // Merge manually typed services with checkbox selected services
    const typedServices = formServiceInput
      .split(/[\n,;\s]+/)
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);

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
      // Create new
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

            {/* New Task Button */}
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-lg shadow-amber-600/30 flex items-center space-x-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Agregar Trabajo</span>
            </button>
          </div>
        </div>

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
              Servicios Afectados
            </span>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-blue-400">{kpis.totalServicesAffected}</span>
              <span className="text-[11px] text-slate-400">retenidos</span>
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
        {/* Table Toolbar with Small Excel Download Icon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-black text-white">
              {viewMode === 'flat' ? 'Detalle de Servicios por Trabajo Pendiente' : 'Tareas Pendientes Agrupadas'}
            </h3>
            <span className="bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold">
              {filteredRows.length} registros
            </span>
          </div>

          <div className="flex items-center space-x-2">
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
        {/* Columnas requeridas: Servicio, Asociado, cable p, par p, cable s, par s, fecha reporte, grupo, demora en días, central telefónica, terminal dirección, afectaciones, tarea o trabajo */}
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
                  <th className="py-3 px-4 text-slate-300">Terminal Dirección</th>
                  <th className="py-3 px-3 text-center text-purple-400 font-bold">AFECTACIONES</th>
                  <th className="py-3 px-4 text-white font-black">Tarea o Trabajo</th>
                  <th className="py-3 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-medium">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-12 text-center text-slate-500 italic space-y-2">
                      <p className="text-sm">No se encontraron trabajos o servicios que coincidan con los filtros.</p>
                      <button
                        type="button"
                        onClick={handleOpenAddModal}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold rounded-xl border border-slate-700 transition-colors"
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

                        {/* 11. Terminal Dirección */}
                        <td className="py-2.5 px-4 text-slate-300 max-w-xs truncate" title={row.terminalDireccion}>
                          <div className="flex items-center space-x-1.5 truncate">
                            <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                            <span className="truncate">{row.terminalDireccion}</span>
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

              {/* Terminal / Dirección */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  <span>Terminal / Dirección (Opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Terminal 04 · Av. Principal cruce con Calle 2"
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
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Servicios Afectados ({selectedServicesSet.size} seleccionados)</span>
                  </label>
                  {cableAvailableServices.length > 0 && (
                    <button
                      type="button"
                      onClick={handleToggleSelectAllCableServices}
                      className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
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
                    <span className="text-[10px] text-slate-400 uppercase font-mono block mb-1">
                      Servicios detectados en Excel para cable "{formCable}":
                    </span>
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

                {/* Manual or Pasted Service Numbers Input */}
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 block">
                    O pegue números de servicio adicionales (separados por coma o saltos de línea):
                  </span>
                  <textarea
                    rows={2}
                    placeholder="Ej: 0212000001, 0212000002, 0212000003..."
                    value={formServiceInput}
                    onChange={(e) => setFormServiceInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500 resize-none"
                  />
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
    </div>
  );
};
