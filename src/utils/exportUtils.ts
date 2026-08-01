import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Central, WorkGroup, DailyReport, SystemDataBackup } from '../types';
import { getTodayStr, formatDateLong } from './dateUtils';

export function downloadJSONBackup(
  centrales: Central[],
  workGroups: WorkGroup[],
  reports: DailyReport[]
) {
  const backupData: SystemDataBackup = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    centrales,
    workGroups,
    reports
  };

  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `copia_de_seguridad.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseJSONBackupFile(file: File): Promise<SystemDataBackup> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed.centrales) && Array.isArray(parsed.workGroups) && Array.isArray(parsed.reports)) {
          resolve(parsed as SystemDataBackup);
        } else if (Array.isArray(parsed)) {
          // Fallback if raw reports array
          reject(new Error('El archivo JSON no tiene la estructura completa de copia de seguridad (centrales, grupos y reportes).'));
        } else {
          reject(new Error('Formato de copia de seguridad JSON inválido.'));
        }
      } catch (err) {
        reject(new Error('Error al decodificar el archivo JSON. Asegúrese de que sea un JSON válido.'));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsText(file);
  });
}

export async function exportElementToPDF(
  elementId: string,
  title: string,
  fileName: string = 'informe_estadistico_telecom.pdf'
) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found for PDF export.`);
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Header banner
    pdf.setFillColor(15, 23, 42); // slate-900
    pdf.rect(0, 0, pdfWidth, 18, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(11);
    pdf.text('SISTEMA ESTADÍSTICO DE OPERACIONES DE TELECOMUNICACIONES', 10, 11);
    pdf.setFontSize(8);
    pdf.text(`Fecha de exportación: ${formatDateLong(getTodayStr())}`, pdfWidth - 75, 11);

    const imgWidth = pdfWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 24;

    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= (pdfHeight - 30);

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    pdf.save(fileName);
  } catch (err) {
    console.error('Error generating PDF:', err);
    alert('No se pudo generar el documento PDF. Intente nuevamente.');
  }
}
