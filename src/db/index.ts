import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const url = process.env.DATABASE_URL ?? 'postgres://jamaroff:jamaroff@localhost:5432/jamaroff';

// Reutiliza la conexión entre recargas en desarrollo
const g = globalThis as unknown as { __pg?: ReturnType<typeof postgres> };
const client = g.__pg ?? postgres(url, { max: 10 });
if (process.env.NODE_ENV !== 'production') g.__pg = client;

export const db = drizzle(client, { schema });
export { schema };
