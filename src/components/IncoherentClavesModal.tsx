import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Settings,
  ShieldAlert,
  ArrowRight,
  Info
} from 'lucide-react';
import { IncoherentAuditConfig, IncoherenceDetectionMode } from '../types';
import { DEFAULT_INCOHERENT_CONFIG, normalizeClave } from '../utils/incoherentAuditHelper';

interface IncoherentClavesModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: IncoherentAuditConfig;
  onSaveConfig: (newConfig: IncoherentAuditConfig) => void;
  availableClavesFromData: string[];
}

export const IncoherentClavesModal: React.FC<IncoherentClavesModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  availableClavesFromData
}) => {
  if (!isOpen) return null;

  const [tempConfig, setTempConfig] = useState<IncoherentAuditConfig>({ ...config });
  const [newNonEffectiveInput, setNewNonEffectiveInput] = useState('');
  const [newEffectiveInput, setNewEffectiveInput] = useState('');

  // Pair rule input
  const [fromPairClave, setFromPairClave] = useState('');
  const [toPairClave, setToPairClave] = useState('');
  const [pairDesc, setPairDesc] = useState('');

  const handleAddNonEffective = () => {
    const val = normalizeClave(newNonEffectiveInput);
    if (!val) return;
    if (!tempConfig.nonEffectiveClaves.map(normalizeClave).includes(val)) {
      setTempConfig({
        ...tempConfig,
        nonEffectiveClaves: [...tempConfig.nonEffectiveClaves, val],
        // Remove from effective if present
        effectiveClaves: tempConfig.effectiveClaves.filter(c => normalizeClave(c) !== val)
      });
    }
    setNewNonEffectiveInput('');
  };

  const handleRemoveNonEffective = (claveToRemove: string) => {
    setTempConfig({
      ...tempConfig,
      nonEffectiveClaves: tempConfig.nonEffectiveClaves.filter(
        c => normalizeClave(c) !== normalizeClave(claveToRemove)
      )
    });
  };

  const handleAddEffective = () => {
    const val = normalizeClave(newEffectiveInput);
    if (!val) return;
    if (!tempConfig.effectiveClaves.map(normalizeClave).includes(val)) {
      setTempConfig({
        ...tempConfig,
        effectiveClaves: [...tempConfig.effectiveClaves, val],
        // Remove from non-effective if present
        nonEffectiveClaves: tempConfig.nonEffectiveClaves.filter(c => normalizeClave(c) !== val)
      });
    }
    setNewEffectiveInput('');
  };

  const handleRemoveEffective = (claveToRemove: string) => {
    setTempConfig({
      ...tempConfig,
      effectiveClaves: tempConfig.effectiveClaves.filter(
        c => normalizeClave(c) !== normalizeClave(claveToRemove)
      )
    });
  };

  const handleAddPairRule = () => {
    const f = normalizeClave(fromPairClave);
    const t = normalizeClave(toPairClave);
    if (!f || !t) return;
    setTempConfig({
      ...tempConfig,
      customPairs: [
        ...tempConfig.customPairs,
        {
          fromClave: f,
          toClave: t,
          description: pairDesc.trim() || `Incoherencia: ${f} ➔ ${t}`
        }
      ]
    });
    setFromPairClave('');
    setToPairClave('');
    setPairDesc('');
  };

  const handleRemovePair = (index: number) => {
    const updated = [...tempConfig.customPairs];
    updated.splice(index, 1);
    setTempConfig({
      ...tempConfig,
      customPairs: updated
    });
  };

  const handleResetToDefaults = () => {
    if (window.confirm('¿Desea restablecer las reglas y claves a la configuración sugerida por defecto?')) {
      setTempConfig({ ...DEFAULT_INCOHERENT_CONFIG });
    }
  };

  const handleSave = () => {
    onSaveConfig(tempConfig);
    onClose();
  };

  // Quick toggle helper for discovered claves
  const toggleClaveCategory = (clave: string, targetCat: 'non_effective' | 'effective') => {
    const norm = normalizeClave(clave);
    const isNonEff = tempConfig.nonEffectiveClaves.map(normalizeClave).includes(norm);
    const isEff = tempConfig.effectiveClaves.map(normalizeClave).includes(norm);

    if (targetCat === 'non_effective') {
      if (isNonEff) {
        // Unset
        handleRemoveNonEffective(norm);
      } else {
        // Set to non-effective and remove from effective
        setTempConfig({
          ...tempConfig,
          nonEffectiveClaves: [...tempConfig.nonEffectiveClaves, norm],
          effectiveClaves: tempConfig.effectiveClaves.filter(c => normalizeClave(c) !== norm)
        });
      }
    } else {
      if (isEff) {
        // Unset
        handleRemoveEffective(norm);
      } else {
        // Set to effective and remove from non-effective
        setTempConfig({
          ...tempConfig,
          effectiveClaves: [...tempConfig.effectiveClaves, norm],
          nonEffectiveClaves: tempConfig.nonEffectiveClaves.filter(c => normalizeClave(c) !== norm)
        });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-white animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-rose-950/50 via-slate-900 to-indigo-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                Configuración de Claves Incoherentes y Falsos Cierres
              </h3>
              <p className="text-xs text-slate-400">
                Configure la ventana de días y las claves para evaluar discrepancias que afecten al 1er técnico.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">

          {/* 1. Window of Days & Detection Mode */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
            <div>
              <label className="block text-xs font-black text-rose-400 mb-1 flex items-center gap-1.5">
                <span>Ventana de Días de Reincidencia:</span>
                <span className="text-[11px] font-normal text-slate-400 font-mono">({tempConfig.windowDays} días)</span>
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={tempConfig.windowDays}
                  onChange={(e) => setTempConfig({ ...tempConfig, windowDays: parseInt(e.target.value, 10) || 30 })}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono w-24 focus:border-rose-500"
                />
                <div className="flex items-center gap-1">
                  {[7, 15, 30, 45, 60].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setTempConfig({ ...tempConfig, windowDays: d })}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                        tempConfig.windowDays === d
                          ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Tiempo máximo entre la 1ª y la 2ª visita para considerar que es una reapertura incoherente.
              </p>
            </div>

            <div>
              <label className="block text-xs font-black text-indigo-400 mb-1">
                Criterio de Detección:
              </label>
              <select
                value={tempConfig.detectionMode}
                onChange={(e) => setTempConfig({ ...tempConfig, detectionMode: e.target.value as IncoherenceDetectionMode })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 font-medium"
              >
                <option value="all_different">
                  Cualquier cambio de Clave (Clave 1 ≠ Clave 2 en ≤ {tempConfig.windowDays} días)
                </option>
                <option value="effective_vs_non_effective">
                  Clave No Efectiva (1ª Visita) ➔ Clave Efectiva (2ª Visita)
                </option>
                <option value="custom_rules">
                  Reglas Específicas / Pares de Claves Incompatibles
                </option>
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                {tempConfig.detectionMode === 'all_different' && 'Detecta cualquier cambio de código de cierre entre la 1ª y 2ª visita.'}
                {tempConfig.detectionMode === 'effective_vs_non_effective' && 'Solo alerta cuando el 1er técnico cerró con clave No Efectiva y el 2do técnico cerró con Falla Real (Efectiva).'}
                {tempConfig.detectionMode === 'custom_rules' && 'Solo evalúa las combinaciones exactas definidas en la lista de pares.'}
              </p>
            </div>
          </div>

          {/* Quick Clave Tagger from Detected Data */}
          {availableClavesFromData.length > 0 && (
            <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Claves detectadas en sus datos cargados:
                </span>
                <span className="text-[10px] text-slate-400">Haga clic en los botones para clasificar rápidamente</span>
              </div>
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                {availableClavesFromData.map(clave => {
                  const norm = normalizeClave(clave);
                  const isNonEff = tempConfig.nonEffectiveClaves.map(normalizeClave).includes(norm);
                  const isEff = tempConfig.effectiveClaves.map(normalizeClave).includes(norm);

                  return (
                    <div
                      key={clave}
                      className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                        isNonEff
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : isEff
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      <span className="font-mono">{clave}</span>
                      <div className="flex items-center space-x-1 ml-1 border-l border-slate-700/60 pl-1.5">
                        <button
                          type="button"
                          onClick={() => toggleClaveCategory(clave, 'non_effective')}
                          title={isNonEff ? 'Quitar de No Efectivas' : 'Marcar como Clave No Efectiva'}
                          className={`text-[9px] px-1.5 py-0.5 rounded ${
                            isNonEff ? 'bg-amber-500 text-slate-950 font-black' : 'hover:bg-amber-500/30 text-amber-300'
                          }`}
                        >
                          No Efectiva
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleClaveCategory(clave, 'effective')}
                          title={isEff ? 'Quitar de Efectivas' : 'Marcar como Clave Efectiva'}
                          className={`text-[9px] px-1.5 py-0.5 rounded ${
                            isEff ? 'bg-emerald-500 text-slate-950 font-black' : 'hover:bg-emerald-500/30 text-emerald-300'
                          }`}
                        >
                          Efectiva
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Categorization Columns: Claves No Efectivas vs Claves Efectivas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Column A: Claves No Efectivas */}
            <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
                    Claves No Efectivas / Blandas (1ª Visita)
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Cierres sin solución de fondo (ej: Sin Falla, OK Casa, No atendieron, Cancelado).
                  </p>
                </div>
                <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  {tempConfig.nonEffectiveClaves.length} claves
                </span>
              </div>

              {/* Add Input */}
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Agregar clave (ej. C-01, OK CASA)..."
                  value={newNonEffectiveInput}
                  onChange={(e) => setNewNonEffectiveInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddNonEffective())}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={handleAddNonEffective}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar</span>
                </button>
              </div>

              {/* List of tags */}
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1 bg-slate-900/60 rounded-xl border border-slate-800">
                {tempConfig.nonEffectiveClaves.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic p-2">No hay claves no efectivas registradas.</p>
                ) : (
                  tempConfig.nonEffectiveClaves.map((clave) => (
                    <span
                      key={clave}
                      className="bg-amber-500/20 text-amber-200 border border-amber-500/30 px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5"
                    >
                      <span>{clave}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveNonEffective(clave)}
                        className="text-amber-400 hover:text-white transition-colors"
                        title="Eliminar clave"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Column B: Claves Efectivas / Falla Real */}
            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                    Claves Efectivas / Falla Real (2ª Visita)
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Cierres donde sí se reparó un daño físico (ej: Par Sulfatado, Cable Roto, Splitter, Central).
                  </p>
                </div>
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  {tempConfig.effectiveClaves.length} claves
                </span>
              </div>

              {/* Add Input */}
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Agregar clave (ej. C-04, CABLE ROTO)..."
                  value={newEffectiveInput}
                  onChange={(e) => setNewEffectiveInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEffective())}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddEffective}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar</span>
                </button>
              </div>

              {/* List of tags */}
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1 bg-slate-900/60 rounded-xl border border-slate-800">
                {tempConfig.effectiveClaves.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic p-2">No hay claves efectivas registradas.</p>
                ) : (
                  tempConfig.effectiveClaves.map((clave) => (
                    <span
                      key={clave}
                      className="bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5"
                    >
                      <span>{clave}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveEffective(clave)}
                        className="text-emerald-400 hover:text-white transition-colors"
                        title="Eliminar clave"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 3. Custom Pairs Section (Optional for fine-grained rules) */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-indigo-300 flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                  Reglas Específicas de Pares (Clave 1 ➔ Clave 2)
                </h4>
                <p className="text-[10px] text-slate-400">
                  Opcional: Si desea sancionar específicamente un salto directo de una clave a otra.
                </p>
              </div>
              <span className="text-[11px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                {tempConfig.customPairs.length} reglas
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="Clave 1 (ej. C-01)"
                value={fromPairClave}
                onChange={(e) => setFromPairClave(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
              <input
                type="text"
                placeholder="Clave 2 (ej. C-04)"
                value={toPairClave}
                onChange={(e) => setToPairClave(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
              <input
                type="text"
                placeholder="Descripción (ej. Falso Cierre de Acometida)"
                value={pairDesc}
                onChange={(e) => setPairDesc(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
              <button
                type="button"
                onClick={handleAddPairRule}
                disabled={!fromPairClave || !toPairClave}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold px-3 py-1.5 rounded-xl transition-all flex items-center justify-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar Regla</span>
              </button>
            </div>

            {tempConfig.customPairs.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {tempConfig.customPairs.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800 text-[11px]"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-amber-300">{p.fromClave}</span>
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <span className="font-mono font-bold text-emerald-300">{p.toClave}</span>
                      {p.description && <span className="text-slate-400">({p.description})</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePair(idx)}
                      className="text-rose-400 hover:text-rose-300 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="text-xs text-slate-400 hover:text-white flex items-center space-x-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-900 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer sugeridos</span>
          </button>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-all shadow-lg shadow-rose-600/30 flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Guardar Configuración</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
