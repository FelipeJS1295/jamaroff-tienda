import type { MetadataRoute } from 'next';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const [products, cats] = await Promise.all([
    db.select({ slug: schema.products.slug, updatedAt: schema.products.updatedAt }).from(schema.products).where(eq(schema.products.active, true)),
    db.select({ slug: schema.categories.slug }).from(schema.categories),
  ]);
  return [
    { url: `${site}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${site}/catalogo`, changeFrequency: 'daily', priority: 0.9 },
    ...cats.map((c) => ({ url: `${site}/catalogo/${c.slug}`, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${site}/producto/${p.slug}`, lastModified: p.updatedAt, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...['a-medida', 'mayoristas', 'contacto', 'ayuda/despachos', 'ayuda/preguntas-frecuentes'].map((s) => ({ url: `${site}/${s}`, priority: 0.5 })),
  ];
}
