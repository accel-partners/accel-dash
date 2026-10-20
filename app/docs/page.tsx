'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { canUseApp, NO_ACCESS_TEXT, NO_ACCESS_HINT } from '@/lib/appAccess'
import { signOut } from '@/lib/auth'
import { DOC_KIND_LABEL, detectKind, normalizeUrl, type DocKind } from '@/lib/docKinds'
import { buildTree, descendants, pathOf, type DocCategory } from '@/lib/docTree'
import {
  LogOut, Plus, Search, Pin, PinOff, Pencil, Trash2, X, ExternalLink, Table2, FileText, Presentation, ClipboardList,
  Folder, File, Link2, ChevronUp, ChevronDown, ChevronRight, ArrowLeft, FolderPlus, Bot,
} from 'lucide-react'

/**
 * 資料置き場（リンク集）。
 *
 * 社内のスプレッドシート・ドキュメント・マニュアルなどへのリンクを、何段でも重ねられるカテゴリー（大カテ › 小カテ › …）に
 * 「説明文＋リンク」で並べる。ファイル本体は持たない。
 * スタッフはここで探して開く。Claude は claude.ai のアドマネージャーの接続から、説明文ごと読む（アクセルダッシュの /api/docs/export）。
 *
 * 見られる・直せる人：担当者と、ポータルで「資料置き場」にチェックした人（RLS: can_use_app('/docs')）。画面のガードは表示用。
 */

interface DocLink {
  id: string
  title: string
  description: string | null
  url: string
  kind: DocKind
  category_id: string | null
  pinned: boolean
  updated_at: string
}
type Draft = { id?: string; title: string; description: string; url: string; category_id: string; pinned: boolean }
type CatDraft = { id?: string; parent_id: string | null; name: string; description: string }

const KIND_STYLE: Record<DocKind, { icon: React.ReactNode; tone: string }> = {
  sheet: { icon: <Table2 size={18} />, tone: 'bg-emerald-50 text-emerald-700' },
  doc: { icon: <FileText size={18} />, tone: 'bg-sky-50 text-sky-700' },
  slide: { icon: <Presentation size={18} />, tone: 'bg-amber-50 text-amber-700' },
  form: { icon: <ClipboardList size={18} />, tone: 'bg-violet-50 text-violet-700' },
  folder: { icon: <Folder size={18} />, tone: 'bg-accel-lightest text-accel-text' },
  pdf: { icon: <File size={18} />, tone: 'bg-rose-50 text-rose-700' },
  file: { icon: <File size={18} />, tone: 'bg-gray-100 text-gray-700' },
  link: { icon: <Link2 size={18} />, tone: 'bg-gray-100 text-gray-700' },
}
const NONE = '__none__'
const ALL = '__all__'

export default function DocsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [allowed, setAllowed] = useState(false)
  const [cats, setCats] = useState<DocCategory[]>([])
  const [links, setLinks] = useState<DocLink[]>([])
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState<string>(ALL)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [draft, setDraft] = useState<Draft | null>(null)
  const [catDraft, setCatDraft] = useState<CatDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'ng'; text: string } | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) { router.push('/login'); return }
      const mail = data.session.user.email ?? ''
      setEmail(mail)
      const ok = await canUseApp('/docs', mail)
      setAllowed(ok)
      if (ok) await fetchAll()
      setLoading(false)
    }
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchAll() {
    const [c, l] = await Promise.all([
      supabase.from('doc_categories').select('id, parent_id, name, description, sort_order'),
      supabase.from('doc_links').select('id, title, description, url, kind, category_id, pinned, updated_at').order('pinned', { ascending: false }).order('title'),
    ])
    const err = c.error ?? l.error
    if (err) {
      const hint = /doc_categories|category_id/.test(err.message) ? ' カテゴリーの表がまだありません。Supabase（共有）の SQL Editor で supabase/docs_tree.sql を実行してください。' : ''
      setNotice({ kind: 'ng', text: `読み込みに失敗しました：${err.message}${hint}` })
      return
    }
    setCats((c.data ?? []) as DocCategory[])
    setLinks((l.data ?? []) as DocLink[])
  }

  const tree = useMemo(() => buildTree(cats), [cats])
  const catById = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats])
  const pathText = (id: string | null) => (id ? pathOf(id, catById).map((c) => c.name).join(' › ') : '未分類')
  const countIn = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of cats) { const ids = new Set([c.id, ...descendants(c.id, tree.children)]); m.set(c.id, links.filter((l) => l.category_id && ids.has(l.category_id)).length) }
    return m
  }, [cats, links, tree])
  const uncategorized = links.filter((l) => !l.category_id || !catById.has(l.category_id))

  const q = query.trim().toLowerCase()
  const hits = q ? links.filter((l) => [l.title, l.description ?? '', l.url, pathText(l.category_id), DOC_KIND_LABEL[l.kind] ?? ''].join(' ').toLowerCase().includes(q)) : []

  function toggle(id: string) { setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n }) }
  function select(id: string) {
    setSel(id); setQuery('')
    if (id !== ALL && id !== NONE) setOpen((s) => new Set([...s, ...pathOf(id, catById).map((c) => c.id)]))
  }

  // ---------- リンク
  function openNew(categoryId?: string) {
    setDraft({ title: '', description: '', url: '', category_id: categoryId ?? (sel !== ALL && sel !== NONE ? sel : ''), pinned: false })
  }
  function openEdit(l: DocLink) {
    setDraft({ id: l.id, title: l.title, description: l.description ?? '', url: l.url, category_id: l.category_id ?? '', pinned: l.pinned })
  }
  async function saveDraft() {
    if (!draft) return
    const url = normalizeUrl(draft.url)
    if (!url || !draft.title.trim()) { setNotice({ kind: 'ng', text: 'URL と名前は必須です' }); return }
    setSaving(true)
    const row = { title: draft.title.trim(), description: draft.description.trim() || null, url, kind: detectKind(url), category_id: draft.category_id || null, pinned: draft.pinned }
    const res = draft.id ? await supabase.from('doc_links').update(row).eq('id', draft.id) : await supabase.from('doc_links').insert(row)
    setSaving(false)
    if (res.error) { setNotice({ kind: 'ng', text: `保存に失敗しました：${res.error.message}` }); return }
    setDraft(null)
    setNotice({ kind: 'ok', text: draft.id ? '更新しました' : '追加しました' })
    await fetchAll()
  }
  async function togglePin(l: DocLink) {
    const { error } = await supabase.from('doc_links').update({ pinned: !l.pinned }).eq('id', l.id)
    if (error) { setNotice({ kind: 'ng', text: `更新に失敗しました：${error.message}` }); return }
    setLinks((prev) => prev.map((x) => (x.id === l.id ? { ...x, pinned: !l.pinned } : x)))
  }
  async function removeLink(l: DocLink) {
    if (!confirm(`「${l.title}」をこの一覧から削除しますか？\n（リンク先のファイルは消えません）`)) return
    const { error } = await supabase.from('doc_links').delete().eq('id', l.id)
    if (error) { setNotice({ kind: 'ng', text: `削除に失敗しました：${error.message}` }); return }
    setLinks((prev) => prev.filter((x) => x.id !== l.id))
  }

  // ---------- カテゴリー
  async function saveCat() {
    if (!catDraft || !catDraft.name.trim()) { setNotice({ kind: 'ng', text: 'カテゴリーの名前を入れてください' }); return }
    setSaving(true)
    const siblings = cats.filter((c) => c.parent_id === catDraft.parent_id)
    const res = catDraft.id
      ? await supabase.from('doc_categories').update({ name: catDraft.name.trim(), description: catDraft.description.trim() || null }).eq('id', catDraft.id)
      : await supabase.from('doc_categories').insert({ parent_id: catDraft.parent_id, name: catDraft.name.trim(), description: catDraft.description.trim() || null, sort_order: Math.max(0, ...siblings.map((c) => c.sort_order)) + 1 }).select('id').single()
    setSaving(false)
    if (res.error) { setNotice({ kind: 'ng', text: `保存に失敗しました：${res.error.message}` }); return }
    setCatDraft(null)
    if (!catDraft.id && res.data && 'id' in res.data) { if (catDraft.parent_id) setOpen((s) => new Set([...s, catDraft.parent_id!])); setSel(String((res.data as { id: string }).id)) }
    await fetchAll()
  }
  async function moveCat(c: DocCategory, dir: -1 | 1) {
    const list = (tree.children.get(c.parent_id ?? '') ?? [])
    const i = list.findIndex((x) => x.id === c.id), j = i + dir
    if (i < 0 || j < 0 || j >= list.length) return
    // 並び順を振り直してから入れ替える
    const order = list.map((x) => x.id)
    ;[order[i], order[j]] = [order[j], order[i]]
    await Promise.all(order.map((id, k) => supabase.from('doc_categories').update({ sort_order: k + 1 }).eq('id', id)))
    await fetchAll()
  }
  async function removeCat(c: DocCategory) {
    const sub = descendants(c.id, tree.children)
    const n = countIn.get(c.id) ?? 0
    const msg = `「${c.name}」を削除しますか？` + (sub.length ? `\n中の小カテゴリー ${sub.length} 個も一緒に消えます。` : '') + (n ? `\n中のリンク ${n} 件は消えずに「未分類」に移ります。` : '')
    if (!confirm(msg)) return
    const { error } = await supabase.from('doc_categories').delete().eq('id', c.id)
    if (error) { setNotice({ kind: 'ng', text: `削除に失敗しました：${error.message}` }); return }
    setSel(c.parent_id ?? ALL)
    await fetchAll()
  }

  async function handleLogout() { await signOut(); router.push('/login') }

  if (loading) return <div className="flex min-h-screen items-center justify-center text-black">読み込み中…</div>

  // ---------- 表示
  const cur = sel !== ALL && sel !== NONE ? catById.get(sel) ?? null : null
  const topLevel = tree.children.get('') ?? []

  const linkList = (list: DocLink[], showPath = false) => (
    <ul className="divide-y divide-border-soft rounded-xl border border-border-soft bg-surface">
      {[...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.title.localeCompare(b.title, 'ja')).map((l) => (
        <LinkRow key={l.id} l={l} path={showPath ? pathText(l.category_id) : null} onEdit={openEdit} onPin={togglePin} onRemove={removeLink} />
      ))}
    </ul>
  )
  /** カテゴリーの中身：説明 → 直下のリンク → 小カテゴリーごと（見出しの深さで段を表す） */
  const section = (c: DocCategory, depth: number): React.ReactNode => {
    const own = links.filter((l) => l.category_id === c.id)
    const kids = tree.children.get(c.id) ?? []
    if (depth > 0 && !own.length && !kids.length && !c.description) return null
    return (
      <section key={c.id} className={depth ? 'mt-6' : ''}>
        {depth > 0 && (
          <button onClick={() => select(c.id)} className={`mb-1 text-left font-bold text-black hover:underline ${depth === 1 ? 'text-base' : 'text-sm'}`}>
            {c.name}<span className="ml-2 text-xs font-normal text-black/40">{countIn.get(c.id) ?? 0} 件</span>
          </button>
        )}
        {depth > 0 && c.description && <p className="mb-2 whitespace-pre-wrap text-xs leading-relaxed text-black/60">{c.description}</p>}
        {own.length > 0 && linkList(own)}
        {kids.map((k) => section(k, depth + 1))}
      </section>
    )
  }

  return (
    <div className="min-h-screen bg-surface-muted">
      <header className="border-b border-border-soft bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-1.5 text-sm text-black/60 hover:text-black"><ArrowLeft size={16} /> ポータル</Link>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="ACCEL DASH" className="h-9 w-auto" />
            <span className="hidden text-lg font-bold text-black sm:inline">資料</span>
          </div>
          <div className="flex items-center gap-4">
            {email && <span className="text-sm text-black/70">{email}</span>}
            <button onClick={handleLogout} className="flex items-center gap-2 rounded-lg border-2 border-border-soft bg-surface px-4 py-2 text-black hover:border-accel-secondary"><LogOut size={18} />ログアウト</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {notice && (
          <div className={notice.kind === 'ok' ? 'mb-6 flex items-start justify-between gap-4 rounded-lg bg-accel-lightest px-5 py-3 text-black' : 'mb-6 flex items-start justify-between gap-4 rounded-lg bg-red-50 px-5 py-3 text-red-800'}>
            <span className="text-sm">{notice.text}</span>
            <button onClick={() => setNotice(null)} aria-label="閉じる" className="shrink-0 p-0"><X size={16} /></button>
          </div>
        )}

        {!allowed ? (
          <div className="rounded-xl border border-border-soft bg-surface p-10 text-center text-black/70">{NO_ACCESS_TEXT}<br /><span className="text-sm">{NO_ACCESS_HINT}</span></div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-black">資料置き場</h1>
                <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-black/60">
                  社内のスプレッドシート・ドキュメント・マニュアルのリンク集。説明文も含めて Claude が読めます
                  <span className="inline-flex items-center gap-1 rounded-full bg-accel-lightest px-2 py-0.5 text-xs text-accel-text" title="claude.ai でアドマネージャーの接続をオンにすると、Claude がこのリンク集を説明ごと読み、スプレッドシートの中身も開けます"><Bot size={12} />Claude 対応</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setCatDraft({ parent_id: null, name: '', description: '' })} className="flex items-center gap-1.5 rounded-lg border-2 border-border-soft bg-surface px-3.5 py-2 text-sm font-semibold text-black hover:border-accel-secondary"><FolderPlus size={16} /> 大カテゴリー</button>
                <button onClick={() => openNew()} className="flex items-center gap-1.5 rounded-lg bg-accel-primary px-4 py-2 text-sm font-bold text-white hover:bg-accel-hover"><Plus size={16} /> リンクを追加</button>
              </div>
            </div>

            <div className="relative mb-6">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="名前・説明・カテゴリー・URL で検索"
                className="w-full rounded-xl border-2 border-border-soft bg-surface py-3 pl-12 pr-4 text-black outline-none focus:border-accel-primary" />
            </div>

            <div className="grid gap-6 md:grid-cols-[260px_1fr]">
              {/* カテゴリーの木 */}
              <nav className="h-fit rounded-xl border border-border-soft bg-surface p-2 text-sm md:sticky md:top-4">
                <TreeItem label="すべて" count={links.length} active={sel === ALL && !q} onClick={() => select(ALL)} />
                {topLevel.map((c) => (
                  <TreeNode key={c.id} c={c} depth={0} childrenMap={tree.children} open={open} sel={q ? '' : sel} countIn={countIn} onToggle={toggle} onSelect={select} />
                ))}
                {uncategorized.length > 0 && <TreeItem label="未分類" count={uncategorized.length} active={sel === NONE && !q} onClick={() => select(NONE)} />}
              </nav>

              {/* 中身 */}
              <div className="min-w-0">
                {q ? (
                  <>
                    <h2 className="mb-3 text-sm font-bold text-black/70">「{query.trim()}」の検索結果（{hits.length} 件）</h2>
                    {hits.length ? linkList(hits, true) : <Empty text="当てはまるリンクがありません。" />}
                  </>
                ) : sel === NONE ? (
                  <>
                    <h2 className="mb-3 text-lg font-bold text-black">未分類</h2>
                    {linkList(uncategorized)}
                  </>
                ) : cur ? (
                  <>
                    <div className="mb-1 text-xs text-black/50">
                      <button onClick={() => select(ALL)} className="hover:underline">すべて</button>
                      {pathOf(cur.id, catById).slice(0, -1).map((p) => <span key={p.id}> › <button onClick={() => select(p.id)} className="hover:underline">{p.name}</button></span>)}
                    </div>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-black">{cur.name}</h2>
                      <span className="text-sm text-black/40">{countIn.get(cur.id) ?? 0} 件</span>
                      <span className="flex-1" />
                      <IconBtn title="上へ" onClick={() => moveCat(cur, -1)}><ChevronUp size={14} /></IconBtn>
                      <IconBtn title="下へ" onClick={() => moveCat(cur, 1)}><ChevronDown size={14} /></IconBtn>
                      <IconBtn title="名前・説明を直す" onClick={() => setCatDraft({ id: cur.id, parent_id: cur.parent_id, name: cur.name, description: cur.description ?? '' })}><Pencil size={14} /></IconBtn>
                      <IconBtn title="このカテゴリーを削除" danger onClick={() => removeCat(cur)}><Trash2 size={14} /></IconBtn>
                    </div>
                    {cur.description && <p className="mb-4 whitespace-pre-wrap rounded-lg bg-surface px-4 py-3 text-sm leading-relaxed text-black/70 ring-1 ring-border-soft">{cur.description}</p>}
                    <div className="mb-4 flex flex-wrap gap-2">
                      <button onClick={() => openNew(cur.id)} className="flex items-center gap-1.5 rounded-lg bg-accel-primary px-3 py-1.5 text-sm font-bold text-white hover:bg-accel-hover"><Plus size={14} /> ここにリンクを追加</button>
                      <button onClick={() => setCatDraft({ parent_id: cur.id, name: '', description: '' })} className="flex items-center gap-1.5 rounded-lg border-2 border-border-soft bg-surface px-3 py-1.5 text-sm font-semibold text-black hover:border-accel-secondary"><FolderPlus size={14} /> 小カテゴリーを追加</button>
                    </div>
                    {(countIn.get(cur.id) ?? 0) === 0 && !(tree.children.get(cur.id) ?? []).length ? <Empty text="まだリンクがありません。" /> : section(cur, 0)}
                  </>
                ) : links.length === 0 && cats.length === 0 ? (
                  <Empty text="まだリンクがありません。「大カテゴリー」を作ってから「リンクを追加」で入れてください。" />
                ) : (
                  <>
                    {links.some((l) => l.pinned) && (
                      <section className="mb-8">
                        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-black/70"><Pin size={14} /> 重要</h2>
                        {linkList(links.filter((l) => l.pinned), true)}
                      </section>
                    )}
                    {topLevel.map((c) => (
                      <section key={c.id} className="mb-8">
                        <button onClick={() => select(c.id)} className="mb-1 text-left text-lg font-bold text-black hover:underline">{c.name}<span className="ml-2 text-xs font-normal text-black/40">{countIn.get(c.id) ?? 0} 件</span></button>
                        {c.description && <p className="mb-2 whitespace-pre-wrap text-xs leading-relaxed text-black/60">{c.description}</p>}
                        {section(c, 0)}
                      </section>
                    ))}
                    {uncategorized.length > 0 && (
                      <section className="mb-8"><h2 className="mb-2 text-lg font-bold text-black">未分類</h2>{linkList(uncategorized)}</section>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* リンクの追加・編集 */}
      {draft && (
        <Modal title={draft.id ? 'リンクを編集' : 'リンクを追加'} onClose={() => setDraft(null)}>
          <div className="space-y-4">
            <Field label="URL">
              <input type="url" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://docs.google.com/spreadsheets/d/..." autoFocus className={INPUT} />
              {draft.url.trim() && <p className="mt-1.5 text-xs text-black/60">種類：{DOC_KIND_LABEL[detectKind(normalizeUrl(draft.url))]}</p>}
            </Field>
            <Field label="名前"><input type="text" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="例：案件管理シート 2026" className={INPUT} /></Field>
            <Field label="説明（Claude もこれを読んで使い道を判断します）">
              <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={4} placeholder="例：受任案件の進行状況。週次で更新。1 行 = 1 案件、担当者・期日・状態の列あり" className={INPUT} />
            </Field>
            <Field label="カテゴリー">
              <select value={draft.category_id} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })} className={INPUT}>
                <option value="">（未分類）</option>
                {tree.flat.map(({ c, depth }) => <option key={c.id} value={c.id}>{'　'.repeat(depth)}{c.name}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-black"><input type="checkbox" checked={draft.pinned} onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })} className="h-4 w-4" />重要として「すべて」の先頭に出す</label>
          </div>
          <ModalButtons saving={saving} label={draft.id ? '更新する' : '追加する'} onSave={saveDraft} onCancel={() => setDraft(null)} />
        </Modal>
      )}

      {/* カテゴリーの追加・編集 */}
      {catDraft && (
        <Modal title={catDraft.id ? 'カテゴリーを直す' : catDraft.parent_id ? `「${catById.get(catDraft.parent_id)?.name ?? ''}」の下に小カテゴリーを追加` : '大カテゴリーを追加'} onClose={() => setCatDraft(null)}>
          <div className="space-y-4">
            <Field label="名前"><input value={catDraft.name} onChange={(e) => setCatDraft({ ...catDraft, name: e.target.value })} autoFocus placeholder="例：広告運用 ／ レポート" className={INPUT} /></Field>
            <Field label="説明（任意。Claude もこれを読みます）"><textarea value={catDraft.description} onChange={(e) => setCatDraft({ ...catDraft, description: e.target.value })} rows={3} placeholder="例：クライアントへの月次レポートの元データと雛形" className={INPUT} /></Field>
          </div>
          <ModalButtons saving={saving} label={catDraft.id ? '更新する' : '追加する'} onSave={saveCat} onCancel={() => setCatDraft(null)} />
        </Modal>
      )}
    </div>
  )
}

const INPUT = 'w-full rounded-lg border-2 border-border-soft bg-surface px-3 py-2.5 text-black outline-none focus:border-accel-primary'

function TreeItem({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left ${active ? 'bg-accel-lightest font-bold text-accel-text' : 'text-black hover:bg-surface-muted'}`}>
      <span className="min-w-0 flex-1 truncate">{label}</span><span className="text-xs text-black/40">{count}</span>
    </button>
  )
}

function TreeNode({ c, depth, childrenMap, open, sel, countIn, onToggle, onSelect }: {
  c: DocCategory; depth: number; childrenMap: Map<string, DocCategory[]>; open: Set<string>; sel: string; countIn: Map<string, number>
  onToggle: (id: string) => void; onSelect: (id: string) => void
}) {
  const kids = childrenMap.get(c.id) ?? []
  const isOpen = open.has(c.id)
  return (
    <div>
      <div className={`flex items-center rounded-lg ${sel === c.id ? 'bg-accel-lightest font-bold text-accel-text' : 'text-black hover:bg-surface-muted'}`} style={{ paddingLeft: 4 + depth * 14 }}>
        <button onClick={() => onToggle(c.id)} className={`flex h-7 w-6 shrink-0 items-center justify-center text-black/40 ${kids.length ? '' : 'invisible'}`} aria-label={isOpen ? '閉じる' : '開く'}>
          <ChevronRight size={14} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        </button>
        <button onClick={() => onSelect(c.id)} className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-3 text-left">
          <span className="min-w-0 flex-1 truncate">{c.name}</span><span className="text-xs font-normal text-black/40">{countIn.get(c.id) ?? 0}</span>
        </button>
      </div>
      {isOpen && kids.map((k) => <TreeNode key={k.id} c={k} depth={depth + 1} childrenMap={childrenMap} open={open} sel={sel} countIn={countIn} onToggle={onToggle} onSelect={onSelect} />)}
    </div>
  )
}

function LinkRow({ l, path, onEdit, onPin, onRemove }: { l: DocLink; path: string | null; onEdit: (l: DocLink) => void; onPin: (l: DocLink) => void; onRemove: (l: DocLink) => void }) {
  const st = KIND_STYLE[l.kind] ?? KIND_STYLE.link
  return (
    <li className="group flex items-start gap-3 px-4 py-3">
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${st.tone}`}>{st.icon}</span>
      <a href={l.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
        <p className="font-bold leading-snug text-black">
          {l.pinned && <Pin size={12} className="mr-1 inline-block text-accel-text" />}{l.title}<ExternalLink size={12} className="ml-1 inline-block text-black/30" />
        </p>
        {l.description && <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-black/60">{l.description}</p>}
        <p className="mt-1 text-[11px] text-black/40">{path ? `${path}・` : ''}{DOC_KIND_LABEL[l.kind]}</p>
      </a>
      <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
        <IconBtn title={l.pinned ? '重要を外す' : '重要にする'} onClick={() => onPin(l)}>{l.pinned ? <PinOff size={14} /> : <Pin size={14} />}</IconBtn>
        <IconBtn title="編集" onClick={() => onEdit(l)}><Pencil size={14} /></IconBtn>
        <IconBtn title="削除" danger onClick={() => onRemove(l)}><Trash2 size={14} /></IconBtn>
      </div>
    </li>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border-2 border-dashed border-border-soft bg-surface p-10 text-center text-sm text-black/60">{text}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1.5 block text-xs font-semibold text-black/60">{label}</label>{children}</div>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-black">{title}</h2>
          <button onClick={onClose} aria-label="閉じる" className="text-black/50 hover:text-black"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalButtons({ saving, label, onSave, onCancel }: { saving: boolean; label: string; onSave: () => void; onCancel: () => void }) {
  return (
    <div className="mt-6 flex gap-3">
      <button onClick={onSave} disabled={saving} className="flex-1 rounded-lg bg-accel-primary px-4 py-3 font-bold text-white hover:bg-accel-hover disabled:opacity-60">{saving ? '保存中…' : label}</button>
      <button onClick={onCancel} className="rounded-lg border-2 border-border-soft px-5 py-3 text-black hover:bg-surface-muted">キャンセル</button>
    </div>
  )
}

function IconBtn({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-black/50 transition-colors ${danger ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-accel-lightest hover:text-accel-text'}`}>
      {children}
    </button>
  )
}
