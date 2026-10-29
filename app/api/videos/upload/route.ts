import { NextRequest } from 'next/server'
import { clearLibrary, folderInLibrary, folderUri, library, makeInternal, vimeo } from '@/lib/vimeo'
import { bad, videosRoute } from '@/lib/videosApi'

export const dynamic = 'force-dynamic'

/**
 * アップロードの準備：Vimeo に動画の枠をフォルダの中に作り、ブラウザから直接送る先（upload_link）を返す。
 * ファイル本体はサーバーを通らず、ブラウザ → Vimeo に直接送る（大きい録画でも Vercel の上限にかからない）。
 * 公開範囲は「Vimeo 上では非表示・埋め込みはアクセルダッシュだけ」にする（できなければ限定公開のまま）。
 */
export async function POST(req: NextRequest) {
  return videosRoute(req, async () => {
    const { name, description, size, folderId } = (await req.json().catch(() => ({}))) as { name?: string; description?: string; size?: number; folderId?: string }
    const title = String(name ?? '').trim()
    if (!title || !size) return bad('タイトルとファイルを指定してください')
    const lib = await library(true)
    if (!lib) return bad('先に親フォルダを設定してください')
    const target = String(folderId || lib.root.id)
    if (!folderInLibrary(lib, target)) return bad('このフォルダには入れられません', 403)
    const uri = await folderUri(lib, target)
    const base = { upload: { approach: 'tus', size }, name: title, description: String(description ?? ''), privacy: { view: 'unlisted', embed: 'public' } }
    let created: { uri: string; upload?: { upload_link?: string }; parent_folder?: { uri?: string } | null }
    let folderError: string | null = null
    try {
      created = (await vimeo('/me/videos', { method: 'POST', body: { ...base, folder_uri: uri } })) as typeof created
    } catch (e) {
      folderError = e instanceof Error ? e.message.slice(0, 160) : String(e)
      created = (await vimeo('/me/videos', { method: 'POST', body: base })) as typeof created
    }
    const videoId = created.uri.split('/').pop() ?? ''
    const placed = created.parent_folder?.uri ? created.parent_folder.uri.split('/').pop() === target : !folderError
    const privacy = await makeInternal(videoId)
    clearLibrary()
    return { videoId, uploadLink: created.upload?.upload_link, placed, folderError: placed ? null : folderError, privacy }
  })
}
