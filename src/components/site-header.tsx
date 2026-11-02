import { getMenuCategories } from '@/lib/catalog';
import { getCurrentUser } from '@/lib/auth';
import { HeaderShell } from './header-shell';

export async function SiteHeader() {
  const [cats, user] = await Promise.all([getMenuCategories(), getCurrentUser()]);
  return (
    <HeaderShell
      categories={cats.map((c) => ({ name: c.name, slug: c.slug }))}
      accountLabel={user ? `Mi cuenta (${user.name})` : 'Ingresar a mi cuenta'}
    />
  );
}
