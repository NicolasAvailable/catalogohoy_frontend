import { Injectable } from '@angular/core';
import { E } from '@shared/domain';
import {
  BaseProductPdfCatalogService,
  PdfCatalogImage,
  PdfCatalogPage,
  PdfCatalogParseResult,
} from '../domain';

// pdfjs-dist se carga con import() dinámico para no meter ~1MB en el bundle
// inicial: solo paga el costo quien entra al flujo de importar PDF.
type PdfJsModule = typeof import('pdfjs-dist');

const MAX_PAGES = 80;
const MAX_TEXT_PER_PAGE = 4000;
const MAX_IMAGES = 300;
/** Lado mayor del render de página: suficiente para leer empaques sin
 *  reventar memoria en catálogos largos. */
const RENDER_MAX_SIDE = 1600;
/** Recortes más chicos que esto (en px del render) son iconos/decoración. */
const MIN_CROP_SIDE = 72;
/** Un dibujo que cubre casi toda la página es un fondo/portada, no un producto. */
const MAX_PAGE_AREA_RATIO = 0.7;
/** Lado mayor del JPEG resultante por recorte (misma convención del uploader). */
const CROP_MAX_SIDE = 1200;

/** Matriz 2D estilo canvas: [a, b, c, d, e, f]. */
type Matrix = [number, number, number, number, number, number];

function matMul(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function applyPoint(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

@Injectable({ providedIn: 'root' })
export class PdfCatalogService implements BaseProductPdfCatalogService {
  private pdfjsPromise: Promise<PdfJsModule> | null = null;

  /** Carga pdf.js una sola vez y configura su worker. El worker se copia como
   *  asset del app (ver project.json: pdf.worker.min.mjs de pdfjs-dist) porque
   *  el builder de Angular no resuelve new URL() hacia node_modules. */
  private loadPdfJs(): Promise<PdfJsModule> {
    if (!this.pdfjsPromise) {
      // zone.js reemplaza window.Promise por ZoneAwarePromise, que no trae
      // Promise.try (ES2025); pdf.js v6 lo usa en el canal de mensajes con su
      // worker y revienta con TypeError aunque el navegador sí lo soporte.
      const P = Promise as unknown as {
        try?: (fn: (...a: unknown[]) => unknown, ...args: unknown[]) => Promise<unknown>;
      };
      if (typeof P.try !== 'function') {
        P.try = (fn, ...args) =>
          new Promise((resolve) => resolve(fn(...args)));
      }
      this.pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        }
        return pdfjs;
      });
    }
    return this.pdfjsPromise;
  }

  public async parse(
    file: File,
    onProgress?: (done: number, total: number) => void
  ): Promise<E.Either<Error, PdfCatalogParseResult>> {
    try {
      const pdfjs = await this.loadPdfJs();
      const data = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data });
      const doc = await loadingTask.promise;

      if (doc.numPages > MAX_PAGES) {
        return E.left(
          new Error(
            `El PDF tiene ${doc.numPages} páginas; el máximo es ${MAX_PAGES}.`
          )
        );
      }

      const pages: PdfCatalogPage[] = [];
      const images: PdfCatalogImage[] = [];

      for (let p = 1; p <= doc.numPages; p++) {
        const page = (await doc.getPage(p)) as unknown as PdfPageLike;

        const text = await this.extractText(page);
        if (text.trim()) {
          pages.push({ page: p, text: text.slice(0, MAX_TEXT_PER_PAGE) });
        }

        if (images.length < MAX_IMAGES) {
          const crops = await this.extractImages(pdfjs, page, p);
          images.push(...crops.slice(0, MAX_IMAGES - images.length));
        }

        page.cleanup();
        onProgress?.(p, doc.numPages);
      }

      await loadingTask.destroy();

      if (!pages.length) {
        return E.left(
          new Error(
            'El PDF no tiene texto legible (¿es un escaneo?). Prueba con un PDF exportado digitalmente.'
          )
        );
      }
      return E.right({ pages, images });
    } catch (e) {
      console.error('[PDF Catalog] parse error:', e);
      return E.left(
        new Error('No se pudo leer el PDF. Verifica que el archivo no esté dañado.')
      );
    }
  }

  /** Reconstruye el texto agrupando los items por renglón (coordenada Y) y
   *  ordenando por X — el orden crudo de un PDF multi-columna es inservible
   *  para la IA sin esto. */
  private async extractText(page: PdfPageLike): Promise<string> {
    const content = await page.getTextContent();
    const rows = new Map<number, { x: number; str: string }[]>();

    for (const item of content.items as {
      str?: string;
      transform?: number[];
    }[]) {
      if (!item.str?.trim() || !item.transform) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      // Bucket de 4pt: items del mismo renglón caen juntos aunque la Y varíe
      // por decimales.
      const key = Math.round(y / 4);
      const row = rows.get(key) ?? [];
      row.push({ x, str: item.str });
      rows.set(key, row);
    }

    return [...rows.entries()]
      .sort((a, b) => b[0] - a[0]) // Y crece hacia arriba en PDF
      .map(([, items]) =>
        items
          .sort((a, b) => a.x - b.x)
          .map((i) => i.str)
          .join(' ')
      )
      .join('\n');
  }

  /** Renderiza la página y recorta cada imagen dibujada (rastreando la matriz
   *  de transformación del operator list). Recortar del render — en vez de
   *  extraer los objetos crudos — compone gratis las máscaras de transparencia
   *  y respeta la orientación. */
  private async extractImages(
    pdfjs: PdfJsModule,
    page: PdfPageLike,
    pageNumber: number
  ): Promise<PdfCatalogImage[]> {
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(
      2,
      RENDER_MAX_SIDE / Math.max(baseViewport.width, baseViewport.height)
    );
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    if (!canvas.getContext('2d')) return [];

    await page.render({ canvas, viewport }).promise;

    // Rects de cada paintImageXObject en coordenadas del canvas.
    const OPS = pdfjs.OPS;
    const opList = await page.getOperatorList();
    let ctm = viewport.transform.slice() as Matrix;
    const stack: Matrix[] = [];
    const rects: { x: number; y: number; w: number; h: number }[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      if (fn === OPS.save) {
        stack.push(ctm.slice() as Matrix);
      } else if (fn === OPS.restore) {
        ctm = stack.pop() ?? (viewport.transform.slice() as Matrix);
      } else if (fn === OPS.transform) {
        ctm = matMul(ctm, opList.argsArray[i] as Matrix);
      } else if (
        fn === OPS.paintImageXObject ||
        fn === OPS.paintImageXObjectRepeat
      ) {
        // La imagen se dibuja en el cuadrado unitario transformado por la CTM.
        const corners = [
          applyPoint(ctm, 0, 0),
          applyPoint(ctm, 1, 0),
          applyPoint(ctm, 0, 1),
          applyPoint(ctm, 1, 1),
        ];
        const xs = corners.map((c) => c[0]);
        const ys = corners.map((c) => c[1]);
        const x = Math.max(0, Math.min(...xs));
        const y = Math.max(0, Math.min(...ys));
        const w = Math.min(canvas.width, Math.max(...xs)) - x;
        const h = Math.min(canvas.height, Math.max(...ys)) - y;
        if (w < MIN_CROP_SIDE || h < MIN_CROP_SIDE) continue;
        if (w * h > canvas.width * canvas.height * MAX_PAGE_AREA_RATIO) {
          continue;
        }
        const key = [x, y, w, h].map((v) => Math.round(v / 4)).join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        rects.push({ x, y, w, h });
      }
    }

    const crops: PdfCatalogImage[] = [];
    for (const rect of rects) {
      const blob = await this.cropToJpeg(canvas, rect);
      if (blob) {
        crops.push({
          page: pageNumber,
          blob,
          width: Math.round(rect.w),
          height: Math.round(rect.h),
        });
      }
    }

    canvas.width = 0; // liberar memoria del render
    return crops;
  }

  private cropToJpeg(
    source: HTMLCanvasElement,
    rect: { x: number; y: number; w: number; h: number }
  ): Promise<Blob | null> {
    const scale = Math.min(1, CROP_MAX_SIDE / Math.max(rect.w, rect.h));
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(rect.w * scale));
    out.height = Math.max(1, Math.round(rect.h * scale));
    const ctx = out.getContext('2d');
    if (!ctx) return Promise.resolve(null);
    // Fondo blanco por si el recorte cae sobre zona transparente del render.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(
      source,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      0,
      0,
      out.width,
      out.height
    );
    return new Promise((resolve) =>
      out.toBlob((b) => resolve(b), 'image/jpeg', 0.85)
    );
  }
}

/** Subconjunto tipado de PDFPageProxy que usamos (evita depender de los tipos
 *  internos de pdfjs-dist en la firma pública del servicio). */
interface PdfPageLike {
  getTextContent(): Promise<{ items: unknown[] }>;
  getViewport(opts: { scale: number }): {
    width: number;
    height: number;
    transform: number[];
  };
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[] }>;
  render(opts: { canvas: HTMLCanvasElement; viewport: unknown }): {
    promise: Promise<void>;
  };
  cleanup(): void;
}
