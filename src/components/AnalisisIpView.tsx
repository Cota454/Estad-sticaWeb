import React, { useState } from 'react';
import {
  Network,
  Radio,
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
  Sparkles,
  Wifi,
  ShieldCheck,
  Cpu,
  ArrowLeft,
  SlidersHorizontal,
  Layers
} from 'lucide-react';

interface AnalisisIpViewProps {
  onBackToHub: () => void;
}

interface IpSubnet {
  id: string;
  name: string;
  subnet: string;
  gateway: string;
  usedIps: number;
  totalIps: number;
  status: 'optimal' | 'warning' | 'critical';
  central: string;
  type: string;
}

export const AnalisisIpView: React.FC<AnalisisIpViewProps> = ({ onBackToHub }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [pingingIp, setPingingIp] = useState<string | null>(null);
  const [pingResult, setPingResult] = useState<{ ip: string; status: string; rtt: string; loss: string } | null>(null);

  const mockSubnets: IpSubnet[] = [
    { id: '1', name: 'Gestión Central CTA SE', subnet: '10.120.40.0/24', gateway: '10.120.40.1', usedIps: 184, totalIps: 254, status: 'optimal', central: 'CTA SE', type: 'Core Network' },
    { id: '2', name: 'Nodos OLT GPON Norte', subnet: '10.120.42.0/23', gateway: '10.120.42.1', usedIps: 492, totalIps: 510, status: 'warning', central: 'Plaza Norte', type: 'Acceso GPON' },
    { id: '3', name: 'Anillos Troncales IP/MPLS', subnet: '172.24.10.0/27', gateway: '172.24.10.1', usedIps: 22, totalIps: 30, status: 'optimal', central: 'Core Central', type: 'Troncal Backhaul' },
    { id: '4', name: 'Switches NOC Mantenimiento', subnet: '10.120.88.0/24', gateway: '10.120.88.1', usedIps: 95, totalIps: 254, status: 'optimal', central: 'NOC Principal', type: 'Mantenimiento' },
    { id: '5', name: 'VoIP & ToIP Servidores', subnet: '10.120.100.0/25', gateway: '10.120.100.1', usedIps: 120, totalIps: 126, status: 'critical', central: 'Central Sur', type: 'Telefonía IP' },
  ];

  const handleRunPingTest = (ip: string) => {
    setPingingIp(ip);
    setPingResult(null);

    setTimeout(() => {
      setPingingIp(null);
      setPingResult({
        ip,
        status: 'EXITOSO (64 bytes)',
        rtt: `${Math.floor(Math.random() * 8 + 3)}ms`,
        loss: '0% (4/4 paquetes)'
      });
    }, 1200);
  };

  const filteredSubnets = mockSubnets.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.subnet.includes(searchTerm) ||
                          s.central.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || s.status === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Banner Navigation */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBackToHub}
              className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl border border-slate-700 transition-all hover:scale-105"
              title="Volver al Portal de Módulos"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center space-x-2">
                <span className="bg-blue-500/20 text-blue-400 text-xs px-2.5 py-0.5 rounded-full border border-blue-500/30 font-bold uppercase font-mono">
                  Módulo 02
                </span>
                <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-semibold flex items-center space-x-1">
                  <Sparkles className="w-3 h-3" />
                  <span>En Desarrollo v2.6 - Vista Previa</span>
                </span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight mt-1">Análisis de IP y Direccionamiento de Red</h1>
              <p className="text-slate-400 text-xs sm:text-sm">
                Supervisión de subredes, monitoreo ping ICMP, ocupación de direccionamiento IP y enlaces troncales NOC.
              </p>
            </div>
          </div>

          <button
            onClick={onBackToHub}
            className="self-start sm:self-center px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20"
          >
            ← Volver al Portal
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Subredes Monitoreadas</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Network className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">24 Subredes</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>22 Normales · 2 con Alta Ocupación</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">IPs Asignadas / Activas</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">1,420 IPs</div>
          <div className="text-[11px] text-slate-500 font-semibold mt-1">
            De 2,048 totales (69.3% Ocupación)
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Disponibilidad Ping ICMP</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">99.88%</div>
          <div className="text-[11px] text-purple-600 font-semibold mt-1">
            Latencia Promedio: 5.2 ms
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Equipos Core / Switches</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">18 Nodos</div>
          <div className="text-[11px] text-amber-600 font-semibold mt-1">
            Todos Respondiendo Ping
          </div>
        </div>

      </div>

      {/* Ping Tester Simulator */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Wifi className="w-5 h-5 text-emerald-400" />
            <h3 className="font-extrabold text-sm text-white">Simulador de Diagnóstico Ping / Traza de Red</h3>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full font-mono">
            ICMP Echo Request
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
          <div className="md:col-span-2 flex items-center space-x-2">
            <input
              type="text"
              placeholder="Ingrese dirección IP (ej: 10.120.40.1 o 172.24.10.1)"
              defaultValue="10.120.40.1"
              id="pingIpInput"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs font-mono text-white focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={() => {
                const val = (document.getElementById('pingIpInput') as HTMLInputElement)?.value || '10.120.40.1';
                handleRunPingTest(val);
              }}
              disabled={!!pingingIp}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shrink-0 transition-colors flex items-center space-x-1.5"
            >
              {pingingIp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
              <span>{pingingIp ? 'Probando...' : 'Probar Latencia'}</span>
            </button>
          </div>

          {pingResult && (
            <div className="p-3 bg-slate-950 border border-emerald-500/30 rounded-xl text-xs space-y-1 font-mono">
              <div className="text-emerald-400 font-bold flex items-center justify-between">
                <span>RESPUESTA OK</span>
                <span>{pingResult.rtt}</span>
              </div>
              <div className="text-slate-400 text-[10px]">
                IP: {pingResult.ip} · Pérdida: {pingResult.loss}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subnets List */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm space-y-4 pt-4">
        <div className="px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-extrabold text-slate-900 uppercase">
              Inventario de Subredes Registradas ({filteredSubnets.length})
            </h3>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar subred o central..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none"
            >
              <option value="all">Estado: Todos</option>
              <option value="optimal">Óptimo</option>
              <option value="warning">Alerta Ocupación</option>
              <option value="critical">Saturado (&gt;90%)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-900 text-white font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3 pl-5">Nombre de Subred / Segmento</th>
                <th className="p-3">Rango / Gateway</th>
                <th className="p-3">Central Asignada</th>
                <th className="p-3 text-center">Uso IPs</th>
                <th className="p-3 text-center">Estado</th>
                <th className="p-3 text-right pr-5">Diagnóstico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSubnets.map((sub) => {
                const percent = Math.round((sub.usedIps / sub.totalIps) * 100);
                return (
                  <tr key={sub.id} className="hover:bg-slate-50 font-medium">
                    <td className="p-3 pl-5 font-bold text-slate-900">
                      <div>{sub.name}</div>
                      <span className="text-[10px] text-slate-400 font-normal">{sub.type}</span>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-800">
                      <div>{sub.subnet}</div>
                      <span className="text-[10px] text-slate-400 font-normal">GW: {sub.gateway}</span>
                    </td>
                    <td className="p-3 text-slate-700 font-semibold">{sub.central}</td>
                    <td className="p-3 text-center">
                      <div className="font-mono font-bold text-slate-900">{sub.usedIps} / {sub.totalIps}</div>
                      <div className="w-24 bg-slate-200 h-1.5 rounded-full mx-auto mt-1 overflow-hidden">
                        <div
                          className={`h-full ${percent > 90 ? 'bg-rose-500' : percent > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          sub.status === 'optimal'
                            ? 'bg-emerald-100 text-emerald-800'
                            : sub.status === 'warning'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {sub.status === 'optimal' ? 'Óptimo' : sub.status === 'warning' ? 'Alerta' : 'Saturado'}
                      </span>
                    </td>
                    <td className="p-3 text-right pr-5">
                      <button
                        onClick={() => handleRunPingTest(sub.gateway)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-200"
                      >
                        Ping GW
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
