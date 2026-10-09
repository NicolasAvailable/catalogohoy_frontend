import * as XLSX from 'xlsx';
import { OrderExcelService } from './order-excel.service';

/** Construye un File .xlsx en memoria desde una matriz (array of arrays). */
function makeFile(aoa: unknown[][]): File {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
  return new File([buf as unknown as BlobPart], 'pedido.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('OrderExcelService.parseOrderExcel', () => {
  const service = new OrderExcelService();

  it('detecta el encabezado tras el preámbulo, mapea columnas y toma solo PEDIDO>0', async () => {
    const aoa = [
      ['LISTA DE PRECIOS SOLO PARA PAGOS EN $$', '', '', ''],
      ['CLIENTE: Juan Pérez', '', 'TELF: 04141234567', ''],
      ['COD', 'DESCRIPCION', 'PRECIO DE VENTA $$', 'PEDIDO'],
      ['FOX-001', 'ACEITE 20W-50', 8.1, 3],
      ['FOX-002', 'FILTRO', 2.5, ''], // sin pedido → se ignora
      ['FOX-003', 'BUJIA', '1,5', '2'], // coma decimal + cantidad string
    ];
    const result = await service.parseOrderExcel(makeFile(aoa));
    const parsed = result.fold(
      () => null,
      (r) => r
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.lines).toEqual([
      { sku: 'FOX-001', name: 'ACEITE 20W-50', price: 8.1, quantity: 3 },
      { sku: 'FOX-003', name: 'BUJIA', price: 1.5, quantity: 2 },
    ]);
    expect(parsed!.client.name).toBe('Juan Pérez');
    expect(parsed!.client.phone).toBe('04141234567');
    expect(parsed!.totalRows).toBe(3);
  });

  it('descarta los placeholders del cliente ("Por favor, rellene")', async () => {
    const aoa = [
      ['CLIENTE: Por favor, rellene', 'TELF: Por favor, rellene'],
      ['Producto', 'Precio', 'Cantidad'],
      ['Item A', 5, 1],
    ];
    const parsed = (await service.parseOrderExcel(makeFile(aoa))).fold(
      () => null,
      (r) => r
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.client.name).toBeUndefined();
    expect(parsed!.client.phone).toBeUndefined();
    expect(parsed!.lines.length).toBe(1);
  });

  it('Left si no hay ninguna línea con cantidad > 0', async () => {
    const aoa = [
      ['COD', 'DESCRIPCION', 'PRECIO', 'PEDIDO'],
      ['A', 'X', 5, 0],
      ['B', 'Y', 3, ''],
    ];
    const result = await service.parseOrderExcel(makeFile(aoa));
    expect(result.isLeft()).toBe(true);
  });

  it('Left si no encuentra columna de producto y de cantidad', async () => {
    const aoa = [
      ['Foo', 'Bar'],
      ['a', 'b'],
    ];
    const result = await service.parseOrderExcel(makeFile(aoa));
    expect(result.isLeft()).toBe(true);
  });

  it('parsea precios con separador de miles de cualquier locale', async () => {
    const aoa = [
      ['Producto', 'Precio', 'Pedido'],
      ['A', '1.234,56', 1], // VE/ES: punto=miles, coma=decimal
      ['B', '1,234.56', 1], // US
      ['C', '45.000', 1], // COP: cuarenta y cinco mil
      ['D', '1,5', 1], // simple con coma
    ];
    const parsed = (await service.parseOrderExcel(makeFile(aoa))).fold(
      () => null,
      (r) => r
    );
    expect(parsed!.lines.map((l) => l.price)).toEqual([1234.56, 1234.56, 45000, 1.5]);
  });

  it('prioriza la columna PEDIDO sobre CANTIDAD (stock)', async () => {
    const aoa = [
      ['COD', 'DESCRIPCION', 'CANTIDAD', 'PRECIO', 'PEDIDO'],
      ['X-1', 'ITEM', 999, 10, 4], // CANTIDAD(stock)=999, PEDIDO=4
    ];
    const parsed = (await service.parseOrderExcel(makeFile(aoa))).fold(
      () => null,
      (r) => r
    );
    expect(parsed!.lines[0].quantity).toBe(4); // no 999
  });

  it('captura el cliente cuando etiqueta y valor están en celdas separadas', async () => {
    const aoa = [
      ['CLIENTE', 'Juan Pérez', '', ''],
      ['TELF', '04141234567', '', ''],
      ['Producto', 'Precio', 'Cantidad', ''],
      ['Item A', 5, 1, ''],
    ];
    const parsed = (await service.parseOrderExcel(makeFile(aoa))).fold(
      () => null,
      (r) => r
    );
    expect(parsed!.client.name).toBe('Juan Pérez');
    expect(parsed!.client.phone).toBe('04141234567');
  });

  it('mapea la columna de precio principal, no la de descuento/contado', async () => {
    const aoa = [
      ['COD', 'DESCRIPCION', 'PRECIO DE VENTA $$', 'PEDIDO', 'PAGO AL CONTADO 5% DCSTO'],
      ['FOX-1', 'ITEM', 10, 1, 9.5],
    ];
    const parsed = (await service.parseOrderExcel(makeFile(aoa))).fold(
      () => null,
      (r) => r
    );
    expect(parsed!.lines[0].price).toBe(10); // no 9.5
  });
});
