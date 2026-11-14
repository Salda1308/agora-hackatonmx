-- T17: autorizado en el chat del ticket. Conserva los campos de moderación protegidos.
alter table public.publicaciones add column consentimiento boolean not null default false;
grant insert (consentimiento) on public.publicaciones to authenticated;
-- Política restrictiva: las filas previas siguen siendo moderables sin inventar consentimiento.
create policy "T17 consentimiento al publicar" on public.publicaciones as restrictive for insert to authenticated
with check (consentimiento);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('publicaciones', 'publicaciones', false, 5242880, array['image/jpeg']);

create policy "T17 imagenes visibles" on storage.objects for select to anon, authenticated
using (bucket_id = 'publicaciones' and exists (
  select 1 from public.publicacion_medios m join public.publicaciones p on p.id = m.publicacion_id
  where m.tipo = 'imagen' and m.url = storage.objects.name
    and not p.retirada and privado.org_publica(p.organizacion_id)
));
-- Sin INSERT de cliente: t17-imagen sanitiza y guarda con service_role.
create policy "T17 borrar imagen propia" on storage.objects for delete to authenticated
using (bucket_id = 'publicaciones' and (storage.foldername(name))[1] = privado.mi_organizacion()::text
  and privado.org_publica(privado.mi_organizacion()));

-- Edición solo de texto propio: jamás campos de moderación ni medios ajenos.
grant update (texto, consentimiento) on public.publicaciones to authenticated;
create policy "T17 editar texto propio verificado" on public.publicaciones for update to authenticated
using (organizacion_id = privado.mi_organizacion() and privado.org_publica(organizacion_id) and not retirada)
with check (organizacion_id = privado.mi_organizacion() and privado.org_publica(organizacion_id) and not retirada and consentimiento);

-- Los medios nuevos deben seguir perteneciendo a una página propia y activa.
create policy "T17 medios propios activos" on public.publicacion_medios as restrictive for insert to authenticated
with check (exists (
  select 1 from public.publicaciones p where p.id = publicacion_id
    and p.organizacion_id = privado.mi_organizacion()
    and privado.org_publica(p.organizacion_id) and not p.retirada
    and (tipo <> 'imagen' or split_part(url, '/', 1) = p.organizacion_id::text)
));
