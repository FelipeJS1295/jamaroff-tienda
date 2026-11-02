import 'server-only';
import path from 'node:path';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
const MAX_BYTES = 15 * 1024 * 1024;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/** Guarda una foto optimizada (WebP 1600 px) y su miniatura (600 px). Devuelve las URLs públicas. */
export async function saveProductImage(file: File) {
  if (!OK_TYPES.includes(file.type)) throw new Error('Formato no soportado. Usa JPG, PNG o WebP.');
  if (file.size > MAX_BYTES) throw new Error('La foto supera los 15 MB.');
  const buf = Buffer.from(await file.arrayBuffer());
  return saveImageBuffer(buf);
}

export async function saveImageBuffer(buf: Buffer) {
  const dir = path.join(UPLOAD_DIR, 'products');
  await mkdir(dir, { recursive: true });
  const id = randomUUID();
  const img = sharp(buf, { failOn: 'error' }).rotate();
  const big = await img.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const thumb = await img.clone().resize({ width: 600, height: 750, fit: 'cover' }).webp({ quality: 78 }).toBuffer();
  await writeFile(path.join(dir, `${id}.webp`), big);
  await writeFile(path.join(dir, `${id}-t.webp`), thumb);
  return { url: `/uploads/products/${id}.webp`, thumbUrl: `/uploads/products/${id}-t.webp` };
}

export async function deleteUpload(url: string | null | undefined) {
  if (!url || !url.startsWith('/uploads/')) return;
  const rel = url.replace(/^\/uploads\//, '');
  const full = path.join(UPLOAD_DIR, rel);
  if (!full.startsWith(UPLOAD_DIR)) return;
  await unlink(full).catch(() => {});
}
