import React, { useState } from 'react';
import { ZoneConfig } from '../types/ipCablesTypes';
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
  Layers
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
  const [formCables, setFormCables] = useState<string[]>([]);
  const [newCableInput, setNewCableInput] = useState<string>('');

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setIsCreatingNew(true);
    setEditingZoneId(null);
    setFormName('');
    setFormDesc('');
    setFormColor('#3B82F6');
    setFormCentrales([]);
    setFormCables([]);
    setNewCableInput('');
  };

  const handleStartEdit = (zone: ZoneConfig) => {
    setEditingZoneId(zone.id);
    setIsCreatingNew(false);
    setFormName(zone.name);
    setFormDesc(zone.description || '');
    setFormColor(zone.color || '#3B82F6');
    setFormCentrales([...zone.centralNames]);
    setFormCables([...zone.cableNames]);
    setNewCableInput('');
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

  const handleAddCable = () => {
    if (!newCableInput.trim()) return;
    const rawParts = newCableInput.split(',');
    const updated = [...formCables];

    rawParts.forEach(part => {
      const trimmed = part.trim().toUpperCase();
      if (trimmed && !updated.includes(trimmed)) {
        updated.push(trimmed);
      }
    });

    setFormCables(updated);
    setNewCableInput('');
  };

  const handleRemoveCable = (cableName: string) => {
    setFormCables(formCables.filter(c => c !== cableName));
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    let updatedList: ZoneConfig[];

    if (isCreatingNew) {
      const newZone: ZoneConfig = {
        id: `zone_${Date.now()}`,
        name: formName.trim(),
        description: formDesc.trim(),
        centralNames: formCentrales,
        cableNames: formCables,
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
            cableNames: formCables,
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
                Creación, edición y asignación de Centrales Telefónicas y Cables por Zona.
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

              {/* Cables Selection */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-[11px] font-extrabold uppercase text-amber-300 flex items-center space-x-1.5">
                  <Cable className="w-3.5 h-3.5 text-amber-400" />
                  <span>Asignar Cables Pertenecientes a esta Zona ({formCables.length} cables)</span>
                </label>

                {/* Cable Input Add */}
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Escriba uno o varios cables separados por coma (ej: VA61, VA62, VA63) o seleccione abajo"
                    value={newCableInput}
                    onChange={(e) => setNewCableInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCable();
                      }
                    }}
                    className="flex-1 bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddCable}
                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl transition-all"
                  >
                    + Agregar
                  </button>
                </div>

                {/* Assigned Cables Badges */}
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-900 rounded-xl border border-slate-800 min-h-[48px]">
                  {formCables.length === 0 ? (
                    <span className="text-xs text-slate-500 p-1">No hay cables asignados a esta zona.</span>
                  ) : (
                    formCables.map((cb) => (
                      <span
                        key={cb}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold"
                      >
                        <span>{cb}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCable(cb)}
                          className="hover:text-rose-400 ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Available Cables Suggestions */}
                {availableCables.length > 0 && (
                  <div className="text-[11px] text-slate-400 pt-1">
                    <span className="font-bold text-slate-300">Cables detectados en Excel:</span>
                    <div className="flex flex-wrap gap-1 mt-1 max-h-24 overflow-y-auto">
                      {availableCables.map(c => {
                        const isAssigned = formCables.includes(c);
                        return (
                          <button
                            type="button"
                            key={c}
                            onClick={() => {
                              if (!isAssigned) setFormCables([...formCables, c]);
                            }}
                            disabled={isAssigned}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                              isAssigned ? 'bg-slate-800 text-slate-600 border-slate-800' : 'bg-slate-900 text-amber-400 border-slate-700 hover:border-amber-500'
                            }`}
                          >
                            + {c}
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
            {zones.map((zone) => (
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

                {/* Cables list */}
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Cables Pertencientes ({zone.cableNames.length}):</span>
                  <div className="flex flex-wrap gap-1">
                    {zone.cableNames.length === 0 ? (
                      <span className="text-[11px] text-slate-600 italic">Ningún cable asignado</span>
                    ) : (
                      zone.cableNames.map(c => (
                        <span key={c} className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60 text-[10px] font-mono">
                          {c}
                        </span>
                      ))
                    )}
                  </div>
                </div>

              </div>
            ))}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 rounded-b-3xl flex items-center justify-between text-xs text-slate-400">
          <span>Las zonas creadas se actualizan inmediatamente en la Tabla de Zonificación vs Grupos.</span>
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
