import { notFound } from 'next/navigation';
import { getBook, isCatalogSlug } from '@/lib/catalog-book';
import { getCurrentUser } from '@/lib/auth';
import { getSettings, whatsappLink } from '@/lib/settings';
import { BookViewer } from '@/components/book-viewer';

export const dynamic = 'force-dynamic';

async function load(slug: string) {
  if (!isCatalogSlug(slug)) return null;
  const user = await getCurrentUser();
  // Los borradores solo los ve el admin
  return getBook(slug, { includeDraft: user?.role === 'admin' });
}

export async function generateMetadata({ params }: { params: Promise<{ catalogo: string }> }) {
  const { catalogo } = await params;
  const book = await load(catalogo);
  if (!book) return { title: 'Página no encontrada' };
  const cover = book.pages.find((p) => p.imageUrl)?.imageUrl ?? book.pages.find((p) => p.product?.images[0])?.product?.images[0];
  return {
    title: book.title,
    description: book.subtitle ?? `${book.title} de Jamaroff Home Atelier: sofás y muebles, telas, colores y medidas.`,
    openGraph: { images: cover ? [cover] : [] },
    robots: book.published ? undefined : { index: false },
  };
}

export default async function CatalogoPage({ params }: { params: Promise<{ catalogo: string }> }) {
  const { catalogo } = await params;
  const [book, settings] = await Promise.all([load(catalogo), getSettings()]);
  if (!book) notFound();
  return <BookViewer book={book} whatsapp={settings.whatsapp ? whatsappLink(settings.whatsapp) : null} instagram={settings.instagram || null} />;
}
