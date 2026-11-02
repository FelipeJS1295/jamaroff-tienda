// Crea (o actualiza) un usuario administrador.
// Uso: npm run admin:create -- correo@dominio.cl "Nombre" "contraseña-segura"
import bcrypt from 'bcryptjs';
import postgres from 'postgres';

const url = process.env.DATABASE_URL ?? 'postgres://jamaroff:jamaroff@localhost:5432/jamaroff';

async function main() {
  const [email, name, password] = process.argv.slice(2);
  if (!email || !name || !password) {
    console.error('Uso: npm run admin:create -- correo@dominio.cl "Nombre" "contraseña"');
    process.exit(1);
  }
  if (password.length < 10) {
    console.error('La contraseña debe tener al menos 10 caracteres.');
    process.exit(1);
  }
  const sql = postgres(url, { max: 1 });
  const hash = await bcrypt.hash(password, 12);
  await sql`
    insert into users (email, password_hash, name, role)
    values (${email.toLowerCase().trim()}, ${hash}, ${name}, 'admin')
    on conflict (email) do update set password_hash = excluded.password_hash, name = excluded.name, role = 'admin'`;
  await sql.end();
  console.log(`✓ Administrador listo: ${email}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
