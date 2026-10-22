/**
 * Exports an HTML element to a downloadable PDF file using html2canvas and jsPDF.
 * Supports multi-page splitting for long reports.
 *
 * html2canvas + jsPDF are ~450 kB together and are only ever needed after the
 * user taps "Export", so they are pulled in with a dynamic import. That keeps
 * them out of the first-paint bundle; callers already `await` this function.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  filename: string,
  onProgress?: (step: string) => void
): Promise<void> {
  try {
    if (onProgress) onProgress('Đang tải công cụ xuất PDF...');

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    if (onProgress) onProgress('Đang chuẩn bị trang in...');

    // Small delay to ensure all images and fonts are rendered
    await new Promise((resolve) => setTimeout(resolve, 180));

    if (onProgress) onProgress('Đang xử lý hình ảnh và văn bản...');
    const canvas = await html2canvas(element, {
      scale: 2, // High resolution for crisp print quality
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      scrollY: -window.scrollY,
      scrollX: -window.scrollX,
      windowWidth: element.scrollWidth || 1024,
    });

    if (onProgress) onProgress('Đang định dạng các trang PDF...');

    // Standard A4 dimensions in mm
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

    // Margins in mm
    const margin = 8;
    const contentWidth = pdfWidth - margin * 2; // 194mm
    const contentHeightPerPage = pdfHeight - margin * 2 - 8; // Leave 8mm at bottom for page numbers

    // Pixel ratio
    const pxPerMm = canvas.width / contentWidth;
    const pageHeightPx = Math.floor(contentHeightPerPage * pxPerMm);

    const totalPages = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) {
        pdf.addPage();
      }

      const sourceY = page * pageHeightPx;
      const sourceHeight = Math.min(pageHeightPx, canvas.height - sourceY);

      // Create a slice canvas for this page
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sourceHeight;
      const ctx = pageCanvas.getContext('2d');

      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(
          canvas,
          0,
          sourceY,
          canvas.width,
          sourceHeight,
          0,
          0,
          canvas.width,
          sourceHeight
        );

        const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
        const sliceHeightMm = sourceHeight / pxPerMm;

        pdf.addImage(pageImgData, 'JPEG', margin, margin, contentWidth, sliceHeightMm, undefined, 'FAST');

        // Add page footer with page number
        pdf.setFontSize(8);
        pdf.setTextColor(140, 140, 140);
        pdf.text(
          `Trang ${page + 1} / ${totalPages} • Oder Checklist System`,
          pdfWidth / 2,
          pdfHeight - 4,
          { align: 'center' }
        );
      }
    }

    if (onProgress) onProgress('Đang hoàn thiện file...');
    const cleanFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);

    if (onProgress) onProgress('Hoàn tất tải file PDF!');
  } catch (error) {
    console.error('Lỗi khi xuất PDF:', error);
    throw error;
  }
}

/**
 * Downloads a standalone HTML report file
 */
export function downloadHtmlReport(filename: string, title: string, contentHtml: string): void {
  const fullHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; background: #f8fafc; }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
    th { background: #f1f5f9; font-weight: 700; color: #334155; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .text-emerald { color: #059669; }
    .text-rose { color: #e11d48; }
    .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 16px 0; }
    .card { background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .card-title { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; }
    .card-val { font-size: 16px; font-weight: bold; margin-top: 4px; }
    .signatures { display: flex; justify-content: space-between; margin-top: 40px; text-align: center; font-size: 13px; }
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; border: none; padding: 0; width: 100%; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="container">
    ${contentHtml}
  </div>
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.html') ? filename : `${filename}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
