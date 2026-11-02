import Link from 'next/link';
import { getFacets, listProducts, getMenuCategories, type CatalogFilters } from '@/lib/catalog';
import { getCurrentUser, isApprovedWholesale } from '@/lib/auth';
import { ProductCard } from './product-card';
import { AutoSubmitSelect } from './auto-submit';

type SP = Record<string, string | string[] | undefined>;

function arr(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);
}
function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export async function CatalogView({ categorySlug, searchParams }: { categorySlug?: string; searchParams: SP }) {
  const disp = one(searchParams.disp);
  const orden = one(searchParams.orden);
  const filters: CatalogFilters = {
    categoria: categorySlug,
    disp: disp === 'stock' || disp === 'pedido' ? disp : undefined,
    material: arr(searchParams.material),
    color: arr(searchParams.color),
    min: Number(one(searchParams.min)?.replace(/\D/g, '')) || undefined,
    max: Number(one(searchParams.max)?.replace(/\D/g, '')) || undefined,
    q: one(searchParams.q)?.slice(0, 80) || undefined,
    orden: (['precio-asc', 'precio-desc', 'nuevos'] as const).find((o) => o === orden) ?? 'destacados',
    page: Number(one(searchParams.page)) || 1,
  };
  const [{ rows, total, page, pages }, facets, cats, user] = await Promise.all([
    listProducts(filters),
    getFacets(categorySlug),
    getMenuCategories(),
    getCurrentUser(),
  ]);
  const category = cats.find((c) => c.slug === categorySlug);
  const base = categorySlug ? `/catalogo/${categorySlug}` : '/catalogo';

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) for (const x of arr(v)) p.append(k, x);
    for (const [k, v] of Object.entries(patch)) {
      p.delete(k);
      if (v) p.set(k, v);
    }
    if (!('page' in patch)) p.delete('page');
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };

  const title = filters.q ? `Resultados para “${filters.q}”` : category?.name ?? 'Catálogo';

  return (
    <div className="wrap catalog-page">
      <nav aria-label="Ruta" className="breadcrumb">
        <Link href="/">Inicio</Link><span aria-hidden="true">/</span>
        {category ? (<><Link href="/catalogo">Catálogo</Link><span aria-hidden="true">/</span><span aria-current="page">{category.name}</span></>) : <span aria-current="page">Catálogo</span>}
      </nav>
      <header className="catalog-head">
        <h1 className="page-title">{title}</h1>
        <p className="catalog-total">{total} {total === 1 ? 'pieza' : 'piezas'}</p>
      </header>
      {category?.description ? <p className="lead catalog-desc">{category.description}</p> : null}

      <div className="catalog">
        <form className="filters" action={base} aria-label="Filtros">
          {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
          {filters.orden !== 'destacados' ? <input type="hidden" name="orden" value={filters.orden} /> : null}
          <fieldset>
            <legend>Disponibilidad</legend>
            <Link className="chip" aria-current={!filters.disp ? 'true' : undefined} href={qs({ disp: undefined })}>Todos</Link>
            <Link className="chip" aria-current={filters.disp === 'stock' ? 'true' : undefined} href={qs({ disp: 'stock' })}>En stock · despacho inmediato</Link>
            <Link className="chip" aria-current={filters.disp === 'pedido' ? 'true' : undefined} href={qs({ disp: 'pedido' })}>A pedido · personalizable</Link>
            {filters.disp ? <input type="hidden" name="disp" value={filters.disp} /> : null}
          </fieldset>
          {!categorySlug ? (
            <fieldset>
              <legend>Categoría</legend>
              {cats.map((c) => <Link key={c.id} href={`/catalogo/${c.slug}`} className="filter-link">{c.name}</Link>)}
            </fieldset>
          ) : null}
          {facets.materials.length ? (
            <fieldset>
              <legend>Material</legend>
              {facets.materials.map((m) => (
                <label key={m} className="check"><input type="checkbox" name="material" value={m} defaultChecked={filters.material?.includes(m)} /> {m}</label>
              ))}
            </fieldset>
          ) : null}
          {facets.colors.length ? (
            <fieldset>
              <legend>Color</legend>
              {facets.colors.map((c) => (
                <label key={c} className="check"><input type="checkbox" name="color" value={c} defaultChecked={filters.color?.includes(c)} /> {c}</label>
              ))}
            </fieldset>
          ) : null}
          <fieldset>
            <legend>Precio</legend>
            <div style={{ display: 'flex', gap: 10 }}>
              <label className="field" style={{ flex: 1 }}><span>Desde</span><input className="input" name="min" inputMode="numeric" placeholder="$ mín." defaultValue={filters.min ?? ''} /></label>
              <label className="field" style={{ flex: 1 }}><span>Hasta</span><input className="input" name="max" inputMode="numeric" placeholder="$ máx." defaultValue={filters.max ?? ''} /></label>
            </div>
          </fieldset>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" type="submit">Aplicar filtros</button>
            <Link className="btn btn-outline btn-sm" href={base}>Limpiar</Link>
          </div>
        </form>

        <section className="results" aria-label="Productos">
          <div className="toolbar">
            <form action={base} role="search" style={{ display: 'flex', gap: 8, flex: '1 1 260px', maxWidth: 420 }}>
              <label htmlFor="buscar" className="sr-only">Buscar en el catálogo</label>
              <input id="buscar" name="q" type="search" className="input" placeholder="Buscar productos…" defaultValue={filters.q ?? ''} />
              <button className="btn btn-primary btn-sm" type="submit">Buscar</button>
            </form>
                        <form action={base} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {Object.entries(searchParams).filter(([k]) => k !== 'orden' && k !== 'page').flatMap(([k, v]) => arr(v).map((x, i) => <input key={k + i} type="hidden" name={k} value={x} />))}
              <label htmlFor="orden">Ordenar por</label>
              <AutoSubmitSelect id="orden" name="orden" defaultValue={filters.orden ?? 'destacados'} options={[
                ['destacados', 'Destacados'], ['precio-asc', 'Precio: menor a mayor'], ['precio-desc', 'Precio: mayor a menor'], ['nuevos', 'Más nuevos'],
              ]} />
            </form>
          </div>
          {rows.length ? (
            <div className="product-grid">
              {rows.map((p) => <ProductCard key={p.id} p={p} wholesale={isApprovedWholesale(user)} />)}
            </div>
          ) : (
            <div className="empty">
              <p className="lead">No encontramos productos con esos filtros.</p>
              <Link href={base} className="btn btn-outline">Ver todo</Link>
            </div>
          )}
          {pages > 1 ? (
            <nav className="pager" aria-label="Páginas">
              {page > 1 ? <Link href={qs({ page: String(page - 1) })}>← Anterior</Link> : null}
              {Array.from({ length: pages }, (_, i) => i + 1).filter((n) => Math.abs(n - page) <= 2 || n === 1 || n === pages).map((n) => (
                <Link key={n} href={qs({ page: String(n) })} aria-current={n === page ? 'page' : undefined}>{n}</Link>
              ))}
              {page < pages ? <Link href={qs({ page: String(page + 1) })}>Siguiente →</Link> : null}
            </nav>
          ) : null}
        </section>
      </div>
    </div>
  );
}
