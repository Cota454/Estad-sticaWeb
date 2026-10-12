import React, { useState, useMemo } from 'react';
import { CableClassificationRules, IpCableRow } from '../types/ipCablesTypes';
import { saveCableRules } from '../utils/ipCablesStorage';
import { cleanCableName, isCableExactMatch } from '../utils/ipCablesExcelParser';
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
  FileSpreadsheet
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

  // Red Rígida Input
  const [newRigidaInput, setNewRigidaInput] = useState<string>('');
  const [editingRigidaIdx, setEditingRigidaIdx] = useState<number | null>(null);
  const [editRigidaVal, setEditRigidaVal] = useState<string>('');

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
  // 1. RED RÍGIDA HANDLERS
  // ------------------------------------
  const handleAddRigida = () => {
    if (!newRigidaInput.trim()) return;
    const parts = newRigidaInput.split(',');
    const currentList = [...rules.rigidaCables];

    parts.forEach(p => {
      const trimmed = p.trim().toUpperCase();
      if (trimmed && !currentList.includes(trimmed)) {
        currentList.push(trimmed);
      }
    });

    const updated = { ...rules, rigidaCables: currentList };
    saveCableRules(updated);
    onRulesUpdated(updated);
    setNewRigidaInput('');
  };

  const handleStartEditRigida = (idx: number, currentVal: string) => {
    setEditingRigidaIdx(idx);
    setEditRigidaVal(currentVal);
  };

  const handleSaveEditRigida = (idx: number) => {
    const trimmed = editRigidaVal.trim().toUpperCase();
    if (!trimmed) return;

    const updatedList = [...rules.rigidaCables];
    updatedList[idx] = trimmed;

    const updated = { ...rules, rigidaCables: updatedList };
    saveCableRules(updated);
    onRulesUpdated(updated);
    setEditingRigidaIdx(null);
  };

  const handleRemoveRigida = (idx: number) => {
    const updatedList = rules.rigidaCables.filter((_, i) => i !== idx);
    const updated = { ...rules, rigidaCables: updatedList };
    saveCableRules(updated);
    onRulesUpdated(updated);
    if (editingRigidaIdx === idx) setEditingRigidaIdx(null);
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

        {/* 1. Panel RED RÍGIDA */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-lg space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
                  <Cable className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">1. Cables de Red Rígida</h3>
                  <span className="text-[10px] text-blue-400 font-mono">Coincidencia en Columna CABLE</span>
                </div>
              </div>
              <span className="text-xs bg-blue-900/60 text-blue-200 border border-blue-700/50 px-2.5 py-0.5 rounded-full font-bold">
                {rules.rigidaCables.length} cables
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Añada nombres directos o cables separados por coma (ej. <code>CR-101, CR-102</code>).
            </p>

            {/* Input Form */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Cable(s) (ej: CR-101, CR-102)"
                value={newRigidaInput}
                onChange={(e) => setNewRigidaInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddRigida();
                  }
                }}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleAddRigida}
                className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
              >
                + Añadir
              </button>
            </div>

            {/* List */}
            <div className="space-y-1.5 max-h-64 overflow-y-auto p-2 bg-slate-950 rounded-2xl border border-slate-800">
              {rules.rigidaCables.length === 0 ? (
                <div className="text-xs text-slate-500 p-2 text-center">No hay cables de Red Rígida configurados.</div>
              ) : (
                rules.rigidaCables.map((cb, idx) => (
                  <div
                    key={`${cb}_${idx}`}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800/80 text-xs font-mono"
                  >
                    {editingRigidaIdx === idx ? (
                      <div className="flex items-center space-x-1.5">
                        <input
                          type="text"
                          value={editRigidaVal}
                          onChange={(e) => setEditRigidaVal(e.target.value)}
                          className="flex-1 bg-slate-950 border border-blue-500 p-1.5 rounded text-xs text-white font-mono uppercase"
                        />
                        <button
                          onClick={() => handleSaveEditRigida(idx)}
                          className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded cursor-pointer"
                          title="Guardar"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingRigidaIdx(null)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between font-bold text-blue-300">
                        <span>{cb}</span>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleStartEditRigida(idx, cb)}
                            className="p-1 hover:text-blue-400 text-slate-400 transition-colors cursor-pointer"
                            title="Editar cable"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemoveRigida(idx)}
                            className="p-1 hover:text-rose-400 text-slate-500 transition-colors cursor-pointer"
                            title="Eliminar cable"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <span>Coincidencia directa en la columna <strong>CABLE</strong> del Excel.</span>
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
