import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { cuadraAuth, siteUrl } from '@/lib/cuadra';

export const dynamic = 'force-dynamic';

/** GET /api/cuadra · Cuadra prueba la conexión */
export async function GET(req: Request) {
  const denied = cuadraAuth(req);
  if (denied) return denied;
  const [c] = (await db.execute(sql`
    select (select count(*) from products)::int as products,
           (select count(*) from orders where payment_status = 'pagado')::int as orders
  `)) as unknown as { products: number; orders: number }[];
  return Response.json({ ok: true, store: 'Jamaroff', siteUrl: siteUrl(), products: c.products, paidOrders: c.orders });
}
