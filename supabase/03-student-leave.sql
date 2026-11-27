-- SpeakBoost · "Đổi bạn" trên máy dùng chung: gỡ học sinh khỏi phiên của máy, GIỮ phiên máy.
-- Nhờ vậy mỗi máy (phòng máy trường) chỉ tạo phiên đăng nhập một lần, không tốn giới hạn 30 lần/giờ.
create or replace function public.student_leave() returns void
language sql security definer set search_path = '' as $$
  delete from public.student_links where auth_uid = auth.uid()
$$;
revoke execute on function public.student_leave() from public, anon;
grant execute on function public.student_leave() to authenticated;

select 'student_leave đã sẵn sàng' as ket_qua;
