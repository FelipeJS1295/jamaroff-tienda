import { notFound } from 'next/navigation';
import { CatalogView } from '@/components/catalog-view';
import { getMenuCategories } from '@/lib/catalog';

export async function generateMetadata({ params }: { params: Promise<{ categoria: string }> }) {
  const { categoria } = await params;
  const cat = (await getMenuCategories()).find((c) => c.slug === categoria);
  return { title: cat?.name ?? 'Catálogo', description: cat?.description ?? undefined };
}

export default async function CategoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoria: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { categoria } = await params;
  const cats = await getMenuCategories();
  if (!cats.some((c) => c.slug === categoria)) notFound();
  return <CatalogView categorySlug={categoria} searchParams={await searchParams} />;
}
