'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { endSession, getCurrentUser, hashPassword, recordAttempt, startSession, tooManyAttempts, verifyPassword } from '@/lib/auth';
import { validRut } from '@/lib/format';
import { mailAdminNotice } from '@/lib/mail';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

function safeNext(next: string, fallback = '/cuenta') {
  return next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

function back(path: string, error: string, extra: Record<string, string> = {}): never {
  const p = new URLSearchParams({ error, ...extra });
  redirect(`${path}?${p.toString()}`);
}

export async function loginAction(fd: FormData) {
  const email = str(fd, 'email').toLowerCase();
  const password = str(fd, 'password');
  const next = safeNext(str(fd, 'next'));
  if (await tooManyAttempts(email)) back('/cuenta/ingresar', 'Demasiados intentos. Espera 15 minutos.', { next });
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  const ok = !!user && (await verifyPassword(password, user.passwordHash));
  await recordAttempt(email, ok);
  if (!ok) back('/cuenta/ingresar', 'Correo o contraseña incorrectos', { next });
  await startSession(user!.id);
  redirect(next);
}

const Register = z.object({
  name: z.string().trim().min(2, 'Ingresa tu nombre').max(120),
  email: z.string().trim().toLowerCase().email('Correo no válido'),
  phone: z.string().trim().max(30).optional(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(200),
});

export async function registerAction(fd: FormData) {
  const next = safeNext(str(fd, 'next'));
  const parsed = Register.safeParse({ name: str(fd, 'name'), email: str(fd, 'email'), phone: str(fd, 'phone') || undefined, password: str(fd, 'password') });
  if (!parsed.success) back('/cuenta/registro', parsed.error.issues[0].message, { next });
  const d = parsed.data!;
  const [exists] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, d.email)).limit(1);
  if (exists) back('/cuenta/registro', 'Ya existe una cuenta con ese correo. Ingresa con tu contraseña.', { next });
  const [u] = await db.insert(schema.users).values({ name: d.name, email: d.email, phone: d.phone ?? null, passwordHash: await hashPassword(d.password) }).returning();
  // Asocia pedidos anteriores hechos como invitado con el mismo correo
  await db.update(schema.orders).set({ userId: u.id }).where(eq(schema.orders.email, d.email));
  await startSession(u.id);
  redirect(next);
}

export async function logoutAction() {
  await endSession();
  redirect('/');
}

const Wholesale = z.object({
  companyName: z.string().trim().min(2, 'Ingresa la razón social').max(160),
  companyRut: z.string().trim().min(8, 'Ingresa el RUT de la empresa').max(15),
  companyGiro: z.string().trim().min(2, 'Ingresa el giro').max(160),
  phone: z.string().trim().min(8, 'Ingresa un teléfono').max(30),
  message: z.string().trim().max(1500).optional(),
});

/** Solicitud mayorista: crea la cuenta si no existe y la deja pendiente de aprobación */
export async function wholesaleApplyAction(fd: FormData) {
  const parsed = Wholesale.safeParse({
    companyName: str(fd, 'companyName'), companyRut: str(fd, 'companyRut'), companyGiro: str(fd, 'companyGiro'),
    phone: str(fd, 'phone'), message: str(fd, 'message') || undefined,
  });
  if (!parsed.success) back('/mayoristas', parsed.error.issues[0].message);
  const d = parsed.data!;
  if (!validRut(d.companyRut)) back('/mayoristas', 'El RUT de la empresa no es válido');

  let user = await getCurrentUser();
  if (!user) {
    const reg = Register.safeParse({ name: str(fd, 'name'), email: str(fd, 'email'), phone: d.phone, password: str(fd, 'password') });
    if (!reg.success) back('/mayoristas', reg.error.issues[0].message);
    const r = reg.data!;
    const [exists] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, r.email)).limit(1);
    if (exists) back('/mayoristas', 'Ya existe una cuenta con ese correo. Ingresa primero y luego envía la solicitud.');
    [user] = await db.insert(schema.users).values({ name: r.name, email: r.email, phone: r.phone, passwordHash: await hashPassword(r.password) }).returning();
    await startSession(user.id);
  }
  if (user.wholesaleStatus === 'approved') redirect('/cuenta');

  await db.update(schema.users).set({
    wholesaleStatus: 'pending', companyName: d.companyName, companyRut: d.companyRut, companyGiro: d.companyGiro, phone: d.phone,
  }).where(eq(schema.users.id, user.id));
  await db.insert(schema.quoteRequests).values({
    kind: 'mayorista', name: user.name, email: user.email, phone: d.phone, company: d.companyName,
    message: d.message ?? 'Solicitud de cuenta mayorista',
  });
  await mailAdminNotice('Nueva solicitud mayorista', { Empresa: d.companyName, RUT: d.companyRut, Giro: d.companyGiro, Contacto: user.name, Correo: user.email, Teléfono: d.phone, Mensaje: d.message });
  redirect('/cuenta?mayorista=enviada');
}

const Quote = z.object({
  kind: z.enum(['medida', 'contacto']),
  name: z.string().trim().min(2, 'Ingresa tu nombre').max(120),
  email: z.string().trim().toLowerCase().email('Correo no válido'),
  phone: z.string().trim().max(30).optional(),
  region: z.string().trim().max(60).optional(),
  message: z.string().trim().min(10, 'Cuéntanos un poco más (mínimo 10 caracteres)').max(3000),
  productId: z.coerce.number().int().positive().optional(),
});

export async function quoteAction(fd: FormData) {
  const kind = str(fd, 'kind') === 'contacto' ? 'contacto' : 'medida';
  const path = kind === 'contacto' ? '/contacto' : '/a-medida';
  if (str(fd, 'website')) redirect(`${path}?enviado=1`); // trampa anti-spam
  const parsed = Quote.safeParse({
    kind, name: str(fd, 'name'), email: str(fd, 'email'), phone: str(fd, 'phone') || undefined,
    region: str(fd, 'region') || undefined, message: str(fd, 'message'), productId: str(fd, 'productId') || undefined,
  });
  if (!parsed.success) back(path, parsed.error.issues[0].message);
  const d = parsed.data!;
  await db.insert(schema.quoteRequests).values({ kind: d.kind, name: d.name, email: d.email, phone: d.phone, region: d.region, message: d.message, productId: d.productId ?? null });
  await mailAdminNotice(kind === 'contacto' ? 'Nuevo mensaje de contacto' : 'Nueva cotización a medida', {
    Nombre: d.name, Correo: d.email, Teléfono: d.phone, Región: d.region, Mensaje: d.message,
  });
  redirect(`${path}?enviado=1`);
}
