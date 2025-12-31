import { jsPDF } from 'jspdf';
import * as QRCode from 'qrcode';

export const qr = {
  to: {
    pdf: async (url: string, filename: string, title = 'Mi Catálogo') => {
      try {
        // Generate QR code as a data URL (PNG)
        const qrDataUrl = await QRCode.toDataURL(url, {
          width: 512,
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

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // Add Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.setTextColor(31, 41, 55); // grey-800
        doc.text(title, pageWidth / 2, 40, { align: 'center' });

        // Add Subtitle (the URL)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(107, 114, 128); // grey-500
        doc.text(url, pageWidth / 2, 50, { align: 'center' });

        // Add QR Image
        const qrSize = 100; // 100mm
        const xPos = (pageWidth - qrSize) / 2;
        const yPos = (pageHeight - qrSize) / 2;
        doc.addImage(qrDataUrl, 'PNG', xPos, yPos, qrSize, qrSize);

        // Add Footer
        doc.setFontSize(10);
        doc.text(
          'Escaneá para ver el catálogo',
          pageWidth / 2,
          yPos + qrSize + 15,
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
