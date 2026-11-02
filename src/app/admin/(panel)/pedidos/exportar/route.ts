import ExcelJS from 'exceljs';
import { and, desc, eq, ilike, inArray, or, type SQL } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getCurrentUser } from '@/lib/auth';
import { ORDER_STATUS_LABEL } from '@/lib/format';

export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return new Response('No autorizado', { status: 401 });
  const sp = new URL(req.url).searchParams;
  const { orders } = schema;
  const where: SQL[] = [];
  const estado = sp.get('estado') ?? 'todos';
  if (estado === 'por-despachar') where.push(inArray(orders.status, ['pagado', 'listo_despacho']));
  else if (estado !== 'todos') where.push(eq(orders.status, estado as typeof orders.status.enumValues[number]));
  if (sp.get('tipo') === 'mayorista') where.push(eq(orders.isWholesale, true));
  const q = sp.get('q');
  if (q) {
    const t = `%${q.replace(/[%_]/g, '')}%`;
    where.push(or(ilike(orders.number, t), ilike(orders.name, t), ilike(orders.email, t))!);
  }
  const rows = await db.select().from(orders).where(where.length ? and(...where) : undefined).orderBy(desc(orders.createdAt)).limit(5000);
  const items = rows.length ? await db.select().from(schema.orderItems).where(inArray(schema.orderItems.orderId, rows.map((r) => r.id))) : [];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Pedidos');
  ws.columns = [
    { header: 'Pedido', key: 'number', width: 12 }, { header: 'Fecha', key: 'date', width: 18 }, { header: 'Estado', key: 'status', width: 18 },
    { header: 'Pago', key: 'pay', width: 22 }, { header: 'Cliente', key: 'name', width: 24 }, { header: 'Correo', key: 'email', width: 28 },
    { header: 'Teléfono', key: 'phone', width: 16 }, { header: 'Mayorista', key: 'ws', width: 10 }, { header: 'Entrega', key: 'delivery', width: 40 },
    { header: 'Productos', key: 'items', width: 60 }, { header: 'Subtotal', key: 'subtotal', width: 12 }, { header: 'Descuento', key: 'discount', width: 12 },
    { header: 'Despacho', key: 'shipping', width: 12 }, { header: 'Total', key: 'total', width: 12 }, { header: 'Factura', key: 'invoice', width: 40 },
    { header: 'Transporte', key: 'carrier', width: 18 }, { header: 'Seguimiento', key: 'tracking', width: 18 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const o of rows) {
    ws.addRow({
      number: o.number,
      date: o.createdAt.toLocaleString('es-CL', { timeZone: 'America/Santiago' }),
      status: ORDER_STATUS_LABEL[o.status],
      pay: `${o.paymentMethod} · ${o.paymentStatus}`,
      name: o.name, email: o.email, phone: o.phone, ws: o.isWholesale ? 'Sí' : '',
      delivery: o.deliveryMethod === 'retiro' ? 'Retiro' : `${o.address ?? ''} ${o.addressExtra ?? ''}, ${o.comuna}, ${o.region}`,
      items: items.filter((i) => i.orderId === o.id).map((i) => `${i.quantity}× ${i.name}${i.variantName ? ` (${i.variantName})` : ''}${i.mode === 'pedido' ? ' [a pedido]' : ''}`).join('; '),
      subtotal: o.subtotal, discount: o.discount, shipping: o.shippingToQuote ? 'A cotizar' : o.shippingCost, total: o.total,
      invoice: o.invoice ? `${o.invoice.razonSocial} · ${o.invoice.rut} · ${o.invoice.giro}` : '',
      carrier: o.carrier ?? '', tracking: o.trackingCode ?? '',
    });
  }
  for (const k of ['subtotal', 'discount', 'shipping', 'total']) ws.getColumn(k).numFmt = '"$"#,##0';
  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="pedidos-jamaroff-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
