'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type CartLine = { productId: number; variantId: number | null; mode: 'stock' | 'pedido'; qty: number };

type CartCtx = {
  lines: CartLine[];
  ready: boolean;
  count: number;
  add: (line: CartLine) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const KEY = 'jam_cart_v1';
const Ctx = createContext<CartCtx | null>(null);

export const keyOf = (l: Pick<CartLine, 'productId' | 'variantId' | 'mode'>) => `${l.productId}:${l.variantId ?? 0}:${l.mode}`;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {}
  }, [lines, ready]);

  const add = useCallback((line: CartLine) => {
    setLines((prev) => {
      const k = keyOf(line);
      const found = prev.find((l) => keyOf(l) === k);
      if (found) return prev.map((l) => (keyOf(l) === k ? { ...l, qty: Math.min(999, l.qty + line.qty) } : l));
      return [...prev, line];
    });
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setLines((prev) => prev.map((l) => (keyOf(l) === key ? { ...l, qty: Math.max(1, Math.min(999, qty)) } : l)));
  }, []);

  const remove = useCallback((key: string) => setLines((prev) => prev.filter((l) => keyOf(l) !== key)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(
    () => ({ lines, ready, count: lines.reduce((a, l) => a + l.qty, 0), add, setQty, remove, clear }),
    [lines, ready, add, setQty, remove, clear],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart fuera de CartProvider');
  return c;
}
