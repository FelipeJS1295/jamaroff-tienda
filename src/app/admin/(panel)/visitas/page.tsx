import Link from 'next/link';
import { inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/db';

export const metadata = { title: 'Visitas' };
export const dynamic = 'force-dynamic';

const TZ = 'America/Santiago';
// Escrita en la consulta (no como parámetro) para que el agrupar por día coincida
const tz = sql.raw(`'${TZ}'`);
const RANGES = [7, 30, 90] as const;
const DEVICE: Record<string, string> = { movil: 'Celular', escritorio: 'Computador', tablet: 'Tablet' };
const n = (x: number) => x.toLocaleString('es-CL');
const dayLabel = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, dd, 12)).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
};

/** Nombre legible de una página de la tienda */
function pageName(path: string, products: Map<string, string>, cats: Map<string, string>) {
  if (path === '/') return 'Portada';
  const prod = path.match(/^\/producto\/([^/]+)/);
  if (prod) return products.get(prod[1]) ?? `Producto (${prod[1]})`;
  const cat = path.match(/^\/catalogo\/([^/]+)/);
  if (cat) return `Colección · ${cats.get(cat[1]) ?? cat[1]}`;
  if (path === '/catalogo') return 'Colección completa';
  if (/^\/catalogo-/.test(path)) return `Catálogo digital (${path.slice(1)})`;
  const fixed: Record<string, string> = { '/a-medida': 'A medida', '/mayoristas': 'Mayoristas', '/contacto': 'Contacto', '/carrito': 'Carrito', '/checkout': 'Pago (checkout)', '/cuenta': 'Mi cuenta' };
  return fixed[path] ?? path;
}

export default async function Visitas({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const sp = await searchParams;
  const days = (RANGES as readonly number[]).includes(Number(sp.dias)) ? Number(sp.dias) : 30;
  const pv = schema.pageViews;
  // Desde las 00:00 (hora de Chile) del primer día del rango
  const since = sql`(date_trunc('day', now() at time zone ${tz}) - make_interval(days => ${days - 1})) at time zone ${tz}`;
  const dayOf = sql`(${pv.at} at time zone ${tz})::date`;

  const [daily, pages, sources, devices, [today]] = await Promise.all([
    db
      .select({ d: sql<string>`${dayOf}::text`, views: sql<number>`count(*)::int`, people: sql<number>`count(distinct ${pv.visitor})::int` })
      .from(pv)
      .where(sql`${pv.at} >= ${since}`)
      .groupBy(dayOf),
    db
      .select({ path: pv.path, views: sql<number>`count(*)::int`, people: sql<number>`count(distinct (${pv.visitor}, ${dayOf}))::int` })
      .from(pv)
      .where(sql`${pv.at} >= ${since}`)
      .groupBy(pv.path)
      .orderBy(sql`count(*) desc`)
      .limit(20),
    // Cada persona (por día) cuenta una vez, con el origen de su primera página
    db.execute<{ source: string | null; people: number }>(sql`
      select src as source, count(*)::int as people from (
        select (array_agg(${pv.source} order by ${pv.at}) filter (where ${pv.source} is not null))[1] as src
        from ${pv} where ${pv.at} >= ${since} group by ${pv.visitor}, ${dayOf}
      ) x group by src order by 2 desc
    `),
    db.execute<{ device: string; people: number }>(sql`
      select device, count(*)::int as people from (
        select (array_agg(${pv.device} order by ${pv.at}))[1] as device from ${pv} where ${pv.at} >= ${since} group by ${pv.visitor}, ${dayOf}
      ) x group by device order by 2 desc
    `),
    db
      .select({ views: sql<number>`count(*)::int`, people: sql<number>`count(distinct ${pv.visitor})::int` })
      .from(pv)
      .where(sql`${pv.at} >= date_trunc('day', now() at time zone ${tz}) at time zone ${tz}`),
  ]);

  // Todos los días del rango, también los sin visitas
  const byDay = new Map(daily.map((r) => [r.d, r]));
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const series = Array.from({ length: days }, (_, i) => {
    const t = new Date(`${todayStr}T12:00:00Z`);
    t.setUTCDate(t.getUTCDate() - (days - 1 - i));
    const d = t.toISOString().slice(0, 10);
    return { d, views: byDay.get(d)?.views ?? 0, people: byDay.get(d)?.people ?? 0 };
  });
  const totalViews = series.reduce((s, r) => s + r.views, 0);
  const totalPeople = series.reduce((s, r) => s + r.people, 0);
  const max = Math.max(1, ...series.map((r) => r.people));
  const sourceRows = [...sources];
  const deviceRows = [...devices];
  const peopleAll = sourceRows.reduce((s, r) => s + r.people, 0) || 1;
  const pct = (x: number) => `${Math.round((x / peopleAll) * 100)}%`;

  const slugs = pages.map((p) => p.path.match(/^\/producto\/([^/]+)/)?.[1]).filter((x): x is string => !!x);
  const catSlugs = pages.map((p) => p.path.match(/^\/catalogo\/([^/]+)/)?.[1]).filter((x): x is string => !!x);
  const [prods, cats] = await Promise.all([
    slugs.length ? db.select({ slug: schema.products.slug, name: schema.products.name }).from(schema.products).where(inArray(schema.products.slug, slugs)) : [],
    catSlugs.length ? db.select({ slug: schema.categories.slug, name: schema.categories.name }).from(schema.categories).where(inArray(schema.categories.slug, catSlugs)) : [],
  ]);
  const prodNames = new Map(prods.map((p) => [p.slug, p.name]));
  const catNames = new Map(cats.map((c) => [c.slug, c.name]));

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Visitas</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>Personas que entraron a jamaroff.cl. No cuentan robots ni tus propias visitas con la sesión del admin abierta.</p>
        </div>
        <nav className="row" aria-label="Período" style={{ gap: 6 }}>
          {RANGES.map((r) => (
            <Link key={r} href={`/admin/visitas?dias=${r}`} className={`btn btn-sm ${r === days ? 'btn-dark' : 'btn-outline'}`} aria-current={r === days ? 'page' : undefined}>
              {r} días
            </Link>
          ))}
        </nav>
      </div>

      <div className="tiles" style={{ marginBottom: 24 }}>
        <div className="tile"><div className="label">Hoy</div><div className="value">{n(today.people)}</div><div className="small muted">{today.people === 1 ? 'persona' : 'personas'} · {n(today.views)} páginas vistas</div></div>
        <div className="tile"><div className="label">Últimos {days} días</div><div className="value">{n(totalPeople)}</div><div className="small muted">visitas (una persona por día)</div></div>
        <div className="tile"><div className="label">Páginas vistas</div><div className="value">{n(totalViews)}</div><div className="small muted">en {days} días</div></div>
        <div className="tile"><div className="label">Páginas por visita</div><div className="value">{totalPeople ? (totalViews / totalPeople).toLocaleString('es-CL', { maximumFractionDigits: 1 }) : '0'}</div><div className="small muted">cuánto recorren la tienda</div></div>
      </div>

      <section className="box" style={{ marginBottom: 20 }}>
        <h2>Visitas por día</h2>
        {totalViews ? (
          <div className="visits-chart" role="img" aria-label={`Visitas por día en los últimos ${days} días`}>
            {series.map((r) => (
              <div key={r.d} className="visits-col" title={`${dayLabel(r.d)}: ${n(r.people)} ${r.people === 1 ? 'persona' : 'personas'}, ${n(r.views)} páginas`}>
                <span className="visits-bar" style={{ height: `${(r.people / max) * 100}%` }} />
              </div>
            ))}
          </div>
        ) : (
          <p className="alert alert-info small" style={{ margin: 0 }}>Aún no hay visitas registradas. Se empiezan a contar desde hoy.</p>
        )}
        {totalViews ? (
          <div className="visits-axis small muted"><span>{dayLabel(series[0].d)}</span><span>Máximo: {n(max)} en un día</span><span>{dayLabel(series[series.length - 1].d)}</span></div>
        ) : null}
      </section>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <section className="box">
          <h2>De dónde llegan</h2>
          {sourceRows.length ? (
            <ul className="visits-list">
              {sourceRows.map((r) => (
                <li key={r.source ?? 'directo'}>
                  <span>{r.source ?? 'Directo o enlace guardado'}</span>
                  <span className="visits-meter"><i style={{ width: pct(r.people) }} /></span>
                  <strong>{n(r.people)}</strong>
                </li>
              ))}
            </ul>
          ) : <p className="muted">Sin datos todavía.</p>}
          <p className="small muted" style={{ marginBottom: 0 }}>“Directo” incluye quienes escriben jamaroff.cl, usan un marcador o abren el enlace desde una app que no informa el origen.</p>
        </section>
        <section className="box">
          <h2>Desde qué aparato</h2>
          {deviceRows.length ? (
            <ul className="visits-list">
              {deviceRows.map((r) => (
                <li key={r.device}>
                  <span>{DEVICE[r.device] ?? r.device}</span>
                  <span className="visits-meter"><i style={{ width: pct(r.people) }} /></span>
                  <strong>{pct(r.people)}</strong>
                </li>
              ))}
            </ul>
          ) : <p className="muted">Sin datos todavía.</p>}
        </section>
      </div>

      <section className="box">
        <h2>Páginas más vistas</h2>
        {pages.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Página</th><th style={{ textAlign: 'right' }}>Personas</th><th style={{ textAlign: 'right' }}>Veces vista</th></tr></thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.path}>
                    <td><a href={p.path} target="_blank" rel="noreferrer">{pageName(p.path, prodNames, catNames)}</a></td>
                    <td style={{ textAlign: 'right' }}>{n(p.people)}</td>
                    <td style={{ textAlign: 'right' }}>{n(p.views)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">Sin datos todavía.</p>}
      </section>
    </>
  );
}
