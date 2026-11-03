import { getMenuCategories } from '@/lib/catalog';
import { getCurrentUser } from '@/lib/auth';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { HeaderShell } from './header-shell';

export async function SiteHeader() {
  const [cats, user, [catalog]] = await Promise.all([
    getMenuCategories(),
    getCurrentUser(),
    // El catálogo digital publicado más reciente aparece en el menú
    db.select({ slug: schema.catalogs.slug, title: schema.catalogs.title }).from(schema.catalogs).where(eq(schema.catalogs.published, true)).orderBy(desc(schema.catalogs.updatedAt)).limit(1),
  ]);
  return (
    <HeaderShell
      categories={cats.map((c) => ({ name: c.name, slug: c.slug }))}
      accountLabel={user ? `Mi cuenta (${user.name})` : 'Ingresar a mi cuenta'}
      catalog={catalog ?? null}
    />
  );
}
