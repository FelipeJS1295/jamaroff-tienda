// Aplica las migraciones de la base de datos (carpeta /drizzle)
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL ?? 'postgres://jamaroff:jamaroff@localhost:5432/jamaroff';

async function main() {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder: './drizzle' });
  await client.end();
  console.log('✓ Base de datos al día');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
