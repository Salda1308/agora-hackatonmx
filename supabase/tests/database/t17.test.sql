begin;
create extension if not exists pgtap with schema extensions;
select plan(16);
-- Fixtures exclusivas T17; ninguna cuenta ni dato compartido.
insert into auth.users (id) values ('a1700000-0000-0000-0000-000000000001');
insert into public.organizaciones (id,tipo,nombre,slug,verificada) values
 ('a1700000-0000-0000-0000-000000000001','tienda','T17 propia','t17-propia',true),
 ('a1700000-0000-0000-0000-000000000002','tienda','T17 ajena','t17-ajena',true);
insert into public.perfiles (id,rol,organizacion_id) values
 ('a1700000-0000-0000-0000-000000000001','tienda','a1700000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1700000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select throws_ok($$insert into public.publicaciones(organizacion_id,texto) values ('a1700000-0000-0000-0000-000000000001','Sin consentimiento')$$,'42501',null,'exige consentimiento');
select lives_ok($$insert into public.publicaciones(organizacion_id,texto,consentimiento) values ('a1700000-0000-0000-0000-000000000001','Hola',true)$$,'publica en su página');
reset role;
update public.publicaciones set id='b1700000-0000-0000-0000-000000000001' where organizacion_id='a1700000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_ok($$insert into public.publicaciones(organizacion_id,texto,consentimiento) values ('a1700000-0000-0000-0000-000000000002','Intrusión',true)$$,'42501',null,'no publica en página ajena');
select lives_ok($$update public.publicaciones set texto='Editado' where id='b1700000-0000-0000-0000-000000000001'$$,'edita su texto');
select throws_ok($$update public.publicaciones set retirada=true$$,'42501',null,'no controla moderación');
select throws_ok($$insert into storage.objects(bucket_id,name) values ('publicaciones','a1700000-0000-0000-0000-000000000001/raw.jpg')$$,'42501',null,'ni propietario sube JPEG sin sanitizar');
select throws_ok($$insert into storage.objects(bucket_id,name) values ('publicaciones','a1700000-0000-0000-0000-000000000002/ajena.jpg')$$,'42501',null,'no sube en organización ajena');
select throws_ok($$insert into public.publicacion_medios(publicacion_id,tipo,url) values ('b1700000-0000-0000-0000-000000000001','imagen','a1700000-0000-0000-0000-000000000002/ajena.jpg')$$,'42501',null,'no enlaza imagen ajena');
select lives_ok($$insert into public.publicacion_medios(publicacion_id,tipo,url) values ('b1700000-0000-0000-0000-000000000001','video','https://vimeo.com/123456')$$,'agrega video propio');
reset role;
update public.organizaciones set verificada=false where id='a1700000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_ok($$insert into public.publicaciones(organizacion_id,texto,consentimiento) values ('a1700000-0000-0000-0000-000000000001','No verificada',true)$$,'42501',null,'no verificada no publica');
reset role;
update public.organizaciones set verificada=true where id='a1700000-0000-0000-0000-000000000001';
set local role anon;
select is((select count(*)::int from public.publicaciones where id='b1700000-0000-0000-0000-000000000001'),1,'visitante ve publicación');
select lives_ok($$insert into public.reportes(publicacion_id,motivo) values ('b1700000-0000-0000-0000-000000000001','Revisar consentimiento')$$,'visitante reporta');
reset role;
select is((select count(*)::int from public.reportes where publicacion_id='b1700000-0000-0000-0000-000000000001'),1,'reporte llega a moderación');
update public.publicaciones set retirada=true where id='b1700000-0000-0000-0000-000000000001';
set local role anon;
select is((select count(*)::int from public.publicaciones where id='b1700000-0000-0000-0000-000000000001'),0,'retirada desaparece');
reset role;
select is((select file_size_limit::int from storage.buckets where id='publicaciones'),5242880,'bucket limita 5 MB');
select is((select public from storage.buckets where id='publicaciones'),false,'bucket privado');
select * from finish();
rollback;
