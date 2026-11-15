-- T19 (hallazgo C1 de T13): la contraseña de las cuentas @demo.agora.test es pública.
-- Nadie puede cambiarles la contraseña ni el correo, ni siquiera con sesión propia.
-- Única excepción: volver a poner la contraseña publicada (la usa el script de
-- restablecimiento y no bloquea una posible re-codificación del hash al iniciar sesión).
-- Las demás cuentas no se ven afectadas.

create function privado.proteger_cuentas_demo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email like '%@demo.agora.test' then
    if new.encrypted_password is distinct from old.encrypted_password
       and new.encrypted_password is distinct from
         extensions.crypt('Agora-demo-2026!', new.encrypted_password) then
      raise exception 'La contraseña de las cuentas demo no se puede cambiar'
        using errcode = 'insufficient_privilege';
    end if;
    if new.email is distinct from old.email
       or coalesce(new.email_change, '') not in ('', coalesce(old.email_change, '')) then
      raise exception 'El correo de las cuentas demo no se puede cambiar'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function privado.proteger_cuentas_demo() from public, anon, authenticated;
-- GoTrue actualiza auth.users como supabase_auth_admin.
grant usage on schema privado to supabase_auth_admin;
grant execute on function privado.proteger_cuentas_demo() to supabase_auth_admin;

create trigger proteger_cuentas_demo
  before update of encrypted_password, email, email_change on auth.users
  for each row execute function privado.proteger_cuentas_demo();
