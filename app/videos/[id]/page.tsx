'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, Check, ChevronRight, Clock, Copy, Lock, Pencil, Video } from 'lucide-react'
import Shell from '@/components/videos/Shell'
import { EditVideoModal } from '@/components/videos/Modals'
import { api, duration, processing, ymd, type Library, type VVideo } from '@/lib/videosClient'

type One = { root: { id: string; name: string }; video: VVideo; path: { id: string; name: string }[] }

/** 動画 1 本を見る。同じフォルダのほかの動画も横に並べる */
export default function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <Shell>{() => <Player id={id} />}</Shell>
}

function embedUrl(v: VVideo) {
  if (!v.embed) return null
  const u = new URL(v.embed)
  for (const [k, val] of Object.entries({ title: '0', byline: '0', portrait: '0', dnt: '1' })) u.searchParams.set(k, val)
  return u.toString()
}

function Player({ id }: { id: string }) {
  const router = useRouter()
  const [one, setOne] = useState<One | null>(null)
  const [lib, setLib] = useState<Library | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [o, l] = await Promise.all([api<One>(`/api/videos/video/${id}`), api<Library>('/api/videos/library')])
      setOne(o); setLib(l)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }, [id])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- 開いたときに Vimeo から読む
  useEffect(() => { void load() }, [load])

  if (error) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-red-800">
      <p>{error}</p><Link href="/videos" className="mt-4 inline-block font-semibold text-accel-primary hover:underline">社内動画の一覧へ</Link>
    </div>
  )
  if (!one) return <p className="py-20 text-center text-black/70">読み込み中…</p>

  const v = one.video
  const src = embedUrl(v)
  const siblings = (lib?.videos ?? []).filter((x) => x.folder === v.folder && x.id !== v.id).slice(0, 12)
  const backHref = v.folder && v.folder !== one.root.id ? `/videos?f=${v.folder}` : '/videos'
  const internal = v.privacy?.view === 'disable'

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        <nav className="mb-3 flex flex-wrap items-center gap-1 text-sm">
          <Link href={backHref} className="mr-2 flex items-center gap-1 text-black/70 hover:text-black"><ArrowLeft size={15} /> 戻る</Link>
          <Link href="/videos" className="text-accel-primary hover:underline">{one.root.name || '社内動画'}</Link>
          {one.path.map((p) => (
            <span key={p.id} className="flex items-center gap-1"><ChevronRight size={14} className="text-black/40" /><Link href={`/videos?f=${p.id}`} className="text-accel-primary hover:underline">{p.name}</Link></span>
          ))}
        </nav>

        <div className="overflow-hidden rounded-xl bg-black shadow">
          <div className="relative aspect-video">
            {processing(v) ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-white/80"><Video size={36} /><p>Vimeo で変換中です。しばらくしてから開き直してください。</p></div>
            ) : src ? (
              <iframe src={src} className="absolute inset-0 h-full w-full" allow="autoplay; fullscreen; picture-in-picture; clipboard-write" allowFullScreen title={v.name} />
            ) : (
              <div className="flex h-full items-center justify-center text-white/80">この動画は埋め込みで再生できない設定です（Vimeo の公開設定を確認してください）</div>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-black">{v.name}</h1>
          <div className="flex gap-2">
            <button
              onClick={async () => { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
              className="flex items-center gap-1.5 rounded-lg border-2 border-border-soft bg-surface px-3 py-2 text-sm font-semibold text-black hover:border-accel-secondary"
            >{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'コピーしました' : 'リンクをコピー'}</button>
            <button onClick={() => setEditing(true)} disabled={!lib} className="flex items-center gap-1.5 rounded-lg border-2 border-border-soft bg-surface px-3 py-2 text-sm font-semibold text-black hover:border-accel-secondary disabled:opacity-50"><Pencil size={15} /> 編集</button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-black/70">
          <span className="flex items-center gap-1"><Calendar size={14} /> {ymd(v.created_time)}</span>
          {v.duration > 0 && <span className="flex items-center gap-1"><Clock size={14} /> {duration(v.duration)}</span>}
          {internal && <span className="flex items-center gap-1"><Lock size={14} /> アクセルダッシュの中だけで再生</span>}
        </div>
        {v.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{v.tags.map((t) => <span key={t} className="rounded-full bg-accel-lightest px-3 py-0.5 text-sm text-accel-text">{t}</span>)}</div>}
        {v.description && <div className="mt-4 whitespace-pre-wrap rounded-xl border border-border-soft bg-surface p-4 text-black">{v.description}</div>}
      </div>

      <aside>
        <h2 className="mb-3 text-lg font-bold text-black">同じフォルダの動画</h2>
        {siblings.length ? (
          <div className="space-y-3">
            {siblings.map((s) => (
              <Link key={s.id} href={`/videos/${s.id}`} className="flex gap-3 rounded-lg p-1.5 hover:bg-surface">
                <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded bg-accel-dark">
                  {s.thumb && <img src={s.thumb} alt="" className="h-full w-full object-cover" />}
                  {s.duration > 0 && <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-xs text-white">{duration(s.duration)}</span>}
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-bold leading-snug text-black">{s.name}</p>
                  <p className="text-xs text-black/60">{ymd(s.created_time)}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : <p className="text-sm text-black/60">ほかの動画はありません</p>}
      </aside>

      {editing && lib && (
        <EditVideoModal lib={lib} video={v} onClose={() => setEditing(false)} onDone={(_m, deleted) => { setEditing(false); if (deleted) router.push(backHref); else void load() }} />
      )}
    </div>
  )
}
