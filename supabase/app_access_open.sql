-- =============================================
-- アプリの権限を「ポータルのチェック」で決める（社内アプリ全部・今後作るものも同じ）
-- =============================================
-- これまで：社内アプリ（基幹システム・アドマネージャー・MF連携・資料置き場・実務従事・にのみーブレイン）は
--           担当者（@accel-partners.co.jp）だけ。社外の人はポータルでチェックを付けても中で断られていた。
-- これから：担当者 ＋ ポータルのユーザー管理でそのアプリにチェックが付いている人（app_access に行がある人）。
--   ・チェックを付けた人は、そのアプリで担当者と同じことができる（見る・編集）
--   ・チェックを外せば、次に読み込んだときから使えなくなる
--   ・アプリごとに別。ほかのアプリのチェックでは開かない
-- 変えないもの：
--   ・基幹システムの財務（月次PL・事業別採算・経費・口座）… 今までどおり社内＋二宮さんが付けた人だけ（has_feature）
--   ・Magnet・アクセルガード … 社外の人は自分の会社の分だけ（今までどおり）
--   ・ユーザー管理・アプリの編集 … 担当者だけ
-- 何度実行しても同じ結果になる。supabase/jitsumu_access.sql の内容もここに含む（あちらは実行不要）。

-- apps.slug（'/jitsumu'・'magnet'・'https://crm.accel-dash.com' など書き方がまちまち）を同じ形にそろえる
--   '/jitsumu'                          → '/jitsumu'
--   'magnet'                            → 'magnet.accel-dash.com'
--   'https://admanager.accel-dash.com/' → 'admanager.accel-dash.com'
create or replace function public.app_key(p_slug text)
returns text
language sql
immutable
as $$
  select case
    when s like '/%' then coalesce(nullif(rtrim(s, '/'), ''), '/')
    when s ~ '^https?://' then rtrim(regexp_replace(s, '^https?://', ''), '/')
    when s like '%.%' then rtrim(s, '/')
    else s || '.accel-dash.com'
  end
  from (select lower(trim(coalesce(p_slug, ''))) as s) t;
$$;

-- そのアプリを使えるか：担当者、またはポータルでそのアプリにチェックが付いている人。
-- 各アプリはログイン中の本人のトークンで rpc('can_use_app', { p_slug: '<自分の slug かホスト名>' }) を呼ぶ。
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
        where public.app_key(p.slug) = public.app_key(p_slug)
          and a.user_id = auth.uid()
      );
$$;
revoke all on function public.can_use_app(text) from public, anon;
grant execute on function public.can_use_app(text) to authenticated;

-- ---------------------------------------------
-- 実務従事（/jitsumu）
-- ---------------------------------------------
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

-- ---------------------------------------------
-- 資料置き場（/docs）
-- ---------------------------------------------
drop policy if exists doc_divisions_staff on public.doc_divisions;
drop policy if exists doc_divisions_access on public.doc_divisions;
create policy doc_divisions_access on public.doc_divisions
  for all to authenticated using (public.can_use_app('/docs')) with check (public.can_use_app('/docs'));
drop policy if exists doc_purposes_staff on public.doc_purposes;
drop policy if exists doc_purposes_access on public.doc_purposes;
create policy doc_purposes_access on public.doc_purposes
  for all to authenticated using (public.can_use_app('/docs')) with check (public.can_use_app('/docs'));
drop policy if exists doc_links_staff on public.doc_links;
drop policy if exists doc_links_access on public.doc_links;
create policy doc_links_access on public.doc_links
  for all to authenticated using (public.can_use_app('/docs')) with check (public.can_use_app('/docs'));

-- ---------------------------------------------
-- 基幹システム（crm.accel-dash.com）の顧客・売上・商談など（crm_docs）
-- 財務（finance_docs）は has_feature のまま変えない
-- ---------------------------------------------
drop policy if exists crm_docs_staff on public.crm_docs;
drop policy if exists crm_docs_access on public.crm_docs;
create policy crm_docs_access on public.crm_docs
  for all to authenticated using (public.can_use_app('crm.accel-dash.com')) with check (public.can_use_app('crm.accel-dash.com'));

-- ---------------------------------------------
-- 確かめる：社外の人で、チェックが付いているアプリ（＝今回から中まで使えるようになる人とアプリ）
-- ---------------------------------------------
select u.email, p.title as アプリ, public.app_key(p.slug) as アプリのキー
from public.app_access a
join public.apps p on p.id = a.app_id
join auth.users u on u.id = a.user_id
where coalesce(u.email, '') not like '%@accel-partners.co.jp'
order by u.email, p."order";
