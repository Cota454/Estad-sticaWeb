import React, { useState } from 'react';
import { CableClassificationRules } from '../types/ipCablesTypes';
import { saveCableRules } from '../utils/ipCablesStorage';
import {
  Sliders,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Building2,
  Cable,
  Info
} from 'lucide-react';

interface CableClassificationViewProps {
  rules: CableClassificationRules;
  onRulesUpdated: (newRules: CableClassificationRules) => void;
  availableCables?: string[];
  availableCentrales?: string[];
}

export const CableClassificationView: React.FC<CableClassificationViewProps> = ({
  rules,
  onRulesUpdated,
  availableCables = [],
  availableCentrales = []
}) => {
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
      assignedName: flexAssignedName.trim() || `Red Flexible (${flexPattern.trim().toUpperCase()})`
    };

    const updated = {
      ...rules,
      flexibleRules: [...rules.flexibleRules, newRule]
    };

    saveCableRules(updated);
    onRulesUpdated(updated);
    setFlexPattern('');
    setFlexAssignedName('');
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
          assignedName: editFlexAssignedName.trim() || `Red Flexible (${editFlexPattern.trim().toUpperCase()})`
        };
      }
      return r;
    });

    const updated = { ...rules, flexibleRules: updatedFlex };
    saveCableRules(updated);
    onRulesUpdated(updated);
    setEditingFlexId(null);
  };

  const handleRemoveFlexibleRule = (id: string) => {
    const updated = {
      ...rules,
      flexibleRules: rules.flexibleRules.filter(r => r.id !== id)
    };
    saveCableRules(updated);
    onRulesUpdated(updated);
    if (editingFlexId === id) setEditingFlexId(null);
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
          Defina qué cables pertenecen a <strong>Red Rígida</strong>, configure coincidencias en la columna <strong>CABLE</strong> para <strong>Red Flexible</strong> (admite múltiples patrones por coma, ej: <code>VA61, VA62, VA63</code>) y coincidencias para <strong>Outdoor</strong>. Cada regla puede ser editada tras su creación.
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
                className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shrink-0"
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
                          className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded"
                          title="Guardar"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingRigidaIdx(null)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
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
                            className="p-1 hover:text-blue-400 text-slate-400 transition-colors"
                            title="Editar cable"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemoveRigida(idx)}
                            className="p-1 hover:text-rose-400 text-slate-500 transition-colors"
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

        {/* 2. Panel RED FLEXIBLE */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-lg space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <Cable className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">2. Coincidencia Red Flexible</h3>
                  <span className="text-[10px] text-emerald-400 font-mono">Búsqueda en Columna CABLE</span>
                </div>
              </div>
              <span className="text-xs bg-emerald-900/60 text-emerald-200 border border-emerald-700/50 px-2.5 py-0.5 rounded-full font-bold">
                {rules.flexibleRules.length} reglas
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Un mismo Nombre Asignado puede agrupar varios patrones separados por coma (ej. Nombre = <strong>RA</strong>, Patrones = <code>VA61, VA62, VA63</code>).
            </p>

            {/* Input Form */}
            <form onSubmit={handleAddFlexibleRule} className="space-y-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">1. Patrón(es) a buscar (separados por coma)</label>
                <input
                  type="text"
                  required
                  placeholder="ej: VA61, VA62, VA63"
                  value={flexPattern}
                  onChange={(e) => setFlexPattern(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-emerald-500 mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">2. Nombre Asignado</label>
                <div className="flex items-center space-x-2 mt-1">
                  <input
                    type="text"
                    placeholder="ej: RA o Red Flexible 1"
                    value={flexAssignedName}
                    onChange={(e) => setFlexAssignedName(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shrink-0"
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
                rules.flexibleRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 text-xs space-y-1"
                  >
                    {editingFlexId === rule.id ? (
                      <div className="space-y-2">
                        <div>
                          <label className="text-[9px] text-emerald-400 font-bold uppercase block">Patrones (separados por coma)</label>
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
                            className="px-2 py-1 bg-slate-800 text-slate-300 text-[10px] font-bold rounded"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditFlex(rule.id)}
                            className="px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded flex items-center space-x-1"
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
                          <div className="text-[11px] font-mono font-bold text-emerald-400">
                            Patrones: {rule.pattern}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            onClick={() => handleStartEditFlex(rule)}
                            className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800"
                            title="Editar regla"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
                          </button>
                          <button
                            onClick={() => handleRemoveFlexibleRule(rule.id)}
                            className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800"
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
            <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Busca subcadenas en la columna <strong>CABLE</strong> y asigna la regla correspondiente.</span>
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
                    className="px-3.5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shrink-0"
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
                            className="px-2 py-1 bg-slate-800 text-slate-300 text-[10px] font-bold rounded"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditOutdoor(rule.id)}
                            className="px-2 py-1 bg-amber-600 text-white text-[10px] font-bold rounded flex items-center space-x-1"
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
                            className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800"
                            title="Editar regla"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                          </button>
                          <button
                            onClick={() => handleRemoveOutdoorRule(rule.id)}
                            className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800"
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
