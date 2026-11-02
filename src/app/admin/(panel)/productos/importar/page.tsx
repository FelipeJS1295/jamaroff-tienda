import Link from 'next/link';
import { importProductsAction } from '../../../actions';
import { Flash } from '@/components/admin-flash';

export const metadata = { title: 'Importar productos' };

export default async function Importar({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; detalle?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <div className="admin-head"><div><Link href="/admin/productos" className="small">← Productos</Link><h1>Importar desde Excel</h1></div></div>
      <Flash ok={sp.ok} error={sp.error} detail={sp.detalle} />
      <div className="grid-2">
        <section className="box stack">
          <h2 style={{ margin: 0 }}>1. Descarga la plantilla</h2>
          <p className="small" style={{ margin: 0 }}>Incluye tus productos actuales, así puedes editar precios y stock en bloque y volver a subirla.</p>
          <a className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} href="/admin/productos/plantilla">Descargar plantilla (.xlsx)</a>
          <h2 style={{ margin: '12px 0 0' }}>2. Súbela con tus cambios</h2>
          <form action={importProductsAction} className="row">
            <input type="file" name="file" accept=".xlsx" required aria-label="Archivo Excel" />
            <button className="btn btn-dark btn-sm" type="submit">Importar</button>
          </form>
        </section>
        <section className="box small">
          <h2>Cómo funciona</h2>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>Cada fila es un producto. El <strong>SKU</strong> lo identifica: si ya existe se actualiza, si no se crea.</li>
            <li>Columnas obligatorias: SKU, Nombre, Precio.</li>
            <li>Modalidad: <em>stock</em>, <em>pedido</em> o <em>ambos</em>.</li>
            <li>Si escribes una categoría nueva, se crea sola.</li>
            <li>Bultos: <code>200x100x90,55; 170x100x90,45</code> (largo×ancho×alto en cm, coma, kg; separa con punto y coma).</li>
            <li>Activo: <em>no</em> para ocultarlo.</li>
            <li>Las fotos y telas se agregan después desde la ficha de cada producto.</li>
          </ul>
        </section>
      </div>
    </>
  );
}
