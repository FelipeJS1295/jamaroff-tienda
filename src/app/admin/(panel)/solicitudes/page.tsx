import Link from 'next/link';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import { db, schema } from '@/db';
import { fechaHora } from '@/lib/format';
import { quoteStatusAction } from '../../actions';
import { Flash } from '@/components/admin-flash';

export const metadata = { title: 'Cotizaciones y mensajes' };

const KIND: Record<string, string> = { medida: 'A medida', mayorista: 'Mayorista', contacto: 'Contacto' };

export default async function Solicitudes({ searchParams }: { searchParams: Promise<{ estado?: string; tipo?: string; ok?: string }> }) {
  const sp = await searchParams;
  const estado = sp.estado ?? 'nueva';
  const where: SQL[] = [];
  if (estado !== 'todas') where.push(eq(schema.quoteRequests.status, estado as 'nueva' | 'respondida' | 'cerrada'));
  if (sp.tipo) where.push(eq(schema.quoteRequests.kind, sp.tipo as 'medida' | 'mayorista' | 'contacto'));
  const rows = await db.select({ q: schema.quoteRequests, product: schema.products.name, slug: schema.products.slug })
    .from(schema.quoteRequests).leftJoin(schema.products, eq(schema.quoteRequests.productId, schema.products.id))
    .where(where.length ? and(...where) : undefined).orderBy(desc(schema.quoteRequests.createdAt)).limit(200);
  return (
    <>
      <div className="admin-head"><h1>Cotizaciones y mensajes</h1></div>
      <Flash ok={sp.ok} />
      <div className="pills">
        {[['nueva', 'Nuevas'], ['respondida', 'Respondidas'], ['cerrada', 'Cerradas'], ['todas', 'Todas']].map(([k, l]) => (
          <Link key={k} className="pill" aria-current={estado === k ? 'true' : undefined} href={`/admin/solicitudes?estado=${k}`}>{l}</Link>
        ))}
      </div>
      <div className="stack">
        {rows.map(({ q, product, slug }) => {
          const wa = q.phone?.replace(/\D/g, '');
          return (
            <article key={q.id} className="box">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className={`tag ${q.kind === 'mayorista' ? 'tag-yellow' : q.kind === 'medida' ? 'tag-green' : ''}`}>{KIND[q.kind]}</span>{' '}
                  <strong style={{ fontWeight: 500 }}>{q.name}</strong>{q.company ? ` · ${q.company}` : ''}
                  <div className="small muted">{fechaHora(q.createdAt)}{q.region ? ` · ${q.region}` : ''}</div>
                  <div className="small"><a href={`mailto:${q.email}`}>{q.email}</a>{q.phone ? <> · {q.phone}{wa ? <> · <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener">WhatsApp</a></> : null}</> : null}</div>
                </div>
                <form action={quoteStatusAction} className="row" style={{ gap: 6 }}>
                  <input type="hidden" name="id" value={q.id} />
                  {q.status !== 'respondida' ? <button className="mini-btn" name="status" value="respondida" type="submit">Marcar respondida</button> : null}
                  {q.status !== 'cerrada' ? <button className="mini-btn" name="status" value="cerrada" type="submit">Cerrar</button> : null}
                  {q.status !== 'nueva' ? <button className="mini-btn" name="status" value="nueva" type="submit">Reabrir</button> : null}
                </form>
              </div>
              {product ? <p className="small" style={{ margin: '10px 0 0' }}>Producto: <a href={`/producto/${slug}`} target="_blank">{product}</a></p> : null}
              <p style={{ margin: '10px 0 0', whiteSpace: 'pre-line' }}>{q.message}</p>
              {q.kind === 'mayorista' ? <p className="small" style={{ margin: '10px 0 0' }}><Link href="/admin/mayoristas">Aprobar o rechazar en Mayoristas →</Link></p> : null}
            </article>
          );
        })}
        {!rows.length ? <p className="muted">No hay solicitudes en esta lista.</p> : null}
      </div>
    </>
  );
}
