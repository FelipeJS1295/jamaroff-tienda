import 'server-only';
import nodemailer from 'nodemailer';
import type { Order, OrderItem } from '@/db/schema';
import { clp, ORDER_STATUS_LABEL } from './format';

const siteUrl = () => (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

function transport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  const port = Number(process.env.SMTP_PORT ?? 465);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function esc(s: string | null | undefined) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function layout(title: string, body: string) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#F7F2EA;font-family:Arial,Helvetica,sans-serif;color:#1A1916">
<div style="max-width:600px;margin:0 auto;padding:24px">
  <div style="background:#121110;padding:20px 24px;color:#F7F2EA;font-size:22px;letter-spacing:3px">JAMAROFF <span style="font-size:11px;color:#DDB582;letter-spacing:2px">HOME ATELIER</span></div>
  <div style="background:#FFFDF9;padding:28px 24px;border:1px solid #E6DED2;border-top:0">
    <h1 style="font-size:22px;margin:0 0 16px;font-weight:normal">${esc(title)}</h1>
    ${body}
  </div>
  <p style="font-size:12px;color:#5E574E;text-align:center">Jamaroff Home Atelier · <a href="${siteUrl()}" style="color:#4C7556">${siteUrl().replace(/^https?:\/\//, '')}</a></p>
</div></body></html>`;
}

export async function sendMail(to: string, subject: string, html: string) {
  const t = transport();
  if (!t) {
    console.info(`[correo no configurado] Para: ${to} · Asunto: ${subject}`);
    return;
  }
  try {
    await t.sendMail({ from: process.env.MAIL_FROM ?? process.env.SMTP_USER, to, subject, html });
  } catch (e) {
    console.error('Error enviando correo', e);
  }
}

function itemsTable(items: OrderItem[]) {
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">${items
    .map(
      (i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #E6DED2">${i.quantity} × ${esc(i.name)}${i.variantName ? ` · ${esc(i.variantName)}` : ''}<br><span style="color:#5E574E;font-size:12px">${i.mode === 'pedido' ? `A pedido${i.leadTimeDays ? ` · fabricación ${i.leadTimeDays} días` : ''}` : 'En stock'}</span></td><td style="padding:8px 0;border-bottom:1px solid #E6DED2;text-align:right">${clp(i.unitPrice * i.quantity)}</td></tr>`,
    )
    .join('')}</table>`;
}

function totals(o: Order) {
  return `<table style="width:100%;font-size:14px">
<tr><td>Subtotal</td><td style="text-align:right">${clp(o.subtotal)}</td></tr>
${o.discount ? `<tr><td>Descuento${o.couponCode ? ` (${esc(o.couponCode)})` : ''}</td><td style="text-align:right">-${clp(o.discount)}</td></tr>` : ''}
<tr><td>Despacho</td><td style="text-align:right">${o.deliveryMethod === 'retiro' ? 'Retiro en showroom' : o.shippingToQuote ? 'A cotizar' : clp(o.shippingCost)}</td></tr>
<tr><td style="padding-top:8px"><strong>Total</strong></td><td style="text-align:right;padding-top:8px"><strong>${clp(o.total)}</strong></td></tr></table>`;
}

export function orderLink(o: Order) {
  return `${siteUrl()}/pedido/${o.number}?t=${o.accessToken}`;
}

export async function mailOrderReceived(o: Order, items: OrderItem[], bankInfo?: string) {
  const transfer = o.paymentMethod === 'transferencia' && o.paymentStatus !== 'pagado';
  const body = `<p>Hola ${esc(o.name)}, ${transfer ? 'recibimos tu pedido. Para confirmarlo, realiza la transferencia con estos datos:' : 'tu pago fue aprobado y tu pedido está confirmado.'}</p>
${transfer && bankInfo ? `<pre style="background:#F7F2EA;padding:12px;font-family:inherit;white-space:pre-wrap">${esc(bankInfo)}\nMonto: ${clp(o.total)}\nAsunto: Pedido ${esc(o.number)}</pre>` : ''}
<p><strong>Pedido ${esc(o.number)}</strong></p>${itemsTable(items)}${totals(o)}
<p style="margin-top:24px"><a href="${orderLink(o)}" style="background:#4C7556;color:#fff;padding:12px 20px;text-decoration:none;display:inline-block">Ver mi pedido</a></p>`;
  await sendMail(o.email, `Pedido ${o.number} ${transfer ? 'recibido' : 'confirmado'} · Jamaroff`, layout(transfer ? 'Recibimos tu pedido' : '¡Gracias por tu compra!', body));
}

export async function mailAdminNewOrder(o: Order, items: OrderItem[]) {
  const to = process.env.ADMIN_NOTIFY_EMAIL;
  if (!to) return;
  const body = `<p>${esc(o.name)} · ${esc(o.email)} · ${esc(o.phone)}${o.isWholesale ? ' · <strong>MAYORISTA</strong>' : ''}</p>
<p>${o.deliveryMethod === 'retiro' ? 'Retiro en showroom' : `${esc(o.address)}, ${esc(o.comuna)}, ${esc(o.region)}`}</p>
<p>Pago: ${o.paymentMethod === 'webpay' ? 'Webpay' : 'Transferencia'} · ${o.paymentStatus}</p>${itemsTable(items)}${totals(o)}
<p><a href="${siteUrl()}/admin/pedidos/${o.id}">Abrir en el admin</a></p>`;
  await sendMail(to, `Nuevo pedido ${o.number} · ${clp(o.total)}`, layout(`Nuevo pedido ${o.number}`, body));
}

export async function mailStatusChange(o: Order) {
  const label = ORDER_STATUS_LABEL[o.status] ?? o.status;
  const extra =
    o.status === 'despachado' && (o.carrier || o.trackingCode)
      ? `<p>Transporte: ${esc(o.carrier)}${o.trackingCode ? `<br>N° de seguimiento: <strong>${esc(o.trackingCode)}</strong>` : ''}</p>`
      : '';
  const body = `<p>Hola ${esc(o.name)}, tu pedido <strong>${esc(o.number)}</strong> cambió de estado:</p>
<p style="font-size:20px;color:#4C7556">${esc(label)}</p>${extra}
<p><a href="${orderLink(o)}" style="background:#4C7556;color:#fff;padding:12px 20px;text-decoration:none;display:inline-block">Ver mi pedido</a></p>`;
  await sendMail(o.email, `Tu pedido ${o.number}: ${label}`, layout(`Pedido ${o.number}`, body));
}

export async function mailWholesaleDecision(email: string, name: string, approved: boolean) {
  const body = approved
    ? `<p>Hola ${esc(name)}, tu cuenta mayorista fue aprobada. Desde ahora verás tus precios mayoristas al ingresar a la tienda.</p><p><a href="${siteUrl()}/catalogo" style="background:#4C7556;color:#fff;padding:12px 20px;text-decoration:none;display:inline-block">Ver catálogo</a></p>`
    : `<p>Hola ${esc(name)}, revisamos tu solicitud de cuenta mayorista y por ahora no pudimos aprobarla. Responde este correo si quieres más información.</p>`;
  await sendMail(email, approved ? 'Tu cuenta mayorista fue aprobada · Jamaroff' : 'Tu solicitud mayorista · Jamaroff', layout(approved ? 'Cuenta mayorista aprobada' : 'Solicitud mayorista', body));
}

export async function mailAdminNotice(subject: string, lines: Record<string, string | null | undefined>) {
  const to = process.env.ADMIN_NOTIFY_EMAIL;
  if (!to) return;
  const body = Object.entries(lines)
    .filter(([, v]) => v)
    .map(([k, v]) => `<p style="margin:0 0 8px"><strong>${esc(k)}:</strong> ${esc(v).replace(/\n/g, '<br>')}</p>`)
    .join('');
  await sendMail(to, subject, layout(subject, body));
}
