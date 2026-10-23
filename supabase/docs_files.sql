-- =============================================
-- 資料置き場：1 つの資料に URL とアップロードしたファイルを何個でも（2026-10-20）
-- =============================================
-- ・doc_items：資料（doc_links）の中身。kind = url（リンク）／ file（アップロードしたファイル）
-- ・ファイル本体は Supabase Storage の非公開の入れ物「docs」（1 つ 50MB まで）
-- ・共有用 URL は https://accel-dash.com/f/<share_token>。開けるのは、ふつうは資料置き場を見られる人（ログインが要る）。
--   is_public をオンにしたファイルだけ、URL を知っていれば誰でも開ける（いつでもオフに戻せる）
-- ・見られる・直せる人は資料置き場と同じ（can_use_app('/docs')）
-- ・今の資料の URL は doc_items に移す（何度実行しても二重にならない）

create table if not exists public.doc_items (
  id            uuid primary key default gen_random_uuid(),
  link_id       uuid not null references public.doc_links(id) on delete cascade,
  kind          text not null check (kind in ('url','file')),
  label         text,
  url           text,
  storage_path  text,
  file_name     text,
  mime          text,
  size          bigint,
  share_token   text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  is_public     boolean not null default false,
  sort_order    integer not null default 0,
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index if not exists idx_doc_items_link on public.doc_items (link_id, sort_order);

alter table public.doc_items enable row level security;
drop policy if exists doc_items_access on public.doc_items;
create policy doc_items_access on public.doc_items
  for all to authenticated using (public.can_use_app('/docs')) with check (public.can_use_app('/docs'));

-- 資料そのものは URL が無くてもよい（ファイルだけの資料）
alter table public.doc_links alter column url drop not null;

-- 今の URL を中身に移し、資料側の URL は空にする（以後は doc_items だけを見る）
insert into public.doc_items (link_id, kind, url, sort_order)
select l.id, 'url', l.url, 0 from public.doc_links l
where coalesce(l.url, '') <> '' and not exists (select 1 from public.doc_items i where i.link_id = l.id);
update public.doc_links l set url = null
where l.url is not null and exists (select 1 from public.doc_items i where i.link_id = l.id and i.kind = 'url' and i.url = l.url);

-- ファイルの入れ物（非公開・1 つ 50MB まで）
insert into storage.buckets (id, name, public, file_size_limit)
values ('docs', 'docs', false, 52428800)
on conflict (id) do nothing;

drop policy if exists docs_files_read on storage.objects;
create policy docs_files_read on storage.objects for select to authenticated
  using (bucket_id = 'docs' and public.can_use_app('/docs'));
drop policy if exists docs_files_write on storage.objects;
create policy docs_files_write on storage.objects for insert to authenticated
  with check (bucket_id = 'docs' and public.can_use_app('/docs'));
drop policy if exists docs_files_update on storage.objects;
create policy docs_files_update on storage.objects for update to authenticated
  using (bucket_id = 'docs' and public.can_use_app('/docs'));
drop policy if exists docs_files_delete on storage.objects;
create policy docs_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'docs' and public.can_use_app('/docs'));

-- 確認用：中身の数（URL・ファイル）と、まだ URL が資料側に残っている数（0 なら OK）
select (select count(*) from public.doc_items where kind = 'url') as url_items,
       (select count(*) from public.doc_items where kind = 'file') as file_items,
       (select count(*) from public.doc_links where url is not null) as links_with_old_url;
