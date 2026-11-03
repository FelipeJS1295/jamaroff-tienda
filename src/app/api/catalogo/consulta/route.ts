import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { mailAdminNotice } from '@/lib/mail';

const Body = z.object({
  productId: z.number().int().positive().optional(),
  catalog: z.string().max(80).optional(),
  name: z.string().trim().min(2, 'Escribe tu nombre').max(120),
  email: z.string().trim().email('Revisa tu correo').max(160),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(5, 'Escribe tu consulta').max(2000),
  website: z.string().optional(), // trampa anti-spam: los humanos la dejan vacía
});

/** Consulta de precio desde el catálogo digital: queda en Admin › Cotizaciones y mensajes y avisa por correo */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos incompletos' }, { status: 400 });
  const d = parsed.data;
  if (d.website) return NextResponse.json({ ok: true });
  const [prod] = d.productId ? await db.select({ id: schema.products.id, name: schema.products.name }).from(schema.products).where(eq(schema.products.id, d.productId)).limit(1) : [];
  const origin = d.catalog ? ` (desde ${d.catalog})` : '';
  await db.insert(schema.quoteRequests).values({
    kind: 'contacto',
    name: d.name,
    email: d.email,
    phone: d.phone || null,
    message: `${prod ? `Consulta de precio: ${prod.name}${origin}\n\n` : ''}${d.message}`,
    productId: prod?.id ?? null,
  });
  await mailAdminNotice(prod ? `Consulta de precio: ${prod.name}` : 'Consulta desde el catálogo', {
    Producto: prod?.name, Catálogo: d.catalog, Nombre: d.name, Correo: d.email, Teléfono: d.phone, Mensaje: d.message,
  }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
