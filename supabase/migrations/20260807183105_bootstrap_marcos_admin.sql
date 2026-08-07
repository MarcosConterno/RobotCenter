-- Bootstrap do primeiro administrador. Idempotente e sem remoção de papéis existentes.
insert into public.user_roles (user_id, role_id)
select auth_user.id, role.id
from auth.users as auth_user
join public.profiles as profile on profile.id = auth_user.id
cross join public.roles as role
where lower(auth_user.email) = lower('marcos.vinicius@loylegal.com')
  and profile.ativo
  and profile.deleted_at is null
  and role.codigo = 'admin'
  and role.ativo
on conflict (user_id, role_id) do nothing;
