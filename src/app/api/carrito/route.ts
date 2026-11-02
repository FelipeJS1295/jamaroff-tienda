import { NextResponse } from 'next/server';
import { priceCart, sanitizeLines, applyCoupon } from '@/lib/cart';
import { getCurrentUser } from '@/lib/auth';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const lines = sanitizeLines(body.lines);
  const user = await getCurrentUser();
  const cart = await priceCart(lines, user);
  const coupon = await applyCoupon(typeof body.coupon === 'string' ? body.coupon : null, cart.subtotal);
  return NextResponse.json({
    ...cart,
    discount: coupon.discount,
    couponError: coupon.error,
    couponCode: coupon.coupon?.code ?? null,
    user: user ? { name: user.name, email: user.email, phone: user.phone, wholesale: user.wholesaleStatus === 'approved', companyName: user.companyName, companyRut: user.companyRut, companyGiro: user.companyGiro } : null,
  });
}
