// T19: deja las cuatro cuentas demo con su correo y la contraseña publicada.
// Uso: SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/restablecer-cuentas-demo.mjs
// La llave service_role nunca se guarda en el repositorio.

const PASSWORD = 'Agora-demo-2026!';
const CUENTAS = [
  ['f1000000-0000-0000-0000-000000000001', 'fundacion@demo.agora.test'],
  ['f1000000-0000-0000-0000-000000000002', 'tienda@demo.agora.test'],
  ['f1000000-0000-0000-0000-000000000003', 'repartidor@demo.agora.test'],
  ['f1000000-0000-0000-0000-000000000004', 'comprador@demo.agora.test'],
];

const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

let fallos = 0;
for (const [id, email] of CUENTAS) {
  const res = await fetch(`${url}/auth/v1/admin/users/${id}`, {
    method: 'PUT',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true, ban_duration: 'none' }),
  });
  if (res.ok) {
    console.log(`ok     ${email}`);
  } else {
    fallos++;
    console.error(`error  ${email}: ${res.status} ${await res.text()}`);
  }
}
process.exit(fallos ? 1 : 0);
