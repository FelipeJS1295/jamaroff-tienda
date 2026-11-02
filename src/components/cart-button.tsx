'use client';

import Link from 'next/link';
import { useCart } from './cart-context';
import { BagIcon } from './icons';

export function CartButton() {
  const { count, ready } = useCart();
  return (
    <Link href="/carrito" className="icon-btn" aria-label={`Carrito, ${count} productos`}>
      <BagIcon />
      {ready && count > 0 ? <span className="cart-count">{count}</span> : null}
    </Link>
  );
}
