import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { UPLOAD_DIR } from '@/lib/uploads';

const TYPES: Record<string, string> = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.avif': 'image/avif' };

// Sirve las fotos subidas desde el admin (en producción Caddy también puede servirlas directo)
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  const full = path.resolve(UPLOAD_DIR, ...parts);
  if (!full.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) return new Response('No encontrado', { status: 404 });
  const type = TYPES[path.extname(full).toLowerCase()];
  if (!type) return new Response('No encontrado', { status: 404 });
  try {
    const s = await stat(full);
    if (!s.isFile()) throw new Error();
    const data = await readFile(full);
    return new Response(new Uint8Array(data), {
      headers: { 'content-type': type, 'cache-control': 'public, max-age=31536000, immutable', 'content-length': String(s.size) },
    });
  } catch {
    return new Response('No encontrado', { status: 404 });
  }
}
