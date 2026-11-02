import { asc, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { deleteCategoryAction, saveCategoryAction } from '../../actions';
import { Flash } from '@/components/admin-flash';
import { ConfirmButton } from '@/components/auto-submit';

export const metadata = { title: 'Categorías' };

export default async function CategoriasAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const cats = await db.select({
    c: schema.categories,
    n: sql<number>`(select count(*)::int from products p where p.category_id = "categories"."id")`,
  }).from(schema.categories).orderBy(asc(schema.categories.position), asc(schema.categories.name));
  return (
    <>
      <div className="admin-head"><h1>Categorías</h1></div>
      <Flash ok={sp.ok} error={sp.error} />
      <p className="small muted">Las categorías visibles aparecen, en este orden, en el submenú “Productos”, en el pie de página y en el catálogo.</p>
      <div className="stack">
        {cats.map(({ c, n }) => (
          <form key={c.id} action={saveCategoryAction} className="box row">
            <input type="hidden" name="id" value={c.id} />
            <label className="field" style={{ width: 70 }}><span>Orden</span><input className="input" name="position" defaultValue={c.position} inputMode="numeric" /></label>
            <label className="field" style={{ flex: '1 1 200px' }}><span>Nombre</span><input className="input" name="name" defaultValue={c.name} required /></label>
            <label className="field" style={{ flex: '2 1 280px' }}><span>Descripción</span><input className="input" name="description" defaultValue={c.description ?? ''} /></label>
            <label className="check small" style={{ height: 46 }}><input type="checkbox" name="showInMenu" defaultChecked={c.showInMenu} /> Visible</label>
            <span className="small muted" style={{ height: 46, display: 'flex', alignItems: 'center' }}>{n} productos · /catalogo/{c.slug}</span>
            <button className="btn btn-dark btn-sm" type="submit">Guardar</button>
            <ConfirmButton formAction={deleteCategoryAction} className="mini-btn danger" message={`¿Eliminar la categoría “${c.name}”? Sus productos quedarán sin categoría.`}>
              Eliminar
            </ConfirmButton>
          </form>
        ))}
        <form action={saveCategoryAction} className="box row">
          <label className="field" style={{ width: 70 }}><span>Orden</span><input className="input" name="position" defaultValue={cats.length + 1} inputMode="numeric" /></label>
          <label className="field" style={{ flex: '1 1 200px' }}><span>Nueva categoría</span><input className="input" name="name" required /></label>
          <label className="field" style={{ flex: '2 1 280px' }}><span>Descripción</span><input className="input" name="description" /></label>
          <input type="hidden" name="showInMenu" value="on" />
          <button className="btn btn-primary btn-sm" type="submit">+ Crear</button>
        </form>
      </div>
    </>
  );
}
