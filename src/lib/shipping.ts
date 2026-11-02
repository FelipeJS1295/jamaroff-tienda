import type { PackageSpec, ShippingZone } from '@/db/schema';
import { normalize } from './chile';

/** Volumen embalado total en m³ (redondeado a 2 decimales) */
export function packagesVolume(packages: PackageSpec[], qty = 1) {
  const cm3 = packages.reduce((acc, p) => acc + (p.largo || 0) * (p.ancho || 0) * (p.alto || 0), 0);
  return Math.round((cm3 / 1_000_000) * qty * 100) / 100;
}

export function packagesWeight(packages: PackageSpec[], qty = 1) {
  return packages.reduce((acc, p) => acc + (p.peso || 0), 0) * qty;
}

/** Busca la zona que aplica: primero por comuna, luego por región */
export function findZone(zones: ShippingZone[], region: string, comuna: string) {
  const active = zones.filter((z) => z.active).sort((a, b) => a.position - b.position);
  const c = normalize(comuna);
  const r = normalize(region);
  return (
    active.find((z) => z.comunas.some((x) => normalize(x) === c)) ??
    active.find((z) => z.comunas.length === 0 && z.regions.some((x) => normalize(x) === r)) ??
    null
  );
}

export type ShippingQuote =
  | { kind: 'price'; zone: string; cost: number; eta: string; volume: number }
  | { kind: 'quote'; zone: string | null; eta: string; volume: number };

export function quoteShipping(zones: ShippingZone[], region: string, comuna: string, volumeM3: number, subtotal: number): ShippingQuote {
  const zone = findZone(zones, region, comuna);
  if (!zone || zone.quoteOnly) {
    return { kind: 'quote', zone: zone?.name ?? null, eta: zone?.etaText ?? 'Te contactamos con el costo', volume: volumeM3 };
  }
  if (zone.freeOver && subtotal >= zone.freeOver) {
    return { kind: 'price', zone: zone.name, cost: 0, eta: zone.etaText, volume: volumeM3 };
  }
  const raw = zone.baseRate + zone.ratePerM3 * volumeM3;
  const cost = Math.max(zone.minRate, Math.ceil(raw / 100) * 100); // redondeo a $100
  return { kind: 'price', zone: zone.name, cost, eta: zone.etaText, volume: volumeM3 };
}
