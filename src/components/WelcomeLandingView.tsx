import React, { useState } from 'react';
import {
  ShieldCheck,
  Activity,
  LogIn,
  CheckCircle2,
  Lock,
  User,
  Key,
  AlertCircle,
  HardDrive,
  Sparkles,
  ArrowRight,
  Shield,
  Radio,
  BarChart3
} from 'lucide-react';
import { UserProfile, PortalUser } from '../types';
import {
  authenticatePortalUser,
  saveActivePortalSession
} from '../utils/authService';
import { ADMIN_EMAIL } from '../utils/googleDriveService';

interface WelcomeLandingViewProps {
  onLoginSuccess: (userProfile: UserProfile, portalUser: PortalUser) => void;
}

export const WelcomeLandingView: React.FC<WelcomeLandingViewProps> = ({ onLoginSuccess }) => {
  const [usernameInput, setUsernameInput] = useState<string>('Admin');
  const [passwordInput, setPasswordInput] = useState<string>('Rafael1974**');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handlePortalLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    setTimeout(() => {
      const authenticatedUser = authenticatePortalUser(usernameInput, passwordInput);

      if (!authenticatedUser) {
        setLoginError('Credenciales incorrectas o usuario inactivo. Verifique su usuario y contraseña.');
        setIsLoggingIn(false);
        return;
      }

      // Save session & convert to profile
      const profile = saveActivePortalSession(authenticatedUser);

      if (profile) {
        onLoginSuccess(profile, authenticatedUser);
      }
      setIsLoggingIn(false);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-blue-600 selection:text-white">

      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl text-white shadow-lg shadow-blue-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg text-white tracking-tight">TelecomStat <span className="text-blue-400">NOC</span></span>
              <span className="hidden sm:inline-block ml-2 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-mono">v2.5 Enterprise</span>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <span className="text-slate-400 hidden md:inline">Cuenta de Respaldo Drive:</span>
            <div className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-emerald-400 font-mono font-bold flex items-center space-x-1.5">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>{ADMIN_EMAIL}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Login Portal Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col lg:flex-row items-center justify-center gap-12">
        
        {/* Left Side: Information & Branding */}
        <div className="flex-1 space-y-6 max-w-xl text-center lg:text-left">
          <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-500/20 px-3.5 py-1.5 rounded-full text-blue-400 text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>Portal de Seguridad & Acceso Administrado</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            Consola Operativa NOC y Gestión de Datos
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Inicie sesión con sus credenciales autorizadas para acceder a los módulos de <strong>Análisis de Reporte</strong>, <strong>Análisis de IP</strong> y <strong>Análisis Reparaciones</strong>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-left">
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl">
              <BarChart3 className="w-5 h-5 text-emerald-400 mb-1" />
              <div className="text-xs font-bold text-white">Análisis de Reporte</div>
              <div className="text-[10px] text-slate-400">Procesamiento de folios CTA</div>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl">
              <Radio className="w-5 h-5 text-blue-400 mb-1" />
              <div className="text-xs font-bold text-white">Análisis de IP</div>
              <div className="text-[10px] text-slate-400">Subredes y ping ICMP</div>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl">
              <Shield className="w-5 h-5 text-indigo-400 mb-1" />
              <div className="text-xs font-bold text-white">Análisis Reparaciones</div>
              <div className="text-[10px] text-slate-400">Tiempos medios MTTR</div>
            </div>
          </div>
        </div>

        {/* Right Side: Login Form Card */}
        <div className="w-full max-w-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-2 relative z-10">
              <div className="flex items-center space-x-2 text-blue-400">
                <Lock className="w-5 h-5" />
                <h2 className="text-xl font-extrabold text-white">Inicio de Sesión</h2>
              </div>
              <p className="text-xs text-slate-400">
                Ingrese sus credenciales registradas por el Administrador.
              </p>
            </div>

            {/* Admin Credentials Quick Hint */}
            <div className="p-3.5 bg-blue-950/60 border border-blue-800/50 rounded-2xl space-y-1 text-xs">
              <div className="flex items-center justify-between text-blue-300 font-bold">
                <span className="flex items-center space-x-1">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Credenciales Administrador Principal:</span>
                </span>
                <span className="text-[10px] bg-blue-900 px-1.5 py-0.5 rounded text-blue-200">Default</span>
              </div>
              <div className="font-mono text-slate-200 flex items-center justify-between pt-1">
                <span>Usuario: <strong className="text-white">Admin</strong></span>
                <span>Contraseña: <strong className="text-amber-300">Rafael1974**</strong></span>
              </div>
            </div>

            {/* Error Message */}
            {loginError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-2xl text-xs font-semibold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Form Inputs */}
            <form onSubmit={handlePortalLogin} className="space-y-4 relative z-10">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                  Usuario
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="ej. Admin"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white font-bold placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white font-bold placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center space-x-2"
              >
                {isLoggingIn ? (
                  <span>Validando Credenciales...</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Ingresar al Portal NOC</span>
                  </>
                )}
              </button>
            </form>

            <div className="text-center pt-2">
              <span className="text-[11px] text-slate-500">
                Los usuarios secundarios son creados y gestionados por el Administrador.
              </span>
            </div>

          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/50 py-4 text-center text-xs text-slate-500">
        <p>TelecomStat NOC v2.5 Enterprise · Sistema de Análisis Centralizado</p>
      </footer>

    </div>
  );
};
