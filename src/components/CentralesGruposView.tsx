import React, { useState } from 'react';
import { Building2, Plus, Edit, Trash2, CheckCircle2, AlertCircle, X, Save, Layers, MapPin } from 'lucide-react';
import { Central, WorkGroup } from '../types';
import { getCentralTotalCapacity } from '../utils/statCalculations';

interface CentralesGruposViewProps {
  centrales: Central[];
  workGroups: WorkGroup[];
  onUpdateCentrales: (updated: Central[]) => void;
  onUpdateWorkGroups: (updated: WorkGroup[]) => void;
}

export const CentralesGruposView: React.FC<CentralesGruposViewProps> = ({
  centrales,
  workGroups,
  onUpdateCentrales,
  onUpdateWorkGroups
}) => {
  const [activeTab, setActiveTab] = useState<'centrales' | 'grupos'>('centrales');

  // Central Modal State
  const [isCentralModalOpen, setIsCentralModalOpen] = useState(false);
  const [editingCentralId, setEditingCentralId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');

  // Group Modal State
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupCode, setGroupCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupColor, setGroupColor] = useState('#3b82f6');

  // Central CRUD Handlers
  const handleOpenCentralModal = (central?: Central) => {
    if (central) {
      setEditingCentralId(central.id);
      setCode(central.code);
      setName(central.name);
      setLocation(central.location);
    } else {
      setEditingCentralId(null);
      setCode(`C-TEL-0${centrales.length + 1}`);
      setName('');
      setLocation('');
    }
    setIsCentralModalOpen(true);
  };

  const handleSaveCentral = () => {
    if (!name.trim()) {
      alert('Por favor ingrese el nombre de la central telefónica.');
      return;
    }

    if (editingCentralId) {
      // Edit
      const updated = centrales.map(c => {
        if (c.id === editingCentralId) {
          return { ...c, code, name, location };
        }
        return c;
      });
      onUpdateCentrales(updated);
    } else {
      // Create
      const newCentral: Central = {
        id: `cnt_${Date.now()}`,
        code: code || `C-TEL-${Date.now()}`,
        name,
        location: location || 'Ubicación General',
        active: true,
        installedTech: {
          total: 10000
        }
      };
      onUpdateCentrales([...centrales, newCentral]);
    }

    setIsCentralModalOpen(false);
  };

  const handleDeleteCentral = (id: string, centralName: string) => {
    if (confirm(`¿Está seguro de eliminar la central telefónica "${centralName}"? Esta acción no se puede deshacer.`)) {
      const updated = centrales.filter(c => c.id !== id);
      onUpdateCentrales(updated);
    }
  };

  // Work Group CRUD Handlers
  const handleOpenGroupModal = (grp?: WorkGroup) => {
    if (grp) {
      setEditingGroupId(grp.id);
      setGroupCode(grp.code);
      setGroupName(grp.name);
      setGroupDesc(grp.description);
      setGroupColor(grp.color);
    } else {
      setEditingGroupId(null);
      setGroupCode(`GRP-${workGroups.length + 1}`);
      setGroupName('');
      setGroupDesc('');
      setGroupColor('#3b82f6');
    }
    setIsGroupModalOpen(true);
  };

  const handleSaveGroup = () => {
    if (!groupName.trim()) {
      alert('Por favor ingrese el nombre del grupo de trabajo.');
      return;
    }

    if (editingGroupId) {
      const updated = workGroups.map(g => {
        if (g.id === editingGroupId) {
          return { ...g, code: groupCode, name: groupName, description: groupDesc, color: groupColor };
        }
        return g;
      });
      onUpdateWorkGroups(updated);
    } else {
      const newGroup: WorkGroup = {
        id: `grp_${Date.now()}`,
        code: groupCode || `GRP-${Date.now()}`,
        name: groupName,
        description: groupDesc,
        color: groupColor
      };
      onUpdateWorkGroups([...workGroups, newGroup]);
    }

    setIsGroupModalOpen(false);
  };

  const handleDeleteGroup = (id: string, gName: string) => {
    if (confirm(`¿Está seguro de eliminar el grupo de trabajo "${gName}"?`)) {
      const updated = workGroups.filter(g => g.id !== id);
      onUpdateWorkGroups(updated);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Tab Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Gestión de Centrales Telefónicas y Grupos de Trabajo</h2>
            <p className="text-xs text-slate-500">Configure la infraestructura técnica de la red operativa</p>
          </div>

          <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('centrales')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'centrales' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Centrales ({centrales.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('grupos')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'grupos' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Grupos de Trabajo ({workGroups.length})</span>
            </button>
          </div>
        </div>

        {/* Centrales View */}
        {activeTab === 'centrales' && (
          <div className="mt-5 space-y-4">
            
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase">Listado de Centrales Telefónicas Activas</span>
              <button
                onClick={() => handleOpenCentralModal()}
                className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all shadow-md shadow-blue-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Central Telefónica</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {centrales.map(central => {
                const totalCap = getCentralTotalCapacity(central);

                return (
                  <div key={central.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col justify-between space-y-3 hover:border-slate-300 transition-all">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                          {central.code}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Activa</span>
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 mt-2">{central.name}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{central.location}</span>
                      </p>

                      <div className="mt-3 pt-3 border-t border-slate-200/60 text-xs text-slate-600 flex justify-between">
                        <span>Técnica Instalada Total:</span>
                        <span className="font-extrabold text-slate-900">{totalCap.toLocaleString()} unidades</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200/60">
                      <button
                        onClick={() => handleOpenCentralModal(central)}
                        className="inline-flex items-center space-x-1 text-xs bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 font-medium"
                      >
                        <Edit className="w-3.5 h-3.5 text-blue-600" />
                        <span>Editar</span>
                      </button>

                      <button
                        onClick={() => handleDeleteCentral(central.id, central.name)}
                        className="inline-flex items-center space-x-1 text-xs bg-white hover:bg-rose-50 text-rose-600 px-2.5 py-1.5 rounded-lg border border-rose-200 font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar</span>
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* Work Groups View */}
        {activeTab === 'grupos' && (
          <div className="mt-5 space-y-4">
            
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase">Grupos de Trabajo Técnico</span>
              <button
                onClick={() => handleOpenGroupModal()}
                className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all shadow-md shadow-blue-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Grupo de Trabajo</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workGroups.map(grp => (
                <div key={grp.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: grp.color }}>
                        {grp.code}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 mt-2">{grp.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{grp.description}</p>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200/60">
                    <button
                      onClick={() => handleOpenGroupModal(grp)}
                      className="inline-flex items-center space-x-1 text-xs bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 font-medium"
                    >
                      <Edit className="w-3.5 h-3.5 text-blue-600" />
                      <span>Editar</span>
                    </button>

                    <button
                      onClick={() => handleDeleteGroup(grp.id, grp.name)}
                      className="inline-flex items-center space-x-1 text-xs bg-white hover:bg-rose-50 text-rose-600 px-2.5 py-1.5 rounded-lg border border-rose-200 font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

      </div>

      {/* Central Create/Edit Modal */}
      {isCentralModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingCentralId ? 'Editar Central Telefónica' : 'Nueva Central Telefónica'}
              </h3>
              <button onClick={() => setIsCentralModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Código de la Central:</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ej: C-NOR-02"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nombre de la Central Telefónica:</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Central Norte (Tele)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ubicación / Dirección:</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ej: Calle Industrial 45, Sector Norte"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsCentralModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCentral}
                className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-xl"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Central</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Group Create/Edit Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingGroupId ? 'Editar Grupo de Trabajo' : 'Nuevo Grupo de Trabajo'}
              </h3>
              <button onClick={() => setIsGroupModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Código del Grupo:</label>
                <input
                  type="text"
                  value={groupCode}
                  onChange={(e) => setGroupCode(e.target.value)}
                  placeholder="Ej: ING"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nombre del Grupo:</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Ej: Planta Exterior"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descripción de Funciones:</label>
                <textarea
                  rows={2}
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="Ej: Mantenimiento de red de cobre y fibra óptica"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Color Distintivo:</label>
                <input
                  type="color"
                  value={groupColor}
                  onChange={(e) => setGroupColor(e.target.value)}
                  className="h-9 w-full bg-slate-50 border border-slate-300 rounded-lg p-1 cursor-pointer"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsGroupModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveGroup}
                className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-xl"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Grupo</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
