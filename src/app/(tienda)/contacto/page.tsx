import { getCurrentUser } from '@/lib/auth';
import { getSettings, whatsappLink } from '@/lib/settings';
import { QuoteForm } from '@/components/quote-form';

export const metadata = { title: 'Contacto' };

export default async function ContactoPage({ searchParams }: { searchParams: Promise<{ error?: string; enviado?: string }> }) {
  const [sp, s, user] = await Promise.all([searchParams, getSettings(), getCurrentUser()]);
  const wa = whatsappLink(s.whatsapp, 'Hola Jamaroff');
  return (
    <div className="container split section" style={{ alignItems: 'flex-start' }}>
      <div>
        <h1 className="display h1" style={{ marginBottom: 20, fontSize: 'clamp(40px,5vw,64px)' }}>Conversemos.</h1>
        <p className="lead">Resolvemos tus dudas sobre productos, telas, despachos o pedidos.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
          {wa ? <a href={wa} target="_blank" rel="noopener" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Escríbenos por WhatsApp</a> : null}
          {s.contactEmail ? <span>Correo: <a href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a></span> : null}
          {s.showroomAddress ? <span>Showroom: {s.showroomAddress}</span> : null}
          {s.showroomHours ? <span className="muted">{s.showroomHours}</span> : null}
        </div>
      </div>
      <div className="card">
        <QuoteForm kind="contacto" error={sp.error} sent={sp.enviado === '1'} user={user} />
      </div>
    </div>
  );
}
