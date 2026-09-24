import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Info,
  Check,
  Tag,
  KeyRound
} from 'lucide-react';
import { IncoherentAuditConfig, IncoherenceDetectionMode, NonEffectiveMappingRule } from '../types';
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

  const [tempConfig, setTempConfig] = useState<IncoherentAuditConfig>(() => ({
    ...DEFAULT_INCOHERENT_CONFIG,
    ...config,
    nonEffectiveMappings: (config.nonEffectiveMappings && config.nonEffectiveMappings.length > 0)
      ? config.nonEffectiveMappings
      : DEFAULT_INCOHERENT_CONFIG.nonEffectiveMappings || []
  }));

  // State for creating a new Clave No Efectiva with multiple Claves Efectivas asignadas
  const [formNonEffectiveClave, setFormNonEffectiveClave] = useState('');
  const [formAssignedEffectiveClaves, setFormAssignedEffectiveClaves] = useState<string[]>([]);
  const [formSingleEffectiveInput, setFormSingleEffectiveInput] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // Editing state for an existing rule
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Inline quick-add effective key to an existing rule
  const [inlineAddKeyRuleId, setInlineAddKeyRuleId] = useState<string | null>(null);
  const [inlineNewEffectiveKey, setInlineNewEffectiveKey] = useState('');

  // Global catalogs quick inputs
  const [newNonEffectiveInput, setNewNonEffectiveInput] = useState('');
  const [newEffectiveInput, setNewEffectiveInput] = useState('');

  // Active sub-tab inside the modal
  const [modalTab, setModalTab] = useState<'mappings' | 'catalog' | 'settings'>('mappings');

  // Helper: list of all effective keys available from config + data
  const allKnownEffectiveClaves = Array.from(
    new Set([
      ...tempConfig.effectiveClaves,
      ...availableClavesFromData.filter(c => !tempConfig.nonEffectiveClaves.map(normalizeClave).includes(normalizeClave(c)))
    ])
  ).sort();

  // Helper: list of candidate non-effective keys from config + data
  const allCandidateNonEffectiveClaves = Array.from(
    new Set([
      ...tempConfig.nonEffectiveClaves,
      ...availableClavesFromData.filter(c => !tempConfig.effectiveClaves.map(normalizeClave).includes(normalizeClave(c)))
    ])
  ).sort();

  // Add single effective key to the form selection
  const handleAddEffectiveToForm = (keyToAdd: string) => {
    const norm = normalizeClave(keyToAdd);
    if (!norm) return;
    if (!formAssignedEffectiveClaves.map(normalizeClave).includes(norm)) {
      setFormAssignedEffectiveClaves([...formAssignedEffectiveClaves, norm]);
    }
    setFormSingleEffectiveInput('');
  };

  // Remove effective key from form selection
  const handleRemoveEffectiveFromForm = (keyToRemove: string) => {
    setFormAssignedEffectiveClaves(
      formAssignedEffectiveClaves.filter(c => normalizeClave(c) !== normalizeClave(keyToRemove))
    );
  };

  // Toggle selection of an effective key in form
  const handleToggleEffectiveInForm = (clave: string) => {
    const norm = normalizeClave(clave);
    if (formAssignedEffectiveClaves.map(normalizeClave).includes(norm)) {
      handleRemoveEffectiveFromForm(norm);
    } else {
      handleAddEffectiveToForm(norm);
    }
  };

  // Select all known effective keys into form
  const handleSelectAllEffectiveForForm = () => {
    const set = new Set([...formAssignedEffectiveClaves, ...allKnownEffectiveClaves]);
    setFormAssignedEffectiveClaves(Array.from(set));
  };

  // Clear selected effective keys in form
  const handleClearSelectedEffectiveForForm = () => {
    setFormAssignedEffectiveClaves([]);
  };

  // Save or Update Mapping Rule (1 Clave No Efectiva ➔ Múltiples Claves Efectivas)
  const handleSaveMappingRule = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const nonEffNorm = normalizeClave(formNonEffectiveClave);
    if (!nonEffNorm) {
      alert('Por favor ingrese o seleccione una Clave No Efectiva (1ª Visita).');
      return;
    }
    if (formAssignedEffectiveClaves.length === 0) {
      alert('Por favor asigne al menos una Clave Efectiva (2ª Visita) para esta regla de incoherencia.');
      return;
    }

    const currentMappings = tempConfig.nonEffectiveMappings || [];
    let updatedMappings: NonEffectiveMappingRule[] = [];

    if (editingRuleId) {
      updatedMappings = currentMappings.map(m => {
        if (m.id === editingRuleId) {
          return {
            ...m,
            nonEffectiveClave: nonEffNorm,
            effectiveClaves: [...formAssignedEffectiveClaves],
            description: formDescription.trim() || `1ª Visita ${nonEffNorm} ➔ 2ª Visita Falla Real Asignada`
          };
        }
        return m;
      });
      setEditingRuleId(null);
    } else {
      // Check if rule for this nonEffectiveClave already exists; if so, merge assigned effective keys
      const existingIdx = currentMappings.findIndex(
        m => normalizeClave(m.nonEffectiveClave) === nonEffNorm
      );

      if (existingIdx >= 0) {
        const existing = currentMappings[existingIdx];
        const mergedKeys = Array.from(new Set([...existing.effectiveClaves, ...formAssignedEffectiveClaves]));
        updatedMappings = [...currentMappings];
        updatedMappings[existingIdx] = {
          ...existing,
          effectiveClaves: mergedKeys,
          description: formDescription.trim() || existing.description || `1ª Visita ${nonEffNorm} ➔ 2ª Visita Falla Real Asignada`
        };
      } else {
        const newRule: NonEffectiveMappingRule = {
          id: `map_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          nonEffectiveClave: nonEffNorm,
          effectiveClaves: [...formAssignedEffectiveClaves],
          description: formDescription.trim() || `1ª Visita ${nonEffNorm} ➔ 2ª Visita Falla Real Asignada`
        };
        updatedMappings = [newRule, ...currentMappings];
      }
    }

    // Sync with global catalogs
    const updatedNonEffectiveClaves = Array.from(
      new Set([...tempConfig.nonEffectiveClaves, nonEffNorm])
    );
    const updatedEffectiveClaves = Array.from(
      new Set([...tempConfig.effectiveClaves, ...formAssignedEffectiveClaves])
    );

    setTempConfig({
      ...tempConfig,
      nonEffectiveMappings: updatedMappings,
      nonEffectiveClaves: updatedNonEffectiveClaves,
      effectiveClaves: updatedEffectiveClaves
    });

    // Reset form
    setFormNonEffectiveClave('');
    setFormAssignedEffectiveClaves([]);
    setFormSingleEffectiveInput('');
    setFormDescription('');
  };

  // Start editing a rule
  const handleStartEditRule = (rule: NonEffectiveMappingRule) => {
    setEditingRuleId(rule.id);
    setFormNonEffectiveClave(rule.nonEffectiveClave);
    setFormAssignedEffectiveClaves([...rule.effectiveClaves]);
    setFormDescription(rule.description || '');
    setModalTab('mappings');
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingRuleId(null);
    setFormNonEffectiveClave('');
    setFormAssignedEffectiveClaves([]);
    setFormSingleEffectiveInput('');
    setFormDescription('');
  };

  // Delete entire mapping rule
  const handleDeleteMappingRule = (ruleId: string) => {
    const currentMappings = tempConfig.nonEffectiveMappings || [];
    setTempConfig({
      ...tempConfig,
      nonEffectiveMappings: currentMappings.filter(m => m.id !== ruleId)
    });
  };

  // Remove single effective key from a specific rule
  const handleRemoveEffectiveKeyFromRule = (ruleId: string, keyToRemove: string) => {
    const currentMappings = tempConfig.nonEffectiveMappings || [];
    setTempConfig({
      ...tempConfig,
      nonEffectiveMappings: currentMappings.map(m => {
        if (m.id === ruleId) {
          return {
            ...m,
            effectiveClaves: m.effectiveClaves.filter(c => normalizeClave(c) !== normalizeClave(keyToRemove))
          };
        }
        return m;
      })
    });
  };

  // Inline add an effective key to a specific rule
  const handleInlineAddEffectiveKey = (ruleId: string) => {
    const norm = normalizeClave(inlineNewEffectiveKey);
    if (!norm) return;
    const currentMappings = tempConfig.nonEffectiveMappings || [];
    setTempConfig({
      ...tempConfig,
      nonEffectiveMappings: currentMappings.map(m => {
        if (m.id === ruleId) {
          if (!m.effectiveClaves.map(normalizeClave).includes(norm)) {
            return {
              ...m,
              effectiveClaves: [...m.effectiveClaves, norm]
            };
          }
        }
        return m;
      }),
      effectiveClaves: Array.from(new Set([...tempConfig.effectiveClaves, norm]))
    });
    setInlineNewEffectiveKey('');
    setInlineAddKeyRuleId(null);
  };

  // Global catalog operations
  const handleAddNonEffectiveToCatalog = () => {
    const val = normalizeClave(newNonEffectiveInput);
    if (!val) return;
    if (!tempConfig.nonEffectiveClaves.map(normalizeClave).includes(val)) {
      setTempConfig({
        ...tempConfig,
        nonEffectiveClaves: [...tempConfig.nonEffectiveClaves, val],
        effectiveClaves: tempConfig.effectiveClaves.filter(c => normalizeClave(c) !== val)
      });
    }
    setNewNonEffectiveInput('');
  };

  const handleRemoveNonEffectiveFromCatalog = (claveToRemove: string) => {
    setTempConfig({
      ...tempConfig,
      nonEffectiveClaves: tempConfig.nonEffectiveClaves.filter(
        c => normalizeClave(c) !== normalizeClave(claveToRemove)
      )
    });
  };

  const handleAddEffectiveToCatalog = () => {
    const val = normalizeClave(newEffectiveInput);
    if (!val) return;
    if (!tempConfig.effectiveClaves.map(normalizeClave).includes(val)) {
      setTempConfig({
        ...tempConfig,
        effectiveClaves: [...tempConfig.effectiveClaves, val],
        nonEffectiveClaves: tempConfig.nonEffectiveClaves.filter(c => normalizeClave(c) !== val)
      });
    }
    setNewEffectiveInput('');
  };

  const handleRemoveEffectiveFromCatalog = (claveToRemove: string) => {
    setTempConfig({
      ...tempConfig,
      effectiveClaves: tempConfig.effectiveClaves.filter(
        c => normalizeClave(c) !== normalizeClave(claveToRemove)
      )
    });
  };

  const handleResetToDefaults = () => {
    if (window.confirm('¿Desea restablecer las reglas de incoherencia a los valores predeterminados del sistema?')) {
      setTempConfig({ ...DEFAULT_INCOHERENT_CONFIG });
      setEditingRuleId(null);
    }
  };

  const handleSave = () => {
    onSaveConfig(tempConfig);
    onClose();
  };

  const currentMappings = tempConfig.nonEffectiveMappings || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white animate-in fade-in zoom-in-95 duration-200">
        
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
                Asigne a cada <strong>Clave No Efectiva</strong> varias <strong>Claves Efectivas</strong> para detectar incoherencias entre la 1ª y 2ª visita.
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

        {/* Modal Navigation Sub-tabs */}
        <div className="px-6 pt-3 bg-slate-950/60 border-b border-slate-800 flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setModalTab('mappings')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center space-x-2 border-b-2 ${
              modalTab === 'mappings'
                ? 'border-amber-400 text-amber-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900/40'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>1. Asignación de Claves (1 No Efectiva ➔ Varias Efectivas)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono">
              {currentMappings.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setModalTab('catalog')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center space-x-2 border-b-2 ${
              modalTab === 'catalog'
                ? 'border-indigo-400 text-indigo-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900/40'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>2. Catálogo Global de Claves</span>
          </button>

          <button
            type="button"
            onClick={() => setModalTab('settings')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center space-x-2 border-b-2 ${
              modalTab === 'settings'
                ? 'border-rose-400 text-rose-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900/40'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>3. Ventana de Días y Detección</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">

          {/* ========================================================================= */}
          {/* TAB 1: ASIGNACIÓN DE 1 CLAVE NO EFECTIVA ➔ MÚLTIPLES CLAVES EFECTIVAS     */}
          {/* ========================================================================= */}
          {modalTab === 'mappings' && (
            <div className="space-y-6">

              {/* Explanatory Banner */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200/90 flex items-start space-x-3">
                <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-300">
                    Lógica de Detección de Incoherencia (Falsos Cierres):
                  </p>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Al crear o configurar una <strong>Clave No Efectiva</strong> (1ª visita), usted puede asignarle <strong>varias Claves Efectivas</strong>.
                    Si un servicio con el <em>mismo Folio</em> cerró primero con esa clave no efectiva y en su segunda visita cerró con <em>cualquiera de esas claves efectivas asignadas</em> dentro de ≤ {tempConfig.windowDays} días, el sistema lo registrará automáticamente como <strong>Cierre Incoherente</strong> y afectará al 1er técnico.
                  </p>
                </div>
              </div>

              {/* Form to Add / Edit Rule */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                      <Plus className="w-4 h-4" />
                    </span>
                    <h4 className="text-xs font-black text-white uppercase tracking-wider">
                      {editingRuleId ? 'Modificar Regla de Clave No Efectiva' : 'Nueva Regla: Asignar Varias Claves Efectivas a una Clave No Efectiva'}
                    </h4>
                  </div>
                  {editingRuleId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="text-xs text-rose-400 hover:text-rose-300 font-bold"
                    >
                      Cancelar Edición
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Step 1: Clave No Efectiva (1ª Visita) */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-amber-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
                      <span>1. Clave No Efectiva (1ª Visita):</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. C-01, SIN FALLA, OK PRUEBAS, CLIENTE AUSENTE..."
                      value={formNonEffectiveClave}
                      onChange={(e) => setFormNonEffectiveClave(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                    />

                    {/* Quick suggestion chips for Clave No Efectiva */}
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] text-slate-400">Sugerencias rápidas detectadas:</span>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 bg-slate-900/50 rounded-xl border border-slate-800/60">
                        {allCandidateNonEffectiveClaves.slice(0, 10).map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setFormNonEffectiveClave(c)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all ${
                              normalizeClave(formNonEffectiveClave) === normalizeClave(c)
                                ? 'bg-amber-500 text-slate-950 shadow-sm'
                                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Descripción u Observación */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-300">
                      Observación / Motivo de Incoherencia (Opcional):
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. 1ª visita sin falla refutada por daño en planta externa"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-slate-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400">
                      Este texto aparecerá en el diagnóstico y reporte Excel cuando se detecte la discrepancia.
                    </p>
                  </div>
                </div>

                {/* Step 3: Asignar Múltiples Claves Efectivas (2ª Visita) */}
                <div className="space-y-2.5 pt-2 border-t border-slate-800/70">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                      <span>2. Claves Efectivas Asignadas a esta regla (2ª Visita - Falla Real):</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                        {formAssignedEffectiveClaves.length} seleccionadas
                      </span>
                    </label>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={handleSelectAllEffectiveForForm}
                        className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 underline"
                      >
                        Seleccionar Todas las Claves Efectivas
                      </button>
                      <span className="text-slate-600">|</span>
                      <button
                        type="button"
                        onClick={handleClearSelectedEffectiveForForm}
                        className="text-[10px] font-bold text-slate-400 hover:text-slate-300 underline"
                      >
                        Limpiar selección
                      </button>
                    </div>
                  </div>

                  {/* Add single effective key manually */}
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Escriba otra clave y presione Enter o Agregar (ej. C-03, PAR DAÑADO)..."
                      value={formSingleEffectiveInput}
                      onChange={(e) => setFormSingleEffectiveInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddEffectiveToForm(formSingleEffectiveInput);
                        }
                      }}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddEffectiveToForm(formSingleEffectiveInput)}
                      disabled={!formSingleEffectiveInput.trim()}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Asignar</span>
                    </button>
                  </div>

                  {/* Quick toggle chips from all available effective keys */}
                  <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Haga clic para activar / desactivar las claves efectivas asignadas:</span>
                      <span className="text-emerald-400 font-normal lowercase">{formAssignedEffectiveClaves.length} de {allKnownEffectiveClaves.length} asignadas</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                      {allKnownEffectiveClaves.map((clave) => {
                        const isAssigned = formAssignedEffectiveClaves.map(normalizeClave).includes(normalizeClave(clave));
                        return (
                          <button
                            key={clave}
                            type="button"
                            onClick={() => handleToggleEffectiveInForm(clave)}
                            className={`flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold transition-all border ${
                              isAssigned
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                            }`}
                          >
                            {isAssigned ? (
                              <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                            ) : (
                              <Plus className="w-3 h-3 text-slate-500 shrink-0" />
                            )}
                            <span>{clave}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Currently Assigned Keys Pills */}
                  {formAssignedEffectiveClaves.length > 0 && (
                    <div className="p-2.5 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-1.5">
                      <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                        Claves Efectivas que causarán Incoherencia:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {formAssignedEffectiveClaves.map(clave => (
                          <span
                            key={clave}
                            className="bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 px-2 py-0.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-1"
                          >
                            <span>{clave}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveEffectiveFromForm(clave)}
                              className="text-emerald-400 hover:text-white ml-1"
                              title="Quitar clave"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit button for the rule */}
                <div className="flex items-center justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => handleSaveMappingRule()}
                    disabled={!formNonEffectiveClave.trim() || formAssignedEffectiveClaves.length === 0}
                    className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center space-x-2 text-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{editingRuleId ? 'Actualizar Regla de Incoherencia' : 'Guardar y Asignar Claves a esta Regla'}</span>
                  </button>
                </div>
              </div>

              {/* LIST OF CONFIGURED RULES */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center space-x-2">
                    <span>Reglas de Claves No Efectivas Configuradas</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono">
                      {currentMappings.length} reglas activas
                    </span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Se evalúan en orden cronológico entre visitas con el mismo Servicio y Folio
                  </span>
                </div>

                {currentMappings.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 text-slate-400 space-y-2">
                    <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="font-bold">No hay reglas de asignación configuradas.</p>
                    <p className="text-xs text-slate-500">
                      Cree una regla arriba especificando la Clave No Efectiva y sus Claves Efectivas asignadas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentMappings.map((rule) => (
                      <div
                        key={rule.id}
                        className="bg-slate-950/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 transition-all space-y-3 shadow-md"
                      >
                        {/* Rule Card Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                          <div className="flex items-center space-x-2.5">
                            <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-black text-xs">
                              1ª Visita: {rule.nonEffectiveClave}
                            </span>
                            <ArrowRight className="w-4 h-4 text-slate-500" />
                            <span className="text-xs font-bold text-white">
                              Refutada por <strong className="text-emerald-400">{rule.effectiveClaves.length} claves efectivas asignadas</strong>:
                            </span>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => handleStartEditRule(rule)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-bold transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMappingRule(rule.id)}
                              className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="Eliminar regla completa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Description */}
                        {rule.description && (
                          <div className="text-[11px] text-slate-400 italic">
                            Motivo: {rule.description}
                          </div>
                        )}

                        {/* Assigned Effective Claves Chips */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {rule.effectiveClaves.map((effClave) => (
                            <span
                              key={effClave}
                              className="bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold flex items-center space-x-1"
                            >
                              <span>{effClave}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveEffectiveKeyFromRule(rule.id, effClave)}
                                className="text-emerald-400 hover:text-rose-400 transition-colors ml-0.5"
                                title={`Quitar ${effClave} de esta regla`}
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}

                          {/* Quick inline button to add another effective key */}
                          {inlineAddKeyRuleId === rule.id ? (
                            <div className="flex items-center space-x-1 ml-1">
                              <input
                                type="text"
                                placeholder="Clave nueva..."
                                value={inlineNewEffectiveKey}
                                onChange={(e) => setInlineNewEffectiveKey(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleInlineAddEffectiveKey(rule.id);
                                  }
                                }}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-[11px] font-mono text-white w-28 focus:border-emerald-400 focus:outline-none"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleInlineAddEffectiveKey(rule.id)}
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold"
                              >
                                OK
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setInlineAddKeyRuleId(null);
                                  setInlineNewEffectiveKey('');
                                }}
                                className="px-1 py-0.5 text-slate-400 hover:text-white text-[10px]"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setInlineAddKeyRuleId(rule.id);
                                setInlineNewEffectiveKey('');
                              }}
                              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 flex items-center space-x-1 transition-all"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Sumar clave efectiva</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: CATÁLOGO GLOBAL DE CLAVES (NO EFECTIVAS VS EFECTIVAS)              */}
          {/* ========================================================================= */}
          {modalTab === 'catalog' && (
            <div className="space-y-6">

              {/* Quick Clave Tagger from Detected Data */}
              {availableClavesFromData.length > 0 && (
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Claves detectadas en sus datos cargados ({availableClavesFromData.length}):
                    </span>
                    <span className="text-[10px] text-slate-400">Haga clic en los botones para clasificar rápidamente</span>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
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
                              onClick={() => {
                                if (isNonEff) {
                                  handleRemoveNonEffectiveFromCatalog(norm);
                                } else {
                                  setTempConfig({
                                    ...tempConfig,
                                    nonEffectiveClaves: [...tempConfig.nonEffectiveClaves, norm],
                                    effectiveClaves: tempConfig.effectiveClaves.filter(c => normalizeClave(c) !== norm)
                                  });
                                }
                              }}
                              className={`text-[9px] px-1.5 py-0.5 rounded ${
                                isNonEff ? 'bg-amber-500 text-slate-950 font-black' : 'hover:bg-amber-500/30 text-amber-300'
                              }`}
                            >
                              No Efectiva
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (isEff) {
                                  handleRemoveEffectiveFromCatalog(norm);
                                } else {
                                  setTempConfig({
                                    ...tempConfig,
                                    effectiveClaves: [...tempConfig.effectiveClaves, norm],
                                    nonEffectiveClaves: tempConfig.nonEffectiveClaves.filter(c => normalizeClave(c) !== norm)
                                  });
                                }
                              }}
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

              {/* 2 Columns: Claves No Efectivas vs Claves Efectivas */}
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
                        Cierres sin reparación física (ej: Sin Falla, OK Casa, No atendieron).
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
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddNonEffectiveToCatalog())}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-amber-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleAddNonEffectiveToCatalog}
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
                            onClick={() => handleRemoveNonEffectiveFromCatalog(clave)}
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
                        Cierres con solución física (ej: Par Sulfatado, Cable Roto, Splitter, Central).
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
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEffectiveToCatalog())}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleAddEffectiveToCatalog}
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
                            onClick={() => handleRemoveEffectiveFromCatalog(clave)}
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

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: VENTANA DE DÍAS Y CRITERIOS GLOBALES                              */}
          {/* ========================================================================= */}
          {modalTab === 'settings' && (
            <div className="space-y-6">
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
                    Criterio de Detección Global:
                  </label>
                  <select
                    value={tempConfig.detectionMode}
                    onChange={(e) => setTempConfig({ ...tempConfig, detectionMode: e.target.value as IncoherenceDetectionMode })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 font-medium"
                  >
                    <option value="effective_vs_non_effective">
                      Clave No Efectiva (1ª Visita) ➔ Clave Efectiva (2ª Visita) [Recomendado]
                    </option>
                    <option value="all_different">
                      Cualquier cambio de Clave (Clave 1 ≠ Clave 2 en ≤ {tempConfig.windowDays} días)
                    </option>
                    <option value="custom_rules">
                      Solo Reglas Específicas / Pares de Claves
                    </option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {tempConfig.detectionMode === 'effective_vs_non_effective' && 'Aplica las reglas asignadas de 1 No Efectiva ➔ Varias Efectivas, más la matriz de falla real.'}
                    {tempConfig.detectionMode === 'all_different' && 'Detecta cualquier cambio de código de cierre entre la 1ª y 2ª visita para el mismo servicio y folio.'}
                    {tempConfig.detectionMode === 'custom_rules' && 'Solo evalúa las combinaciones exactas definidas.'}
                  </p>
                </div>
              </div>
            </div>
          )}

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
