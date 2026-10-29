-- =============================================
-- 社内動画（accel-dash.com/videos）
-- =============================================
-- MTG議事録・マニュアル・勉強用の動画を Vimeo から出す。仕組みはビジネスカレッジの動画と同じ。
-- 見られる人：担当者（@accel-partners.co.jp）と、ポータルのユーザー管理で「社内動画」にチェックを付けた人（共通の決まり）。
-- 何度実行しても同じ結果になる。

-- 1) アプリ一覧のタイル（slug が '/' で始まる行はポータル内のページへのリンク。名前・説明・並び順は画面から変えられる）
insert into public.apps (slug, title, description, "order")
select '/videos', '社内動画', 'MTG議事録・マニュアル・勉強用の動画（Vimeo）', 0
where not exists (select 1 from public.apps where slug = '/videos');

-- 2) 設定：どの Vimeo フォルダの中を出すか（1 行だけ）。書き込みはサーバーの API（担当者だけ）から
create table if not exists public.video_settings (
  id int primary key default 1 check (id = 1),
  root_folder_id text,
  root_folder_name text,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.video_settings enable row level security;
drop policy if exists video_settings_read on public.video_settings;
create policy video_settings_read on public.video_settings
  for select to authenticated using (public.can_use_app('/videos'));
