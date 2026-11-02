import { getSettings } from '@/lib/settings';
import { isWebpayTestMode } from '@/lib/webpay';
import { CheckoutForm } from './checkout-form';

export const metadata = { title: 'Finalizar compra', robots: { index: false } };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ cupon?: string }> }) {
  const [{ cupon }, s] = await Promise.all([searchParams, getSettings()]);
  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <h1 className="display" style={{ fontSize: 'clamp(40px,5vw,56px)', marginBottom: 28 }}>Finalizar compra</h1>
      <CheckoutForm
        coupon={cupon ?? null}
        pickupEnabled={s.pickupEnabled === '1'}
        pickupAddress={s.showroomAddress}
        testMode={isWebpayTestMode()}
      />
    </div>
  );
}
