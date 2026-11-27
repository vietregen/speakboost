-- SpeakBoost · Giao bài theo lớp: mức cần hoàn thành, có tính thử thách, ngưỡng sao, hạn chót, thang điểm.
alter table public.classes
  add column if not exists assignment jsonb not null
  default '{"levels":[1],"challenge":true,"pass_stars":2,"due":null,"scale":10}'::jsonb;

-- Học sinh đọc được yêu cầu của lớp mình (qua student_me).
create or replace function public.student_me() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object('nickname', s.nickname, 'roster_no', s.roster_no, 'class_name', c.name,
                           'class_id', c.id, 'assignment', c.assignment)
  from public.student_links l join public.students s on s.id = l.student_id join public.classes c on c.id = s.class_id
  where l.auth_uid = auth.uid()
$$;
revoke execute on function public.student_me() from public, anon;
grant execute on function public.student_me() to authenticated;

select 'Đã thêm phần giao bài cho lớp' as ket_qua;
