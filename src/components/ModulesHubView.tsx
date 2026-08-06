import React, { useState } from 'react';
import {
  BarChart3,
  Network,
  Wrench,
  Users,
  LogOut,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  HardDrive,
  Activity,
  CheckCircle2,
  Clock,
  Radio,
  Building2,
  Sliders,
  Sun,
  Moon
} from 'lucide-react';
import { PortalUser, PortalModuleId } from '../types';
import { UserManagementModal } from './UserManagementModal';

interface ModulesHubViewProps {
  portalUser: PortalUser;
  onSelectModule: (moduleId: PortalModuleId) => void;
  onLogout: () => void;
  syncStatus?: 'synced' | 'syncing' | 'idle';
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

export const ModulesHubView: React.FC<ModulesHubViewProps> = ({
  portalUser,
  onSelectModule,
  onLogout,
  syncStatus = 'synced',
  isDarkMode = true,
  onToggleTheme
}) => {
  const [isUserMgmtOpen, setIsUserMgmtOpen] = useState<boolean>(false);

  const isAdmin = portalUser.role === 'admin' || portalUser.username.toLowerCase() === 'admin';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* User Portal Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Brand Logo & Portal Name */}
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg shadow-blue-500/20 text-white">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black uppercase tracking-widest text-blue-400 font-mono">
                  Portal NOC
                </span>
                <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-md font-bold border border-slate-700">
                  v2.5 Enterprise
                </span>
              </div>
              <h1 className="text-lg font-black text-white tracking-tight">
                Consola Central de Procesamiento de Datos
              </h1>
            </div>
          </div>

          {/* User Info & Actions Bar */}
          <div className="flex items-center space-x-3">
            
            {/* Theme Toggle Button */}
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs px-3 py-2 rounded-xl border border-slate-700 transition-all shadow-sm"
                title={isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
              >
                {isDarkMode ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span className="hidden sm:inline">Modo Claro</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-indigo-400" />
                    <span className="hidden sm:inline">Modo Oscuro</span>
                  </>
                )}
              </button>
            )}

            {/* Google Drive Status Badge */}
            <div className="hidden lg:flex items-center space-x-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
              <HardDrive className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'text-amber-400 animate-spin' : 'text-emerald-400'}`} />
              <span className="text-slate-300 font-medium text-[11px]">Drive NOC:</span>
              <span className="text-emerald-400 font-bold font-mono text-[11px]">2pacgobernador@gmail.com</span>
            </div>

            {/* Admin User Management Button */}
            {isAdmin && (
              <button
                onClick={() => setIsUserMgmtOpen(true)}
                className="flex items-center space-x-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-bold text-xs px-3 py-2 rounded-xl transition-all"
              >
                <Users className="w-4 h-4 text-blue-400" />
                <span>Gestión Usuarios</span>
              </button>
            )}

            {/* Profile Pill */}
            <div className="flex items-center space-x-2 bg-slate-800 p-1.5 pl-3 rounded-xl border border-slate-700">
              <ShieldCheck className={`w-4 h-4 ${isAdmin ? 'text-amber-400' : 'text-blue-400'}`} />
              <div className="text-left">
                <div className="text-xs font-black text-white leading-none">{portalUser.name}</div>
                <div className="text-[10px] text-slate-400 font-medium">
                  {isAdmin ? 'Administrador' : 'Operador NOC'}
                </div>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-rose-400 rounded-lg transition-colors ml-1"
                title="Cerrar Sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>
      </header>

      {/* Main Hub Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Welcome Hero Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 space-y-3 max-w-3xl">
            <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full text-blue-400 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Bienvenido al Portal Multifuncional NOC</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Seleccione el Módulo de Trabajo
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Cada recuadro representa una función operativa especializada. Presione cualquiera de las tarjetas para desplegar las estadísticas, herramientas y datos correspondientes.
            </p>
          </div>
        </div>

        {/* The 3 Interactive Cards ("Cuadrados") */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* CARD 1: Análisis de Reporte */}
          <div
            onClick={() => onSelectModule('report_analysis')}
            className="group cursor-pointer bg-slate-900 border-2 border-emerald-500/40 hover:border-emerald-400 rounded-3xl p-6 transition-all duration-300 hover:scale-[1.02] shadow-xl hover:shadow-emerald-500/10 flex flex-col justify-between space-y-6 relative overflow-hidden"
          >
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />

            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 group-hover:scale-110 transition-transform">
                  <BarChart3 className="w-7 h-7" />
                </div>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase px-2.5 py-1 rounded-full tracking-wider font-mono">
                  MÓDULO PRINCIPAL
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black text-white group-hover:text-emerald-300 transition-colors">
                  1. Análisis de Reporte
                </h3>
                <p className="text-slate-300 text-xs mt-2 leading-relaxed">
                  Consola estadística NOC completa: registro diario de folios, matriz de diferencias entre fechas, técnica instalada por grupo de trabajo y copias de seguridad en Google Drive.
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>12 Centrales CTA Registradas</span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Registro Diario y Matriz de Diferencias</span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sincronización Automática con Google Drive</span>
                </div>
              </div>
            </div>

            <button className="w-full py-3 px-4 bg-emerald-600 group-hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20">
              <span>Ingresar a Análisis de Reporte</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* CARD 2: Análisis de IP */}
          <div
            onClick={() => onSelectModule('ip_analysis')}
            className="group cursor-pointer bg-slate-900 border border-slate-800 hover:border-blue-500/60 rounded-3xl p-6 transition-all duration-300 hover:scale-[1.02] shadow-xl hover:shadow-blue-500/10 flex flex-col justify-between space-y-6 relative overflow-hidden"
          >
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />

            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-blue-400 group-hover:scale-110 transition-transform">
                  <Network className="w-7 h-7" />
                </div>
                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-black uppercase px-2.5 py-1 rounded-full tracking-wider font-mono">
                  PRÓXIMAMENTE v2.6
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black text-white group-hover:text-blue-300 transition-colors">
                  2. Análisis de IP
                </h3>
                <p className="text-slate-300 text-xs mt-2 leading-relaxed">
                  Supervisión de subredes, estado de direccionamiento IPv4/IPv6, pruebas de latencia ping ICMP en vivo y mapa de routers/switches distribuidos.
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 font-medium">
                  <Radio className="w-3.5 h-3.5 text-blue-400" />
                  <span>24 Subredes Monitoreadas</span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 font-medium">
                  <Radio className="w-3.5 h-3.5 text-blue-400" />
                  <span>Pruebas Ping y Diagnóstico de Latencia</span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 font-medium">
                  <Radio className="w-3.5 h-3.5 text-blue-400" />
                  <span>Topología de Enlaces Troncales NOC</span>
                </div>
              </div>
            </div>

            <button className="w-full py-3 px-4 bg-slate-800 group-hover:bg-blue-600 text-slate-200 group-hover:text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center space-x-2 border border-slate-700 group-hover:border-blue-500">
              <span>Explorar Vista Previa</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* CARD 3: Análisis Reparaciones */}
          <div
            onClick={() => onSelectModule('repairs_analysis')}
            className="group cursor-pointer bg-slate-900 border-2 border-indigo-500/40 hover:border-indigo-400 rounded-3xl p-6 transition-all duration-300 hover:scale-[1.02] shadow-xl hover:shadow-indigo-500/20 flex flex-col justify-between space-y-6 relative overflow-hidden"
          >
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all" />

            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-indigo-400 group-hover:scale-110 transition-transform">
                  <Wrench className="w-7 h-7" />
                </div>
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-black uppercase px-2.5 py-1 rounded-full tracking-wider font-mono">
                  MÓDULO REPARADAS
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black text-white group-hover:text-indigo-300 transition-colors">
                  3. Análisis de Reparadas
                </h3>
                <p className="text-slate-300 text-xs mt-2 leading-relaxed">
                  Carga Excel, mapeo dinámico de columnas, comparativa con reportes iniciales del Historial (días/semanas), estadísticas de días con más/menos reparaciones y creación de tablas personalizadas.
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Carga de Excel y Configuración de Columnas</span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Comparativa Reparadas vs Reportes Iniciales</span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Días Pico, Reincidencias y Tablas a Medida</span>
                </div>
              </div>
            </div>

            <button className="w-full py-3 px-4 bg-indigo-600 group-hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/20">
              <span>Ingresar a Análisis de Reparadas</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

        </div>

      </main>

      {/* User Management Modal */}
      {isAdmin && (
        <UserManagementModal
          isOpen={isUserMgmtOpen}
          onClose={() => setIsUserMgmtOpen(false)}
          currentUsername={portalUser.username}
        />
      )}

    </div>
  );
};
