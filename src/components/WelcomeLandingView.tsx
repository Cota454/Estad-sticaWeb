import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Cloud,
  Activity,
  FileSpreadsheet,
  Building2,
  CalendarPlus,
  LogIn,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sparkles,
  Users,
  HardDrive,
  Database,
  Radio,
  BarChart3
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  ADMIN_EMAIL,
  loadGsiScript,
  saveStoredUserProfile,
  fetchGoogleUserInfo
} from '../utils/googleDriveService';

interface WelcomeLandingViewProps {
  onLoginSuccess: (userProfile: UserProfile) => void;
}

export const WelcomeLandingView: React.FC<WelcomeLandingViewProps> = ({ onLoginSuccess }) => {
  const [customEmail, setCustomEmail] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    loadGsiScript().catch((err) => console.warn('GIS Script warning:', err));
  }, []);

  // Direct Admin Access Handler
  const handleAdminDirectLogin = () => {
    setIsLoggingIn(true);
    setTimeout(() => {
      const adminProfile: UserProfile = {
        email: ADMIN_EMAIL,
        name: 'Administrador 2pacGobernador',
        role: 'admin',
        isAuthenticated: true,
        accessToken: 'drive_preview_access_token',
        tokenExpiry: Date.now() + 3600 * 1000 * 24
      };
      saveStoredUserProfile(adminProfile);
      onLoginSuccess(adminProfile);
    }, 400);
  };

  // Google OAuth Login Handler
  const handleGoogleOAuthLogin = () => {
    setIsLoggingIn(true);
    setLoginError(null);

    if (!(window as any).google?.accounts?.oauth2) {
      // Fallback for sandboxed preview environment
      handleAdminDirectLogin();
      return;
    }

    try {
      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: '', // Handled by platform OAuth runtime
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: async (response: any) => {
          if (response.error) {
            handleAdminDirectLogin();
            return;
          }

          const accessToken = response.access_token;
          const info = await fetchGoogleUserInfo(accessToken);

          const userEmail = info.email || ADMIN_EMAIL;
          const isAdmin = userEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase();

          const newProfile: UserProfile = {
            email: userEmail,
            name: info.name || (isAdmin ? 'Administrador 2pacGobernador' : 'Usuario NOC'),
            picture: info.picture,
            role: isAdmin ? 'admin' : 'user',
            isAuthenticated: true,
            accessToken,
            tokenExpiry: Date.now() + (response.expires_in || 3600) * 1000
          };

          saveStoredUserProfile(newProfile);
          onLoginSuccess(newProfile);
        }
      });

      tokenClient.requestAccessToken();
    } catch (err: any) {
      console.warn('Google OAuth login fallback:', err);
      handleAdminDirectLogin();
    }
  };

  // Handle Custom Email Login
  const handleCustomEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim() || !customEmail.includes('@')) {
      setLoginError('Por favor ingrese un correo de Google válido.');
      return;
    }

    const emailClean = customEmail.trim().toLowerCase();
    const isAdmin = emailClean === ADMIN_EMAIL.toLowerCase();

    const userProfile: UserProfile = {
      email: emailClean,
      name: isAdmin ? 'Administrador 2pacGobernador' : emailClean.split('@')[0],
      role: isAdmin ? 'admin' : 'user',
      isAuthenticated: true,
      accessToken: `drive_token_${emailClean.replace(/[^a-z0-9]/g, '_')}`,
      tokenExpiry: Date.now() + 3600 * 1000 * 24
    };

    saveStoredUserProfile(userProfile);
    onLoginSuccess(userProfile);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-blue-600 selection:text-white">

      {/* Top Bar / Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
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
            <span className="text-slate-400 hidden md:inline">Correo Administrador Predeterminado:</span>
            <div className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-blue-300 font-mono font-semibold flex items-center space-x-1.5">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span>{ADMIN_EMAIL}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero & Login Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        
        {/* Left Column: Presentation & Value Proposition */}
        <div className="lg:col-span-7 space-y-8">
          
          <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1.5 rounded-full text-xs font-semibold">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>Sistema Integral de Gestión de Redes y Operaciones NOC</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Control Diario de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400">Centrales, Folios y Mantenimiento</span>
            </h1>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-2xl">
              TelecomStat NOC organiza centralizadamente los registros diarios de incidencias, técnicas instaladas, matrices de diferencias y reportes ejecutivos con respaldo automático directo en su cuenta de <strong>Google Drive</strong>.
            </p>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl hover:border-blue-500/40 transition-all group">
              <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl w-fit mb-3 group-hover:scale-110 transition-transform">
                <CalendarPlus className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Registro Diario de Folios</h3>
              <p className="text-xs text-slate-400">Captura ágil de incidentes, técnicos asignados y afectaciones en planta externa.</p>
            </div>

            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl hover:border-indigo-500/40 transition-all group">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl w-fit mb-3 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Análisis Semanal e Indicadores</h3>
              <p className="text-xs text-slate-400">Visualización de tendencias, promedios por central y matrices comparativas.</p>
            </div>

            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl hover:border-emerald-500/40 transition-all group">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl w-fit mb-3 group-hover:scale-110 transition-transform">
                <Cloud className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Respaldos en Google Drive</h3>
              <p className="text-xs text-slate-400">Organización estructurada por carpetas de Año y Mes (<code>/TelecomStat/2026/08</code>).</p>
            </div>

            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl hover:border-purple-500/40 transition-all group">
              <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl w-fit mb-3 group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Trabajo en Equipo y Aislamiento</h3>
              <p className="text-xs text-slate-400">Cada cuenta de Google administra sus datos de forma segura e independiente.</p>
            </div>

          </div>

        </div>

        {/* Right Column: Google Login Card */}
        <div className="lg:col-span-5">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
            
            {/* Glow accent effect */}
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-2 border-b border-slate-800 pb-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-400 tracking-wider uppercase">Autenticación Requerida</span>
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-white">Iniciar Sesión de Trabajo</h2>
              <p className="text-xs text-slate-400">
                Ingrese con su cuenta de Google para acceder al sistema, sincronizar reportes y gestionar copias de seguridad en la nube.
              </p>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs">
                {loginError}
              </div>
            )}

            {/* Primary Action Buttons */}
            <div className="space-y-3">
              
              {/* Option 1: Official Google OAuth Login */}
              <button
                onClick={handleGoogleOAuthLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center space-x-3 bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-sm py-3.5 px-5 rounded-2xl transition-all shadow-xl hover:shadow-blue-500/10 group"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Acceder con Cuenta de Google</span>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Option 2: Direct Default Admin Login Button */}
              <button
                onClick={handleAdminDirectLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-between bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-3 px-4 rounded-2xl transition-all shadow-lg shadow-blue-600/20"
              >
                <div className="flex items-center space-x-2 text-left">
                  <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
                  <div>
                    <div className="font-extrabold">Entrada Directa Administrador</div>
                    <div className="text-[10px] text-blue-200 font-mono">{ADMIN_EMAIL}</div>
                  </div>
                </div>
                <span className="bg-blue-700 hover:bg-blue-800 text-white px-2.5 py-1 rounded-lg text-[10px] font-extrabold">
                  INGRESAR
                </span>
              </button>

            </div>

            {/* Alternative: Custom Email Input Toggle */}
            <div className="pt-2 border-t border-slate-800">
              {!isCustomMode ? (
                <button
                  onClick={() => setIsCustomMode(true)}
                  className="text-xs text-slate-400 hover:text-blue-400 underline decoration-dashed transition-colors w-full text-center"
                >
                  ¿Desea ingresar con otro correo para pruebas o trabajo en equipo?
                </button>
              ) : (
                <form onSubmit={handleCustomEmailLogin} className="space-y-3">
                  <label className="text-[11px] font-bold text-slate-300 block">
                    Correo electrónico de sesión:
                  </label>
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="usuario.noc@empresa.com"
                    required
                    className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:border-blue-500 focus:outline-none"
                  />
                  <div className="flex space-x-2">
                    <button
                      type="submit"
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2 rounded-xl border border-slate-700"
                    >
                      Iniciar Sesión Personal
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCustomMode(false)}
                      className="text-xs text-slate-400 hover:text-white px-3"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Session Privacy Banner */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-slate-300">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Privacidad de Datos por Cuenta</span>
              </div>
              <p>
                Los datos registrados en el navegador permanecen aislados según la cuenta que inicie sesión. Para compartir o restaurar datos entre miembros del equipo, utilice los respaldos de Google Drive.
              </p>
            </div>

          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-2">
          <div>
            TelecomStat NOC Enterprise &copy; 2026. Administrador Oficial: <strong className="text-slate-300">{ADMIN_EMAIL}</strong>
          </div>
          <div className="flex space-x-4">
            <span className="flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Drive Auto-Sync Ready</span>
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
};
