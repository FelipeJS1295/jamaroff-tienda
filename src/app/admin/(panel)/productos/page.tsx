import Link from 'next/link';
import { and, asc, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { db, schema } from '@/db';
import { clp, MODE_LABEL } from '@/lib/format';
import { quickStockAction } from '../../actions';
import { Flash } from '@/components/admin-flash';

export const metadata = { title: 'Productos' };

export default async function ProductosAdmin({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string; ver?: string; page?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { products, categories } = schema;
  const where: SQL[] = [];
  if (sp.q) {
    const t = `%${sp.q.replace(/[%_]/g, '')}%`;
    where.push(or(ilike(products.name, t), ilike(products.sku, t))!);
  }
  if (sp.cat) where.push(eq(products.categoryId, Number(sp.cat)));
  if (sp.ver === 'ocultos') where.push(eq(products.active, false));
  if (sp.ver === 'sin-stock') where.push(and(sql`${products.mode} <> 'pedido'`, sql`${products.stock} <= 0`)!);
  const page = Math.max(1, Number(sp.page) || 1);
  const cond = where.length ? and(...where) : undefined;
  const [rows, [{ total }], cats] = await Promise.all([
    db.select({
      p: products,
      cat: categories.name,
      img: sql<string | null>`(select coalesce(pi.thumb_url, pi.url) from product_images pi where pi.product_id = "products"."id" order by pi.position limit 1)`,
    }).from(products).leftJoin(categories, eq(products.categoryId, categories.id)).where(cond)
      .orderBy(desc(products.updatedAt)).limit(60).offset((page - 1) * 60),
    db.select({ total: sql<number>`count(*)::int` }).from(products).where(cond),
    db.select().from(categories).orderBy(asc(categories.position)),
  ]);
  const back = `/admin/productos?${new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && !['ok', 'error'].includes(k)) as [string, string][])}`;

  return (
    <>
      <div className="admin-head">
        <h1>Productos <span className="muted" style={{ fontSize: 20, fontFamily: 'var(--sans)', fontWeight: 400 }}>{total}</span></h1>
        <div className="row">
          <Link href="/admin/productos/importar" className="btn btn-outline btn-sm">Importar Excel</Link>
          <Link href="/admin/productos/nuevo" className="btn btn-primary btn-sm">+ Nuevo producto</Link>
        </div>
      </div>
      <Flash ok={sp.ok} error={sp.error} />
      <form className="row" style={{ marginBottom: 16 }} action="/admin/productos">
        <input name="q" className="input" style={{ maxWidth: 280 }} placeholder="Nombre o SKU" defaultValue={sp.q} aria-label="Buscar" />
        <select name="cat" className="select" style={{ width: 'auto' }} defaultValue={sp.cat ?? ''} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="ver" className="select" style={{ width: 'auto' }} defaultValue={sp.ver ?? ''} aria-label="Mostrar">
          <option value="">Todos</option><option value="sin-stock">Sin stock</option><option value="ocultos">Ocultos</option>
        </select>
        <button className="btn btn-dark btn-sm" type="submit">Filtrar</button>
      </form>
      <div className="table-wrap box" style={{ padding: 0 }}>
        <table className="table" style={{ minWidth: 880 }}>
          <thead><tr><th></th><th>Producto</th><th>Categoría</th><th>Modalidad</th><th>Precio</th><th>Mayorista</th><th>Stock</th></tr></thead>
          <tbody>
            {rows.map(({ p, cat, img }) => (
              <tr key={p.id}>
                <td style={{ width: 64 }}>{img ? <img className="thumb" src={img} alt="" /> : <div className="thumb" />}</td>
                <td>
                  <Link href={`/admin/productos/${p.id}`} style={{ fontWeight: 500 }}>{p.name}</Link>
                  <div className="small muted">{p.sku ?? 'Sin SKU'}{!p.active ? <> · <span className="tag tag-red">Oculto</span></> : null}{p.featured ? <> · <span className="tag tag-green">Destacado</span></> : null}</div>
                </td>
                <td className="small">{cat ?? '—'}</td>
                <td className="small">{MODE_LABEL[p.mode]}</td>
                <td>{clp(p.price)}</td>
                <td className="small">{p.wholesalePrice != null ? `${clp(p.wholesalePrice)} (mín. ${p.wholesaleMinQty})` : '—'}</td>
                <td>
                  {p.mode === 'pedido' ? <span className="small muted">A pedido</span> : (
                    <form action={quickStockAction} className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="back" value={back} />
                      <input className="input" name="stock" defaultValue={p.stock} inputMode="numeric" style={{ width: 70, height: 36 }} aria-label={`Stock de ${p.name}`} />
                      <button className="mini-btn" type="submit">OK</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={7} className="muted" style={{ padding: 24 }}>No hay productos. <Link href="/admin/productos/nuevo">Crea el primero</Link>.</td></tr> : null}
          </tbody>
        </table>
      </div>
      {total > 60 ? (
        <div className="row" style={{ marginTop: 16 }}>
          {page > 1 ? <Link className="pill" href={`${back}&page=${page - 1}`}>← Anterior</Link> : null}
          <span className="small muted">Página {page} de {Math.ceil(total / 60)}</span>
          {page * 60 < total ? <Link className="pill" href={`${back}&page=${page + 1}`}>Siguiente →</Link> : null}
        </div>
      ) : null}
    </>
  );
}
