import { notFound } from 'next/navigation';
import Link from 'next/link';

// Textos base: reemplaza lo que está entre [corchetes] con tu información real.
const PAGES: Record<string, { title: string; body: { h?: string; p: string }[] }> = {
  despachos: {
    title: 'Despachos y plazos',
    body: [
      { p: 'Despachamos a todo Chile. El costo se calcula automáticamente en el carrito según tu comuna y el volumen embalado de tu pedido.' },
      { h: 'Plazos', p: 'Productos en stock: [X] a [Y] días hábiles según la zona. Productos a pedido: se suma el tiempo de fabricación indicado en cada producto.' },
      { h: 'Coordinación', p: 'Antes de despachar te contactamos para coordinar el día de entrega. Revisa que el mueble pase por puertas, pasillos y ascensores.' },
      { h: 'Zonas extremas', p: 'Para Aysén, Magallanes y destinos especiales cotizamos el despacho aparte y te informamos el costo antes de enviar.' },
    ],
  },
  'cambios-y-devoluciones': {
    title: 'Cambios y devoluciones',
    body: [
      { p: 'Tienes derecho a garantía legal de 6 meses por fallas de fabricación (Ley del Consumidor N° 19.496).' },
      { h: 'Productos en stock', p: '[Describe tu política: plazo para retracto, condiciones del producto, quién paga el flete de vuelta.]' },
      { h: 'Productos a pedido o a medida', p: 'Al ser fabricados especialmente para ti, [describe las condiciones de cambio o devolución].' },
      { h: 'Cómo solicitarlo', p: 'Escríbenos a [correo] o por WhatsApp con tu número de pedido y fotos del producto.' },
    ],
  },
  'preguntas-frecuentes': {
    title: 'Preguntas frecuentes',
    body: [
      { h: '¿Puedo pagar en cuotas?', p: 'Sí, con tarjeta de crédito a través de Webpay, según las cuotas que ofrezca tu banco.' },
      { h: '¿Qué significa “a pedido”?', p: 'Lo fabricamos especialmente para ti con la tela que elijas. El plazo de fabricación aparece en cada producto.' },
      { h: '¿Puedo ver las telas?', p: 'Sí, puedes visitarnos en el showroom o pedirnos muestras al cotizar.' },
      { h: '¿Emiten factura?', p: 'Sí. Marca “Necesito factura” al pagar e ingresa los datos de tu empresa.' },
      { h: '¿Venden al por mayor?', p: 'Sí. Solicita tu cuenta mayorista para ver precios por volumen.' },
    ],
  },
  terminos: {
    title: 'Términos y condiciones',
    body: [
      { p: '[Razón social], RUT [RUT], con domicilio en [dirección], es responsable de este sitio.' },
      { h: 'Precios', p: 'Los precios están en pesos chilenos e incluyen IVA. El costo de despacho se informa antes de pagar.' },
      { h: 'Confirmación de compra', p: 'La compra se confirma al aprobarse el pago. En transferencias, al recibir el depósito.' },
      { h: 'Datos personales', p: 'Usamos tus datos solo para procesar tu pedido y comunicarnos contigo. No los compartimos con terceros salvo el transportista.' },
      { h: 'Garantía y retracto', p: 'Ver la página de cambios y devoluciones.' },
    ],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: PAGES[slug]?.title ?? 'Ayuda' };
}

export default async function AyudaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();
  return (
    <div className="container" style={{ paddingTop: 48, paddingBottom: 80, maxWidth: 820 }}>
      <h1 className="display h2" style={{ marginBottom: 28 }}>{page.title}</h1>
      {page.body.map((b, i) => (
        <section key={i} style={{ marginBottom: 22 }}>
          {b.h ? <h2 style={{ fontSize: 19, fontWeight: 500, margin: '0 0 6px' }}>{b.h}</h2> : null}
          <p className="prose" style={{ margin: 0, color: 'var(--ink)' }}>{b.p}</p>
        </section>
      ))}
      <p className="small muted" style={{ marginTop: 40 }}>¿Otra duda? <Link href="/contacto">Escríbenos</Link>.</p>
    </div>
  );
}
