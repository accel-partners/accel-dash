/**
 * アプリの権限（社内アプリ全部・今後作るものも同じ決まり）
 *
 *   担当者（@accel-partners.co.jp）… 全アプリ
 *   それ以外 … ポータルのユーザー管理で、そのアプリにチェックが付いている人（app_access に行がある人）
 *              チェックが付いていれば、そのアプリでは担当者と同じことができる
 *
 * 本当の守りは DB 側（RLS の public.can_use_app、supabase/app_access_open.sql）。ここは画面の出し分け用。
 * 新しいアプリ・ページを作ったら：
 *   1. 画面は canUseApp('<apps.slug>') で出し分ける（is_staff だけで止めない）
 *   2. テーブルの RLS は public.can_use_app('<apps.slug>')
 *   3. サーバーの API は requireAppUser(req, '<apps.slug>')（lib/supabaseAdmin.ts）
 * apps.slug は '/jitsumu'・'magnet'・'https://crm.accel-dash.com' のどれでもよい（appKey でそろえて比べる）。
 */
import { supabase } from './supabase'
import { appKey } from './appKeyShared'

export { appKey }

export const STAFF_DOMAIN = '@accel-partners.co.jp'

/** ログイン中の本人がそのアプリを使えるか（担当者は常に true） */
export async function canUseApp(slug: string, email?: string | null): Promise<boolean> {
  if ((email || '').toLowerCase().endsWith(STAFF_DOMAIN)) return true
  const { data, error } = await supabase.rpc('can_use_app', { p_slug: slug })
  if (error) console.warn('[appAccess] can_use_app:', error.message)
  return data === true
}

/** 権限がないときの案内（全ページ共通の文言） */
export const NO_ACCESS_TEXT = 'このページを見る権限がありません。'
export const NO_ACCESS_HINT = '管理者に、ポータルのユーザー管理でこのアプリにチェックを付けてもらってください。'
