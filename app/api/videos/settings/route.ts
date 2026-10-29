import { NextRequest } from 'next/server'
import { ADMIN_DOMAIN } from '@/lib/supabaseAdmin'
import { getRoot, setRoot, vimeo, vimeoToken } from '@/lib/vimeo'
import { bad, videosRoute } from '@/lib/videosApi'

export const dynamic = 'force-dynamic'

const NEED = ['public', 'private', 'create', 'edit', 'delete', 'upload', 'interact', 'video_files']

/**
 * GET：今の親フォルダ。担当者には、選べる Vimeo のフォルダと、トークンの権限の確認結果も返す（トークンの値は返さない）
 * PUT：親フォルダを変える（担当者だけ）。{ folder: '25313251' か Vimeo のフォルダの URL }
 */
export async function GET(req: NextRequest) {
  return videosRoute(req, async (user) => {
    const root = await getRoot()
    const isAdmin = user.email.toLowerCase().endsWith(ADMIN_DOMAIN)
    if (!isAdmin) return { root, isAdmin }
    if (!vimeoToken()) return { root, isAdmin, token: { ok: false, error: 'Vercel に VIMEO_ACCESS_TOKEN が設定されていません' }, folders: [] }
    let token: Record<string, unknown>
    try {
      const v = (await vimeo('/oauth/verify')) as { scope?: string; user?: { name?: string } }
      const scopes = (v?.scope ?? '').split(/\s+/).filter(Boolean)
      token = { ok: true, user: v?.user?.name ?? null, missing: NEED.filter((s) => !scopes.includes(s)) }
    } catch (e) {
      token = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
    let folders: { id: string; name: string }[] = []
    try {
      const r = (await vimeo('/me/projects?per_page=100&sort=name&fields=uri,name')) as { data?: { uri: string; name: string }[] }
      folders = (r?.data ?? []).map((f) => ({ id: f.uri.split('/').pop() ?? '', name: f.name }))
    } catch { /* トークンが使えないときは空 */ }
    return { root, isAdmin, token, folders }
  })
}

export async function PUT(req: NextRequest) {
  return videosRoute(req, async (user) => {
    const { folder } = (await req.json().catch(() => ({}))) as { folder?: string }
    const id = String(folder ?? '').match(/(?:folder\/|projects\/)?(\d{4,})\/?(?:\?.*)?$/)?.[1]
    if (!id) return bad('Vimeo のフォルダの URL か番号を入れてください（例：https://vimeo.com/user/…/folder/12345678）')
    const f = (await vimeo(`/me/projects/${id}?fields=uri,name`)) as { name?: string }
    await setRoot(id, f?.name ?? '', user.email)
    return { root: { id, name: f?.name ?? '' } }
  }, { admin: true })
}
