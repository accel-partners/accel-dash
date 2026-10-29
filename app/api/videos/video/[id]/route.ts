import { NextRequest } from 'next/server'
import { clearLibrary, folderInLibrary, folderPath, folderUri, library, videoInLibrary, vimeo } from '@/lib/vimeo'
import { bad, videosRoute } from '@/lib/videosApi'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

async function load(id: string) {
  const lib = await library()
  if (!lib) return { lib: null, video: null }
  return { lib, video: await videoInLibrary(lib, id) }
}

/** GET：動画 1 本（親フォルダの中のものだけ）とパンくず */
export async function GET(req: NextRequest, ctx: Ctx) {
  return videosRoute(req, async () => {
    const { id } = await ctx.params
    const { lib, video } = await load(id)
    if (!lib || !video) return bad('動画が見つかりません（社内動画のフォルダの外か、削除されています）', 404)
    return { root: lib.root, video, path: folderPath(lib, video.folder) }
  })
}

/** PATCH：タイトル・説明を変える { name, description } */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return videosRoute(req, async () => {
    const { id } = await ctx.params
    const { video } = await load(id)
    if (!video) return bad('この動画は変えられません', 404)
    const { name, description } = (await req.json().catch(() => ({}))) as { name?: string; description?: string }
    const body: Record<string, string> = {}
    if (typeof name === 'string' && name.trim()) body.name = name.trim()
    if (typeof description === 'string') body.description = description
    if (!Object.keys(body).length) return bad('変える内容がありません')
    await vimeo(`/videos/${id}`, { method: 'PATCH', body })
    clearLibrary()
    return { ok: true }
  })
}

/** PUT：別のフォルダへ移す { folderId }（移す先も親フォルダの中だけ） */
export async function PUT(req: NextRequest, ctx: Ctx) {
  return videosRoute(req, async () => {
    const { id } = await ctx.params
    const { folderId } = (await req.json().catch(() => ({}))) as { folderId?: string }
    const { lib, video } = await load(id)
    if (!lib || !video) return bad('この動画は移せません', 404)
    if (!folderId || !folderInLibrary(lib, String(folderId))) return bad('このフォルダには移せません', 403)
    await vimeo(`${await folderUri(lib, String(folderId))}/videos/${id}`, { method: 'PUT' })
    clearLibrary()
    return { ok: true }
  })
}

/** DELETE：Vimeo から動画を削除する（元に戻せない。画面で確認してから呼ぶ） */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return videosRoute(req, async () => {
    const { id } = await ctx.params
    const { video } = await load(id)
    if (!video) return bad('この動画は削除できません', 404)
    await vimeo(`/videos/${id}`, { method: 'DELETE' })
    clearLibrary()
    return { ok: true }
  })
}
