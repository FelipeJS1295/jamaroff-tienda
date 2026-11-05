import { createHash } from 'node:crypto';
import { db, schema } from '@/db';
import { getCurrentUser } from '@/lib/auth';
import { BOT_UA, deviceOf, sourceOf } from '@/lib/visits';

// Registra una página vista. No usa cookies ni guarda la IP: el visitante es un código
// que se arma con IP + navegador + día, así que al día siguiente es otro (no se le sigue).
export async function POST(req: Request) {
  const done = new Response(null, { status: 204 });
  try {
    const ua = req.headers.get('user-agent') ?? '';
    if (!ua || BOT_UA.test(ua)) return done;
    const body = (await req.json().catch(() => null)) as { path?: unknown; ref?: unknown } | null;
    const path = typeof body?.path === 'string' ? body.path : '';
    if (!path.startsWith('/') || path.length > 300 || /^\/(admin|api|uploads|_next)(\/|$)/.test(path)) return done;
    // Las visitas del equipo (administradores con sesión) no cuentan
    const user = await getCurrentUser().catch(() => null);
    if (user?.role === 'admin') return done;

    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || '';
    const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
    const visitor = createHash('sha256').update(`${ip}|${ua}|${day}|${process.env.AUTH_SECRET ?? ''}`).digest('hex').slice(0, 16);
    const site = process.env.SITE_URL ?? 'http://localhost:3000';
    await db.insert(schema.pageViews).values({
      path: path.split('?')[0].split('#')[0].slice(0, 200),
      visitor,
      source: sourceOf(typeof body?.ref === 'string' ? body.ref : null, site),
      device: deviceOf(ua),
    });
  } catch {
    /* una visita que no se pudo guardar no debe molestar al cliente */
  }
  return done;
}
