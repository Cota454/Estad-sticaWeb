import React, { useState } from 'react';
import { ZoneConfig, ZoneCableRule } from '../types/ipCablesTypes';
import { saveZones, DEFAULT_ZONES } from '../utils/ipCablesStorage';
import {
  MapPin,
  Plus,
  Trash2,
  Edit2,
  X,
  Check,
  Building2,
  Cable,
  RotateCcw,
  Sparkles,
  Layers,
  HelpCircle,
  Tag
} from 'lucide-react';

interface ZoneManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  zones: ZoneConfig[];
  availableCentrales: string[];
  availableCables: string[];
  onZonesUpdated: (updatedZones: ZoneConfig[]) => void;
}

export const ZoneManagementModal: React.FC<ZoneManagementModalProps> = ({
  isOpen,
  onClose,
  zones,
  availableCentrales,
  availableCables,
  onZonesUpdated
}) => {
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);

  // Form State
  const [formName, setFormName] = useState<string>('');
  const [formDesc, setFormDesc] = useState<string>('');
  const [formColor, setFormColor] = useState<string>('#3B82F6');
  const [formCentrales, setFormCentrales] = useState<string[]>([]);
  
  // Cable Rules State (Supports simple cable or cable with specific terminals)
  const [formCableRules, setFormCableRules] = useState<ZoneCableRule[]>([]);
  
  // Add Cable Sub-Form State
  const [cableInput, setCableInput] = useState<string>('');
  const [cableMode, setCableMode] = useState<'all' | 'terminals'>('all'); // 'all' = Todo el Cable, 'terminals' = Verificar Terminal
  const [terminalsInput, setTerminalsInput] = useState<string>('');

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setIsCreatingNew(true);
    setEditingZoneId(null);
    setFormName('');
    setFormDesc('');
    setFormColor('#3B82F6');
    setFormCentrales([]);
    setFormCableRules([]);
    setCableInput('');
    setCableMode('all');
    setTerminalsInput('');
  };

  const handleStartEdit = (zone: ZoneConfig) => {
    setEditingZoneId(zone.id);
    setIsCreatingNew(false);
    setFormName(zone.name);
    setFormDesc(zone.description || '');
    setFormColor(zone.color || '#3B82F6');
    setFormCentrales([...zone.centralNames]);
    
    // Normalize existing cableRules or convert legacy cableNames
    let initialRules: ZoneCableRule[] = [];
    if (zone.cableRules && zone.cableRules.length > 0) {
      initialRules = zone.cableRules.map(r => ({
        cableName: r.cableName,
        matchTerminal: Boolean(r.matchTerminal),
        terminals: r.terminals ? [...r.terminals] : []
      }));
    } else if (zone.cableNames && zone.cableNames.length > 0) {
      initialRules = zone.cableNames.map(c => ({
        cableName: c,
        matchTerminal: false,
        terminals: []
      }));
    }

    setFormCableRules(initialRules);
    setCableInput('');
    setCableMode('all');
    setTerminalsInput('');
  };

  const handleCancelForm = () => {
    setIsCreatingNew(false);
    setEditingZoneId(null);
  };

  const handleToggleCentral = (centralName: string) => {
    if (formCentrales.includes(centralName)) {
      setFormCentrales(formCentrales.filter(c => c !== centralName));
    } else {
      setFormCentrales([...formCentrales, centralName]);
    }
  };

  const handleAddCableRule = () => {
    if (!cableInput.trim()) return;

    // Split multiple cables if user entered comma-separated cable names
    const rawCables = cableInput.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
    if (rawCables.length === 0) return;

    const parsedTerminals = cableMode === 'terminals' && terminalsInput.trim()
      ? terminalsInput.split(',').map(t => t.trim().toUpperCase()).filter(Boolean)
      : [];

    const isMatchTerminal = cableMode === 'terminals';

    const updated = [...formCableRules];

    rawCables.forEach(cableName => {
      // Find if this cable is already configured
      const existingIdx = updated.findIndex(r => r.cableName === cableName);
      if (existingIdx >= 0) {
        // Update existing rule
        if (isMatchTerminal) {
          // Merge terminals if already exists or replace
          const existingTerms = updated[existingIdx].terminals || [];
          const mergedTerms = Array.from(new Set([...existingTerms, ...parsedTerminals]));
          updated[existingIdx] = {
            cableName,
            matchTerminal: true,
            terminals: mergedTerms
          };
        } else {
          updated[existingIdx] = {
            cableName,
            matchTerminal: false,
            terminals: []
          };
        }
      } else {
        // Add new rule
        updated.push({
          cableName,
          matchTerminal: isMatchTerminal,
          terminals: isMatchTerminal ? parsedTerminals : []
        });
      }
    });

    setFormCableRules(updated);
    setCableInput('');
    setTerminalsInput('');
    setCableMode('all');
  };

  const handleRemoveCableRule = (cableName: string) => {
    setFormCableRules(formCableRules.filter(r => r.cableName !== cableName));
  };

  const handleSelectSuggestedCable = (suggestedCable: string) => {
    setCableInput(suggestedCable);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    // Backward compatibility: maintain cableNames array alongside detailed cableRules
    const legacyCableNames: string[] = Array.from(new Set(formCableRules.map(r => r.cableName)));

    let updatedList: ZoneConfig[];

    if (isCreatingNew) {
      const newZone: ZoneConfig = {
        id: `zone_${Date.now()}`,
        name: formName.trim(),
        description: formDesc.trim(),
        centralNames: formCentrales,
        cableNames: legacyCableNames,
        cableRules: formCableRules,
        color: formColor
      };
      updatedList = [...zones, newZone];
    } else if (editingZoneId) {
      updatedList = zones.map(z => {
        if (z.id === editingZoneId) {
          return {
            ...z,
            name: formName.trim(),
            description: formDesc.trim(),
            centralNames: formCentrales,
            cableNames: legacyCableNames,
            cableRules: formCableRules,
            color: formColor
          };
        }
        return z;
      });
    } else {
      return;
    }

    saveZones(updatedList);
    onZonesUpdated(updatedList);
    handleCancelForm();
  };

  const handleDeleteZone = (id: string) => {
    if (confirm('¿Está seguro de que desea eliminar esta zona?')) {
      const updatedList = zones.filter(z => z.id !== id);
      saveZones(updatedList);
      onZonesUpdated(updatedList);
      if (editingZoneId === id) handleCancelForm();
    }
  };

  const handleResetDefaultZones = () => {
    if (confirm('¿Desea restablecer las zonas a las configuraciones por defecto?')) {
      saveZones(DEFAULT_ZONES);
      onZonesUpdated(DEFAULT_ZONES);
      handleCancelForm();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur-md z-10">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-2xl">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-white">
                Gestor y Dashboard de Zonificación
              </h2>
              <p className="text-xs text-slate-400">
                Creación, edición y asignación de Centrales Telefónicas, Cables y Terminales por Zona.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleResetDefaultZones}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-all flex items-center space-x-1"
              title="Restablecer Zonas por Defecto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Restablecer</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1">
          
          {/* Action Bar */}
          {!isCreatingNew && !editingZoneId && (
            <div className="flex items-center justify-between bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div className="text-xs text-slate-400">
                Total de Zonas Registradas: <strong className="text-white text-sm font-black">{zones.length}</strong>
              </div>
              <button
                onClick={handleStartCreate}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Crear Nueva Zona</span>
              </button>
            </div>
          )}

          {/* Form for Creating / Editing Zone */}
          {(isCreatingNew || editingZoneId) && (
            <form onSubmit={handleSaveForm} className="bg-slate-950 p-5 rounded-2xl border border-blue-500/40 space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-extrabold text-sm text-blue-400 flex items-center space-x-2">
                  <Sparkles className="w-4 h-4" />
                  <span>{isCreatingNew ? 'Configurar Nueva Zona' : 'Editar Zona Existente'}</span>
                </h3>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Nombre de la Zona</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Zona Metro / Anillo Norte"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2.5 font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Color de Identificación</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={formColor}
                      onChange={(e) => setFormColor(e.target.value)}
                      className="w-10 h-9 rounded-xl bg-slate-900 border border-slate-700 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={formColor}
                      onChange={(e) => setFormColor(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2 font-mono uppercase"
                    />
                  </div>
                </div>

                <div className="md:col-span-3 space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Descripción o Sector (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Breve nota sobre las centrales o cables que cubre"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Centrales Selection */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-[11px] font-extrabold uppercase text-blue-300 flex items-center space-x-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Asignar Centrales Telefónicas a esta Zona ({formCentrales.length} seleccionadas)</span>
                </label>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-2 bg-slate-900 rounded-xl border border-slate-800">
                  {availableCentrales.length === 0 ? (
                    <div className="col-span-full text-xs text-slate-500 p-2 text-center">
                      Cargue un archivo Excel o configure centrales para asignarlas.
                    </div>
                  ) : (
                    availableCentrales.map((cName) => {
                      const isSelected = formCentrales.includes(cName);
                      return (
                        <button
                          type="button"
                          key={cName}
                          onClick={() => handleToggleCentral(cName)}
                          className={`p-2 rounded-xl text-xs font-bold text-left transition-all border flex items-center justify-between ${
                            isSelected
                              ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                          }`}
                        >
                          <span className="truncate">{cName}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Cables & Terminals Selection */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold uppercase text-amber-300 flex items-center space-x-1.5">
                    <Cable className="w-3.5 h-3.5 text-amber-400" />
                    <span>Asignar Cables y Terminales a esta Zona ({formCableRules.length} reglas configuradas)</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Verificación de Columna Terminal activa</span>
                </div>

                {/* Cable Rule Configuration Box */}
                <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    
                    {/* Cable Input */}
                    <div className="md:col-span-5 space-y-1">
                      <label className="text-[10px] font-extrabold uppercase text-slate-400">
                        1. Nombre de Cable (ej: VA12, VA61):
                      </label>
                      <input
                        type="text"
                        placeholder="Escriba cable (ej: VA12 o varios: VA12, VA13)"
                        value={cableInput}
                        onChange={(e) => setCableInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && cableMode === 'all') {
                            e.preventDefault();
                            handleAddCableRule();
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:outline-none focus:border-amber-500 font-mono font-bold"
                      />
                    </div>

                    {/* Mode Selector */}
                    <div className="md:col-span-4 space-y-1">
                      <label className="text-[10px] font-extrabold uppercase text-slate-400">
                        2. Cobertura del Cable:
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setCableMode('all')}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                            cableMode === 'all'
                              ? 'bg-amber-600 text-white shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Todo el Cable
                        </button>
                        <button
                          type="button"
                          onClick={() => setCableMode('terminals')}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                            cableMode === 'terminals'
                              ? 'bg-blue-600 text-white shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Verificar Terminal
                        </button>
                      </div>
                    </div>

                    {/* Add Button */}
                    <div className="md:col-span-3">
                      <button
                        type="button"
                        onClick={handleAddCableRule}
                        disabled={!cableInput.trim()}
                        className={`w-full py-2.5 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
                          cableInput.trim()
                            ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20'
                            : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                        <span>Asignar a Zona</span>
                      </button>
                    </div>

                  </div>

                  {/* Terminal Input field shown only when 'Verificar Terminal' is selected */}
                  {cableMode === 'terminals' && (
                    <div className="p-3 bg-blue-950/30 border border-blue-800/40 rounded-xl space-y-1.5 animate-in fade-in duration-150">
                      <label className="text-[11px] font-bold text-blue-300 flex items-center space-x-1">
                        <Tag className="w-3.5 h-3.5 text-blue-400" />
                        <span>Nombres de los Terminales pertenecientes a este Cable (separados por coma):</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ejemplo: 1210, 1211, 1215, T-04, 204B"
                        value={terminalsInput}
                        onChange={(e) => setTerminalsInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCableRule();
                          }
                        }}
                        className="w-full bg-slate-950 border border-blue-600/50 text-blue-100 text-xs rounded-xl p-2.5 font-mono focus:outline-none focus:border-blue-400"
                      />
                      <p className="text-[10px] text-blue-300/70">
                        * El servicio se asignará a esta zona <strong>únicamente si pertenece al cable "{cableInput || '...'}" y al Terminal indicado en la columna Terminal</strong> del archivo Excel.
                      </p>
                    </div>
                  )}
                </div>

                {/* Assigned Cables Badges */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">
                    Cables y Reglas asignadas a esta zona:
                  </div>

                  <div className="flex flex-wrap gap-2 p-3 bg-slate-900 rounded-xl border border-slate-800 min-h-[52px]">
                    {formCableRules.length === 0 ? (
                      <span className="text-xs text-slate-500 p-1">No hay cables o terminales asignados a esta zona.</span>
                    ) : (
                      formCableRules.map((rule) => {
                        const hasTerminals = rule.matchTerminal && rule.terminals && rule.terminals.length > 0;
                        return (
                          <span
                            key={rule.cableName}
                            className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold ${
                              hasTerminals
                                ? 'bg-blue-950/70 text-blue-200 border-blue-700/60 shadow-sm'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            <div className="flex items-center space-x-1.5">
                              <Cable className="w-3.5 h-3.5 text-amber-400" />
                              <span className="font-extrabold">{rule.cableName}</span>
                              {hasTerminals ? (
                                <span className="text-[10px] bg-blue-600/30 border border-blue-500/50 text-blue-300 px-1.5 py-0.5 rounded-md font-sans">
                                  Terminal: {rule.terminals!.join(', ')}
                                </span>
                              ) : (
                                <span className="text-[9px] text-amber-400/70 font-sans uppercase">
                                  (Todo el cable)
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveCableRule(rule.cableName)}
                              className="hover:text-rose-400 ml-1.5 transition-colors"
                              title="Eliminar regla"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Available Cables Suggestions */}
                {availableCables.length > 0 && (
                  <div className="text-[11px] text-slate-400 pt-1">
                    <span className="font-bold text-slate-300">Cables detectados en Excel (clic para autocompletar):</span>
                    <div className="flex flex-wrap gap-1 mt-1 max-h-24 overflow-y-auto">
                      {availableCables.map(c => {
                        const isAssigned = formCableRules.some(r => r.cableName === c);
                        return (
                          <button
                            type="button"
                            key={c}
                            onClick={() => handleSelectSuggestedCable(c)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                              isAssigned
                                ? 'bg-slate-800 text-slate-500 border-slate-800 hover:border-slate-700'
                                : 'bg-slate-900 text-amber-400 border-slate-700 hover:border-amber-500 hover:bg-slate-800'
                            }`}
                          >
                            + {c} {isAssigned && '✓'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/30"
                >
                  Guardar Cambios de Zona
                </button>
              </div>
            </form>
          )}

          {/* Zones Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {zones.map((zone) => {
              const cableRulesList = zone.cableRules && zone.cableRules.length > 0
                ? zone.cableRules
                : (zone.cableNames || []).map(c => ({ cableName: c, matchTerminal: false }));

              return (
                <div
                  key={zone.id}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 relative hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center space-x-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: zone.color || '#3B82F6' }}
                      />
                      <h3 className="font-black text-sm text-white">{zone.name}</h3>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleStartEdit(zone)}
                        className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-colors"
                        title="Editar Zona"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                      </button>
                      <button
                        onClick={() => handleDeleteZone(zone.id)}
                        className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-colors"
                        title="Eliminar Zona"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      </button>
                    </div>
                  </div>

                  {zone.description && (
                    <p className="text-xs text-slate-400 italic">{zone.description}</p>
                  )}

                  {/* Centrales list */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Centrales Telefónicas ({zone.centralNames.length}):</span>
                    <div className="flex flex-wrap gap-1">
                      {zone.centralNames.length === 0 ? (
                        <span className="text-[11px] text-slate-600 italic">Ninguna asignada</span>
                      ) : (
                        zone.centralNames.map(c => (
                          <span key={c} className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60 text-[10px] font-semibold">
                            {c}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Cables & Terminals list */}
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Cables y Terminales ({cableRulesList.length}):</span>
                    <div className="flex flex-wrap gap-1.5">
                      {cableRulesList.length === 0 ? (
                        <span className="text-[11px] text-slate-600 italic">Ningún cable asignado</span>
                      ) : (
                        cableRulesList.map(rule => {
                          const hasTerminals = rule.matchTerminal && rule.terminals && rule.terminals.length > 0;
                          return (
                            <span
                              key={rule.cableName}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono border flex items-center space-x-1 ${
                                hasTerminals
                                  ? 'bg-blue-950 text-blue-200 border-blue-700/60'
                                  : 'bg-amber-950 text-amber-300 border border-amber-800/60'
                              }`}
                            >
                              <span className="font-bold">{rule.cableName}</span>
                              {hasTerminals && (
                                <span className="text-[9px] text-blue-300 font-sans">
                                  [Term: {rule.terminals!.join(',')}]
                                </span>
                              )}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 rounded-b-3xl flex items-center justify-between text-xs text-slate-400">
          <span>Las zonas y terminales configurados se actualizan automáticamente en la Matriz 2 de Zonificación.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl"
          >
            Cerrar Gestor
          </button>
        </div>

      </div>
    </div>
  );
};
