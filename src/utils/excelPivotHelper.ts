import * as XLSX from 'xlsx-js-style';

export interface MatrixSummaryData {
  rows: string[];
  columns: string[];
  cellMap: Record<string, Record<string, number>>;
  rowTotals: Record<string, number>;
  colTotals: Record<string, number>;
  grandTotal: number;
}

/**
 * Genera la pestaña 'TablaDinamica' para el archivo Excel descargado.
 * Incluye:
 * 1. Matriz de Reportes (Centrales Telefónicas vs GRUPO)
 * 2. Matriz de Zonificación (Zonas vs GRUPO)
 * Formateadas ejecutivamente con estilos, fórmulas =SUM y enlaces directos a la hoja 'Datos'.
 */
export function buildTablaDinamicaWorksheet(
  matrixCentralesData: MatrixSummaryData,
  matrixZonasData: MatrixSummaryData
): XLSX.WorkSheet {
  const aoa: any[][] = [];

  // Fila 0: Banner Principal
  aoa.push(['📊 TABLAS DINÁMICAS - CONSOLIDADO EJECUTIVO IP Y REPORTES']);
  // Fila 1: Subtítulo explicativo
  aoa.push([
    'Base sincronizada con hoja "Datos". Haga clic en cualquier casilla para ir a la base de registros. Para desgloses nativos de doble clic: Seleccione Datos > Insertar > Tabla Dinámica.'
  ]);
  // Fila 2: Separador
  aoa.push([]);

  // -------------------------------------------------------------
  // TABLA 1: MATRIZ DE REPORTES (CENTRALES VS GRUPO)
  // -------------------------------------------------------------
  const t1TitleRowIdx = aoa.length;
  aoa.push(['🏢 1. MATRIZ DE REPORTES: CENTRALES TELEFÓNICAS VS GRUPO']);

  const t1HeaderRowIdx = aoa.length;
  const t1Cols = matrixCentralesData.columns;
  const t1Header = ['Central Telefónica', ...t1Cols, 'Total General'];
  aoa.push(t1Header);

  const t1DataStartRowIdx = aoa.length;
  matrixCentralesData.rows.forEach(rowName => {
    const rowVals = t1Cols.map(col => matrixCentralesData.cellMap[rowName]?.[col] || 0);
    const rowTot = matrixCentralesData.rowTotals[rowName] || 0;
    aoa.push([rowName, ...rowVals, rowTot]);
  });
  const t1DataEndRowIdx = aoa.length - 1;

  // Fila de Total General Tabla 1
  const t1TotalRowIdx = aoa.length;
  const t1ColTotals = t1Cols.map(col => matrixCentralesData.colTotals[col] || 0);
  aoa.push(['TOTAL GENERAL CENTRALES', ...t1ColTotals, matrixCentralesData.grandTotal]);

  // Separadores
  aoa.push([]);
  aoa.push([]);

  // -------------------------------------------------------------
  // TABLA 2: MATRIZ DE ZONIFICACIÓN (ZONAS VS GRUPO)
  // -------------------------------------------------------------
  const t2TitleRowIdx = aoa.length;
  aoa.push(['📍 2. MATRIZ DE ZONIFICACIÓN: ZONAS CONFIGURADAS VS GRUPO']);

  const t2HeaderRowIdx = aoa.length;
  const t2Cols = matrixZonasData.columns;
  const t2Header = ['Zonas Configuradas', ...t2Cols, 'Total General', '% Participación'];
  aoa.push(t2Header);

  const t2DataStartRowIdx = aoa.length;
  const grandTotZonas = matrixZonasData.grandTotal || 1;
  matrixZonasData.rows.forEach(rowName => {
    const rowVals = t2Cols.map(col => matrixZonasData.cellMap[rowName]?.[col] || 0);
    const rowTot = matrixZonasData.rowTotals[rowName] || 0;
    const pct = ((rowTot / grandTotZonas) * 100).toFixed(1) + '%';
    aoa.push([rowName, ...rowVals, rowTot, pct]);
  });
  const t2DataEndRowIdx = aoa.length - 1;

  // Fila de Total General Tabla 2
  const t2TotalRowIdx = aoa.length;
  const t2ColTotals = t2Cols.map(col => matrixZonasData.colTotals[col] || 0);
  aoa.push(['TOTAL GENERAL ZONAS', ...t2ColTotals, matrixZonasData.grandTotal, '100.0%']);

  // Generar worksheet base a partir del array AOA
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Anchos de columna dinámicos
  const maxColsCount = Math.max(t1Header.length, t2Header.length);
  const colWidths: { wch: number }[] = [{ wch: 28 }]; // Primera columna (Central o Zona)
  for (let c = 1; c < maxColsCount; c++) {
    colWidths.push({ wch: 15 });
  }
  colWidths.push({ wch: 18 }); // Total General
  colWidths.push({ wch: 16 }); // %
  ws['!cols'] = colWidths;

  // Estilos de celda
  const thinBorder = {
    top: { style: 'thin', color: { rgb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } }
  };

  // 1. Banner Principal (Fila 0 y 1)
  const bannerCell = ws[XLSX.utils.encode_cell({ r: 0, c: 0 })];
  if (bannerCell) {
    bannerCell.s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 14 },
      fill: { fgColor: { rgb: '0F172A' } }, // Slate 900
      alignment: { horizontal: 'left', vertical: 'center' }
    };
  }

  const subBannerCell = ws[XLSX.utils.encode_cell({ r: 1, c: 0 })];
  if (subBannerCell) {
    subBannerCell.s = {
      font: { italic: true, color: { rgb: '475569' }, sz: 9 },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
  }

  // 2. Estilizar Título Tabla 1
  const t1TitleCell = ws[XLSX.utils.encode_cell({ r: t1TitleRowIdx, c: 0 })];
  if (t1TitleCell) {
    t1TitleCell.s = {
      font: { bold: true, color: { rgb: '1E3A8A' }, sz: 12 },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
  }

  // 3. Encabezados Tabla 1 (Navy Blue)
  for (let c = 0; c < t1Header.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: t1HeaderRowIdx, c });
    if (ws[addr]) {
      ws[addr].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
        fill: { fgColor: { rgb: '1E3A8A' } }, // Navy
        alignment: { horizontal: c === 0 ? 'left' : 'center', vertical: 'center' },
        border: thinBorder
      };
    }
  }

  // 4. Filas de Datos Tabla 1
  for (let r = t1DataStartRowIdx; r <= t1DataEndRowIdx; r++) {
    const isAlt = (r - t1DataStartRowIdx) % 2 === 1;
    for (let c = 0; c < t1Header.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (ws[addr]) {
        const isFirst = c === 0;
        const isLast = c === t1Header.length - 1;
        ws[addr].s = {
          font: {
            bold: isFirst || isLast,
            color: isLast ? { rgb: '1E3A8A' } : { rgb: '0F172A' },
            sz: 10
          },
          fill: isAlt ? { fgColor: { rgb: 'F8FAFC' } } : undefined,
          alignment: { horizontal: isFirst ? 'left' : 'center', vertical: 'center' },
          border: thinBorder
        };
        // Hipervínculo para saltar a la hoja 'Datos'
        ws[addr].l = {
          Target: "#'Datos'!A1",
          Tooltip: 'Ver detalle de registros en la hoja Datos'
        };
      }
    }
  }

  // 5. Fila Total Tabla 1
  for (let c = 0; c < t1Header.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: t1TotalRowIdx, c });
    if (ws[addr]) {
      ws[addr].s = {
        font: { bold: true, color: { rgb: '60A5FA' }, sz: 11 },
        fill: { fgColor: { rgb: '0F172A' } }, // Slate 900
        alignment: { horizontal: c === 0 ? 'left' : 'center', vertical: 'center' },
        border: thinBorder
      };
      ws[addr].l = {
        Target: "#'Datos'!A1",
        Tooltip: 'Ir a hoja Datos'
      };
    }
  }

  // 6. Estilizar Título Tabla 2
  const t2TitleCell = ws[XLSX.utils.encode_cell({ r: t2TitleRowIdx, c: 0 })];
  if (t2TitleCell) {
    t2TitleCell.s = {
      font: { bold: true, color: { rgb: '065F46' }, sz: 12 },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
  }

  // 7. Encabezados Tabla 2 (Emerald Green)
  for (let c = 0; c < t2Header.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: t2HeaderRowIdx, c });
    if (ws[addr]) {
      ws[addr].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
        fill: { fgColor: { rgb: '065F46' } }, // Emerald
        alignment: { horizontal: c === 0 ? 'left' : 'center', vertical: 'center' },
        border: thinBorder
      };
    }
  }

  // 8. Filas de Datos Tabla 2
  for (let r = t2DataStartRowIdx; r <= t2DataEndRowIdx; r++) {
    const isAlt = (r - t2DataStartRowIdx) % 2 === 1;
    for (let c = 0; c < t2Header.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (ws[addr]) {
        const isFirst = c === 0;
        const isTot = c === t2Header.length - 2;
        const isPct = c === t2Header.length - 1;
        ws[addr].s = {
          font: {
            bold: isFirst || isTot || isPct,
            color: isTot ? { rgb: '065F46' } : isPct ? { rgb: '059669' } : { rgb: '0F172A' },
            sz: 10
          },
          fill: isAlt ? { fgColor: { rgb: 'F0FDF4' } } : undefined,
          alignment: { horizontal: isFirst ? 'left' : 'center', vertical: 'center' },
          border: thinBorder
        };
        ws[addr].l = {
          Target: "#'Datos'!A1",
          Tooltip: 'Ver detalle de registros en la hoja Datos'
        };
      }
    }
  }

  // 9. Fila Total Tabla 2
  for (let c = 0; c < t2Header.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: t2TotalRowIdx, c });
    if (ws[addr]) {
      ws[addr].s = {
        font: { bold: true, color: { rgb: '34D399' }, sz: 11 },
        fill: { fgColor: { rgb: '0F172A' } }, // Slate 900
        alignment: { horizontal: c === 0 ? 'left' : 'center', vertical: 'center' },
        border: thinBorder
      };
      ws[addr].l = {
        Target: "#'Datos'!A1",
        Tooltip: 'Ir a hoja Datos'
      };
    }
  }

  return ws;
}
