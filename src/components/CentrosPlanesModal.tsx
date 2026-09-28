import React, { useState, useEffect } from 'react';
import {
  CentroTelefonicoConfig,
  IndicadorPlanConfig,
  DEFAULT_PLANES_CALIDAD,
  DEFAULT_CENTROS_TELEFONICOS,
  DEFAULT_QUALITY_COLUMN_NAMES,
  DEFAULT_QUALITY_FORMULAS,
  QualityCustomization,
  QualityColumnNamesConfig,
  QualityFormulasConfig,
  PlanOperator
} from '../types/qualityIndicators';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  RotateCcw,
  Building2,
  Target,
  Sliders,
  AlertCircle,
  Calculator,
  Type
} from 'lucide-react';

interface CentrosPlanesModalProps {
  isOpen: boolean;
  onClose: () => void;
  centros: CentroTelefonicoConfig[];
  planes: Record<string, IndicadorPlanConfig>;
  customization?: QualityCustomization;
  initialTab?: 'centros' | 'planes' | 'formulas';
  onSaveCentros: (updated: CentroTelefonicoConfig[]) => void;
  onSavePlanes: (updated: Record<string, IndicadorPlanConfig>) => void;
  onSaveCustomization: (updated: QualityCustomization) => void;
}

export const CentrosPlanesModal: React.FC<CentrosPlanesModalProps> = ({
  isOpen,
  onClose,
  centros = [],
  planes = DEFAULT_PLANES_CALIDAD,
  customization,
  initialTab = 'centros',
  onSaveCentros,
  onSavePlanes,
  onSaveCustomization
}) => {
  const [modalTab, setModalTab] = useState<'centros' | 'planes' | 'formulas'>(initialTab);

  // Centros local state
  const [localCentros, setLocalCentros] = useState<CentroTelefonicoConfig[]>(() => centros || []);
  const [editingCentroId, setEditingCentroId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editLs, setEditLs] = useState<number>(10000);

  // New Centro input
  const [newName, setNewName] = useState('');
  const [newLs, setNewLs] = useState<number>(12000);

  // Planes local state
  const [localPlanes, setLocalPlanes] = useState<Record<string, IndicadorPlanConfig>>(() => planes || DEFAULT_PLANES_CALIDAD);

  // Formulas & Column names local state
  const [localCustomization, setLocalCustomization] = useState<QualityCustomization>(() => customization || {
    columnNames: DEFAULT_QUALITY_COLUMN_NAMES,
    formulas: DEFAULT_QUALITY_FORMULAS
  });

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setModalTab(initialTab);
      }
      setLocalCentros(centros || []);
      setLocalPlanes(planes || DEFAULT_PLANES_CALIDAD);
      if (customization) {
        setLocalCustomization(customization);
      }
    }
  }, [isOpen, initialTab, centros, planes, customization]);

  if (!isOpen) return null;

  // Handle add new centro
  const handleAddCentro = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newId = `cnt_${Date.now()}`;
    const updated = [
      ...localCentros,
      {
        id: newId,
        name: newName.trim(),
        ls: Math.max(1, Number(newLs) || 10000),
        active: true
      }
    ];
    setLocalCentros(updated);
    onSaveCentros(updated);
    setNewName('');
    setNewLs(12000);
  };

  // Start edit centro
  const handleStartEdit = (c: CentroTelefonicoConfig) => {
    setEditingCentroId(c.id);
    setEditName(c.name);
    setEditLs(c.ls);
  };

  // Save edit centro
  const handleSaveEdit = (id: string) => {
    if (!editName.trim()) return;
    const updated = (localCentros || []).map(c =>
      c.id === id
        ? { ...c, name: editName.trim(), ls: Math.max(1, Number(editLs) || 10000) }
        : c
    );
    setLocalCentros(updated);
    onSaveCentros(updated);
    setEditingCentroId(null);
  };

  // Delete centro
  const handleDeleteCentro = (id: string) => {
    if (!window.confirm('¿Seguro que desea eliminar este centro telefónico?')) return;
    const updated = localCentros.filter(c => c.id !== id);
    setLocalCentros(updated);
    onSaveCentros(updated);
  };

  // Reset centros to default
  const handleResetCentros = () => {
    if (window.confirm('¿Desea restablecer los centros telefónicos a los valores iniciales?')) {
      setLocalCentros(DEFAULT_CENTROS_TELEFONICOS);
      onSaveCentros(DEFAULT_CENTROS_TELEFONICOS);
    }
  };

  // Update Plan target & operator
  const handlePlanChange = (
    indicatorId: string,
    field: 'targetValue' | 'operator',
    value: any
  ) => {
    const updated = {
      ...localPlanes,
      [indicatorId]: {
        ...localPlanes[indicatorId],
        [field]: field === 'targetValue' ? Math.max(0, Number(value)) : value
      }
    };
    setLocalPlanes(updated);
    onSavePlanes(updated);
  };

  // Reset planes to default
  const handleResetPlanes = () => {
    if (window.confirm('¿Restablecer los valores de metas a los valores predeterminados?')) {
      setLocalPlanes(DEFAULT_PLANES_CALIDAD);
      onSavePlanes(DEFAULT_PLANES_CALIDAD);
    }
  };

  // Handle update column name
  const handleColumnNameChange = (key: keyof QualityColumnNamesConfig, val: string) => {
    const updated: QualityCustomization = {
      ...localCustomization,
      columnNames: {
        ...localCustomization.columnNames,
        [key]: val
      }
    };
    setLocalCustomization(updated);
    onSaveCustomization(updated);
  };

  // Handle update formula
  const handleFormulaChange = (key: keyof QualityFormulasConfig, val: string) => {
    const updated: QualityCustomization = {
      ...localCustomization,
      formulas: {
        ...localCustomization.formulas,
        [key]: val
      }
    };
    setLocalCustomization(updated);
    onSaveCustomization(updated);
  };

  // Reset customization
  const handleResetCustomization = () => {
    if (window.confirm('¿Restablecer los nombres de columnas y fórmulas a los valores predeterminados?')) {
      const reset: QualityCustomization = {
        columnNames: DEFAULT_QUALITY_COLUMN_NAMES,
        formulas: DEFAULT_QUALITY_FORMULAS
      };
      setLocalCustomization(reset);
      onSaveCustomization(reset);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white max-w-4xl w-full space-y-6 shadow-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-2xl">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white">
                Gestor de Centros Telefónicos y Planes de Calidad
              </h3>
              <p className="text-xs text-slate-400">
                Ajuste la técnica instalada (LS), agregue o elimine centros y defina los umbrales de cumplimiento.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setModalTab('centros')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              modalTab === 'centros'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-400/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>1. Centros Telefónicos y Técnica Instalada ({localCentros.length})</span>
          </button>

          <button
            onClick={() => setModalTab('planes')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              modalTab === 'planes'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>2. Metas y Condiciones del Plan</span>
          </button>

          <button
            onClick={() => setModalTab('formulas')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              modalTab === 'formulas'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 ring-2 ring-purple-400/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>3. Fórmulas y Nombres de Columnas</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-5">
          {modalTab === 'centros' && (
            <div className="space-y-5">
              {/* Form Add New Centro */}
              <form onSubmit={handleAddCentro} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <span className="text-xs font-extrabold text-blue-400 uppercase tracking-wider block">
                  + Agregar Nuevo Centro Telefónico
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-7">
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      Nombre del Centro Telefónico (tal como viene en el Excel)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Central Miramar o Central Boyeros"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-bold"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      LS (Técnica Instalada)
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={newLs}
                      onChange={(e) => setNewLs(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono font-bold"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-end">
                    <button
                      type="submit"
                      disabled={!newName.trim()}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center space-x-1 cursor-pointer shadow-md"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Centros List Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
                    Centros Registrados ({localCentros.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleResetCentros}
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restablecer Predefinidos</span>
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-xs text-left text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-bold">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Nombre del Centro Telefónico</th>
                        <th className="py-2.5 px-3 text-center">Técnica Instalada (LS)</th>
                        <th className="py-2.5 px-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-medium">
                      {(localCentros || []).map((c, idx) => {
                        const isEditing = editingCentroId === c.id;
                        return (
                          <tr key={c.id} className="hover:bg-slate-900/50 transition-colors">
                            <td className="py-2.5 px-3 text-slate-500 font-mono">{idx + 1}</td>
                            <td className="py-2.5 px-3">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full bg-slate-900 border border-blue-500 rounded-lg px-2 py-1 text-xs text-white font-bold"
                                />
                              ) : (
                                <span className="font-extrabold text-white">{c.name}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {isEditing ? (
                                <input
                                  type="number"
                                  min="1"
                                  value={editLs}
                                  onChange={(e) => setEditLs(Number(e.target.value))}
                                  className="w-28 bg-slate-900 border border-blue-500 rounded-lg px-2 py-1 text-xs text-center text-white font-mono font-bold"
                                />
                              ) : (
                                <span className="font-mono font-bold text-emerald-400">
                                  {c.ls.toLocaleString()}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right space-x-1">
                              {isEditing ? (
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(c.id)}
                                  className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer"
                                  title="Guardar cambios"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(c)}
                                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                                  title="Editar centro"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteCentro(c.id)}
                                className="p-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg transition-colors cursor-pointer"
                                title="Eliminar centro"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {modalTab === 'planes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-extrabold text-white">
                    Configuración de Metas del Plan y Operadores de Calidad
                  </h4>
                  <p className="text-xs text-slate-400">
                    Defina si el plan se considera cumplido cuando es <strong>menor o igual (≤)</strong> o <strong>mayor o igual (≥)</strong> a la meta establecida.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetPlanes}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restablecer Metas</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(Object.values(localPlanes || {}) as IndicadorPlanConfig[]).map(p => (
                  <div
                    key={p.id}
                    className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-black text-sm text-white block">{p.name}</span>
                        <p className="text-[11px] text-slate-400 mt-0.5">{p.description}</p>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700">
                        {p.unit}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800/80">
                      <div>
                        <label className="text-[11px] font-bold text-slate-400 block mb-1">
                          Condición de Cumplimiento
                        </label>
                        <select
                          value={p.operator}
                          onChange={(e) => handlePlanChange(p.id, 'operator', e.target.value as PlanOperator)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                        >
                          <option value="<=">Menor o Igual (≤) - Menos es Mejor</option>
                          <option value=">=">Mayor o Igual (≥) - Más es Mejor</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-400 block mb-1">
                          Valor Meta ({p.unit})
                        </label>
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={p.targetValue}
                            onChange={(e) => handlePlanChange(p.id, 'targetValue', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                          />
                          <span className="font-bold text-slate-400 text-xs">{p.unit}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] text-emerald-400 bg-emerald-950/30 border border-emerald-500/20 px-2.5 py-1 rounded-xl">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Se considera <strong>CUMPLIDO</strong> si el valor real es {p.operator} {p.targetValue} {p.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {modalTab === 'formulas' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <h4 className="text-sm font-extrabold text-white flex items-center space-x-2">
                    <Calculator className="w-4 h-4 text-purple-400" />
                    <span>Configuración de Fórmulas y Nombres de Columnas</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Personalice los títulos visibles de las columnas y las expresiones matemáticas de cálculo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetCustomization}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restablecer Fórmulas y Nombres</span>
                </button>
              </div>

              {/* Sub-section 1: Nombres de Columnas */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4">
                <div className="flex items-center space-x-2 text-blue-400">
                  <Type className="w-4 h-4" />
                  <h5 className="text-xs font-black uppercase tracking-wider">
                    1. Nombres Personalizados de las Columnas de la Tabla
                  </h5>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Columna Centro</label>
                    <input
                      type="text"
                      value={localCustomization.columnNames.centroName}
                      onChange={(e) => handleColumnNameChange('centroName', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Columna Técnica (LS)</label>
                    <input
                      type="text"
                      value={localCustomization.columnNames.ls}
                      onChange={(e) => handleColumnNameChange('ls', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Columna 1. Reporte Inicial</label>
                    <input
                      type="text"
                      value={localCustomization.columnNames.reporteInicial}
                      onChange={(e) => handleColumnNameChange('reporteInicial', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Columna 2. % Rep -3 Días</label>
                    <input
                      type="text"
                      value={localCustomization.columnNames.pctRep3dias}
                      onChange={(e) => handleColumnNameChange('pctRep3dias', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Columna 3. % Rep -1 Día</label>
                    <input
                      type="text"
                      value={localCustomization.columnNames.pctRep1dia}
                      onChange={(e) => handleColumnNameChange('pctRep1dia', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Columna 4. Demora Promedio</label>
                    <input
                      type="text"
                      value={localCustomization.columnNames.demoraPromedio}
                      onChange={(e) => handleColumnNameChange('demoraPromedio', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Columna RER</label>
                    <input
                      type="text"
                      value={localCustomization.columnNames.rer}
                      onChange={(e) => handleColumnNameChange('rer', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Columna IP Inicial</label>
                    <input
                      type="text"
                      value={localCustomization.columnNames.ipInicial}
                      onChange={(e) => handleColumnNameChange('ipInicial', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Columna IP Final</label>
                    <input
                      type="text"
                      value={localCustomization.columnNames.ipFinal}
                      onChange={(e) => handleColumnNameChange('ipFinal', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Columna Reparaciones</label>
                    <input
                      type="text"
                      value={localCustomization.columnNames.totalReparaciones}
                      onChange={(e) => handleColumnNameChange('totalReparaciones', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Columna Rep ≤3d</label>
                    <input
                      type="text"
                      value={localCustomization.columnNames.rep3dias}
                      onChange={(e) => handleColumnNameChange('rep3dias', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Columna DTR (hrs)</label>
                    <input
                      type="text"
                      value={localCustomization.columnNames.dtr}
                      onChange={(e) => handleColumnNameChange('dtr', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Sub-section 2: Fórmulas Matemáticas */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 text-purple-400">
                    <Calculator className="w-4 h-4" />
                    <h5 className="text-xs font-black uppercase tracking-wider">
                      2. Fórmulas de Cálculo Matemático
                    </h5>
                  </div>
                </div>

                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-[11px] text-slate-300 space-y-1.5">
                  <span className="font-bold text-white block">Variables disponibles para usar en las fórmulas:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'rer',
                      'ls',
                      'reparaciones',
                      'ipInicial',
                      'ipFinal',
                      'rep3dias',
                      'ip3diasInicial',
                      'ip3diasFinal',
                      'rep1dia',
                      'ip1diaInicial',
                      'ip1diaFinal',
                      'dtr'
                    ].map(v => (
                      <span key={v} className="px-2 py-0.5 bg-slate-800 text-purple-300 font-mono text-[10px] rounded border border-purple-500/30">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Formula 1: RER */}
                  <div className="space-y-1.5 bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">RER (Reparaciones Equivalentes)</span>
                      <span className="text-[10px] text-slate-400 font-mono">Por defecto: reparaciones - ipInicial + ipFinal</span>
                    </div>
                    <input
                      type="text"
                      value={localCustomization.formulas.rer}
                      onChange={(e) => handleFormulaChange('rer', e.target.value)}
                      placeholder="reparaciones - ipInicial + ipFinal"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-purple-300 font-mono focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  {/* Formula 2: Reporte Inicial */}
                  <div className="space-y-1.5 bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">1. Reporte Inicial (%)</span>
                      <span className="text-[10px] text-slate-400 font-mono">Por defecto: (rer / ls) * 100</span>
                    </div>
                    <input
                      type="text"
                      value={localCustomization.formulas.reporteInicial}
                      onChange={(e) => handleFormulaChange('reporteInicial', e.target.value)}
                      placeholder="(rer / ls) * 100"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-purple-300 font-mono focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  {/* Formula 3: % Reparadas -3 Días */}
                  <div className="space-y-1.5 bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">2. % Reparadas -3 Días (%)</span>
                      <span className="text-[10px] text-slate-400 font-mono">Por defecto: (rep3dias / (rer + ip3diasInicial - ip3diasFinal)) * 100</span>
                    </div>
                    <input
                      type="text"
                      value={localCustomization.formulas.pctRep3dias}
                      onChange={(e) => handleFormulaChange('pctRep3dias', e.target.value)}
                      placeholder="(rep3dias / (rer + ip3diasInicial - ip3diasFinal)) * 100"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-purple-300 font-mono focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  {/* Formula 4: % Reparadas -1 Día */}
                  <div className="space-y-1.5 bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">3. % Reparadas -1 Día (%)</span>
                      <span className="text-[10px] text-slate-400 font-mono">Por defecto: (rep1dia / (rer + ip1diaInicial - ip1diaFinal)) * 100</span>
                    </div>
                    <input
                      type="text"
                      value={localCustomization.formulas.pctRep1dia}
                      onChange={(e) => handleFormulaChange('pctRep1dia', e.target.value)}
                      placeholder="(rep1dia / (rer + ip1diaInicial - ip1diaFinal)) * 100"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-purple-300 font-mono focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  {/* Formula 5: Demora Promedio */}
                  <div className="space-y-1.5 bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">4. Demora Promedio (hrs)</span>
                      <span className="text-[10px] text-slate-400 font-mono">Por defecto: dtr / reparaciones</span>
                    </div>
                    <input
                      type="text"
                      value={localCustomization.formulas.demoraPromedio}
                      onChange={(e) => handleFormulaChange('demoraPromedio', e.target.value)}
                      placeholder="dtr / reparaciones"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-purple-300 font-mono focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <span className="text-xs text-slate-500">
            * Los cambios se guardan automáticamente y se aplican a los cálculos diarios y mensuales.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-blue-600/20"
          >
            Cerrar y Aplicar
          </button>
        </div>

      </div>
    </div>
  );
};
