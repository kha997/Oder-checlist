import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Exports an HTML element to a downloadable PDF file using html2canvas and jsPDF.
 * Supports multi-page splitting for long reports.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  filename: string,
  onProgress?: (step: string) => void
): Promise<void> {
  try {
    if (onProgress) onProgress('Đang chuẩn bị trang in...');

    // Small delay to ensure all images and fonts are rendered
    await new Promise((resolve) => setTimeout(resolve, 150));

    if (onProgress) onProgress('Đang xử lý hình ảnh và văn bản...');
    const canvas = await html2canvas(element, {
      scale: 2, // High resolution for crisp print quality
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    if (onProgress) onProgress('Đang đóng gói file PDF...');
    const imgData = canvas.toDataURL('image/jpeg', 0.95);

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
    const contentWidth = pdfWidth - margin * 2;
    const contentHeight = (canvas.height * contentWidth) / canvas.width;

    let heightLeft = contentHeight;
    let position = margin;
    let page = 1;

    // First page
    pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, contentHeight, undefined, 'FAST');
    heightLeft -= (pdfHeight - margin * 2);

    // Additional pages if report is long
    while (heightLeft > 0) {
      position = -(page * (pdfHeight - margin * 2)) + margin;
      pdf.addPage();
      page++;
      pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, contentHeight, undefined, 'FAST');
      heightLeft -= (pdfHeight - margin * 2);
    }

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
