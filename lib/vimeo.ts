/**
 * 社内動画（/videos）の Vimeo 読み書き。サーバー専用（VIMEO_ACCESS_TOKEN と service role を使う）。
 *
 * 仕組みはビジネスカレッジの動画機能と同じ：
 *   Vimeo の「親フォルダ」1 つを決め、その中のフォルダ＝大カテゴリー、さらに中のフォルダ＝小カテゴリー。
 *   親フォルダの外の動画・フォルダは、ID を知っていても読めない・触れない（inLibrary で必ず確かめる）。
 * 親フォルダは画面（担当者だけ）で選び、video_settings に保存する（supabase/videos.sql）。
 */
import { supabaseAdmin } from './supabaseAdmin'

const BASE = 'https://api.vimeo.com'
const ACCEPT = 'application/vnd.vimeo.*+json;version=3.4'

export const VIDEO_FIELDS =
  'uri,name,description,duration,created_time,modified_time,pictures.sizes,tags.name,link,player_embed_url,privacy.view,privacy.embed,parent_folder.uri,status,transcode.status'

export type VFolder = { id: string; uri: string; name: string; description: string | null; parent: string | null; created_time: string }
export type VVideo = {
  id: string
  name: string
  description: string | null
  duration: number
  created_time: string
  thumb: string | null
  tags: string[]
  folder: string | null
  embed: string | null
  link: string | null
  privacy: { view: string; embed: string } | null
  status: string | null
}
export type Library = { root: { id: string; name: string }; folders: VFolder[]; videos: VVideo[] }

export function vimeoToken() {
  return (process.env.VIMEO_ACCESS_TOKEN ?? '').trim()
}

export class VimeoError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

/** Vimeo の応答本文はエラー文に少しだけ載せる（トークンは載らない） */
export async function vimeo(path: string, init: { method?: string; body?: unknown } = {}): Promise<unknown> {
  const token = vimeoToken()
  if (!token) throw new VimeoError(500, 'Vimeo のトークン（VIMEO_ACCESS_TOKEN）が Vercel に設定されていません')
  const res = await fetch(path.startsWith('http') ? path : `${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: ACCEPT,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  })
  if (res.status === 204) return null
  const text = await res.text()
  if (!res.ok) {
    const hint =
      res.status === 401 ? '（トークンが無効か期限切れ）'
      : res.status === 403 ? '（トークンの権限が足りない可能性。Interact・Edit・Upload・Create・Delete が必要）'
      : res.status === 404 ? '（見つかりません）' : ''
    throw new VimeoError(res.status, `Vimeo ${res.status}${hint} ${text.slice(0, 160)}`)
  }
  return text.trim() ? JSON.parse(text) : null
}

const idOf = (uri?: string | null) => (uri ? uri.split('/').pop() ?? '' : '')

function bestThumb(p?: { sizes?: { width: number; link: string }[] }) {
  const s = p?.sizes ?? []
  if (!s.length) return null
  const fit = s.filter((x) => x.width <= 960)
  return (fit.length ? fit[fit.length - 1] : s[s.length - 1]).link
}

type RawVideo = {
  uri: string; name: string; description: string | null; duration: number; created_time: string
  pictures?: { sizes?: { width: number; link: string }[] }; tags?: { name: string }[]; link?: string
  player_embed_url?: string; privacy?: { view: string; embed: string }; parent_folder?: { uri?: string } | null
  status?: string; transcode?: { status?: string }
}

export function toVideo(v: RawVideo, folder?: string | null): VVideo {
  return {
    id: idOf(v.uri),
    name: v.name,
    description: v.description ?? null,
    duration: v.duration ?? 0,
    created_time: v.created_time,
    thumb: bestThumb(v.pictures),
    tags: (v.tags ?? []).map((t) => t.name),
    folder: folder ?? (idOf(v.parent_folder?.uri) || null),
    embed: v.player_embed_url ?? null,
    link: v.link ?? null,
    privacy: v.privacy ? { view: v.privacy.view, embed: v.privacy.embed } : null,
    status: v.transcode?.status ?? v.status ?? null,
  }
}

// ---------- 親フォルダ（設定）

export async function getRoot(): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabaseAdmin.from('video_settings').select('root_folder_id, root_folder_name').eq('id', 1).maybeSingle()
  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) throw new VimeoError(500, 'テーブルがまだありません。supabase/videos.sql を実行してください')
    throw new VimeoError(500, `設定の読み込みに失敗：${error.message}`)
  }
  if (!data?.root_folder_id) return null
  return { id: String(data.root_folder_id), name: String(data.root_folder_name ?? '') }
}

export async function setRoot(id: string, name: string, email: string) {
  const { error } = await supabaseAdmin.from('video_settings').upsert({ id: 1, root_folder_id: id, root_folder_name: name, updated_by: email, updated_at: new Date().toISOString() })
  if (error) throw new VimeoError(500, `設定の保存に失敗：${error.message}`)
  clearLibrary()
}

// ---------- 親フォルダの中身（フォルダの木と動画）。少しの間だけ覚えておく

let cache: { at: number; rootId: string; lib: Library } | null = null
const TTL = 60_000

export function clearLibrary() { cache = null }

async function folderItems(folderId: string) {
  const out: { folders: VFolder[]; videos: VVideo[] } = { folders: [], videos: [] }
  const vf = VIDEO_FIELDS.split(',').map((f) => `video.${f}`).join(',')
  let next: string | null = `/me/projects/${folderId}/items?per_page=100&fields=type,folder.uri,folder.name,folder.description,folder.created_time,${vf}`
  for (let page = 0; next && page < 20; page++) {
    const r = (await vimeo(next)) as { data?: { type: string; folder?: { uri: string; name: string; description: string | null; created_time: string }; video?: RawVideo }[]; paging?: { next?: string | null } }
    for (const it of r?.data ?? []) {
      if (it.type === 'folder' && it.folder) {
        out.folders.push({ id: idOf(it.folder.uri), uri: it.folder.uri, name: it.folder.name, description: it.folder.description ?? null, parent: folderId, created_time: it.folder.created_time })
      } else if (it.type === 'video' && it.video) {
        out.videos.push(toVideo(it.video, folderId))
      }
    }
    next = r?.paging?.next ?? null
  }
  return out
}

export async function library(force = false): Promise<Library | null> {
  const root = await getRoot()
  if (!root) return null
  if (!force && cache && cache.rootId === root.id && Date.now() - cache.at < TTL) return cache.lib
  const folders: VFolder[] = []
  const videos: VVideo[] = []
  const seen = new Set<string>([root.id])
  let level = [root.id]
  // 深さ 6 まで（大カテ・小カテの想定より十分深い）。同じ深さのフォルダはまとめて読む
  for (let depth = 0; level.length && depth < 6; depth++) {
    const results = await Promise.all(level.map((id) => folderItems(id)))
    const nextLevel: string[] = []
    for (const r of results) {
      for (const f of r.folders) if (!seen.has(f.id)) { seen.add(f.id); folders.push(f); nextLevel.push(f.id) }
      videos.push(...r.videos)
    }
    level = nextLevel
  }
  videos.sort((a, b) => b.created_time.localeCompare(a.created_time))
  const lib = { root, folders, videos }
  cache = { at: Date.now(), rootId: root.id, lib }
  return lib
}

/** フォルダが親フォルダの中（親フォルダ自身を含む）か */
export function folderInLibrary(lib: Library, folderId: string) {
  return folderId === lib.root.id || lib.folders.some((f) => f.id === folderId)
}

/** 動画が親フォルダの中か。覚えている一覧に無ければ（アップロード直後など）Vimeo に聞いて確かめる */
export async function videoInLibrary(lib: Library, videoId: string): Promise<VVideo | null> {
  if (!/^\d+$/.test(videoId)) return null
  const raw = (await vimeo(`/videos/${videoId}?fields=${VIDEO_FIELDS}`)) as RawVideo
  const v = toVideo(raw)
  const known = lib.videos.find((x) => x.id === videoId)
  const folder = v.folder || known?.folder || null
  if (!folder || !folderInLibrary(lib, folder)) {
    // 一覧が古いだけかもしれないので、1 回だけ読み直して確かめる
    const fresh = await library(true)
    const f2 = v.folder || fresh?.videos.find((x) => x.id === videoId)?.folder || null
    if (!fresh || !f2 || !folderInLibrary(fresh, f2)) return null
    return { ...v, folder: f2 }
  }
  return { ...v, folder }
}

/** フォルダの完全な uri（チームのフォルダは持ち主がチームオーナーなので /me ではなくこれを使う） */
export async function folderUri(lib: Library, folderId: string) {
  const f = lib.folders.find((x) => x.id === folderId)
  if (f) return f.uri
  const r = (await vimeo(`/me/projects/${folderId}?fields=uri`)) as { uri?: string }
  return r?.uri ?? `/me/projects/${folderId}`
}

/** 親フォルダから順に並べたパス（パンくず用） */
export function folderPath(lib: Library, folderId: string | null) {
  const path: { id: string; name: string }[] = []
  let cur = folderId
  for (let i = 0; cur && cur !== lib.root.id && i < 10; i++) {
    const f = lib.folders.find((x) => x.id === cur)
    if (!f) break
    path.unshift({ id: f.id, name: f.name })
    cur = f.parent
  }
  return path
}

/** 動画を社内だけで見られるようにする：Vimeo 上では非表示、埋め込みはアクセルダッシュだけ。
 *  プランや権限でできなければ「限定公開（URL を知っている人）」のまま。結果を返す */
export async function makeInternal(videoId: string): Promise<'internal' | 'unlisted'> {
  const host = (() => {
    try { return new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://accel-dash.com').host } catch { return 'accel-dash.com' }
  })()
  try {
    await vimeo(`/videos/${videoId}/privacy/domains/${encodeURIComponent(host)}`, { method: 'PUT' })
    await vimeo(`/videos/${videoId}`, { method: 'PATCH', body: { privacy: { view: 'disable', embed: 'whitelist' } } })
    return 'internal'
  } catch (e) {
    console.warn('[vimeo] makeInternal failed:', e instanceof Error ? e.message.slice(0, 120) : e)
    return 'unlisted'
  }
}
