import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Key,
  Check,
  X,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Lock,
  UserCheck,
  Building2,
  AlertCircle
} from 'lucide-react';
import { PortalUser, PortalModuleId } from '../types';
import {
  getPortalUsers,
  createPortalUser,
  updatePortalUser,
  deletePortalUser
} from '../utils/authService';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUsername: string;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  currentUsername
}) => {
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Form State
  const [formUsername, setFormUsername] = useState<string>('');
  const [formPassword, setFormPassword] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formRole, setFormRole] = useState<'admin' | 'operator'>('operator');
  const [formPermissions, setFormPermissions] = useState<PortalModuleId[]>([
    'report_analysis',
    'ip_analysis',
    'repairs_analysis'
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadUsersList();
      resetForm();
    }
  }, [isOpen]);

  const loadUsersList = () => {
    setUsers(getPortalUsers());
  };

  const resetForm = () => {
    setFormUsername('');
    setFormPassword('');
    setFormName('');
    setFormRole('operator');
    setFormPermissions(['report_analysis', 'ip_analysis', 'repairs_analysis']);
    setFormError(null);
    setIsCreating(false);
    setEditingUserId(null);
  };

  const togglePermission = (moduleId: PortalModuleId) => {
    setFormPermissions(prev =>
      prev.includes(moduleId)
        ? prev.filter(p => p !== moduleId)
        : [...prev, moduleId]
    );
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formUsername.trim()) {
      setFormError('El nombre de usuario es obligatorio');
      return;
    }
    if (!formName.trim()) {
      setFormError('El nombre completo es obligatorio');
      return;
    }

    if (!editingUserId && !formPassword.trim()) {
      setFormError('Debe ingresar una contraseña para el nuevo usuario');
      return;
    }

    // Check duplicate username if creating
    if (!editingUserId) {
      const exists = users.some(
        u => u.username.toLowerCase() === formUsername.trim().toLowerCase()
      );
      if (exists) {
        setFormError('Ya existe un usuario registrado con este nombre de usuario');
        return;
      }

      createPortalUser({
        username: formUsername.trim(),
        password: formPassword.trim(),
        name: formName.trim(),
        role: formRole,
        permissions: formPermissions,
        active: true
      });
      setSuccessMessage(`Usuario "${formUsername}" creado exitosamente.`);
    } else {
      // Updating user
      const updates: Partial<PortalUser> = {
        name: formName.trim(),
        role: formRole,
        permissions: formPermissions
      };
      if (formPassword.trim()) {
        updates.password = formPassword.trim();
      }
      updatePortalUser(editingUserId, updates);
      setSuccessMessage(`Usuario "${formUsername}" actualizado exitosamente.`);
    }

    loadUsersList();
    resetForm();
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleEditClick = (user: PortalUser) => {
    setEditingUserId(user.id);
    setFormUsername(user.username);
    setFormPassword('');
    setFormName(user.name);
    setFormRole(user.role);
    setFormPermissions(user.permissions || ['report_analysis']);
    setIsCreating(true);
  };

  const handleToggleActive = (user: PortalUser) => {
    if (user.username.toLowerCase() === 'admin') {
      alert('No se puede desactivar la cuenta principal de Administrador');
      return;
    }
    updatePortalUser(user.id, { active: !user.active });
    loadUsersList();
  };

  const handleDelete = (user: PortalUser) => {
    if (user.username.toLowerCase() === 'admin') {
      alert('No se puede eliminar la cuenta principal de Administrador');
      return;
    }
    if (confirm(`¿Está seguro de eliminar al usuario "${user.username}"?`)) {
      deletePortalUser(user.id);
      loadUsersList();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full p-6 text-slate-900 space-y-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Gestión de Usuarios del Portal NOC</h2>
              <p className="text-xs text-slate-500">
                Administración de accesos, roles y permisos de la plataforma
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Action Controls */}
        {!isCreating ? (
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">
              Usuarios Registrados ({users.length})
            </span>

            <button
              onClick={() => {
                resetForm();
                setIsCreating(true);
              }}
              className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>Crear Nuevo Usuario</span>
            </button>
          </div>
        ) : (
          /* User Creation / Edit Form */
          <form onSubmit={handleSaveUser} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-xs font-extrabold text-slate-900 uppercase">
                {editingUserId ? `Editar Usuario: ${formUsername}` : 'Crear Nuevo Usuario del Portal'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold"
              >
                Cancelar
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Nombre de Usuario (Login)
                </label>
                <input
                  type="text"
                  disabled={!!editingUserId}
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="ej. Operador1"
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="ej. Téc. Juan Pérez"
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Contraseña {editingUserId && '(Dejar en blanco para mantener la actual)'}
                </label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={editingUserId ? 'Nueva contraseña (Opcional)' : 'Contraseña segura'}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Rol en el Sistema
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as 'admin' | 'operator')}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  <option value="operator">Operador / Usuario Técnico</option>
                  <option value="admin">Administrador General</option>
                </select>
              </div>
            </div>

            {/* Modules Permissions */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-2">
                Permisos de Acceso a Módulos:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'report_analysis', label: '1. Análisis de Reporte' },
                  { id: 'ip_analysis', label: '2. Análisis de IP' },
                  { id: 'repairs_analysis', label: '3. Análisis Reparaciones' }
                ].map((mod) => {
                  const isChecked = formPermissions.includes(mod.id as PortalModuleId);
                  return (
                    <button
                      type="button"
                      key={mod.id}
                      onClick={() => togglePermission(mod.id as PortalModuleId)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                        isChecked
                          ? 'bg-blue-50 border-blue-300 text-blue-900'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      <span>{mod.label}</span>
                      {isChecked ? <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" /> : <div className="w-4 h-4 rounded-full border border-slate-300" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-colors shadow-sm"
              >
                {editingUserId ? 'Guardar Cambios' : 'Crear Usuario'}
              </button>
            </div>
          </form>
        )}

        {/* Users Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-900 text-white font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3 pl-5">Usuario</th>
                <th className="p-3">Nombre Completo</th>
                <th className="p-3">Rol</th>
                <th className="p-3 text-center">Estado</th>
                <th className="p-3 text-right pr-5">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isAdmin = u.username.toLowerCase() === 'admin';
                return (
                  <tr key={u.id} className="hover:bg-slate-50 font-medium">
                    <td className="p-3 pl-5 font-mono font-bold text-slate-900 flex items-center space-x-2">
                      <Shield className={`w-4 h-4 ${isAdmin ? 'text-amber-500' : 'text-blue-500'}`} />
                      <span>{u.username}</span>
                    </td>
                    <td className="p-3 text-slate-800 font-bold">{u.name}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${u.role === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                        {u.role === 'admin' ? 'Administrador' : 'Operador'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleToggleActive(u)}
                        disabled={isAdmin}
                        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          u.active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {u.active ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-600" />}
                        <span>{u.active ? 'Activo' : 'Inactivo'}</span>
                      </button>
                    </td>
                    <td className="p-3 text-right pr-5 space-x-1">
                      <button
                        onClick={() => handleEditClick(u)}
                        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Editar usuario"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={isAdmin}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30"
                        title={isAdmin ? 'No se puede eliminar el administrador principal' : 'Eliminar usuario'}
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
  );
};
