// Horas de la escena "Luz del día". 0 = medianoche (se muestra al final del día).
export const LIGHT_HOURS = [8, 10, 12, 15, 18, 21, 0] as const;
export type LightHour = (typeof LIGHT_HOURS)[number];

export const LIGHT_LABEL: Record<LightHour, string> = {
  8: 'Mañana',
  10: 'Media mañana',
  12: 'Mediodía',
  15: 'Tarde',
  18: 'Atardecer',
  21: 'Noche',
  0: 'Medianoche',
};

/** Hora en la línea del día: la medianoche va después de las 21 h */
export const dayHour = (h: number) => (h === 0 ? 24 : h);
export const hourText = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
