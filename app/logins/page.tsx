'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { canUseApp, NO_ACCESS_TEXT, NO_ACCESS_HINT } from '@/lib/appAccess'
import { signOut } from '@/lib/auth'
import { normalizeUrl } from '@/lib/docKinds'
import { ArrowLeft, Copy, ExternalLink, KeyRound, Lock, LogOut, Pencil, Plus, Search, ShieldCheck, Trash2, X } from 'lucide-react'

/**
 * ログインリンク集。
 * 社内で使うサービスの「ログイン URL・ログイン ID・担当・2 段階認証の場所・パスワードの置き場所（パスワードマネージャーのリンク）」の一覧。
 * ★パスワードそのものは入れない。パスワードはパスワードマネージャーに置き、ここにはそこへのリンクだけを持つ。
 * 見られる人：担当者と、ポータルで「ログインリンク集」にチェックした人。「限定」にした項目は、選んだ人・作った人・二宮だけ（RLS）。
 * Claude（claude.ai の接続）には渡さない。
 */

interface Entry {
  id: string
  category: string | null
  service: string
  login_url: string | null
  account_id: string | null
  owner: string | null
  mfa: string | null
  vault_url: string | null
  note: string | null
  restricted: boolean
  allowed_emails: string[]
  sort_order: number
  updated_at: string
}
type Draft = Omit<Entry, 'id' | 'updated_at' | 'sort_order' | 'allowed_emails'> & { id?: string; allowed: string }
const EMPTY: Draft = { category: '', service: '', login_url: '', account_id: '', owner: '', mfa: '', vault_url: '', note: '', restricted: false, allowed: '' }
const INPUT = 'w-full rounded-lg border-2 border-border-soft bg-surface px-3 py-2.5 text-black outline-none focus:border-accel-primary'
const NONE = '（分類なし）'
/** パスワードを書いてしまっていそうなとき */
const looksLikePassword = (s: string) => /(パスワード|パス|password|passwd|pass|pw)\s*[:：=]\s*\S/i.test(s)

export default function LoginsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [allowed, setAllowed] = useState(false)
  const [list, setList] = useState<Entry[]>([])
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'ng'; text: string } | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) { router.push('/login'); return }
      const mail = data.session.user.email ?? ''
      setEmail(mail)
      const ok = await canUseApp('/logins', mail)
      setAllowed(ok)
      if (ok) await fetchAll()
      setLoading(false)
    }
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchAll() {
    const { data, error } = await supabase.from('login_entries').select('*').order('sort_order').order('service')
    if (error) {
      setNotice({ kind: 'ng', text: `読み込みに失敗しました：${error.message}${/login_entries/.test(error.message) ? '（Supabase（共有）の SQL Editor で supabase/logins.sql を実行してください）' : ''}` })
      return
    }
    setList((data ?? []) as Entry[])
  }

  const categories = useMemo(() => [...new Set(list.map((e) => e.category?.trim() || NONE))].sort((a, b) => (a === NONE ? 1 : b === NONE ? -1 : a.localeCompare(b, 'ja'))), [list])
  const q = query.trim().toLowerCase()
  const shown = q ? list.filter((e) => [e.service, e.category, e.login_url, e.account_id, e.owner, e.mfa, e.note].join(' ').toLowerCase().includes(q)) : list

  async function copy(text: string, what: string) {
    await navigator.clipboard.writeText(text)
    setNotice({ kind: 'ok', text: `${what}をコピーしました` })
  }

  function openNew(category?: string) { setDraft({ ...EMPTY, category: category && category !== NONE ? category : '' }) }
  function openEdit(e: Entry) {
    setDraft({ id: e.id, category: e.category ?? '', service: e.service, login_url: e.login_url ?? '', account_id: e.account_id ?? '', owner: e.owner ?? '', mfa: e.mfa ?? '', vault_url: e.vault_url ?? '', note: e.note ?? '', restricted: e.restricted, allowed: e.allowed_emails.join(', ') })
  }
  async function save() {
    if (!draft) return
    if (!draft.service.trim()) { setNotice({ kind: 'ng', text: 'サービス名を入れてください' }); return }
    if ([draft.note, draft.mfa, draft.account_id, draft.owner].some((s) => looksLikePassword(s ?? '')) && !confirm('パスワードのような文字が入っています。ここにはパスワードを書かず、パスワードマネージャーに置いてください。\nこのまま保存しますか？')) return
    const emails = draft.allowed.split(/[,，;；\s]+/).map((s) => s.trim().toLowerCase()).filter((s) => /^[^@\s]+@[^@\s]+$/.test(s))
    if (draft.restricted && !emails.length && !confirm('「限定」にしましたが、見られる人が入っていません。作った人と二宮だけが見られます。よろしいですか？')) return
    setSaving(true)
    const row = {
      category: draft.category?.trim() || null, service: draft.service.trim(),
      login_url: draft.login_url?.trim() ? normalizeUrl(draft.login_url) : null, account_id: draft.account_id?.trim() || null,
      owner: draft.owner?.trim() || null, mfa: draft.mfa?.trim() || null, vault_url: draft.vault_url?.trim() ? normalizeUrl(draft.vault_url) : null,
      note: draft.note?.trim() || null, restricted: draft.restricted, allowed_emails: draft.restricted ? emails : [],
    }
    const res = draft.id ? await supabase.from('login_entries').update(row).eq('id', draft.id) : await supabase.from('login_entries').insert(row)
    setSaving(false)
    if (res.error) { setNotice({ kind: 'ng', text: `保存に失敗しました：${res.error.message}` }); return }
    setDraft(null)
    setNotice({ kind: 'ok', text: draft.id ? '更新しました' : '追加しました' })
    await fetchAll()
  }
  async function remove(e: Entry) {
    if (!confirm(`「${e.service}」をこの一覧から削除しますか？（サービスのアカウントやパスワードは消えません）`)) return
    const { error } = await supabase.from('login_entries').delete().eq('id', e.id)
    if (error) { setNotice({ kind: 'ng', text: `削除に失敗しました：${error.message}` }); return }
    setList((p) => p.filter((x) => x.id !== e.id))
  }

  async function handleLogout() { await signOut(); router.push('/login') }
  if (loading) return <div className="flex min-h-screen items-center justify-center text-black">読み込み中…</div>

  const row = (e: Entry) => (
    <li key={e.id} className="group flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accel-lightest text-accel-text"><KeyRound size={18} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2">
          {e.login_url ? (
            <a href={e.login_url} target="_blank" rel="noopener noreferrer" className="font-bold text-black hover:underline">{e.service}<ExternalLink size={12} className="ml-1 inline-block text-black/30" /></a>
          ) : <span className="font-bold text-black">{e.service}</span>}
          {e.restricted && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700" title={`見られる人：${e.allowed_emails.join('、') || '作った人と二宮だけ'}`}><Lock size={11} />限定</span>}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/70">
          {e.account_id && (
            <span className="inline-flex items-center gap-1">ID：<span className="font-mono">{e.account_id}</span>
              <button type="button" onClick={() => copy(e.account_id!, 'ログイン ID ')} className="text-black/40 hover:text-black" title="ID をコピー" aria-label="ID をコピー"><Copy size={12} /></button>
            </span>
          )}
          {e.owner && <span>担当：{e.owner}</span>}
          {e.mfa && <span className="inline-flex items-center gap-1"><ShieldCheck size={12} className="text-emerald-600" />2 段階認証：{e.mfa}</span>}
        </div>
        {e.note && <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-black/60">{e.note}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {e.vault_url ? (
          <a href={e.vault_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border-2 border-border-soft px-2.5 py-1 text-xs font-semibold text-black hover:border-accel-secondary"><KeyRound size={12} />パスワード</a>
        ) : <span className="px-2 text-[11px] text-black/30" title="パスワードマネージャーの項目のリンクを入れると、ここから開けます">置き場所 未登録</span>}
        <span className="flex items-center sm:hidden sm:group-hover:flex">
          <IconBtn title="編集" onClick={() => openEdit(e)}><Pencil size={14} /></IconBtn>
          <IconBtn title="削除" danger onClick={() => remove(e)}><Trash2 size={14} /></IconBtn>
        </span>
      </div>
    </li>
  )

  return (
    <div className="min-h-screen bg-surface-muted">
      <header className="border-b border-border-soft bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-1.5 text-sm text-black/60 hover:text-black"><ArrowLeft size={16} /> ポータル</Link>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="ACCEL DASH" className="h-9 w-auto" />
            <span className="hidden text-lg font-bold text-black sm:inline">ログイン</span>
          </div>
          <div className="flex items-center gap-4">
            {email && <span className="text-sm text-black/70">{email}</span>}
            <button onClick={handleLogout} className="flex items-center gap-2 rounded-lg border-2 border-border-soft bg-surface px-4 py-2 text-black hover:border-accel-secondary"><LogOut size={18} />ログアウト</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
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
                <h1 className="text-2xl font-bold text-black">ログインリンク集</h1>
                <p className="mt-1 text-sm text-black/60">社内で使うサービスのログイン先・ID・担当・パスワードの置き場所。<b>パスワードはここに書かず</b>、パスワードマネージャーに置いてください。</p>
              </div>
              <button onClick={() => openNew()} className="flex items-center gap-1.5 rounded-lg bg-accel-primary px-4 py-2 text-sm font-bold text-white hover:bg-accel-hover"><Plus size={16} /> サービスを追加</button>
            </div>
            <div className="relative mb-6">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="サービス名・ID・担当・メモで検索" className="w-full rounded-xl border-2 border-border-soft bg-surface py-3 pl-12 pr-4 text-black outline-none focus:border-accel-primary" />
            </div>
            {list.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-border-soft bg-surface p-10 text-center text-sm text-black/60">まだありません。「サービスを追加」で、よく使う管理画面から入れてください。</div>
            ) : q ? (
              shown.length ? <ul className="divide-y divide-border-soft rounded-xl border border-border-soft bg-surface">{shown.map(row)}</ul> : <div className="rounded-xl border border-border-soft bg-surface p-10 text-center text-sm text-black/60">当てはまるものがありません。</div>
            ) : (
              <div className="flex flex-col gap-4">
                {categories.map((c) => {
                  const items = list.filter((e) => (e.category?.trim() || NONE) === c)
                  return (
                    <section key={c} className="overflow-hidden rounded-xl border border-border-soft bg-surface">
                      <div className="flex items-center border-b border-border-soft bg-accel-lightest/60 px-4 py-2.5 font-bold text-black">{c}<span className="ml-2 text-xs font-normal text-black/40">{items.length} 件</span></div>
                      <ul className="divide-y divide-border-soft">{items.map(row)}</ul>
                      <button onClick={() => openNew(c)} className="flex w-full items-center gap-1 border-t border-border-soft px-4 py-2 text-left text-xs text-black/50 hover:bg-surface-muted hover:text-black"><Plus size={12} />ここにサービスを追加</button>
                    </section>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>

      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDraft(null)}>
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-black">{draft.id ? 'サービスを編集' : 'サービスを追加'}</h2>
              <button onClick={() => setDraft(null)} aria-label="閉じる" className="text-black/50 hover:text-black"><X size={20} /></button>
            </div>
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">パスワードは入れないでください。パスワードマネージャーにその項目を作り、そのリンクを「パスワードの置き場所」に貼ります。</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="サービス名 *"><input value={draft.service} onChange={(e) => setDraft({ ...draft, service: e.target.value })} placeholder="例：Google 広告（MCC）" autoFocus className={INPUT} /></F>
              <F label="分類"><input value={draft.category ?? ''} onChange={(e) => setDraft({ ...draft, category: e.target.value })} list="login-cats" placeholder="例：広告媒体 ／ 経理 ／ 社内ツール" className={INPUT} />
                <datalist id="login-cats">{categories.filter((c) => c !== NONE).map((c) => <option key={c} value={c} />)}</datalist></F>
              <F label="ログイン URL" wide><input value={draft.login_url ?? ''} onChange={(e) => setDraft({ ...draft, login_url: e.target.value })} placeholder="https://ads.google.com/" className={INPUT} /></F>
              <F label="ログイン ID（メールアドレスなど）"><input value={draft.account_id ?? ''} onChange={(e) => setDraft({ ...draft, account_id: e.target.value })} placeholder="ads@accel-partners.co.jp" className={INPUT} /></F>
              <F label="担当"><input value={draft.owner ?? ''} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} placeholder="例：二宮・高橋" className={INPUT} /></F>
              <F label="2 段階認証" wide><input value={draft.mfa ?? ''} onChange={(e) => setDraft({ ...draft, mfa: e.target.value })} placeholder="例：二宮のスマホ（Google 認証システム）／ 会社携帯の SMS" className={INPUT} /></F>
              <F label="パスワードの置き場所（パスワードマネージャーの項目のリンク）" wide><input value={draft.vault_url ?? ''} onChange={(e) => setDraft({ ...draft, vault_url: e.target.value })} placeholder="1Password・Bitwarden などで項目を開いて「リンクをコピー」したもの" className={INPUT} /></F>
              <F label="メモ" wide><textarea value={draft.note ?? ''} onChange={(e) => setDraft({ ...draft, note: e.target.value })} rows={3} placeholder="例：契約は年払い（4 月更新）。権限の追加は二宮に依頼" className={INPUT} /></F>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm text-black"><input type="checkbox" checked={draft.restricted} onChange={(e) => setDraft({ ...draft, restricted: e.target.checked })} className="h-4 w-4" /><Lock size={14} />限定（選んだ人だけが見られる）</label>
                {draft.restricted && (
                  <div className="mt-2">
                    <input value={draft.allowed} onChange={(e) => setDraft({ ...draft, allowed: e.target.value })} placeholder="見られる人のメールアドレス（カンマ区切り）" className={INPUT} />
                    <p className="mt-1 text-xs text-black/50">ここに入れた人・作った人・二宮だけに表示されます（ほかの人には一覧にも出ません）。</p>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={save} disabled={saving} className="flex-1 rounded-lg bg-accel-primary px-4 py-3 font-bold text-white hover:bg-accel-hover disabled:opacity-60">{saving ? '保存中…' : draft.id ? '更新する' : '追加する'}</button>
              <button onClick={() => setDraft(null)} className="rounded-lg border-2 border-border-soft px-5 py-3 text-black hover:bg-surface-muted">キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function F({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <div className={wide ? 'sm:col-span-2' : ''}><label className="mb-1.5 block text-xs font-semibold text-black/60">{label}</label>{children}</div>
}

function IconBtn({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-black/50 transition-colors ${danger ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-accel-lightest hover:text-accel-text'}`}>
      {children}
    </button>
  )
}
