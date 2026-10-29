'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, Check, Upload, Video, X } from 'lucide-react'
import { api, folderOptions, uploadToVimeo, type Library, type VVideo } from '@/lib/videosClient'

export const inputCls = 'w-full rounded-lg border-2 border-border-soft bg-surface px-3 py-2.5 text-black outline-none focus:border-accel-primary disabled:opacity-60'
export const btnPrimary = 'rounded-lg bg-accel-primary px-5 py-2.5 font-bold text-white hover:bg-accel-hover disabled:opacity-50'
export const btnSub = 'rounded-lg border-2 border-border-soft bg-surface px-5 py-2.5 font-semibold text-black hover:border-accel-secondary disabled:opacity-50'

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-black">{title}</h2>
          <button onClick={onClose} aria-label="閉じる" className="rounded-lg p-1 text-black/60 hover:bg-surface-muted hover:text-black"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-black">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-black/60">{hint}</span>}
    </label>
  )
}

export function ErrorBox({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
      <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span>{text}</span>
    </div>
  )
}

const isVideoFile = (f: File) => f.type.startsWith('video/') || /\.(mp4|mov|m4v|avi|mkv|webm|wmv)$/i.test(f.name)

/** 動画のアップロード：ブラウザ → Vimeo に直接送る。フォルダの中に作り、社内だけで見られる設定にする */
export function UploadModal({ lib, folderId, initialFile, onClose, onDone }: {
  lib: Library; folderId: string; initialFile?: File | null; onClose: () => void; onDone: (msg: string) => void
}) {
  const [file, setFile] = useState<File | null>(initialFile ?? null)
  const [title, setTitle] = useState(initialFile ? initialFile.name.replace(/\.[^.]+$/, '') : '')
  const [desc, setDesc] = useState('')
  const [folder, setFolder] = useState(folderId)
  const [pct, setPct] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'init' | 'upload' | 'folder' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  const busy = phase === 'init' || phase === 'upload' || phase === 'folder'

  const pick = (f?: File | null) => {
    if (!f) return
    if (!isVideoFile(f)) { setError('動画ファイル（MP4・MOV など）を選んでください'); return }
    setError(null); setFile(f)
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }

  // アップロード中にページを閉じようとしたら止める
  useEffect(() => {
    if (!busy) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [busy])

  async function go() {
    if (!file || !title.trim()) return
    setError(null); setPhase('init')
    try {
      const r = await api<{ videoId: string; uploadLink: string; placed: boolean; folderError: string | null; privacy: 'internal' | 'unlisted' }>(
        '/api/videos/upload', { method: 'POST', body: { name: title.trim(), description: desc.trim(), size: file.size, folderId: folder } })
      setPhase('upload')
      await uploadToVimeo(file, r.uploadLink, setPct)
      let note = ''
      if (!r.placed) {
        setPhase('folder')
        let last = r.folderError ?? ''
        for (const wait of [0, 1500, 4000]) {
          if (wait) await new Promise((ok) => setTimeout(ok, wait))
          try { await api(`/api/videos/video/${r.videoId}`, { method: 'PUT', body: { folderId: folder } }); last = ''; break } catch (e) { last = e instanceof Error ? e.message : String(e) }
        }
        if (last) note = `（フォルダに入れられませんでした：${last}。Vimeo で移してください）`
      }
      if (r.privacy !== 'internal') note += '（Vimeo のプランか権限の都合で「URL を知っている人は見られる」設定のままです）'
      setPhase('done')
      onDone(`「${title.trim()}」をアップロードしました。Vimeo の変換が終わると再生できます（数分〜数十分）${note}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setPhase('idle')
    }
  }

  const label = { idle: '', init: '準備中…', upload: `アップロード中 ${pct}%`, folder: 'フォルダに入れています…', done: '完了' }[phase]
  return (
    <Modal title="動画をアップロード" onClose={busy ? () => {} : onClose}>
      <div className="space-y-4">
        <div
          onClick={() => !busy && ref.current?.click()}
          onDragOver={(e) => { e.preventDefault(); if (!busy) setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (!busy) pick(e.dataTransfer.files?.[0]) }}
          className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-7 text-center ${drag ? 'border-accel-primary bg-accel-lightest' : file ? 'border-accel-secondary bg-accel-lightest/50' : 'border-border-soft hover:border-accel-secondary'} ${busy ? 'pointer-events-none opacity-60' : ''}`}
        >
          {file ? (
            <div className="flex items-center justify-center gap-2 text-accel-text">
              <Video size={20} /> <span className="max-w-xs truncate font-semibold">{file.name}</span>
              <span className="text-sm text-black/60">（{(file.size / 1024 / 1024).toFixed(0)} MB）</span>
            </div>
          ) : (
            <>
              <Upload size={30} className="mx-auto mb-2 text-accel-primary" />
              <p className="text-black">ここに動画をドラッグ＆ドロップ、またはクリックして選ぶ</p>
              <p className="text-sm text-black/60">MP4・MOV など。Zoom の録画もそのまま上げられます</p>
            </>
          )}
        </div>
        <input ref={ref} type="file" accept="video/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        <Field label="タイトル"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} placeholder="例：2026/10/29 定例MTG" /></Field>
        <Field label="説明（任意）" hint="議題・要点・資料のリンクなど。検索の対象になります">
          <textarea className={`${inputCls} resize-y`} rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} disabled={busy} />
        </Field>
        <Field label="入れるフォルダ">
          <select className={inputCls} value={folder} onChange={(e) => setFolder(e.target.value)} disabled={busy}>
            {folderOptions(lib).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </Field>
        {phase !== 'idle' && (
          <div>
            <div className="mb-1 flex items-center justify-between text-sm text-black/70"><span>{label}</span>{phase === 'done' && <Check size={16} className="text-accel-primary" />}</div>
            {phase === 'upload' && <div className="h-2 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-accel-primary transition-all" style={{ width: `${pct}%` }} /></div>}
            {phase === 'upload' && <p className="mt-1 text-xs text-black/60">終わるまでこの画面を閉じないでください</p>}
          </div>
        )}
        <ErrorBox text={error} />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} disabled={busy} className={btnSub}>{phase === 'done' ? '閉じる' : 'キャンセル'}</button>
        {phase !== 'done' && <button onClick={go} disabled={!file || !title.trim() || busy} className={btnPrimary}>{busy ? label : 'アップロード'}</button>}
      </div>
    </Modal>
  )
}

/** 動画のタイトル・説明・フォルダを変える。削除もここから（確認してから） */
export function EditVideoModal({ lib, video, onClose, onDone }: { lib: Library; video: VVideo; onClose: () => void; onDone: (msg: string, deleted?: boolean) => void }) {
  const [name, setName] = useState(video.name)
  const [desc, setDesc] = useState(video.description ?? '')
  const [folder, setFolder] = useState(video.folder ?? lib.root?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)

  async function save() {
    setBusy(true); setError(null)
    try {
      if (name.trim() !== video.name || desc !== (video.description ?? '')) await api(`/api/videos/video/${video.id}`, { method: 'PATCH', body: { name: name.trim(), description: desc } })
      if (folder && folder !== video.folder) await api(`/api/videos/video/${video.id}`, { method: 'PUT', body: { folderId: folder } })
      onDone(`「${name.trim()}」を保存しました`)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false) }
  }
  async function del() {
    setBusy(true); setError(null)
    try { await api(`/api/videos/video/${video.id}`, { method: 'DELETE' }); onDone(`「${video.name}」を削除しました`, true) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false) }
  }

  return (
    <Modal title="動画を編集" onClose={busy ? () => {} : onClose}>
      <div className="space-y-4">
        <Field label="タイトル"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} /></Field>
        <Field label="説明"><textarea className={`${inputCls} resize-y`} rows={5} value={desc} onChange={(e) => setDesc(e.target.value)} disabled={busy} /></Field>
        <Field label="フォルダ">
          <select className={inputCls} value={folder} onChange={(e) => setFolder(e.target.value)} disabled={busy}>
            {folderOptions(lib).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </Field>
        <ErrorBox text={error} />
        {confirmDel && (
          <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-bold">Vimeo から動画を削除します。元に戻せません。</p>
            <div className="mt-3 flex gap-2">
              <button onClick={del} disabled={busy} className="rounded-lg bg-red-700 px-4 py-2 font-bold text-white hover:bg-red-800 disabled:opacity-50">削除する</button>
              <button onClick={() => setConfirmDel(false)} disabled={busy} className={btnSub}>やめる</button>
            </div>
          </div>
        )}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <button onClick={() => setConfirmDel(true)} disabled={busy || confirmDel} className="text-sm font-semibold text-red-700 hover:underline disabled:opacity-50">削除…</button>
        <div className="flex gap-2">
          <button onClick={onClose} disabled={busy} className={btnSub}>キャンセル</button>
          <button onClick={save} disabled={busy || !name.trim()} className={btnPrimary}>保存</button>
        </div>
      </div>
    </Modal>
  )
}

/** フォルダ（カテゴリー）を作る・名前を変える */
export function FolderModal({ lib, parentId, edit, onClose, onDone }: { lib: Library; parentId: string; edit?: { id: string; name: string }; onClose: () => void; onDone: (msg: string) => void }) {
  const [name, setName] = useState(edit?.name ?? '')
  const [parent, setParent] = useState(parentId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function save() {
    setBusy(true); setError(null)
    try {
      if (edit) await api('/api/videos/folder', { method: 'PATCH', body: { id: edit.id, name: name.trim() } })
      else await api('/api/videos/folder', { method: 'POST', body: { name: name.trim(), parent } })
      onDone(edit ? `フォルダ名を「${name.trim()}」にしました` : `フォルダ「${name.trim()}」を作りました`)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false) }
  }
  return (
    <Modal title={edit ? 'フォルダ名を変える' : 'フォルダを作る'} onClose={busy ? () => {} : onClose}>
      <div className="space-y-4">
        <Field label="フォルダ名"><input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} placeholder="例：MTG議事録" /></Field>
        {!edit && (
          <Field label="作る場所" hint="親フォルダの直下＝大カテゴリー、その中＝小カテゴリー">
            <select className={inputCls} value={parent} onChange={(e) => setParent(e.target.value)} disabled={busy}>
              {folderOptions(lib).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>
        )}
        <ErrorBox text={error} />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} disabled={busy} className={btnSub}>キャンセル</button>
        <button onClick={save} disabled={busy || !name.trim()} className={btnPrimary}>{edit ? '保存' : '作る'}</button>
      </div>
    </Modal>
  )
}

type Settings = { root: { id: string; name: string } | null; isAdmin: boolean; token?: { ok: boolean; error?: string; user?: string | null; missing?: string[] }; folders?: { id: string; name: string }[] }

/** 親フォルダ（Vimeo のどのフォルダの中を見せるか）を選ぶ。担当者だけ */
export function SettingsModal({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [s, setS] = useState<Settings | null>(null)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api<Settings>('/api/videos/settings').then((r) => { setS(r); setValue(r.root?.id ?? '') }).catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])
  async function save() {
    setBusy(true); setError(null)
    try {
      const r = await api<{ root: { id: string; name: string } }>('/api/videos/settings', { method: 'PUT', body: { folder: value.trim() } })
      onDone(`親フォルダを「${r.root.name || r.root.id}」にしました`)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false) }
  }
  const t = s?.token
  return (
    <Modal title="社内動画の設定" onClose={busy ? () => {} : onClose}>
      {!s && !error ? <p className="text-black/70">読み込み中…</p> : (
        <div className="space-y-4">
          {t && (!t.ok || (t.missing?.length ?? 0) > 0) && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              {!t.ok ? `Vimeo につながりません：${t.error}` : `Vimeo のトークンに足りない権限があります：${t.missing?.join('・')}（アップロードやフォルダ操作ができないことがあります）`}
            </div>
          )}
          {t?.ok && <p className="text-sm text-black/70">Vimeo アカウント：{t.user ?? '—'}</p>}
          <Field label="親フォルダ（この中だけを社内動画に出します）" hint="中のフォルダが大カテゴリー、その中が小カテゴリーになります。一覧に無いときは Vimeo のフォルダの URL を貼ってください">
            <input className={inputCls} list="vimeo-folders" value={value} onChange={(e) => setValue(e.target.value)} placeholder="フォルダを選ぶか、URL を貼る" disabled={busy} />
            <datalist id="vimeo-folders">{(s?.folders ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</datalist>
          </Field>
          {(s?.folders?.length ?? 0) > 0 && (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border-soft">
              {s!.folders!.map((f) => (
                <button key={f.id} onClick={() => setValue(f.id)} className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accel-lightest ${value === f.id ? 'bg-accel-lightest font-bold' : ''}`}>
                  <span className="text-black">{f.name}</span><span className="text-black/50">{f.id}</span>
                </button>
              ))}
            </div>
          )}
          <ErrorBox text={error} />
        </div>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} disabled={busy} className={btnSub}>キャンセル</button>
        <button onClick={save} disabled={busy || !value.trim()} className={btnPrimary}>保存</button>
      </div>
    </Modal>
  )
}
