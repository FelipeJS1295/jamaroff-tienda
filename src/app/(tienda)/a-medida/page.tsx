import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getCurrentUser } from '@/lib/auth';
import { QuoteForm } from '@/components/quote-form';

export const metadata = { title: 'Muebles a medida', description: 'Cotiza tu sofá o mueble a medida: elige modelo, medidas, tela y color.' };

export default async function AMedidaPage({ searchParams }: { searchParams: Promise<{ error?: string; enviado?: string; producto?: string }> }) {
  const sp = await searchParams;
  const pid = Number(sp.producto) || undefined;
  const [product] = pid ? await db.select({ id: schema.products.id, name: schema.products.name }).from(schema.products).where(eq(schema.products.id, pid)).limit(1) : [];
  const user = await getCurrentUser();
  return (
    <div className="container split section" style={{ alignItems: 'flex-start' }}>
      <div>
        <span className="eyebrow">Home Atelier</span>
        <h1 className="display h1" style={{ margin: '12px 0 20px', fontSize: 'clamp(40px,5vw,64px)' }}>Hecho a tu medida.</h1>
        <p className="lead">Partimos de cualquier modelo del catálogo y lo ajustamos a tu espacio: medidas, tela, color, firmeza y terminaciones. Te enviamos una cotización con precio y plazo de fabricación.</p>
        <ol className="steps" style={{ marginTop: 32 }}>
          <li><span className="step-n" style={{ background: 'var(--sage-logo)', color: '#fff' }}>1</span><span><strong style={{ fontWeight: 500 }}>Cuéntanos qué necesitas</strong><br /><span className="muted small">Con fotos o medidas si las tienes.</span></span></li>
          <li><span className="step-n" style={{ background: 'var(--yellow)' }}>2</span><span><strong style={{ fontWeight: 500 }}>Te cotizamos</strong><br /><span className="muted small">Precio, plazo y opciones de tela.</span></span></li>
          <li><span className="step-n" style={{ background: 'var(--sand)' }}>3</span><span><strong style={{ fontWeight: 500 }}>Fabricamos y despachamos</strong><br /><span className="muted small">Sigues cada etapa desde tu cuenta.</span></span></li>
        </ol>
      </div>
      <div className="card">
        <h2 className="display h3" style={{ marginBottom: 16 }}>Solicita tu cotización</h2>
        <QuoteForm kind="medida" error={sp.error} sent={sp.enviado === '1'} productId={product?.id} productName={product?.name} user={user} />
      </div>
    </div>
  );
}
