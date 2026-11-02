import { db, schema } from '@/db';

// Ajustes editables desde Admin › Ajustes. Los valores por defecto se muestran
// hasta que los completes.
export const SETTING_DEFAULTS = {
  whatsapp: '',
  contactEmail: '',
  showroomAddress: '',
  showroomHours: '',
  instagram: '',
  bankTransferInfo: 'Banco: [BANCO]\nTipo de cuenta: [TIPO]\nNúmero: [NÚMERO]\nTitular: [RAZÓN SOCIAL]\nRUT: [RUT]\nCorreo: [CORREO]',
  pickupEnabled: '1',
  heroProduct: 'seccional-beige-con-chaise',
  atelierProduct: 'seccional-cobre-con-chaise',
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = Record<SettingKey, string>;

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(schema.settings);
  const out = { ...SETTING_DEFAULTS } as Settings;
  for (const r of rows) {
    if (r.key in out) out[r.key as SettingKey] = r.value;
  }
  return out;
}

export function whatsappLink(number: string, text?: string) {
  const digits = number.replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
