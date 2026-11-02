import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { saveProductAction } from '../../../actions';
import { ProductForm } from '../product-form';
import { Flash } from '@/components/admin-flash';

export const metadata = { title: 'Nuevo producto' };

export default async function NuevoProducto({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [sp, cats] = await Promise.all([searchParams, db.select().from(schema.categories).orderBy(asc(schema.categories.position))]);
  return (
    <>
      <div className="admin-head"><div><Link href="/admin/productos" className="small">← Productos</Link><h1>Nuevo producto</h1></div></div>
      <Flash error={sp.error} />
      <ProductForm
        action={saveProductAction}
        categories={cats}
        data={{
          name: '', sku: '', description: '', categoryId: null, price: null, compareAtPrice: null, wholesalePrice: null, wholesaleMinQty: 1,
          mode: 'stock', stock: 0, leadTimeDays: null, material: '', color: '', dimensions: '', featured: false, active: true,
          variants: [], packages: [], specs: [],
        }}
      />
    </>
  );
}
