export function clp(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CL');
}

export function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function fecha(d: Date | string | null | undefined) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Santiago' });
}

export function fechaHora(d: Date | string | null | undefined) {
  if (!d) return '';
  return new Date(d).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' });
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pendiente_pago: 'Pendiente de pago',
  pagado: 'Pagado',
  en_fabricacion: 'En fabricación',
  listo_despacho: 'Listo para despacho',
  despachado: 'Despachado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export const ORDER_FLOW = ['pagado', 'en_fabricacion', 'listo_despacho', 'despachado', 'entregado'] as const;

export const MODE_LABEL: Record<string, string> = { stock: 'En stock', pedido: 'A pedido', ambos: 'En stock y a pedido' };

/** Valida un RUT chileno (formato 12.345.678-9 o 12345678-9) */
export function validRut(rut: string) {
  const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (sum % 11);
  const expected = res === 11 ? '0' : res === 10 ? 'K' : String(res);
  return dv === expected;
}
