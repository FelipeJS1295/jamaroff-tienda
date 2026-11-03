import Link from 'next/link';
import { desc, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { createCatalogAction } from '../../catalog-actions';
import { Flash } from '@/components/admin-flash';

export const metadata = { title: 'Catálogos digitales' };

export default async function CatalogosAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const rows = await db
    .select({ c: schema.catalogs, n: sql<number>`(select count(*)::int from catalog_pages p where p.catalog_id = "catalogs"."id")` })
    .from(schema.catalogs)
    .orderBy(desc(schema.catalogs.createdAt));
  return (
    <>
      <div className="admin-head"><h1>Catálogos digitales</h1></div>
      <Flash ok={sp.ok} error={sp.error} />
      <p className="small muted" style={{ marginTop: 0 }}>
        Un libro que se hojea en la tienda, como el catálogo impreso. Las páginas de producto toman las fotos, telas y medidas de la tienda,
        y en vez de precio llevan un botón para consultarlo.
      </p>
      <div className="stack">
        {rows.map(({ c, n }) => (
          <div key={c.id} className="box row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ fontSize: 17 }}>{c.title}</strong>{' '}
              {c.published ? <span className="tag tag-green">Publicado</span> : <span className="tag">Borrador</span>}
              <div className="small muted">/{c.slug} · {n} {n === 1 ? 'página' : 'páginas'}</div>
            </div>
            <div className="row">
              <a className="btn btn-outline btn-sm" href={`/${c.slug}`} target="_blank">Ver ↗</a>
              <Link className="btn btn-dark btn-sm" href={`/admin/catalogos/${c.id}`}>Editar</Link>
            </div>
          </div>
        ))}
        <form action={createCatalogAction} className="box row">
          <label className="field" style={{ flex: '1 1 220px' }}><span>Nuevo catálogo</span><input className="input" name="title" placeholder="Catálogo 2026" required /></label>
          <label className="field" style={{ flex: '1 1 220px' }}><span>Dirección (jamaroff.cl/…)</span><input className="input" name="slug" placeholder="catalogo-2026" /></label>
          <label className="field" style={{ flex: '2 1 260px' }}><span>Bajada (opcional)</span><input className="input" name="subtitle" placeholder="Colección otoño–invierno" /></label>
          <button className="btn btn-primary btn-sm" type="submit">+ Crear</button>
        </form>
      </div>
    </>
  );
}
