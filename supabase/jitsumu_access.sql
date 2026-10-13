-- =============================================
-- 実務従事：ポータルで「実務従事」にチェックを付けた人も使えるようにする
-- =============================================
-- これまで：担当者（@accel-partners.co.jp）だけ（RLS: is_staff）
-- これから：担当者 ＋ ポータルのユーザー管理で「実務従事 申込者管理」にチェックが付いている人（app_access に行がある人）
--   ・見られるもの／できることは担当者と同じ（申込者の名前・メール・電話・名刺情報・備考、チェック、登録・振替・編集・削除）
--   ・チェックを外せば、次に読み込んだときから見られなくなる
--   ・ほかのアプリのチェックとは別。「実務従事」のチェックだけで決まる
-- 何度実行しても同じ結果になる。

-- そのアプリを使えるか（担当者、またはポータルでそのアプリにチェックが付いている人）。
-- app_access・apps の RLS に左右されないよう security definer。見るのは「自分（auth.uid()）の行」だけ。
create or replace function public.can_use_app(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff()
      or exists (
        select 1
        from public.app_access a
        join public.apps p on p.id = a.app_id
        where p.slug = p_slug
          and a.user_id = auth.uid()
      );
$$;
revoke all on function public.can_use_app(text) from public, anon;
grant execute on function public.can_use_app(text) to authenticated;

drop policy if exists jitsumu_sessions_staff on public.jitsumu_sessions;
drop policy if exists jitsumu_sessions_access on public.jitsumu_sessions;
create policy jitsumu_sessions_access on public.jitsumu_sessions
  for all to authenticated using (public.can_use_app('/jitsumu')) with check (public.can_use_app('/jitsumu'));

drop policy if exists jitsumu_people_staff on public.jitsumu_people;
drop policy if exists jitsumu_people_access on public.jitsumu_people;
create policy jitsumu_people_access on public.jitsumu_people
  for all to authenticated using (public.can_use_app('/jitsumu')) with check (public.can_use_app('/jitsumu'));

drop policy if exists jitsumu_entries_staff on public.jitsumu_entries;
drop policy if exists jitsumu_entries_access on public.jitsumu_entries;
create policy jitsumu_entries_access on public.jitsumu_entries
  for all to authenticated using (public.can_use_app('/jitsumu')) with check (public.can_use_app('/jitsumu'));

-- 確かめる：社外で「実務従事」にチェックが付いている人（＝今回から見られるようになる人）
select u.email, a.created_at as チェックした日
from public.app_access a
join public.apps p on p.id = a.app_id
join auth.users u on u.id = a.user_id
where p.slug = '/jitsumu'
  and coalesce(u.email, '') not like '%@accel-partners.co.jp'
order by u.email;
