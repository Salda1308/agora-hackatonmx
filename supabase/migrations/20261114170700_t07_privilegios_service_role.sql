-- T07: privilegios del backend (service_role) sobre las tablas de public.
-- El Supabase alojado ya no da por defecto SELECT/INSERT/UPDATE/DELETE a service_role
-- en tablas creadas por postgres (solo Dxtm), ni USAGE en secuencias; el CLI local sí.
-- Sin esto, crear-cobro, pey-webhook, estado-pago y t17-imagen fallan con 42501 en el remoto.
-- service_role ya omite RLS por diseño; no cambia permisos de anon ni authenticated.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Tablas y secuencias que creen migraciones futuras.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;
