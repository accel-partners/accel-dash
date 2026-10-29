/** 社内動画（/videos）の画面側の共通部品。サーバーの型は lib/vimeo.ts と同じ形 */
import { supabase } from './supabase'

export const VIDEOS_SLUG = '/videos'

export type VFolder = { id: string; uri: string; name: string; description: string | null; parent: string | null; created_time: string }
export type VVideo = {
  id: string; name: string; description: string | null; duration: number; created_time: string
  thumb: string | null; tags: string[]; folder: string | null; embed: string | null; link: string | null
  privacy: { view: string; embed: string } | null; status: string | null
}
export type Library = { root: { id: string; name: string } | null; folders: VFolder[]; videos: VVideo[] }

/** ログイン中の本人のトークンを付けて API を呼ぶ。エラー文を Error にして投げる */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${data.session?.access_token ?? ''}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error || `エラー（${res.status}）`)
  return json as T
}

export function duration(s: number) {
  if (!s) return ''
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}

export function ymd(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

/** Vimeo で変換中か（アップロード直後は数分〜数十分かかる） */
export function processing(v: VVideo) {
  return !!v.status && !['complete', 'available'].includes(v.status)
}

/** フォルダ（とその下のフォルダ）に入っている動画の数 */
export function countIn(lib: Library, folderId: string): number {
  const kids = lib.folders.filter((f) => f.parent === folderId)
  return lib.videos.filter((v) => v.folder === folderId).length + kids.reduce((n, k) => n + countIn(lib, k.id), 0)
}

/** フォルダの表紙：中（下のフォルダも含む）でいちばん新しい動画のサムネイル */
export function coverOf(lib: Library, folderId: string): string | null {
  const ids = new Set<string>([folderId])
  for (let grew = true; grew;) {
    grew = false
    for (const f of lib.folders) if (f.parent && ids.has(f.parent) && !ids.has(f.id)) { ids.add(f.id); grew = true }
  }
  return lib.videos.find((v) => v.folder && ids.has(v.folder) && v.thumb)?.thumb ?? null
}

export function pathOf(lib: Library, folderId: string | null) {
  const path: VFolder[] = []
  let cur = folderId
  for (let i = 0; cur && cur !== lib.root?.id && i < 10; i++) {
    const f = lib.folders.find((x) => x.id === cur)
    if (!f) break
    path.unshift(f)
    cur = f.parent
  }
  return path
}

/** フォルダの選択肢（「大カテ / 小カテ」の形の名前） */
export function folderOptions(lib: Library) {
  const out: { id: string; label: string }[] = []
  if (lib.root) out.push({ id: lib.root.id, label: `（${lib.root.name || '親フォルダ'}の直下）` })
  for (const f of lib.folders) out.push({ id: f.id, label: pathOf(lib, f.id).map((p) => p.name).join(' / ') })
  return out.sort((a, b) => (a.id === lib.root?.id ? -1 : b.id === lib.root?.id ? 1 : a.label.localeCompare(b.label, 'ja')))
}

/** ブラウザから Vimeo へ直接送る（tus。1 回の PATCH で全部送る） */
export function uploadToVimeo(file: File, uploadLink: string, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PATCH', uploadLink, true)
    xhr.setRequestHeader('Tus-Resumable', '1.0.0')
    xhr.setRequestHeader('Upload-Offset', '0')
    xhr.setRequestHeader('Content-Type', 'application/offset+octet-stream')
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.floor((e.loaded / e.total) * 100)) }
    xhr.onload = () => (xhr.status === 204 || xhr.status === 200 ? resolve() : reject(new Error(`アップロードに失敗しました（${xhr.status}）`)))
    xhr.onerror = () => reject(new Error('ネットワークエラーで止まりました。もう一度お試しください'))
    xhr.send(file)
  })
}
