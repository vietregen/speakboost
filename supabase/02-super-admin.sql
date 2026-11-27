-- SpeakBoost · Đặt Super Admin. Chạy MỘT lần trong SQL Editor, sau 01-schema.sql.
-- Trường đầu tiên.
insert into public.schools (name)
select 'THCS Nguyễn Văn Cừ'
where not exists (select 1 from public.schools where name = 'THCS Nguyễn Văn Cừ');

-- Lời mời: khi email này đăng nhập lần đầu, tài khoản tự có vai trò super_admin (gắn với trường trên).
insert into public.invites (email, role, school_id)
select 'quynhduc.ven@gmail.com', 'super_admin', id from public.schools where name = 'THCS Nguyễn Văn Cừ'
on conflict (email) do update set role = 'super_admin', school_id = excluded.school_id;

-- Nếu email này đã từng đăng nhập trước khi có lời mời, cấp quyền ngay:
insert into public.profiles (user_id, role, school_id)
select u.id, 'super_admin', s.id from auth.users u, public.schools s
where lower(u.email) = 'quynhduc.ven@gmail.com' and s.name = 'THCS Nguyễn Văn Cừ'
on conflict (user_id) do update set role = 'super_admin', school_id = excluded.school_id;

-- Super Admin được tạo trường. Hàm này giúp tạo trường từ Dashboard.
create or replace function public.create_school(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare sid uuid;
begin
  if coalesce(public.my_role(), '') <> 'super_admin' then raise exception 'forbidden'; end if;
  insert into public.schools (name) values (trim(p_name)) returning id into sid;
  return sid;
end $$;
revoke execute on function public.create_school(text) from public, anon;
grant execute on function public.create_school(text) to authenticated;

select i.email, i.role, s.name as school from public.invites i left join public.schools s on s.id = i.school_id;
