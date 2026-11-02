import ExcelJS from 'exceljs';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return new Response('No autorizado', { status: 401 });
  const rows = await db.select({ p: schema.products, cat: schema.categories.name }).from(schema.products)
    .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id)).orderBy(asc(schema.products.id));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Productos');
  ws.columns = [
    { header: 'SKU', key: 'sku', width: 16 }, { header: 'Nombre', key: 'name', width: 34 }, { header: 'Categoria', key: 'cat', width: 20 },
    { header: 'Precio', key: 'price', width: 12 }, { header: 'Precio antes', key: 'compare', width: 12 }, { header: 'Precio mayorista', key: 'ws', width: 15 },
    { header: 'Minimo mayorista', key: 'wsMin', width: 15 }, { header: 'Modalidad', key: 'mode', width: 11 }, { header: 'Stock', key: 'stock', width: 8 },
    { header: 'Dias fabricacion', key: 'lead', width: 15 }, { header: 'Material', key: 'material', width: 12 }, { header: 'Color', key: 'color', width: 12 },
    { header: 'Medidas', key: 'dims', width: 20 }, { header: 'Bultos (largoxanchoxalto cm; kg)', key: 'pk', width: 34 },
    { header: 'Activo', key: 'active', width: 8 }, { header: 'Descripcion', key: 'desc', width: 60 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  for (const { p, cat } of rows) {
    ws.addRow({
      sku: p.sku ?? '', name: p.name, cat: cat ?? '', price: p.price, compare: p.compareAtPrice ?? '', ws: p.wholesalePrice ?? '',
      wsMin: p.wholesaleMinQty, mode: p.mode, stock: p.stock, lead: p.leadTimeDays ?? '', material: p.material ?? '', color: p.color ?? '',
      dims: p.dimensions ?? '', pk: p.packages.map((x) => `${x.largo}x${x.ancho}x${x.alto},${x.peso}`).join('; '), active: p.active ? 'si' : 'no', desc: p.description,
    });
  }
  if (!rows.length) ws.addRow({ sku: 'JAM-001', name: 'Sofá de ejemplo', cat: 'Sofás', price: 599990, mode: 'stock', stock: 3, pk: '200x95x85,50', active: 'si' });
  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': 'attachment; filename="productos-jamaroff.xlsx"',
    },
  });
}
