-- =============================================
-- 資料置き場を「多重階層のカテゴリー＋説明＋リンク」に作り替える（2026-10-20）
-- =============================================
-- ・カテゴリーは親子で何段でも（大カテ › 小カテ › …）。説明文も持てる
-- ・今のリンクは「事業部 › 用途」のカテゴリーに移す（事業部だけのものは事業部の直下、用途だけのものは用途の名前のカテゴリー）
-- ・見られる・直せる人は今までどおり：担当者と、ポータルで「資料置き場」にチェックした人（can_use_app('/docs')）
-- ・Claude（claude.ai のアドマネージャーの接続）からも、同じ人だけが読める（アクセルダッシュの /api/docs/export）
-- 何度実行しても壊れない。移す処理はカテゴリーがまだ 1 件も無いときだけ動く

create table if not exists public.doc_categories (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid references public.doc_categories(id) on delete cascade,
  name         text not null,
  description  text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists idx_doc_categories_parent on public.doc_categories (parent_id, sort_order);

alter table public.doc_links add column if not exists category_id uuid references public.doc_categories(id) on delete set null;
create index if not exists idx_doc_links_category on public.doc_links (category_id);
-- リンクの並び順（同じカテゴリーの中。画面の上下ボタンで決める。空は名前順）
alter table public.doc_links add column if not exists sort_order integer;

alter table public.doc_categories enable row level security;
drop policy if exists doc_categories_access on public.doc_categories;
create policy doc_categories_access on public.doc_categories
  for all to authenticated using (public.can_use_app('/docs')) with check (public.can_use_app('/docs'));

-- 今のリンクを移す（カテゴリーがまだ無いときだけ）
do $$
begin
  if exists (select 1 from public.doc_categories) then return; end if;

  -- 事業部 → 大カテゴリー（ID はそのまま使う）
  insert into public.doc_categories (id, parent_id, name, sort_order)
  select d.id, null, d.name, d.sort_order from public.doc_divisions d;

  -- 事業部 × 用途 → 小カテゴリー（使われている組み合わせだけ）
  insert into public.doc_categories (id, parent_id, name, sort_order)
  select distinct md5(l.division_id::text || ':' || l.purpose_id::text)::uuid, l.division_id, p.name, p.sort_order
  from public.doc_links l join public.doc_purposes p on p.id = l.purpose_id
  where l.division_id is not null and l.purpose_id is not null;

  -- 用途だけのリンク → 用途の名前の大カテゴリー
  insert into public.doc_categories (id, parent_id, name, sort_order)
  select distinct p.id, null::uuid, p.name, 1000 + p.sort_order
  from public.doc_links l join public.doc_purposes p on p.id = l.purpose_id
  where l.division_id is null;

  update public.doc_links l set category_id = case
    when l.division_id is not null and l.purpose_id is not null then md5(l.division_id::text || ':' || l.purpose_id::text)::uuid
    when l.division_id is not null then l.division_id
    when l.purpose_id is not null then l.purpose_id
    else null end
  where l.category_id is null;
end $$;

-- 確認用：カテゴリーの数・カテゴリーに入ったリンク・まだ入っていないリンク
select (select count(*) from public.doc_categories) as categories,
       (select count(*) from public.doc_links where category_id is not null) as links_in_category,
       (select count(*) from public.doc_links where category_id is null) as links_without_category;
