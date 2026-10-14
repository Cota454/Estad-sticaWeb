import React, { useState, useMemo } from 'react';
import { CableClassificationRules, IpCableRow, PriorityServiceItem } from '../types/ipCablesTypes';
import { saveCableRules } from '../utils/ipCablesStorage';
import { cleanCableName, isCableExactMatch, createPriorityServiceMatcher } from '../utils/ipCablesExcelParser';
import {
  Sliders,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Building2,
  Cable,
  Info,
  RefreshCw,
  CheckCircle2,
  FileSpreadsheet,
  Star,
  ClipboardPaste,
  Search,
  AlertTriangle
} from 'lucide-react';

interface CableClassificationViewProps {
  rules: CableClassificationRules;
  onRulesUpdated: (newRules: CableClassificationRules) => void;
  availableCables?: string[];
  availableCentrales?: string[];
  consolidatedRows?: IpCableRow[];
  fileName?: string;
  onForceResync?: () => void;
}

export const CableClassificationView: React.FC<CableClassificationViewProps> = ({
  rules,
  onRulesUpdated,
  availableCables = [],
  availableCentrales = [],
  consolidatedRows = [],
  fileName,
  onForceResync
}) => {
  // Notification toast state
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Servicios PRIORIDAD State (Cuadro 1)
  const [newPriorityInput, setNewPriorityInput] = useState<string>('');
  const [newPriorityComment, setNewPriorityComment] = useState<string>('');
  const [priorityError, setPriorityError] = useState<string>('');
  const [editingPriorityIdx, setEditingPriorityIdx] = useState<number | null>(null);
  const [editPriorityVal, setEditPriorityVal] = useState<string>('');
  const [editPriorityComment, setEditPriorityComment] = useState<string>('');
  const [isBulkPasteOpen, setIsBulkPasteOpen] = useState<boolean>(false);
  const [bulkPasteText, setBulkPasteText] = useState<string>('');
  const [bulkPasteDefaultComment, setBulkPasteDefaultComment] = useState<string>('');
  const [prioritySearchTerm, setPrioritySearchTerm] = useState<string>('');

  // Red Flexible Input
  const [flexPattern, setFlexPattern] = useState<string>('');
  const [flexAssignedName, setFlexAssignedName] = useState<string>('');
  const [editingFlexId, setEditingFlexId] = useState<string | null>(null);
  const [editFlexPattern, setEditFlexPattern] = useState<string>('');
  const [editFlexAssignedName, setEditFlexAssignedName] = useState<string>('');

  // Outdoor Input
  const [outdoorPattern, setOutdoorPattern] = useState<string>('');
  const [outdoorAssignedName, setOutdoorAssignedName] = useState<string>('');
  const [editingOutdoorId, setEditingOutdoorId] = useState<string | null>(null);
  const [editOutdoorPattern, setEditOutdoorPattern] = useState<string>('');
  const [editOutdoorAssignedName, setEditOutdoorAssignedName] = useState<string>('');

  // -------------------------------------------------------------
  // SYNCHRONIZATION WITH TAB 1 (Excel Data)
  // -------------------------------------------------------------
  // Extract unique clean values present specifically in the Cable P column of the loaded Excel
  const detectedCablePList = useMemo(() => {
    if (!consolidatedRows || consolidatedRows.length === 0) return [];
    const cableSet = new Set<string>();
    consolidatedRows.forEach(row => {
      const rawP = row.cableP || (row.rawRowData && (row.rawRowData['Cable P'] || row.rawRowData['CABLE P'])) || '';
      if (rawP) {
        rawP.split(/[\/,;]+/).forEach(p => {
          const cleaned = cleanCableName(p).trim().toUpperCase();
          if (cleaned && cleaned !== '-' && cleaned !== 'SIN CABLE') {
            cableSet.add(cleaned);
          }
        });
      }
    });
    return Array.from(cableSet).sort();
  }, [consolidatedRows]);

  // Check if a specific Cable P name is already matched by flexible rules
  const isCableMatchedByFlexibleRules = (cableName: string) => {
    const targetClean = cleanCableName(cableName).trim().toUpperCase();
    if (!targetClean) return false;
    return rules.flexibleRules.some(r => {
      const rawPatterns = (r.pattern || '').split(',');
      return rawPatterns.some(p => {
        const pat = cleanCableName(p).trim().toUpperCase();
        return pat && (pat === targetClean || isCableExactMatch(cableName, pat));
      });
    });
  };

  // Count services in the current Excel report that match a given flexible pattern string in Cable P
  const getRuleMatchCount = (patternStr: string) => {
    if (!consolidatedRows || consolidatedRows.length === 0 || !patternStr) return 0;
    const rawPatterns = patternStr.split(',');
    return consolidatedRows.filter(row => {
      const rawP = row.cableP || (row.rawRowData && (row.rawRowData['Cable P'] || row.rawRowData['CABLE P'])) || '';
      if (!rawP) return false;
      return rawPatterns.some(p => {
        const pat = cleanCableName(p).trim().toUpperCase();
        if (!pat) return false;
        const normP = cleanCableName(rawP).trim().toUpperCase();
        return (normP && (normP === pat || isCableExactMatch(rawP, pat))) || (cleanCableName(rawP).trim().toUpperCase() === pat);
      });
    }).length;
  };

  // Total count of rows classified as flexible in consolidatedRows
  const flexibleServicesCount = useMemo(() => {
    if (!consolidatedRows) return 0;
    return consolidatedRows.filter(r => r.networkType === 'flexible').length;
  }, [consolidatedRows]);

  const pctFlexible = consolidatedRows.length > 0
    ? ((flexibleServicesCount / consolidatedRows.length) * 100).toFixed(1)
    : '0.0';

  const triggerToast = (msg: string) => {
    setSyncToast(msg);
    setTimeout(() => setSyncToast(null), 3500);
  };

  // ------------------------------------
  // 1. SERVICIOS PRIORIDAD (Cuadro 1)
  // ------------------------------------
  const priorityList: PriorityServiceItem[] = useMemo(() => {
    return (rules.priorityServices || []).map(p => {
      if (typeof p === 'string') return { service: p.trim(), comment: '' };
      return { service: String(p?.service || '').trim(), comment: String(p?.comment || '').trim() };
    }).filter(p => Boolean(p.service));
  }, [rules.priorityServices]);

  // Conteo de coincidencias en el reporte cargado activo
  const { priorityReportedCounts, totalReportedPriorityMatches } = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    if (!consolidatedRows || consolidatedRows.length === 0 || priorityList.length === 0) {
      return { priorityReportedCounts: counts, totalReportedPriorityMatches: 0 };
    }
    priorityList.forEach(item => {
      const singleMatcher = createPriorityServiceMatcher([item.service]);
      const matchedRows = consolidatedRows.filter(r => singleMatcher(r.servicio, r.asociado));
      counts[item.service] = matchedRows.length;
      total += matchedRows.length;
    });
    return { priorityReportedCounts: counts, totalReportedPriorityMatches: total };
  }, [priorityList, consolidatedRows]);

  const handleAddPriority = () => {
    setPriorityError('');
    const cleanSrv = newPriorityInput.trim().toUpperCase();
    const cleanComment = newPriorityComment.trim();

    if (!cleanSrv) {
      setPriorityError('Debe ingresar el número de servicio.');
      return;
    }
    if (!cleanComment) {
      setPriorityError('El comentario o nombre de caso es obligatorio.');
      return;
    }

    const currentList = [...priorityList];
    const existingIdx = currentList.findIndex(p => p.service === cleanSrv);
    if (existingIdx >= 0) {
      currentList[existingIdx] = { service: cleanSrv, comment: cleanComment };
      triggerToast(`Servicio ${cleanSrv} actualizado con nuevo comentario.`);
    } else {
      currentList.push({ service: cleanSrv, comment: cleanComment });
      triggerToast(`Servicio PRIORIDAD ${cleanSrv} añadido.`);
    }

    const updated = { ...rules, priorityServices: currentList };
    saveCableRules(updated);
    onRulesUpdated(updated);
    setNewPriorityInput('');
    setNewPriorityComment('');
    setPriorityError('');
  };

  const handleBulkPastePriority = () => {
    setPriorityError('');
    if (!bulkPasteText.trim()) return;

    const lines = bulkPasteText.split(/[\r\n]+/);
    const currentList = [...priorityList];
    let addedCount = 0;
    let updatedCount = 0;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let srv = '';
      let comment = '';

      if (trimmed.includes('\t')) {
        const parts = trimmed.split('\t');
        srv = (parts[0] || '').trim().toUpperCase();
        comment = parts.slice(1).join(' ').trim();
      } else if (trimmed.includes(';') || trimmed.includes(',')) {
        const parts = trimmed.split(/[;,]/);
        srv = (parts[0] || '').trim().toUpperCase();
        comment = parts.slice(1).join(' ').trim();
      } else {
        srv = trimmed.toUpperCase();
        comment = bulkPasteDefaultComment.trim() || 'Caso Prioritario';
      }

      if (!comment && bulkPasteDefaultComment.trim()) {
        comment = bulkPasteDefaultComment.trim();
      }
      if (!comment) {
        comment = 'Caso Prioritario';
      }

      if (srv) {
        const existingIdx = currentList.findIndex(p => p.service === srv);
        if (existingIdx >= 0) {
          currentList[existingIdx] = { service: srv, comment };
          updatedCount++;
        } else {
          currentList.push({ service: srv, comment });
          addedCount++;
        }
      }
    });

    if (addedCount > 0 || updatedCount > 0) {
      const updated = { ...rules, priorityServices: currentList };
      saveCableRules(updated);
      onRulesUpdated(updated);
      triggerToast(`Carga masiva: ${addedCount} añadidos, ${updatedCount} actualizados.`);
    } else {
      triggerToast('No se encontraron servicios válidos.');
    }
    setBulkPasteText('');
    setBulkPasteDefaultComment('');
    setIsBulkPasteOpen(false);
  };

  const handleStartEditPriority = (idx: number, item: PriorityServiceItem) => {
    setEditingPriorityIdx(idx);
    setEditPriorityVal(item.service);
    setEditPriorityComment(item.comment);
  };

  const handleSaveEditPriority = (idx: number) => {
    const trimmedSrv = editPriorityVal.trim().toUpperCase();
    const trimmedComment = editPriorityComment.trim();
    if (!trimmedSrv) return;
    if (!trimmedComment) {
      alert('El comentario o nombre de caso es obligatorio.');
      return;
    }

    const updatedList = [...priorityList];
    updatedList[idx] = { service: trimmedSrv, comment: trimmedComment };

    const updated = { ...rules, priorityServices: updatedList };
    saveCableRules(updated);
    onRulesUpdated(updated);
    setEditingPriorityIdx(null);
    triggerToast('Servicio PRIORIDAD actualizado correctamente.');
  };

  const handleRemovePriority = (idx: number) => {
    const updatedList = priorityList.filter((_, i) => i !== idx);
    const updated = { ...rules, priorityServices: updatedList };
    saveCableRules(updated);
    onRulesUpdated(updated);
    if (editingPriorityIdx === idx) setEditingPriorityIdx(null);
    triggerToast('Servicio PRIORIDAD eliminado.');
  };

  const handleClearAllPriority = () => {
    if (priorityList.length === 0) return;
    if (window.confirm('¿Está seguro de eliminar TODOS los servicios de la lista PRIORIDAD?')) {
      const updated = { ...rules, priorityServices: [] };
      saveCableRules(updated);
      onRulesUpdated(updated);
      setEditingPriorityIdx(null);
      triggerToast('Se eliminaron todos los servicios PRIORIDAD.');
    }
  };

  // ------------------------------------
  // 2. RED FLEXIBLE HANDLERS
  // ------------------------------------
  const handleAddFlexibleRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!flexPattern.trim()) return;

    const newRule = {
      id: `flex_${Date.now()}`,
      pattern: flexPattern.trim().toUpperCase(),
      assignedName: flexAssignedName.trim() || 'Red Flexible'
    };

    const updated = {
      ...rules,
      flexibleRules: [...rules.flexibleRules, newRule]
    };

    saveCableRules(updated);
    onRulesUpdated(updated);
    setFlexPattern('');
    setFlexAssignedName('');
    triggerToast(`Regla de Red Flexible "${newRule.pattern}" agregada y sincronizada con Pestaña 1`);
  };

  const handleQuickAddCablePToFlexible = (cableName: string) => {
    const clean = cleanCableName(cableName).trim().toUpperCase();
    if (!clean) return;
    if (isCableMatchedByFlexibleRules(clean)) return;

    const newRule = {
      id: `flex_${Date.now()}`,
      pattern: clean,
      assignedName: 'Red Flexible'
    };

    const updated = {
      ...rules,
      flexibleRules: [...rules.flexibleRules, newRule]
    };

    saveCableRules(updated);
    onRulesUpdated(updated);
    triggerToast(`Cable P "${clean}" agregado a Red Flexible y sincronizado`);
  };

  const handleStartEditFlex = (rule: { id: string; pattern: string; assignedName: string }) => {
    setEditingFlexId(rule.id);
    setEditFlexPattern(rule.pattern);
    setEditFlexAssignedName(rule.assignedName);
  };

  const handleSaveEditFlex = (id: string) => {
    if (!editFlexPattern.trim()) return;

    const updatedFlex = rules.flexibleRules.map(r => {
      if (r.id === id) {
        return {
          ...r,
          pattern: editFlexPattern.trim().toUpperCase(),
          assignedName: editFlexAssignedName.trim() || 'Red Flexible'
        };
      }
      return r;
    });

    const updated = { ...rules, flexibleRules: updatedFlex };
    saveCableRules(updated);
    onRulesUpdated(updated);
    setEditingFlexId(null);
    triggerToast('Regla de Red Flexible actualizada y sincronizada con Pestaña 1');
  };

  const handleRemoveFlexibleRule = (id: string) => {
    const updated = {
      ...rules,
      flexibleRules: rules.flexibleRules.filter(r => r.id !== id)
    };
    saveCableRules(updated);
    onRulesUpdated(updated);
    if (editingFlexId === id) setEditingFlexId(null);
    triggerToast('Regla eliminada y clasificación sincronizada');
  };

  // ------------------------------------
  // 3. OUTDOOR HANDLERS
  // ------------------------------------
  const handleAddOutdoorRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!outdoorPattern.trim()) return;

    const newRule = {
      id: `out_${Date.now()}`,
      centralPattern: outdoorPattern.trim().toUpperCase(),
      assignedName: outdoorAssignedName.trim() || `Outdoor (${outdoorPattern.trim().toUpperCase()})`
    };

    const updated = {
      ...rules,
      outdoorRules: [...rules.outdoorRules, newRule]
    };

    saveCableRules(updated);
    onRulesUpdated(updated);
    setOutdoorPattern('');
    setOutdoorAssignedName('');
  };

  const handleStartEditOutdoor = (rule: { id: string; centralPattern: string; assignedName: string }) => {
    setEditingOutdoorId(rule.id);
    setEditOutdoorPattern(rule.centralPattern);
    setEditOutdoorAssignedName(rule.assignedName);
  };

  const handleSaveEditOutdoor = (id: string) => {
    if (!editOutdoorPattern.trim()) return;

    const updatedOutdoor = rules.outdoorRules.map(r => {
      if (r.id === id) {
        return {
          ...r,
          centralPattern: editOutdoorPattern.trim().toUpperCase(),
          assignedName: editOutdoorAssignedName.trim() || `Outdoor (${editOutdoorPattern.trim().toUpperCase()})`
        };
      }
      return r;
    });

    const updated = { ...rules, outdoorRules: updatedOutdoor };
    saveCableRules(updated);
    onRulesUpdated(updated);
    setEditingOutdoorId(null);
  };

  const handleRemoveOutdoorRule = (id: string) => {
    const updated = {
      ...rules,
      outdoorRules: rules.outdoorRules.filter(r => r.id !== id)
    };
    saveCableRules(updated);
    onRulesUpdated(updated);
    if (editingOutdoorId === id) setEditingOutdoorId(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Sync Toast Notification */}
      {syncToast && (
        <div className="p-3 bg-emerald-900/90 border border-emerald-500/50 rounded-2xl text-emerald-200 text-xs font-bold flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncToast}</span>
          </div>
          <button
            onClick={() => setSyncToast(null)}
            className="text-emerald-400 hover:text-white p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      
      {/* Synchronization with Tab 1 Active Banner */}
      <div className="bg-gradient-to-r from-indigo-950/90 via-slate-900 to-emerald-950/90 border border-indigo-700/50 rounded-3xl p-6 text-white shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-indigo-500/20 text-indigo-300 rounded-2xl border border-indigo-500/40 shrink-0">
              <RefreshCw className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-black text-base text-white">Sincronización Activa con Pestaña 1</h3>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>En Línea y Sincronizado</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Reporte activo: <span className="font-semibold text-white">{fileName || 'Muestra de datos de IP Cables'}</span> • 
                Total en Pestaña 1: <span className="font-bold text-amber-300">{consolidatedRows.length} servicios</span> • 
                Red Flexible: <span className="font-bold text-emerald-300">{flexibleServicesCount} servicios ({pctFlexible}%)</span> • 
                Cables P detectados: <span className="font-bold text-cyan-300">{detectedCablePList.length} cables</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onForceResync) {
                onForceResync();
              } else {
                onRulesUpdated(rules);
              }
              triggerToast('¡Sincronización completada! Todos los servicios fueron reclasificados según las reglas actuales.');
            }}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center space-x-2 shrink-0 cursor-pointer active:scale-95 border border-indigo-400/40"
            title="Re-evaluar todos los servicios de la Pestaña 1 contra los patrones de Cable P"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Re-sincronizar y Reclasificar Todo</span>
          </button>
        </div>
      </div>

      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl space-y-2">
        <div className="inline-flex items-center space-x-2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-bold">
          <Sliders className="w-3.5 h-3.5 text-indigo-400" />
          <span>Módulo de Reglas y Clasificación de Red</span>
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight">
          Ajustes de Clasificación para Cables y Redes
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm">
          Configure reglas de clasificación para sus servicios. En <strong>Coincidencia Red Flexible</strong>, los patrones se comparan con la columna <strong>Cable P</strong> del Excel: se clasifica como <strong>Red Flexible</strong> y, si la columna <strong>Cable S</strong> no contiene datos, se le asigna el nombre de la Red Flexible. Las redes generales se establecen como <strong>Red Rígida</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 1. Panel SERVICIOS PRIORIDAD */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-lg space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <Star className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">1. Servicios PRIORIDAD</h3>
                  <span className="text-[10px] text-amber-400 font-mono font-bold">Coincidencia en SERVICIO y ASOCIADO</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs bg-amber-950/80 text-amber-300 border border-amber-700/60 px-2.5 py-0.5 rounded-full font-bold">
                  {priorityList.length} configurados
                </span>
                {totalReportedPriorityMatches > 0 && (
                  <span className="text-[10px] text-red-400 font-extrabold animate-pulse mt-0.5">
                    🚨 {totalReportedPriorityMatches} reportados activos
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Añada números de teléfono o abonados críticos con su <strong>comentario o nombre de caso</strong> (obligatorio). Se detectarán automáticamente en reportes, se resaltarán en amarillo suave y letra roja en Excel y la web, y en las descargas se incluirá la columna <strong>CASO PRIORIDAD</strong>.
            </p>

            {/* Error Message if Validation Fails */}
            {priorityError && (
              <div className="p-2.5 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex items-center space-x-1.5 animate-in fade-in">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{priorityError}</span>
              </div>
            )}

            {/* Input Form & Acciones */}
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-300 block mb-1">
                    Número de Servicio <span className="text-rose-400">*</span>:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 48210001"
                    value={newPriorityInput}
                    onChange={(e) => {
                      setNewPriorityInput(e.target.value);
                      if (priorityError) setPriorityError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPriority();
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-300 block mb-1">
                    Comentario / Nombre Caso <span className="text-rose-400">*</span>:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Cliente VIP - Hospital"
                    value={newPriorityComment}
                    onChange={(e) => {
                      setNewPriorityComment(e.target.value);
                      if (priorityError) setPriorityError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPriority();
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddPriority}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md cursor-pointer active:scale-95 flex items-center justify-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>Añadir Servicio PRIORIDAD</span>
              </button>

              {/* Botones de Carga Masiva y Limpiar */}
              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setIsBulkPasteOpen(!isBulkPasteOpen)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl text-[11px] font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <ClipboardPaste className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isBulkPasteOpen ? 'Ocultar Pegado Masivo' : '📋 Pegar desde Excel (Servicio + Comentario)'}</span>
                </button>

                {priorityList.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllPriority}
                    className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors font-medium cursor-pointer"
                  >
                    Limpiar todo
                  </button>
                )}
              </div>

              {/* Área de Pegado Masivo */}
              {isBulkPasteOpen && (
                <div className="p-3 bg-slate-950 rounded-2xl border border-amber-500/40 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-300 block">
                      Pegar lista desde Excel (admite 2 columnas: Servicio [Tab] Comentario):
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={bulkPasteText}
                    onChange={(e) => setBulkPasteText(e.target.value)}
                    placeholder="48210001&#9;Cliente VIP Hospital&#10;48210002&#9;Fiscalía Central&#10;48210003..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500 resize-none"
                  />
                  <div>
                    <label className="text-[10px] text-slate-400 font-medium block mb-1">
                      Comentario por defecto (si la línea solo contiene el número):
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Caso Prioritario Lote 1"
                      value={bulkPasteDefaultComment}
                      onChange={(e) => setBulkPasteDefaultComment(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsBulkPasteOpen(false);
                        setBulkPasteText('');
                        setBulkPasteDefaultComment('');
                      }}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkPastePriority}
                      className="px-3.5 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs rounded-lg cursor-pointer shadow"
                    >
                      Guardar Servicios
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Buscador interno por servicio o comentario */}
            {priorityList.length > 2 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar por número o comentario de caso..."
                  value={prioritySearchTerm}
                  onChange={(e) => setPrioritySearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            {/* List */}
            <div className="space-y-1.5 max-h-64 overflow-y-auto p-2 bg-slate-950 rounded-2xl border border-slate-800">
              {priorityList.length === 0 ? (
                <div className="text-xs text-slate-500 p-4 text-center italic">
                  No hay servicios de PRIORIDAD configurados.
                </div>
              ) : (
                priorityList
                  .filter(item => {
                    if (!prioritySearchTerm) return true;
                    const q = prioritySearchTerm.trim().toUpperCase();
                    return item.service.toUpperCase().includes(q) || item.comment.toUpperCase().includes(q);
                  })
                  .map((item, originalIdx) => {
                    const actualIdx = priorityList.findIndex(p => p.service === item.service);
                    const matchCount = priorityReportedCounts[item.service] || 0;
                    const isReported = matchCount > 0;

                    return (
                      <div
                        key={`${item.service}_${actualIdx}`}
                        className={`p-2.5 rounded-xl border text-xs font-mono transition-all ${
                          isReported
                            ? 'bg-amber-950/40 border-amber-500/50 text-amber-200 shadow-sm'
                            : 'bg-slate-900 border-slate-800/80 text-slate-300'
                        }`}
                      >
                        {editingPriorityIdx === actualIdx ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              <input
                                type="text"
                                value={editPriorityVal}
                                onChange={(e) => setEditPriorityVal(e.target.value)}
                                placeholder="Servicio"
                                className="bg-slate-950 border border-amber-500 p-1.5 rounded text-xs text-white font-mono uppercase"
                              />
                              <input
                                type="text"
                                value={editPriorityComment}
                                onChange={(e) => setEditPriorityComment(e.target.value)}
                                placeholder="Comentario / Caso"
                                className="bg-slate-950 border border-amber-500 p-1.5 rounded text-xs text-white font-sans"
                              />
                            </div>
                            <div className="flex justify-end space-x-1.5">
                              <button
                                onClick={() => setEditingPriorityIdx(null)}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => handleSaveEditPriority(actualIdx)}
                                className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded cursor-pointer flex items-center space-x-1"
                              >
                                <Save className="w-3 h-3" />
                                <span>Guardar</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between">
                            <div className="space-y-1 truncate pr-2">
                              <div className="flex items-center space-x-2">
                                <Star className={`w-3.5 h-3.5 shrink-0 ${isReported ? 'text-amber-400 fill-amber-400' : 'text-slate-500'}`} />
                                <span className={isReported ? 'text-amber-300 font-black' : 'text-slate-200 font-bold'}>
                                  {item.service}
                                </span>
                                {isReported ? (
                                  <span className="bg-red-950/80 text-red-300 border border-red-500/60 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider animate-pulse">
                                    🚨 Reportado ({matchCount})
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-600 font-normal">
                                    No reportado
                                  </span>
                                )}
                              </div>
                              {item.comment && (
                                <div className="text-[11px] font-sans text-amber-300/90 font-medium truncate flex items-center space-x-1">
                                  <span className="text-amber-500 font-bold text-[10px]">Caso:</span>
                                  <span className="truncate">{item.comment}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center space-x-1 shrink-0">
                              <button
                                onClick={() => handleStartEditPriority(actualIdx, item)}
                                className="p-1 hover:text-amber-400 text-slate-400 transition-colors cursor-pointer"
                                title="Editar servicio y comentario"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleRemovePriority(actualIdx)}
                                className="p-1 hover:text-rose-400 text-slate-500 transition-colors cursor-pointer"
                                title="Eliminar de prioridad"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 flex items-start space-x-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>Coincide contra columnas <strong>SERVICIO</strong> y <strong>ASOCIADO</strong>. Se resalta en amarillo suave con letra roja en Excel y la Web.</span>
          </div>
        </div>

        {/* 2. Panel RED FLEXIBLE (Sincronizado con Cable P de Pestaña 1) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-lg space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <Cable className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">2. Coincidencia Red Flexible</h3>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">Comparación exacta con Columna Cable P</span>
                </div>
              </div>
              <span className="text-xs bg-emerald-900/60 text-emerald-200 border border-emerald-700/50 px-2.5 py-0.5 rounded-full font-bold">
                {rules.flexibleRules.length} reglas
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Los patrones configurados se comparan directamente con la columna <strong>Cable P</strong> del Excel. Si el Cable P coincide con uno de ellos, en la columna Clasificación Red se establecerá <strong>Red Flexible</strong>, y en la columna <strong>Cable S</strong> se asignará el nombre de la Red Flexible a la que pertenece si no contiene datos.
            </p>

            {/* Chips de Cables P detectados en el Excel de Pestaña 1 */}
            {detectedCablePList.length > 0 && (
              <div className="space-y-1.5 p-3 bg-slate-950 rounded-2xl border border-slate-800/90">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                    Cables P detectados en Pestaña 1 ({detectedCablePList.length}):
                  </span>
                  <span className="text-[9px] text-slate-400">Click para agregar</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
                  {detectedCablePList.map(c => {
                    const isMatched = isCableMatchedByFlexibleRules(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          if (isMatched) return;
                          handleQuickAddCablePToFlexible(c);
                        }}
                        disabled={isMatched}
                        className={`text-[10px] px-2 py-0.5 rounded-lg font-mono font-bold transition-all flex items-center space-x-1 ${
                          isMatched
                            ? 'bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 opacity-90 cursor-default'
                            : 'bg-slate-800 hover:bg-emerald-600 hover:text-white border border-slate-700 text-slate-300 cursor-pointer active:scale-95'
                        }`}
                        title={isMatched ? `El Cable P "${c}" ya está clasificado como Red Flexible` : `Click para agregar "${c}" a Red Flexible`}
                      >
                        {isMatched ? (
                          <>
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                            <span>{c}</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-2.5 h-2.5 text-slate-400 group-hover:text-white" />
                            <span>{c}</span>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleAddFlexibleRule} className="space-y-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">1. Patrón(es) a comparar con Cable P (separados por coma)</label>
                <input
                  type="text"
                  required
                  list="flex-available-cables"
                  placeholder="ej: VA61, VA62, VA63"
                  value={flexPattern}
                  onChange={(e) => setFlexPattern(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-emerald-500 mt-1"
                />
                <datalist id="flex-available-cables">
                  {detectedCablePList.map(c => (
                    <option key={c} value={c} />
                  ))}
                  {availableCables.map(c => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">2. Nombre Asignado (opcional, por defecto "Red Flexible")</label>
                <div className="flex items-center space-x-2 mt-1">
                  <input
                    type="text"
                    placeholder="Red Flexible"
                    value={flexAssignedName}
                    onChange={(e) => setFlexAssignedName(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
                  >
                    + Agregar Regla
                  </button>
                </div>
              </div>
            </form>

            {/* List */}
            <div className="space-y-2 max-h-56 overflow-y-auto p-2 bg-slate-950 rounded-2xl border border-slate-800">
              {rules.flexibleRules.length === 0 ? (
                <div className="text-xs text-slate-500 p-2 text-center">No hay reglas de Red Flexible configuradas.</div>
              ) : (
                rules.flexibleRules.map((rule) => {
                  const matchCount = getRuleMatchCount(rule.pattern);
                  return (
                    <div
                      key={rule.id}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 text-xs space-y-1.5"
                    >
                      {editingFlexId === rule.id ? (
                        <div className="space-y-2">
                          <div>
                            <label className="text-[9px] text-emerald-400 font-bold uppercase block">Patrones a comparar con Cable P</label>
                            <input
                              type="text"
                              value={editFlexPattern}
                              onChange={(e) => setEditFlexPattern(e.target.value)}
                              className="w-full bg-slate-950 border border-emerald-500 p-1.5 rounded text-xs text-white font-mono uppercase"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-emerald-400 font-bold uppercase block">Nombre Asignado</label>
                            <input
                              type="text"
                              value={editFlexAssignedName}
                              onChange={(e) => setEditFlexAssignedName(e.target.value)}
                              className="w-full bg-slate-950 border border-emerald-500 p-1.5 rounded text-xs text-white font-bold"
                            />
                          </div>
                          <div className="flex items-center justify-end space-x-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingFlexId(null)}
                              className="px-2 py-1 bg-slate-800 text-slate-300 text-[10px] font-bold rounded cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditFlex(rule.id)}
                              className="px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded flex items-center space-x-1 cursor-pointer"
                            >
                              <Save className="w-3 h-3" />
                              <span>Guardar</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-black text-white">{rule.assignedName}</span>
                              {matchCount > 0 ? (
                                <span className="bg-emerald-950 text-emerald-300 border border-emerald-600/50 text-[10px] px-2 py-0.2 rounded-full font-bold font-mono">
                                  ✓ {matchCount} {matchCount === 1 ? 'servicio' : 'servicios'}
                                </span>
                              ) : (
                                <span className="bg-slate-800 text-slate-400 text-[10px] px-1.5 py-0.2 rounded font-mono">
                                  0 servicios
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono font-bold text-emerald-400">
                              Cable P: {rule.pattern}
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              onClick={() => handleStartEditFlex(rule)}
                              className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 cursor-pointer"
                              title="Editar regla"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
                            </button>
                            <button
                              onClick={() => handleRemoveFlexibleRule(rule.id)}
                              className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 cursor-pointer"
                              title="Eliminar regla"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 flex items-start space-x-2">
            <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Compara estrictamente con la columna <strong>Cable P</strong> del Excel y clasifica los servicios como <strong>Red Flexible</strong> en la Pestaña 1 y en todos los Excel descargados.</span>
          </div>
        </div>

        {/* 3. Panel OUTDOOR */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-lg space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">3. Coincidencia Outdoor</h3>
                  <span className="text-[10px] text-amber-400 font-mono">Búsqueda en CENTRAL TELEFÓNICA</span>
                </div>
              </div>
              <span className="text-xs bg-amber-900/60 text-amber-200 border border-amber-700/50 px-2.5 py-0.5 rounded-full font-bold">
                {rules.outdoorRules.length} reglas
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Clasifica como Outdoor según coincidencia en la columna <strong>Central Telefónica</strong> (admite patrones por coma, ej: <code>OUTDOOR, EXT, PLAZA</code>).
            </p>

            {/* Input Form */}
            <form onSubmit={handleAddOutdoorRule} className="space-y-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">1. Patrón(es) en Central Telefónica</label>
                <input
                  type="text"
                  required
                  placeholder="ej: OUTDOOR, EXT, PLAZA"
                  value={outdoorPattern}
                  onChange={(e) => setOutdoorPattern(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-amber-500 mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">2. Nombre Asignado</label>
                <div className="flex items-center space-x-2 mt-1">
                  <input
                    type="text"
                    placeholder="ej: Outdoor Gabinetes"
                    value={outdoorAssignedName}
                    onChange={(e) => setOutdoorAssignedName(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
                  >
                    + Agregar Regla
                  </button>
                </div>
              </div>
            </form>

            {/* List */}
            <div className="space-y-2 max-h-56 overflow-y-auto p-2 bg-slate-950 rounded-2xl border border-slate-800">
              {rules.outdoorRules.length === 0 ? (
                <div className="text-xs text-slate-500 p-2 text-center">No hay reglas Outdoor configuradas.</div>
              ) : (
                rules.outdoorRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 text-xs space-y-1"
                  >
                    {editingOutdoorId === rule.id ? (
                      <div className="space-y-2">
                        <div>
                          <label className="text-[9px] text-amber-400 font-bold uppercase block">Patrones en Central</label>
                          <input
                            type="text"
                            value={editOutdoorPattern}
                            onChange={(e) => setEditOutdoorPattern(e.target.value)}
                            className="w-full bg-slate-950 border border-amber-500 p-1.5 rounded text-xs text-white font-mono uppercase"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-amber-400 font-bold uppercase block">Nombre Asignado</label>
                          <input
                            type="text"
                            value={editOutdoorAssignedName}
                            onChange={(e) => setEditOutdoorAssignedName(e.target.value)}
                            className="w-full bg-slate-950 border border-amber-500 p-1.5 rounded text-xs text-white font-bold"
                          />
                        </div>
                        <div className="flex items-center justify-end space-x-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingOutdoorId(null)}
                            className="px-2 py-1 bg-slate-800 text-slate-300 text-[10px] font-bold rounded cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditOutdoor(rule.id)}
                            className="px-2 py-1 bg-amber-600 text-white text-[10px] font-bold rounded flex items-center space-x-1 cursor-pointer"
                          >
                            <Save className="w-3 h-3" />
                            <span>Guardar</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-black text-white">{rule.assignedName}</div>
                          <div className="text-[11px] font-mono font-bold text-amber-400">
                            Patrones: {rule.centralPattern}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            onClick={() => handleStartEditOutdoor(rule)}
                            className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 cursor-pointer"
                            title="Editar regla"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                          </button>
                          <button
                            onClick={() => handleRemoveOutdoorRule(rule.id)}
                            className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 cursor-pointer"
                            title="Eliminar regla"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 flex items-start space-x-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>Busca subcadenas en la columna <strong>CENTRAL TELEFÓNICA</strong> del Excel.</span>
          </div>
        </div>

      </div>

    </div>
  );
};
