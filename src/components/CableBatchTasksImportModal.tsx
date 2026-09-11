import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Wrench,
  Cable as CableIcon,
  Users,
  Check,
  Trash2,
  Copy,
  Info,
  Layers,
  ArrowRight,
  Filter,
  PlusCircle,
  Clock
} from 'lucide-react';
import { CablePendingTask, IpCableRow } from '../types/ipCablesTypes';

interface CableBatchTasksImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (
    updatedTasks: CablePendingTask[],
    stats: { createdCount: number; mergedCount: number; totalServices: number }
  ) => void;
  existingTasks: CablePendingTask[];
  excelServicesMap: Map<string, IpCableRow>;
  availableCables?: string[];
}

export interface ParsedBatchEntry {
  service: string;
  taskName: string;
  cable?: string;
  terminal?: string;
  afectacionMotivo?: string;
}

export interface GroupedBatchTaskPreview {
  groupKey: string;
  taskName: string;
  cable: string;
  services: string[];
  hasAfectacion: boolean;
  afectacionMotivo?: string;
  afectacionFechaInicio?: string;
  afectacionFechaFin?: string;
  cableSource: 'excel_row' | 'report_auto' | 'default';
  matchedExistingTask?: CablePendingTask;
}

const EXCEL_HEADER_WORDS = new Set([
  'SERVICIO', 'SERVICIOS', 'TELEFONO', 'TELEFONOS', 'TELÉFONO', 'TELÉFONOS',
  'NUMERO', 'NUMEROS', 'NÚMERO', 'NÚMEROS', 'NRO', 'N°', 'LINEA', 'LINEAS',
  'LÍNEA', 'LÍNEAS', 'ABONADO', 'ABONADOS', 'CLIENTE', 'CLIENTES', 'CABLE', 'PAR',
  'TELEF', 'TLF', 'SERIAL', 'ID', 'CODIGO', 'CÓDIGO', 'TRABAJO', 'TAREA', 'ACTIVIDAD',
  'AFECTACION', 'AFECTACIÓN', 'MOTIVO'
]);

export const CableBatchTasksImportModal: React.FC<CableBatchTasksImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingTasks,
  excelServicesMap,
  availableCables = []
}) => {
  const [inputText, setInputText] = useState<string>('');
  const [format, setFormat] = useState<
    'auto' | 'service_task' | 'service_task_cable' | 'service_task_cable_afectacion' | 'service_task_afectacion'
  >('auto');

  // Afectación Global
  const [hasGlobalAfectacion, setHasGlobalAfectacion] = useState<boolean>(false);
  const [globalAfectacionMotivo, setGlobalAfectacionMotivo] = useState<string>('');
  const [globalFechaInicio, setGlobalFechaInicio] = useState<string>('');
  const [globalFechaFin, setGlobalFechaFin] = useState<string>('');

  // Opciones de Carga
  const [mergeWithExisting, setMergeWithExisting] = useState<boolean>(true);
  const [defaultPriority, setDefaultPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');

  // Filtro de búsqueda en la previsualización
  const [previewSearch, setPreviewSearch] = useState<string>('');
  const [showOnlyWithAfectacion, setShowOnlyWithAfectacion] = useState<boolean>(false);

  // Parse raw text into structured entries
  const parsedEntries = useMemo<ParsedBatchEntry[]>(() => {
    if (!inputText.trim()) return [];

    const lines = inputText.split(/\r?\n/);
    const entries: ParsedBatchEntry[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      let cols: string[] = [];
      if (line.includes('\t')) {
        cols = line.split('\t');
      } else if (line.includes(';')) {
        cols = line.split(';');
      } else if (line.includes(',') && !line.includes(' - ')) {
        cols = line.split(',');
      } else {
        cols = line.split(/\s{2,}/);
      }

      cols = cols.map(c => c.replace(/^=["']|["']$/g, '').trim());
      if (cols.length === 0) continue;

      // Detect header row
      const firstUpper = (cols[0] || '').toUpperCase();
      const secondUpper = (cols[1] || '').toUpperCase();
      if (
        EXCEL_HEADER_WORDS.has(firstUpper) ||
        firstUpper.includes('SERVICIO') ||
        firstUpper.includes('TELEFONO') ||
        secondUpper.includes('TRABAJO') ||
        secondUpper.includes('TAREA')
      ) {
        continue;
      }

      let service = '';
      let taskName = '';
      let cable = '';
      let afectacion = '';

      if (format === 'service_task') {
        service = cols[0] || '';
        taskName = cols.slice(1).join(' ') || '';
      } else if (format === 'service_task_cable') {
        service = cols[0] || '';
        taskName = cols[1] || '';
        cable = cols.slice(2).join(' ') || '';
      } else if (format === 'service_task_cable_afectacion') {
        service = cols[0] || '';
        taskName = cols[1] || '';
        cable = cols[2] || '';
        afectacion = cols.slice(3).join(' ') || '';
      } else if (format === 'service_task_afectacion') {
        service = cols[0] || '';
        taskName = cols[1] || '';
        afectacion = cols.slice(2).join(' ') || '';
      } else {
        // 'auto' mode
        if (cols.length >= 4) {
          service = cols[0] || '';
          taskName = cols[1] || '';
          cable = cols[2] || '';
          afectacion = cols.slice(3).join(' ') || '';
        } else if (cols.length === 3) {
          service = cols[0] || '';
          taskName = cols[1] || '';
          const col3 = cols[2] || '';
          if (/^CABLE/i.test(col3) || /^C\d+/i.test(col3) || /^\d{1,3}$/.test(col3) || /^CAB/i.test(col3)) {
            cable = col3;
          } else {
            afectacion = col3;
          }
        } else if (cols.length === 2) {
          service = cols[0] || '';
          taskName = cols[1] || '';
        } else {
          // 1 col, check if separated by spaces
          const parts = cols[0].split(/\s+/);
          if (parts.length >= 2) {
            service = parts[0];
            taskName = parts.slice(1).join(' ');
          } else {
            service = cols[0];
            taskName = 'Trabajo sin especificar';
          }
        }
      }

      // Clean digits
      const digitsOnly = service.replace(/[\s\-\.\(\)]/g, '');
      const cleanService = (digitsOnly.length >= 6 && /^\d+$/.test(digitsOnly)) ? digitsOnly : service.trim().toUpperCase();

      if (!cleanService) continue;

      entries.push({
        service: cleanService,
        taskName: taskName.trim() || 'Trabajo General',
        cable: cable.trim(),
        afectacionMotivo: afectacion.trim()
      });
    }

    return entries;
  }, [inputText, format]);

  // Group entries into consolidated tasks
  const groupedTasks = useMemo<GroupedBatchTaskPreview[]>(() => {
    if (parsedEntries.length === 0) return [];

    const map = new Map<string, GroupedBatchTaskPreview>();

    parsedEntries.forEach(entry => {
      let cable = entry.cable || '';
      let cableSource: 'excel_row' | 'report_auto' | 'default' = 'excel_row';

      if (!cable) {
        // Auto-lookup in active report
        const sKey = entry.service.toUpperCase();
        let matched = excelServicesMap.get(sKey);
        if (!matched) {
          const digits = sKey.replace(/\D/g, '');
          if (digits) {
            matched = excelServicesMap.get(digits) || excelServicesMap.get(digits.replace(/^0+/, ''));
          }
        }

        if (matched) {
          cable = matched.cableP || matched.cable || '';
          if (cable) cableSource = 'report_auto';
        }
      }

      if (!cable) {
        cable = 'CABLE GENERAL';
        cableSource = 'default';
      }

      // Afectación logic
      let hasAfectacion = false;
      let afectacionMotivo = '';
      let fechaInicio = '';
      let fechaFin = '';

      if (hasGlobalAfectacion) {
        hasAfectacion = true;
        afectacionMotivo = globalAfectacionMotivo.trim() || 'Afectación General';
        fechaInicio = globalFechaInicio;
        fechaFin = globalFechaFin;
      } else if (entry.afectacionMotivo) {
        const rowAfec = entry.afectacionMotivo.trim();
        if (rowAfec && rowAfec.toLowerCase() !== 'sin afectacion' && rowAfec.toLowerCase() !== 'sin afectación' && rowAfec !== '-') {
          hasAfectacion = true;
          afectacionMotivo = rowAfec;
          fechaInicio = globalFechaInicio;
          fechaFin = globalFechaFin;
        }
      }

      const normTask = entry.taskName.trim();
      const normCable = cable.trim().toUpperCase();
      const normAfec = hasAfectacion ? afectacionMotivo.trim().toUpperCase() : 'NO_AFEC';

      const groupKey = `${normTask.toUpperCase()}___${normCable}___${normAfec}`;

      if (!map.has(groupKey)) {
        // Check if matches existing task
        const matched = existingTasks.find(
          t => t.taskName.trim().toUpperCase() === normTask.toUpperCase() &&
               t.cable.trim().toUpperCase() === normCable
        );

        map.set(groupKey, {
          groupKey,
          taskName: normTask,
          cable: normCable,
          services: [],
          hasAfectacion,
          afectacionMotivo: hasAfectacion ? afectacionMotivo : undefined,
          afectacionFechaInicio: fechaInicio || undefined,
          afectacionFechaFin: fechaFin || undefined,
          cableSource,
          matchedExistingTask: matched
        });
      }

      const grp = map.get(groupKey)!;
      if (!grp.services.includes(entry.service)) {
        grp.services.push(entry.service);
      }
    });

    return Array.from(map.values());
  }, [
    parsedEntries,
    excelServicesMap,
    existingTasks,
    hasGlobalAfectacion,
    globalAfectacionMotivo,
    globalFechaInicio,
    globalFechaFin
  ]);

  // Overall batch statistics
  const batchStats = useMemo(() => {
    const totalLines = parsedEntries.length;
    const uniqueServices = new Set(parsedEntries.map(e => e.service)).size;
    const tasksCount = groupedTasks.length;
    const withAfectacionCount = groupedTasks.filter(g => g.hasAfectacion).length;
    const toMergeCount = groupedTasks.filter(g => g.matchedExistingTask).length;
    const newTasksCount = tasksCount - toMergeCount;

    return {
      totalLines,
      uniqueServices,
      tasksCount,
      withAfectacionCount,
      toMergeCount,
      newTasksCount
    };
  }, [parsedEntries, groupedTasks]);

  // Filtered preview
  const filteredPreviewTasks = useMemo(() => {
    return groupedTasks.filter(g => {
      if (showOnlyWithAfectacion && !g.hasAfectacion) return false;
      if (previewSearch.trim()) {
        const q = previewSearch.toLowerCase();
        const matchTask = g.taskName.toLowerCase().includes(q);
        const matchCable = g.cable.toLowerCase().includes(q);
        const matchAfec = (g.afectacionMotivo || '').toLowerCase().includes(q);
        const matchSrv = g.services.some(s => s.toLowerCase().includes(q));
        if (!matchTask && !matchCable && !matchAfec && !matchSrv) return false;
      }
      return true;
    });
  }, [groupedTasks, previewSearch, showOnlyWithAfectacion]);

  // Handler to load realistic demo data
  const handleLoadDemoData = () => {
    const sample = [
      '78310012\tCambio de bajante y acometida\tCABLE 04\tLluvias e inundación',
      '78310013\tCambio de bajante y acometida\tCABLE 04\tLluvias e inundación',
      '78310014\tCambio de bajante y acometida\tCABLE 04\tLluvias e inundación',
      '78320455\tReparación de terminal y bornes\tCABLE 12\tHuracán',
      '78320456\tReparación de terminal y bornes\tCABLE 12\tHuracán',
      '78320457\tReparación de terminal y bornes\tCABLE 12\tHuracán',
      '78350119\tEmpalme primario par 14\tCABLE 01\tSin afectación',
      '78350120\tEmpalme primario par 14\tCABLE 01\tSin afectación'
    ].join('\n');

    setInputText(sample);
    setFormat('auto');
  };

  // Submit and confirm import
  const handleConfirmImport = () => {
    if (groupedTasks.length === 0) {
      alert('No hay datos válidos para importar. Copie y pegue filas desde Excel en el cuadro de texto.');
      return;
    }

    if (hasGlobalAfectacion && !globalAfectacionMotivo.trim()) {
      alert('Por favor especifique el Motivo de la Afectación Global o desactive la opción.');
      return;
    }

    let updatedTasks = [...existingTasks];
    let createdCount = 0;
    let mergedCount = 0;
    let totalServicesCount = 0;

    groupedTasks.forEach(grp => {
      totalServicesCount += grp.services.length;

      if (mergeWithExisting && grp.matchedExistingTask) {
        // Merge into existing task
        updatedTasks = updatedTasks.map(t => {
          if (t.id === grp.matchedExistingTask!.id) {
            const currentServices = t.serviceNumbers || [];
            const unionSet = new Set([...currentServices, ...grp.services]);
            mergedCount++;
            return {
              ...t,
              serviceNumbers: Array.from(unionSet),
              hasAfectacion: grp.hasAfectacion ? true : t.hasAfectacion,
              afectacionMotivo: grp.hasAfectacion ? (grp.afectacionMotivo || t.afectacionMotivo) : t.afectacionMotivo,
              afectacionFechaInicio: grp.afectacionFechaInicio || t.afectacionFechaInicio,
              afectacionFechaFin: grp.afectacionFechaFin || t.afectacionFechaFin,
              updatedAt: new Date().toISOString()
            };
          }
          return t;
        });
      } else {
        // Create new task
        const newTask: CablePendingTask = {
          id: `task-batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          cable: grp.cable,
          taskName: grp.taskName,
          status: 'pending',
          priority: defaultPriority,
          serviceNumbers: grp.services,
          hasAfectacion: grp.hasAfectacion,
          afectacionMotivo: grp.afectacionMotivo,
          afectacionFechaInicio: grp.afectacionFechaInicio,
          afectacionFechaFin: grp.afectacionFechaFin,
          createdAt: new Date().toISOString()
        };
        updatedTasks = [newTask, ...updatedTasks];
        createdCount++;
      }
    });

    onImport(updatedTasks, {
      createdCount,
      mergedCount,
      totalServices: totalServicesCount
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-5xl text-white shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase px-2 py-0.5 rounded-full font-mono">
                  Carga Masiva
                </span>
                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md font-mono">
                  Multi-Servicios & Trabajos
                </span>
              </div>
              <h3 className="text-lg font-black text-white tracking-tight mt-0.5">
                Importar Trabajos en Masa desde Excel
              </h3>
              <p className="text-xs text-slate-400">
                Copie filas completas desde su hoja de cálculo y péguelas directamente. Los números con la misma tarea se agrupan automáticamente.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar">
          {/* Instrucciones y Formatos */}
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
            <div className="flex items-start space-x-2.5">
              <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-slate-200">
                  Formato compatible para copiar y pegar desde Excel:
                </span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Seleccione las columnas en Excel y presione <kbd className="bg-slate-800 text-slate-300 px-1 py-0.5 rounded text-[10px]">Ctrl+C</kbd>. El orden estándar es:
                  <strong className="text-emerald-300 ml-1">[Número/Servicio]</strong> &rarr;
                  <strong className="text-blue-300 ml-1">[Trabajo o Tarea]</strong> &rarr;
                  <strong className="text-amber-300 ml-1">[Cable (Opcional)]</strong> &rarr;
                  <strong className="text-purple-300 ml-1">[Afectación (Opcional)]</strong>.
                  Si el cable no viene, el sistema lo busca en el Excel de averías cargado.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
              <button
                type="button"
                onClick={handleLoadDemoData}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cargar Ejemplo</span>
              </button>
              {inputText && (
                <button
                  type="button"
                  onClick={() => setInputText('')}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-700 text-[11px] font-bold rounded-xl transition-all flex items-center space-x-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpiar</span>
                </button>
              )}
            </div>
          </div>

          {/* Selector de Formato & Controles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Formato de Columnas</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="auto">Auto-detectar columnas</option>
                <option value="service_task">Col 1: Servicio | Col 2: Trabajo</option>
                <option value="service_task_cable">Col 1: Servicio | Col 2: Trabajo | Col 3: Cable</option>
                <option value="service_task_cable_afectacion">Col 1: Servicio | Col 2: Trabajo | Col 3: Cable | Col 4: Afectación</option>
                <option value="service_task_afectacion">Col 1: Servicio | Col 2: Trabajo | Col 3: Afectación</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Prioridad Predeterminada</label>
              <select
                value={defaultPriority}
                onChange={(e) => setDefaultPriority(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="low">Baja</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>

            <div className="sm:col-span-2 flex items-end">
              <label className="flex items-center space-x-2.5 p-2 bg-slate-950/70 border border-slate-800 rounded-xl cursor-pointer w-full h-[38px]">
                <input
                  type="checkbox"
                  checked={mergeWithExisting}
                  onChange={(e) => setMergeWithExisting(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-900 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs text-slate-300 select-none">
                  Fusionar con trabajos existentes si coinciden <strong>nombre y cable</strong>
                </span>
              </label>
            </div>
          </div>

          {/* Textarea para pegar desde Excel */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pegue los datos aquí (Ctrl + V desde Excel) *</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                {parsedEntries.length > 0 ? `${parsedEntries.length} filas detectadas` : 'Vacío'}
              </span>
            </div>
            <textarea
              rows={6}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Copie desde su Excel las filas y péguelas aquí...&#10;Ejemplo:&#10;78310012	Cambio de bajante	CABLE 04	Huracán&#10;78310013	Cambio de bajante	CABLE 04	Huracán&#10;78320455	Reparación de caja	CABLE 12	Lluvias"
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Sección de Afectación (Global u Opcional) */}
          <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasGlobalAfectacion}
                  onChange={(e) => setHasGlobalAfectacion(e.target.checked)}
                  className="rounded border-slate-700 text-purple-500 focus:ring-purple-500 bg-slate-900 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-extrabold text-purple-300 flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-purple-400" />
                  <span>Aplicar Afectación Global a todo este lote pegado</span>
                </span>
              </label>
              <span className="text-[11px] text-slate-400 italic">
                {hasGlobalAfectacion
                  ? 'Sobrescribe o asigna afectación a todos los trabajos'
                  : 'Se usará la afectación indicada en la columna del Excel (si existe)'}
              </span>
            </div>

            {hasGlobalAfectacion && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80 animate-in fade-in">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400">Motivo de la Afectación *</label>
                  <input
                    type="text"
                    list="batch-afectacion-suggestions"
                    placeholder="Ej. Huracán, Inundaciones..."
                    value={globalAfectacionMotivo}
                    onChange={(e) => setGlobalAfectacionMotivo(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                  <datalist id="batch-afectacion-suggestions">
                    <option value="Huracán / Ciclón" />
                    <option value="Lluvias e inundaciones" />
                    <option value="Vandalismo de cable de red" />
                    <option value="Rotura por obras civiles" />
                    <option value="Falla de fluido eléctrico" />
                  </datalist>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400">Fecha Inicio (Opcional)</label>
                  <input
                    type="date"
                    value={globalFechaInicio}
                    onChange={(e) => setGlobalFechaInicio(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400">Fecha Fin (Opcional)</label>
                  <input
                    type="date"
                    value={globalFechaFin}
                    onChange={(e) => setGlobalFechaFin(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Tarjetas de Resumen KPI de la Carga Masiva */}
          {parsedEntries.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Filas Procesadas
                </span>
                <span className="text-xl font-black font-mono text-white mt-0.5 block">
                  {batchStats.totalLines}
                </span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Servicios Únicos
                </span>
                <span className="text-xl font-black font-mono text-emerald-400 mt-0.5 block">
                  {batchStats.uniqueServices}
                </span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Trabajos Consolidados
                </span>
                <div className="flex items-baseline space-x-1 mt-0.5">
                  <span className="text-xl font-black font-mono text-blue-400">
                    {batchStats.tasksCount}
                  </span>
                  {mergeWithExisting && batchStats.toMergeCount > 0 && (
                    <span className="text-[10px] text-amber-400 font-mono">
                      ({batchStats.toMergeCount} a fusionar)
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Con Afectación
                </span>
                <span className="text-xl font-black font-mono text-purple-400 mt-0.5 block">
                  {batchStats.withAfectacionCount}
                </span>
              </div>
            </div>
          )}

          {/* Previsualización en Tiempo Real de Trabajos Agrupados */}
          {groupedTasks.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Vista Previa de Trabajos a Registrar ({filteredPreviewTasks.length})</span>
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    (Se crearán o actualizarán estas tareas consolidadas)
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar en vista previa..."
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-[11px] text-white pl-7 w-48 focus:outline-none focus:border-emerald-500"
                    />
                    <Filter className="w-3 h-3 text-slate-500 absolute left-2.5 top-2" />
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowOnlyWithAfectacion(!showOnlyWithAfectacion)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                      showOnlyWithAfectacion
                        ? 'bg-purple-950/70 border-purple-500/50 text-purple-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Solo con afectación
                  </button>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto border border-slate-800 rounded-2xl bg-slate-950/60 custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950 sticky top-0 border-b border-slate-800 text-[11px] text-slate-400 uppercase font-black tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Trabajo / Tarea</th>
                      <th className="py-2.5 px-3">Cable</th>
                      <th className="py-2.5 px-3 text-center">Cant. Servicios</th>
                      <th className="py-2.5 px-3">Afectación</th>
                      <th className="py-2.5 px-3">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredPreviewTasks.map((grp, idx) => (
                      <tr key={grp.groupKey} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-extrabold text-white text-xs">{grp.taskName}</div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center space-x-1 font-mono font-bold text-amber-300 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-md text-[11px]">
                            <CableIcon className="w-3 h-3 text-amber-400" />
                            <span>{grp.cable}</span>
                          </span>
                          {grp.cableSource === 'report_auto' && (
                            <span className="ml-1 text-[10px] text-emerald-400" title="Cable deducido automáticamente de averías activas">
                              (Auto)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-xs">
                            <Users className="w-3 h-3 text-emerald-400" />
                            <span>{grp.services.length}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {grp.hasAfectacion ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-purple-950/60 border border-purple-500/40 text-purple-300 text-[11px] font-bold">
                              <AlertTriangle className="w-3 h-3 text-purple-400" />
                              <span>{grp.afectacionMotivo}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px] italic">Sin afectación</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {mergeWithExisting && grp.matchedExistingTask ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-950/60 border border-blue-500/40 text-blue-300 text-[10px] font-bold">
                              <Sparkles className="w-3 h-3 text-blue-400" />
                              <span>Se fusionará</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                              <PlusCircle className="w-3 h-3 text-emerald-400" />
                              <span>Nueva tarea</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/80 shrink-0">
          <div className="text-xs text-slate-400">
            {groupedTasks.length > 0 ? (
              <span>
                Listo para procesar <strong className="text-emerald-300">{batchStats.tasksCount} tareas</strong> y <strong className="text-blue-300">{batchStats.uniqueServices} servicios</strong>.
              </span>
            ) : (
              <span>Pegue datos desde su Excel para activar la importación masiva.</span>
            )}
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={groupedTasks.length === 0}
              onClick={handleConfirmImport}
              className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-emerald-600/30 flex items-center space-x-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>
                {groupedTasks.length > 0
                  ? `Confirmar e Importar (${groupedTasks.length} Trabajos)`
                  : 'Importar Trabajos'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
