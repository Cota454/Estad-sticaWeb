import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  X,
  PlusCircle,
  Trash2,
  Edit3,
  Calendar,
  Globe,
  Radio,
  Building2,
  Hash,
  CheckCircle2,
  Search,
  Check,
  Power,
  Clock,
  FileText
} from 'lucide-react';
import { CableAfectacion, IpCableExcelParseResult } from '../types/ipCablesTypes';
import {
  loadCableAfectaciones,
  saveCableAfectaciones
} from '../utils/ipCablesStorage';

export interface CableAfectacionesModalProps {
  isOpen: boolean;
  onClose: () => void;
  afectaciones?: CableAfectacion[];
  onSaveAfectacion?: (afectacion: CableAfectacion) => void;
  onDeleteAfectacion?: (id: string) => void;
  excelData?: IpCableExcelParseResult | null;
  availableCables?: string[];
  availableCentrales?: string[];
  initialScope?: 'global' | 'cable' | 'central' | 'services';
  initialCable?: string;
  initialServiceNumbers?: string[];
}

const COMMON_AFECTACION_MOTIVOS = [
  'Huracán / Clima Severo',
  'Corte de Fibra Óptica',
  'Robo de Cable',
  'Vandalismo',
  'Filtración en Cámara',
  'Daño por Terceros (Excavación)',
  'Avería Mayor de Red',
  'Falla de Planta Externa'
];

export const CableAfectacionesModal: React.FC<CableAfectacionesModalProps> = ({
  isOpen,
  onClose,
  afectaciones: externalAfectaciones,
  onSaveAfectacion: externalOnSave,
  onDeleteAfectacion: externalOnDelete,
  excelData,
  availableCables: propAvailableCables,
  availableCentrales: propAvailableCentrales,
  initialScope = 'global',
  initialCable = '',
  initialServiceNumbers = []
}) => {
  // Local list state synchronized with storage or external props
  const [internalList, setInternalList] = useState<CableAfectacion[]>(loadCableAfectaciones);

  useEffect(() => {
    if (externalAfectaciones) {
      setInternalList(externalAfectaciones);
    } else {
      setInternalList(loadCableAfectaciones());
    }
  }, [externalAfectaciones, isOpen]);

  const currentAfectaciones = externalAfectaciones || internalList;

  // Resolve available cables and centrales
  const availableCables = useMemo(() => {
    if (propAvailableCables && propAvailableCables.length > 0) return propAvailableCables;
    if (excelData?.allUniqueCables && excelData.allUniqueCables.length > 0) return excelData.allUniqueCables;
    return [];
  }, [propAvailableCables, excelData]);

  const availableCentrales = useMemo(() => {
    if (propAvailableCentrales && propAvailableCentrales.length > 0) return propAvailableCentrales;
    if (excelData?.allUniqueCentrales && excelData.allUniqueCentrales.length > 0) return excelData.allUniqueCentrales;
    return [];
  }, [propAvailableCentrales, excelData]);

  const [activeTab, setActiveTab] = useState<'create' | 'list'>(
    initialServiceNumbers.length > 0 || initialCable ? 'create' : (currentAfectaciones.length > 0 ? 'list' : 'create')
  );

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<string>('');
  const [scope, setScope] = useState<'global' | 'cable' | 'central' | 'services'>(
    initialServiceNumbers.length > 0 ? 'services' : (initialCable ? 'cable' : initialScope)
  );
  const [cable, setCable] = useState<string>(initialCable || (availableCables[0] || ''));
  const [central, setCentral] = useState<string>(availableCentrales[0] || '');
  const [serviceNumbersText, setServiceNumbersText] = useState<string>(
    initialServiceNumbers.join('\n')
  );
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');
  const [descripcion, setDescripcion] = useState<string>('');
  const [activo, setActivo] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Search in list
  const [searchTerm, setSearchTerm] = useState<string>('');

  if (!isOpen) return null;

  const handleResetForm = () => {
    setEditingId(null);
    setMotivo('');
    setScope('global');
    setCable(availableCables[0] || '');
    setCentral(availableCentrales[0] || '');
    setServiceNumbersText('');
    setFechaInicio('');
    setFechaFin('');
    setDescripcion('');
    setActivo(true);
    setErrorMsg('');
  };

  const handleStartEdit = (af: CableAfectacion) => {
    setEditingId(af.id);
    setMotivo(af.motivo);
    setScope(af.scope);
    setCable(af.cable || availableCables[0] || '');
    setCentral(af.central || availableCentrales[0] || '');
    setServiceNumbersText((af.serviceNumbers || []).join('\n'));
    setFechaInicio(af.fechaInicio || '');
    setFechaFin(af.fechaFin || '');
    setDescripcion(af.descripcion || '');
    setActivo(af.activo !== false);
    setErrorMsg('');
    setActiveTab('create');
  };

  const handleSaveInternal = (af: CableAfectacion) => {
    if (externalOnSave) {
      externalOnSave(af);
    } else {
      const current = loadCableAfectaciones();
      const idx = current.findIndex(a => a.id === af.id);
      let updated: CableAfectacion[];
      if (idx >= 0) {
        updated = [...current];
        updated[idx] = af;
      } else {
        updated = [af, ...current];
      }
      saveCableAfectaciones(updated);
      setInternalList(updated);
    }
  };

  const handleDeleteInternal = (id: string) => {
    if (externalOnDelete) {
      externalOnDelete(id);
    } else {
      const current = loadCableAfectaciones();
      const updated = current.filter(a => a.id !== id);
      saveCableAfectaciones(updated);
      setInternalList(updated);
    }
  };

  const handleToggleActive = (af: CableAfectacion) => {
    const updated: CableAfectacion = {
      ...af,
      activo: af.activo === false ? true : false,
      updatedAt: new Date().toISOString()
    };
    handleSaveInternal(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanMotivo = motivo.trim();
    if (!cleanMotivo) {
      setErrorMsg('Debe ingresar o seleccionar un motivo de afectación.');
      return;
    }

    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      setErrorMsg('La Fecha Inicial no puede ser posterior a la Fecha Final.');
      return;
    }

    let parsedServices: string[] | undefined = undefined;
    if (scope === 'services') {
      const list = serviceNumbersText
        .split(/[\n,;\s]+/)
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);

      if (list.length === 0) {
        setErrorMsg('Debe ingresar al menos un número de servicio para el ámbito seleccionado.');
        return;
      }
      parsedServices = Array.from(new Set(list));
    }

    if (scope === 'cable' && !cable.trim()) {
      setErrorMsg('Debe seleccionar o ingresar el cable al que se aplicará la afectación.');
      return;
    }

    if (scope === 'central' && !central.trim()) {
      setErrorMsg('Debe seleccionar la central a la que se aplicará la afectación.');
      return;
    }

    const payload: CableAfectacion = {
      id: editingId || `afect-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      motivo: cleanMotivo,
      scope,
      cable: scope === 'cable' ? cable.trim().toUpperCase() : undefined,
      central: scope === 'central' ? central.trim().toUpperCase() : undefined,
      serviceNumbers: scope === 'services' ? parsedServices : undefined,
      fechaInicio: fechaInicio || undefined,
      fechaFin: fechaFin || undefined,
      descripcion: descripcion.trim() || undefined,
      activo,
      createdAt: editingId ? (currentAfectaciones.find(a => a.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    handleSaveInternal(payload);
    setSuccessMsg(editingId ? '¡Afectación actualizada con éxito!' : '¡Afectación registrada y aplicada con éxito!');
    setTimeout(() => setSuccessMsg(''), 3500);

    handleResetForm();
    setActiveTab('list');
  };

  const filteredAfectaciones = useMemo(() => {
    if (!searchTerm.trim()) return currentAfectaciones;
    const q = searchTerm.toLowerCase().trim();
    return currentAfectaciones.filter(a =>
      a.motivo.toLowerCase().includes(q) ||
      (a.cable && a.cable.toLowerCase().includes(q)) ||
      (a.central && a.central.toLowerCase().includes(q)) ||
      (a.descripcion && a.descripcion.toLowerCase().includes(q)) ||
      (a.serviceNumbers && a.serviceNumbers.some(s => s.toLowerCase().includes(q)))
    );
  }, [currentAfectaciones, searchTerm]);

  // Helper to determine status based on dates
  const getDateStatus = (af: CableAfectacion) => {
    if (af.activo === false) {
      return { label: 'Inactiva / Pausada', color: 'bg-slate-800 text-slate-400 border-slate-700' };
    }
    const today = new Date().toISOString().slice(0, 10);
    if (af.fechaInicio && af.fechaInicio > today) {
      return { label: 'Programada', color: 'bg-amber-950/80 text-amber-300 border-amber-500/50' };
    }
    if (af.fechaFin && af.fechaFin < today) {
      return { label: 'Concluida', color: 'bg-slate-800 text-slate-300 border-slate-600' };
    }
    return { label: 'Vigente', color: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50' };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl text-white shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-purple-500/20 text-purple-400 border border-purple-500/40 rounded-2xl shadow-inner">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider font-mono">
                  Módulo de Afectaciones
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {currentAfectaciones.filter(a => a.activo !== false).length} de {currentAfectaciones.length} activas
                </span>
              </div>
              <h3 className="text-lg font-black text-white tracking-tight mt-0.5">
                Crear, Actualizar y Eliminar Afectaciones
              </h3>
              <p className="text-xs text-slate-400">
                Seguimiento por período de fecha para etiquetar contingencias en servicios y cables de forma independiente.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="px-6 pt-3 bg-slate-950/50 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('create');
                if (!editingId) handleResetForm();
              }}
              className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center space-x-2 cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-slate-800 text-purple-300 border-purple-500 font-black'
                  : 'text-slate-400 hover:text-white border-transparent'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>{editingId ? 'Editar Afectación' : 'Nueva Afectación'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center space-x-2 cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-slate-800 text-purple-300 border-purple-500 font-black'
                  : 'text-slate-400 hover:text-white border-transparent'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Afectaciones Registradas ({currentAfectaciones.length})</span>
            </button>
          </div>

          {successMsg && (
            <div className="flex items-center space-x-1.5 text-xs text-emerald-400 bg-emerald-950/90 px-3 py-1 rounded-lg border border-emerald-500/50 animate-in fade-in shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'create' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMsg && (
                <div className="p-3.5 bg-rose-950/80 border border-rose-500/50 rounded-2xl flex items-center space-x-2.5 text-xs text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* 1. Motivo de Afectación */}
              <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-200 uppercase tracking-wider block">
                    1. Motivo de la Afectación <span className="text-rose-400">*</span>
                  </label>
                  {editingId && (
                    <span className="text-[11px] font-mono text-purple-400 bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded">
                      Modificando ID: {editingId}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ej. Huracán, Corte de FO, Robo de Cable, Vandalismo..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>

                {/* Quick Suggestions */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Sugerencias rápidas:</span>
                  {COMMON_AFECTACION_MOTIVOS.map(sug => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setMotivo(sug)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg font-medium border transition-colors cursor-pointer ${
                        motivo === sug
                          ? 'bg-purple-600 text-white border-purple-500 font-bold'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-purple-500/60 hover:text-white'
                      }`}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Seguimiento por Período de Fecha */}
              <div className="bg-slate-950/60 border border-purple-500/30 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    <label className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">
                      2. Período de Fecha de la Afectación
                    </label>
                  </div>
                  {(fechaInicio || fechaFin) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFechaInicio('');
                        setFechaFin('');
                      }}
                      className="text-[10px] text-purple-400 hover:text-purple-200 underline cursor-pointer"
                    >
                      Limpiar Fechas (Hacer Permanente)
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Solo se aplicará a los servicios cuya <strong>Fecha de Reporte</strong> caiga dentro de esta ventana de tiempo. Si deja ambas fechas vacías, aplicará de forma continua.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Fecha Inicial (Desde):
                    </label>
                    <input
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Fecha Final (Hasta):
                    </label>
                    <input
                      type="date"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Ámbito de Aplicación (Scope) */}
              <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-2xl space-y-3">
                <label className="text-xs font-extrabold text-slate-200 uppercase tracking-wider block">
                  3. Ámbito de Cobertura <span className="text-rose-400">*</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {/* Scope: Global */}
                  <label
                    onClick={() => setScope('global')}
                    className={`p-3 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                      scope === 'global'
                        ? 'bg-purple-950/40 border-purple-500 text-purple-200 shadow-md shadow-purple-950/50'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Globe className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold text-white">Todo en General</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-2 leading-tight">
                      Aplica a todos los servicios y cables dentro del período de fecha.
                    </span>
                  </label>

                  {/* Scope: Cable */}
                  <label
                    onClick={() => setScope('cable')}
                    className={`p-3 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                      scope === 'cable'
                        ? 'bg-purple-950/40 border-purple-500 text-purple-200 shadow-md shadow-purple-950/50'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Radio className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white">A Todo un Cable</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-2 leading-tight">
                      Aplica a todas las incidencias de un cable específico.
                    </span>
                  </label>

                  {/* Scope: Central */}
                  <label
                    onClick={() => setScope('central')}
                    className={`p-3 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                      scope === 'central'
                        ? 'bg-purple-950/40 border-purple-500 text-purple-200 shadow-md shadow-purple-950/50'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold text-white">A una Central</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-2 leading-tight">
                      Aplica a todas las líneas de una central telefónica seleccionada.
                    </span>
                  </label>

                  {/* Scope: Services */}
                  <label
                    onClick={() => setScope('services')}
                    className={`p-3 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                      scope === 'services'
                        ? 'bg-purple-950/40 border-purple-500 text-purple-200 shadow-md shadow-purple-950/50'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Hash className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-white">Servicios Puntuales</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-2 leading-tight">
                      Aplica a una lista de teléfonos/servicios ingresados.
                    </span>
                  </label>
                </div>

                {/* Sub-inputs according to Scope */}
                {scope === 'cable' && (
                  <div className="mt-3 p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5 animate-in fade-in">
                    <label className="text-xs font-bold text-slate-300">Seleccione o escriba el Cable:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        list="available-cables-list"
                        value={cable}
                        onChange={(e) => setCable(e.target.value)}
                        placeholder="Ej. CABLE-01 o CR-101"
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-emerald-400 uppercase focus:outline-none focus:border-purple-500"
                        required
                      />
                      <datalist id="available-cables-list">
                        {availableCables.map(c => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                )}

                {scope === 'central' && (
                  <div className="mt-3 p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5 animate-in fade-in">
                    <label className="text-xs font-bold text-slate-300">Seleccione la Central Telefónica:</label>
                    <select
                      value={central}
                      onChange={(e) => setCentral(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                      required
                    >
                      {availableCentrales.map(cnt => (
                        <option key={cnt} value={cnt}>{cnt}</option>
                      ))}
                    </select>
                  </div>
                )}

                {scope === 'services' && (
                  <div className="mt-3 p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300">
                        Pegue o escriba los números de servicio:
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {serviceNumbersText.split(/[\n,;\s]+/).filter(Boolean).length} números ingresados
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      value={serviceNumbersText}
                      onChange={(e) => setServiceNumbersText(e.target.value)}
                      placeholder="Pegue aquí desde Excel una columna de servicios o escríbalos separados por salto de línea..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                      required
                    />
                  </div>
                )}
              </div>

              {/* 4. Observaciones Técnicas y Estado Activo */}
              <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-2xl space-y-3">
                <div>
                  <label className="text-xs font-extrabold text-slate-200 uppercase tracking-wider block mb-1">
                    4. Observaciones o Notas Técnicas (Opcional)
                  </label>
                  <input
                    type="text"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Ej. Daño por obras viales, cuadrilla asignada para el fin de semana..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <div className="flex items-center space-x-2">
                    <Power className={`w-4 h-4 ${activo ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold text-slate-300">Estado de la Afectación:</span>
                  </div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activo}
                      onChange={(e) => setActivo(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 bg-slate-900 border-slate-700 focus:ring-purple-500"
                    />
                    <span className={`text-xs font-bold ${activo ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {activo ? 'Activa y Vigente' : 'Desactivada / Pausada'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Limpiar Formulario
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-purple-600/30 flex items-center space-x-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingId ? 'Actualizar Afectación' : 'Crear y Aplicar Afectación'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Tab 2: Lista de Afectaciones Registradas */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar afectación por motivo, cable, central o fecha..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    handleResetForm();
                    setActiveTab('create');
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition-colors flex items-center space-x-1.5 shrink-0 cursor-pointer shadow-md shadow-purple-600/20"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Crear Nueva Afectación</span>
                </button>
              </div>

              {filteredAfectaciones.length === 0 ? (
                <div className="py-12 text-center text-slate-500 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
                  <AlertTriangle className="w-8 h-8 mx-auto text-purple-400/50" />
                  <p className="text-sm font-bold text-slate-300">
                    {searchTerm ? 'No se encontraron afectaciones con esa búsqueda.' : 'No hay afectaciones registradas actualmente.'}
                  </p>
                  <p className="text-xs text-slate-400">
                    Puede crear una nueva afectación con su período de fechas haciendo clic en "Crear Nueva Afectación".
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredAfectaciones.map(af => {
                    const status = getDateStatus(af);
                    return (
                      <div
                        key={af.id}
                        className={`bg-slate-950 border p-4 rounded-2xl transition-all shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                          af.activo === false
                            ? 'border-slate-800/80 opacity-60'
                            : 'border-slate-800 hover:border-purple-500/50'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-500/20 text-purple-300 border border-purple-500/40">
                              <AlertTriangle className="w-3 h-3 mr-1 text-purple-400" />
                              {af.motivo}
                            </span>

                            {/* Badge de Estado / Vigencia de Fechas */}
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${status.color}`}>
                              {status.label}
                            </span>

                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                              af.scope === 'global'
                                ? 'bg-purple-900/60 text-purple-200 border border-purple-700/50'
                                : af.scope === 'cable'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40 font-mono'
                                : af.scope === 'central'
                                ? 'bg-blue-950 text-blue-300 border border-blue-800/40'
                                : 'bg-amber-950 text-amber-300 border border-amber-800/40 font-mono'
                            }`}>
                              {af.scope === 'global'
                                ? 'Global (Todo el Recuadro)'
                                : af.scope === 'cable'
                                ? `Cable: ${af.cable}`
                                : af.scope === 'central'
                                ? `Central: ${af.central}`
                                : `${af.serviceNumbers?.length || 0} Servicios`}
                            </span>

                            {(af.fechaInicio || af.fechaFin) ? (
                              <span className="text-[10px] text-slate-300 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800 flex items-center space-x-1">
                                <Clock className="w-3 h-3 text-purple-400 inline mr-1" />
                                <span>{af.fechaInicio || 'Inicio'} → {af.fechaFin || 'Sin fin'}</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800">
                                Permanente
                              </span>
                            )}
                          </div>

                          {af.descripcion && (
                            <p className="text-xs text-slate-300 italic flex items-center space-x-1">
                              <FileText className="w-3 h-3 text-slate-500 shrink-0 inline mr-1" />
                              <span>"{af.descripcion}"</span>
                            </p>
                          )}

                          {af.scope === 'services' && af.serviceNumbers && af.serviceNumbers.length > 0 && (
                            <div className="text-[11px] text-slate-400 font-mono truncate max-w-xl">
                              Servicios: {af.serviceNumbers.slice(0, 6).join(', ')}
                              {af.serviceNumbers.length > 6 ? ` y ${af.serviceNumbers.length - 6} más...` : ''}
                            </div>
                          )}
                        </div>

                        {/* Action buttons: Toggle, Edit, Delete */}
                        <div className="flex items-center space-x-1.5 shrink-0 self-end md:self-auto">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(af)}
                            className={`p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
                              af.activo !== false
                                ? 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border-emerald-500/40'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                            }`}
                            title={af.activo !== false ? 'Desactivar temporalmente' : 'Activar afectación'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStartEdit(af)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-700"
                            title="Actualizar / Editar Afectación"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`¿Está seguro de eliminar la afectación "${af.motivo}"? Dejará de aplicarse a los servicios y cables asociados.`)) {
                                handleDeleteInternal(af.id);
                              }
                            }}
                            className="p-2 bg-rose-950/50 hover:bg-rose-900/70 text-rose-300 hover:text-rose-100 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-rose-500/30"
                            title="Eliminar Afectación"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
