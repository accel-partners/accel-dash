import { NextRequest, NextResponse } from 'next/server'
import { requireAppUser, supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

/**
 * 資料置き場にアップロードしたファイルの共有用 URL（/f/<token>）の中身。
 * - 「社外にも共有」（is_public）がオンのファイル：誰でも、短い時間だけ使える署名つき URL を返す
 * - それ以外：資料置き場を見られる人（担当者・ポータルでチェックした人）だけ。ログインのトークンが要る
 */
const INLINE = /^(application\/pdf|image\/|text\/plain|video\/|audio\/)/

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  if (!/^[0-9a-f]{32,80}$/.test(token)) return NextResponse.json({ error: 'URL が正しくありません' }, { status: 404 })
  const { data: it } = await supabaseAdmin.from('doc_items').select('kind, storage_path, file_name, mime, is_public').eq('share_token', token).maybeSingle()
  if (!it || it.kind !== 'file' || !it.storage_path) return NextResponse.json({ error: 'ファイルが見つかりません（削除されたか、URL が違います）' }, { status: 404 })
  if (!it.is_public) {
    const auth = await requireAppUser(req, '/docs')
    if (!auth.ok) return NextResponse.json({ error: auth.status === 401 ? 'login' : auth.message, needLogin: auth.status === 401 }, { status: auth.status })
  }
  const download = INLINE.test(it.mime || '') ? undefined : (it.file_name || true)
  const { data, error } = await supabaseAdmin.storage.from('docs').createSignedUrl(it.storage_path, 120, download ? { download } : undefined)
  if (error || !data) return NextResponse.json({ error: 'ファイルを開けませんでした' }, { status: 500 })
  return NextResponse.json({ url: data.signedUrl, name: it.file_name })
}
