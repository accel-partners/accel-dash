-- =============================================
-- ログインリンク集（/logins）（2026-10-20）
-- =============================================
-- 社内で使っているサービスの「ログイン URL・ログイン ID・担当・2 段階認証の場所・パスワードの置き場所（1Password などのリンク）」の一覧。
-- ★パスワードそのものは入れない（パスワードは専用のパスワードマネージャーに置き、ここにはそこへのリンクだけ）
-- 見られる人：担当者（@accel-partners.co.jp）と、ポータルで「ログインリンク集」にチェックした人（can_use_app('/logins')）。
--   そのうえで「限定」にした項目は、選んだ人（allowed_emails）・作った人・二宮だけ
-- Claude（claude.ai の接続）には渡さない
-- 何度実行しても壊れない

create table if not exists public.login_entries (
  id              uuid primary key default gen_random_uuid(),
  category        text,
  service         text not null,
  login_url       text,
  account_id      text,
  owner           text,
  mfa             text,
  vault_url       text,
  note            text,
  restricted      boolean not null default false,
  allowed_emails  text[] not null default '{}',
  sort_order      integer not null default 0,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_login_entries_category on public.login_entries (category, sort_order);

drop trigger if exists trg_login_entries_touch on public.login_entries;
create trigger trg_login_entries_touch before update on public.login_entries
  for each row execute function public.touch_updated_at();

-- 見られるか：アプリを使える人で、限定でないか、選ばれた人・作った人・二宮
create or replace function public.login_entry_visible(p_restricted boolean, p_allowed text[], p_created_by uuid)
returns boolean language sql stable as $$
  select public.can_use_app('/logins') and (
    not p_restricted
    or lower(coalesce(auth.jwt() ->> 'email', '')) = any (select lower(x) from unnest(p_allowed) x)
    or p_created_by = auth.uid()
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'ninomiya@accel-partners.co.jp'
  );
$$;

alter table public.login_entries enable row level security;
drop policy if exists login_entries_select on public.login_entries;
create policy login_entries_select on public.login_entries for select to authenticated
  using (public.login_entry_visible(restricted, allowed_emails, created_by));
drop policy if exists login_entries_insert on public.login_entries;
create policy login_entries_insert on public.login_entries for insert to authenticated
  with check (public.can_use_app('/logins'));
drop policy if exists login_entries_update on public.login_entries;
create policy login_entries_update on public.login_entries for update to authenticated
  using (public.login_entry_visible(restricted, allowed_emails, created_by))
  with check (public.login_entry_visible(restricted, allowed_emails, created_by));
drop policy if exists login_entries_delete on public.login_entries;
create policy login_entries_delete on public.login_entries for delete to authenticated
  using (public.login_entry_visible(restricted, allowed_emails, created_by));

-- ポータルのタイル
insert into public.apps (slug, title, description, "order")
select '/logins', 'ログインリンク集', '社内で使うサービスのログイン先・ID・担当・パスワードの置き場所', 0
where not exists (select 1 from public.apps where slug = '/logins');

-- 確認用：表とタイルができたか（1 行目に件数、2 行目にタイル）
select (select count(*) from public.login_entries) as entries,
       (select count(*) from public.apps where slug = '/logins') as tile;
