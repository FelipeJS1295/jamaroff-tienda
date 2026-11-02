import { CatalogView } from '@/components/catalog-view';

export const metadata = { title: 'Catálogo' };

export default async function CatalogoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <CatalogView searchParams={await searchParams} />;
}
