import { quoteAction } from '@/app/(tienda)/cuenta/actions';
import { REGION_NAMES } from '@/lib/chile';

export function QuoteForm({ kind, error, sent, productId, productName, user }: {
  kind: 'medida' | 'contacto'; error?: string; sent?: boolean; productId?: number; productName?: string;
  user?: { name: string; email: string; phone: string | null } | null;
}) {
  if (sent) {
    return <p className="alert alert-ok">¡Gracias! Recibimos tu mensaje y te responderemos a la brevedad.</p>;
  }
  return (
    <form action={quoteAction} className="form-grid">
      <input type="hidden" name="kind" value={kind} />
      {productId ? <input type="hidden" name="productId" value={productId} /> : null}
      <div className="sr-only" aria-hidden="true"><label>No completar<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      {error ? <p role="alert" className="alert alert-error small full">{error}</p> : null}
      <label className="field"><span>Nombre</span><input className="input" name="name" autoComplete="name" defaultValue={user?.name} required /></label>
      <label className="field"><span>Correo</span><input className="input" name="email" type="email" autoComplete="email" defaultValue={user?.email} required /></label>
      <label className="field"><span>Teléfono / WhatsApp</span><input className="input" name="phone" type="tel" autoComplete="tel" defaultValue={user?.phone ?? ''} /></label>
      <label className="field"><span>Región</span>
        <select className="select" name="region" defaultValue="Metropolitana">{REGION_NAMES.map((r) => <option key={r}>{r}</option>)}</select>
      </label>
      <label className="field full"><span>{kind === 'medida' ? '¿Qué mueble necesitas?' : 'Mensaje'}</span>
        <textarea className="textarea" name="message" required minLength={10}
          defaultValue={productName ? `Me interesa el ${productName} con estas modificaciones: ` : ''}
          placeholder={kind === 'medida' ? 'Modelo, medidas aproximadas, tela o color, cantidad, fecha en que lo necesitas…' : ''} />
      </label>
      <div className="full"><button className="btn btn-primary" type="submit">{kind === 'medida' ? 'Solicitar cotización' : 'Enviar mensaje'}</button></div>
    </form>
  );
}
