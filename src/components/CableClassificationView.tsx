import React, { useState } from 'react';
import { CableClassificationRules } from '../types/ipCablesTypes';
import { saveCableRules } from '../utils/ipCablesStorage';
import {
  Sliders,
  Plus,
  Trash2,
  Check,
  Building2,
  Cable,
  Sparkles,
  Search,
  ShieldAlert,
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

  // Red Flexible Input
  const [flexPattern, setFlexPattern] = useState<string>('');
  const [flexAssignedName, setFlexAssignedName] = useState<string>('');

  // Outdoor Input
  const [outdoorPattern, setOutdoorPattern] = useState<string>('');
  const [outdoorAssignedName, setOutdoorAssignedName] = useState<string>('');

  // 1. Red Rígida Handlers
  const handleAddRigida = () => {
    const trimmed = newRigidaInput.trim().toUpperCase();
    if (trimmed && !rules.rigidaCables.includes(trimmed)) {
      const updated = {
        ...rules,
        rigidaCables: [...rules.rigidaCables, trimmed]
      };
      saveCableRules(updated);
      onRulesUpdated(updated);
      setNewRigidaInput('');
    }
  };

  const handleRemoveRigida = (cableName: string) => {
    const updated = {
      ...rules,
      rigidaCables: rules.rigidaCables.filter(c => c !== cableName)
    };
    saveCableRules(updated);
    onRulesUpdated(updated);
  };

  // 2. Red Flexible Handlers
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

  const handleRemoveFlexibleRule = (id: string) => {
    const updated = {
      ...rules,
      flexibleRules: rules.flexibleRules.filter(r => r.id !== id)
    };
    saveCableRules(updated);
    onRulesUpdated(updated);
  };

  // 3. Outdoor Handlers
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

  const handleRemoveOutdoorRule = (id: string) => {
    const updated = {
      ...rules,
      outdoorRules: rules.outdoorRules.filter(r => r.id !== id)
    };
    saveCableRules(updated);
    onRulesUpdated(updated);
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
          Defina qué cables pertenecen a <strong>Red Rígida</strong>, configure coincidencia en la columna <strong>CABLE</strong> para <strong>Red Flexible</strong> y la coincidencia en la columna <strong>CENTRAL TELEFÓNICA</strong> para <strong>Outdoor</strong>.
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
              Añada los nombres directos o prefijos de los cables que pertenecen a la categoría <strong>Red Rígida</strong>.
            </p>

            {/* Input Form */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Nombre del Cable (ej. CR-101)"
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
            <div className="space-y-1.5 max-h-60 overflow-y-auto p-2 bg-slate-950 rounded-2xl border border-slate-800">
              {rules.rigidaCables.length === 0 ? (
                <div className="text-xs text-slate-500 p-2 text-center">No hay cables de Red Rígida configurados.</div>
              ) : (
                rules.rigidaCables.map((cb) => (
                  <div
                    key={cb}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800/80 text-xs font-mono font-bold text-blue-300"
                  >
                    <span>{cb}</span>
                    <button
                      onClick={() => handleRemoveRigida(cb)}
                      className="p-1 hover:text-rose-400 text-slate-500 transition-colors"
                      title="Eliminar cable"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 flex items-start space-x-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <span>Cualquier coincidencia de estos nombres en la columna <strong>CABLE</strong> del Excel será sumada a Red Rígida.</span>
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
              Las casillas de la columna <strong>CABLE</strong> que contengan cualquiera de estos valores se sumarán al nombre asignado.
            </p>

            {/* Input Form */}
            <form onSubmit={handleAddFlexibleRule} className="space-y-2">
              <input
                type="text"
                required
                placeholder="Valor/Patrón a buscar en CABLE (ej. CF-, FLEX)"
                value={flexPattern}
                onChange={(e) => setFlexPattern(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
              />
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Nombre Asignado (ej. Red Flexible FO)"
                  value={flexAssignedName}
                  onChange={(e) => setFlexAssignedName(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shrink-0"
                >
                  + Regla
                </button>
              </div>
            </form>

            {/* List */}
            <div className="space-y-1.5 max-h-52 overflow-y-auto p-2 bg-slate-950 rounded-2xl border border-slate-800">
              {rules.flexibleRules.length === 0 ? (
                <div className="text-xs text-slate-500 p-2 text-center">No hay reglas de Red Flexible configuradas.</div>
              ) : (
                rules.flexibleRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800/80 text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-emerald-400">{rule.pattern}</span>
                      <div className="text-[10px] text-slate-400">{rule.assignedName}</div>
                    </div>
                    <button
                      onClick={() => handleRemoveFlexibleRule(rule.id)}
                      className="p-1 hover:text-rose-400 text-slate-500 transition-colors"
                      title="Eliminar regla"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 flex items-start space-x-2">
            <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Se busca subcadena en la columna <strong>CABLE</strong> y asigna la etiqueta correspondiente.</span>
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
              Coincidencia buscada en la columna <strong>Central Telefónica</strong> para clasificar la incidencia como Outdoor.
            </p>

            {/* Input Form */}
            <form onSubmit={handleAddOutdoorRule} className="space-y-2">
              <input
                type="text"
                required
                placeholder="Valor a buscar en Central Telefónica (ej. OUTDOOR, PLAZA)"
                value={outdoorPattern}
                onChange={(e) => setOutdoorPattern(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-amber-500"
              />
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Nombre Asignado (ej. Gabinete Exterior)"
                  value={outdoorAssignedName}
                  onChange={(e) => setOutdoorAssignedName(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shrink-0"
                >
                  + Regla
                </button>
              </div>
            </form>

            {/* List */}
            <div className="space-y-1.5 max-h-52 overflow-y-auto p-2 bg-slate-950 rounded-2xl border border-slate-800">
              {rules.outdoorRules.length === 0 ? (
                <div className="text-xs text-slate-500 p-2 text-center">No hay reglas Outdoor configuradas.</div>
              ) : (
                rules.outdoorRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800/80 text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-amber-400">{rule.centralPattern}</span>
                      <div className="text-[10px] text-slate-400">{rule.assignedName}</div>
                    </div>
                    <button
                      onClick={() => handleRemoveOutdoorRule(rule.id)}
                      className="p-1 hover:text-rose-400 text-slate-500 transition-colors"
                      title="Eliminar regla"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 flex items-start space-x-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>Se busca subcadena en la columna <strong>CENTRAL TELEFÓNICA</strong> del Excel cargado.</span>
          </div>
        </div>

      </div>

    </div>
  );
};
