import './libro.css';

// El catálogo digital va sin el header ni el pie de la tienda: es un libro a pantalla completa
export default function LibroLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preload" href="/fonts/bodoni-moda-latin-standard-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
      <link rel="preload" href="/fonts/hanken-grotesk-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
      <link rel="preload" href="/fonts/cormorant-garamond-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
      {children}
    </>
  );
}
