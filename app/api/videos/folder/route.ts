import { NextRequest } from 'next/server'
import { clearLibrary, folderInLibrary, folderUri, library, vimeo } from '@/lib/vimeo'
import { bad, videosRoute } from '@/lib/videosApi'

export const dynamic = 'force-dynamic'

/** POST：フォルダ（カテゴリー）を作る { name, parent }。parent は親フォルダの中のフォルダだけ */
export async function POST(req: NextRequest) {
  return videosRoute(req, async () => {
    const { name, parent } = (await req.json().catch(() => ({}))) as { name?: string; parent?: string }
    const title = String(name ?? '').trim()
    if (!title) return bad('フォルダ名を入れてください')
    const lib = await library(true)
    if (!lib) return bad('先に親フォルダを設定してください')
    const parentId = String(parent || lib.root.id)
    if (!folderInLibrary(lib, parentId)) return bad('このフォルダには作れません', 403)
    const parentUri = await folderUri(lib, parentId)
    const owner = parentUri.match(/^\/users\/\d+/)?.[0] ?? '/me'
    const created = (await vimeo(`${owner}/projects`, { method: 'POST', body: { name: title, parent_folder_uri: parentUri } })) as { uri: string; name: string }
    clearLibrary()
    return { id: created.uri.split('/').pop(), name: created.name }
  })
}

/** PATCH：フォルダ名を変える { id, name } */
export async function PATCH(req: NextRequest) {
  return videosRoute(req, async () => {
    const { id, name } = (await req.json().catch(() => ({}))) as { id?: string; name?: string }
    const title = String(name ?? '').trim()
    if (!id || !title) return bad('フォルダと名前を指定してください')
    const lib = await library(true)
    if (!lib || !folderInLibrary(lib, String(id))) return bad('このフォルダは変えられません', 403)
    await vimeo(await folderUri(lib, String(id)), { method: 'PATCH', body: { name: title } })
    clearLibrary()
    return { ok: true }
  })
}
