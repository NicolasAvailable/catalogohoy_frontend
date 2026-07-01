import { jsPDF } from 'jspdf';
import * as QRCode from 'qrcode';

export const qr = {
  to: {
    pdf: async (url: string, filename: string, title = 'Mi Catálogo') => {
      try {
        // Alta resolución para que el QR quede nítido impreso a gran tamaño.
        const qrDataUrl = await QRCode.toDataURL(url, {
          width: 1024,
          margin: 2,
          color: {
            dark: '#000000', // grey-800
            light: '#ffffff',
          },
        });

        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
        const pageHeight = doc.internal.pageSize.getHeight(); // 297mm

        // Título (nombre del negocio) arriba. Se ajusta a varias líneas si es
        // largo, para no desbordar el ancho.
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.setTextColor(31, 41, 55); // grey-800
        const titleLines = doc.splitTextToSize(title, pageWidth - 30);
        doc.text(titleLines, pageWidth / 2, 24, { align: 'center' });
        const titleBottom = 24 + titleLines.length * 9;

        // Subtítulo (la URL).
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(107, 114, 128); // grey-500
        doc.text(url, pageWidth / 2, titleBottom + 4, { align: 'center' });

        // QR grande: ocupa casi todo el ancho de la hoja (margen mínimo) para
        // que se pueda imprimir y usar tal cual, sin recortar el papel.
        const margin = 10;
        const qrSize = pageWidth - margin * 2; // 190mm (~90% del ancho)
        const xPos = margin;
        // Centrado vertical entre el encabezado y el pie.
        const headerBottom = titleBottom + 12;
        const footerHeight = 20;
        const availableV = pageHeight - headerBottom - footerHeight;
        const yPos = headerBottom + Math.max(0, (availableV - qrSize) / 2);
        doc.addImage(qrDataUrl, 'PNG', xPos, yPos, qrSize, qrSize);

        // Pie: instrucción para escanear.
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(31, 41, 55);
        doc.text(
          'Escaneá para ver el catálogo',
          pageWidth / 2,
          Math.min(yPos + qrSize + 12, pageHeight - 8),
          { align: 'center' }
        );

        // Save the PDF
        doc.save(`${filename}.pdf`);
      } catch (err) {
        console.error('Error generating QR PDF:', err);
        throw err;
      }
    },
  },
};
