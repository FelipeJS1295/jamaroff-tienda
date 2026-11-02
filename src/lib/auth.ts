import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { and, eq, gt, sql } from 'drizzle-orm';
import { db, schema } from '@/db';

const COOKIE = 'jam_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 días

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET debe tener al menos 32 caracteres');
    return new TextEncoder().encode('dev-secret-solo-para-desarrollo-local-0000');
  }
  return new TextEncoder().encode(s);
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function startSession(userId: number) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && (process.env.SITE_URL ?? '').startsWith('https'),
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const uid = Number(payload.uid);
    if (!uid) return null;
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, uid)).limit(1);
    return user ?? null;
  } catch {
    return null;
  }
}

export async function requireUser(next = '/cuenta') {
  const user = await getCurrentUser();
  if (!user) redirect(`/cuenta/ingresar?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') redirect('/admin/ingresar');
  return user;
}

export function isApprovedWholesale(user: { wholesaleStatus: string } | null | undefined) {
  return user?.wholesaleStatus === 'approved';
}

/** Bloquea tras 8 intentos fallidos en 15 minutos para el mismo correo o IP */
export async function tooManyAttempts(email: string) {
  const ip = await clientIp();
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.loginAttempts)
    .where(and(
      eq(schema.loginAttempts.success, false),
      gt(schema.loginAttempts.createdAt, since),
      sql`(${schema.loginAttempts.email} = ${email} or ${schema.loginAttempts.ip} = ${ip})`,
    ));
  return (row?.n ?? 0) >= 8;
}

export async function recordAttempt(email: string, success: boolean) {
  const ip = await clientIp();
  await db.insert(schema.loginAttempts).values({ email, ip, success });
}

async function clientIp() {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? '').trim() || null;
}
