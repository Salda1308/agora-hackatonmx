// T27: sube las fotos de ejemplo al bucket privado `publicaciones`, en la carpeta de cada organización.
// Uso: SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node supabase/datos-ejemplo/subir-imagenes.mjs
// Después corre aplicar.sql. Es idempotente (x-upsert). La llave nunca se guarda en el repositorio.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORG = {
  abuela: 'f2000000-0000-0000-0000-000000000001',
  albergue: 'f5000000-0000-0000-0000-000000000001',
  girasoles: 'f5000000-0000-0000-0000-000000000003',
  semillas: 'e2700000-0000-0000-0000-000000000001',
  huellitas: 'e2700000-0000-0000-0000-000000000002',
};
// [archivo, organización, número de objeto] (debe coincidir con aplicar.sql)
const IMAGENES = [
  ['solicitud-agua-garrafones.jpg', ORG.albergue, 1],
  ['solicitud-higiene-jabones.jpg', ORG.girasoles, 2],
  ['solicitud-despensa-verduras.jpg', ORG.abuela, 3],
  ['solicitud-leche.jpg', ORG.abuela, 4],
  ['solicitud-cobijas.jpg', ORG.albergue, 5],
  ['solicitud-utiles-escolares.jpg', ORG.semillas, 6],
  ['solicitud-croquetas-refugio.jpg', ORG.huellitas, 7],
  ['solicitud-botiquin.jpg', ORG.girasoles, 8],
  ['solicitud-desayunos-avena.jpg', ORG.semillas, 9],
  ['solicitud-cepillos-dientes.jpg', ORG.albergue, 10],
  ['publicacion-limpieza-albergue.jpg', ORG.albergue, 11],
  ['publicacion-domino.jpg', ORG.abuela, 12],
  ['publicacion-comedor.jpg', ORG.girasoles, 13],
  ['publicacion-lectura.jpg', ORG.abuela, 14],
  ['publicacion-refugio-perrito.jpg', ORG.huellitas, 15],
  ['publicacion-mural.jpg', ORG.semillas, 16],
  ['solicitud-despensa-verduras.jpg', ORG.abuela, 17],
  ['solicitud-higiene-jabones.jpg', ORG.abuela, 18],
];

const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const carpeta = join(dirname(fileURLToPath(import.meta.url)), 'imagenes');
let fallos = 0;
for (const [archivo, org, n] of IMAGENES) {
  const ruta = `${org}/e2780000-0000-0000-0000-${String(n).padStart(12, '0')}.jpg`;
  const res = await fetch(`${url}/storage/v1/object/publicaciones/${ruta}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
    body: await readFile(join(carpeta, archivo)),
  });
  if (res.ok) {
    console.log(`ok     ${archivo} -> ${ruta}`);
  } else {
    fallos++;
    console.error(`error  ${archivo}: ${res.status} ${await res.text()}`);
  }
}
process.exit(fallos ? 1 : 0);
