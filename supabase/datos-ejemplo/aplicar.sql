-- T27: datos de ejemplo bonitos para el sitio. NO es migración.
-- Idempotente: actualiza en sitio las filas de ejemplo y agrega las nuevas con ids fijos.
-- No borra ni cambia filas con pagos, pedidos, tareas, entregas, perfiles o tiendas_cobro,
-- y nunca sobrescribe contadores de unidades ya existentes.
-- Orden en el alojado: primero subir-imagenes.mjs, luego este archivo. Si una imagen aún no
-- está en el bucket, el script la omite y lo avisa con NOTICE (se puede volver a correr).
-- Cada solicitud trae al menos un artículo de $0.01 para probar pagos reales de un centavo.
begin;

-- 1. Organizaciones (ids existentes conservados; dos fundaciones nuevas) --------------
insert into public.organizaciones
  (id, tipo, categoria, nombre, slug, descripcion, direccion_publica, latitud, longitud, verificada, verificada_en, es_ejemplo)
values
  ('f2000000-0000-0000-0000-000000000001', 'fundacion', 'asilo', 'Casa de la Abuela', 'casa-de-la-abuela',
   'Acompañamos a 28 personas mayores con comida caliente, cuidados diarios y muchas tardes de plática. Aquí nadie envejece en soledad.',
   'Col. Toriello Guerra, Tlalpan, Ciudad de México', 19.2955, -99.1712, true, now(), true),
  ('f2000000-0000-0000-0000-000000000002', 'tienda', null, 'Despensa del Barrio', 'despensa-del-barrio',
   'Tienda de abarrotes de la colonia desde hace 20 años. Surtimos las solicitudes con precio justo y entregamos en el mostrador.',
   'Calle Coahuila 112, Col. Roma Sur, Ciudad de México', 19.4119, -99.1626, true, now(), true),
  ('f5000000-0000-0000-0000-000000000001', 'fundacion', 'albergue', 'Albergue Camino a Casa', 'albergue-camino-a-casa',
   'Damos techo, cena y regaderas a personas en situación de calle mientras encuentran trabajo y un lugar propio.',
   'Col. Guerrero, Cuauhtémoc, Ciudad de México', 19.4419, -99.1450, true, now(), true),
  ('f5000000-0000-0000-0000-000000000002', 'tienda', null, 'Abarrotes La Esquina', 'abarrotes-la-esquina',
   'Abarrotes, artículos de limpieza y agua purificada. Atendemos a las fundaciones de la zona con entrega el mismo día.',
   null, null, null, true, now(), true),
  ('f5000000-0000-0000-0000-000000000003', 'fundacion', 'asilo', 'Hogar Los Girasoles', 'hogar-los-girasoles',
   'Casa de retiro para 15 adultas mayores. Por su seguridad no publicamos la dirección; las entregas se coordinan con la tienda.',
   null, null, null, true, now(), true),
  ('e2700000-0000-0000-0000-000000000001', 'fundacion', 'albergue', 'Casa Hogar Semillas', 'casa-hogar-semillas',
   'Hogar temporal para niñas y niños mientras se resuelve su situación familiar. Escuela, juego y tareas todos los días.',
   'Col. Santa María la Ribera, Ciudad de México', 19.4502, -99.1590, true, now(), true),
  ('e2700000-0000-0000-0000-000000000002', 'fundacion', 'refugio_animales', 'Refugio Huellitas de Coyoacán', 'refugio-huellitas-coyoacan',
   'Rescatamos, curamos y damos en adopción a perros y gatos de la calle. Hoy cuidamos a 42 peludos.',
   'Col. El Rosario, Coyoacán, Ciudad de México', 19.3360, -99.1440, true, now(), true)
on conflict (id) do update set
  nombre = excluded.nombre, slug = excluded.slug, descripcion = excluded.descripcion,
  direccion_publica = excluded.direccion_publica, latitud = excluded.latitud, longitud = excluded.longitud,
  es_ejemplo = true;

-- 2. Catálogo -------------------------------------------------------------------------
-- Nombres limpios para los artículos de ejemplo existentes (precio sin cambios).
update public.catalogo_articulos c set nombre = v.nombre
from (values
  ('f5100000-0000-0000-0000-000000000001'::uuid, 'Garrafón de agua, precio de prueba $0.01'),
  ('f5100000-0000-0000-0000-000000000002'::uuid, 'Jabón de tocador, precio de prueba $0.01'),
  ('f8100000-0000-0000-0000-000000000001'::uuid, 'Paquete de pañales para adulto'),
  ('f8100000-0000-0000-0000-000000000002'::uuid, 'Arroz 1 kg'),
  ('f8100000-0000-0000-0000-000000000003'::uuid, 'Leche entera 1 L'),
  ('f8100000-0000-0000-0000-000000000004'::uuid, 'Jabón de tocador'),
  ('f0700000-0000-0000-0000-000000000001'::uuid, 'Garrafón de agua, precio de prueba $0.01'),
  ('f0700000-0000-0000-0000-000000000002'::uuid, 'Arroz 1 kg, precio de prueba $0.01')
) as v(id, nombre)
where c.id = v.id and c.es_ejemplo;

insert into public.catalogo_articulos (id, tienda_id, nombre, unidad, precio_centavos, es_ejemplo)
values
  ('e2710000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'Cobija matrimonial de polar', 'pieza', 18900, true),
  ('e2710000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002', 'Cuaderno profesional de 100 hojas', 'pieza', 4500, true),
  ('e2710000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000002', 'Caja de colores y lápiz escolar', 'paquete', 6900, true),
  ('e2710000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000002', 'Croquetas para perro adulto 20 kg', 'bulto', 74900, true),
  ('e2710000-0000-0000-0000-000000000005', 'f2000000-0000-0000-0000-000000000002', 'Avena en hojuelas 1 kg', 'bolsa', 4200, true),
  ('e2710000-0000-0000-0000-000000000006', 'f2000000-0000-0000-0000-000000000002', 'Frijol negro 1 kg', 'bolsa', 3800, true),
  ('e2710000-0000-0000-0000-000000000007', 'f2000000-0000-0000-0000-000000000002', 'Cepillo de dientes', 'pieza', 1800, true),
  ('e2710000-0000-0000-0000-000000000008', 'f2000000-0000-0000-0000-000000000002', 'Pasta dental 100 ml', 'pieza', 2600, true),
  ('e2710000-0000-0000-0000-000000000009', 'f2000000-0000-0000-0000-000000000002', 'Botiquín de primeros auxilios', 'pieza', 34900, true),
  ('e2710000-0000-0000-0000-000000000010', 'f2000000-0000-0000-0000-000000000002', 'Gasas y vendas', 'paquete', 8500, true),
  ('e2710000-0000-0000-0000-000000000011', 'f2000000-0000-0000-0000-000000000002', 'Cobija, precio de prueba $0.01', 'pieza', 1, true),
  ('e2710000-0000-0000-0000-000000000012', 'f2000000-0000-0000-0000-000000000002', 'Cuaderno, precio de prueba $0.01', 'pieza', 1, true),
  ('e2710000-0000-0000-0000-000000000013', 'f2000000-0000-0000-0000-000000000002', 'Croquetas, precio de prueba $0.01', 'bulto', 1, true),
  ('e2710000-0000-0000-0000-000000000014', 'f2000000-0000-0000-0000-000000000002', 'Avena, precio de prueba $0.01', 'bolsa', 1, true),
  ('e2710000-0000-0000-0000-000000000015', 'f2000000-0000-0000-0000-000000000002', 'Cepillo de dientes, precio de prueba $0.01', 'pieza', 1, true),
  ('e2710000-0000-0000-0000-000000000016', 'f2000000-0000-0000-0000-000000000002', 'Gasas, precio de prueba $0.01', 'paquete', 1, true),
  ('e2710000-0000-0000-0000-000000000017', 'f2000000-0000-0000-0000-000000000002', 'Leche, precio de prueba $0.01', 'pieza', 1, true),
  ('e2710000-0000-0000-0000-000000000019', 'f5000000-0000-0000-0000-000000000002', 'Garrafón de agua 20 L', 'pieza', 4200, true),
  ('e2710000-0000-0000-0000-000000000020', 'f5000000-0000-0000-0000-000000000002', 'Jabón de tocador', 'pieza', 1600, true),
  ('e2710000-0000-0000-0000-000000000021', 'f5000000-0000-0000-0000-000000000002', 'Shampoo 750 ml', 'pieza', 5900, true)
on conflict (id) do update set nombre = excluded.nombre, activo = true;

-- 3. Solicitudes ----------------------------------------------------------------------
-- Existentes: solo texto. Nuevas: se crean publicadas con fechas escalonadas.
update public.solicitudes s set titulo = v.titulo, descripcion = v.descripcion
from (values
  ('f5200000-0000-0000-0000-000000000001'::uuid, 'Agua purificada para el albergue',
   'Cada noche llegan más de 30 personas y el agua se termina antes del desayuno. Con garrafones de 20 litros podemos cocinar y ofrecer agua limpia toda la semana. Necesitamos completarla antes del 20 de noviembre.'),
  ('f5200000-0000-0000-0000-000000000002'::uuid, 'Jabón y shampoo para las abuelas',
   'Las residentes de Hogar Los Girasoles se bañan con ayuda todos los días y los artículos de higiene se acaban rápido. Un jabón y un shampoo les dan comodidad y dignidad.'),
  ('f8200000-0000-0000-0000-000000000001'::uuid, 'Despensa de noviembre para la Casa de la Abuela',
   'Preparamos tres comidas al día para 28 abuelos. Con arroz y pañales cubrimos la cocina y los cuidados del mes, y lo que llega se nota en cada plato.'),
  ('0ceb4ba0-07da-4f81-a1e6-5e1163fa44d6'::uuid, 'Arroz para la despensa de la semana',
   'El arroz rinde para todo: sopa, guisados y el arroz con leche de los domingos. Con unas bolsas más, la cocina de la Casa de la Abuela llega tranquila al fin de mes.'),
  ('f9cc1cd9-0308-49dc-8b3f-c4876b016cd6'::uuid, 'Agua, arroz y jabón para Los Laureles',
   'Un ancianato cercano nos pidió ayuda con lo básico de cada semana: agua para tomar, arroz para la comida y jabón para el baño diario. Es poco para ti y mucho para ellos.'),
  ('f9200000-0000-0000-0000-000000000001'::uuid, 'Leche y pañales para la semana',
   'La leche acompaña el desayuno y la merienda de los abuelos. Los pañales son lo que más gastamos y lo que más falta hace.')
) as v(id, titulo, descripcion)
where s.id = v.id;

insert into public.solicitudes (id, organizacion_id, tienda_id, titulo, descripcion, estado, publicada_en, es_ejemplo)
values
  ('e2720000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002',
   'Cobijas para las noches de frío',
   'En diciembre las madrugadas bajan a 5 grados y muchas camas del albergue solo tienen una sábana. Cada cobija es una noche tranquila para alguien que empieza de nuevo.',
   'publicada', now() - interval '2 days', true),
  ('e2720000-0000-0000-0000-000000000002', 'e2700000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002',
   'Útiles para terminar el semestre',
   'Las niñas y los niños de la casa ya casi tienen todo lo del semestre. Faltan unos cuadernos y colores para que nadie haga la tarea en hojas sueltas.',
   'publicada', now() - interval '6 days', true),
  ('e2720000-0000-0000-0000-000000000003', 'e2700000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002',
   'Croquetas para 42 peludos',
   'Cada semana se van cuatro bultos de croquetas. Con tu ayuda los perros del refugio comen bien mientras encuentran una familia.',
   'publicada', now() - interval '4 days', true),
  ('e2720000-0000-0000-0000-000000000004', 'f5000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000002',
   'Botiquín para la enfermería del hogar',
   'Nuestro botiquín ya no tiene gasas ni vendas. Queremos tener todo listo para curar raspones y caídas sin salir corriendo a la farmacia.',
   'publicada', now() - interval '1 hour', true),
  ('e2720000-0000-0000-0000-000000000005', 'e2700000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002',
   'Desayunos nutritivos antes de la escuela',
   'Un plato de avena con fruta y unos frijoles en la comida hacen la diferencia en la escuela. Buscamos cubrir los desayunos de todo el mes.',
   'publicada', now() - interval '3 days', true),
  ('e2720000-0000-0000-0000-000000000006', 'f5000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002',
   'Kits de higiene para quienes llegan hoy',
   'Muchas personas llegan al albergue sin nada. Un cepillo y pasta de dientes son lo primero que pedimos para recibirlas. Es urgente: esta semana se terminaron.',
   'publicada', now() - interval '12 hours', true)
on conflict (id) do update set titulo = excluded.titulo, descripcion = excluded.descripcion;

-- Artículos: nunca se actualizan si ya existen (los contadores se respetan).
insert into public.solicitud_articulos (id, solicitud_id, articulo_id, cantidad, unidades_pagadas)
select v.id::uuid, v.solicitud_id::uuid, v.articulo_id::uuid, v.cantidad, v.unidades_pagadas
from (values
  -- Existentes: se agregan artículos con precio real o de prueba.
  ('e2730000-0000-0000-0000-000000000001', 'f5200000-0000-0000-0000-000000000001', 'e2710000-0000-0000-0000-000000000019', 24, 9),
  ('e2730000-0000-0000-0000-000000000002', 'f5200000-0000-0000-0000-000000000002', 'e2710000-0000-0000-0000-000000000020', 30, 12),
  ('e2730000-0000-0000-0000-000000000003', 'f5200000-0000-0000-0000-000000000002', 'e2710000-0000-0000-0000-000000000021', 15, 4),
  ('e2730000-0000-0000-0000-000000000004', 'f8200000-0000-0000-0000-000000000001', 'f0700000-0000-0000-0000-000000000002', 200, 0),
  ('e2730000-0000-0000-0000-000000000005', 'f9200000-0000-0000-0000-000000000001', 'e2710000-0000-0000-0000-000000000017', 200, 0),
  -- Cobijas
  ('e2730000-0000-0000-0000-000000000011', 'e2720000-0000-0000-0000-000000000001', 'e2710000-0000-0000-0000-000000000001', 40, 14),
  ('e2730000-0000-0000-0000-000000000012', 'e2720000-0000-0000-0000-000000000001', 'e2710000-0000-0000-0000-000000000011', 200, 0),
  -- Útiles (casi completa)
  ('e2730000-0000-0000-0000-000000000021', 'e2720000-0000-0000-0000-000000000002', 'e2710000-0000-0000-0000-000000000002', 40, 36),
  ('e2730000-0000-0000-0000-000000000022', 'e2720000-0000-0000-0000-000000000002', 'e2710000-0000-0000-0000-000000000003', 20, 18),
  ('e2730000-0000-0000-0000-000000000023', 'e2720000-0000-0000-0000-000000000002', 'e2710000-0000-0000-0000-000000000012', 200, 0),
  -- Croquetas
  ('e2730000-0000-0000-0000-000000000031', 'e2720000-0000-0000-0000-000000000003', 'e2710000-0000-0000-0000-000000000004', 16, 5),
  ('e2730000-0000-0000-0000-000000000032', 'e2720000-0000-0000-0000-000000000003', 'e2710000-0000-0000-0000-000000000013', 200, 0),
  -- Botiquín (recién publicada)
  ('e2730000-0000-0000-0000-000000000041', 'e2720000-0000-0000-0000-000000000004', 'e2710000-0000-0000-0000-000000000009', 2, 0),
  ('e2730000-0000-0000-0000-000000000042', 'e2720000-0000-0000-0000-000000000004', 'e2710000-0000-0000-0000-000000000010', 10, 0),
  ('e2730000-0000-0000-0000-000000000043', 'e2720000-0000-0000-0000-000000000004', 'e2710000-0000-0000-0000-000000000016', 200, 0),
  -- Desayunos
  ('e2730000-0000-0000-0000-000000000051', 'e2720000-0000-0000-0000-000000000005', 'e2710000-0000-0000-0000-000000000005', 30, 11),
  ('e2730000-0000-0000-0000-000000000052', 'e2720000-0000-0000-0000-000000000005', 'e2710000-0000-0000-0000-000000000006', 25, 7),
  ('e2730000-0000-0000-0000-000000000053', 'e2720000-0000-0000-0000-000000000005', 'e2710000-0000-0000-0000-000000000014', 200, 0),
  -- Higiene (urgente: casi todo falta)
  ('e2730000-0000-0000-0000-000000000061', 'e2720000-0000-0000-0000-000000000006', 'e2710000-0000-0000-0000-000000000007', 60, 6),
  ('e2730000-0000-0000-0000-000000000062', 'e2720000-0000-0000-0000-000000000006', 'e2710000-0000-0000-0000-000000000008', 60, 4),
  ('e2730000-0000-0000-0000-000000000063', 'e2720000-0000-0000-0000-000000000006', 'e2710000-0000-0000-0000-000000000015', 200, 0)
) as v(id, solicitud_id, articulo_id, cantidad, unidades_pagadas)
where exists (select 1 from public.solicitudes s where s.id = v.solicitud_id::uuid)
on conflict do nothing;

-- Nombres limpios en las copias de artículos existentes (solo el texto copiado).
update public.solicitud_articulos sa set nombre = c.nombre
from public.catalogo_articulos c
where c.id = sa.articulo_id and c.es_ejemplo and sa.nombre <> c.nombre
  and sa.solicitud_id in (select id from public.solicitudes where es_ejemplo);

-- 4. Publicaciones ---------------------------------------------------------------------
insert into public.publicaciones (id, organizacion_id, texto, es_ejemplo, consentimiento, creada_en)
values
  ('f2400000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-000000000001',
   'Este sábado hacemos limpieza general del albergue: lavamos cobijas, ordenamos la bodega y dejamos todo listo para el invierno. Si tienes una mañana libre, inscríbete en la jornada.', true, true, now() - interval '3 hours'),
  ('f2400000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000001',
   'Torneo de dominó en la Casa de la Abuela. Don Chema ganó tres partidas seguidas y ya pidió revancha para el viernes.', true, true, now() - interval '1 day'),
  ('f2400000-0000-0000-0000-000000000003', 'f5000000-0000-0000-0000-000000000003',
   'Gracias a sus donaciones, esta semana la cocina del hogar tuvo caldo de pollo y verduras frescas todos los días. Las abuelas mandan un abrazo enorme.', true, true, now() - interval '2 days'),
  ('f1700000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001',
   'Buscamos voluntarios para nuestra tarde de lectura. Una hora de cuentos y plática alegra la semana de los abuelos. Revisa la jornada y aparta tu lugar.', true, true, now() - interval '5 hours'),
  ('e2740000-0000-0000-0000-000000000001', 'e2700000-0000-0000-0000-000000000002',
   'Este es Tamal: llegó al refugio con frío y mucho miedo. Hoy duerme calientito y busca familia. Ven a conocerlo en nuestra jornada de paseo y baño.', true, true, now() - interval '8 hours'),
  ('e2740000-0000-0000-0000-000000000002', 'e2700000-0000-0000-0000-000000000001',
   'Vamos a pintar un mural en el patio de la casa hogar y queremos que se llene de color. No hace falta saber pintar, solo ganas de ayudar.', true, true, now() - interval '30 hours')
on conflict (id) do update set texto = excluded.texto, consentimiento = true;

-- 5. Jornadas --------------------------------------------------------------------------
update public.jornadas j set titulo = v.titulo, descripcion = v.descripcion, requisitos = v.requisitos, ubicacion = v.ubicacion
from (values
  ('f1800000-0000-0000-0000-000000000001'::uuid, 'Tarde de lectura con los abuelos',
   'Leemos cuentos, poemas y el periódico en voz alta, y después platicamos con café y pan dulce.',
   'Mayores de 16 años. Ganas de escuchar.', 'Casa de la Abuela, Col. Toriello Guerra, Tlalpan'),
  ('f1800000-0000-0000-0000-000000000002'::uuid, 'Limpieza general del albergue',
   'Lavamos cobijas, limpiamos dormitorios y ordenamos la bodega para recibir el invierno.',
   'Mayores de 18 años. Guantes y ropa cómoda.', 'Albergue Camino a Casa, Col. Guerrero'),
  ('f1800000-0000-0000-0000-000000000003'::uuid, 'Pintura del comedor',
   'Pintamos el comedor de la Casa de la Abuela con colores cálidos.',
   'Ropa que se pueda manchar.', 'Casa de la Abuela, Col. Toriello Guerra, Tlalpan')
) as v(id, titulo, descripcion, requisitos, ubicacion)
where j.id = v.id;

-- Las dos jornadas futuras del seed se recorren si ya pasaron.
update public.jornadas set
  inicia_en = (date_trunc('day', now() at time zone 'America/Mexico_City') + interval '7 days 16 hours') at time zone 'America/Mexico_City',
  termina_en = (date_trunc('day', now() at time zone 'America/Mexico_City') + interval '7 days 19 hours') at time zone 'America/Mexico_City'
where id = 'f1800000-0000-0000-0000-000000000001' and inicia_en < now();
update public.jornadas set
  inicia_en = (date_trunc('day', now() at time zone 'America/Mexico_City') + interval '5 days 9 hours') at time zone 'America/Mexico_City',
  termina_en = (date_trunc('day', now() at time zone 'America/Mexico_City') + interval '5 days 13 hours') at time zone 'America/Mexico_City'
where id = 'f1800000-0000-0000-0000-000000000002' and inicia_en < now();

insert into public.jornadas
  (id, organizacion_id, titulo, descripcion, requisitos, ubicacion, inicia_en, termina_en, cupos, es_ejemplo)
values
  ('e2760000-0000-0000-0000-000000000001', 'e2700000-0000-0000-0000-000000000001',
   'Mural en el patio de Casa Hogar Semillas', 'Pintamos juntos un mural de colores en el patio donde juegan las niñas y los niños.',
   'Mayores de 18 años. Ropa que se pueda manchar; nosotros ponemos la pintura.', 'Casa Hogar Semillas, Col. Santa María la Ribera',
   (date_trunc('day', now() at time zone 'America/Mexico_City') + interval '10 days 10 hours') at time zone 'America/Mexico_City',
   (date_trunc('day', now() at time zone 'America/Mexico_City') + interval '10 days 14 hours') at time zone 'America/Mexico_City', 15, true),
  ('e2760000-0000-0000-0000-000000000002', 'e2700000-0000-0000-0000-000000000002',
   'Paseo y baño de perritos', 'Sacamos a pasear a los perros del refugio y después los bañamos para sus fotos de adopción.',
   'Mayores de 16 años. Tenis cómodos y paciencia.', 'Refugio Huellitas, Col. El Rosario, Coyoacán',
   (date_trunc('day', now() at time zone 'America/Mexico_City') + interval '12 days 9 hours') at time zone 'America/Mexico_City',
   (date_trunc('day', now() at time zone 'America/Mexico_City') + interval '12 days 13 hours') at time zone 'America/Mexico_City', 10, true)
on conflict (id) do update set titulo = excluded.titulo, descripcion = excluded.descripcion,
  requisitos = excluded.requisitos, ubicacion = excluded.ubicacion;

-- 6. Imágenes: solo si el objeto ya está en el bucket (el disparador de T25 lo exige) ---
create temporary table t27_imagenes (destino text, objetivo uuid, ruta text) on commit drop;
insert into t27_imagenes values
  ('solicitud', 'f5200000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-000000000001/e2780000-0000-0000-0000-000000000001.jpg'),
  ('solicitud', 'f5200000-0000-0000-0000-000000000002', 'f5000000-0000-0000-0000-000000000003/e2780000-0000-0000-0000-000000000002.jpg'),
  ('solicitud', 'f8200000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001/e2780000-0000-0000-0000-000000000003.jpg'),
  ('solicitud', 'f9200000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001/e2780000-0000-0000-0000-000000000004.jpg'),
  ('solicitud', 'e2720000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-000000000001/e2780000-0000-0000-0000-000000000005.jpg'),
  ('solicitud', 'e2720000-0000-0000-0000-000000000002', 'e2700000-0000-0000-0000-000000000001/e2780000-0000-0000-0000-000000000006.jpg'),
  ('solicitud', 'e2720000-0000-0000-0000-000000000003', 'e2700000-0000-0000-0000-000000000002/e2780000-0000-0000-0000-000000000007.jpg'),
  ('solicitud', 'e2720000-0000-0000-0000-000000000004', 'f5000000-0000-0000-0000-000000000003/e2780000-0000-0000-0000-000000000008.jpg'),
  ('solicitud', 'e2720000-0000-0000-0000-000000000005', 'e2700000-0000-0000-0000-000000000001/e2780000-0000-0000-0000-000000000009.jpg'),
  ('solicitud', 'e2720000-0000-0000-0000-000000000006', 'f5000000-0000-0000-0000-000000000001/e2780000-0000-0000-0000-000000000010.jpg'),
  ('solicitud', '0ceb4ba0-07da-4f81-a1e6-5e1163fa44d6', 'f2000000-0000-0000-0000-000000000001/e2780000-0000-0000-0000-000000000017.jpg'),
  ('solicitud', 'f9cc1cd9-0308-49dc-8b3f-c4876b016cd6', 'f2000000-0000-0000-0000-000000000001/e2780000-0000-0000-0000-000000000018.jpg'),
  ('publicacion', 'f2400000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-000000000001/e2780000-0000-0000-0000-000000000011.jpg'),
  ('publicacion', 'f2400000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000001/e2780000-0000-0000-0000-000000000012.jpg'),
  ('publicacion', 'f2400000-0000-0000-0000-000000000003', 'f5000000-0000-0000-0000-000000000003/e2780000-0000-0000-0000-000000000013.jpg'),
  ('publicacion', 'f1700000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001/e2780000-0000-0000-0000-000000000014.jpg'),
  ('publicacion', 'e2740000-0000-0000-0000-000000000001', 'e2700000-0000-0000-0000-000000000002/e2780000-0000-0000-0000-000000000015.jpg'),
  ('publicacion', 'e2740000-0000-0000-0000-000000000002', 'e2700000-0000-0000-0000-000000000001/e2780000-0000-0000-0000-000000000016.jpg');

update public.solicitudes s set imagen_ruta = i.ruta
from t27_imagenes i
where i.destino = 'solicitud' and s.id = i.objetivo and s.imagen_ruta is distinct from i.ruta
  and exists (select 1 from storage.objects o where o.bucket_id = 'publicaciones' and o.name = i.ruta);

-- Un medio por publicación, con id fijo derivado del número de imagen.
insert into public.publicacion_medios (id, publicacion_id, tipo, url, orden)
select ('e2750000-0000-0000-0000-0000000000' || substr(i.ruta, length(i.ruta) - 5, 2))::uuid,
       i.objetivo, 'imagen', i.ruta, 0
from t27_imagenes i
where i.destino = 'publicacion'
  and exists (select 1 from storage.objects o where o.bucket_id = 'publicaciones' and o.name = i.ruta)
on conflict (id) do update set url = excluded.url, publicacion_id = excluded.publicacion_id;

do $$
declare r record;
begin
  for r in select i.ruta from t27_imagenes i
           where not exists (select 1 from storage.objects o where o.bucket_id = 'publicaciones' and o.name = i.ruta)
  loop
    raise notice 'T27: falta subir la imagen %', r.ruta;
  end loop;
end $$;

-- 7. Social de ejemplo (cuentas demo, comentarios de más de 24 h) ---------------------
insert into public.me_gusta (tipo, objetivo_id, usuario_id)
select v.tipo, v.objetivo, v.usuario
from (values
  ('publicacion', 'e2740000-0000-0000-0000-000000000001'::uuid, 'f1000000-0000-0000-0000-000000000004'::uuid),
  ('publicacion', 'e2740000-0000-0000-0000-000000000001'::uuid, 'f1000000-0000-0000-0000-000000000003'::uuid),
  ('publicacion', 'f2400000-0000-0000-0000-000000000003'::uuid, 'f1000000-0000-0000-0000-000000000004'::uuid),
  ('solicitud', 'e2720000-0000-0000-0000-000000000006'::uuid, 'f1000000-0000-0000-0000-000000000004'::uuid),
  ('solicitud', 'e2720000-0000-0000-0000-000000000003'::uuid, 'f1000000-0000-0000-0000-000000000003'::uuid)
) as v(tipo, objetivo, usuario)
where exists (select 1 from auth.users u where u.id = v.usuario)
on conflict do nothing;

insert into public.comentarios (id, tipo, objetivo_id, usuario_id, texto, creado_en)
select v.id, v.tipo, v.objetivo, v.usuario, v.texto, now() - v.hace
from (values
  ('e2770000-0000-0000-0000-000000000001'::uuid, 'publicacion', 'e2740000-0000-0000-0000-000000000001'::uuid,
   'f1000000-0000-0000-0000-000000000004'::uuid, '¡Tamal está precioso! Ojalá encuentre familia pronto.', interval '26 hours'),
  ('e2770000-0000-0000-0000-000000000002'::uuid, 'publicacion', 'f2400000-0000-0000-0000-000000000003'::uuid,
   'f1000000-0000-0000-0000-000000000004'::uuid, 'Qué bonito ver la cocina llena. Un abrazo a las abuelas.', interval '28 hours')
) as v(id, tipo, objetivo, usuario, texto, hace)
where exists (select 1 from auth.users u where u.id = v.usuario)
on conflict (id) do update set texto = excluded.texto;

-- 8. Retiro de ejemplo viejo no referenciado; lo referenciado se reporta y se deja ------
create temporary table t27_conocidas (id uuid primary key) on commit drop;
insert into t27_conocidas values
  ('f5200000-0000-0000-0000-000000000001'), ('f5200000-0000-0000-0000-000000000002'),
  ('f8200000-0000-0000-0000-000000000001'), ('f9200000-0000-0000-0000-000000000001'),
  ('e2720000-0000-0000-0000-000000000001'), ('e2720000-0000-0000-0000-000000000002'),
  ('e2720000-0000-0000-0000-000000000003'), ('e2720000-0000-0000-0000-000000000004'),
  ('e2720000-0000-0000-0000-000000000005'), ('e2720000-0000-0000-0000-000000000006');

create temporary table t27_retirar on commit drop as
select s.id from public.solicitudes s
join public.organizaciones o on o.id = s.organizacion_id and o.es_ejemplo
where s.id not in (select id from t27_conocidas)
  and not exists (select 1 from public.pagos p where p.solicitud_id = s.id)
  and not exists (select 1 from public.pedidos pe where pe.solicitud_id = s.id);

delete from public.me_gusta where tipo = 'solicitud' and objetivo_id in (select id from t27_retirar);
delete from public.comentarios where tipo = 'solicitud' and objetivo_id in (select id from t27_retirar);
delete from public.solicitudes where id in (select id from t27_retirar);

do $$
declare r record;
begin
  for r in select s.id, s.titulo from public.solicitudes s
           join public.organizaciones o on o.id = s.organizacion_id and o.es_ejemplo
           where s.id not in (select id from t27_conocidas)
  loop
    raise notice 'T27: se conserva la solicitud % (%) porque tiene pagos o pedidos', r.id, r.titulo;
  end loop;
end $$;

commit;
