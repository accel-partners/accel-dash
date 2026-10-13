@AGENTS.md

# アプリの権限（全アプリ共通・新しく作るものも同じ）

- 担当者（@accel-partners.co.jp）は全アプリ。それ以外は、ポータルのユーザー管理でそのアプリにチェックが付いている人（`app_access`）だけ。チェックがあれば、そのアプリの中は担当者と同じように使える
- 「社内メンバー専用」で止めない（`is_staff()` だけの RLS・メールのドメインだけの判定を新しく書かない）
  - 画面：`canUseApp('<apps.slug>', email)`（lib/appAccess.ts）
  - テーブルの RLS：`public.can_use_app('<apps.slug>')`（supabase/app_access_open.sql）
  - サーバーの API：`requireAppUser(req, '<apps.slug>')`（lib/supabaseAdmin.ts）。ユーザー管理・アプリ編集など管理の操作だけ `requireAdmin`
  - 別のサブドメインのアプリ：ログイン中の本人のトークンで共有 Supabase の `rpc('can_use_app', { p_slug: '<ホスト名>' })`
- 例外：基幹システムの財務（has_feature）、Magnet・アクセルガード（社外の人は自分の会社の分だけ）
- 権限まわりを変えるときは、先に「誰が見えるようになるか」をユーザーに確認する
