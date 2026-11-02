import { NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import { priceCart, sanitizeLines } from '@/lib/cart';
import { getCurrentUser } from '@/lib/auth';
import { packagesVolume, quoteShipping } from '@/lib/shipping';
import { isValidComuna } from '@/lib/chile';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const region = String(body.region ?? '');
  const comuna = String(body.comuna ?? '');
  if (!isValidComuna(region, comuna)) return NextResponse.json({ error: 'Elige una región y comuna válidas' }, { status: 400 });
  const lines = sanitizeLines(body.lines);
  if (!lines.length) return NextResponse.json({ error: 'Carrito vacío' }, { status: 400 });

  let volume: number;
  let subtotal: number;
  if (body.estimate) {
    // Estimación desde la ficha: solo volumen de los productos indicados
    const ps = await db.select().from(schema.products).where(inArray(schema.products.id, lines.map((l) => l.productId)));
    volume = lines.reduce((a, l) => a + packagesVolume(ps.find((p) => p.id === l.productId)?.packages ?? [], l.qty), 0);
    subtotal = lines.reduce((a, l) => a + (ps.find((p) => p.id === l.productId)?.price ?? 0) * l.qty, 0);
  } else {
    const cart = await priceCart(lines, await getCurrentUser());
    volume = cart.volume;
    subtotal = cart.subtotal;
  }
  const zones = await db.select().from(schema.shippingZones);
  const quote = quoteShipping(zones, region, comuna, Math.round(volume * 100) / 100, subtotal);
  return NextResponse.json({ quote });
}
