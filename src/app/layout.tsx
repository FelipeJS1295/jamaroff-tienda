import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CartProvider } from '@/components/cart-context';

const siteUrl = process.env.SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Jamaroff Home Atelier · Muebles en stock y a pedido', template: '%s · Jamaroff' },
  description: 'Sofás y muebles con diseño de atelier, en stock o fabricados a tu medida. Despacho a todo Chile.',
  openGraph: { siteName: 'Jamaroff Home Atelier', locale: 'es_CL', type: 'website' },
};

export const viewport: Viewport = { themeColor: '#1C2620' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Jost:wght@300;400;500;600&display=swap"
        />
      </head>
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
