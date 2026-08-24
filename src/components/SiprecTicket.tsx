import React from 'react';
import { IpCableRow } from '../types/ipCablesTypes';

interface SiprecTicketProps {
  row: IpCableRow;
  index?: number;
  ticketWidth?: '80mm' | '58mm' | 'full';
  showFooterLiquidation?: boolean;
  ticketFormat?: 'siprec' | 'standard';
  selectedColumns?: string[];
}

// Helper to search case-insensitively across rawRowData keys
function findRawValue(raw: Record<string, any> | undefined, aliases: string[]): string | null {
  if (!raw) return null;
  const rawKeys = Object.keys(raw);
  
  for (const alias of aliases) {
    const aliasClean = alias.trim().toUpperCase();
    const foundKey = rawKeys.find(k => k.trim().toUpperCase() === aliasClean);
    if (foundKey && raw[foundKey] !== undefined && raw[foundKey] !== null && String(raw[foundKey]).trim() !== '') {
      return String(raw[foundKey]).trim();
    }
  }

  // Second pass: partial includes
  for (const alias of aliases) {
    const aliasClean = alias.trim().toUpperCase();
    const foundKey = rawKeys.find(k => k.trim().toUpperCase().includes(aliasClean));
    if (foundKey && raw[foundKey] !== undefined && raw[foundKey] !== null && String(raw[foundKey]).trim() !== '') {
      return String(raw[foundKey]).trim();
    }
  }

  return null;
}

export const SiprecTicket: React.FC<SiprecTicketProps> = ({
  row,
  index = 1,
  ticketWidth = '80mm',
  showFooterLiquidation = true,
  ticketFormat = 'siprec',
  selectedColumns = []
}) => {
  const raw = row.rawRowData || {};

  // Extract all fields matching the physical SIPREC field layout
  const centralName = findRawValue(raw, ['CENTRAL', 'CENTRAL TELEFONICA', 'CENTRAL_TELEFONICA', 'CENTRAL TELEFÓNICA']) || row.central || 'CENTRAL';
  const servicio = findRawValue(raw, ['SERVICIO', 'TELEFONO', 'NUMERO', 'SERVICIO EXT', 'TEL']) || row.servicio || 'N/A';
  
  // Format Date (e.g., 23/4/2026 51)
  let fechaPrueb = findRawValue(raw, ['FECH-PRUEB', 'FECH-PRUEB SERV', 'FECHA PRUEBA', 'FECHA REPORTE', 'FECHA', 'FECHA_REPORTE']);
  if (!fechaPrueb) {
    if (row.fechaReporte) {
      try {
        const parts = row.fechaReporte.split('-');
        if (parts.length === 3) {
          fechaPrueb = `${parseInt(parts[2], 10)}/${parseInt(parts[1], 10)}/${parts[0]}`;
        } else {
          fechaPrueb = row.fechaReporte;
        }
      } catch {
        fechaPrueb = row.fechaReporte;
      }
    } else {
      const now = new Date();
      fechaPrueb = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
    }
  }

  // Folio#
  const folio = findRawValue(raw, ['FOLIO#', 'FOLIO', 'NO. REPORTE', 'NO_REPORTE', 'NUMERO REPORTE', 'ID_REPORTE', 'REPORTE']) || 
    `43${(servicio.replace(/\D/g, '') || '63836').slice(-5)}`;

  // Subscriber Data
  const nombre = findRawValue(raw, ['NOMBRE', 'NOMBRE ABONADO', 'CLIENTE', 'ABONADO', 'TITULAR', 'SUSCRIPTOR', 'NOMBRE_ABONADO']) || 'ABONADO GENERAL';
  const direccion = findRawValue(raw, ['DIRECC', 'DIRECCION', 'DIR', 'DIRECCIÓN', 'DOMICILIO', 'DIRECCION ABONADO', 'CALLE']) || 'DIRECCIÓN PENDIENTE DE CAMPO';
  const tipoServ = findRawValue(raw, ['TIPOSERV', 'TIPO SERVICIO', 'TIPO_SERVICIO', 'TIPO']) || 'TE';
  
  // Equipment / Apparatus
  const equipoAparato = findRawValue(raw, ['EQUIPO', 'APARATO', 'EQUIPO APARATO', 'APARATO LUGAR', 'MODELO']) || 'ppl GOLDST MF SI 0';
  
  // Line Circuit & Port
  const puerto = findRawValue(raw, ['PUERTO', 'CIRCUITO', 'CIRCUITO DE LINEA', 'PORT', 'POSICION', 'MSAN_PORT']) || 
    `SCU0${(servicio.replace(/\D/g, '') || '6408').slice(-4)} 01-05-42 234`;

  // Observations & Notes
  const observaciones = findRawValue(raw, ['OBSERVACIONES', 'OBSERVACION', 'OBS', 'DETALLE', 'MOTIVO', 'DESCRIPCION']) || 
    'SIN OBSERVACIONES ESPECIFICADAS EN EL SISTEMA';
  const nota = findRawValue(raw, ['NOTA', 'NOTAS', 'REFERENCIA', 'COMENTARIOS', 'INDICACIONES']) || 
    'CONFIRMAR ACCESO Y LLAVE CON EL CLIENTE';

  // Electrical Test Result
  const resultadoPrueba = findRawValue(raw, ['RESULTADO DE PRUEBA', 'RESULTADO PRUEBA', 'PRUEBA', 'ESTADO PRUEBA', 'FALLA', 'DEFECTO', 'TIPO FALLA']) || 
    'Cortocircuito P <PAR';

  // Outside Plant Data (Rack, Pair, Cable, Terminal)
  const rack = findRawValue(raw, ['RACK', 'BASTIDOR', 'LISTON', 'BLOQUE']) || row.parP || row.parS || '95';
  const par = row.parP || row.parS || findRawValue(raw, ['PAR', 'PAR P', 'PAR S', 'PAR PRIMARIO', 'PAR SECUNDARIO']) || '95';
  const cableName = row.cableP || row.cableS || row.cable || findRawValue(raw, ['CABLE', 'CABLE P', 'CABLE S']) || 'VA12 (BAJA)';
  const terminal = findRawValue(raw, ['TERMINAL', 'CAJA', 'DISTRIBUIDOR', 'TERM']) || 
    (row.cable ? `${row.cable.replace(/\D/g, '') || '1210'}` : '1210');
  
  const grupoZona = row.grupo || findRawValue(raw, ['GRUPO', 'ZONA', 'ZONA TERMINAL']) || 'RAJ';
  const rangoPares = findRawValue(raw, ['RANGO PARES', 'RANGO', 'PAR RANGO']) || '(91 al 100)';
  const dirTerminal = findRawValue(raw, ['DIR TERMINAL', 'DIRECCION TERMINAL', 'UBICACION TERMINAL', 'DIR_TERMINAL']) || 'DETRÁS DEL EDIFICIO A-2';

  // Data / Contact
  const servicioDatos = findRawValue(raw, ['SERVICIO DATOS', 'DATOS', 'INTERNET', 'IP', 'ENLACE']) || '';
  const nodo = findRawValue(raw, ['NODO', 'DSLAM', 'OLT', 'MSAN']) || '';
  const puerta = findRawValue(raw, ['PUERTA', 'PORT DATA', 'SLOT']) || '';
  const telContacto = findRawValue(raw, ['TELEFONO DE LOCALIZACION', 'TEL LOCALIZACION', 'TELEFONO CONTACTO', 'TEL CONTACTO', 'MOVIL', 'CELULAR']) || servicio;
  const nombreContacto = findRawValue(raw, ['NOMBRE CONTACTO', 'CONTACTO', 'RESPONSABLE', 'ATENCION']) || (nombre.split(' ')[0] || 'LIDIA');
  const repetidas = findRawValue(raw, ['REPETIDAS', 'REINCIDENCIA', 'HISTORIAL']) || 'No hay repetidas en últimos 30 días';

  // Width Class
  const widthStyle = ticketWidth === '58mm' 
    ? 'w-[230px] max-w-[230px] text-[10px] p-2' 
    : ticketWidth === '80mm' 
    ? 'w-[310px] max-w-[310px] text-[11px] p-3' 
    : 'w-full max-w-xl text-xs p-4';

  if (ticketFormat === 'standard') {
    return (
      <div 
        className={`bg-white text-black rounded-lg shadow-md font-mono border-2 border-black space-y-3 break-inside-avoid print:break-inside-avoid print:shadow-none print:m-0 print:border-black ${widthStyle}`}
        style={{ pageBreakAfter: 'always', breakAfter: 'page' }}
      >
        <div className="text-center border-b-2 border-black pb-2 space-y-0.5">
          <h2 className="text-sm font-black uppercase">ORDEN DE TRABAJO - SIPREC</h2>
          <div className="text-xs font-bold text-blue-900">SERVICIO: {servicio}</div>
          <div className="text-[10px] text-gray-700">Central: {centralName} | Folio: #{folio}</div>
        </div>

        <div className="space-y-1 text-xs pt-1">
          {selectedColumns.length > 0 ? (
            selectedColumns.map(col => {
              let val = raw[col] || (row as any)[col] || '-';
              return (
                <div key={col} className="flex justify-between border-b border-gray-200 pb-0.5 text-[11px]">
                  <span className="font-bold text-gray-700 uppercase text-[10px]">{col}:</span>
                  <span className="font-bold truncate max-w-[170px]">{String(val)}</span>
                </div>
              );
            })
          ) : (
            <>
              <div className="flex justify-between border-b border-gray-200 pb-0.5"><span className="font-bold">Cliente:</span><span className="font-bold">{nombre}</span></div>
              <div className="flex justify-between border-b border-gray-200 pb-0.5"><span className="font-bold">Dirección:</span><span className="font-bold">{direccion}</span></div>
              <div className="flex justify-between border-b border-gray-200 pb-0.5"><span className="font-bold">Cable / Par:</span><span className="font-bold">{cableName} / {par}</span></div>
              <div className="flex justify-between border-b border-gray-200 pb-0.5"><span className="font-bold">Terminal:</span><span className="font-bold">{terminal} ({grupoZona})</span></div>
              <div className="flex justify-between border-b border-gray-200 pb-0.5"><span className="font-bold">Prueba:</span><span className="font-bold text-red-600">{resultadoPrueba}</span></div>
            </>
          )}
        </div>

        {showFooterLiquidation && (
          <div className="border-t-2 border-dashed border-black pt-3 mt-3 text-[10px] space-y-2">
            <div><strong>Trabajo efectuado:</strong> ______________________</div>
            <div className="grid grid-cols-2 gap-2 text-center pt-2">
              <div className="border-t border-black pt-1 font-bold">Reparador / Técnico</div>
              <div className="border-t border-black pt-1 font-bold">Fecha / Clave Arreglo</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // EXACT REPLICA OF THE PHYSICAL SIPREC THERMAL TICKET FROM PHOTO
  return (
    <div
      className={`bg-white text-black font-mono leading-tight tracking-tight shadow-md border border-gray-300 print:border-none print:shadow-none print:p-0 print:m-0 break-inside-avoid print:break-inside-avoid select-text ${widthStyle}`}
      style={{
        fontFamily: '"Courier New", Courier, "Lucida Console", monospace',
        pageBreakAfter: 'always',
        breakAfter: 'page',
        color: '#000000',
        backgroundColor: '#ffffff'
      }}
    >
      {/* 1. TOP HEADER */}
      <div className="flex justify-between items-start font-black text-xs uppercase border-b border-black/80 pb-0.5 mb-1">
        <span>{centralName}</span>
        <span className="tracking-widest">SIPREC</span>
      </div>

      <div className="font-black text-xs uppercase tracking-wide mb-1.5">
        REPORTE DE PENDIENTES DE 24
      </div>

      {/* 2. REPORTE / FECHA / FOLIO GRID */}
      <div className="grid grid-cols-3 gap-1 text-[10px] uppercase font-bold border-b border-black/60 pb-1 mb-1">
        <div>
          <span className="block text-[8px] text-gray-800 leading-none">Servicio Ext</span>
          <span className="font-black text-xs tracking-tighter block">{servicio}</span>
        </div>
        <div>
          <span className="block text-[8px] text-gray-800 leading-none">Fech-prueb Serv</span>
          <span className="font-black text-[10px] block">{fechaPrueb}</span>
        </div>
        <div className="text-right">
          <span className="block text-[8px] text-gray-800 leading-none">Folio#</span>
          <span className="font-black text-[11px] block">{folio}</span>
        </div>
      </div>

      {/* 3. SUBSCRIBER INFO */}
      <div className="space-y-0.5 text-[10.5px] uppercase font-bold mb-1.5 leading-snug">
        <div className="break-words">
          <span className="text-gray-900 font-normal">Nombre: </span>
          <span className="font-black">{nombre}</span>
        </div>
        <div className="break-words">
          <span className="text-gray-900 font-normal">Direcc: </span>
          <span>{direccion}</span>
        </div>
        <div>
          <span className="text-gray-900 font-normal">TipoServ: </span>
          <span className="font-black">{tipoServ}</span>
        </div>
      </div>

      {/* 4. APPARATUS & EQUIPMENT */}
      <div className="text-[10px] font-bold text-center tracking-tighter text-gray-800 my-0.5">
        ---Equipo--Aparato-Lugar---APA-Ext-
      </div>
      <div className="text-[10.5px] font-mono font-bold text-left px-1 mb-1">
        {equipoAparato}
      </div>

      {/* 5. LINE CIRCUIT */}
      <div className="text-[10px] font-bold text-center tracking-tighter text-gray-800 my-0.5">
        ------ Circuito de Línea ------
      </div>
      <div className="text-[10.5px] font-mono font-black mb-1 px-1">
        PUERTO: {puerto}
      </div>

      {/* 6. OBSERVATIONS */}
      <div className="text-[10px] font-bold text-center tracking-tighter text-gray-800 my-0.5">
        ------ Observaciones ------
      </div>
      <div className="text-[10px] uppercase font-bold px-1 mb-1 break-words leading-tight">
        {observaciones}
      </div>

      {/* 7. NOTE */}
      <div className="text-[10px] font-bold text-center tracking-tighter text-gray-800 my-0.5">
        ------ Nota ------
      </div>
      <div className="text-[10px] uppercase font-bold px-1 mb-1 break-words leading-tight">
        {nota}
      </div>

      {/* 8. TEST RESULT */}
      <div className="text-[10px] font-bold text-center tracking-tighter text-gray-800 my-0.5">
        ------ Resultado de Prueba------Pdte.de
      </div>
      <div className="flex justify-between items-center text-[10.5px] font-black px-1 mb-1.5">
        <span>{resultadoPrueba}</span>
        <span className="text-[9.5px]">P &lt;PAR</span>
      </div>

      {/* 9. OUTSIDE PLANT / NETWORK DETAILS */}
      <div className="border-t border-dashed border-black/80 pt-1 space-y-0.5 text-[10.5px] font-bold uppercase mb-1.5">
        <div>
          <span className="text-gray-900 font-normal">Central: </span>
          <span className="font-black">{centralName}</span>
        </div>
        <div className="flex justify-between">
          <div>
            <span className="text-gray-900 font-normal">Rack: </span>
            <span className="font-black">{rack}</span>
          </div>
          <div>
            <span className="text-gray-900 font-normal">Par: </span>
            <span className="font-black">{par}</span>
          </div>
        </div>
        <div>
          <span className="text-gray-900 font-normal">Cable: </span>
          <span className="font-black">{cableName}</span>
        </div>
        <div>
          <span className="text-gray-900 font-normal">Terminal: </span>
          <span className="font-black">{terminal}</span>
        </div>
        <div className="text-[10px] text-gray-900">
          {rangoPares} en Zona {grupoZona}
        </div>
        <div className="break-words">
          <span className="text-gray-900 font-normal">Direccion: </span>
          <span>{dirTerminal}</span>
        </div>
      </div>

      {/* 10. DATA & CONTACT */}
      <div className="border-t border-dashed border-black/80 pt-1 space-y-0.5 text-[10px] uppercase font-bold mb-2">
        <div className="flex justify-between">
          <span>Servicio Datos: {servicioDatos || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span>Nodo: {nodo || '-'}</span>
          <span>Puerta: {puerta || '-'}</span>
        </div>
        <div>
          <span className="text-gray-900 font-normal">Teléfono de Localización: </span>
          <span className="font-black">{telContacto}</span>
        </div>
        <div>
          <span className="text-gray-900 font-normal">Nombre: </span>
          <span className="font-black">{nombreContacto}</span>
        </div>
      </div>

      {/* 11. FOOTER / LIQUIDATION WORK */}
      {showFooterLiquidation && (
        <div className="border-t border-black pt-1.5 space-y-2 text-[10px]">
          <div className="font-bold">
            Trabajo efectuado: <span className="inline-block border-b border-black w-36"></span>
          </div>

          <div className="text-[9.5px] italic text-gray-800 text-center">
            {repetidas}
          </div>

          <div className="pt-2 text-[9px] font-black uppercase flex justify-between border-t border-dashed border-black/70 mt-1">
            <span>Reparador</span>
            <span>Fecha</span>
            <span>Hora</span>
            <span>Clave arreglo</span>
          </div>
        </div>
      )}
    </div>
  );
};
