'use client';

import { useEffect, useState } from 'react';
import { useCart } from './cart-context';

export type PricedLine = {
  key: string; productId: number; variantId: number | null; mode: 'stock' | 'pedido'; qty: number;
  name: string; slug: string; variantName: string | null; imageUrl: string | null;
  unitPrice: number; retailUnitPrice: number; lineTotal: number; leadTimeDays: number | null;
  maxQty: number | null; wholesaleApplied: boolean; wholesaleMinQty: number | null; error: string | null;
};

export type PricedCart = {
  lines: PricedLine[]; subtotal: number; volume: number; leadTime: number | null; hasErrors: boolean; wholesale: boolean;
  discount: number; couponError: string | null; couponCode: string | null;
  user: null | { name: string; email: string; phone: string | null; wholesale: boolean; companyName: string | null; companyRut: string | null; companyGiro: string | null };
};

export function usePricedCart(coupon: string | null) {
  const { lines, ready } = useCart();
  const [data, setData] = useState<PricedCart | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    let cancel = false;
    setLoading(true);
    fetch('/api/carrito', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines, coupon }) })
      .then((r) => r.json())
      .then((j) => { if (!cancel) setData(j); })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [lines, ready, coupon]);

  return { data, loading: loading || !ready };
}
