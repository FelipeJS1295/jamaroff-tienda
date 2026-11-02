import { CartView } from './cart-view';

export const metadata = { title: 'Carrito' };

export default function CarritoPage() {
  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <h1 className="display" style={{ fontSize: 'clamp(40px,5vw,56px)', marginBottom: 28 }}>Tu carrito</h1>
      <CartView />
    </div>
  );
}
