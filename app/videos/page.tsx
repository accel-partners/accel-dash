'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronRight, Clock, Folder, FolderPlus, Loader2, Pencil, RefreshCw, Search, Settings, Upload, Video, X } from 'lucide-react'
import Shell from '@/components/videos/Shell'
import { EditVideoModal, FolderModal, SettingsModal, UploadModal } from '@/components/videos/Modals'
import { api, countIn, coverOf, duration, pathOf, processing, ymd, type Library, type VVideo } from '@/lib/videosClient'

/**
 * 社内動画（MTG議事録・マニュアル・勉強用）。
 * Vimeo の親フォルダの中だけを出す（ビジネスカレッジの動画と同じ仕組み）。中のフォルダ＝大カテ、その中＝小カテ。
 * ?f=<フォルダ番号> でフォルダを開く。検索は全フォルダの動画のタイトル・説明・タグ・フォルダ名。
 */
export default function VideosPage() {
  return (
    <Shell>{(me) => (
      <Suspense fallback={<p className="py-20 text-center text-black/70">読み込み中…</p>}>
        <Browser isAdmin={me.isAdmin} />
      </Suspense>
    )}</Shell>
  )
}

type Dialog =
  | { kind: 'upload'; file?: File | null }
  | { kind: 'folder'; edit?: { id: string; name: string } }
  | { kind: 'edit'; video: VVideo }
  | { kind: 'settings' }
  | null

function Browser({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter()
  const params = useSearchParams()
  const [lib, setLib] = useState<Library | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [drag, setDrag] = useState(false)

  const load = useCallback(async (refresh = false) => {
    setLoading(true); setError(null)
    try { setLib(await api<Library>(`/api/videos/library${refresh ? '?refresh=1' : ''}`)) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    setLoading(false)
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- 開いたときに Vimeo から読む
  useEffect(() => { void load() }, [load])

  const rootId = lib?.root?.id ?? ''
  const current = params.get('f') || rootId
  const folder = lib?.folders.find((f) => f.id === current) ?? null
  const path = lib ? pathOf(lib, current) : []
  const subfolders = useMemo(() => (lib ? lib.folders.filter((f) => f.parent === current).sort((a, b) => a.name.localeCompare(b.name, 'ja')) : []), [lib, current])
  const here = useMemo(() => (lib ? lib.videos.filter((v) => v.folder === current) : []), [lib, current])
  const folderName = useCallback((id: string | null) => (lib && id ? pathOf(lib, id).map((p) => p.name).join(' / ') || lib.root?.name || '' : ''), [lib])

  const hits = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!lib || !words.length) return null
    return lib.videos.filter((v) => {
      const text = [v.name, v.description ?? '', v.tags.join(' '), folderName(v.folder)].join(' ').toLowerCase()
      return words.every((w) => text.includes(w))
    })
  }, [lib, q, folderName])

  const open = (id: string) => router.push(id === rootId ? '/videos' : `/videos?f=${id}`)
  const done = (msg: string) => { setDialog(null); setNotice(msg); void load(true) }

  if (error && !lib) return <ErrorPanel text={error} onRetry={() => load(true)} />
  if (!lib) return <p className="py-20 text-center text-black/70">読み込み中…</p>

  if (!lib.root) {
    return (
      <div className="rounded-xl border border-border-soft bg-surface p-8 text-center">
        <h1 className="mb-2 text-2xl font-bold text-black">社内動画</h1>
        <p className="text-black/70">まだ Vimeo の親フォルダが設定されていません。</p>
        {isAdmin ? (
          <button onClick={() => setDialog({ kind: 'settings' })} className="mt-5 rounded-lg bg-accel-primary px-5 py-2.5 font-bold text-white hover:bg-accel-hover">親フォルダを選ぶ</button>
        ) : <p className="mt-2 text-sm text-black/60">担当者（@accel-partners.co.jp）に設定してもらってください。</p>}
        {dialog?.kind === 'settings' && <SettingsModal onClose={() => setDialog(null)} onDone={done} />}
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDrag(true) } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false) }}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) setDialog({ kind: 'upload', file: f }) }}
      className="relative"
    >
      {drag && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-4 border-dashed border-accel-primary bg-accel-lightest/80 text-lg font-bold text-accel-text">ここに離すとアップロード</div>}

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-black">{folder?.name ?? '社内動画'}</h1>
          <p className="mt-1 text-sm text-black/70">{folder?.description || 'MTG議事録・マニュアル・勉強用の動画。動画ファイルを画面にドロップしてもアップロードできます。'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setDialog({ kind: 'upload' })} className="flex items-center gap-1.5 rounded-lg bg-accel-primary px-4 py-2 font-bold text-white hover:bg-accel-hover"><Upload size={17} /> アップロード</button>
          <button onClick={() => setDialog({ kind: 'folder' })} className="flex items-center gap-1.5 rounded-lg border-2 border-border-soft bg-surface px-4 py-2 font-semibold text-black hover:border-accel-secondary"><FolderPlus size={17} /> フォルダを作る</button>
          {folder && <button onClick={() => setDialog({ kind: 'folder', edit: { id: folder.id, name: folder.name } })} className="flex items-center gap-1.5 rounded-lg border-2 border-border-soft bg-surface px-4 py-2 font-semibold text-black hover:border-accel-secondary"><Pencil size={16} /> 名前を変える</button>}
          <button onClick={() => load(true)} disabled={loading} title="Vimeo から読み直す" className="flex items-center gap-1.5 rounded-lg border-2 border-border-soft bg-surface px-3 py-2 text-black hover:border-accel-secondary disabled:opacity-50">
            {loading ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
          </button>
          {isAdmin && <button onClick={() => setDialog({ kind: 'settings' })} title="設定（担当者だけ）" className="flex items-center gap-1.5 rounded-lg border-2 border-border-soft bg-surface px-3 py-2 text-black hover:border-accel-secondary"><Settings size={17} /></button>}
        </div>
      </div>

      {notice && (
        <div className="mb-5 flex items-start justify-between gap-4 rounded-lg bg-accel-lightest px-4 py-3 text-sm text-black">
          <span>{notice}</span><button onClick={() => setNotice(null)} aria-label="閉じる"><X size={16} /></button>
        </div>
      )}
      {error && <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/50" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="全部の動画から探す（タイトル・説明・フォルダ名）" className="w-full rounded-lg border-2 border-border-soft bg-surface py-2.5 pl-10 pr-9 text-black outline-none focus:border-accel-primary" />
          {q && <button onClick={() => setQ('')} aria-label="消す" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-black/50 hover:text-black"><X size={16} /></button>}
        </div>
        {!hits && (
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            <Link href="/videos" className={path.length ? 'text-accel-primary hover:underline' : 'font-bold text-black'}>{lib.root.name || '社内動画'}</Link>
            {path.map((p, i) => (
              <span key={p.id} className="flex items-center gap-1">
                <ChevronRight size={14} className="text-black/40" />
                {i === path.length - 1 ? <span className="font-bold text-black">{p.name}</span> : <Link href={`/videos?f=${p.id}`} className="text-accel-primary hover:underline">{p.name}</Link>}
              </span>
            ))}
          </nav>
        )}
      </div>

      {hits ? (
        <section>
          <h2 className="mb-3 text-lg font-bold text-black">「{q.trim()}」の検索結果 {hits.length} 本</h2>
          {hits.length ? <Grid videos={hits} folderName={folderName} onEdit={(v) => setDialog({ kind: 'edit', video: v })} /> : <Empty text="見つかりませんでした" />}
        </section>
      ) : (
        <>
          {subfolders.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-lg font-bold text-black">{path.length ? 'フォルダ' : 'カテゴリー'}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {subfolders.map((f) => {
                  const cover = coverOf(lib, f.id)
                  const kids = lib.folders.filter((x) => x.parent === f.id).length
                  return (
                    <button key={f.id} onClick={() => open(f.id)} className="group overflow-hidden rounded-xl border border-border-soft bg-surface text-left shadow-sm transition hover:border-accel-secondary hover:shadow-md">
                      <div className="relative aspect-video bg-accel-lightest">
                        {cover ? <img src={cover} alt="" className="h-full w-full object-cover opacity-90 group-hover:opacity-100" /> : <Folder size={40} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-accel-secondary" />}
                      </div>
                      <div className="p-3">
                        <div className="flex items-center gap-2 font-bold text-black"><Folder size={17} className="shrink-0 text-accel-primary" /><span className="truncate">{f.name}</span></div>
                        <p className="mt-0.5 text-sm text-black/70">{countIn(lib, f.id)} 本{kids ? `・フォルダ ${kids}` : ''}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          )}
          {(here.length > 0 || subfolders.length === 0) && (
            <section>
              <h2 className="mb-3 text-lg font-bold text-black">{subfolders.length ? 'このフォルダの動画' : '動画'} {here.length} 本</h2>
              {here.length ? <Grid videos={here} onEdit={(v) => setDialog({ kind: 'edit', video: v })} /> : <Empty text="まだ動画がありません。「アップロード」から追加できます（動画ファイルを画面にドロップしても上げられます）" />}
            </section>
          )}
          {!path.length && lib.videos.length > here.length && (
            <section className="mt-10">
              <h2 className="mb-3 text-lg font-bold text-black">新しい動画</h2>
              <Grid videos={lib.videos.slice(0, 8)} folderName={folderName} onEdit={(v) => setDialog({ kind: 'edit', video: v })} />
            </section>
          )}
        </>
      )}

      {dialog?.kind === 'upload' && <UploadModal lib={lib} folderId={current} initialFile={dialog.file} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'folder' && <FolderModal lib={lib} parentId={current} edit={dialog.edit} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'edit' && <EditVideoModal lib={lib} video={dialog.video} onClose={() => setDialog(null)} onDone={(m) => done(m)} />}
      {dialog?.kind === 'settings' && <SettingsModal onClose={() => setDialog(null)} onDone={done} />}
    </div>
  )
}

function Grid({ videos, folderName, onEdit }: { videos: VVideo[]; folderName?: (id: string | null) => string; onEdit: (v: VVideo) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {videos.map((v) => (
        <div key={v.id} className="group relative overflow-hidden rounded-xl border border-border-soft bg-surface shadow-sm transition hover:border-accel-secondary hover:shadow-md">
          <Link href={`/videos/${v.id}`} className="block">
            <div className="relative aspect-video bg-accel-dark">
              {v.thumb && !processing(v) ? <img src={v.thumb} alt="" className="h-full w-full object-cover" /> : (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-white/80"><Video size={30} />{processing(v) && <span className="text-xs">Vimeo で変換中</span>}</div>
              )}
              {v.duration > 0 && <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-xs font-semibold text-white">{duration(v.duration)}</span>}
            </div>
            <div className="p-3">
              <p className="line-clamp-2 font-bold leading-snug text-black">{v.name}</p>
              <p className="mt-1 flex items-center gap-1 text-sm text-black/70"><Clock size={13} /> {ymd(v.created_time)}{folderName && v.folder ? <span className="truncate">・{folderName(v.folder)}</span> : null}</p>
            </div>
          </Link>
          <button onClick={() => onEdit(v)} title="編集" className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-black opacity-0 shadow transition group-hover:opacity-100 focus:opacity-100"><Pencil size={15} /></button>
        </div>
      ))}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-border-soft bg-surface px-6 py-10 text-center text-black/70">{text}</div>
}

function ErrorPanel({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-red-800">
      <p>動画を読み込めませんでした：{text}</p>
      <button onClick={onRetry} className="mt-4 rounded-lg border-2 border-red-300 bg-white px-4 py-2 font-semibold text-red-800">もう一度</button>
    </div>
  )
}
