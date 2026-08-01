import html2canvas from 'html2canvas';
import { getSafeHtml2CanvasOptions } from './html2canvasFix';

/**
 * Copies table data to clipboard in both TSV (plain text) and HTML table formats,
 * enabling direct pasting into Microsoft Word, Excel, Google Sheets, or PowerPoint.
 */
export async function copyTableToClipboard(
  headers: string[],
  rows: (string | number)[][],
  title?: string
): Promise<boolean> {
  const tsvLines = [
    title ? `[ ${title} ]` : null,
    headers.join('\t'),
    ...rows.map(row => row.map(cell => String(cell !== undefined && cell !== null ? cell : '').replace(/\t/g, ' ')).join('\t'))
  ].filter(Boolean).join('\n');

  const htmlContent = `
    ${title ? `<h3 style="font-family: sans-serif; color: #0f172a; margin-bottom: 8px;">${title}</h3>` : ''}
    <table border="1" style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px; width: 100%;">
      <thead>
        <tr style="background-color: #0f172a; color: #ffffff; font-weight: bold;">
          ${headers.map(h => `<th style="padding: 8px 12px; text-align: left; border: 1px solid #334155;">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row, i) => `
          <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
            ${row.map(cell => `<td style="padding: 6px 12px; border: 1px solid #cbd5e1; text-align: ${typeof cell === 'number' ? 'center' : 'left'};">${cell}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const textBlob = new Blob([tsvLines], { type: 'text/plain' });
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': textBlob,
          'text/html': htmlBlob
        })
      ]);
      return true;
    } else {
      await navigator.clipboard.writeText(tsvLines);
      return true;
    }
  } catch (err) {
    console.warn('HTML Clipboard fallback to plain text:', err);
    try {
      await navigator.clipboard.writeText(tsvLines);
      return true;
    } catch (e2) {
      console.error('Clipboard copy failed:', e2);
      return false;
    }
  }
}

/**
 * Captures an HTML element (e.g. chart container) as an image (PNG) and copies it to clipboard.
 * Fallback to plain text image data notice if image write is disallowed.
 */
export async function copyElementAsImageToClipboard(
  elementIdOrRef: string | HTMLElement,
  fallbackTextSummary?: string
): Promise<{ success: boolean; mode?: 'clipboard' | 'download' }> {
  try {
    const el = typeof elementIdOrRef === 'string' ? document.getElementById(elementIdOrRef) : elementIdOrRef;
    if (!el) {
      if (fallbackTextSummary) {
        await navigator.clipboard.writeText(fallbackTextSummary);
        return { success: true, mode: 'clipboard' };
      }
      return { success: false };
    }

    const canvas = await html2canvas(el, getSafeHtml2CanvasOptions({
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true
    }));

    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          if (fallbackTextSummary) {
            await navigator.clipboard.writeText(fallbackTextSummary);
            resolve({ success: true, mode: 'clipboard' });
          } else {
            resolve({ success: false });
          }
          return;
        }

        // 1. Try writing image blob directly to clipboard
        try {
          if (navigator.clipboard && window.ClipboardItem) {
            await navigator.clipboard.write([
              new ClipboardItem({
                'image/png': blob
              })
            ]);
            resolve({ success: true, mode: 'clipboard' });
            return;
          }
        } catch (clipErr) {
          console.warn('Image clipboard write restricted, triggering PNG file download fallback:', clipErr);
        }

        // 2. Fallback: Automatically download PNG file if clipboard write is blocked by iframe/browser security
        try {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          const cleanId = (typeof elementIdOrRef === 'string' ? elementIdOrRef : 'grafica').replace(/[^a-z0-9_-]/gi, '_');
          link.download = `${cleanId}_${new Date().toISOString().slice(0, 10)}.png`;
          link.href = url;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          resolve({ success: true, mode: 'download' });
        } catch (downloadErr) {
          console.error('PNG Download fallback failed:', downloadErr);
          if (fallbackTextSummary) {
            await navigator.clipboard.writeText(fallbackTextSummary);
            resolve({ success: true, mode: 'clipboard' });
          } else {
            resolve({ success: false });
          }
        }
      }, 'image/png');
    });
  } catch (err) {
    console.error('Failed to copy element as image:', err);
    if (fallbackTextSummary) {
      try {
        await navigator.clipboard.writeText(fallbackTextSummary);
        return { success: true, mode: 'clipboard' };
      } catch (e) {
        return { success: false };
      }
    }
    return { success: false };
  }
}
