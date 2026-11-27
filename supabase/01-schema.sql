-- SpeakBoost · Giai đoạn 2 · Cơ sở dữ liệu và phân quyền (RLS)
-- Chạy một lần trong Supabase → SQL Editor. Chạy lại được (idempotent ở mức bảng/hàm).
--
-- Nguyên tắc:
--  * Học sinh KHÔNG có email. Trình duyệt học sinh đăng nhập ẩn danh (anonymous sign-in),
--    rồi gọi student_join(mã lớp, số thứ tự, PIN) để gắn phiên đó với một học sinh.
--  * Giáo viên / quản trị đăng nhập bằng email. Chỉ email đã được mời (bảng invites) mới có quyền.
--  * Mọi quyền được kiểm tra ở máy chủ bằng RLS; giao diện chỉ hiển thị.
--  * Không lưu họ tên đầy đủ, không lưu giọng nói. PIN chỉ lưu dạng băm (bcrypt).

create extension if not exists pgcrypto with schema extensions;

-- ---------- Bảng ----------
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('super_admin', 'school_admin', 'teacher')),
  school_id uuid references public.schools on delete set null,
  display_name text,
  created_at timestamptz not null default now()
);

-- Lời mời: email nào được mời thì khi đăng nhập lần đầu sẽ tự có vai trò tương ứng.
create table if not exists public.invites (
  email text primary key,
  role text not null check (role in ('super_admin', 'school_admin', 'teacher')),
  school_id uuid references public.schools on delete cascade,
  invited_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools on delete cascade,
  teacher_id uuid not null references auth.users on delete restrict,
  name text not null,                                  -- ví dụ "6A"
  code text not null unique,                           -- mã lớp, ví dụ "6A-K7Q"
  study_group text check (study_group in ('thuc_nghiem', 'doi_chung')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes on delete cascade,
  roster_no int not null check (roster_no between 1 and 99),
  nickname text not null check (char_length(nickname) between 1 and 40),  -- tên gọi ngắn, không cần họ tên
  pin_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  unique (class_id, roster_no)
);

-- Phiên trình duyệt (tài khoản ẩn danh) nào đang là học sinh nào.
create table if not exists public.student_links (
  auth_uid uuid primary key references auth.users on delete cascade,
  student_id uuid not null references public.students on delete cascade,
  linked_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.students on delete cascade,
  class_id uuid not null references public.classes on delete cascade,
  unit int not null,
  activity text not null check (activity in ('vocab', 'pattern', 'dialogue', 'roleplay', 'picture', 'challenge')),
  item_id text not null,
  level int check (level between 1 and 3),
  source text not null check (source in ('asr_match', 'self_check')),
  stars int not null check (stars between 0 and 3),
  detail text check (char_length(detail) <= 200),
  is_simulated boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists attempts_class_time on public.attempts (class_id, created_at);
create index if not exists attempts_student on public.attempts (student_id);

-- ---------- Hàm hỗ trợ phân quyền (chạy với quyền chủ sở hữu, không lộ dữ liệu) ----------
create or replace function public.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where user_id = auth.uid()
$$;

create or replace function public.my_school() returns uuid
language sql stable security definer set search_path = '' as $$
  select school_id from public.profiles where user_id = auth.uid()
$$;

create or replace function public.my_student() returns uuid
language sql stable security definer set search_path = '' as $$
  select student_id from public.student_links where auth_uid = auth.uid()
$$;

-- Người đang đăng nhập có được xem/quản lý lớp này không?
create or replace function public.can_manage_class(p_class uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.classes c
    where c.id = p_class and (
      c.teacher_id = auth.uid()
      or (public.my_role() = 'school_admin' and c.school_id = public.my_school())
      or public.my_role() = 'super_admin'))
$$;

-- ---------- Tự tạo hồ sơ khi người được mời đăng nhập lần đầu ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare inv public.invites;
begin
  if new.email is null or new.is_anonymous then return new; end if;
  select * into inv from public.invites where lower(email) = lower(new.email);
  if found then
    insert into public.profiles (user_id, role, school_id) values (new.id, inv.role, inv.school_id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RPC cho học sinh ----------
-- Danh sách để học sinh chọn tên sau khi nhập mã lớp (chỉ số thứ tự + tên gọi).
create or replace function public.class_roster(p_code text)
returns table (roster_no int, nickname text, class_name text)
language sql stable security definer set search_path = '' as $$
  select s.roster_no, s.nickname, c.name
  from public.classes c join public.students s on s.class_id = c.id
  where upper(c.code) = upper(trim(p_code)) and c.active and auth.uid() is not null
  order by s.roster_no
$$;

create or replace function public.student_join(p_code text, p_roster int, p_pin text)
returns json
language plpgsql security definer set search_path = '' as $$
declare c public.classes; s public.students;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into c from public.classes where upper(code) = upper(trim(p_code)) and active;
  if not found then raise exception 'wrong_code'; end if;
  select * into s from public.students where class_id = c.id and roster_no = p_roster for update;
  if not found then raise exception 'wrong_student'; end if;
  if s.locked_until is not null and s.locked_until > now() then raise exception 'locked'; end if;
  if extensions.crypt(p_pin, s.pin_hash) <> s.pin_hash then
    update public.students
       set failed_attempts = failed_attempts + 1,
           locked_until = case when failed_attempts + 1 >= 5 then now() + interval '10 minutes' end
     where id = s.id;
    return json_build_object('ok', false, 'error', 'wrong_pin');
  end if;
  update public.students set failed_attempts = 0, locked_until = null where id = s.id;
  insert into public.student_links (auth_uid, student_id) values (auth.uid(), s.id)
    on conflict (auth_uid) do update set student_id = excluded.student_id, linked_at = now();
  return json_build_object('ok', true, 'nickname', s.nickname, 'roster_no', s.roster_no, 'class_name', c.name);
end $$;

create or replace function public.student_me() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object('nickname', s.nickname, 'roster_no', s.roster_no, 'class_name', c.name, 'class_id', c.id)
  from public.student_links l join public.students s on s.id = l.student_id join public.classes c on c.id = s.class_id
  where l.auth_uid = auth.uid()
$$;

create or replace function public.record_attempt(p_unit int, p_activity text, p_item text, p_level int,
  p_source text, p_stars int, p_detail text) returns void
language plpgsql security definer set search_path = '' as $$
declare sid uuid; cid uuid;
begin
  select s.id, s.class_id into sid, cid
  from public.student_links l join public.students s on s.id = l.student_id where l.auth_uid = auth.uid();
  if sid is null then raise exception 'not_a_student'; end if;
  insert into public.attempts (student_id, class_id, unit, activity, item_id, level, source, stars, detail)
  values (sid, cid, p_unit, p_activity, p_item, p_level, p_source, p_stars, left(p_detail, 200));
end $$;

-- ---------- RPC cho giáo viên ----------
-- Thêm/cập nhật học sinh: p_rows = [{"roster_no":1,"nickname":"An","pin":"4821"}, ...]
create or replace function public.upsert_students(p_class uuid, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare r jsonb; n int := 0;
begin
  if not public.can_manage_class(p_class) then raise exception 'forbidden'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    if (r->>'pin') !~ '^[0-9]{4,6}$' then raise exception 'bad_pin for %', r->>'roster_no'; end if;
    insert into public.students (class_id, roster_no, nickname, pin_hash)
    values (p_class, (r->>'roster_no')::int, trim(r->>'nickname'), extensions.crypt(r->>'pin', extensions.gen_salt('bf')))
    on conflict (class_id, roster_no) do update
      set nickname = excluded.nickname, pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.reset_pin(p_student uuid, p_pin text) returns void
language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  select class_id into cid from public.students where id = p_student;
  if cid is null or not public.can_manage_class(cid) then raise exception 'forbidden'; end if;
  if p_pin !~ '^[0-9]{4,6}$' then raise exception 'bad_pin'; end if;
  update public.students set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')),
    failed_attempts = 0, locked_until = null where id = p_student;
  delete from public.student_links where student_id = p_student;  -- đăng xuất các máy cũ
end $$;

-- ---------- Bật RLS và chính sách ----------
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.student_links enable row level security;
alter table public.attempts enable row level security;

-- Không cho ai đọc pin_hash qua API.
revoke select on public.students from anon, authenticated;
grant select (id, class_id, roster_no, nickname, failed_attempts, locked_until, created_at) on public.students to authenticated;
revoke insert, update on public.students from anon, authenticated;   -- chỉ qua upsert_students / reset_pin
revoke all on public.student_links from anon, authenticated;          -- chỉ qua student_join
revoke insert, update on public.attempts from anon, authenticated;    -- chỉ qua record_attempt

drop policy if exists schools_read on public.schools;
create policy schools_read on public.schools for select to authenticated
  using (public.my_role() = 'super_admin' or id = public.my_school());
drop policy if exists schools_admin on public.schools;
create policy schools_admin on public.schools for all to authenticated
  using (public.my_role() = 'super_admin') with check (public.my_role() = 'super_admin');

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.my_role() = 'super_admin'
         or (public.my_role() = 'school_admin' and school_id = public.my_school()));
drop policy if exists profiles_admin on public.profiles;
create policy profiles_admin on public.profiles for update to authenticated
  using (public.my_role() = 'super_admin') with check (public.my_role() = 'super_admin');

drop policy if exists invites_read on public.invites;
create policy invites_read on public.invites for select to authenticated
  using (public.my_role() = 'super_admin' or (public.my_role() = 'school_admin' and school_id = public.my_school()));
drop policy if exists invites_write on public.invites;
create policy invites_write on public.invites for all to authenticated
  using (public.my_role() = 'super_admin' or (public.my_role() = 'school_admin' and school_id = public.my_school() and role = 'teacher'))
  with check (public.my_role() = 'super_admin' or (public.my_role() = 'school_admin' and school_id = public.my_school() and role = 'teacher'));

drop policy if exists classes_read on public.classes;
create policy classes_read on public.classes for select to authenticated
  using (public.can_manage_class(id));
drop policy if exists classes_insert on public.classes;
create policy classes_insert on public.classes for insert to authenticated
  with check (public.my_role() in ('teacher', 'school_admin', 'super_admin')
              and teacher_id = auth.uid()
              and (school_id = public.my_school() or public.my_role() = 'super_admin'));
drop policy if exists classes_update on public.classes;
create policy classes_update on public.classes for update to authenticated
  using (public.can_manage_class(id)) with check (public.can_manage_class(id));
drop policy if exists classes_delete on public.classes;
create policy classes_delete on public.classes for delete to authenticated
  using (public.can_manage_class(id));

drop policy if exists students_read on public.students;
create policy students_read on public.students for select to authenticated
  using (public.can_manage_class(class_id) or id = public.my_student());
drop policy if exists students_delete on public.students;
create policy students_delete on public.students for delete to authenticated
  using (public.can_manage_class(class_id));

drop policy if exists attempts_read on public.attempts;
create policy attempts_read on public.attempts for select to authenticated
  using (student_id = public.my_student() or public.can_manage_class(class_id));
drop policy if exists attempts_delete on public.attempts;
create policy attempts_delete on public.attempts for delete to authenticated
  using (public.can_manage_class(class_id));

-- Hàm RPC: chỉ người đã đăng nhập (kể cả ẩn danh) được gọi.
revoke execute on function public.class_roster(text), public.student_join(text, int, text), public.student_me(),
  public.record_attempt(int, text, text, int, text, int, text), public.upsert_students(uuid, jsonb),
  public.reset_pin(uuid, text) from public, anon;
grant execute on function public.class_roster(text), public.student_join(text, int, text), public.student_me(),
  public.record_attempt(int, text, text, int, text, int, text), public.upsert_students(uuid, jsonb),
  public.reset_pin(uuid, text) to authenticated;
