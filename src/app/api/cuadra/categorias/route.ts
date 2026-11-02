import { asc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { cuadraAuth } from '@/lib/cuadra';

export const dynamic = 'force-dynamic';

/** GET /api/cuadra/categorias · categorías de la tienda (para elegir al publicar) */
export async function GET(req: Request) {
  const denied = cuadraAuth(req);
  if (denied) return denied;
  const rows = await db.select({ id: schema.categories.id, name: schema.categories.name }).from(schema.categories).orderBy(asc(schema.categories.position), asc(schema.categories.name));
  return Response.json({ categories: rows });
}
